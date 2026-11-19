import { AuditList, PageHeader, Panel } from "@/components/admin/parts";
import { getStore } from "@/lib/server/store";

export default async function HistoryPage() {
  const entries = await getStore().listAudit(300);
  return (
    <>
      <PageHeader title="Histórico" description="Quem mudou o quê e quando — respostas dos convidados e alterações feitas pelos papais." />
      <Panel>
        <AuditList entries={entries} />
      </Panel>
    </>
  );
}
