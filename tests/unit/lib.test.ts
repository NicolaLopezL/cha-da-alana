import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  dateParts,
  deadlinePassed,
  eventInstant,
  fillTemplate,
  googleMapsUrl,
  wazeUrl,
  whatsappUrl,
} from "@/lib/format";
import { defaultSettings, normalizeSettings, settingsSchema, toPublicSettings } from "@/lib/settings";
import { isValidTokenShape, nameKey, newInviteToken } from "@/lib/server/security";
import { LocalStore } from "@/lib/server/store/local";

describe("datas", () => {
  it("extrai dia, mês, ano e dia da semana sem inventar", () => {
    expect(dateParts("")).toBeNull();
    expect(dateParts("2027-02-30")).toBeNull();
    expect(dateParts("2099-03-20")).toEqual({ day: 20, monthIndex: 2, month: "março", year: 2099, weekday: "sexta-feira" });
  });
  it("usa o horário de Brasília", () => {
    expect(new Date(eventInstant("2027-05-01", "15:00")!).toISOString()).toBe("2027-05-01T18:00:00.000Z");
  });
  it("prazo vale até o fim do dia", () => {
    const end = Date.parse("2027-05-01T23:59:59-03:00");
    expect(deadlinePassed("2027-05-01", end)).toBe(false);
    expect(deadlinePassed("2027-05-01", end + 2000)).toBe(true);
    expect(deadlinePassed("")).toBe(false);
  });
});

describe("links externos", () => {
  const place = { venueName: "Espaço", address: "Rua A, 1", city: "Cidade", mapsUrl: "", wazeUrl: "" };
  it("gera Google Maps e Waze a partir do endereço", () => {
    expect(googleMapsUrl(place)).toBe("https://www.google.com/maps/search/?api=1&query=Espa%C3%A7o%2C%20Rua%20A%2C%201%2C%20Cidade");
    expect(wazeUrl(place)).toBe("https://waze.com/ul?q=Rua%20A%2C%201%2C%20Cidade&navigate=yes");
    expect(googleMapsUrl({ ...place, venueName: "", address: "", city: "" })).toBe("");
  });
  it("prefere links próprios quando configurados", () => {
    expect(googleMapsUrl({ ...place, mapsUrl: "https://maps.app.goo.gl/x" })).toBe("https://maps.app.goo.gl/x");
  });
  it("monta o link do WhatsApp com a mensagem personalizada", () => {
    const msg = fillTemplate("Olá! Aqui é {nome}.", { nome: "Ana" });
    expect(whatsappUrl("+55 (11) 90000-0000", msg)).toBe(`https://wa.me/5511900000000?text=${encodeURIComponent("Olá! Aqui é Ana.")}`);
    expect(whatsappUrl("", msg)).toBe("");
  });
});

describe("configurações", () => {
  it("padrões não trazem data, local nem telefones", () => {
    expect(defaultSettings.eventDate).toBe("");
    expect(defaultSettings.address).toBe("");
    expect(defaultSettings.fatherPhone).toBe("");
    expect(defaultSettings.registryUrl).toBe("");
    expect(defaultSettings.genericInviteEnabled).toBe(false);
  });
  it("adiciona DDI 55 e recusa telefones inválidos", () => {
    expect(settingsSchema.parse({ motherPhone: "(11) 98888-7777" }).motherPhone).toBe("5511988887777");
    expect(settingsSchema.safeParse({ motherPhone: "123" }).success).toBe(false);
  });
  it("só aceita links https", () => {
    expect(settingsSchema.safeParse({ registryUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(settingsSchema.safeParse({ registryUrl: "http://x.com" }).success).toBe(false);
    expect(settingsSchema.safeParse({ registryUrl: "https://x.com/lista" }).success).toBe(true);
  });
  it("ignora campo corrompido sem perder os demais", () => {
    const s = normalizeSettings({ venueName: "Salão", eventDate: "data-ruim" });
    expect(s.venueName).toBe("Salão");
    expect(s.eventDate).toBe("");
  });
  it("não envia e-mails de notificação ao navegador", () => {
    const pub = toPublicSettings({ ...defaultSettings, notifyEmails: ["a@b.com"] });
    expect(pub).not.toHaveProperty("notifyEmails");
  });
});

describe("tokens e duplicidade", () => {
  it("tokens são aleatórios, longos e não sequenciais", () => {
    const set = new Set(Array.from({ length: 500 }, newInviteToken));
    expect(set.size).toBe(500);
    for (const t of set) expect(isValidTokenShape(t)).toBe(true);
    expect(isValidTokenShape("123")).toBe(false);
    expect(isValidTokenShape("../../etc/passwd-aaaaaaaaaaaaa")).toBe(false);
  });
  it("normaliza nomes para evitar respostas duplicadas", () => {
    expect(nameKey("  JOSÉ   da Silva ")).toBe(nameKey("jose da silva"));
  });
});

describe("LocalStore", () => {
  let dir: string;
  let store: LocalStore;
  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "alana-"));
    process.env.LOCAL_DATA_DIR = dir;
    store = new LocalStore();
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("uma resposta por convite, respeitando o limite de pessoas", async () => {
    const g = await store.createGuest({ name: "Teste", groupName: "", maxPeople: 2, phone: "", internalNotes: "" }, newInviteToken(), "teste");
    await expect(store.upsertRsvp(g.id, { attending: "yes", people: 3, message: "", source: "site" })).rejects.toThrow("people_out_of_range");
    const first = await store.upsertRsvp(g.id, { attending: "yes", people: 2, message: "", source: "site" });
    expect(first.previous).toBeNull();
    const second = await store.upsertRsvp(g.id, { attending: "no", people: 2, message: "", source: "site" });
    expect(second.previous?.attending).toBe("yes");
    expect(second.response.people).toBe(0);
    const all = await store.listGuests();
    expect(all.find((x) => x.id === g.id)?.rsvp?.attending).toBe("no");
  });

  it("gravações concorrentes não se perdem", async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        store.createGuest({ name: `C${i}`, groupName: "", maxPeople: 1, phone: "", internalNotes: "" }, newInviteToken(), `c${i}`),
      ),
    );
    expect((await store.listGuests()).filter((g) => g.name.startsWith("C")).length).toBe(20);
  });

  it("limita requisições abusivas", async () => {
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await store.hitRateLimit("k", 3, 60));
    expect(results).toEqual([true, true, true, false, false]);
  });
});
