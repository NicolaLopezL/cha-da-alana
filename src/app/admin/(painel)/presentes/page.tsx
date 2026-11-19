import { ActionForm, ConfirmSubmit, Field, SubmitButton, Toggle } from "@/components/admin/ui";
import { PageHeader, Panel } from "@/components/admin/parts";
import { getStore } from "@/lib/server/store";
import { createGiftAction, deleteGiftAction, moveGiftAction, updateGiftAction } from "../../actions";

const EXAMPLES = ["Fraldas descartáveis", "Lenços umedecidos", "Algodão para bebê", "Sabonete infantil", "Pomada para assaduras", "Shampoo infantil"];

export default async function GiftsPage() {
  const gifts = await getStore().listGifts();
  return (
    <>
      <PageHeader
        title="Sugestões de presentes"
        description="Itens simples de cuidado, mostrados como sugestão (nunca como obrigação). A lista de enxoval externa é configurada em Evento."
      />

      <Panel title="Adicionar item" description={gifts.length === 0 ? `Sugestões: ${EXAMPLES.join(", ")}.` : undefined}>
        <ActionForm action={createGiftAction} resetOnSuccess className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Field label="Item" name="name" required maxLength={120} placeholder="Ex.: Fraldas descartáveis" />
          </div>
          <Field label="Marca (opcional)" name="brand" maxLength={120} />
          <Field label="Tamanho (opcional)" name="size" maxLength={60} placeholder="Ex.: M ou G" />
          <div className="sm:col-span-4">
            <Field label="Observação (opcional)" name="notes" maxLength={300} placeholder="Ex.: qualquer marca é bem-vinda" />
          </div>
          <input type="hidden" name="active" value="on" />
          <div className="sm:col-span-4">
            <SubmitButton>Adicionar</SubmitButton>
          </div>
        </ActionForm>
      </Panel>

      <div className="mt-6 space-y-3" data-testid="admin-gifts">
        {gifts.map((g, i) => (
          <Panel key={g.id} className={g.active ? "" : "opacity-70"}>
            <ActionForm action={updateGiftAction} className="grid gap-3 sm:grid-cols-4">
              <input type="hidden" name="id" value={g.id} />
              <div className="sm:col-span-2">
                <Field label="Item" name="name" required maxLength={120} defaultValue={g.name} />
              </div>
              <Field label="Marca" name="brand" maxLength={120} defaultValue={g.brand} />
              <Field label="Tamanho" name="size" maxLength={60} defaultValue={g.size} />
              <div className="sm:col-span-3">
                <Field label="Observação" name="notes" maxLength={300} defaultValue={g.notes} />
              </div>
              <div className="flex items-end">
                <Toggle label="Visível no convite" name="active" defaultChecked={g.active} />
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:col-span-4">
                <SubmitButton>Salvar</SubmitButton>
              </div>
            </ActionForm>
            <div className="mt-2 flex flex-wrap gap-2 border-t border-blush-100 pt-3">
              <form action={moveGiftAction}>
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="dir" value="up" />
                <button type="submit" disabled={i === 0} className="min-h-10 rounded-lg px-3 text-xs font-semibold text-cocoa-500 hover:bg-blush-50 disabled:opacity-30" aria-label={`Mover ${g.name} para cima`}>
                  ↑ Subir
                </button>
              </form>
              <form action={moveGiftAction}>
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="dir" value="down" />
                <button type="submit" disabled={i === gifts.length - 1} className="min-h-10 rounded-lg px-3 text-xs font-semibold text-cocoa-500 hover:bg-blush-50 disabled:opacity-30" aria-label={`Mover ${g.name} para baixo`}>
                  ↓ Descer
                </button>
              </form>
              <form action={deleteGiftAction} className="ml-auto">
                <input type="hidden" name="id" value={g.id} />
                <ConfirmSubmit message={`Remover “${g.name}”?`} className="min-h-10 rounded-lg px-3 text-xs font-semibold text-danger hover:bg-[#f7e4e2]">
                  Remover
                </ConfirmSubmit>
              </form>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
