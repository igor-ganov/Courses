/* Собирает витрину: пять макетов в одну страницу с переключателем.
 *
 * Стили каждого направления загоняются под .direzione[data-dir="…"], иначе
 * пять целых таблиц стилей передерутся за :root, body и h1. Шрифты и
 * materia.js подключаются файлами, а не вшиваются в HTML: скрытые
 * направления свои начертания не тянут, а браузер кэширует их отдельно.
 *
 *   node design/costruisci.mjs   (из корня репозитория)
 */

import { readFileSync, writeFileSync } from 'node:fs';

const DIRS = [
  ['quaderno', 'Тетрадь', 'клетка, поля, паста', '01-quaderno'],
  ['cianotipia', 'Синька', 'светокопия, только линии', '02-cianotipia'],
  ['telescrivente', 'Телетайп', '1948, знакоместо', '03-telescrivente'],
  ['lavagna', 'Доска', 'мел с прорехами', '04-lavagna'],
  ['incisione', 'Гравюра', 'высокая печать', '05-incisione'],
];

/* Конец блока со счётом вложенности: у @media внутри свои правила,
   а наивный поиск ближайшей «}» разрубил бы медиазапрос пополам. */
function blockEnd(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return css.length;
}

function scope(css, dir) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const close = blockEnd(css, open);
    const selector = css.slice(i, open).trim();
    const body = css.slice(open + 1, close);
    i = close + 1;
    if (!selector) continue;
    if (/^@(media|supports)/.test(selector)) {
      out.push(`${selector}{${scope(body, dir)}}`);
      continue;
    }
    if (selector.startsWith('@')) {
      out.push(`${selector}{${body}}`);
      continue;
    }
    const scoped = selector
      .split(',')
      .map((s) => s.trim())
      .map((s) => {
        // html в макете задаёт высоту окна — в витрине окно одно на пятерых,
        // и эту роль играет оболочка, а не направление.
        if (s === 'html') return null;
        if (s === ':root' || s === 'html,body' || s === 'body') return `.direzione[data-dir="${dir}"]`;
        if (s === '*') return `.direzione[data-dir="${dir}"] *`;
        if (s.startsWith('canvas[data-materia]')) return null;
        return `.direzione[data-dir="${dir}"] ${s}`;
      })
      .filter(Boolean);
    if (scoped.length) out.push(`${scoped.join(',')}{${body}}`);
  }
  return out.join('\n');
}

const parts = DIRS.map(([dir, name, note, file]) => {
  const html = readFileSync(`design/mockups/${file}.html`, 'utf8');
  // Комментарии со скобками сбили бы разбор, да и в собранной странице
  // они не нужны: авторский текст остаётся в исходных макетах.
  const css = /<style>([\s\S]*?)<\/style>/.exec(html)[1].replace(/\/\*[\s\S]*?\*\//g, '');
  const body = /<body>([\s\S]*?)<script/.exec(html)[1];
  const canvas = /<canvas([^>]*)><\/canvas>/.exec(body)[1];
  const palette = Object.fromEntries(
    [...canvas.matchAll(/data-(carta|ombra|luce|rilievo|fibra|calore)="([^"]+)"/g)].map((m) => [m[1], m[2]]),
  );
  return { dir, name, note, palette, css: scope(css, dir), markup: body.replace(/<canvas[^>]*><\/canvas>/, '') };
});

const chips = parts
  .map(
    ({ dir, name, note }, index) =>
      `      <button type="button" class="scelta" data-scelta="${dir}" aria-pressed="${index === 0}">
        <b>${name}</b><i>${note}</i>
      </button>`,
  )
  .join('\n');

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Пять почерков</title>
<style>
/* Начертания объявлены прямо здесь: отдельный файл стилей блокирует
   отрисовку на лишний оборот сети, а весит объявление пять килобайт.
   Сами файлы шрифтов тянутся отдельно и кэшируются — и только те, что
   нужны видимому направлению. */
${readFileSync('design/fonts/caratteri.css', 'utf8').replace(/\.\.\/fonts\//g, 'fonts/')}

/* ═══════════════════════════════════════════════════════════════
   ВИТРИНА
   Оболочка намеренно молчит: пять материалов внутри — это и есть
   содержание, а панель выбора не должна с ними спорить. Поэтому
   графит, узкий гротеск и никакого своего цвета: активный выбор
   отмечен бумагой, а не акцентом.
   ═══════════════════════════════════════════════════════════════ */

:root{
  --графит:#191715;
  --графит-стекло:rgba(23,21,19,.86);
  --волос:rgba(246,240,228,.20);
  --светлый:#f4efe4;
  --приглушённый:#a7a091;
  --низ:calc(84px + env(safe-area-inset-bottom));
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  background:#f7f3e8;
  font-family:'Literata',Georgia,serif;
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
}
canvas[data-materia]{position:fixed;inset:0;z-index:-2;display:block}

.direzione[hidden]{display:none}

/* ── панель выбора ─────────────────────────────────────────── */
.pannello{
  position:fixed;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);
  z-index:50;display:flex;flex-direction:column;align-items:center;gap:7px;
  width:max-content;max-width:calc(100vw - 16px);
}
.scelte{
  display:flex;gap:4px;padding:5px;
  background:var(--графит-стекло);
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  border:1px solid var(--волос);border-radius:999px;
  box-shadow:0 14px 34px -14px rgba(0,0,0,.6);
  overflow-x:auto;scrollbar-width:none;max-width:100%;
}
.scelte::-webkit-scrollbar{display:none}
.scelta{
  display:grid;gap:1px;justify-items:center;
  border:0;background:none;cursor:pointer;
  padding:7px 15px 8px;border-radius:999px;color:var(--приглушённый);
  font-family:'Oswald',"Helvetica Neue",sans-serif;white-space:nowrap;
  transition:background .16s,color .16s;
}
.scelta b{font-weight:500;font-size:13.5px;letter-spacing:.10em;text-transform:uppercase}
.scelta i{font-style:normal;font-size:10.5px;letter-spacing:.04em;opacity:.72}
.scelta:hover{color:var(--светлый);background:rgba(246,240,228,.07)}
.scelta[aria-pressed="true"]{background:var(--светлый);color:#1b1917}
.scelta[aria-pressed="true"] i{opacity:.62}
.scelta:focus-visible{outline:2px solid var(--светлый);outline-offset:2px}

.consiglio{
  margin:0;font-size:11.5px;letter-spacing:.05em;color:var(--светлый);
  background:var(--графит-стекло);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  border:1px solid var(--волос);border-radius:999px;padding:4px 13px;
  text-align:center;
}
.consiglio::after{content:"Наведите и нажмите — свет идёт за курсором, палец вдавливает лист"}
@media (hover:none){
  .consiglio::after{content:"Коснитесь листа — под пальцем продавится ямка"}
  /* Палец не мельче 44 px, иначе в поезде не попасть. */
  .scelta{padding:11px 15px}
  .scelta i{display:none}
  .consiglio{display:none}
}
@media (max-width:560px){
  .scelta i{display:none}
  .scelta b{font-size:12.5px;letter-spacing:.08em}
}
@media (prefers-reduced-motion:reduce){
  .scelta{transition:none}
}

/* ── ${parts[0].dir} ─────────────────────────── */
${parts[0].css}

/* Панель стоит внизу — освобождаем под неё место в каждом направлении. */
.direzione[data-dir] main{padding-bottom:var(--низ)}
</style>

<canvas data-materia data-carta="f7f3e8" data-ombra="9a917f" data-luce="fff7e6" data-rilievo="11" data-fibra="0.055" data-calore="0.05"></canvas>

${parts
  .map((p, i) =>
    i === 0
      ? `<div class="direzione" data-dir="${p.dir}">${p.markup}</div>`
      : /* Невидимые направления лежат в template — вместе со своими стилями.
           Разметки и таблиц стилей тут на пятерых, и если держать их в
           документе, браузер разбирает и раскладывает четыре страницы,
           которых никто не видит. Содержимое template инертно: ни стили, ни
           разметка не считаются, пока направление не выбрали. */
        `<template data-dir="${p.dir}"><style>${p.css}</style>${p.markup}</template>`,
  )
  .join('\n')}

<div class="pannello" data-fisso>
  <div class="scelte" role="group" aria-label="Направление">
${chips}
  </div>
  <p class="consiglio"></p>
</div>

<script src="materia.js"></script>
<script>
/* Переключение направления: меняются и разметка, и сорт материала —
   лампа остаётся той же, меняется бумага под ней. */
(function () {
  'use strict';
  var STOCKS = ${JSON.stringify(Object.fromEntries(parts.map((p) => [p.dir, p.palette])), null, 2)};
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-scelta]'));

  function apri(dir) {
    var gia = document.querySelector('.direzione[data-dir="' + dir + '"]');
    if (gia) return gia;
    var tpl = document.querySelector('template[data-dir="' + dir + '"]');
    if (!tpl) return null;
    var blocco = document.createElement('div');
    blocco.className = 'direzione';
    blocco.dataset.dir = dir;
    blocco.appendChild(tpl.content.cloneNode(true));
    // Лист лежит внутри .foglio — туда же кладём и развёрнутое направление.
    (document.querySelector('.foglio') || document.body).appendChild(blocco);
    return blocco;
  }

  function choose(dir) {
    apri(dir);
    document.querySelectorAll('.direzione').forEach(function (block) {
      block.hidden = block.dataset.dir !== dir;
    });
    buttons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.scelta === dir));
    });
    var stock = STOCKS[dir];
    document.body.style.background = '#' + stock.carta;
    if (window.materia) {
      window.materia.setStock(stock);
      window.materia.rileggi();
    }
    window.scrollTo({ top: 0 });
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', function () { choose(button.dataset.scelta); });
  });
})();
</script>
`;

writeFileSync('design/mostra.html', html);
console.log('mostra.html KB:', Math.round(html.length / 1024));
