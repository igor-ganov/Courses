/* Собран автоматически: scripts/offline.mjs. Править здесь нечего. */
const ХРАНИЛИЩЕ = 'quaderno-78c21db36196';
const ОПИСЬ = ["/Courses/","/Courses/_astro/Foglio.astro_astro_type_script_index_0_lang.Ch3sMstj.js","/Courses/_astro/_depth_.eOIfRysB.css","/Courses/_astro/automi.BvN9Gefo.js","/Courses/_astro/base.EFBAa4pS.js","/Courses/_astro/caveat-sempre.CRX6Vjg2.woff2","/Courses/_astro/coda.CKNi2lQD.js","/Courses/_astro/contorno.BrgqLRsY.js","/Courses/_astro/dinamica.BWVPGVuy.js","/Courses/_astro/gioco.ChfPDSzk.js","/Courses/_astro/index.astro_astro_type_script_index_0_lang.dijJV3nt.js","/Courses/_astro/informazione.Cl_GsZZh.js","/Courses/_astro/literata-b-raro.CCfzXczP.woff2","/Courses/_astro/literata-b-sempre.eDOY3w7I.woff2","/Courses/_astro/literata-i-raro.DmMaleAg.woff2","/Courses/_astro/literata-i-sempre.Dh1EYoH3.woff2","/Courses/_astro/literata-raro.Bm2PF4Fv.woff2","/Courses/_astro/literata-sempre.Bfql75LH.woff2","/Courses/_astro/manifesto.DiPjBe1k.js","/Courses/_astro/officina.DSpbHmBg.js","/Courses/_astro/pianificatore.CD2t4jTX.js","/Courses/_astro/pt-mono-raro.DU9u2h2p.woff2","/Courses/_astro/pt-mono-sempre.Bcljgxq8.woff2","/Courses/_astro/quiz.C3O0VVnB.js","/Courses/_astro/riconciliazione.iBzfqTl1.js","/Courses/_astro/ripasso.astro_astro_type_script_index_0_lang.VcQflLzO.js","/Courses/_astro/selettore.-XWmXYsy.js","/Courses/_astro/simboli-0.S1vaKy87.woff2","/Courses/_astro/simboli-1.DrpCcrPn.woff2","/Courses/_astro/sonde.DwXT3KUA.js","/Courses/_astro/varieta.w0qDior5.js","/Courses/blocchi/","/Courses/cibernetica/","/Courses/cibernetica/blackbox/1/","/Courses/cibernetica/control/1/","/Courses/cibernetica/control/2/","/Courses/cibernetica/emergence/1/","/Courses/cibernetica/emergence/2/","/Courses/cibernetica/feedback/1/","/Courses/cibernetica/feedback/2/","/Courses/cibernetica/feedback/3/","/Courses/cibernetica/information/1/","/Courses/cibernetica/information/2/","/Courses/cibernetica/secondorder/1/","/Courses/cibernetica/stability/1/","/Courses/cibernetica/stability/2/","/Courses/cibernetica/variety/1/","/Courses/cibernetica/variety/2/","/Courses/cibernetica/whatis/1/","/Courses/cibernetica/whatis/2/","/Courses/icona-192.png","/Courses/icona-512.png","/Courses/icona-maskable.png","/Courses/icona.svg","/Courses/kubernetes/","/Courses/kubernetes/dichiarativo/1/","/Courses/kubernetes/dichiarativo/2/","/Courses/kubernetes/dichiarativo/3/","/Courses/kubernetes/pod/1/","/Courses/kubernetes/pod/2/","/Courses/kubernetes/pod/3/","/Courses/kubernetes/riconciliazione/1/","/Courses/kubernetes/riconciliazione/2/","/Courses/kubernetes/riconciliazione/3/","/Courses/kubernetes/scheduler/1/","/Courses/kubernetes/scheduler/2/","/Courses/manifest.webmanifest","/Courses/materia/grana.png","/Courses/materia/materia.js","/Courses/ripasso/"];
const НАЧАЛО = "/Courses/";

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
