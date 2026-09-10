/**
 * ЛИСТАНИЕ — сколько стоит прокрутка пальцем.
 *
 * Отдельный скрипт, а не сквозная проверка, и это вынужденно: замер времени
 * кадра внутри Playwright-раннера показывает 51 мс там, где в голом процессе
 * 17, — обвязка раннера сама съедает кадры, и разницы между «с бумагой» и
 * «без» на этом фоне не видно вовсе. Проверено: подсунутая заведомо сломанная
 * версия проходила такую проверку насквозь.
 *
 * Меряется отношение, а не миллисекунды: та же страница листается дважды —
 * с освещённой бумагой и без неё. Абсолютные числа зависят от машины,
 * отношение — почти нет.
 *
 *     node scripts/scorrimento.mjs [адрес ...]
 */

import { chromium, devices } from '@playwright/test';

const БАЗА =
  (process.env['FARO_BASE'] ?? 'http://127.0.0.1:4321') +
  (process.env['PAGES_BASE'] ?? '/').replace(/\/*$/, '');
const ПУТИ = process.argv.slice(2);
const адреса = ПУТИ.length > 0 ? ПУТИ : ['/kubernetes/riconciliazione/1/', '/cibernetica/feedback/2/'];

/* До починки было 46 мс против 17 (отношение 2,7) и 0,73 доли длинных кадров
   против 0,05; после — 17 против 17 и 0,16 против 0,05. Пороги с запасом:
   ловят возврат прежней беды, но не цепляются за обычный разброс. */
const ОТНОШЕНИЕ = Number(process.env['SCORR_RAPPORTO'] ?? 1.6);
const ЛИШНИХ = Number(process.env['SCORR_LUNGHI'] ?? 0.35);

const браузер = await chromium.launch();

/** Один замер: шесть свайпов пальцем по замедленному вчетверо телефону. */
async function листать(адрес, безБумаги) {
  const контекст = await браузер.newContext({ ...devices['Pixel 7'] });
  if (безБумаги) await контекст.route('**/materia/**', (м) => м.abort());
  const стр = await контекст.newPage();
  const cdp = await контекст.newCDPSession(стр);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await стр.addInitScript(() => {
    window.__кадры = [];
    let t = performance.now();
    const тик = () => {
      const n = performance.now();
      window.__кадры.push(n - t);
      t = n;
      requestAnimationFrame(тик);
    };
    requestAnimationFrame(тик);
  });

  await стр.goto(адрес, { waitUntil: 'load' });
  await стр.waitForTimeout(1500);
  /* Первое касание уходит на загрузку бумаги — её обработчиков ещё нет, и
     жест до неё не доходит. Мерить надо листание, а не эту разовую плату. */
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 400 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await стр.waitForTimeout(1200);
  await стр.evaluate(() => {
    window.__кадры.length = 0;
  });

  for (let свайп = 0; свайп < 6; свайп += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 700 }] });
    for (let i = 1; i <= 14; i += 1) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 200, y: 700 - (500 * i) / 14 }],
      });
      await стр.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await стр.waitForTimeout(250);
  }
  await стр.waitForTimeout(1000);

  const кадры = (await стр.evaluate(() => window.__кадры)).sort((a, b) => a - b);
  await контекст.close();
  return {
    всего: кадры.length,
    медиана: кадры[Math.floor(кадры.length / 2)] ?? 0,
    длинных: кадры.filter((к) => к > 32).length / Math.max(кадры.length, 1),
  };
}

let плохо = false;

try {
  for (const путь of адреса) {
    const адрес = путь.startsWith('http') ? путь : БАЗА + путь;
    const без = await листать(адрес, true);
    const с = await листать(адрес, false);
    const отношение = с.медиана / Math.max(без.медиана, 1);
    const лишних = с.длинных - без.длинных;

    console.log(`\n${путь}`);
    console.log(
      `  без бумаги: медиана ${без.медиана.toFixed(0)} мс, длинных ${(без.длинных * 100).toFixed(0)} %`,
    );
    console.log(
      `  с бумагой:  медиана ${с.медиана.toFixed(0)} мс, длинных ${(с.длинных * 100).toFixed(0)} %`,
    );
    console.log(
      `  отношение ${отношение.toFixed(2)} (порог ${ОТНОШЕНИЕ}), ` +
        `лишних длинных ${(лишних * 100).toFixed(0)} % (порог ${(ЛИШНИХ * 100).toFixed(0)} %)`,
    );
    if (отношение >= ОТНОШЕНИЕ || лишних >= ЛИШНИХ) плохо = true;
  }
} finally {
  await браузер.close();
}

if (плохо) {
  console.error('\nлистание: бумага мешает прокрутке');
  process.exit(1);
}
console.log('\nлистание: бумага прокрутке не мешает');
