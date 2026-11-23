import type { Metadata } from "next";
import { connection } from "next/server";
import { FinalRanking } from "@/components/quiz/FinalRanking";
import { requestLang } from "@/lib/server/quiz/request";
import { finalState, quizInfoOrNull } from "@/lib/server/quiz/service";
import type { FinalState } from "@/lib/quiz/types";

export const metadata: Metadata = { title: "Ranking final — Chá da Alana" };

export default async function FinalPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  await connection();
  const [state, info] = await Promise.all([
    finalState().catch((): FinalState => ({ published: false, status: "draft" })),
    quizInfoOrNull(),
  ]);
  return <FinalRanking state={state} texts={info?.texts ?? {}} initialLang={await requestLang((await searchParams).lang)} />;
}
