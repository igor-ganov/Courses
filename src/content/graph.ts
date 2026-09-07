/**
 * The curriculum graph.
 *
 * Courses are authored as flat data; the graph is the read model over them. It
 * answers the questions the UI and the progress system ask: what does this level
 * inherit, what points at it, what is unlocked, what should I study next, and —
 * crucially for authoring — is this curriculum internally consistent?
 *
 * `validate()` is exercised against the real courses in the test suite, so a
 * broken cross-reference or a gap in the spiral fails CI, not the learner.
 */

import type { ValidationIssue } from '@/core/schema';
import {
  formatLevelRef,
  levelKey,
  parseLevelRef,
  type Course,
  type Module,
  type Reference,
  type Topic,
  type TopicLevel,
} from './model';

export interface ResolvedReference extends Reference {
  /** Canonical `course/topic@level` key, or null for external links. */
  key: string | null;
  title?: string;
  topicTitle?: string;
  courseTitle?: string;
  external: boolean;
  /** True when the reference points at content that does not exist. */
  broken: boolean;
}

export interface ResolvedInheritance {
  ownObjectives: string[];
  /** Objectives pulled in from ancestors, nearest ancestor first. */
  inheritedObjectives: string[];
  /** Ancestor level keys in breadth-first order. */
  ancestors: string[];
}

export interface LevelEntry {
  courseId: string;
  topicId: string;
  key: string;
  topic: Topic;
  level: TopicLevel;
}

export class CurriculumGraph {
  readonly courses: readonly Course[];
  private levels = new Map<string, LevelEntry>();
  private topics = new Map<string, Topic>();
  private courseById = new Map<string, Course>();
  private incoming = new Map<string, { from: string; ref: Reference }[]>();

  constructor(courses: readonly Course[]) {
    this.courses = courses;
    for (const course of courses) {
      if (!this.courseById.has(course.id)) this.courseById.set(course.id, course);
      for (const topic of course.topics) {
        this.topics.set(`${course.id}/${topic.id}`, topic);
        for (const level of topic.levels) {
          const key = levelKey(course.id, topic.id, level.level);
          this.levels.set(key, { courseId: course.id, topicId: topic.id, key, topic, level });
        }
      }
    }
    this.indexBackReferences();
  }

  // -- lookups --------------------------------------------------------------

  course(courseId: string): Course | undefined {
    return this.courseById.get(courseId);
  }

  topic(courseId: string, topicId: string): Topic | undefined {
    return this.topics.get(`${courseId}/${topicId}`);
  }

  entry(key: string): LevelEntry | undefined {
    return this.levels.get(key);
  }

  level(key: string): TopicLevel | undefined {
    return this.levels.get(key)?.level;
  }

  allLevelKeys(): string[] {
    return [...this.levels.keys()];
  }

  modulesOf(courseId: string): Module[] {
    return this.courseById.get(courseId)?.modules ?? [];
  }

  topicsOfModule(courseId: string, moduleId: string): Topic[] {
    const module = this.modulesOf(courseId).find((m) => m.id === moduleId);
    if (!module) return [];
    return module.topicIds
      .map((id) => this.topic(courseId, id))
      .filter((t): t is Topic => Boolean(t));
  }

  moduleOfTopic(courseId: string, topicId: string): Module | undefined {
    return this.modulesOf(courseId).find((m) => m.topicIds.includes(topicId));
  }

  /** Resolve a raw reference target against a level's home course. */
  resolveTarget(target: string, homeCourseId: string): string | null {
    const parsed = parseLevelRef(target);
    if (!parsed) return null;
    return formatLevelRef({ ...parsed, courseId: parsed.courseId ?? homeCourseId });
  }

  // -- spiral inheritance ---------------------------------------------------

  /**
   * Walk the `inherits` chain breadth-first. Nearest ancestors come first so a
   * recap reads from "what you just learned" back to first principles.
   */
  resolveInheritance(key: string): ResolvedInheritance {
    const entry = this.levels.get(key);
    if (!entry) return { ownObjectives: [], inheritedObjectives: [], ancestors: [] };

    const ancestors: string[] = [];
    const seen = new Set<string>([key]);
    let frontier = this.inheritedKeys(entry);

    while (frontier.length) {
      const next: string[] = [];
      for (const ancestorKey of frontier) {
        if (seen.has(ancestorKey)) continue;
        seen.add(ancestorKey);
        const ancestor = this.levels.get(ancestorKey);
        if (!ancestor) continue;
        ancestors.push(ancestorKey);
        next.push(...this.inheritedKeys(ancestor));
      }
      frontier = next;
    }

    const inheritedObjectives: string[] = [];
    for (const ancestorKey of ancestors) {
      for (const objective of this.levels.get(ancestorKey)?.level.objectives ?? []) {
        if (!entry.level.objectives.includes(objective) && !inheritedObjectives.includes(objective)) {
          inheritedObjectives.push(objective);
        }
      }
    }

    return { ownObjectives: [...entry.level.objectives], inheritedObjectives, ancestors };
  }

  private inheritedKeys(entry: LevelEntry): string[] {
    return (entry.level.inherits ?? [])
      .map((target) => this.resolveTarget(target, entry.courseId))
      .filter((k): k is string => Boolean(k));
  }

  // -- references -----------------------------------------------------------

  resolveReferences(key: string): ResolvedReference[] {
    const entry = this.levels.get(key);
    if (!entry) return [];
    return (entry.level.references ?? []).map((ref) => this.resolveReference(ref, entry.courseId));
  }

  private resolveReference(ref: Reference, homeCourseId: string): ResolvedReference {
    const resolved = this.resolveTarget(ref.target, homeCourseId);
    if (!resolved) {
      return { ...ref, key: null, external: true, broken: ref.kind !== 'external' };
    }
    const target = this.levels.get(resolved);
    return {
      ...ref,
      key: resolved,
      external: false,
      broken: !target,
      title: target?.level.title,
      topicTitle: target?.topic.title,
      courseTitle: target ? this.courseById.get(target.courseId)?.title : undefined,
    };
  }

  private indexBackReferences(): void {
    for (const entry of this.levels.values()) {
      for (const ref of entry.level.references ?? []) {
        const resolved = this.resolveTarget(ref.target, entry.courseId);
        if (!resolved) continue;
        const list = this.incoming.get(resolved) ?? [];
        list.push({ from: entry.key, ref });
        this.incoming.set(resolved, list);
      }
    }
  }

  /** Levels that point at `key` — "you will meet this idea again in ...". */
  backReferences(key: string): { from: string; ref: Reference; title: string }[] {
    return (this.incoming.get(key) ?? []).map(({ from, ref }) => ({
      from,
      ref,
      title: this.levels.get(from)?.level.title ?? from,
    }));
  }

  // -- ordering and gating --------------------------------------------------

  /**
   * Topic ids of a course ordered so that prerequisites precede dependants;
   * ties keep the authored module order. Cycles are broken deterministically so
   * the UI still renders while `validate()` reports the problem.
   */
  topologicalTopics(courseId: string): string[] {
    const ordered: string[] = [];
    for (const module of this.modulesOf(courseId)) {
      for (const topicId of module.topicIds) if (!ordered.includes(topicId)) ordered.push(topicId);
    }

    const result: string[] = [];
    const state = new Map<string, 'visiting' | 'done'>();

    const visit = (topicId: string) => {
      if (state.get(topicId) === 'done' || state.get(topicId) === 'visiting') return;
      state.set(topicId, 'visiting');
      for (const prereq of this.topic(courseId, topicId)?.prerequisites ?? []) {
        if (ordered.includes(prereq)) visit(prereq);
      }
      state.set(topicId, 'done');
      result.push(topicId);
    };

    for (const topicId of ordered) visit(topicId);
    return result;
  }

  /**
   * The spiral: all level-1 passes across the course, then all level-2 passes,
   * and so on. Depth comes after breadth, which is the whole point of spiral
   * design — you meet every idea once before any idea gets hard.
   */
  spiralPath(courseId: string): string[] {
    const topicOrder = this.topologicalTopics(courseId);
    const maxLevel = Math.max(
      0,
      ...topicOrder.map((id) => this.topic(courseId, id)?.levels.length ?? 0),
    );
    const path: string[] = [];
    for (let depth = 1; depth <= maxLevel; depth += 1) {
      for (const topicId of topicOrder) {
        const key = levelKey(courseId, topicId, depth);
        if (this.levels.has(key)) path.push(key);
      }
    }
    return path;
  }

  /**
   * A level is available once the previous level of the same topic is done and
   * every prerequisite topic has been opened at the same depth or shallower.
   */
  isUnlocked(key: string, completed: ReadonlySet<string>): boolean {
    const entry = this.levels.get(key);
    if (!entry) return false;

    if (entry.level.level > 1) {
      const previous = levelKey(entry.courseId, entry.topicId, entry.level.level - 1);
      if (!completed.has(previous)) return false;
    }

    for (const prereq of entry.topic.prerequisites ?? []) {
      const prereqKey = levelKey(entry.courseId, prereq, entry.level.level);
      const fallback = levelKey(entry.courseId, prereq, 1);
      if (!completed.has(prereqKey) && !completed.has(fallback)) return false;
    }
    return true;
  }

  /** First unlocked, not-yet-completed level along the spiral path. */
  nextLevel(courseId: string, completed: ReadonlySet<string>): string | null {
    for (const key of this.spiralPath(courseId)) {
      if (!completed.has(key) && this.isUnlocked(key, completed)) return key;
    }
    return null;
  }

  // -- integrity ------------------------------------------------------------

  validate(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const seenCourses = new Set<string>();

    for (const course of this.courses) {
      if (seenCourses.has(course.id)) {
        issues.push({ path: course.id, message: `duplicate course id "${course.id}"`, code: 'custom' });
        continue;
      }
      seenCourses.add(course.id);

      const topicIds = new Set(course.topics.map((t) => t.id));
      const referenced = new Set<string>();

      for (const module of course.modules) {
        for (const topicId of module.topicIds) {
          referenced.add(topicId);
          if (!topicIds.has(topicId)) {
            issues.push({
              path: `${course.id}.${module.id}`,
              message: `module references missing topic "${topicId}"`,
              code: 'custom',
            });
          }
        }
      }

      for (const topic of course.topics) {
        if (!referenced.has(topic.id)) {
          issues.push({
            path: `${course.id}.${topic.id}`,
            message: `topic "${topic.id}" is not referenced by any module`,
            code: 'custom',
          });
        }

        const numbers = topic.levels.map((l) => l.level);
        const expected = numbers.map((_, index) => index + 1);
        if (JSON.stringify([...numbers].sort((a, b) => a - b)) !== JSON.stringify(expected)) {
          issues.push({
            path: `${course.id}.${topic.id}`,
            message: `levels must be contiguous starting at 1, got [${numbers.join(', ')}]`,
            code: 'custom',
          });
        }

        for (const prereq of topic.prerequisites ?? []) {
          if (!topicIds.has(prereq)) {
            issues.push({
              path: `${course.id}.${topic.id}`,
              message: `prerequisite "${prereq}" is not a topic of this course`,
              code: 'custom',
            });
          }
        }

        for (const level of topic.levels) {
          const key = levelKey(course.id, topic.id, level.level);
          for (const target of level.inherits ?? []) {
            const resolved = this.resolveTarget(target, course.id);
            if (!resolved || !this.levels.has(resolved)) {
              issues.push({
                path: key,
                message: `inherits from missing level "${target}"`,
                code: 'custom',
              });
            }
          }
          for (const ref of level.references ?? []) {
            if (ref.kind === 'external') {
              if (!/^https?:\/\//.test(ref.target)) {
                issues.push({
                  path: key,
                  message: `external reference must be a URL, got "${ref.target}"`,
                  code: 'custom',
                });
              }
              continue;
            }
            const resolved = this.resolveTarget(ref.target, course.id);
            if (!resolved || !this.levels.has(resolved)) {
              issues.push({
                path: key,
                message: `reference points at missing level "${ref.target}"`,
                code: 'custom',
              });
            }
          }
        }
      }

      issues.push(...this.findPrerequisiteCycles(course));
    }

    issues.push(...this.findInheritanceCycles());
    return issues;
  }

  private findPrerequisiteCycles(course: Course): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const state = new Map<string, 'visiting' | 'done'>();

    const visit = (topicId: string, trail: string[]): void => {
      if (state.get(topicId) === 'done') return;
      if (state.get(topicId) === 'visiting') {
        issues.push({
          path: `${course.id}.${topicId}`,
          message: `prerequisite cycle: ${[...trail, topicId].join(' → ')}`,
          code: 'custom',
        });
        return;
      }
      state.set(topicId, 'visiting');
      for (const prereq of course.topics.find((t) => t.id === topicId)?.prerequisites ?? []) {
        visit(prereq, [...trail, topicId]);
      }
      state.set(topicId, 'done');
    };

    for (const topic of course.topics) visit(topic.id, []);
    return issues;
  }

  private findInheritanceCycles(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const state = new Map<string, 'visiting' | 'done'>();

    const visit = (key: string, trail: string[]): void => {
      if (state.get(key) === 'done') return;
      if (state.get(key) === 'visiting') {
        issues.push({
          path: key,
          message: `inheritance cycle: ${[...trail, key].join(' → ')}`,
          code: 'custom',
        });
        return;
      }
      state.set(key, 'visiting');
      const entry = this.levels.get(key);
      if (entry) for (const next of this.inheritedKeys(entry)) visit(next, [...trail, key]);
      state.set(key, 'done');
    };

    for (const key of this.levels.keys()) visit(key, []);
    return issues;
  }
}
