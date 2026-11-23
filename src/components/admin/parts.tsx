import type { ReactNode } from "react";
import { guestStatus, type AuditEntry, type GuestWithRsvp } from "@/lib/types";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="display text-[2.2rem] text-cocoa-900 sm:text-[2.6rem]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-cocoa-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className = "", description }: { title?: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`admin-panel p-5 sm:p-6 ${className}`}>
      {title && <h2 className="text-base font-bold text-cocoa-900">{title}</h2>}
      {description && <p className="mt-1 text-sm text-cocoa-500">{description}</p>}
      <div className={title || description ? "mt-5" : ""}>{children}</div>
    </section>
  );
}

export function StatusBadge({ guest }: { guest: GuestWithRsvp }) {
  const st = guestStatus(guest);
  const map = {
    confirmed: ["bg-[#e5efe7] text-success", "Confirmado"],
    declined: ["bg-[#f3e6e6] text-danger", "Não vai"],
    sent: ["bg-champagne-200/50 text-champagne-700", "Aguardando"],
    pending: ["bg-blush-50 text-cocoa-500", "Não enviado"],
  } as const;
  const [cls, label] = map[st];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const ACTIONS: Record<string, string> = {
  "settings.update": "alterou as configurações",
  "guest.create": "adicionou um convidado",
  "guest.update": "editou um convidado",
  "guest.delete": "excluiu um convidado",
  "guest.sent": "marcou convite como enviado",
  "guest.unsent": "desmarcou convite enviado",
  "guest.token": "gerou um novo link",
  "rsvp.create": "registrou resposta",
  "rsvp.update": "alterou resposta",
  "rsvp.delete": "apagou uma resposta",
  "gift.create": "adicionou um presente",
  "gift.update": "editou um presente",
  "gift.delete": "removeu um presente",
  "media.upload": "enviou um arquivo",
  "media.remove": "removeu um arquivo",
  "quiz.open": "abriu o quiz",
  "quiz.closed": "encerrou o quiz ou ocultou os resultados",
  "quiz.published": "publicou os resultados do quiz",
  "quiz.config": "alterou a configuração do quiz",
  "quiz.texts": "alterou os textos do quiz",
  "quiz.reset": "zerou as participações do quiz",
  "quiz.key": "definiu a resposta correta de uma pergunta do quiz",
  "quiz.question.create": "adicionou uma pergunta ao quiz",
  "quiz.question.update": "editou uma pergunta do quiz",
  "quiz.question.delete": "excluiu uma pergunta do quiz",
  "quiz.question.duplicate": "duplicou uma pergunta do quiz",
  "quiz.question.activate": "ativou uma pergunta do quiz",
  "quiz.question.deactivate": "desativou uma pergunta do quiz",
  "quiz.participant.rename": "renomeou um participante do quiz",
  "quiz.participant.invalidate": "invalidou uma participação do quiz",
  "quiz.participant.restore": "restaurou uma participação do quiz",
  "quiz.round.start": "iniciou uma rodada de desempate do quiz",
  "quiz.round.close": "encerrou uma rodada de desempate do quiz",
};

export function AuditList({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-cocoa-500">Nenhuma alteração registrada ainda.</p>;
  return (
    <ol className="divide-y divide-blush-100">
      {entries.map((e) => {
        const d = e.details as Record<string, unknown>;
        const subject = (d.guest ?? d.name) as string | undefined;
        const fields = Array.isArray(d.fields) ? (d.fields as string[]).join(", ") : "";
        return (
          <li key={e.id} className="flex flex-col gap-0.5 py-3 text-sm sm:flex-row sm:items-baseline sm:gap-3">
            <time className="shrink-0 text-xs tabular text-cocoa-500 sm:w-32">{formatDateTime(e.createdAt)}</time>
            <p className="text-cocoa-700">
              <strong className="font-semibold">{e.actor.replace(/^convidado:/, "")}</strong>{" "}
              {e.actor.startsWith("convidado:") && e.action.startsWith("rsvp") ? "respondeu pelo site" : ACTIONS[e.action] ?? e.action}
              {subject && !e.actor.startsWith("convidado:") ? ` — ${subject}` : ""}
              {e.action.startsWith("rsvp") && d.attending ? (
                <span className="text-cocoa-500"> · {d.attending === "yes" ? `vai (${d.people})` : "não vai"}</span>
              ) : null}
              {fields && <span className="text-cocoa-500"> · {fields}</span>}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
