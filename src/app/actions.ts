"use server";

import { assertSameOrigin } from "@/lib/server/security";
import { submitRsvp, type RsvpPayload, type RsvpResult } from "@/lib/server/rsvp";

/** Confirmação de presença enviada pelo convite (validação completa no servidor). */
export async function rsvpAction(payload: RsvpPayload): Promise<RsvpResult> {
  try {
    await assertSameOrigin();
  } catch {
    return { ok: false, error: "Requisição não permitida." };
  }
  return submitRsvp(payload);
}
