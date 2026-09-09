/**
 * МОДЕЛЬ СОДЕРЖАНИЯ — форма курса.
 *
 * Курс: модули → темы → витки → лекция из блоков. Модуль задаёт порядок чтения,
 * тема живёт сквозь весь курс и встречается несколько раз всё глубже — это и
 * есть спираль. Виток не пересказывает предыдущий, а наследует его цели
 * (`inherits`) и ссылается на соседей (`seeAlso`), в том числе в другом курсе.
 *
 * Типы здесь ВЫВЕДЕНЫ из схем, а не написаны рядом: два описания одной и той же
 * структуры неизбежно разъезжаются, и разъезжаются они молча.
 *
 * Про блоки лекции модель не знает ничего — она спрашивает реестр. Заводить
 * здесь перечисление видов означало бы, что каждый новый виджет стоит правки
 * в модели, в реестре и в отображении; ровно этого и не должно быть.
 */

import * as s from '~/core/schema';
import { blocks } from './registry';

/** Адрес витка: `feedback:2` внутри курса, `control-101/feedback:2` — в другом. */
export interface LevelRef {
  readonly course?: string;
  readonly topic: string;
  readonly depth: number;
}

const REF = /^(?:([a-z0-9-]+)\/)?([a-z0-9-]+):(\d+)$/;

export function parseRef(value: string): LevelRef | undefined {
  const m = REF.exec(value.trim());
  if (!m) return undefined;
  const depth = Number(m[3]);
  if (!Number.isInteger(depth) || depth < 1) return undefined;
  return m[1] ? { course: m[1], topic: m[2]!, depth } : { topic: m[2]!, depth };
}

export function levelKey(ref: LevelRef): string {
  return `${ref.course ? `${ref.course}/` : ''}${ref.topic}:${ref.depth}`;
}

/* Ссылка хранится строкой: в файле курса `'feedback:2'` читается лучше, чем
   запись из трёх полей, а разбор всё равно проверяется схемой. */
const ref = () =>
  s.text().where((v) => parseRef(v) !== undefined, 'адрес витка вида "тема:глубина" или "курс/тема:глубина"');

const id = () => s.text({ max: 64 }).where((v) => /^[a-z0-9-]+$/.test(v), 'только строчные латинские, цифры и дефис');

const levelSchema = () =>
  s.record({
    /** Номер витка спирали: 1 — первая встреча с темой, дальше глубже. */
    depth: s.number({ integer: true, min: 1, max: 9 }),
    title: s.text({ max: 120 }),
    /** Чему учит именно этот виток. Проверяется, что цели вообще заявлены. */
    objectives: s.list(s.text({ max: 200 }), { min: 1 }),
    /** Витки, цели которых к этому моменту считаются достигнутыми. */
    inherits: s.optional(s.list(ref())),
    /** Перекрёстные ссылки — вперёд, назад и в другие курсы. */
    seeAlso: s.optional(s.list(ref())),
    lecture: s.list(blocks(), { min: 1 }),
  });

const topicSchema = () =>
  s
    .record({
      id: id(),
      title: s.text({ max: 120 }),
      summary: s.text({ max: 400 }),
      /** Темы, без которых эту не начать. Порядок спирали считается по ним. */
      requires: s.optional(s.list(id())),
      levels: s.list(levelSchema(), { min: 1 }),
    })
    .where(
      (t) => t.levels.every((l, i) => l.depth === i + 1),
      'витки идут подряд по глубине, начиная с первого: спираль не стартует с середины и не повторяет виток',
    );

const moduleSchema = () =>
  s.record({
    id: id(),
    title: s.text({ max: 120 }),
    /** Знак для оглавления: ↻, ⚖, ▦. Необязателен. */
    glyph: s.optional(s.text({ max: 4 })),
    description: s.text({ max: 600 }),
    /** Порядок чтения внутри модуля. Что эти темы существуют — проверяет граф. */
    topicIds: s.list(id(), { min: 1 }),
  });

export const courseSchema = () =>
  s.record({
    id: id(),
    title: s.text({ max: 120 }),
    subtitle: s.optional(s.text({ max: 240 })),
    description: s.text({ max: 1200 }),
    modules: s.list(moduleSchema(), { min: 1 }),
    topics: s.list(topicSchema(), { min: 1 }),
  });

export type Course = s.Infer<ReturnType<typeof courseSchema>>;
export type Module = Course['modules'][number];
export type Topic = Course['topics'][number];
export type Level = Topic['levels'][number];

/**
 * Разбор курса при сборке: либо готовый курс, либо падение со всеми бедами
 * разом и с адресами. Связность — что темы модулей существуют, что ссылки
 * ведут в существующие витки, что зависимости не зациклены — проверяет граф:
 * здесь речь только о форме одного курса.
 */
export function defineCourse(value: unknown): Course {
  return s.parse(courseSchema(), value, '');
}
