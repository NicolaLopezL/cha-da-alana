"use client";

import { useState } from "react";
import { questionOpAction, saveQuestionAction, setKeyAction } from "@/app/admin/quiz-actions";
import type { AdminQuestion, QuizStatus } from "@/lib/quiz/types";
import { ActionButton, btnClass, useQuizAction } from "./kit";

/** Lista e editor de perguntas (do quiz ou extras de desempate). */
export function QuestionManager({ questions, round, status, defaultPoints }: { questions: AdminQuestion[]; round: "main" | "extra"; status: QuizStatus; defaultPoints: number }) {
  const [editing, setEditing] = useState<string | null>(null);
  const locked = round === "main" && status !== "draft";
  const missing = questions.filter((q) => q.active && !q.key).length;

  return (
    <div className="space-y-4">
      {locked && (
        <p className="rounded-2xl bg-champagne-200/40 p-4 text-sm text-cocoa-700" data-testid="questions-locked">
          O quiz já foi aberto: para proteger as respostas recebidas, só a tradução para o espanhol pode ser editada.
          {status === "closed" && " Com o quiz encerrado, a resposta correta ainda pode ser corrigida (as pontuações são recalculadas)."}
        </p>
      )}
      {!locked && missing > 0 && (
        <p className="rounded-2xl bg-blush-100 p-4 text-sm text-cocoa-700">
          {missing} pergunta(s) sem resposta correta. <strong>Toque na alternativa certa</strong> de cada pergunta para definir o gabarito.
        </p>
      )}
      {!locked && editing !== "new" && (
        <button type="button" className={btnClass("primary")} onClick={() => setEditing("new")} data-testid="question-new">
          + {round === "extra" ? "Nova pergunta extra" : "Nova pergunta"}
        </button>
      )}
      {editing === "new" && (
        <div className="admin-panel p-5">
          <QuestionForm round={round} defaultPoints={defaultPoints} esOnly={false} onClose={() => setEditing(null)} />
        </div>
      )}
      <ol className="space-y-3" data-testid="question-list">
        {questions.map((q, i) => {
          const frozen = locked || q.used;
          const keyOpen = round === "main" ? status === "draft" || status === "closed" : !q.used;
          return (
            <li key={q.id} className={`admin-panel p-4 sm:p-5 ${q.active ? "" : "opacity-70"}`} data-testid="question-card">
              {editing === q.id ? (
                <QuestionForm q={q} round={round} defaultPoints={defaultPoints} esOnly={frozen} onClose={() => setEditing(null)} />
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <span className="tabular mt-0.5 w-7 shrink-0 text-sm font-bold text-rose-600">{i + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-cocoa-900">{q.pt}</p>
                      <p className="text-sm italic text-cocoa-500">{q.es || "Sem tradução para o espanhol"}</p>
                      <p className="mt-1 flex flex-wrap gap-2 text-xs">
                        <span className="badge bg-blush-50 text-cocoa-500">{q.points === 1 ? "1 ponto" : `${q.points} pontos`}</span>
                        {!q.active && <span className="badge bg-blush-50 text-danger">Desativada</span>}
                        {!q.key && <span className="badge bg-champagne-200/60 text-champagne-700">Sem resposta correta</span>}
                        {q.used && <span className="badge bg-champagne-200/60 text-champagne-700">Já usada no desempate</span>}
                      </p>
                    </div>
                  </div>
                  <KeyPicker q={q} disabled={!keyOpen} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={btnClass("ghost", "sm")} onClick={() => setEditing(q.id)}>
                      {frozen ? "Editar tradução" : "Editar"}
                    </button>
                    {!frozen && (
                      <>
                        <ActionButton size="sm" label={`Subir: ${q.pt}`} disabled={i === 0} action={() => questionOpAction("up", q.id, q.pt)}>
                          ↑
                        </ActionButton>
                        <ActionButton size="sm" label={`Descer: ${q.pt}`} disabled={i === questions.length - 1} action={() => questionOpAction("down", q.id, q.pt)}>
                          ↓
                        </ActionButton>
                        <ActionButton size="sm" action={() => questionOpAction("duplicate", q.id, q.pt)}>
                          Duplicar
                        </ActionButton>
                        <ActionButton size="sm" action={() => questionOpAction(q.active ? "deactivate" : "activate", q.id, q.pt)}>
                          {q.active ? "Desativar" : "Ativar"}
                        </ActionButton>
                        <ActionButton size="sm" variant="danger" confirm={`Excluir a pergunta “${q.pt}”?`} action={() => questionOpAction("delete", q.id, q.pt)}>
                          Excluir
                        </ActionButton>
                      </>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ol>
      {questions.length === 0 && <p className="text-sm text-cocoa-500">Nenhuma pergunta cadastrada.</p>}
    </div>
  );
}

function KeyPicker({ q, disabled }: { q: AdminQuestion; disabled: boolean }) {
  const { run, pending } = useQuizAction();
  return (
    <div role="radiogroup" aria-label={`Resposta correta: ${q.pt}`} className="mt-3 flex flex-wrap gap-2 pl-10">
      {q.options.map((o) => {
        const on = q.key === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled || pending}
            onClick={() => !on && run(() => setKeyAction(q.id, o.id, `${q.pt} → ${o.pt}`))}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition disabled:cursor-not-allowed ${
              on ? "border-success bg-[#e5efe7] text-success" : "border-blush-200 bg-paper text-cocoa-500 hover:bg-blush-50 disabled:opacity-60"
            }`}
          >
            <span aria-hidden="true">{on ? "✓" : "○"}</span>
            {o.pt}
          </button>
        );
      })}
    </div>
  );
}

interface DraftOption {
  id?: string;
  pt: string;
  es: string;
}

function QuestionForm({ q, round, defaultPoints, esOnly, onClose }: { q?: AdminQuestion; round: "main" | "extra"; defaultPoints: number; esOnly: boolean; onClose: () => void }) {
  const { run, pending } = useQuizAction();
  const [pt, setPt] = useState(q?.pt ?? "");
  const [es, setEs] = useState(q?.es ?? "");
  const [points, setPoints] = useState(String(q?.points ?? defaultPoints));
  const [options, setOptions] = useState<DraftOption[]>(
    q?.options.map((o) => ({ id: o.id, pt: o.pt, es: o.es })) ?? [
      { pt: "Nicola", es: "Nicola" },
      { pt: "Yasmin", es: "Yasmin" },
      { pt: "Os dois", es: "Los dos" },
    ],
  );
  const [correct, setCorrect] = useState<number | null>(() => {
    const i = q ? q.options.findIndex((o) => o.id === q.key) : -1;
    return i >= 0 ? i : null;
  });
  const [error, setError] = useState("");
  const uid = q?.id ?? `new-${round}`;

  const patch = (i: number, p: Partial<DraftOption>) => setOptions((list) => list.map((o, j) => (j === i ? { ...o, ...p } : o)));
  const remove = (i: number) => {
    setOptions((list) => list.filter((_, j) => j !== i));
    setCorrect((c) => (c === null || c === i ? null : c > i ? c - 1 : c));
  };
  const save = () => {
    setError("");
    run(
      () => saveQuestionAction({ id: q?.id, round, active: q?.active ?? true, points: Number(points), pt, es, options, correct }),
      (r) => (r.ok ? onClose() : setError(r.message)),
    );
  };

  return (
    <div className="space-y-4" data-testid="question-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-[0.8rem] font-semibold text-cocoa-700">
          Pergunta em português
          <textarea rows={2} maxLength={300} value={pt} disabled={esOnly} onChange={(e) => setPt(e.target.value)} className="admin-field mt-1 disabled:opacity-60" />
        </label>
        <label className="block text-[0.8rem] font-semibold text-cocoa-700">
          Pergunta em espanhol
          <textarea rows={2} maxLength={300} value={es} lang="es" onChange={(e) => setEs(e.target.value)} className="admin-field mt-1" />
        </label>
      </div>

      <fieldset>
        <legend className="text-[0.8rem] font-semibold text-cocoa-700">Alternativas {esOnly ? "" : "(marque a correta)"}</legend>
        <ul className="mt-2 space-y-2">
          {options.map((o, i) => (
            <li key={o.id ?? i} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${uid}`}
                aria-label={`Alternativa ${i + 1} é a correta`}
                checked={correct === i}
                disabled={esOnly}
                onChange={() => setCorrect(i)}
                className="h-5 w-5 shrink-0 accent-[#4f7a5b]"
              />
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <input aria-label={`Alternativa ${i + 1} em português`} placeholder="Português" maxLength={120} value={o.pt} disabled={esOnly} onChange={(e) => patch(i, { pt: e.target.value })} className="admin-field disabled:opacity-60" />
                <input aria-label={`Alternativa ${i + 1} em espanhol`} placeholder="Español" lang="es" maxLength={120} value={o.es} onChange={(e) => patch(i, { es: e.target.value })} className="admin-field" />
              </div>
              {!esOnly && (
                <button type="button" disabled={options.length <= 2} onClick={() => remove(i)} aria-label={`Remover alternativa ${i + 1}`} className={btnClass("danger", "sm")}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
        {!esOnly && options.length < 8 && (
          <button type="button" onClick={() => setOptions((l) => [...l, { pt: "", es: "" }])} className={`${btnClass("ghost", "sm")} mt-2`}>
            + Alternativa
          </button>
        )}
      </fieldset>

      {!esOnly && (
        <label className="block w-40 text-[0.8rem] font-semibold text-cocoa-700">
          Pontos se acertar
          <input type="number" min={1} max={100} inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} className="admin-field mt-1" />
        </label>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={save} className={btnClass("primary")}>
          Salvar pergunta
        </button>
        <button type="button" onClick={onClose} className={btnClass("ghost")}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
