import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WELLS,
  basinOf,
  lorenzTrajectory,
  potentialAt,
  rollBall,
  settle,
  spiralTrajectory,
  stepLorenz,
} from './dynamics';

describe('Lorenz attractor', () => {
  it('stays inside a bounded region however long it runs', () => {
    const path = lorenzTrajectory({ x: 1, y: 1, z: 1 }, 4000, 0.005);
    expect(path).toHaveLength(4000);
    for (const p of path) {
      expect(Math.abs(p.x)).toBeLessThan(100);
      expect(Math.abs(p.y)).toBeLessThan(100);
      expect(p.z).toBeGreaterThan(-10);
      expect(p.z).toBeLessThan(120);
    }
  });

  it('never repeats a point exactly — it is not a cycle', () => {
    const path = lorenzTrajectory({ x: 1, y: 1, z: 1 }, 500, 0.005);
    const start = path[0];
    const returns = path.slice(50).filter(
      (p) => Math.hypot(p.x - start.x, p.y - start.y, p.z - start.z) < 1e-6,
    );
    expect(returns).toHaveLength(0);
  });

  // A millionth of a unit apart at t=0; by t≈35 the two runs are on opposite
  // wings of the attractor. This is the whole argument against "deterministic
  // therefore predictable" in one assertion.
  it('shows sensitive dependence: neighbouring starts end up far apart', () => {
    const steps = 7000;
    const a = lorenzTrajectory({ x: 1, y: 1, z: 1 }, steps, 0.005);
    const b = lorenzTrajectory({ x: 1.000001, y: 1, z: 1 }, steps, 0.005);
    const gap = (i: number) => Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y, a[i].z - b[i].z);
    expect(gap(0)).toBeLessThan(1e-5);
    expect(gap(steps - 1)).toBeGreaterThan(1);
  });

  it('takes a single deterministic step', () => {
    const once = stepLorenz({ x: 1, y: 1, z: 1 }, 0.01);
    expect(stepLorenz({ x: 1, y: 1, z: 1 }, 0.01)).toEqual(once);
    expect(once).not.toEqual({ x: 1, y: 1, z: 1 });
  });
});

describe('stability landscape', () => {
  it('is lower inside a well than on the ridge between wells', () => {
    const well = DEFAULT_WELLS[0];
    expect(potentialAt(well.x, well.y, DEFAULT_WELLS)).toBeLessThan(
      potentialAt(well.x + 6, well.y + 6, DEFAULT_WELLS),
    );
  });

  it('rolls a ball downhill: the potential never increases', () => {
    let position = { x: 1.5, y: 1.2 };
    let previous = potentialAt(position.x, position.y, DEFAULT_WELLS);
    for (let i = 0; i < 200; i += 1) {
      position = rollBall(position, DEFAULT_WELLS, 0.05);
      const current = potentialAt(position.x, position.y, DEFAULT_WELLS);
      expect(current).toBeLessThanOrEqual(previous + 1e-6);
      previous = current;
    }
  });

  it('settles into the basin it started in', () => {
    for (const [index, well] of DEFAULT_WELLS.entries()) {
      const start = { x: well.x + 0.4, y: well.y - 0.4 };
      expect(basinOf(start, DEFAULT_WELLS)).toBe(index);
      const rest = settle(start, DEFAULT_WELLS);
      expect(Math.hypot(rest.x - well.x, rest.y - well.y)).toBeLessThan(0.5);
    }
  });

  it('a nudge across the ridge changes which equilibrium the system falls into', () => {
    const nearFirst = basinOf({ x: DEFAULT_WELLS[0].x + 0.2, y: DEFAULT_WELLS[0].y }, DEFAULT_WELLS);
    const nearSecond = basinOf({ x: DEFAULT_WELLS[1].x - 0.2, y: DEFAULT_WELLS[1].y }, DEFAULT_WELLS);
    expect(nearFirst).toBe(0);
    expect(nearSecond).toBe(1);
  });
});

describe('damped spiral', () => {
  it('spirals inward for a damped system and outward for a negative damping', () => {
    const damped = spiralTrajectory({ x: 3, y: 0 }, 0.3, 1, 600, 0.02);
    const radius = (p: { x: number; y: number }) => Math.hypot(p.x, p.y);
    expect(radius(damped[599])).toBeLessThan(radius(damped[0]));

    const unstable = spiralTrajectory({ x: 0.2, y: 0 }, -0.3, 1, 600, 0.02);
    expect(radius(unstable[599])).toBeGreaterThan(radius(unstable[0]));
  });

  it('keeps a constant radius when there is no damping', () => {
    const path = spiralTrajectory({ x: 2, y: 0 }, 0, 1, 400, 0.01);
    const radius = (p: { x: number; y: number }) => Math.hypot(p.x, p.y);
    expect(radius(path[399])).toBeCloseTo(radius(path[0]), 1);
  });
});
