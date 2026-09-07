import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Inline, parseInline } from './inline';

describe('parseInline', () => {
  it('returns a single text token for plain prose', () => {
    expect(parseInline('обычный текст')).toEqual([{ kind: 'text', text: 'обычный текст' }]);
  });

  it('recognises bold, italic and code', () => {
    expect(parseInline('**жирный**')).toEqual([{ kind: 'bold', text: 'жирный' }]);
    expect(parseInline('*курсив*')).toEqual([{ kind: 'italic', text: 'курсив' }]);
    expect(parseInline('`код`')).toEqual([{ kind: 'code', text: 'код' }]);
  });

  it('keeps surrounding text around markup', () => {
    expect(parseInline('до **того** как')).toEqual([
      { kind: 'text', text: 'до ' },
      { kind: 'bold', text: 'того' },
      { kind: 'text', text: ' как' },
    ]);
  });

  it('parses a glossary term with its explanation', () => {
    expect(parseInline('[[гомеостаз|удержание переменной в норме]]')).toEqual([
      { kind: 'term', text: 'гомеостаз', title: 'удержание переменной в норме' },
    ]);
  });

  it('parses a link', () => {
    expect(parseInline('[Эшби](https://example.org)')).toEqual([
      { kind: 'link', text: 'Эшби', href: 'https://example.org' },
    ]);
  });

  it('leaves unmatched markers alone rather than eating the text', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([{ kind: 'text', text: '2 * 3 = 6' }]);
    expect(parseInline('незакрытый **жирный')).toEqual([{ kind: 'text', text: 'незакрытый **жирный' }]);
  });

  it('does not treat markup inside code as markup', () => {
    expect(parseInline('`a ** b`')).toEqual([{ kind: 'code', text: 'a ** b' }]);
  });

  it('handles several tokens in one line', () => {
    const tokens = parseInline('**H** — это `энтропия` по [[Шеннону|1948 год]]');
    expect(tokens.map((t) => t.kind)).toEqual(['bold', 'text', 'code', 'text', 'term']);
  });
});

describe('<Inline>', () => {
  it('renders the semantic elements for each token', () => {
    const { container } = render(<Inline text="**важно**, *мягко*, `код`" />);
    expect(container.querySelector('strong')).toHaveTextContent('важно');
    expect(container.querySelector('em')).toHaveTextContent('мягко');
    expect(container.querySelector('code')).toHaveTextContent('код');
  });

  it('exposes a glossary term with its explanation as a tooltip', () => {
    render(<Inline text="[[вариетность|число различимых состояний]]" />);
    const term = screen.getByText('вариетность');
    expect(term).toHaveAttribute('title', 'число различимых состояний');
  });

  it('renders external links safely', () => {
    render(<Inline text="[источник](https://example.org)" />);
    const link = screen.getByRole('link', { name: 'источник' });
    expect(link).toHaveAttribute('href', 'https://example.org');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
