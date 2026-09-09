/**
 * ВИТОК — что должно работать на странице лекции.
 *
 * Проверяется не «страница открылась», а три обещания, ради которых всё это
 * и построено:
 *
 *   1. текст читается до всякого скрипта;
 *   2. прибор не грузится, пока до него не доехали, — и оживает, когда доехали;
 *   3. решённые работы превращаются в опыт и переживают перезагрузку.
 */
import { expect, test } from '@playwright/test';

const ВИТОК = 'cibernetica/feedback/2/';

test.describe('страница витка', () => {
  test('содержание приезжает разметкой, без скриптов', async ({ browser }) => {
    /* Без JS страница обязана остаться лекцией: это и есть проверка того, что
       текст не собирается на устройстве. */
    const контекст = await browser.newContext({ javaScriptEnabled: false });
    const стр = await контекст.newPage();
    await стр.goto(ВИТОК);

    await expect(стр.locator('h1')).toHaveText('Знак связи');
    expect((await стр.locator('.testo p').first().innerText()).length).toBeGreaterThan(120);
    /* Целей витка и оглавления спирали тоже касаться нечему. */
    await expect(стр.locator('.obiettivi li')).not.toHaveCount(0);
    await expect(стр.locator('.spirale .giro')).toHaveCount(3);

    const знаков = await стр.locator('.testo').innerText();
    expect(знаков.length).toBeGreaterThan(2000);

    await контекст.close();
  });

  test('прибор ждёт своей очереди и оживает при подходе', async ({ page }) => {
    await page.goto(ВИТОК);

    const прибор = page.locator('cy-contorno').first();
    await expect(прибор).toHaveCount(1);
    /* До подхода — пустой элемент: ни теневого корня, ни кода. */
    expect(await прибор.evaluate((el) => el.shadowRoot !== null)).toBe(false);

    await прибор.scrollIntoViewIfNeeded();
    await expect
      .poll(async () => прибор.evaluate((el) => el.shadowRoot !== null), { timeout: 10_000 })
      .toBe(true);

    /* Ожил — значит считает: приборные числа обязаны меняться сами. */
    const число = () => прибор.evaluate((el) => el.shadowRoot?.querySelector('.quadrante span')?.textContent ?? '');
    const было = await число();
    await expect.poll(число, { timeout: 10_000 }).not.toBe(было);
  });

  test('решённые работы дают опыт, и он переживает перезагрузку', async ({ page }) => {
    await page.goto(ВИТОК);
    await expect(page.locator('[data-conteggio]')).toHaveText('0 из 2');

    /* Селекторы Playwright сами проходят сквозь открытый теневой корень,
       поэтому прибор проверяется снаружи, как его видит читатель. */
    for (const квиз of await page.locator('cy-quiz').all()) {
      await квиз.scrollIntoViewIfNeeded();
      /* Прибор оживает не мгновенно: сперва грузится кусок. Ждём, пока
         вопрос действительно встанет на страницу. */
      await квиз.locator('.domanda').waitFor();
      /* Отвечаем первым, что подвернулось: проверяется учёт работы, а не
         знание ответа. Оценка при этом может выйти и нулевой — и должна
         всё равно считаться сделанной работой. */
      const варианты = квиз.locator('.opzione');
      if (await варианты.count()) await варианты.first().click();
      else await квиз.locator('input[type=text]').fill('1');
      await квиз.getByRole('button', { name: 'Ответить' }).click();
    }

    await expect(page.locator('[data-conteggio]')).toHaveText('2 из 2');
    await expect(page.locator('[data-esito]')).toBeVisible();
    await expect(page.locator('.stato .grado')).toHaveText(/\S/);

    const опыт = () => page.evaluate(() => JSON.parse(localStorage.getItem('courses.progress') ?? '{}').xp ?? 0);
    expect(await опыт()).toBeGreaterThan(0);

    await page.reload();
    expect(await опыт()).toBeGreaterThan(0);
    /* И на оглавлении виток теперь помечен как начатый или сданный. */
    await page.goto('cibernetica/');
    await expect(
      page.locator('[data-livello="cibernetica/feedback:2"]').first(),
    ).toHaveAttribute('data-stato', /fatto|iniziato/);
  });

  test('переходы вперёд и назад ведут по учебному плану', async ({ page }) => {
    await page.goto(ВИТОК);
    await page.locator('.successivo').click();
    await expect(page).toHaveURL(/\/cibernetica\/feedback\/3\/$/);
    await page.locator('.precedente').click();
    await expect(page).toHaveURL(new RegExp(`/${ВИТОК}$`));
  });
});
