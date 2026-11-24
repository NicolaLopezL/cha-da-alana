import { describe, expect, it } from "vitest";
import { applyMystery, MYSTERY_TICK_MS } from "@/lib/quiz/mystery";
import type { LiveRow, LiveState } from "@/lib/quiz/types";

const id = (i: number) => `0000000${i}-1111-4222-8333-44444444444${i}`;
const row = (i: number, pos: number, score: number): LiveRow => ({ id: id(i), name: `P${i}`, pos, tied: false, done: true, score, answered: 20 });
const base = (rows: LiveRow[]): LiveState => ({
  mode: "ranking", status: "open", showScores: true, showProgress: true, top10: true,
  participants: rows.length, done: rows.length, questions: 20, maxScore: 20, tie: true, round: false, rows,
});
const eight = base([1, 2, 3, 4, 5, 6, 7, 8].map((i) => row(i, i, 21 - i)));
const START = 1_790_000_000_000;
const at = (k: number, s = eight) => applyMystery(s, START + k * MYSTERY_TICK_MS);

describe("modo misterioso", () => {
  it("não vaza pontuação nem empate, mantém as mesmas pessoas e numera de 1 a n", () => {
    const s = at(0);
    expect(s).toMatchObject({ mystery: true, showScores: false, tie: false });
    expect(JSON.stringify(s.rows)).not.toContain("score");
    expect(s.rows.map((r) => r.pos)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(s.rows.map((r) => r.id).sort()).toEqual(eight.rows.map((r) => r.id).sort());
    expect(s.rows.slice(5).map((r) => r.name)).toEqual(["P6", "P7", "P8"]);
    expect(s.rows.slice(5).every((r) => r.heat === undefined)).toBe(true);
  });

  it("a liderança troca bastante e todos os cinco passam por ela, sempre próximos", () => {
    const leaders = Array.from({ length: 75 }, (_, k) => at(k).rows[0].name); // 5 minutos
    expect(new Set(leaders).size).toBeGreaterThanOrEqual(4);
    expect(leaders.filter((x, i) => i && x !== leaders[i - 1]).length).toBeGreaterThanOrEqual(12);
    let run = 1;
    let longest = 1;
    leaders.forEach((x, i) => {
      run = i && x === leaders[i - 1] ? run + 1 : 1;
      longest = Math.max(longest, run);
    });
    expect(longest * MYSTERY_TICK_MS).toBeLessThanOrEqual(45_000);
    for (const r of at(3).rows.slice(0, 5)) expect(r.heat).toBeGreaterThanOrEqual(72);
  });

  it("a ordem mostrada não depende de quem está ganhando de verdade; telas diferentes veem o mesmo", () => {
    const inverted = base([...eight.rows.slice(0, 5)].reverse().map((r, i) => ({ ...r, pos: i + 1 })));
    const same = base(eight.rows.slice(0, 5));
    for (let k = 0; k < 20; k++) expect(at(k, inverted).rows).toEqual(at(k, same).rows);
    expect(applyMystery(eight, START + 10)).toEqual(applyMystery(eight, START + 900));
  });

  it("com duas pessoas, também trocam; o resultado final e as outras telas não são tocados", () => {
    const two = base([row(1, 1, 9), row(2, 2, 3)]);
    expect(new Set(Array.from({ length: 40 }, (_, k) => at(k, two).rows[0].name)).size).toBe(2);
    for (const mode of ["final", "hidden", "waiting", "off"] as const) expect(applyMystery({ ...eight, mode }, START)).toEqual({ ...eight, mode });
  });
});
