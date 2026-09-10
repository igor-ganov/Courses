/**
 * ПРИБОРЫ ОРКЕСТРОВКИ — то, чем щупают Kubernetes.
 *
 * Отдельный файл от `interattivi`, и не ради порядка в папке: приборы здесь
 * принадлежат предмету, а не платформе. Курс уедет — уедет и файл, и ни
 * движок, ни реестр этого не заметят. Ровно это и обещает реестр: вид блока
 * стоит схемы, элемента и одной регистрации.
 */

import * as s from '~/core/schema';
import { defineBlock } from '~/content/registry';

const общие = {
  title: s.optional(s.text({ max: 200 })),
  hint: s.optional(s.text({ max: 600 })),
};

export const manifest = defineBlock({
  kind: 'manifest',
  label: 'Разбор манифеста',
  note: 'YAML построчно: подчёркнутая строка объясняет себя по касанию, spec и status разведены цветом.',
  schema: s.record({
    kind: s.literal('manifest'),
    ...общие,
    lines: s.list(
      s.record({
        text: s.text({ max: 120 }),
        note: s.optional(s.text({ max: 600 })),
        /** Чем строка является: заявкой, отчётом кластера или опознанием. */
        part: s.optional(s.oneOf(['spec', 'status', 'meta'] as const)),
      }),
      { min: 1 },
    ),
  }),
  tag: 'cy-manifesto',
  /* Высота манифеста определяется числом строк, и одним числом её не задать:
     разбор из восьми строк вдвое ниже разбора из пятнадцати. Слагаемые
     измерены на собранном сайте в двух профилях: заголовок с подсказкой,
     легенда, отведённое место под пояснение и строка листа. */
  reserve: (b) => 300 + b.lines.length * 25,
  load: () => import('~/widgets/manifesto'),
});

export const schedule = defineBlock({
  kind: 'schedule',
  label: 'Планировщик',
  note: 'Отсев и оценка на живой обстановке. Порядок отправки выбирает читатель — в нём и задача.',
  schema: s.record({
    kind: s.literal('schedule'),
    ...общие,
    goal: s.optional(s.record({ placed: s.number({ integer: true, min: 1 }) })),
  }),
  tag: 'cy-pianificatore',
  reserve: 800,
  goals: (b) => (b.goal ? ['placed'] : []),
  load: () => import('~/widgets/pianificatore'),
});

export const traffic = defineBlock({
  kind: 'traffic',
  label: 'Очередь и дверь',
  note: 'Одна механика в двух обличьях: опрос против слежения и обработка по событию против обработки по ключу.',
  schema: s.record({
    kind: s.literal('traffic'),
    ...общие,
    /** `porta` — дверь и опрос, `coda` — очередь ключей. */
    modo: s.optional(s.oneOf(['porta', 'coda'] as const)),
  }),
  tag: 'cy-coda',
  reserve: (b) => (b.modo === 'coda' ? 830 : 760),
  load: () => import('~/widgets/coda'),
});

export const probes = defineBlock({
  kind: 'probes',
  label: 'Наплыв и пробы',
  note: 'Игра: пережить наплыв, который служба обязана пережить. Убить её могут только настройки проб.',
  schema: s.record({
    kind: s.literal('probes'),
    ...общие,
    goal: s.optional(s.record({ maxErrors: s.number({ min: 0, max: 1 }) })),
  }),
  tag: 'cy-sonde',
  reserve: 860,
  goals: () => ['endured'],
  load: () => import('~/widgets/sonde'),
});

export const selector = defineBlock({
  kind: 'selector',
  label: 'Отбор по метке',
  note: 'Головоломка: попасть условием ровно в нужное подмножество подов. Очевидный путь теряет своего.',
  schema: s.record({
    kind: s.literal('selector'),
    ...общие,
    /** Засчитывать как задание. */
    goal: s.optional(s.flag()),
  }),
  tag: 'cy-selettore',
  reserve: 920,
  goals: (b) => (b.goal ? ['selected'] : []),
  load: () => import('~/widgets/selettore'),
});

export const nightshift = defineBlock({
  kind: 'nightshift',
  label: 'Ночная смена',
  note: 'Игра: подежурить руками против заявленного состояния. Счёт — доля времени в строю и число пробуждений.',
  schema: s.record({
    kind: s.literal('nightshift'),
    ...общие,
    desired: s.optional(s.number({ integer: true, min: 1, max: 5 })),
    /** В среднем раз в столько секунд падает под. */
    chaos: s.optional(s.number({ min: 1, max: 60 })),
    goal: s.optional(
      s.record({ uptime: s.number({ min: 0, max: 1 }), over: s.number({ min: 10 }) }),
    ),
  }),
  tag: 'cy-turno',
  reserve: 900,
  /* Смена засчитывается всегда: игра без счёта — это показ. */
  goals: () => ['survived'],
  load: () => import('~/widgets/turno'),
});

export const reconcile = defineBlock({
  kind: 'reconcile',
  label: 'Цикл сверки',
  note: 'Заявленное число против настоящего. Поды роняются пальцем, контроллер выключается.',
  schema: s.record({
    kind: s.literal('reconcile'),
    ...общие,
    desired: s.optional(s.number({ integer: true, min: 0, max: 8 })),
    /** Период опроса контроллера, секунды: как часто он вообще смотрит. */
    resync: s.optional(s.number({ min: 0.1, max: 20 })),
    /** Сколько под поднимается до готовности. */
    startup: s.optional(s.number({ min: 0, max: 20 })),
    /**
     * Второй хозяин заявленного числа: раз в `every` секунд ставит своё.
     * Так получается дребезг — оба контура исправны, а поле одно.
     */
    rival: s.optional(
      s.record({
        desired: s.number({ integer: true, min: 0, max: 8 }),
        every: s.number({ min: 1, max: 60 }),
      }),
    ),
    goal: s.optional(s.record({ hold: s.number({ min: 1 }) })),
  }),
  tag: 'cy-riconciliazione',
  /* С пилой второго хозяина прибор выше на её высоту. Взято по телефону, а не по среднему: на узком экране подсказка и ручки
     занимают больше, и место надо занимать по худшему случаю. Лишний воздух
     на настольном экране не стоит ничего, а прыжок на телефоне стоит
     попадания по ссылке. */
  reserve: (b) => (b.rival ? 1030 : 970),
  /* Молчит, пока автор не задал, сколько держать: без этого прибор — только
     показ, и задание рядом было бы невыполнимым. */
  goals: (b) => (b.goal ? ['held'] : []),
  load: () => import('~/widgets/riconciliazione'),
});
