import { describe, expect, it } from 'vitest';
import { parseInline, renderInline } from './inline';

/* Внутри абзаца нужна разметка: термин, который вводится, ссылка на другой
   виток, формула, код. Без неё глубокий материал набрать нечем — останется
   ровный серый текст, в котором ничего не найти.

   Разметка своя и намеренно куцая. Полный markdown притащил бы заголовки,
   таблицы и картинки внутрь абзаца, то есть второй способ делать то, что уже
   делают блоки. Здесь только то, что бывает ВНУТРИ предложения.

   И главное: HTML не склеивается строками из авторского текста. Разбор даёт
   дерево, отрисовка обходит дерево и экранирует листья. Иначе любая лекция —
   это дыра для внедрения разметки. */

describe('разбор', () => {
  it('обычный текст остаётся текстом', () => {
    expect(parseInline('Обратная связь.')).toEqual([{ kind: 'text', text: 'Обратная связь.' }]);
  });

  it('термин вводится двумя звёздочками', () => {
    expect(parseInline('Это **обратная связь**, и вот.')).toEqual([
      { kind: 'text', text: 'Это ' },
      { kind: 'term', text: 'обратная связь' },
      { kind: 'text', text: ', и вот.' },
    ]);
  });

  it('выделение, код и формула', () => {
    expect(parseInline('вот _так_, вот `x=1`, вот $e^{i\\pi}$')).toEqual([
      { kind: 'text', text: 'вот ' },
      { kind: 'em', text: 'так' },
      { kind: 'text', text: ', вот ' },
      { kind: 'code', text: 'x=1' },
      { kind: 'text', text: ', вот ' },
      { kind: 'math', text: 'e^{i\\pi}' },
    ]);
  });

  it('ссылка на виток: адрес разбирается, а не остаётся строкой', () => {
    expect(parseInline('см. [ниже](feedback:2)')).toEqual([
      { kind: 'text', text: 'см. ' },
      { kind: 'ref', text: 'ниже', ref: { topic: 'feedback', depth: 2 } },
    ]);
  });

  it('ссылка наружу остаётся ссылкой наружу', () => {
    expect(parseInline('[Винер](https://example.org/wiener)')).toEqual([
      { kind: 'link', text: 'Винер', href: 'https://example.org/wiener' },
    ]);
  });

  it('не пропускает адрес, который не адрес: молчаливая битая ссылка хуже текста', () => {
    expect(parseInline('[что-то](javascript:alert(1))')).toEqual([
      { kind: 'text', text: '[что-то](javascript:alert(1))' },
    ]);
  });

  it('незакрытая разметка остаётся текстом, а не съедает остаток абзаца', () => {
    expect(parseInline('вот **начал и не закрыл')).toEqual([
      { kind: 'text', text: 'вот **начал и не закрыл' },
    ]);
  });

  it('внутри кода разметка не разбирается: там она часть кода', () => {
    expect(parseInline('`a **b** c`')).toEqual([{ kind: 'code', text: 'a **b** c' }]);
  });
});

describe('отрисовка', () => {
  it('строит разметку из дерева, а не склейкой строк', () => {
    expect(renderInline(parseInline('Это **связь** и `код`'))).toBe(
      'Это <b class="termine">связь</b> и <code>код</code>',
    );
  });

  it('экранирует всё, что пришло от автора', () => {
    expect(renderInline(parseInline('<script>alert(1)</script>'))).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
    expect(renderInline(parseInline('**<img onerror=x>**'))).toBe(
      '<b class="termine">&lt;img onerror=x&gt;</b>',
    );
  });

  it('экранирует и в атрибутах ссылки', () => {
    expect(renderInline(parseInline('[x](https://a/"onmouseover="y)'))).toContain('&quot;');
  });

  it('ссылка на виток получает адрес страницы, а не строку', () => {
    expect(renderInline(parseInline('[туда](feedback:2)'), { base: '/Courses/', course: 'cyb' })).toBe(
      '<a href="/Courses/cyb/feedback/2/" class="rinvio">туда</a>',
    );
  });

  it('внешняя ссылка уходит в новую вкладку и без утечки реферера', () => {
    const html = renderInline(parseInline('[В](https://example.org/)'));
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });
});
