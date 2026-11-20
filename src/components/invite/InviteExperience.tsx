"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicSettings } from "@/lib/settings";
import type { GiftSuggestion, PublicGuest } from "@/lib/types";
import { Envelope } from "./Envelope";
import { Hero } from "./Hero";
import { IconCalendar, IconGift, IconHeart, IconMusic, IconMute, IconPin, IconSparkle } from "./Icons";
import { QuickNav, type QuickNavItem } from "./QuickNav";
import { RsvpSection } from "./Rsvp";
import {
  Closing,
  DateSection,
  GiftsSection,
  InviteText,
  LocationSection,
  RegistrySection,
  WhatsappSection,
} from "./Sections";
import { gsap, isLowPowerDevice, prefersReducedMotion, ScrollTrigger, useGSAP } from "./gsap";

export interface InviteData {
  settings: PublicSettings;
  guest: PublicGuest | null;
  gifts: GiftSuggestion[];
  turnstileSiteKey: string;
}

const openedKey = (token: string | undefined) => `alana-opened-${token ?? "geral"}`;

export function InviteExperience({ settings: s, guest: initialGuest, gifts, turnstileSiteKey }: InviteData) {
  const [guest, setGuest] = useState(initialGuest);
  const [opened, setOpened] = useState(false);
  const [envelopeVisible, setEnvelopeVisible] = useState(true);
  const [lowPower, setLowPower] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const musicEnabled = s.showMusic && Boolean(s.musicUrl);
  const token = initialGuest?.token;

  // Retorno na mesma sessão: pula o envelope (o script inline já o escondeu antes da pintura).
  useEffect(() => {
    let skip = false;
    try {
      skip = sessionStorage.getItem(openedKey(token)) === "1";
    } catch {}
    const id = requestAnimationFrame(() => {
      setLowPower(isLowPowerDevice());
      if (skip) {
        setEnvelopeVisible(false);
        setOpened(true);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [token]);

  // Trava a rolagem enquanto o envelope está na tela.
  useEffect(() => {
    const html = document.documentElement;
    if (envelopeVisible) {
      html.style.overflow = "hidden";
      window.scrollTo(0, 0);
    } else {
      html.style.overflow = "";
      delete html.dataset.opened;
    }
    return () => {
      html.style.overflow = "";
    };
  }, [envelopeVisible]);

  const startMusic = useCallback(() => {
    const a = audioRef.current;
    if (!musicEnabled || !a) return;
    a.volume = 0.55;
    a.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, [musicEnabled]);

  const onOpened = useCallback(() => {
    try {
      sessionStorage.setItem(openedKey(token), "1");
    } catch {}
    window.scrollTo(0, 0);
    setEnvelopeVisible(false);
    setOpened(true);
    requestAnimationFrame(() => document.getElementById("alana-title")?.focus({ preventScroll: true }));
  }, [token]);

  const replay = useCallback(() => {
    try {
      sessionStorage.removeItem(openedKey(token));
    } catch {}
    // Volta ao topo antes de recarregar, para rever a experiência desde o início.
    try {
      history.scrollRestoration = "manual";
    } catch {}
    window.scrollTo(0, 0);
    window.location.reload();
  }, [token]);

  const toggleMusic = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  // Revelações ao rolar (o conteúdo é visível por padrão; só escondemos quando o GSAP está ativo).
  useGSAP(
    () => {
      if (!opened || prefersReducedMotion()) return;
      const items = gsap.utils.toArray<HTMLElement>("[data-reveal]", mainRef.current);
      gsap.set(items, { opacity: 0, y: 28 });
      ScrollTrigger.batch(items, {
        start: "top 90%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, stagger: 0.12, ease: "power3.out", overwrite: true }),
      });
      // Garante que nada fique invisível caso a página seja redimensionada ou o gatilho falhe.
      const safety = window.setTimeout(() => ScrollTrigger.refresh(), 400);
      return () => window.clearTimeout(safety);
    },
    { scope: mainRef, dependencies: [opened] },
  );

  const decorations = s.showDecorations && !lowPower;

  // Atalhos do HUD lateral: só seções que existem nesta página
  const navItems: QuickNavItem[] = [
    { id: "data", label: "Data", icon: <IconCalendar size={20} /> },
    ...(s.showRegistry && s.registryUrl ? [{ id: "enxoval", label: "Presente", icon: <IconGift size={20} /> }] : []),
    ...(s.showLocation ? [{ id: "local", label: "Endereço", icon: <IconPin size={20} /> }] : []),
    { id: "confirmar", label: "Confirmar presença", icon: <IconHeart size={20} /> },
    ...(s.showGifts && gifts.length > 0 ? [{ id: "presentes", label: "Sugestões de mimos", icon: <IconSparkle size={20} /> }] : []),
  ];

  return (
    <>
      <a href="#confirmar" className="sr-only-focusable fixed left-4 top-4 z-[60] rounded-full bg-paper px-4 py-2 text-sm shadow">
        Ir para a confirmação de presença
      </a>

      {envelopeVisible && (
        <Envelope
          guestName={guest?.name ?? null}
          message={s.envelopeMessage}
          showDecorations={decorations}
          onOpenStart={startMusic}
          onOpened={onOpened}
        />
      )}

      <main ref={mainRef} className="relative overflow-x-clip" aria-hidden={envelopeVisible ? true : undefined}>
        <Hero
          opened={opened}
          guestName={guest?.name ?? null}
          phrase={s.heroPhrase}
          bearImageUrl={s.bearImageUrl}
          showBear={s.showBear}
          showDecorations={decorations}
          giftTarget={s.showRegistry && s.registryUrl ? "enxoval" : s.showGifts && gifts.length > 0 ? "presentes" : null}
        />
        <div className="paper-ivory">
          <InviteText lines={s.inviteLines.filter(Boolean)} />
          <DateSection s={s} />
          {/* Enxoval antes do local, para ninguém deixar de ver */}
          {s.showRegistry && <RegistrySection s={s} />}
          {s.showLocation && <LocationSection s={s} />}
          <RsvpSection s={s} guest={guest} turnstileSiteKey={turnstileSiteKey} onGuestResolved={setGuest} />
          {s.showWhatsapp && <WhatsappSection s={s} guestName={guest?.name ?? ""} />}
          {s.showGifts && <GiftsSection s={s} gifts={gifts} />}
        </div>
        <Closing s={s} onReplay={replay} />
      </main>

      <QuickNav items={navItems} visible={opened && !envelopeVisible} />

      {musicEnabled && (
        <>
          <audio ref={audioRef} src={s.musicUrl} loop preload="none" />
          {!envelopeVisible && (
            <button
              type="button"
              onClick={toggleMusic}
              aria-pressed={playing}
              aria-label={playing ? "Pausar a música" : "Tocar a música"}
              className="paper fixed bottom-[calc(var(--safe-bottom)+1rem)] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full text-cocoa-700 shadow-[var(--shadow-soft)] transition active:scale-95"
            >
              {playing ? <IconMusic size={20} /> : <IconMute size={20} />}
            </button>
          )}
        </>
      )}
    </>
  );
}
