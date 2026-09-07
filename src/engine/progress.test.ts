import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BADGES,
  DAY_MS,
  ProgressStore,
  RANKS,
  createInitialState,
  evaluateBadges,
  rankFromXp,
  reviewIntervalDays,
  xpForRank,
  type ProgressState,
} from './progress';

const memoryStorage = () => {
  let value: string | null = null;
  return {
    load: () => value,
    save: (next: string) => {
      value = next;
    },
    clear: () => {
      value = null;
    },
    get raw() {
      return value;
    },
  };
};

describe('rank curve', () => {
  it('starts everyone at rank 1 with a name', () => {
    expect(rankFromXp(0)).toMatchObject({ rank: 1, title: RANKS[0].title, into: 0 });
  });

  it('is monotonic and reports progress into the next rank', () => {
    const second = rankFromXp(xpForRank(2));
    expect(second.rank).toBe(2);
    expect(second.into).toBe(0);
    const mid = rankFromXp(xpForRank(2) + 50);
    expect(mid.rank).toBe(2);
    expect(mid.into).toBe(50);
    expect(mid.needed).toBe(xpForRank(3) - xpForRank(2));
  });

  it('caps at the last rank instead of running off the end', () => {
    const top = rankFromXp(10_000_000);
    expect(top.rank).toBe(RANKS.length);
    expect(top.title).toBe(RANKS[RANKS.length - 1].title);
  });
});

describe('spaced repetition intervals', () => {
  it('grows with each successful repetition', () => {
    const intervals = [0, 1, 2, 3, 4, 5].map(reviewIntervalDays);
    expect(intervals).toEqual([...intervals].sort((a, b) => a - b));
    expect(intervals[0]).toBeGreaterThan(0);
  });

  it('stops growing past the longest interval', () => {
    expect(reviewIntervalDays(50)).toBe(reviewIntervalDays(51));
  });
});

describe('ProgressStore block credit', () => {
  let store: ProgressStore;
  let now = Date.parse('2026-03-01T10:00:00Z');

  beforeEach(() => {
    now = Date.parse('2026-03-01T10:00:00Z');
    store = new ProgressStore({ storage: memoryStorage(), now: () => now });
  });

  it('starts empty', () => {
    expect(store.state.xp).toBe(0);
    expect(store.state.levels).toEqual({});
  });

  it('awards XP the first time a block is completed and not again', () => {
    store.completeBlock('cyb/feedback@1', 'b1');
    const afterFirst = store.state.xp;
    expect(afterFirst).toBeGreaterThan(0);
    store.completeBlock('cyb/feedback@1', 'b1');
    expect(store.state.xp).toBe(afterFirst);
    expect(store.state.levels['cyb/feedback@1'].blocksDone).toEqual(['b1']);
  });

  it('gives extra XP for a scored interactive block', () => {
    store.completeBlock('cyb/feedback@1', 'plain');
    const plain = store.state.xp;
    store.completeBlock('cyb/feedback@1', 'sim', { score: 1 });
    expect(store.state.xp - plain).toBeGreaterThan(plain);
  });

  it('marks a level in-progress as soon as a block lands', () => {
    store.completeBlock('cyb/feedback@1', 'b1');
    expect(store.state.levels['cyb/feedback@1'].status).toBe('in-progress');
  });

  it('notifies subscribers on change and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.completeBlock('cyb/feedback@1', 'b1');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.completeBlock('cyb/feedback@1', 'b2');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps state immutable between snapshots so React sees a new reference', () => {
    const before = store.state;
    store.completeBlock('cyb/feedback@1', 'b1');
    expect(store.state).not.toBe(before);
    expect(before.levels['cyb/feedback@1']).toBeUndefined();
  });
});

describe('ProgressStore assessments and mastery', () => {
  let store: ProgressStore;
  let now = Date.parse('2026-03-01T10:00:00Z');

  beforeEach(() => {
    now = Date.parse('2026-03-01T10:00:00Z');
    store = new ProgressStore({ storage: memoryStorage(), now: () => now });
  });

  it('records a passing attempt, sets mastery and schedules a review', () => {
    store.submitAssessment('cyb/feedback@1', { ratio: 0.9, passed: true, weakConcepts: [] });
    const level = store.state.levels['cyb/feedback@1'];
    expect(level.status).toBe('passed');
    expect(level.attempts).toBe(1);
    expect(level.bestRatio).toBeCloseTo(0.9);
    expect(level.mastery).toBeGreaterThan(0);
    expect(level.dueAt).toBeGreaterThan(now);
  });

  it('does not mark a failed attempt as passed but still records the attempt', () => {
    store.submitAssessment('cyb/feedback@1', { ratio: 0.3, passed: false, weakConcepts: ['loop'] });
    const level = store.state.levels['cyb/feedback@1'];
    expect(level.status).toBe('in-progress');
    expect(level.attempts).toBe(1);
    expect(store.state.weakConcepts).toContain('loop');
  });

  it('awards XP only for improvement on a retry', () => {
    store.submitAssessment('cyb/feedback@1', { ratio: 0.5, passed: false, weakConcepts: [] });
    const first = store.state.xp;
    store.submitAssessment('cyb/feedback@1', { ratio: 0.5, passed: false, weakConcepts: [] });
    expect(store.state.xp).toBe(first);
    store.submitAssessment('cyb/feedback@1', { ratio: 1, passed: true, weakConcepts: [] });
    expect(store.state.xp).toBeGreaterThan(first);
  });

  it('raises mastery towards 1 with repeated strong results and lowers it after a bad one', () => {
    store.submitAssessment('cyb/feedback@1', { ratio: 1, passed: true, weakConcepts: [] });
    const afterOne = store.state.levels['cyb/feedback@1'].mastery;
    store.submitAssessment('cyb/feedback@1', { ratio: 1, passed: true, weakConcepts: [] });
    const afterTwo = store.state.levels['cyb/feedback@1'].mastery;
    expect(afterTwo).toBeGreaterThan(afterOne);
    store.submitAssessment('cyb/feedback@1', { ratio: 0, passed: false, weakConcepts: [] });
    expect(store.state.levels['cyb/feedback@1'].mastery).toBeLessThan(afterTwo);
  });

  it('promotes a level to mastered once mastery is high after several reviews', () => {
    for (let i = 0; i < 4; i += 1) {
      store.submitAssessment('cyb/feedback@1', { ratio: 1, passed: true, weakConcepts: [] });
      now += 10 * DAY_MS;
    }
    expect(store.state.levels['cyb/feedback@1'].status).toBe('mastered');
  });

  it('resets the review interval after a failure', () => {
    store.submitAssessment('cyb/feedback@1', { ratio: 1, passed: true, weakConcepts: [] });
    const firstDue = store.state.levels['cyb/feedback@1'].dueAt!;
    now += DAY_MS;
    store.submitAssessment('cyb/feedback@1', { ratio: 0.1, passed: false, weakConcepts: [] });
    const level = store.state.levels['cyb/feedback@1'];
    expect(level.reps).toBe(0);
    expect(level.dueAt! - now).toBeLessThan(firstDue - (now - DAY_MS));
  });

  it('lists levels that are due for review', () => {
    store.submitAssessment('cyb/feedback@1', { ratio: 1, passed: true, weakConcepts: [] });
    expect(store.dueForReview()).toEqual([]);
    now += 30 * DAY_MS;
    expect(store.dueForReview()).toEqual(['cyb/feedback@1']);
  });

  it('exposes the set of completed level keys for gating', () => {
    store.submitAssessment('cyb/feedback@1', { ratio: 0.9, passed: true, weakConcepts: [] });
    store.submitAssessment('cyb/variety@1', { ratio: 0.2, passed: false, weakConcepts: [] });
    expect([...store.completedLevels()]).toEqual(['cyb/feedback@1']);
  });
});

describe('streaks', () => {
  it('counts consecutive days of study and resets after a gap', () => {
    let now = Date.parse('2026-03-01T10:00:00Z');
    const store = new ProgressStore({ storage: memoryStorage(), now: () => now });

    store.completeBlock('cyb/feedback@1', 'b1');
    expect(store.state.streak.current).toBe(1);

    store.completeBlock('cyb/feedback@1', 'b2');
    expect(store.state.streak.current).toBe(1);

    now += DAY_MS;
    store.completeBlock('cyb/feedback@1', 'b3');
    expect(store.state.streak.current).toBe(2);
    expect(store.state.streak.longest).toBe(2);

    now += 3 * DAY_MS;
    store.completeBlock('cyb/feedback@1', 'b4');
    expect(store.state.streak.current).toBe(1);
    expect(store.state.streak.longest).toBe(2);
  });
});

describe('badges', () => {
  const ctx = { spirals: { cyb: ['cyb/feedback@1', 'cyb/variety@1'] } };

  const stateWith = (mutate: (state: ProgressState) => void): ProgressState => {
    const state = createInitialState();
    mutate(state);
    return state;
  };

  it('has unique ids and non-empty descriptions', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    for (const badge of BADGES) expect(badge.description.length).toBeGreaterThan(5);
  });

  it('grants the first-level badge once a level is passed', () => {
    const state = stateWith((s) => {
      s.levels['cyb/feedback@1'] = {
        status: 'passed',
        mastery: 0.8,
        attempts: 1,
        bestRatio: 0.9,
        blocksDone: [],
        reps: 1,
      };
    });
    expect(evaluateBadges(state, ctx)).toContain('first-loop');
  });

  it('grants the perfectionist badge only for a flawless assessment', () => {
    const almost = stateWith((s) => {
      s.levels['a@1'] = { status: 'passed', mastery: 1, attempts: 1, bestRatio: 0.99, blocksDone: [], reps: 1 };
    });
    expect(evaluateBadges(almost, ctx)).not.toContain('flawless');
    const perfect = stateWith((s) => {
      s.levels['a@1'] = { status: 'passed', mastery: 1, attempts: 1, bestRatio: 1, blocksDone: [], reps: 1 };
    });
    expect(evaluateBadges(perfect, ctx)).toContain('flawless');
  });

  it('grants the spiral badge when every level-1 of a course is passed', () => {
    const state = stateWith((s) => {
      for (const key of ctx.spirals.cyb) {
        s.levels[key] = { status: 'passed', mastery: 1, attempts: 1, bestRatio: 1, blocksDone: [], reps: 1 };
      }
    });
    expect(evaluateBadges(state, ctx)).toContain('first-turn');
  });

  it('never re-grants a badge already held', () => {
    const state = stateWith((s) => {
      s.levels['cyb/feedback@1'] = {
        status: 'passed', mastery: 1, attempts: 1, bestRatio: 1, blocksDone: [], reps: 1,
      };
      s.badges = [{ id: 'first-loop', earnedAt: 1 }];
    });
    expect(evaluateBadges(state, ctx)).not.toContain('first-loop');
  });

  it('stores earned badges on the store when progress triggers them', () => {
    let now = Date.parse('2026-03-01T10:00:00Z');
    const store = new ProgressStore({
      storage: memoryStorage(),
      now: () => now,
      badgeContext: () => ctx,
    });
    store.submitAssessment('cyb/feedback@1', { ratio: 1, passed: true, weakConcepts: [] });
    expect(store.state.badges.map((b) => b.id)).toContain('first-loop');
  });
});

describe('persistence', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage();
    const now = () => Date.parse('2026-03-01T10:00:00Z');
    const first = new ProgressStore({ storage, now });
    first.completeBlock('cyb/feedback@1', 'b1');
    first.submitAssessment('cyb/feedback@1', { ratio: 1, passed: true, weakConcepts: [] });

    const restored = new ProgressStore({ storage, now });
    expect(restored.state.xp).toBe(first.state.xp);
    expect(restored.state.levels['cyb/feedback@1'].bestRatio).toBe(1);
  });

  it('ignores corrupted storage instead of crashing the app', () => {
    const storage = memoryStorage();
    storage.save('{not json');
    const store = new ProgressStore({ storage, now: () => 0 });
    expect(store.state.xp).toBe(0);
  });

  it('discards a snapshot written by an incompatible future version', () => {
    const storage = memoryStorage();
    storage.save(JSON.stringify({ ...createInitialState(), version: 999, xp: 500 }));
    const store = new ProgressStore({ storage, now: () => 0 });
    expect(store.state.xp).toBe(0);
  });

  it('supports a full reset', () => {
    const storage = memoryStorage();
    const store = new ProgressStore({ storage, now: () => 0 });
    store.completeBlock('cyb/feedback@1', 'b1');
    store.reset();
    expect(store.state.xp).toBe(0);
    expect(store.state.levels).toEqual({});
  });

  it('exports and imports a snapshot for moving between devices', () => {
    const store = new ProgressStore({ storage: memoryStorage(), now: () => 0 });
    store.completeBlock('cyb/feedback@1', 'b1');
    const dump = store.export();

    const other = new ProgressStore({ storage: memoryStorage(), now: () => 0 });
    expect(other.import(dump)).toBe(true);
    expect(other.state.xp).toBe(store.state.xp);
    expect(other.import('garbage')).toBe(false);
  });
});
