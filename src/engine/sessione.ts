/**
 * СЕССИЯ — то, что читатель сделал на одной странице.
 *
 * Виток состоит из нескольких работ: вопросов и заданий с целью. Пока они
 * идут по одной, у каждой своя оценка; движку продвижения нужна одна.
 * Здесь и происходит сведение.
 *
 * Три решения, каждое из которых видно в тестах:
 *
 *   — Оценка сводится по трудности, а не средним арифметическим: вопрос на
 *     пять баллов и вопрос на один не равны, и делать вид, что равны, —
 *     значит поощрять сдачу лёгкого.
 *   — Повторный ответ на ту же работу заменяет прежний, а не добавляется.
 *     Иначе три попытки одного вопроса перевесили бы весь остальной виток.
 *   — Виток считается сделанным, когда сданы все работы, а не когда набран
 *     порог: половина витка — это половина витка, даже если она отличная.
 *
 * Класс здесь не нужен, состояние — замыкание; ни DOM, ни хранилища эта
 * часть не знает и потому проверяется без браузера.
 */

export interface Esito {
  /** Кто отвечал: идентификатор вопроса или прибора с целью. */
  readonly id: string;
  /** Оценка 0…1. */
  readonly score: number;
  /** Трудность работы, 1…5. */
  readonly difficulty: number;
}

export interface Sessione {
  /** Записать результат работы. Повторный по тому же id заменяет прежний. */
  segna(esito: Esito): void;
  /** Сколько работ сдано из скольких. */
  readonly fatto: number;
  readonly totale: number;
  /** Все ли работы витка сданы. */
  compiuto(): boolean;
  /** Сводная оценка витка, 0…1, взвешенная по трудности. */
  voto(): number;
  /** Сводная трудность витка: средняя трудность его работ. */
  difficolta(): number;
  /** Только для отображения: что сдано, в порядке появления. */
  esiti(): readonly Esito[];
}

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
const peso = (d: number) => (Number.isFinite(d) && d > 0 ? Math.min(5, d) : 1);

/**
 * @param totale сколько работ на витке. Ноль означает виток без работ —
 *   такой считается сделанным сразу, но и оценки за него нет.
 */
export function createSessione(totale: number): Sessione {
  const записи = new Map<string, Esito>();

  return {
    get fatto() {
      return записи.size;
    },
    get totale() {
      return totale;
    },
    segna(esito) {
      записи.set(esito.id, {
        id: esito.id,
        score: clamp01(esito.score),
        difficulty: peso(esito.difficulty),
      });
    },
    compiuto: () => записи.size >= totale,
    voto() {
      if (записи.size === 0) return 0;
      let сумма = 0;
      let вес = 0;
      for (const э of записи.values()) {
        сумма += э.score * э.difficulty;
        вес += э.difficulty;
      }
      return вес === 0 ? 0 : сумма / вес;
    },
    difficolta() {
      if (записи.size === 0) return 1;
      let вес = 0;
      for (const э of записи.values()) вес += э.difficulty;
      return вес / записи.size;
    },
    esiti: () => [...записи.values()],
  };
}
