/**
 * State space: the geometry behind "stability", "equilibrium" and "attractor".
 *
 * Three objects, three lessons:
 *
 * - a **damped spiral** in the plane, where the sign of one number decides
 *   whether a system returns to rest or tears itself apart;
 * - a **potential landscape** with several wells, which turns "equilibrium",
 *   "basin of attraction" and "a nudge big enough to change the outcome" into
 *   something you can push a ball around inside;
 * - the **Lorenz attractor**, where the trajectory is bounded, deterministic and
 *   still unpredictable — determinism and predictability come apart, and with
 *   them the fantasy of controlling a system by knowing its equations.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Lorenz
// ---------------------------------------------------------------------------

export interface LorenzParams {
  sigma: number;
  rho: number;
  beta: number;
}

export const DEFAULT_LORENZ: LorenzParams = { sigma: 10, rho: 28, beta: 8 / 3 };

const lorenzDerivative = (s: Vec3, p: LorenzParams): Vec3 => ({
  x: p.sigma * (s.y - s.x),
  y: s.x * (p.rho - s.z) - s.y,
  z: s.x * s.y - p.beta * s.z,
});

const add = (a: Vec3, b: Vec3, scale: number): Vec3 => ({
  x: a.x + b.x * scale,
  y: a.y + b.y * scale,
  z: a.z + b.z * scale,
});

/** One Runge-Kutta 4 step: accurate enough that the shape is the real one. */
export function stepLorenz(state: Vec3, dt: number, params: LorenzParams = DEFAULT_LORENZ): Vec3 {
  const k1 = lorenzDerivative(state, params);
  const k2 = lorenzDerivative(add(state, k1, dt / 2), params);
  const k3 = lorenzDerivative(add(state, k2, dt / 2), params);
  const k4 = lorenzDerivative(add(state, k3, dt), params);
  return {
    x: state.x + (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
    y: state.y + (dt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
    z: state.z + (dt / 6) * (k1.z + 2 * k2.z + 2 * k3.z + k4.z),
  };
}

export function lorenzTrajectory(
  start: Vec3,
  steps: number,
  dt = 0.005,
  params: LorenzParams = DEFAULT_LORENZ,
): Vec3[] {
  const path: Vec3[] = [];
  let state = start;
  for (let i = 0; i < steps; i += 1) {
    path.push(state);
    state = stepLorenz(state, dt, params);
  }
  return path;
}

// ---------------------------------------------------------------------------
// Potential landscape
// ---------------------------------------------------------------------------

export interface Well {
  x: number;
  y: number;
  depth: number;
  width: number;
  label: string;
}

/** A gentle bowl keeps the whole landscape bounded, so nothing rolls to infinity. */
const BOWL = 0.01;

export const DEFAULT_WELLS: readonly Well[] = [
  { x: -4, y: 0, depth: 1.2, width: 1.8, label: 'Режим A' },
  { x: 0, y: 3, depth: 0.8, width: 1.8, label: 'Режим B' },
  { x: 4, y: -1, depth: 1.0, width: 1.8, label: 'Режим C' },
];

export function potentialAt(x: number, y: number, wells: readonly Well[]): number {
  let value = BOWL * (x * x + y * y);
  for (const well of wells) {
    const dx = x - well.x;
    const dy = y - well.y;
    value -= well.depth * Math.exp(-(dx * dx + dy * dy) / (2 * well.width * well.width));
  }
  return value;
}

export function gradientAt(x: number, y: number, wells: readonly Well[]): Vec2 {
  let gx = 2 * BOWL * x;
  let gy = 2 * BOWL * y;
  for (const well of wells) {
    const dx = x - well.x;
    const dy = y - well.y;
    const sigma2 = well.width * well.width;
    const gauss = well.depth * Math.exp(-(dx * dx + dy * dy) / (2 * sigma2));
    gx += (gauss * dx) / sigma2;
    gy += (gauss * dy) / sigma2;
  }
  return { x: gx, y: gy };
}

/** One downhill step. Gradient descent is the simplest honest "relaxation". */
export function rollBall(position: Vec2, wells: readonly Well[], rate = 0.15): Vec2 {
  const gradient = gradientAt(position.x, position.y, wells);
  return { x: position.x - rate * gradient.x, y: position.y - rate * gradient.y };
}

/** Roll until the motion stops: where does this state of affairs end up? */
export function settle(start: Vec2, wells: readonly Well[], steps = 2000, rate = 0.15): Vec2 {
  let position = start;
  for (let i = 0; i < steps; i += 1) {
    const next = rollBall(position, wells, rate);
    if (Math.hypot(next.x - position.x, next.y - position.y) < 1e-9) return next;
    position = next;
  }
  return position;
}

/** Which equilibrium this starting point belongs to. */
export function basinOf(start: Vec2, wells: readonly Well[]): number {
  const rest = settle(start, wells);
  let best = -1;
  let bestDistance = Infinity;
  wells.forEach((well, index) => {
    const distance = Math.hypot(rest.x - well.x, rest.y - well.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

// ---------------------------------------------------------------------------
// Damped oscillator in the phase plane
// ---------------------------------------------------------------------------

const spiralDerivative = (s: Vec2, damping: number, omega: number): Vec2 => ({
  x: -damping * s.x - omega * s.y,
  y: omega * s.x - damping * s.y,
});

/**
 * Positive damping spirals in (stable), zero holds a circle (marginal), negative
 * spirals out (unstable). One sign, three qualitatively different worlds.
 */
export function spiralTrajectory(
  start: Vec2,
  damping: number,
  omega: number,
  steps: number,
  dt: number,
): Vec2[] {
  const path: Vec2[] = [];
  let state = start;
  for (let i = 0; i < steps; i += 1) {
    path.push(state);
    const k1 = spiralDerivative(state, damping, omega);
    const k2 = spiralDerivative({ x: state.x + (k1.x * dt) / 2, y: state.y + (k1.y * dt) / 2 }, damping, omega);
    const k3 = spiralDerivative({ x: state.x + (k2.x * dt) / 2, y: state.y + (k2.y * dt) / 2 }, damping, omega);
    const k4 = spiralDerivative({ x: state.x + k3.x * dt, y: state.y + k3.y * dt }, damping, omega);
    state = {
      x: state.x + (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
      y: state.y + (dt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
    };
  }
  return path;
}
