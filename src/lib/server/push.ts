import "server-only";
import { createHash } from "node:crypto";
import webpush, { type PushSubscription } from "web-push";
import { env } from "./env";
import type { RsvpNotice } from "./notify";
import { getStore } from "./store";

/**
 * Notificações push no celular/computador dos papais (Web Push padrão, sem serviço pago).
 * As chaves VAPID são geradas uma única vez e guardadas no armazenamento privado do servidor
 * (ou vêm de VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, se definidas).
 */

const VAPID_KEY = "push/_vapid.json";
const SUBS_DIR = "push/subs";

interface Vapid {
  publicKey: string;
  privateKey: string;
}
export interface StoredSubscription {
  subscription: PushSubscription;
  admin: string;
  device: string;
  createdAt: string;
}

let vapidCache: Promise<Vapid> | undefined;

async function loadVapid(): Promise<Vapid> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const store = getStore();
  const existing = await store.getPrivate(VAPID_KEY);
  if (existing) return JSON.parse(existing) as Vapid;
  const fresh = webpush.generateVAPIDKeys();
  // Se outra instância gerou ao mesmo tempo, fica valendo a primeira.
  if (await store.putPrivate(VAPID_KEY, JSON.stringify(fresh), true)) return fresh;
  return JSON.parse((await store.getPrivate(VAPID_KEY))!) as Vapid;
}

function vapid(): Promise<Vapid> {
  vapidCache ??= loadVapid().catch((e) => {
    vapidCache = undefined;
    throw e;
  });
  return vapidCache;
}

export async function pushPublicKey(): Promise<string> {
  return (await vapid()).publicKey;
}

const subKey = (endpoint: string) => `${SUBS_DIR}/${createHash("sha256").update(endpoint).digest("hex").slice(0, 40)}.json`;

export function isValidSubscription(x: unknown): x is PushSubscription {
  const s = x as PushSubscription;
  return (
    !!s &&
    typeof s.endpoint === "string" &&
    s.endpoint.startsWith("https://") &&
    s.endpoint.length < 1000 &&
    typeof s.keys?.p256dh === "string" &&
    typeof s.keys?.auth === "string" &&
    s.keys.p256dh.length < 200 &&
    s.keys.auth.length < 100
  );
}

export async function savePushSubscription(subscription: PushSubscription, admin: string, device: string) {
  const entry: StoredSubscription = {
    subscription: { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } },
    admin,
    device: device.slice(0, 80),
    createdAt: new Date().toISOString(),
  };
  await getStore().putPrivate(subKey(subscription.endpoint), JSON.stringify(entry));
}

export async function removePushSubscription(endpoint: string) {
  await getStore().deletePrivate(subKey(endpoint));
}

export async function listPushSubscriptions(): Promise<StoredSubscription[]> {
  const store = getStore();
  const keys = await store.listPrivate(SUBS_DIR);
  const all = await Promise.all(keys.map((k) => store.getPrivate(k)));
  return all.flatMap((raw) => {
    try {
      return raw ? [JSON.parse(raw) as StoredSubscription] : [];
    } catch {
      return [];
    }
  });
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Envia para todos os aparelhos inscritos; remove inscrições que expiraram. */
export async function sendPush(payload: PushPayload, only?: (s: StoredSubscription) => boolean): Promise<string> {
  const subs = (await listPushSubscriptions()).filter((s) => !only || only(s));
  if (subs.length === 0) return "push: nenhum aparelho";
  const keys = await vapid();
  const subject = env.siteUrl || "https://cha-da-alana.vercel.app";
  const body = JSON.stringify({ url: "/admin/notificacoes", ...payload });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription, body, {
          vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
          TTL: 60 * 60 * 24,
          urgency: "high",
          timeout: 8000,
        });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await removePushSubscription(s.subscription.endpoint);
        else console.error("[push]", code ?? (e as Error).message);
      }
    }),
  );
  return `push: ${sent}/${subs.length} enviados`;
}

export function sendPushNotice(notice: RsvpNotice): Promise<string> {
  return sendPush({ title: notice.title, body: notice.body, tag: `rsvp-${notice.guestName}` });
}
