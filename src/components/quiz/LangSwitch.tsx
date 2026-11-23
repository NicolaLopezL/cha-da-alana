"use client";

import { useState } from "react";
import type { QuizLang } from "@/lib/quiz/types";
import { Flag } from "./Art";

const LABEL: Record<QuizLang, string> = { pt: "Português", es: "Español" };

/** Idioma atual + troca (lembrada neste aparelho). */
export function useQuizLang(initial: QuizLang) {
  const [lang, setLang] = useState<QuizLang>(initial);
  const change = (next: QuizLang) => {
    setLang(next);
    document.cookie = `alana_quiz_lang=${next};path=/;max-age=15552000;samesite=lax`;
  };
  return [lang, change] as const;
}

export function LangSwitch({ lang, onChange, label }: { lang: QuizLang; onChange: (l: QuizLang) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border border-blush-200 bg-paper/90 p-1 shadow-[var(--shadow-soft)]" data-testid="lang-switch">
      {(["pt", "es"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l === "pt" ? "pt-BR" : "es-CO"}
          aria-pressed={lang === l}
          onClick={() => onChange(l)}
          className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
            lang === l ? "bg-blush-100 text-cocoa-900" : "text-cocoa-500 hover:bg-blush-50"
          }`}
        >
          <Flag lang={l} size={15} />
          {LABEL[l]}
        </button>
      ))}
    </div>
  );
}
