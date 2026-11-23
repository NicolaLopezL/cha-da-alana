import { QuestionManager } from "@/components/admin/quiz/Questions";
import { adminQuestions, adminState } from "@/lib/server/quiz/service";

export default async function QuizQuestionsPage() {
  const [state, questions] = await Promise.all([adminState(), adminQuestions("main")]);
  return <QuestionManager questions={questions} round="main" status={state.status} defaultPoints={state.defaultPoints} />;
}
