"use client";

import { useState } from "react";
import { closeRoundAction, saveQuizConfigAction, startRoundAction } from "@/app/admin/quiz-actions";
import type { AdminQuestion, AdminQuizState, TiebreakMode } from "@/lib/quiz/types";
import { Panel } from "../parts";
import { ActionButton, usePolled, useQuizAction } from "./kit";
import { QuestionManager } from "./Questions";

const MODES: [TiebreakMode, string, string][] = [
  ["time", "Menor tempo de conclusão", "Com a mesma pontuação, vence quem terminou mais rápido (tempo medido no servidor)."],
  ["extra", "Perguntas extras", "Depois de encerrar o quiz, você inicia uma rodada só para os empatados."],
  ["shared", "Empate permitido", "Quem empatar divide a mesma posição."],
];

export function Tiebreak({ initial, extras }: { initial: AdminQuizState; extras: AdminQuestion[] }) {
  const s = usePolled("/admin/quiz/dados", initial);
  const { run, pending } = useQuizAction();
  const [picked, setPicked] = useState<string[]>([]);
  const draft = s.status === "draft";
  const open = s.rounds.find((r) => r.status === "open");
  const available = extras.filter((q) => q.active && q.key && !q.used);
  const chosen = picked.filter((id) => available.some((q) => q.id === id));

  // Grupos de empatados (mesma posição), na ordem do ranking
  const groups = new Map<number, typeof s.ranking>();
  for (const r of s.ranking) if (r.tied) groups.set(r.pos, [...(groups.get(r.pos) ?? []), r]);

  return (
    <div className="space-y-6">
      <Panel title="Regra de desempate" description={draft ? "Escolha antes de abrir o quiz." : "A regra foi travada quando o quiz abriu."}>
        <div role="radiogroup" aria-label="Regra de desempate" className="grid gap-3 sm:grid-cols-3">
          {MODES.map(([mode, label, hint]) => {
            const on = s.tiebreakMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!draft || pending}
                onClick={() => !on && run(() => saveQuizConfigAction({ tiebreakMode: mode }))}
                data-testid={`tiebreak-${mode}`}
                className={`rounded-2xl border-2 p-4 text-left transition disabled:cursor-not-allowed ${on ? "border-rose-600 bg-blush-50" : "border-blush-100 hover:border-blush-200 disabled:opacity-55"}`}
              >
                <span className="block text-sm font-bold text-cocoa-900">
                  {on ? "✓ " : ""}
                  {label}
                </span>
                <span className="mt-1 block text-xs text-cocoa-500">{hint}</span>
              </button>
            );
          })}
        </div>
      </Panel>

      {s.tiebreakMode === "extra" && (
        <>
          <Panel title="Rodadas de desempate" description="Encerre o quiz, escolha as perguntas extras e inicie a rodada. Os empatados recebem as perguntas na própria tela de agradecimento.">
            {open && (
              <div className="rounded-2xl border-2 border-rose-600 bg-blush-50 p-4" data-testid="round-open">
                <p className="font-bold text-cocoa-900">Rodada {open.number} em andamento</p>
                <ul className="mt-2 space-y-1 text-sm text-cocoa-700">
                  {open.members.map((m) => (
                    <li key={m.id} className="tabular flex justify-between gap-3">
                      <span>{m.name}</span>
                      <span>
                        {m.answered}/{open.questions} · {m.score} pts {m.finished ? "✓" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  <ActionButton
                    variant="primary"
                    testId="round-close"
                    confirm={open.members.every((m) => m.finished) ? "Encerrar a rodada e atualizar a classificação?" : "Nem todos terminaram. Encerrar assim mesmo?"}
                    action={() => closeRoundAction(open.id)}
                  >
                    Encerrar rodada
                  </ActionButton>
                </div>
              </div>
            )}

            {!open && s.status === "closed" && groups.size > 0 && (
              <div className="space-y-4">
                <fieldset>
                  <legend className="text-sm font-semibold text-cocoa-700">1. Perguntas desta rodada</legend>
                  {available.length === 0 && <p className="mt-1 text-sm text-cocoa-500">Cadastre perguntas extras com resposta correta logo abaixo.</p>}
                  {available.map((q) => (
                    <label key={q.id} className="flex min-h-11 items-center gap-3 text-sm text-cocoa-700">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-[#9c6266]"
                        checked={chosen.includes(q.id)}
                        onChange={(e) => setPicked((p) => (e.target.checked ? [...p, q.id] : p.filter((x) => x !== q.id)))}
                      />
                      {q.pt} <span className="text-xs text-cocoa-500">({q.points} pts)</span>
                    </label>
                  ))}
                </fieldset>
                <div>
                  <p className="text-sm font-semibold text-cocoa-700">2. Inicie para um grupo empatado</p>
                  <ul className="mt-2 space-y-2">
                    {[...groups.entries()].map(([pos, members]) => (
                      <li key={pos} className="flex flex-col gap-2 rounded-2xl border border-blush-100 p-3 sm:flex-row sm:items-center" data-testid="tied-group">
                        <span className="min-w-0 flex-1 text-sm text-cocoa-700">
                          <strong>{pos}º lugar</strong> ({members[0].score} pts): {members.map((m) => m.name).join(", ")}
                        </span>
                        <ActionButton variant="rose" disabled={chosen.length === 0} testId="round-start" action={() => startRoundAction(members.map((m) => m.id), chosen)}>
                          Iniciar rodada
                        </ActionButton>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {!open && s.status === "closed" && groups.size === 0 && <p className="text-sm text-cocoa-500">Não há empates. 🎉</p>}
            {!open && s.status !== "closed" && <p className="text-sm text-cocoa-500">Disponível com o quiz encerrado e antes de publicar os resultados.</p>}

            {s.rounds.some((r) => r.status === "closed") && (
              <div className="mt-5 space-y-2">
                {s.rounds
                  .filter((r) => r.status === "closed")
                  .map((r) => (
                    <p key={r.id} className="text-sm text-cocoa-500">
                      Rodada {r.number} (encerrada): {r.members.map((m) => `${m.name} ${m.score} pts`).join(" · ")}
                    </p>
                  ))}
              </div>
            )}
          </Panel>

          <section>
            <h2 className="mb-3 text-base font-bold text-cocoa-900">Perguntas extras</h2>
            <QuestionManager questions={extras} round="extra" status={s.status} defaultPoints={s.defaultPoints} />
          </section>
        </>
      )}
    </div>
  );
}
