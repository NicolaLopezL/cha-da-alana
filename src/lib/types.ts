export type GuestStatus = "pending" | "sent" | "confirmed" | "declined";
export type RsvpAttending = "yes" | "no";
export type RsvpSource = "site" | "whatsapp_manual" | "admin";

export interface Guest {
  id: string;
  token: string;
  name: string;
  groupName: string;
  maxPeople: number;
  phone: string;
  internalNotes: string;
  /** Convite enviado ao convidado (controle manual do painel). */
  sentAt: string | null;
  /** "personal" = criado no painel; "generic" = veio do convite aberto. */
  origin: "personal" | "generic";
  createdAt: string;
  updatedAt: string;
}

export interface RsvpResponse {
  id: string;
  guestId: string;
  attending: RsvpAttending;
  people: number;
  message: string;
  source: RsvpSource;
  createdAt: string;
  updatedAt: string;
}

export interface GuestWithRsvp extends Guest {
  rsvp: RsvpResponse | null;
}

export function guestStatus(g: GuestWithRsvp): GuestStatus {
  if (g.rsvp?.attending === "yes") return "confirmed";
  if (g.rsvp?.attending === "no") return "declined";
  return g.sentAt ? "sent" : "pending";
}

export interface GiftSuggestion {
  id: string;
  name: string;
  brand: string;
  size: string;
  notes: string;
  position: number;
  active: boolean;
}

export interface AppNotification {
  id: string;
  kind: "rsvp_new" | "rsvp_updated" | "system";
  guestId: string | null;
  title: string;
  body: string;
  readAt: string | null;
  readBy: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

/** Dados do convidado que podem ir para o navegador. */
export interface PublicGuest {
  token: string;
  name: string;
  groupName: string;
  maxPeople: number;
  rsvp: { attending: RsvpAttending; people: number; message: string } | null;
}
