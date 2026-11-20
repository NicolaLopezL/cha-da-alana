"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "./gsap";

export interface QuickNavItem {
  id: string;
  label: string;
  icon: ReactNode;
}

/**
 * Atalhos laterais ("HUD") para ir direto ao que importa.
 *  - Computador (≥1024px): trilho fixo à esquerda (ícones; rótulos a partir de 1280px).
 *  - Celular/tablet: uma aba discreta na borda esquerda que abre a lista — não cobre o conteúdo.
 */
export function QuickNav({ items, visible }: { items: QuickNavItem[]; visible: boolean }) {
  const [active, setActive] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Aparece com suavidade depois da revelação da Alana; no celular, a abinha brilha na primeira visita
  // (sem abrir sozinha, para não cobrir os botões do topo).
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const reduce = prefersReducedMotion();
    const t1 = setTimeout(() => setShown(true), reduce ? 0 : 2600);
    let t2: ReturnType<typeof setTimeout> | undefined;
    let t3: ReturnType<typeof setTimeout> | undefined;
    let seen = false;
    try {
      seen = sessionStorage.getItem("alana-nav-hint") === "1";
      sessionStorage.setItem("alana-nav-hint", "1");
    } catch {}
    if (!seen && !reduce && window.innerWidth < 1024) {
      t2 = setTimeout(() => setHint(true), 3200);
      t3 = setTimeout(() => setHint(false), 9000);
    }
    return () => [t1, t2, t3].forEach((t) => t && clearTimeout(t));
  }, [visible]);

  // Destaca a seção que está na tela
  useEffect(() => {
    if (!visible) return;
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items, visible]);

  // Fecha ao tocar fora ou com Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setOpen(false);
    const top = el.getBoundingClientRect().top + window.scrollY - 8;
    window.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };

  if (!visible || items.length === 0) return null;

  const fade = `transition-all duration-700 ease-[var(--ease-soft)] ${shown ? "opacity-100 translate-x-0" : "pointer-events-none -translate-x-4 opacity-0"}`;

  return (
    <>
      {/* computador */}
      <nav aria-label="Atalhos do convite" className={`fixed left-4 top-1/2 z-40 hidden -translate-y-1/2 lg:block xl:left-8 ${fade}`} data-testid="quicknav-desktop">
        <ul className="paper flex flex-col gap-1 rounded-[22px] p-2 shadow-[var(--shadow-soft)] ring-1 ring-champagne-400/20">
          {items.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => go(i.id)}
                aria-current={active === i.id ? "true" : undefined}
                title={i.label}
                className={`group flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-semibold transition ${
                  active === i.id ? "bg-blush-100 text-cocoa-900" : "text-cocoa-500 hover:bg-blush-50 hover:text-cocoa-700"
                }`}
              >
                <span className={active === i.id ? "text-rose-600" : ""}>{i.icon}</span>
                <span className="sr-only xl:not-sr-only xl:pr-2">{i.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* celular e tablet */}
      <div ref={panelRef} className={`fixed left-0 top-1/2 z-40 -translate-y-1/2 lg:hidden ${fade}`}>
        <button
          type="button"
          onClick={() => {
            setHint(false);
            setOpen((o) => !o);
          }}
          aria-expanded={open}
          aria-controls="quicknav-mobile"
          aria-label={open ? "Fechar atalhos" : "Abrir atalhos: presente, endereço e confirmação"}
          className={`paper flex h-14 w-9 items-center justify-center rounded-r-2xl text-rose-600 shadow-[var(--shadow-soft)] ring-1 ring-champagne-400/25 active:scale-95 ${hint ? "animate-tab-hint" : ""}`}
          data-testid="quicknav-toggle"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />}
          </svg>
        </button>
        <nav
          id="quicknav-mobile"
          aria-label="Atalhos do convite"
          aria-hidden={!open}
          className={`absolute left-11 top-1/2 -translate-y-1/2 transition-all duration-300 ease-[var(--ease-soft)] ${
            open ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-3 opacity-0"
          }`}
        >
          <ul className="paper w-max rounded-[20px] p-1.5 shadow-[var(--shadow-lift)] ring-1 ring-champagne-400/25">
            {items.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  tabIndex={open ? 0 : -1}
                  onClick={() => go(i.id)}
                  aria-current={active === i.id ? "true" : undefined}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 pr-5 text-left text-[0.95rem] font-semibold transition ${
                    active === i.id ? "bg-blush-100 text-cocoa-900" : "text-cocoa-700"
                  }`}
                >
                  <span className="text-rose-600">{i.icon}</span>
                  {i.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
