import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import webpush from "web-push";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

describe("notificações push", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "alana-push-"));
    process.env.LOCAL_DATA_DIR = dir;
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const sub = (n: number) => ({
    endpoint: `https://push.example.com/send/${n}`,
    keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
  });

  it("gera as chaves uma vez só, guarda inscrições e recusa dados inválidos", async () => {
    const push = await import("@/lib/server/push");
    const k1 = await push.pushPublicKey();
    expect(k1).toMatch(/^[A-Za-z0-9_-]{80,}$/);
    expect(await push.pushPublicKey()).toBe(k1);
    expect(push.isValidSubscription({ endpoint: "http://x", keys: {} })).toBe(false);
    expect(push.isValidSubscription(sub(1))).toBe(true);
    await push.savePushSubscription(sub(1), "a@x.com", "iPhone");
    await push.savePushSubscription(sub(2), "b@x.com", "Android");
    await push.savePushSubscription(sub(2), "b@x.com", "Android"); // mesmo aparelho não duplica
    expect((await push.listPushSubscriptions()).length).toBe(2);
  });

  it("envia para todos e remove aparelhos que saíram (410)", async () => {
    const push = await import("@/lib/server/push");
    const spy = vi.spyOn(webpush, "sendNotification").mockImplementation(async (s) => {
      if (s.endpoint.endsWith("/2")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      return { statusCode: 201, body: "", headers: {} };
    });
    const result = await push.sendPushNotice({ guestName: "Ana", title: "Ana confirmou presença", body: "2 pessoas" });
    expect(result).toBe("push: 1/2 enviados");
    const payload = JSON.parse(String(spy.mock.calls[0][1]));
    expect(payload).toMatchObject({ title: "Ana confirmou presença", body: "2 pessoas", url: "/admin/notificacoes" });
    expect((await push.listPushSubscriptions()).map((s) => s.device)).toEqual(["iPhone"]);
    spy.mockRestore();
  });
});
