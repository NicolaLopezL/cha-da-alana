import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import type { AdminUser } from "@/lib/types";
import { env, isSupabaseConfigured } from "./env";
import { safeEqual, sign } from "./security";

/**
 * Autenticação dos administradores (pai e mãe).
 *  - Produção: Supabase Auth (e-mail + senha) + vínculo na tabela `admins`.
 *  - Modo local (sem Supabase): contas definidas em LOCAL_ADMINS, sessão em cookie assinado.
 */

const LOCAL_COOKIE = "alana_admin";
const LOCAL_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export async function supabaseServerClient() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Chamado durante renderização de Server Component: o proxy renova os cookies.
        }
      },
    },
  });
}

function parseLocalAdmins(): { email: string; password: string; name: string }[] {
  return env.localAdmins
    .split(";")
    .map((entry) => entry.split("|"))
    .filter((p) => p.length >= 2 && p[0] && p[1])
    .map(([email, password, name]) => ({ email: email.trim().toLowerCase(), password, name: (name ?? email).trim() }));
}

export async function signIn(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  if (isSupabaseConfigured()) {
    const supabase = await supabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password });
    if (error || !data.user) return { ok: false, error: "E-mail ou senha incorretos." };
    const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (!admin) {
      await supabase.auth.signOut();
      return { ok: false, error: "Esta conta não tem acesso ao painel." };
    }
    return { ok: true };
  }

  const match = parseLocalAdmins().find((a) => a.email === normalized);
  // Compara mesmo quando o e-mail não existe, para não revelar quais e-mails são válidos.
  const ok = safeEqual(sign(password), sign(match?.password ?? "\u0000invalid"));
  if (!match || !ok) return { ok: false, error: "E-mail ou senha incorretos." };
  const payload = Buffer.from(JSON.stringify({ e: match.email, n: match.name, x: Date.now() + LOCAL_TTL_MS })).toString(
    "base64url",
  );
  (await cookies()).set(LOCAL_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !env.allowLocalStore,
    path: "/",
    maxAge: LOCAL_TTL_MS / 1000,
  });
  return { ok: true };
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await supabaseServerClient();
    await supabase.auth.signOut();
  }
  (await cookies()).delete(LOCAL_COOKIE);
}

/** Administrador da requisição atual (validado no servidor) ou null. */
export const getAdmin = cache(async (): Promise<AdminUser | null> => {
  if (isSupabaseConfigured()) {
    const supabase = await supabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    const { data: admin } = await supabase
      .from("admins")
      .select("user_id, email, name")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (!admin) return null;
    return { id: admin.user_id, email: admin.email, name: admin.name || admin.email };
  }

  const raw = (await cookies()).get(LOCAL_COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !safeEqual(sign(payload), sig)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { e: string; n: string; x: number };
    if (data.x < Date.now()) return null;
    if (!parseLocalAdmins().some((a) => a.email === data.e)) return null;
    return { id: data.e, email: data.e, name: data.n };
  } catch {
    return null;
  }
});

/** Para páginas do painel: redireciona ao login se não autenticado. */
export async function requireAdminPage(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** Para Server Actions e rotas: lança erro se não autenticado. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) throw new Error("unauthorized");
  return admin;
}
