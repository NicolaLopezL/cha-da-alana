"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { formatDuration, quizDict } from "@/lib/quiz/i18n";
import type { FinalState, QuizLang, QuizTextOverrides } from "@/lib/quiz/types";
import { OrnamentFrame, Particles } from "@/components/invite/Ornaments";
import { Bear, HeartRain, Medal } from "./Art";
import { LangSwitch, useQuizLang } from "./LangSwitch";

export function FinalRanking({ state, texts, initialLang }: { state: FinalState; texts: QuizTextOverrides; initialLang: QuizLang }) {
  const [lang, setLang] = useQuizLang(initialLang);
  const d = quizDict(lang, texts);
  const router = useRouter();

  // Aparece sozinho quando a organizadora publicar (e some se ela ocultar).
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && router.refresh(), state.published ? 30_000 : 8000);
    return () => clearInterval(id);
  }, [router, state.published]);

  return (
    <main lang={lang === "pt" ? "pt-BR" : "es-CO"} className="paper-ivory relative min-h-dvh overflow-x-clip" data-testid="final-ranking" data-published={state.published}>
      <OrnamentFrame className="!fixed max-sm:hidden" />
      <Particles />
      {state.published && state.rows.length > 0 && <HeartRain />}
      <div className="relative z-10 mx-auto max-w-2xl px-5 pb-[calc(var(--safe-bottom)+3.5rem)] pt-[calc(var(--safe-top)+2.5rem)] text-center">
        <LangSwitch lang={lang} onChange={setLang} label={d.language} />
        <p className="eyebrow mt-7">{d.brand}</p>
        <Bear size={116} id="final-bear" className="animate-float-soft mx-auto mt-4" />
        <h1 className="display mt-4 text-[clamp(2.4rem,9vw,3.6rem)] text-cocoa-900">{d.finalTitle}</h1>
        <p className="display mt-1 text-xl italic text-rose-600">{d.title}</p>

        {!state.published ? (
          <div className="mt-8" data-testid="final-hidden">
            <p className="text-lg font-semibold text-cocoa-700">{d.finalNotYet}</p>
            <p className="mx-auto mt-2 max-w-[36ch] text-cocoa-500">{d.finalNotYetHint}</p>
          </div>
        ) : (
          <>
            <p className="mt-4 flex flex-wrap justify-center gap-x-4 text-sm font-semibold text-cocoa-500">
              <span data-testid="final-count">{d.participants(state.participants)}</span>
              <span data-testid="final-max">{d.maxScore(state.maxScore)}</span>
            </p>
            {state.rows.length === 0 && <p className="mt-8 text-cocoa-500">{d.noParticipants}</p>}
            <ol className="mt-7 space-y-3 text-left">
              {state.rows.map((r, i) => (
                <li
                  key={r.id}
                  data-testid="final-row"
                  data-pos={r.pos}
                  className={`podium-in flex items-center gap-4 rounded-3xl border px-4 py-3.5 shadow-[var(--shadow-soft)] ${
                    r.pos === 1 ? "border-champagne-400/60 bg-gradient-to-r from-champagne-200/80 to-blush-100" : r.pos <= 3 ? "border-blush-200 bg-blush-50" : "border-blush-100 bg-paper"
                  }`}
                  style={{ animationDelay: `${Math.min(i, 12) * 0.08}s` }}
                >
                  <span className="flex w-12 shrink-0 justify-center">
                    {r.pos <= 3 ? (
                      <>
                        <Medal pos={r.pos as 1 | 2 | 3} size={46} />
                        <span className="sr-only">{r.pos}º</span>
                      </>
                    ) : (
                      <span className="tabular text-lg font-bold text-rose-600">{r.pos}º</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-bold text-cocoa-900">{r.name}</span>
                    {(r.tied || state.tiebreakMode === "time") && (
                      <span className="flex gap-3 text-xs font-semibold text-cocoa-500">
                        {state.tiebreakMode === "time" && r.durationMs !== null && <span className="tabular">{formatDuration(r.durationMs)}</span>}
                        {r.tied && <span className="text-champagne-700">{d.tied}</span>}
                      </span>
                    )}
                  </span>
                  <span className="tabular shrink-0 text-lg font-bold text-rose-600">{d.points(r.score)}</span>
                </li>
              ))}
            </ol>
          </>
        )}
        <Link href="/" prefetch={false} className="btn btn-ghost mt-10">
          {d.backToInvite}
        </Link>
      </div>
    </main>
  );
}
