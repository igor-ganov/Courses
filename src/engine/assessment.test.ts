import { beforeEach, describe, expect, it } from 'vitest';
import {
  defineQuestion,
  gradeAnswer,
  gradeAssessment,
  questionKinds,
  resetQuestions,
  questionsSchema,
  standardQuestions,
} from './assessment';
import * as s from '~/core/schema';

/* Оценка обязана быть чистой функцией: тот же вопрос и тот же ответ дают тот же
   результат всегда, без часов, случайности и состояния. Иначе её нельзя ни
   проверить, ни объяснить читателю, ни пересчитать позже.

   И она обязана быть частичной. «Неверно» на вопросе, где отмечено три пункта
   из четырёх, — это не оценка, а отписка: читатель не понимает, чего не знает. */

beforeEach(() => {
  resetQuestions();
  standardQuestions();
});

describe('выбор одного', () => {
  const q = {
    kind: 'choice' as const,
    id: 'q1',
    prompt: 'Что делает отрицательная обратная связь?',
    difficulty: 1,
    options: ['Усиливает отклонение', 'Гасит отклонение', 'Не влияет'],
    answer: 1,
    explain: 'Она вычитает выход из задания, поэтому отклонение уменьшается.',
  };

  it('верный ответ — единица, неверный — ноль, и всегда с объяснением', () => {
    expect(gradeAnswer(q, 1)).toEqual({
      correct: true,
      score: 1,
      explain: 'Она вычитает выход из задания, поэтому отклонение уменьшается.',
    });
    expect(gradeAnswer(q, 0).score).toBe(0);
  });

  it('не ломается на мусоре вместо ответа', () => {
    expect(gradeAnswer(q, undefined).score).toBe(0);
    expect(gradeAnswer(q, 99).score).toBe(0);
    expect(gradeAnswer(q, 'два').score).toBe(0);
  });
});

describe('выбор нескольких', () => {
  const q = {
    kind: 'multi' as const,
    id: 'q2',
    prompt: 'Что входит в контур регулирования?',
    difficulty: 2,
    options: ['Датчик', 'Регулятор', 'Исполнительный орган', 'Барометр на стене'],
    answer: [0, 1, 2],
  };

  it('даёт частичный балл: три из четырёх — это не «неверно»', () => {
    expect(gradeAnswer(q, [0, 1, 2]).score).toBe(1);
    expect(gradeAnswer(q, [0, 1]).score).toBeCloseTo(2 / 3, 6);
    expect(gradeAnswer(q, []).score).toBe(0);
  });

  it('лишняя отметка вычитает, но балл не уходит ниже нуля', () => {
    expect(gradeAnswer(q, [0, 1, 2, 3]).score).toBeCloseTo(2 / 3, 6);
    expect(gradeAnswer(q, [3]).score).toBe(0);
  });

  it('засчитывает полностью только полное совпадение', () => {
    expect(gradeAnswer(q, [0, 1, 2]).correct).toBe(true);
    expect(gradeAnswer(q, [0, 1, 2, 3]).correct).toBe(false);
  });
});

describe('число', () => {
  const q = {
    kind: 'numeric' as const,
    id: 'q3',
    prompt: 'Во сколько раз растянуть лист дороже, чем согнуть?',
    difficulty: 3,
    answer: 1e5,
    tolerance: 0.5,
    relative: true,
    unit: 'раз',
  };

  it('принимает ответ в пределах допуска, относительного или абсолютного', () => {
    expect(gradeAnswer(q, 1e5).correct).toBe(true);
    expect(gradeAnswer(q, 1.4e5).correct).toBe(true);
    expect(gradeAnswer(q, 3e5).correct).toBe(false);
    const абс = { ...q, tolerance: 0.5, relative: false, answer: 10 };
    expect(gradeAnswer(абс, 10.4).correct).toBe(true);
    expect(gradeAnswer(абс, 11).correct).toBe(false);
  });

  it('строку с запятой разбирает: читатель пишет как привык', () => {
    expect(gradeAnswer({ ...q, answer: 1.5, tolerance: 0.1, relative: false }, '1,5').correct).toBe(
      true,
    );
  });
});

describe('порядок', () => {
  const q = {
    kind: 'order' as const,
    id: 'q4',
    prompt: 'Расставьте по контуру',
    difficulty: 2,
    items: ['Задание', 'Сравнение', 'Регулятор', 'Объект', 'Датчик'],
  };

  it('считает долю правильно стоящих соседей, а не позиций', () => {
    expect(gradeAnswer(q, [0, 1, 2, 3, 4]).score).toBe(1);
    // Переставлены два соседних: три стыка из четырёх целы.
    expect(gradeAnswer(q, [0, 1, 2, 4, 3]).score).toBeCloseTo(2 / 4, 6);
    expect(gradeAnswer(q, [4, 3, 2, 1, 0]).score).toBe(0);
  });
});

describe('сопоставление', () => {
  const q = {
    kind: 'match' as const,
    id: 'q5',
    prompt: 'Кто что сказал',
    difficulty: 2,
    pairs: [
      ['Винер', 'Управление и связь'],
      ['Эшби', 'Необходимое разнообразие'],
      ['Шеннон', 'Мера информации'],
    ] as [string, string][],
  };

  it('даёт балл за каждую верную пару', () => {
    expect(gradeAnswer(q, [0, 1, 2]).score).toBe(1);
    expect(gradeAnswer(q, [0, 2, 1]).score).toBeCloseTo(1 / 3, 6);
  });
});

describe('цель в виджете', () => {
  /* Любой считающий виджет может быть заданием: он сам сообщает, добрался ли
     читатель до цели. Это и есть та точка, ради которой оценка расширяемая. */
  const q = {
    kind: 'goal' as const,
    id: 'q6',
    prompt: 'Удержите температуру в пределах ±0,5° полминуты',
    difficulty: 4,
    widget: 'pid-lab',
    goal: 'settled',
  };

  it('верит виджету, но требует именно его цель', () => {
    expect(gradeAnswer(q, { goal: 'settled', reached: true }).correct).toBe(true);
    expect(gradeAnswer(q, { goal: 'settled', reached: false }).correct).toBe(false);
    expect(gradeAnswer(q, { goal: 'другое', reached: true }).correct).toBe(false);
  });

  it('принимает частичный успех, если виджет его сообщил', () => {
    expect(gradeAnswer(q, { goal: 'settled', reached: false, score: 0.6 }).score).toBe(0.6);
  });
});

describe('работа целиком', () => {
  const работа = {
    id: 'a1',
    questions: [
      { kind: 'choice' as const, id: 'q1', prompt: 'п', difficulty: 1, options: ['а', 'б'], answer: 0 },
      { kind: 'choice' as const, id: 'q2', prompt: 'п', difficulty: 4, options: ['а', 'б'], answer: 0 },
    ],
    passScore: 0.7,
  };

  it('взвешивает по трудности: лёгкий вопрос не перевешивает трудный', () => {
    const только_лёгкий = gradeAssessment(работа, { q1: 0, q2: 1 });
    const только_трудный = gradeAssessment(работа, { q1: 1, q2: 0 });
    expect(только_лёгкий.score).toBeCloseTo(1 / 5, 6);
    expect(только_трудный.score).toBeCloseTo(4 / 5, 6);
  });

  it('отдаёт разбор по каждому вопросу, а не только итог', () => {
    const r = gradeAssessment(работа, { q1: 0, q2: 0 });
    expect(r.perQuestion.map((p) => [p.id, p.score])).toEqual([
      ['q1', 1],
      ['q2', 1],
    ]);
    expect(r.passed).toBe(true);
  });

  it('порог сравнивается со взвешенным итогом', () => {
    expect(gradeAssessment(работа, { q1: 0, q2: 1 }).passed).toBe(false);
    expect(gradeAssessment(работа, { q1: 1, q2: 0 }).passed).toBe(true);
  });

  it('неотвеченный вопрос — ноль, а не пропуск', () => {
    const r = gradeAssessment(работа, {});
    expect(r.score).toBe(0);
    expect(r.perQuestion).toHaveLength(2);
  });
});

describe('расширяемость', () => {
  it('новый вид вопроса — схема плюс чистая функция, и больше ничего', () => {
    defineQuestion({
      kind: 'yesno',
      label: 'Да или нет',
      schema: s.record({
        kind: s.literal('yesno'),
        id: s.text(),
        prompt: s.text(),
        difficulty: s.number({ integer: true, min: 1, max: 5 }),
        answer: s.flag(),
      }),
      grade: (q, a) => ({ correct: a === q.answer, score: a === q.answer ? 1 : 0 }),
    });
    expect(questionKinds()).toContain('yesno');
    expect(
      gradeAnswer({ kind: 'yesno', id: 'x', prompt: 'п', difficulty: 1, answer: true }, true).score,
    ).toBe(1);
  });

  it('схема вопросов собирается из реестра', () => {
    const плохо = questionsSchema().check({ kind: 'выдумка' }, 'q');
    expect(!плохо.ok && плохо.issues[0]?.message).toMatch(/неизвестный вид/);
  });

  it('неизвестный вид на оценке даёт ноль и говорит об этом, а не падает', () => {
    const r = gradeAnswer({ kind: 'выдумка', id: 'x', prompt: 'п', difficulty: 1 }, 'что угодно');
    expect(r.score).toBe(0);
    expect(r.explain).toMatch(/выдумка/);
  });
});
