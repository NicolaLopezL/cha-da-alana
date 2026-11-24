"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { quizDict } from "@/lib/quiz/i18n";
import type { PublicQuestion, QuizError, QuizInfo, QuizLang, QuizSession } from "@/lib/quiz/types";
import { IconHeart } from "@/components/invite/Icons";
import { OrnamentFrame, Particles } from "@/components/invite/Ornaments";
import { Bear, HeartRain } from "./Art";
import { LangSwitch, useQuizLang } from "./LangSwitch";
import { clearPending, QuestionFlow } from "./QuestionFlow";

interface State {
  info: QuizInfo | null;
  session: QuizSession | null;
  questions: PublicQuestion[];
}

const POLL_MS = 8000;

/** Já mostramos os parabéns nesta visita? Ao voltar pelo navegador, vale o "você já respondeu". */
let celebrated = false;

async function fetchState(): Promise<State | null> {
  try {
    const res = await fetch("/api/quiz/session", { cache: "no-store" });
    return res.ok ? ((await res.json()) as State) : null;
  } catch {
    return null;
  }
}

export function QuizApp({ initial, initialLang }: { initial: State; initialLang: QuizLang }) {
  const [state, setState] = useState(initial);
  const [lang, setLang] = useQuizLang(initialLang);
  const [notice, setNotice] = useState<QuizError | null>(null);
  const [inRound, setInRound] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [deviceUsed, setDeviceUsed] = useState(false);
  const lastStatus = useRef(initial.session?.status);
  const latest = useRef(0);
  const { info, session, questions } = state;
  const d = quizDict(lang, info?.texts);

  const refresh = useCallback(async () => {
    const turn = ++latest.current;
    const next = await fetchState();
    if (next && turn === latest.current) {
      // A última resposta chegou (inclusive a que tinha ficado guardada no aparelho).
      if (lastStatus.current === "active" && next.session?.status === "done" && !celebrated) {
        celebrated = true;
        setCelebrate(true);
      }
      lastStatus.current = next.session?.status;
      setState(next);
    }
    return next;
  }, []);

  // Voltar pelo navegador pode reabrir uma cópia antiga da página: confere o progresso real no servidor.
  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void refresh();
    };
    window.addEventListener("pageshow", onShow);
    return () => {
      clearTimeout(first);
      window.removeEventListener("pageshow", onShow);
    };
  }, [refresh]);

  const round = session?.round && !session.round.finished ? session.round : null;
  const answering = (session?.status === "active" && session.canAnswer) || (inRound && round !== null);

  // Fora das perguntas, acompanha mudanças (abriu, encerrou, desempate, resultado publicado).
  useEffect(() => {
    if (answering) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [answering, refresh]);

  const onFinished = useCallback(async () => {
    setInRound(false);
    celebrated = true;
    setCelebrate(true);
    // A última resposta já foi confirmada pelo servidor: mostra o agradecimento na hora.
    setState((s) =>
      s.session
        ? {
            ...s,
            session: {
              ...s.session,
              status: "done",
              round: s.session.round ? { ...s.session.round, finished: true } : null,
            },
          }
        : s,
    );
    await refresh();
  }, [refresh]);

  const onFatal = useCallback(
    async (error: QuizError) => {
      setInRound(false);
      if (error !== "finished") setNotice(error);
      await refresh();
    },
    [refresh],
  );

  const restart = async () => {
    try {
      const res = await fetch("/api/quiz/session", { method: "DELETE" });
      if (!res.ok) throw new Error();
      clearPending();
      celebrated = false;
      setCelebrate(false);
      setNotice(null);
      setState((s) => ({ ...s, session: null, questions: [] }));
      await refresh();
    } catch {
      setNotice("unavailable");
    }
  };

  // Muda só quando o servidor traz um progresso diferente do que a tela recebeu ao abrir.
  const flowVersion = session ? Object.keys(session.answers).length : 0;

  let body: ReactNode;
  if (session && inRound && round) {
    body = (
      <QuestionFlow
        key={`${round.id}-${flowVersion}`}
        questions={round.questions}
        initialAnswers={session.answers}
        name={session.name}
        lang={lang}
        d={d}
        onFinished={onFinished}
        onFatal={onFatal}
      />
    );
  } else if (session?.status === "active" && session.canAnswer && questions.length > 0) {
    body = (
      <QuestionFlow
        key={`main-${flowVersion}`}
        questions={questions}
        initialAnswers={session.answers}
        name={session.name}
        lang={lang}
        d={d}
        onFinished={onFinished}
        onFatal={onFatal}
      />
    );
  } else {
    const status = info?.status ?? "draft";
    const links = (
      <div className="mt-8 flex flex-col items-center gap-3">
        {status === "published" && (
          <Link href="/quiz/ranking" className="cta-soft" data-testid="see-final">
            {d.seeFinal}
          </Link>
        )}
        {info?.liveEnabled && status !== "draft" && status !== "published" && (
          <Link href="/quiz/ao-vivo" className="cta-soft" data-testid="see-live">
            {d.seeLive}
          </Link>
        )}
      </div>
    );
    const finalReady = status === "published";
    const liveReady = !!info?.liveEnabled && status !== "draft" && !finalReady;
    const results = (
      <div className="mt-8 flex flex-col items-center gap-4" data-testid="quiz-results">
        {finalReady || liveReady ? (
          <>
            <p className="text-lg font-medium text-cocoa-700">{d.wantResults}</p>
            <Link href={finalReady ? "/quiz/ranking" : "/quiz/ao-vivo"} className="cta-glow" data-testid={finalReady ? "see-final" : "see-live"}>
              <span className="cta-glow-shine" aria-hidden="true" />
              <IconHeart size={20} />
              {finalReady ? d.seeFinal : d.seeLive}
            </Link>
          </>
        ) : (
          <p className="max-w-[36ch] text-sm font-medium text-cocoa-500">{d.resultsSoon}</p>
        )}
      </div>
    );
    if (deviceUsed && !session) {
      body = (
        <Card testId="quiz-already">
          <Bear size={132} id="already-bear" className="animate-float-soft mx-auto" />
          <h1 className="display mt-6 text-[clamp(1.9rem,7vw,2.6rem)] text-cocoa-900">{d.alreadyTitle}</h1>
          <p className="mx-auto mt-4 max-w-[38ch] text-lg leading-relaxed text-cocoa-700">{d.errors.device_used}</p>
          {results}
        </Card>
      );
    } else if (session?.status === "done") {
      const doneRound = session.round?.finished;
      body = (
        <Card testId={celebrate || round || doneRound ? "quiz-thanks" : "quiz-already"}>
          <Bear size={132} id="thanks-bear" className="animate-float-soft mx-auto" />
          {round ? (
            <>
              <h1 className="display mt-5 text-4xl text-cocoa-900">{d.tiebreakTitle}</h1>
              <p className="mt-4 text-lg text-cocoa-700">{d.tiebreakText}</p>
              <button type="button" onClick={() => setInRound(true)} className="cta-glow mt-8" data-testid="tiebreak-start">
                <span className="cta-glow-shine" aria-hidden="true" />
                {d.tiebreakStart}
              </button>
            </>
          ) : (
            <>
              <p className="script mt-4 break-words px-2 text-[clamp(2.6rem,12vw,4rem)] text-rose-600" data-testid="thanks-name">
                {session.name}
              </p>
              <h1 className="display mt-4 text-[clamp(1.9rem,7vw,2.6rem)] text-cocoa-900">{doneRound ? d.tiebreakDone : celebrate ? d.thanksTitle : d.alreadyTitle}</h1>
              {!doneRound && <p className="mx-auto mt-4 max-w-[38ch] text-lg leading-relaxed text-cocoa-700">{celebrate ? d.thanksText : d.alreadyText}</p>}
              {status !== "published" && <p className="mt-5 text-sm font-medium text-cocoa-500">{d.waitingResult}</p>}
              {results}
              {info?.allowSameDevice && status === "open" && (
                <button
                  type="button"
                  onClick={restart}
                  className="mt-6 min-h-11 px-3 text-sm text-cocoa-500 underline decoration-champagne-400/60 underline-offset-4"
                  data-testid="answer-for-other"
                >
                  {d.answerForOther}
                </button>
              )}
            </>
          )}
        </Card>
      );
    } else if (session?.status === "invalid") {
      body = (
        <Card testId="quiz-invalid">
          <Bear size={110} id="invalid-bear" className="mx-auto" />
          <p className="mx-auto mt-6 max-w-[36ch] text-lg text-cocoa-700">{d.invalidated}</p>
          {status === "open" && (
            <button type="button" onClick={restart} className="btn btn-primary mt-8">
              {d.invalidRestart}
            </button>
          )}
        </Card>
      );
    } else if (session || status === "closed" || status === "published") {
      body = (
        <Card testId="quiz-ended">
          <Bear size={120} id="ended-bear" className="mx-auto" />
          <h1 className="display mt-6 text-[clamp(1.9rem,7vw,2.6rem)] text-cocoa-900">{d.ended}</h1>
          {session && <p className="mt-4 text-cocoa-500">{d.endedIncomplete}</p>}
          {links}
        </Card>
      );
    } else if (status === "open") {
      body = <Welcome info={info!} lang={lang} onStarted={refresh} onDeviceUsed={() => setDeviceUsed(true)} />;
    } else {
      body = (
        <Card testId="quiz-not-open">
          <p className="eyebrow mb-4">{d.brand}</p>
          <Bear size={140} id="wait-bear" className="animate-float-soft mx-auto" />
          <h1 className="display mt-6 text-[clamp(2rem,8vw,2.9rem)] text-cocoa-900">{d.title}</h1>
          <p className="mx-auto mt-5 max-w-[34ch] text-lg leading-relaxed text-cocoa-700">{d.notOpen}</p>
        </Card>
      );
    }
  }

  return (
    <main lang={lang === "pt" ? "pt-BR" : "es-CO"} className="paper-ivory relative flex min-h-dvh flex-col overflow-x-clip" data-testid="quiz-app">
      {!answering && <OrnamentFrame className="!fixed max-sm:hidden" />}
      {!answering && <Particles count={6} />}
      {celebrate && session?.status === "done" && <HeartRain />}
      <header className="relative z-10 mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-5 pt-[calc(var(--safe-top)+1.25rem)] sm:pt-11">
        <Link href="/" prefetch={false} className="script px-1 text-4xl text-rose-600" aria-label={d.backToInvite}>
          Alana
        </Link>
        <LangSwitch lang={lang} onChange={setLang} label={d.language} />
      </header>
      <div className="relative z-10 flex flex-1 flex-col px-5 pb-[calc(var(--safe-bottom)+1.5rem)] pt-4 sm:pb-12">
        {notice && (
          <p role="alert" className="mx-auto mb-4 w-full max-w-xl rounded-2xl bg-blush-100 px-4 py-3 text-center text-sm font-medium text-cocoa-900">
            {d.errors[notice]}
          </p>
        )}
        {body}
      </div>
    </main>
  );
}

function Card({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <div className="quiz-in mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-8 text-center" data-testid={testId}>
      {children}
    </div>
  );
}

interface WelcomeProps {
  info: QuizInfo;
  lang: QuizLang;
  onStarted: () => Promise<State | null>;
  onDeviceUsed: () => void;
}

function Welcome({ info, lang, onStarted, onDeviceUsed }: WelcomeProps) {
  const d = quizDict(lang, info.texts);
  const [error, setError] = useState<QuizError | null>(null);
  const [busy, setBusy] = useState(false);
  // Campo não controlado: o que for digitado antes de a página terminar de carregar não se perde.
  const input = useRef<HTMLInputElement>(null);
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  // Mesma chave em todas as tentativas: se a resposta se perder na rede, não cria outra participação.
  const startKey = useRef("");

  const start = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const name = input.current?.value ?? "";
    if (name.trim().length < 2) {
      setError("name_required");
      input.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    startKey.current ||= newKey();
    try {
      const res = await fetch("/api/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, lang, startKey: startKey.current }),
      });
      const data = (await res.json()) as { ok?: true; error?: QuizError };
      if (data.ok) {
        clearPending();
        const next = await onStarted();
        if (next?.session) return;
        setError("unavailable");
      } else {
        if (data.error === "device_used") return onDeviceUsed();
        setError(data.error ?? "unavailable");
        if (data.error === "name_taken" || data.error === "name_required") input.current?.focus();
        if (data.error === "not_open") await onStarted();
      }
    } catch {
      setError("unavailable");
    }
    setBusy(false);
  };

  return (
    <div className="quiz-in mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-2 text-center" data-testid="quiz-welcome">
      <p className="eyebrow mb-2">{d.brand}</p>
      <Bear size="clamp(72px, 15dvh, 128px)" id="welcome-bear" className="animate-float-soft mx-auto" />
      <h1 className="display mt-3 text-[clamp(2.1rem,8.4vw,3rem)] text-cocoa-900">{d.title}</h1>
      <p className="mx-auto mt-3 max-w-[46ch] text-[1.02rem] leading-relaxed text-cocoa-700">{d.intro}</p>
      <p className="mt-2 text-sm font-semibold text-champagne-700" data-testid="question-count">
        {d.questionsCount(info.questions)}
      </p>

      <form onSubmit={start} noValidate className="paper mx-auto mt-4 w-full max-w-md rounded-[28px] p-5 sm:p-6 text-left shadow-[var(--shadow-paper)]">
        <label htmlFor="quiz-name" className="field-label !text-base">
          {d.nameLabel}
        </label>
        <input
          ref={input}
          id="quiz-name"
          name="name"
          maxLength={40}
          required
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="go"
          placeholder={d.namePlaceholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "quiz-name-error" : undefined}
          className="field !min-h-[56px] !text-lg"
        />
        {error && (
          <p id="quiz-name-error" role="alert" className="mt-2 text-sm font-medium text-danger">
            {d.errors[error]}
          </p>
        )}
        <button type="submit" disabled={busy || !hydrated} className="cta-glow mt-5 w-full disabled:opacity-70" data-testid="quiz-start">
          <span className="cta-glow-shine" aria-hidden="true" />
          <IconHeart size={20} />
          {busy ? d.starting : d.start}
        </button>
        <p className="mt-4 text-center text-sm text-cocoa-500">
          {d.howTo}
          {info.tiebreakMode === "time" && ` ${d.tieHint}`}
        </p>
      </form>
    </div>
  );
}

const noSubscribe = () => () => undefined;

/** crypto.randomUUID não existe em páginas http comuns; getRandomValues existe sempre. */
function newKey() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
