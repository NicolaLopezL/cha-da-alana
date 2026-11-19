import type { Metadata } from "next";
import { connection } from "next/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdminPage } from "@/lib/server/auth";
import { getStore } from "@/lib/server/store";
import { logoutAction } from "../actions";

export const metadata: Metadata = {
  title: "Painel — Chá da Alana",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await connection();
  const admin = await requireAdminPage();
  const unread = await getStore().countUnreadNotifications();
  const localMode = getStore().kind === "local";

  return (
    <div className="min-h-dvh bg-[#faf6f1] lg:flex">
      <AdminNav unread={unread} adminName={admin.name} logout={logoutAction} />
      <main className="min-w-0 flex-1 px-4 pb-[calc(var(--safe-bottom)+3rem)] pt-6 sm:px-8 lg:py-10">
        {localMode && (
          <p className="mx-auto mb-6 max-w-5xl rounded-xl border border-champagne-400/40 bg-champagne-200/30 px-4 py-2 text-xs text-cocoa-700">
            Modo local de desenvolvimento: os dados ficam em <code>.data/db.json</code>. Em produção, configure o Supabase.
          </p>
        )}
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
