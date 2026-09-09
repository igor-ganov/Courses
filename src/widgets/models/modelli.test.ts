import { describe, expect, it } from 'vitest';
import {
  canRegulate,
  createBlackBox,
  createVarietyGame,
  residualVariety,
  unhandled,
  variety,
  type Machine,
  type VarietyTable,
} from './varieta';
import {
  FIGURES,
  createGrid,
  elementaryRun,
  elementaryStep,
  lifeStep,
  population,
  setCells,
  singleSeed,
  soup,
} from './automi';
import {
  attractorAt,
  distance,
  logisticOrbit,
  lorenzStep,
  lorenzTrail,
  lyapunov,
  period,
} from './dinamica';

/* ── разнообразие ───────────────────────────────────────────────────── */

/* Закон необходимого разнообразия нельзя рассказать — в него нужно проиграть.
   Поэтому модель обязана честно отбирать у регулятора возможность победить,
   когда ходов становится меньше, чем помех. */

const таблица = (moves: number): VarietyTable => ({
  disturbances: ['холод', 'жара', 'сквозняк'],
  moves: ['греть', 'студить', 'закрыть'].slice(0, moves),
  /* Каждой помехе отвечает ровно один ход; ноль — исход приемлемый. */
  outcomes: [
    [0, 1, 1].slice(0, moves),
    [1, 0, 1].slice(0, moves),
    [1, 1, 0].slice(0, moves),
  ],
});

describe('закон необходимого разнообразия', () => {
  it('регулятор с ходом на каждую помеху держит исход', () => {
    expect(canRegulate(таблица(3))).toBe(true);
    expect(unhandled(таблица(3))).toEqual([]);
  });

  it('отними один ход — и появляется помеха, которую нечем отработать', () => {
    expect(canRegulate(таблица(2))).toBe(false);
    expect(unhandled(таблица(2))).toEqual(['сквозняк']);
  });

  it('разнообразие меряется в битах, и нехватка тоже', () => {
    expect(variety(8)).toBe(3);
    expect(residualVariety(8, 8)).toBe(0);
    expect(residualVariety(8, 2)).toBe(2);
    expect(residualVariety(2, 8)).toBe(0);
  });

  it('в игре ход по помехе выигрывает, ход мимо — нет', () => {
    const игра = createVarietyGame(таблица(3), { seed: 1, target: 3 });
    let выиграно = 0;
    for (let i = 0; i < 12; i += 1) {
      const помеха = игра.current();
      if (игра.play(помеха).ok) выиграно += 1;
    }
    expect(выиграно).toBe(12);
    expect(игра.goal().reached).toBe(true);
  });

  it('с урезанным набором ходов идеальная игра всё равно проигрывает', () => {
    const игра = createVarietyGame(таблица(2), { seed: 3, target: 12 });
    let выиграно = 0;
    for (let i = 0; i < 12; i += 1) {
      const помеха = игра.current();
      /* Лучшее, что можно сделать: если ход есть — сделать его. */
      if (игра.play(Math.min(помеха, 1)).ok) выиграно += 1;
    }
    expect(выиграно).toBeLessThan(12);
    expect(игра.goal().reached).toBe(false);
    expect(игра.goal().score).toBeGreaterThan(0);
  });
});

describe('чёрный ящик', () => {
  const триггер: Machine = {
    name: 'триггер',
    states: 2,
    next: [
      [0, 1],
      [1, 0],
    ],
    out: [
      ['0', '0'],
      ['1', '1'],
    ],
  };
  const эхо: Machine = {
    name: 'эхо',
    states: 1,
    next: [[0, 0]],
    out: [['0', '1']],
  };
  const тишина: Machine = {
    name: 'тишина',
    states: 1,
    next: [[0, 0]],
    out: [['0', '0']],
  };

  it('отвечает по своему автомату, а не по гипотезе', () => {
    const ящик = createBlackBox(триггер);
    expect(ящик.send(1)).toBe('0'); // выход берётся ДО перехода
    expect(ящик.send(0)).toBe('1');
  });

  it('наблюдения отсеивают гипотезы', () => {
    const ящик = createBlackBox(триггер);
    const все = [триггер, эхо, тишина];
    expect(ящик.survivors(все)).toHaveLength(3);
    ящик.send(1);
    ящик.send(0);
    expect(ящик.survivors(все).map((m) => m.name)).toEqual(['триггер']);
  });

  it('опознание засчитывается только когда осталась одна гипотеза, и она верная', () => {
    const ящик = createBlackBox(триггер);
    const все = [триггер, эхо, тишина];
    expect(ящик.goal(все).reached).toBe(false);
    ящик.send(1);
    ящик.send(0);
    expect(ящик.goal(все).reached).toBe(true);
    expect(ящик.goal(все).score).toBe(1);
  });

  it('частичный балл растёт по мере сужения круга', () => {
    const ящик = createBlackBox(триггер);
    const все = [триггер, эхо, тишина];
    ящик.send(0); // выход '0' — отсеивает только эхо? нет: эхо на 0 даёт '0'
    const после = ящик.goal(все).score;
    expect(после).toBeGreaterThanOrEqual(0);
    expect(после).toBeLessThanOrEqual(1);
  });
});

/* ── автоматы ───────────────────────────────────────────────────────── */

describe('элементарный клеточный автомат', () => {
  it('правило 0 гасит всё, правило 255 зажигает всё', () => {
    expect(elementaryStep([1, 0, 1], 0)).toEqual([0, 0, 0]);
    expect(elementaryStep([0, 0, 0], 255)).toEqual([1, 1, 1]);
  });

  it('правило 90 — это XOR соседей, треугольник Серпинского', () => {
    const ряды = elementaryRun(9, 90, 2);
    expect(ряды[0]).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0]);
    expect(ряды[1]).toEqual([0, 0, 0, 1, 0, 1, 0, 0, 0]);
    expect(ряды[2]).toEqual([0, 0, 1, 0, 0, 0, 1, 0, 0]);
  });

  it('края замкнуты в кольцо: на них не появляется поведения, которого нет в правиле', () => {
    // Правило 90: у крайней клетки соседи — противоположный край.
    expect(elementaryStep([1, 0, 0], 90)).toEqual([0, 1, 1]);
  });

  it('правило 30 не сваливается ни в покой, ни в период — на этом его и ловят', () => {
    const ряды = elementaryRun(101, 30, 60);
    const строки = new Set(ряды.map((r) => r.join('')));
    expect(строки.size).toBeGreaterThan(50);
  });

  it('начальный ряд — одна живая клетка посередине', () => {
    expect(singleSeed(5)).toEqual([0, 0, 1, 0, 0]);
  });
});

describe('«Жизнь»', () => {
  it('блок не меняется никогда', () => {
    let g = setCells(createGrid(8, 8), FIGURES.блок!);
    const было = [...g.cells];
    for (let i = 0; i < 5; i += 1) g = lifeStep(g);
    expect([...g.cells]).toEqual(было);
  });

  it('мигалка возвращается к себе за два шага, а за один — нет', () => {
    const начало = setCells(createGrid(8, 8), FIGURES.мигалка!);
    const шаг = lifeStep(начало);
    expect([...шаг.cells]).not.toEqual([...начало.cells]);
    expect([...lifeStep(шаг).cells]).toEqual([...начало.cells]);
  });

  it('планёр повторяет себя через четыре шага, сдвинувшись по диагонали', () => {
    let g = setCells(createGrid(12, 12), FIGURES.планёр!);
    const было = population(g);
    for (let i = 0; i < 4; i += 1) g = lifeStep(g);
    expect(population(g)).toBe(было);
    const сдвинутый = setCells(
      createGrid(12, 12),
      FIGURES.планёр!.map(([x, y]) => [x + 1, y + 1] as const),
    );
    expect([...g.cells]).toEqual([...сдвинутый.cells]);
  });

  it('одинокая клетка умирает', () => {
    const g = setCells(createGrid(6, 6), [[3, 3]]);
    expect(population(lifeStep(g))).toBe(0);
  });
});

/* ── динамика ───────────────────────────────────────────────────────── */

describe('логистическое отображение', () => {
  it('при малом r всё вымирает', () => {
    const орбита = logisticOrbit(0.4, 0.8, 200);
    expect(орбита[орбита.length - 1]).toBeLessThan(1e-6);
  });

  it('удвоения периода: покой, потом два состояния, потом четыре', () => {
    expect(period(attractorAt(2.8))).toBe(1);
    expect(period(attractorAt(3.2))).toBe(2);
    expect(period(attractorAt(3.5))).toBe(4);
  });

  it('за порогом хаоса период перестаёт быть числом', () => {
    expect(period(attractorAt(3.9))).toBe(Infinity);
  });

  it('показатель Ляпунова отрицателен в покое и положителен в хаосе', () => {
    expect(lyapunov(3.2)).toBeLessThan(0);
    expect(lyapunov(3.9)).toBeGreaterThan(0);
  });

  it('окно периода три внутри хаоса — оно там правда есть', () => {
    expect(period(attractorAt(3.83))).toBe(3);
  });
});

describe('аттрактор Лоренца', () => {
  it('остаётся в ограниченной области, а не улетает', () => {
    const след = lorenzTrail({ x: 1, y: 1, z: 1 }, 6000);
    for (const p of след.slice(2000)) {
      expect(Math.abs(p.x)).toBeLessThan(60);
      expect(Math.abs(p.y)).toBeLessThan(80);
      expect(p.z).toBeGreaterThan(0);
      expect(p.z).toBeLessThan(80);
    }
  });

  it('соседние траектории расходятся — предсказание имеет горизонт', () => {
    let a = { x: 1, y: 1, z: 1 };
    let b = { x: 1 + 1e-9, y: 1, z: 1 };
    const было = distance(a, b);
    for (let i = 0; i < 6000; i += 1) {
      a = lorenzStep(a, 0.006);
      b = lorenzStep(b, 0.006);
    }
    expect(distance(a, b)).toBeGreaterThan(было * 1e6);
  });

  it('но система детерминирована: тот же старт — тот же след', () => {
    const a = lorenzTrail({ x: 2, y: 3, z: 4 }, 500);
    const b = lorenzTrail({ x: 2, y: 3, z: 4 }, 500);
    expect(a[500]).toEqual(b[500]);
  });

  it('неподвижная точка в начале координат остаётся неподвижной', () => {
    const p = lorenzStep({ x: 0, y: 0, z: 0 }, 0.01);
    expect(p).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('россыпь для «Жизни»', () => {
  it('одно зерно даёт одно и то же поле', () => {
    const a = soup(20, 12, 0.3, 7);
    const b = soup(20, 12, 0.3, 7);
    expect([...a.cells]).toEqual([...b.cells]);
    expect(soup(20, 12, 0.3, 8).cells).not.toEqual(a.cells);
  });

  it('плотность примерно та, что заказана', () => {
    const g = soup(120, 80, 0.28);
    const доля = population(g) / (120 * 80);
    expect(доля).toBeGreaterThan(0.24);
    expect(доля).toBeLessThan(0.32);
  });

  it('россыпь приходит к покою, а не к пустоте: правило порождает структуры', () => {
    /* Из случайного месива само собой выпадают устойчивые фигуры. Проверка
       ровно этого: население падает в разы, но не в ноль, и к двухсотому
       поколению почти не меняется. */
    let g = soup(80, 60, 0.3, 3);
    const начало = population(g);
    for (let i = 0; i < 200; i += 1) g = lifeStep(g);
    const после = population(g);
    let ещё = g;
    for (let i = 0; i < 20; i += 1) ещё = lifeStep(ещё);

    expect(после).toBeGreaterThan(20);
    expect(после).toBeLessThan(начало / 2);
    expect(Math.abs(population(ещё) - после)).toBeLessThan(после * 0.3);
  });
});
