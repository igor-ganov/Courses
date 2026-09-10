/**
 * ФАРО — прогон Lighthouse по собранному сайту.
 *
 * Запускается против `astro preview`, а не dev-сервера: измерять надо то, что
 * уедет читателю, вместе с отпечатками в именах и отложенными кусками.
 *
 * Печатает четыре оценки и разбор по метрикам. Возвращает ненулевой код, если
 * хоть одна оценка ниже порога, — чтобы это можно было поставить в проверку,
 * а не смотреть глазами.
 *
 *   node scripts/faro.mjs [адрес ...]
 */

import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';

const ПОРОГ = Number(process.env['FARO_SOGLIA'] ?? 100);
const БАЗА = (process.env['FARO_BASE'] ?? 'http://127.0.0.1:4321') + (process.env['PAGES_BASE'] ?? '/').replace(/\/*$/, '');
const ПУТИ = process.argv.slice(2);
const адреса =
  ПУТИ.length > 0
    ? ПУТИ
    : [
        '/',
        '/kubernetes/',
        '/kubernetes/riconciliazione/1/',
        '/kubernetes/scheduler/1/',
        '/cibernetica/feedback/2/',
        '/blocchi/',
        '/ripasso/',
      ];

/* Браузер берётся тот же, которым идут сквозные проверки: другой браузер —
   другие числа, и сравнивать их между собой было бы не с чем. */
const chrome = await launch({
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'],
  chromePath: process.env['CHROME_PATH'] ?? chromium.executablePath(),
});

let худшее = 100;

try {
  for (const путь of адреса) {
    const адрес = путь.startsWith('http') ? путь : БАЗА + путь;
    const { lhr } = await lighthouse(
      адрес,
      { port: chrome.port, output: 'json', logLevel: 'error' },
      /* Профиль по умолчанию — телефон с четырёхкратным замедлением. Мерить
         на настольной машине без замедления значит мерить не то устройство. */
      undefined,
    );

    const оценки = Object.entries(lhr.categories).map(([, c]) => [c.title, Math.round((c.score ?? 0) * 100)]);
    худшее = Math.min(худшее, ...оценки.map(([, s]) => Number(s)));

    console.log(`\n${путь}`);
    console.log('  ' + оценки.map(([имя, балл]) => `${имя}: ${балл}`).join(' · '));

    const м = (id) => lhr.audits[id]?.displayValue ?? '—';
    console.log(
      `  FCP ${м('first-contentful-paint')} · LCP ${м('largest-contentful-paint')} · ` +
        `TBT ${м('total-blocking-time')} · CLS ${м('cumulative-layout-shift')} · SI ${м('speed-index')}`,
    );

    /* Что именно не даёт сотни — по каждой категории, с весом. */
    for (const c of Object.values(lhr.categories)) {
      const беды = c.auditRefs
        .map((ref) => ({ ref, a: lhr.audits[ref.id] }))
        .filter(({ ref, a }) => a && a.score !== null && a.score < 1 && (ref.weight > 0 || c.id !== 'performance'))
        .sort((x, y) => (y.ref.weight ?? 0) - (x.ref.weight ?? 0));
      for (const { ref, a } of беды) {
        console.log(
          `    ${c.id}/${a.id} = ${a.score.toFixed(2)}${ref.weight ? ` (вес ${ref.weight})` : ''}` +
            `${a.displayValue ? ` — ${a.displayValue}` : ''}`,
        );
      }
    }
  }
} finally {
  await chrome.kill();
}

if (худшее < ПОРОГ) {
  console.error(`\nфаро: худшая оценка ${худшее}, порог ${ПОРОГ}`);
  process.exit(1);
}
console.log(`\nфаро: все оценки не ниже ${ПОРОГ}`);
