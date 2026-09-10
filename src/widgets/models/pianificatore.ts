/**
 * ПЛАНИРОВЩИК — отсев и оценка, как они устроены на самом деле.
 *
 * Прибор, в котором под едет «куда-нибудь», не учит ничему. Поэтому здесь
 * воспроизведены оба приёма настоящего планировщика и в том же порядке:
 *
 *   — отсев даёт ответ «да или нет» и работает по заявленным ресурсам,
 *     а не по потребляемым: узел продаёт ёмкость по обещаниям;
 *   — оценка даёт баллы, и считается она по двум правилам сразу —
 *     «где свободнее» и «где ровнее», — потому что одного первого мало:
 *     оно набивает узел процессорными подами до последнего ядра, оставляя
 *     память нетронутой и бесполезной.
 *
 * Чего здесь нет намеренно: перестановки уже размещённых. Настоящий
 * планировщик тоже этого не делает, и осколочность, которую читатель увидит
 * к концу, — не упрощение модели, а свойство предмета.
 *
 * Модель чистая и без экрана: её гоняют тесты, а виджет только рисует.
 */

export interface Risorse {
  /** Доли ядра: 0,5 — половина. В Kubernetes это же пишется как `500m`. */
  readonly cpu: number;
  /** Гигабайты. */
  readonly mem: number;
}

export interface Nodo extends Risorse {
  readonly id: number;
  readonly name: string;
}

export interface Carico extends Risorse {
  readonly id: number;
  readonly name: string;
}

/** Что планировщик решил про один узел на этом шаге. */
export interface Verdetto {
  readonly nodo: number;
  /** Прошёл ли отсев. */
  readonly adatto: boolean;
  /** Почему не прошёл — словами, для показа читателю. */
  readonly perche?: string;
  /** Баллы, если прошёл. Больше — лучше. */
  readonly punti: number;
}

export interface Piazzamento {
  readonly pod: number;
  /** Узел, на который под встал. Ничего — значит остался в ожидании. */
  readonly nodo?: number;
  readonly verdetti: readonly Verdetto[];
}

export interface SchedulerState {
  readonly nodi: readonly Nodo[];
  /** Занято на узле: сумма заявок размещённых подов. */
  readonly occupato: readonly Risorse[];
  /** Кто где стоит. */
  readonly posti: readonly { pod: Carico; nodo: number }[];
  /** Кто ещё не отправлен. */
  readonly coda: readonly Carico[];
  /** Кто отправлен, но не размещён. */
  readonly attesa: readonly Carico[];
  /** Разбор последнего размещения — то, что показывается читателю. */
  readonly ultimo?: Piazzamento;
}

export interface Scheduler {
  state(): SchedulerState;
  /**
   * Отправить под: названный или, если не назван, первый в очереди.
   *
   * Выбор пода — это выбор _порядка_, и он здесь у читателя нарочно.
   * Планировщик порядком не распоряжается: он видит по одному поду за раз
   * и не знает, что придёт следующим. А тот, кто заявки пишет, — знает.
   */
  invia(id?: number): Piazzamento | undefined;
  reset(): void;
  goal(): { goal: 'placed'; reached: boolean; score: number };
}

export interface SchedulerSettings {
  readonly nodi: readonly Nodo[];
  readonly coda: readonly Carico[];
}

export interface SchedulerGoal {
  /** Сколько подов надо разместить, не оставив никого в ожидании. */
  readonly placed: number;
}

const пусто = (): Risorse => ({ cpu: 0, mem: 0 });

export function createScheduler(settings: SchedulerSettings, goal?: SchedulerGoal): Scheduler {
  let occupato: Risorse[] = settings.nodi.map(пусто);
  let posti: { pod: Carico; nodo: number }[] = [];
  let coda: Carico[] = [...settings.coda];
  let attesa: Carico[] = [];
  let ultimo: Piazzamento | undefined;

  function свободно(i: number): Risorse {
    const n = settings.nodi[i]!;
    const o = occupato[i]!;
    return { cpu: n.cpu - o.cpu, mem: n.mem - o.mem };
  }

  /** Отсев: помещается ли заявка в остаток. Ответ без оттенков. */
  function отсеять(i: number, pod: Carico): { adatto: boolean; perche?: string } {
    const s = свободно(i);
    if (s.cpu < pod.cpu && s.mem < pod.mem) return { adatto: false, perche: 'мало ядер и памяти' };
    if (s.cpu < pod.cpu) return { adatto: false, perche: 'мало ядер' };
    if (s.mem < pod.mem) return { adatto: false, perche: 'мало памяти' };
    return { adatto: true };
  }

  /**
   * Оценка. Два правила, как в настоящем: «где свободнее» тянет размазать
   * нагрузку, «где ровнее» не даёт выесть один ресурс до дна, оставив другой
   * нетронутым. Балл — сотые доли, чтобы его можно было показать целым числом.
   */
  function оценить(i: number, pod: Carico): number {
    const n = settings.nodi[i]!;
    const o = occupato[i]!;
    const cpu = (o.cpu + pod.cpu) / n.cpu;
    const mem = (o.mem + pod.mem) / n.mem;
    const свободнее = ((1 - cpu) + (1 - mem)) / 2;
    const ровнее = 1 - Math.abs(cpu - mem);
    return Math.round((свободнее * 0.5 + ровнее * 0.5) * 100);
  }

  function снимок(): SchedulerState {
    return {
      nodi: settings.nodi,
      occupato: occupato.map((o) => ({ ...o })),
      posti: posti.map((p) => ({ ...p })),
      coda: [...coda],
      attesa: [...attesa],
      ...(ultimo ? { ultimo } : {}),
    };
  }

  return {
    state: снимок,
    invia(id) {
      const i = id === undefined ? 0 : coda.findIndex((p) => p.id === id);
      if (i < 0) return undefined;
      const pod = coda.splice(i, 1)[0];
      if (!pod) return undefined;

      const verdetti: Verdetto[] = settings.nodi.map((n, i) => {
        const о = отсеять(i, pod);
        return {
          nodo: n.id,
          adatto: о.adatto,
          ...(о.perche ? { perche: о.perche } : {}),
          punti: о.adatto ? оценить(i, pod) : 0,
        };
      });

      let лучший = -1;
      let лучшие = -1;
      verdetti.forEach((v, i) => {
        if (!v.adatto) return;
        if (v.punti > лучшие) {
          лучшие = v.punti;
          лучший = i;
        }
      });

      if (лучший < 0) {
        attesa.push(pod);
        ultimo = { pod: pod.id, verdetti };
        return ultimo;
      }

      const o = occupato[лучший]!;
      occupato[лучший] = { cpu: o.cpu + pod.cpu, mem: o.mem + pod.mem };
      posti.push({ pod, nodo: settings.nodi[лучший]!.id });
      ultimo = { pod: pod.id, nodo: settings.nodi[лучший]!.id, verdetti };
      return ultimo;
    },
    reset() {
      occupato = settings.nodi.map(пусто);
      posti = [];
      coda = [...settings.coda];
      attesa = [];
      ultimo = undefined;
    },
    goal() {
      if (!goal) return { goal: 'placed' as const, reached: false, score: 0 };
      /* Засчитывается только чистое размещение: один оставленный в ожидании
         означает, что задача не решена, сколько бы ни встало до него. */
      const reached = posti.length >= goal.placed && attesa.length === 0;
      return {
        goal: 'placed' as const,
        reached,
        score: Math.min(1, posti.length / goal.placed),
      };
    },
  };
}

/**
 * Обстановка по умолчанию. Подобрана не для красоты: если отправлять поды
 * в том порядке, в каком они написаны, последний не встанет никуда, хотя
 * свободных ядер в сумме хватает с запасом. Место разошлось мелкими кусками
 * по обоим узлам — это и есть осколочность, и увидеть её на пяти подах
 * полезнее, чем прочитать о ней абзац.
 */
export const OBSTANOVKA: SchedulerSettings = {
  nodi: [
    { id: 1, name: 'узел-1', cpu: 4, mem: 8 },
    { id: 2, name: 'узел-2', cpu: 4, mem: 8 },
  ],
  coda: [
    { id: 1, name: 'веб-1', cpu: 1, mem: 2 },
    { id: 2, name: 'веб-2', cpu: 1, mem: 2 },
    { id: 3, name: 'веб-3', cpu: 1, mem: 2 },
    { id: 4, name: 'веб-4', cpu: 1, mem: 2 },
    { id: 5, name: 'счёт', cpu: 3, mem: 2 },
  ],
};
