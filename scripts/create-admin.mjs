#!/usr/bin/env node
/**
 * Cria (ou vincula) uma conta de administrador no Supabase.
 *
 * Uso:
 *   node --env-file=.env.production.local scripts/create-admin.mjs <email> "<Nome>" [senha]
 *
 * Se a senha não for informada, uma senha forte é gerada e mostrada UMA vez no terminal.
 * Requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY).
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [email, name, passwordArg] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !name) {
  console.error('Uso: node --env-file=<arquivo .env> scripts/create-admin.mjs <email> "<Nome>" [senha]');
  process.exit(1);
}
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no arquivo de ambiente.");
  process.exit(1);
}
if (passwordArg && passwordArg.length < 12) {
  console.error("Use uma senha com pelo menos 12 caracteres.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const password = passwordArg ?? randomBytes(12).toString("base64url");
const normalized = email.trim().toLowerCase();

let userId;
const created = await supabase.auth.admin.createUser({ email: normalized, password, email_confirm: true });
if (created.error) {
  // Já existe: procura o usuário e apenas vincula como admin (sem trocar a senha).
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const existing = data.users.find((u) => u.email?.toLowerCase() === normalized);
  if (!existing) {
    console.error("Não foi possível criar o usuário:", created.error.message);
    process.exit(1);
  }
  userId = existing.id;
  console.log("Usuário já existia; vinculando como administrador (senha mantida).");
} else {
  userId = created.data.user.id;
  console.log(`Usuário criado: ${normalized}`);
  if (!passwordArg) console.log(`Senha gerada (guarde num gerenciador de senhas): ${password}`);
}

const { error: linkError } = await supabase.from("admins").upsert({ user_id: userId, email: normalized, name });
if (linkError) {
  console.error("Erro ao vincular na tabela admins:", linkError.message);
  process.exit(1);
}
console.log(`Pronto! ${name} já pode entrar em /admin/login.`);
