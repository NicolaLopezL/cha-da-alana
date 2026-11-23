import { QuizOverview } from "@/components/admin/quiz/Overview";
import { adminState } from "@/lib/server/quiz/service";

export default async function QuizAdminPage() {
  return <QuizOverview initial={await adminState()} />;
}
