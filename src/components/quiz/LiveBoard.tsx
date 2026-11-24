"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { quizDict, type QuizDict } from "@/lib/quiz/i18n";
import type { LiveRow, LiveState, QuizLang, QuizTextOverrides } from "@/lib/quiz/types";
import { prefersReducedMotion } from "@/components/invite/gsap";
import { OrnamentFrame, Particles } from "@/components/invite/Ornaments";
import { Bear, HeartRain, Medal } from "./Art";
import { FullscreenButton } from "./FullscreenButton";
import { LangSwitch, useQuizLang } from "./LangSwitch";

const PAGE_SIZE = 7; // linhas por página no modo televisão
const PAGE_MS = 8000;
const REVEAL_MS = 9000; // pódio 3º, 2º, 1º e chuva de corações

/** Busca o ranking em intervalos curtos; pausa com a aba escondida e espaça as tentativas sem conexão. */
function useLive(initial: LiveState | null, everyMs: number) {
  const [state, setState] = useState(initial);
  const [online, setOnline] = useState(initial !== null);
  const last = useRef(JSON.stringify(initial));

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fails = 0;
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      clearTimeout(timer);
      const ctrl = new AbortController();
      const abort = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch("/api/quiz/live", { cache: "no-cache", signal: ctrl.signal });
        if (!res.ok) throw new Error();
        const text = await res.text();
        if (stopped) return;
        fails = 0;
        setOnline(true);
        if (text !== last.current) {
          last.current = text;
          setState(JSON.parse(text) as LiveState);
        }
      } catch {
        if (stopped) return;
        fails++;
        if (fails >= 2) setOnline(false);
      } finally {
        clearTimeout(abort);
        running = false;
        if (!stopped && document.visibilityState === "visible") {
          timer = setTimeout(tick, fails ? Math.min(10_000, 1000 * 2 ** fails) : everyMs);
        }
      }
    };
    const onShow = () => {
      if (document.visibilityState === "visible") void tick();
      else clearTimeout(timer);
    };
    timer = setTimeout(tick, everyMs);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("online", onShow);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("online", onShow);
    };
  }, [everyMs]);

  return { state, online };
}

/** Mantém a tela da televisão acesa, quando o navegador permite. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const ask = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {}
    };
    void ask();
    document.addEventListener("visibilitychange", ask);
    return () => {
      document.removeEventListener("visibilitychange", ask);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

/** Troca suave de posições (FLIP): cada linha desliza do lugar antigo para o novo. */
function useFlip(rows: LiveRow[]) {
  const box = useRef<HTMLDivElement>(null);
  const rects = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    const reduce = prefersReducedMotion();
    box.current?.querySelectorAll<HTMLElement>("[data-row]").forEach((el) => {
      const id = el.dataset.row!;
      const now = el.getBoundingClientRect();
      const before = rects.current.get(id);
      next.set(id, now);
      if (reduce || !before) return;
      const dx = before.left - now.left;
      const dy = before.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)`, zIndex: 2 }, { transform: "none", zIndex: 2 }],
        { duration: 900, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    });
    rects.current = next;
  }, [rows]);
  return box;
}

export function LiveBoard({
  initial,
  texts,
  initialLang,
  tv,
}: {
  initial: LiveState | null;
  texts: QuizTextOverrides;
  initialLang: QuizLang;
  tv: boolean;
}) {
  const [lang, setLang] = useQuizLang(initialLang);
  const d = quizDict(lang, texts);
  const { state, online } = useLive(initial, tv ? 2000 : 3000);
  useWakeLock(tv);

  const mode = state?.mode ?? "off";
  const rows = state?.rows ?? [];
  const final = mode === "final";
  const ranked = (mode === "ranking" || final) && rows.length > 0;
  const mystery = state?.mystery === true;

  // Saiu do modo misterioso com o ranking no ar: contagem regressiva e revelação da classificação verdadeira.
  const [wasMystery, setWasMystery] = useState(mystery);
  const [reveal, setReveal] = useState<"count" | "show" | null>(null);
  if (mystery !== wasMystery) {
    setWasMystery(mystery);
    setReveal(!mystery && ranked ? "count" : null);
  }
  useEffect(() => {
    if (reveal !== "show") return;
    const id = setTimeout(() => setReveal(null), REVEAL_MS);
    return () => clearTimeout(id);
  }, [reveal]);
  const showPodium = useCallback(() => setReveal("show"), []);
  const counting = reveal === "count" && ranked;
  const podium = final || reveal === "show";

  const [page, setPage] = useState(0);
  const rest = rows.slice(3);
  const pages = tv ? Math.max(1, Math.ceil(rest.length / PAGE_SIZE)) : 1;
  useEffect(() => {
    if (pages < 2) return;
    const id = setInterval(() => setPage((p) => p + 1), PAGE_MS);
    return () => clearInterval(id);
  }, [pages]);
  const current = page % pages;
  const visibleRest = tv ? rest.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE) : rest;
  const box = useFlip(rows);

  const status =
    mystery ? d.mysteryStatus : state?.status === "published" ? d.winners : state?.status === "closed" ? `${d.closedLive} ${d.waitingOfficial}` : d.provisional;

  return (
    <main
      lang={lang === "pt" ? "pt-BR" : "es-CO"}
      data-testid="live-board"
      data-mode={mode}
      data-tv={tv ? "1" : undefined}
      data-mystery={mystery ? "1" : undefined}
      className={`paper-ivory relative flex flex-col overflow-x-clip ${tv ? "h-dvh overflow-hidden" : "min-h-dvh"}`}
    >
      <OrnamentFrame className="!fixed max-sm:hidden" />
      <Particles />
      {podium && !counting && <HeartRain count={tv ? 60 : 36} />}

      <header className={`relative z-10 text-center ${tv ? "px-[4vw] pt-[5vh]" : "px-5 pt-[calc(var(--safe-top)+2.25rem)]"}`}>
        {!tv && (
          <div className="mb-5 flex justify-center">
            <LangSwitch lang={lang} onChange={setLang} label={d.language} />
          </div>
        )}
        <p className={`eyebrow ${tv ? "!text-[1.7vh]" : ""}`}>{d.brand}</p>
        <h1 className={`display mt-1 text-cocoa-900 ${tv ? "text-[6vh]" : "text-[clamp(2.3rem,9vw,3.6rem)]"}`}>
          {final ? d.finalTitle : d.liveTitle}
        </h1>
        {!(tv && mystery) && <p className={`display italic text-rose-600 ${tv ? "text-[3.1vh]" : "mt-1 text-xl"}`}>{d.title}</p>}
        {(ranked || mode === "ranking") && (
          <p
            data-testid="live-status"
            className={`mx-auto mt-[1.2vh] inline-flex flex-wrap items-center justify-center gap-x-[1em] gap-y-1 font-semibold text-cocoa-500 ${tv ? "text-[2vh]" : "mt-3 text-sm"}`}
          >
            <span className={state?.status === "open" ? "" : "text-rose-600"}>{status}</span>
            <span>{d.participants(state!.participants)}</span>
            {state!.status === "open" && state!.showProgress && <span>{d.finishedCount(state!.done)}</span>}
            {state!.showScores && <span>{d.maxScore(state!.maxScore)}</span>}
          </p>
        )}
        {mystery && ranked && (
          <p className={`mystery-pill mx-auto mt-[1vh] w-fit rounded-full bg-rose-600 px-[1.3em] py-[0.4em] font-bold text-paper ${tv ? "text-[2.4vh]" : "!mt-3 text-sm"}`} data-testid="live-mystery">
            {d.mystery}
          </p>
        )}
        {state?.round && (
          <p className={`mx-auto mt-2 w-fit rounded-full bg-champagne-200/70 px-[1.2em] py-[0.35em] font-bold text-cocoa-900 ${tv ? "text-[2.2vh]" : "text-sm"}`} data-testid="live-round">
            {d.tieRound}
          </p>
        )}
        {!state?.round && !final && state?.tie && mode === "ranking" && (
          <p className={`mt-1 font-medium text-champagne-700 ${tv ? "text-[1.9vh]" : "text-sm"}`} data-testid="live-tie">
            {d.tieProvisional}
          </p>
        )}
      </header>

      <div
        ref={box}
        className={`relative z-10 mx-auto flex w-full min-h-0 flex-1 ${
          tv ? "max-w-[94vw] items-center justify-center gap-[3vw] px-[2vw] py-[1vh]" : "max-w-2xl flex-col px-4 pb-8 pt-6"
        }`}
      >
        {counting ? (
          <Countdown title={d.revealTitle} tv={tv} onDone={showPodium} />
        ) : ranked ? (
          <>
            <ol key={final ? "final" : "live"} className={tv ? `grid h-full min-h-0 w-full grid-cols-[minmax(0,1fr)] content-center gap-[2vh] ${rest.length ? "max-w-[44vw]" : "max-w-[60vw]"}` : "space-y-3"}>
              {rows.slice(0, 3).map((r, i) => (
                <Row key={r.id} row={r} place={i} state={state!} d={d} tv={tv} top reveal={podium} />
              ))}
            </ol>
            {rest.length > 0 && (
              <ol start={4} className={tv ? "grid h-full min-h-0 w-full max-w-[44vw] grid-cols-[minmax(0,1fr)] content-center gap-[1vh]" : "mt-4 space-y-2.5"}>
                {visibleRest.map((r) => (
                  <Row key={r.id} row={r} place={3} state={state!} d={d} tv={tv} roomy={rest.length <= 4} reveal={podium} />
                ))}
                {pages > 1 && (
                  <li className="mt-[0.6vh] flex list-none justify-center gap-2" aria-hidden="true">
                    {Array.from({ length: pages }, (_, i) => (
                      <span key={i} className={`h-[1.1vh] w-[1.1vh] rounded-full ${i === current ? "bg-rose-600" : "bg-blush-200"}`} />
                    ))}
                  </li>
                )}
              </ol>
            )}
          </>
        ) : (
          <Message tv={tv}>
            {mode === "hidden" ? d.liveHidden : mode === "waiting" ? d.liveWaiting : mode === "off" ? d.liveOff : final ? d.noParticipants : d.liveEmpty}
            {mode === "off" && state?.status === "published" && (
              <Link href="/quiz/ranking" className="cta-soft mt-6 !flex !font-sans">
                {d.seeFinal}
              </Link>
            )}
          </Message>
        )}
      </div>

      <footer
        className={`relative z-10 flex items-center justify-between gap-3 ${
          tv ? "px-[5vw] pb-[5.2vh]" : "mx-auto w-full max-w-2xl flex-wrap px-5 pb-[calc(var(--safe-bottom)+2rem)]"
        }`}
      >
        <p className={`flex items-center gap-2 font-medium text-cocoa-500 ${tv ? "text-[1.6vh]" : "text-xs"}`} role="status" data-testid="live-connection" data-online={online}>
          <span aria-hidden="true" className={`inline-block h-[0.65em] w-[0.65em] rounded-full ${online ? "live-dot bg-success" : "bg-danger"}`} />
          {online ? d.connected : d.reconnecting}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {!tv && (
            <Link href="/quiz/ao-vivo?tv=1" prefetch={false} className="btn btn-ghost max-sm:!hidden" data-testid="tv-mode">
              {d.tvMode}
            </Link>
          )}
          <FullscreenButton
            enter={d.fullscreen}
            exit={d.exitFullscreen}
            className={tv ? "rounded-full border border-blush-300 px-[1.2em] py-[0.5em] text-[1.6vh] font-semibold text-cocoa-500 hover:bg-blush-50" : "btn btn-ghost"}
          />
        </div>
      </footer>
      {tv && <Bear size="15vh" id="tv-bear" className="animate-float-soft pointer-events-none absolute right-[5vw] top-[6vh] z-10" />}
      {tv && <Bear size="15vh" id="tv-bear2" className="animate-float-soft pointer-events-none absolute left-[5vw] top-[6vh] z-10" style={{ transform: "scaleX(-1)" }} />}
    </main>
  );
}

function Row({ row, place, state, d, tv, top = false, roomy = false, reveal }: { row: LiveRow; place: number; state: LiveState; d: QuizDict; tv: boolean; top?: boolean; roomy?: boolean; reveal: boolean }) {
  // Sem medalha enquanto a pessoa ainda não pontuou.
  const medal = row.pos <= 3 && row.score !== 0 ? (row.pos as 1 | 2 | 3) : null;
  const skin = !top
    ? "bg-paper/90 border-blush-100"
    : place === 0
      ? "bg-gradient-to-r from-champagne-200/80 to-blush-100 border-champagne-400/60"
      : "bg-gradient-to-r from-blush-100 to-paper border-blush-200";
  const size = tv
    ? top
      ? ["px-[2vw] py-[2.4vh] text-[4.9vh]", "px-[2vw] py-[2vh] text-[4.3vh]", "px-[2vw] py-[1.8vh] text-[4vh]"][place]
      : roomy
        ? "px-[1.6vw] py-[1.4vh] text-[3.7vh]"
        : "px-[1.4vw] py-[0.6vh] text-[2.9vh]"
    : top
      ? "px-4 py-4 text-2xl"
      : "px-4 py-3 text-lg";

  return (
    <li
      data-row={row.id}
      data-testid="live-row"
      data-pos={row.pos}
      className={`relative flex items-center gap-[0.6em] rounded-[0.8em] border shadow-[var(--shadow-soft)] ${skin} ${size} ${reveal ? "podium-in" : state.mystery && place === 0 ? "lead-flash" : ""}`}
      style={reveal ? { animationDelay: `${top ? [3.6, 2.2, 0.9][place] : 0.1}s` } : undefined}
    >
      <span className="flex w-[1.9em] shrink-0 items-center justify-center">
        {medal ? (
          <>
            <Medal pos={medal} size="1.75em" />
            <span className="sr-only">{row.pos}º</span>
          </>
        ) : (
          <span className="tabular text-[0.8em] font-bold text-rose-600">{row.pos}º</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`font-bold leading-tight text-cocoa-900 ${top ? "line-clamp-2 break-words" : "block truncate"}`} data-testid="live-name">
          {row.name}
        </span>
        {(row.answered !== undefined || row.tied) && (
          <span className="mt-[0.15em] flex flex-wrap items-center gap-x-[0.8em] text-[0.5em] font-semibold leading-tight text-cocoa-500 max-sm:text-[0.65em]">
            {row.answered !== undefined && (
              <span className="tabular" data-testid="live-progress">
                {row.answered}/{state.questions} · {row.done ? d.doneLabel : d.answering}
              </span>
            )}
            {row.tied && <span className="text-champagne-700">{d.tied}</span>}
          </span>
        )}
      </span>
      {row.heat !== undefined && (
        <span aria-hidden="true" data-testid="live-heat" className="absolute inset-x-[1em] bottom-[0.18em] h-[0.14em] overflow-hidden rounded-full bg-blush-100">
          <span className="block h-full rounded-full bg-gradient-to-r from-blush-300 to-rose-600 transition-[width] duration-[1600ms] ease-in-out" style={{ width: `${row.heat}%` }} />
        </span>
      )}
      {state.mystery && (
        <span className="shrink-0 font-bold text-rose-600" data-testid="live-secret" aria-hidden="true">
          ???
        </span>
      )}
      {row.score !== undefined && (
        <span className="tabular shrink-0 text-right font-bold text-rose-600" data-testid="live-score">
          {row.score}
          <span className="ml-[0.3em] text-[0.5em] font-semibold text-cocoa-500">{d.points(row.score).replace(/^\d+\s*/, "")}</span>
        </span>
      )}
    </li>
  );
}

/** 3, 2, 1… antes de mostrar a classificação verdadeira. */
function Countdown({ title, tv, onDone }: { title: string; tv: boolean; onDone: () => void }) {
  const [n, setN] = useState(4); // 4 = só o título
  useEffect(() => {
    const id = setTimeout(() => (n > 1 ? setN(n - 1) : onDone()), n === 4 ? 1800 : 1100);
    return () => clearTimeout(id);
  }, [n, onDone]);
  return (
    <div className="m-auto flex flex-col items-center py-10 text-center" data-testid="live-countdown" role="status">
      <p className={`display text-cocoa-900 ${tv ? "text-[6vh]" : "text-3xl"}`}>{title}</p>
      <p key={n} className={`count-pop display lining-nums mt-[2vh] leading-none text-rose-600 ${tv ? "h-[34vh] text-[32vh]" : "h-40 text-[9rem]"}`}>
        {n < 4 ? n : <Bear size={tv ? "28vh" : 140} id="count-bear" className="animate-float-soft" />}
      </p>
    </div>
  );
}

function Message({ children, tv }: { children: ReactNode; tv: boolean }) {
  return (
    <div className="m-auto flex flex-col items-center py-10 text-center" data-testid="live-message">
      <Bear size={tv ? "30vh" : 150} id="live-bear" className="animate-float-soft" />
      <div className={`display mt-6 max-w-[24ch] text-cocoa-700 ${tv ? "text-[4.4vh]" : "text-2xl"}`}>{children}</div>
    </div>
  );
}
