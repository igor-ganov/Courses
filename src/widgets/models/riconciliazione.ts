/**
 * СВЕРКА — модель того единственного, из чего Kubernetes состоит.
 *
 * Всё остальное в нём — надстройки над одним движением: контроллер смотрит,
 * что заявлено, смотрит, что есть, и делает шаг к сближению. Ни «создать»,
 * ни «удалить» никто не приказывает: приказ — это заявленное число, а
 * создание и удаление — следствия.
 *
 * Поэтому модель не про поды, а про расхождение:
 *
 *   — под появляется не мгновенно: планирование, запуск образа, готовность.
 *     Пока он поднимается, расхождение не закрыто, и контроллер, который
 *     этого не учитывает, создаёт лишние;
 *   — контроллер просыпается не непрерывно, а с периодом опроса, и между
 *     пробуждениями мир живёт сам;
 *   — под может умереть в любой момент, и это не поломка, а обычный день;
 *   — контроллер можно выключить — тогда видно, чем именно он занимался.
 *
 * Модель чистая и без экрана: её гоняют тесты, а виджет только рисует.
 */

/** Что с подом прямо сейчас. Имена — те же, что читатель увидит в kubectl. */
export type PodPhase = 'pending' | 'creating' | 'running' | 'terminating';

export interface Pod {
  readonly id: number;
  readonly name: string;
  readonly phase: PodPhase;
  /** Сколько секунд в этой фазе. */
  readonly age: number;
  /** Готов принимать нагрузку. Только running бывает готовым. */
  readonly ready: boolean;
}

/** Строка ленты событий — то же, что показывает `kubectl get events`. */
export interface ClusterEvent {
  readonly at: number;
  readonly kind: 'created' | 'started' | 'killed' | 'deleted' | 'scaled' | 'paused' | 'resumed';
  readonly text: string;
}

export interface ClusterSettings {
  /** Заявленное число экземпляров. То самое «желаемое состояние». */
  readonly desired: number;
  /** Период опроса контроллера, секунды: как часто он вообще смотрит. */
  readonly resync: number;
  /** Сколько секунд под поднимается от создания до готовности. */
  readonly startup: number;
  /** Сколько секунд под гасится. */
  readonly shutdown: number;
  /** Работает ли контроллер. Выключенный — способ увидеть, что он делал. */
  readonly running: boolean;
  readonly dt: number;
  /**
   * Беда сама по себе: в среднем раз в столько секунд падает случайный под.
   * Ноль — не падает никто.
   *
   * Нужно для ночной смены. Кластер, в котором ничего не ломается, ничего и
   * не показывает: разница между «чинить руками» и «заявить состояние»
   * появляется ровно тогда, когда ломается без предупреждения и не вовремя.
   */
  readonly chaos?: number;
  /** Зерно бед: одна и та же ночь при каждом заходе, иначе это лотерея. */
  readonly seed?: number;
  /**
   * Начать с заявленным числом уже работающих подов.
   *
   * Нужно ночной смене: без этого читатель приходит на смену, где ещё ничего
   * не поднято, доля времени в строю с первой секунды равна нулю, и смена
   * проиграна прежде, чем он что-либо сделал. Дежурство начинается с
   * исправного кластера — и портится по ходу дела.
   */
  readonly warm?: boolean;
  /**
   * Второй хозяин заявленного числа: раз в `every` секунд ставит своё
   * значение. Ноль — второго хозяина нет.
   *
   * Хозяев при этом получается ровно два, и это важно: первый — файл, он
   * возвращает своё значение на своей половине периода, второй ставит своё
   * на другой. Один хозяин, тянущий поле в свою сторону, дребезга не даёт —
   * он просто побеждает; дребезг начинается со второго.
   */
  readonly rival?: { readonly desired: number; readonly every: number };
}

export interface ClusterGoal {
  /** Сколько секунд подряд надо продержать готовых ровно столько, сколько заявлено. */
  readonly hold: number;
}

export interface ClusterState {
  readonly time: number;
  readonly desired: number;
  readonly pods: readonly Pod[];
  /** Готовых сейчас. Это и есть то, что видит пользователь службы. */
  readonly ready: number;
  /** Существующих: считая поднимающиеся. Именно по нему работает контроллер. */
  readonly alive: number;
  readonly events: readonly ClusterEvent[];
  /** Секунд подряд, что готовых ровно столько, сколько заявлено. */
  readonly held: number;
  /** Доля всего времени, что готовых было столько, сколько заявлено. */
  readonly uptime: number;
  /** Сколько раз читателю пришлось вмешаться руками. */
  readonly interventions: number;
  /** Заявленное число за последнее время — для графика дребезга. */
  readonly wanted: readonly { readonly at: number; readonly n: number }[];
}

export interface Cluster {
  step(): ClusterState;
  state(): ClusterState;
  reset(): void;
  set(patch: Partial<ClusterSettings>): void;
  settings(): ClusterSettings;
  /** Убить под пальцем: узел упал, память кончилась, кто-то дёрнул провод. */
  kill(id: number): void;
  /**
   * Поднять один под руками — то, чем занимается человек в ночную смену,
   * когда контроллера нет. Считается отдельно от работы контроллера: смысл
   * ночной смены в том, чтобы увидеть, сколько таких нажатий выходит.
   */
  raise(): void;
  goal(): { goal: 'held'; reached: boolean; score: number };
}

const СОБЫТИЙ = 40;

interface Живой {
  id: number;
  name: string;
  phase: PodPhase;
  age: number;
}

/* Имя пода в Kubernetes — имя набора плюс случайный хвост. Хвост здесь
   выдаётся по счётчику, а не случайно: читатель должен узнавать под, о
   котором только что прочёл в ленте, а не гадать. */
const ХВОСТЫ = 'abcdefghijklmnopqrstuvwxyz0123456789';
function хвост(n: number): string {
  return ХВОСТЫ[(n * 7) % ХВОСТЫ.length]! + ХВОСТЫ[(n * 13 + 5) % ХВОСТЫ.length]! + ХВОСТЫ[(n * 3 + 11) % ХВОСТЫ.length]!;
}

/* Быстрый повторяемый генератор. Ночь должна быть одна и та же при каждом
   заходе: иначе ночная смена превращается в лотерею, и сравнить «руками» с
   «заявкой» становится нельзя. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ЖЕЛАННОГО = 400;

export function createCluster(settings: ClusterSettings, goal?: ClusterGoal): Cluster {
  let cfg: ClusterSettings = { ...settings };

  let time = 0;
  let счёт = 0;
  let pods: Живой[] = [];
  let events: ClusterEvent[] = [];
  let doОпроса = 0;
  let held = 0;
  let лучшее = 0;
  let rnd = mulberry32(cfg.seed ?? 20260910);
  let вмешательств = 0;
  let сошлосьСекунд = 0;
  let желанное: { at: number; n: number }[] = [];
  let doСоперника = 0;
  /* Что записано в файле. Хозяин номер один — тот, кто этот файл применяет,
     и он возвращает своё значение так же исправно, как соперник ставит своё. */
  let файл = cfg.desired;
  let ходСоперника = true;

  if (cfg.warm) {
    for (let i = 0; i < cfg.desired; i += 1) {
      счёт += 1;
      pods.push({ id: счёт, name: `web-${хвост(счёт)}`, phase: 'running', age: 0 });
    }
  }

  const готов = (p: Живой) => p.phase === 'running';
  /* Существующим считается и тот, что ещё поднимается: иначе контроллер
     создаёт замену каждому, кто не успел стать готовым, и вместо трёх подов
     получается тридцать. Эта ошибка — самая частая у тех, кто пишет свой
     контроллер впервые. */
  const жив = (p: Живой) => p.phase !== 'terminating';

  function записать(kind: ClusterEvent['kind'], text: string): void {
    events.push({ at: Number(time.toFixed(2)), kind, text });
    if (events.length > СОБЫТИЙ) events.shift();
  }

  function снимок(): ClusterState {
    return {
      time,
      desired: cfg.desired,
      pods: pods.map((p) => ({
        id: p.id,
        name: p.name,
        phase: p.phase,
        age: Number(p.age.toFixed(2)),
        ready: готов(p),
      })),
      ready: pods.filter(готов).length,
      alive: pods.filter(жив).length,
      events: [...events],
      held: Number(held.toFixed(2)),
      uptime: time > 0 ? Number((сошлосьСекунд / time).toFixed(4)) : 1,
      interventions: вмешательств,
      wanted: [...желанное],
    };
  }

  function создать(): void {
    счёт += 1;
    const name = `web-${хвост(счёт)}`;
    pods.push({ id: счёт, name, phase: 'pending', age: 0 });
    записать('created', `создан ${name}`);
  }

  function reset(): void {
    time = 0;
    счёт = 0;
    pods = [];
    events = [];
    doОпроса = 0;
    held = 0;
    rnd = mulberry32(cfg.seed ?? 20260910);
    вмешательств = 0;
    сошлосьСекунд = 0;
    желанное = [];
    doСоперника = 0;
    ходСоперника = true;
    cfg = { ...cfg, desired: файл };
    if (cfg.warm) {
      for (let i = 0; i < cfg.desired; i += 1) {
        счёт += 1;
        pods.push({ id: счёт, name: `web-${хвост(счёт)}`, phase: 'running', age: 0 });
      }
    }
    лучшее = 0;
  }

  /** Один проход контроллера: посмотреть и сделать шаг. Больше он ничего не умеет. */
  function сверить(): void {
    const есть = pods.filter(жив).length;
    if (есть < cfg.desired) {
      for (let i = есть; i < cfg.desired; i += 1) создать();
      return;
    }
    if (есть > cfg.desired) {
      /* Лишние гасятся с конца: младшие поды моложе и, скорее всего, ещё не
         взяли на себя работу. Настоящий контроллер выбирает по целому списку
         правил (не готов, младше, на перегруженном узле) — здесь взято
         главное из них. */
      let лишних = есть - cfg.desired;
      for (let i = pods.length - 1; i >= 0 && лишних > 0; i -= 1) {
        const p = pods[i]!;
        if (!жив(p)) continue;
        p.phase = 'terminating';
        p.age = 0;
        записать('deleted', `гасится ${p.name}`);
        лишних -= 1;
      }
    }
  }

  function step(): ClusterState {
    const dt = cfg.dt;
    time += dt;

    for (const p of pods) p.age += dt;

    /* Поды живут своей жизнью независимо от контроллера — в этом весь смысл:
       контроллер не «выполняет» создание, он его только просит. */
    for (const p of pods) {
      if (p.phase === 'pending') {
        /* Планирование в этой модели мгновенно: узлы появятся в приборе о
           планировщике, и смешивать два предмета в одном приборе незачем. */
        p.phase = 'creating';
        p.age = 0;
      } else if (p.phase === 'creating' && p.age >= cfg.startup) {
        p.phase = 'running';
        p.age = 0;
        записать('started', `${p.name} готов`);
      }
    }
    pods = pods.filter((p) => !(p.phase === 'terminating' && p.age >= cfg.shutdown));

    /* Беда приходит сама. Вероятность на шаг выведена из среднего срока
       между падениями: за `chaos` секунд ожидается одно падение. */
    if (cfg.chaos && cfg.chaos > 0 && pods.length > 0 && rnd() < dt / cfg.chaos) {
      const жертва = pods[Math.floor(rnd() * pods.length)];
      if (жертва) {
        pods = pods.filter((p) => p !== жертва);
        записать('killed', `${жертва.name} упал сам`);
      }
    }

    /* Два хозяина по очереди. Ни один не сломан, и каждый делает ровно то,
       что должен: соперник считает по нагрузке, файл возвращает записанное.
       В этом и беда — исправны оба, а поле одно. */
    if (cfg.rival && cfg.rival.every > 0) {
      doСоперника -= dt;
      if (doСоперника <= 0) {
        doСоперника = cfg.rival.every;
        const хочет = ходСоперника ? cfg.rival.desired : файл;
        const кто = ходСоперника ? 'второй хозяин' : 'выкладка по файлу';
        ходСоперника = !ходСоперника;
        if (cfg.desired !== хочет) {
          записать('scaled', `${кто} ставит ${хочет}`);
          cfg = { ...cfg, desired: хочет };
          doОпроса = 0;
        }
      }
    }

    doОпроса -= dt;
    if (doОпроса <= 0) {
      doОпроса = cfg.resync;
      if (cfg.running) сверить();
    }

    const сошлось = pods.filter(готов).length === cfg.desired;
    if (сошлось) сошлосьСекунд += dt;
    if (goal) {
      held = сошлось ? held + dt : 0;
      лучшее = Math.max(лучшее, held);
    }

    желанное.push({ at: Number(time.toFixed(2)), n: cfg.desired });
    if (желанное.length > ЖЕЛАННОГО) желанное.shift();

    return снимок();
  }

  return {
    step,
    state: снимок,
    reset,
    settings: () => cfg,
    set(patch) {
      const было = cfg;
      cfg = { ...cfg, ...patch };
      if (patch.desired !== undefined && patch.desired !== было.desired) {
        /* Читатель правит именно файл: он и есть первый хозяин. */
        файл = patch.desired;
        записать('scaled', `заявлено ${patch.desired} вместо ${было.desired}`);
        /* Заявка — не событие раз в период опроса: изменение желаемого будит
           контроллер сразу, как и в настоящем через очередь. */
        doОпроса = 0;
      }
      if (patch.running !== undefined && patch.running !== было.running) {
        записать(patch.running ? 'resumed' : 'paused', patch.running ? 'контроллер пущен' : 'контроллер остановлен');
      }
    },
    kill(id) {
      const i = pods.findIndex((p) => p.id === id);
      if (i < 0) return;
      const p = pods[i]!;
      pods.splice(i, 1);
      записать('killed', `${p.name} упал`);
    },
    raise() {
      /* Руками поднимают ровно один под и ровно тогда, когда нажали. Никакой
         проверки «а надо ли» здесь нет намеренно: человек в ночную смену
         тоже её не делает — он видит, что мало, и поднимает. */
      вмешательств += 1;
      создать();
    },
    goal() {
      if (!goal) return { goal: 'held' as const, reached: false, score: 0 };
      return {
        goal: 'held' as const,
        reached: лучшее >= goal.hold,
        score: Math.min(1, лучшее / goal.hold),
      };
    },
  };
}
