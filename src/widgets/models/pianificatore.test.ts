import { describe, expect, it } from 'vitest';
import { createScheduler, OBSTANOVKA, type SchedulerSettings } from './pianificatore';

/* Проверяется то, ради чего прибор показывают: что размещение идёт по
   заявкам, что отсев отвечает без оттенков, что оценка не даёт выесть один
   ресурс до дна, и что не влезшее не пропадает, а ждёт. */

const один: SchedulerSettings = {
  nodi: [
    { id: 1, name: 'а', cpu: 4, mem: 8 },
    { id: 2, name: 'б', cpu: 4, mem: 8 },
  ],
  coda: [{ id: 1, name: 'под', cpu: 1, mem: 1 }],
};

describe('отсев', () => {
  it('не пускает туда, где не хватает ядер, и говорит почему', () => {
    const s = createScheduler({
      nodi: [{ id: 1, name: 'а', cpu: 1, mem: 8 }],
      coda: [{ id: 1, name: 'под', cpu: 2, mem: 1 }],
    });
    const р = s.invia()!;
    expect(р.nodo).toBeUndefined();
    expect(р.verdetti[0]!.adatto).toBe(false);
    expect(р.verdetti[0]!.perche).toBe('мало ядер');
  });

  it('различает нехватку памяти и нехватку ядер', () => {
    const s = createScheduler({
      nodi: [{ id: 1, name: 'а', cpu: 8, mem: 1 }],
      coda: [{ id: 1, name: 'под', cpu: 1, mem: 4 }],
    });
    expect(s.invia()!.verdetti[0]!.perche).toBe('мало памяти');
  });

  it('считает заявленное, а не потребляемое: сумма заявок и есть занятое', () => {
    const s = createScheduler({
      nodi: [{ id: 1, name: 'а', cpu: 4, mem: 8 }],
      coda: [
        { id: 1, name: 'п1', cpu: 3, mem: 1 },
        { id: 2, name: 'п2', cpu: 2, mem: 1 },
      ],
    });
    s.invia();
    const второй = s.invia()!;
    expect(второй.nodo).toBeUndefined();
    expect(s.state().occupato[0]!.cpu).toBe(3);
  });
});

describe('оценка', () => {
  it('при равных узлах выбирает свободный, а не первый попавшийся', () => {
    const s = createScheduler({
      nodi: [
        { id: 1, name: 'а', cpu: 4, mem: 8 },
        { id: 2, name: 'б', cpu: 4, mem: 8 },
      ],
      coda: [
        { id: 1, name: 'п1', cpu: 2, mem: 4 },
        { id: 2, name: 'п2', cpu: 2, mem: 4 },
      ],
    });
    expect(s.invia()!.nodo).toBe(1);
    expect(s.invia()!.nodo).toBe(2);
  });

  it('не выедает один ресурс до дна, оставив другой нетронутым', () => {
    /* Узел «а» уже перекошен: ядра съедены, память цела. Правило «где ровнее»
       уводит процессорный под на ровный узел, хотя по остатку ядер они равны. */
    const s = createScheduler({
      nodi: [
        { id: 1, name: 'а', cpu: 8, mem: 8 },
        { id: 2, name: 'б', cpu: 8, mem: 8 },
      ],
      coda: [
        { id: 1, name: 'перекос', cpu: 4, mem: 0.5 },
        { id: 2, name: 'ещё ядра', cpu: 2, mem: 0.5 },
      ],
    });
    expect(s.invia()!.nodo).toBe(1);
    expect(s.invia()!.nodo).toBe(2);
  });

  it('баллы выставлены всем прошедшим отсев, а не только победителю', () => {
    const s = createScheduler(один);
    const р = s.invia()!;
    expect(р.verdetti.filter((v) => v.adatto).length).toBe(2);
    expect(р.verdetti.every((v) => !v.adatto || v.punti > 0)).toBe(true);
  });
});

describe('ожидание', () => {
  it('не влезший под не пропадает, а ждёт', () => {
    const s = createScheduler({
      nodi: [{ id: 1, name: 'а', cpu: 1, mem: 1 }],
      coda: [{ id: 1, name: 'толстый', cpu: 4, mem: 4 }],
    });
    s.invia();
    expect(s.state().attesa).toHaveLength(1);
    expect(s.state().posti).toHaveLength(0);
  });

  it('размещённых не переставляет ради того, кто не влез', () => {
    /* Три мелких занимают три узла; крупному места нет, хотя, сдвинув мелкие,
       его можно было бы поставить. Настоящий планировщик тоже так не умеет. */
    const s = createScheduler({
      nodi: [
        { id: 1, name: 'а', cpu: 2, mem: 2 },
        { id: 2, name: 'б', cpu: 2, mem: 2 },
      ],
      coda: [
        { id: 1, name: 'м1', cpu: 1.5, mem: 1 },
        { id: 2, name: 'м2', cpu: 1.5, mem: 1 },
        { id: 3, name: 'крупный', cpu: 2, mem: 2 },
      ],
    });
    s.invia();
    s.invia();
    s.invia();
    expect(s.state().attesa).toHaveLength(1);
    expect(s.state().posti).toHaveLength(2);
  });
});

describe('обстановка по умолчанию', () => {
  it('в порядке очереди заводит в тупик: место есть, а поставить некуда', () => {
    /* Ради этого она и подобрана: осколочность видна на пяти подах,
       а не на теоретическом рассуждении. */
    const s = createScheduler(OBSTANOVKA, { placed: 5 });
    for (let i = 0; i < 5; i += 1) s.invia();
    expect(s.state().attesa.length).toBeGreaterThan(0);
    expect(s.goal().reached).toBe(false);

    const свободноCpu = OBSTANOVKA.nodi.reduce((с, n, i) => с + n.cpu - s.state().occupato[i]!.cpu, 0);
    expect(свободноCpu).toBeGreaterThan(0);
  });

  it('но решается: порядок отправки — и есть задача читателя', () => {
    const s = createScheduler(
      {
        nodi: OBSTANOVKA.nodi,
        /* Крупные вперёд, пока места лежат крупными кусками. */
        coda: [...OBSTANOVKA.coda].sort((a, b) => b.cpu + b.mem - (a.cpu + a.mem)),
      },
      { placed: 5 },
    );
    for (let i = 0; i < 5; i += 1) s.invia();
    expect(s.state().attesa).toHaveLength(0);
    expect(s.goal().reached).toBe(true);
  });
});

describe('задание', () => {
  it('не засчитывается, пока хоть кто-то в ожидании', () => {
    const s = createScheduler(
      { nodi: [{ id: 1, name: 'а', cpu: 2, mem: 2 }], coda: [
        { id: 1, name: 'п1', cpu: 1, mem: 1 },
        { id: 2, name: 'п2', cpu: 4, mem: 4 },
      ] },
      { placed: 1 },
    );
    s.invia();
    expect(s.goal().reached).toBe(true);
    s.invia();
    expect(s.goal().reached).toBe(false);
  });

  it('начинает сначала по сбросу', () => {
    const s = createScheduler(OBSTANOVKA, { placed: 5 });
    for (let i = 0; i < 5; i += 1) s.invia();
    s.reset();
    expect(s.state().posti).toHaveLength(0);
    expect(s.state().coda).toHaveLength(5);
    expect(s.state().occupato.every((o) => o.cpu === 0 && o.mem === 0)).toBe(true);
  });
});

describe('выбор порядка', () => {
  it('можно отправить не первого, а названного', () => {
    const s = createScheduler(OBSTANOVKA, { placed: 5 });
    s.invia(5);
    expect(s.state().posti[0]!.pod.name).toBe('счёт');
    expect(s.state().coda).toHaveLength(4);
  });

  it('и тогда обстановка по умолчанию решается целиком', () => {
    /* Тот же набор, что заводит в тупик по порядку записи: крупный вперёд —
       и в ожидании не остаётся никого. Это и есть задание читателю. */
    const s = createScheduler(OBSTANOVKA, { placed: 5 });
    s.invia(5);
    for (const id of [1, 2, 3, 4]) s.invia(id);
    expect(s.state().attesa).toHaveLength(0);
    expect(s.goal().reached).toBe(true);
  });

  it('несуществующий под не отправляется и очередь не трогает', () => {
    const s = createScheduler(OBSTANOVKA);
    expect(s.invia(99)).toBeUndefined();
    expect(s.state().coda).toHaveLength(5);
  });
});
