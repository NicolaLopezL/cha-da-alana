import Link from "next/link";
import { ActionForm, SubmitButton, TextArea, Toggle } from "@/components/admin/ui";
import { formatDateTime, PageHeader, Panel } from "@/components/admin/parts";
import { emailEnabled, whatsappApiConfigured } from "@/lib/server/notify";
import { getStore } from "@/lib/server/store";
import { markReadAction, saveSettingsAction } from "../../actions";

export default async function NotificationsPage() {
  const store = getStore();
  const [items, settings] = await Promise.all([store.listNotifications(100), store.getSettings()]);
  const unread = items.filter((n) => !n.readAt).length;
  const email = emailEnabled();
  const wa = whatsappApiConfigured();

  return (
    <>
      <PageHeader
        title="Notificações"
        description="Cada confirmação gera um aviso aqui, visível para os dois. Respostas alteradas antes de serem lidas atualizam o mesmo aviso, sem duplicar."
        actions={
          unread > 0 ? (
            <form action={markReadAction}>
              <input type="hidden" name="id" value="all" />
              <button type="submit" className="inline-flex min-h-11 items-center rounded-xl border border-blush-300 bg-paper px-4 text-sm font-semibold text-cocoa-700 hover:bg-blush-50">
                Marcar todas como lidas
              </button>
            </form>
          ) : null
        }
      />

      <Panel className="!p-0">
        {items.length === 0 ? (
          <p className="p-6 text-sm text-cocoa-500">Nenhuma notificação ainda.</p>
        ) : (
          <ul className="divide-y divide-blush-100" data-testid="notification-list">
            {items.map((n) => (
              <li key={n.id} className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 ${n.readAt ? "" : "bg-blush-50/60"}`}>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-cocoa-900">
                    {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-rose-600" aria-label="Não lida" />}
                    {n.guestId ? <Link href={`/admin/convidados/${n.guestId}`} className="hover:text-rose-600">{n.title}</Link> : n.title}
                  </p>
                  {n.body && <p className="mt-0.5 whitespace-pre-line text-xs text-cocoa-500">{n.body}</p>}
                  <p className="mt-1 text-xs text-cocoa-500">
                    {formatDateTime(n.createdAt)}
                    {n.readAt && ` · lida por ${n.readBy ?? "—"}`}
                    {n.kind === "rsvp_updated" && " · resposta alterada"}
                  </p>
                </div>
                {!n.readAt && (
                  <form action={markReadAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className="inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold text-rose-600 hover:bg-blush-100">
                      Marcar como lida
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Destinatários e canais" className="mt-6">
        <ul className="mb-5 space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="badge bg-[#e5efe7] text-success">Ativo</span>
            <span className="text-cocoa-700">Painel — sempre ativo para os dois administradores.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className={`badge ${email ? "bg-[#e5efe7] text-success" : "bg-linen text-cocoa-500"}`}>{email ? "Configurado" : "Não configurado"}</span>
            <span className="text-cocoa-700">
              E-mail (Resend). {email ? "Envia para os endereços abaixo." : "Defina RESEND_API_KEY e NOTIFY_FROM_EMAIL na hospedagem para ativar."}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className={`badge ${wa ? "bg-[#e5efe7] text-success" : "bg-linen text-cocoa-500"}`}>{wa ? "Configurado" : "Não configurado"}</span>
            <span className="text-cocoa-700">
              WhatsApp Business Platform (opcional, pago por mensagem). Requer conta Meta Business, número próprio e modelo aprovado — veja o guia de publicação.
            </span>
          </li>
        </ul>
        <ActionForm action={saveSettingsAction} booleans={["notifyWhatsappApi"]} className="space-y-4">
          <TextArea
            label="E-mails que recebem avisos"
            name="notifyEmails"
            rows={2}
            defaultValue={settings.notifyEmails.join("\n")}
            hint="Um por linha (até 5). Ex.: o e-mail do pai e o da mãe."
          />
          <Toggle
            label="Avisar pelo WhatsApp automaticamente"
            name="notifyWhatsappApi"
            defaultChecked={settings.notifyWhatsappApi}
            hint={wa ? "Envia o modelo aprovado para os dois números configurados em Evento." : "Só funciona depois que as credenciais da API oficial forem configuradas."}
          />
          <SubmitButton>Salvar destinatários</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
