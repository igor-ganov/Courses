import { describe, expect, it } from 'vitest';
import './index';
import { blockDefinitions, blockKinds, blocks } from '~/content/registry';

/* Сторож обещания: каждый зарегистрированный блок объявляет ровно один способ
   отрисовки, у интерактивного есть отложенная загрузка, а у каждого — имя для
   галереи. Если это разъедется, разъедется молча. */

describe('библиотека блоков', () => {
  it('собрана и не пуста', () => {
    expect(blockKinds().length).toBeGreaterThan(15);
  });

  it('у каждого блока ровно один способ отрисовки и человеческое имя', () => {
    for (const d of blockDefinitions()) {
      const статический = typeof d.html === 'function';
      const интерактивный = typeof d.tag === 'string';
      expect(статический !== интерактивный, d.kind).toBe(true);
      if (интерактивный) expect(typeof d.load, d.kind).toBe('function');
      expect(d.label.trim().length, d.kind).toBeGreaterThan(0);
    }
  });

  it('имена элементов не повторяются между разными приборами одного модуля', () => {
    const теги = blockDefinitions().filter((d) => d.tag).map((d) => d.tag!);
    expect(new Set(теги).size).toBe(теги.length);
  });

  it('схема любого блока строится и отвергает выдумку', () => {
    expect(blocks().check({ kind: 'prose', text: 'раз' }).ok).toBe(true);
    expect(blocks().check({ kind: 'loop' }).ok).toBe(true);
    expect(blocks().check({ kind: 'выдумка' }).ok).toBe(false);
  });

  it('задание принимает вопрос движка оценки и отвергает неизвестный вид вопроса', () => {
    expect(
      blocks().check({
        kind: 'question',
        question: { kind: 'choice', id: 'q', prompt: 'п', difficulty: 1, options: ['а', 'б'], answer: 0 },
      }).ok,
    ).toBe(true);
    const плохо = blocks().check({ kind: 'question', question: { kind: 'выдумка' } }, 'l[0]');
    expect(!плохо.ok && плохо.issues[0]?.path).toBe('l[0].question.kind');
  });
});
