/**
 * ПРОГРЕСС — единственное место платформы, которое помнит.
 *
 * Часы и хранилище приходят снаружи. Не ради красоты: без этого поведение
 * нельзя проверить, а «завтра» в тесте становится ожиданием длиной в сутки.
 *
 * Мастерство — скользящее среднее, а не флажок «сдал». Флажок врёт в обе
 * стороны: угадавший с третьего раза выглядит знающим, а знающий, ошибившийся
 * однажды, теряет всё. Среднее забывает медленно и в обе стороны.
 *
 * Игровая часть — опыт, звания, знаки, серия дней — считается от сделанной
 * работы, а не от открытых страниц. Опыт за перезаход того же витка убывает:
 * иначе выгоднее всего перезагружать страницу.
 */

export interface Clock {
  now(): number;
}

export interface Store {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const KEY = 'courses.progress';
const DAY = 86_400_000;

/** Скорость забывания. 0,45 — три-четыре подхода до уверенной оценки. */
const ALPHA = 0.45;
/** Порог, с которого виток считается сданным, а срок повторения растёт. */
export const PASS = 0.7;
/** Во сколько раз растягивается срок после успешного повторения. */
const GROWTH = 2.2;

export const RANKS = [
  'Наблюдатель',
  'Оператор',
  'Регулятор',
  'Проектировщик',
  'Архитектор контуров',
  'Кибернетик',
] as const;

/* Пороги подобраны так, чтобы первое звание пришло за один хороший вечер, а
   последнее требовало пройденного курса, а не запаса времени. */
export const THRESHOLDS = [0, 120, 400, 1000, 2200, 4500];

export interface LevelProgress {
  /** Скользящее среднее оценок, 0…1. */
  readonly mastery: number;
  readonly attempts: number;
  readonly lastScore: number;
  /** Когда звать на повторение. */
  readonly due: number;
  /** Текущий срок в днях. */
  readonly interval: number;
  readonly doneAt?: number;
}

export interface Snapshot {
  readonly xp: number;
  readonly levels: Readonly<Record<string, LevelProgress>>;
  readonly streak: { readonly current: number; readonly best: number; readonly lastDay: number | null };
  readonly badges: readonly string[];
}

export interface RecordInput {
  readonly score: number;
  /** Трудность витка или работы, 1…5. */
  readonly difficulty: number;
}

export interface RecordResult {
  readonly xpGained: number;
  readonly rankUp: boolean;
  readonly badges: readonly string[];
  readonly mastery: number;
}

export interface Rank {
  readonly index: number;
  readonly title: string;
  readonly xp: number;
  readonly next?: number;
}

export interface Progress {
  snapshot(): Snapshot;
  level(key: string): LevelProgress;
  isDone(key: string): boolean;
  done(): ReadonlySet<string>;
  rank(): Rank;
  record(key: string, input: RecordInput): RecordResult;
  /** Витки, чей срок повторения настал; дольше просроченные идут первыми. */
  due(): { key: string; overdueDays: number }[];
  export(): string;
  import(text: string): void;
}

const EMPTY: LevelProgress = { mastery: 0, attempts: 0, lastScore: 0, due: 0, interval: 0 };

const blank = (): Snapshot => ({
  xp: 0,
  levels: {},
  streak: { current: 0, best: 0, lastDay: null },
  badges: [],
});

const dayOf = (t: number) => Math.floor(t / DAY);
const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

export function createProgress(deps: { clock: Clock; store: Store }): Progress {
  const { clock, store } = deps;
  let state = load();

  function load(): Snapshot {
    /* Испорченная запись не должна ронять платформу: читатель теряет прогресс,
       но не возможность учиться дальше. */
    try {
      const raw = store.get(KEY);
      return raw ? validate(JSON.parse(raw)) : blank();
    } catch {
      return blank();
    }
  }

  function save(): void {
    try {
      store.set(KEY, JSON.stringify(state));
    } catch {
      /* Приватный режим, переполненное хранилище — учиться это не мешает. */
    }
  }

  function rankOf(xp: number): Rank {
    let index = 0;
    for (let i = 0; i < THRESHOLDS.length; i += 1) if (xp >= THRESHOLDS[i]!) index = i;
    const next = THRESHOLDS[index + 1];
    const rank = { index, title: RANKS[index]!, xp };
    return next === undefined ? rank : { ...rank, next };
  }

  function grantBadges(fresh: string[]): void {
    const have = new Set(state.badges);
    const add = fresh.filter((b) => !have.has(b));
    if (add.length) state = { ...state, badges: [...state.badges, ...add] };
  }

  return {
    snapshot: () => state,
    level: (key) => state.levels[key] ?? EMPTY,
    isDone: (key) => (state.levels[key]?.doneAt ?? 0) > 0,
    done: () => new Set(Object.keys(state.levels).filter((k) => (state.levels[k]?.doneAt ?? 0) > 0)),
    rank: () => rankOf(state.xp),

    record(key, input) {
      const now = clock.now();
      const score = clamp01(input.score);
      const difficulty = Math.min(5, Math.max(1, input.difficulty));
      const before = state.levels[key] ?? EMPTY;
      const rankBefore = rankOf(state.xp).index;

      /* Мастерство: скользящее среднее, и первая попытка не исключение. Одна
         удача не венчает — это одно наблюдение, а не знание; до уверенной
         оценки нужно три-четыре подхода. */
      const mastery = before.mastery + ALPHA * (score - before.mastery);

      /* Срок повторения. Успех растягивает, неудача возвращает к завтра — то,
         чего не знаешь, надо увидеть скоро, а не через месяц. */
      const passed = score >= PASS;
      const interval = passed ? (before.interval === 0 ? 1 : before.interval * GROWTH) : 1;

      const after: LevelProgress = {
        mastery,
        attempts: before.attempts + 1,
        lastScore: score,
        due: now + interval * DAY,
        interval,
        ...(passed || before.doneAt ? { doneAt: before.doneAt ?? now } : {}),
      };

      /* Опыт: за трудность и качество, с убыванием за повтор. Иначе выгоднее
         всего перезаходить на один и тот же лёгкий виток. */
      const repeat = 1 / (1 + before.attempts);
      const xpGained = Math.round(20 * difficulty * (0.3 + 0.7 * score) * repeat);

      /* Серия дней. Тот же день второй раз ничего не удлиняет. */
      const today = dayOf(now);
      const last = state.streak.lastDay;
      const current = last === null ? 1 : today === last ? state.streak.current : today === last + 1 ? state.streak.current + 1 : 1;

      state = {
        xp: state.xp + xpGained,
        levels: { ...state.levels, [key]: after },
        streak: { current, best: Math.max(state.streak.best, current), lastDay: today },
        badges: state.badges,
      };

      const свежие: string[] = [];
      if (Object.keys(state.levels).length === 1) свежие.push('первый-виток');
      if (score === 1) свежие.push('без-единой-ошибки');
      if (current >= 7) свежие.push('неделя-подряд');
      if (Object.keys(state.levels).length >= 10) свежие.push('десять-витков');
      if (mastery >= 0.9 && after.attempts >= 3) свежие.push('уверенное-знание');
      const было = new Set(state.badges);
      grantBadges(свежие);
      save();

      return {
        xpGained,
        rankUp: rankOf(state.xp).index > rankBefore,
        badges: свежие.filter((b) => !было.has(b)),
        mastery,
      };
    },

    due() {
      const now = clock.now();
      return Object.entries(state.levels)
        .filter(([, l]) => l.attempts > 0 && l.due <= now)
        .map(([key, l]) => ({ key, overdueDays: (now - l.due) / DAY }))
        .sort((a, b) => b.overdueDays - a.overdueDays);
    },

    export: () => JSON.stringify(state, null, 2),

    import(text) {
      state = validate(JSON.parse(text));
      save();
    },
  };
}

/* Разбор сохранённого. Чужой или испорченный файл не принимается молча: молча
   принятый мусор превращается в необъяснимые числа на экране. */
function validate(value: unknown): Snapshot {
  const v = value as Partial<Snapshot>;
  if (typeof v !== 'object' || v === null) throw new Error('это не запись прогресса');
  if (typeof v.xp !== 'number' || !Number.isFinite(v.xp)) throw new Error('xp: ожидалось число');
  const levels: Record<string, LevelProgress> = {};
  for (const [key, raw] of Object.entries(v.levels ?? {})) {
    const l = raw as Partial<LevelProgress>;
    if (typeof l?.mastery !== 'number' || typeof l?.attempts !== 'number') {
      throw new Error(`levels.${key}: ожидались числа mastery и attempts`);
    }
    levels[key] = {
      mastery: clamp01(l.mastery),
      attempts: Math.max(0, Math.trunc(l.attempts)),
      lastScore: clamp01(l.lastScore ?? 0),
      due: Number(l.due ?? 0),
      interval: Number(l.interval ?? 0),
      ...(l.doneAt ? { doneAt: Number(l.doneAt) } : {}),
    };
  }
  const s = v.streak ?? { current: 0, best: 0, lastDay: null };
  return {
    xp: v.xp,
    levels,
    streak: {
      current: Number(s.current ?? 0),
      best: Number(s.best ?? 0),
      lastDay: s.lastDay === null || s.lastDay === undefined ? null : Number(s.lastDay),
    },
    badges: Array.isArray(v.badges) ? v.badges.filter((b): b is string => typeof b === 'string') : [],
  };
}
