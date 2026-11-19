import "server-only";

/** Leitura centralizada das variáveis de ambiente (nunca expostas ao navegador). */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  siteUrl: (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, ""),
  sessionSecret: process.env.SESSION_SECRET ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",

  /** Somente modo local: "email|senha|Nome;email2|senha2|Nome2" */
  localAdmins: process.env.LOCAL_ADMINS ?? "",
  allowLocalStore: process.env.ALLOW_LOCAL_STORE === "1",

  resendApiKey: process.env.RESEND_API_KEY ?? "",
  notifyFrom: process.env.NOTIFY_FROM_EMAIL ?? "",

  whatsappToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  whatsappTemplate: process.env.WHATSAPP_TEMPLATE_NAME ?? "",
  whatsappTemplateLang: process.env.WHATSAPP_TEMPLATE_LANG ?? "pt_BR",

  turnstileSecret: process.env.TURNSTILE_SECRET_KEY ?? "",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
};

export const isSupabaseConfigured = () => Boolean(env.supabaseUrl && env.supabasePublishableKey && env.supabaseSecretKey);

export function assertProductionConfig() {
  if (isSupabaseConfigured()) return;
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !env.allowLocalStore) {
    throw new Error(
      "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY.",
    );
  }
}
