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
    goal: s.optional(s.record({ hold: s.number({ min: 1 }) })),
  }),
  tag: 'cy-riconciliazione',
  /* Взято по телефону, а не по среднему: на узком экране подсказка и ручки
     занимают больше, и место надо занимать по худшему случаю. Лишний воздух
     на настольном экране не стоит ничего, а прыжок на телефоне стоит
     попадания по ссылке. */
  reserve: 970,
  /* Молчит, пока автор не задал, сколько держать: без этого прибор — только
     показ, и задание рядом было бы невыполнимым. */
  goals: (b) => (b.goal ? ['held'] : []),
  load: () => import('~/widgets/riconciliazione'),
});
