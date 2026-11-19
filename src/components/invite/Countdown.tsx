"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Contagem regressiva (calculada só no navegador para evitar divergência de horário). */
export function Countdown({ target }: { target: number }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Primeiro valor no próximo frame; depois a cada segundo.
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  if (now !== null && now >= target) {
    const sameDay = now - target < 1000 * 60 * 60 * 12;
    return (
      <p className="display text-2xl italic text-rose-600" role="status">
        {sameDay ? "Chegou o grande dia!" : "Obrigado por celebrar com a gente!"}
      </p>
    );
  }

  const p = now === null ? null : parts(target - now);
  const items: [string, number | undefined][] = [
    ["dias", p?.d],
    ["horas", p?.h],
    ["min", p?.m],
    ["seg", p?.s],
  ];

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-4" role="timer" aria-label="Contagem regressiva para o chá">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col items-center rounded-2xl bg-blush-50 px-2 py-3 sm:px-4 sm:py-4">
          <span className="display tabular text-3xl text-cocoa-700 sm:text-4xl" aria-hidden={label === "seg"}>
            {value === undefined ? "–" : String(value).padStart(2, "0")}
          </span>
          <span className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-cocoa-500">{label}</span>
        </div>
      ))}
    </div>
  );
}
