"use client";

import { quizDict } from "@/lib/quiz/i18n";
import type { QuizLang } from "@/lib/quiz/types";
import { OrnamentFrame, Particles } from "@/components/invite/Ornaments";
import { Bear } from "./Art";
import { FullscreenButton } from "./FullscreenButton";
import { LangSwitch, useQuizLang } from "./LangSwitch";

/** Tela do QR Code para televisão, projetor ou celular. */
export function QrScreen({ svg, url, initialLang }: { svg: string; url: string; initialLang: QuizLang }) {
  const [lang, setLang] = useQuizLang(initialLang);
  const d = quizDict(lang);
  return (
    <main lang={lang === "pt" ? "pt-BR" : "es-CO"} className="paper-ivory relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-12 text-center" data-testid="qr-screen">
      <OrnamentFrame />
      <Particles />
      <div className="relative z-10 flex flex-col items-center">
        <Bear size="min(16vh, 30vw)" id="qr-bear" className="animate-float-soft" />
        <p className="eyebrow mt-3">{d.brand}</p>
        <h1 className="display mt-2 text-[clamp(2.2rem,6.4vh,5rem)] text-cocoa-900">{d.qrTitle}</h1>
        <p className="mt-2 max-w-[52ch] text-[clamp(1.05rem,2.6vh,1.9rem)] text-cocoa-700">{d.qrText}</p>
        <div
          role="img"
          aria-label={d.qrAlt}
          className="mt-[3vh] rounded-[28px] border border-champagne-400/50 bg-white p-[1.8vh] shadow-[var(--shadow-paper)] [&_svg]:block [&_svg]:h-[min(38vh,72vw)] [&_svg]:w-[min(38vh,72vw)]"
          data-testid="qr-code"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="mt-[2vh] text-[clamp(0.95rem,2.2vh,1.5rem)] font-semibold text-rose-600" data-testid="qr-url">
          {url.replace(/^https?:\/\//, "")}
        </p>
        <div className="mt-[2.4vh] flex flex-wrap items-center justify-center gap-2 [:fullscreen_&]:hidden">
          <LangSwitch lang={lang} onChange={setLang} label={d.language} />
          <FullscreenButton enter={d.fullscreen} exit={d.exitFullscreen} />
        </div>
      </div>
    </main>
  );
}
