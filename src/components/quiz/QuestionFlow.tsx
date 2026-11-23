"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pick, type QuizDict } from "@/lib/quiz/i18n";
import type { AnswerResult, PublicQuestion, QuizError, QuizLang } from "@/lib/quiz/types";
import { IconCheck } from "@/components/invite/Icons";

const PENDING_KEY = "alana-quiz-pending";
const ADVANCE_MS = 480;

type Pending = { q: string; o: string };
type SaveState = "idle" | "saving" | "saved" | "offline";

function readPending(): Pending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null");
    return p && typeof p.q === "string" && typeof p.o === "string" ? p : null;
  } catch {
    return null;
  }
}
function writePending(p: Pending | null) {
  try {
    if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else localStorage.removeItem(PENDING_KEY);
  } catch {}
}

/** null = falha de rede/servidor: vale tentar de novo. */
async function post(p: Pending): Promise<AnswerResult | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch("/api/quiz/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: p.q, optionId: p.o }),
      signal: ctrl.signal,
      keepalive: true,
    });
    if (res.status >= 500 || res.status === 429) return null;
    return (await res.json()) as AnswerResult;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

interface Props {
  questions: PublicQuestion[];
  initialAnswers: Record<string, string>;
  name: string;
  lang: QuizLang;
  d: QuizDict;
  onFinished: () => void;
  onFatal: (error: QuizError) => void;
}

/** Uma pergunta por tela: tocar salva sozinho e só avança depois que o servidor confirma. */
export function QuestionFlow({ questions, initialAnswers, name, lang, d, onFinished, onFatal }: Props) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [index, setIndex] = useState(() => Math.max(0, questions.findIndex((q) => !initialAnswers[q.id])));
  const [choice, setChoice] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const saved = useRef(initialAnswers);
  const busy = useRef(false);
  const alive = useRef(true);
  const wake = useRef<(() => void) | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  const total = questions.length;
  const q = questions[index];
  const answered = questions.filter((x) => answers[x.id]).length;

  const submit = useCallback(
    async (questionId: string, optionId: string) => {
      if (busy.current) return; // toque duplicado
      busy.current = true;
      setChoice(optionId);
      setSave("saving");
      const pending = { q: questionId, o: optionId };
      writePending(pending);

      let res: AnswerResult | null = null;
      for (let attempt = 0; alive.current; attempt++) {
        res = await post(pending);
        if (res || !alive.current) break;
        setSave("offline");
        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, Math.min(8000, 1200 * 2 ** attempt));
          wake.current = () => {
            clearTimeout(t);
            resolve();
          };
        });
        wake.current = null;
        if (alive.current) setSave("saving");
      }
      if (!res || !alive.current) return; // a resposta continua guardada no aparelho
      writePending(null);
      if ("error" in res) {
        busy.current = false;
        setSave("idle");
        setChoice(null);
        onFatal(res.error);
        return;
      }
      const { finished } = res;
      setSave("saved");
      await new Promise((r) => setTimeout(r, ADVANCE_MS));
      if (!alive.current) return;
      busy.current = false;
      if (finished) {
        onFinished();
        return;
      }
      saved.current = { ...saved.current, [questionId]: optionId };
      const at = questions.findIndex((x) => x.id === questionId);
      const next = at + 1 < questions.length ? at + 1 : questions.findIndex((x) => !saved.current[x.id]);
      moved.current = true;
      setAnswers(saved.current);
      setIndex(Math.max(0, next));
      setChoice(null);
      setSave("idle");
    },
    [onFatal, onFinished, questions],
  );

  // Retoma uma resposta que não chegou a ser salva (fechou a página ou caiu a internet).
  useEffect(() => {
    alive.current = true;
    const p = readPending();
    if (p) {
      const at = questions.findIndex((x) => x.id === p.q && x.options.some((o) => o.id === p.o));
      if (at >= 0 && initialAnswers[p.q] !== p.o) {
        queueMicrotask(() => {
          if (!alive.current) return;
          setIndex(at);
          void submit(p.q, p.o);
        });
      } else writePending(null);
    }
    const retry = () => wake.current?.();
    window.addEventListener("online", retry);
    return () => {
      alive.current = false;
      busy.current = false;
      window.removeEventListener("online", retry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na montagem
  }, []);

  // Anuncia a nova pergunta para leitores de tela e volta ao topo.
  useEffect(() => {
    if (!moved.current) return;
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [index]);

  const go = (to: number) => {
    if (busy.current) return;
    moved.current = true;
    setChoice(null);
    setSave("idle");
    setIndex(to);
  };

  if (!q) return null;
  const selected = choice ?? answers[q.id] ?? null;
  const locked = save !== "idle";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col" data-testid="quiz-question" data-index={index}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-cocoa-500">{d.hello(name)}</p>
        <p className="tabular text-sm font-semibold text-rose-600" data-testid="question-counter">
          {d.questionOf(index + 1, total)}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={d.progress}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
        className="mt-2 h-3 overflow-hidden rounded-full bg-blush-100"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-blush-300 to-rose-600 transition-[width] duration-500"
          style={{ width: `${total ? (answered / total) * 100 : 0}%` }}
        />
      </div>

      <div key={q.id} className="quiz-in flex flex-1 flex-col justify-center py-8">
        <h2 ref={heading} tabIndex={-1} id="quiz-question-title" className="display text-center text-[clamp(1.9rem,7vw,2.7rem)] text-cocoa-900 outline-none">
          {pick(q, lang)}
        </h2>
        <p className="mt-3 text-center text-sm text-cocoa-500">{d.chooseOne}</p>
        <div role="group" aria-labelledby="quiz-question-title" className="mt-7 space-y-3.5">
          {q.options.map((o) => {
            const on = selected === o.id;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                aria-disabled={locked}
                onClick={() => !locked && submit(q.id, o.id)}
                data-testid="quiz-option"
                className={`flex min-h-[72px] w-full items-center gap-4 rounded-3xl border-2 px-5 py-4 text-left text-xl font-semibold transition duration-200 active:scale-[0.98] ${
                  on
                    ? "border-rose-600 bg-blush-100 text-cocoa-900 shadow-[var(--shadow-soft)]"
                    : "border-blush-200 bg-paper text-cocoa-700 hover:border-blush-300 hover:bg-blush-50"
                } ${locked && !on ? "opacity-55" : ""}`}
                style={{ touchAction: "manipulation" }}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    on ? "border-rose-600 bg-rose-600 text-paper" : "border-blush-300 bg-paper text-transparent"
                  }`}
                >
                  <IconCheck size={20} strokeWidth={2.5} />
                </span>
                {pick(o, lang)}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex min-h-12 items-center justify-center text-center">
          <p role="status" aria-live="polite" data-testid="save-status" data-state={save} className={`text-sm font-medium ${save === "offline" ? "text-danger" : save === "saved" ? "text-success" : "text-cocoa-500"}`}>
            {save === "saving" && d.saving}
            {save === "saved" && `✓ ${d.saved}`}
            {save === "offline" && d.offline}
          </p>
        </div>
        {save === "offline" && (
          <button type="button" onClick={() => wake.current?.()} className="btn btn-soft mx-auto mt-1">
            {d.retryNow}
          </button>
        )}
      </div>

      <div className="flex min-h-14 items-center justify-between gap-3 pb-2">
        {index > 0 ? (
          <button type="button" onClick={() => go(index - 1)} disabled={locked} className="btn btn-ghost" data-testid="quiz-back">
            ← {d.back}
          </button>
        ) : (
          <span />
        )}
        {answers[q.id] && index < total - 1 && (
          <button type="button" onClick={() => go(index + 1)} disabled={locked} className="btn btn-ghost" data-testid="quiz-next">
            {d.next} →
          </button>
        )}
      </div>
    </div>
  );
}
