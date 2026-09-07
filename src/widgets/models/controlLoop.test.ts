import { describe, expect, it } from 'vitest';
import { analyse, defaultLoopParams, simulateLoop, type LoopParams } from './controlLoop';

const run = (over: Partial<LoopParams> = {}) => {
  const params = { ...defaultLoopParams, ...over };
  return { params, trace: simulateLoop(params) };
};

/** Simulate and analyse in one step — most tests only care about the metrics. */
const metrics = (over: Partial<LoopParams> = {}) => {
  const { trace, params } = run(over);
  return analyse(trace, params);
};

describe('simulateLoop', () => {
  it('produces one sample per step, starting at the initial value', () => {
    const { trace, params } = run({ steps: 50 });
    expect(trace.length).toBe(50);
    expect(trace[0].y).toBeCloseTo(params.y0);
    expect(trace[0].t).toBe(0);
    expect(trace[49].t).toBeCloseTo(49 * params.dt);
  });

  it('is deterministic when noise is off', () => {
    const a = simulateLoop({ ...defaultLoopParams, noise: 0 });
    const b = simulateLoop({ ...defaultLoopParams, noise: 0 });
    expect(a.map((p) => p.y)).toEqual(b.map((p) => p.y));
  });

  it('is reproducible with a seed even when noise is on', () => {
    const a = simulateLoop({ ...defaultLoopParams, noise: 0.2, seed: 7 });
    const b = simulateLoop({ ...defaultLoopParams, noise: 0.2, seed: 7 });
    const c = simulateLoop({ ...defaultLoopParams, noise: 0.2, seed: 8 });
    expect(a.map((p) => p.y)).toEqual(b.map((p) => p.y));
    expect(a.map((p) => p.y)).not.toEqual(c.map((p) => p.y));
  });

  it('an open loop ignores the setpoint entirely', () => {
    const { trace } = run({ closedLoop: false, setpoint: 1, y0: 0 });
    expect(Math.abs(trace[trace.length - 1].y)).toBeLessThan(0.05);
  });

  it('respects actuator saturation', () => {
    const { trace } = run({ kp: 100, uMax: 2, setpoint: 1 });
    expect(Math.max(...trace.map((p) => Math.abs(p.u)))).toBeLessThanOrEqual(2 + 1e-9);
  });
});

describe('proportional control leaves a steady-state offset', () => {
  it('never quite reaches the setpoint with P alone', () => {
    const { trace, params } = run({ kp: 1, ki: 0, kd: 0, setpoint: 1, steps: 600 });
    const metrics = analyse(trace, params);
    expect(metrics.steadyStateError).toBeGreaterThan(0.01);
    expect(trace[trace.length - 1].y).toBeLessThan(1);
  });

  it('shrinks the offset as the gain grows', () => {
    const weak = metrics({ kp: 0.5, ki: 0, steps: 600 });
    const strong = metrics({ kp: 4, ki: 0, steps: 600 });
    expect(strong.steadyStateError).toBeLessThan(weak.steadyStateError);
  });

  it('closes the offset once integral action is added', () => {
    const { trace, params } = run({ kp: 1, ki: 1.2, kd: 0, steps: 1200 });
    expect(analyse(trace, params).steadyStateError).toBeLessThan(0.01);
  });
});

describe('gain, delay and stability — the core lesson of the loop', () => {
  it('a modest gain with no delay settles without oscillating', () => {
    const { trace, params } = run({ kp: 1.5, ki: 0.5, delaySteps: 0, steps: 800 });
    const metrics = analyse(trace, params);
    expect(metrics.settled).toBe(true);
    expect(metrics.oscillations).toBeLessThan(3);
  });

  it('the same gain with a long delay starts to ring', () => {
    const calm = metrics({ kp: 3, ki: 0.5, delaySteps: 0, steps: 800 });
    const delayed = metrics({ kp: 3, ki: 0.5, delaySteps: 25, steps: 800 });
    expect(delayed.oscillations).toBeGreaterThan(calm.oscillations);
  });

  it('enough gain and delay together make the loop unstable', () => {
    const { trace, params } = run({ kp: 14, ki: 0, delaySteps: 30, steps: 600 });
    const metrics = analyse(trace, params);
    expect(metrics.unstable).toBe(true);
    expect(metrics.settled).toBe(false);
  });

  it('derivative action damps the ringing that delay causes', () => {
    const ringing = metrics({ kp: 6, ki: 0.4, kd: 0, delaySteps: 12, steps: 900 });
    const damped = metrics({ kp: 6, ki: 0.4, kd: 1.5, delaySteps: 12, steps: 900 });
    expect(damped.overshoot).toBeLessThan(ringing.overshoot);
  });
});

describe('disturbance rejection', () => {
  it('a closed loop pushes back against a step disturbance', () => {
    const open = run({ closedLoop: false, disturbance: 0.5, setpoint: 0, y0: 0, steps: 600 });
    const closed = run({ closedLoop: true, disturbance: 0.5, setpoint: 0, y0: 0, kp: 4, ki: 1, steps: 600 });
    const drift = (trace: { y: number }[]) => Math.abs(trace[trace.length - 1].y);
    expect(drift(closed.trace)).toBeLessThan(drift(open.trace));
  });
});

describe('analyse', () => {
  // Damping of a PI loop on a first-order plant is (1+kp)/(2*sqrt(ki*tau)):
  // strong integral action against a modest proportional gain is underdamped.
  it('reports overshoot as a fraction of the setpoint', () => {
    const { trace, params } = run({ kp: 1, ki: 20, kd: 0, setpoint: 1, steps: 800 });
    const metrics = analyse(trace, params);
    expect(metrics.overshoot).toBeGreaterThan(0);
    expect(metrics.peak).toBeGreaterThan(1);
  });

  it('reports no overshoot for an overdamped tuning', () => {
    expect(metrics({ kp: 8, ki: 2, kd: 0, setpoint: 1, steps: 800 }).overshoot).toBe(0);
  });

  it('reports a settling time when the loop converges and none when it does not', () => {
    const good = run({ kp: 2, ki: 0.8, steps: 900 });
    expect(analyse(good.trace, good.params).settlingTime).not.toBeNull();
    const bad = run({ kp: 14, ki: 0, delaySteps: 30, steps: 600 });
    expect(analyse(bad.trace, bad.params).settlingTime).toBeNull();
  });

  it('scores a run for use as a graded goal', () => {
    const good = run({ kp: 2, ki: 0.8, steps: 900 });
    const bad = run({ kp: 14, ki: 0, delaySteps: 30, steps: 600 });
    expect(analyse(good.trace, good.params).score).toBeGreaterThan(0.7);
    expect(analyse(bad.trace, bad.params).score).toBeLessThan(0.3);
  });
});
