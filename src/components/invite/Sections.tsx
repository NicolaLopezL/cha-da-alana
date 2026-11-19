"use client";

import { useEffect, useRef, useState } from "react";
import {
  dateParts,
  eventInstant,
  fillTemplate,
  formatTime,
  fullAddress,
  googleMapsUrl,
  wazeUrl,
  whatsappUrl,
} from "@/lib/format";
import type { PublicSettings } from "@/lib/settings";
import type { GiftSuggestion } from "@/lib/types";
import { Countdown } from "./Countdown";
import { IconCalendar, IconChat, IconClock, IconExternal, IconGift, IconHeart, IconNavigate, IconPin } from "./Icons";
import { HeartBalloon } from "./Ornaments";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";

function SectionHeading({ eyebrow, title, id }: { eyebrow: string; title: string; id?: string }) {
  return (
    <header className="mb-10 text-center" data-reveal>
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h2 id={id} className="display text-[2.1rem] text-cocoa-700 sm:text-5xl">
        {title}
      </h2>
    </header>
  );
}

function HeartRule({ className = "" }: { className?: string }) {
  return (
    <div className={`rule-gold mx-auto w-32 ${className}`} aria-hidden="true">
      <IconHeart size={12} />
    </div>
  );
}

/* Cena 4 — texto do convite */
export function InviteText({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <section id="convite" className="relative px-7 py-24 sm:py-32" aria-label="Convite">
      <div className="mx-auto max-w-xl space-y-8 text-center">
        <HeartRule className="mb-12" />
        {lines.map((line, i) => (
          <p
            key={i}
            data-reveal
            className={i === 0 ? "display text-[1.85rem] italic leading-snug text-cocoa-700 sm:text-[2.4rem]" : "prose-invite"}
          >
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}

/* Cena 5 — data e horário */
export function DateSection({ s }: { s: PublicSettings }) {
  const p = dateParts(s.eventDate);
  const instant = eventInstant(s.eventDate, s.eventTime);
  const time = formatTime(s.eventTime);
  const end = formatTime(s.eventEndTime);

  const calendarUrl = (() => {
    if (!p || !instant) return "";
    const fmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const endMs = s.eventEndTime ? eventInstant(s.eventDate, s.eventEndTime) ?? instant + 3 * 3600e3 : instant + 3 * 3600e3;
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: "Chá da Alana",
      dates: `${fmt(instant)}/${fmt(endMs)}`,
      details: "Chá de bebê da Alana 💗",
      location: [s.venueName, fullAddress(s)].filter(Boolean).join(" — "),
      ctz: "America/Sao_Paulo",
    });
    return `https://calendar.google.com/calendar/render?${params}`;
  })();

  return (
    <section id="data" className="relative px-5 py-24 sm:py-28" aria-labelledby="data-title">
      <SectionHeading eyebrow="Quando" title="Reserve a data" id="data-title" />
      <div
        data-reveal
        className="paper relative mx-auto max-w-lg rounded-[28px] px-6 py-10 text-center sm:px-10 sm:py-12"
        style={{ boxShadow: "var(--shadow-paper)" }}
      >
        <div className="pointer-events-none absolute inset-2 rounded-[22px] border border-champagne-400/30" aria-hidden="true" />
        {p ? (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
              <div className="border-y border-champagne-400/50 py-2 text-right text-xs font-semibold uppercase tracking-[0.22em] text-cocoa-500 sm:text-sm">
                {p.weekday.replace("-feira", "")}
              </div>
              <div className="display text-[5.5rem] leading-none text-rose-600 sm:text-[7rem]" data-testid="event-day">
                {String(p.day).padStart(2, "0")}
              </div>
              <div className="border-y border-champagne-400/50 py-2 text-left text-xs font-semibold uppercase tracking-[0.22em] text-cocoa-500 sm:text-sm">
                {p.month}
              </div>
            </div>
            <p className="display mt-3 text-2xl tracking-[0.3em] text-cocoa-700">{p.year}</p>
            <p className="mt-2 text-sm text-cocoa-500 first-letter:uppercase">
              {p.weekday}, {p.day} de {p.month} de {p.year}
            </p>
            {time && (
              <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-blush-50 px-4 py-2 text-[0.95rem] font-medium text-cocoa-700">
                <IconClock size={18} className="text-rose-600" />
                {end ? `das ${time} às ${end}` : `às ${time}`}
              </p>
            )}
            {s.showCountdown && instant && (
              <div className="mt-8">
                <Countdown target={instant} />
              </div>
            )}
            {calendarUrl && (
              <a href={calendarUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-8">
                <IconCalendar size={18} />
                Adicionar à agenda
              </a>
            )}
          </>
        ) : (
          <div className="py-4" data-testid="date-soon">
            <IconCalendar size={28} className="mx-auto mb-4 text-champagne-400" />
            <p className="script text-[3.6rem] leading-none text-rose-600 sm:text-[4.4rem]">Data em breve</p>
            <p className="prose-invite mx-auto mt-5 max-w-[28ch] !text-lg text-cocoa-500">
              Estamos escolhendo o dia com todo o carinho. Assim que for definido, ele aparecerá aqui.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* Cena 6 — localização */
export function LocationSection({ s }: { s: PublicSettings }) {
  const hasPlace = Boolean(s.venueName || s.address);
  const maps = googleMapsUrl(s);
  const waze = wazeUrl(s);
  return (
    <section id="local" className="relative px-5 py-24 sm:py-28" aria-labelledby="local-title">
      <SectionHeading eyebrow="Onde" title="O lugar" id="local-title" />
      <div data-reveal className="mx-auto max-w-lg text-center">
        <span className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-blush-100 text-rose-600">
          <IconPin size={24} />
        </span>
        {hasPlace ? (
          <>
            {s.venueName && <p className="display text-3xl text-cocoa-700 sm:text-4xl">{s.venueName}</p>}
            {s.address && <p className="mt-3 text-[1.05rem] leading-relaxed text-cocoa-700">{s.address}</p>}
            {s.city && <p className="text-[1.05rem] text-cocoa-500">{s.city}</p>}
            {s.venueInfo && (
              <p className="prose-invite mx-auto mt-5 max-w-[34ch] !text-lg italic text-cocoa-500">{s.venueInfo}</p>
            )}
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              {maps && (
                <a href={maps} target="_blank" rel="noopener noreferrer" className="btn btn-primary" data-testid="maps-link">
                  <IconNavigate size={18} />
                  Como chegar · Google Maps
                </a>
              )}
              {waze && (
                <a href={waze} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" data-testid="waze-link">
                  <IconNavigate size={18} />
                  Abrir no Waze
                </a>
              )}
            </div>
          </>
        ) : (
          <div data-testid="place-soon">
            <p className="script text-[3.2rem] leading-none text-rose-600 sm:text-[4rem]">Local em breve</p>
            <p className="prose-invite mx-auto mt-4 max-w-[28ch] !text-lg text-cocoa-500">
              O endereço será divulgado aqui assim que estiver confirmado.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* Cena 8 — WhatsApp com o pai e a mãe */
export function WhatsappSection({ s, guestName }: { s: PublicSettings; guestName: string }) {
  const contacts = [
    { name: s.motherName, phone: s.motherPhone, id: "mae" },
    { name: s.fatherName, phone: s.fatherPhone, id: "pai" },
  ].filter((c) => c.phone);
  if (contacts.length === 0) return null;
  const message = fillTemplate(s.whatsappTemplate, { nome: guestName || "um(a) convidado(a)" });

  return (
    <section id="whatsapp" className="px-5 pb-24 pt-4" aria-labelledby="whatsapp-title">
      <div data-reveal className="mx-auto max-w-lg text-center">
        <h2 id="whatsapp-title" className="display text-2xl text-cocoa-700 sm:text-3xl">
          Prefere falar com a gente?
        </h2>
        <p className="mx-auto mt-3 max-w-[38ch] text-[0.95rem] leading-relaxed text-cocoa-500">
          A confirmação feita aqui no site já chega automaticamente para os dois. Se quiser, mande também uma mensagem:
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {contacts.map((c) => (
            <a
              key={c.id}
              href={whatsappUrl(c.phone, message)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-soft"
              data-testid={`whatsapp-${c.id}`}
            >
              <IconChat size={20} />
              Falar com {c.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Cena 9 — sugestões de presentes simples */
export function GiftsSection({ s, gifts }: { s: PublicSettings; gifts: GiftSuggestion[] }) {
  if (gifts.length === 0) return null;
  return (
    <section id="presentes" className="relative px-5 py-24 sm:py-28" aria-labelledby="presentes-title">
      <SectionHeading eyebrow="Com carinho" title={s.giftsTitle} id="presentes-title" />
      <p data-reveal className="prose-invite mx-auto -mt-4 mb-12 max-w-[36ch] text-center !text-lg text-cocoa-500 sm:!text-xl">
        {s.giftsText}
      </p>
      <ul className="mx-auto grid max-w-3xl gap-x-12 sm:grid-cols-2" data-testid="gift-list">
        {gifts.map((g) => {
          const meta = [g.brand, g.size].filter(Boolean).join(" · ");
          return (
            <li key={g.id} data-reveal className="flex gap-4 border-b border-blush-200/80 py-5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-champagne-400" aria-hidden="true" />
              <div>
                <p className="display text-[1.45rem] leading-tight text-cocoa-700">{g.name}</p>
                {meta && <p className="mt-1 text-sm font-medium text-cocoa-500">{meta}</p>}
                {g.notes && <p className="mt-1 text-sm italic text-cocoa-500">{g.notes}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* Cena 10 — lista de enxoval (site externo, separada das sugestões) */
export function RegistrySection({ s }: { s: PublicSettings }) {
  // Depois de confirmar presença, o recado da fralda dá uma "piscadinha" para chamar atenção
  const [nudge, setNudge] = useState(0);
  useEffect(() => {
    const onReminder = () => setNudge((n) => n + 1);
    window.addEventListener("alana:registry-reminder", onReminder);
    return () => window.removeEventListener("alana:registry-reminder", onReminder);
  }, []);

  if (!s.registryUrl) return null;
  return (
    <section id="enxoval" className="px-4 py-10 sm:py-16" aria-labelledby="enxoval-title">
      <div
        data-reveal
        className="relative mx-auto max-w-3xl overflow-hidden rounded-[32px] bg-blush-100 px-6 pb-12 pt-14 text-center sm:px-14 sm:py-16"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          aria-hidden="true"
          style={{ backgroundImage: "var(--paper-grain)" }}
        />
        <span className="relative mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-paper text-rose-600 shadow-[var(--shadow-soft)]">
          <IconGift size={24} />
        </span>
        <h2 id="enxoval-title" className="display relative mx-auto max-w-[20ch] text-[1.9rem] text-cocoa-700 sm:text-[2.6rem]">
          {s.registryTitle}
        </h2>
        <p className="relative mx-auto mt-4 max-w-[40ch] text-[1rem] leading-relaxed text-cocoa-700/85">{s.registryText}</p>

        <div className="relative mx-auto mt-10 w-full max-w-sm">
          <a
            href={s.registryUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-describedby={s.registryReminder ? "registry-reminder-text" : undefined}
            className="btn btn-primary w-full !min-h-[60px] !gap-3 !px-8 !text-[1.05rem] shadow-[var(--shadow-lift)]"
            data-testid="registry-link"
          >
            <IconGift size={22} />
            Ver lista de enxoval
            <IconExternal size={17} />
          </a>

          {/* recado da fralda: sempre visível, no celular e no computador */}
          {s.registryReminder && (
            <div
              key={nudge}
              className={`paper relative mt-7 rounded-2xl border-2 border-dashed border-rose-400/45 px-5 pb-4 pt-6 text-cocoa-700 shadow-[var(--shadow-soft)] ${
                nudge ? "animate-reminder-nudge" : ""
              }`}
              data-testid="registry-reminder"
            >
              <span className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-rose-600 px-3.5 py-1 text-[0.7rem] font-bold tracking-[0.16em] text-paper uppercase shadow-[var(--shadow-soft)]">
                <IconHeart size={13} />
                Lembrete
              </span>
              <p id="registry-reminder-text" className="text-[1rem] leading-snug">
                {s.registryReminder}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* Cena 11 — encerramento */
export function Closing({ s, onReplay }: { s: PublicSettings; onReplay: () => void }) {
  const scope = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const q = gsap.utils.selector(scope);
      gsap.fromTo(
        q("[data-closing-balloon]"),
        { y: 120, opacity: 0 },
        {
          y: -30,
          opacity: 1,
          ease: "none",
          scrollTrigger: { trigger: scope.current, start: "top 85%", end: "bottom bottom", scrub: 1.2 },
        },
      );
    },
    { scope },
  );

  return (
    <footer ref={scope} className="paper-ivory relative overflow-hidden px-6 pb-[calc(var(--safe-bottom)+3rem)] pt-28 text-center">
      <div data-closing-balloon className="mx-auto mb-8 w-fit">
        <div className="animate-balloon">
          <HeartBalloon size={70} id="closing-balloon" />
        </div>
      </div>
      <div className="mx-auto max-w-xl space-y-5">
        {s.closingLines.map((l, i) => (
          <p key={i} data-reveal className="display text-[1.75rem] italic leading-snug text-cocoa-700 sm:text-[2.3rem]">
            {l}
          </p>
        ))}
        <p data-reveal className="script pt-4 text-[2.6rem] text-rose-600 sm:text-[3.2rem]">
          {s.signature}
        </p>
      </div>
      <HeartRule className="mt-14" />
      <p className="mt-6 text-xs tracking-[0.2em] text-cocoa-500 uppercase">Chá da Alana</p>
      <button type="button" onClick={onReplay} className="mt-3 min-h-11 px-3 text-xs text-cocoa-500 underline decoration-champagne-400/60 underline-offset-4">
        Ver a abertura do envelope de novo
      </button>
    </footer>
  );
}
