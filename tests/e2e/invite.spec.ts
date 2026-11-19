import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { collectConsoleErrors, createGuest, login, openEnvelope, saveSettings, uniq } from "./helpers";

test.describe("Experiência do convite", () => {
  test("envelope abre com animação e revela a Alana, sem erros no console", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/");
    await expect(page.getByText("Você recebeu um convite muito especial...")).toBeVisible();
    // A rolagem fica travada enquanto o envelope está fechado
    await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");

    // force: o envelope flutua sem parar, então não espera ele ficar "estável" para tocar
    await page.getByTestId("seal").click({ force: true });
    // No meio da animação a aba já girou (abertura física, não troca de imagem)
    await page.waitForTimeout(1600);
    const flapTransform = await page.locator("[data-env-flap]").evaluate((el) => getComputedStyle(el).transform);
    expect(flapTransform).not.toBe("none");

    await expect(page.getByTestId("envelope-scene")).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Alana" })).toBeVisible();
    await expect(page.getByText("Cheguei para trazer amor, alegria e muitas bênçãos!")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe("");

    // Rolagem cinematográfica: seções revelam ao entrar na tela
    await page.locator("#data").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("date-soon")).toBeVisible();
    await page.locator("footer").scrollIntoViewIfNeeded();
    await expect(page.getByText("Com carinho, papai e mamãe.")).toBeVisible();

    // Recarregar na mesma sessão não repete o envelope
    await page.reload();
    await expect(page.getByTestId("envelope-scene")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Alana" })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("respeita movimento reduzido", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const t0 = Date.now();
    await page.getByTestId("seal").click({ force: true });
    await expect(page.getByTestId("envelope-scene")).toBeHidden();
    expect(Date.now() - t0).toBeLessThan(3000);
    await expect(page.getByRole("heading", { level: 1, name: "Alana" })).toBeVisible();
    await ctx.close();
  });

  test("sem data e local definidos mostra estados elegantes, sem inventar dados", async ({ page }) => {
    await page.goto("/");
    await openEnvelope(page);
    await expect(page.getByTestId("date-soon")).toContainText("Data em breve");
    await expect(page.getByTestId("place-soon")).toContainText("Local em breve");
    await expect(page.getByTestId("maps-link")).toHaveCount(0);
    await expect(page.getByTestId("registry-link")).toHaveCount(0);
    // Sem números configurados, não há botões de WhatsApp
    await expect(page.locator("[data-testid^=whatsapp-]")).toHaveCount(0);
  });

  test("layout sem rolagem horizontal", async ({ page }) => {
    await page.goto("/");
    await openEnvelope(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("token inexistente mostra página amigável", async ({ page }) => {
    const res = await page.goto("/convite/tokenquenaoexiste1234567");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Convite não encontrado" })).toBeVisible();
    const res2 = await page.goto("/convite/curto");
    expect(res2?.status()).toBe(404);
  });

  test("acessibilidade básica (axe) no convite aberto", async ({ page }) => {
    await page.goto("/");
    await openEnvelope(page);
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
});

test.describe("Convite personalizado e confirmação", () => {
  test("link pessoal mostra o nome, respeita o limite e permite atualizar a resposta", async ({ page, context }, testInfo) => {
    const name = uniq(testInfo, "Maria Clara");
    await login(page);
    const { path, detailUrl } = await createGuest(page, name, 3, { group: "Família Teste" });

    const guestPage = await context.newPage();
    const errors = collectConsoleErrors(guestPage);
    await guestPage.goto(path);
    await expect(guestPage.getByText("Um convite especial para")).toBeVisible();
    await expect(guestPage.getByTestId("envelope-scene")).toContainText(name);
    await openEnvelope(guestPage);
    await expect(guestPage.getByText(`Para ${name}`)).toBeVisible();

    const form = guestPage.getByTestId("rsvp-form");
    await form.scrollIntoViewIfNeeded();
    await expect(form).toContainText("Este convite é para até 3 pessoas.");

    // Enviar sem escolher mostra erro próximo
    await form.getByTestId("rsvp-submit").click();
    await expect(form.getByTestId("rsvp-error")).toContainText("Escolha uma das opções");

    await form.getByText("Vou, com certeza!").click();
    const plus = form.getByRole("button", { name: "Aumentar" });
    await plus.click();
    await plus.click();
    await expect(form.getByTestId("people-count")).toHaveText("3");
    await expect(plus).toBeDisabled(); // limite do convite
    await form.getByLabel(/recadinho/).fill("Mal posso esperar!");
    await form.getByTestId("rsvp-submit").click();

    const thanks = guestPage.getByTestId("rsvp-thanks");
    await expect(thanks).toContainText("Presença confirmada! A Alana está esperando por você com muito carinho!");
    await expect(thanks).toContainText("3 pessoas confirmadas");

    // Atualiza a resposta: não vai
    await thanks.getByRole("button", { name: "Alterar resposta" }).click();
    await guestPage.getByTestId("rsvp-form").getByText("Não poderei ir").click();
    await guestPage.getByTestId("rsvp-submit").click();
    await expect(guestPage.getByTestId("rsvp-thanks")).toContainText("Obrigado por nos avisar");

    // Reabrindo o link, a resposta salva aparece (persistida no servidor)
    await guestPage.reload();
    await expect(guestPage.getByTestId("rsvp-summary")).toContainText("não poderá ir");
    expect(errors).toEqual([]);

    // Painel: uma única resposta e uma única notificação não lida para o convidado
    await page.goto(detailUrl);
    await expect(page.getByText("Não vai").first()).toBeVisible();
    await page.goto("/admin/notificacoes");
    const items = page.getByTestId("notification-list").locator("li", { hasText: name });
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText("não poderá comparecer");
  });

  test("convite aberto: desativado por padrão; ativado aceita nome e evita duplicidade", async ({ page, context }, testInfo) => {
    await login(page);
    await page.goto("/admin/evento");
    const generic = page.locator("form", { hasText: "Aceitar confirmações no convite aberto" });
    const toggle = generic.getByLabel("Aceitar confirmações no convite aberto");
    if (await toggle.isChecked()) {
      await generic.getByText("Aceitar confirmações no convite aberto").click();
      await generic.getByRole("button", { name: "Salvar" }).click();
      await expect(generic.getByTestId("form-feedback")).toContainText(/salvas/);
    }

    const visitor = await context.newPage();
    await visitor.goto("/");
    await openEnvelope(visitor);
    await expect(visitor.locator("#confirmar")).toContainText("use o link pessoal");
    await expect(visitor.getByTestId("rsvp-form")).toHaveCount(0);

    // Ativa o convite aberto
    await page.reload();
    await generic.getByText("Aceitar confirmações no convite aberto").click();
    await generic.getByLabel("Máximo de pessoas por resposta").fill("2");
    await generic.getByRole("button", { name: "Salvar" }).click();
    await expect(generic.getByTestId("form-feedback")).toContainText(/salvas/);

    const name = uniq(testInfo, "Joana Prado");
    for (const people of [2, 1]) {
      const v = await context.browser()!.newContext();
      const p = await v.newPage();
      await p.goto("/");
      await openEnvelope(p);
      const form = p.getByTestId("rsvp-form");
      await form.scrollIntoViewIfNeeded();
      await form.getByLabel("Seu nome completo").fill(name);
      await form.getByLabel(/WhatsApp/).fill("(11) 98888-7777");
      await form.getByText("Vou, com certeza!").click();
      if (people === 2) await form.getByRole("button", { name: "Aumentar" }).click();
      await form.getByTestId("rsvp-submit").click();
      await expect(p.getByTestId("rsvp-thanks")).toContainText(people === 1 ? "1 pessoa" : "2 pessoas");
      // Ganha um link pessoal para editar depois
      await expect(p).toHaveURL(/\/convite\/[A-Za-z0-9_-]{20,}/);
      await v.close();
    }

    await page.goto(`/admin/convidados?q=${encodeURIComponent(name)}`);
    const rows = page.getByTestId("guest-row").filter({ hasText: name });
    await expect(rows).toHaveCount(1); // mesma pessoa, mesma linha
    await expect(rows.first()).toContainText("1 confirmados");
    await expect(rows.first()).toContainText("convite aberto");

    // Desativa novamente para não afetar outros testes
    await page.goto("/admin/evento");
    await generic.getByText("Aceitar confirmações no convite aberto").click();
    await generic.getByRole("button", { name: "Salvar" }).click();
    await expect(generic.getByTestId("form-feedback")).toContainText(/salvas/);
  });

  test("data, local, WhatsApp, mapas, Waze, presentes e enxoval configurados no painel aparecem no convite", async ({ page, context }, testInfo) => {
    await login(page);
    await saveSettings(page, "/admin/evento", "Salvar data", {
      "Data do chá": "2099-03-20",
      "Horário de início": "15:30",
    });
    await saveSettings(page, "/admin/evento", "Salvar local", {
      "Nome do espaço": "Espaço de Teste",
      Endereço: "Rua Exemplo, 100",
      Cidade: "Cidade Teste – SP",
    });
    await saveSettings(page, "/admin/evento", "Salvar WhatsApp", {
      "WhatsApp da mãe": "(11) 90000-0001",
      "WhatsApp do pai": "(11) 90000-0002",
    });
    await saveSettings(page, "/admin/evento", "Salvar link", { "Link da lista de enxoval": "https://example.com/enxoval-teste" });

    const gift = uniq(testInfo, "Fraldas");
    await page.goto("/admin/presentes");
    const add = page.locator("form", { has: page.getByRole("button", { name: "Adicionar" }) });
    await add.getByLabel("Item").fill(gift);
    await add.getByLabel("Tamanho (opcional)").fill("M");
    await add.getByRole("button", { name: "Adicionar" }).click();
    await expect(add.getByTestId("form-feedback")).toContainText("adicionado");

    const name = uniq(testInfo, "Rafael");
    const { path } = await createGuest(page, name, 1);
    const g = await context.newPage();
    await g.goto(path);
    await openEnvelope(g);

    await expect(g.getByTestId("event-day")).toHaveText("20");
    await expect(g.locator("#data")).toContainText("março");
    await expect(g.locator("#data")).toContainText("2099");
    await expect(g.locator("#data")).toContainText("sexta-feira");
    await expect(g.locator("#data")).toContainText("às 15h30");
    await expect(g.getByRole("timer")).toBeVisible();

    const maps = await g.getByTestId("maps-link").getAttribute("href");
    expect(maps).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(decodeURIComponent(maps!)).toContain("Rua Exemplo, 100");
    const waze = await g.getByTestId("waze-link").getAttribute("href");
    expect(waze).toMatch(/^https:\/\/waze\.com\/ul\?q=.*navigate=yes$/);

    const mae = await g.getByTestId("whatsapp-mae").getAttribute("href");
    expect(mae).toMatch(/^https:\/\/wa\.me\/5511900000001\?text=/);
    expect(decodeURIComponent(mae!)).toContain(name);
    expect(await g.getByTestId("whatsapp-pai").getAttribute("href")).toMatch(/^https:\/\/wa\.me\/5511900000002/);

    await expect(g.getByTestId("gift-list")).toContainText(gift);
    const reg = g.getByTestId("registry-link");
    await expect(reg).toHaveAttribute("href", "https://example.com/enxoval-teste");
    await expect(reg).toHaveAttribute("target", "_blank");
    await expect(reg).toHaveAttribute("rel", /noopener/);

    // Convite individual: não mostra seletor de quantidade
    await g.getByTestId("rsvp-form").getByText("Vou, com certeza!").click();
    await expect(g.getByRole("button", { name: "Aumentar" })).toHaveCount(0);

    // Limpa a configuração para os próximos projetos de teste
    await saveSettings(page, "/admin/evento", "Salvar data", { "Data do chá": "", "Horário de início": "" });
    await saveSettings(page, "/admin/evento", "Salvar local", { "Nome do espaço": "", Endereço: "", Cidade: "" });
    await saveSettings(page, "/admin/evento", "Salvar WhatsApp", { "WhatsApp da mãe": "", "WhatsApp do pai": "" });
    await saveSettings(page, "/admin/evento", "Salvar link", { "Link da lista de enxoval": "" });
  });
});
