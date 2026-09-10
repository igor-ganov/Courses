/**
 * ПРОБЫ — модель того, как проверка здоровья убивает здоровую службу.
 *
 * Виток утверждает: проба живости отвечает на вопрос «нужен ли
 * перезапуск», а не «хорошо ли идут дела», и тесная проба превращает наплыв
 * в полный отказ. Утверждение сильное, и на слово его брать не надо — здесь
 * оно воспроизведено механикой:
 *
 *   — время ответа растёт с нагрузкой на экземпляр, и растёт нелинейно:
 *     вдвое больше запросов — вчетверо дольше ответ;
 *   — проба живости смотрит на время ответа. Не уложился `timeout` подряд
 *     `threshold` раз — экземпляр убит и поднимается заново;
 *   — убитый экземпляр не принимает нагрузку, и его доля переходит к
 *     оставшимся. Им становится тяжелее, они тоже не укладываются в
 *     `timeout`, и это положительная обратная связь: служба выкашивается
 *     целиком, не будучи сломанной ни в одном месте;
 *   — проба готовности, если она включена, убирает поднимающийся экземпляр
 *     из-под нагрузки. Без неё запросы идут в того, кто ещё не готов, и
 *     теряются полностью.
 *
 * Модель чистая и без экрана: её гоняют тесты, а виджет только рисует.
 */

export type ReplicaPhase = 'running' | 'starting';

export interface Replica {
  readonly id: number;
  readonly phase: ReplicaPhase;
  /** Время ответа, секунды. Ноль — не принимает нагрузку. */
  readonly latency: number;
  /** Сколько раз подряд не уложился в срок пробы живости. */
  readonly fails: number;
  /** Принимает ли запросы прямо сейчас. */
  readonly serving: boolean;
  /** Сколько раз перезапускался за прогон. */
  readonly restarts: number;
}

export interface SondeSettings {
  readonly replicas: number;
  /** Сколько запросов в секунду держит один экземпляр без роста времени. */
  readonly capacity: number;
  /**
   * Во сколько раз сверх ёмкости очередь ещё держит запросы, не теряя их.
   *
   * Разделение важно: время ответа портится задолго до того, как запросы
   * начинают пропадать. Именно в этом зазоре и живёт беда — служба ещё
   * работает, просто медленнее, а тесная проба уже считает её мёртвой.
   */
  readonly queue: number;
  /** Время ответа без нагрузки, секунды. */
  readonly base: number;
  /** Запросов в секунду в спокойное время. */
  readonly calm: number;
  /** Запросов в секунду во время наплыва. */
  readonly surge: number;
  /** Когда начинается наплыв и сколько длится, секунды. */
  readonly surgeAt: number;
  readonly surgeFor: number;
  /** Сколько экземпляр поднимается после перезапуска, секунды. */
  readonly startup: number;
  /** Как часто задаётся проба живости, секунды. */
  readonly period: number;
  /** Срок, в который надо уложиться, секунды. Ручка читателя. */
  readonly timeout: number;
  /** Сколько отказов подряд до перезапуска. Ручка читателя. */
  readonly threshold: number;
  /** Включена ли проба готовности. Ручка читателя. */
  readonly readiness: boolean;
  readonly dt: number;
}

export interface SondeState {
  readonly time: number;
  readonly replicas: readonly Replica[];
  /** Запросов в секунду прямо сейчас. */
  readonly load: number;
  /** Идёт ли наплыв. */
  readonly surging: boolean;
  /** Всего запросов и сколько из них потеряно. */
  readonly requests: number;
  readonly errors: number;
  /**
   * Сколько запросов ушло в поднимающийся экземпляр — то есть в пустоту.
   *
   * Это и есть настоящая работа пробы готовности, и мерить её надо отдельно
   * от общих потерь: во время обвала готовность общие потери даже
   * увеличивает — снятый экземпляр отдаёт нагрузку выжившим, и те падают
   * быстрее. А вот запросы в пустоту она убирает всегда и полностью.
   */
  readonly wasted: number;
  /** Доля потерянных за весь прогон. */
  readonly errorRate: number;
  /** Сколько перезапусков случилось всего. */
  readonly restarts: number;
  /** Прогон кончился. */
  readonly done: boolean;
}

export interface SondeGoal {
  /** Какую долю потерь считать проигрышем. */
  readonly maxErrors: number;
}

export interface Sonde {
  step(): SondeState;
  state(): SondeState;
  reset(): void;
  set(patch: Partial<SondeSettings>): void;
  settings(): SondeSettings;
  goal(): { goal: 'endured'; reached: boolean; score: number };
}

interface Живая {
  id: number;
  phase: ReplicaPhase;
  age: number;
  fails: number;
  latency: number;
  restarts: number;
  /** До своей следующей пробы. У каждого экземпляра она своя. */
  доПробы: number;
}

export function createSonde(settings: SondeSettings, goal?: SondeGoal): Sonde {
  let cfg: SondeSettings = { ...settings };
  let time = 0;
  let реплики: Живая[] = [];
  let запросов = 0;
  let потеряно = 0;
  let вПустоту = 0;

  function завести(): void {
    time = 0;
    запросов = 0;
    потеряно = 0;
    вПустоту = 0;
    реплики = Array.from({ length: cfg.replicas }, (_, i) => ({
      id: i + 1,
      phase: 'running' as ReplicaPhase,
      age: 0,
      fails: 0,
      latency: cfg.base,
      restarts: 0,
      /* Пробы разнесены по времени, и это не украшение модели.
         
         Kubelet на каждом узле опрашивает свои поды по своему расписанию, и
         синхронного опроса всей службы не бывает. Сначала здесь была одна
         проба на всех, и экземпляры умирали одновременно — а тогда не
         бывает состояния «один поднимается, двое работают», ради которого
         и нужна проба готовности. Разнос по фазе возвращает это состояние
         и заодно делает обвал последовательным, каким он и выглядит в жизни. */
      доПробы: (cfg.period * (i + 1)) / cfg.replicas,
    }));
  }

  завести();

  const наплыв = () => time >= cfg.surgeAt && time < cfg.surgeAt + cfg.surgeFor;
  const нагрузка = () => (наплыв() ? cfg.surge : cfg.calm);

  /** Кто принимает запросы. Готовность решает, попадёт ли в этот список
      поднимающийся экземпляр. */
  const принимают = (r: Живая) => (cfg.readiness ? r.phase === 'running' : true);

  const конец = () => time >= cfg.surgeAt + cfg.surgeFor + 10;

  function снимок(): SondeState {
    return {
      time: Number(time.toFixed(2)),
      replicas: реплики.map((r) => ({
        id: r.id,
        phase: r.phase,
        latency: Number(r.latency.toFixed(3)),
        fails: r.fails,
        serving: принимают(r),
        restarts: r.restarts,
      })),
      load: нагрузка(),
      surging: наплыв(),
      requests: Math.round(запросов),
      errors: Math.round(потеряно),
      wasted: Math.round(вПустоту),
      errorRate: запросов > 0 ? Number((потеряно / запросов).toFixed(4)) : 0,
      restarts: реплики.reduce((н, r) => н + r.restarts, 0),
      done: конец(),
    };
  }

  function step(): SondeState {
    if (конец()) return снимок();
    const dt = cfg.dt;
    time += dt;

    for (const r of реплики) {
      r.age += dt;
      if (r.phase === 'starting' && r.age >= cfg.startup) {
        r.phase = 'running';
        r.age = 0;
        r.fails = 0;
      }
    }

    /* Нагрузка делится на тех, кто её принимает. Если не принимает никто —
       теряется всё: это и есть полный отказ. */
    const берущие = реплики.filter(принимают);
    const запросы = нагрузка() * dt;
    запросов += запросы;

    if (берущие.length === 0) {
      потеряно += запросы;
      for (const r of реплики) {
        r.latency = 0;
        r.доПробы -= dt;
        if (r.доПробы <= 0) r.доПробы = cfg.period;
      }
      return снимок();
    }

    const доля = нагрузка() / берущие.length;
    for (const r of реплики) {
      if (!принимают(r)) {
        r.latency = 0;
        continue;
      }
      /* Время ответа растёт квадратично от перегрузки: это грубо, но верно
         по существу — очередь на входе растёт быстрее, чем поток. */
      const пере = доля / cfg.capacity;
      r.latency = cfg.base * (1 + пере * пере);
    }

    /* Потери. Запросы к поднимающемуся теряются полностью — он ещё не
       отвечает; запросы сверх ёмкости теряются частично. */
    for (const r of берущие) {
      const их = запросы / берущие.length;
      if (r.phase === 'starting') {
        потеряно += их;
        вПустоту += их;
        continue;
      }
      const пере = доля / cfg.capacity;
      if (пере > cfg.queue) потеряно += их * Math.min(1, (пере - cfg.queue) / пере);
    }

    /* Проба живости. Смотрит на время ответа — то есть на то, «хорошо ли
       идут дела», а не на то, «завис ли процесс». В этом вся беда. */
    for (const r of реплики) {
      r.доПробы -= dt;
      if (r.доПробы > 0) continue;
      r.доПробы = cfg.period;
      if (r.phase !== 'running') continue;
      if (r.latency > cfg.timeout) r.fails += 1;
      else r.fails = 0;
      if (r.fails >= cfg.threshold) {
        r.phase = 'starting';
        r.age = 0;
        r.fails = 0;
        r.restarts += 1;
        r.latency = 0;
      }
    }

    return снимок();
  }

  return {
    step,
    state: снимок,
    reset: завести,
    settings: () => cfg,
    set(patch) {
      cfg = { ...cfg, ...patch };
    },
    goal() {
      if (!goal) return { goal: 'endured' as const, reached: false, score: 0 };
      const s = снимок();
      const reached = s.done && s.errorRate <= goal.maxErrors;
      /* Балл — доля пройденного прогона, ухудшенная потерями: «нет» без
         числа не говорит читателю, близко он был или нет. */
      const прошло = Math.min(1, time / (cfg.surgeAt + cfg.surgeFor + 10));
      const качество = Math.max(0, 1 - s.errorRate / Math.max(goal.maxErrors, 0.001) / 4);
      return { goal: 'endured' as const, reached, score: Math.min(1, прошло * качество) };
    },
  };
}

/**
 * Обстановка по умолчанию. Числа подобраны, а не выдуманы, и подобраны под
 * одну задачу: наплыв должен быть переживаем, а убивать службу должны
 * настройки проб.
 *
 *   — втроём под наплывом время ответа выходит около 1,1 с. Проба со сроком
 *     в секунду — та самая частая настройка — начинает считать исправные
 *     экземпляры зависшими;
 *   — вдвоём время ответа 2,2 с, и тесная проба валит следующего: это
 *     положительная обратная связь, и служба выкашивается целиком;
 *   — при сроке в три секунды не срабатывает ни разу, и потерь нет вовсе:
 *     очередь держит наплыв, просто отвечает медленнее.
 */
export const NAPLYV: SondeSettings = {
  replicas: 3,
  capacity: 20,
  queue: 2,
  base: 0.3,
  calm: 45,
  surge: 100,
  surgeAt: 5,
  surgeFor: 20,
  startup: 4,
  period: 2,
  timeout: 1,
  threshold: 1,
  readiness: false,
  dt: 0.1,
};
