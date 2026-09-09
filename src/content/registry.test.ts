import { beforeEach, describe, expect, it } from 'vitest';
import * as s from '~/core/schema';
import { blockKinds, blocks, defineBlock, lookupBlock, resetRegistry } from './registry';

/* Реестр — единственная точка расширения платформы. Новый интерактив обязан
   стоить ровно трёх вещей: схема, элемент, одна регистрация. Ни движок, ни
   маршрутизатор, ни отображение лекции не должны об этом узнать. Тесты ниже
   и сторожат это обещание. */

beforeEach(resetRegistry);

const проза = () =>
  defineBlock({
    kind: 'prose',
    tag: 'cy-prose',
    label: 'Текст',
    schema: s.record({ kind: s.literal('prose'), text: s.text() }),
  });

describe('регистрация', () => {
  it('отдаёт готовую фабрику: вид подставляется сам', () => {
    const prose = проза();
    expect(prose({ text: 'Обратная связь' })).toEqual({ kind: 'prose', text: 'Обратная связь' });
  });

  it('знает, чем блок рисуется', () => {
    проза();
    expect(lookupBlock('prose')?.tag).toBe('cy-prose');
    expect(lookupBlock('prose')?.label).toBe('Текст');
    expect(lookupBlock('нет такого')).toBeUndefined();
  });

  it('не даёт занять один вид дважды: молчаливая подмена блока хуже падения', () => {
    проза();
    expect(() => проза()).toThrowError(/prose/);
  });

  it('перечисляет виды в порядке регистрации — по этому списку строится галерея', () => {
    проза();
    defineBlock({
      kind: 'figure',
      tag: 'cy-figure',
      label: 'Рисунок',
      schema: s.record({ kind: s.literal('figure'), src: s.text(), alt: s.text() }),
    });
    expect(blockKinds()).toEqual(['prose', 'figure']);
  });
});

describe('схема блоков', () => {
  it('строится из реестра, а не из списка в коде движка', () => {
    const схема = blocks();
    // Пока ничего не зарегистрировано, любой блок — неизвестный вид.
    expect(схема.check({ kind: 'prose', text: 'раз' }).ok).toBe(false);
    проза();
    expect(схема.check({ kind: 'prose', text: 'раз' }).ok).toBe(true);
  });

  it('жалуется по существу той ветви, которую выбрал автор', () => {
    проза();
    const плохо = blocks().check({ kind: 'prose' }, 'lecture[3]');
    expect(!плохо.ok && плохо.issues).toEqual([
      { path: 'lecture[3].text', message: 'ожидалась строка, пришло ничего' },
    ]);
  });

  it('на незнакомом виде называет известные — обычно это опечатка', () => {
    проза();
    const плохо = blocks().check({ kind: 'proze' }, 'b');
    expect(!плохо.ok && плохо.issues[0]?.message).toBe('неизвестный вид "proze"; известны prose');
  });
});

describe('вложенность', () => {
  it('блок может содержать блоки, в том числе себя', () => {
    проза();
    const aside = defineBlock({
      kind: 'aside',
      tag: 'cy-aside',
      label: 'Врезка',
      schema: s.record({ kind: s.literal('aside'), body: s.list(blocks(), { min: 1 }) }),
    });
    const значение = aside({ body: [aside({ body: [{ kind: 'prose', text: 'вглубь' }] })] });
    expect(blocks().check(значение).ok).toBe(true);

    const плохо = blocks().check(
      { kind: 'aside', body: [{ kind: 'aside', body: [{ kind: 'prose', text: '' }] }] },
      'l[0]',
    );
    expect(!плохо.ok && плохо.issues[0]?.path).toBe('l[0].body[0].body[0].text');
  });
});
