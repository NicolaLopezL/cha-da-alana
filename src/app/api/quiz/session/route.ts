import { assertSameOrigin } from "@/lib/server/security";
import { clearToken, loadQuizState, noStore } from "@/lib/server/quiz/request";

/** Estado atual da tela do convidado (retomar, saber se abriu, encerrou ou há desempate). */
export async function GET() {
  try {
    return Response.json(await loadQuizState(), { headers: noStore });
  } catch (e) {
    console.error("[quiz/session]", e);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}

/** Esquece a participação neste aparelho (para outra pessoa responder). Nada é apagado no banco. */
export async function DELETE() {
  try {
    await assertSameOrigin();
  } catch {
    return Response.json({ error: "unavailable" }, { status: 403, headers: noStore });
  }
  await clearToken();
  return Response.json({ ok: true }, { headers: noStore });
}
