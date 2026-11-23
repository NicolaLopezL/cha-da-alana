"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/admin", label: "Resumo" },
  { href: "/admin/convidados", label: "Convidados" },
  { href: "/admin/notificacoes", label: "Notificações", badge: true },
  { href: "/admin/evento", label: "Evento" },
  { href: "/admin/personalizar", label: "Textos e visual" },
  { href: "/admin/presentes", label: "Presentes" },
  { href: "/admin/quiz", label: "🎀 Quiz dos Papais" },
  { href: "/admin/historico", label: "Histórico" },
];

export function AdminNav({ unread, adminName, logout }: { unread: number; adminName: string; logout: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  const items = (
    <ul className="space-y-1">
      {LINKS.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            onClick={() => setOpen(false)}
            aria-current={isActive(l.href) ? "page" : undefined}
            className={`flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-semibold transition ${
              isActive(l.href) ? "bg-blush-100 text-cocoa-900" : "text-cocoa-500 hover:bg-blush-50 hover:text-cocoa-700"
            }`}
          >
            {l.label}
            {l.badge && unread > 0 && (
              <span className="badge bg-rose-600 text-paper" aria-label={`${unread} não lidas`}>
                {unread}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );

  const footer = (
    <div className="mt-6 border-t border-blush-100 pt-4">
      <p className="px-3 text-xs text-cocoa-500">
        Conectado como <strong className="text-cocoa-700">{adminName}</strong>
      </p>
      <div className="mt-2 flex flex-col gap-1">
        <a href="/" target="_blank" className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-cocoa-500 hover:bg-blush-50">
          Ver o convite ↗
        </a>
        <form action={logout}>
          <button type="submit" className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-cocoa-500 hover:bg-blush-50">
            Sair
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* celular */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-blush-100 bg-paper/95 px-4 pb-3 pt-[calc(var(--safe-top)+0.75rem)] backdrop-blur lg:hidden">
        <Link href="/admin" className="script text-3xl text-rose-600">
          Alana
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="admin-menu"
          className="relative flex min-h-11 items-center gap-2 rounded-xl border border-blush-200 px-4 text-sm font-semibold text-cocoa-700"
        >
          Menu
          {unread > 0 && <span className="h-2 w-2 rounded-full bg-rose-600" aria-label="Há notificações não lidas" />}
        </button>
      </header>
      {open && (
        <nav id="admin-menu" aria-label="Painel" className="border-b border-blush-100 bg-paper px-4 py-4 lg:hidden">
          {items}
          {footer}
        </nav>
      )}

      {/* computador */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <nav aria-label="Painel" className="sticky top-0 flex h-dvh flex-col border-r border-blush-100 bg-paper px-4 py-8">
          <Link href="/admin" className="mb-1 px-3">
            <span className="script text-4xl text-rose-600">Alana</span>
          </Link>
          <p className="eyebrow mb-8 px-3 !text-[0.6rem]">Painel do chá</p>
          <div className="flex-1 overflow-y-auto">{items}</div>
          {footer}
        </nav>
      </aside>
    </>
  );
}
