/** Utilitários compartilhados (cliente e servidor). Fuso fixo do evento: America/Sao_Paulo. */

export const EVENT_TZ = "America/Sao_Paulo";
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export interface DateParts {
  day: number;
  month: string;
  monthIndex: number;
  year: number;
  weekday: string;
}

export function dateParts(isoDate: string): DateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const year = +m[1];
  const monthIndex = +m[2] - 1;
  const day = +m[3];
  // Meio-dia UTC evita virar o dia por causa de fuso.
  const d = new Date(Date.UTC(year, monthIndex, day, 12));
  if (d.getUTCMonth() !== monthIndex) return null;
  return { day, monthIndex, month: MONTHS[monthIndex], year, weekday: WEEKDAYS[d.getUTCDay()] };
}

/** Instante do evento em ms (horário de Brasília, UTC-3, sem horário de verão desde 2019). */
export function eventInstant(isoDate: string, time: string): number | null {
  if (!dateParts(isoDate)) return null;
  const t = /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  const ms = Date.parse(`${isoDate}T${t}:00-03:00`);
  return Number.isNaN(ms) ? null : ms;
}

export function formatDateLong(isoDate: string): string {
  const p = dateParts(isoDate);
  return p ? `${p.day} de ${p.month} de ${p.year}` : "";
}

export function formatTime(time: string): string {
  if (!/^\d{2}:\d{2}$/.test(time)) return "";
  const [h, m] = time.split(":");
  return m === "00" ? `${+h}h` : `${+h}h${m}`;
}

/** Prazo de confirmação já passou? (fim do dia em Brasília) */
export function deadlinePassed(isoDate: string, now = Date.now()): boolean {
  if (!dateParts(isoDate)) return false;
  return now > Date.parse(`${isoDate}T23:59:59-03:00`);
}

export function fullAddress(s: { venueName: string; address: string; city: string }): string {
  return [s.address, s.city].filter(Boolean).join(", ");
}

export function googleMapsUrl(s: { mapsUrl: string; venueName: string; address: string; city: string }): string {
  if (s.mapsUrl) return s.mapsUrl;
  const q = [s.venueName, s.address, s.city].filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : "";
}

export function wazeUrl(s: { wazeUrl: string; venueName: string; address: string; city: string }): string {
  if (s.wazeUrl) return s.wazeUrl;
  const q = [s.address, s.city].filter(Boolean).join(", ");
  return q ? `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes` : "";
}

export function whatsappUrl(phoneDigits: string, message: string): string {
  const phone = phoneDigits.replace(/\D/g, "");
  if (!phone) return "";
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  const m = /^(\d{2})(\d{2})(\d{4,5})(\d{4})$/.exec(d);
  return m ? `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}` : d;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}
