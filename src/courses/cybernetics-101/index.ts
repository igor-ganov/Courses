/**
 * «Кибернетика: введение» — the course this platform was built to carry.
 *
 * Four modules, nine topics, seventeen turns of the spiral. The module order is
 * the reading order; the spiral order (every topic at level 1, then every topic
 * at level 2) is what the platform actually suggests, so a learner meets every
 * idea once before any idea gets hard.
 */

import type { Course } from '@/content/model';
import { whatIsCybernetics } from './topics/foundations';
import { feedback } from './topics/feedback';
import { control, stability } from './topics/control';
import { variety, blackbox } from './topics/variety';
import { information } from './topics/information';
import { emergence, secondOrder } from './topics/emergence';

export const cybernetics101: Course = {
  id: 'cybernetics-101',
  title: 'Кибернетика: введение',
  subtitle: 'Обратная связь, разнообразие, информация, устойчивость и самоорганизация — на моделях, а не на пересказе',
  description:
    'Вводный курс, в котором каждое понятие сначала встречается в работающей модели, а уже потом получает определение. Материал построен по спирали: сперва все темы проходятся на первом уровне глубины, затем те же понятия возвращаются с новым аппаратом. Уровни явно наследуют цели друг друга и ссылаются на связанные лекции — вперёд и назад по курсу.',
  level: 'intro',
  modules: [
    {
      id: 'foundations',
      title: 'Основания',
      glyph: '↻',
      description:
        'Что за дисциплина, откуда взялась и на какой структуре держится. Здесь появляется контур обратной связи — объект, к которому курс будет возвращаться на каждом витке.',
      topicIds: ['whatis', 'feedback'],
    },
    {
      id: 'regulation',
      title: 'Управление и устойчивость',
      glyph: '⚖',
      description:
        'Как система удерживает себя в границах жизнеспособности, почему усиление регулятора имеет предел и что происходит, когда предел пройден.',
      topicIds: ['control', 'stability'],
    },
    {
      id: 'variety-information',
      title: 'Разнообразие и информация',
      glyph: '∑',
      description:
        'Два способа измерить сложность задачи управления: разнообразие Эшби и энтропия Шеннона. Плюс метод изучения систем, внутрь которых заглянуть нельзя.',
      topicIds: ['variety', 'information', 'blackbox'],
    },
    {
      id: 'self-organisation',
      title: 'Самоорганизация и наблюдатель',
      glyph: '✳',
      description:
        'Порядок, возникающий без центра, системы, производящие сами себя, и поворот дисциплины к тому, кто её применяет.',
      topicIds: ['emergence', 'secondorder'],
    },
  ],
  topics: [
    whatIsCybernetics,
    feedback,
    control,
    stability,
    variety,
    information,
    blackbox,
    emergence,
    secondOrder,
  ],
};
