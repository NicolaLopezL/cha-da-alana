import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Executa a migração real num Postgres embutido (PGlite), com um "stub" mínimo
 * dos esquemas do Supabase (auth, storage e papéis), e verifica tabelas, gatilhos e RLS.
 */
const migration = readFileSync(path.resolve("supabase/migrations/20261119000000_init.sql"), "utf8").replace(
  /create extension if not exists pgcrypto;/,
  "",
);

const ADMIN = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

let db: PGlite;

async function as(role: "anon" | "authenticated" | "service_role", sub: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub ?? ""}', false); set role ${role};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    grant usage on schema public to anon, authenticated, service_role;
  `);
  await db.exec(migration);
  // A migração do quiz é aditiva: tudo abaixo precisa continuar valendo depois dela.
  await db.exec(readFileSync(path.resolve("supabase/migrations/20261123000000_quiz.sql"), "utf8"));
  await db.exec(readFileSync(path.resolve("supabase/migrations/20261124000000_quiz_misterioso.sql"), "utf8"));
  await db.exec(`insert into auth.users values ('${ADMIN}'), ('${OTHER}');
                 insert into public.admins (user_id, email, name) values ('${ADMIN}', 'mae@teste.test', 'Mamãe');`);
});

describe("migração Supabase", () => {
  it("cria a linha única de configurações e o bucket de mídia", async () => {
    expect((await db.query("select count(*)::int as n from public.event_settings")).rows[0]).toEqual({ n: 1 });
    expect((await db.query("select public from storage.buckets where id = 'media'")).rows[0]).toEqual({ public: true });
  });

  it("garante no banco o limite de pessoas e uma resposta por convite", async () => {
    const g = await db.query<{ id: string }>(
      "insert into public.guests (token, name, max_people) values ('tokendeteste-aaaaaaaaaaaa', 'Ana', 2) returning id",
    );
    const id = g.rows[0].id;
    await expect(db.query("insert into public.rsvp_responses (guest_id, attending, people) values ($1, 'yes', 3)", [id])).rejects.toThrow(
      /people_out_of_range/,
    );
    await db.query("insert into public.rsvp_responses (guest_id, attending, people) values ($1, 'yes', 2)", [id]);
    await expect(db.query("insert into public.rsvp_responses (guest_id, attending, people) values ($1, 'yes', 1)", [id])).rejects.toThrow();
    await db.query("update public.rsvp_responses set attending = 'no', people = 2 where guest_id = $1", [id]);
    expect((await db.query("select people from public.rsvp_responses where guest_id = $1", [id])).rows[0]).toEqual({ people: 0 });
  });

  it("RLS: anônimo não acessa nada", async () => {
    await expect(as("anon", null, "select * from public.guests")).rejects.toThrow(/permission denied/);
    await expect(as("anon", null, "insert into public.guests (token, name) values ('xxxxxxxxxxxxxxxxxxxxxxx', 'X')")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("RLS: usuário autenticado que não é admin não vê nem altera dados", async () => {
    const r = await as("authenticated", OTHER, "select * from public.guests");
    expect(r.rows).toHaveLength(0);
    await expect(
      as("authenticated", OTHER, "insert into public.guests (token, name) values ('yyyyyyyyyyyyyyyyyyyyyyyy', 'Y')"),
    ).rejects.toThrow(/row-level security/);
    const upd = await as("authenticated", OTHER, "update public.event_settings set data = '{}'::jsonb returning id");
    expect(upd.rows).toHaveLength(0);
  });

  it("RLS: administrador acessa os dados", async () => {
    const r = await as("authenticated", ADMIN, "select name from public.guests");
    expect(r.rows.length).toBeGreaterThan(0);
    const admins = await as("authenticated", ADMIN, "select email from public.admins");
    expect(admins.rows).toEqual([{ email: "mae@teste.test" }]);
  });

  it("limite de requisições é atômico e restrito à chave secreta", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await as("service_role", null, "select public.hit_rate_limit('ip:x', 3, 600) as ok");
      results.push((r.rows[0] as { ok: boolean }).ok);
    }
    expect(results).toEqual([true, true, true, false]);
    await expect(as("authenticated", ADMIN, "select public.hit_rate_limit('ip:y', 3, 600)")).rejects.toThrow(/permission denied/);
  });
});
