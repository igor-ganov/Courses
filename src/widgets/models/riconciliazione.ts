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
}

export interface Cluster {
  step(): ClusterState;
  state(): ClusterState;
  reset(): void;
  set(patch: Partial<ClusterSettings>): void;
  settings(): ClusterSettings;
  /** Убить под пальцем: узел упал, память кончилась, кто-то дёрнул провод. */
  kill(id: number): void;
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

export function createCluster(settings: ClusterSettings, goal?: ClusterGoal): Cluster {
  let cfg: ClusterSettings = { ...settings };

  let time = 0;
  let счёт = 0;
  let pods: Живой[] = [];
  let events: ClusterEvent[] = [];
  let doОпроса = 0;
  let held = 0;
  let лучшее = 0;

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

    doОпроса -= dt;
    if (doОпроса <= 0) {
      doОпроса = cfg.resync;
      if (cfg.running) сверить();
    }

    if (goal) {
      const сошлось = pods.filter(готов).length === cfg.desired;
      held = сошлось ? held + dt : 0;
      лучшее = Math.max(лучшее, held);
    }

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
