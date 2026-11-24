import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import type { QuizRpc } from "@/lib/server/quiz/db";
import { LOCAL_ROLES_SQL, rpcOver } from "@/lib/server/quiz/local-db";
import type { AdminParticipant, AdminQuestion, AdminQuizState, LiveState, PublicQuestion, QuizSession } from "@/lib/quiz/types";

/** Regras do quiz testadas direto na migração SQL real (Postgres embutido). */
const migration = ["20261123000000_quiz.sql", "20261124000000_quiz_misterioso.sql"]
  .map((f) => readFileSync(path.resolve("supabase/migrations", f), "utf8"))
  .join("\n");

let db: PGlite;
let rpc: QuizRpc;
const R = (x: unknown) => x as Record<string, unknown>;

async function questions() {
  return (await rpc("quiz_admin_questions", { p_round: "main" })) as AdminQuestion[];
}
/** Deixa só `n` perguntas ativas, todas com gabarito na 1ª alternativa. */
async function setup(n: number, config: Record<string, unknown> = {}, open = true) {
  const qs = await questions();
  for (const [i, q] of qs.entries()) {
    if (i >= n) await rpc("quiz_set_active", { p_question: q.id, p_active: false });
    else await rpc("quiz_set_key", { p_question: q.id, p_option: q.options[0].id });
  }
  await rpc("quiz_save_config", { p: config });
  if (open) expect(await rpc("quiz_set_status", { p_to: "open" })).toMatchObject({ ok: true });
  return ((await rpc("quiz_public_questions")) as PublicQuestion[]).slice(0, n);
}
async function start(name: string, device = name) {
  return rpc("quiz_start", {
    p_name: name,
    p_name_key: name.toLowerCase(),
    p_lang: "pt",
    p_token_hash: `t-${name}`,
    p_device_hash: device,
    p_start_key: `k-${name}`,
  });
}
const answer = (name: string, q: PublicQuestion, opt: number) =>
  rpc("quiz_answer", { p_token_hash: `t-${name}`, p_question: q.id, p_option: q.options[opt].id });
async function play(name: string, qs: PublicQuestion[], correct: number) {
  await start(name);
  for (const [i, q] of qs.entries()) await answer(name, q, i < correct ? 0 : 1);
}
const state = async () => (await rpc("quiz_admin_state")) as AdminQuizState;
const live = async () => (await rpc("quiz_live")) as LiveState;
const setDuration = (name: string, ms: number) => db.query("update public.quiz_participants set duration_ms = $2 where name = $1", [name, ms]);

beforeEach(async () => {
  db = new PGlite();
  await db.exec(LOCAL_ROLES_SQL);
  await db.exec("grant usage on schema public to anon, authenticated, service_role;");
  await db.exec(migration);
  rpc = rpcOver(db);
});

describe("modo misterioso", () => {
  it("liga e desliga sem mudar classificação nem pontuação; só o servidor executa", async () => {
    const qs = await setup(3, { liveEnabled: true });
    await play("Ana", qs, 3);
    await play("Bia", qs, 1);
    const before = [await live(), (await state()).ranking];
    expect(await rpc("quiz_mystery")).toBe(false);
    await rpc("quiz_set_mystery", { p_on: true });
    expect(await rpc("quiz_mystery")).toBe(true);
    expect([await live(), (await state()).ranking]).toEqual(before);
    await rpc("quiz_set_mystery", { p_on: false });
    expect(await rpc("quiz_mystery")).toBe(false);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await expect(db.query("select public.quiz_mystery()")).rejects.toThrow(/permission denied/);
      await expect(db.query("select public.quiz_set_mystery(true)")).rejects.toThrow(/permission denied/);
      await db.exec("reset role");
    }
  });
});

describe("migração do quiz", () => {
  it("cadastra 20 perguntas com 3 alternativas, em PT e ES, sem gabarito; pode rodar de novo", async () => {
    await db.exec(migration);
    const qs = await questions();
    expect(qs).toHaveLength(20);
    expect(qs.every((q) => q.key === null && q.es && q.options.length === 3)).toBe(true);
    expect(qs[0].options.map((o) => o.pt)).toEqual(["Nicola", "Yasmin", "Os dois"]);
    expect(qs[0].options.map((o) => o.es)).toEqual(["Nicola", "Yasmin", "Los dos"]);
    expect(await state()).toMatchObject({ status: "draft", questions: 20, maxScore: 20, missingKey: 20, missingEs: 0 });
  });

  it("anon e authenticated não leem tabelas nem executam funções; service_role sim", async () => {
    for (const role of ["anon", "authenticated"]) {
      for (const sql of [
        "select * from public.quiz_answer_key",
        "select * from public.quiz_participants",
        "select public.quiz_admin_state()",
        "select public.quiz_live()",
        "select public.quiz_answer('x', gen_random_uuid(), gen_random_uuid())",
      ]) {
        await db.exec(`set role ${role}`);
        await expect(db.query(sql)).rejects.toThrow(/permission denied/);
        await db.exec("reset role");
      }
    }
    await db.exec("set role service_role");
    expect((await db.query("select public.quiz_info()")).rows).toHaveLength(1);
    expect((await db.query("select public.quiz_admin_state()")).rows).toHaveLength(1);
    await db.exec("reset role");
    const off = await db.query("select relname from pg_class where relname like 'quiz\\_%' and relkind = 'r' and not relrowsecurity");
    expect(off.rows).toHaveLength(0);
  });
});

describe("perguntas", () => {
  it("cria, edita, duplica, reordena, ativa/desativa e exclui, com totais dinâmicos", async () => {
    const saved = R(
      await rpc("quiz_save_question", {
        p: {
          round: "main",
          active: true,
          points: 5,
          pt: "Quem canta melhor?",
          es: "¿Quién canta mejor?",
          correct: 1,
          options: [
            { pt: "Nicola", es: "" },
            { pt: "Yasmin", es: "" },
          ],
        },
      }),
    );
    expect(saved.ok).toBe(true);
    expect(await state()).toMatchObject({ questions: 21, maxScore: 25, missingKey: 20, missingEs: 1 });
    let q = (await questions()).find((x) => x.id === saved.id)!;
    expect(q.key).toBe(q.options[1].id);

    // editar: troca textos, remove uma alternativa, adiciona outra e muda o gabarito
    await rpc("quiz_save_question", {
      p: {
        id: q.id,
        active: true,
        points: 2,
        pt: "Quem dança melhor?",
        es: "x",
        correct: 0,
        options: [
          { id: q.options[0].id, pt: "Papai", es: "Papá" },
          { pt: "Os dois", es: "Los dos" },
        ],
      },
    });
    q = (await questions()).find((x) => x.id === saved.id)!;
    expect(q.options.map((o) => o.pt)).toEqual(["Papai", "Os dois"]);
    expect(q.key).toBe(q.options[0].id);

    const dup = R(await rpc("quiz_duplicate_question", { p_question: q.id }));
    const copy = (await questions()).find((x) => x.id === dup.id)!;
    expect(copy.pt).toBe("Quem dança melhor? (cópia)");
    expect(copy.key).toBe(copy.options[0].id);

    await rpc("quiz_move_question", { p_question: copy.id, p_delta: -21 });
    expect((await questions())[0].id).toBe(copy.id);
    await rpc("quiz_move_question", { p_question: copy.id, p_delta: 2 });
    expect((await questions())[2].id).toBe(copy.id);

    await rpc("quiz_set_active", { p_question: copy.id, p_active: false });
    expect((await state()).questions).toBe(21);
    await rpc("quiz_delete_question", { p_question: copy.id });
    expect(await questions()).toHaveLength(21);
    expect(
      await rpc("quiz_save_question", { p: { round: "main", active: true, points: 1, pt: "X?", es: "", correct: null, options: [{ pt: "A" }] } }),
    ).toEqual({ error: "bad_options" });
  });

  it("não abre sem gabarito completo nem sem perguntas", async () => {
    expect(await rpc("quiz_set_status", { p_to: "open" })).toEqual({ error: "missing_key" });
    for (const q of await questions()) await rpc("quiz_set_active", { p_question: q.id, p_active: false });
    expect(await rpc("quiz_set_status", { p_to: "open" })).toEqual({ error: "no_questions" });
  });

  it("depois da abertura bloqueia mudanças que invalidam respostas, mas permite traduzir", async () => {
    await setup(2);
    const q = (await questions())[0];
    const base = { id: q.id, active: true, points: 1, pt: q.pt, es: q.es, correct: 0, options: q.options };
    const fresh = { round: "main", active: true, points: 1, pt: "Nova?", es: "", correct: 0, options: [{ pt: "A" }, { pt: "B" }] };
    for (const call of [
      () => rpc("quiz_save_question", { p: { ...base, pt: "Outra pergunta" } }),
      () => rpc("quiz_save_question", { p: { ...base, points: 9 } }),
      () => rpc("quiz_save_question", { p: { ...base, correct: 1 } }),
      () => rpc("quiz_save_question", { p: { ...base, options: q.options.slice(0, 2) } }),
      () => rpc("quiz_save_question", { p: { ...base, options: [...q.options, { pt: "Nova" }] } }),
      () => rpc("quiz_set_active", { p_question: q.id, p_active: false }),
      () => rpc("quiz_delete_question", { p_question: q.id }),
      () => rpc("quiz_duplicate_question", { p_question: q.id }),
      () => rpc("quiz_move_question", { p_question: q.id, p_delta: 1 }),
      () => rpc("quiz_set_key", { p_question: q.id, p_option: q.options[1].id }),
      () => rpc("quiz_save_question", { p: fresh }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: "locked" });
    }
    expect(await rpc("quiz_save_question", { p: { ...base, es: "¿Traducción nueva?" } })).toMatchObject({ ok: true });
    expect((await questions())[0].es).toBe("¿Traducción nueva?");
    expect(await rpc("quiz_save_config", { p: { tiebreakMode: "shared" } })).toEqual({ error: "locked" });
  });

  it("gabarito corrigido depois de encerrar recalcula todas as pontuações", async () => {
    const qs = await setup(2);
    await play("Ana", qs, 2);
    await rpc("quiz_set_status", { p_to: "closed" });
    await rpc("quiz_set_key", { p_question: qs[0].id, p_option: qs[0].options[1].id });
    expect((await state()).ranking[0]).toMatchObject({ name: "Ana", score: 1 });
  });
});

describe("participação", () => {
  it("só começa com o quiz aberto; nome repetido e pedido repetido são tratados", async () => {
    await setup(2, {}, false);
    expect(await start("Ana")).toEqual({ error: "not_open" });
    await rpc("quiz_set_status", { p_to: "open" });
    const first = R(await start("Ana"));
    expect(first.ok).toBe(true);
    expect(R(await start("Ana")).id).toBe(first.id); // mesma start_key: mesma participação
    expect(
      await rpc("quiz_start", { p_name: "ANA", p_name_key: "ana", p_lang: "pt", p_token_hash: "t2", p_device_hash: "d2", p_start_key: "k2" }),
    ).toEqual({ error: "name_taken" });
    expect((await state()).stats.total).toBe(1);
  });

  it("limita a uma participação por aparelho quando configurado", async () => {
    await setup(1, { allowSameDevice: false });
    await start("Ana", "aparelho");
    expect(await start("Bia", "aparelho")).toEqual({ error: "device_used" });
    expect(R(await start("Caio", "outro")).ok).toBe(true);
  });

  it("salva, corrige, finaliza uma única vez e calcula no servidor", async () => {
    const qs = await setup(3);
    await start("Ana");
    expect(await answer("Ana", qs[0], 1)).toMatchObject({ ok: true, answered: 1, total: 3, finished: false });
    expect((await state()).ranking[0].score).toBe(0);
    expect(await answer("Ana", qs[0], 0)).toMatchObject({ answered: 1 }); // corrige
    expect((await state()).ranking[0].score).toBe(1);
    expect(await answer("Ana", qs[0], 0)).toMatchObject({ ok: true, answered: 1 }); // reenvio idempotente
    await answer("Ana", qs[1], 0);
    expect(await answer("Ana", qs[2], 2)).toMatchObject({ answered: 3, finished: true });
    const before = (await db.query("select finished_at, duration_ms from public.quiz_participants")).rows[0];
    expect(await answer("Ana", qs[2], 2)).toMatchObject({ ok: true, finished: true }); // reenvio da última
    expect(await answer("Ana", qs[0], 1)).toEqual({ error: "finished" }); // não altera depois
    expect((await db.query("select finished_at, duration_ms from public.quiz_participants")).rows[0]).toEqual(before);
    expect((await state()).ranking[0]).toMatchObject({ score: 2, status: "done" });
  });

  it("recusa sessão, pergunta e alternativa inválidas", async () => {
    const qs = await setup(2);
    await start("Ana");
    expect(await rpc("quiz_answer", { p_token_hash: "nao-existe", p_question: qs[0].id, p_option: qs[0].options[0].id })).toEqual({ error: "no_session" });
    expect(await rpc("quiz_answer", { p_token_hash: "t-Ana", p_question: qs[0].id, p_option: qs[1].options[0].id })).toEqual({ error: "bad_question" });
    const inactive = (await questions())[5];
    expect(await rpc("quiz_answer", { p_token_hash: "t-Ana", p_question: inactive.id, p_option: inactive.options[0].id })).toEqual({
      error: "bad_question",
    });
  });

  it("retoma a sessão com as respostas já salvas", async () => {
    const qs = await setup(3);
    await start("Ana");
    await answer("Ana", qs[0], 2);
    const s = (await rpc("quiz_session", { p_token_hash: "t-Ana" })) as QuizSession;
    expect(s).toMatchObject({ name: "Ana", status: "active", canAnswer: true, round: null, answers: { [qs[0].id]: qs[0].options[2].id } });
    expect(await rpc("quiz_session", { p_token_hash: "x" })).toBeNull();
  });

  it("encerramento: bloqueia na hora ou deixa terminar, conforme a política", async () => {
    const qs = await setup(2);
    await start("Ana");
    await answer("Ana", qs[0], 0);
    await rpc("quiz_set_status", { p_to: "closed" });
    expect(await answer("Ana", qs[1], 0)).toEqual({ error: "closed" });
    await rpc("quiz_save_config", { p: { closePolicy: "finish" } });
    expect(await start("Bia")).toEqual({ error: "not_open" });
    expect(await answer("Ana", qs[1], 0)).toMatchObject({ finished: true });
  });

  it("participação invalidada não responde, sai do ranking e libera o nome", async () => {
    const qs = await setup(2);
    await play("Ana", qs, 2);
    const id = ((await rpc("quiz_admin_participants")) as AdminParticipant[])[0].id;
    await rpc("quiz_update_participant", { p_id: id, p_name: null, p_name_key: null, p_status: "invalid", p_reason: "teste" });
    expect((await state()).ranking).toHaveLength(0);
    expect(await answer("Ana", qs[0], 0)).toEqual({ error: "invalid" });
    expect(
      await rpc("quiz_start", { p_name: "Ana", p_name_key: "ana", p_lang: "es", p_token_hash: "n", p_device_hash: "n", p_start_key: "n" }),
    ).toMatchObject({ ok: true });
    // com o nome já reocupado, não dá para revalidar a antiga
    expect(await rpc("quiz_update_participant", { p_id: id, p_name: null, p_name_key: null, p_status: "valid", p_reason: null })).toEqual({
      error: "name_taken",
    });
  });

  it("sinaliza possíveis duplicidades (mesmo aparelho, nome parecido)", async () => {
    await setup(1);
    await start("Ana Souza", "x");
    await start("Ana Lima", "x");
    await start("Caio", "y");
    const list = (await rpc("quiz_admin_participants")) as AdminParticipant[];
    const by = (n: string) => list.find((p) => p.name === n)!;
    expect(by("Ana Souza")).toMatchObject({ sameDevice: true, similarName: true });
    expect(by("Caio")).toMatchObject({ sameDevice: false, similarName: false });
  });
});

describe("segurança do gabarito", () => {
  it("nenhuma função pública devolve gabarito nem acerto", async () => {
    const qs = await setup(2, { liveEnabled: true });
    await start("Ana");
    const outputs = [
      await answer("Ana", qs[0], 0),
      await rpc("quiz_info"),
      await rpc("quiz_public_questions"),
      await rpc("quiz_session", { p_token_hash: "t-Ana" }),
      await rpc("quiz_live"),
      await rpc("quiz_final"),
    ];
    const text = JSON.stringify(outputs);
    expect(text).not.toMatch(/"(key|correct|correctOption|is_correct|points)"/);
    // a resposta do servidor é idêntica acertando ou errando
    await start("Bia");
    expect(await answer("Bia", qs[0], 1)).toEqual(outputs[0]);
  });
});

describe("ranking ao vivo", () => {
  it("respeita ligar/desligar, ocultar, pontuação, progresso e top 10", async () => {
    const qs = await setup(2);
    for (let i = 1; i <= 12; i++) await start(`Pessoa ${String(i).padStart(2, "0")}`);
    await answer("Pessoa 07", qs[0], 0);
    expect(await live()).toMatchObject({ mode: "off", rows: [] });
    await rpc("quiz_save_config", { p: { liveEnabled: true } });
    let l = await live();
    expect(l).toMatchObject({ mode: "ranking", participants: 12, questions: 2, maxScore: 2 });
    expect(l.rows).toHaveLength(10);
    expect(l.rows[0]).toMatchObject({ name: "Pessoa 07", pos: 1, score: 1, answered: 1, done: false });
    await rpc("quiz_save_config", { p: { liveTop10: false, liveShowScores: false, liveShowProgress: false } });
    l = await live();
    expect(l.rows).toHaveLength(12);
    expect(l.rows[0]).not.toHaveProperty("score");
    expect(l.rows[0]).not.toHaveProperty("answered");
    await rpc("quiz_save_config", { p: { liveHidden: true } });
    expect(await live()).toMatchObject({ mode: "hidden", rows: [] });
  });

  it("recalcula posições a cada resposta e indica empate provisório", async () => {
    const qs = await setup(3, { liveEnabled: true, tiebreakMode: "shared" });
    await start("Ana");
    await start("Bia");
    await answer("Ana", qs[0], 0);
    expect((await live()).rows.map((r) => r.name)).toEqual(["Ana", "Bia"]);
    await answer("Bia", qs[0], 0);
    let l = await live();
    expect(l.tie).toBe(true);
    expect(l.rows.map((r) => r.pos)).toEqual([1, 1]);
    await answer("Bia", qs[1], 0);
    l = await live();
    expect(l.rows.map((r) => r.name)).toEqual(["Bia", "Ana"]);
    expect(l.tie).toBe(false);
  });

  it("encerrado mostra só quem concluiu; publicado mostra o resultado final mesmo com 'ocultar' ligado", async () => {
    const qs = await setup(2, { liveEnabled: true });
    await play("Ana", qs, 2);
    await start("Incompleta");
    await rpc("quiz_set_status", { p_to: "closed" });
    expect((await live()).rows.map((r) => r.name)).toEqual(["Ana"]);
    await rpc("quiz_save_config", { p: { liveHidden: true } });
    expect((await live()).mode).toBe("hidden");
    await rpc("quiz_set_status", { p_to: "published" });
    expect(await live()).toMatchObject({ mode: "final", rows: [{ name: "Ana", pos: 1, score: 2 }] });
  });
});

describe("resultado e desempates", () => {
  it("fica oculto até publicar, exclui incompletas e invalidadas, e pode ser ocultado de novo", async () => {
    const qs = await setup(2);
    await play("Ana", qs, 2);
    await play("Bia", qs, 1);
    await play("Fake", qs, 2);
    await start("Incompleta");
    expect(await rpc("quiz_final")).toEqual({ published: false, status: "open" });
    expect(await rpc("quiz_set_status", { p_to: "published" })).toEqual({ error: "bad_transition" });
    await rpc("quiz_set_status", { p_to: "closed" });
    const find = async (n: string) => ((await rpc("quiz_admin_participants")) as AdminParticipant[]).find((p) => p.name === n)!.id;
    await rpc("quiz_update_participant", { p_id: await find("Fake"), p_name: null, p_name_key: null, p_status: "invalid", p_reason: "dup" });
    await rpc("quiz_set_status", { p_to: "published" });
    expect(await rpc("quiz_final")).toMatchObject({
      published: true,
      participants: 2,
      maxScore: 2,
      rows: [
        { name: "Ana", pos: 1 },
        { name: "Bia", pos: 2 },
      ],
    });
    // renomear depois atualiza a publicação
    await rpc("quiz_update_participant", { p_id: await find("Bia"), p_name: "Beatriz", p_name_key: "beatriz", p_status: null, p_reason: null });
    expect(await rpc("quiz_final")).toMatchObject({ rows: [{ name: "Ana" }, { name: "Beatriz" }] });
    await rpc("quiz_set_status", { p_to: "closed" });
    expect(await rpc("quiz_final")).toEqual({ published: false, status: "closed" });
  });

  it("desempate por menor tempo", async () => {
    const qs = await setup(2, { tiebreakMode: "time" });
    for (const n of ["Lenta", "Rapida", "Media"]) await play(n, qs, 2);
    await setDuration("Lenta", 90000);
    await setDuration("Rapida", 20000);
    await setDuration("Media", 40000);
    expect((await state()).ranking.map((r) => [r.name, r.pos, r.tied])).toEqual([
      ["Rapida", 1, false],
      ["Media", 2, false],
      ["Lenta", 3, false],
    ]);
  });

  it("empate permitido divide a posição e pula a seguinte", async () => {
    const qs = await setup(2, { tiebreakMode: "shared" });
    await play("Ana", qs, 2);
    await play("Bia", qs, 2);
    await play("Caio", qs, 1);
    expect((await state()).ranking.map((r) => [r.name, r.pos, r.tied])).toEqual([
      ["Ana", 1, true],
      ["Bia", 1, true],
      ["Caio", 3, false],
    ]);
  });

  it("perguntas extras: rodada só para empatados, com gabarito e pontuação próprios", async () => {
    const qs = await setup(2, { tiebreakMode: "extra" });
    const extra = async (pt: string, points: number, correct: number | null) =>
      R(
        await rpc("quiz_save_question", {
          p: { round: "extra", active: true, points, pt, es: "", correct, options: [{ pt: "Sim" }, { pt: "Não" }] },
        }),
      ).id as string;
    const e1 = await extra("Extra 1", 3, 0);
    const e2 = await extra("Extra 2", 1, 1);
    const e3 = await extra("Sem gabarito", 1, null);
    expect(await state()).toMatchObject({ questions: 2, maxScore: 2 }); // extras não contam no quiz principal

    await play("Ana", qs, 2);
    await play("Bia", qs, 2);
    await play("Caio", qs, 1);
    const ids = Object.fromEntries((await state()).ranking.map((r) => [r.name, r.id]));
    const round = (people: string[], q: string[]) => rpc("quiz_round_start", { p_participants: people, p_questions: q });
    expect(await round([ids.Ana, ids.Bia], [e1])).toEqual({ error: "bad_transition" });
    await rpc("quiz_set_status", { p_to: "closed" });
    expect(await round([ids.Ana, ids.Caio], [e1])).toEqual({ error: "not_tied" });
    expect(await round([ids.Ana], [e1])).toEqual({ error: "not_tied" });
    expect(await round([ids.Ana, ids.Bia], [e3])).toEqual({ error: "bad_question" });
    const r1 = R(await round([ids.Ana, ids.Bia], [e1, e2]));
    expect(r1).toMatchObject({ ok: true, number: 1 });
    expect(await rpc("quiz_set_status", { p_to: "published" })).toEqual({ error: "round_open" });
    await expect(rpc("quiz_delete_question", { p_question: e1 })).rejects.toMatchObject({ code: "locked" });

    const s = (await rpc("quiz_session", { p_token_hash: "t-Ana" })) as QuizSession;
    expect(s.round).toMatchObject({ number: 1, finished: false });
    expect(JSON.stringify(s.round)).not.toMatch(/"(key|points|correct)"/);
    const [x1, x2] = s.round!.questions;
    expect(((await rpc("quiz_session", { p_token_hash: "t-Caio" })) as QuizSession).round).toBeNull();
    expect(await answer("Caio", x1, 0)).toEqual({ error: "bad_question" }); // não participa

    expect(await answer("Ana", x1, 1)).toMatchObject({ answered: 1, total: 2, finished: false });
    expect(await answer("Ana", x1, 0)).toMatchObject({ answered: 1 }); // corrige
    expect(await answer("Ana", x2, 1)).toMatchObject({ finished: true });
    expect(await answer("Ana", x1, 1)).toEqual({ error: "finished" });
    await answer("Bia", x1, 1);
    expect(await answer("Bia", x2, 1)).toMatchObject({ finished: true });
    // a pontuação principal não muda
    expect((await state()).ranking.map((r) => r.score)).toEqual([2, 2, 1]);
    await rpc("quiz_round_close", { p_round: r1.id });
    expect((await state()).ranking.map((r) => [r.name, r.pos, r.tied])).toEqual([
      ["Ana", 1, false],
      ["Bia", 2, false],
      ["Caio", 3, false],
    ]);
    expect(await rpc("quiz_set_status", { p_to: "open" })).toEqual({ error: "has_rounds" });
    expect(await rpc("quiz_set_status", { p_to: "published" })).toMatchObject({ ok: true });
  });

  it("zerar ensaio apaga só participações e volta ao rascunho", async () => {
    const qs = await setup(2);
    await play("Ana", qs, 2);
    expect(await rpc("quiz_reset")).toEqual({ error: "bad_transition" }); // aberto não pode
    await rpc("quiz_set_status", { p_to: "closed" });
    await rpc("quiz_set_status", { p_to: "published" });
    expect(await rpc("quiz_reset")).toMatchObject({ ok: true, removed: 1 });
    expect(await state()).toMatchObject({ status: "draft", missingKey: 0, stats: { total: 0 } });
    expect(await questions()).toHaveLength(20);
  });
});
