import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/server/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar — Chá da Alana", robots: { index: false, follow: false } };

export default async function LoginPage() {
  await connection();
  if (await getAdmin()) redirect("/admin");
  return (
    <main className="paper-ivory flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="script text-6xl text-rose-600">Alana</p>
          <p className="eyebrow mt-2">Painel dos papais</p>
        </div>
        <div className="paper rounded-[24px] p-6 sm:p-8" style={{ boxShadow: "var(--shadow-paper)" }}>
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-cocoa-500">Acesso restrito aos responsáveis pelo evento.</p>
      </div>
    </main>
  );
}
