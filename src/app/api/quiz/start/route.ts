import { isLang } from "@/lib/quiz/i18n";
import { rateLimit } from "@/lib/server/security";
import { deviceId, noStore, readJson, writeToken } from "@/lib/server/quiz/request";
import { startParticipation } from "@/lib/server/quiz/service";

/** Cria a participação e guarda o token num cookie httpOnly. Repetir o mesmo pedido não duplica. */
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body || typeof body.startKey !== "string" || !/^[0-9a-f-]{32,40}$/i.test(body.startKey)) {
    return Response.json({ error: "unavailable" }, { status: 400, headers: noStore });
  }
  try {
    // Limite folgado: numa festa, todos usam o mesmo Wi-Fi (mesmo IP).
    if (!(await rateLimit("quiz-start", 200, 600))) {
      return Response.json({ error: "rate_limited" }, { status: 429, headers: noStore });
    }
    const res = await startParticipation({
      name: body.name,
      lang: isLang(body.lang) ? body.lang : "pt",
      startKey: body.startKey,
      device: await deviceId(),
    });
    if ("error" in res) return Response.json(res, { status: 409, headers: noStore });
    await writeToken(res.token);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (e) {
    console.error("[quiz/start]", e);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
