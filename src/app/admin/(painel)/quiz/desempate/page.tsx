import { Tiebreak } from "@/components/admin/quiz/Tiebreak";
import { adminQuestions, adminState } from "@/lib/server/quiz/service";

export default async function QuizTiebreakPage() {
  const [state, extras] = await Promise.all([adminState(), adminQuestions("extra")]);
  return <Tiebreak initial={state} extras={extras} />;
}
