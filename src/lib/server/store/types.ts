import type { Settings } from "@/lib/settings";
import type {
  AppNotification,
  AuditEntry,
  GiftSuggestion,
  Guest,
  GuestWithRsvp,
  RsvpAttending,
  RsvpResponse,
  RsvpSource,
} from "@/lib/types";

export interface GuestInput {
  name: string;
  groupName: string;
  maxPeople: number;
  phone: string;
  internalNotes: string;
  origin?: "personal" | "generic";
}

export interface RsvpInput {
  attending: RsvpAttending;
  people: number;
  message: string;
  source: RsvpSource;
}

export interface GiftInput {
  name: string;
  brand: string;
  size: string;
  notes: string;
  active: boolean;
}

export interface NotificationInput {
  kind: AppNotification["kind"];
  guestId: string | null;
  title: string;
  body: string;
}

/**
 * Camada de dados. Implementações:
 *  - SupabaseStore (produção): Postgres do Supabase via chave secreta, só no servidor.
 *  - LocalStore (desenvolvimento/testes sem credenciais): arquivo JSON em .data/.
 */
export interface Store {
  readonly kind: "supabase" | "local";

  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings, actor: string): Promise<void>;

  listGuests(): Promise<GuestWithRsvp[]>;
  getGuestById(id: string): Promise<GuestWithRsvp | null>;
  getGuestByToken(token: string): Promise<GuestWithRsvp | null>;
  findGuestByNameKey(nameKey: string, phone: string): Promise<GuestWithRsvp | null>;
  createGuest(input: GuestInput, token: string, nameKey: string): Promise<Guest>;
  updateGuest(id: string, patch: Partial<GuestInput> & { sentAt?: string | null; nameKey?: string; token?: string }): Promise<Guest | null>;
  deleteGuest(id: string): Promise<boolean>;

  /** Cria ou substitui a resposta do convite. Retorna a anterior para detectar mudanças. */
  upsertRsvp(guestId: string, input: RsvpInput): Promise<{ response: RsvpResponse; previous: RsvpResponse | null }>;
  deleteRsvp(guestId: string): Promise<void>;

  listGifts(): Promise<GiftSuggestion[]>;
  createGift(input: GiftInput): Promise<GiftSuggestion>;
  updateGift(id: string, patch: Partial<GiftInput> & { position?: number }): Promise<GiftSuggestion | null>;
  deleteGift(id: string): Promise<boolean>;

  listNotifications(limit: number): Promise<AppNotification[]>;
  countUnreadNotifications(): Promise<number>;
  /** Notificação ainda não lida do mesmo convidado (para não duplicar avisos). */
  findUnreadNotificationForGuest(guestId: string): Promise<AppNotification | null>;
  createNotification(input: NotificationInput): Promise<AppNotification>;
  updateNotification(id: string, patch: Partial<NotificationInput>): Promise<void>;
  markNotificationsRead(ids: string[] | "all", readBy: string): Promise<void>;

  addAudit(entry: Omit<AuditEntry, "id" | "createdAt">): Promise<void>;
  listAudit(limit: number): Promise<AuditEntry[]>;

  /** true = pode prosseguir; false = limite atingido. */
  hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean>;

  saveMedia(fileName: string, contentType: string, bytes: Uint8Array): Promise<string>;

  ping(): Promise<void>;

  /** Arquivos privados do servidor (inscrições de notificação, chaves). Nunca públicos. */
  getPrivate(key: string): Promise<string | null>;
  /** Grava; com onlyIfAbsent, devolve false se já existir. */
  putPrivate(key: string, value: string, onlyIfAbsent?: boolean): Promise<boolean>;
  deletePrivate(key: string): Promise<void>;
  listPrivate(prefix: string): Promise<string[]>;
}
