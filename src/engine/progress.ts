/**
 * Progress, XP, mastery and badges.
 *
 * The store is a plain class with an immutable snapshot and a subscribe hook, so
 * React binds to it through `useSyncExternalStore` while tests drive it directly
 * with an injected clock and an injected storage adapter. Nothing here touches
 * the network: all progress lives on the device, which is what "offline first"
 * has to mean for a learner on a train.
 *
 * Two ideas beyond a plain XP counter:
 *
 * - **Mastery** is an exponential moving average of assessment results, not a
 *   pass/fail flag. Understanding decays and recovers; the number should too.
 * - **Spaced repetition**: passing a level schedules it for review, with the
 *   interval growing after each success and collapsing after a failure. The
 *   spiral curriculum and the review queue reinforce each other.
 */

export const DAY_MS = 86_400_000;
const STATE_VERSION = 1;
const STORAGE_KEY = 'cybernetica.progress.v1';

/** EMA weight for a fresh result. 0.5 = the latest attempt counts as much as all history. */
const MASTERY_ALPHA = 0.5;
const MASTERY_THRESHOLD = 0.85;
const MASTERY_MIN_REPS = 3;

const XP_PER_BLOCK = 10;
const XP_PER_SCORED_BLOCK = 20;
const XP_PER_ASSESSMENT = 100;

/** Days until the next review, indexed by successful repetition count. */
const REVIEW_INTERVALS = [1, 3, 7, 16, 35, 70];

export type LevelStatus = 'available' | 'in-progress' | 'passed' | 'mastered';

export interface LevelProgress {
  status: LevelStatus;
  /** 0..1 exponential moving average of assessment ratios. */
  mastery: number;
  attempts: number;
  bestRatio: number;
  blocksDone: string[];
  /** Successful reviews in a row; drives the spaced-repetition interval. */
  reps: number;
  firstPassedAt?: number;
  lastSeenAt?: number;
  dueAt?: number;
}

export interface ProgressState {
  version: number;
  xp: number;
  levels: Record<string, LevelProgress>;
  badges: { id: string; earnedAt: number }[];
  streak: { current: number; longest: number; lastDay: string | null };
  totals: { blocks: number; interactions: number; assessments: number };
  /** Concepts recently missed; the review screen surfaces these first. */
  weakConcepts: string[];
  settings: { reducedMotion: boolean; sound: boolean };
}

export interface ProgressStorage {
  load(): string | null;
  save(value: string): void;
}

export interface BadgeContext {
  /** Course id → its full spiral path of level keys. */
  spirals: Record<string, string[]>;
}

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  glyph: string;
  earned(state: ProgressState, ctx: BadgeContext): boolean;
}

export interface Rank {
  title: string;
  blurb: string;
}

export const RANKS: readonly Rank[] = [
  { title: 'Наблюдатель', blurb: 'Видит систему снаружи' },
  { title: 'Оператор', blurb: 'Умеет крутить ручки и читать показания' },
  { title: 'Регулятор', blurb: 'Замыкает контуры и удерживает равновесие' },
  { title: 'Конструктор', blurb: 'Собирает управление из блоков' },
  { title: 'Архитектор систем', blurb: 'Проектирует разнообразие и его подавление' },
  { title: 'Кибернетик', blurb: 'Видит контуры там, где другие видят вещи' },
];

/** Cumulative XP needed to reach a rank. Triangular: 0, 100, 300, 600, ... */
export function xpForRank(rank: number): number {
  const r = Math.max(1, Math.floor(rank));
  return 50 * r * (r - 1);
}

export interface RankInfo {
  rank: number;
  title: string;
  blurb: string;
  /** XP accumulated inside the current rank. */
  into: number;
  /** XP span of the current rank; 0 at the cap. */
  needed: number;
}

export function rankFromXp(xp: number): RankInfo {
  let rank = 1;
  while (rank < RANKS.length && xp >= xpForRank(rank + 1)) rank += 1;
  const base = xpForRank(rank);
  const next = rank < RANKS.length ? xpForRank(rank + 1) : base;
  return {
    rank,
    title: RANKS[rank - 1].title,
    blurb: RANKS[rank - 1].blurb,
    into: xp - base,
    needed: next - base,
  };
}

export function reviewIntervalDays(reps: number): number {
  const index = Math.min(Math.max(0, Math.floor(reps)), REVIEW_INTERVALS.length - 1);
  return REVIEW_INTERVALS[index];
}

export function createInitialState(): ProgressState {
  return {
    version: STATE_VERSION,
    xp: 0,
    levels: {},
    badges: [],
    streak: { current: 0, longest: 0, lastDay: null },
    totals: { blocks: 0, interactions: 0, assessments: 0 },
    weakConcepts: [],
    settings: { reducedMotion: false, sound: true },
  };
}

const emptyLevel = (): LevelProgress => ({
  status: 'available',
  mastery: 0,
  attempts: 0,
  bestRatio: 0,
  blocksDone: [],
  reps: 0,
});

const levelNumberOf = (key: string): number => Number(key.split('@')[1] ?? 0);
const dayOf = (timestamp: number): string => new Date(timestamp).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

const passed = (level: LevelProgress) => level.status === 'passed' || level.status === 'mastered';

export const BADGES: readonly BadgeDefinition[] = [
  {
    id: 'first-loop',
    title: 'Первый контур',
    description: 'Пройден первый уровень темы — контур обратной связи замкнулся.',
    glyph: '🔁',
    earned: (state) => Object.values(state.levels).some(passed),
  },
  {
    id: 'flawless',
    title: 'Без помех',
    description: 'Идеальный результат на проверке: 100% без единой ошибки.',
    glyph: '🎯',
    earned: (state) => Object.values(state.levels).some((l) => l.bestRatio >= 1),
  },
  {
    id: 'first-turn',
    title: 'Первый виток спирали',
    description: 'Пройдены все темы курса на первом уровне глубины.',
    glyph: '🌀',
    earned: (state, ctx) =>
      Object.values(ctx.spirals).some((path) => {
        const firstPass = path.filter((key) => levelNumberOf(key) === 1);
        return firstPass.length > 0 && firstPass.every((key) => state.levels[key] && passed(state.levels[key]));
      }),
  },
  {
    id: 'deep-diver',
    title: 'Глубокое погружение',
    description: 'Тема пройдена до третьего уровня глубины.',
    glyph: '🕳️',
    earned: (state) =>
      Object.entries(state.levels).some(([key, level]) => levelNumberOf(key) >= 3 && passed(level)),
  },
  {
    id: 'experimenter',
    title: 'Экспериментатор',
    description: 'Десять интерактивных моделей доведены до результата.',
    glyph: '🧪',
    earned: (state) => state.totals.interactions >= 10,
  },
  {
    id: 'marathon',
    title: 'Длинный контур',
    description: 'Пятьдесят блоков материала пройдено.',
    glyph: '📚',
    earned: (state) => state.totals.blocks >= 50,
  },
  {
    id: 'streak-3',
    title: 'Гомеостаз',
    description: 'Три дня занятий подряд — режим удерживается.',
    glyph: '🔥',
    earned: (state) => state.streak.longest >= 3,
  },
  {
    id: 'streak-7',
    title: 'Устойчивый режим',
    description: 'Неделя занятий без единого пропуска.',
    glyph: '🏅',
    earned: (state) => state.streak.longest >= 7,
  },
  {
    id: 'retained',
    title: 'Запомнилось',
    description: 'Уровень доведён до устойчивого владения через повторения.',
    glyph: '🧠',
    earned: (state) => Object.values(state.levels).some((l) => l.status === 'mastered'),
  },
];

/** Ids of badges the state now qualifies for but does not yet hold. */
export function evaluateBadges(state: ProgressState, ctx: BadgeContext): string[] {
  const held = new Set(state.badges.map((b) => b.id));
  return BADGES.filter((badge) => !held.has(badge.id) && badge.earned(state, ctx)).map((b) => b.id);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface AssessmentOutcome {
  ratio: number;
  passed: boolean;
  weakConcepts: string[];
}

export interface ProgressStoreOptions {
  storage: ProgressStorage;
  now?: () => number;
  badgeContext?: () => BadgeContext;
}

export class ProgressStore {
  private current: ProgressState;
  private listeners = new Set<() => void>();
  private storage: ProgressStorage;
  private now: () => number;
  private badgeContext: () => BadgeContext;

  constructor(options: ProgressStoreOptions) {
    this.storage = options.storage;
    this.now = options.now ?? (() => Date.now());
    this.badgeContext = options.badgeContext ?? (() => ({ spirals: {} }));
    this.current = this.restore();
  }

  get state(): ProgressState {
    return this.current;
  }

  /** Stable reference for `useSyncExternalStore`. */
  getSnapshot = (): ProgressState => this.current;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  // -- queries --------------------------------------------------------------

  levelProgress(key: string): LevelProgress | undefined {
    return this.current.levels[key];
  }

  completedLevels(): Set<string> {
    return new Set(
      Object.entries(this.current.levels)
        .filter(([, level]) => passed(level))
        .map(([key]) => key),
    );
  }

  dueForReview(): string[] {
    const now = this.now();
    return Object.entries(this.current.levels)
      .filter(([, level]) => passed(level) && level.dueAt !== undefined && level.dueAt <= now)
      .map(([key]) => key)
      .sort();
  }

  // -- mutations ------------------------------------------------------------

  markVisited(levelKey: string): void {
    this.update((draft) => {
      const level = { ...(draft.levels[levelKey] ?? emptyLevel()) };
      level.lastSeenAt = this.now();
      if (level.status === 'available') level.status = 'in-progress';
      draft.levels[levelKey] = level;
    });
  }

  /**
   * Credit a block. `score` is present for interactive blocks that report how
   * well the learner did; plain content blocks just report completion.
   */
  completeBlock(levelKey: string, blockId: string, opts: { score?: number } = {}): void {
    this.update((draft) => {
      const level = { ...(draft.levels[levelKey] ?? emptyLevel()) };
      if (level.blocksDone.includes(blockId)) {
        draft.levels[levelKey] = level;
        return;
      }
      level.blocksDone = [...level.blocksDone, blockId];
      level.lastSeenAt = this.now();
      if (level.status === 'available') level.status = 'in-progress';
      draft.levels[levelKey] = level;

      draft.totals.blocks += 1;
      draft.xp += XP_PER_BLOCK;
      if (opts.score !== undefined) {
        draft.totals.interactions += 1;
        draft.xp += Math.round(XP_PER_SCORED_BLOCK * Math.min(1, Math.max(0, opts.score)));
      }
      this.touchStreak(draft);
    });
  }

  submitAssessment(levelKey: string, outcome: AssessmentOutcome): void {
    this.update((draft) => {
      const now = this.now();
      const level = { ...(draft.levels[levelKey] ?? emptyLevel()) };
      const ratio = Math.min(1, Math.max(0, outcome.ratio));

      // XP rewards improvement, so grinding the same score earns nothing.
      const improvement = Math.max(0, ratio - level.bestRatio);
      draft.xp += Math.round(improvement * XP_PER_ASSESSMENT);

      level.attempts += 1;
      level.bestRatio = Math.max(level.bestRatio, ratio);
      level.mastery = Number((level.mastery + MASTERY_ALPHA * (ratio - level.mastery)).toFixed(4));
      level.lastSeenAt = now;

      if (outcome.passed) {
        level.reps += 1;
        level.firstPassedAt ??= now;
        level.status =
          level.mastery >= MASTERY_THRESHOLD && level.reps >= MASTERY_MIN_REPS ? 'mastered' : 'passed';
      } else {
        level.reps = 0;
        if (level.status === 'available') level.status = 'in-progress';
      }
      level.dueAt = now + reviewIntervalDays(level.reps) * DAY_MS;

      draft.levels[levelKey] = level;
      draft.totals.assessments += 1;
      draft.weakConcepts = [...new Set([...outcome.weakConcepts, ...draft.weakConcepts])].slice(0, 24);
      this.touchStreak(draft);
    });
  }

  updateSettings(patch: Partial<ProgressState['settings']>): void {
    this.update((draft) => {
      draft.settings = { ...draft.settings, ...patch };
    });
  }

  reset(): void {
    this.current = createInitialState();
    this.persist();
    this.emit();
  }

  export(): string {
    return JSON.stringify(this.current);
  }

  import(dump: string): boolean {
    const parsed = this.parse(dump);
    if (!parsed) return false;
    this.current = parsed;
    this.persist();
    this.emit();
    return true;
  }

  // -- internals ------------------------------------------------------------

  private touchStreak(draft: ProgressState): void {
    const today = dayOf(this.now());
    if (draft.streak.lastDay === today) return;
    const yesterday = dayOf(this.now() - DAY_MS);
    draft.streak = {
      current: draft.streak.lastDay === yesterday ? draft.streak.current + 1 : 1,
      longest: 0,
      lastDay: today,
    };
    draft.streak.longest = Math.max(draft.streak.current, this.current.streak.longest);
  }

  /** Shallow-clone the pieces we mutate; snapshots stay immutable for React. */
  private update(mutate: (draft: ProgressState) => void): void {
    const draft: ProgressState = {
      ...this.current,
      levels: { ...this.current.levels },
      badges: [...this.current.badges],
      totals: { ...this.current.totals },
      streak: { ...this.current.streak },
      weakConcepts: [...this.current.weakConcepts],
      settings: { ...this.current.settings },
    };
    mutate(draft);

    const now = this.now();
    for (const id of evaluateBadges(draft, this.badgeContext())) {
      draft.badges.push({ id, earnedAt: now });
    }

    this.current = draft;
    this.persist();
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private persist(): void {
    try {
      this.storage.save(JSON.stringify(this.current));
    } catch {
      // A full or blocked storage quota must not break the lesson in progress.
    }
  }

  private restore(): ProgressState {
    try {
      const raw = this.storage.load();
      return (raw && this.parse(raw)) || createInitialState();
    } catch {
      return createInitialState();
    }
  }

  private parse(raw: string): ProgressState | null {
    try {
      const parsed = JSON.parse(raw) as Partial<ProgressState>;
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.version !== STATE_VERSION) return null;
      const base = createInitialState();
      return {
        ...base,
        ...parsed,
        levels: { ...(parsed.levels ?? {}) },
        badges: [...(parsed.badges ?? [])],
        totals: { ...base.totals, ...(parsed.totals ?? {}) },
        streak: { ...base.streak, ...(parsed.streak ?? {}) },
        settings: { ...base.settings, ...(parsed.settings ?? {}) },
        weakConcepts: [...(parsed.weakConcepts ?? [])],
      };
    } catch {
      return null;
    }
  }
}

/** localStorage adapter, degrading to an in-memory store in private mode. */
export function browserStorage(key: string = STORAGE_KEY): ProgressStorage {
  let fallback: string | null = null;
  return {
    load: () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return fallback;
      }
    },
    save: (value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        fallback = value;
      }
    },
  };
}
