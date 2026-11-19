import { env } from "@/lib/server/env";
import { safeEqual } from "@/lib/server/security";
import { getStore } from "@/lib/server/store";

/**
 * Chamado diariamente pelo Cron da Vercel (vercel.json) para manter o projeto
 * gratuito do Supabase ativo (ele pausa após ~7 dias sem atividade).
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) {
    return new Response("Não autorizado", { status: 401 });
  }
  try {
    await getStore().ping();
    return Response.json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    console.error("[keepalive]", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
