import { describe, expect, it } from 'vitest';
import { createCoda, DVER, OCHERED } from './coda';

/* Проверяются оба утверждения курса, которые этот прибор показывает:
   слежение дешевле опроса на порядки (а не на проценты), и очередь ключей
   схлопывает пачку в одну обработку. Если модель перестанет это
   подтверждать — падёт проверка, а не читатель. */

const прогнать = (s: ReturnType<typeof createCoda>, seconds: number, пачек = 0) => {
  const шагов = Math.round(seconds / 0.1);
  const когда = пачек > 0 ? Math.floor(шагов / (пачек + 1)) : -1;
  for (let i = 0; i < шагов; i += 1) {
    if (когда > 0 && i % когда === 0 && i > 0) s.burst();
    s.step();
  }
  return s.state();
};

describe('дверь', () => {
  it('опрос платит за весь список каждым наблюдателем', () => {
    const s = createCoda({ ...DVER, cheap: false });
    const st = прогнать(s, 10);
    /* Тысяча объектов, тридцать наблюдателей, раз в секунду — тридцать
       тысяч объектов через дверь в секунду. Считается по всему прогону, а
       не по последнему окну: окно закрывается по своим часам, и на его
       границе выходит то девять опросов, то одиннадцать. */
    const вСекунду = st.total / st.time;
    expect(вСекунду).toBeGreaterThan(DVER.objects * DVER.watchers * 0.85);
    expect(вСекунду).toBeLessThan(DVER.objects * DVER.watchers * 1.15);
  });

  it('слежение в спокойном кластере не стоит ничего', () => {
    const s = createCoda({ ...DVER, cheap: true });
    const st = прогнать(s, 10);
    expect(st.total).toBe(0);
  });

  it('и даже при изменениях дешевле опроса на порядки', () => {
    const опрос = прогнать(createCoda({ ...DVER, cheap: false }), 20, 3);
    const слежение = прогнать(createCoda({ ...DVER, cheap: true }), 20, 3);
    expect(слежение.total).toBeGreaterThan(0);
    expect(слежение.total * 10).toBeLessThan(опрос.total);
  });

  it('чаще опрашивать — дороже ровно во столько же раз', () => {
    const редко = прогнать(createCoda({ ...DVER, cheap: false, period: 2 }), 20);
    const часто = прогнать(createCoda({ ...DVER, cheap: false, period: 0.5 }), 20);
    /* Вчетверо — с допуском на границу окна: опрос попадает в прогон то
       целое число раз, то на один больше. */
    const во = часто.total / редко.total;
    expect(во).toBeGreaterThan(3);
    expect(во).toBeLessThan(5);
  });

  it('работа на одно изменение — то, ради чего считается', () => {
    const опрос = прогнать(createCoda({ ...DVER, cheap: false }), 20, 2);
    const слежение = прогнать(createCoda({ ...DVER, cheap: true }), 20, 2);
    expect(слежение.perChange).toBeLessThan(опрос.perChange);
  });
});

describe('очередь', () => {
  it('по событию обрабатывает каждое: сто изменений — сто обработок', () => {
    const s = createCoda({ ...OCHERED, cheap: false });
    s.burst(100);
    expect(s.state().queued).toBe(100);
    прогнать(s, 40);
    expect(s.state().total).toBe(100);
  });

  it('по ключу схлопывает пачку в одну обработку', () => {
    const s = createCoda({ ...OCHERED, cheap: true });
    s.burst(100);
    expect(s.state().queued).toBe(1);
    прогнать(s, 5);
    expect(s.state().total).toBe(1);
  });

  it('повторный ключ не удлиняет очередь, пока прежний ещё в ней', () => {
    const s = createCoda({ ...OCHERED, cheap: true });
    s.burst(50);
    s.burst(50);
    expect(s.state().queued).toBe(1);
  });

  it('а по событию — удлиняет вдвое', () => {
    const s = createCoda({ ...OCHERED, cheap: false });
    s.burst(50);
    s.burst(50);
    expect(s.state().queued).toBe(100);
  });

  it('пачка по событию разбирается долго, по ключу — мгновенно', () => {
    const событиями = createCoda({ ...OCHERED, cheap: false });
    событиями.burst(100);
    прогнать(событиями, 5);
    const ключами = createCoda({ ...OCHERED, cheap: true });
    ключами.burst(100);
    прогнать(ключами, 5);
    expect(событиями.state().queued).toBeGreaterThan(0);
    expect(ключами.state().queued).toBe(0);
  });
});

describe('сброс и смена режима', () => {
  it('смена режима начинает счёт заново', () => {
    const s = createCoda({ ...DVER, cheap: false });
    прогнать(s, 10);
    expect(s.state().total).toBeGreaterThan(0);
    s.set({ cheap: true });
    expect(s.state().total).toBe(0);
  });

  it('сброс возвращает всё к началу', () => {
    const s = createCoda({ ...OCHERED, cheap: false });
    s.burst(10);
    прогнать(s, 5);
    s.reset();
    expect(s.state().total).toBe(0);
    expect(s.state().queued).toBe(0);
    expect(s.state().changes).toBe(0);
  });
});
