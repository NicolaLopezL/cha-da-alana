"use client";

import { useEffect, useState } from "react";

/** Botão de tela cheia (some onde o navegador não permite, como no iPhone). */
export function FullscreenButton({ enter, exit, className = "btn btn-ghost" }: { enter: string; exit: string; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const sync = () => setFull(Boolean(document.fullscreenElement));
    const id = requestAnimationFrame(() => {
      setSupported(Boolean(document.fullscreenEnabled));
      sync();
    });
    document.addEventListener("fullscreenchange", sync);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("fullscreenchange", sync);
    };
  }, []);

  if (!supported) return null;
  const toggle = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {}
  };
  return (
    <button type="button" onClick={toggle} className={className} data-testid="fullscreen">
      <span aria-hidden="true">⛶</span> {full ? exit : enter}
    </button>
  );
}
