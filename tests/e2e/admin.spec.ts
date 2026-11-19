import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { TEST_ADMIN, TEST_ADMIN_2 } from "../../playwright.config";
import { createGuest, login, openEnvelope, uniq } from "./helpers";

test.describe("Painel administrativo", () => {
  test("rotas do painel exigem login; senha errada é recusada", async ({ page, request }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/admin/convidados");
    await expect(page).toHaveURL(/\/admin\/login$/);

    const csv = await request.get("/admin/convidados/exportar", { maxRedirects: 0 });
    expect([302, 307, 401]).toContain(csv.status());

    // Cookie forjado não dá acesso
    await page.context().addCookies([{ name: "alana_admin", value: "eyJlIjoieCJ9.assinatura-falsa", url: "http://localhost:3100" }]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.getByLabel("E-mail").fill(TEST_ADMIN.email);
    await page.getByLabel("Senha", { exact: true }).fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "incorretos" })).toContainText("E-mail ou senha incorretos.");
  });

  test("os dois responsáveis entram com contas próprias e veem os mesmos dados", async ({ browser }, testInfo) => {
    const a = await browser.newContext();
    const b = await browser.newContext();
    const pa = await a.newPage();
    const pb = await b.newPage();
    await login(pa, TEST_ADMIN);
    await login(pb, TEST_ADMIN_2);
    const name = uniq(testInfo, "Convidado Compartilhado");
    await createGuest(pa, name, 2);
    await pb.goto(`/admin/convidados?q=${encodeURIComponent(name)}`);
    await expect(pb.getByTestId("guest-row").filter({ hasText: name })).toHaveCount(1);
    await expect(pb.getByText(`Conectado como`).first()).toBeAttached();
    await a.close();
    await b.close();
  });

  test("gestão de convidados: criar, pesquisar, editar, enviar, registrar WhatsApp, notificações, CSV e excluir", async ({ page, context }, testInfo) => {
    await login(page);
    const name = uniq(testInfo, "Família Silva");
    const { link, detailUrl } = await createGuest(page, name, 4, { group: "Silva", phone: "(21) 97777-6666" });
    expect(link).toMatch(/\/convite\/[A-Za-z0-9_-]{24}$/); // token aleatório, não sequencial

    // Pesquisar e filtrar
    await page.goto("/admin/convidados");
    await page.getByLabel("Pesquisar convidado").fill(name);
    await page.getByLabel("Filtrar por situação").selectOption("pending");
    await page.getByRole("button", { name: "Filtrar" }).click();
    const row = page.getByTestId("guest-row").filter({ hasText: name });
    await expect(row).toHaveCount(1);
    await expect(row.getByRole("link", { name: "Enviar no WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/5521977776666\?text=/);
    await row.getByRole("button", { name: "Marcar como enviado" }).click();
    await expect(page.getByTestId("guest-row").filter({ hasText: name })).toHaveCount(0); // saiu do filtro "não enviados"
    await page.getByLabel("Filtrar por situação").selectOption("sent");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByTestId("guest-row").filter({ hasText: name })).toHaveCount(1);

    // Editar
    await page.goto(detailUrl);
    const dataForm = page.locator("form", { has: page.getByRole("button", { name: "Salvar", exact: true }) });
    await dataForm.getByLabel("Máximo de pessoas").fill("5");
    await dataForm.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(dataForm.getByTestId("form-feedback")).toContainText("Dados salvos");

    // Registro manual de confirmação recebida pelo WhatsApp (com limite)
    const manual = page.locator("form", { has: page.getByRole("button", { name: "Registrar resposta" }) });
    // Remove o limite do navegador para provar que o servidor também valida
    await manual.getByLabel(/Pessoas \(máx/).evaluate((el) => el.removeAttribute("max"));
    await manual.getByLabel(/Pessoas \(máx/).fill("9");
    await manual.getByRole("button", { name: "Registrar resposta" }).click();
    await expect(manual.getByTestId("form-feedback")).toContainText("entre 1 e 5");
    await manual.getByLabel(/Pessoas \(máx/).fill("4");
    await manual.getByRole("button", { name: "Registrar resposta" }).click();
    await expect(manual.getByTestId("form-feedback")).toContainText("Resposta registrada");
    await page.reload();
    await expect(page.getByText("Registrado manualmente (WhatsApp)")).toBeVisible();

    // Notificação criada; marcar como lida
    await page.goto("/admin/notificacoes");
    const item = page.getByTestId("notification-list").locator("li", { hasText: name });
    await expect(item).toHaveCount(1);
    await expect(item).toContainText("4 pessoas");
    await item.getByRole("button", { name: "Marcar como lida" }).click();
    await expect(page.getByTestId("notification-list").locator("li", { hasText: name })).toContainText(`lida por ${TEST_ADMIN.name}`);

    // O link antigo funciona; gerar novo link invalida o anterior
    const g = await context.newPage();
    await g.goto(new URL(link).pathname);
    await openEnvelope(g);
    await expect(g.getByTestId("rsvp-summary")).toContainText("4 pessoas");
    await page.goto(detailUrl);
    await page.getByRole("button", { name: /Gerar novo link/ }).click();
    await expect(page.getByText("Novo link gerado")).toBeVisible();
    const res = await g.goto(new URL(link).pathname);
    expect(res?.status()).toBe(404);

    // Exportar CSV (autenticado)
    const csv = await page.request.get("/admin/convidados/exportar");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const body = await csv.text();
    expect(body).toContain(name);
    expect(body).toContain("Confirmado");

    // Histórico registra quem fez
    await page.goto("/admin/historico");
    await expect(page.getByText(name).first()).toBeVisible();

    // Excluir
    await page.goto(detailUrl);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Excluir convidado" }).click();
    await expect(page).toHaveURL(/\/admin\/convidados$/);
    await expect(page.getByTestId("guest-row").filter({ hasText: name })).toHaveCount(0);
  });

  test("painel instalável no celular, com avisos push", async ({ page, request }) => {
    const manifest = await (await request.get("/painel.webmanifest")).json();
    expect(manifest).toMatchObject({ start_url: "/admin", scope: "/admin", display: "standalone" });
    const icon = await request.get("/painel-icon/192");
    expect(icon.headers()["content-type"]).toBe("image/png");
    expect((await request.get("/painel-icon/7")).status()).toBe(404);
    expect(await (await request.get("/painel-sw.js")).text()).toContain("showNotification");

    await login(page);
    await page.goto("/admin/notificacoes");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/painel.webmanifest");
    await expect(page.getByRole("heading", { name: "Avisos no celular" })).toBeVisible();
    // Cada navegador mostra o caminho certo: botão para ativar, ou o passo a passo do iPhone
    const toggle = page.getByTestId("push-toggle");
    await expect(toggle).not.toHaveAttribute("data-state", "loading");
    const state = await toggle.getAttribute("data-state");
    if (state === "off") await expect(page.getByTestId("push-enable")).toBeVisible();
    if (state === "ios-install") await expect(toggle).toContainText("Adicionar à Tela de Início");
  });

  test("dashboard soma confirmados e acompanhantes", async ({ page }, testInfo) => {
    await login(page);
    const before = await page.getByTestId("stats").innerText();
    const n = (label: string, txt: string) => Number(new RegExp(`${label}\\s*\\n?\\s*(\\d+)`).exec(txt)?.[1] ?? NaN);
    const confirmedBefore = n("Pessoas confirmadas", before);

    const name = uniq(testInfo, "Soma");
    const { detailUrl } = await createGuest(page, name, 3);
    await page.goto(detailUrl);
    const manual = page.locator("form", { has: page.getByRole("button", { name: "Registrar resposta" }) });
    await manual.getByLabel(/Pessoas \(máx/).fill("3");
    await manual.getByRole("button", { name: "Registrar resposta" }).click();
    await expect(manual.getByTestId("form-feedback")).toContainText("Resposta registrada");

    await page.goto("/admin");
    const after = await page.getByTestId("stats").innerText();
    expect(n("Pessoas confirmadas", after)).toBe(confirmedBefore + 3);
    await expect(page.getByText(name).first()).toBeVisible(); // últimas respostas
  });

  test("textos editáveis no painel aparecem no convite", async ({ page, context }) => {
    await login(page);
    await page.goto("/admin/personalizar");
    const form = page.locator("form", { has: page.getByRole("button", { name: "Salvar mensagens" }) });
    const original = await form.getByLabel("Frase da Alana").inputValue();
    await form.getByLabel("Frase da Alana").fill("Frase de teste editada pelo painel");
    await form.getByRole("button", { name: "Salvar mensagens" }).click();
    await expect(form.getByTestId("form-feedback")).toContainText("salvas");

    const g = await context.newPage();
    await g.goto("/");
    await openEnvelope(g);
    await expect(g.getByText("Frase de teste editada pelo painel")).toBeVisible();

    await form.getByLabel("Frase da Alana").fill(original);
    await form.getByRole("button", { name: "Salvar mensagens" }).click();
    await expect(form.getByTestId("form-feedback")).toContainText("salvas");
  });

  test("acessibilidade do login e sair do painel", async ({ page }) => {
    await page.goto("/admin/login");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    await login(page);
    const menu = page.getByRole("button", { name: /Menu/ });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole("button", { name: "Sair" }).first().click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
