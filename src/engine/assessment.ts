/**
 * The assessment engine.
 *
 * Question types are registered the same way blocks are: a type string maps to a
 * schema, a pure grader and a React component. Grading is deliberately kept
 * pure and framework-free so it can be unit-tested exhaustively and reused
 * anywhere (a level summary, a spaced-repetition review, a end-of-module boss
 * fight) without dragging the UI along.
 *
 * Partial credit matters here: a learner who orders four of five steps right
 * has understood something, and telling them "wrong" teaches nothing.
 */

import type { ComponentType } from 'react';
import { s, type Schema } from '@/core/schema';
import type { Assessment, Question } from '@/content/model';

export interface Grade {
  correct: boolean;
  /** 0..1 */
  score: number;
  /** False when the learner left it blank or typed something unparseable. */
  answered: boolean;
  feedback?: string;
  detail?: Record<string, unknown>;
}

export interface QuestionViewProps<P = Record<string, unknown>> {
  question: Question;
  props: P;
  answer: unknown;
  onAnswer(answer: unknown): void;
  /** Set once the learner has submitted; the view switches to review mode. */
  revealed: boolean;
  grade?: Grade;
  disabled?: boolean;
}

export interface QuestionType<P = any> {
  type: string;
  schema: Schema<P>;
  grade(props: P, answer: unknown): Grade;
  component: ComponentType<QuestionViewProps<P>>;
  label?: string;
  /** Interactive questions are answered by a widget rather than a form. */
  interactive?: boolean;
}

export function defineQuestionType<P>(def: QuestionType<P>): QuestionType<P> {
  return def;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export class QuestionRegistry {
  private types = new Map<string, QuestionType<any>>();

  register(def: QuestionType<any>, opts: { override?: boolean } = {}): this {
    if (this.types.has(def.type) && !opts.override) {
      throw new Error(`Question type "${def.type}" is already registered.`);
    }
    this.types.set(def.type, def);
    return this;
  }

  registerAll(defs: readonly QuestionType<any>[], opts: { override?: boolean } = {}): this {
    for (const def of defs) this.register(def, opts);
    return this;
  }

  get(type: string): QuestionType<any> | undefined {
    return this.types.get(type);
  }

  has(type: string): boolean {
    return this.types.has(type);
  }

  list(): QuestionType<any>[] {
    return [...this.types.values()];
  }

  /** Validate the authored props, then grade the learner's answer. */
  grade(question: Question, answer: unknown): Grade {
    const def = this.types.get(question.type);
    if (!def) {
      return {
        correct: false,
        score: 0,
        answered: false,
        feedback: `unknown question type "${question.type}"`,
      };
    }
    const parsed = def.schema.parse(question.props ?? {}, question.id);
    if (!parsed.ok) {
      return {
        correct: false,
        score: 0,
        answered: false,
        feedback: `invalid question props: ${parsed.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`,
      };
    }
    return def.grade(parsed.value, answer);
  }

  /** Parsed props for rendering, or null when the question is malformed. */
  propsFor(question: Question): unknown | null {
    const def = this.types.get(question.type);
    if (!def) return null;
    const parsed = def.schema.parse(question.props ?? {}, question.id);
    return parsed.ok ? parsed.value : null;
  }
}

// ---------------------------------------------------------------------------
// Standard question types
// ---------------------------------------------------------------------------

const singleChoice = defineQuestionType({
  type: 'choice.single',
  label: 'Один вариант',
  schema: s.object({
    options: s.array(s.string({ min: 1 }), { min: 2 }),
    correct: s.number({ min: 0, int: true }),
    /** Per-option feedback, indexed like `options`. */
    why: s.optional(s.array(s.string())),
  }),
  grade: (props, answer) => {
    const picked = typeof answer === 'number' ? answer : null;
    if (picked === null || !Number.isInteger(picked) || picked < 0 || picked >= props.options.length) {
      return { correct: false, score: 0, answered: false };
    }
    const correct = picked === props.correct;
    return {
      correct,
      score: correct ? 1 : 0,
      answered: true,
      feedback:
        props.why?.[picked] ??
        (correct ? 'Верно.' : `Верный ответ: «${props.options[props.correct]}».`),
    };
  },
  component: () => null,
});

const multiChoice = defineQuestionType({
  type: 'choice.multi',
  label: 'Несколько вариантов',
  schema: s.object({
    options: s.array(s.string({ min: 1 }), { min: 2 }),
    correct: s.array(s.number({ min: 0, int: true }), { min: 1 }),
    why: s.optional(s.array(s.string())),
  }),
  grade: (props, answer) => {
    if (!Array.isArray(answer) || answer.length === 0) {
      return { correct: false, score: 0, answered: false };
    }
    const picked = new Set(answer.filter((n): n is number => Number.isInteger(n)));
    const right = new Set(props.correct);
    const wrongCount = props.options.length - right.size;

    let hits = 0;
    let misses = 0;
    for (const index of picked) (right.has(index) ? (hits += 1) : (misses += 1));

    const raw = hits / right.size - (wrongCount > 0 ? misses / wrongCount : 0);
    const score = clamp01(raw);
    const correct = hits === right.size && misses === 0;
    return {
      correct,
      score,
      answered: true,
      feedback: correct
        ? 'Полный набор.'
        : `Правильные варианты: ${props.correct.map((i) => `«${props.options[i]}»`).join(', ')}.`,
    };
  },
  component: () => null,
});

const numeric = defineQuestionType({
  type: 'numeric',
  label: 'Число',
  schema: s.object({
    answer: s.number(),
    tolerance: s.withDefault(s.number({ min: 0 }), 0),
    unit: s.optional(s.string()),
    /** Hint text shown next to the input, e.g. "с точностью до 0,01". */
    placeholder: s.optional(s.string()),
  }),
  grade: (props, answer) => {
    const value =
      typeof answer === 'number'
        ? answer
        : typeof answer === 'string' && answer.trim() !== ''
          ? Number(answer.replace(',', '.').replace(/\s/g, ''))
          : Number.NaN;
    if (!Number.isFinite(value)) return { correct: false, score: 0, answered: false };
    const correct = Math.abs(value - props.answer) <= props.tolerance + Number.EPSILON;
    return {
      correct,
      score: correct ? 1 : 0,
      answered: true,
      feedback: correct
        ? 'Верно.'
        : `Ожидалось ${props.answer}${props.unit ? ` ${props.unit}` : ''}${
            props.tolerance ? ` (±${props.tolerance})` : ''
          }.`,
    };
  },
  component: () => null,
});

const ordering = defineQuestionType({
  type: 'order',
  label: 'Расставить по порядку',
  schema: s.object({
    /** Authored in the correct order; the view shuffles for display. */
    items: s.array(s.string({ min: 1 }), { min: 2 }),
    caption: s.optional(s.string()),
  }),
  grade: (props, answer) => {
    if (!Array.isArray(answer) || answer.length !== props.items.length) {
      return { correct: false, score: 0, answered: false };
    }
    const position = new Map<number, number>();
    answer.forEach((item, index) => position.set(Number(item), index));
    if (position.size !== props.items.length) return { correct: false, score: 0, answered: false };

    // Fraction of pairs whose relative order is right: rewards partial insight.
    let good = 0;
    let total = 0;
    for (let a = 0; a < props.items.length; a += 1) {
      for (let b = a + 1; b < props.items.length; b += 1) {
        total += 1;
        if ((position.get(a) ?? 0) < (position.get(b) ?? 0)) good += 1;
      }
    }
    const score = total === 0 ? 1 : good / total;
    const correct = score === 1;
    return {
      correct,
      score,
      answered: true,
      feedback: correct ? 'Порядок верный.' : `Верный порядок: ${props.items.join(' → ')}.`,
    };
  },
  component: () => null,
});

const matching = defineQuestionType({
  type: 'match',
  label: 'Сопоставить',
  schema: s.object({
    pairs: s.array(s.object({ left: s.string({ min: 1 }), right: s.string({ min: 1 }) }), { min: 2 }),
  }),
  grade: (props, answer) => {
    if (typeof answer !== 'object' || answer === null) {
      return { correct: false, score: 0, answered: false };
    }
    const map = answer as Record<string, unknown>;
    let hits = 0;
    let answered = 0;
    props.pairs.forEach((_, index) => {
      const chosen = map[String(index)];
      if (chosen === undefined || chosen === null) return;
      answered += 1;
      if (Number(chosen) === index) hits += 1;
    });
    if (answered === 0) return { correct: false, score: 0, answered: false };
    const score = hits / props.pairs.length;
    return {
      correct: hits === props.pairs.length,
      score,
      answered: true,
      feedback:
        hits === props.pairs.length
          ? 'Все пары на месте.'
          : `Совпало ${hits} из ${props.pairs.length}.`,
    };
  },
  component: () => null,
});

const shortText = defineQuestionType({
  type: 'text.short',
  label: 'Короткий ответ',
  schema: s.object({
    accept: s.array(s.string({ min: 1 }), { min: 1 }),
    normalize: s.withDefault(s.boolean(), true),
    placeholder: s.optional(s.string()),
  }),
  grade: (props, answer) => {
    if (typeof answer !== 'string' || answer.trim() === '') {
      return { correct: false, score: 0, answered: false };
    }
    const norm = (value: string) =>
      props.normalize ? value.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ') : value;
    const correct = props.accept.some((candidate) => norm(candidate) === norm(answer));
    return {
      correct,
      score: correct ? 1 : 0,
      answered: true,
      feedback: correct ? 'Верно.' : `Ожидалось: «${props.accept[0]}».`,
    };
  },
  component: () => null,
});

/**
 * A question answered by doing rather than picking: the learner drives a
 * simulation or a mini-game until it reports a score. The widget is rendered by
 * the block registry; here we only decide whether the reported score counts.
 */
const interactiveGoal = defineQuestionType({
  type: 'goal',
  label: 'Практическое задание',
  interactive: true,
  schema: s.object({
    /** Block type of the widget to embed. */
    widget: s.string({ min: 1 }),
    /** Widget-specific goal identifier. */
    goal: s.optional(s.string()),
    threshold: s.withDefault(s.number({ min: 0, max: 1 }), 0.8),
    widgetProps: s.optional(s.record(s.unknown())),
    caption: s.optional(s.string()),
  }),
  grade: (props, answer) => {
    const reported =
      typeof answer === 'object' && answer !== null && 'score' in answer
        ? Number((answer as { score: unknown }).score)
        : Number.NaN;
    if (!Number.isFinite(reported)) return { correct: false, score: 0, answered: false };
    const score = clamp01(reported);
    return {
      correct: score >= props.threshold,
      score,
      answered: true,
      feedback:
        score >= props.threshold
          ? 'Цель достигнута.'
          : `Пока ${Math.round(score * 100)}%, нужно не меньше ${Math.round(props.threshold * 100)}%.`,
    };
  },
  component: () => null,
});

export const standardQuestionTypes: readonly QuestionType<any>[] = [
  singleChoice,
  multiChoice,
  numeric,
  ordering,
  matching,
  shortText,
  interactiveGoal,
];

// ---------------------------------------------------------------------------
// Whole-assessment grading
// ---------------------------------------------------------------------------

export interface AssessmentResult {
  earned: number;
  max: number;
  /** earned / max, 0..1 */
  ratio: number;
  passed: boolean;
  answeredCount: number;
  perQuestion: Record<string, Grade>;
  /** Concept ids the learner got wrong — feeds the review queue. */
  weakConcepts: string[];
}

export const DEFAULT_PASSING_SCORE = 0.7;

/** Difficulty doubles as the score weight: hard questions say more about mastery. */
export function gradeAssessment(
  assessment: Assessment,
  answers: Record<string, unknown>,
  registry: QuestionRegistry,
): AssessmentResult {
  const perQuestion: Record<string, Grade> = {};
  const weak = new Set<string>();
  let earned = 0;
  let max = 0;
  let answeredCount = 0;

  for (const question of assessment.questions) {
    const weight = question.difficulty ?? 1;
    const grade = registry.grade(question, answers[question.id]);
    perQuestion[question.id] = grade;
    max += weight;
    earned += grade.score * weight;
    if (grade.answered) answeredCount += 1;
    if (grade.score < 1) for (const concept of question.concepts ?? []) weak.add(concept);
  }

  const ratio = max === 0 ? 0 : earned / max;
  return {
    earned: Number(earned.toFixed(4)),
    max,
    ratio,
    passed: ratio >= (assessment.passingScore ?? DEFAULT_PASSING_SCORE),
    answeredCount,
    perQuestion,
    weakConcepts: [...weak],
  };
}
