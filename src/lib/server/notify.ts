import "server-only";
import type { Settings } from "@/lib/settings";
import { env } from "./env";
import { sendPushNotice } from "./push";

/**
 * Avisos externos sobre novas confirmações.
 * O registro principal é sempre a notificação do painel; e-mail e WhatsApp são extras
 * e nunca impedem a confirmação de ser salva.
 */

export interface RsvpNotice {
  guestName: string;
  title: string;
  body: string;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function emailEnabled(): boolean {
  return Boolean(env.resendApiKey && env.notifyFrom);
}

export function whatsappApiConfigured(): boolean {
  return Boolean(env.whatsappToken && env.whatsappPhoneNumberId && env.whatsappTemplate);
}

async function withTimeout<T>(p: Promise<T>, ms = 8000): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t);
  }
}

export async function sendEmailNotice(settings: Settings, notice: RsvpNotice): Promise<string> {
  if (!emailEnabled()) return "email: não configurado";
  if (settings.notifyEmails.length === 0) return "email: sem destinatários";
  const panel = env.siteUrl ? `${env.siteUrl}/admin` : "";
  const html = `
    <div style="font-family:Georgia,serif;color:#5b4040;max-width:520px;margin:auto;padding:24px;background:#fbf7f1;border-radius:12px">
      <p style="letter-spacing:.2em;text-transform:uppercase;font-size:11px;color:#a8875a;margin:0 0 8px">Chá da Alana</p>
      <h2 style="font-weight:normal;margin:0 0 12px">${escapeHtml(notice.title)}</h2>
      <p style="white-space:pre-line;line-height:1.6;margin:0 0 16px">${escapeHtml(notice.body)}</p>
      ${panel ? `<a href="${panel}" style="color:#9c6b6b">Abrir o painel</a>` : ""}
    </div>`;
  const res = await withTimeout(
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.notifyFrom,
        to: settings.notifyEmails,
        subject: `Chá da Alana — ${notice.title}`,
        html,
        text: `${notice.title}\n\n${notice.body}${panel ? `\n\nPainel: ${panel}` : ""}`,
      }),
    }),
  );
  return res.ok ? "email: enviado" : `email: falhou (${res.status})`;
}

/**
 * WhatsApp Business Platform (API oficial da Meta / Cloud API).
 * Exige: conta Meta Business verificada, número dedicado ao WhatsApp Business,
 * modelo de mensagem (template) aprovado com 2 variáveis no corpo: {{1}} nome, {{2}} resumo.
 */
export async function sendWhatsappNotice(settings: Settings, notice: RsvpNotice): Promise<string> {
  if (!settings.notifyWhatsappApi) return "whatsapp: desativado no painel";
  if (!whatsappApiConfigured()) return "whatsapp: credenciais ausentes";
  const recipients = [settings.fatherPhone, settings.motherPhone].filter(Boolean);
  if (recipients.length === 0) return "whatsapp: números não configurados";
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  const results = await Promise.all(
    recipients.map(async (to) => {
      try {
        const res = await withTimeout(
          fetch(`https://graph.facebook.com/${version}/${env.whatsappPhoneNumberId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${env.whatsappToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to,
              type: "template",
              template: {
                name: env.whatsappTemplate,
                language: { code: env.whatsappTemplateLang },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: notice.guestName.slice(0, 60) },
                      { type: "text", text: notice.title.slice(0, 200) },
                    ],
                  },
                ],
              },
            }),
          }),
        );
        return res.ok ? "ok" : `erro ${res.status}`;
      } catch (e) {
        return `erro ${(e as Error).message}`;
      }
    }),
  );
  return `whatsapp: ${results.join(", ")}`;
}

export async function dispatchExternalNotices(settings: Settings, notice: RsvpNotice): Promise<void> {
  const out = await Promise.allSettled([
    sendPushNotice(notice),
    sendEmailNotice(settings, notice),
    sendWhatsappNotice(settings, notice),
  ]);
  for (const r of out) {
    if (r.status === "rejected") console.error("[notify]", r.reason);
    else if (!r.value.endsWith("não configurado") && !r.value.includes("desativado") && !r.value.includes("nenhum aparelho")) console.info("[notify]", r.value);
  }
}
