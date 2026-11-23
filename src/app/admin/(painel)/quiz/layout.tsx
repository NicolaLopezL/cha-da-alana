import { connection } from "next/server";
import { PageHeader, Panel } from "@/components/admin/parts";
import { QuizTabs, QuizToast } from "@/components/admin/quiz/kit";
import { QuizDbError } from "@/lib/server/quiz/db";
import { quizInfo } from "@/lib/server/quiz/service";

export default async function QuizAdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  let problem: QuizDbError["code"] | null = null;
  try {
    await quizInfo();
  } catch (e) {
    console.error("[quiz/painel]", e);
    problem = e instanceof QuizDbError ? e.code : "failed";
  }
  return (
    <>
      <PageHeader title="🎀 Quiz dos Papais" description="Quem conhece melhor os papais? Perguntas, participantes, ranking e resultados." />
      {problem ? (
        <Panel title={problem === "not_installed" ? "Falta criar as tabelas do quiz no banco" : "O quiz está indisponível no momento"}>
          <p className="text-sm text-cocoa-700">
            {problem === "not_installed" ? (
              <>
                No Supabase, abra <strong>SQL Editor → New query</strong>, cole o conteúdo de{" "}
                <code>supabase/migrations/20261123000000_quiz.sql</code> e clique em <strong>Run</strong>. Nada do que já existe é alterado.
              </>
            ) : (
              "Não foi possível falar com o banco de dados. Recarregue a página em instantes."
            )}
          </p>
        </Panel>
      ) : (
        <>
          <QuizTabs />
          {children}
          <QuizToast />
        </>
      )}
    </>
  );
}
