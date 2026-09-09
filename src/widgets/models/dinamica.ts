/**
 * ДИНАМИКА — логистическое отображение и аттрактор Лоренца.
 *
 * Два самых коротких контрпримера к бытовому «сложное поведение бывает у
 * сложных систем». В логистическом отображении одна строчка и один параметр, а
 * поведение проходит путь от покоя через удвоения периода к хаосу. У Лоренца
 * три уравнения и полная невозможность предсказания при полной
 * детерминированности.
 *
 * Для курса важно, что оба считаются точно и повторяемо: соседние траектории
 * расходятся из-за самой системы, а не из-за ошибок счёта.
 */

/* ── логистическое отображение ──────────────────────────────────────── */

/** xₙ₊₁ = r·xₙ·(1 − xₙ). Вся динамика — в этой строке. */
export const logisticStep = (x: number, r: number): number => r * x * (1 - x);

export function logisticOrbit(x0: number, r: number, steps: number): number[] {
  const out: number[] = [x0];
  let x = x0;
  for (let i = 0; i < steps; i += 1) {
    x = logisticStep(x, r);
    out.push(x);
  }
  return out;
}

/**
 * Точки, к которым система приходит при данном r: прогоняем переходный процесс
 * и собираем то, что осталось. Это столбец диаграммы бифуркаций.
 */
export function attractorAt(r: number, options: { warmup?: number; samples?: number; x0?: number } = {}): number[] {
  const warmup = options.warmup ?? 600;
  const samples = options.samples ?? 200;
  let x = options.x0 ?? 0.5;
  for (let i = 0; i < warmup; i += 1) x = logisticStep(x, r);
  const out: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    x = logisticStep(x, r);
    out.push(x);
  }
  return out;
}

/** Наблюдаемый период: сколько различных значений на аттракторе. */
export function period(values: readonly number[], epsilon = 1e-4): number {
  const unique: number[] = [];
  for (const v of values) {
    if (!unique.some((u) => Math.abs(u - v) < epsilon)) unique.push(v);
    if (unique.length > 64) return Infinity;
  }
  return unique.length;
}

/**
 * Показатель Ляпунова: средний логарифм растяжения. Положительный означает, что
 * соседние траектории расходятся, то есть предсказание имеет горизонт.
 */
export function lyapunov(r: number, steps = 4000, x0 = 0.4): number {
  let x = x0;
  let sum = 0;
  let counted = 0;
  for (let i = 0; i < steps; i += 1) {
    x = logisticStep(x, r);
    const slope = Math.abs(r * (1 - 2 * x));
    if (slope > 0) {
      sum += Math.log(slope);
      counted += 1;
    }
  }
  return counted > 0 ? sum / counted : 0;
}

/* ── аттрактор Лоренца ──────────────────────────────────────────────── */

export interface LorenzPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface LorenzParams {
  readonly sigma: number;
  readonly rho: number;
  readonly beta: number;
}

export const LORENZ: LorenzParams = { sigma: 10, rho: 28, beta: 8 / 3 };

const derivative = (p: LorenzPoint, k: LorenzParams): LorenzPoint => ({
  x: k.sigma * (p.y - p.x),
  y: p.x * (k.rho - p.z) - p.y,
  z: p.x * p.y - k.beta * p.z,
});

const shift = (p: LorenzPoint, d: LorenzPoint, h: number): LorenzPoint => ({
  x: p.x + d.x * h,
  y: p.y + d.y * h,
  z: p.z + d.z * h,
});

/**
 * Шаг Рунге–Кутты четвёртого порядка. Эйлер здесь не годится: на этих
 * масштабах он сам порождает расхождение, и тогда читатель видит ошибку метода,
 * а думает, что видит хаос.
 */
export function lorenzStep(p: LorenzPoint, dt: number, k: LorenzParams = LORENZ): LorenzPoint {
  const a = derivative(p, k);
  const b = derivative(shift(p, a, dt / 2), k);
  const c = derivative(shift(p, b, dt / 2), k);
  const d = derivative(shift(p, c, dt), k);
  return {
    x: p.x + ((a.x + 2 * b.x + 2 * c.x + d.x) * dt) / 6,
    y: p.y + ((a.y + 2 * b.y + 2 * c.y + d.y) * dt) / 6,
    z: p.z + ((a.z + 2 * b.z + 2 * c.z + d.z) * dt) / 6,
  };
}

export function lorenzTrail(
  start: LorenzPoint,
  steps: number,
  dt = 0.006,
  k: LorenzParams = LORENZ,
): LorenzPoint[] {
  const out: LorenzPoint[] = [start];
  let p = start;
  for (let i = 0; i < steps; i += 1) {
    p = lorenzStep(p, dt, k);
    out.push(p);
  }
  return out;
}

export const distance = (a: LorenzPoint, b: LorenzPoint): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
