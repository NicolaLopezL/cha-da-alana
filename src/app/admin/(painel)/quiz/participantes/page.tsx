import { Panel } from "@/components/admin/parts";
import { ParticipantList } from "@/components/admin/quiz/Participants";
import { adminParticipants, adminState } from "@/lib/server/quiz/service";

export default async function QuizParticipantsPage() {
  const [state, list] = await Promise.all([adminState(), adminParticipants()]);
  return (
    <Panel>
      <div className="mb-4 flex justify-end">
        <a href="/admin/quiz/participantes/exportar" download className="inline-flex min-h-11 items-center rounded-xl border border-blush-300 px-4 text-sm font-semibold text-cocoa-700 hover:bg-blush-50" data-testid="export-csv">
          Exportar CSV
        </a>
      </div>
      <ParticipantList initial={list} total={state.questions} />
    </Panel>
  );
}
