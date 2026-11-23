"use client";

import Link from "next/link";
import { setQuizStatusAction } from "@/app/admin/quiz-actions";
import { formatDuration } from "@/lib/quiz/i18n";
import type { AdminQuizState } from "@/lib/quiz/types";
import { Panel } from "../parts";
import { ActionButton, btnClass, QuizStatusBadge, usePolled } from "./kit";

export function QuizOverview({ initial }: { initial: AdminQuizState }) {
  const s = usePolled("/admin/quiz/dados", initial);
  const ready = s.questions > 0 && s.missingKey === 0;
  const tied = s.ranking.some((r) => r.tied && r.pos <= 3 && r.status === "done");

  const stats: [string, string | number, string][] = [
    ["Participantes", s.stats.total, "total"],
    ["Respondendo agora", s.stats.active, "active"],
    ["Concluídas", s.stats.done, "done"],
    ["Respostas registradas", s.stats.answers, "answers"],
    ["Pontuação média", s.stats.avgScore === null ? "—" : String(s.stats.avgScore).replace(".", ","), "avg"],
    ["Pontuação máxima", s.maxScore, "max"],
    ["Perguntas ativas", s.questions, "questions"],
  ];

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-cocoa-500">Situação:</span>
          <QuizStatusBadge status={s.status} />
          {s.stats.invalid > 0 && <span className="text-xs text-cocoa-500">{s.stats.invalid} invalidada(s)</span>}
        </div>

        {s.status === "draft" && !ready && (
          <div className="mt-4 rounded-2xl bg-champagne-200/40 p-4 text-sm text-cocoa-700" data-testid="missing-key">
            {s.questions === 0 ? "Ative pelo menos uma pergunta." : `Falta definir a resposta correta de ${s.missingKey} pergunta(s).`}{" "}
            <Link href="/admin/quiz/perguntas" className="font-semibold text-rose-600 underline underline-offset-4">
              Ir para Perguntas
            </Link>
          </div>
        )}
        {s.missingEs > 0 && s.status !== "published" && (
          <p className="mt-3 text-xs text-cocoa-500">
            {s.missingEs} pergunta(s) ainda sem tradução completa para o espanhol (nesses casos aparece o português).
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {s.status === "draft" && (
            <ActionButton
              variant="rose"
              size="lg"
              disabled={!ready}
              action={() => setQuizStatusAction("open")}
              confirm="Abrir o quiz agora? Depois de aberto, as perguntas e a regra de desempate ficam travadas."
              testId="quiz-open"
            >
              Abrir Quiz
            </ActionButton>
          )}
          {s.status === "open" && (
            <ActionButton
              variant="primary"
              size="lg"
              action={() => setQuizStatusAction("closed")}
              confirm={
                s.closePolicy === "block"
                  ? `Encerrar o quiz? ${s.stats.active ? `${s.stats.active} pessoa(s) ainda estão respondendo e não poderão terminar.` : ""}`
                  : "Encerrar o quiz? Quem já começou ainda poderá terminar."
              }
              testId="quiz-close"
            >
              Encerrar Quiz
            </ActionButton>
          )}
          {s.status === "closed" && (
            <>
              <ActionButton
                variant="rose"
                size="lg"
                action={() => setQuizStatusAction("published")}
                confirm={tied && s.tiebreakMode === "extra" ? "Ainda há empate entre os primeiros lugares. Publicar assim mesmo?" : "Publicar o ranking final para todos?"}
                testId="quiz-publish"
              >
                Publicar Resultados
              </ActionButton>
              <ActionButton action={() => setQuizStatusAction("open")} confirm="Reabrir o quiz para novas respostas?" size="lg" testId="quiz-reopen">
                Reabrir Quiz
              </ActionButton>
            </>
          )}
          {s.status === "published" && (
            <ActionButton size="lg" variant="primary" action={() => setQuizStatusAction("closed")} confirm="Ocultar o ranking final?" testId="quiz-unpublish">
              Ocultar Resultados
            </ActionButton>
          )}
          <Link href="/admin/quiz/desempate" className={btnClass("ghost", "lg")}>
            Configurar Desempate
          </Link>
          <Link href="/admin/quiz/ao-vivo" className={btnClass("ghost", "lg")}>
            Ranking ao Vivo {s.live.enabled ? (s.live.hidden ? "(oculto)" : "(no ar)") : "(desligado)"}
          </Link>
        </div>
      </Panel>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value, key]) => (
          <div key={key} className="admin-panel p-4">
            <dt className="text-xs font-semibold text-cocoa-500">{label}</dt>
            <dd className="tabular mt-1 text-3xl font-bold text-cocoa-900" data-testid={`stat-${key}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <Panel
        title={s.status === "published" ? "Ranking final" : s.status === "closed" ? "Classificação (só quem concluiu)" : "Ranking provisório"}
        description={s.status === "open" ? "Atualiza sozinho. Só você vê esta lista; o público vê apenas o que for liberado em Ranking ao vivo." : undefined}
      >
        {s.ranking.length === 0 ? (
          <p className="text-sm text-cocoa-500">Ninguém participou ainda.</p>
        ) : (
          <ol className="divide-y divide-blush-100" data-testid="admin-ranking">
            {s.ranking.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="tabular w-9 shrink-0 font-bold text-rose-600">{r.pos}º</span>
                <Link href={`/admin/quiz/participantes/${r.id}`} className="min-w-0 flex-1 truncate font-semibold text-cocoa-900 hover:underline">
                  {r.name}
                  {r.tied && r.answered > 0 && <span className="ml-2 text-xs font-semibold text-champagne-700">empate</span>}
                </Link>
                <span className="tabular shrink-0 text-xs text-cocoa-500">
                  {r.status === "done" ? formatDuration(r.durationMs) : `${r.answered}/${s.questions}`}
                </span>
                <span className="tabular w-14 shrink-0 text-right font-bold text-cocoa-900">{r.score} pts</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
