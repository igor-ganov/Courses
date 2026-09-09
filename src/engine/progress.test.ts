import { describe, expect, it } from 'vitest';
import { createProgress, RANKS, type Clock, type Store } from './progress';

/* Прогресс — единственное место платформы, которое хранит состояние, поэтому
   часы и хранилище приходят снаружи: иначе поведение нельзя проверить, а
   «завтра» в тесте становится ожиданием в сутки.

   Мастерство здесь — скользящее среднее, а не флажок «сдал». Флажок врёт в обе
   стороны: угадавший с третьего раза выглядит как знающий, а знающий, который
   один раз ошибся, теряет всё. */

class Часы implements Clock {
  constructor(private t = Date.UTC(2026, 0, 1, 12)) {}
  now() {
    return this.t;
  }
  вперёд(дней: number) {
    this.t += дней * 86_400_000;
    return this;
  }
}

class Память implements Store {
  data = new Map<string, string>();
  get(k: string) {
    return this.data.get(k) ?? null;
  }
  set(k: string, v: string) {
    this.data.set(k, v);
  }
}

const создать = (clock = new Часы(), store = new Память()) =>
  ({ p: createProgress({ clock, store }), clock, store });

describe('опыт и звания', () => {
  it('начисляет опыт по трудности и качеству, а не по факту открытия страницы', () => {
    const { p } = создать();
    const слабо = p.record('feedback:1', { score: 0.4, difficulty: 3 });
    expect(слабо.xpGained).toBeGreaterThan(0);
    const { p: p2 } = создать();
    const сильно = p2.record('feedback:1', { score: 1, difficulty: 3 });
    expect(сильно.xpGained).toBeGreaterThan(слабо.xpGained);
  });

  it('за повтор того же витка даёт меньше: опыт за работу, а не за перезаход', () => {
    const { p } = создать();
    const первый = p.record('feedback:1', { score: 1, difficulty: 3 }).xpGained;
    const второй = p.record('feedback:1', { score: 1, difficulty: 3 }).xpGained;
    expect(второй).toBeLessThan(первый);
    expect(второй).toBeGreaterThan(0);
  });

  it('звание растёт по порогам и сообщается один раз', () => {
    const { p } = создать();
    expect(p.rank().index).toBe(0);
    let повышений = 0;
    for (let i = 0; i < 40; i += 1) {
      if (p.record(`t${i}:1`, { score: 1, difficulty: 5 }).rankUp) повышений += 1;
    }
    expect(p.rank().index).toBeGreaterThan(0);
    expect(повышений).toBe(p.rank().index);
    expect(RANKS[p.rank().index]).toBe(p.rank().title);
  });
});

describe('мастерство', () => {
  it('скользящее среднее: одна ошибка не обнуляет, одна удача не венчает', () => {
    const { p } = создать();
    p.record('feedback:1', { score: 1, difficulty: 2 });
    const после_удачи = p.level('feedback:1').mastery;
    expect(после_удачи).toBeGreaterThan(0);
    expect(после_удачи).toBeLessThan(1);

    p.record('feedback:1', { score: 0, difficulty: 2 });
    expect(p.level('feedback:1').mastery).toBeGreaterThan(0);
    expect(p.level('feedback:1').mastery).toBeLessThan(после_удачи);
  });

  it('сходится к правде: пять успехов подряд дают высокое мастерство', () => {
    const { p } = создать();
    for (let i = 0; i < 5; i += 1) p.record('feedback:1', { score: 1, difficulty: 2 });
    expect(p.level('feedback:1').mastery).toBeGreaterThan(0.85);
  });

  it('виток считается пройденным, когда сдан, и это не то же, что мастерство', () => {
    const { p } = создать();
    p.record('feedback:1', { score: 0.5, difficulty: 2 });
    expect(p.isDone('feedback:1')).toBe(false);
    p.record('feedback:1', { score: 0.9, difficulty: 2 });
    expect(p.isDone('feedback:1')).toBe(true);
    expect(p.done().has('feedback:1')).toBe(true);
  });
});

describe('повторение', () => {
  it('после успеха срок растёт, после ошибки возвращается к завтра', () => {
    const часы = new Часы();
    const { p } = создать(часы);
    p.record('feedback:1', { score: 1, difficulty: 2 });
    const первый = p.level('feedback:1').interval;
    expect(первый).toBe(1);

    часы.вперёд(1);
    p.record('feedback:1', { score: 1, difficulty: 2 });
    expect(p.level('feedback:1').interval).toBeGreaterThan(первый);

    часы.вперёд(3);
    p.record('feedback:1', { score: 0.2, difficulty: 2 });
    expect(p.level('feedback:1').interval).toBe(1);
  });

  it('к повторению зовёт только то, чей срок настал', () => {
    const часы = new Часы();
    const { p } = создать(часы);
    p.record('feedback:1', { score: 1, difficulty: 2 });
    expect(p.due()).toEqual([]);
    часы.вперёд(1);
    expect(p.due().map((d) => d.key)).toEqual(['feedback:1']);
  });

  it('просроченное идёт первым: дольше ждало — раньше забудется', () => {
    const часы = new Часы();
    const { p } = создать(часы);
    p.record('a:1', { score: 1, difficulty: 2 });
    часы.вперёд(1);
    p.record('b:1', { score: 1, difficulty: 2 });
    часы.вперёд(2);
    expect(p.due().map((d) => d.key)).toEqual(['a:1', 'b:1']);
  });
});

describe('серия дней', () => {
  it('считает подряд идущие дни и помнит лучшую', () => {
    const часы = new Часы();
    const { p } = создать(часы);
    p.record('a:1', { score: 1, difficulty: 1 });
    expect(p.snapshot().streak.current).toBe(1);

    часы.вперёд(1);
    p.record('b:1', { score: 1, difficulty: 1 });
    expect(p.snapshot().streak.current).toBe(2);

    // Тот же день второй раз серию не удлиняет.
    p.record('c:1', { score: 1, difficulty: 1 });
    expect(p.snapshot().streak.current).toBe(2);

    часы.вперёд(3);
    p.record('d:1', { score: 1, difficulty: 1 });
    expect(p.snapshot().streak.current).toBe(1);
    expect(p.snapshot().streak.best).toBe(2);
  });
});

describe('знаки', () => {
  it('даются один раз и приходят событием', () => {
    const { p } = создать();
    const первый = p.record('a:1', { score: 0.9, difficulty: 1 });
    expect(первый.badges).toContain('первый-виток');
    const второй = p.record('b:1', { score: 0.9, difficulty: 1 });
    expect(второй.badges).not.toContain('первый-виток');
    expect(p.snapshot().badges).toContain('первый-виток');
  });

  it('за безошибочную работу и за неделю подряд', () => {
    const часы = new Часы();
    const { p } = создать(часы);
    expect(p.record('a:1', { score: 1, difficulty: 3 }).badges).toContain('без-единой-ошибки');
    for (let i = 1; i < 7; i += 1) {
      часы.вперёд(1);
      p.record(`b${i}:1`, { score: 0.8, difficulty: 1 });
    }
    expect(p.snapshot().badges).toContain('неделя-подряд');
  });
});

describe('сохранение', () => {
  it('переживает перезапуск', () => {
    const часы = new Часы();
    const склад = new Память();
    const { p } = создать(часы, склад);
    p.record('feedback:1', { score: 1, difficulty: 3 });
    const было = p.snapshot();

    const второй = createProgress({ clock: часы, store: склад });
    expect(второй.snapshot()).toEqual(было);
  });

  it('переживает и мусор в хранилище: испорченная запись не роняет платформу', () => {
    const склад = new Память();
    склад.set('courses.progress', '{ это не json');
    const p = createProgress({ clock: new Часы(), store: склад });
    expect(p.snapshot().xp).toBe(0);
    expect(() => p.record('a:1', { score: 1, difficulty: 1 })).not.toThrow();
  });

  it('выгружается и загружается обратно — это способ унести прогресс с собой', () => {
    const { p } = создать();
    p.record('feedback:1', { score: 1, difficulty: 3 });
    const слепок = p.export();

    const { p: чистый } = создать();
    expect(чистый.snapshot().xp).toBe(0);
    чистый.import(слепок);
    expect(чистый.snapshot()).toEqual(p.snapshot());
  });

  it('чужой файл не принимается молча', () => {
    const { p } = создать();
    expect(() => p.import('{"xp":"много"}')).toThrowError(/xp/);
  });
});
