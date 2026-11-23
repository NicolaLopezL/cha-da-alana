import { createHash } from "node:crypto";
import { noStore } from "@/lib/server/quiz/request";
import { liveState } from "@/lib/server/quiz/service";

/**
 * Ranking ao vivo (público, sem login). Consultado a cada poucos segundos pelas telas abertas:
 *  - ETag: se nada mudou, responde 304 sem corpo;
 *  - s-maxage=1: a CDN da Vercel atende todas as telas com no máximo ~1 consulta por segundo.
 */
export async function GET(req: Request) {
  try {
    const body = JSON.stringify(await liveState());
    const etag = `"${createHash("sha256").update(body).digest("base64url").slice(0, 22)}"`;
    const headers = { "Cache-Control": "public, max-age=0, s-maxage=1, must-revalidate", ETag: etag };
    if (req.headers.get("if-none-match")?.includes(etag)) return new Response(null, { status: 304, headers });
    return new Response(body, { headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
  } catch (e) {
    console.error("[quiz/live]", e);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
