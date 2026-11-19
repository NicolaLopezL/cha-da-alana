"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/admin/actions";

/** Formulário ligado a uma Server Action, com mensagem de retorno acessível. */
export function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess = false,
  booleans,
  encType,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  /** Nomes de checkboxes do formulário (para gravar "desmarcado"). */
  booleans?: string[];
  encType?: "multipart/form-data";
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className} encType={encType}>
      {booleans && <input type="hidden" name="__booleans" value={booleans.join(",")} />}
      {children}
      <Feedback state={state} />
    </form>
  );
}

function Feedback({ state }: { state: ActionState }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!state) return;
    const show = requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => setVisible(false), state.ok ? 4000 : 9000);
    return () => {
      cancelAnimationFrame(show);
      clearTimeout(t);
    };
  }, [state]);
  return (
    <p
      role="status"
      aria-live="polite"
      className={`mt-3 text-sm font-medium transition-opacity ${visible && state ? "opacity-100" : "opacity-0"} ${
        state?.ok ? "text-success" : "text-danger"
      }`}
      data-testid="form-feedback"
    >
      {state?.message ?? ""}
    </p>
  );
}

export function SubmitButton({ children, variant = "primary", className = "" }: { children: ReactNode; variant?: "primary" | "ghost" | "danger"; className?: string }) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-cocoa-700 text-paper hover:bg-cocoa-900",
    ghost: "border border-blush-300 text-cocoa-700 hover:bg-blush-50",
    danger: "border border-danger/40 text-danger hover:bg-[#f7e4e2]",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${styles} ${className}`}
    >
      {pending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Botão de formulário que pede confirmação antes de uma ação destrutiva. */
export function ConfirmSubmit({ message, children, className = "" }: { message: string; children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className={className}
    >
      {children}
    </button>
  );
}

export function CopyButton({ text, label = "Copiar link", className = "" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-blush-300 px-3 text-xs font-semibold text-cocoa-700 transition hover:bg-blush-50 ${className}`}
      data-testid="copy-link"
    >
      <span aria-live="polite">{copied ? "Copiado!" : label}</span>
    </button>
  );
}

export function Field({
  label,
  name,
  hint,
  defaultValue,
  type = "text",
  required,
  placeholder,
  maxLength,
  min,
  max,
  inputMode,
  autoComplete,
}: {
  label: string;
  name: string;
  hint?: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  inputMode?: "text" | "tel" | "numeric" | "url" | "email";
  autoComplete?: string;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[0.8rem] font-semibold text-cocoa-700">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        min={min}
        max={max}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="admin-field"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-cocoa-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextArea({
  label,
  name,
  hint,
  defaultValue,
  rows = 3,
  maxLength,
}: {
  label: string;
  name: string;
  hint?: string;
  defaultValue?: string;
  rows?: number;
  maxLength?: number;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[0.8rem] font-semibold text-cocoa-700">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        maxLength={maxLength}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="admin-field resize-y"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-cocoa-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Toggle({ label, name, defaultChecked, hint }: { label: string; name: string; defaultChecked: boolean; hint?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-1 py-2">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-blush-200 transition peer-checked:bg-rose-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-rose-600 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-paper after:shadow after:transition peer-checked:after:translate-x-5"
      />
      <span>
        <span className="block text-sm font-semibold text-cocoa-700">{label}</span>
        {hint && <span className="block text-xs text-cocoa-500">{hint}</span>}
      </span>
    </label>
  );
}
