import type { Metadata } from "next";
import { QrScreen } from "@/components/quiz/QrScreen";
import { quizQrSvg, quizUrl } from "@/lib/server/quiz/qr";
import { requestLang } from "@/lib/server/quiz/request";

export const metadata: Metadata = { title: "QR Code do Quiz — Chá da Alana" };

export default async function QrPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const url = await quizUrl();
  return <QrScreen svg={await quizQrSvg(url)} url={url} initialLang={await requestLang((await searchParams).lang)} />;
}
