import { describe, expect, it } from 'vitest';
import * as s from './schema';

/* Проверка содержания — не украшение, а условие того, чтобы курс можно было
   писать данными. Опечатка в файле лекции обязана превращаться в точный адрес
   и внятную фразу, а не в пустую страницу. Поэтому у схемы два требования:
   адрес указывает на конкретное место, и найдены должны быть все ошибки
   разом, а не первая. */

describe('примитивы', () => {
  it('пропускают своё и называют чужое', () => {
    expect(s.text().check('раз')).toEqual({ ok: true, value: 'раз' });
    expect(s.number().check(2)).toEqual({ ok: true, value: 2 });
    expect(s.flag().check(true)).toEqual({ ok: true, value: true });

    const плохо = s.text().check(7, 'title');
    expect(плохо.ok).toBe(false);
    expect(!плохо.ok && плохо.issues).toEqual([
      { path: 'title', message: 'ожидалась строка, пришло число' },
    ]);
  });

  it('не считают NaN числом, а null — объектом', () => {
    expect(s.number().check(Number.NaN).ok).toBe(false);
    expect(s.record({}).check(null).ok).toBe(false);
  });

  it('строка по умолчанию непустая: пустой заголовок — это ошибка автора', () => {
    expect(s.text().check('   ').ok).toBe(false);
    expect(s.text({ allowEmpty: true }).check('').ok).toBe(true);
  });

  it('держат границы длины и величины', () => {
    expect(s.text({ max: 3 }).check('слишком длинно').ok).toBe(false);
    expect(s.number({ min: 0, max: 1 }).check(1.5).ok).toBe(false);
    expect(s.number({ integer: true }).check(1.5).ok).toBe(false);
  });
});

describe('перечисление', () => {
  const сорт = s.oneOf(['intro', 'core', 'deep'] as const);

  it('возвращает узкий тип и перечисляет допустимое в ошибке', () => {
    expect(сорт.check('core')).toEqual({ ok: true, value: 'core' });
    const плохо = сорт.check('глубокий', 'level');
    expect(!плохо.ok && плохо.issues[0]?.message).toBe(
      'ожидалось одно из intro, core, deep; пришло "глубокий"',
    );
  });
});

describe('запись', () => {
  const автор = s.record({
    name: s.text(),
    year: s.optional(s.number({ integer: true })),
  });

  it('собирает все ошибки полей сразу, с адресами', () => {
    const плохо = автор.check({ year: 1.5 }, 'author');
    expect(плохо.ok).toBe(false);
    expect(!плохо.ok && плохо.issues.map((i) => i.path)).toEqual(['author.name', 'author.year']);
  });

  it('ловит лишние поля: опечатка в имени ключа иначе молча теряется', () => {
    const плохо = автор.check({ name: 'Винер', yaer: 1948 });
    expect(!плохо.ok && плохо.issues[0]?.message).toBe('неизвестное поле "yaer"');
  });

  it('необязательное поле можно не писать, но написанное проверяется', () => {
    expect(автор.check({ name: 'Эшби' }).ok).toBe(true);
    expect(автор.check({ name: 'Эшби', year: 'давно' }).ok).toBe(false);
  });
});

describe('список', () => {
  it('адресует элемент по номеру', () => {
    const плохо = s.list(s.text()).check(['раз', 2], 'tags');
    expect(!плохо.ok && плохо.issues[0]?.path).toBe('tags[1]');
  });

  it('умеет требовать непустоту', () => {
    expect(s.list(s.text(), { min: 1 }).check([]).ok).toBe(false);
  });
});

describe('союз', () => {
  /* Блоки лекции — размеченный союз: поле `kind` выбирает ветвь. Ошибка обязана
     приходить из выбранной ветви, иначе автор получает свалку из всех вариантов
     сразу и не понимает, какой из них он писал. */
  const блок = s.variant('kind', {
    prose: s.record({ kind: s.literal('prose'), text: s.text() }),
    figure: s.record({ kind: s.literal('figure'), src: s.text(), alt: s.text() }),
  });

  it('ведёт по метке и жалуется по существу выбранной ветви', () => {
    expect(блок.check({ kind: 'prose', text: 'раз' }).ok).toBe(true);
    const плохо = блок.check({ kind: 'figure', src: 'a.png' }, 'blocks[0]');
    expect(!плохо.ok && плохо.issues).toEqual([
      { path: 'blocks[0].alt', message: 'ожидалась строка, пришло ничего' },
    ]);
  });

  it('на незнакомой метке перечисляет известные', () => {
    const плохо = блок.check({ kind: 'proze' }, 'b');
    expect(!плохо.ok && плохо.issues[0]).toEqual({
      path: 'b.kind',
      message: 'неизвестный вид "proze"; известны prose, figure',
    });
  });
});

describe('дополнительное условие', () => {
  it('проверяет то, что типом не выразить', () => {
    const отрезок = s
      .record({ from: s.number(), to: s.number() })
      .where((v) => v.to > v.from, 'конец должен быть больше начала');
    expect(отрезок.check({ from: 0, to: 1 }).ok).toBe(true);
    const плохо = отрезок.check({ from: 1, to: 0 }, 'span');
    expect(!плохо.ok && плохо.issues[0]).toEqual({
      path: 'span',
      message: 'конец должен быть больше начала',
    });
  });
});

describe('отложенная схема', () => {
  it('позволяет блоку содержать блоки', () => {
    type Узел = { text: string; children?: Узел[] };
    const узел: s.Schema<Узел> = s.lazy(() =>
      s.record({ text: s.text(), children: s.optional(s.list(узел)) }),
    );
    expect(узел.check({ text: 'раз', children: [{ text: 'два' }] }).ok).toBe(true);
    const плохо = узел.check({ text: 'раз', children: [{ text: '' }] }, 'root');
    expect(!плохо.ok && плохо.issues[0]?.path).toBe('root.children[0].text');
  });
});

describe('разбор с исключением', () => {
  it('отдаёт значение или падает с перечислением всех бед', () => {
    expect(s.parse(s.text(), 'раз')).toBe('раз');
    expect(() => s.parse(s.record({ a: s.text() }), {}, 'курс')).toThrowError(
      /курс\.a: ожидалась строка, пришло ничего/,
    );
  });
});
