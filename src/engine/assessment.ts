/**
 * ОЦЕНКА — чистые функции над вопросом и ответом.
 *
 * Два свойства держат всё остальное:
 *
 *   — чистота. Тот же вопрос и тот же ответ дают тот же результат всегда: без
 *     часов, случайности и состояния. Иначе оценку нельзя ни проверить, ни
 *     объяснить читателю, ни пересчитать позже по сохранённому ответу.
 *   — частичность. «Неверно» на вопросе, где отмечено три пункта из четырёх, —
 *     это отписка: читатель не узнаёт, чего именно он не знает. Балл дробный
 *     везде, где дробность имеет смысл.
 *
 * Виды вопросов расширяются так же, как блоки: схема плюс функция оценки. Ради
 * этого и заведён отдельный реестр — иначе любой новый вид задания приходилось
 * бы вписывать в движок, а значит и в его тесты, и в отображение.
 */

import * as s from '~/core/schema';

export interface Grade {
  /** Полный успех. Частичный балл при этом может быть больше нуля. */
  readonly correct: boolean;
  /** Доля от 0 до 1. */
  readonly score: number;
  readonly explain?: string;
}

export interface QuestionBase {
  readonly kind: string;
  readonly id: string;
  readonly prompt: string;
  /** Вес вопроса в работе: 1 — узнавание, 5 — перенос на новую задачу. */
  readonly difficulty: number;
  readonly explain?: string;
}

export interface QuestionType<Q extends QuestionBase = QuestionBase> {
  readonly kind: Q['kind'];
  readonly label: string;
  readonly schema: s.Schema<Q>;
  readonly grade: (question: Q, answer: unknown) => Grade;
}

const registry = new Map<string, QuestionType>();
let version = 0;
let cached: { at: number; schema: s.Schema<QuestionBase> } | undefined;

export function defineQuestion<Q extends QuestionBase>(type: QuestionType<Q>): void {
  if (registry.has(type.kind)) throw new Error(`вид вопроса "${type.kind}" уже занят`);
  registry.set(type.kind, type as unknown as QuestionType);
  version += 1;
}

export function questionKinds(): string[] {
  return [...registry.keys()];
}

export function questionTypes(): QuestionType[] {
  return [...registry.values()];
}

export function questionsSchema(): s.Schema<QuestionBase> {
  if (!cached || cached.at !== version) {
    const branches: Record<string, s.Schema<unknown>> = {};
    for (const [kind, type] of registry) branches[kind] = type.schema;
    cached = { at: version, schema: s.variant('kind', branches) as s.Schema<QuestionBase> };
  }
  return cached.schema;
}

export function resetQuestions(): void {
  registry.clear();
  version += 1;
  cached = undefined;
}

/**
 * Оценить один ответ. Неизвестный вид не роняет работу: читатель получает ноль
 * и внятную строчку, а не белый экран посреди контрольной.
 */
export function gradeAnswer<Q extends QuestionBase>(question: Q, answer: unknown): Grade {
  const type = registry.get(question.kind);
  if (!type) {
    return { correct: false, score: 0, explain: `вид вопроса "${question.kind}" не зарегистрирован` };
  }
  const grade = type.grade(question, answer);
  const score = clamp01(grade.score);
  const explain = grade.explain ?? question.explain;
  return explain === undefined
    ? { correct: grade.correct, score }
    : { correct: grade.correct, score, explain };
}

export interface Assessment {
  readonly id: string;
  readonly questions: readonly QuestionBase[];
  /** Порог зачёта по взвешенному итогу. По умолчанию — две трети. */
  readonly passScore?: number;
}

export interface AssessmentResult {
  readonly score: number;
  readonly passed: boolean;
  readonly perQuestion: readonly (Grade & { readonly id: string })[];
}

/**
 * Оценить работу целиком. Итог взвешен по трудности: пять лёгких вопросов не
 * должны перевешивать один трудный, иначе оценка меряет усидчивость.
 * Неотвеченный вопрос — ноль, а не пропуск: пропуск незаметно завышал бы итог.
 */
export function gradeAssessment(
  assessment: Assessment,
  answers: Readonly<Record<string, unknown>>,
): AssessmentResult {
  const perQuestion = assessment.questions.map((q) => ({
    id: q.id,
    ...gradeAnswer(q, answers[q.id]),
  }));
  const weight = assessment.questions.reduce((sum, q) => sum + Math.max(q.difficulty, 0), 0);
  const earned = assessment.questions.reduce(
    (sum, q, i) => sum + Math.max(q.difficulty, 0) * (perQuestion[i]?.score ?? 0),
    0,
  );
  const score = weight > 0 ? earned / weight : 0;
  return { score, passed: score >= (assessment.passScore ?? 2 / 3), perQuestion };
}

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/* ── стандартные виды ───────────────────────────────────────────────── */

const base = {
  id: s.text({ max: 64 }),
  prompt: s.text({ max: 600 }),
  difficulty: s.number({ integer: true, min: 1, max: 5 }),
  explain: s.optional(s.text({ max: 800 })),
};

/** Число из ответа: читатель пишет «1,5», а не «1.5». */
function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const n = Number(value.trim().replace(',', '.').replace(/\s+/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

const asIndexList = (value: unknown, limit: number): number[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < limit))]
    : [];

export function standardQuestions(): void {
  defineQuestion({
    kind: 'choice',
    label: 'Выбор одного',
    schema: s.record({
      kind: s.literal('choice'),
      ...base,
      options: s.list(s.text({ max: 300 }), { min: 2 }),
      answer: s.number({ integer: true, min: 0 }),
    }),
    grade: (q, a) => {
      const ok = typeof a === 'number' && a === q.answer;
      return { correct: ok, score: ok ? 1 : 0 };
    },
  });

  defineQuestion({
    kind: 'multi',
    label: 'Выбор нескольких',
    schema: s.record({
      kind: s.literal('multi'),
      ...base,
      options: s.list(s.text({ max: 300 }), { min: 2 }),
      answer: s.list(s.number({ integer: true, min: 0 }), { min: 1 }),
    }),
    grade: (q, a) => {
      const picked = asIndexList(a, q.options.length);
      const right = new Set(q.answer);
      /* Попадания минус промахи, поделённые на число верных. Без вычитания
         выгодно отметить всё подряд, и вопрос перестаёт что-либо мерить. */
      const hits = picked.filter((i) => right.has(i)).length;
      const misses = picked.length - hits;
      const score = clamp01((hits - misses) / right.size);
      return { correct: hits === right.size && misses === 0, score };
    },
  });

  defineQuestion({
    kind: 'numeric',
    label: 'Число',
    schema: s.record({
      kind: s.literal('numeric'),
      ...base,
      answer: s.number(),
      /** Допуск: доля от ответа при relative, иначе те же единицы. */
      tolerance: s.number({ min: 0 }),
      relative: s.optional(s.flag()),
      unit: s.optional(s.text({ max: 32 })),
    }),
    grade: (q, a) => {
      const given = toNumber(a);
      if (given === undefined) return { correct: false, score: 0 };
      const allowed = q.relative ? Math.abs(q.answer * q.tolerance) : q.tolerance;
      const ok = Math.abs(given - q.answer) <= allowed;
      return { correct: ok, score: ok ? 1 : 0 };
    },
  });

  defineQuestion({
    kind: 'order',
    label: 'Порядок',
    schema: s.record({
      kind: s.literal('order'),
      ...base,
      /** Правильный порядок — тот, в котором пункты записаны. */
      items: s.list(s.text({ max: 300 }), { min: 3 }),
    }),
    grade: (q, a) => {
      const given = asIndexList(a, q.items.length);
      if (given.length !== q.items.length) return { correct: false, score: 0 };
      /* Считаются целые стыки, а не совпавшие позиции: смещение всей цепочки
         на один шаг сохраняет знание порядка, а по позициям даёт ноль. */
      let intact = 0;
      for (let i = 1; i < given.length; i += 1) {
        if (given[i]! === given[i - 1]! + 1) intact += 1;
      }
      const score = clamp01(intact / (q.items.length - 1));
      return { correct: score === 1, score };
    },
  });

  defineQuestion({
    kind: 'match',
    label: 'Сопоставление',
    schema: s.record({
      kind: s.literal('match'),
      ...base,
      /** Пары «слева — справа»; правильное сопоставление — по порядку. */
      pairs: s.list(s.list(s.text({ max: 300 }), { min: 2, max: 2 }), { min: 2 }),
    }),
    grade: (q, a) => {
      const given = Array.isArray(a) ? a : [];
      let hits = 0;
      for (let i = 0; i < q.pairs.length; i += 1) if (given[i] === i) hits += 1;
      const score = clamp01(hits / q.pairs.length);
      return { correct: score === 1, score };
    },
  });

  /* Цель в виджете. Любой считающий виджет может быть заданием: он сам знает,
     добрался ли читатель до цели, и сообщает это сюда. Ради этого вида оценка
     и сделана расширяемой — задание в кибернетике чаще «удержи контур», чем
     «выбери из четырёх». */
  defineQuestion({
    kind: 'goal',
    label: 'Цель в виджете',
    schema: s.record({
      kind: s.literal('goal'),
      ...base,
      widget: s.text({ max: 64 }),
      goal: s.text({ max: 64 }),
    }),
    grade: (q, a) => {
      const report = (a ?? {}) as { goal?: unknown; reached?: unknown; score?: unknown };
      if (report.goal !== q.goal) return { correct: false, score: 0 };
      const reached = report.reached === true;
      const partial = typeof report.score === 'number' ? clamp01(report.score) : 0;
      return { correct: reached, score: reached ? 1 : partial };
    },
  });
}
