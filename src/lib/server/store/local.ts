import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { normalizeSettings, type Settings } from "@/lib/settings";
import type { AppNotification, AuditEntry, GiftSuggestion, Guest, GuestWithRsvp, RsvpResponse } from "@/lib/types";
import type { GiftInput, GuestInput, NotificationInput, RsvpInput, Store } from "./types";

/**
 * Armazenamento local em JSON — usado só em desenvolvimento e nos testes automatizados
 * quando as credenciais do Supabase não estão configuradas. Não use em produção
 * (a Vercel não tem disco persistente).
 */

interface LocalGuest extends Guest {
  nameKey: string;
}

interface Db {
  settings: unknown;
  guests: LocalGuest[];
  rsvps: RsvpResponse[];
  gifts: GiftSuggestion[];
  notifications: AppNotification[];
  audit: AuditEntry[];
}

const emptyDb = (): Db => ({ settings: {}, guests: [], rsvps: [], gifts: [], notifications: [], audit: [] });

export function localDataDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.LOCAL_DATA_DIR || ".data");
}

const now = () => new Date().toISOString();
const strip = ({ nameKey: _nk, ...g }: LocalGuest): Guest => g; // eslint-disable-line @typescript-eslint/no-unused-vars

export class LocalStore implements Store {
  readonly kind = "local" as const;
  private queue: Promise<unknown> = Promise.resolve();
  private rate = new Map<string, { count: number; start: number }>();

  private get file() {
    return path.join(localDataDir(), "db.json");
  }

  private async read(): Promise<Db> {
    try {
      return { ...emptyDb(), ...JSON.parse(await fs.readFile(this.file, "utf8")) };
    } catch {
      return emptyDb();
    }
  }

  /** Serializa operações para não perder gravações concorrentes. */
  private tx<T>(fn: (db: Db) => T | Promise<T>, write = true): Promise<T> {
    const run = this.queue.then(async () => {
      const db = await this.read();
      const result = await fn(db);
      if (write) {
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        const tmp = `${this.file}.${process.pid}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(db, null, 2));
        await fs.rename(tmp, this.file);
      }
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private withRsvp(db: Db, g: LocalGuest): GuestWithRsvp {
    return { ...strip(g), rsvp: db.rsvps.find((r) => r.guestId === g.id) ?? null };
  }

  getSettings() {
    return this.tx((db) => normalizeSettings(db.settings), false);
  }
  saveSettings(settings: Settings) {
    return this.tx((db) => {
      db.settings = settings;
    });
  }

  listGuests() {
    return this.tx(
      (db) => [...db.guests].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((g) => this.withRsvp(db, g)),
      false,
    );
  }
  getGuestById(id: string) {
    return this.tx((db) => {
      const g = db.guests.find((x) => x.id === id);
      return g ? this.withRsvp(db, g) : null;
    }, false);
  }
  getGuestByToken(token: string) {
    return this.tx((db) => {
      const g = db.guests.find((x) => x.token === token);
      return g ? this.withRsvp(db, g) : null;
    }, false);
  }
  findGuestByNameKey(nameKey: string, phone: string) {
    return this.tx((db) => {
      const g = db.guests.find((x) => x.nameKey === nameKey && x.origin === "generic" && (!phone || x.phone === phone));
      return g ? this.withRsvp(db, g) : null;
    }, false);
  }
  createGuest(input: GuestInput, token: string, nameKey: string) {
    return this.tx((db) => {
      const g: LocalGuest = {
        id: randomUUID(),
        token,
        name: input.name,
        groupName: input.groupName,
        maxPeople: input.maxPeople,
        phone: input.phone,
        internalNotes: input.internalNotes,
        origin: input.origin ?? "personal",
        sentAt: null,
        nameKey,
        createdAt: now(),
        updatedAt: now(),
      };
      db.guests.push(g);
      return strip(g);
    });
  }
  updateGuest(id: string, patch: Partial<GuestInput> & { sentAt?: string | null; nameKey?: string; token?: string }) {
    return this.tx((db) => {
      const g = db.guests.find((x) => x.id === id);
      if (!g) return null;
      Object.assign(g, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)), { updatedAt: now() });
      return strip(g);
    });
  }
  deleteGuest(id: string) {
    return this.tx((db) => {
      const before = db.guests.length;
      db.guests = db.guests.filter((g) => g.id !== id);
      db.rsvps = db.rsvps.filter((r) => r.guestId !== id);
      db.notifications.forEach((n) => {
        if (n.guestId === id) n.guestId = null;
      });
      return db.guests.length < before;
    });
  }

  upsertRsvp(guestId: string, input: RsvpInput) {
    return this.tx((db) => {
      const g = db.guests.find((x) => x.id === guestId);
      if (!g) throw new Error("guest_not_found");
      const people = input.attending === "no" ? 0 : input.people;
      if (input.attending === "yes" && (people < 1 || people > g.maxPeople)) throw new Error("people_out_of_range");
      const existing = db.rsvps.find((r) => r.guestId === guestId) ?? null;
      const previous = existing ? { ...existing } : null;
      if (existing) {
        Object.assign(existing, { ...input, people, updatedAt: now() });
        return { response: { ...existing }, previous };
      }
      const created: RsvpResponse = { id: randomUUID(), guestId, ...input, people, createdAt: now(), updatedAt: now() };
      db.rsvps.push(created);
      return { response: created, previous };
    });
  }
  deleteRsvp(guestId: string) {
    return this.tx((db) => {
      db.rsvps = db.rsvps.filter((r) => r.guestId !== guestId);
    });
  }

  listGifts() {
    return this.tx((db) => [...db.gifts].sort((a, b) => a.position - b.position), false);
  }
  createGift(input: GiftInput) {
    return this.tx((db) => {
      const gift: GiftSuggestion = {
        id: randomUUID(),
        ...input,
        position: db.gifts.reduce((m, g) => Math.max(m, g.position), -1) + 1,
      };
      db.gifts.push(gift);
      return gift;
    });
  }
  updateGift(id: string, patch: Partial<GiftInput> & { position?: number }) {
    return this.tx((db) => {
      const g = db.gifts.find((x) => x.id === id);
      if (!g) return null;
      Object.assign(g, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
      return { ...g };
    });
  }
  deleteGift(id: string) {
    return this.tx((db) => {
      const before = db.gifts.length;
      db.gifts = db.gifts.filter((g) => g.id !== id);
      return db.gifts.length < before;
    });
  }

  listNotifications(limit: number) {
    return this.tx((db) => [...db.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit), false);
  }
  countUnreadNotifications() {
    return this.tx((db) => db.notifications.filter((n) => !n.readAt).length, false);
  }
  findUnreadNotificationForGuest(guestId: string) {
    return this.tx((db) => db.notifications.find((n) => n.guestId === guestId && !n.readAt) ?? null, false);
  }
  createNotification(input: NotificationInput) {
    return this.tx((db) => {
      const n: AppNotification = { id: randomUUID(), ...input, readAt: null, readBy: null, createdAt: now() };
      db.notifications.push(n);
      return n;
    });
  }
  updateNotification(id: string, patch: Partial<NotificationInput>) {
    return this.tx((db) => {
      const n = db.notifications.find((x) => x.id === id);
      if (n) Object.assign(n, patch, { createdAt: now() });
    });
  }
  markNotificationsRead(ids: string[] | "all", readBy: string) {
    return this.tx((db) => {
      for (const n of db.notifications) {
        if (!n.readAt && (ids === "all" || ids.includes(n.id))) {
          n.readAt = now();
          n.readBy = readBy;
        }
      }
    });
  }

  addAudit(entry: Omit<AuditEntry, "id" | "createdAt">) {
    return this.tx((db) => {
      db.audit.push({ id: randomUUID(), ...entry, createdAt: now() });
      if (db.audit.length > 2000) db.audit = db.audit.slice(-2000);
    });
  }
  listAudit(limit: number) {
    return this.tx((db) => [...db.audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit), false);
  }

  async hitRateLimit(key: string, limit: number, windowSeconds: number) {
    const t = Date.now();
    const entry = this.rate.get(key);
    if (!entry || t - entry.start > windowSeconds * 1000) {
      this.rate.set(key, { count: 1, start: t });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  }

  async saveMedia(fileName: string, _contentType: string, bytes: Uint8Array) {
    const dir = path.join(localDataDir(), "media");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, fileName), bytes);
    return `/api/media/${encodeURIComponent(fileName)}`;
  }

  async ping() {}
}
