"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cleanName, quizNameKey } from "@/lib/quiz/name";
import { TEXT_KEYS, type QuizTextOverrides } from "@/lib/quiz/types";
import { requireAdmin } from "@/lib/server/auth";
import { QuizDbError, quizRpc } from "@/lib/server/quiz/db";
import { assertSameOrigin } from "@/lib/server/security";
import { getStore } from "@/lib/server/store";

export type QuizActionResult = { ok: boolean; message: string };

const ERRORS: Record<string, string> = {
  locked: "Isso só pode ser mudado antes de abrir o quiz (protege as respostas já recebidas).",
  bad_transition: "Esta ação não é permitida na situação atual do quiz.",
  no_questions: "Ative pelo menos uma pergunta antes de abrir.",
  missing_key: "Defina a resposta correta de todas as perguntas ativas antes de abrir.",
  has_rounds: "O desempate já começou, por isso o quiz não pode ser reaberto.",
  round_open: "Há uma rodada de desempate em andamento. Encerre-a primeiro.",
  bad_options: "Cada pergunta precisa de 2 a 8 alternativas.",
  too_many: "Limite de 200 perguntas atingido.",
  not_found: "Item não encontrado. Atualize a página.",
  name_taken: "Já existe uma participação válida com esse nome.",
  not_tied: "A rodada precisa incluir todos os empatados da mesma posição.",
  bad_question: "Escolha perguntas extras ativas, com resposta correta definida e ainda não usadas.",
};

const ok = (message: string): QuizActionResult => ({ ok: true, message });
const fail = (message: string): QuizActionResult => ({ ok: false, message });

interface Audit {
  action: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}

/** Verifica o administrador, executa a função SQL, registra no histórico e atualiza o painel. */
async function run(fn: string, args: Record<string, unknown>, success: string | ((r: Record<string, unknown>) => string), audit: Audit | null): Promise<QuizActionResult> {
  await assertSameOrigin();
  const admin = await requireAdmin();
  let res: Record<string, unknown>;
  try {
    res = (await quizRpc()(fn, args)) as Record<string, unknown>;
  } catch (e) {
    if (e instanceof QuizDbError && e.code === "locked") return fail(ERRORS.locked);
    if (e instanceof QuizDbError && e.code === "not_installed") return fail("As tabelas do quiz ainda não foram criadas no banco.");
    console.error(`[quiz/${fn}]`, e);
    return fail("Não foi possível concluir. Tente de novo.");
  }
  if (typeof res?.error === "string") return fail(ERRORS[res.error] ?? "Não foi possível concluir.");
  if (audit) {
    await getStore()
      .addAudit({ actor: admin.name, action: audit.action, entity: "quiz", entityId: audit.entityId ?? null, details: audit.details ?? {} })
      .catch((e) => console.error("[quiz/audit]", e));
  }
  revalidatePath("/admin/quiz", "layout");
  return ok(typeof success === "function" ? success(res) : success);
}

const uuid = z.string().uuid();

/* ---------- Controle do quiz ---------- */

const STATUS_MSG = {
  open: "Quiz aberto! Os convidados já podem participar.",
  closed: "Pronto: o quiz está encerrado e os resultados ocultos.",
  published: "Resultados publicados! O ranking final está no ar.",
} as const;

export async function setQuizStatusAction(to: keyof typeof STATUS_MSG): Promise<QuizActionResult> {
  if (!(to in STATUS_MSG)) return fail("Situação inválida.");
  return run("quiz_set_status", { p_to: to }, STATUS_MSG[to], { action: `quiz.${to}` });
}

const configSchema = z
  .object({
    tiebreakMode: z.enum(["time", "extra", "shared"]),
    closePolicy: z.enum(["block", "finish"]),
    defaultPoints: z.number().int().min(1).max(100),
    allowSameDevice: z.boolean(),
    liveEnabled: z.boolean(),
    liveShowScores: z.boolean(),
    liveShowProgress: z.boolean(),
    liveTop10: z.boolean(),
    liveHidden: z.boolean(),
  })
  .partial()
  .strict();

export async function saveQuizConfigAction(patch: z.input<typeof configSchema>): Promise<QuizActionResult> {
  const parsed = configSchema.safeParse(patch);
  if (!parsed.success) return fail("Valor inválido.");
  return run("quiz_save_config", { p: parsed.data }, "Configuração salva.", { action: "quiz.config", details: { config: parsed.data } });
}

export async function saveQuizTextsAction(texts: Record<string, string>): Promise<QuizActionResult> {
  const clean: QuizTextOverrides = {};
  for (const key of TEXT_KEYS) {
    for (const lang of ["pt", "es"] as const) {
      const v = String(texts[`${key}_${lang}`] ?? "").trim().slice(0, 400);
      if (v) clean[`${key}_${lang}`] = v;
    }
  }
  return run("quiz_save_config", { p: { texts: clean } }, "Textos salvos.", { action: "quiz.texts" });
}

export async function resetQuizAction(confirmation: string): Promise<QuizActionResult> {
  if (confirmation.trim().toUpperCase() !== "ZERAR") return fail("Digite ZERAR para confirmar.");
  return run("quiz_reset", {}, (r) => `Participações apagadas (${r.removed}). O quiz voltou para rascunho.`, { action: "quiz.reset" });
}

/* ---------- Perguntas ---------- */

const questionSchema = z.object({
  id: uuid.optional(),
  round: z.enum(["main", "extra"]),
  active: z.boolean(),
  points: z.number().int("Use pontos inteiros.").min(1, "Mínimo de 1 ponto.").max(100, "Máximo de 100 pontos."),
  pt: z.string().trim().min(1, "Escreva a pergunta em português.").max(300, "Pergunta muito longa."),
  es: z.string().trim().max(300, "Tradução muito longa."),
  options: z
    .array(
      z.object({
        id: uuid.optional(),
        pt: z.string().trim().min(1, "Preencha todas as alternativas em português.").max(120, "Alternativa muito longa."),
        es: z.string().trim().max(120, "Tradução muito longa."),
      }),
    )
    .min(2, "Cada pergunta precisa de pelo menos 2 alternativas.")
    .max(8, "Máximo de 8 alternativas."),
  correct: z.number().int().min(0).max(7).nullable(),
});

export type QuestionPayload = z.input<typeof questionSchema>;

export async function saveQuestionAction(payload: QuestionPayload): Promise<QuizActionResult> {
  const parsed = questionSchema.safeParse(payload);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Verifique os campos.");
  const q = parsed.data;
  const names = q.options.map((o) => quizNameKey(o.pt));
  if (new Set(names).size !== names.length) return fail("Há alternativas repetidas.");
  if (q.correct !== null && q.correct >= q.options.length) return fail("Escolha uma alternativa correta válida.");
  return run("quiz_save_question", { p: q }, q.id ? "Pergunta salva." : "Pergunta adicionada.", {
    action: q.id ? "quiz.question.update" : "quiz.question.create",
    entityId: q.id,
    details: { name: q.pt },
  });
}

export async function setKeyAction(questionId: string, optionId: string, label: string): Promise<QuizActionResult> {
  if (!uuid.safeParse(questionId).success || !uuid.safeParse(optionId).success) return fail(ERRORS.not_found);
  return run("quiz_set_key", { p_question: questionId, p_option: optionId }, "Resposta correta salva.", {
    action: "quiz.key",
    entityId: questionId,
    details: { name: String(label).slice(0, 120) },
  });
}

export async function questionOpAction(op: "activate" | "deactivate" | "delete" | "duplicate" | "up" | "down", id: string, label: string): Promise<QuizActionResult> {
  if (!uuid.safeParse(id).success) return fail(ERRORS.not_found);
  const details = { name: String(label).slice(0, 120) };
  switch (op) {
    case "activate":
    case "deactivate":
      return run("quiz_set_active", { p_question: id, p_active: op === "activate" }, op === "activate" ? "Pergunta ativada." : "Pergunta desativada.", { action: `quiz.question.${op}`, entityId: id, details });
    case "delete":
      return run("quiz_delete_question", { p_question: id }, "Pergunta excluída.", { action: "quiz.question.delete", entityId: id, details });
    case "duplicate":
      return run("quiz_duplicate_question", { p_question: id }, "Pergunta duplicada (no fim da lista).", { action: "quiz.question.duplicate", entityId: id, details });
    case "up":
    case "down":
      return run("quiz_move_question", { p_question: id, p_delta: op === "up" ? -1 : 1 }, "Ordem atualizada.", null);
    default:
      return fail("Ação inválida.");
  }
}

/* ---------- Participantes ---------- */

export async function participantAction(op: "invalidate" | "restore" | "rename", id: string, text: string): Promise<QuizActionResult> {
  if (!uuid.safeParse(id).success) return fail(ERRORS.not_found);
  const base = { p_id: id, p_name: null as string | null, p_name_key: null as string | null, p_status: null as string | null, p_reason: null as string | null };
  if (op === "rename") {
    const name = cleanName(text);
    if (!name) return fail("Informe um nome válido (2 a 40 letras).");
    return run("quiz_update_participant", { ...base, p_name: name, p_name_key: quizNameKey(name) }, "Nome atualizado.", { action: "quiz.participant.rename", entityId: id, details: { name } });
  }
  if (op === "invalidate") {
    return run("quiz_update_participant", { ...base, p_status: "invalid", p_reason: String(text ?? "").slice(0, 200) }, "Participação invalidada.", { action: "quiz.participant.invalidate", entityId: id });
  }
  return run("quiz_update_participant", { ...base, p_status: "valid" }, "Participação restaurada.", { action: "quiz.participant.restore", entityId: id });
}

/* ---------- Desempate ---------- */

export async function startRoundAction(participants: string[], questions: string[]): Promise<QuizActionResult> {
  const list = z.array(uuid).max(200);
  if (!list.safeParse(participants).success || !list.safeParse(questions).success) return fail(ERRORS.not_found);
  if (questions.length === 0) return fail("Escolha pelo menos uma pergunta extra.");
  return run("quiz_round_start", { p_participants: participants, p_questions: questions }, (r) => `Rodada ${r.number} iniciada. Os empatados já veem as perguntas no celular.`, {
    action: "quiz.round.start",
    details: { participants: participants.length, questions: questions.length },
  });
}

export async function closeRoundAction(id: string): Promise<QuizActionResult> {
  if (!uuid.safeParse(id).success) return fail(ERRORS.not_found);
  return run("quiz_round_close", { p_round: id }, "Rodada encerrada. A classificação foi atualizada.", { action: "quiz.round.close", entityId: id });
}
