import { beforeEach, describe, expect, it } from 'vitest';
import * as s from '~/core/schema';
import { defineBlock, resetRegistry } from './registry';
import { courseSchema, defineCourse, levelKey, parseRef } from './model';

/* Курс — данные. Типы выведены из схем, а не написаны рядом с ними: два
   описания одного и того же неизбежно разъезжаются. Здесь проверяется, что
   форма курса держит спираль (тема встречается несколько раз, всё глубже) и
   что ссылки между витками — часть модели, а не украшение в тексте. */

beforeEach(() => {
  resetRegistry();
  defineBlock({
    kind: 'prose',
    label: 'Текст',
    schema: s.record({ kind: s.literal('prose'), text: s.text() }),
    html: (b) => `<p>${b.text}</p>`,
  });
});

const виток = (depth: number, extra: Record<string, unknown> = {}) => ({
  depth,
  title: `Виток ${depth}`,
  objectives: ['различать вход и выход контура'],
  lecture: [{ kind: 'prose', text: 'Достаточно длинный текст для витка.' }],
  ...extra,
});

const курс = (extra: Record<string, unknown> = {}) => ({
  id: 'cybernetics',
  title: 'Кибернетика',
  description: 'Вводный курс.',
  modules: [{ id: 'foundations', title: 'Основания', description: 'Начало.', topicIds: ['feedback'] }],
  topics: [{ id: 'feedback', title: 'Обратная связь', summary: 'Контур.', levels: [виток(1)] }],
  ...extra,
});

describe('форма курса', () => {
  it('принимает минимальный курс и выводит типы из схемы', () => {
    const c = defineCourse(курс());
    expect(c.topics[0]?.levels[0]?.depth).toBe(1);
    // Тип, а не только значение: поле существует и сужено.
    const заголовок: string = c.title;
    expect(заголовок).toBe('Кибернетика');
  });

  it('перечисляет все беды разом и с адресами', () => {
    const плохо = courseSchema().check(
      { id: 'c', title: '', description: 'ок', modules: [], topics: [] },
      'course',
    );
    expect(плохо.ok).toBe(false);
    const адреса = !плохо.ok ? плохо.issues.map((i) => i.path) : [];
    expect(адреса).toContain('course.title');
    expect(адреса).toContain('course.modules');
    expect(адреса).toContain('course.topics');
  });

  it('требует, чтобы у темы был хотя бы один виток, а у витка — хотя бы один блок', () => {
    expect(defineCourseFails(курс({ topics: [{ id: 'feedback', title: 'ОС', summary: 'к', levels: [] }] }))).toMatch(
      /levels/,
    );
    expect(
      defineCourseFails(
        курс({
          topics: [
            { id: 'feedback', title: 'ОС', summary: 'к', levels: [{ ...виток(1), lecture: [] }] },
          ],
        }),
      ),
    ).toMatch(/lecture/);
  });

  it('проверяет блоки лекции через реестр, а не через список в модели', () => {
    const сообщение = defineCourseFails(
      курс({
        topics: [
          {
            id: 'feedback',
            title: 'ОС',
            summary: 'к',
            levels: [{ ...виток(1), lecture: [{ kind: 'выдумка' }] }],
          },
        ],
      }),
    );
    expect(сообщение).toMatch(/неизвестный вид "выдумка"/);
    expect(сообщение).toMatch(/topics\[0\]\.levels\[0\]\.lecture\[0\]\.kind/);
  });
});

describe('спираль', () => {
  it('витки одной темы обязаны идти по возрастанию глубины и не повторяться', () => {
    expect(
      defineCourseFails(
        курс({
          topics: [{ id: 'feedback', title: 'ОС', summary: 'к', levels: [виток(1), виток(1)] }],
        }),
      ),
    ).toMatch(/глубин/);
    expect(
      defineCourseFails(
        курс({
          topics: [{ id: 'feedback', title: 'ОС', summary: 'к', levels: [виток(2), виток(1)] }],
        }),
      ),
    ).toMatch(/глубин/);
  });

  it('первый виток темы начинается с единицы: спираль не стартует с середины', () => {
    expect(
      defineCourseFails(
        курс({ topics: [{ id: 'feedback', title: 'ОС', summary: 'к', levels: [виток(2)] }] }),
      ),
    ).toMatch(/глубин/);
  });
});

describe('ссылки между витками', () => {
  it('разбирает короткую запись «тема:глубина» и полную «курс/тема:глубина»', () => {
    expect(parseRef('feedback:2')).toEqual({ topic: 'feedback', depth: 2 });
    expect(parseRef('control-101/feedback:2')).toEqual({
      course: 'control-101',
      topic: 'feedback',
      depth: 2,
    });
    expect(parseRef('feedback')).toBeUndefined();
    expect(parseRef('feedback:ноль')).toBeUndefined();
  });

  it('принимает наследование целей и перекрёстные ссылки, включая в другой курс', () => {
    const c = defineCourse(
      курс({
        topics: [
          {
            id: 'feedback',
            title: 'ОС',
            summary: 'к',
            levels: [виток(1), виток(2, { inherits: ['feedback:1'], seeAlso: ['other/control:1'] })],
          },
        ],
      }),
    );
    expect(c.topics[0]?.levels[1]?.inherits).toEqual(['feedback:1']);
  });

  it('отвергает ссылку, которую нельзя разобрать: адрес — часть модели', () => {
    expect(
      defineCourseFails(
        курс({
          topics: [
            {
              id: 'feedback',
              title: 'ОС',
              summary: 'к',
              levels: [виток(1, { inherits: ['просто текст'] })],
            },
          ],
        }),
      ),
    ).toMatch(/inherits\[0\]/);
  });

  it('ключ витка однозначен внутри курса', () => {
    expect(levelKey({ topic: 'feedback', depth: 2 })).toBe('feedback:2');
    expect(levelKey({ course: 'other', topic: 'feedback', depth: 2 })).toBe('other/feedback:2');
  });
});

function defineCourseFails(value: unknown): string {
  try {
    defineCourse(value);
  } catch (error) {
    return String((error as Error).message);
  }
  throw new Error('ожидалось падение разбора, а курс прошёл');
}
