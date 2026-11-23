"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { QuizActionResult } from "@/app/admin/quiz-actions";
import type { QuizStatus } from "@/lib/quiz/types";

const TABS = [
  ["/admin/quiz", "Visão geral"],
  ["/admin/quiz/perguntas", "Perguntas"],
  ["/admin/quiz/participantes", "Participantes"],
  ["/admin/quiz/ao-vivo", "Ranking ao vivo"],
  ["/admin/quiz/desempate", "Desempate"],
  ["/admin/quiz/divulgar", "QR Code"],
  ["/admin/quiz/ajustes", "Ajustes"],
] as const;

export function QuizTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Seções do quiz" className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1.5 pb-1">
        {TABS.map(([href, label]) => {
          const on = href === "/admin/quiz" ? path === href : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition ${
                  on ? "bg-cocoa-700 text-paper" : "border border-blush-200 bg-paper text-cocoa-500 hover:bg-blush-50"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ---------- Aviso de resultado das ações ---------- */

const EVT = "quiz-toast";
export const toast = (r: QuizActionResult) => window.dispatchEvent(new CustomEvent(EVT, { detail: r }));

export function QuizToast() {
  const [msg, setMsg] = useState<QuizActionResult | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      const r = (e as CustomEvent<QuizActionResult>).detail;
      setMsg(r);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), r.ok ? 3500 : 8000);
    };
    window.addEventListener(EVT, on);
    return () => {
      clearTimeout(t);
      window.removeEventListener(EVT, on);
    };
  }, []);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--safe-bottom)+1rem)] z-50 flex justify-center px-4">
      {msg && (
        <p
          data-testid="quiz-toast"
          data-ok={msg.ok}
          className={`max-w-md rounded-2xl px-5 py-3 text-center text-sm font-semibold text-paper shadow-[var(--shadow-lift)] ${msg.ok ? "bg-success" : "bg-danger"}`}
        >
          {msg.message}
        </p>
      )}
    </div>
  );
}

/** Executa uma ação do servidor e mostra o resultado. */
export function useQuizAction() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = useCallback(
    (action: () => Promise<QuizActionResult>, after?: (r: QuizActionResult) => void) => {
      start(async () => {
        let r: QuizActionResult;
        try {
          r = await action();
        } catch {
          r = { ok: false, message: "Sem conexão ou sessão expirada. Recarregue a página e tente de novo." };
        }
        toast(r);
        after?.(r);
        if (r.ok) router.refresh();
      });
    },
    [router],
  );
  return { run, pending };
}

const VARIANTS = {
  primary: "bg-cocoa-700 text-paper hover:bg-cocoa-900",
  rose: "bg-rose-600 text-paper hover:bg-cocoa-700",
  ghost: "border border-blush-300 bg-paper text-cocoa-700 hover:bg-blush-50",
  danger: "border border-danger/40 bg-paper text-danger hover:bg-[#f7e4e2]",
};
export const btnClass = (variant: keyof typeof VARIANTS = "ghost", size: "md" | "lg" | "sm" = "md") =>
  `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
    { sm: "min-h-10 px-3 text-xs", md: "min-h-11 px-4 text-sm", lg: "min-h-13 px-6 py-3 text-base" }[size]
  } ${VARIANTS[variant]}`;

export function ActionButton({
  action,
  confirm,
  children,
  variant = "ghost",
  size = "md",
  disabled,
  label,
  testId,
  onDone,
}: {
  action: () => Promise<QuizActionResult>;
  confirm?: string;
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  label?: string;
  testId?: string;
  onDone?: (r: QuizActionResult) => void;
}) {
  const { run, pending } = useQuizAction();
  return (
    <button
      type="button"
      disabled={pending || disabled}
      aria-label={label}
      data-testid={testId}
      onClick={() => (!confirm || window.confirm(confirm)) && run(action, onDone)}
      className={btnClass(variant, size)}
    >
      {children}
    </button>
  );
}

/** Interruptor que salva na hora. */
export function Switch({
  label,
  hint,
  checked,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => Promise<QuizActionResult>;
  disabled?: boolean;
  testId?: string;
}) {
  const { run, pending } = useQuizAction();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled || pending}
      data-testid={testId}
      onClick={() => run(() => onChange(!checked))}
      className="flex min-h-12 w-full items-start gap-3 rounded-xl px-1 py-2 text-left disabled:opacity-55"
    >
      <span
        aria-hidden="true"
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition after:absolute after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-paper after:shadow after:transition-all ${
          checked ? "bg-rose-600 after:left-[22px]" : "bg-blush-200 after:left-0.5"
        }`}
      />
      <span>
        <span className="block text-sm font-semibold text-cocoa-700">{label}</span>
        {hint && <span className="block text-xs text-cocoa-500">{hint}</span>}
      </span>
    </button>
  );
}

/** Dados que se atualizam sozinhos no painel (pausa com a aba escondida). */
export function usePolled<T>(url: string, initial: T, everyMs = 3000): T {
  const [override, setOverride] = useState<{ base: T; data: T } | null>(null);
  const latest = useRef(initial);
  useEffect(() => {
    latest.current = initial;
  }, [initial]);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const base = latest.current;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok || res.redirected) return;
        const data = (await res.json()) as T;
        if (!stop) setOverride({ base, data });
      } catch {}
    };
    const id = setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stop = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [url, everyMs]);
  // Depois de uma ação, o servidor manda dados novos: eles valem até a próxima consulta.
  return override && override.base === initial ? override.data : initial;
}

const STATUS: Record<QuizStatus, [string, string]> = {
  draft: ["Rascunho", "bg-blush-50 text-cocoa-500"],
  open: ["Aberto", "bg-[#e5efe7] text-success"],
  closed: ["Encerrado", "bg-champagne-200/60 text-champagne-700"],
  published: ["Resultados publicados", "bg-rose-600 text-paper"],
};
export function QuizStatusBadge({ status }: { status: QuizStatus }) {
  const [label, cls] = STATUS[status];
  return (
    <span className={`badge !px-3 !py-1 !text-sm ${cls}`} data-testid="quiz-status" data-status={status}>
      {label}
    </span>
  );
}
