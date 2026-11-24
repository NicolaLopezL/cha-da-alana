import type { LiveRow, LiveState } from "./types";

/**
 * Modo misterioso: só muda o que o público VÊ no ranking ao vivo (a pontuação verdadeira nunca é tocada).
 * Os primeiros colocados disputam a liderança o tempo todo, sempre bem próximos, e os pontos somem.
 * A ordem mostrada entre eles não depende da classificação real: só do id e do relógio.
 */
export const MYSTERY_TICK_MS = 4000;
const CONTENDERS = 5;

/** Número estável em [0, 1) para cada participante. */
function seed(id: string, salt: number) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Curva suave entre 0 e 1 que sobe e desce com o tempo, diferente para cada participante. */
function wave(id: string, seconds: number) {
  const part = (salt: number, min: number, max: number) =>
    Math.sin(2 * Math.PI * (seconds / (min + seed(id, salt) * (max - min)) + seed(id, salt + 100)));
  return 0.5 + 0.5 * (0.5 * part(1, 26, 44) + 0.3 * part(2, 13, 21) + 0.2 * part(3, 9, 12));
}

export function applyMystery(state: LiveState, now: number): LiveState {
  if (state.mode !== "ranking") return state;
  const { rows } = state;
  // Quem está em 1º (mesmo empatado) sempre entra na disputa; os demais, até o 5º lugar.
  const n = Math.max(CONTENDERS, rows.filter((r) => r.pos === 1).length);
  const tick = Math.floor(now / MYSTERY_TICK_MS) * MYSTERY_TICK_MS;
  const fight = rows
    .slice(0, n)
    .map((row) => ({ row, v: wave(row.id, tick / 1000) }))
    .sort((a, b) => b.v - a.v || (a.row.id < b.row.id ? -1 : 1));
  const mask = (row: LiveRow, i: number, heat?: number): LiveRow => ({
    id: row.id,
    name: row.name,
    pos: i + 1,
    tied: false,
    done: row.done,
    ...(row.answered === undefined ? {} : { answered: row.answered }),
    ...(heat === undefined ? {} : { heat }),
  });
  return {
    ...state,
    mystery: true,
    showScores: false,
    tie: false,
    rows: [
      ...fight.map(({ row, v }, i) => mask(row, i, Math.round(72 + 27 * v))),
      ...rows.slice(n).map((row, i) => mask(row, n + i)),
    ],
  };
}
