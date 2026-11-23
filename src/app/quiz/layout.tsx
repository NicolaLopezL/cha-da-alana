import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "Quiz — Chá da Alana",
  description: "Quem conhece melhor os papais? Participe do Quiz do Chá da Alana!",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Quem conhece melhor os papais? 🧸",
    description: "Participe do Quiz do Chá da Alana!",
    type: "website",
    locale: "pt_BR",
  },
};

export default async function QuizLayout({ children }: { children: React.ReactNode }) {
  await connection(); // sempre dinâmico
  return children;
}
