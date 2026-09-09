import { describe, expect, it } from 'vitest';
import { createLoop, type LoopSettings } from './contorno';

/* Физика контура проверяется, а не предполагается. Виджет, в котором регулятор
   ведёт себя не так, как настоящий, учит неправде — и учит убедительно, потому
   что читатель видел это своими глазами.

   Проверяются те свойства, ради которых контур и показывают: пропорциональный
   регулятор оставляет статическую ошибку, интеграл её убирает, запаздывание
   ставит предел усилению, насыщение накапливает интеграл, если его не
   остановить. */

const базовые = (over: Partial<LoopSettings> = {}): LoopSettings => ({
  setpoint: 21,
  ambient: 5,
  gain: 1.6,
  tau: 12,
  delay: 0,
  kp: 0,
  ki: 0,
  kd: 0,
  uMin: 0,
  uMax: 100,
  noise: 0,
  seed: 1,
  dt: 0.25,
  ...over,
});

/** Прогнать контур и вернуть последнее состояние. */
function прогнать(settings: LoopSettings, seconds: number) {
  const loop = createLoop(settings);
  const шагов = Math.round(seconds / settings.dt);
  for (let i = 0; i < шагов; i += 1) loop.step();
  return loop.state();
}

describe('объект без регулятора', () => {
  it('остывает к среде: без воздействия контур не удерживает ничего', () => {
    const s = прогнать(базовые({ setpoint: 21 }), 400);
    expect(s.output).toBeCloseTo(5, 1);
  });

  it('постоянная времени — это она и есть: за τ проходится ~63 % пути', () => {
    const settings = базовые({ kp: 0, ki: 0, tau: 12, ambient: 25, start: 5 });
    const loop = createLoop(settings);
    for (let i = 0; i < Math.round(12 / settings.dt); i += 1) loop.step();
    const путь = (loop.state().output - 5) / (25 - 5);
    expect(путь).toBeGreaterThan(0.6);
    expect(путь).toBeLessThan(0.68);
  });
});

describe('пропорциональный регулятор', () => {
  it('оставляет статическую ошибку — и это главное, что о нём нужно знать', () => {
    const s = прогнать(базовые({ kp: 4 }), 600);
    expect(s.output).toBeLessThan(21);
    expect(21 - s.output).toBeGreaterThan(0.5);
  });

  it('чем больше усиление, тем меньше остаток, но нулём он не становится', () => {
    const слабо = 21 - прогнать(базовые({ kp: 2 }), 600).output;
    const сильно = 21 - прогнать(базовые({ kp: 8 }), 600).output;
    expect(сильно).toBeLessThan(слабо);
    expect(сильно).toBeGreaterThan(0);
  });
});

describe('интегральная составляющая', () => {
  it('убирает статическую ошибку', () => {
    const s = прогнать(базовые({ kp: 4, ki: 0.4 }), 900);
    expect(Math.abs(21 - s.output)).toBeLessThan(0.1);
  });
});

describe('запаздывание', () => {
  it('ставит предел усилению: то, что было устойчиво без него, начинает качаться', () => {
    const без = прогнать(базовые({ kp: 14, ki: 0.5, delay: 0 }), 600);
    const с = createLoop(базовые({ kp: 14, ki: 0.5, delay: 6 }));
    let размах = 0;
    let мин = Infinity;
    let макс = -Infinity;
    for (let i = 0; i < 2400; i += 1) {
      с.step();
      if (i > 1200) {
        мин = Math.min(мин, с.state().output);
        макс = Math.max(макс, с.state().output);
      }
    }
    размах = макс - мин;
    expect(Math.abs(21 - без.output)).toBeLessThan(0.2);
    expect(размах).toBeGreaterThan(1);
  });

  it('воздействие доходит до объекта не раньше, чем через запаздывание', () => {
    const loop = createLoop(базовые({ kp: 10, delay: 5 }));
    const начало = loop.state().output;
    for (let i = 0; i < Math.round(4 / 0.25); i += 1) loop.step();
    // Регулятор давно требует греть, но до объекта ничего ещё не дошло.
    expect(loop.state().control).toBeGreaterThan(0);
    expect(loop.state().output).toBeCloseTo(начало, 9);
    for (let i = 0; i < Math.round(4 / 0.25); i += 1) loop.step();
    expect(loop.state().output).toBeGreaterThan(начало + 0.5);
  });
});

describe('насыщение и накопление интеграла', () => {
  it('воздействие не выходит за пределы органа', () => {
    const loop = createLoop(базовые({ kp: 50, ki: 5, uMax: 40 }));
    for (let i = 0; i < 400; i += 1) {
      loop.step();
      expect(loop.state().control).toBeLessThanOrEqual(40 + 1e-9);
      expect(loop.state().control).toBeGreaterThanOrEqual(0);
    }
  });

  it('без ограничения накопления интеграл разносит систему, с ним — нет', () => {
    const общее = базовые({ kp: 6, ki: 1.2, uMax: 12, setpoint: 60 });
    const дикий = createLoop({ ...общее, antiWindup: false });
    const умный = createLoop({ ...общее, antiWindup: true });
    for (let i = 0; i < 1600; i += 1) {
      дикий.step();
      умный.step();
    }
    expect(Math.abs(дикий.state().integral)).toBeGreaterThan(
      Math.abs(умный.state().integral) * 5,
    );
  });
});

describe('шум', () => {
  it('одно зерно — одна и та же история: иначе задание нельзя проверить', () => {
    const a = прогнать(базовые({ kp: 4, noise: 0.5, seed: 7 }), 100);
    const b = прогнать(базовые({ kp: 4, noise: 0.5, seed: 7 }), 100);
    const c = прогнать(базовые({ kp: 4, noise: 0.5, seed: 8 }), 100);
    expect(a.output).toBe(b.output);
    expect(a.output).not.toBe(c.output);
  });

  it('дифференциальная составляющая усиливает шум — это её цена', () => {
    const тихо = createLoop(базовые({ kp: 4, kd: 0, noise: 0.4, seed: 3 }));
    const шумно = createLoop(базовые({ kp: 4, kd: 8, noise: 0.4, seed: 3 }));
    let a = 0;
    let b = 0;
    let прошлое_a = 0;
    let прошлое_b = 0;
    for (let i = 0; i < 800; i += 1) {
      тихо.step();
      шумно.step();
      if (i > 200) {
        a += Math.abs(тихо.state().control - прошлое_a);
        b += Math.abs(шумно.state().control - прошлое_b);
      }
      прошлое_a = тихо.state().control;
      прошлое_b = шумно.state().control;
    }
    expect(b).toBeGreaterThan(a * 2);
  });
});

describe('цель задания', () => {
  it('сообщает, удержан ли контур в допуске нужное время', () => {
    const loop = createLoop(базовые({ kp: 6, ki: 0.5 }), { tolerance: 0.5, hold: 30 });
    for (let i = 0; i < 4000; i += 1) loop.step();
    const цель = loop.goal();
    expect(цель.goal).toBe('settled');
    expect(цель.reached).toBe(true);
  });

  it('пока не удержан — сообщает долю пройденного, а не просто «нет»', () => {
    const loop = createLoop(базовые({ kp: 0.2 }), { tolerance: 0.2, hold: 30 });
    for (let i = 0; i < 200; i += 1) loop.step();
    const цель = loop.goal();
    expect(цель.reached).toBe(false);
    expect(цель.score).toBeGreaterThanOrEqual(0);
    expect(цель.score).toBeLessThan(1);
  });
});
