"use client";

import { useEffect, useState } from "react";
import {
  pushPublicKeyAction,
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  testPushAction,
} from "@/app/admin/actions";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on" | "working";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Computador (Windows)";
  if (/Mac/.test(ua)) return "Mac";
  return "Aparelho";
}

async function registration() {
  return navigator.serviceWorker.register("/painel-sw.js", { scope: "/admin/" });
}

/** Liga/desliga avisos push neste aparelho (celular ou computador). */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      try {
        const reg = await registration();
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, []);

  const enable = async () => {
    setState("working");
    setMsg("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const key = await pushPublicKeyAction();
      let sub = await reg.pushManager.getSubscription();
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      const saved = await savePushSubscriptionAction(sub.toJSON(), deviceLabel());
      if (!saved.ok) throw new Error("save");
      setState("on");
      const test = await testPushAction(sub.endpoint);
      setMsg(test.ok ? "Pronto! Enviamos um aviso de teste para este aparelho." : "Ativado, mas o aviso de teste não chegou. Tente “Enviar teste”.");
    } catch {
      setState("off");
      setMsg("Não foi possível ativar agora. Tente de novo em instantes.");
    }
  };

  const disable = async () => {
    setState("working");
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setMsg("Avisos desligados neste aparelho.");
    } finally {
      setState("off");
    }
  };

  const test = async () => {
    setMsg("");
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return setState("off");
    const r = await testPushAction(sub.endpoint);
    setMsg(r.ok ? "Aviso de teste enviado!" : "O aviso de teste não chegou. Desligue e ligue de novo.");
  };

  return (
    <div className="space-y-3" data-testid="push-toggle" data-state={state}>
      {state === "loading" && <p className="text-sm text-cocoa-500">Verificando este aparelho…</p>}

      {state === "ios-install" && (
        <div className="rounded-xl bg-blush-50 p-4 text-sm leading-relaxed text-cocoa-700">
          <p className="font-semibold text-cocoa-900">No iPhone, falta um passo:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              No Safari, toque em <strong>Compartilhar</strong> (o quadrado com a setinha para cima).
            </li>
            <li>
              Escolha <strong>Adicionar à Tela de Início</strong> e confirme.
            </li>
            <li>
              Abra o painel pelo novo ícone <strong>Chá da Alana</strong>, entre com seu e-mail e senha e volte aqui em{" "}
              <strong>Notificações</strong> para ativar.
            </li>
          </ol>
          <p className="mt-2 text-xs text-cocoa-500">É uma exigência da Apple (iOS 16.4 ou mais novo).</p>
        </div>
      )}

      {state === "unsupported" && (
        <p className="text-sm text-cocoa-500">Este navegador não aceita notificações. No Android, use o Chrome; no iPhone, o Safari.</p>
      )}

      {state === "denied" && (
        <p className="rounded-xl bg-blush-50 p-4 text-sm text-cocoa-700">
          As notificações deste site foram bloqueadas no aparelho. Libere em <strong>Ajustes → Notificações</strong> (iPhone) ou no
          cadeado ao lado do endereço (Android/computador) e recarregue a página.
        </p>
      )}

      {(state === "off" || state === "working") && (
        <button
          type="button"
          onClick={enable}
          disabled={state === "working"}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-cocoa-700 px-5 text-sm font-semibold text-paper shadow-[var(--shadow-soft)] hover:bg-cocoa-900 disabled:opacity-60"
          data-testid="push-enable"
        >
          {state === "working" ? "Ativando…" : "🔔 Ativar avisos neste aparelho"}
        </button>
      )}

      {state === "on" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#e7f0e9] px-3 text-sm font-semibold text-success">
            ✓ Avisos ligados neste aparelho
          </span>
          <button type="button" onClick={test} className="inline-flex min-h-10 items-center rounded-xl border border-blush-300 bg-paper px-3 text-sm font-semibold text-cocoa-700 hover:bg-blush-50">
            Enviar teste
          </button>
          <button type="button" onClick={disable} className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-rose-600 hover:bg-blush-100">
            Desligar
          </button>
        </div>
      )}

      {msg && (
        <p className="text-sm text-cocoa-700" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
