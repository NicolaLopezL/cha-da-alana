import type { CSSProperties } from "react";
import type { QuizLang } from "@/lib/quiz/types";

/* Ursinha com laço rosa — desenhada nas cores do convite. */
export function Bear({ size = 120, className = "", id = "bear", style }: { size?: number | string; className?: string; id?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 200 200" className={className} style={{ width: size, height: size, ...style }} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-fur`} cx="40%" cy="32%" r="78%">
          <stop offset="0%" stopColor="#e8cfae" />
          <stop offset="60%" stopColor="#d3b18a" />
          <stop offset="100%" stopColor="#b98f67" />
        </radialGradient>
        <radialGradient id={`${id}-muzzle`} cx="45%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#fffaf2" />
          <stop offset="100%" stopColor="#f0e0c9" />
        </radialGradient>
        <linearGradient id={`${id}-bow`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6d3d4" />
          <stop offset="55%" stopColor="#e0a5a9" />
          <stop offset="100%" stopColor="#c98f92" />
        </linearGradient>
      </defs>
      {/* orelhas */}
      <circle cx="48" cy="68" r="27" fill={`url(#${id}-fur)`} />
      <circle cx="152" cy="68" r="27" fill={`url(#${id}-fur)`} />
      <circle cx="48" cy="69" r="14.5" fill="#efcfcf" />
      <circle cx="152" cy="69" r="14.5" fill="#efcfcf" />
      {/* cabeça */}
      <ellipse cx="100" cy="116" rx="72" ry="66" fill={`url(#${id}-fur)`} />
      {/* bochechas */}
      <ellipse cx="54" cy="132" rx="13" ry="9" fill="#e9a9ab" opacity=".55" />
      <ellipse cx="146" cy="132" rx="13" ry="9" fill="#e9a9ab" opacity=".55" />
      {/* focinho */}
      <ellipse cx="100" cy="141" rx="33" ry="27" fill={`url(#${id}-muzzle)`} />
      <path d="M100 128c7 0 12 3 12 7s-6 8-12 8-12-4-12-8 5-7 12-7Z" fill="#6b4a44" />
      <path d="M100 143v7m0 0c-3 6-11 7-15 2m15-2c3 6 11 7 15 2" stroke="#6b4a44" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      {/* olhos */}
      <circle cx="72" cy="113" r="7.6" fill="#4a3333" />
      <circle cx="128" cy="113" r="7.6" fill="#4a3333" />
      <circle cx="74.6" cy="110.4" r="2.5" fill="#fff" />
      <circle cx="130.6" cy="110.4" r="2.5" fill="#fff" />
      <path d="M60 99c4-5 11-6 16-3M124 96c5-3 12-2 16 3" stroke="#8c6548" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".7" />
      {/* laço */}
      <g stroke="#c6a66b" strokeWidth="1.1">
        <path d="M100 48C86 26 58 18 50 30s0 34 14 38c14 3 28-8 36-20Z" fill={`url(#${id}-bow)`} />
        <path d="M100 48c14-22 42-30 50-18s0 34-14 38c-14 3-28-8-36-20Z" fill={`url(#${id}-bow)`} />
        <path d="M94 56c-8 8-13 17-12 25 6-2 12-9 16-19ZM106 56c8 8 13 17 12 25-6-2-12-9-16-19Z" fill={`url(#${id}-bow)`} />
        <rect x="89" y="38" width="22" height="22" rx="9" fill="#d79a9d" />
      </g>
      <path d="M60 32c8 1 17 6 24 12M140 32c-8 1-17 6-24 12" stroke="#fff" strokeOpacity=".6" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

const MEDALS = [
  ["#f7e6b6", "#d9b45c", "#8a6420"],
  ["#f4f4f6", "#c3c6cf", "#5d626e"],
  ["#f3d3b5", "#cb9264", "#7a4a22"],
] as const;

/** Medalha de ouro, prata ou bronze, com fita rosa. */
export function Medal({ pos, size = 44, className = "" }: { pos: 1 | 2 | 3; size?: number | string; className?: string }) {
  const [light, mid, ink] = MEDALS[pos - 1];
  const id = `medal-${pos}`;
  return (
    <svg viewBox="0 0 60 72" className={className} style={{ height: size, width: "auto" }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={light} />
          <stop offset="100%" stopColor={mid} />
        </linearGradient>
      </defs>
      <path d="M14 0h14l6 26-14 6Z" fill="#e3b5b5" />
      <path d="M46 0H32l-6 26 14 6Z" fill="#c98f92" />
      <circle cx="30" cy="46" r="24" fill={`url(#${id})`} stroke={mid} strokeWidth="2" />
      <circle cx="30" cy="46" r="18.5" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.6" />
      <text x="30" y="55" textAnchor="middle" fontSize="26" fontWeight="700" fontFamily="var(--font-sans)" fill={ink}>
        {pos}
      </text>
    </svg>
  );
}

/* Bandeiras em SVG: os emojis de bandeira não aparecem no Windows. */
export function Flag({ lang, size = 20 }: { lang: QuizLang; size?: number }) {
  return (
    <svg viewBox="0 0 28 20" width={size * 1.4} height={size} aria-hidden="true" focusable="false" style={{ borderRadius: 4 }}>
      {lang === "pt" ? (
        <>
          <rect width="28" height="20" fill="#3a9a5b" />
          <path d="M14 2.5 25.5 10 14 17.5 2.5 10Z" fill="#f4d65a" />
          <circle cx="14" cy="10" r="4.4" fill="#2b4c8c" />
        </>
      ) : (
        <>
          <rect width="28" height="20" fill="#f4d65a" />
          <rect y="10" width="28" height="5" fill="#2b4c8c" />
          <rect y="15" width="28" height="5" fill="#c44545" />
        </>
      )}
    </svg>
  );
}

/** Corações caindo (comemoração). Posições fixas: sem diferença entre servidor e navegador. */
export function HeartRain({ count = 36 }: { count?: number }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="heart-rain"
          style={{
            left: `${(i * 37) % 100}%`,
            color: ["#e3b5b5", "#c98f92", "#ecdcb9", "#efcfcf", "#c6a66b"][i % 5],
            fontSize: 12 + ((i * 7) % 18),
            animationDelay: `${((i * 13) % 40) / 10}s`,
            animationDuration: `${4.5 + ((i * 5) % 30) / 10}s`,
          }}
        >
          <svg width="1em" height="1em" viewBox="0 0 24 24">
            <path fill="currentColor" d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
          </svg>
        </span>
      ))}
    </div>
  );
}
