import { describe, expect, it } from 'vitest';
import { createSessione } from './sessione';

describe('сессия витка', () => {
  it('пустая сессия не сдана и оценки не имеет', () => {
    const с = createSessione(2);
    expect(с.compiuto()).toBe(false);
    expect(с.voto()).toBe(0);
    expect(с.fatto).toBe(0);
  });

  it('виток без работ считается сделанным сразу', () => {
    expect(createSessione(0).compiuto()).toBe(true);
  });

  it('сдана, когда сданы все работы', () => {
    const с = createSessione(2);
    с.segna({ id: 'a', score: 1, difficulty: 3 });
    expect(с.compiuto()).toBe(false);
    с.segna({ id: 'b', score: 0, difficulty: 3 });
    expect(с.compiuto()).toBe(true);
  });

  it('повторный ответ заменяет прежний, а не добавляется', () => {
    const с = createSessione(1);
    с.segna({ id: 'a', score: 0, difficulty: 2 });
    с.segna({ id: 'a', score: 1, difficulty: 2 });
    expect(с.fatto).toBe(1);
    expect(с.voto()).toBe(1);
  });

  it('оценка взвешена по трудности', () => {
    const с = createSessione(2);
    /* Сдан трудный, провален лёгкий: оценка должна быть выше половины. */
    с.segna({ id: 'трудный', score: 1, difficulty: 5 });
    с.segna({ id: 'лёгкий', score: 0, difficulty: 1 });
    expect(с.voto()).toBeCloseTo(5 / 6, 6);

    const наоборот = createSessione(2);
    наоборот.segna({ id: 'трудный', score: 0, difficulty: 5 });
    наоборот.segna({ id: 'лёгкий', score: 1, difficulty: 1 });
    expect(наоборот.voto()).toBeCloseTo(1 / 6, 6);
  });

  it('оценка зажата в 0…1, трудность — в 1…5', () => {
    const с = createSessione(1);
    с.segna({ id: 'a', score: 7, difficulty: 40 });
    expect(с.voto()).toBe(1);
    expect(с.difficolta()).toBe(5);

    const плохая = createSessione(1);
    плохая.segna({ id: 'a', score: Number.NaN, difficulty: 0 });
    expect(плохая.voto()).toBe(0);
    expect(плохая.difficolta()).toBe(1);
  });

  it('сводная трудность — средняя по работам', () => {
    const с = createSessione(2);
    с.segna({ id: 'a', score: 1, difficulty: 2 });
    с.segna({ id: 'b', score: 1, difficulty: 4 });
    expect(с.difficolta()).toBe(3);
  });

  it('порядок сохраняется для отображения', () => {
    const с = createSessione(3);
    с.segna({ id: 'первый', score: 1, difficulty: 1 });
    с.segna({ id: 'второй', score: 1, difficulty: 1 });
    с.segna({ id: 'первый', score: 0, difficulty: 1 });
    expect(с.esiti().map((э) => э.id)).toEqual(['первый', 'второй']);
    expect(с.esiti()[0]!.score).toBe(0);
  });
});
