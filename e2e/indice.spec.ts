/**
 * ОГЛАВЛЕНИЕ, ГАЛЕРЕЯ И ПОВТОРЕНИЕ — страницы вокруг лекции.
 *
 * Проверяется главным образом то, что легко сломать незаметно: обе развёртки
 * курса ведут в одни и те же витки, галерея показывает весь реестр, а очередь
 * повторения появляется тогда и только тогда, когда есть что повторять.
 */
import { expect, test } from '@playwright/test';

test.describe('оглавление курса', () => {
  test('обе развёртки ведут в одни и те же витки', async ({ page }) => {
    await page.goto('/cibernetica/');

    const адреса = async () =>
      (await page.locator('section.vista:not([hidden]) a[data-livello]').evaluateAll((узлы) =>
        узлы.map((у) => (у as HTMLAnchorElement).pathname),
      )).sort();

    /* По спирали открыто сразу: без скрипта читатель видит именно её. */
    const спираль = await адреса();
    expect(спираль.length).toBe(17);

    await page.getByRole('tab', { name: 'по модулям' }).click();
    const модули = await адреса();
    expect(модули).toEqual(спираль);
  });

  test('спираль идёт по глубине, а не по темам', async ({ page }) => {
    await page.goto('/cibernetica/');
    const глубины = await page
      .locator('section[data-vista="spirale"] a[data-livello]')
      .evaluateAll((узлы) => узлы.map((у) => Number(у.getAttribute('data-livello')!.split(':')[1])));

    /* Все первые витки идут раньше всех вторых: иначе это не спираль. */
    expect(глубины).toEqual([...глубины].sort((a, b) => a - b));
    expect(глубины.filter((d) => d === 1).length).toBe(9);
  });

  test('без скрипта оглавление всё равно доводит до витка', async ({ browser }) => {
    const контекст = await browser.newContext({ javaScriptEnabled: false });
    const стр = await контекст.newPage();
    await стр.goto('/cibernetica/');
    await стр.locator('section[data-vista="spirale"] a[data-livello]').first().click();
    await expect(стр.locator('h1')).toHaveText(/\S/);
    await контекст.close();
  });
});

test.describe('галерея блоков', () => {
  test('показывает весь реестр, и каждый блок живой', async ({ page }) => {
    await page.goto('/blocchi/');

    /* Каждому виду — свой раздел с примером; ни одной карточки беды. */
    const разделов = await page.locator('.galleria .voce').count();
    expect(разделов).toBeGreaterThan(15);
    await expect(page.locator('.guasto')).toHaveCount(0);

    /* Приборы в галерее оживают так же, как в лекции. */
    const прибор = page.locator('cy-vita').first();
    await прибор.scrollIntoViewIfNeeded();
    await expect.poll(async () => прибор.evaluate((el) => el.shadowRoot !== null), { timeout: 10_000 }).toBe(true);
  });
});

test.describe('повторение', () => {
  test('пусто, пока ничего не сдано', async ({ page }) => {
    await page.goto('/ripasso/');
    await expect(page.locator('[data-vuoto]')).toBeVisible();
    await expect(page.locator('.coda .riga:visible')).toHaveCount(0);
  });

  test('сданный виток возвращается в очередь, когда придёт срок', async ({ page }) => {
    await page.goto('/ripasso/');
    /* Подкладываем состояние прямо в хранилище: ждать сутки ради проверки
       очереди — не проверка, а ожидание. Формат — тот же, что пишет движок. */
    await page.evaluate(() => {
      localStorage.setItem(
        'courses.progress',
        JSON.stringify({
          xp: 40,
          levels: {
            'cibernetica/feedback:2': {
              mastery: 0.8,
              attempts: 1,
              lastScore: 0.8,
              due: Date.now() - 3 * 86_400_000,
              interval: 1,
              doneAt: Date.now() - 4 * 86_400_000,
            },
          },
          streak: { current: 1, best: 1, lastDay: Math.floor(Date.now() / 86_400_000) },
          badges: [],
        }),
      );
    });
    await page.reload();

    const строка = page.locator('.riga[data-livello="cibernetica/feedback:2"]');
    await expect(строка).toBeVisible();
    await expect(строка.locator('[data-scaduto]')).toHaveText(/просрочено на 3 дн\./);
    await expect(page.locator('[data-vuoto]')).toBeHidden();
    /* И в шапке появляется зов на повторение. */
    await expect(page.locator('.stato .ripasso')).toHaveText(/на повторение: 1/);
  });

  test('прогресс выписывается и вставляется обратно', async ({ page }) => {
    await page.goto('/ripasso/');
    await page.evaluate(() => localStorage.setItem('courses.progress', JSON.stringify({ xp: 123, levels: {}, streak: { current: 0, best: 0, lastDay: null }, badges: [] })));
    await page.reload();

    await page.getByRole('button', { name: 'Выписать' }).click();
    const выписка = await page.locator('[data-scambio]').inputValue();
    expect(JSON.parse(выписка).xp).toBe(123);

    /* Чужая выписка не должна молча затирать свою. */
    await page.locator('[data-scambio]').fill('{"это":"не выписка"}');
    await page.getByRole('button', { name: 'Вставить' }).click();
    await expect(page.locator('[data-esito-scambio]')).toHaveClass(/male/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('courses.progress')!).xp)).toBe(123);
  });
});
