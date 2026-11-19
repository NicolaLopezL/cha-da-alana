import "server-only";
import { after } from "next/server";
import { z } from "zod";
import { deadlinePassed } from "@/lib/format";
import type { GuestWithRsvp, PublicGuest, RsvpAttending, RsvpResponse, RsvpSource } from "@/lib/types";
import { dispatchExternalNotices } from "./notify";
import { isValidTokenShape, nameKey, newInviteToken, rateLimit, verifyTurnstile } from "./security";
import { getStore } from "./store";

export const rsvpSchema = z.object({
  token: z.string().trim().max(64).optional().default(""),
  name: z.string().trim().max(120).optional().default(""),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .default("")
    .transform((v) => v.replace(/\D/g, "")),
  attending: z.enum(["yes", "no"]),
  people: z.coerce.number().int().min(0).max(20),
  message: z.string().trim().max(500).optional().default(""),
  /** Campo invisível: robôs costumam preenchê-lo. */
  website: z.string().max(200).optional().default(""),
  turnstileToken: z.string().max(4000).optional(),
});

export type RsvpPayload = z.input<typeof rsvpSchema>;

export type RsvpResult =
  | { ok: true; attending: RsvpAttending; people: number; token: string; updated: boolean }
  | { ok: false; error: string; field?: string };

export function toPublicGuest(g: GuestWithRsvp): PublicGuest {
  return {
    token: g.token,
    name: g.name,
    groupName: g.groupName,
    maxPeople: g.maxPeople,
    rsvp: g.rsvp ? { attending: g.rsvp.attending, people: g.rsvp.people, message: g.rsvp.message } : null,
  };
}

function describe(guest: GuestWithRsvp, r: RsvpResponse): { title: string; body: string } {
  const who = guest.groupName ? `${guest.name} (${guest.groupName})` : guest.name;
  const title =
    r.attending === "yes"
      ? `${who} confirmou presença — ${r.people} ${r.people === 1 ? "pessoa" : "pessoas"}`
      : `${who} não poderá comparecer`;
  const via = r.source === "whatsapp_manual" ? "Registrado manualmente (WhatsApp)" : r.source === "admin" ? "Registrado pelo painel" : "Pelo site";
  const body = [via, r.message ? `Recado: “${r.message}”` : ""].filter(Boolean).join("\n");
  return { title, body };
}

/**
 * Registra uma resposta, cria/atualiza notificação (sem duplicar) e grava histórico.
 * Usada pelo site e pelo registro manual no painel.
 */
export async function recordRsvp(
  guest: GuestWithRsvp,
  input: { attending: RsvpAttending; people: number; message: string; source: RsvpSource },
  actor: string,
): Promise<{ response: RsvpResponse; changed: boolean; updated: boolean }> {
  const store = getStore();
  const { response, previous } = await store.upsertRsvp(guest.id, input);
  const changed =
    !previous ||
    previous.attending !== response.attending ||
    previous.people !== response.people ||
    previous.message !== response.message;

  if (changed) {
    const { title, body } = describe(guest, response);
    const kind = previous ? "rsvp_updated" : "rsvp_new";
    const pending = await store.findUnreadNotificationForGuest(guest.id);
    if (pending) await store.updateNotification(pending.id, { kind: pending.kind === "rsvp_new" ? "rsvp_new" : kind, title, body });
    else await store.createNotification({ kind, guestId: guest.id, title, body });

    await store.addAudit({
      actor,
      action: previous ? "rsvp.update" : "rsvp.create",
      entity: "rsvp",
      entityId: guest.id,
      details: {
        guest: guest.name,
        attending: response.attending,
        people: response.people,
        source: response.source,
        ...(previous ? { before: { attending: previous.attending, people: previous.people } } : {}),
      },
    });

    if (response.source === "site") {
      const settings = await store.getSettings();
      after(() => dispatchExternalNotices(settings, { guestName: guest.name, title, body }));
    }
  }
  return { response, changed, updated: Boolean(previous) };
}

export async function submitRsvp(raw: unknown): Promise<RsvpResult> {
  const parsed = rsvpSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Confira os dados informados." };
  const data = parsed.data;

  // Honeypot: responde como sucesso para não ensinar o robô, mas não grava nada.
  if (data.website) return { ok: true, attending: data.attending, people: data.people, token: "", updated: false };

  if (!(await rateLimit("rsvp", 12, 600))) {
    return { ok: false, error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente." };
  }

  const store = getStore();
  const settings = await store.getSettings();
  if (deadlinePassed(settings.rsvpDeadline)) {
    return { ok: false, error: "O prazo de confirmação foi encerrado. Fale com os papais pelo WhatsApp." };
  }

  let guest: GuestWithRsvp | null = null;

  if (data.token) {
    if (!isValidTokenShape(data.token)) return { ok: false, error: "Convite não encontrado." };
    guest = await store.getGuestByToken(data.token);
    if (!guest) return { ok: false, error: "Convite não encontrado." };
  } else {
    if (!settings.genericInviteEnabled) return { ok: false, error: "Use o link pessoal que você recebeu para confirmar." };
    if (data.name.length < 3 || !/\p{L}{2,}/u.test(data.name)) {
      return { ok: false, error: "Informe seu nome completo.", field: "name" };
    }
    if (data.phone && (data.phone.length < 10 || data.phone.length > 13)) {
      return { ok: false, error: "Telefone inválido. Use DDD + número.", field: "phone" };
    }
    if (!(await verifyTurnstile(data.turnstileToken))) {
      return { ok: false, error: "Não foi possível verificar que você não é um robô. Tente novamente." };
    }
    const key = nameKey(data.name);
    guest = await store.findGuestByNameKey(key, data.phone);
    if (!guest) {
      const created = await store.createGuest(
        {
          name: data.name,
          groupName: "",
          maxPeople: settings.genericMaxPeople,
          phone: data.phone,
          internalNotes: "Respondeu pelo convite aberto.",
          origin: "generic",
        },
        newInviteToken(),
        key,
      );
      guest = { ...created, rsvp: null };
    }
  }

  const people = data.attending === "no" ? 0 : data.people;
  if (data.attending === "yes" && (people < 1 || people > guest.maxPeople)) {
    return {
      ok: false,
      field: "people",
      error:
        guest.maxPeople === 1
          ? "Este convite é para 1 pessoa."
          : `Este convite permite de 1 a ${guest.maxPeople} pessoas.`,
    };
  }

  try {
    const { updated } = await recordRsvp(
      guest,
      { attending: data.attending, people, message: data.message, source: "site" },
      `convidado:${guest.name}`,
    );
    return { ok: true, attending: data.attending, people, token: guest.token, updated };
  } catch (e) {
    console.error("[rsvp]", e);
    if ((e as Error).message === "people_out_of_range") {
      return { ok: false, field: "people", error: `Este convite permite até ${guest.maxPeople} pessoas.` };
    }
    return { ok: false, error: "Não conseguimos salvar agora. Tente novamente em instantes." };
  }
}
