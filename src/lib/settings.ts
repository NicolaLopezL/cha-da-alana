import { z } from "zod";

/**
 * Configurações do evento, editáveis no painel.
 * Ficam numa única linha (event_settings.data) para que novos campos não exijam migração.
 * Nada aqui é inventado: campos sem valor ficam vazios e a interface mostra "em breve".
 */

const text = (max: number) => z.string().trim().max(max);
const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), "Use um endereço completo começando com https://");

/** Telefone brasileiro em dígitos com DDI, ex.: 5511999998888. Vazio = não configurado. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .transform((v) => (v.length === 10 || v.length === 11 ? `55${v}` : v))
  .refine((v) => v === "" || (v.length >= 12 && v.length <= 13), "Informe DDD + número, ex.: (11) 99999-8888");

export const settingsSchema = z.object({
  // Data e horário (vazios = "Data em breve")
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  eventTime: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).default(""),
  eventEndTime: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).default(""),
  rsvpDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),

  // Local (vazio = "Local em breve")
  venueName: text(120).default(""),
  address: text(240).default(""),
  city: text(120).default(""),
  venueInfo: text(600).default(""),
  mapsUrl: optionalUrl.default(""),
  wazeUrl: optionalUrl.default(""),

  // Textos
  envelopeMessage: text(140).default("Você recebeu um convite muito especial..."),
  heroPhrase: text(160).default("Cheguei para trazer amor, alegria e muitas bênçãos!"),
  inviteLines: z
    .array(text(280))
    .max(6)
    .default([
      "Um amor tão pequeno está prestes a transformar nossas vidas para sempre.",
      "Queremos compartilhar com você a alegria de esperar pela nossa Alana.",
      "Será muito especial ter você conosco nesse momento.",
    ]),
  giftsTitle: text(120).default("Um carinho para a Alana"),
  giftsText: text(400).default(
    "Sua presença já é um presente muito especial! Mas, se desejar trazer um mimo para nossa pequena, separamos algumas sugestões com carinho.",
  ),
  registryTitle: text(160).default("Quer presentear a Alana de uma forma ainda mais especial?"),
  registryText: text(400).default(
    "Também preparamos uma lista de enxoval com muito carinho, para quem desejar escolher um presente para nossa pequena.",
  ),
  registryUrl: optionalUrl.default(""),
  closingLines: z
    .array(text(280))
    .max(4)
    .default(["Mal podemos esperar para viver esse momento tão especial com você."]),
  signature: text(120).default("Com carinho, papai e mamãe."),
  thanksYes: text(200).default("Presença confirmada! A Alana está esperando por você com muito carinho!"),
  thanksNo: text(200).default("Obrigado por nos avisar. Você estará no nosso coração nesse dia!"),

  // WhatsApp (números reais só pelo painel)
  fatherName: text(60).default("Papai"),
  fatherPhone: phoneSchema.default(""),
  motherName: text(60).default("Mamãe"),
  motherPhone: phoneSchema.default(""),
  whatsappTemplate: text(400).default("Olá! Aqui é {nome}. Recebi o convite do Chá da Alana 💗"),

  // Convites
  genericInviteEnabled: z.boolean().default(true),
  /** Limite de segurança do convite aberto (o próprio convidado escolhe a quantidade até este teto). */
  genericMaxPeople: z.number().int().min(1).max(20).default(20),

  // Mídia e elementos opcionais
  bearImageUrl: z.string().trim().max(2000).default(""),
  musicUrl: z.string().trim().max(2000).default(""),
  showBear: z.boolean().default(true),
  showCountdown: z.boolean().default(true),
  showLocation: z.boolean().default(true),
  showWhatsapp: z.boolean().default(true),
  showGifts: z.boolean().default(true),
  showRegistry: z.boolean().default(true),
  showMusic: z.boolean().default(false),
  showDecorations: z.boolean().default(true),

  // Notificações
  notifyEmails: z.array(z.string().trim().email().max(200)).max(5).default([]),
  notifyWhatsappApi: z.boolean().default(false),
});

export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = settingsSchema.parse({});

/** Aceita dados parciais/antigos do banco e completa com os padrões. */
export function normalizeSettings(raw: unknown): Settings {
  const parsed = settingsSchema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  // Campo inválido salvo no banco: ignora só os campos problemáticos.
  const base: Record<string, unknown> = { ...(raw as object) };
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") delete base[key];
  }
  const retry = settingsSchema.safeParse(base);
  return retry.success ? retry.data : defaultSettings;
}

/** Subconjunto seguro para o navegador do convidado (sem e-mails de notificação). */
export type PublicSettings = Omit<Settings, "notifyEmails" | "notifyWhatsappApi">;

export function toPublicSettings(s: Settings): PublicSettings {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { notifyEmails, notifyWhatsappApi, ...rest } = s;
  return rest;
}
