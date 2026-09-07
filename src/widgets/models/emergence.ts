/**
 * Emergence: simple local rules, surprising global behaviour.
 *
 * Two classics, both cybernetic to the core. Elementary cellular automata show
 * that a rule you can write on a fingernail can generate structure you cannot
 * predict without running it — von Foerster's point about the limits of
 * outside description. Conway's Life shows self-maintaining organisation:
 * patterns that persist, move and reproduce without anyone steering them.
 *
 * A deliberate asymmetry: the automaton's line wraps into a ring (there is no
 * edge to a one-dimensional universe), while the Life board is bounded, because
 * the learner draws on a finite canvas and expects the border to be a border.
 */

export type Bit = 0 | 1;

// ---------------------------------------------------------------------------
// Elementary cellular automata (Wolfram)
// ---------------------------------------------------------------------------

/**
 * The eight outcomes of a rule number, indexed by the neighbourhood read as
 * `left*4 + centre*2 + right`.
 */
export function ruleBits(rule: number): Bit[] {
  const n = ((rule % 256) + 256) % 256;
  return Array.from({ length: 8 }, (_, index) => ((n >> index) & 1) as Bit);
}

export function stepElementary(row: readonly number[], rule: number): Bit[] {
  const bits = ruleBits(rule);
  const width = row.length;
  return row.map((_, i) => {
    const left = row[(i - 1 + width) % width] ? 1 : 0;
    const centre = row[i] ? 1 : 0;
    const right = row[(i + 1) % width] ? 1 : 0;
    return bits[left * 4 + centre * 2 + right];
  });
}

/** The full space-time diagram: the initial row plus `steps` generations. */
export function runElementary(initial: readonly number[], rule: number, steps: number): Bit[][] {
  const history: Bit[][] = [initial.map((c) => (c ? 1 : 0) as Bit)];
  for (let i = 0; i < steps; i += 1) {
    history.push(stepElementary(history[history.length - 1], rule));
  }
  return history;
}

export function emptyRow(width: number): Bit[] {
  return new Array(width).fill(0) as Bit[];
}

/** One cell alive in the middle: the classic starting condition. */
export function singleSeedRow(width: number): Bit[] {
  const row = emptyRow(width);
  row[Math.floor(width / 2)] = 1;
  return row;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRow(width: number, seed: number, density = 0.5): Bit[] {
  const rand = mulberry32(seed);
  return Array.from({ length: width }, () => (rand() < density ? 1 : 0) as Bit);
}

/** Rules worth showing, with the class each belongs to. */
export const NOTABLE_RULES: readonly { rule: number; title: string; note: string }[] = [
  { rule: 30, title: 'Правило 30', note: 'Хаос из одной клетки: узор не сжимается и не предсказывается.' },
  { rule: 90, title: 'Правило 90', note: 'Треугольник Серпинского — фрактал как побочный эффект XOR.' },
  { rule: 110, title: 'Правило 110', note: 'Граница хаоса и порядка; доказано, что это полный по Тьюрингу мир.' },
  { rule: 184, title: 'Правило 184', note: 'Модель транспортного потока: пробки движутся назад.' },
  { rule: 250, title: 'Правило 250', note: 'Простой рост: структура без сюрпризов.' },
];

// ---------------------------------------------------------------------------
// Conway's Game of Life
// ---------------------------------------------------------------------------

export interface Grid {
  w: number;
  h: number;
  cells: Uint8Array;
}

export function createGrid(w: number, h: number): Grid {
  return { w, h, cells: new Uint8Array(w * h) };
}

export function liveNeighbours(grid: Grid, x: number, y: number): number {
  let count = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= grid.w || ny >= grid.h) continue;
      count += grid.cells[ny * grid.w + nx];
    }
  }
  return count;
}

/** B3/S23: born with exactly three neighbours, survives with two or three. */
export function stepLife(grid: Grid): Grid {
  const next = createGrid(grid.w, grid.h);
  for (let y = 0; y < grid.h; y += 1) {
    for (let x = 0; x < grid.w; x += 1) {
      const alive = grid.cells[y * grid.w + x] === 1;
      const n = liveNeighbours(grid, x, y);
      next.cells[y * grid.w + x] = (alive ? n === 2 || n === 3 : n === 3) ? 1 : 0;
    }
  }
  return next;
}

export function population(grid: Grid): number {
  let count = 0;
  for (const cell of grid.cells) count += cell;
  return count;
}

export function toggleCell(grid: Grid, x: number, y: number): Grid {
  const next: Grid = { w: grid.w, h: grid.h, cells: Uint8Array.from(grid.cells) };
  const index = y * grid.w + x;
  next.cells[index] = next.cells[index] ? 0 : 1;
  return next;
}

export function setCell(grid: Grid, x: number, y: number, value: 0 | 1): Grid {
  if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) return grid;
  const next: Grid = { w: grid.w, h: grid.h, cells: Uint8Array.from(grid.cells) };
  next.cells[y * grid.w + x] = value;
  return next;
}

export interface LifePattern {
  id: string;
  title: string;
  note: string;
  /** Offsets from the placement origin. */
  cells: readonly [number, number][];
}

export const LIFE_PATTERNS: readonly LifePattern[] = [
  {
    id: 'glider',
    title: 'Планёр',
    note: 'Устойчивая структура, которая движется: организация без перемещения вещества.',
    cells: [
      [1, 0],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ],
  },
  {
    id: 'blinker',
    title: 'Мигалка',
    note: 'Простейший осциллятор с периодом 2 — минимальный «гомеостат».',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
  },
  {
    id: 'block',
    title: 'Блок',
    note: 'Неподвижная жизнь: равновесие, которое ничего не делает.',
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  },
  {
    id: 'r-pentomino',
    title: 'R-пентамино',
    note: 'Пять клеток, которые бушуют больше тысячи поколений: непредсказуемость из простоты.',
    cells: [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  },
  {
    id: 'lwss',
    title: 'Лёгкий корабль',
    note: 'Более крупный движущийся паттерн — «организм» из 9 клеток.',
    cells: [
      [0, 0],
      [3, 0],
      [4, 1],
      [0, 2],
      [4, 2],
      [1, 3],
      [2, 3],
      [3, 3],
      [4, 3],
    ],
  },
];

export function placePattern(grid: Grid, pattern: LifePattern, atX: number, atY: number): Grid {
  const next: Grid = { w: grid.w, h: grid.h, cells: Uint8Array.from(grid.cells) };
  for (const [dx, dy] of pattern.cells) {
    const x = atX + dx;
    const y = atY + dy;
    if (x >= 0 && y >= 0 && x < grid.w && y < grid.h) next.cells[y * grid.w + x] = 1;
  }
  return next;
}

export function randomGrid(w: number, h: number, seed: number, density = 0.3): Grid {
  const rand = mulberry32(seed);
  const grid = createGrid(w, h);
  for (let i = 0; i < grid.cells.length; i += 1) grid.cells[i] = rand() < density ? 1 : 0;
  return grid;
}
