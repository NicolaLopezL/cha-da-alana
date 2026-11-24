import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { localDataDir } from "../store/local";
import { toQuizError, type QuizRpc } from "./db";

/** Postgres embutido só para desenvolvimento e testes (nunca usado com o Supabase configurado). */

export const LOCAL_ROLES_SQL = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;
`;

interface MiniDb {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

/** Transforma uma conexão Postgres em chamadas nomeadas, como o RPC do Supabase. */
export function rpcOver(db: MiniDb): QuizRpc {
  return async (fn, args = {}) => {
    if (!/^quiz_[a-z_]+$/.test(fn)) throw new Error("invalid_fn");
    const names = Object.keys(args);
    if (names.some((n) => !/^p(_[a-z_]+)?$/.test(n))) throw new Error("invalid_arg");
    const values = names.map((n) => {
      const v = args[n];
      return v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v;
    });
    const list = names.map((n, i) => `${n} => $${i + 1}`).join(", ");
    try {
      const res = await db.query(`select public.${fn}(${list}) as r`, values);
      return (res.rows[0] as { r: unknown } | undefined)?.r ?? null;
    } catch (e) {
      throw toQuizError(e as { message?: string; code?: string });
    }
  };
}

export async function openLocalQuizDb(): Promise<QuizRpc> {
  const { PGlite } = await import("@electric-sql/pglite");
  let db;
  if (process.env.LOCAL_QUIZ_MEMORY === "1") {
    db = await PGlite.create(); // testes E2E: começa vazio a cada execução
  } else {
    const dir = path.join(localDataDir(), "quiz-db");
    await fs.mkdir(path.dirname(dir), { recursive: true });
    db = await PGlite.create({ dataDir: dir, relaxedDurability: true });
  }
  await db.exec(LOCAL_ROLES_SQL);
  for (const name of ["20261123000000_quiz.sql", "20261124000000_quiz_misterioso.sql"]) {
    const file = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "supabase/migrations", name);
    await db.exec(await fs.readFile(file, "utf8"));
  }
  return rpcOver(db);
}
