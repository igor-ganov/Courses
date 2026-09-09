/**
 * ИНТЕРАКТИВНЫЕ БЛОКИ — регистрация приборов.
 *
 * Каждый прибор здесь — три строки: схема свойств, имя элемента, отложенная
 * загрузка. Ни движок, ни маршрутизатор, ни отображение лекции об этом не
 * узнают: они спрашивают реестр.
 *
 * `load` — литеральный `import()`, потому что собиратель должен увидеть его
 * глазами и выделить отдельный кусок. Из-за этого список нельзя построить
 * циклом по именам, и это единственная причина, по которой он выглядит
 * однообразно.
 */

import * as s from '~/core/schema';
import { defineBlock } from '~/content/registry';
import { questionsSchema, standardQuestions, questionKinds, type QuestionBase } from '~/engine/assessment';

if (questionKinds().length === 0) standardQuestions();

/* Место, которое прибор занимает до оживления, измерено на собранном сайте
   в двух профилях — настольном и телефонном — и взято посередине. Точнее не
   бывает: высота зависит от подписи и ширины окна. Смысл в том, чтобы текст
   под прибором не уезжал в тот самый момент, когда читатель до него доехал.
   Числа стоят у каждого прибора рядом с его именем: разъехаться им негде. */

const общие = {
  title: s.optional(s.text({ max: 200 })),
  hint: s.optional(s.text({ max: 600 })),
};

export const loop = defineBlock({
  kind: 'loop',
  label: 'Лаборатория контура',
  note: 'ПИД с запаздыванием, насыщением и шумом. Может служить заданием через цель.',
  schema: s.record({
    kind: s.literal('loop'),
    ...общие,
    setpoint: s.optional(s.number()),
    ambient: s.optional(s.number()),
    kp: s.optional(s.number({ min: 0 })),
    ki: s.optional(s.number({ min: 0 })),
    kd: s.optional(s.number({ min: 0 })),
    delay: s.optional(s.number({ min: 0 })),
    noise: s.optional(s.number({ min: 0 })),
    goal: s.optional(
      s.record({ tolerance: s.number({ min: 0 }), hold: s.number({ min: 1 }) }),
    ),
  }),
  tag: 'cy-contorno',
  reserve: 640,
  /* Контур молчит, пока автор не задал ему допуск и время удержания. */
  goals: (b) => (b.goal ? ['settled'] : []),
  load: () => import('~/widgets/contorno'),
});

export const ashby = defineBlock({
  kind: 'ashby',
  label: 'Игра Эшби',
  note: 'Разнообразие среды против разнообразия регулятора. Ход можно отнять.',
  schema: s.record({
    kind: s.literal('ashby'),
    ...общие,
    moves: s.optional(s.number({ integer: true, min: 1, max: 4 })),
    target: s.optional(s.number({ integer: true, min: 1 })),
  }),
  tag: 'cy-varieta',
  reserve: 420,
  goals: () => ['held'],
  load: () => import('~/widgets/varieta'),
});

export const blackbox = defineBlock({
  kind: 'blackbox',
  label: 'Чёрный ящик',
  note: 'Опознание автомата по входам и выходам, без вскрытия.',
  schema: s.record({
    kind: s.literal('blackbox'),
    ...общие,
    hidden: s.optional(s.text({ max: 60 })),
  }),
  tag: 'cy-scatola',
  reserve: 420,
  goals: () => ['identified'],
  load: () => import('~/widgets/varieta'),
});

export const entropy = defineBlock({
  kind: 'entropy',
  label: 'Энтропия и код',
  note: 'Частоты двигаются, код Хаффмана пересчитывается сам.',
  schema: s.record({
    kind: s.literal('entropy'),
    ...общие,
    symbols: s.optional(
      s.list(s.record({ symbol: s.text({ max: 4 }), weight: s.number({ min: 0 }) }), { min: 2 }),
    ),
  }),
  tag: 'cy-entropia',
  reserve: 410,
  load: () => import('~/widgets/informazione'),
});

export const channel = defineBlock({
  kind: 'channel',
  label: 'Канал с шумом',
  note: 'Избыточность включается кнопкой, и сообщение начинает доходить.',
  schema: s.record({
    kind: s.literal('channel'),
    ...общие,
    message: s.optional(s.text({ max: 40 })),
    p: s.optional(s.number({ min: 0, max: 0.5 })),
  }),
  tag: 'cy-canale',
  reserve: 540,
  load: () => import('~/widgets/informazione'),
});

export const automaton = defineBlock({
  kind: 'automaton',
  label: 'Клеточный автомат',
  note: 'Восемь бит правила, время сверху вниз, край в кольцо.',
  schema: s.record({
    kind: s.literal('automaton'),
    ...общие,
    rule: s.optional(s.number({ integer: true, min: 0, max: 255 })),
    width: s.optional(s.number({ integer: true, min: 21, max: 601 })),
    steps: s.optional(s.number({ integer: true, min: 10, max: 400 })),
  }),
  tag: 'cy-automa',
  reserve: 580,
  load: () => import('~/widgets/automi'),
});

export const life = defineBlock({
  kind: 'life',
  label: '«Жизнь»',
  note: 'Поле на торе, фигуры и рисование пальцем.',
  schema: s.record({
    kind: s.literal('life'),
    ...общие,
    figure: s.optional(s.text({ max: 40 })),
    width: s.optional(s.number({ integer: true, min: 16, max: 200 })),
    height: s.optional(s.number({ integer: true, min: 16, max: 200 })),
  }),
  tag: 'cy-vita',
  reserve: 600,
  load: () => import('~/widgets/automi'),
});

export const logistic = defineBlock({
  kind: 'logistic',
  label: 'Удвоения периода',
  note: 'Диаграмма бифуркаций с движком по r и показателем Ляпунова.',
  schema: s.record({
    kind: s.literal('logistic'),
    ...общие,
    r: s.optional(s.number({ min: 2.4, max: 4 })),
  }),
  tag: 'cy-logistica',
  reserve: 600,
  load: () => import('~/widgets/dinamica'),
});

export const lorenz = defineBlock({
  kind: 'lorenz',
  label: 'Аттрактор Лоренца',
  note: 'Объём поворачивается пальцем; две близкие точки расходятся.',
  schema: s.record({
    kind: s.literal('lorenz'),
    ...общие,
    rho: s.optional(s.number({ min: 1, max: 60 })),
  }),
  tag: 'cy-lorenz',
  reserve: 600,
  load: () => import('~/widgets/dinamica'),
});

export const question = defineBlock({
  kind: 'question',
  label: 'Задание',
  note: 'Вопрос из движка оценки. Виды вопросов расширяются отдельно от блоков.',
  schema: s.record({
    kind: s.literal('question'),
    number: s.optional(s.number({ integer: true, min: 1 })),
    /* Вопрос приходит из движка оценки, и его поля зависят от вида. Тип
       расширен нарочно: автор пишет `answer` и `options` литералом, и запрещать
       ему это значило бы заставить приводить типы в каждом файле курса. */
    question: questionsSchema() as s.Schema<QuestionBase & Record<string, unknown>>,
  }),
  tag: 'cy-quiz',
  reserve: 270,
  load: () => import('~/widgets/quiz'),
});
