"use client";

import Image from "next/image";
import { useRef, type MouseEvent } from "react";
import { IconArrowDown, IconGift, IconHeart } from "./Icons";
import { HeartBalloon, OrnamentFrame, Particles } from "./Ornaments";
import { gsap, prefersReducedMotion, SplitText, useGSAP } from "./gsap";

interface Props {
  opened: boolean;
  guestName: string | null;
  phrase: string;
  bearImageUrl: string;
  showBear: boolean;
  showDecorations: boolean;
  /** Seção dos presentes para o botão secundário (lista de enxoval ou sugestões); null esconde o botão. */
  giftTarget: "enxoval" | "presentes" | null;
}

/** Cena 3 — revelação da Alana: nome escrito à mão, frase e balão de coração. */
export function Hero({ opened, guestName, phrase, bearImageUrl, showBear, showDecorations, giftTarget }: Props) {
  const scope = useRef<HTMLElement>(null);

  const goTo = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const top = el.getBoundingClientRect().top + window.scrollY - 8;
    window.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };

  useGSAP(
    () => {
      if (!opened || prefersReducedMotion()) return;
      const q = gsap.utils.selector(scope);
      const split = SplitText.create(q("[data-hero-phrase]"), { type: "words", wordsClass: "inline-block", aria: "none" });

      const tl = gsap.timeline({ delay: 0.1 });
      tl.from(q("[data-hero-eyebrow]"), { opacity: 0, y: 10, duration: 0.9 })
        // "escrita" do nome: a máscara avança da esquerda para a direita
        .fromTo(
          q("[data-hero-name]"),
          { clipPath: "inset(-20% 100% -20% 0%)", opacity: 1 },
          { clipPath: "inset(-20% 0% -20% 0%)", duration: 2.4, ease: "power2.inOut" },
          "-=0.4",
        )
        .fromTo(
          q("[data-hero-pen]"),
          { left: "4%", opacity: 0 },
          { left: "96%", opacity: 1, duration: 2.4, ease: "power2.inOut" },
          "<",
        )
        .to(q("[data-hero-pen]"), { opacity: 0, scale: 0.4, duration: 0.5 }, ">-0.3")
        .from(split.words, { opacity: 0, y: 14, duration: 0.9, stagger: 0.06 }, "-=1.1")
        .from(q("[data-hero-rule]"), { scaleX: 0, opacity: 0, duration: 1 }, "-=0.6")
        .from(q("[data-hero-bear]"), { opacity: 0, y: 50, scale: 0.92, duration: 1.6, ease: "power3.out" }, "-=1.2")
        .from(q("[data-hero-cue]"), { opacity: 0, y: -8, duration: 0.8 }, "-=0.6");

      // Parallax suave do balão ao rolar
      gsap.to(q("[data-hero-bear]"), {
        yPercent: -18,
        ease: "none",
        scrollTrigger: { trigger: scope.current, start: "top top", end: "bottom top", scrub: true },
      });
      return () => split.revert();
    },
    { scope, dependencies: [opened] },
  );

  return (
    <section ref={scope} id="inicio" className="paper-ivory relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-14 sm:py-20">
      <OrnamentFrame />
      {showDecorations && <Particles count={6} />}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{ background: "radial-gradient(70% 50% at 50% 40%, rgb(255 253 249 / .95), transparent 70%)" }}
      />

      <div className="relative z-10 flex max-w-2xl flex-col items-center text-center">
        <p data-hero-eyebrow className="eyebrow mb-2 sm:mb-4">
          {guestName ? `Para ${guestName}` : "Chá de bebê"}
        </p>

        <div className="relative">
          <h1
            id="alana-title"
            tabIndex={-1}
            data-hero-name
            className="script px-[0.18em] pb-[0.08em] pt-[0.12em] text-[clamp(6rem,30vw,12.5rem)] text-rose-600 outline-none"
          >
            Alana
          </h1>
          <span
            data-hero-pen
            aria-hidden="true"
            className="pointer-events-none absolute top-[58%] h-3 w-3 -translate-x-1/2 rounded-full bg-champagne-200 opacity-0 shadow-[0_0_14px_6px_rgba(236,220,185,0.9)]"
          />
        </div>

        <div data-hero-rule className="rule-gold my-5 w-40 sm:w-56">
          <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10Z" />
          </svg>
        </div>

        <p data-hero-phrase className="display max-w-[20ch] text-[1.6rem] italic text-cocoa-700 sm:text-[2.1rem]">
          {phrase}
        </p>

        <div data-hero-cue className="mt-7 flex flex-col items-center gap-3 sm:mt-9">
          <a href="#confirmar" onClick={goTo("confirmar")} className="cta-glow" data-testid="hero-confirm">
            <span className="cta-glow-shine" aria-hidden="true" />
            <IconHeart size={20} />
            Confirme aqui
          </a>
          {giftTarget && (
            <a href={`#${giftTarget}`} onClick={goTo(giftTarget)} className="cta-soft" data-testid="hero-gifts">
              <span className="cta-glow-shine" aria-hidden="true" />
              <IconGift size={18} />
              Ver os presentes
            </a>
          )}
          <a
            href="#convite"
            className="flex min-h-11 items-center gap-1.5 rounded-full px-4 text-xs font-medium tracking-[0.18em] text-cocoa-500 uppercase"
          >
            ou role para ver tudo
            <IconArrowDown size={16} className="animate-float-soft" />
          </a>
        </div>

        {showBear && (
          <div data-hero-bear className="mt-6 flex items-end justify-center sm:mt-8">
            {bearImageUrl ? (
              <div className="animate-float-soft relative h-[min(40vw,240px,24dvh)] w-[min(40vw,240px,24dvh)]">
                <Image
                  src={bearImageUrl}
                  alt="Ursinha da Alana com balão de coração"
                  fill
                  sizes="240px"
                  className="object-contain drop-shadow-[0_18px_24px_rgba(74,51,51,0.18)]"
                  priority
                  unoptimized={bearImageUrl.startsWith("/api/")}
                />
              </div>
            ) : (
              <div className="animate-balloon">
                <HeartBalloon size={92} id="hero-balloon" />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
