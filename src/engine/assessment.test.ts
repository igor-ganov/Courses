import { describe, expect, it } from 'vitest';
import { s } from '@/core/schema';
import type { Assessment } from '@/content/model';
import {
  QuestionRegistry,
  defineQuestionType,
  gradeAssessment,
  standardQuestionTypes,
} from './assessment';

const registry = new QuestionRegistry().registerAll(standardQuestionTypes);

const grade = (type: string, props: unknown, answer: unknown) =>
  registry.grade({ id: 'q', type, prompt: 'p', props: props as Record<string, unknown> }, answer);

describe('single choice', () => {
  const props = { options: ['a', 'b', 'c'], correct: 1 };

  it('scores the right option', () => {
    expect(grade('choice.single', props, 1)).toMatchObject({ correct: true, score: 1 });
  });

  it('scores a wrong option and names the right one', () => {
    const result = grade('choice.single', props, 0);
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback).toContain('b');
  });

  it('treats a missing answer as unanswered, not wrong', () => {
    expect(grade('choice.single', props, null)).toMatchObject({ correct: false, answered: false });
  });
});

describe('multiple choice', () => {
  const props = { options: ['a', 'b', 'c', 'd'], correct: [0, 2] };

  it('gives full credit for an exact set', () => {
    expect(grade('choice.multi', props, [2, 0])).toMatchObject({ correct: true, score: 1 });
  });

  it('gives partial credit and penalises false positives', () => {
    // one of two right, one wrong pick out of two distractors: 0.5 - 0.5 = 0
    expect(grade('choice.multi', props, [0, 1]).score).toBeCloseTo(0);
    // one of two right, nothing wrong picked
    expect(grade('choice.multi', props, [0]).score).toBeCloseTo(0.5);
  });

  it('never scores below zero', () => {
    expect(grade('choice.multi', props, [1, 3]).score).toBe(0);
  });
});

describe('numeric', () => {
  const props = { answer: 3.14, tolerance: 0.01, unit: 'бит' };

  it('accepts a value inside the tolerance band', () => {
    expect(grade('numeric', props, 3.145).correct).toBe(true);
    expect(grade('numeric', props, 3.2).correct).toBe(false);
  });

  it('parses a numeric string with a comma decimal separator', () => {
    expect(grade('numeric', props, '3,14').correct).toBe(true);
  });

  it('rejects unparseable input as unanswered', () => {
    expect(grade('numeric', props, 'около трёх')).toMatchObject({ answered: false, correct: false });
  });
});

describe('ordering', () => {
  const props = { items: ['датчик', 'компаратор', 'исполнитель'] };

  it('gives full credit for the authored order', () => {
    expect(grade('order', props, [0, 1, 2])).toMatchObject({ correct: true, score: 1 });
  });

  it('gives partial credit for adjacent pairs in the right relative order', () => {
    const result = grade('order', props, [0, 2, 1]);
    expect(result.correct).toBe(false);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(1);
  });
});

describe('matching', () => {
  const props = {
    pairs: [
      { left: 'обратная связь', right: 'замыкает контур' },
      { left: 'разнообразие', right: 'число состояний' },
    ],
  };

  it('scores each correct pairing', () => {
    expect(grade('match', props, { 0: 0, 1: 1 })).toMatchObject({ correct: true, score: 1 });
    expect(grade('match', props, { 0: 0, 1: 0 }).score).toBe(0.5);
  });
});

describe('short text', () => {
  const props = { accept: ['гомеостаз'], normalize: true };

  it('accepts a case- and space-insensitive match', () => {
    expect(grade('text.short', props, '  Гомеостаз ').correct).toBe(true);
  });

  it('rejects a different word', () => {
    expect(grade('text.short', props, 'энтропия').correct).toBe(false);
  });
});

describe('interactive goal', () => {
  it('takes the score reported by the widget', () => {
    const props = { widget: 'sim.thermostat', goal: 'settle', threshold: 0.8 };
    expect(grade('goal', props, { score: 0.9 })).toMatchObject({ correct: true, score: 0.9 });
    expect(grade('goal', props, { score: 0.5 }).correct).toBe(false);
  });
});

describe('QuestionRegistry extensibility', () => {
  it('accepts a custom question type and uses its grader', () => {
    const parity = defineQuestionType({
      type: 'parity',
      schema: s.object({ want: s.enum(['even', 'odd'] as const) }),
      grade: (props, answer) => {
        const n = Number(answer);
        if (!Number.isFinite(n)) return { correct: false, score: 0, answered: false };
        const isEven = n % 2 === 0;
        const correct = props.want === (isEven ? 'even' : 'odd');
        return { correct, score: correct ? 1 : 0, answered: true };
      },
      component: () => null,
    });
    const custom = new QuestionRegistry().registerAll(standardQuestionTypes).register(parity);
    expect(custom.grade({ id: 'q', type: 'parity', prompt: '', props: { want: 'even' } }, 4).correct).toBe(true);
  });

  it('fails loudly for an unknown question type', () => {
    const result = registry.grade({ id: 'q', type: 'nope', prompt: '' }, 1);
    expect(result.correct).toBe(false);
    expect(result.feedback).toMatch(/unknown question type/i);
  });

  it('reports invalid question props rather than grading nonsense', () => {
    const result = grade('numeric', { tolerance: 1 }, 1);
    expect(result.correct).toBe(false);
    expect(result.feedback).toMatch(/answer/);
  });
});

describe('gradeAssessment', () => {
  const assessment: Assessment = {
    id: 'a1',
    passingScore: 0.6,
    questions: [
      { id: 'q1', type: 'choice.single', prompt: 'p1', props: { options: ['a', 'b'], correct: 0 }, difficulty: 1 },
      { id: 'q2', type: 'numeric', prompt: 'p2', props: { answer: 2, tolerance: 0 }, difficulty: 3 },
    ],
  };

  it('weights questions by difficulty and reports the ratio', () => {
    const result = gradeAssessment(assessment, { q1: 0, q2: 99 }, registry);
    expect(result.earned).toBe(1);
    expect(result.max).toBe(4);
    expect(result.ratio).toBeCloseTo(0.25);
    expect(result.passed).toBe(false);
    expect(result.perQuestion.q2.correct).toBe(false);
  });

  it('passes once the ratio clears the threshold', () => {
    const result = gradeAssessment(assessment, { q1: 0, q2: 2 }, registry);
    expect(result.ratio).toBe(1);
    expect(result.passed).toBe(true);
  });

  it('counts unanswered questions towards the maximum', () => {
    const result = gradeAssessment(assessment, {}, registry);
    expect(result.answeredCount).toBe(0);
    expect(result.max).toBe(4);
    expect(result.ratio).toBe(0);
  });

  it('defaults the passing threshold when the author omits it', () => {
    const noThreshold: Assessment = { ...assessment, passingScore: undefined };
    const result = gradeAssessment(noThreshold, { q1: 0, q2: 2 }, registry);
    expect(result.passed).toBe(true);
  });
});
