import { describe, expect, it } from 'vitest';
import {
  CANONICAL_LOOP,
  PALETTE,
  addEdge,
  describeSignalPath,
  removeEdge,
  validateLoop,
  type LoopEdge,
} from './loopBuilder';

const nodes = CANONICAL_LOOP.nodes;
const correct = CANONICAL_LOOP.edges;

describe('palette', () => {
  it('offers every role a control loop needs, each with an explanation', () => {
    const kinds = PALETTE.map((p) => p.kind);
    for (const required of ['goal', 'comparator', 'controller', 'actuator', 'plant', 'sensor', 'disturbance']) {
      expect(kinds).toContain(required);
    }
    for (const item of PALETTE) expect(item.description.length).toBeGreaterThan(10);
  });
});

describe('validateLoop', () => {
  it('accepts the canonical closed loop', () => {
    const result = validateLoop(nodes, correct);
    expect(result.closed).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.score).toBe(1);
  });

  it('rejects an open loop and says the feedback path is missing', () => {
    const open = correct.filter((e) => !(e.from === 'sensor' && e.to === 'comparator'));
    const result = validateLoop(nodes, open);
    expect(result.closed).toBe(false);
    expect(result.issues.join(' ')).toMatch(/обратн/i);
    expect(result.score).toBeLessThan(1);
  });

  it('notices when the goal never reaches the comparator', () => {
    const noGoal = correct.filter((e) => e.from !== 'goal');
    const result = validateLoop(nodes, noGoal);
    expect(result.closed).toBe(false);
    expect(result.issues.join(' ')).toMatch(/цел/i);
  });

  it('notices a sensor that measures nothing', () => {
    const blind = correct.filter((e) => !(e.from === 'plant' && e.to === 'sensor'));
    expect(validateLoop(nodes, blind).issues.join(' ')).toMatch(/датчик/i);
  });

  it('rejects a loop wired backwards', () => {
    const reversed: LoopEdge[] = correct.map((e) => ({ from: e.to, to: e.from }));
    expect(validateLoop(nodes, reversed).closed).toBe(false);
  });

  it('tolerates an extra disturbance edge without complaining', () => {
    const withDisturbance = addEdge(correct, { from: 'disturbance', to: 'plant' });
    const result = validateLoop(nodes, withDisturbance);
    expect(result.closed).toBe(true);
    expect(result.score).toBe(1);
  });

  it('gives partial credit proportional to the edges wired correctly', () => {
    const half = correct.slice(0, Math.ceil(correct.length / 2));
    const result = validateLoop(nodes, half);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(1);
  });

  it('penalises edges that do not belong', () => {
    const bogus = addEdge(correct, { from: 'sensor', to: 'actuator' });
    const result = validateLoop(nodes, bogus);
    expect(result.score).toBeLessThan(1);
    expect(result.issues.join(' ')).toMatch(/лишн/i);
  });

  it('reports an empty canvas without throwing', () => {
    const result = validateLoop(nodes, []);
    expect(result.closed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe('edge editing', () => {
  it('adds an edge once and never duplicates it', () => {
    const edges = addEdge([], { from: 'goal', to: 'comparator' });
    expect(addEdge(edges, { from: 'goal', to: 'comparator' })).toHaveLength(1);
  });

  it('refuses a self-loop', () => {
    expect(addEdge([], { from: 'plant', to: 'plant' })).toHaveLength(0);
  });

  it('removes an edge without touching the rest', () => {
    const edges = removeEdge(correct, { from: 'sensor', to: 'comparator' });
    expect(edges).toHaveLength(correct.length - 1);
    expect(edges.some((e) => e.from === 'sensor')).toBe(false);
  });
});

describe('signal path narration', () => {
  it('traces the loop in order for the animation', () => {
    expect(describeSignalPath(correct)).toEqual([
      'goal',
      'comparator',
      'controller',
      'actuator',
      'plant',
      'sensor',
      'comparator',
    ]);
  });

  it('stops early when the loop is broken', () => {
    const open = correct.filter((e) => !(e.from === 'actuator' && e.to === 'plant'));
    expect(describeSignalPath(open)).toEqual(['goal', 'comparator', 'controller', 'actuator']);
  });
});
