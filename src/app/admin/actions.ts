"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { defaultSettings, settingsSchema, type Settings } from "@/lib/settings";
import { requireAdmin, signIn, signOut } from "@/lib/server/auth";
import { isValidSubscription, pushPublicKey, removePushSubscription, savePushSubscription, sendPush } from "@/lib/server/push";
import { recordRsvp } from "@/lib/server/rsvp";
import { assertSameOrigin, nameKey, newInviteToken, rateLimit } from "@/lib/server/security";
import { getStore } from "@/lib/server/store";

export type ActionState = { ok: boolean; message: string; at?: number } | null;

const ok = (message: string): ActionState => ({ ok: true, message, at: Date.now() });
const fail = (message: string): ActionState => ({ ok: false, message, at: Date.now() });

async function guard() {
  await assertSameOrigin();
  return requireAdmin();
}

function refreshAll() {
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertSameOrigin();
  } catch {
    return fail("Requisição não permitida.");
  }
  if (!(await rateLimit("login", 8, 900))) return fail("Muitas tentativas. Aguarde 15 minutos e tente novamente.");
  const email = String(form.get("email") ?? "").slice(0, 200);
  const password = String(form.get("password") ?? "").slice(0, 200);
  if (!email || !password) return fail("Informe e-mail e senha.");
  const res = await signIn(email, password);
  if (!res.ok) return fail(res.error);
  redirect("/admin");
}

export async function logoutAction() {
  await signOut();
  redirect("/admin/login");
}

/* ------------------------------------------------------------------ */
/* Configurações do evento e personalização                            */
/* ------------------------------------------------------------------ */

const settingKeys = Object.keys(defaultSettings) as (keyof Settings)[];

/** Converte o formulário (somente os campos presentes) e mescla com as configurações atuais. */
function mergeSettingsForm(current: Settings, form: FormData): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current };
  const booleans = String(form.get("__booleans") ?? "")
    .split(",")
    .filter(Boolean);
  for (const key of settingKeys) {
    const sample = defaultSettings[key];
    if (typeof sample === "boolean") {
      if (booleans.includes(key)) next[key] = form.get(key) === "on";
      continue;
    }
    if (!form.has(key)) continue;
    const raw = String(form.get(key) ?? "");
    if (typeof sample === "number") next[key] = Number(raw);
    else if (Array.isArray(sample))
      next[key] = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    else next[key] = raw;
  }
  return next;
}

export async function saveSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await guard();
  const store = getStore();
  const current = await store.getSettings();
  const merged = mergeSettingsForm(current, form);
  const parsed = settingsSchema.safeParse(merged);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? "");
    return fail(`Verifique o campo “${FIELD_LABELS[field] ?? field}”: ${issue?.message ?? "valor inválido"}.`);
  }
  await store.saveSettings(parsed.data, admin.email);
  const changed = settingKeys.filter((k) => JSON.stringify(current[k]) !== JSON.stringify(parsed.data[k]));
  if (changed.length) {
    await store.addAudit({
      actor: admin.name,
      action: "settings.update",
      entity: "settings",
      entityId: null,
      details: { fields: changed.map((k) => FIELD_LABELS[k] ?? k) },
    });
  }
  refreshAll();
  return ok(changed.length ? "Alterações salvas. O convite já está atualizado." : "Nada mudou.");
}

const MEDIA_RULES = {
  bear: { key: "bearImageUrl", types: ["image/png", "image/jpeg", "image/webp", "image/avif"], max: 3.5 * 1024 * 1024 },
  music: { key: "musicUrl", types: ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/x-m4a"], max: 3.5 * 1024 * 1024 },
} as const;

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
};

export async function uploadMediaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await guard();
  const kind = form.get("kind") === "music" ? "music" : "bear";
  const rule = MEDIA_RULES[kind];
  const store = getStore();
  const settings = await store.getSettings();

  if (form.get("remove") === "1") {
    await store.saveSettings({ ...settings, [rule.key]: "" }, admin.email);
    await store.addAudit({ actor: admin.name, action: `media.remove`, entity: kind, entityId: null, details: {} });
    refreshAll();
    return ok("Arquivo removido.");
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Escolha um arquivo.");
  if (!(rule.types as readonly string[]).includes(file.type)) {
    return fail(kind === "bear" ? "Use uma imagem PNG, JPG, WebP ou AVIF." : "Use um áudio MP3, M4A ou OGG.");
  }
  if (file.size > rule.max) return fail("Arquivo grande demais (máximo 3,5 MB).");

  const name = `${kind}-${Date.now()}-${randomBytes(4).toString("hex")}.${EXT[file.type]}`;
  try {
    const url = await store.saveMedia(name, file.type, new Uint8Array(await file.arrayBuffer()));
    await store.saveSettings({ ...settings, [rule.key]: url }, admin.email);
    await store.addAudit({ actor: admin.name, action: "media.upload", entity: kind, entityId: null, details: { file: name } });
  } catch (e) {
    console.error("[upload]", e);
    return fail("Não foi possível enviar o arquivo. Tente novamente.");
  }
  refreshAll();
  return ok(kind === "bear" ? "Imagem atualizada." : "Música atualizada.");
}

/* ------------------------------------------------------------------ */
/* Convidados                                                          */
/* ------------------------------------------------------------------ */

const guestSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(120),
  groupName: z.string().trim().max(120).default(""),
  maxPeople: z.coerce.number().int().min(1, "Mínimo 1").max(20, "Máximo 20"),
  phone: z
    .string()
    .trim()
    .max(30)
    .default("")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || (v.length >= 10 && v.length <= 13), "Telefone inválido (use DDD + número)"),
  internalNotes: z.string().trim().max(1000).default(""),
});

function readGuest(form: FormData) {
  const parsed = guestSchema.safeParse({
    name: form.get("name"),
    groupName: form.get("groupName") ?? "",
    maxPeople: form.get("maxPeople"),
    phone: form.get("phone") ?? "",
    internalNotes: form.get("internalNotes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" } as const;
  const d = parsed.data;
  // Número brasileiro sem DDI => adiciona 55
  const phone = d.phone && d.phone.length <= 11 ? `55${d.phone}` : d.phone;
  return { data: { ...d, phone } } as const;
}

export async function createGuestAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await guard();
  const r = readGuest(form);
  if ("error" in r) return fail(r.error!);
  const store = getStore();
  const g = await store.createGuest({ ...r.data, origin: "personal" }, newInviteToken(), nameKey(r.data.name));
  await store.addAudit({ actor: admin.name, action: "guest.create", entity: "guest", entityId: g.id, details: { name: g.name } });
  refreshAll();
  return ok(`${g.name} adicionado(a). O link pessoal já está disponível.`);
}

export async function updateGuestAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await guard();
  const id = String(form.get("id") ?? "");
  const r = readGuest(form);
  if ("error" in r) return fail(r.error!);
  const store = getStore();
  const before = await store.getGuestById(id);
  if (!before) return fail("Convidado não encontrado.");
  if (before.rsvp?.attending === "yes" && before.rsvp.people > r.data.maxPeople) {
    return fail(`Já há ${before.rsvp.people} pessoas confirmadas neste convite. Ajuste a resposta antes de reduzir o limite.`);
  }
  await store.updateGuest(id, { ...r.data, nameKey: nameKey(r.data.name) });
  await store.addAudit({ actor: admin.name, action: "guest.update", entity: "guest", entityId: id, details: { name: r.data.name } });
  refreshAll();
  return ok("Dados salvos.");
}

export async function deleteGuestAction(form: FormData) {
  const admin = await guard();
  const id = String(form.get("id") ?? "");
  const store = getStore();
  const g = await store.getGuestById(id);
  if (g && (await store.deleteGuest(id))) {
    await store.addAudit({ actor: admin.name, action: "guest.delete", entity: "guest", entityId: id, details: { name: g.name } });
  }
  refreshAll();
  redirect("/admin/convidados");
}

export async function toggleSentAction(form: FormData) {
  const admin = await guard();
  const id = String(form.get("id") ?? "");
  const store = getStore();
  const g = await store.getGuestById(id);
  if (!g) return;
  const sentAt = g.sentAt ? null : new Date().toISOString();
  await store.updateGuest(id, { sentAt });
  await store.addAudit({
    actor: admin.name,
    action: sentAt ? "guest.sent" : "guest.unsent",
    entity: "guest",
    entityId: id,
    details: { name: g.name },
  });
  refreshAll();
}

export async function regenerateTokenAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await guard();
  const id = String(form.get("id") ?? "");
  const store = getStore();
  const g = await store.getGuestById(id);
  if (!g) return fail("Convidado não encontrado.");
  // Atualiza o token diretamente (o link antigo deixa de funcionar).
  const token = newInviteToken();
  await store.updateGuest(id, { token });
  await store.addAudit({ actor: admin.name, action: "guest.token", entity: "guest", entityId: id, details: { name: g.name } });
  refreshAll();
  return ok("Novo link gerado. O link anterior não funciona mais.");
}

const manualRsvpSchema = z.object({
  id: z.string().min(1),
  attending: z.enum(["yes", "no"]),
  people: z.coerce.number().int().min(0).max(20),
  message: z.string().trim().max(500).default(""),
  source: z.enum(["whatsapp_manual", "admin"]).default("whatsapp_manual"),
});

export async function manualRsvpAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await guard();
  const parsed = manualRsvpSchema.safeParse({
    id: form.get("id"),
    attending: form.get("attending"),
    people: form.get("people") ?? 0,
    message: form.get("message") ?? "",
    source: form.get("source") ?? "whatsapp_manual",
  });
  if (!parsed.success) return fail("Escolha se a pessoa vai ou não e a quantidade.");
  const d = parsed.data;
  const store = getStore();
  const g = await store.getGuestById(d.id);
  if (!g) return fail("Convidado não encontrado.");
  const people = d.attending === "no" ? 0 : d.people;
  if (d.attending === "yes" && (people < 1 || people > g.maxPeople)) {
    return fail(`Informe entre 1 e ${g.maxPeople} pessoas.`);
  }
  try {
    await recordRsvp(g, { attending: d.attending, people, message: d.message, source: d.source }, admin.name);
  } catch (e) {
    console.error("[manual-rsvp]", e);
    return fail("Não foi possível salvar a resposta.");
  }
  refreshAll();
  return ok("Resposta registrada.");
}

export async function clearRsvpAction(form: FormData) {
  const admin = await guard();
  const id = String(form.get("id") ?? "");
  const store = getStore();
  const g = await store.getGuestById(id);
  if (!g?.rsvp) return;
  await store.deleteRsvp(id);
  await store.addAudit({ actor: admin.name, action: "rsvp.delete", entity: "rsvp", entityId: id, details: { name: g.name } });
  refreshAll();
}

/* ------------------------------------------------------------------ */
/* Presentes                                                           */
/* ------------------------------------------------------------------ */

const giftSchema = z.object({
  name: z.string().trim().min(1, "Informe o item").max(120),
  brand: z.string().trim().max(120).default(""),
  size: z.string().trim().max(60).default(""),
  notes: z.string().trim().max(300).default(""),
  active: z.boolean().default(true),
});

function readGift(form: FormData) {
  return giftSchema.safeParse({
    name: form.get("name"),
    brand: form.get("brand") ?? "",
    size: form.get("size") ?? "",
    notes: form.get("notes") ?? "",
    active: form.get("active") === "on",
  });
}

export async function createGiftAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await guard();
  const parsed = readGift(form);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");
  const g = await getStore().createGift({ ...parsed.data, active: true });
  await getStore().addAudit({ actor: admin.name, action: "gift.create", entity: "gift", entityId: g.id, details: { name: g.name } });
  refreshAll();
  return ok(`“${g.name}” adicionado.`);
}

export async function updateGiftAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await guard();
  const id = String(form.get("id") ?? "");
  const parsed = readGift(form);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");
  const g = await getStore().updateGift(id, parsed.data);
  if (!g) return fail("Item não encontrado.");
  await getStore().addAudit({ actor: admin.name, action: "gift.update", entity: "gift", entityId: id, details: { name: g.name } });
  refreshAll();
  return ok("Item salvo.");
}

export async function deleteGiftAction(form: FormData) {
  const admin = await guard();
  const id = String(form.get("id") ?? "");
  const store = getStore();
  const gift = (await store.listGifts()).find((g) => g.id === id);
  if (gift && (await store.deleteGift(id))) {
    await store.addAudit({ actor: admin.name, action: "gift.delete", entity: "gift", entityId: id, details: { name: gift.name } });
  }
  refreshAll();
}

export async function moveGiftAction(form: FormData) {
  await guard();
  const id = String(form.get("id") ?? "");
  const dir = form.get("dir") === "up" ? -1 : 1;
  const store = getStore();
  const gifts = await store.listGifts();
  const i = gifts.findIndex((g) => g.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= gifts.length) return;
  [gifts[i], gifts[j]] = [gifts[j], gifts[i]];
  await Promise.all(gifts.map((g, idx) => (g.position !== idx ? store.updateGift(g.id, { position: idx }) : null)));
  refreshAll();
}

/* ------------------------------------------------------------------ */
/* Notificações                                                        */
/* ------------------------------------------------------------------ */

export async function markReadAction(form: FormData) {
  const admin = await guard();
  const id = String(form.get("id") ?? "");
  await getStore().markNotificationsRead(id === "all" ? "all" : [id], admin.name);
  refreshAll();
}

/* ------------------------------------------------------------------ */

const FIELD_LABELS: Record<string, string> = {
  eventDate: "Data",
  eventTime: "Horário de início",
  eventEndTime: "Horário de término",
  rsvpDeadline: "Prazo de confirmação",
  venueName: "Nome do local",
  address: "Endereço",
  city: "Cidade",
  venueInfo: "Informações adicionais",
  mapsUrl: "Link do Google Maps",
  wazeUrl: "Link do Waze",
  envelopeMessage: "Mensagem do envelope",
  heroPhrase: "Frase da Alana",
  inviteLines: "Texto do convite",
  giftsTitle: "Título dos presentes",
  giftsText: "Texto dos presentes",
  registryTitle: "Título do enxoval",
  registryText: "Texto do enxoval",
  registryUrl: "Link da lista de enxoval",
  registryReminder: "Lembrete do enxoval",
  closingLines: "Mensagem de encerramento",
  signature: "Assinatura",
  thanksYes: "Agradecimento (vai)",
  thanksNo: "Agradecimento (não vai)",
  fatherName: "Nome do pai",
  fatherPhone: "WhatsApp do pai",
  motherName: "Nome da mãe",
  motherPhone: "WhatsApp da mãe",
  whatsappTemplate: "Mensagem do WhatsApp",
  genericInviteEnabled: "Convite aberto",
  genericMaxPeople: "Pessoas no convite aberto",
  bearImageUrl: "Imagem da ursinha",
  musicUrl: "Música",
  notifyEmails: "E-mails de notificação",
  notifyWhatsappApi: "Aviso automático por WhatsApp",
};

// ---------------------------------------------------------------------------
// Notificações push no celular
// ---------------------------------------------------------------------------
export async function pushPublicKeyAction(): Promise<string> {
  await guard();
  return pushPublicKey();
}

export async function savePushSubscriptionAction(subscription: unknown, device: string): Promise<{ ok: boolean }> {
  const admin = await guard();
  if (!isValidSubscription(subscription)) return { ok: false };
  await savePushSubscription(subscription, admin.email, String(device || "Aparelho"));
  await getStore().addAudit({ actor: admin.name, action: "push.subscribe", entity: "push", entityId: null, details: { device: String(device).slice(0, 80) } });
  return { ok: true };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<{ ok: boolean }> {
  await guard();
  if (typeof endpoint === "string" && endpoint.startsWith("https://")) await removePushSubscription(endpoint);
  return { ok: true };
}

export async function testPushAction(endpoint: string): Promise<{ ok: boolean; message: string }> {
  const admin = await guard();
  const result = await sendPush(
    { title: "Avisos ligados 💕", body: `Pronto, ${admin.name}! Este aparelho vai avisar quando alguém responder o convite.`, tag: "teste" },
    (s) => s.subscription.endpoint === endpoint,
  );
  return { ok: result.startsWith("push: 1/"), message: result };
}
