import type { Metadata, Viewport } from "next";

/** Metadados do app do painel (instalável na tela de início, com ícone e notificações). */
export const metadata: Metadata = {
  manifest: "/painel.webmanifest",
  icons: { apple: "/painel-icon/180" },
  appleWebApp: { capable: true, title: "Chá da Alana", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#faf6f1" };

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
