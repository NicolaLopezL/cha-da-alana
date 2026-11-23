import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTime, Panel } from "@/components/admin/parts";
import { ParticipantEditor, ParticipantStatus } from "@/components/admin/quiz/Participants";
import { formatDuration } from "@/lib/quiz/i18n";
import { adminAnswers, adminParticipants, adminState, isUuid } from "@/lib/server/quiz/service";

export default async function QuizParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [state, list, answers] = await Promise.all([adminState(), adminParticipants(), adminAnswers(id)]);
  const p = list.find((x) => x.id === id);
  if (!p) notFound();

  const facts = [
    ["Início", formatDateTime(p.startedAt)],
    ["Conclusão", p.finishedAt ? formatDateTime(p.finishedAt) : "—"],
    ["Progresso", `${p.answered}/${state.questions}`],
    ["Pontuação", `${p.score}/${state.maxScore}`],
    ["Acertos", String(p.correct)],
    ["Tempo", formatDuration(p.durationMs)],
    ["Idioma", p.lang === "es" ? "Espanhol" : "Português"],
  ];
  return (
    <div className="space-y-6">
      <Link href="/admin/quiz/participantes" className="inline-flex min-h-11 items-center text-sm font-semibold text-rose-600">
        ← Participantes
      </Link>
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-cocoa-900">{p.name}</h2>
          <ParticipantStatus status={p.status} />
          {p.reason && <span className="text-xs text-cocoa-500">{p.reason}</span>}
        </div>
        <dl className="mb-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-cocoa-500">{k}</dt>
              <dd className="tabular font-semibold text-cocoa-900">{v}</dd>
            </div>
          ))}
        </dl>
        <ParticipantEditor key={p.name} p={p} />
      </Panel>
      <Panel title="Respostas">
        {answers.length === 0 ? (
          <p className="text-sm text-cocoa-500">Nenhuma resposta ainda.</p>
        ) : (
          <ol className="divide-y divide-blush-100" data-testid="answer-list">
            {answers.map((a) => (
              <li key={a.questionId} className="flex items-start gap-3 py-3 text-sm">
                <span className={`mt-0.5 font-bold ${a.correct ? "text-success" : "text-danger"}`}>
                  <span aria-hidden="true">{a.correct ? "✓" : "✗"}</span>
                  <span className="sr-only">{a.correct ? "Acertou" : "Errou"}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-cocoa-900">
                    {a.question} {a.round === "extra" && <span className="badge bg-champagne-200/60 text-champagne-700">Desempate</span>}
                  </p>
                  <p className="text-cocoa-500">
                    Respondeu: <strong className="text-cocoa-700">{a.option}</strong>
                    {!a.correct && a.correctOption && <> · Correta: {a.correctOption}</>}
                  </p>
                </div>
                <span className="tabular shrink-0 text-xs text-cocoa-500">{a.correct ? `+${a.points}` : "0"}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
