"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(loginAction, null);
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="email" className="field-label">
          E-mail
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className="field" />
      </div>
      <div>
        <label htmlFor="password" className="field-label">
          Senha
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="field pr-20"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 min-h-10 -translate-y-1/2 rounded-lg px-3 text-xs font-semibold text-cocoa-500"
            aria-pressed={show}
          >
            {show ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>
      {state && !state.ok && (
        <p role="alert" className="rounded-xl bg-[#f7e4e2] px-4 py-3 text-sm font-medium text-danger">
          {state.message}
        </p>
      )}
      <Submit />
    </form>
  );
}
