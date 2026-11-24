import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { connection } from "next/server";
import { cleanName, quizNameKey } from "@/lib/quiz/name";
import type {
  AdminAnswer,
  AdminParticipant,
  AdminQuestion,
  AdminQuizState,
  AnswerResult,
  FinalState,
  LiveState,
  PublicQuestion,
  QuizError,
  QuizInfo,
  QuizLang,
  QuizSession,
} from "@/lib/quiz/types";
import { quizRpc } from "./db";

/** Chama a função SQL sempre em tempo de requisição (nunca durante o build). */
async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  await connection();
  return (await quizRpc()(fn, args)) as T;
}

/* O token fica só no cookie do convidado; o banco guarda apenas o hash. */
export const hashSecret = (v: string) => createHash("sha256").update(v).digest("hex");
export const newSecret = () => randomBytes(24).toString("base64url");
export const isSecretShape = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{32}$/.test(v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export const quizInfo = () => call<QuizInfo>("quiz_info");
export const publicQuestions = () => call<PublicQuestion[]>("quiz_public_questions");
export const finalState = () => call<FinalState>("quiz_final");

/** Estado do quiz para a página do convite: nunca derruba o convite se o quiz falhar ou não estiver instalado. */
export async function quizInfoOrNull(): Promise<QuizInfo | null> {
  try {
    return await Promise.race([quizInfo(), new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500))]);
  } catch {
    return null;
  }
}

export interface StartInput {
  name: unknown;
  lang: QuizLang;
  startKey: string;
  device: string;
}

export async function startParticipation(input: StartInput): Promise<{ ok: true; token: string } | { error: QuizError }> {
  const name = cleanName(input.name);
  const key = name ? quizNameKey(name) : "";
  if (!name || !key) return { error: "name_required" };
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = newSecret();
    const res = (await quizRpc()("quiz_start", {
      p_name: name,
      p_name_key: key,
      p_lang: input.lang,
      p_token_hash: hashSecret(token),
      p_device_hash: hashSecret(input.device),
      p_start_key: hashSecret(input.startKey),
    })) as { ok: true } | { error: QuizError };
    if ("ok" in res) return { ok: true, token };
    if (res.error !== "retry") return res;
  }
  return { error: "unavailable" };
}

export const loadSession = (token: string) =>
  call<QuizSession | null>("quiz_session", { p_token_hash: hashSecret(token) });

/**
 * A primeira resposta vale: se a pergunta já foi respondida, repete a opção guardada (o banco trata como reenvio).
 * Assim ninguém olha a própria pontuação no telão e volta para corrigir.
 */
export async function saveAnswer(token: string, questionId: string, optionId: string): Promise<AnswerResult> {
  const previous = (await loadSession(token))?.answers[questionId];
  return call<AnswerResult>("quiz_answer", {
    p_token_hash: hashSecret(token),
    p_question: questionId,
    p_option: previous ?? optionId,
  });
}

/* Ranking ao vivo: um mini-cache por instância evita uma consulta por tela conectada. */
const LIVE_TTL_MS = 700;
let liveCache: { at: number; value: Promise<LiveState> } | null = null;
export function liveState(): Promise<LiveState> {
  const now = Date.now();
  if (liveCache && now - liveCache.at < LIVE_TTL_MS) return liveCache.value;
  const value = call<LiveState>("quiz_live");
  const entry = { at: now, value };
  liveCache = entry;
  value.catch(() => {
    if (liveCache === entry) liveCache = null;
  });
  return value;
}

/* ---------- Painel ---------- */
export const adminState = () => call<AdminQuizState>("quiz_admin_state");
export const adminQuestions = (round: "main" | "extra") =>
  call<AdminQuestion[]>("quiz_admin_questions", { p_round: round });
export const adminParticipants = () => call<AdminParticipant[]>("quiz_admin_participants");
export const adminAnswers = (participantId: string | null) =>
  call<AdminAnswer[]>("quiz_admin_answers", { p_participant: participantId });
