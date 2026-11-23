"use client";

import Link from "next/link";
import { useState } from "react";
import { participantAction } from "@/app/admin/quiz-actions";
import { formatDuration } from "@/lib/quiz/i18n";
import { quizNameKey } from "@/lib/quiz/name";
import type { AdminParticipant } from "@/lib/quiz/types";
import { formatDateTime } from "../parts";
import { ActionButton, btnClass, usePolled, useQuizAction } from "./kit";

const STATUS = {
  active: ["Respondendo", "bg-champagne-200/50 text-champagne-700"],
  done: ["Concluída", "bg-[#e5efe7] text-success"],
  invalid: ["Invalidada", "bg-[#f3e6e6] text-danger"],
} as const;

export function ParticipantStatus({ status }: { status: AdminParticipant["status"] }) {
  const [label, cls] = STATUS[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function ParticipantList({ initial, total }: { initial: AdminParticipant[]; total: number }) {
  const list = usePolled("/admin/quiz/dados?tipo=participantes", initial, 4000);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | AdminParticipant["status"] | "dup">("all");
  const key = quizNameKey(q);
  const rows = list.filter(
    (p) =>
      (!key || quizNameKey(p.name).includes(key)) &&
      (filter === "all" || (filter === "dup" ? p.sameDevice || p.similarName : p.status === filter)),
  );

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input type="search" aria-label="Pesquisar participante" placeholder="Pesquisar pelo nome" value={q} onChange={(e) => setQ(e.target.value)} className="admin-field min-w-0 flex-1" />
        <select aria-label="Filtrar participantes" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="admin-field sm:!w-60">
          <option value="all">Todas</option>
          <option value="active">Respondendo</option>
          <option value="done">Concluídas</option>
          <option value="invalid">Invalidadas</option>
          <option value="dup">Possíveis duplicidades</option>
        </select>
      </div>
      <p className="mt-3 text-xs text-cocoa-500">
        {rows.length} de {list.length} participações
      </p>
      <ul className="mt-2 space-y-3" data-testid="participant-list">
        {rows.map((p) => (
          <li key={p.id} className="rounded-2xl border border-blush-100 p-4" data-testid="participant-row">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link href={`/admin/quiz/participantes/${p.id}`} className="font-bold text-cocoa-900 hover:underline">
                {p.name}
              </Link>
              <ParticipantStatus status={p.status} />
              {p.sameDevice && <span className="badge bg-blush-100 text-rose-600">Mesmo aparelho</span>}
              {p.similarName && <span className="badge bg-blush-100 text-rose-600">Nome parecido</span>}
            </div>
            <dl className="tabular mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-cocoa-500 sm:grid-cols-5">
              <div>Início: {formatDateTime(p.startedAt)}</div>
              <div>Conclusão: {p.finishedAt ? formatDateTime(p.finishedAt) : "—"}</div>
              <div>
                Progresso: {p.answered}/{total}
              </div>
              <div>Pontuação: {p.score}</div>
              <div>Tempo: {formatDuration(p.durationMs)}</div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/admin/quiz/participantes/${p.id}`} className={btnClass("ghost", "sm")}>
                Ver respostas
              </Link>
              {p.status === "invalid" ? (
                <ActionButton size="sm" action={() => participantAction("restore", p.id, "")}>
                  Restaurar
                </ActionButton>
              ) : (
                <ActionButton
                  size="sm"
                  variant="danger"
                  confirm={`Invalidar a participação de ${p.name}? Ela sai do ranking (dá para restaurar depois).`}
                  action={() => participantAction("invalidate", p.id, "Duplicidade")}
                >
                  Invalidar
                </ActionButton>
              )}
            </div>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="mt-4 text-sm text-cocoa-500">Nenhuma participação encontrada.</p>}
    </div>
  );
}

export function ParticipantEditor({ p }: { p: AdminParticipant }) {
  const [name, setName] = useState(p.name);
  const { run, pending } = useQuizAction();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="block flex-1 text-[0.8rem] font-semibold text-cocoa-700">
        Nome no ranking
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className="admin-field mt-1" />
      </label>
      <button type="button" disabled={pending || name.trim() === p.name} onClick={() => run(() => participantAction("rename", p.id, name))} className={btnClass("primary")}>
        Salvar nome
      </button>
      {p.status === "invalid" ? (
        <ActionButton action={() => participantAction("restore", p.id, "")}>Restaurar participação</ActionButton>
      ) : (
        <ActionButton variant="danger" confirm={`Invalidar a participação de ${p.name}?`} action={() => participantAction("invalidate", p.id, "Invalidada pela organização")}>
          Invalidar participação
        </ActionButton>
      )}
    </div>
  );
}
