/**
 * АВТОМАТЫ — элементарный клеточный и «Жизнь».
 *
 * Обе модели нужны курсу ради одного: правило умещается в строку, а поведение
 * в строку не умещается. Это самый дешёвый способ показать, что «сложное» и
 * «сложно устроенное» — разные вещи, и что эмерджентность не мистика, а
 * обычное следствие локальных правил.
 *
 * Правило 110 — полное по Тьюрингу; правило 30 даёт последовательность, которую
 * использовали как генератор случайных чисел. Это стоит того, чтобы читатель
 * увидел их своими глазами, а не прочитал.
 */

/* ── элементарный клеточный автомат ─────────────────────────────────── */

/**
 * Шаг по правилу Вольфрама. Номер правила — это таблица: бит k говорит, во что
 * превращается тройка соседей с двоичной записью k. Края замкнуты в кольцо,
 * иначе на них появляется поведение, которого в правиле нет.
 */
export function elementaryStep(row: readonly number[], rule: number): number[] {
  const n = row.length;
  return row.map((_, i) => {
    const left = row[(i - 1 + n) % n]!;
    const self = row[i]!;
    const right = row[(i + 1) % n]!;
    const index = (left << 2) | (self << 1) | right;
    return (rule >> index) & 1;
  });
}

/** Первый ряд с единственной живой клеткой посередине — классическое начало. */
export function singleSeed(width: number): number[] {
  const row = new Array<number>(width).fill(0);
  row[Math.floor(width / 2)] = 1;
  return row;
}

export function elementaryRun(width: number, rule: number, steps: number, seed?: number[]): number[][] {
  const rows: number[][] = [seed ? [...seed] : singleSeed(width)];
  for (let i = 0; i < steps; i += 1) rows.push(elementaryStep(rows[rows.length - 1]!, rule));
  return rows;
}

/* ── «Жизнь» Конвея ─────────────────────────────────────────────────── */

export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint8Array;
}

export const createGrid = (width: number, height: number): Grid => ({
  width,
  height,
  cells: new Uint8Array(width * height),
});

export const at = (grid: Grid, x: number, y: number): number =>
  grid.cells[
    ((y + grid.height) % grid.height) * grid.width + ((x + grid.width) % grid.width)
  ] ?? 0;

export function setCells(grid: Grid, points: readonly (readonly [number, number])[]): Grid {
  const cells = new Uint8Array(grid.cells);
  for (const [x, y] of points) {
    cells[((y + grid.height) % grid.height) * grid.width + ((x + grid.width) % grid.width)] = 1;
  }
  return { ...grid, cells };
}

/**
 * Правило: живая с двумя или тремя соседями выживает, мёртвая ровно с тремя
 * оживает. Поле замкнуто в тор — так у него нет краёв, а значит и краевых
 * артефактов, которые читатель принял бы за поведение.
 */
export function lifeStep(grid: Grid): Grid {
  const next = new Uint8Array(grid.cells.length);
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      let neighbours = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          neighbours += at(grid, x + dx, y + dy);
        }
      }
      const alive = at(grid, x, y) === 1;
      next[y * grid.width + x] = alive
        ? neighbours === 2 || neighbours === 3
          ? 1
          : 0
        : neighbours === 3
          ? 1
          : 0;
    }
  }
  return { ...grid, cells: next };
}

export const population = (grid: Grid): number => grid.cells.reduce((a, b) => a + b, 0);

/** Известные фигуры — чтобы читателю было с чего начать, а не с пустого поля. */
export const FIGURES: Record<string, readonly (readonly [number, number])[]> = {
  /** Планёр: ползёт по диагонали, повторяя себя каждые четыре шага. */
  планёр: [
    [1, 0],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  /** Мигалка: период два. Самое короткое доказательство, что покой не един. */
  мигалка: [
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  /** Жаба: период два, но шире — видно, что период не связан с размером. */
  жаба: [
    [1, 1],
    [2, 1],
    [3, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  /** Блок: не меняется никогда. */
  блок: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
};
