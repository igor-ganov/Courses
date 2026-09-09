/**
 * РАЗНООБРАЗИЕ — игра Эшби и опознание чёрного ящика.
 *
 * Закон необходимого разнообразия — центральная теорема курса, и её нельзя
 * рассказать: в неё нужно проиграть. Игра устроена так, что читатель сначала
 * побеждает, потом у него отнимают один ход, и он перестаёт побеждать — не
 * потому что стал хуже играть, а потому что ходов стало меньше, чем помех.
 *
 * Чёрный ящик — вторая половина той же мысли: систему опознают, тыкая в неё, а
 * не вскрывая. Здесь спрятан конечный автомат, и вся работа читателя — подать
 * такую последовательность, которая различит гипотезы.
 */

/* ── игра Эшби ──────────────────────────────────────────────────────── */

export interface VarietyTable {
  /** Названия помех — то, что делает среда. */
  readonly disturbances: readonly string[];
  /** Названия ходов регулятора. */
  readonly moves: readonly string[];
  /** outcomes[помеха][ход] — исход. Числа: 0 — приемлемо, дальше хуже. */
  readonly outcomes: readonly (readonly number[])[];
}

/**
 * Может ли регулятор удержать исход, каким бы ни была помеха? Ему нужен ход на
 * каждую помеху, и этот ход должен давать приемлемый исход. Ровно это и есть
 * закон необходимого разнообразия: V(исход) ≥ V(помеха) − V(регулятор).
 */
export function canRegulate(table: VarietyTable): boolean {
  return table.outcomes.every((row) => row.some((outcome) => outcome === 0));
}

/** Сколько помех регулятор в принципе не может отработать. */
export function unhandled(table: VarietyTable): string[] {
  return table.disturbances.filter((_, d) => !(table.outcomes[d] ?? []).some((o) => o === 0));
}

/** Разнообразие в битах: логарифм числа различимых состояний. */
export const variety = (count: number): number => (count > 0 ? Math.log2(count) : 0);

/**
 * Нижняя граница остаточного разнообразия исхода по Эшби, в битах.
 * Отрицательное значение означает, что запас есть.
 */
export const residualVariety = (disturbances: number, moves: number): number =>
  Math.max(0, variety(disturbances) - variety(moves));

export interface VarietyRound {
  readonly disturbance: number;
  readonly move: number;
  readonly outcome: number;
  readonly ok: boolean;
}

export interface VarietyGame {
  /** Какая помеха пришла в этот раунд. */
  current(): number;
  /** Сделать ход; возвращает разбор раунда и берёт следующую помеху. */
  play(move: number): VarietyRound;
  rounds(): readonly VarietyRound[];
  score(): { held: number; total: number };
  goal(): { goal: 'held'; reached: boolean; score: number };
  reset(): void;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createVarietyGame(
  table: VarietyTable,
  options: { seed: number; target: number },
): VarietyGame {
  let rnd = mulberry32(options.seed);
  let disturbance = Math.floor(rnd() * table.disturbances.length);
  let log: VarietyRound[] = [];

  return {
    current: () => disturbance,
    play(move) {
      const outcome = table.outcomes[disturbance]?.[move] ?? Number.POSITIVE_INFINITY;
      const round: VarietyRound = { disturbance, move, outcome, ok: outcome === 0 };
      log.push(round);
      disturbance = Math.floor(rnd() * table.disturbances.length);
      return round;
    },
    rounds: () => log,
    score: () => ({ held: log.filter((r) => r.ok).length, total: log.length }),
    goal() {
      const held = log.filter((r) => r.ok).length;
      return {
        goal: 'held' as const,
        reached: held >= options.target,
        score: Math.min(1, held / options.target),
      };
    },
    reset() {
      rnd = mulberry32(options.seed);
      disturbance = Math.floor(rnd() * table.disturbances.length);
      log = [];
    },
  };
}

/* ── чёрный ящик ────────────────────────────────────────────────────── */

export interface Machine {
  readonly name: string;
  readonly states: number;
  /** next[состояние][вход] — следующее состояние. */
  readonly next: readonly (readonly number[])[];
  /** out[состояние][вход] — что видно снаружи. */
  readonly out: readonly (readonly string[])[];
}

export interface BlackBox {
  send(input: number): string;
  trace(): readonly { input: number; output: string }[];
  /** Гипотезы, которые ещё не опровергнуты наблюдениями. */
  survivors(candidates: readonly Machine[]): Machine[];
  reset(): void;
  goal(candidates: readonly Machine[]): { goal: 'identified'; reached: boolean; score: number };
}

/**
 * Чёрный ящик: внутрь заглянуть нельзя, можно только подавать вход и смотреть
 * выход. Гипотезы отсеиваются наблюдениями — это и есть опознание.
 */
export function createBlackBox(hidden: Machine): BlackBox {
  let state = 0;
  let log: { input: number; output: string }[] = [];

  const run = (machine: Machine, inputs: readonly number[]): string[] => {
    let s = 0;
    return inputs.map((input) => {
      const output = machine.out[s]?.[input] ?? '';
      s = machine.next[s]?.[input] ?? 0;
      return output;
    });
  };

  return {
    send(input) {
      const output = hidden.out[state]?.[input] ?? '';
      state = hidden.next[state]?.[input] ?? 0;
      log.push({ input, output });
      return output;
    },
    trace: () => log,
    survivors(candidates) {
      const inputs = log.map((l) => l.input);
      const seen = log.map((l) => l.output);
      return candidates.filter((c) => run(c, inputs).every((o, i) => o === seen[i]));
    },
    reset() {
      state = 0;
      log = [];
    },
    goal(candidates) {
      const left = this.survivors(candidates);
      const reached = left.length === 1 && left[0]?.name === hidden.name;
      /* Частичный балл — насколько сузился круг. Иначе читатель, отсеявший
         три гипотезы из четырёх, получает такой же ноль, как не начинавший. */
      const total = Math.max(candidates.length, 1);
      const score = total > 1 ? (total - left.length) / (total - 1) : 0;
      return { goal: 'identified' as const, reached, score: Math.min(1, Math.max(0, score)) };
    },
  };
}
