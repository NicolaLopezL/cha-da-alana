"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { rsvpAction } from "@/app/actions";
import { deadlinePassed, firstName, formatDateLong } from "@/lib/format";
import type { PublicSettings } from "@/lib/settings";
import type { PublicGuest, RsvpAttending } from "@/lib/types";
import { IconCheck, IconHeart, IconMinus, IconPlus } from "./Icons";
import { Turnstile } from "./Turnstile";
import { gsap, prefersReducedMotion } from "./gsap";

interface Props {
  s: PublicSettings;
  guest: PublicGuest | null;
  turnstileSiteKey: string;
  /** Convite aberto respondido: passa a se comportar como convite pessoal. */
  onGuestResolved: (guest: PublicGuest) => void;
}

type View = "form" | "summary" | "thanks";

/** Cena 7 — confirmação de presença (gravada no banco pelo servidor). */
export function RsvpSection({ s, guest, turnstileSiteKey, onGuestResolved }: Props) {
  const mode: "personal" | "generic" | "closed" = guest ? "personal" : s.genericInviteEnabled ? "generic" : "closed";
  const closed = deadlinePassed(s.rsvpDeadline);
  const maxPeople = guest?.maxPeople ?? s.genericMaxPeople;

  const [view, setView] = useState<View>(guest?.rsvp ? "summary" : "form");
  const [attending, setAttending] = useState<RsvpAttending | null>(guest?.rsvp?.attending ?? null);
  const [people, setPeople] = useState<number>(guest?.rsvp?.people || 1);
  const [message, setMessage] = useState(guest?.rsvp?.message ?? "");
  const maxCompanions = Math.max(0, maxPeople - 1);
  const companions = Math.min(maxCompanions, Math.max(0, people - 1));
  const [companionsText, setCompanionsText] = useState(String(companions));
  const setCompanions = (n: number) => {
    const v = Math.min(maxCompanions, Math.max(0, n));
    setPeople(1 + v);
    setCompanionsText(String(v));
    if (!attending) setAttending("yes");
  };
  const [name, setName] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [lastResult, setLastResult] = useState<{ attending: RsvpAttending; people: number } | null>(
    guest?.rsvp ? { attending: guest.rsvp.attending, people: guest.rsvp.people } : null,
  );
  const [pending, startTransition] = useTransition();
  const honeypot = useRef<HTMLInputElement>(null);
  const thanksRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const uid = useId();
  const onToken = useCallback((t: string) => setTurnstileToken(t), []);
  const [savedToken, setSavedToken] = useState("");

  // Quem já respondeu pelo convite aberto neste aparelho pode rever/alterar a resposta.
  useEffect(() => {
    if (mode !== "generic") return;
    let t = "";
    try {
      t = localStorage.getItem("alana-invite-token") ?? "";
    } catch {}
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(t)) return;
    const id = requestAnimationFrame(() => setSavedToken(t));
    return () => cancelAnimationFrame(id);
  }, [mode]);

  useEffect(() => {
    if (view !== "thanks" || !thanksRef.current) return;
    thanksRef.current.focus();
    if (prefersReducedMotion()) return;
    const q = gsap.utils.selector(thanksRef);
    const path = thanksRef.current.querySelector<SVGPathElement>("[data-thanks-heart] path");
    const len = path?.getTotalLength?.() ?? 120;
    const tl = gsap.timeline();
    tl.fromTo(thanksRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 });
    if (path) {
      tl.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.2, ease: "power2.inOut" }, "<0.1");
      tl.fromTo(q("[data-thanks-fill]"), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: "back.out(2.2)" }, "-=0.3");
    }
    tl.from(q("[data-thanks-text]"), { opacity: 0, y: 10, stagger: 0.12, duration: 0.7 }, "-=0.4");
    tl.fromTo(
      q("[data-thanks-spark]"),
      { scale: 0, opacity: 1 },
      { scale: 1.6, opacity: 0, duration: 1.1, stagger: 0.05, ease: "power2.out" },
      "-=1",
    );
  }, [view]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  if (mode === "closed") {
    return (
      <section id="confirmar" className="px-5 py-24 text-center sm:py-28" aria-labelledby="rsvp-title">
        <Heading />
        <p data-reveal className="prose-invite mx-auto max-w-[32ch] !text-lg text-cocoa-500">
          Para confirmar sua presença, use o link pessoal que você recebeu dos papais — ou fale com eles pelo WhatsApp.
        </p>
      </section>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!attending) {
      setError({ text: "Escolha uma das opções: vai ou não poderá ir.", field: "attending" });
      return;
    }
    if (mode === "generic" && name.trim().length < 3) {
      setError({ text: "Informe seu nome completo.", field: "name" });
      return;
    }
    if (mode === "generic" && turnstileSiteKey && !turnstileToken) {
      setError({ text: "Aguarde a verificação de segurança terminar." });
      return;
    }
    startTransition(async () => {
      try {
        const payload = {
          token: guest?.token ?? "",
          name: mode === "generic" ? name : "",
          phone: "",
          attending,
          people: attending === "yes" ? Math.min(people, maxPeople) : 0,
          message,
          website: honeypot.current?.value ?? "",
          turnstileToken: turnstileToken || undefined,
        };
        // Uma nova tentativa automática se a conexão falhar (repetir é seguro: a resposta é atualizada, nunca duplicada).
        let res;
        try {
          res = await rsvpAction(payload);
        } catch {
          await new Promise((r) => setTimeout(r, 800));
          res = await rsvpAction(payload);
        }
        if (!res.ok) {
          setError({ text: res.error, field: res.field });
          return;
        }
        setLastResult({ attending: res.attending, people: res.people });
        if (mode === "generic" && res.token) {
          // Guarda o link pessoal para que a pessoa possa alterar a resposta depois.
          try {
            localStorage.setItem("alana-invite-token", res.token);
            sessionStorage.setItem(`alana-opened-${res.token}`, "1");
          } catch {}
          window.history.replaceState(null, "", `/convite/${res.token}`);
          onGuestResolved({
            token: res.token,
            name: name.trim(),
            groupName: "",
            maxPeople,
            rsvp: { attending: res.attending, people: res.people, message },
          });
        }
        setView("thanks");
        // Depois do agradecimento, leva a pessoa até a lista de enxoval (e mostra o lembrete da fralda).
        const registry = document.getElementById("enxoval");
        if (registry) {
          window.setTimeout(() => {
            const top = registry.getBoundingClientRect().top + window.scrollY - 16;
            window.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
            window.setTimeout(() => window.dispatchEvent(new CustomEvent("alana:registry-reminder")), prefersReducedMotion() ? 50 : 900);
          }, 2600);
        }
      } catch {
        setError({ text: "Sem conexão no momento. Verifique sua internet e tente de novo." });
      }
    });
  };

  const errId = `${uid}-err`;
  const fieldErr = (f: string) => (error?.field === f ? errId : undefined);

  return (
    <section id="confirmar" className="relative px-4 py-24 sm:py-28" aria-labelledby="rsvp-title">
      <Heading />
      <div
        data-reveal
        className="paper relative mx-auto max-w-lg rounded-[28px] px-5 py-8 sm:px-10 sm:py-10"
        style={{ boxShadow: "var(--shadow-paper)" }}
      >
        <div className="pointer-events-none absolute inset-2 rounded-[22px] border border-champagne-400/25" aria-hidden="true" />

        {view === "thanks" && lastResult ? (
          <div ref={thanksRef} tabIndex={-1} className="relative py-6 text-center outline-none" role="status" data-testid="rsvp-thanks">
            <div className="relative mx-auto mb-6 h-20 w-20" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  data-thanks-spark
                  className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-champagne-400 opacity-0"
                  style={{ transform: `rotate(${i * 60}deg) translateY(-44px)` }}
                />
              ))}
              <svg data-thanks-heart viewBox="0 0 24 24" className="absolute inset-0 h-full w-full text-rose-400">
                <path
                  d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                />
              </svg>
              <svg data-thanks-fill viewBox="0 0 24 24" className="absolute inset-[22%] text-blush-200">
                <path fill="currentColor" d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
              </svg>
            </div>
            <p data-thanks-text className="display text-[1.7rem] leading-snug text-cocoa-700 sm:text-3xl">
              {lastResult.attending === "yes" ? s.thanksYes : s.thanksNo}
            </p>
            {lastResult.attending === "yes" && (
              <p data-thanks-text className="mt-3 text-sm text-cocoa-500">
                {lastResult.people === 1 ? "1 pessoa confirmada" : `${lastResult.people} pessoas confirmadas`}
              </p>
            )}
            <button type="button" className="btn btn-ghost mt-8" onClick={() => setView("form")} data-thanks-text>
              Alterar resposta
            </button>
          </div>
        ) : view === "summary" && lastResult ? (
          <div className="relative py-4 text-center" data-testid="rsvp-summary">
            <p className="eyebrow mb-3">Sua resposta</p>
            <p className="display text-[1.7rem] text-cocoa-700">
              {lastResult.attending === "yes"
                ? `Presença confirmada · ${lastResult.people} ${lastResult.people === 1 ? "pessoa" : "pessoas"}`
                : "Você nos avisou que não poderá ir"}
            </p>
            {closed ? (
              <p className="mt-4 text-sm text-cocoa-500">O prazo para alterações foi encerrado.</p>
            ) : (
              <button type="button" className="btn btn-ghost mt-6" onClick={() => setView("form")}>
                Alterar resposta
              </button>
            )}
          </div>
        ) : closed ? (
          <p className="relative py-6 text-center text-cocoa-500">
            O prazo de confirmação terminou em {formatDateLong(s.rsvpDeadline)}. Se precisar, fale com os papais pelo WhatsApp.
          </p>
        ) : (
          <form onSubmit={submit} noValidate className="relative space-y-6" data-testid="rsvp-form">
            {guest ? (
              <div className="text-center">
                <p className="display text-[1.6rem] text-cocoa-700">Olá, {firstName(guest.name)}!</p>
                <p className="mt-1 text-sm text-cocoa-500">
                  {guest.maxPeople === 1 ? "Este convite é individual." : `Este convite é para até ${guest.maxPeople} pessoas.`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {savedToken && (
                  <a
                    href={`/convite/${savedToken}`}
                    className="block rounded-2xl bg-blush-50 px-4 py-3 text-center text-sm text-cocoa-700"
                    data-testid="saved-answer"
                  >
                    Você já respondeu neste aparelho. <span className="font-semibold text-rose-600 underline underline-offset-2">Ver ou alterar minha resposta</span>
                  </a>
                )}
                <p className="text-center text-sm text-cocoa-500">Conte quem é você e quantas pessoas vão com você.</p>
                <div>
                  <label htmlFor={`${uid}-name`} className="field-label">
                    Seu nome completo <span className="text-rose-600" aria-hidden="true">*</span>
                  </label>
                  <input
                    id={`${uid}-name`}
                    className="field"
                    autoComplete="name"
                    required
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={error?.field === "name"}
                    aria-describedby={fieldErr("name")}
                  />
                </div>
              </div>
            )}

            <fieldset aria-describedby={fieldErr("attending")}>
              <legend className="field-label mb-3 text-center !text-[0.95rem]">Você poderá comparecer?</legend>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["yes", "Vou, com certeza!"],
                    ["no", "Não poderei ir"],
                  ] as const
                ).map(([value, label]) => {
                  const checked = attending === value;
                  return (
                    <label
                      key={value}
                      className={`relative flex min-h-[64px] cursor-pointer items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-center text-[0.95rem] font-semibold transition-all duration-300 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-rose-600 ${
                        checked
                          ? value === "yes"
                            ? "border-rose-400 bg-blush-100 text-cocoa-900 shadow-[var(--shadow-soft)]"
                            : "border-cocoa-500/40 bg-linen text-cocoa-900"
                          : "border-blush-300/70 bg-paper text-cocoa-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="attending"
                        value={value}
                        checked={checked}
                        onChange={() => setAttending(value)}
                        className="sr-only"
                      />
                      {checked && <IconCheck size={18} className="shrink-0 text-rose-600" />}
                      {label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {attending !== "no" && maxPeople > 1 && (
              <div
                className={`rounded-2xl border border-blush-200 bg-blush-50/70 px-4 py-5 text-center transition-opacity duration-300 ${
                  attending === "yes" ? "" : "opacity-70"
                }`}
              >
                <label htmlFor={`${uid}-companions`} className="field-label !mb-1 !text-[1rem]">
                  Quantas pessoas vão com você?
                </label>
                <p id={`${uid}-companions-help`} className="mb-3 text-xs text-cocoa-500">
                  Sem contar você. Coloque 0 se for só você.
                </p>
                <div className="inline-flex items-center gap-3">
                  <button
                    type="button"
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-blush-300 bg-paper text-cocoa-700 transition active:scale-95 disabled:opacity-40"
                    onClick={() => setCompanions(companions - 1)}
                    disabled={companions <= 0}
                    aria-label="Diminuir acompanhantes"
                  >
                    <IconMinus />
                  </button>
                  <input
                    id={`${uid}-companions`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    maxLength={2}
                    value={companionsText}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setCompanionsText(digits);
                      setPeople(1 + Math.min(maxCompanions, Number(digits || 0)));
                      if (!attending) setAttending("yes");
                    }}
                    onFocus={(e) => {
                      e.target.select();
                      if (!attending) setAttending("yes");
                    }}
                    onBlur={() => setCompanionsText(String(people - 1))}
                    aria-describedby={`${uid}-companions-help ${fieldErr("people") ?? ""}`}
                    className="field display tabular !h-14 !w-20 !px-2 text-center !text-3xl"
                    data-testid="companions"
                  />
                  <button
                    type="button"
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-blush-300 bg-paper text-cocoa-700 transition active:scale-95 disabled:opacity-40"
                    onClick={() => setCompanions(companions + 1)}
                    disabled={companions >= maxCompanions}
                    aria-label="Aumentar acompanhantes"
                  >
                    <IconPlus />
                  </button>
                </div>
                <p className="mt-3 text-sm font-medium text-cocoa-700" aria-live="polite" data-testid="people-count">
                  Total: {people} {people === 1 ? "pessoa" : "pessoas"} (você{companions > 0 ? ` + ${companions}` : ""})
                </p>
                {mode === "personal" && (
                  <p className="mt-1 text-xs text-cocoa-500">Este convite permite até {maxCompanions} acompanhante{maxCompanions === 1 ? "" : "s"}.</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor={`${uid}-msg`} className="field-label">
                Um recadinho para a Alana <span className="font-normal text-cocoa-500">(opcional)</span>
              </label>
              <textarea
                id={`${uid}-msg`}
                className="field min-h-[96px] resize-y"
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escreva com carinho…"
              />
            </div>

            {/* honeypot anti-robô (invisível para pessoas) */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label>
                Não preencha
                <input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            {mode === "generic" && turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} onToken={onToken} />}

            {error && (
              <p
                ref={errorRef}
                id={errId}
                tabIndex={-1}
                role="alert"
                className="rounded-xl bg-[#f7e4e2] px-4 py-3 text-center text-sm font-medium text-danger outline-none"
                data-testid="rsvp-error"
              >
                {error.text}
              </p>
            )}

            <button type="submit" className="btn btn-primary w-full" disabled={pending} data-testid="rsvp-submit">
              {pending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper/40 border-t-paper" aria-hidden="true" />
                  Enviando…
                </>
              ) : (
                <>
                  <IconHeart size={18} />
                  {lastResult ? "Atualizar resposta" : "Enviar resposta"}
                </>
              )}
            </button>

            {s.rsvpDeadline && (
              <p className="text-center text-xs text-cocoa-500">Confirme até {formatDateLong(s.rsvpDeadline)}.</p>
            )}
            {mode === "generic" && (
              <p className="text-center text-[0.7rem] leading-relaxed text-cocoa-500/90">
                Usamos seus dados apenas para organizar o chá. Eles ficam visíveis só para os papais.
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}

function Heading() {
  return (
    <header className="mb-10 text-center" data-reveal>
      <p className="eyebrow mb-3">Confirme sua presença</p>
      <h2 id="rsvp-title" className="display text-[2.1rem] text-cocoa-700 sm:text-5xl">
        Você vem?
      </h2>
    </header>
  );
}
