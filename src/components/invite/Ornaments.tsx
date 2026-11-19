import type { CSSProperties } from "react";

/* Balão de coração (SVG), com reflexo suave e fio ondulado. */
export function HeartBalloon({ size = 120, className = "", id = "hb" }: { size?: number; className?: string; id?: string }) {
  return (
    <svg
      width={size}
      height={size * 1.75}
      viewBox="0 0 120 210"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-fill`} cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fbe4e2" />
          <stop offset="45%" stopColor="#efc3c3" />
          <stop offset="100%" stopColor="#d79a9d" />
        </radialGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e9d6ad" />
          <stop offset="100%" stopColor="#b8945a" />
        </linearGradient>
      </defs>
      <path
        d="M60 112C60 112 10 82 10 44 10 24 25 10 42 10c8.4 0 14.6 4.4 18 11 3.4-6.6 9.6-11 18-11 17 0 32 14 32 34 0 38-50 68-50 68Z"
        fill={`url(#${id}-fill)`}
      />
      <path d="M30 30c4-7 12-10 18-8" stroke="#fff" strokeOpacity=".7" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M55 112h10l-3 6h-4z" fill="#d79a9d" />
      <path
        d="M60 118c-6 14 8 22 0 36s6 22-2 36 4 14 2 18"
        stroke={`url(#${id}-gold)`}
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Cantoneira ornamental (releitura minimalista da moldura rosa e dourada). */
export function FrameCorner({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 80 80" className={className} style={style} aria-hidden="true" focusable="false" fill="none">
      <path d="M4 76V30C4 15.6 15.6 4 30 4h46" stroke="currentColor" strokeWidth="1" />
      <path d="M12 76V34c0-12.2 9.8-22 22-22h42" stroke="currentColor" strokeWidth=".6" opacity=".6" />
      <path
        d="M20 40c0-11 9-20 20-20M24 30c4 0 6 3 6 6s-3 5-5 4-2-4 0-5"
        stroke="currentColor"
        strokeWidth=".8"
        strokeLinecap="round"
      />
      <circle cx="4" cy="76" r="1.6" fill="currentColor" />
      <circle cx="76" cy="4" r="1.6" fill="currentColor" />
      <path d="M44 8.5l2 -2 2 2 -2 2z" fill="currentColor" />
      <path d="M8.5 44l-2 2 2 2 2-2z" fill="currentColor" />
    </svg>
  );
}

export function OrnamentFrame({ className = "" }: { className?: string }) {
  const c = "absolute w-14 h-14 sm:w-20 sm:h-20 text-champagne-400";
  return (
    <div className={`pointer-events-none absolute inset-3 sm:inset-6 ${className}`} aria-hidden="true">
      <div className="absolute inset-0 rounded-[28px] border border-champagne-400/35" />
      <div className="absolute inset-[6px] rounded-[22px] border border-blush-300/50" />
      <FrameCorner className={`${c} -left-1 -top-1`} />
      <FrameCorner className={`${c} -right-1 -top-1`} style={{ transform: "scaleX(-1)" }} />
      <FrameCorner className={`${c} -left-1 -bottom-1`} style={{ transform: "scaleY(-1)" }} />
      <FrameCorner className={`${c} -right-1 -bottom-1`} style={{ transform: "scale(-1,-1)" }} />
    </div>
  );
}

/* Pequenos corações e pontos que flutuam devagar. Posições fixas (sem divergência SSR/cliente). */
const PARTICLES = [
  { x: 8, y: 14, s: 10, k: "heart", d: 11, dx: 8, dy: -16 },
  { x: 86, y: 10, s: 6, k: "dot", d: 9, dx: -6, dy: -12 },
  { x: 92, y: 42, s: 12, k: "heart", d: 13, dx: -10, dy: -18 },
  { x: 6, y: 56, s: 5, k: "dot", d: 8, dx: 6, dy: -10 },
  { x: 14, y: 84, s: 9, k: "sparkle", d: 12, dx: 8, dy: -14 },
  { x: 80, y: 80, s: 7, k: "dot", d: 10, dx: -8, dy: -12 },
  { x: 50, y: 6, s: 7, k: "sparkle", d: 14, dx: 4, dy: -10 },
  { x: 70, y: 92, s: 10, k: "heart", d: 12, dx: -6, dy: -16 },
] as const;

export function Particles({ className = "", count = PARTICLES.length }: { className?: string; count?: number }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {PARTICLES.slice(0, count).map((p, i) => (
        <span
          key={i}
          className="animate-drift absolute"
          style={
            {
              left: `${p.x}%`,
              top: `${p.y}%`,
              "--dur": `${p.d}s`,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              animationDelay: `${-i * 1.3}s`,
            } as CSSProperties
          }
        >
          {p.k === "heart" && (
            <svg width={p.s} height={p.s} viewBox="0 0 24 24" className="text-blush-300">
              <path
                fill="currentColor"
                d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"
              />
            </svg>
          )}
          {p.k === "dot" && <span className="block rounded-full bg-champagne-200" style={{ width: p.s, height: p.s }} />}
          {p.k === "sparkle" && (
            <svg width={p.s * 1.6} height={p.s * 1.6} viewBox="0 0 24 24" className="text-champagne-400/70">
              <path fill="currentColor" d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10Z" />
            </svg>
          )}
        </span>
      ))}
    </div>
  );
}

/* Lacre de cera com coração em relevo. */
export function SealArt({ id = "seal" }: { id?: string }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-wax`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#e7b3b4" />
          <stop offset="55%" stopColor="#c98f92" />
          <stop offset="100%" stopColor="#a8696d" />
        </radialGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f1e3c2" />
          <stop offset="50%" stopColor="#cfb07a" />
          <stop offset="100%" stopColor="#a58450" />
        </linearGradient>
      </defs>
      {/* borda irregular da cera */}
      <path
        fill={`url(#${id}-wax)`}
        d="M50 3c6 0 8 4 13 5s10-1 13 3 2 9 6 12 9 3 10 8-3 8-2 13 5 8 3 13-7 6-9 10-1 10-5 13-9 0-13 3-6 8-12 8-8-4-13-5-10 1-13-3-2-9-6-12-9-3-10-8 3-8 2-13-5-8-3-13 7-6 9-10 1-10 5-13 9 0 13-3 6-8 12-8Z"
      />
      <circle cx="50" cy="50" r="31" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1.6" opacity=".9" />
      <circle cx="50" cy="50" r="27" fill="none" stroke="#8f5458" strokeOpacity=".25" strokeWidth="1" />
      <path
        d="M50 64s-14-8.6-14-19a7.8 7.8 0 0 1 14-4.7A7.8 7.8 0 0 1 64 45c0 10.4-14 19-14 19Z"
        fill={`url(#${id}-gold)`}
      />
      <path d="M41 43c1-2.6 3.4-3.8 5.6-3.4" stroke="#fff" strokeOpacity=".6" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <ellipse cx="36" cy="28" rx="10" ry="5" fill="#fff" opacity=".18" transform="rotate(-30 36 28)" />
    </svg>
  );
}
