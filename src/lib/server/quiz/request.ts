import "server-only";
import { cookies, headers } from "next/headers";
import { isLang } from "@/lib/quiz/i18n";
import type { QuizInfo, QuizLang, QuizSession, PublicQuestion } from "@/lib/quiz/types";
import { env } from "../env";
import { assertSameOrigin } from "../security";
import { isSecretShape, loadSession, newSecret, publicQuestions, quizInfo } from "./service";

const TOKEN_COOKIE = "alana_quiz";
const DEVICE_COOKIE = "alana_quiz_device";
export const LANG_COOKIE = "alana_quiz_lang";
const DAY = 60 * 60 * 24;

const cookieBase = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && !env.allowLocalStore,
  path: "/",
});

export async function readToken(): Promise<string | null> {
  const v = (await cookies()).get(TOKEN_COOKIE)?.value;
  return isSecretShape(v) ? v : null;
}
export async function writeToken(token: string) {
  (await cookies()).set(TOKEN_COOKIE, token, { ...cookieBase(), maxAge: 60 * DAY });
}
export async function clearToken() {
  (await cookies()).delete(TOKEN_COOKIE);
}

/** Identificador aleatório do aparelho (sem dados pessoais), só para sinalizar duplicidades. */
export async function deviceId(): Promise<string> {
  const store = await cookies();
  const current = store.get(DEVICE_COOKIE)?.value;
  if (isSecretShape(current)) return current;
  const fresh = newSecret();
  store.set(DEVICE_COOKIE, fresh, { ...cookieBase(), maxAge: 180 * DAY });
  return fresh;
}

/** Idioma: ?lang= > escolha salva > idioma do aparelho > português. */
export async function requestLang(param?: string | string[]): Promise<QuizLang> {
  if (isLang(param)) return param;
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(saved)) return saved;
  const accept = ((await headers()).get("accept-language") ?? "").toLowerCase();
  return accept.startsWith("es") ? "es" : "pt";
}

/** Corpo JSON de um POST do próprio site (bloqueia outros sites e corpos grandes). */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    await assertSameOrigin();
    if (!req.headers.get("content-type")?.startsWith("application/json")) return null;
    const text = await req.text();
    if (text.length > 4000) return null;
    const data = JSON.parse(text);
    return data && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export const noStore = { "Cache-Control": "no-store" };

export interface QuizState {
  info: QuizInfo;
  session: QuizSession | null;
  questions: PublicQuestion[];
}

/** Tudo o que a tela do convidado precisa (as perguntas só vão para quem já começou). */
export async function loadQuizState(): Promise<QuizState> {
  const token = await readToken();
  const [info, session] = await Promise.all([quizInfo(), token ? loadSession(token) : null]);
  const questions = session?.status === "active" && session.canAnswer ? await publicQuestions() : [];
  return { info, session, questions };
}
