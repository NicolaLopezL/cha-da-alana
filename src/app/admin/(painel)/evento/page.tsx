import { ActionForm, Field, SubmitButton, TextArea, Toggle } from "@/components/admin/ui";
import { PageHeader, Panel } from "@/components/admin/parts";
import { formatPhone } from "@/lib/format";
import { getStore } from "@/lib/server/store";
import { saveSettingsAction } from "../../actions";

export default async function EventPage() {
  const s = await getStore().getSettings();
  return (
    <>
      <PageHeader title="Evento" description="Tudo o que você preencher aqui aparece no convite na hora. Campos vazios mostram “em breve”." />
      <div className="space-y-6">
        <Panel title="Data e horário" description="Enquanto a data estiver vazia, o convite mostra “Data em breve” e esconde a contagem regressiva.">
          <ActionForm action={saveSettingsAction} className="grid gap-4 sm:grid-cols-2">
            <Field label="Data do chá" name="eventDate" type="date" defaultValue={s.eventDate} />
            <Field label="Prazo para confirmar" name="rsvpDeadline" type="date" defaultValue={s.rsvpDeadline} hint="Depois desse dia o formulário é fechado." />
            <Field label="Horário de início" name="eventTime" type="time" defaultValue={s.eventTime} />
            <Field label="Horário de término (opcional)" name="eventEndTime" type="time" defaultValue={s.eventEndTime} />
            <div className="sm:col-span-2">
              <SubmitButton>Salvar data</SubmitButton>
            </div>
          </ActionForm>
        </Panel>

        <Panel title="Local" description="Os botões do Google Maps e do Waze são criados a partir do endereço. Se preferir, cole links próprios.">
          <ActionForm action={saveSettingsAction} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do espaço" name="venueName" defaultValue={s.venueName} maxLength={120} />
            <Field label="Cidade" name="city" defaultValue={s.city} maxLength={120} placeholder="Ex.: São Paulo – SP" />
            <div className="sm:col-span-2">
              <Field label="Endereço" name="address" defaultValue={s.address} maxLength={240} placeholder="Rua, número, bairro" />
            </div>
            <div className="sm:col-span-2">
              <TextArea label="Informações adicionais" name="venueInfo" defaultValue={s.venueInfo} rows={2} maxLength={600} hint="Ex.: estacionamento, portaria, ponto de referência." />
            </div>
            <Field label="Link do Google Maps (opcional)" name="mapsUrl" type="url" defaultValue={s.mapsUrl} placeholder="https://maps.app.goo.gl/…" />
            <Field label="Link do Waze (opcional)" name="wazeUrl" type="url" defaultValue={s.wazeUrl} placeholder="https://waze.com/ul/…" />
            <div className="sm:col-span-2">
              <SubmitButton>Salvar local</SubmitButton>
            </div>
          </ActionForm>
        </Panel>

        <Panel title="WhatsApp dos papais" description="Os botões “Falar com…” só aparecem para os números preenchidos. Use DDI + DDD + número.">
          <ActionForm action={saveSettingsAction} className="grid gap-4 sm:grid-cols-2">
            <Field label="Como chamar a mãe" name="motherName" defaultValue={s.motherName} maxLength={60} />
            <Field label="WhatsApp da mãe" name="motherPhone" type="tel" inputMode="tel" defaultValue={s.motherPhone ? formatPhone(s.motherPhone) : ""} placeholder="+55 (11) 99999-9999" />
            <Field label="Como chamar o pai" name="fatherName" defaultValue={s.fatherName} maxLength={60} />
            <Field label="WhatsApp do pai" name="fatherPhone" type="tel" inputMode="tel" defaultValue={s.fatherPhone ? formatPhone(s.fatherPhone) : ""} placeholder="+55 (11) 99999-9999" />
            <div className="sm:col-span-2">
              <TextArea
                label="Mensagem pronta"
                name="whatsappTemplate"
                defaultValue={s.whatsappTemplate}
                rows={2}
                maxLength={400}
                hint="{nome} é trocado pelo nome do convidado."
              />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton>Salvar WhatsApp</SubmitButton>
            </div>
          </ActionForm>
        </Panel>

        <Panel title="Lista de enxoval" description="Endereço do site externo onde está a lista. O botão só aparece com o link preenchido.">
          <ActionForm action={saveSettingsAction} className="grid gap-4">
            <Field label="Link da lista de enxoval" name="registryUrl" type="url" defaultValue={s.registryUrl} placeholder="https://…" />
            <div>
              <SubmitButton>Salvar link</SubmitButton>
            </div>
          </ActionForm>
        </Panel>

        <Panel title="Convite aberto" description="Com isto ligado, qualquer pessoa com o link principal confirma digitando o próprio nome e escolhendo quantas pessoas vão com ela — vocês não precisam cadastrar ninguém. Cada resposta aparece em Convidados automaticamente. Se a mesma pessoa responder de novo (mesmo nome e telefone), a resposta anterior é atualizada.">
          <ActionForm action={saveSettingsAction} booleans={["genericInviteEnabled"]} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Toggle label="Aceitar confirmações no convite aberto" name="genericInviteEnabled" defaultChecked={s.genericInviteEnabled} />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton>Salvar</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
