import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta contra o build de produção (next build + next start),
 * usando o armazenamento local isolado em .data-test (sem tocar no Supabase real).
 * Credenciais abaixo são apenas de teste.
 */
export const TEST_ADMIN = { email: "mae@teste.test", password: "senha-de-teste-123", name: "Mamãe Teste" };
export const TEST_ADMIN_2 = { email: "pai@teste.test", password: "senha-de-teste-456", name: "Papai Teste" };
const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "iphone-safari", use: { ...devices["iPhone 13"] } },
    { name: "android-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      ALLOW_LOCAL_STORE: "1",
      NEXT_DIST_DIR: ".next-test",
      LOCAL_DATA_DIR: ".data-test",
      DISABLE_RATE_LIMIT: "1",
      SESSION_SECRET: "segredo-de-teste-com-mais-de-32-caracteres!!",
      LOCAL_ADMINS: `${TEST_ADMIN.email}|${TEST_ADMIN.password}|${TEST_ADMIN.name};${TEST_ADMIN_2.email}|${TEST_ADMIN_2.password}|${TEST_ADMIN_2.name}`,
      SITE_URL: `http://localhost:${PORT}`,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SECRET_KEY: "",
    },
  },
});
