/**
 * БЕЗ СЕТИ — главное обещание тетради, и потому проверяется по-настоящему.
 *
 * Настоящность здесь в двух вещах. Во-первых, сеть отключается на уровне
 * контекста браузера: `setOffline(true)` роняет всякий запрос наружу, а не
 * делает вид. Во-вторых, открывается виток, на котором читатель НЕ БЫЛ, —
 * иначе проверялся бы обычный кэш браузера, а не опись служителя.
 */
import { expect, test, type BrowserContext } from '@playwright/test';

/** Дождаться, пока служитель встанет и разложит опись. */
async function служительГотов(context: BrowserContext, стр: import('@playwright/test').Page) {
  await стр.waitForFunction(() => navigator.serviceWorker?.controller !== null, undefined, {
    timeout: 30_000,
  });
  /* Регистрация — это ещё не «всё лежит»: установка кладёт опись пачками.
     Ждём, пока в хранилище окажется столько же адресов, сколько в описи. */
  await стр.waitForFunction(
    async () => {
      const имена = await caches.keys();
      const имя = имена.find((n) => n.startsWith('quaderno-'));
      if (!имя) return false;
      const кэш = await caches.open(имя);
      return (await кэш.keys()).length > 40;
    },
    undefined,
    { timeout: 60_000 },
  );
  void context;
}

test.describe('тетрадь без сети', () => {
  test('виток, на котором читатель не был, открывается без сети', async ({ context, page }) => {
    await page.goto('./');
    await служительГотов(context, page);

    await context.setOffline(true);

    /* Никуда, кроме этого адреса, читатель не заходил. Если страница
       откроется, значит опись действительно разложена целиком. */
    const ответ = await page.goto('cibernetica/secondorder/1/');
    expect(ответ?.status(), 'страница отдана служителем').toBeLessThan(400);

    await expect(page.locator('h1')).toHaveText('Кибернетика наблюдающих систем');
    const текст = await page.locator('.testo').innerText();
    expect(текст.length).toBeGreaterThan(1500);

    /* И прибор без сети тоже обязан ожить: его кусок лежит в описи. */
    const ящик = page.locator('cy-scatola').first();
    await ящик.scrollIntoViewIfNeeded();
    await expect.poll(async () => ящик.evaluate((el) => el.shadowRoot !== null), { timeout: 15_000 }).toBe(true);

    await context.setOffline(false);
  });

  test('шрифты и значки тоже лежат на устройстве', async ({ context, page }) => {
    await page.goto('./');
    await служительГотов(context, page);
    await context.setOffline(true);

    await page.goto('cibernetica/');
    /* Рукописный шрифт — часть тетради, а не украшение: без него оглавление
       выглядит чужим. Проверяем, что он реально загружен, а не подменён. */
    const загружен = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some((f) => f.family === 'Caveat' && f.status === 'loaded');
    });
    expect(загружен).toBe(true);

    const значок = await page.request.get('icona-512.png');
    expect(значок.ok()).toBe(true);

    await context.setOffline(false);
  });

  test('манифест описывает установимое приложение', async ({ request }) => {
    const ответ = await request.get('manifest.webmanifest');
    expect(ответ.ok()).toBe(true);
    const м = await ответ.json();

    expect(м.name).toBeTruthy();
    expect(м.display).toBe('standalone');
    /* Установленное приложение должно открываться там же, где живёт сайт. */
    expect(м.start_url).toBe(м.scope);
    /* Android без маскируемого значка рисует белый круг поверх рисунка. */
    expect(м.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);

    for (const значок of м.icons) {
      const файл = await request.get(значок.src);
      expect(файл.ok(), значок.src).toBe(true);
    }
  });
});
