import "server-only";
import { connection } from "next/server";
import { toPublicSettings } from "@/lib/settings";
import type { InviteData } from "@/components/invite/InviteExperience";
import { env } from "./env";
import { quizInfoOrNull } from "./quiz/service";
import { toPublicGuest } from "./rsvp";
import { isValidTokenShape } from "./security";
import { getStore } from "./store";

/** Dados do convite (somente o que pode ir ao navegador). null = token inexistente. */
export async function loadInvite(token?: string): Promise<InviteData | null> {
  await connection(); // sempre dinâmico: dados mudam pelo painel
  const store = getStore();
  const [settings, gifts, quiz] = await Promise.all([store.getSettings(), store.listGifts(), quizInfoOrNull()]);

  let guest = null;
  if (token !== undefined) {
    if (!isValidTokenShape(token)) return null;
    const g = await store.getGuestByToken(token);
    if (!g) return null;
    guest = toPublicGuest(g);
  }

  return {
    settings: toPublicSettings(settings),
    guest,
    gifts: gifts.filter((g) => g.active),
    turnstileSiteKey: env.turnstileSiteKey,
    quizStatus: quiz?.status ?? null,
  };
}
