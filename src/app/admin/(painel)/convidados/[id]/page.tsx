import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, ConfirmSubmit, CopyButton, Field, SubmitButton, TextArea } from "@/components/admin/ui";
import { formatDateTime, PageHeader, Panel, StatusBadge } from "@/components/admin/parts";
import { baseUrl, inviteLink } from "@/lib/server/admin-data";
import { getStore } from "@/lib/server/store";
import { clearRsvpAction, deleteGuestAction, manualRsvpAction, regenerateTokenAction, updateGuestAction } from "../../../actions";

export default async function GuestDetail({ params }: PageProps<"/admin/convidados/[id]">) {
  const { id } = await params;
  const store = getStore();
  const [g, base] = await Promise.all([store.getGuestById(id), baseUrl()]);
  if (!g) notFound();
  const link = inviteLink(base, g.token);

  return (
    <>
      <Link href="/admin/convidados" className="mb-4 inline-flex min-h-10 items-center text-sm font-semibold text-cocoa-500 hover:text-cocoa-700">
        ← Convidados
      </Link>
      <PageHeader title={g.name} description={g.groupName || undefined} actions={<StatusBadge guest={g} />} />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Panel title="Link pessoal" description="Envie este link ao convidado. Ele mostra o nome no envelope e permite confirmar ou alterar a resposta.">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 break-all rounded-xl bg-blush-50 px-3 py-2 text-xs text-cocoa-700" data-testid="invite-link">
                {link}
              </code>
              <CopyButton text={link} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={link} target="_blank" className="inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold text-rose-600 hover:bg-blush-50">
                Abrir convite ↗
              </a>
              <ActionForm action={regenerateTokenAction}>
                <input type="hidden" name="id" value={g.id} />
                <SubmitButton variant="ghost" className="!min-h-10 !text-xs">
                  Gerar novo link (invalida o atual)
                </SubmitButton>
              </ActionForm>
            </div>
          </Panel>

          <Panel title="Dados do convite">
            <ActionForm action={updateGuestAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={g.id} />
              <Field label="Nome do convidado" name="name" required maxLength={120} defaultValue={g.name} />
              <Field label="Família ou grupo" name="groupName" maxLength={120} defaultValue={g.groupName} />
              <Field label="Máximo de pessoas" name="maxPeople" type="number" min={1} max={20} defaultValue={g.maxPeople} required />
              <Field label="Telefone" name="phone" type="tel" inputMode="tel" defaultValue={g.phone} />
              <div className="sm:col-span-2">
                <TextArea label="Observações internas" name="internalNotes" rows={3} maxLength={1000} defaultValue={g.internalNotes} />
              </div>
              <div className="sm:col-span-2">
                <SubmitButton>Salvar</SubmitButton>
              </div>
            </ActionForm>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Resposta">
            {g.rsvp ? (
              <div className="mb-5 rounded-xl bg-blush-50 p-4 text-sm">
                <p className="font-semibold text-cocoa-900">
                  {g.rsvp.attending === "yes" ? `Vai · ${g.rsvp.people} ${g.rsvp.people === 1 ? "pessoa" : "pessoas"}` : "Não vai"}
                </p>
                <p className="mt-1 text-xs text-cocoa-500">
                  {g.rsvp.source === "site" ? "Pelo site" : g.rsvp.source === "whatsapp_manual" ? "Registrado manualmente (WhatsApp)" : "Registrado pelo painel"} ·{" "}
                  {formatDateTime(g.rsvp.updatedAt)}
                </p>
                {g.rsvp.message && <p className="mt-2 italic text-cocoa-700">“{g.rsvp.message}”</p>}
                <form action={clearRsvpAction} className="mt-3">
                  <input type="hidden" name="id" value={g.id} />
                  <ConfirmSubmit message="Apagar a resposta deste convidado?" className="text-xs font-semibold text-danger underline underline-offset-2">
                    Apagar resposta
                  </ConfirmSubmit>
                </form>
              </div>
            ) : (
              <p className="mb-5 text-sm text-cocoa-500">Ainda sem resposta.</p>
            )}

            <h3 className="text-sm font-bold text-cocoa-900">Registrar manualmente</h3>
            <p className="mt-1 text-xs text-cocoa-500">Use quando a pessoa responder pelo WhatsApp ou pessoalmente.</p>
            <ActionForm action={manualRsvpAction} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={g.id} />
              <fieldset className="flex gap-4">
                <legend className="sr-only">Vai comparecer?</legend>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="radio" name="attending" value="yes" defaultChecked={g.rsvp?.attending !== "no"} className="h-4 w-4 accent-rose-600" /> Vai
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="radio" name="attending" value="no" defaultChecked={g.rsvp?.attending === "no"} className="h-4 w-4 accent-rose-600" /> Não vai
                </label>
              </fieldset>
              <Field label={`Pessoas (máx. ${g.maxPeople})`} name="people" type="number" min={1} max={g.maxPeople} defaultValue={g.rsvp?.people || 1} />
              <div>
                <label htmlFor="source" className="mb-1 block text-[0.8rem] font-semibold text-cocoa-700">
                  Recebido por
                </label>
                <select id="source" name="source" className="admin-field" defaultValue="whatsapp_manual">
                  <option value="whatsapp_manual">WhatsApp</option>
                  <option value="admin">Pessoalmente / outro</option>
                </select>
              </div>
              <TextArea label="Recado (opcional)" name="message" rows={2} maxLength={500} />
              <SubmitButton>Registrar resposta</SubmitButton>
            </ActionForm>
          </Panel>

          {g.internalNotes && (
            <Panel title="Observações">
              <p className="whitespace-pre-line text-sm text-cocoa-700">{g.internalNotes}</p>
            </Panel>
          )}

          <Panel title="Excluir convite">
            <p className="mb-3 text-sm text-cocoa-500">Remove o convidado, a resposta e o link pessoal. Não é possível desfazer.</p>
            <form action={deleteGuestAction}>
              <input type="hidden" name="id" value={g.id} />
              <ConfirmSubmit
                message={`Excluir ${g.name}? Esta ação não pode ser desfeita.`}
                className="inline-flex min-h-11 items-center rounded-xl border border-danger/40 px-4 text-sm font-semibold text-danger hover:bg-[#f7e4e2]"
              >
                Excluir convidado
              </ConfirmSubmit>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
