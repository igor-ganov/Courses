/**
 * The content test suite.
 *
 * This is the safety net that makes authoring courses as code worthwhile: every
 * block's props are validated against its schema, every cross-reference must
 * resolve, every question must be gradable, and the spiral must actually be a
 * spiral. A typo in a lecture fails CI rather than the learner.
 */

import { describe, expect, it } from 'vitest';
import { CurriculumGraph } from '@/content/graph';
import { createBlockRegistry } from '@/content/blocks';
import { courseSchema, levelKey, type Question } from '@/content/model';
import { QuestionRegistry, gradeAssessment, standardQuestionTypes } from '@/engine/assessment';
import { formatIssues } from '@/core/schema';
import { courses } from './index';

const graph = new CurriculumGraph(courses);
const blocks = createBlockRegistry();
const questions = new QuestionRegistry().registerAll(standardQuestionTypes);

const allLevels = courses.flatMap((course) =>
  course.topics.flatMap((topic) =>
    topic.levels.map((level) => ({ course, topic, level, key: levelKey(course.id, topic.id, level.level) })),
  ),
);

describe('course data conforms to the schema', () => {
  it.each(courses.map((course) => [course.id, course] as const))('%s parses', (_id, course) => {
    const parsed = courseSchema.parse(course, course.id);
    if (!parsed.ok) throw new Error(`\n${formatIssues(parsed.errors)}`);
    expect(parsed.ok).toBe(true);
  });
});

describe('curriculum graph integrity', () => {
  it('has no dangling references, cycles or orphan topics', () => {
    const issues = graph.validate();
    if (issues.length > 0) throw new Error(`\n${formatIssues(issues)}`);
    expect(issues).toEqual([]);
  });

  it('gives every course a walkable spiral path that covers all its levels', () => {
    for (const course of courses) {
      const path = graph.spiralPath(course.id);
      const expected = course.topics.reduce((sum, topic) => sum + topic.levels.length, 0);
      expect(path).toHaveLength(expected);
      expect(new Set(path).size).toBe(expected);
    }
  });

  it('orders the spiral breadth-first: no level 2 before every level 1', () => {
    for (const course of courses) {
      const path = graph.spiralPath(course.id);
      const depths = path.map((key) => Number(key.split('@')[1]));
      expect(depths).toEqual([...depths].sort((a, b) => a - b));
    }
  });

  it('can be walked from start to finish with the unlock rules', () => {
    for (const course of courses) {
      const completed = new Set<string>();
      let steps = 0;
      let next = graph.nextLevel(course.id, completed);
      while (next && steps < 500) {
        completed.add(next);
        steps += 1;
        next = graph.nextLevel(course.id, completed);
      }
      // Every level must be reachable: no level may be gated behind itself.
      expect(completed.size).toBe(graph.spiralPath(course.id).length);
    }
  });

  it('resolves every inherited level to real content', () => {
    for (const { key, level } of allLevels) {
      for (const target of level.inherits ?? []) {
        const resolved = graph.resolveTarget(target, key.split('/')[0]);
        expect(graph.entry(resolved ?? ''), `${key} inherits ${target}`).toBeDefined();
      }
    }
  });
});

describe('every lecture renders as valid blocks', () => {
  it.each(allLevels.map((entry) => [entry.key, entry] as const))('%s', (key, { level }) => {
    const issues = blocks.validateTree(level.lecture.blocks);
    if (issues.length > 0) throw new Error(`${key}:\n${formatIssues(issues)}`);
    expect(issues).toEqual([]);
  });
});

describe('assessments are gradable', () => {
  const withAssessment = allLevels.filter((entry) => entry.level.assessment);

  it('every level ships an assessment', () => {
    expect(withAssessment.length).toBe(
      allLevels.length - allLevels.filter((entry) => !entry.level.assessment).length,
    );
    // Every level in this course is expected to end with a check.
    expect(allLevels.filter((entry) => !entry.level.assessment)).toEqual([]);
  });

  it.each(withAssessment.map((entry) => [entry.key, entry] as const))(
    '%s uses known question types with valid props',
    (key, { level }) => {
      for (const question of level.assessment!.questions) {
        expect(questions.has(question.type), `${key}/${question.id}: unknown type "${question.type}"`).toBe(true);
        const props = questions.propsFor(question);
        expect(props, `${key}/${question.id}: invalid props`).not.toBeNull();
      }
    },
  );

  it('scores zero for an empty submission and one for the authored answers', () => {
    for (const { key, level } of withAssessment) {
      const assessment = level.assessment!;
      const empty = gradeAssessment(assessment, {}, questions);
      expect(empty.ratio, `${key} should not pass with no answers`).toBe(0);

      const perfect = gradeAssessment(assessment, correctAnswersFor(assessment.questions), questions);
      expect(perfect.ratio, `${key} authored answers should be fully correct`).toBeCloseTo(1);
      expect(perfect.passed).toBe(true);
    }
  });

  it('has unique question ids inside every assessment', () => {
    for (const { key, level } of withAssessment) {
      const ids = level.assessment!.questions.map((q) => q.id);
      expect(new Set(ids).size, `${key} has duplicate question ids`).toBe(ids.length);
    }
  });

  it('never offers a choice question whose correct index is out of range', () => {
    for (const { key, level } of withAssessment) {
      for (const question of level.assessment!.questions) {
        const props = questions.propsFor(question) as any;
        if (question.type === 'choice.single') {
          expect(props.correct, `${key}/${question.id}`).toBeLessThan(props.options.length);
        }
        if (question.type === 'choice.multi') {
          for (const index of props.correct) {
            expect(index, `${key}/${question.id}`).toBeLessThan(props.options.length);
          }
        }
      }
    }
  });

  it('never repeats an option inside one question', () => {
    for (const { key, level } of withAssessment) {
      for (const question of level.assessment!.questions) {
        const props = questions.propsFor(question) as any;
        if (props?.options) {
          expect(new Set(props.options).size, `${key}/${question.id} repeats an option`).toBe(props.options.length);
        }
        if (props?.pairs) {
          const rights = props.pairs.map((p: { right: string }) => p.right);
          expect(new Set(rights).size, `${key}/${question.id} repeats a right-hand item`).toBe(rights.length);
        }
      }
    }
  });
});

describe('editorial standards', () => {
  it('gives every level objectives, a summary and an estimate', () => {
    for (const { key, level } of allLevels) {
      expect(level.objectives.length, `${key} has too few objectives`).toBeGreaterThanOrEqual(3);
      expect(level.summary.length, `${key} summary is too short`).toBeGreaterThan(60);
      expect(level.estimatedMinutes, `${key} has no time estimate`).toBeGreaterThan(0);
    }
  });

  it('writes real lectures, not a paragraph and a quiz', () => {
    for (const { key, level } of allLevels) {
      const textLength = measureProse(level.lecture.blocks);
      expect(textLength, `${key} is too thin (${textLength} characters of prose)`).toBeGreaterThan(3500);
    }
  });

  it('puts at least one interactive block in every level', () => {
    for (const { key, level } of allLevels) {
      const interactive = countByCategory(level.lecture.blocks, ['simulation', 'game', 'three-d', 'diagram']);
      expect(interactive, `${key} has no interactive block`).toBeGreaterThanOrEqual(1);
    }
  });

  it('estimates study time close to the sum of its blocks', () => {
    for (const { key, level } of allLevels) {
      const computed = blocks.estimateMinutes(level.lecture.blocks);
      expect(computed, `${key} block cost is implausible`).toBeGreaterThan(5);
      expect(level.estimatedMinutes!, `${key} estimate is far below its blocks`).toBeGreaterThan(computed * 0.4);
    }
  });

  it('deepens: every level above the first inherits something', () => {
    for (const { key, level } of allLevels) {
      if (level.level > 1) {
        expect(level.inherits?.length ?? 0, `${key} does not inherit anything`).toBeGreaterThan(0);
      }
    }
  });

  it('cross-links: at least half the levels reference other levels', () => {
    const withRefs = allLevels.filter((entry) => (entry.level.references?.length ?? 0) > 0);
    expect(withRefs.length / allLevels.length).toBeGreaterThan(0.5);
  });

  it('uses a broad slice of the block library rather than three block types', () => {
    const used = new Set<string>();
    for (const { level } of allLevels) collectTypes(level.lecture.blocks, used);
    expect(used.size).toBeGreaterThanOrEqual(14);
  });

  it('exercises every interactive widget somewhere in the course', () => {
    const used = new Set<string>();
    for (const { level } of allLevels) {
      collectTypes(level.lecture.blocks, used);
      for (const question of level.assessment?.questions ?? []) {
        if (question.type === 'goal') used.add(String((question.props as any)?.widget));
      }
    }
    const interactive = blocks
      .list()
      .filter((d) => ['simulation', 'game', 'three-d', 'diagram'].includes(d.category))
      .map((d) => d.type);
    const unused = interactive.filter((type) => !used.has(type));
    expect(unused, `interactive blocks never used: ${unused.join(', ')}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

/** Build the answer key from the authored questions, for the "perfect run" test. */
function correctAnswersFor(questions_: readonly Question[]): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  for (const question of questions_) {
    const props = questions.propsFor(question) as any;
    switch (question.type) {
      case 'choice.single':
        answers[question.id] = props.correct;
        break;
      case 'choice.multi':
        answers[question.id] = props.correct;
        break;
      case 'numeric':
        answers[question.id] = props.answer;
        break;
      case 'order':
        answers[question.id] = props.items.map((_: string, index: number) => index);
        break;
      case 'match':
        answers[question.id] = Object.fromEntries(props.pairs.map((_: unknown, index: number) => [String(index), index]));
        break;
      case 'text.short':
        answers[question.id] = props.accept[0];
        break;
      case 'goal':
        answers[question.id] = { score: 1 };
        break;
      default:
        break;
    }
  }
  return answers;
}

function measureProse(nodes: readonly { type: string; props?: any; children?: any[] }[]): number {
  let total = 0;
  for (const node of nodes) {
    for (const value of Object.values(node.props ?? {})) total += lengthOf(value);
    if (node.children) total += measureProse(node.children);
  }
  return total;
}

function lengthOf(value: unknown): number {
  if (typeof value === 'string') return value.length;
  if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + lengthOf(item), 0);
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((sum: number, item) => sum + lengthOf(item), 0);
  }
  return 0;
}

function countByCategory(nodes: readonly { type: string; children?: any[] }[], categories: string[]): number {
  let count = 0;
  for (const node of nodes) {
    const definition = blocks.get(node.type);
    if (definition && categories.includes(definition.category)) count += 1;
    if (node.children) count += countByCategory(node.children, categories);
  }
  return count;
}

function collectTypes(nodes: readonly { type: string; children?: any[] }[], into: Set<string>): void {
  for (const node of nodes) {
    into.add(node.type);
    if (node.children) collectTypes(node.children, into);
  }
}
