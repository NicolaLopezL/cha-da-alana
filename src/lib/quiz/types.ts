export type QuizLang = "pt" | "es";
export type QuizStatus = "draft" | "open" | "closed" | "published";
export type TiebreakMode = "time" | "extra" | "shared";
export type ClosePolicy = "block" | "finish";

/** Pergunta como o convidado recebe: nunca inclui o gabarito nem a pontuação. */
export interface PublicQuestion {
  id: string;
  pt: string;
  es: string;
  options: { id: string; pt: string; es: string }[];
}

export interface QuizInfo {
  status: QuizStatus;
  tiebreakMode: TiebreakMode;
  allowSameDevice: boolean;
  texts: QuizTextOverrides;
  questions: number;
  maxScore: number;
  liveEnabled: boolean;
}

export interface QuizSession {
  name: string;
  lang: QuizLang;
  status: "active" | "done" | "invalid";
  quizStatus: QuizStatus;
  canAnswer: boolean;
  answers: Record<string, string>;
  round: { id: string; number: number; finished: boolean; questions: PublicQuestion[] } | null;
}

export type QuizError =
  | "not_open"
  | "closed"
  | "finished"
  | "invalid"
  | "no_session"
  | "bad_question"
  | "name_required"
  | "name_taken"
  | "device_used"
  | "rate_limited"
  | "unavailable"
  | "retry";

export type AnswerResult = { ok: true; answered: number; total: number; finished: boolean } | { error: QuizError };

export interface LiveRow {
  id: string;
  name: string;
  pos: number;
  tied: boolean;
  done: boolean;
  score?: number;
  answered?: number;
}

export interface LiveState {
  mode: "off" | "waiting" | "hidden" | "ranking" | "final";
  status: QuizStatus;
  showScores: boolean;
  showProgress: boolean;
  top10: boolean;
  participants: number;
  done: number;
  questions: number;
  maxScore: number;
  tie: boolean;
  /** Rodada de desempate em andamento. */
  round: boolean;
  rows: LiveRow[];
}

export interface FinalRow {
  id: string;
  name: string;
  pos: number;
  tied: boolean;
  score: number;
  durationMs: number | null;
}

export type FinalState =
  | { published: false; status: QuizStatus }
  | {
      published: true;
      status: QuizStatus;
      maxScore: number;
      questions: number;
      tiebreakMode: TiebreakMode;
      participants: number;
      rows: FinalRow[];
    };

/* ---------- Painel ---------- */

export interface AdminQuestion extends PublicQuestion {
  round: "main" | "extra";
  active: boolean;
  points: number;
  key: string | null;
  used: boolean;
}

export interface AdminRankRow {
  id: string;
  name: string;
  pos: number;
  tied: boolean;
  status: "active" | "done";
  score: number;
  answered: number;
  durationMs: number | null;
}

export interface AdminRound {
  id: string;
  number: number;
  status: "open" | "closed";
  questions: number;
  members: { id: string; name: string; score: number; answered: number; finished: boolean }[];
}

export interface AdminQuizState {
  status: QuizStatus;
  tiebreakMode: TiebreakMode;
  closePolicy: ClosePolicy;
  defaultPoints: number;
  allowSameDevice: boolean;
  texts: QuizTextOverrides;
  live: { enabled: boolean; showScores: boolean; showProgress: boolean; top10: boolean; hidden: boolean };
  openedAt: string | null;
  closedAt: string | null;
  publishedAt: string | null;
  questions: number;
  maxScore: number;
  missingKey: number;
  missingEs: number;
  stats: { total: number; active: number; done: number; invalid: number; answers: number; avgScore: number | null };
  ranking: AdminRankRow[];
  rounds: AdminRound[];
}

export interface AdminParticipant {
  id: string;
  name: string;
  lang: QuizLang;
  status: "active" | "done" | "invalid";
  reason: string;
  startedAt: string;
  finishedAt: string | null;
  lastAt: string;
  answered: number;
  score: number;
  correct: number;
  durationMs: number | null;
  sameDevice: boolean;
  similarName: boolean;
}

export interface AdminAnswer {
  participantId: string;
  questionId: string;
  optionId: string;
  at: string;
  question: string;
  round: "main" | "extra";
  option: string;
  points: number;
  correct: boolean;
  correctOption: string | null;
}

/* ---------- Textos editáveis (PT/ES) ---------- */

export const TEXT_KEYS = ["title", "intro", "notOpen", "thanksTitle", "thanksText", "ended"] as const;
export type QuizTextKey = (typeof TEXT_KEYS)[number];
export type QuizTextOverrides = Partial<Record<`${QuizTextKey}_${QuizLang}`, string>>;
