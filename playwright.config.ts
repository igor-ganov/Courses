/**
 * Сквозные проверки идут по собранному сайту, а не по dev-серверу.
 *
 * Разница не косметическая: офлайн, служитель, отложенные куски и отпечатки
 * в именах существуют только после сборки. Проверять их на dev-сервере —
 * значит проверять другую программу.
 *
 * Телефон здесь основной, а не дополнительный: тетрадь читают в ладони, и
 * если что-то ломается, ломается оно там.
 */
import { defineConfig, devices } from '@playwright/test';

const ПОРТ = 4321;
/* Префикс сайта. На Pages тетрадь живёт в подкаталоге, и проверять её на
   корне значило бы не проверить как раз то, что ломается при переезде.
   Поэтому адреса в проверках относительные — они считаются от базы. */
const БАЗА = (process.env.PAGES_BASE ?? '/').replace(/\/*$/, '/');

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${ПОРТ}${БАЗА}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'ладонь', use: { ...devices['Pixel 7'] } },
    { name: 'стол', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    /* `astro preview` отдаёт ровно то, что уедет на Pages, и с тем же base. */
    command: `npx astro preview --port ${ПОРТ} --host 127.0.0.1`,
    url: `http://127.0.0.1:${ПОРТ}${БАЗА}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
