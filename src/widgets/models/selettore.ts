/**
 * ОТБОР ПО МЕТКЕ — головоломка, а не показ.
 *
 * Отбор по меткам — то, чем в Kubernetes связано всё со всем, и объяснять
 * его словами почти бесполезно: читатель кивает и продолжает думать
 * списками имён. Понимание приходит, когда надо попасть условием ровно в
 * нужное подмножество и обнаружить, что очевидное условие захватывает
 * лишнего или теряет своего.
 *
 * Поэтому здесь есть правильный ответ и есть ошибки, которые к нему не
 * ведут: набор подобран так, что отбор по месту (`tier`) теряет нужный под,
 * а отбор без исключения пробной версии захватывает лишний.
 *
 * Модель чистая и без экрана: её гоняют тесты, а виджет только рисует.
 */

export interface Etichette {
  readonly [key: string]: string;
}

export interface PodEtichettato {
  readonly id: number;
  readonly name: string;
  readonly labels: Etichette;
}

/** Одно условие отбора. `eq` — совпадает, `ne` — не совпадает. */
export interface Condizione {
  readonly key: string;
  readonly op: 'eq' | 'ne';
  readonly value: string;
}

export interface SelettoreSettings {
  readonly pods: readonly PodEtichettato[];
  /** Условия, которые читатель может включать и выключать. */
  readonly conditions: readonly Condizione[];
  /** Кого надо отобрать. Задача формулируется словами в лекции. */
  readonly target: readonly number[];
}

export interface SelettoreState {
  readonly pods: readonly PodEtichettato[];
  readonly conditions: readonly Condizione[];
  /** Какие условия включены. */
  readonly on: readonly boolean[];
  /** Кто подошёл под все включённые условия. */
  readonly matched: readonly number[];
  /** Кого не хватает и кто лишний — то, из чего читатель понимает, что не так. */
  readonly missing: readonly number[];
  readonly extra: readonly number[];
  readonly solved: boolean;
}

export interface Selettore {
  state(): SelettoreState;
  toggle(i: number): void;
  reset(): void;
  goal(): { goal: 'selected'; reached: boolean; score: number };
}

/** Подходит ли под под одно условие. */
export function corrisponde(pod: PodEtichettato, c: Condizione): boolean {
  const есть = pod.labels[c.key];
  /* Условие «не равно» выполняется и когда метки нет вовсе. Так же ведёт
     себя настоящий отбор, и это ловушка: под без метки `release` попадает
     в выборку `release!=canary`. */
  return c.op === 'eq' ? есть === c.value : есть !== c.value;
}

export function createSelettore(settings: SelettoreSettings): Selettore {
  let on: boolean[] = settings.conditions.map(() => false);

  function отобрать(): number[] {
    const включены = settings.conditions.filter((_, i) => on[i]);
    /* Пустой отбор — это не «никто», а «все». Так и в Kubernetes: служба
       без селектора не находит ничего полезного, а объект с пустым отбором
       забирает всё пространство имён. Читателю это полезно увидеть. */
    return settings.pods
      .filter((p) => включены.every((c) => corrisponde(p, c)))
      .map((p) => p.id);
  }

  function снимок(): SelettoreState {
    const matched = отобрать();
    const цель = new Set(settings.target);
    const взято = new Set(matched);
    const missing = [...цель].filter((id) => !взято.has(id));
    const extra = matched.filter((id) => !цель.has(id));
    return {
      pods: settings.pods,
      conditions: settings.conditions,
      on: [...on],
      matched,
      missing,
      extra,
      solved: missing.length === 0 && extra.length === 0,
    };
  }

  return {
    state: снимок,
    toggle(i) {
      if (i < 0 || i >= on.length) return;
      on[i] = !on[i];
    },
    reset() {
      on = settings.conditions.map(() => false);
    },
    goal() {
      const s = снимок();
      /* Балл — доля правильно отобранных за вычетом лишних: «нет» без числа
         не говорит читателю, близко он был или нет. */
      const всего = settings.target.length;
      const верных = всего - s.missing.length;
      const балл = Math.max(0, (верных - s.extra.length) / Math.max(1, всего));
      return { goal: 'selected' as const, reached: s.solved, score: Math.min(1, балл) };
    },
  };
}

/**
 * Набор по умолчанию. Подобран под одну ошибку и одну ловушку:
 *
 *   — `tier=frontend` выглядит разумным условием для веб-службы и теряет
 *     `web-f`, который стоит в backend по историческим причинам. Отбирать
 *     надо по роли, а не по месту;
 *   — без `release!=canary` в выборку попадает пробный `web-b`, и половина
 *     запросов уходит в версию, которую ещё проверяют.
 */
export const NABOR: SelettoreSettings = {
  pods: [
    { id: 1, name: 'web-a', labels: { app: 'web', tier: 'frontend', release: 'stable' } },
    { id: 2, name: 'web-b', labels: { app: 'web', tier: 'frontend', release: 'canary' } },
    { id: 3, name: 'api-c', labels: { app: 'api', tier: 'backend', release: 'stable' } },
    { id: 4, name: 'api-d', labels: { app: 'api', tier: 'backend', release: 'canary' } },
    { id: 5, name: 'cache-e', labels: { app: 'cache', tier: 'backend', release: 'stable' } },
    { id: 6, name: 'web-f', labels: { app: 'web', tier: 'backend', release: 'stable' } },
  ],
  conditions: [
    { key: 'app', op: 'eq', value: 'web' },
    { key: 'app', op: 'eq', value: 'api' },
    { key: 'tier', op: 'eq', value: 'frontend' },
    { key: 'tier', op: 'eq', value: 'backend' },
    { key: 'release', op: 'ne', value: 'canary' },
  ],
  target: [1, 6],
};
