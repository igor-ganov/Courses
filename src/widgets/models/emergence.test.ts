import { describe, expect, it } from 'vitest';
import {
  LIFE_PATTERNS,
  createGrid,
  emptyRow,
  liveNeighbours,
  placePattern,
  population,
  ruleBits,
  runElementary,
  seededRow,
  singleSeedRow,
  stepElementary,
  stepLife,
  toggleCell,
} from './emergence';

describe('elementary cellular automata', () => {
  it('decodes a rule number into its eight neighbourhood outcomes', () => {
    expect(ruleBits(30)).toEqual([0, 1, 1, 1, 1, 0, 0, 0]);
    expect(ruleBits(0)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(ruleBits(255)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('rule 0 kills everything and rule 255 fills everything', () => {
    const row = seededRow(16, 1, 0.5);
    expect(stepElementary(row, 0)).toEqual(emptyRow(16));
    expect(stepElementary(row, 255).every((c) => c === 1)).toBe(true);
  });

  it('rule 90 is the exclusive-or of the two neighbours', () => {
    const row = [0, 1, 0, 0, 1, 1, 0, 0];
    const next = stepElementary(row, 90);
    for (let i = 0; i < row.length; i += 1) {
      const left = row[(i - 1 + row.length) % row.length];
      const right = row[(i + 1) % row.length];
      expect(next[i]).toBe(left ^ right);
    }
  });

  it('wraps around the edges so the world has no walls', () => {
    const row = [1, 0, 0, 0];
    // Rule 90 on a single cell puts a mark either side, including across the seam.
    expect(stepElementary(row, 90)).toEqual([0, 1, 0, 1]);
  });

  it('grows a triangle of history from a single seed with rule 30', () => {
    const history = runElementary(singleSeedRow(41), 30, 20);
    expect(history).toHaveLength(21);
    expect(population({ w: 41, h: 1, cells: Uint8Array.from(history[0]) })).toBe(1);
    // Rule 30 is chaotic: after 20 steps a good share of the row is alive.
    const filled = history[20].reduce<number>((a, b) => a + b, 0);
    expect(filled).toBeGreaterThan(5);
  });

  it('rule 110 neither dies out nor fills up — the edge of chaos', () => {
    const history = runElementary(seededRow(60, 3, 0.5), 110, 60);
    const last = history[history.length - 1].reduce<number>((a, b) => a + b, 0);
    expect(last).toBeGreaterThan(0);
    expect(last).toBeLessThan(60);
  });

  it('produces a reproducible seeded row', () => {
    expect(seededRow(20, 5, 0.5)).toEqual(seededRow(20, 5, 0.5));
    expect(seededRow(20, 5, 0.5)).not.toEqual(seededRow(20, 6, 0.5));
  });
});

describe("Conway's Game of Life", () => {
  const grid = (rows: string[]) => {
    const g = createGrid(rows[0].length, rows.length);
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '#') g.cells[y * g.w + x] = 1;
      }),
    );
    return g;
  };

  const render = (g: { w: number; h: number; cells: Uint8Array }) =>
    Array.from({ length: g.h }, (_, y) =>
      Array.from({ length: g.w }, (_, x) => (g.cells[y * g.w + x] ? '#' : '.')).join(''),
    );

  it('counts living neighbours without counting the cell itself', () => {
    const g = grid(['###', '###', '###']);
    expect(liveNeighbours(g, 1, 1)).toBe(8);
    expect(liveNeighbours(g, 0, 0)).toBe(3);
  });

  it('lets a lone cell die of loneliness', () => {
    expect(population(stepLife(grid(['.....', '..#..', '.....'])))).toBe(0);
  });

  it('keeps a block alive forever', () => {
    const block = grid(['....', '.##.', '.##.', '....']);
    expect(render(stepLife(block))).toEqual(render(block));
  });

  it('oscillates a blinker with period two', () => {
    const blinker = grid(['.....', '.....', '.###.', '.....', '.....']);
    const once = stepLife(blinker);
    expect(render(once)).toEqual(['.....', '..#..', '..#..', '..#..', '.....']);
    expect(render(stepLife(once))).toEqual(render(blinker));
  });

  it('walks a glider one cell diagonally every four generations', () => {
    let g = grid([
      '..........',
      '..#.......',
      '...#......',
      '.###......',
      '..........',
      '..........',
    ]);
    for (let i = 0; i < 4; i += 1) g = stepLife(g);
    expect(render(g)).toEqual([
      '..........',
      '..........',
      '...#......',
      '....#.....',
      '..###.....',
      '..........',
    ]);
  });

  it('kills an overcrowded cell', () => {
    const crowded = grid(['###', '###', '###']);
    expect(stepLife(crowded).cells[1 * 3 + 1]).toBe(0);
  });

  it('toggles a cell without mutating the original grid', () => {
    const g = createGrid(3, 3);
    const next = toggleCell(g, 1, 1);
    expect(next.cells[4]).toBe(1);
    expect(g.cells[4]).toBe(0);
  });

  it('ships named patterns that all fit and are non-empty', () => {
    for (const pattern of LIFE_PATTERNS) {
      expect(pattern.cells.length).toBeGreaterThan(0);
      const g = placePattern(createGrid(30, 30), pattern, 10, 10);
      expect(population(g)).toBe(pattern.cells.length);
    }
  });
});
