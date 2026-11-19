import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeSettings, type Settings } from "@/lib/settings";
import type { AppNotification, AuditEntry, GiftSuggestion, Guest, GuestWithRsvp, RsvpResponse } from "@/lib/types";
import type { GiftInput, GuestInput, NotificationInput, RsvpInput, Store } from "./types";

/* Mapeamento linhas (snake_case) <-> domínio (camelCase) */
type Row = Record<string, unknown>;

const toGuest = (r: Row): Guest => ({
  id: r.id as string,
  token: r.token as string,
  name: r.name as string,
  groupName: (r.group_name as string) ?? "",
  maxPeople: r.max_people as number,
  phone: (r.phone as string) ?? "",
  internalNotes: (r.internal_notes as string) ?? "",
  sentAt: (r.sent_at as string) ?? null,
  origin: r.origin as Guest["origin"],
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const toRsvp = (r: Row): RsvpResponse => ({
  id: r.id as string,
  guestId: r.guest_id as string,
  attending: r.attending as RsvpResponse["attending"],
  people: r.people as number,
  message: (r.message as string) ?? "",
  source: r.source as RsvpResponse["source"],
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const toGuestWithRsvp = (r: Row): GuestWithRsvp => {
  const rel = r.rsvp_responses as Row | Row[] | null | undefined;
  const rsvpRow = Array.isArray(rel) ? rel[0] : rel;
  return { ...toGuest(r), rsvp: rsvpRow ? toRsvp(rsvpRow) : null };
};

const toGift = (r: Row): GiftSuggestion => ({
  id: r.id as string,
  name: r.name as string,
  brand: (r.brand as string) ?? "",
  size: (r.size as string) ?? "",
  notes: (r.notes as string) ?? "",
  position: r.position as number,
  active: r.active as boolean,
});

const toNotification = (r: Row): AppNotification => ({
  id: r.id as string,
  kind: r.kind as AppNotification["kind"],
  guestId: (r.guest_id as string) ?? null,
  title: r.title as string,
  body: (r.body as string) ?? "",
  readAt: (r.read_at as string) ?? null,
  readBy: (r.read_by as string) ?? null,
  createdAt: r.created_at as string,
});

function guestPatchToRow(patch: Partial<GuestInput> & { sentAt?: string | null; nameKey?: string; token?: string }): Row {
  const row: Row = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.groupName !== undefined) row.group_name = patch.groupName;
  if (patch.maxPeople !== undefined) row.max_people = patch.maxPeople;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.internalNotes !== undefined) row.internal_notes = patch.internalNotes;
  if (patch.origin !== undefined) row.origin = patch.origin;
  if (patch.sentAt !== undefined) row.sent_at = patch.sentAt;
  if (patch.nameKey !== undefined) row.name_key = patch.nameKey;
  if (patch.token !== undefined) row.token = patch.token;
  return row;
}

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    const err = new Error(res.error.message.includes("people_out_of_range") ? "people_out_of_range" : res.error.message);
    (err as Error & { code?: string }).code = res.error.code;
    throw err;
  }
  return res.data;
}

const GUEST_SELECT = "*, rsvp_responses(*)";

export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  private db: SupabaseClient;

  constructor(url: string, secretKey: string) {
    this.db = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    });
  }

  async getSettings(): Promise<Settings> {
    const data = check(await this.db.from("event_settings").select("data").eq("id", 1).maybeSingle());
    return normalizeSettings(data?.data);
  }
  async saveSettings(settings: Settings, actor: string) {
    check(
      await this.db
        .from("event_settings")
        .upsert({ id: 1, data: settings, updated_at: new Date().toISOString(), updated_by: actor }),
    );
  }

  async listGuests() {
    const rows = check(await this.db.from("guests").select(GUEST_SELECT).order("name"));
    return (rows as Row[]).map(toGuestWithRsvp);
  }
  async getGuestById(id: string) {
    const row = check(await this.db.from("guests").select(GUEST_SELECT).eq("id", id).maybeSingle());
    return row ? toGuestWithRsvp(row as Row) : null;
  }
  async getGuestByToken(token: string) {
    const row = check(await this.db.from("guests").select(GUEST_SELECT).eq("token", token).maybeSingle());
    return row ? toGuestWithRsvp(row as Row) : null;
  }
  async findGuestByNameKey(nameKey: string, phone: string) {
    let q = this.db.from("guests").select(GUEST_SELECT).eq("name_key", nameKey).eq("origin", "generic");
    if (phone) q = q.eq("phone", phone);
    const rows = check(await q.limit(1));
    return (rows as Row[])[0] ? toGuestWithRsvp((rows as Row[])[0]) : null;
  }
  async createGuest(input: GuestInput, token: string, nameKey: string) {
    const row = check(
      await this.db
        .from("guests")
        .insert({ token, name_key: nameKey, ...guestPatchToRow(input), origin: input.origin ?? "personal" })
        .select()
        .single(),
    );
    return toGuest(row as Row);
  }
  async updateGuest(id: string, patch: Partial<GuestInput> & { sentAt?: string | null; nameKey?: string; token?: string }) {
    const row = check(
      await this.db
        .from("guests")
        .update({ ...guestPatchToRow(patch), updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .maybeSingle(),
    );
    return row ? toGuest(row as Row) : null;
  }
  async deleteGuest(id: string) {
    const rows = check(await this.db.from("guests").delete().eq("id", id).select("id"));
    return (rows as Row[]).length > 0;
  }

  async upsertRsvp(guestId: string, input: RsvpInput) {
    const prevRow = check(await this.db.from("rsvp_responses").select("*").eq("guest_id", guestId).maybeSingle());
    const row = check(
      await this.db
        .from("rsvp_responses")
        .upsert(
          {
            guest_id: guestId,
            attending: input.attending,
            people: input.attending === "no" ? 0 : input.people,
            message: input.message,
            source: input.source,
          },
          { onConflict: "guest_id" },
        )
        .select()
        .single(),
    );
    return { response: toRsvp(row as Row), previous: prevRow ? toRsvp(prevRow as Row) : null };
  }
  async deleteRsvp(guestId: string) {
    check(await this.db.from("rsvp_responses").delete().eq("guest_id", guestId));
  }

  async listGifts() {
    const rows = check(await this.db.from("gift_suggestions").select("*").order("position").order("created_at"));
    return (rows as Row[]).map(toGift);
  }
  async createGift(input: GiftInput) {
    const last = check(
      await this.db.from("gift_suggestions").select("position").order("position", { ascending: false }).limit(1),
    ) as Row[];
    const position = last[0] ? (last[0].position as number) + 1 : 0;
    const row = check(await this.db.from("gift_suggestions").insert({ ...input, position }).select().single());
    return toGift(row as Row);
  }
  async updateGift(id: string, patch: Partial<GiftInput> & { position?: number }) {
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const row = check(await this.db.from("gift_suggestions").update(clean).eq("id", id).select().maybeSingle());
    return row ? toGift(row as Row) : null;
  }
  async deleteGift(id: string) {
    const rows = check(await this.db.from("gift_suggestions").delete().eq("id", id).select("id"));
    return (rows as Row[]).length > 0;
  }

  async listNotifications(limit: number) {
    const rows = check(await this.db.from("notifications").select("*").order("created_at", { ascending: false }).limit(limit));
    return (rows as Row[]).map(toNotification);
  }
  async countUnreadNotifications() {
    const res = await this.db.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    check(res);
    return res.count ?? 0;
  }
  async findUnreadNotificationForGuest(guestId: string) {
    const rows = check(
      await this.db.from("notifications").select("*").eq("guest_id", guestId).is("read_at", null).limit(1),
    ) as Row[];
    return rows[0] ? toNotification(rows[0]) : null;
  }
  async createNotification(input: NotificationInput) {
    const row = check(
      await this.db
        .from("notifications")
        .insert({ kind: input.kind, guest_id: input.guestId, title: input.title, body: input.body })
        .select()
        .single(),
    );
    return toNotification(row as Row);
  }
  async updateNotification(id: string, patch: Partial<NotificationInput>) {
    const row: Row = { created_at: new Date().toISOString() };
    if (patch.kind) row.kind = patch.kind;
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.body !== undefined) row.body = patch.body;
    check(await this.db.from("notifications").update(row).eq("id", id));
  }
  async markNotificationsRead(ids: string[] | "all", readBy: string) {
    let q = this.db
      .from("notifications")
      .update({ read_at: new Date().toISOString(), read_by: readBy })
      .is("read_at", null);
    if (ids !== "all") q = q.in("id", ids);
    check(await q);
  }

  async addAudit(entry: Omit<AuditEntry, "id" | "createdAt">) {
    check(
      await this.db.from("audit_log").insert({
        actor: entry.actor,
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entityId,
        details: entry.details,
      }),
    );
  }
  async listAudit(limit: number) {
    const rows = check(await this.db.from("audit_log").select("*").order("created_at", { ascending: false }).limit(limit));
    return (rows as Row[]).map((r) => ({
      id: r.id as string,
      actor: r.actor as string,
      action: r.action as string,
      entity: r.entity as string,
      entityId: (r.entity_id as string) ?? null,
      details: (r.details as Record<string, unknown>) ?? {},
      createdAt: r.created_at as string,
    }));
  }

  async hitRateLimit(key: string, limit: number, windowSeconds: number) {
    const res = await this.db.rpc("hit_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
    if (res.error) {
      // Falha no limitador não pode derrubar a confirmação de presença.
      console.error("[rate-limit]", res.error.message);
      return true;
    }
    return res.data === true;
  }

  async saveMedia(fileName: string, contentType: string, bytes: Uint8Array) {
    check(await this.db.storage.from("media").upload(fileName, bytes, { contentType, upsert: false }));
    return this.db.storage.from("media").getPublicUrl(fileName).data.publicUrl;
  }

  async ping() {
    check(await this.db.rpc("keepalive"));
  }
}
