import type { Metadata } from "next";
import { LiveBoard } from "@/components/quiz/LiveBoard";
import { requestLang } from "@/lib/server/quiz/request";
import { liveState, quizInfoOrNull } from "@/lib/server/quiz/service";

export const metadata: Metadata = { title: "Ranking ao vivo — Chá da Alana" };

/** Página pública (sem login) para televisão, projetor, computador e celular. ?tv=1 = modo televisão. */
export default async function LivePage({ searchParams }: { searchParams: Promise<{ tv?: string; lang?: string }> }) {
  const { tv, lang } = await searchParams;
  const [state, info] = await Promise.all([liveState().catch(() => null), quizInfoOrNull()]);
  return <LiveBoard key={tv ? "tv" : "page"} initial={state} texts={info?.texts ?? {}} initialLang={await requestLang(lang)} tv={tv === "1"} />;
}
