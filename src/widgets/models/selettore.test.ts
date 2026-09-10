import { describe, expect, it } from 'vitest';
import { corrisponde, createSelettore, NABOR } from './selettore';

/* Проверяется то, ради чего головоломку и показывают: что условие отбирает
   по признаку, а не по списку; что «не равно» выполняется и при отсутствии
   метки; и что набор действительно содержит обе задуманные ошибки — иначе
   головоломка решалась бы первым же нажатием, ничему не научив. */

describe('одно условие', () => {
  const под = { id: 1, name: 'п', labels: { app: 'web', tier: 'frontend' } };

  it('равенство требует именно этого значения', () => {
    expect(corrisponde(под, { key: 'app', op: 'eq', value: 'web' })).toBe(true);
    expect(corrisponde(под, { key: 'app', op: 'eq', value: 'api' })).toBe(false);
  });

  it('«не равно» выполняется и когда метки нет вовсе', () => {
    /* Ловушка настоящего отбора: под без метки release попадает в выборку
       release!=canary. Читателю полезно встретить это здесь, а не в бою. */
    expect(corrisponde(под, { key: 'release', op: 'ne', value: 'canary' })).toBe(true);
  });

  it('равенство при отсутствии метки не выполняется', () => {
    expect(corrisponde(под, { key: 'release', op: 'eq', value: 'stable' })).toBe(false);
  });
});

describe('пустой отбор', () => {
  it('забирает всех, а не никого', () => {
    const s = createSelettore(NABOR);
    expect(s.state().matched).toHaveLength(NABOR.pods.length);
  });

  it('и потому сразу показывает лишних', () => {
    const s = createSelettore(NABOR);
    expect(s.state().extra.length).toBeGreaterThan(0);
    expect(s.state().solved).toBe(false);
  });
});

describe('набор по умолчанию', () => {
  const включить = (...номера: number[]) => {
    const s = createSelettore(NABOR);
    for (const i of номера) s.toggle(i);
    return s;
  };

  it('решается ровно отбором по роли и исключением пробной версии', () => {
    const s = включить(0, 4);
    expect(s.state().matched).toEqual([1, 6]);
    expect(s.state().solved).toBe(true);
    expect(s.goal().reached).toBe(true);
  });

  it('отбор по месту теряет своего: web-f стоит в backend', () => {
    /* Ошибка, ради которой набор и составлен: `tier=frontend` для веб-службы
       выглядит разумным условием и молча выкидывает работающий экземпляр. */
    const s = включить(0, 2, 4);
    expect(s.state().matched).toEqual([1]);
    expect(s.state().missing).toEqual([6]);
    expect(s.state().solved).toBe(false);
  });

  it('без исключения пробной версии захватывает лишнего', () => {
    const s = включить(0);
    expect(s.state().extra).toEqual([2]);
    expect(s.state().solved).toBe(false);
  });

  it('противоречивые условия дают пустую выборку', () => {
    const s = включить(0, 1);
    expect(s.state().matched).toEqual([]);
    expect(s.state().missing).toEqual([1, 6]);
  });

  it('балл растёт по мере приближения, а не скачет', () => {
    const пусто = createSelettore(NABOR);
    const почти = включить(0);
    const точно = включить(0, 4);
    expect(пусто.goal().score).toBeLessThan(почти.goal().score);
    expect(почти.goal().score).toBeLessThan(точно.goal().score);
    expect(точно.goal().score).toBe(1);
  });
});

describe('переключение', () => {
  it('снимает условие обратно', () => {
    const s = createSelettore(NABOR);
    s.toggle(0);
    const было = s.state().matched.length;
    s.toggle(0);
    expect(s.state().matched.length).toBeGreaterThan(было);
  });

  it('сброс выключает всё', () => {
    const s = createSelettore(NABOR);
    s.toggle(0);
    s.toggle(4);
    s.reset();
    expect(s.state().on.every((x) => !x)).toBe(true);
  });

  it('несуществующее условие не роняет прибор', () => {
    const s = createSelettore(NABOR);
    s.toggle(99);
    expect(s.state().on.every((x) => !x)).toBe(true);
  });
});
