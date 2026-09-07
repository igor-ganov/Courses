/**
 * A discrete-time feedback loop: first-order plant, PID controller, transport
 * delay in the measurement path, step disturbance and measurement noise.
 *
 * This one model carries most of the introductory course's intuitions:
 *
 * - proportional action alone leaves a permanent offset;
 * - integral action removes the offset but adds lag;
 * - delay is what turns "more gain" from a fix into a cause of oscillation;
 * - derivative action buys back some phase, at the price of noise sensitivity.
 *
 * The whole trace is computed at once (a few hundred cheap steps), so dragging a
 * slider re-simulates instantly and the learner sees cause and effect in the
 * same gesture. The widget animates a playhead over the finished trace.
 */

export interface LoopParams {
  /** Seconds per step. */
  dt: number;
  steps: number;
  /** Plant time constant: how sluggish the thing being controlled is. */
  tau: number;
  /** Plant gain: output per unit of actuator effort. */
  plantGain: number;
  setpoint: number;
  y0: number;
  kp: number;
  ki: number;
  kd: number;
  /** Measurement transport delay, in steps. The troublemaker. */
  delaySteps: number;
  /** Std-dev of measurement noise. */
  noise: number;
  /** Constant load pushing on the plant. */
  disturbance: number;
  /** Actuator saturation, symmetric. */
  uMax: number;
  /** When false the controller is bypassed: pure open-loop behaviour. */
  closedLoop: boolean;
  seed: number;
}

export const defaultLoopParams: LoopParams = {
  dt: 0.05,
  steps: 600,
  tau: 1,
  plantGain: 1,
  setpoint: 1,
  y0: 0,
  kp: 2,
  ki: 0.5,
  kd: 0,
  delaySteps: 0,
  noise: 0,
  disturbance: 0,
  uMax: 10,
  closedLoop: true,
  seed: 1,
};

export interface LoopSample {
  t: number;
  /** True plant output. */
  y: number;
  /** What the sensor reports: delayed and noisy. */
  measured: number;
  /** Controller output after saturation. */
  u: number;
  /** Error the controller acted on. */
  e: number;
  setpoint: number;
}

/** Small, fast, seeded PRNG so "noisy" runs stay reproducible in tests. */
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

/** Box–Muller, so noise is Gaussian rather than uniform. */
function gaussian(rand: () => number): number {
  const u = Math.max(rand(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));

/** Time constant of the derivative low-pass, in seconds. */
const DERIVATIVE_FILTER_TAU = 0.1;

export function simulateLoop(params: LoopParams): LoopSample[] {
  const { dt, steps, tau, plantGain, setpoint, y0, kp, ki, kd, delaySteps, noise, disturbance, uMax, closedLoop } =
    params;

  const rand = mulberry32(params.seed);
  const history: number[] = [];
  const trace: LoopSample[] = [];

  let y = y0;
  let integral = 0;
  let previousError = 0;
  let derivativeFiltered = 0;

  for (let k = 0; k < steps; k += 1) {
    history.push(y);

    // The sensor sees the past, not the present — this is where delay enters.
    const delayedIndex = Math.max(0, history.length - 1 - Math.round(delaySteps));
    const measured = history[delayedIndex] + (noise > 0 ? gaussian(rand) * noise : 0);

    const error = setpoint - measured;

    let u = 0;
    if (closedLoop) {
      const derivative = k === 0 ? 0 : (error - previousError) / dt;
      derivativeFiltered +=
        (dt / (dt + DERIVATIVE_FILTER_TAU)) * (derivative - derivativeFiltered);

      const unsaturated = kp * error + ki * integral + kd * derivativeFiltered;
      u = clamp(unsaturated, uMax);
      // Anti-windup: stop integrating once the actuator is pinned, otherwise the
      // integral term keeps growing and the loop overshoots wildly on release.
      if (Math.abs(unsaturated - u) < 1e-9) integral += error * dt;
    }

    trace.push({ t: k * dt, y, measured, u, e: closedLoop ? error : 0, setpoint });

    previousError = error;
    y += (dt / tau) * (plantGain * u + disturbance - y);
  }

  return trace;
}

export interface LoopMetrics {
  /** |setpoint − mean of the last 10%| */
  steadyStateError: number;
  /** Highest excursion above the setpoint, as a fraction of the setpoint. */
  overshoot: number;
  peak: number;
  /** Seconds until the output stays inside the tolerance band, or null. */
  settlingTime: number | null;
  settled: boolean;
  /** Times the output crossed the setpoint — a proxy for ringing. */
  oscillations: number;
  /** True when the output never stops swinging. */
  unstable: boolean;
  /** Mean absolute error after the rise phase. */
  iae: number;
  /** 0..1 quality of the run, used when a lecture grades a tuning exercise. */
  score: number;
}

const SETTLING_BAND = 0.02;
/** Ignore the first fifth of the run: rise time is not an error. */
const GRACE_FRACTION = 0.2;

export function analyse(trace: readonly LoopSample[], params: LoopParams): LoopMetrics {
  if (trace.length === 0) {
    return {
      steadyStateError: 0, overshoot: 0, peak: 0, settlingTime: null,
      settled: false, oscillations: 0, unstable: false, iae: 0, score: 0,
    };
  }

  const { setpoint, dt } = params;
  const scale = Math.max(Math.abs(setpoint), 1);
  const band = Math.max(Math.abs(setpoint) * SETTLING_BAND, 0.02);

  const tailStart = Math.floor(trace.length * 0.9);
  const tail = trace.slice(tailStart);
  const tailMean = tail.reduce((sum, p) => sum + p.y, 0) / tail.length;
  const steadyStateError = Math.abs(setpoint - tailMean);

  const peak = Math.max(...trace.map((p) => p.y));
  const overshoot = Math.abs(setpoint) > 1e-9 ? Math.max(0, (peak - setpoint) / Math.abs(setpoint)) : 0;

  // Settling time: the last moment the output left the band, plus one step.
  let settlingIndex: number | null = null;
  for (let i = trace.length - 1; i >= 0; i -= 1) {
    if (Math.abs(trace[i].y - setpoint) > band) {
      settlingIndex = i + 1;
      break;
    }
  }
  if (settlingIndex === null) settlingIndex = 0;
  const settled = settlingIndex < trace.length;
  const settlingTime = settled ? settlingIndex * dt : null;

  let oscillations = 0;
  for (let i = 1; i < trace.length; i += 1) {
    const before = trace[i - 1].y - setpoint;
    const after = trace[i].y - setpoint;
    if (before !== 0 && Math.sign(before) !== Math.sign(after) && after !== 0) oscillations += 1;
  }

  const lastQuarter = trace.slice(Math.floor(trace.length * 0.75));
  const values = lastQuarter.map((p) => p.y);
  const peakToPeak = Math.max(...values) - Math.min(...values);
  const unstable = !settled && peakToPeak > 0.5 * scale;

  const graded = trace.slice(Math.floor(trace.length * GRACE_FRACTION));
  const iae = graded.reduce((sum, p) => sum + Math.abs(p.y - setpoint), 0) / graded.length;

  let score = Math.min(1, Math.max(0, 1 - iae / (0.5 * scale)));
  if (unstable) score = Math.min(score, 0.15);

  return {
    steadyStateError,
    overshoot,
    peak,
    settlingTime,
    settled,
    oscillations,
    unstable,
    iae,
    score: Number(score.toFixed(4)),
  };
}
