/**
 * КРАСКА — сколько браузер перекрашивает при прокрутке.
 *
 * Это второй замер прокрутки, и он нужен потому, что первый (scorrimento.mjs)
 * слеп ровно к той беде, на которую жалуется читатель. Тот меряет длину кадра
 * на главном потоке; но перспектива, режим смешивания и непродвинутый слой
 * стоят не в главном потоке, а в растеризации, — и страница, у которой все
 * кадры короткие, всё равно доезжает во вьюпорт с видимой задержкой.
 *
 * Меряется прямо: трассировка Chrome, сумма RasterTask и Paint за десяток
 * прыжков на экран. Как и в листании, порог на отношении «с бумагой» к «без
 * бумаги», а не на миллисекундах: абсолютные числа зависят от машины, а
 * headless к тому же красит на процессоре.
 *
 * Числа, на которых порог поставлен (1280×900, ×4, десять прыжков):
 *
 *     до починки   855 мс против 102 — отношение 8,4
 *     после        181 мс против  99 — отношение 1,8
 *
 * Что именно стоило этой восьмикратной разницы, разобрано в materia.js: там
 * у каждой строки написано, сколько она стоила и чем заменена.
 *
 *     node scripts/vernice.mjs [адрес ...]
 */

import { chromium, devices } from '@playwright/test';

const БАЗА =
  (process.env['FARO_BASE'] ?? 'http://127.0.0.1:4321') +
  (process.env['PAGES_BASE'] ?? '/').replace(/\/*$/, '');
const ПУТИ = process.argv.slice(2);
const адреса =
  ПУТИ.length > 0 ? ПУТИ : ['/kubernetes/dichiarativo/1/', '/cibernetica/feedback/2/'];

/* Порог посередине между нынешним состоянием и прежним, в логарифме: вдвое
   выше того, что есть, и вдвое ниже того, что было. */
const ОТНОШЕНИЕ = Number(process.env['VERN_RAPPORTO'] ?? 3.5);
const ПРЫЖКОВ = 10;

const браузер = await chromium.launch();

/** Один замер: десять прыжков на экран, сумма растеризации из трассировки. */
async function красить(адрес, профиль, безБумаги) {
  const контекст = await браузер.newContext(
    профиль === 'ладонь' ? { ...devices['Pixel 7'] } : { viewport: { width: 1280, height: 900 } },
  );
  if (безБумаги) await контекст.route('**/materia/**', (м) => м.abort());
  const стр = await контекст.newPage();
  const cdp = await контекст.newCDPSession(стр);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await стр.goto(адрес, { waitUntil: 'load' });
  /* Бумага завешивается отложенно, приборы оживают по пересечению: мерить
     надо установившийся режим, а не эту разовую плату. */
  await стр.waitForTimeout(2500);

  const события = [];
  cdp.on('Tracing.dataCollected', ({ value }) => события.push(...value));
  await cdp.send('Tracing.start', {
    /* Вторая категория обязательна, и это не перестраховка: растеризация
       идёт не в главном потоке, и в одной только devtools.timeline её почти
       нет. Проверено подсунутой сломанной версией — без этой строки замер
       показывал отношение 0,9 там, где на самом деле было 8,4. */
    traceConfig: {
      includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'],
    },
    transferMode: 'ReportEvents',
  });

  for (let i = 0; i < ПРЫЖКОВ; i += 1) {
    await стр.evaluate((h) => scrollBy(0, h), профиль === 'ладонь' ? 700 : 800);
    await стр.waitForTimeout(200);
  }

  const конец = new Promise((р) => cdp.once('Tracing.tracingComplete', р));
  await cdp.send('Tracing.end');
  await конец;
  await контекст.close();

  let краска = 0;
  for (const е of события) {
    if (е.ph !== 'X' || !е.dur) continue;
    if (е.name === 'RasterTask' || е.name === 'Paint') краска += е.dur / 1000;
  }
  return краска;
}

let плохо = false;

try {
  for (const путь of адреса) {
    const адрес = путь.startsWith('http') ? путь : БАЗА + путь;
    console.log(`\n${путь}`);
    for (const профиль of ['стол', 'ладонь']) {
      const без = await красить(адрес, профиль, true);
      const с = await красить(адрес, профиль, false);
      const отношение = с / Math.max(без, 1);
      console.log(
        `  ${профиль}: без бумаги ${без.toFixed(0)} мс, с бумагой ${с.toFixed(0)} мс, ` +
          `отношение ${отношение.toFixed(1)} (порог ${ОТНОШЕНИЕ})`,
      );
      if (отношение >= ОТНОШЕНИЕ) плохо = true;
    }
  }
} finally {
  await браузер.close();
}

if (плохо) {
  console.error('\nкраска: бумага перекрашивает экран при каждой прокрутке');
  process.exit(1);
}
console.log('\nкраска: прокрутка ничего лишнего не перекрашивает');
