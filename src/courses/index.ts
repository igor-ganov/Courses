/**
 * НАБОР КУРСОВ — то, что платформа несёт.
 *
 * Здесь же курсы проверяются целиком: форма — схемой, связность — графом.
 * Проверка идёт при импорте, то есть на сборке: страница с битой ссылкой не
 * должна доезжать до читателя, а должна не собраться.
 */

import { curriculum, validateCurriculum } from '~/content/graph';
import '~/blocks';
import { cibernetica } from './cibernetica';

export const COURSES = [cibernetica];

const беды = validateCurriculum(COURSES);
if (беды.length > 0) {
  throw new Error(
    'учебный план не сходится:\n' +
      беды.map((b) => `  ${b.path || '<корень>'}: ${b.message}`).join('\n'),
  );
}

export const PIANO = curriculum(COURSES);
