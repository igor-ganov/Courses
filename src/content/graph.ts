/**
 * ГРАФ УЧЕБНОГО ПЛАНА — курс целиком, а не по файлу за раз.
 *
 * Схема ловит форму одного курса; связность видна только сверху: существует ли
 * тема, на которую сослался модуль, ведёт ли ссылка в существующий виток, нет
 * ли кольца в зависимостях. Всё это обязано падать на сборке, а не у читателя,
 * поэтому проверка возвращает список бед с адресами, а не бросает на первой.
 *
 * Здесь же живут два порядка, в которых курс можно проходить:
 *
 *   — порядок чтения: как разложено по модулям, тема за темой, виток за витком;
 *   — порядок спирали: сначала ВСЕ темы на первом витке, потом все на втором.
 *     Это и есть спиральность: читатель встречает каждую мысль один раз прежде,
 *     чем любая из них станет трудной.
 */

import type { Issue } from '~/core/schema';
import { levelKey, parseRef, type Course, type Level, type LevelRef, type Topic } from './model';

/** Адрес витка, который печатается сам: `String(ref) === 'feedback:2'`. */
export interface LevelAddress extends LevelRef {
  toString(): string;
}

function address(ref: LevelRef): LevelAddress {
  return { ...ref, toString: () => levelKey(ref) };
}

export interface Curriculum {
  readonly courses: readonly Course[];
  course(id: string): Course | undefined;
  topic(courseId: string, topicId: string): Topic | undefined;
  level(ref: LevelRef, from: string): Level | undefined;
  /** Как разложено по модулям: тема за темой, виток за витком. */
  readingOrder(courseId: string): LevelAddress[];
  /** По глубине: все темы на первом витке, потом все на втором. */
  spiralOrder(courseId: string): LevelAddress[];
  /** Свои цели плюс унаследованные, транзитивно, без повторов, снизу вверх. */
  objectivesOf(ref: LevelRef, from: string): string[];
  /** Кто ссылается на этот виток — обратные ссылки строятся один раз. */
  referencesTo(ref: LevelRef, from: string): LevelAddress[];
  isUnlocked(ref: LevelRef, from: string, done: ReadonlySet<string>): boolean;
  /** Чего не хватает, чтобы открыть виток. Это текст для читателя. */
  missingFor(ref: LevelRef, from: string, done: ReadonlySet<string>): LevelAddress[];
}

/* ── обход всех витков набора ───────────────────────────────────────── */

interface Placed {
  readonly course: Course;
  readonly topic: Topic;
  readonly level: Level;
}

function* everyLevel(courses: readonly Course[]): Generator<Placed> {
  for (const course of courses) {
    for (const topic of course.topics) {
      for (const level of topic.levels) yield { course, topic, level };
    }
  }
}

/** Все адреса, на которые ссылается виток: наследование плюс перекрёстные. */
function refsOf(level: Level): { field: 'inherits' | 'seeAlso'; index: number; raw: string }[] {
  const out: { field: 'inherits' | 'seeAlso'; index: number; raw: string }[] = [];
  level.inherits?.forEach((raw, index) => out.push({ field: 'inherits', index, raw }));
  level.seeAlso?.forEach((raw, index) => out.push({ field: 'seeAlso', index, raw }));
  return out;
}

/* ── проверка связности ─────────────────────────────────────────────── */

export function validateCurriculum(courses: readonly Course[]): Issue[] {
  const issues: Issue[] = [];
  const byId = new Map(courses.map((c) => [c.id, c]));

  for (const course of courses) {
    const topics = new Map(course.topics.map((t) => [t.id, t]));

    /* Модули задают порядок чтения, поэтому каждая тема обязана лежать ровно в
       одном модуле: ни в одном — недостижима, в двух — порядок перестаёт быть
       порядком. */
    const seen = new Map<string, string>();
    course.modules.forEach((module, mi) => {
      module.topicIds.forEach((topicId, ti) => {
        const at = `${course.id}.modules[${mi}].topicIds[${ti}]`;
        if (!topics.has(topicId)) {
          issues.push({ path: at, message: `темы "${topicId}" в курсе нет` });
          return;
        }
        const already = seen.get(topicId);
        if (already) {
          issues.push({
            path: at,
            message: `тема "${topicId}" стоит дважды: здесь и в модуле "${already}"`,
          });
        } else seen.set(topicId, module.id);
      });
    });

    for (const topic of course.topics) {
      if (!seen.has(topic.id)) {
        issues.push({
          path: `${course.id}.topics`,
          message: `тема "${topic.id}" не попала ни в один модуль — читатель до неё не дойдёт`,
        });
      }
    }

    /* Зависимости тем: существуют и не образуют кольца. */
    course.topics.forEach((topic, ti) => {
      topic.requires?.forEach((needed, ri) => {
        if (!topics.has(needed)) {
          issues.push({
            path: `${course.id}.topics[${ti}].requires[${ri}]`,
            message: `тема "${needed}" не существует`,
          });
        }
      });
    });

    const цикл = findCycle(course);
    if (цикл) {
      issues.push({
        path: `${course.id}.topics`,
        message: `кольцо зависимостей: ${цикл.join(' → ')}`,
      });
    }
  }

  /* Ссылки между витками — в том числе в соседний курс. */
  for (const { course, topic, level } of everyLevel(courses)) {
    const ti = course.topics.indexOf(topic);
    const li = topic.levels.indexOf(level);
    for (const { field, index, raw } of refsOf(level)) {
      const at = `${course.id}.topics[${ti}].levels[${li}].${field}[${index}]`;
      const ref = parseRef(raw)!; // форму проверила схема
      const target = byId.get(ref.course ?? course.id);
      if (!target) {
        issues.push({ path: at, message: `ссылка "${raw}" ведёт в никуда: курса "${ref.course}" нет` });
        continue;
      }
      const targetTopic = target.topics.find((t) => t.id === ref.topic);
      if (!targetTopic) {
        issues.push({ path: at, message: `ссылка "${raw}" ведёт в никуда: темы "${ref.topic}" нет` });
        continue;
      }
      if (!targetTopic.levels.some((l) => l.depth === ref.depth)) {
        issues.push({
          path: at,
          message: `ссылка "${raw}" ведёт в никуда: у темы "${ref.topic}" нет витка ${ref.depth}`,
        });
      }
      if (field === 'inherits' && (ref.course ?? course.id) === course.id && ref.topic === topic.id) {
        if (ref.depth >= level.depth) {
          issues.push({
            path: at,
            message: `виток наследует сам себя или более глубокий: "${raw}" из витка ${level.depth}`,
          });
        }
      }
    }
  }

  return issues;
}

/** Кольцо в зависимостях тем, если оно есть, — как список имён по кругу. */
function findCycle(course: Course): string[] | undefined {
  const deps = new Map(course.topics.map((t) => [t.id, t.requires ?? []]));
  const state = new Map<string, 'идём' | 'вышли'>();
  const stack: string[] = [];

  const walk = (id: string): string[] | undefined => {
    const s = state.get(id);
    if (s === 'вышли') return undefined;
    if (s === 'идём') return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, 'идём');
    stack.push(id);
    for (const next of deps.get(id) ?? []) {
      if (!deps.has(next)) continue; // о несуществующей уже сказано отдельно
      const found = walk(next);
      if (found) return found;
    }
    stack.pop();
    state.set(id, 'вышли');
    return undefined;
  };

  for (const topic of course.topics) {
    const found = walk(topic.id);
    if (found) return found;
  }
  return undefined;
}

/* ── читаемая модель ────────────────────────────────────────────────── */

export function curriculum(courses: readonly Course[]): Curriculum {
  const byId = new Map(courses.map((c) => [c.id, c]));

  /* Обратные ссылки строятся один раз: спрашивают их на каждой странице. */
  const backlinks = new Map<string, LevelAddress[]>();
  for (const { course, topic, level } of everyLevel(courses)) {
    for (const { raw } of refsOf(level)) {
      const ref = parseRef(raw);
      if (!ref) continue;
      const key = `${ref.course ?? course.id}/${ref.topic}:${ref.depth}`;
      const from = address({ topic: topic.id, depth: level.depth });
      (backlinks.get(key) ?? backlinks.set(key, []).get(key)!).push(from);
    }
  }

  const resolve = (ref: LevelRef, from: string) => {
    const course = byId.get(ref.course ?? from);
    const topic = course?.topics.find((t) => t.id === ref.topic);
    return { course, topic, level: topic?.levels.find((l) => l.depth === ref.depth) };
  };

  /* Порядок тем внутри одного витка спирали задают зависимости, а не порядок
     строк в файле: иначе спираль ломается от перестановки блоков. */
  const dependencyOrder = (course: Course): Topic[] => {
    const out: Topic[] = [];
    const done = new Set<string>();
    const byTopic = new Map(course.topics.map((t) => [t.id, t]));
    const visit = (topic: Topic, guard: Set<string>) => {
      if (done.has(topic.id) || guard.has(topic.id)) return;
      guard.add(topic.id);
      for (const needed of topic.requires ?? []) {
        const next = byTopic.get(needed);
        if (next) visit(next, guard);
      }
      guard.delete(topic.id);
      if (!done.has(topic.id)) {
        done.add(topic.id);
        out.push(topic);
      }
    };
    for (const module of course.modules) {
      for (const id of module.topicIds) {
        const topic = byTopic.get(id);
        if (topic) visit(topic, new Set());
      }
    }
    return out;
  };

  return {
    courses,
    course: (id) => byId.get(id),
    topic: (courseId, topicId) => byId.get(courseId)?.topics.find((t) => t.id === topicId),
    level: (ref, from) => resolve(ref, from).level,

    readingOrder(courseId) {
      const course = byId.get(courseId);
      if (!course) return [];
      const out: LevelAddress[] = [];
      for (const module of course.modules) {
        for (const topicId of module.topicIds) {
          const topic = course.topics.find((t) => t.id === topicId);
          if (!topic) continue;
          for (const level of topic.levels) out.push(address({ topic: topic.id, depth: level.depth }));
        }
      }
      return out;
    },

    spiralOrder(courseId) {
      const course = byId.get(courseId);
      if (!course) return [];
      const ordered = dependencyOrder(course);
      const deepest = Math.max(...ordered.map((t) => t.levels.length), 0);
      const out: LevelAddress[] = [];
      for (let depth = 1; depth <= deepest; depth += 1) {
        for (const topic of ordered) {
          if (topic.levels.some((l) => l.depth === depth)) {
            out.push(address({ topic: topic.id, depth }));
          }
        }
      }
      return out;
    },

    objectivesOf(ref, from) {
      const out: string[] = [];
      const seen = new Set<string>();
      const walk = (r: LevelRef, home: string) => {
        const key = `${r.course ?? home}/${r.topic}:${r.depth}`;
        if (seen.has(key)) return;
        seen.add(key);
        const found = resolve(r, home);
        if (!found.level) return;
        for (const raw of found.level.inherits ?? []) {
          const parsed = parseRef(raw);
          if (parsed) walk(parsed, r.course ?? home);
        }
        for (const objective of found.level.objectives) {
          if (!out.includes(objective)) out.push(objective);
        }
      };
      walk(ref, from);
      return out;
    },

    referencesTo(ref, from) {
      return backlinks.get(`${ref.course ?? from}/${ref.topic}:${ref.depth}`) ?? [];
    },

    isUnlocked(ref, from, done) {
      return this.missingFor(ref, from, done).length === 0;
    },

    missingFor(ref, from, done) {
      const { topic } = resolve(ref, from);
      if (!topic) return [];
      const missing: LevelAddress[] = [];
      /* Предыдущий виток той же темы: спираль идёт по кругу, а не прыжками. */
      if (ref.depth > 1 && !done.has(levelKey({ topic: ref.topic, depth: ref.depth - 1 }))) {
        missing.push(address({ topic: ref.topic, depth: ref.depth - 1 }));
      }
      /* Зависимости требуют только первой встречи с темой, а не всей глубины:
         иначе спираль вырождается в последовательное чтение. */
      for (const needed of topic.requires ?? []) {
        if (!done.has(levelKey({ topic: needed, depth: 1 }))) {
          missing.push(address({ topic: needed, depth: 1 }));
        }
      }
      return missing;
    },
  };
}
