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

  test("toque antes do carregamento e durante a entrada abre o envelope por completo", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    // Toque assim que o HTML aparece (antes do JavaScript carregar)
    await page.goto("/", { waitUntil: "commit" });
    await page.locator("[data-testid=seal]").waitFor({ state: "attached" });
    await page.locator("[data-testid=seal]").dispatchEvent("click");
    await expect(page.getByTestId("envelope-scene")).toBeHidden({ timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Alana" })).toBeVisible();

    // Toque logo no início da animação de entrada
    await page.evaluate(() => sessionStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("seal").click({ force: true });
    await page.waitForTimeout(1300);
    // a entrada foi concluída, não cortada pela metade
    expect(Number(await page.locator("[data-env-float]").evaluate((el) => getComputedStyle(el).opacity))).toBe(1);
    await expect(page.getByTestId("envelope-scene")).toBeHidden({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test("camadas do envelope num plano só (sem pisca-pisca 3D)", async ({ page }) => {
    await page.goto("/");
    const styles = await page.evaluate(() =>
      ["[data-env-float]", "[data-env-tilt]", "[data-testid=envelope]"].map(
        (s) => getComputedStyle(document.querySelector(s)!).transformStyle,
      ),
    );
    expect(styles).toEqual(["flat", "flat", "flat"]);
  });

  test("ver a abertura de novo começa do topo", async ({ page }) => {
    await page.goto("/");
    await openEnvelope(page);
    await page.locator("footer").scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    await page.getByRole("button", { name: "Ver a abertura do envelope de novo" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("envelope-scene")).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.getByTestId("seal").click({ force: true });
    await expect(page.getByTestId("envelope-scene")).toBeHidden({ timeout: 15_000 });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole("heading", { level: 1, name: "Alana" })).toBeInViewport();
  });

  test("menu de atalhos leva direto à confirmação", async ({ page }) => {
    await page.goto("/");
    await openEnvelope(page);
    const toggle = page.getByTestId("quicknav-toggle");
    if (await toggle.isVisible()) {
      // celular: abre a aba lateral (pode já estar aberta pela dica inicial)
      await page.waitForTimeout(3200);
      if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
      await page.locator("#quicknav-mobile").getByRole("button", { name: "Confirmar presença" }).click();
    } else {
      await page.getByTestId("quicknav-desktop").getByRole("button", { name: "Confirmar presença" }).click();
    }
    await expect(page.locator("#confirmar")).toBeInViewport();
  });

  test("botão brilhante 'Confirme aqui' aparece na primeira tela e leva ao formulário", async ({ page }) => {
    await page.goto("/");
    await openEnvelope(page);
    const cta = page.getByTestId("hero-confirm");
    await expect(cta).toHaveText(/Confirme aqui/);
    await expect(cta).toBeInViewport(); // visível sem precisar rolar
    await page.waitForTimeout(4500); // espera a entrada da Alana terminar
    await cta.click({ force: true }); // o botão balança de leve sem parar, então nunca fica "estável"
    await expect(page.locator("#confirmar")).toBeInViewport();
    await expect(page.getByTestId("rsvp-form")).toBeVisible();
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
    // Campo de acompanhantes: digitar acima do limite fica no máximo do convite
    await form.getByTestId("companions").fill("9");
    await expect(form.getByTestId("people-count")).toContainText("Total: 3 pessoas");
    const plus = form.getByRole("button", { name: "Aumentar acompanhantes" });
    await expect(plus).toBeDisabled(); // limite do convite
    await form.getByRole("button", { name: "Diminuir acompanhantes" }).click();
    await plus.click();
    await expect(form.getByTestId("people-count")).toContainText("Total: 3 pessoas");
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

  test("convite aberto vem ligado: a pessoa digita o nome e escolhe quantas pessoas vão, sem duplicar", async ({ page, context, browser }, testInfo) => {
    const name = uniq(testInfo, "Joana Prado");
    // Sem nenhum cadastro feito pelos papais
    for (const people of [7, 1]) {
      const v = await browser.newContext();
      const p = await v.newPage();
      await p.goto("/");
      await openEnvelope(p);
      const form = p.getByTestId("rsvp-form");
      await form.scrollIntoViewIfNeeded();
      await form.getByLabel("Seu nome completo").fill(name);
      await expect(form.getByLabel(/WhatsApp/)).toHaveCount(0); // não pede telefone
      // O campo de acompanhantes já aparece; digitar o número marca "vou"
      await form.getByLabel("Quantas pessoas vão com você?").fill(String(people - 1));
      await expect(form.getByText("Vou, com certeza!")).toBeVisible();
      await expect(form.getByTestId("people-count")).toContainText(`Total: ${people} ${people === 1 ? "pessoa" : "pessoas"}`);
      await expect(form).not.toContainText("Máximo de");
      await form.getByTestId("rsvp-submit").click();
      await expect(p.getByTestId("rsvp-thanks")).toContainText(people === 1 ? "1 pessoa" : `${people} pessoas`);
      // Ganha um link pessoal para editar depois
      await expect(p).toHaveURL(/\/convite\/[A-Za-z0-9_-]{20,}/);
      // Voltando ao convite geral no mesmo aparelho, aparece o atalho para a própria resposta
      await p.goto("/");
      await expect(p.getByTestId("saved-answer")).toBeVisible();
      await v.close();
    }

    await login(page);
    await page.goto(`/admin/convidados?q=${encodeURIComponent(name)}`);
    const rows = page.getByTestId("guest-row").filter({ hasText: name });
    await expect(rows).toHaveCount(1); // mesma pessoa, mesma linha
    await expect(rows.first()).toContainText("1 confirmados");
    await expect(rows.first()).toContainText("convite aberto");

    // Os papais ainda podem desligar o convite aberto
    await page.goto("/admin/evento");
    const generic = page.locator("form", { hasText: "Aceitar confirmações no convite aberto" });
    await expect(generic.getByLabel("Aceitar confirmações no convite aberto")).toBeChecked();
    await generic.getByText("Aceitar confirmações no convite aberto").click();
    await generic.getByRole("button", { name: "Salvar" }).click();
    await expect(generic.getByTestId("form-feedback")).toContainText(/salvas/);
    const visitor = await context.newPage();
    await visitor.goto("/");
    await openEnvelope(visitor);
    await expect(visitor.locator("#confirmar")).toContainText("use o link pessoal");
    await expect(visitor.getByTestId("rsvp-form")).toHaveCount(0);

    // Religa para os próximos testes
    await page.reload();
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

    // Topo: além do "Confirme aqui", um botão menor leva direto aos presentes
    const giftsCta = g.getByTestId("hero-gifts");
    await expect(giftsCta).toHaveText(/Ver os presentes/);
    await expect(giftsCta).toBeInViewport();
    await g.waitForTimeout(4500);
    await giftsCta.click({ force: true });
    await expect(g.locator("#enxoval")).toBeInViewport();
    await g.evaluate(() => window.scrollTo(0, 0));

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
    // Lembrete da fralda sempre visível (sem precisar passar o mouse)
    await expect(g.getByTestId("registry-reminder")).toBeVisible();
    await expect(g.getByTestId("registry-reminder")).toContainText("fralda");
    const popup = context.waitForEvent("page");
    await reg.click();
    await (await popup).close();
    await expect(g.getByTestId("registry-reminder")).toContainText("fralda");
    // Enxoval vem antes do local, e o local antes da confirmação
    const yLocal = (await g.locator("#local").boundingBox())!.y;
    const yReg = (await g.locator("#enxoval").boundingBox())!.y;
    const yRsvp = (await g.locator("#confirmar").boundingBox())!.y;
    expect(yReg).toBeLessThan(yLocal);
    expect(yLocal).toBeLessThan(yRsvp);

    // Convite individual: não mostra seletor de quantidade
    await g.getByTestId("rsvp-form").getByText("Vou, com certeza!").click();
    await expect(g.getByTestId("companions")).toHaveCount(0);

    // Ao confirmar, o site rola sozinho até a lista de enxoval e mostra o lembrete
    await g.getByTestId("rsvp-submit").click();
    await expect(g.getByTestId("rsvp-thanks")).toBeVisible();
    await expect(g.locator("#enxoval")).toBeInViewport({ timeout: 10_000 });
    await expect(g.getByTestId("registry-reminder")).toContainText("fralda");

    // Limpa a configuração para os próximos projetos de teste
    await saveSettings(page, "/admin/evento", "Salvar data", { "Data do chá": "", "Horário de início": "" });
    await saveSettings(page, "/admin/evento", "Salvar local", { "Nome do espaço": "", Endereço: "", Cidade: "" });
    await saveSettings(page, "/admin/evento", "Salvar WhatsApp", { "WhatsApp da mãe": "", "WhatsApp do pai": "" });
    await saveSettings(page, "/admin/evento", "Salvar link", { "Link da lista de enxoval": "" });
  });
});
