import Link from "next/link";
import { AuditList, formatDateTime, PageHeader, Panel, StatusBadge } from "@/components/admin/parts";
import { computeStats } from "@/lib/server/admin-data";
import { getStore } from "@/lib/server/store";
import { dateParts, formatTime } from "@/lib/format";

export default async function Dashboard() {
  const store = getStore();
  const [guests, audit, settings, unread] = await Promise.all([
    store.listGuests(),
    store.listAudit(12),
    store.getSettings(),
    store.countUnreadNotifications(),
  ]);
  const st = computeStats(guests);
  const latest = guests
    .filter((g) => g.rsvp)
    .sort((a, b) => b.rsvp!.updatedAt.localeCompare(a.rsvp!.updatedAt))
    .slice(0, 8);
  const p = dateParts(settings.eventDate);

  const cards = [
    { label: "Pessoas confirmadas", value: st.confirmedPeople, hint: `${st.confirmedGuests} convites · ${st.companions} acompanhantes`, accent: true },
    { label: "Convites", value: st.invites, hint: `${st.totalSlots} lugares no total` },
    { label: "Aguardando resposta", value: st.pending, hint: `${st.responseRate}% já responderam` },
    { label: "Não poderão ir", value: st.declined, hint: "convites" },
  ];

  return (
    <>
      <PageHeader
        title="Resumo"
        description={
          p
            ? `Chá em ${p.weekday}, ${p.day} de ${p.month} de ${p.year}${settings.eventTime ? ` às ${formatTime(settings.eventTime)}` : ""}.`
            : "A data do chá ainda não foi definida — configure em Evento quando decidirem."
        }
        actions={
          <Link href="/admin/convidados#novo" className="btn btn-primary !min-h-11 !rounded-xl !px-4 !text-sm">
            Adicionar convidado
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="stats">
        {cards.map((c) => (
          <div key={c.label} className={`admin-panel p-4 sm:p-5 ${c.accent ? "!border-blush-300 !bg-blush-50" : ""}`}>
            <p className="text-xs font-semibold text-cocoa-500">{c.label}</p>
            <p className="display mt-1 text-4xl tabular text-cocoa-900 sm:text-5xl">{c.value}</p>
            <p className="mt-1 text-xs text-cocoa-500">{c.hint}</p>
          </div>
        ))}
      </div>

      {unread > 0 && (
        <Link
          href="/admin/notificacoes"
          className="mt-4 flex min-h-12 items-center justify-between rounded-2xl border border-rose-400/40 bg-paper px-5 py-3 text-sm font-semibold text-cocoa-700"
        >
          <span>
            {unread === 1 ? "1 nova notificação" : `${unread} novas notificações`} de confirmação
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Últimas respostas">
          {latest.length === 0 ? (
            <p className="text-sm text-cocoa-500">Ninguém respondeu ainda. As confirmações aparecem aqui em tempo real.</p>
          ) : (
            <ul className="divide-y divide-blush-100">
              {latest.map((g) => (
                <li key={g.id}>
                  <Link href={`/admin/convidados/${g.id}`} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-cocoa-900">{g.name}</span>
                      <span className="block text-xs text-cocoa-500">
                        {g.rsvp!.attending === "yes" ? `${g.rsvp!.people} ${g.rsvp!.people === 1 ? "pessoa" : "pessoas"}` : "Não vai"} ·{" "}
                        {formatDateTime(g.rsvp!.updatedAt)}
                        {g.rsvp!.source === "whatsapp_manual" ? " · via WhatsApp" : ""}
                      </span>
                      {g.rsvp!.message && <span className="mt-0.5 block truncate text-xs italic text-cocoa-500">“{g.rsvp!.message}”</span>}
                    </span>
                    <StatusBadge guest={g} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Histórico de alterações">
          <AuditList entries={audit} />
          <Link href="/admin/historico" className="mt-3 inline-block text-sm font-semibold text-rose-600">
            Ver tudo
          </Link>
        </Panel>
      </div>
    </>
  );
}
