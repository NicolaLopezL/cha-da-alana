import "server-only";
import { headers } from "next/headers";
import { guestStatus, type GuestWithRsvp } from "@/lib/types";
import { env } from "./env";

export async function baseUrl(): Promise<string> {
  if (env.siteUrl) return env.siteUrl;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export function inviteLink(base: string, token: string) {
  return `${base}/convite/${token}`;
}

export interface Stats {
  invites: number;
  totalSlots: number;
  confirmedGuests: number;
  confirmedPeople: number;
  companions: number;
  declined: number;
  pending: number;
  responseRate: number;
}

export function computeStats(guests: GuestWithRsvp[]): Stats {
  let confirmedGuests = 0;
  let confirmedPeople = 0;
  let declined = 0;
  let totalSlots = 0;
  for (const g of guests) {
    totalSlots += g.maxPeople;
    const st = guestStatus(g);
    if (st === "confirmed") {
      confirmedGuests += 1;
      confirmedPeople += g.rsvp?.people ?? 0;
    } else if (st === "declined") declined += 1;
  }
  const pending = guests.length - confirmedGuests - declined;
  return {
    invites: guests.length,
    totalSlots,
    confirmedGuests,
    confirmedPeople,
    companions: Math.max(0, confirmedPeople - confirmedGuests),
    declined,
    pending,
    responseRate: guests.length ? Math.round(((confirmedGuests + declined) / guests.length) * 100) : 0,
  };
}

export const STATUS_LABEL: Record<ReturnType<typeof guestStatus>, string> = {
  pending: "Não enviado",
  sent: "Aguardando resposta",
  confirmed: "Confirmado",
  declined: "Não vai",
};
