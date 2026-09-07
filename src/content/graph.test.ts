import { describe, expect, it } from 'vitest';
import { CurriculumGraph } from './graph';
import type { Course, Topic, TopicLevel } from './model';

const lecture = (id: string) => ({ id, blocks: [{ id: `${id}-b1`, type: 'prose', props: { text: 'x' } }] });

const level = (n: number, over: Partial<TopicLevel> = {}): TopicLevel => ({
  level: n,
  title: `L${n}`,
  summary: 'summary',
  objectives: [`objective ${n}`],
  lecture: lecture(`lec-${n}-${Math.random().toString(36).slice(2, 7)}`),
  ...over,
});

const topic = (id: string, over: Partial<Topic> = {}): Topic => ({
  id,
  title: id,
  tagline: 'tagline',
  levels: [level(1)],
  ...over,
});

const course = (over: Partial<Course> = {}): Course => ({
  id: 'cyb',
  title: 'Кибернетика',
  subtitle: 'sub',
  description: 'desc',
  modules: [{ id: 'm1', title: 'M1', description: 'd', topicIds: ['feedback', 'variety'] }],
  topics: [topic('feedback'), topic('variety', { prerequisites: ['feedback'] })],
  ...over,
});

describe('CurriculumGraph indexing', () => {
  it('indexes topics and levels by key', () => {
    const graph = new CurriculumGraph([course()]);
    expect(graph.topic('cyb', 'feedback')?.title).toBe('feedback');
    expect(graph.level('cyb/feedback@1')?.title).toBe('L1');
    expect(graph.level('cyb/feedback@9')).toBeUndefined();
  });

  it('lists courses and the modules of a course in authored order', () => {
    const graph = new CurriculumGraph([course()]);
    expect(graph.courses.map((c) => c.id)).toEqual(['cyb']);
    expect(graph.modulesOf('cyb').map((m) => m.id)).toEqual(['m1']);
    expect(graph.topicsOfModule('cyb', 'm1').map((t) => t.id)).toEqual(['feedback', 'variety']);
  });

  it('reports which module a topic belongs to', () => {
    const graph = new CurriculumGraph([course()]);
    expect(graph.moduleOfTopic('cyb', 'variety')?.id).toBe('m1');
  });
});

describe('spiral inheritance', () => {
  const spiral = course({
    topics: [
      topic('feedback', {
        levels: [
          level(1, { objectives: ['loop basics'] }),
          level(2, { inherits: ['feedback@1'], objectives: ['gain and delay'] }),
          level(3, { inherits: ['feedback@2', 'variety@1'], objectives: ['stability margins'] }),
        ],
      }),
      topic('variety', { levels: [level(1, { objectives: ['count states'] })] }),
    ],
    modules: [{ id: 'm1', title: 'M1', description: 'd', topicIds: ['feedback', 'variety'] }],
  });

  it('resolves inherited objectives transitively, nearest first, without duplicates', () => {
    const graph = new CurriculumGraph([spiral]);
    const resolved = graph.resolveInheritance('cyb/feedback@3');
    expect(resolved.ownObjectives).toEqual(['stability margins']);
    expect(resolved.inheritedObjectives).toEqual(['gain and delay', 'count states', 'loop basics']);
    expect(resolved.ancestors).toEqual(['cyb/feedback@2', 'cyb/variety@1', 'cyb/feedback@1']);
  });

  it('survives a cycle in the inheritance chain instead of hanging', () => {
    const cyclic = course({
      topics: [
        topic('a', { levels: [level(1, { inherits: ['b@1'] })] }),
        topic('b', { levels: [level(1, { inherits: ['a@1'] })] }),
      ],
      modules: [{ id: 'm1', title: 'M', description: 'd', topicIds: ['a', 'b'] }],
    });
    const graph = new CurriculumGraph([cyclic]);
    expect(graph.resolveInheritance('cyb/a@1').ancestors).toEqual(['cyb/b@1']);
    expect(graph.validate().some((i) => /cycle/i.test(i.message))).toBe(true);
  });
});

describe('reference resolution', () => {
  it('resolves same-course and cross-course targets', () => {
    const second: Course = {
      ...course(),
      id: 'control',
      modules: [{ id: 'm', title: 'M', description: 'd', topicIds: ['pid'] }],
      topics: [topic('pid')],
    };
    const first = course({
      topics: [
        topic('feedback', {
          levels: [
            level(1, {
              references: [
                { kind: 'foreshadows', target: 'control/pid@1' },
                { kind: 'seeAlso', target: 'variety@1' },
                { kind: 'external', target: 'https://example.org/ashby' },
              ],
            }),
          ],
        }),
        topic('variety'),
      ],
    });
    const graph = new CurriculumGraph([first, second]);
    const refs = graph.resolveReferences('cyb/feedback@1');
    expect(refs.map((r) => r.key)).toEqual(['control/pid@1', 'cyb/variety@1', null]);
    expect(refs[1].title).toBe('L1');
    expect(refs[2].external).toBe(true);
  });

  it('flags a dangling internal reference during validation', () => {
    const broken = course({
      topics: [
        topic('feedback', { levels: [level(1, { references: [{ kind: 'prereq', target: 'ghost@1' }] })] }),
        topic('variety'),
      ],
    });
    const issues = new CurriculumGraph([broken]).validate();
    expect(issues.some((i) => i.message.includes('ghost@1'))).toBe(true);
  });

  it('lists back-references so a topic knows who points at it', () => {
    const withRefs = course({
      topics: [
        topic('feedback', { levels: [level(1, { references: [{ kind: 'deepens', target: 'variety@1' }] })] }),
        topic('variety'),
      ],
    });
    const graph = new CurriculumGraph([withRefs]);
    expect(graph.backReferences('cyb/variety@1').map((r) => r.from)).toEqual(['cyb/feedback@1']);
  });
});

describe('validation of curriculum integrity', () => {
  it('accepts a well-formed course', () => {
    expect(new CurriculumGraph([course()]).validate()).toEqual([]);
  });

  it('rejects duplicate course ids', () => {
    const issues = new CurriculumGraph([course(), course()]).validate();
    expect(issues.some((i) => /duplicate course/i.test(i.message))).toBe(true);
  });

  it('rejects a module pointing at a missing topic', () => {
    const issues = new CurriculumGraph([
      course({ modules: [{ id: 'm1', title: 'M', description: 'd', topicIds: ['nope'] }] }),
    ]).validate();
    expect(issues.some((i) => i.message.includes('nope'))).toBe(true);
  });

  it('rejects a topic that is in no module', () => {
    const issues = new CurriculumGraph([
      course({ modules: [{ id: 'm1', title: 'M', description: 'd', topicIds: ['feedback'] }] }),
    ]).validate();
    expect(issues.some((i) => /not referenced by any module/.test(i.message))).toBe(true);
  });

  it('rejects non-contiguous level numbering', () => {
    const issues = new CurriculumGraph([
      course({
        topics: [topic('feedback', { levels: [level(1), level(3)] }), topic('variety')],
      }),
    ]).validate();
    expect(issues.some((i) => /contiguous/.test(i.message))).toBe(true);
  });

  it('detects a cycle in topic prerequisites', () => {
    const issues = new CurriculumGraph([
      course({
        topics: [
          topic('feedback', { prerequisites: ['variety'] }),
          topic('variety', { prerequisites: ['feedback'] }),
        ],
      }),
    ]).validate();
    expect(issues.some((i) => /cycle/i.test(i.message))).toBe(true);
  });
});

describe('learning path', () => {
  const wide = course({
    modules: [
      { id: 'm1', title: 'M1', description: 'd', topicIds: ['feedback'] },
      { id: 'm2', title: 'M2', description: 'd', topicIds: ['variety'] },
    ],
    topics: [
      topic('feedback', { levels: [level(1), level(2)] }),
      topic('variety', { prerequisites: ['feedback'], levels: [level(1), level(2)] }),
    ],
  });

  it('walks the spiral: every level 1 before any level 2', () => {
    const graph = new CurriculumGraph([wide]);
    expect(graph.spiralPath('cyb')).toEqual([
      'cyb/feedback@1',
      'cyb/variety@1',
      'cyb/feedback@2',
      'cyb/variety@2',
    ]);
  });

  it('orders topics so prerequisites come first', () => {
    const graph = new CurriculumGraph([wide]);
    expect(graph.topologicalTopics('cyb')).toEqual(['feedback', 'variety']);
  });

  it('gates a level behind its prerequisites and its own previous level', () => {
    const graph = new CurriculumGraph([wide]);
    const done = new Set<string>();
    expect(graph.isUnlocked('cyb/feedback@1', done)).toBe(true);
    expect(graph.isUnlocked('cyb/feedback@2', done)).toBe(false);
    expect(graph.isUnlocked('cyb/variety@1', done)).toBe(false);

    done.add('cyb/feedback@1');
    expect(graph.isUnlocked('cyb/feedback@2', done)).toBe(true);
    expect(graph.isUnlocked('cyb/variety@1', done)).toBe(true);
  });

  it('suggests the next level to study', () => {
    const graph = new CurriculumGraph([wide]);
    expect(graph.nextLevel('cyb', new Set())).toBe('cyb/feedback@1');
    expect(graph.nextLevel('cyb', new Set(['cyb/feedback@1']))).toBe('cyb/variety@1');
    const all = new Set(graph.spiralPath('cyb'));
    expect(graph.nextLevel('cyb', all)).toBeNull();
  });
});
