/**
 * Ashby's two great tools.
 *
 * **Requisite variety.** Only variety can destroy variety: a regulator with
 * fewer distinct responses than the environment has distinct disturbances
 * cannot hold an essential variable steady, no matter how cleverly it plays.
 * The game below is an honest Latin square — every disturbance needs its own
 * response — so the learner runs into the law rather than being told it.
 *
 * **The black box.** You cannot open the system; you can only poke it and watch.
 * Some boxes are memoryless and give themselves away in two probes; others have
 * internal state and answer the same question differently depending on their
 * history. That difference *is* the discovery of state.
 */

export type Bit = 0 | 1;

// ---------------------------------------------------------------------------
// Variety
// ---------------------------------------------------------------------------

/** The number of distinct states actually present. */
export function varietyOf<T>(states: readonly T[]): number {
  return new Set(states).size;
}

/** Variety expressed in bits — the form in which it can be compared to entropy. */
export function varietyBits(stateCount: number): number {
  return stateCount > 0 ? Math.log2(stateCount) : 0;
}

/**
 * The outcome table of the regulation game: rows are disturbances, columns are
 * the regulator's responses, cells are the resulting state of the essential
 * variable. Response `r` neutralises disturbance `d` exactly when `r === d`, so
 * a regulator with fewer columns than rows provably cannot cover every case.
 */
export function latinSquareOutcomes(disturbances: number, responses: number): number[][] {
  return Array.from({ length: disturbances }, (_, d) =>
    Array.from({ length: responses }, (_, r) => (r - d + disturbances) % disturbances),
  );
}

/** Can the regulator hold the goal state whatever the environment does? */
export function canRegulate(table: readonly (readonly number[])[], goal: number): boolean {
  return table.every((row) => row.includes(goal));
}

/**
 * The law in its quantitative form: the variety left in the outcome is at least
 * the variety of the disturbance minus the variety of the regulator.
 */
export function minimumOutcomeVariety(disturbanceStates: number, regulatorStates: number): number {
  return Math.max(0, varietyBits(disturbanceStates) - varietyBits(regulatorStates));
}

export interface AssignmentResult {
  held: number;
  total: number;
  /** Share of disturbances neutralised, 0..1. */
  score: number;
  /** True only when every single disturbance was absorbed. */
  survived: boolean;
  /** Indices of the disturbances that got through. */
  failures: number[];
}

/** Grade a player's plan: one chosen response per disturbance. */
export function evaluateAssignment(
  table: readonly (readonly number[])[],
  choices: readonly (number | null)[],
  goal: number,
): AssignmentResult {
  const failures: number[] = [];
  let held = 0;
  table.forEach((row, d) => {
    const choice = choices[d];
    if (choice === null || choice === undefined || row[choice] !== goal) failures.push(d);
    else held += 1;
  });
  const total = table.length;
  return {
    held,
    total,
    score: total === 0 ? 0 : held / total,
    survived: held === total,
    failures,
  };
}

// ---------------------------------------------------------------------------
// The black box
// ---------------------------------------------------------------------------

export type BoxId = 'identity' | 'inverter' | 'toggle' | 'delay' | 'counter3' | 'latch';

export interface BlackBox {
  id: BoxId;
  step(input: Bit): Bit;
  reset(): void;
}

export interface BlackBoxInfo {
  id: BoxId;
  title: string;
  /** Revealed only after the learner commits to a guess. */
  explanation: string;
  /** True when the box's answer depends on its history. */
  hasMemory: boolean;
}

export const BLACK_BOXES: readonly BlackBoxInfo[] = [
  {
    id: 'identity',
    title: 'Повторитель',
    explanation: 'Выход равен входу. Памяти нет: одного зондирования хватает, чтобы это заподозрить.',
    hasMemory: false,
  },
  {
    id: 'inverter',
    title: 'Инвертор',
    explanation: 'Выход противоположен входу. Тоже без памяти — поведение полностью описывается таблицей 2×1.',
    hasMemory: false,
  },
  {
    id: 'toggle',
    title: 'Переключатель',
    explanation: 'Меняет выход на каждом шаге независимо от входа. Один и тот же вход даёт разные ответы — значит, внутри есть состояние.',
    hasMemory: true,
  },
  {
    id: 'delay',
    title: 'Задержка',
    explanation: 'Выдаёт то, что получил на предыдущем шаге. Помнит ровно один бит прошлого.',
    hasMemory: true,
  },
  {
    id: 'counter3',
    title: 'Счётчик на три',
    explanation: 'Считает единицы и срабатывает на каждой третьей. Внутри — состояние из трёх значений.',
    hasMemory: true,
  },
  {
    id: 'latch',
    title: 'Защёлка',
    explanation: 'Первая же единица переводит её в единицу навсегда. Необратимое состояние: систему нельзя вернуть назад входом.',
    hasMemory: true,
  },
];

export function createBox(id: BoxId): BlackBox {
  let flip: Bit = 0;
  let previous: Bit = 0;
  let count = 0;
  let latched: Bit = 0;

  const reset = () => {
    flip = 0;
    previous = 0;
    count = 0;
    latched = 0;
  };

  const step = (input: Bit): Bit => {
    switch (id) {
      case 'identity':
        return input;
      case 'inverter':
        return (input ^ 1) as Bit;
      case 'toggle':
        flip = (flip ^ 1) as Bit;
        return flip;
      case 'delay': {
        const out = previous;
        previous = input;
        return out;
      }
      case 'counter3': {
        if (input === 1) count += 1;
        return input === 1 && count % 3 === 0 ? 1 : 0;
      }
      case 'latch':
        if (input === 1) latched = 1;
        return latched;
      default:
        return 0;
    }
  };

  return { id, step, reset };
}

/** Run a fresh box over a list of inputs and collect what it said. */
export function probeSequence(id: BoxId, inputs: readonly Bit[] | readonly number[]): Bit[] {
  const box = createBox(id);
  return [...inputs].map((input) => box.step((input ? 1 : 0) as Bit));
}

export interface Observation {
  input: Bit;
  output: Bit;
}

/**
 * Every box still consistent with the evidence. This is the learner's actual
 * epistemic position: not "what is inside" but "what can still be true".
 */
export function identifyBox(observations: readonly Observation[]): BoxId[] {
  return BLACK_BOXES.map((info) => info.id).filter((id) => {
    const box = createBox(id);
    return observations.every(({ input, output }) => box.step(input) === output);
  });
}
