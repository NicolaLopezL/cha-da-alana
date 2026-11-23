import "server-only";
import { createClient } from "@supabase/supabase-js";
import { assertProductionConfig, env, isSupabaseConfigured } from "../env";

/**
 * Acesso ao banco do quiz. Toda a lógica sensível (gabarito, pontuação, concorrência)
 * vive em funções SQL; aqui só as chamamos.
 *  - Produção: RPC do Supabase com a chave secreta.
 *  - Desenvolvimento/testes sem Supabase: Postgres embutido (PGlite) rodando a MESMA migração.
 */
export type QuizRpc = (fn: string, args?: Record<string, unknown>) => Promise<unknown>;

export class QuizDbError extends Error {
  constructor(
    public code: "locked" | "not_installed" | "failed",
    message: string,
  ) {
    super(message);
  }
}

export function toQuizError(e: { message?: string; code?: string }): QuizDbError {
  const msg = e.message ?? "erro";
  if (msg.includes("quiz_locked")) return new QuizDbError("locked", msg);
  // Função/tabela ainda não existe: a migração do quiz não foi executada.
  if (["PGRST202", "PGRST205", "42883", "42P01"].includes(e.code ?? "")) return new QuizDbError("not_installed", msg);
  return new QuizDbError("failed", msg);
}

function supabaseRpc(): QuizRpc {
  const db = createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return async (fn, args = {}) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw toQuizError(error);
    return data;
  };
}

const g = globalThis as unknown as { __alanaQuizRpc?: QuizRpc };

export function quizRpc(): QuizRpc {
  if (g.__alanaQuizRpc) return g.__alanaQuizRpc;
  assertProductionConfig();
  if (isSupabaseConfigured()) {
    g.__alanaQuizRpc = supabaseRpc();
  } else {
    const local = import("./local-db").then((m) => m.openLocalQuizDb());
    g.__alanaQuizRpc = async (fn, args) => (await local)(fn, args);
  }
  return g.__alanaQuizRpc;
}
