/**
 * A deliberately tiny inline markup for lecture prose.
 *
 * Course text is authored in TypeScript files, and full Markdown would be both
 * a dependency and an invitation to structure content in strings rather than in
 * blocks. Five constructs cover everything the lectures actually need:
 *
 *   **важно**                      emphasis
 *   *мягко*                        secondary emphasis
 *   `код`                          literal
 *   [[термин|пояснение]]           glossary term with a hover explanation
 *   [текст](https://…)             link
 *
 * Anything that does not parse is left as literal text, so `2 * 3` stays maths
 * instead of quietly becoming italics.
 */

import { Fragment, type ReactElement } from 'react';

export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'term'; text: string; title: string }
  | { kind: 'link'; text: string; href: string };

/**
 * Ordered by precedence: code first, so markup inside a literal stays literal;
 * the glossary term before the link, since both start with `[`.
 */
const RULES: { pattern: RegExp; build(match: RegExpExecArray): InlineToken }[] = [
  { pattern: /`([^`]+)`/, build: (m) => ({ kind: 'code', text: m[1] }) },
  { pattern: /\[\[([^\]|]+)\|([^\]]+)\]\]/, build: (m) => ({ kind: 'term', text: m[1], title: m[2] }) },
  { pattern: /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/, build: (m) => ({ kind: 'link', text: m[1], href: m[2] }) },
  { pattern: /\*\*([^*]+)\*\*/, build: (m) => ({ kind: 'bold', text: m[1] }) },
  { pattern: /(?<!\*)\*([^*\s][^*]*)\*(?!\*)/, build: (m) => ({ kind: 'italic', text: m[1] }) },
];

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let rest = text;

  while (rest.length > 0) {
    let earliest: { index: number; length: number; token: InlineToken } | null = null;

    for (const rule of RULES) {
      const match = rule.pattern.exec(rest);
      if (!match) continue;
      if (earliest === null || match.index < earliest.index) {
        earliest = { index: match.index, length: match[0].length, token: rule.build(match) };
      }
    }

    if (!earliest) {
      push(tokens, { kind: 'text', text: rest });
      break;
    }

    if (earliest.index > 0) push(tokens, { kind: 'text', text: rest.slice(0, earliest.index) });
    tokens.push(earliest.token);
    rest = rest.slice(earliest.index + earliest.length);
  }

  return tokens;
}

/** Merge adjacent plain-text runs so the token list stays readable in tests. */
function push(tokens: InlineToken[], token: InlineToken): void {
  const last = tokens[tokens.length - 1];
  if (token.kind === 'text' && last?.kind === 'text') {
    last.text += token.text;
    return;
  }
  if (token.kind === 'text' && token.text === '') return;
  tokens.push(token);
}

export function Inline({ text }: { text: string }): ReactElement {
  return (
    <>
      {parseInline(text).map((token, index) => (
        <Fragment key={index}>{renderToken(token)}</Fragment>
      ))}
    </>
  );
}

function renderToken(token: InlineToken) {
  switch (token.kind) {
    case 'bold':
      return <strong>{token.text}</strong>;
    case 'italic':
      return <em>{token.text}</em>;
    case 'code':
      return <code>{token.text}</code>;
    case 'term':
      return (
        <span className="term" title={token.title} tabIndex={0}>
          {token.text}
        </span>
      );
    case 'link':
      return (
        <a href={token.href} target="_blank" rel="noopener noreferrer">
          {token.text}
        </a>
      );
    default:
      return token.text;
  }
}
