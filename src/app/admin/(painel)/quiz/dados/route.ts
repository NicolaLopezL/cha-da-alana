import { getAdmin } from "@/lib/server/auth";
import { adminParticipants, adminState } from "@/lib/server/quiz/service";

/** Dados do painel que se atualizam sozinhos. Só para administradores. */
export async function GET(req: Request) {
  if (!(await getAdmin())) return new Response("Não autorizado", { status: 401 });
  const participants = new URL(req.url).searchParams.get("tipo") === "participantes";
  try {
    return Response.json(participants ? await adminParticipants() : await adminState(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[quiz/dados]", e);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
