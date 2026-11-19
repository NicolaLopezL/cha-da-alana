import { getAdmin } from "@/lib/server/auth";
import { baseUrl, inviteLink, STATUS_LABEL } from "@/lib/server/admin-data";
import { getStore } from "@/lib/server/store";
import { guestStatus } from "@/lib/types";

/** Exporta a lista de convidados em CSV (separador ";" e BOM para abrir certo no Excel). */
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return new Response("Não autorizado", { status: 401 });

  const [guests, base] = await Promise.all([getStore().listGuests(), baseUrl()]);
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita injeção de fórmulas
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ["Nome", "Família/grupo", "Máx. pessoas", "Telefone", "Situação", "Pessoas confirmadas", "Recado", "Origem da resposta", "Respondido em", "Observações", "Link"];
  const rows = guests.map((g) => [
    g.name,
    g.groupName,
    g.maxPeople,
    g.phone,
    STATUS_LABEL[guestStatus(g)],
    g.rsvp?.attending === "yes" ? g.rsvp.people : 0,
    g.rsvp?.message ?? "",
    g.rsvp ? { site: "Site", whatsapp_manual: "WhatsApp (manual)", admin: "Painel" }[g.rsvp.source] : "",
    g.rsvp ? new Date(g.rsvp.updatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
    g.internalNotes,
    inviteLink(base, g.token),
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="convidados-cha-da-alana-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
