/**
 * КОНТУР РЕГУЛИРОВАНИЯ — модель, а не картинка.
 *
 * Виджет, в котором регулятор ведёт себя не так, как настоящий, учит неправде,
 * и учит убедительно: читатель видел это своими глазами. Поэтому здесь всё,
 * что делает контур контуром, и ничего сверх:
 *
 *   — объект первого порядка с постоянной времени τ и остыванием к среде;
 *   — транспортное запаздывание: воздействие доходит не сразу, и именно оно
 *     ставит предел усилению;
 *   — насыщение исполнительного органа: мощность конечна;
 *   — ограничение накопления интеграла — без него насыщенный контур копит
 *     ошибку и потом её отрабатывает с чудовищным перелётом;
 *   — дифференциальная составляющая по измерению, а не по ошибке: иначе
 *     каждый сдвиг задания даёт удар в исполнительный орган;
 *   — шум с зерном: одно зерно — одна и та же история, иначе задание нельзя
 *     ни проверить, ни обсудить.
 *
 * Модель чистая и без экрана: её гоняют тесты, а виджет только рисует.
 */

export interface LoopSettings {
  /** Куда ведём. */
  readonly setpoint: number;
  /** Куда всё скатывается само. */
  readonly ambient: number;
  /** С чего начинается объект. По умолчанию — со среды. */
  readonly start?: number;
  /** Сколько градусов даёт единица воздействия. */
  readonly gain: number;
  /** Постоянная времени объекта, секунды. */
  readonly tau: number;
  /** Транспортное запаздывание, секунды. */
  readonly delay: number;
  readonly kp: number;
  readonly ki: number;
  readonly kd: number;
  readonly uMin: number;
  readonly uMax: number;
  /** Среднеквадратичный шум измерения. */
  readonly noise: number;
  readonly seed: number;
  readonly dt: number;
  /** Ограничивать накопление интеграла при насыщении. По умолчанию да. */
  readonly antiWindup?: boolean;
}

export interface LoopGoal {
  /** Допуск, внутри которого считается «удержано». */
  readonly tolerance: number;
  /** Сколько секунд подряд надо удержать. */
  readonly hold: number;
}

export interface LoopState {
  readonly time: number;
  /** Истинное состояние объекта. */
  readonly output: number;
  /** Что видит регулятор: истина плюс шум. */
  readonly measured: number;
  readonly control: number;
  readonly error: number;
  readonly integral: number;
  /** Сколько секунд подряд держимся в допуске. */
  readonly settled: number;
}

export interface Loop {
  step(): LoopState;
  state(): LoopState;
  /** История для графика: кольцевой буфер, чтобы не расти без предела. */
  history(): readonly LoopState[];
  reset(): void;
  set(patch: Partial<LoopSettings>): void;
  settings(): LoopSettings;
  goal(): { goal: 'settled'; reached: boolean; score: number };
}

/* Быстрый детерминированный генератор. Нужен именно повторяемый: без него один
   и тот же набор ручек даёт разный результат, и задание превращается в лотерею. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Нормальный шум из равномерного: сумма двух даёт приемлемый колокол дёшево. */
function gauss(rnd: () => number): number {
  return rnd() + rnd() - 1;
}

const HISTORY = 4000;

export function createLoop(settings: LoopSettings, goal?: LoopGoal): Loop {
  let cfg: LoopSettings = { antiWindup: true, ...settings };
  let rnd = mulberry32(cfg.seed);

  let time = 0;
  let output = cfg.start ?? cfg.ambient;
  let integral = 0;
  let lastMeasured = cfg.start ?? cfg.ambient;
  let control = 0;
  let error = 0;
  let settled = 0;
  let bestSettled = 0;
  let queue: number[] = [];
  let log: LoopState[] = [];

  const snapshot = (): LoopState => ({
    time,
    output,
    measured: lastMeasured,
    control,
    error,
    integral,
    settled,
  });

  function reset(): void {
    rnd = mulberry32(cfg.seed);
    time = 0;
    output = cfg.start ?? cfg.ambient;
    integral = 0;
    lastMeasured = cfg.start ?? cfg.ambient;
    control = 0;
    error = 0;
    settled = 0;
    bestSettled = 0;
    queue = [];
    log = [];
  }

  function step(): LoopState {
    const dt = cfg.dt;

    /* Измерение — не истина: датчик шумит, и регулятор работает с тем, что
       видит. Именно поэтому дифференциальная составляющая опасна. */
    const measured = output + (cfg.noise > 0 ? gauss(rnd) * cfg.noise : 0);
    error = cfg.setpoint - measured;

    /* Производная по измерению, а не по ошибке: при сдвиге задания
       производная ошибки даёт бесконечный всплеск, и орган получает удар. */
    const derivative = (measured - lastMeasured) / dt;

    const raw = cfg.kp * error + cfg.ki * integral - cfg.kd * derivative;
    control = Math.min(cfg.uMax, Math.max(cfg.uMin, raw));

    /* Ограничение накопления. Интеграл растёт только если это не толкает
       насыщенный орган ещё дальше в упор. */
    const насыщен = raw !== control;
    const толкает = насыщен && Math.sign(error) === Math.sign(raw - control);
    if (!(cfg.antiWindup && толкает)) integral += error * dt;

    /* Транспортное запаздывание: то, что подано сейчас, дойдёт через delay. */
    const шагов = Math.max(0, Math.round(cfg.delay / dt));
    queue.push(control);
    const applied = queue.length > шагов ? queue.shift()! : 0;

    /* Объект первого порядка: тянется к равновесию, равновесие сдвинуто
       воздействием. */
    const target = cfg.ambient + cfg.gain * applied;
    output += ((target - output) / cfg.tau) * dt;

    lastMeasured = measured;
    time += dt;

    if (goal) {
      settled = Math.abs(cfg.setpoint - output) <= goal.tolerance ? settled + dt : 0;
      bestSettled = Math.max(bestSettled, settled);
    }

    const s = snapshot();
    log.push(s);
    if (log.length > HISTORY) log.shift();
    return s;
  }

  return {
    step,
    state: snapshot,
    history: () => log,
    reset,
    settings: () => cfg,
    set(patch) {
      cfg = { ...cfg, ...patch };
      if (patch.seed !== undefined) rnd = mulberry32(cfg.seed);
    },
    goal() {
      if (!goal) return { goal: 'settled' as const, reached: false, score: 0 };
      const reached = bestSettled >= goal.hold;
      /* Частичный балл — доля удержанного времени. «Нет» без числа не
         говорит читателю, близко он был или нет. */
      return {
        goal: 'settled' as const,
        reached,
        score: Math.min(1, bestSettled / goal.hold),
      };
    },
  };
}
