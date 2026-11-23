import Link from "next/link";
import { quizDict } from "@/lib/quiz/i18n";
import type { QuizStatus } from "@/lib/quiz/types";
import { Bear } from "@/components/quiz/Art";
import { IconHeart } from "./Icons";

/** Brincadeiras do chá (quiz dos papais). O botão só aparece com o quiz aberto ou com resultado publicado. */
export function GamesSection({ status }: { status: QuizStatus }) {
  const d = quizDict("pt");
  return (
    <section id="brincadeiras" className="px-4 py-10 sm:py-16" aria-labelledby="brincadeiras-title" data-testid="games-section">
      <div data-reveal className="relative mx-auto max-w-3xl overflow-hidden rounded-[32px] bg-blush-100 px-6 pb-12 pt-10 text-center sm:px-14 sm:py-14">
        <div className="pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" style={{ backgroundImage: "var(--paper-grain)" }} />
        <div className="relative">
          <p className="eyebrow">{d.gamesEyebrow}</p>
          <h2 id="brincadeiras-title" className="display mt-2 text-[2.1rem] text-cocoa-700 sm:text-5xl">
            <span aria-hidden="true">🎀 </span>
            {d.gamesTitle}
          </h2>
          <Bear size={110} id="games-bear" className="animate-float-soft mx-auto mt-5" />
          <h3 className="display mt-4 text-[1.7rem] italic text-rose-600">{d.gamesName}</h3>
          <p className="mx-auto mt-2 max-w-[38ch] leading-relaxed text-cocoa-700/85" data-testid="games-text">
            {status === "draft" ? `🧸 ${d.notOpen}` : status === "open" ? d.title : d.gamesEnded}
          </p>
          {status === "open" && (
            <Link href="/quiz" className="cta-glow mt-7" data-testid="games-link">
              <span className="cta-glow-shine" aria-hidden="true" />
              <IconHeart size={20} />
              {d.gamesOpen}
            </Link>
          )}
          {status === "published" && (
            <Link href="/quiz/ranking" className="cta-soft mt-7" data-testid="games-link">
              {d.seeFinal}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
