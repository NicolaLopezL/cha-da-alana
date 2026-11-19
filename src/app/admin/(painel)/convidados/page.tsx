import Link from "next/link";
import { ActionForm, CopyButton, Field, SubmitButton, TextArea } from "@/components/admin/ui";
import { PageHeader, Panel, StatusBadge } from "@/components/admin/parts";
import { baseUrl, computeStats, inviteLink } from "@/lib/server/admin-data";
import { getStore } from "@/lib/server/store";
import { fillTemplate, formatPhone, whatsappUrl } from "@/lib/format";
import { guestStatus, type GuestStatus } from "@/lib/types";
import { nameKey } from "@/lib/server/security";
import { createGuestAction, toggleSentAction } from "../../actions";

const FILTERS: { value: "" | GuestStatus; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "pending", label: "Não enviados" },
  { value: "sent", label: "Aguardando" },
  { value: "confirmed", label: "Confirmados" },
  { value: "declined", label: "Não vão" },
];

export default async function GuestsPage({ searchParams }: PageProps<"/admin/convidados">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const store = getStore();
  const [all, base] = await Promise.all([store.listGuests(), baseUrl()]);
  const stats = computeStats(all);

  const needle = nameKey(q);
  const guests = all.filter(
    (g) =>
      (!status || guestStatus(g) === status) &&
      (!needle || nameKey(`${g.name} ${g.groupName} ${g.phone}`).includes(needle)),
  );

  return (
    <>
      <PageHeader
        title="Convidados"
        description={`${stats.invites} convites · ${stats.confirmedPeople} pessoas confirmadas · ${stats.pending} aguardando`}
        actions={
          <a href="/admin/convidados/exportar" download className="inline-flex min-h-11 items-center rounded-xl border border-blush-300 bg-paper px-4 text-sm font-semibold text-cocoa-700 hover:bg-blush-50">
            Exportar CSV
          </a>
        }
      />

      <form className="mb-4 flex flex-col gap-3 sm:flex-row" role="search">
        <label htmlFor="busca" className="sr-only">
          Pesquisar convidado
        </label>
        <input id="busca" name="q" defaultValue={q} placeholder="Pesquisar por nome, grupo ou telefone" className="admin-field sm:max-w-sm" />
        <label htmlFor="filtro" className="sr-only">
          Filtrar por situação
        </label>
        <select id="filtro" name="status" defaultValue={status} className="admin-field sm:max-w-[12rem]">
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cocoa-700 px-5 text-sm font-semibold text-paper">
          Filtrar
        </button>
      </form>

      <Panel className="!p-0">
        {guests.length === 0 ? (
          <p className="p-6 text-sm text-cocoa-500">
            {all.length === 0 ? "Nenhum convidado cadastrado ainda. Use o formulário abaixo para começar." : "Nenhum convidado encontrado com esse filtro."}
          </p>
        ) : (
          <ul className="divide-y divide-blush-100" data-testid="guest-list">
            {guests.map((g) => {
              const link = inviteLink(base, g.token);
              const share = g.phone
                ? whatsappUrl(
                    g.phone,
                    fillTemplate("Olá, {nome}! Preparamos um convite muito especial para você 💗\n{link}", {
                      nome: g.name.split(" ")[0],
                      link,
                    }),
                  )
                : "";
              return (
                <li key={g.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6" data-testid="guest-row">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/convidados/${g.id}`} className="font-semibold text-cocoa-900 hover:text-rose-600">
                        {g.name}
                      </Link>
                      <StatusBadge guest={g} />
                      {g.origin === "generic" && <span className="badge bg-linen text-cocoa-500">convite aberto</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-cocoa-500">
                      {[g.groupName, `até ${g.maxPeople} ${g.maxPeople === 1 ? "pessoa" : "pessoas"}`, g.phone && formatPhone(g.phone)]
                        .filter(Boolean)
                        .join(" · ")}
                      {g.rsvp?.attending === "yes" && <strong className="text-success"> · {g.rsvp.people} confirmados</strong>}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyButton text={link} />
                    {share && (
                      <a href={share} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-lg border border-blush-300 px-3 text-xs font-semibold text-cocoa-700 hover:bg-blush-50">
                        Enviar no WhatsApp
                      </a>
                    )}
                    {guestStatus(g) !== "confirmed" && guestStatus(g) !== "declined" && (
                      <form action={toggleSentAction}>
                        <input type="hidden" name="id" value={g.id} />
                        <button type="submit" className="inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold text-cocoa-500 hover:bg-blush-50">
                          {g.sentAt ? "Desmarcar enviado" : "Marcar como enviado"}
                        </button>
                      </form>
                    )}
                    <Link href={`/admin/convidados/${g.id}`} className="inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold text-rose-600 hover:bg-blush-50">
                      Editar
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Novo convidado" description="Cada convite gera um link pessoal e seguro. Para famílias, informe o nome do grupo e quantas pessoas podem vir." className="mt-6">
        <div id="novo" />
        <ActionForm action={createGuestAction} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do convidado" name="name" required maxLength={120} placeholder="Ex.: Maria Souza" />
          <Field label="Família ou grupo" name="groupName" maxLength={120} placeholder="Ex.: Família Souza" />
          <Field label="Máximo de pessoas" name="maxPeople" type="number" min={1} max={20} defaultValue={1} required />
          <Field label="Telefone (opcional)" name="phone" type="tel" inputMode="tel" placeholder="(11) 99999-9999" hint="Usado só para enviar o convite pelo WhatsApp." />
          <div className="sm:col-span-2">
            <TextArea label="Observações internas" name="internalNotes" rows={2} maxLength={1000} hint="Visível apenas no painel." />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Adicionar convidado</SubmitButton>
          </div>
        </ActionForm>
      </Panel>
    </>
  );
}
