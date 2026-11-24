import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { collectConsoleErrors, login, openEnvelope } from "./helpers";

/**
 * Quiz dos Papais, de ponta a ponta. O "banco" é um Postgres embutido rodando a migração real.
 * Os testes rodam em ordem e cada projeto (PC, iPhone, Android) começa zerando o quiz.
 */
test.describe.configure({ mode: "serial", timeout: 120_000 });

const toast = (page: Page, text: RegExp | string) => expect(page.getByTestId("quiz-toast")).toContainText(text);

async function admin(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  await login(page);
  return page;
}

async function click(page: Page, testId: string, message: RegExp | string) {
  await page.getByTestId(testId).click();
  await toast(page, message);
}

async function setSwitch(page: Page, testId: string, on: boolean) {
  const sw = page.getByTestId(testId);
  await expect(sw).toBeEnabled();
  if ((await sw.getAttribute("aria-checked")) !== String(on)) {
    await sw.click();
    await toast(page, "Configuração salva");
  }
  await expect(sw).toHaveAttribute("aria-checked", String(on));
}

/** Volta ao rascunho com `n` perguntas ativas, todas com "Nicola" como resposta certa. */
async function reset(page: Page, n: number, mode: "time" | "extra" | "shared" = "time") {
  await page.goto("/admin/quiz");
  const badge = page.getByTestId("quiz-status");
  if ((await badge.getAttribute("data-status")) === "open") await click(page, "quiz-close", "encerrado");
  if ((await badge.getAttribute("data-status")) !== "draft") {
    await page.goto("/admin/quiz/ajustes");
    await expect(async () => {
      // o painel pode ainda estar carregando quando digitamos
      await page.getByLabel("Digite ZERAR para confirmar").fill("");
      await page.getByLabel("Digite ZERAR para confirmar").fill("zerar");
      await expect(page.getByTestId("quiz-reset")).toBeEnabled({ timeout: 1000 });
    }).toPass();
    await click(page, "quiz-reset", "rascunho");
  }
  await page.goto("/admin/quiz/desempate");
  const radio = page.getByTestId(`tiebreak-${mode}`);
  if ((await radio.getAttribute("aria-checked")) !== "true") await click(page, `tiebreak-${mode}`, "salva");

  await page.goto("/admin/quiz/perguntas");
  const cards = page.getByTestId("question-card");
  const total = await cards.count();
  for (let i = 0; i < total; i++) {
    const card = cards.nth(i);
    if (i < n) {
      const right = card.getByRole("radio", { name: /Nicola/ });
      if ((await right.getAttribute("aria-checked")) !== "true") await right.click();
      await expect(right).toHaveAttribute("aria-checked", "true");
      const on = card.getByRole("button", { name: "Ativar", exact: true });
      if (await on.count()) await on.click();
      await expect(card.getByRole("button", { name: "Desativar" })).toBeVisible();
    } else {
      const off = card.getByRole("button", { name: "Desativar" });
      if (await off.count()) await off.click();
      await expect(card.getByRole("button", { name: "Ativar", exact: true })).toBeVisible();
    }
  }
  await page.goto("/admin/quiz");
}

async function guest(browser: Browser, testInfo: TestInfo, lang: "pt" | "es" = "pt") {
  const ctx = await browser.newContext({ ...testInfo.project.use, locale: lang === "pt" ? "pt-BR" : "es-CO" });
  return ctx.newPage();
}

async function begin(page: Page, name: string) {
  await page.goto("/quiz");
  await page.locator("#quiz-name").fill(name);
  await expect(page.getByTestId("quiz-start")).toBeEnabled();
  await page.getByTestId("quiz-start").click({ force: true });
  await expect(page.getByTestId("quiz-question")).toBeVisible();
}

const option = (page: Page, i: number) => page.getByTestId("quiz-option").nth(i);

/** Responde `count` perguntas; as `right` primeiras, certas. Espera o avanço automático. */
async function respond(page: Page, count: number, right: number) {
  for (let i = 0; i < count; i++) {
    const at = await page.getByTestId("quiz-question").getAttribute("data-index");
    await option(page, i < right ? 0 : 1).click();
    await expect
      .poll(() => page.evaluate(() => document.querySelector("[data-testid=quiz-question]")?.getAttribute("data-index") ?? "fim"))
      .not.toBe(at);
  }
}

const liveNames = (page: Page) => page.getByTestId("live-name").allTextContents();

test("antes de abrir: aviso no quiz e no convite; endereços públicos sem login; painel exige login", async ({ page, request }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/quiz");
  await expect(page.getByTestId("quiz-not-open")).toContainText("ainda não começou! Aguarde a organizadora");
  await page.goto("/quiz/ao-vivo");
  await expect(page.getByTestId("live-message")).toContainText("desligada");
  await page.goto("/quiz/ranking");
  await expect(page.getByTestId("final-hidden")).toBeVisible();

  await page.goto("/");
  await openEnvelope(page);
  await expect(page.getByTestId("games-section")).toContainText("Brincadeiras");
  await expect(page.getByTestId("games-text")).toContainText("ainda não começou");
  await expect(page.getByTestId("games-link")).toHaveCount(0);
  expect(errors.filter((e) => !/access control checks/.test(e))).toEqual([]); // WebKit: pré-carregamento cancelado ao navegar

  for (const path of ["/admin/quiz", "/admin/quiz/perguntas"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login$/);
  }
  for (const path of ["/admin/quiz/dados", "/admin/quiz/participantes/exportar"]) {
    expect([302, 307, 401]).toContain((await request.get(path, { maxRedirects: 0 })).status());
  }
});

test("perguntas pelo painel: 20 iniciais, criar, traduzir, editar, duplicar, reordenar, desativar e excluir", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "regras do painel: basta um navegador");
  const page = await admin(browser);
  await page.goto("/admin/quiz");
  await expect(page.getByTestId("stat-questions")).toHaveText("20");
  await expect(page.getByTestId("missing-key")).toContainText("20 pergunta(s)");
  await expect(page.getByTestId("quiz-open")).toBeDisabled(); // sem gabarito não abre

  await page.goto("/admin/quiz/perguntas");
  const cards = page.getByTestId("question-card");
  await expect(cards).toHaveCount(20);
  await page.getByTestId("question-new").click();
  const form = page.getByTestId("question-form");
  await form.getByLabel("Pergunta em português").fill("Quem canta no chuveiro?");
  await form.getByLabel("Pergunta em espanhol").fill("¿Quién canta en la ducha?");
  await form.getByLabel("Alternativa 2 é a correta").check();
  await form.getByLabel("Pontos se acertar").fill("3");
  await form.getByRole("button", { name: "+ Alternativa" }).click();
  await form.getByLabel("Alternativa 4 em português").fill("Yasmin"); // repetida
  await form.getByRole("button", { name: "Salvar pergunta" }).click();
  await expect(form.getByRole("alert")).toContainText("repetidas");
  await form.getByRole("button", { name: "Remover alternativa 4" }).click();
  await form.getByRole("button", { name: "Salvar pergunta" }).click();
  await toast(page, "adicionada");
  await expect(cards).toHaveCount(21);
  let card = cards.filter({ hasText: "Quem canta no chuveiro?" });
  await expect(card).toContainText("3 pontos");
  await expect(card.getByRole("radio", { name: /Yasmin/ })).toHaveAttribute("aria-checked", "true");

  await card.getByRole("button", { name: "Editar" }).click();
  await page.getByTestId("question-form").getByLabel("Pergunta em português").fill("Quem canta melhor?");
  await page.getByRole("button", { name: "Salvar pergunta" }).click();
  await toast(page, "salva");
  card = cards.filter({ hasText: "Quem canta melhor?" });
  await card.getByRole("button", { name: "Duplicar" }).click();
  await expect(cards).toHaveCount(22);
  const copy = cards.filter({ hasText: "Quem canta melhor? (cópia)" });
  await copy.getByRole("button", { name: /^Subir/ }).click();
  await expect(cards.nth(20)).toContainText("(cópia)");
  await copy.getByRole("button", { name: "Desativar" }).click();
  await expect(copy).toContainText("Desativada");
  await copy.getByRole("button", { name: "Excluir" }).click();
  await expect(cards).toHaveCount(21);
  await cards.filter({ hasText: "Quem canta melhor?" }).getByRole("button", { name: "Excluir" }).click();
  await expect(cards).toHaveCount(20);
  await page.goto("/admin/historico");
  await expect(page.getByText("adicionou uma pergunta ao quiz").first()).toBeVisible();
  await page.context().close();
});

test('fluxo do convidado: nome, salvamento e avanço automáticos, sem voltar, retomar, finalizar sozinho e "já respondeu"', async ({ browser }, testInfo) => {
  const a = await admin(browser);
  await reset(a, 3);
  await click(a, "quiz-open", "Quiz aberto");
  await expect(a.getByTestId("quiz-status")).toHaveText("Aberto");

  const p = await guest(browser, testInfo);
  const errors = collectConsoleErrors(p);
  await p.goto("/quiz");
  await expect(p.getByRole("heading", { level: 1 })).toHaveText("Quem conhece melhor os papais?");
  await expect(p.getByTestId("question-count")).toHaveText("3 perguntas"); // quantidade dinâmica
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const axe = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await p.screenshot({ path: testInfo.outputPath("inicio.png") });

  // nome obrigatório
  await expect(p.getByTestId("quiz-start")).toBeEnabled();
  await p.getByTestId("quiz-start").click({ force: true });
  await expect(p.locator("#quiz-name-error")).toContainText("Escreva seu nome");
  await p.locator("#quiz-name").fill("  Tia   Marta ");
  await p.getByTestId("quiz-start").click({ force: true });

  const q = p.getByTestId("quiz-question");
  await expect(q).toHaveAttribute("data-index", "0");
  await expect(p.getByTestId("question-counter")).toHaveText("Pergunta 1 de 3");
  await expect(q).toContainText("Olá, Tia Marta!");
  await p.waitForTimeout(700); // fim da animação de entrada
  expect((await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
  await p.screenshot({ path: testInfo.outputPath("pergunta.png") });
  expect((await option(p, 0).boundingBox())!.height).toBeGreaterThanOrEqual(60); // alternativas grandes
  await expect(p.getByRole("button", { name: /enviar|finalizar|confirmar/i })).toHaveCount(0);

  // salva e avança sozinho; a resposta do servidor não revela acerto
  const [res] = await Promise.all([p.waitForResponse("**/api/quiz/answer"), option(p, 1).click()]);
  expect(await res.json()).toEqual({ ok: true, answered: 1, total: 3, finished: false });
  await expect(q).toHaveAttribute("data-index", "1");

  // sem voltar: não há botão e o servidor não troca uma resposta já dada
  await expect(q.getByRole("button", { name: /voltar|próxima/i })).toHaveCount(0);
  await expect(p.getByTestId("quiz-resumed")).toHaveCount(0);
  const session = async () => (await p.request.get("/api/quiz/session")).json();
  const q1 = (await session()).questions[0];
  const change = await p.request.post("/api/quiz/answer", { data: { questionId: q1.id, optionId: q1.options[0].id } });
  expect(await change.json()).toEqual({ ok: true, answered: 1, total: 3, finished: false });
  expect((await session()).session.answers).toEqual({ [q1.id]: q1.options[1].id });

  // fechou o site sem querer e voltou (nova aba): continua de onde parou, sem digitar o nome de novo
  const tab = await p.context().newPage();
  await p.goto("about:blank");
  await tab.goto("/quiz");
  await expect(tab.getByTestId("quiz-question")).toHaveAttribute("data-index", "1");
  await expect(tab.getByTestId("quiz-resumed")).toContainText("Continuamos de onde você parou");
  await expect(tab.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  await tab.waitForTimeout(700);
  expect((await new AxeBuilder({ page: tab }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
  await tab.screenshot({ path: testInfo.outputPath("retomada.png") });
  await tab.close();

  // saiu para o convite e voltou pelo botão do navegador: também mantém
  await p.goto("/quiz");
  await expect(q).toHaveAttribute("data-index", "1");
  await respond(p, 1, 1);
  await expect(p.getByTestId("quiz-resumed")).toHaveCount(0);
  await p.locator("header").getByRole("link").first().click();
  await expect(p).toHaveURL(/\/$/);
  await p.goBack();
  await expect(q).toHaveAttribute("data-index", "2");
  await expect(p.getByTestId("question-counter")).toHaveText("Pergunta 3 de 3");
  await expect(q).toHaveAttribute("data-index", "2");

  // toque duplo na última pergunta: finaliza uma única vez
  let posts = 0;
  p.on("request", (r) => r.url().includes("/api/quiz/answer") && posts++);
  await option(p, 1).dblclick();
  await expect(p.getByTestId("quiz-thanks")).toContainText("Parabéns! Você concluiu o Quiz da Alana!");
  await expect(p.getByTestId("thanks-name")).toHaveText("Tia Marta");
  expect(posts).toBe(1);
  await expect(p.getByTestId("quiz-thanks")).not.toContainText(/Nicola|acert|ponto/i); // sem gabarito
  await p.screenshot({ path: testInfo.outputPath("agradecimento.png") });
  await p.reload();
  const already = p.getByTestId("quiz-already");
  await expect(already).toContainText("Você já respondeu este quiz!");
  await expect(already).toContainText("Tia Marta");
  await expect(p.locator("#quiz-name")).toHaveCount(0); // não deixa começar de novo
  await expect(p.getByTestId("quiz-results")).toContainText("assim que ele for liberado");
  await a.goto("/admin/quiz/ao-vivo");
  await setSwitch(a, "live-enabled", true);
  await expect(p.getByTestId("see-live")).toBeVisible({ timeout: 15_000 }); // aparece sem recarregar
  await expect(already).toContainText("Quer ver os resultados? Clique aqui");
  await p.waitForTimeout(700);
  expect((await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
  await p.screenshot({ path: testInfo.outputPath("ja-respondeu.png") });
  await p.getByTestId("see-live").click({ force: true });
  await expect(p.getByTestId("live-name").first()).toHaveText("Tia Marta");
  await p.goBack();
  await expect(already).toBeVisible();
  await setSwitch(a, "live-enabled", false);
  await a.goto("/admin/quiz");
  expect(errors.filter((e) => !/access control checks/.test(e))).toEqual([]); // WebKit: pedido cancelado ao navegar

  // painel acompanha sozinho
  await expect(a.getByTestId("stat-done")).toHaveText("1");
  await expect(a.getByTestId("admin-ranking")).toContainText("Tia Marta");
  await expect(a.getByTestId("admin-ranking")).toContainText("1 pt");

  // mesmo nome é recusado; outra pessoa no mesmo aparelho pode responder
  await p.getByTestId("answer-for-other").click();
  await p.locator("#quiz-name").fill("tia marta");
  await p.getByTestId("quiz-start").click({ force: true });
  await expect(p.locator("#quiz-name-error")).toContainText("Acrescente seu sobrenome");
  await p.locator("#quiz-name").fill("Tio João");
  await p.getByTestId("quiz-start").click({ force: true });
  await expect(q).toContainText("Olá, Tio João!");
  await expect(a.getByTestId("stat-active")).toHaveText("1");
  await p.context().close();
  await a.context().close();
});

test("queda de internet: guarda a resposta, não avança, tenta de novo e retoma até depois de fechar a página", async ({ browser }, testInfo) => {
  const a = await admin(browser);
  await reset(a, 2);
  await click(a, "quiz-open", "Quiz aberto");
  const p = await guest(browser, testInfo);
  await begin(p, "Vovó Lina");
  const q = p.getByTestId("quiz-question");

  let broken = true;
  await p.route("**/api/quiz/answer", (r) => (broken ? r.abort() : r.continue()));
  await option(p, 0).click();
  await expect(p.getByTestId("save-status")).toContainText("Sem conexão");
  await expect(q).toHaveAttribute("data-index", "0"); // não avança silenciosamente
  broken = false;
  await p.getByRole("button", { name: "Tentar agora" }).click();
  await expect(q).toHaveAttribute("data-index", "1");

  // erro do servidor + fechar a página: ao voltar, a resposta guardada é enviada sozinha
  broken = true;
  await option(p, 0).click();
  await expect(p.getByTestId("save-status")).toContainText("Sem conexão");
  broken = false;
  await p.unrouteAll();
  await p.goto("about:blank");
  await p.goto("/quiz");
  await expect(p.getByTestId("quiz-thanks")).toBeVisible();
  await expect(a.getByTestId("stat-answers")).toHaveText("2");
  await p.context().close();
  await a.context().close();
});

test("ranking ao vivo sem login: atualiza sozinho, muda posições e respeita os controles do painel", async ({ browser }, testInfo) => {
  const a = await admin(browser);
  await reset(a, 3, "shared");
  await click(a, "quiz-open", "Quiz aberto");
  await a.goto("/admin/quiz/ao-vivo");
  await expect(a.getByTestId("live-warning")).toContainText("descobrir uma resposta");
  await expect(a.getByTestId("live-link")).toHaveText(/\/quiz\/ao-vivo$/);
  await setSwitch(a, "live-enabled", false);
  await setSwitch(a, "live-scores", true);
  await setSwitch(a, "live-progress", true);
  await setSwitch(a, "live-hidden", false);
  await setSwitch(a, "live-top10", true);

  const tv = await guest(browser, testInfo); // sem login
  const errors = collectConsoleErrors(tv);
  await tv.goto("/quiz/ao-vivo");
  await expect(tv.getByTestId("live-message")).toContainText("desligada");
  await setSwitch(a, "live-enabled", true);
  await expect(tv.getByTestId("live-message")).toContainText("Ainda não há participantes"); // sem recarregar

  const ana = await guest(browser, testInfo);
  const bia = await guest(browser, testInfo);
  await begin(ana, "Ana");
  await begin(bia, "Bia");
  await respond(ana, 1, 1);
  await expect.poll(() => liveNames(tv)).toEqual(["Ana", "Bia"]);
  await expect(tv.getByTestId("live-status")).toContainText("Classificação provisória");
  await expect(tv.getByTestId("live-progress").first()).toContainText("1/3");
  await respond(bia, 1, 1);
  await expect(tv.getByTestId("live-tie")).toContainText("Empate provisório");
  await respond(bia, 1, 1);
  await expect.poll(() => liveNames(tv)).toEqual(["Bia", "Ana"]); // mudou de posição
  await expect(tv.getByTestId("live-score").first()).toContainText("2");
  expect((await new AxeBuilder({ page: tv }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
  await tv.screenshot({ path: testInfo.outputPath("ao-vivo.png") });

  await setSwitch(a, "live-scores", false);
  await expect(tv.getByTestId("live-score")).toHaveCount(0);
  await setSwitch(a, "live-progress", false);
  await expect(tv.getByTestId("live-progress")).toHaveCount(0);
  const raw = await (await tv.request.get("/api/quiz/live")).text();
  expect(raw).not.toMatch(/"(score|answered|key|correct)"/);
  await setSwitch(a, "live-hidden", true);
  await expect(tv.getByTestId("live-message")).toContainText("Suspense");
  expect(await (await tv.request.get("/api/quiz/live")).text()).not.toContain("Bia");
  await setSwitch(a, "live-hidden", false);
  await setSwitch(a, "live-scores", true);
  await expect.poll(() => liveNames(tv)).toEqual(["Bia", "Ana"]);

  // indicador de conexão
  await tv.route("**/api/quiz/live", (r) => r.abort());
  await expect(tv.getByTestId("live-connection")).toContainText("Reconectando", { timeout: 20_000 });
  await tv.unrouteAll();
  await expect(tv.getByTestId("live-connection")).toContainText("Atualização automática", { timeout: 20_000 });
  expect(errors.filter((e) => !/Failed to load resource|access control|ERR_FAILED/i.test(e))).toEqual([]);

  await setSwitch(a, "live-enabled", false);
  await expect(tv.getByTestId("live-message")).toContainText("desligada");
  for (const x of [tv, ana, bia, a]) await x.context().close();
});

test("segurança: sem gabarito nas respostas públicas, sessão obrigatória, outro site bloqueado", async ({ browser, request }, testInfo) => {
  const a = await admin(browser);
  await reset(a, 2);
  await click(a, "quiz-open", "Quiz aberto");
  const p = await guest(browser, testInfo);
  const bodies: string[] = [];
  p.on("response", async (r) => {
    if (/\/(api\/quiz|quiz)/.test(r.url())) bodies.push(await r.text().catch(() => ""));
  });
  await begin(p, "Curiosa");
  await respond(p, 2, 1);
  await expect(p.getByTestId("quiz-thanks")).toBeVisible();
  bodies.push(await (await p.request.get("/api/quiz/session")).text(), await (await p.request.get("/api/quiz/live")).text());
  bodies.push(await (await p.request.get("/quiz/ranking")).text());
  const all = bodies.join("\n");
  expect(all.length).toBeGreaterThan(500);
  expect(all).not.toMatch(/\\?"(key|correct|correctOption|is_correct)\\?":/);

  const state = await (await p.request.get("/api/quiz/session")).json();
  expect(state.questions).toEqual([]); // quem terminou não recebe mais nada
  const data = { questionId: "11111111-1111-4111-8111-111111111111", optionId: "11111111-1111-4111-8111-111111111111" };
  expect(await (await request.post("/api/quiz/answer", { data })).json()).toEqual({ error: "no_session" });
  expect((await p.request.post("/api/quiz/answer", { data, headers: { Origin: "https://malicioso.example" } })).status()).toBe(400);
  expect((await p.request.post("/api/quiz/answer", { data: "x=1", headers: { "Content-Type": "text/plain" } })).status()).toBe(400);
  const cookies = await p.context().cookies();
  const cookie = cookies.find((c) => c.name === "alana_quiz");
  expect(cookie?.httpOnly).toBe(true);
  if (testInfo.project.name !== "iphone-safari") expect(cookie?.sameSite).toBe("Lax"); // o WebKit do Windows não informa
  await p.context().close();
  await a.context().close();
});

test("encerrar, publicar, ocultar; ranking final por tempo; participante incompleto e invalidado ficam fora; CSV", async ({ browser }, testInfo) => {
  const a = await admin(browser);
  await reset(a, 2, "time");
  await click(a, "quiz-open", "Quiz aberto");
  await a.goto("/admin/quiz/ao-vivo");
  await setSwitch(a, "live-enabled", true);

  const [lenta, rapida, fake, meio] = await Promise.all([1, 2, 3, 4].map(() => guest(browser, testInfo)));
  await begin(lenta, "Lenta");
  await lenta.waitForTimeout(2500);
  await respond(lenta, 2, 2);
  await begin(rapida, "Rápida");
  await respond(rapida, 2, 2);
  await begin(fake, "Duplicada");
  await respond(fake, 2, 2);
  await begin(meio, "No Meio");
  await respond(meio, 1, 1);

  await a.goto("/admin/quiz/participantes");
  await expect(a.getByTestId("participant-row")).toHaveCount(4);
  await a.getByLabel("Pesquisar participante").fill("rapida");
  await expect(a.getByTestId("participant-row")).toHaveCount(1);
  await a.getByRole("link", { name: "Ver respostas" }).click();
  await expect(a.getByTestId("answer-list").locator("li")).toHaveCount(2);
  await a.goto("/admin/quiz/participantes");
  await a.getByTestId("participant-row").filter({ hasText: "Duplicada" }).getByRole("button", { name: "Invalidar" }).click();
  await toast(a, "invalidada");
  const csv = await (await a.request.get("/admin/quiz/participantes/exportar")).text();
  expect(csv).toContain("Rápida");
  expect(csv).toContain("Nicola (certa)");

  const pub = await guest(browser, testInfo);
  await pub.goto("/quiz/ranking");
  await expect(pub.getByTestId("final-hidden")).toBeVisible();
  const tv = await guest(browser, testInfo);
  await tv.goto("/quiz/ao-vivo");

  await a.goto("/admin/quiz");
  await click(a, "quiz-close", "encerrado");
  await expect(tv.getByTestId("live-status")).toContainText("A brincadeira terminou!");
  await expect.poll(() => liveNames(tv)).toEqual(["Rápida", "Lenta"]); // só concluídas e válidas
  await option(meio, 0).click(); // respostas bloqueadas
  await expect(meio.getByTestId("quiz-ended")).toContainText("encerrado antes de você terminar");
  await expect(pub.getByTestId("final-hidden")).toBeVisible();

  await click(a, "quiz-publish", "publicados");
  await expect(tv.getByTestId("live-board")).toHaveAttribute("data-mode", "final");
  await expect(pub.getByTestId("final-row")).toHaveCount(2, { timeout: 15_000 }); // apareceu sozinho
  await expect(pub.getByTestId("final-row").first()).toContainText("Rápida");
  await expect(pub.getByTestId("final-count")).toHaveText("2 participantes");
  await expect(pub.getByTestId("final-max")).toHaveText("Pontuação máxima: 2");
  await pub.waitForTimeout(1200);
  await pub.screenshot({ path: testInfo.outputPath("final.png") });
  await rapida.reload();
  await expect(rapida.getByTestId("see-final")).toBeVisible();

  await pub.goto("/");
  await openEnvelope(pub);
  await expect(pub.getByTestId("games-link")).toHaveAttribute("href", "/quiz/ranking");

  await click(a, "quiz-unpublish", "ocultos");
  await pub.goto("/quiz/ranking");
  await expect(pub.getByTestId("final-hidden")).toBeVisible();
  for (const x of [lenta, rapida, fake, meio, pub, tv, a]) await x.context().close();
});

test("desempate com perguntas extras: rodada só para os empatados", async ({ browser }, testInfo) => {
  const a = await admin(browser);
  await reset(a, 2, "extra");
  await click(a, "quiz-open", "Quiz aberto");
  const [ana, bia, caio] = await Promise.all([1, 2, 3].map(() => guest(browser, testInfo)));
  for (const [p, n, right] of [
    [ana, "Ana", 2],
    [bia, "Bia", 2],
    [caio, "Caio", 1],
  ] as const) {
    await begin(p, n);
    await respond(p, 2, right);
    await expect(p.getByTestId("quiz-thanks")).toBeVisible();
  }

  await a.goto("/admin/quiz/desempate");
  const label = `Desempate ${testInfo.project.name}`;
  await a.getByTestId("question-new").click();
  const form = a.getByTestId("question-form");
  await form.getByLabel("Pergunta em português").fill(label);
  await form.getByLabel("Alternativa 1 é a correta").check();
  await form.getByRole("button", { name: "Salvar pergunta" }).click();
  await toast(a, "adicionada");
  await a.goto("/admin/quiz");
  await click(a, "quiz-close", "encerrado");
  await a.goto("/admin/quiz/desempate");
  await expect(a.getByTestId("tiebreak-time")).toBeDisabled(); // regra travada
  await a.getByRole("checkbox", { name: new RegExp(label) }).check();
  await expect(a.getByTestId("tied-group")).toContainText("Ana, Bia");
  await click(a, "round-start", "Rodada 1 iniciada");

  for (const [p, opt] of [
    [ana, 1],
    [bia, 0],
  ] as const) {
    await p.reload();
    await p.getByTestId("tiebreak-start").click({ force: true });
    await expect(p.getByTestId("quiz-question")).toContainText(label);
    await option(p, opt).click();
    await expect(p.getByTestId("quiz-thanks")).toContainText("desempate registradas");
  }
  await caio.reload();
  await expect(caio.getByTestId("tiebreak-start")).toHaveCount(0);
  await expect(a.getByTestId("round-open")).toContainText("1/1");
  await click(a, "round-close", "Rodada encerrada");
  await a.goto("/admin/quiz");
  await expect(a.getByTestId("admin-ranking").locator("li").first()).toContainText("Bia");
  await expect(a.getByTestId("admin-ranking").locator("li").nth(1)).toContainText("2º");
  await click(a, "quiz-publish", "publicados");
  await caio.goto("/quiz/ranking");
  await expect(caio.getByTestId("final-row").first()).toContainText("Bia");
  for (const x of [ana, bia, caio, a]) await x.context().close();
});

test("espanhol: todas as telas do convidado, perguntas e ranking; troca de idioma", async ({ browser }, testInfo) => {
  const a = await admin(browser);
  await reset(a, 2, "shared");
  const es = await guest(browser, testInfo, "es");
  await es.goto("/quiz");
  await expect(es.getByTestId("quiz-not-open")).toContainText("todavía no ha empezado"); // idioma do aparelho
  await click(a, "quiz-open", "Quiz aberto");
  await expect(es.getByTestId("quiz-welcome")).toBeVisible({ timeout: 15_000 }); // abre sozinho
  await expect(es.getByRole("heading", { level: 1 })).toHaveText("¿Quién conoce mejor a los papás?");
  await es.getByTestId("lang-switch").getByRole("button", { name: "Português" }).click();
  await expect(es.getByRole("heading", { level: 1 })).toHaveText("Quem conhece melhor os papais?");
  await es.getByTestId("lang-switch").getByRole("button", { name: "Español" }).click();
  await begin(es, "Camila");
  await expect(es.getByTestId("quiz-question")).toContainText("¿Quién escogió el nombre Alana?");
  await expect(option(es, 2)).toContainText("Los dos");
  await expect(es.getByTestId("question-counter")).toHaveText("Pregunta 1 de 2");
  await respond(es, 2, 2);
  await expect(es.getByTestId("quiz-thanks")).toContainText("¡Felicitaciones!");
  await es.goto("/quiz/ao-vivo");
  await expect(es.getByRole("heading", { level: 1 })).toHaveText("Ranking EN VIVO");
  await es.goto("/quiz/ranking");
  await expect(es.getByTestId("final-hidden")).toContainText("todavía no se ha publicado");
  await es.goto("/quiz/qr");
  await expect(es.getByRole("heading", { level: 1 })).toContainText("Participa");

  // textos editáveis pelo painel
  await a.goto("/admin/quiz/ajustes");
  await a.getByLabel("Título do quiz (espanhol)").fill("¿Cuánto sabes de los papás?");
  await a.getByRole("button", { name: "Salvar textos" }).click();
  await toast(a, "Textos salvos");
  await es.goto("/quiz/ao-vivo");
  await expect(es.getByTestId("live-board")).toContainText("¿Cuánto sabes de los papás?");
  await a.getByLabel("Título do quiz (espanhol)").fill("");
  await a.getByRole("button", { name: "Salvar textos" }).click();
  await toast(a, "Textos salvos");
  await es.context().close();
  await a.context().close();
});

test("modo televisão: tela cheia, sem rolagem, nomes grandes e rodízio de páginas; 24 participantes ao mesmo tempo", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "televisão/projetor");
  const a = await admin(browser);
  await reset(a, 4, "shared");
  await click(a, "quiz-open", "Quiz aberto");
  await a.goto("/admin/quiz/ao-vivo");
  await setSwitch(a, "live-enabled", true);
  await setSwitch(a, "live-top10", false);

  // 24 convidados simultâneos, cada um com seus próprios cookies; cada resposta é enviada em dobro
  const N = 24;
  const clients = await Promise.all(Array.from({ length: N }, () => browser.newContext()));
  await Promise.all(
    clients.map(async (ctx, i) => {
      const startKey = `${String(i).padStart(2, "0")}${"ab".repeat(15)}`;
      const body = { data: { name: `Convidado ${String(i + 1).padStart(2, "0")}`, lang: "pt", startKey } };
      const both = await Promise.all([ctx.request.post("/api/quiz/start", body), ctx.request.post("/api/quiz/start", body)]);
      expect(both.every((r) => r.ok())).toBe(true);
      const { questions } = await (await ctx.request.get("/api/quiz/session")).json();
      expect(questions).toHaveLength(4);
      for (const [k, q] of questions.entries()) {
        const data = { questionId: q.id, optionId: q.options[k < i % 5 ? 0 : 1].id };
        const twice = await Promise.all([ctx.request.post("/api/quiz/answer", { data }), ctx.request.post("/api/quiz/answer", { data })]);
        for (const r of twice) expect(await r.json()).toMatchObject({ ok: true, answered: k + 1 });
      }
    }),
  );
  await a.goto("/admin/quiz");
  await expect(a.getByTestId("stat-total")).toHaveText(String(N)); // nenhuma duplicada
  await expect(a.getByTestId("stat-done")).toHaveText(String(N));
  await expect(a.getByTestId("stat-answers")).toHaveText(String(N * 4));
  const state = await (await a.request.get("/admin/quiz/dados")).json();
  for (const r of state.ranking) expect(r.score).toBe((Number(r.name.slice(-2)) - 1) % 5); // pontuação exata

  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tv = await ctx.newPage();
  await tv.goto("/quiz/ao-vivo?tv=1");
  await expect(tv.getByTestId("live-board")).toHaveAttribute("data-tv", "1");
  await expect(tv.getByTestId("live-row")).toHaveCount(10); // 3 do pódio + 7 da página
  expect(await tv.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  expect(parseFloat(await tv.getByTestId("live-name").first().evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThan(40);
  for (const row of await tv.getByTestId("live-row").all()) {
    const box = (await row.boundingBox())!;
    expect(box.y).toBeGreaterThan(0);
    expect(box.y + box.height).toBeLessThan(1080);
  }
  await tv.waitForTimeout(500);
  await tv.screenshot({ path: testInfo.outputPath("tv.png") });
  const firstPage = await liveNames(tv);
  await expect.poll(() => liveNames(tv), { timeout: 12_000 }).not.toEqual(firstPage);
  await expect(tv.getByTestId("fullscreen")).toBeVisible();
  await tv.setViewportSize({ width: 1280, height: 720 });
  await expect(tv.getByTestId("live-row").first()).toBeVisible();
  expect(await tv.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);

  await a.goto("/admin/quiz");
  await click(a, "quiz-close", "encerrado");
  await click(a, "quiz-publish", "publicados");
  await expect(tv.getByTestId("live-board")).toHaveAttribute("data-mode", "final");
  await tv.waitForTimeout(5000);
  await tv.screenshot({ path: testInfo.outputPath("tv-final.png") });
  await a.goto("/admin/quiz/ao-vivo");
  await setSwitch(a, "live-top10", true);
  for (const c of [...clients, ctx, a.context()]) await c.close();
});

test("QR Code: tela, PNG, cartaz PDF e link com o endereço configurado", async ({ browser }, testInfo) => {
  const a = await admin(browser);
  await a.goto("/admin/quiz/divulgar");
  await expect(a.getByTestId("quiz-link")).toHaveText("http://localhost:3100/quiz");
  const p = await guest(browser, testInfo);
  await p.goto("/quiz/qr");
  await expect(p.getByRole("heading", { level: 1 })).toContainText("Participe do Quiz da Alana!");
  await expect(p.getByTestId("qr-code").locator("svg")).toBeVisible();
  await p.screenshot({ path: testInfo.outputPath("qr.png") });
  const png = await p.request.get("/quiz/qr/png");
  expect((await png.body()).subarray(1, 4).toString()).toBe("PNG");
  const pdf = await p.request.get("/quiz/qr/cartaz");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await p.context().close();
  await a.context().close();
});

test("invalidação pelo painel avisa o convidado; travas depois de abrir; um por aparelho", async ({ browser }, testInfo) => {
  const a = await admin(browser);
  await reset(a, 2, "shared");
  await a.goto("/admin/quiz/ajustes");
  await setSwitch(a, "same-device", false);
  await a.goto("/admin/quiz");
  await click(a, "quiz-open", "Quiz aberto");
  await a.goto("/admin/quiz/perguntas");
  await expect(a.getByTestId("questions-locked")).toBeVisible();
  await expect(a.getByTestId("question-new")).toHaveCount(0);
  await expect(a.getByRole("button", { name: "Excluir" })).toHaveCount(0);

  const p = await guest(browser, testInfo);
  await begin(p, "Repetida");
  await respond(p, 2, 1);
  await expect(p.getByTestId("quiz-thanks")).toBeVisible();
  await expect(p.getByTestId("answer-for-other")).toHaveCount(0);
  await p.request.delete("/api/quiz/session");
  const again = await p.request.post("/api/quiz/start", { data: { name: "Outra", lang: "pt", startKey: "cd".repeat(16) } });
  expect(await again.json()).toEqual({ error: "device_used" });
  await p.goto("/quiz");
  await p.locator("#quiz-name").fill("Outra");
  await expect(p.getByTestId("quiz-start")).toBeEnabled();
  await p.getByTestId("quiz-start").click({ force: true });
  await expect(p.getByTestId("quiz-already")).toContainText("Você já respondeu este quiz!");

  await a.goto("/admin/quiz/ajustes");
  await setSwitch(a, "same-device", true);
  const p2 = await guest(browser, testInfo);
  await begin(p2, "Cancelada");
  await a.goto("/admin/quiz/participantes");
  await a.getByTestId("participant-row").filter({ hasText: "Cancelada" }).getByRole("button", { name: "Invalidar" }).click();
  await toast(a, "invalidada");
  await option(p2, 0).click();
  await expect(p2.getByTestId("quiz-invalid")).toBeVisible();

  // deixa tudo como começou para o próximo navegador
  await reset(a, 2, "time");
  await a.goto("/admin/quiz/ao-vivo");
  await setSwitch(a, "live-enabled", false);
  for (const x of [p, p2, a]) await x.context().close();
});
