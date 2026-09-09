/**
 * ОФЛАЙН — то, что превращает собранный сайт в тетрадь, которая не нужна сети.
 *
 * Запускается после `astro build` и делает три вещи над `dist/`:
 *
 *   1. рисует значки из `icona.svg` — 192, 512 и маскируемый 512 с полями
 *      под обрезку в круг, потому что TWA и Android требуют растр;
 *   2. составляет список всего, что собралось, вместе с отпечатками;
 *   3. пишет `sw.js` с этим списком внутри.
 *
 * Список нельзя написать руками: имена кусков содержат отпечатки и меняются
 * при каждой правке. Нельзя и обойтись без него: служитель, который кэширует
 * «что попросят», оставляет читателя без тех страниц, куда он не заходил, —
 * а обещано, что тетрадь работает целиком.
 *
 * Отпечаток всего списка становится именем хранилища. Поэтому обновление
 * тетради — это новое хранилище и разовая дозагрузка, а не разбор, что
 * устарело: разбирать нечего, всё либо то, либо не то.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';
import sharp from 'sharp';

const DIST = process.argv[2] ?? 'dist';
const BASE = (process.env.PAGES_BASE ?? '/').replace(/\/*$/, '/');

/* Что не имеет смысла держать в кэше. Служитель сам по себе кэшироваться не
   должен ни при каких условиях: иначе обновление тетради невозможно. */
const НЕ_КЭШИРОВАТЬ = [/^sw\.js$/, /\.map$/, /^assetlinks\.json$/, /^\.nojekyll$/];

async function* файлы(корень) {
  for (const запись of await readdir(корень, { withFileTypes: true })) {
    const путь = join(корень, запись.name);
    if (запись.isDirectory()) yield* файлы(путь);
    else yield путь;
  }
}

/* ── значки ────────────────────────────────────────────────────────── */

async function значки() {
  const svg = await readFile(join(DIST, 'icona.svg'));
  await sharp(svg, { density: 384 }).resize(192, 192).png().toFile(join(DIST, 'icona-192.png'));
  await sharp(svg, { density: 384 }).resize(512, 512).png().toFile(join(DIST, 'icona-512.png'));
  /* Маскируемый: система вырежет из него круг или скруглённый квадрат, и
     срезано будет до 20 % с каждой стороны. Поэтому рисунок ужимается до
     центральных 60 %, а поля докрашиваются цветом бумаги. */
  const ядро = await sharp(svg, { density: 384 }).resize(308, 308).png().toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: '#f3efe4' },
  })
    .composite([{ input: ядро, top: 102, left: 102 }])
    .png()
    .toFile(join(DIST, 'icona-maskable.png'));
  return ['icona-192.png', 'icona-512.png', 'icona-maskable.png'];
}

/* ── список ────────────────────────────────────────────────────────── */

async function опись() {
  const список = [];
  let вес = 0;
  for await (const путь of файлы(DIST)) {
    const имя = relative(DIST, путь).split(sep).join(posix.sep);
    if (НЕ_КЭШИРОВАТЬ.some((r) => r.test(имя))) continue;
    вес += (await stat(путь)).size;
    /* Адрес страницы — это папка: `/tema/1/`, а не `/tema/1/index.html`.
       Служитель ловит запросы по адресу, а не по файлу. */
    список.push(BASE + имя.replace(/(^|\/)index\.html$/, '$1'));
  }
  список.sort();
  return { список, вес };
}

/* ── служитель ─────────────────────────────────────────────────────── */

const служитель = (версия, список) => `/* Собран автоматически: scripts/offline.mjs. Править здесь нечего. */
const ХРАНИЛИЩЕ = 'quaderno-${версия}';
const ОПИСЬ = ${JSON.stringify(список, null, 0)};
const НАЧАЛО = ${JSON.stringify(BASE)};

/* Установка: тетрадь кладётся целиком, пачками. Пачки — чтобы сотня с лишним
   запросов разом не выбила соединение на телефоне в метро; там же, где сеть
   хорошая, разница незаметна. Одна упавшая пачка не роняет установку: чего
   не хватит, доедет позже по запросу. */
const кэшировать = (кэш, пачка) =>
  Promise.all(пачка.map((адрес) => кэш.add(new Request(адрес, { cache: 'reload' })).catch(() => {})));

self.addEventListener('install', (событие) => {
  событие.waitUntil(
    (async () => {
      const кэш = await caches.open(ХРАНИЛИЩЕ);
      for (let i = 0; i < ОПИСЬ.length; i += 12) {
        await кэшировать(кэш, ОПИСЬ.slice(i, i + 12));
      }
      await self.skipWaiting();
    })(),
  );
});

/* Смена версии: старые хранилища сносятся целиком. Разбирать, что в них
   устарело, незачем — имя хранилища и есть отпечаток всей описи. */
self.addEventListener('activate', (событие) => {
  событие.waitUntil(
    (async () => {
      for (const имя of await caches.keys()) {
        if (имя.startsWith('quaderno-') && имя !== ХРАНИЛИЩЕ) await caches.delete(имя);
      }
      await self.clients.claim();
    })(),
  );
});

/* Выдача: сперва кэш. Тетрадь неизменна внутри одной версии, поэтому ходить
   в сеть за уже лежащим — только тратить батарею и время.
   Чего в кэше нет — берётся из сети и кладётся; а если и сети нет, страница
   отвечает титулом: это честнее пустого экрана браузера.

   ignoreVary здесь обязателен, и это не перестраховка. Сервер отдаёт
   «Vary: Origin», а опись кладётся запросами самого служителя — без
   заголовка Origin. Документ же просит шрифты и модули в режиме CORS, то
   есть с Origin. Без ignoreVary эти запросы промахиваются мимо только что
   уложенного кэша: страница открывается, но без шрифтов и без приборов, и
   ровно так это и выглядело, пока не поймал сквозной тест. Тетрадь внутри
   одной версии неизменна, и отдавать по адресу всегда одно и то же —
   именно то, что здесь нужно. */
self.addEventListener('fetch', (событие) => {
  const запрос = событие.request;
  if (запрос.method !== 'GET') return;
  const адрес = new URL(запрос.url);
  if (адрес.origin !== self.location.origin) return;

  событие.respondWith(
    (async () => {
      const лежит = await caches.match(запрос, { ignoreSearch: true, ignoreVary: true });
      if (лежит) return лежит;
      try {
        const ответ = await fetch(запрос);
        if (ответ.ok && ответ.type === 'basic') {
          const кэш = await caches.open(ХРАНИЛИЩЕ);
          await кэш.put(запрос, ответ.clone());
        }
        return ответ;
      } catch (беда) {
        if (запрос.mode === 'navigate') {
          const титул = await caches.match(НАЧАЛО, { ignoreSearch: true, ignoreVary: true });
          if (титул) return титул;
        }
        throw беда;
      }
    })(),
  );
});
`;

/* ── сборка ────────────────────────────────────────────────────────── */

const нарисовано = await значки();
const { список, вес } = await опись();
const версия = createHash('sha256').update(список.join('\n')).digest('hex').slice(0, 12);

await writeFile(join(DIST, 'sw.js'), служитель(версия, список), 'utf8');

console.log(
  `офлайн: ${список.length} файлов, ${(вес / 1024 / 1024).toFixed(2)} МБ, ` +
    `хранилище quaderno-${версия}; значков нарисовано ${нарисовано.length}`,
);
