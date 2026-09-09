import { beforeEach, describe, expect, it } from 'vitest';
import * as s from '~/core/schema';
import { defineBlock, resetRegistry } from './registry';
import { defineCourse, type Course } from './model';
import { curriculum, validateCurriculum } from './graph';

/* Граф — единственное место, где курс проверяется целиком. Схема ловит форму
   одного файла; связность — что тема модуля существует, что ссылка ведёт в
   существующий виток, что зависимости не зациклены — видна только сверху.
   Всё, что здесь падает, должно падать на сборке, а не у читателя. */

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
  objectives: [`цель ${depth}`],
  lecture: [{ kind: 'prose', text: 'Текст витка.' }],
  ...extra,
});

const тема = (id: string, levels: unknown[], extra: Record<string, unknown> = {}) => ({
  id,
  title: id,
  summary: 'коротко',
  levels,
  ...extra,
});

function курс(over: Partial<Record<string, unknown>> = {}): Course {
  return defineCourse({
    id: 'cyb',
    title: 'Кибернетика',
    description: 'Курс.',
    modules: [{ id: 'm1', title: 'М1', description: 'о', topicIds: ['feedback', 'control'] }],
    topics: [
      тема('feedback', [виток(1), виток(2, { inherits: ['feedback:1'] })]),
      тема('control', [виток(1)], { requires: ['feedback'] }),
    ],
    ...over,
  });
}

describe('связность', () => {
  it('целый курс проходит без замечаний', () => {
    expect(validateCurriculum([курс()])).toEqual([]);
  });

  it('ловит тему модуля, которой нет', () => {
    const беды = validateCurriculum([
      курс({
        modules: [
          { id: 'm1', title: 'М1', description: 'о', topicIds: ['feedback', 'control', 'nosuch'] },
        ],
      }),
    ]);
    expect(беды).toEqual([
      { path: 'cyb.modules[0].topicIds[2]', message: 'темы "nosuch" в курсе нет' },
    ]);
  });

  it('ловит тему, не попавшую ни в один модуль: иначе она недостижима', () => {
    const беды = validateCurriculum([
      курс({ modules: [{ id: 'm1', title: 'М1', description: 'о', topicIds: ['feedback'] }] }),
    ]);
    expect(беды[0]?.message).toMatch(/"control".*ни в один модуль/);
  });

  it('ловит тему в двух модулях: порядок чтения перестаёт быть порядком', () => {
    const беды = validateCurriculum([
      курс({
        modules: [
          { id: 'm1', title: 'М1', description: 'о', topicIds: ['feedback', 'control'] },
          { id: 'm2', title: 'М2', description: 'о', topicIds: ['control'] },
        ],
      }),
    ]);
    expect(беды[0]?.message).toMatch(/"control".*дважды/);
  });

  it('ловит несуществующую зависимость и кольцо зависимостей', () => {
    expect(
      validateCurriculum([
        курс({
          topics: [
            тема('feedback', [виток(1)], { requires: ['nosuch'] }),
            тема('control', [виток(1)]),
          ],
        }),
      ])[0]?.message,
    ).toMatch(/"nosuch"/);

    const кольцо = validateCurriculum([
      курс({
        topics: [
          тема('feedback', [виток(1)], { requires: ['control'] }),
          тема('control', [виток(1)], { requires: ['feedback'] }),
        ],
      }),
    ]);
    expect(кольцо[0]?.message).toMatch(/кольцо/);
  });

  it('ловит ссылку в несуществующий виток — и внутри курса, и в чужой', () => {
    const беды = validateCurriculum([
      курс({
        topics: [
          тема('feedback', [виток(1, { seeAlso: ['feedback:9', 'nosuch/control:1'] })]),
          тема('control', [виток(1)]),
        ],
      }),
    ]);
    expect(беды.map((b) => b.message)).toEqual([
      'ссылка "feedback:9" ведёт в никуда: у темы "feedback" нет витка 9',
      'ссылка "nosuch/control:1" ведёт в никуда: курса "nosuch" нет',
    ]);
  });

  it('видит витки соседнего курса, когда тот тоже в наборе', () => {
    const другой = defineCourse({
      id: 'info',
      title: 'Информация',
      description: 'Курс.',
      modules: [{ id: 'm', title: 'М', description: 'о', topicIds: ['entropy'] }],
      topics: [тема('entropy', [виток(1)])],
    });
    const с = курс({
      topics: [
        тема('feedback', [виток(1, { seeAlso: ['info/entropy:1'] })]),
        тема('control', [виток(1)]),
      ],
    });
    expect(validateCurriculum([с, другой])).toEqual([]);
  });
});

describe('порядки чтения', () => {
  it('порядок модулей — это порядок чтения: тема за темой, виток за витком', () => {
    const к = curriculum([курс()]);
    expect(к.readingOrder('cyb').map(String)).toEqual([
      'feedback:1',
      'feedback:2',
      'control:1',
    ]);
  });

  it('спираль идёт по глубине: все темы на первом витке, потом все на втором', () => {
    const к = curriculum([курс()]);
    expect(к.spiralOrder('cyb').map(String)).toEqual(['feedback:1', 'control:1', 'feedback:2']);
  });

  it('внутри витка порядок задают зависимости, а не порядок в файле', () => {
    const к = curriculum([
      курс({
        modules: [{ id: 'm1', title: 'М1', description: 'о', topicIds: ['control', 'feedback'] }],
        topics: [
          тема('control', [виток(1)], { requires: ['feedback'] }),
          тема('feedback', [виток(1)]),
        ],
      }),
    ]);
    expect(к.spiralOrder('cyb').map(String)).toEqual(['feedback:1', 'control:1']);
  });
});

describe('цели и ссылки', () => {
  it('виток наследует цели предыдущих — транзитивно и без повторов', () => {
    const к = curriculum([
      курс({
        topics: [
          тема('feedback', [
            виток(1),
            виток(2, { inherits: ['feedback:1'] }),
            виток(3, { inherits: ['feedback:2', 'feedback:1'] }),
          ]),
          тема('control', [виток(1)]),
        ],
      }),
    ]);
    expect(к.objectivesOf({ topic: 'feedback', depth: 3 }, 'cyb')).toEqual([
      'цель 1',
      'цель 2',
      'цель 3',
    ]);
  });

  it('обратные ссылки: виток знает, кто на него ссылается', () => {
    const к = curriculum([курс()]);
    expect(к.referencesTo({ topic: 'feedback', depth: 1 }, 'cyb').map(String)).toEqual([
      'feedback:2',
    ]);
  });
});

describe('разблокировка', () => {
  const к = () => curriculum([курс()]);

  it('первый виток первой темы открыт сразу', () => {
    expect(к().isUnlocked({ topic: 'feedback', depth: 1 }, 'cyb', new Set())).toBe(true);
  });

  it('следующий виток темы ждёт предыдущего', () => {
    const c = к();
    expect(c.isUnlocked({ topic: 'feedback', depth: 2 }, 'cyb', new Set())).toBe(false);
    expect(c.isUnlocked({ topic: 'feedback', depth: 2 }, 'cyb', new Set(['feedback:1']))).toBe(true);
  });

  it('тема с зависимостью ждёт первого витка той темы, а не всей её глубины', () => {
    const c = к();
    expect(c.isUnlocked({ topic: 'control', depth: 1 }, 'cyb', new Set())).toBe(false);
    expect(c.isUnlocked({ topic: 'control', depth: 1 }, 'cyb', new Set(['feedback:1']))).toBe(true);
  });

  it('перечисляет, чего именно не хватает, — это текст для читателя, а не для отладки', () => {
    expect(к().missingFor({ topic: 'control', depth: 1 }, 'cyb', new Set()).map(String)).toEqual([
      'feedback:1',
    ]);
  });
});
