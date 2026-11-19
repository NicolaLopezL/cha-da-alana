import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { env } from "./env";
import { getStore } from "./store";

/** Token de convite: 18 bytes aleatórios (144 bits) em base64url => 24 caracteres. */
export function newInviteToken(): string {
  return randomBytes(18).toString("base64url");
}

export function isValidTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{20,64}$/.test(token);
}

/** Chave normalizada para detectar respostas duplicadas no convite aberto. */
export function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function secret(): string {
  if (env.sessionSecret.length >= 32) return env.sessionSecret;
  if (process.env.NODE_ENV === "production" && !env.allowLocalStore) {
    throw new Error("Defina SESSION_SECRET com pelo menos 32 caracteres.");
  }
  return "dev-only-secret-change-me-dev-only-secret";
}

export function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** IP do visitante com hash (LGPD: não guardamos o IP em texto). */
export async function clientKey(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  return createHash("sha256").update(`${secret()}:${ip}`).digest("hex").slice(0, 32);
}

export async function rateLimit(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (process.env.DISABLE_RATE_LIMIT === "1") return true;
  return getStore().hitRateLimit(`${bucket}:${await clientKey()}`, limit, windowSeconds);
}

/** Bloqueia POSTs vindos de outros sites (complementa a proteção nativa das Server Actions). */
export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host || new URL(origin).host !== host) throw new Error("forbidden_origin");
}

export async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  if (!env.turnstileSecret) return true; // não configurado: depende do limite de requisições + honeypot
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: env.turnstileSecret, response: token });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
