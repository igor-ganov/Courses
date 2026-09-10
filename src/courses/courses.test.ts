import { describe, expect, it } from 'vitest';
import { COURSES, PIANO } from './index';
import { blockDefinitions, blocks, lookupBlock } from '~/content/registry';

/* Содержание проверяется так же, как код. Курс, который собрался, но в котором
   виток без задания или ссылка в никуда, — это брак, который увидит читатель,
   а не сборка.

   Сам факт, что этот файл импортируется без падения, уже означает, что схема и
   граф прошли: проверка стоит в index.ts и бросает при импорте. */

describe('учебный план', () => {
  it('собран и связен', () => {
    expect(COURSES.length).toBeGreaterThan(0);
    for (const курс of COURSES) expect(PIANO.course(курс.id), курс.id).toBeDefined();
    expect(PIANO.course('kubernetes')).toBeDefined();
  });

  it('спираль идёт по глубине и начинается со всех первых витков', () => {
    /* Проверяется для каждого курса, а не для названного: спираль — свойство
       платформы, и курс, в котором она развалилась, должен уронить сборку
       независимо от того, вспомнили о нём здесь или нет. */
    for (const курс of COURSES) {
      const порядок = PIANO.spiralOrder(курс.id).map(String);
      const первые = порядок.slice(0, курс.topics.length);
      expect(первые.every((k) => k.endsWith(':1')), курс.id).toBe(true);
      expect(new Set(первые).size, курс.id).toBe(курс.topics.length);
    }
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
    /* Список берётся из реестра, а не пишется здесь. Прежде он был литералом,
       и новый прибор в курсе молча не считался живым: проверка проходила,
       а обещание «модели, а не пересказ» держалось на памяти автора.
       Задание из этого списка исключено нарочно — вопрос не модель. */
    const живые = new Set<string>([
      ...blockDefinitions()
        .filter((d) => d.tag && d.kind !== 'question')
        .map((d) => d.kind),
      'figure',
    ]);
    for (const курс of COURSES) {
      for (const тема of курс.topics) {
        for (const виток of тема.levels) {
          const есть = виток.lecture.some((b) => живые.has(b.kind));
          expect(есть, `${тема.id}:${виток.depth}`).toBe(true);
        }
      }
    }
  });

  it('в каждом витке есть живая модель, а не только схема', () => {
    /* Проверка выше довольствуется схемой, и это оказалось слишком мягко:
       восемь витков из одиннадцати имели рисунок, задания — и ничего, что
       можно покрутить. Читатель это увидел первым и сказал прямо: «ни одной
       интерактивной игры, только квизы».

       Живой считается прибор — зарегистрированный блок с элементом; задание
       не считается, вопрос не модель. Схема остаётся полезной, но перестаёт
       быть достаточной. */
    const живые = new Set<string>(
      blockDefinitions()
        .filter((d) => d.tag && d.kind !== 'question')
        .map((d) => d.kind),
    );
    for (const курс of COURSES) {
      for (const тема of курс.topics) {
        for (const виток of тема.levels) {
          const есть = виток.lecture.some((b) => живые.has(b.kind));
          expect(есть, `${тема.id}:${виток.depth} — нет ни одного прибора`).toBe(true);
        }
      }
    }
  });

  it('в основном курсе в каждой теме есть то, что можно выиграть', () => {
    /* Прибор, который только показывает, — половина дела: у темы должно быть
       и состояние, которого читатель добивается сам.
       
       Требование стоит на курсе про Kubernetes, а не на всех: в курсе по
       кибернетике четыре темы из девяти показывают, но не дают выиграть —
       «Жизнь», клеточный автомат, удвоения периода и чёрный ящик цели не
       произносят вовсе. Это известный долг, а не оплошность проверки, и
       закрывать его надо работой в приборах, а не смягчением требования
       до бессмысленного. */
    const курс = COURSES.find((c) => c.id === 'kubernetes')!;
    for (const тема of курс.topics) {
      const цели = тема.levels.flatMap((виток) =>
        виток.lecture.flatMap((b) => lookupBlock(b.kind)?.goals?.(b) ?? []),
      );
      expect(цели.length, `${курс.id}/${тема.id} — нечего выигрывать`).toBeGreaterThan(0);
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
