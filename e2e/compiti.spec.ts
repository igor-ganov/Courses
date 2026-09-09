/**
 * ВИДЫ ЗАДАНИЙ — те три, у которых своя разметка.
 *
 * Выбор и число проверены в `lezione.spec.ts` заодно со счётом. Здесь —
 * порядок, сопоставление и цель в приборе, и не из любви к полноте: все три
 * ДОЛГО существовали в движке оценки, проверялись модульными тестами и при
 * этом не имели на странице ни одного элемента управления. Виток с таким
 * заданием выглядел совершенно обычно и был непроходим.
 *
 * Модульный тест этого поймать не мог: он проверял оценку, а не то, что
 * ответ вообще можно дать. Поэтому проверка здесь и именно такая — довести
 * задание до конца руками.
 */
import { expect, test, type Locator } from '@playwright/test';

/** Дождаться, пока задание оживёт: до этого элемент пуст. */
async function готово(задание: Locator) {
  await задание.scrollIntoViewIfNeeded();
  await задание.locator('.domanda').waitFor();
}

test('порядок: пункты переставляются стрелками и оцениваются по стыкам', async ({ page }) => {
  await page.goto('cibernetica/stability/2/');
  const задание = page.locator('cy-quiz').last();
  await готово(задание);

  const пунктов = await задание.locator('.voce').count();
  expect(пунктов).toBeGreaterThan(2);

  /* Показывается заведомо неверный порядок: иначе ответ был бы уже дан. */
  await задание.getByRole('button', { name: 'Ответить' }).click();
  await expect(задание.locator('.esito')).not.toHaveText('Верно.');
  await задание.getByRole('button', { name: 'Ещё раз' }).click();

  /* Пузырьком: верхний топится до дна, потом следующий. Каждый ход — одна
     кнопка, то есть ровно то, что делает читатель пальцем. */
  for (let проход = 0; проход < пунктов - 1; проход += 1) {
    for (let i = 0; i < пунктов - 1 - проход; i += 1) {
      await задание.locator('.voce').nth(i).locator('.freccia').nth(1).click();
    }
  }

  await задание.getByRole('button', { name: 'Ответить' }).click();
  await expect(задание.locator('.esito')).toHaveText('Верно.');
  /* Разбор приходит и на верный ответ: угадавший и знающий должны разойтись. */
  await expect(задание.locator('.spiegazione')).toHaveText(/\S/);
});

test('сопоставление: пока не выбраны все пары, отвечать нечем', async ({ page }) => {
  await page.goto('cibernetica/emergence/1/');
  const задание = page.locator('cy-quiz').last();
  await готово(задание);

  const пар = await задание.locator('.coppia').count();
  expect(пар).toBeGreaterThan(1);
  await expect(задание.getByRole('button', { name: 'Ответить' })).toBeDisabled();

  for (let i = 0; i < пар; i += 1) {
    await задание.locator('.coppia select').nth(i).selectOption(String(i));
  }
  await expect(задание.getByRole('button', { name: 'Ответить' })).toBeEnabled();
  await задание.getByRole('button', { name: 'Ответить' }).click();
  await expect(задание.locator('.esito')).toHaveText('Верно.');
});

test('цель в приборе: задание ждёт донесения и засчитывается само', async ({ page }) => {
  await page.goto('cibernetica/control/1/');
  const задание = page.locator('cy-quiz').last();
  await готово(задание);

  /* Пока прибор молчит, зачитывать нечего — и кнопка это признаёт. */
  await expect(задание.locator('.compito')).toHaveText(/выполняется в приборе/);
  await expect(задание.getByRole('button', { name: 'Зачесть как есть' })).toBeDisabled();

  /* Одним P задание не берётся — нужен интеграл; так в разборе и написано. */
  const прибор = page.locator('cy-contorno').first();
  await прибор.scrollIntoViewIfNeeded();
  await прибор.locator('.quadrante').first().waitFor();
  await прибор.locator('input[type=range]').nth(1).fill('0.3');

  await expect(задание.locator('.esito')).toHaveText('Верно.', { timeout: 60_000 });
  await expect(page.locator('[data-conteggio]')).toHaveText(/1 из 2|2 из 2/);
});
