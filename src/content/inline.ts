/**
 * СТРОЧНАЯ РАЗМЕТКА — то, что бывает внутри предложения.
 *
 * Термин, который вводится. Ссылка на другой виток. Формула. Код. Без этого
 * глубокий материал набрать нечем: останется ровный серый текст, в котором
 * ничего не найти и некуда сослаться.
 *
 * Разметка своя и намеренно куцая. Полный markdown притащил бы внутрь абзаца
 * заголовки, списки и картинки — то есть второй способ делать то, что уже
 * делают блоки, и вечный вопрос «а этот заголовок какого уровня». Здесь ровно
 * шесть видов, и все они помещаются в строку.
 *
 * HTML не склеивается из авторского текста. Разбор даёт дерево, отрисовка
 * обходит дерево и экранирует листья. Склейка строк здесь означала бы, что
 * любая лекция — это дыра для внедрения разметки, а лекции пишут люди, которые
 * про это не думают и думать не должны.
 */

import { parseRef, type LevelRef } from './model';

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'term'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'math'; text: string }
  | { kind: 'ref'; text: string; ref: LevelRef }
  | { kind: 'link'; text: string; href: string };

/* Порядок важен: код идёт первым, потому что внутри него разметка не
   разбирается — там она часть кода. */
const RULES: { kind: Inline['kind']; re: RegExp }[] = [
  { kind: 'code', re: /`([^`\n]+)`/y },
  { kind: 'term', re: /\*\*([^*\n]+)\*\*/y },
  { kind: 'em', re: /_([^_\n]+)_/y },
  { kind: 'math', re: /\$([^$\n]+)\$/y },
];

const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/y;

/** Наружу пускаем только то, что заведомо не исполняется. */
function safeHref(raw: string): string | undefined {
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('/') || raw.startsWith('#')) return raw;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(raw)) return raw;
  return undefined;
}

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let plain = '';
  let i = 0;

  const flush = () => {
    if (plain) out.push({ kind: 'text', text: plain });
    plain = '';
  };

  while (i < source.length) {
    let matched = false;

    for (const rule of RULES) {
      rule.re.lastIndex = i;
      const m = rule.re.exec(source);
      if (m) {
        flush();
        out.push({ kind: rule.kind, text: m[1]! } as Inline);
        i = rule.re.lastIndex;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    LINK.lastIndex = i;
    const link = LINK.exec(source);
    if (link) {
      const [whole, text, target] = link as unknown as [string, string, string];
      const ref = parseRef(target);
      const href = ref ? undefined : safeHref(target);
      if (ref) {
        flush();
        out.push({ kind: 'ref', text, ref });
        i = LINK.lastIndex;
        continue;
      }
      if (href) {
        flush();
        out.push({ kind: 'link', text, href });
        i = LINK.lastIndex;
        continue;
      }
      /* Адрес, который не адрес, остаётся видимым текстом. Молчаливо
         проглоченная битая ссылка хуже: автор её не найдёт. */
      plain += whole;
      i = LINK.lastIndex;
      continue;
    }

    plain += source[i];
    i += 1;
  }

  flush();
  return out;
}

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => ESCAPE[c]!);

export interface RenderOptions {
  /** Префикс сайта: на GitHub Pages это /Courses/. */
  readonly base?: string;
  /** Курс, внутри которого считаются короткие адреса витков. */
  readonly course?: string;
}

/** Адрес страницы витка. Один источник правды для ссылок и для маршрутов. */
export function levelHref(ref: LevelRef, options: RenderOptions = {}): string {
  const base = options.base ?? '/';
  const course = ref.course ?? options.course ?? '';
  return `${base}${course}/${ref.topic}/${ref.depth}/`.replace(/\/{2,}/g, '/');
}

export function renderInline(nodes: readonly Inline[], options: RenderOptions = {}): string {
  return nodes
    .map((node) => {
      const text = escapeHtml(node.text);
      switch (node.kind) {
        case 'text':
          return text;
        case 'term':
          return `<b class="termine">${text}</b>`;
        case 'em':
          return `<em>${text}</em>`;
        case 'code':
          return `<code>${text}</code>`;
        case 'math':
          return `<span class="formula" translate="no">${text}</span>`;
        case 'ref':
          return `<a href="${escapeHtml(levelHref(node.ref, options))}" class="rinvio">${text}</a>`;
        case 'link':
          return `<a href="${escapeHtml(node.href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      }
    })
    .join('');
}

/** Короткий путь для отрисовки: разобрать и сразу отдать разметку. */
export const inlineHtml = (source: string, options: RenderOptions = {}): string =>
  renderInline(parseInline(source), options);
