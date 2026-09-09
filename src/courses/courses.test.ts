import { describe, expect, it } from 'vitest';
import { COURSES, PIANO } from './index';
import { blocks, lookupBlock } from '~/content/registry';

/* Содержание проверяется так же, как код. Курс, который собрался, но в котором
   виток без задания или ссылка в никуда, — это брак, который увидит читатель,
   а не сборка.

   Сам факт, что этот файл импортируется без падения, уже означает, что схема и
   граф прошли: проверка стоит в index.ts и бросает при импорте. */

describe('учебный план', () => {
  it('собран и связен', () => {
    expect(COURSES).toHaveLength(1);
    expect(PIANO.course('cibernetica')).toBeDefined();
  });

  it('спираль идёт по глубине и начинается со всех первых витков', () => {
    const порядок = PIANO.spiralOrder('cibernetica').map(String);
    const первые = порядок.slice(0, 9);
    expect(первые.every((k) => k.endsWith(':1'))).toBe(true);
    expect(new Set(первые).size).toBe(9);
  });

  it('в каждом витке есть хотя бы одно задание — иначе это чтение, а не курс', () => {
    for (const курс of COURSES) {
      for (const тема of курс.topics) {
        for (const виток of тема.levels) {
          const есть = виток.lecture.some((b) => b.kind === 'question');
          expect(есть, `${тема.id}:${виток.depth}`).toBe(true);
        }
      }
    }
  });

  it('в каждом витке есть интерактив или схема — курс обещает модели, а не пересказ', () => {
    const живые = new Set(['loop', 'ashby', 'blackbox', 'entropy', 'channel', 'automaton', 'life', 'logistic', 'lorenz', 'figure']);
    for (const курс of COURSES) {
      for (const тема of курс.topics) {
        for (const виток of тема.levels) {
          const есть = виток.lecture.some((b) => живые.has(b.kind));
          expect(есть, `${тема.id}:${виток.depth}`).toBe(true);
        }
      }
    }
  });

  it('материал глубокий: не «два абзаца и тест»', () => {
    for (const курс of COURSES) {
      for (const тема of курс.topics) {
        for (const виток of тема.levels) {
          const знаков = виток.lecture
            .filter((b) => b.kind === 'prose')
            .reduce((n, b) => n + String(b.text).length, 0);
          expect(знаков, `${тема.id}:${виток.depth}`).toBeGreaterThan(1500);
          expect(виток.lecture.length, `${тема.id}:${виток.depth}`).toBeGreaterThan(6);
        }
      }
    }
  });

  it('у каждого витка объявлены цели, и они разные', () => {
    const все: string[] = [];
    for (const курс of COURSES) {
      for (const тема of курс.topics) {
        for (const виток of тема.levels) {
          expect(виток.objectives.length, `${тема.id}:${виток.depth}`).toBeGreaterThan(1);
          все.push(...виток.objectives);
        }
      }
    }
    expect(new Set(все).size).toBe(все.length);
  });

  it('каждый блок курса проходит схему — это и есть проверка содержания', () => {
    const схема = blocks();
    for (const курс of COURSES) {
      курс.topics.forEach((тема, ti) =>
        тема.levels.forEach((виток, li) =>
          виток.lecture.forEach((блок, bi) => {
            const r = схема.check(блок, `${курс.id}.topics[${ti}].levels[${li}].lecture[${bi}]`);
            expect(r.ok ? [] : r.issues).toEqual([]);
          }),
        ),
      );
    }
  });

  it('у задания с целью на витке есть прибор, который эту цель произносит', () => {
    /* Задание вида «удержите контур» выглядит совершенно обычным вопросом, но
       ответить на него можно только через донесение прибора. Если прибора с
       такой целью на витке нет — или он есть, но не настроен на цель, — виток
       становится непроходимым, и заметить это по данным нельзя: и вопрос, и
       прибор по отдельности законны. Отсюда проверка. */
    for (const курс of COURSES) {
      for (const тема of курс.topics) {
        for (const виток of тема.levels) {
          const цели = виток.lecture
            .filter((б) => б.kind === 'question')
            .map((б) => (б as { question?: { kind?: string; goal?: string } }).question)
            .filter((в): в is { kind: string; goal: string } => в?.kind === 'goal');

          for (const вопрос of цели) {
            const где = `${тема.id}:${виток.depth} → ${вопрос.goal}`;
            const прибор = виток.lecture.find((б) =>
              (lookupBlock(б.kind)?.goals?.(б) ?? []).includes(вопрос.goal),
            );
            expect(прибор, где).toBeDefined();
          }
        }
      }
    }
  });

  it('витки, наследующие цели, ссылаются назад, а не вперёд', () => {
    for (const курс of COURSES) {
      for (const тема of курс.topics) {
        for (const виток of тема.levels) {
          for (const raw of виток.inherits ?? []) {
            const [, топик, глубина] = /^(?:[a-z0-9-]+\/)?([a-z0-9-]+):(\d+)$/.exec(raw)!;
            if (топик === тема.id) {
              expect(Number(глубина), `${тема.id}:${виток.depth} → ${raw}`).toBeLessThan(виток.depth);
            }
          }
        }
      }
    }
  });
});
