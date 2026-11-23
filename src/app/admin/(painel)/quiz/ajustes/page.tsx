import { QuizSettings } from "@/components/admin/quiz/QuizSettings";
import { adminState } from "@/lib/server/quiz/service";

export default async function QuizSettingsPage() {
  return <QuizSettings state={await adminState()} />;
}
