/**
 * The content model.
 *
 * Everything a learner sees is described by these structures, which are plain
 * serialisable data. Nothing here knows about React: rendering is the job of the
 * block registry, which maps a block's `type` to a component. That split is what
 * makes the platform extensible — a new interactive simulation is a new block
 * definition plus a `type` string in a course file, with no changes to the
 * engine, the router, the progress system or the UI shell.
 *
 * Curriculum shape (spiral learning):
 *
 *   Course
 *    └─ Module            thematic grouping, ordered
 *        └─ Topic         a concept, e.g. "feedback"
 *            └─ Level     the same concept revisited deeper: 1 → 2 → 3
 *                └─ Lecture (blocks) + Assessment (questions)
 *
 * A level may `inherits` from other levels — its own earlier levels, or levels
 * of related topics, possibly in other courses. The graph resolves that chain so
 * a deep level automatically carries the objectives it builds on and can render
 * a recap of where the learner has been.
 */

import { s, type Infer } from '@/core/schema';

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

/** A node in a lecture tree. `type` is resolved through the block registry. */
export interface BlockNode {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: BlockNode[];
}

export const blockNodeSchema: import('@/core/schema').Schema<BlockNode> = s.lazy(() =>
  s.object({
    id: s.string({ min: 1, pattern: /^[a-z0-9][a-z0-9._-]*$/i }),
    type: s.string({ min: 1 }),
    props: s.optional(s.record(s.unknown())),
    children: s.optional(s.array(blockNodeSchema)),
  }),
) as import('@/core/schema').Schema<BlockNode>;

export type BlockCategory =
  | 'text'
  | 'media'
  | 'diagram'
  | 'simulation'
  | 'game'
  | 'three-d'
  | 'assessment'
  | 'layout'
  | 'meta';

// ---------------------------------------------------------------------------
// Cross-references
// ---------------------------------------------------------------------------

export type ReferenceKind =
  /** Must be understood first. */
  | 'prereq'
  /** This level goes deeper into the target. */
  | 'deepens'
  /** Related, read whenever. */
  | 'seeAlso'
  /** Comes later in the curriculum; a teaser. */
  | 'foreshadows'
  /** Outside the platform: a book, a paper, a video. */
  | 'external';

export interface Reference {
  kind: ReferenceKind;
  /**
   * `topicId@level`, `courseId/topicId@level`, or a URL when kind is
   * `external`. Internal targets are checked by the curriculum graph, so a
   * dangling reference fails the test suite rather than the learner.
   */
  target: string;
  label?: string;
  note?: string;
}

export const referenceSchema = s.object({
  kind: s.enum(['prereq', 'deepens', 'seeAlso', 'foreshadows', 'external'] as const),
  target: s.string({ min: 1 }),
  label: s.optional(s.string()),
  note: s.optional(s.string()),
});

/** A parsed pointer at one level of one topic. */
export interface LevelRef {
  courseId?: string;
  topicId: string;
  level: number;
}

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

/**
 * A question is, like a block, an open-typed record: `type` selects a grader
 * from the question registry, so new interaction styles (drag-to-order, wire up
 * a control loop, hit a target in a simulation) plug in the same way.
 */
export interface Question {
  id: string;
  type: string;
  prompt: string;
  /** Shown after answering, whether right or wrong; the teaching moment. */
  explanation?: string;
  /** Rough difficulty 1..3, used to weight mastery. */
  difficulty?: number;
  hint?: string;
  props?: Record<string, unknown>;
  /** Concepts this question probes; drives the skill radar. */
  concepts?: string[];
}

export const questionSchema = s.object({
  id: s.string({ min: 1 }),
  type: s.string({ min: 1 }),
  prompt: s.string({ min: 1 }),
  explanation: s.optional(s.string()),
  difficulty: s.optional(s.number({ min: 1, max: 3, int: true })),
  hint: s.optional(s.string()),
  props: s.optional(s.record(s.unknown())),
  concepts: s.optional(s.array(s.string())),
});

export interface Assessment {
  id: string;
  title?: string;
  /** Fraction of the total score needed to count the level as passed. */
  passingScore?: number;
  questions: Question[];
}

export const assessmentSchema = s.object({
  id: s.string({ min: 1 }),
  title: s.optional(s.string()),
  passingScore: s.optional(s.number({ min: 0, max: 1 })),
  questions: s.array(questionSchema, { min: 1 }),
});

// ---------------------------------------------------------------------------
// Lecture / Topic / Module / Course
// ---------------------------------------------------------------------------

export interface Lecture {
  id: string;
  blocks: BlockNode[];
}

export const lectureSchema = s.object({
  id: s.string({ min: 1 }),
  blocks: s.array(blockNodeSchema, { min: 1 }),
});

export interface TopicLevel {
  /** 1 = first pass, 2 = second turn of the spiral, ... */
  level: number;
  title: string;
  /** One-paragraph promise of what this turn of the spiral adds. */
  summary: string;
  objectives: string[];
  /**
   * Level refs this level builds on. Objectives and context are inherited
   * transitively, which is what makes the spiral explicit rather than implied.
   */
  inherits?: string[];
  references?: Reference[];
  lecture: Lecture;
  assessment?: Assessment;
  estimatedMinutes?: number;
  /** Extra XP for finishing this level, on top of per-block and quiz XP. */
  xpBonus?: number;
}

export const topicLevelSchema = s.object({
  level: s.number({ min: 1, max: 9, int: true }),
  title: s.string({ min: 1 }),
  summary: s.string({ min: 1 }),
  objectives: s.array(s.string({ min: 1 }), { min: 1 }),
  inherits: s.optional(s.array(s.string({ min: 1 }))),
  references: s.optional(s.array(referenceSchema)),
  lecture: lectureSchema,
  assessment: s.optional(assessmentSchema),
  estimatedMinutes: s.optional(s.number({ min: 1 })),
  xpBonus: s.optional(s.number({ min: 0, int: true })),
});

export interface Topic {
  id: string;
  title: string;
  /** Single sentence shown on cards and the skill map. */
  tagline: string;
  tags?: string[];
  /** Topic ids that must reach at least level 1 before this one unlocks. */
  prerequisites?: string[];
  levels: TopicLevel[];
}

export const topicSchema = s.object({
  id: s.string({ min: 1, pattern: /^[a-z0-9][a-z0-9-]*$/ }),
  title: s.string({ min: 1 }),
  tagline: s.string({ min: 1 }),
  tags: s.optional(s.array(s.string())),
  prerequisites: s.optional(s.array(s.string())),
  levels: s.array(topicLevelSchema, { min: 1 }),
});

export interface Module {
  id: string;
  title: string;
  description: string;
  /** Ordered topic ids. A topic may appear in several modules. */
  topicIds: string[];
  /** Optional emoji/short glyph used on the map. */
  glyph?: string;
}

export const moduleSchema = s.object({
  id: s.string({ min: 1, pattern: /^[a-z0-9][a-z0-9-]*$/ }),
  title: s.string({ min: 1 }),
  description: s.string({ min: 1 }),
  topicIds: s.array(s.string({ min: 1 }), { min: 1 }),
  glyph: s.optional(s.string()),
});

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  /** Shown on the course card; free-form. */
  level?: 'intro' | 'intermediate' | 'advanced';
  modules: Module[];
  topics: Topic[];
}

export const courseSchema = s.object({
  id: s.string({ min: 1, pattern: /^[a-z0-9][a-z0-9-]*$/ }),
  title: s.string({ min: 1 }),
  subtitle: s.string({ min: 1 }),
  description: s.string({ min: 1 }),
  level: s.optional(s.enum(['intro', 'intermediate', 'advanced'] as const)),
  modules: s.array(moduleSchema, { min: 1 }),
  topics: s.array(topicSchema, { min: 1 }),
});

export type ParsedCourse = Infer<typeof courseSchema>;

// ---------------------------------------------------------------------------
// Level reference parsing
// ---------------------------------------------------------------------------

const LEVEL_REF = /^(?:([a-z0-9][a-z0-9-]*)\/)?([a-z0-9][a-z0-9-]*)@(\d+)$/;

/**
 * Parse `topicId@2` or `other-course/topicId@1`. Returns null when the string
 * is not a level reference (e.g. an external URL).
 */
export function parseLevelRef(raw: string): LevelRef | null {
  const match = LEVEL_REF.exec(raw.trim());
  if (!match) return null;
  const [, courseId, topicId, level] = match;
  return courseId ? { courseId, topicId, level: Number(level) } : { topicId, level: Number(level) };
}

/** Serialise a level ref back to its canonical string form. */
export function formatLevelRef(ref: LevelRef): string {
  return `${ref.courseId ? `${ref.courseId}/` : ''}${ref.topicId}@${ref.level}`;
}

/** Fully-qualified key used by the progress store and the graph index. */
export function levelKey(courseId: string, topicId: string, level: number): string {
  return `${courseId}/${topicId}@${level}`;
}
