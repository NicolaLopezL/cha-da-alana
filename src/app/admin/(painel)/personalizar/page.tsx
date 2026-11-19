import { ActionForm, Field, SubmitButton, TextArea, Toggle } from "@/components/admin/ui";
import { PageHeader, Panel } from "@/components/admin/parts";
import { getStore } from "@/lib/server/store";
import { saveSettingsAction, uploadMediaAction } from "../../actions";

const TOGGLES = [
  ["showBear", "Ursinha / balão no topo"],
  ["showCountdown", "Contagem regressiva"],
  ["showLocation", "Seção do local"],
  ["showWhatsapp", "Botões de WhatsApp"],
  ["showGifts", "Sugestões de presentes"],
  ["showRegistry", "Lista de enxoval"],
  ["showMusic", "Música (o visitante pode silenciar)"],
  ["showDecorations", "Corações e brilhos flutuantes"],
] as const;

export default async function CustomizePage() {
  const s = await getStore().getSettings();
  return (
    <>
      <PageHeader title="Textos e visual" description="Mensagens, imagens, música e elementos opcionais do convite." />
      <div className="space-y-6">
        <Panel title="Mensagens">
          <ActionForm action={saveSettingsAction} className="grid gap-4">
            <Field label="Mensagem do envelope (convite sem nome)" name="envelopeMessage" defaultValue={s.envelopeMessage} maxLength={140} />
            <Field label="Frase da Alana" name="heroPhrase" defaultValue={s.heroPhrase} maxLength={160} />
            <TextArea label="Texto do convite" name="inviteLines" defaultValue={s.inviteLines.join("\n")} rows={4} hint="Cada linha vira um parágrafo (até 6)." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Agradecimento — vai" name="thanksYes" defaultValue={s.thanksYes} maxLength={200} />
              <Field label="Agradecimento — não vai" name="thanksNo" defaultValue={s.thanksNo} maxLength={200} />
            </div>
            <TextArea label="Encerramento" name="closingLines" defaultValue={s.closingLines.join("\n")} rows={2} hint="Cada linha vira um parágrafo." />
            <Field label="Assinatura" name="signature" defaultValue={s.signature} maxLength={120} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título dos presentes" name="giftsTitle" defaultValue={s.giftsTitle} maxLength={120} />
              <Field label="Título do enxoval" name="registryTitle" defaultValue={s.registryTitle} maxLength={160} />
              <TextArea label="Texto dos presentes" name="giftsText" defaultValue={s.giftsText} rows={3} maxLength={400} />
              <TextArea label="Texto do enxoval" name="registryText" defaultValue={s.registryText} rows={3} maxLength={400} />
            </div>
            <Field
              label="Lembrete no botão do enxoval"
              name="registryReminder"
              defaultValue={s.registryReminder}
              maxLength={220}
            />
            <div>
              <SubmitButton>Salvar mensagens</SubmitButton>
            </div>
          </ActionForm>
        </Panel>

        <div className="grid gap-6 md:grid-cols-2">
          <Panel title="Imagem da ursinha" description="Use a arte oficial (PNG com fundo transparente fica melhor). Sem imagem, aparece um balão de coração.">
            {s.bearImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.bearImageUrl} alt="Imagem atual" className="mb-4 h-32 w-32 rounded-xl bg-blush-50 object-contain p-2" />
            )}
            <ActionForm action={uploadMediaAction} encType="multipart/form-data" className="space-y-3">
              <input type="hidden" name="kind" value="bear" />
              <label className="sr-only" htmlFor="bear-file">
                Arquivo da imagem
              </label>
              <input id="bear-file" name="file" type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="block w-full text-sm" />
              <SubmitButton>Enviar imagem</SubmitButton>
            </ActionForm>
            {s.bearImageUrl && (
              <ActionForm action={uploadMediaAction} className="mt-2">
                <input type="hidden" name="kind" value="bear" />
                <input type="hidden" name="remove" value="1" />
                <SubmitButton variant="ghost">Remover imagem</SubmitButton>
              </ActionForm>
            )}
          </Panel>

          <Panel title="Música" description="Toca só depois que o convidado abre o envelope, com botão para silenciar. Use uma música com direito de uso.">
            {s.musicUrl && <audio controls src={s.musicUrl} className="mb-4 w-full" preload="none" />}
            <ActionForm action={uploadMediaAction} encType="multipart/form-data" className="space-y-3">
              <input type="hidden" name="kind" value="music" />
              <label className="sr-only" htmlFor="music-file">
                Arquivo de áudio
              </label>
              <input id="music-file" name="file" type="file" accept="audio/mpeg,audio/mp4,audio/ogg,.m4a" className="block w-full text-sm" />
              <SubmitButton>Enviar música</SubmitButton>
            </ActionForm>
            {s.musicUrl && (
              <ActionForm action={uploadMediaAction} className="mt-2">
                <input type="hidden" name="kind" value="music" />
                <input type="hidden" name="remove" value="1" />
                <SubmitButton variant="ghost">Remover música</SubmitButton>
              </ActionForm>
            )}
            <p className="mt-3 text-xs text-cocoa-500">Arquivos de até 3,5 MB. Lembre de ativar “Música” abaixo.</p>
          </Panel>
        </div>

        <Panel title="Elementos do convite">
          <ActionForm action={saveSettingsAction} booleans={TOGGLES.map(([k]) => k)} className="space-y-1">
            <div className="grid gap-x-6 sm:grid-cols-2">
              {TOGGLES.map(([key, label]) => (
                <Toggle key={key} label={label} name={key} defaultChecked={s[key]} />
              ))}
            </div>
            <div className="pt-3">
              <SubmitButton>Salvar elementos</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
