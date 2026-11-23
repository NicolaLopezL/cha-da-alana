import { rateLimit } from "@/lib/server/security";
import { getStore } from "@/lib/server/store";
import { noStore, readJson, readToken } from "@/lib/server/quiz/request";
import { hashSecret, isUuid, saveAnswer } from "@/lib/server/quiz/service";

/** Salva uma resposta. A resposta do servidor é igual acertando ou errando (não revela o gabarito). */
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body || !isUuid(body.questionId) || !isUuid(body.optionId)) {
    return Response.json({ error: "bad_question" }, { status: 400, headers: noStore });
  }
  const token = await readToken();
  if (!token) return Response.json({ error: "no_session" }, { status: 409, headers: noStore });
  try {
    const allowed =
      process.env.DISABLE_RATE_LIMIT === "1" ||
      (
        await Promise.all([
          getStore().hitRateLimit(`quiz-answer:${hashSecret(token).slice(0, 32)}`, 120, 60),
          rateLimit("quiz-answer", 6000, 600),
        ])
      ).every(Boolean);
    if (!allowed) return Response.json({ error: "rate_limited" }, { status: 429, headers: noStore });
    const res = await saveAnswer(token, body.questionId, body.optionId);
    return Response.json(res, { status: "error" in res ? 409 : 200, headers: noStore });
  } catch (e) {
    console.error("[quiz/answer]", e);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
