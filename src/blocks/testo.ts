/**
 * БЛОКИ ТЕКСТА — из чего набирается лекция.
 *
 * Все они статические: разметка и ничего больше. Набор, выделение, поиск по
 * странице, печать и чтение с экрана работают сами, потому что это обычный
 * HTML в светлом DOM, а не элемент с теневым корнем. Скрипта они не стоят.
 *
 * Разметка строится из дерева, а не склейкой строк: `inlineHtml` разбирает
 * авторский текст и экранирует листья. Единственное исключение — `figure`,
 * куда автор кладёт готовый SVG; оно так и названо и так и прокомментировано.
 */

import * as s from '~/core/schema';
import { blocks, defineBlock, renderBlocks, type RenderContext } from '~/content/registry';
import { escapeHtml, inlineHtml, levelHref } from '~/content/inline';
import { parseRef } from '~/content/model';

const строка = (max = 2000) => s.text({ max });
const внутри = (context: RenderContext) => ({ base: context.base, course: context.course });

export const prose = defineBlock({
  kind: 'prose',
  label: 'Абзац',
  note: 'Основной набор. Внутри — термины, ссылки на витки, формулы и код.',
  schema: s.record({ kind: s.literal('prose'), text: строка(4000) }),
  html: (b, c) => `<p>${inlineHtml(b.text, внутри(c))}</p>`,
});

export const heading = defineBlock({
  kind: 'heading',
  label: 'Подзаголовок',
  note: 'Второй и третий уровень. Первый занят названием витка.',
  schema: s.record({
    kind: s.literal('heading'),
    text: строка(200),
    level: s.optional(s.oneOf([2, 3] as const)),
  }),
  html: (b, c) => {
    const tag = b.level === 3 ? 'h3' : 'h2';
    const id = slug(b.text);
    return `<${tag} id="${escapeHtml(id)}">${inlineHtml(b.text, внутри(c))}</${tag}>`;
  },
});

export const note = defineBlock({
  kind: 'note',
  label: 'Пометка на полях',
  note: 'То, что дописано карандашом сбоку: замечание, оговорка, отсылка.',
  schema: s.record({ kind: s.literal('note'), text: строка(1200) }),
  html: (b, c) => `<aside class="nota">${inlineHtml(b.text, внутри(c))}</aside>`,
});

export const define = defineBlock({
  kind: 'define',
  label: 'Определение',
  note: 'Термин вводится один раз и выносится, чтобы к нему можно было вернуться.',
  schema: s.record({
    kind: s.literal('define'),
    term: строка(120),
    text: строка(1600),
  }),
  html: (b, c) =>
    `<dl class="definizione" id="${escapeHtml(slug(b.term))}">` +
    `<dt><b class="termine">${escapeHtml(b.term)}</b></dt>` +
    `<dd>${inlineHtml(b.text, внутри(c))}</dd></dl>`,
});

export const list = defineBlock({
  kind: 'list',
  label: 'Перечень',
  schema: s.record({
    kind: s.literal('list'),
    items: s.list(строка(1200), { min: 1 }),
    ordered: s.optional(s.flag()),
  }),
  html: (b, c) => {
    const tag = b.ordered ? 'ol' : 'ul';
    const items = b.items.map((it) => `<li>${inlineHtml(it, внутри(c))}</li>`).join('');
    return `<${tag} class="elenco">${items}</${tag}>`;
  },
});

export const quote = defineBlock({
  kind: 'quote',
  label: 'Цитата',
  note: 'С источником обязательно: кибернетика — дисциплина с датами и именами.',
  schema: s.record({
    kind: s.literal('quote'),
    text: строка(1600),
    source: строка(200),
  }),
  html: (b, c) =>
    `<figure class="citazione"><blockquote>${inlineHtml(b.text, внутри(c))}</blockquote>` +
    `<figcaption>${inlineHtml(b.source, внутри(c))}</figcaption></figure>`,
});

export const formula = defineBlock({
  kind: 'formula',
  label: 'Формула',
  note: 'Выключенная строка. Подпись объясняет буквы — формула без легенды бесполезна.',
  schema: s.record({
    kind: s.literal('formula'),
    math: строка(400),
    legend: s.optional(строка(600)),
  }),
  html: (b, c) =>
    `<figure class="formula-blocco"><div class="formula" translate="no">${escapeHtml(b.math)}</div>` +
    (b.legend ? `<figcaption>${inlineHtml(b.legend, внутри(c))}</figcaption>` : '') +
    `</figure>`,
});

export const code = defineBlock({
  kind: 'code',
  label: 'Код',
  schema: s.record({
    kind: s.literal('code'),
    code: строка(4000),
    caption: s.optional(строка(300)),
  }),
  html: (b, c) =>
    `<figure class="codice"><pre><code>${escapeHtml(b.code)}</code></pre>` +
    (b.caption ? `<figcaption>${inlineHtml(b.caption, внутри(c))}</figcaption>` : '') +
    `</figure>`,
});

export const table = defineBlock({
  kind: 'table',
  label: 'Таблица',
  schema: s
    .record({
      kind: s.literal('table'),
      /* Угловая ячейка часто пуста: в таблице с подписями строк ей нечего
         сказать. Это единственное место, где пустая строка осмысленна. */
      head: s.list(s.text({ max: 200, allowEmpty: true }), { min: 1 }),
      rows: s.list(s.list(строка(400)), { min: 1 }),
      caption: s.optional(строка(300)),
    })
    .where(
      (t) => t.rows.every((r) => r.length === t.head.length),
      'в каждой строке столько же ячеек, сколько в шапке',
    ),
  html: (b, c) => {
    const th = b.head.map((h) => `<th scope="col">${inlineHtml(h, внутри(c))}</th>`).join('');
    const tr = b.rows
      .map((row) => `<tr>${row.map((cell) => `<td>${inlineHtml(cell, внутри(c))}</td>`).join('')}</tr>`)
      .join('');
    return (
      `<figure class="tabella"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>` +
      (b.caption ? `<figcaption>${inlineHtml(b.caption, внутри(c))}</figcaption>` : '') +
      `</figure>`
    );
  },
});

export const callout = defineBlock({
  kind: 'callout',
  label: 'Врезка',
  note: 'Отступление, историческая справка, разбор ошибки. Внутри — любые блоки.',
  schema: s.record({
    kind: s.literal('callout'),
    title: s.optional(строка(200)),
    tone: s.optional(s.oneOf(['storia', 'attenzione', 'prova'] as const)),
    body: s.list(blocks(), { min: 1 }),
  }),
  html: (b, c) =>
    `<section class="strumento incastro" data-tono="${escapeHtml(b.tone ?? 'storia')}">` +
    (b.title ? `<p class="titolo-strumento">${inlineHtml(b.title, внутри(c))}</p>` : '') +
    renderBlocks(b.body, c) +
    `</section>`,
});

export const figure = defineBlock({
  kind: 'figure',
  label: 'Схема',
  note: 'Готовый SVG из файла курса. Единственное место, где разметка приходит от автора как есть.',
  schema: s
    .record({
      kind: s.literal('figure'),
      /* Содержимое пишет автор курса в исходниках репозитория — это не ввод
         пользователя. Но и здесь стоит проверка: скрипта и обработчиков в
         схеме быть не должно, иначе однажды такой SVG приедет из внешнего
         источника, и мы об этом не вспомним. */
      svg: строка(60_000),
      caption: s.optional(строка(400)),
      alt: строка(300),
    })
    .where(
      (f) => !/<script|\son\w+\s*=|javascript:/i.test(f.svg),
      'в схеме не должно быть скриптов и обработчиков событий',
    ),
  html: (b, c) =>
    `<figure class="disegno" role="img" aria-label="${escapeHtml(b.alt)}">${b.svg}` +
    (b.caption ? `<figcaption>${inlineHtml(b.caption, внутри(c))}</figcaption>` : '') +
    `</figure>`,
});

export const crossref = defineBlock({
  kind: 'crossref',
  label: 'Отсылка к витку',
  note: 'Выносная ссылка на другой виток — вперёд, назад или в соседний курс.',
  schema: s.record({
    kind: s.literal('crossref'),
    ref: строка(80),
    text: строка(300),
  }),
  html: (b, c) => {
    const ref = parseRef(b.ref);
    if (!ref) return `<div class="guasto" role="note">Битая отсылка: ${escapeHtml(b.ref)}</div>`;
    const href = levelHref(ref, внутри(c));
    return (
      `<p class="rinvio-blocco"><a href="${escapeHtml(href)}" class="rinvio">` +
      `${inlineHtml(b.text, внутри(c))}</a></p>`
    );
  },
});

/** Якорь для заголовка: кириллица переводится, чтобы ссылка была читаемой. */
const ТРАНСЛИТ: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'j',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[а-яё]/g, (c) => ТРАНСЛИТ[c] ?? '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
