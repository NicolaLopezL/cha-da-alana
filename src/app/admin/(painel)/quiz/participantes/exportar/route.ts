import { formatDuration } from "@/lib/quiz/i18n";
import { getAdmin } from "@/lib/server/auth";
import { adminAnswers, adminParticipants, adminQuestions, adminState } from "@/lib/server/quiz/service";

const STATUS = { active: "Respondendo", done: "Concluída", invalid: "Invalidada" } as const;

/** Exporta participantes e respostas em CSV (separador ";" e BOM para abrir certo no Excel). */
export async function GET() {
  if (!(await getAdmin())) return new Response("Não autorizado", { status: 401 });
  const [state, people, answers, main, extra] = await Promise.all([
    adminState(),
    adminParticipants(),
    adminAnswers(null),
    adminQuestions("main"),
    adminQuestions("extra"),
  ]);
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita injeção de fórmulas
    return `"${s.replace(/"/g, '""')}"`;
  };
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
  const pos = new Map(state.ranking.map((r) => [r.id, r.pos]));
  const questions = [...main.filter((q) => q.active), ...extra.filter((q) => q.used)];
  const byKey = new Map(answers.map((a) => [`${a.participantId}:${a.questionId}`, a]));

  const header = [
    "Posição",
    "Nome",
    "Situação",
    "Pontuação",
    "Acertos",
    "Respondidas",
    "Início",
    "Conclusão",
    "Tempo",
    "Tempo (ms)",
    "Idioma",
    "Mesmo aparelho",
    ...questions.map((q) => (q.round === "extra" ? `[Desempate] ${q.pt}` : q.pt)),
  ];
  const rows = [...people]
    .sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9) || a.name.localeCompare(b.name, "pt-BR"))
    .map((p) => [
      pos.get(p.id) ?? "",
      p.name,
      STATUS[p.status],
      p.score,
      p.correct,
      `${p.answered} de ${state.questions}`,
      when(p.startedAt),
      when(p.finishedAt),
      p.durationMs === null ? "" : formatDuration(p.durationMs),
      p.durationMs ?? "",
      p.lang === "es" ? "Espanhol" : "Português",
      p.sameDevice ? "Sim" : "",
      ...questions.map((q) => {
        const a = byKey.get(`${p.id}:${q.id}`);
        return a ? `${a.option} (${a.correct ? "certa" : "errada"})` : "";
      }),
    ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quiz-cha-da-alana-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
