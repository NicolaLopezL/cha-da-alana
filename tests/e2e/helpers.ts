import { expect, type Page, type TestInfo } from "@playwright/test";
import { TEST_ADMIN } from "../../playwright.config";

export async function login(page: Page, admin = TEST_ADMIN) {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(admin.email);
  await page.getByLabel("Senha", { exact: true }).fill(admin.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Nome único por projeto/teste para os testes não interferirem entre si. */
export function uniq(testInfo: TestInfo, base: string) {
  const tag = testInfo.project.name.split("-")[0];
  return `${base} ${tag} ${Math.random().toString(36).slice(2, 6)}`;
}

export async function createGuest(page: Page, name: string, maxPeople: number, opts: { group?: string; phone?: string } = {}) {
  await page.goto("/admin/convidados");
  const form = page.locator("form", { has: page.getByRole("button", { name: "Adicionar convidado" }) });
  await form.getByLabel("Nome do convidado").fill(name);
  if (opts.group) await form.getByLabel("Família ou grupo").fill(opts.group);
  await form.getByLabel("Máximo de pessoas").fill(String(maxPeople));
  if (opts.phone) await form.getByLabel("Telefone (opcional)").fill(opts.phone);
  await form.getByRole("button", { name: "Adicionar convidado" }).click();
  await expect(form.getByTestId("form-feedback")).toContainText("adicionado");
  const row = page.getByTestId("guest-row").filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "Editar" }).click();
  const link = (await page.getByTestId("invite-link").textContent())!.trim();
  return { link, path: new URL(link).pathname, detailUrl: page.url() };
}

/** Salva campos de configuração numa página do painel (preenche pelo rótulo e clica no botão). */
export async function saveSettings(page: Page, url: string, button: string, fields: Record<string, string>) {
  await page.goto(url);
  const form = page.locator("form", { has: page.getByRole("button", { name: button }) });
  for (const [label, value] of Object.entries(fields)) await form.getByLabel(label, { exact: true }).fill(value);
  await form.getByRole("button", { name: button }).click();
  await expect(form.getByTestId("form-feedback")).toContainText(/salvas|Nada mudou/);
}

export async function openEnvelope(page: Page) {
  await expect(page.getByTestId("envelope-scene")).toBeVisible();
  // force: o envelope flutua continuamente (o WebKit nunca o considera "estável")
  await page.waitForLoadState("networkidle");
  await page.getByTestId("seal").click({ force: true });
  await expect(page.getByTestId("envelope-scene")).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Alana" })).toBeVisible();
}

export function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}
