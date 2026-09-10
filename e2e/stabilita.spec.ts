/**
 * НЕПОДВИЖНОСТЬ — страница не должна ехать под читателем.
 *
 * Проверка появилась не из принципа, а по трём найденным случаям, каждый из
 * которых выглядел безобидно в исходниках:
 *
 *   — полоса состояния пряталась, пока пуста, и, заполнившись скриптом,
 *     раздвигала шапку: вся страница уезжала вниз ровно тогда, когда
 *     читатель начинал читать первый абзац;
 *   — высота шапки бралась из шрифта, и рукописное начертание, приехав,
 *     меняло её на пару пикселей — этого хватало;
 *   — приборы занимали до оживления одинаковое место, а оживали под самым
 *     пальцем, и текст под ними прыгал на три сотни пикселей.
 *
 * Ни один из трёх не ловился ни типами, ни модульными тестами, ни глазами:
 * на быстрой машине с тёплым кэшем ничего не двигается. Поэтому здесь —
 * холодный кэш, замедленный вчетверо процессор и подсчёт сдвигов.
 */
import { expect, test, type Page } from '@playwright/test';

/** Что рассказал браузер о сдвигах после загрузки. */
interface Сдвиг {
  readonly значение: number;
  readonly когда: number;
  readonly кто: readonly string[];
}

declare global {
  interface Window {
    __сдвиги?: Сдвиг[];
  }
}

async function сдвиги(page: Page, путь: string): Promise<Сдвиг[]> {
  await page.addInitScript(() => {
    window.__сдвиги = [];
    new PerformanceObserver((список) => {
      for (const запись of список.getEntries()) {
        const с = запись as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
          sources?: { node?: Element; previousRect?: DOMRectReadOnly; currentRect?: DOMRectReadOnly }[];
        };
        /* Сдвиг сразу после действия читателя — не беда, а следствие:
           раскрытая подсказка и должна раздвинуть текст. */
        if (с.hadRecentInput) continue;
        window.__сдвиги!.push({
          значение: Number(с.value.toFixed(4)),
          когда: Math.round(с.startTime),
          /* Узел источника Chrome отдаёт не всегда, а прямоугольники — всегда.
             Поэтому в отчёт идёт и то и другое: по имени понятно что, по
             сдвигу прямоугольника — насколько и куда. */
          кто: (с.sources ?? [])
            .map((и) => {
              const э = и.node as HTMLElement | undefined;
              const имя = э ? э.nodeName + '.' + String(э.className ?? '') : '?';
              const б = (r: DOMRectReadOnly | undefined) =>
                r ? `${Math.round(r.top)}+${Math.round(r.height)}` : '?';
              return `${имя} ${б(и.previousRect)}→${б(и.currentRect)}`;
            })
            .slice(0, 3),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  /* Холодный кэш обязателен: со вторым заходом шрифты уже на устройстве,
     и всё, что двигалось из-за них, двигаться перестаёт. */
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await page.goto(путь, { waitUntil: 'load' });
  /* Приборы оживают по пересечению — доезжаем до низа и обратно, как
     читатель. Всё, что при этом дёрнется, попадёт в подсчёт. */
  for (let i = 0; i < 12; i += 1) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(2500);
  return page.evaluate(() => window.__сдвиги ?? []);
}

for (const путь of [
  './',
  'kubernetes/',
  'kubernetes/riconciliazione/1/',
  'kubernetes/scheduler/1/',
  'kubernetes/dichiarativo/1/',
  'cibernetica/feedback/2/',
  'blocchi/',
]) {
  test(`ничего не съезжает: ${путь}`, async ({ page }) => {
    const найденные = await сдвиги(page, путь);
    const сумма = найденные.reduce((с, э) => с + э.значение, 0);
    /* Порог Core Web Vitals — 0,1. Здесь на порядок строже: у статической
       страницы, где место под каждый прибор занято заранее, поводов ехать
       нет вовсе, и всякий сдвиг означает, что повод завёлся. */
    expect(сумма, JSON.stringify(найденные)).toBeLessThan(0.01);
  });
}
