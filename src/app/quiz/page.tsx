import { QuizApp } from "@/components/quiz/QuizApp";
import { loadQuizState, requestLang } from "@/lib/server/quiz/request";

export default async function QuizPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = await requestLang((await searchParams).lang);
  // Se o banco do quiz estiver indisponível, mostra a tela de espera (que tenta de novo sozinha).
  const state = await loadQuizState().catch((e) => {
    console.error("[quiz]", e);
    return { info: null, session: null, questions: [] };
  });
  return <QuizApp initial={state} initialLang={lang} />;
}
