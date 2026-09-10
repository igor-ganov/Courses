/**
 * МАТЕРИЯ — бумага должна прогибаться под пальцем.
 *
 * Проверка появилась вместе с починкой прокрутки и именно из-за неё. Быстрота
 * листания меряется отдельно (scripts/scorrimento.mjs), но её порог проходит
 * и мёртвая бумага: прогиб, который ничего не считает, не стоит ничего.
 * Поэтому здесь наоборот — что он всё-таки происходит, и что после пальца
 * лист распрямляется, а не остаётся под фильтром навсегда.
 *
 * Смотрим на фильтр смещения, а не на пиксели: холст рисуется WebGL без
 * сохранения буфера, и прочитать его после кадра нельзя, а фильтр на листе
 * появляется ровно тогда, когда сжатие перевалило за порог видимости.
 */
import { expect, test, type Page } from '@playwright/test';

/** Бумага приезжает по первому признаку присутствия — до него её нет вовсе. */
async function разбудить(page: Page): Promise<void> {
  await page.goto('cibernetica/');
  await page.mouse.wheel(0, 10);
  await page.waitForSelector('.foglio', { timeout: 15_000 });
  /* Первое касание уходит на саму загрузку: обработчиков ещё нет, и жест до
     них не доходит. Ждём, пока лист соберётся, и только потом трогаем. */
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-materia') !== null,
    undefined,
    { timeout: 15_000 },
  );
}

const фильтр = () =>
  getComputedStyle(document.querySelector('.foglio') as HTMLElement).filter;

test('лист гнётся под пальцем и распрямляется', async ({ page }) => {
  await разбудить(page);

  /* Отрисовка шейдером — не роскошь: без неё вместо освещённой бумаги
     остаётся плоская краска, и прогибу не по чему идти. */
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-materia')))
    .toBe('illuminata');

  expect(await page.evaluate(фильтр)).toBe('none');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 200, y: 400 }],
  });
  /* Сжатие идёт пружиной, а не скачком: фильтр появляется не в тот же кадр. */
  await expect.poll(() => page.evaluate(фильтр), { timeout: 4000 }).toContain('piega-foglio');

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  /* И снимается: фильтр во весь экран, оставленный висеть, — это плата за
     каждый последующий кадр, включая кадры прокрутки. */
  await expect.poll(() => page.evaluate(фильтр), { timeout: 4000 }).toBe('none');
});

test('во время прокрутки лист не под фильтром', async ({ page, hasTouch }) => {
  /* Речь про листание пальцем: там, где пальца нет, ведение по экрану ничего
     не прокручивает, и мерить нечего — нажатие остаётся нажатием. */
  test.skip(!hasTouch, 'жест пальцем — только на сенсорном профиле');
  await разбудить(page);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 200, y: 700 }],
  });

  /* Палец лежит на листе и ведёт страницу. Пока непонятно, нажатие это или
     листание, лист успевает тронуться: пружина проходит ничтожную долю хода,
     и глазу этого не видно. А дальше страница поехала, и прогиб перестаёт
     считаться — по летящему тексту его всё равно не прочесть, а фильтр во
     весь экран стоит кадра.
   *
   * Порог здесь по времени, а не по числу замеров: возврат идёт пружиной и
   * занимает своё время независимо от того, сколько кадров успела нарисовать
   * машина. Счёт замеров это и подвёл — на своей машине под фильтром
   * оказывались два первых, на машине сборки шесть, и число ничего не
   * значило само по себе. */
  const ВЕДЁТ = 800;
  const ВСЕГО = 2400;
  let y = 700;
  let вниз = true;
  const пошло = Date.now();
  const замеры: string[] = [];
  while (Date.now() - пошло < ВСЕГО) {
    /* Ведём туда-обратно: у страницы есть край, а нам нужно, чтобы она ехала
       всё время замера — остановившись, лист имеет полное право прогнуться. */
    if (y <= 200) вниз = false;
    if (y >= 700) вниз = true;
    y += вниз ? -24 : 24;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 200, y }],
    });
    /* Первые ВЕДЁТ миллисекунд не в счёт: за них жест и опознаётся как
       листание, и лист успевает вернуться. */
    if (Date.now() - пошло > ВЕДЁТ) замеры.push(await page.evaluate(фильтр));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  expect(замеры.length, 'замеров не набралось').toBeGreaterThan(3);
  expect(замеры.join(' '), замеры.join(' ')).not.toContain('piega-foglio');
});
