"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";
import { Particles, SealArt } from "./Ornaments";

interface Props {
  guestName: string | null;
  message: string;
  showDecorations: boolean;
  /** Disparado no toque (interação do visitante) — usado para iniciar a música, se houver. */
  onOpenStart: () => void;
  onOpened: () => void;
}

/**
 * Cena 1 e 2 — envelope físico em camadas:
 *   fundo (forro) → cartão → bolso frontal → aba superior (3D) → lacre.
 * O toque no lacre (ou no envelope) rompe o lacre, abre a aba, desliza o cartão
 * e o faz crescer até ocupar a tela, revelando a página.
 */
export function Envelope({ guestName, message, showDecorations, onOpenStart, onOpened }: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const [opening, setOpening] = useState(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const introRef = useRef<gsap.core.Timeline | null>(null);
  const floatRef = useRef<gsap.core.Tween | null>(null);
  const ringRef = useRef<gsap.core.Tween | null>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(scope);
      // Perspectiva própria em cada peça que gira: as camadas do envelope ficam num plano só
      // (sem preserve-3d nos contêineres), o que elimina o "pisca-pisca" entre camadas.
      gsap.set(q("[data-env-tilt]"), { transformPerspective: 1200 });
      gsap.set(q("[data-env-flap]"), { transformPerspective: 900 });
      if (prefersReducedMotion()) return;

      // Entrada suave
      introRef.current = gsap
        .timeline()
        .from(q("[data-env-intro]"), { opacity: 0, y: 14, duration: 1.1, stagger: 0.12, delay: 0.15 }, 0)
        .from(q("[data-env-float]"), { opacity: 0, y: 30, scale: 0.96, duration: 1.4, ease: "power3.out" }, 0.3);

      // Flutuação quase imperceptível
      floatRef.current = gsap.to(q("[data-env-float]"), { y: -7, duration: 3.4, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.7 });

      // Brilho discreto no lacre chamando o toque
      ringRef.current = gsap.to(q("[data-seal-ring]"), {
        scale: 1.35,
        opacity: 0,
        duration: 2.2,
        ease: "power1.out",
        repeat: -1,
        repeatDelay: 0.6,
        delay: 2,
      });
    },
    { scope },
  );

  // Inclinação que acompanha o dedo ou o mouse (não depende de hover)
  const tilt = useRef<{ rx: gsap.QuickToFunc; ry: gsap.QuickToFunc } | null>(null);
  const onPointer = (e: React.PointerEvent) => {
    if (opening || prefersReducedMotion() || !scope.current) return;
    const el = scope.current.querySelector<HTMLElement>("[data-env-tilt]");
    if (!el) return;
    if (!tilt.current) {
      tilt.current = {
        rx: gsap.quickTo(el, "rotationX", { duration: 0.8, ease: "power3.out" }),
        ry: gsap.quickTo(el, "rotationY", { duration: 0.8, ease: "power3.out" }),
      };
    }
    const r = el.getBoundingClientRect();
    const px = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) - 0.5;
    const py = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1) - 0.5;
    tilt.current.rx(py * -9);
    tilt.current.ry(px * 12);
  };
  const resetTilt = () => {
    tilt.current?.rx(0);
    tilt.current?.ry(0);
  };

  const open = useCallback(() => {
    if (opening || !scope.current) return;
    setOpening(true);
    onOpenStart();
    const q = gsap.utils.selector(scope);
    const root = scope.current;

    const done = () => {
      tlRef.current = null;
      onOpened();
    };

    if (prefersReducedMotion()) {
      gsap.to(root, { opacity: 0, duration: 0.45, ease: "power1.out", onComplete: done });
      return;
    }

    const card = q("[data-env-card]")[0] as HTMLElement;
    // Toque durante a entrada: conclui a entrada (em vez de cortá-la pela metade).
    introRef.current?.progress(1).kill();
    floatRef.current?.kill();
    ringRef.current?.kill();
    gsap.set(q("[data-seal-ring]"), { opacity: 0 });

    const tl = gsap.timeline({ onComplete: done });
    tlRef.current = tl;

    tl
      // 1. o lacre reage ao toque
      .to(q("[data-seal]"), { scale: 0.86, duration: 0.14, ease: "power2.out" })
      .to(q("[data-seal]"), { scale: 1.06, duration: 0.2, ease: "back.out(3)" })
      .set(q("[data-seal-ring]"), { opacity: 0 })
      // 2. o lacre se rompe em duas metades
      .to(q("[data-seal-left]"), { xPercent: -55, yPercent: 90, rotation: -32, opacity: 0, duration: 0.75, ease: "power2.in" }, ">-0.04")
      .to(q("[data-seal-right]"), { xPercent: 55, yPercent: 100, rotation: 26, opacity: 0, duration: 0.75, ease: "power2.in" }, "<")
      .to(q("[data-seal-shadow]"), { opacity: 0, duration: 0.3 }, "<")
      .to(q("[data-env-intro]"), { opacity: 0, y: -12, duration: 0.45, ease: "power2.in", stagger: 0.05 }, "<")
      .to(q("[data-env-float]"), { y: 0, duration: 0.6, ease: "power2.out" }, "<")
      .to(q("[data-env-tilt]"), { rotationX: 0, rotationY: 0, duration: 0.6, ease: "power2.out" }, "<")
      // 3. a aba abre em 3D
      .to(q("[data-env-flap]"), { rotationX: 180, duration: 1.05, ease: "power2.inOut" }, "-=0.4")
      .set(q("[data-env-flap]"), { zIndex: 1 }, "-=0.52")
      .to(q("[data-env-flap-shade]"), { opacity: 0.08, duration: 0.5, yoyo: true, repeat: 1 }, "<-0.5")
      // 4. o envelope ganha profundidade e desce um pouco (a câmera acompanha)
      .to(q("[data-env-float]"), { y: () => root.clientHeight * 0.14, scale: 0.97, duration: 1.2, ease: "power2.inOut" }, "-=0.25")
      // 5. o convite desliza para fora
      .to(card, { yPercent: -72, duration: 1.25, ease: "power3.out" }, "<0.1")
      .to(q("[data-env-card-shadow]"), { opacity: 1, duration: 0.8 }, "<")
      .set(card, { zIndex: 20 })
      // 6–7. o convite cresce e se torna a página
      .add("grow")
      .to(
        card,
        {
          x: () => {
            const r = card.getBoundingClientRect();
            return window.innerWidth / 2 - (r.left + r.width / 2);
          },
          y: () => {
            const r = card.getBoundingClientRect();
            return window.innerHeight / 2 - (r.top + r.height / 2);
          },
          scale: () => {
            const r = card.getBoundingClientRect();
            return Math.max(window.innerWidth / r.width, window.innerHeight / r.height) * 1.12;
          },
          rotation: 0,
          borderRadius: 0,
          duration: 1.25,
          ease: "power3.inOut",
        },
        "grow",
      )
      .to(q("[data-env-card-content]"), { opacity: 0, duration: 0.4, ease: "power1.in" }, "grow")
      .to(q("[data-env-body], [data-env-flap]"), { y: () => window.innerHeight * 0.45, opacity: 0, duration: 0.9, ease: "power2.in" }, "grow")
      .to(q("[data-env-particles]"), { opacity: 0, duration: 0.6 }, "grow")
      .to(root, { opacity: 0, duration: 0.55, ease: "power1.inOut" }, ">-0.25");
  }, [opening, onOpenStart, onOpened]);

  // Toque feito antes do JavaScript carregar (registrado pelo script inline): abre assim que possível.
  useEffect(() => {
    const w = window as Window & { __alanaOpenRequested?: boolean; __alanaHydrated?: boolean };
    w.__alanaHydrated = true;
    if (!w.__alanaOpenRequested) return;
    w.__alanaOpenRequested = false;
    const id = requestAnimationFrame(() => open());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const label = guestName ? `Abrir o convite de ${guestName}` : "Abrir o convite";

  return (
    <div
      ref={scope}
      className="paper-ivory fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-6 pb-safe pt-safe"
      style={{ perspective: "1400px" }}
      onPointerMove={onPointer}
      onPointerDown={onPointer}
      onPointerLeave={resetTilt}
      data-testid="envelope-scene"
    >
      {/* vinheta rosada */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 45%, rgb(248 230 228 / 0) 40%, rgb(239 207 207 / 0.55) 100%), radial-gradient(60% 40% at 50% 55%, rgb(255 253 249 / 0.9), transparent 70%)",
        }}
      />
      {showDecorations && (
        <div data-env-particles className="absolute inset-0">
          <Particles />
        </div>
      )}

      <div className="relative z-10 mb-10 text-center sm:mb-12">
        <p data-env-intro className="eyebrow mb-4">
          Chá da Alana
        </p>
        {guestName ? (
          <h1 data-env-intro className="display text-[1.65rem] text-cocoa-700 sm:text-4xl">
            Um convite especial para
            <span className="script mt-2 block text-[2.9rem] text-rose-600 sm:text-6xl">{guestName}</span>
          </h1>
        ) : (
          <h1 data-env-intro className="display max-w-[18ch] text-[1.75rem] italic text-cocoa-700 sm:text-4xl">
            {message}
          </h1>
        )}
      </div>

      {/* envelope */}
      <div data-env-float className="relative z-10 w-[min(86vw,440px)]" style={{ willChange: "transform, opacity" }}>
        <div data-env-tilt className="relative" style={{ willChange: "transform" }}>
          <div
            className="relative aspect-[10/7] w-full cursor-pointer select-none"
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            onClick={open}
            data-testid="envelope"
          >
            {/* sombra no chão */}
            <div
              data-env-body
              aria-hidden="true"
              className="absolute -bottom-6 left-[8%] right-[8%] h-8 rounded-[50%] bg-cocoa-900/15 blur-xl"
            />

            {/* fundo / forro */}
            <div
              data-env-body
              aria-hidden="true"
              className="absolute inset-0 overflow-hidden rounded-[10px]"
              style={{ zIndex: 1, boxShadow: "var(--shadow-paper)" }}
            >
              <div className="absolute inset-0 bg-blush-100" />
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 25% 25%, rgb(201 143 146 / .22) 1.2px, transparent 1.6px), radial-gradient(circle at 75% 75%, rgb(198 166 107 / .25) 1px, transparent 1.4px)",
                  backgroundSize: "18px 18px",
                }}
              />
            </div>

            {/* cartão do convite */}
            <div
              data-env-card
              className="paper absolute left-[6%] right-[6%] top-[7%] bottom-[5%] rounded-[6px]"
              style={{ zIndex: 2, transformOrigin: "50% 50%", willChange: "transform" }}
              aria-hidden="true"
            >
              <div
                data-env-card-shadow
                className="absolute inset-0 rounded-[inherit] opacity-0"
                style={{ boxShadow: "var(--shadow-lift)" }}
              />
              <div className="absolute inset-[5%] rounded-[4px] border border-champagne-400/40" />
              <div data-env-card-content className="relative flex h-full flex-col items-center justify-start pt-[9%] text-center">
                <span className="eyebrow text-[0.5rem] sm:text-[0.55rem]">Chá de bebê</span>
                <span className="script mt-1 text-[2.4rem] text-rose-600 sm:text-[2.9rem]">Alana</span>
                <span className="rule-gold mt-1 w-1/3 text-[0.5rem]">
                  <svg width="8" height="8" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
                  </svg>
                </span>
              </div>
            </div>

            {/* bolso frontal */}
            <svg
              data-env-body
              viewBox="0 0 100 70"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible"
              style={{ zIndex: 3 }}
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="pocket-side" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#f3eadf" />
                  <stop offset="1" stopColor="#faf4ec" />
                </linearGradient>
                <linearGradient id="pocket-bottom" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0" stopColor="#fbf6ef" />
                  <stop offset="1" stopColor="#fffdf9" />
                </linearGradient>
              </defs>
              <path d="M0 1.5Q0 0 1.5 .8L50 40 1.5 69.2Q0 70 0 68.5Z" fill="url(#pocket-side)" />
              <path d="M100 1.5Q100 0 98.5 .8L50 40l48.5 29.2q1.5.8 1.5-.7Z" fill="url(#pocket-side)" transform="" />
              <path d="M1.4 70 50 35.5 98.6 70Z" fill="url(#pocket-bottom)" />
              <path d="M1.4 70 50 35.5 98.6 70" fill="none" stroke="#e6d6c6" strokeWidth=".35" />
              <path d="M1.5 .8 50 40l48.5-39.2" fill="none" stroke="#ece0d2" strokeWidth=".3" />
            </svg>
            {guestName && (
              <span
                data-env-body
                aria-hidden="true"
                className="script pointer-events-none absolute bottom-[9%] left-0 right-0 text-center text-[1.35rem] text-cocoa-500/80 sm:text-[1.6rem]"
                style={{ zIndex: 3 }}
              >
                para {guestName.split(" ")[0]}
              </span>
            )}

            {/* aba superior (frente: papel; verso: forro) */}
            <div
              data-env-flap
              aria-hidden="true"
              className="absolute left-0 right-0 top-0 h-[62%]"
              style={{ zIndex: 4, transformOrigin: "50% 0%", transformStyle: "preserve-3d" }}
            >
              <svg
                viewBox="0 0 100 62"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full overflow-visible"
                style={{ backfaceVisibility: "hidden" }}
              >
                <defs>
                  <linearGradient id="flap-front" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fffdf9" />
                    <stop offset="1" stopColor="#f6eee4" />
                  </linearGradient>
                </defs>
                <path d="M0 1.5Q0 0 1.5 0h97q1.5 0 1.5 1.5L53.5 59.5Q50 62.5 46.5 59.5Z" fill="#4a3333" opacity=".07" transform="translate(0 1.2)" />
                <path d="M0 1.5Q0 0 1.5 0h97q1.5 0 1.5 1.5L53.5 59.5Q50 62.5 46.5 59.5Z" fill="url(#flap-front)" />
                <path d="M0 1.5 46.5 59.5Q50 62.5 53.5 59.5L100 1.5" fill="none" stroke="#e6d6c6" strokeWidth=".35" />
              </svg>
              <svg
                viewBox="0 0 100 62"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
                style={{ backfaceVisibility: "hidden", transform: "rotateX(180deg)" }}
              >
                <path d="M0 1.5Q0 0 1.5 0h97q1.5 0 1.5 1.5L53.5 59.5Q50 62.5 46.5 59.5Z" fill="#f3d9d7" />
                <path d="M8 4h84L50 56Z" fill="#efcfcf" opacity=".6" />
              </svg>
              <div data-env-flap-shade className="absolute inset-0 bg-cocoa-900 opacity-0" style={{ clipPath: "polygon(0 0,100% 0,50% 100%)" }} />
            </div>

            {/* lacre */}
            <button
              type="button"
              data-seal
              onClick={(e) => {
                e.stopPropagation();
                open();
              }}
              disabled={opening}
              aria-label={label}
              className="absolute left-1/2 top-[62%] aspect-square w-[21%] min-w-[64px] max-w-[92px] -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full focus-visible:outline-offset-4"
              style={{ zIndex: 6, touchAction: "manipulation" }}
              data-testid="seal"
            >
              <span data-seal-ring className="absolute inset-0 rounded-full border border-rose-400/60" aria-hidden="true" />
              <span
                data-seal-shadow
                aria-hidden="true"
                className="absolute inset-[6%] translate-y-[6%] rounded-full"
                style={{ background: "radial-gradient(closest-side, rgb(74 51 51 / .28), transparent)" }}
              />
              <span
                data-seal-left
                className="absolute inset-0"
                style={{ clipPath: "polygon(0 0,52% 0,47% 22%,55% 40%,46% 58%,53% 78%,48% 100%,0 100%)" }}
                aria-hidden="true"
              >
                <SealArt id="seal-l" />
              </span>
              <span
                data-seal-right
                className="absolute inset-0"
                style={{ clipPath: "polygon(52% 0,100% 0,100% 100%,48% 100%,53% 78%,46% 58%,55% 40%,47% 22%)" }}
                aria-hidden="true"
              >
                <SealArt id="seal-r" />
              </span>
            </button>
          </div>
        </div>
      </div>

      <p data-env-intro className="relative z-10 mt-12 flex items-center gap-2 text-sm font-medium tracking-wide text-cocoa-500" aria-hidden="true">
        <span className="inline-block h-px w-6 bg-champagne-400/70" />
        Toque para abrir
        <span className="inline-block h-px w-6 bg-champagne-400/70" />
      </p>
    </div>
  );
}
