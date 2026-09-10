import { describe, expect, it } from 'vitest';
import { createSonde, NAPLYV, type SondeSettings } from './sonde';

/* Проверяется главное утверждение витка: тесная проба живости превращает
   наплыв в полный отказ, хотя ни один экземпляр не сломан. Утверждение
   сильное, и если модель перестанет его подтверждать — падёт проверка, а не
   читатель, поверивший тексту.

   Заодно проверено, что обстановка честная: наплыв в принципе переживаем,
   и убивают службу именно настройки проб, а не нехватка ёмкости. */

const прогнать = (over: Partial<SondeSettings> = {}) => {
  const cfg = { ...NAPLYV, ...over };
  const s = createSonde(cfg);
  while (!s.state().done) s.step();
  return s.state();
};

describe('обстановка честная', () => {
  it('наплыв переживаем: очередь трёх экземпляров его держит', () => {
    /* Не «влезает в ёмкость» — время ответа при таком наплыве портится, и
       так и должно быть. Важно, что запросы при этом не теряются: беда не в
       нагрузке. */
    expect(NAPLYV.replicas * NAPLYV.capacity * NAPLYV.queue).toBeGreaterThan(NAPLYV.surge);
  });

  it('без проб служба проходит наплыв почти без потерь', () => {
    /* Порог живости выше любого достижимого времени ответа — значит проба
       не срабатывает никогда, и видно, что сама нагрузка не смертельна. */
    const s = прогнать({ timeout: 100, threshold: 5 });
    expect(s.restarts).toBe(0);
    expect(s.errorRate).toBeLessThan(0.01);
  });
});

describe('тесная проба живости', () => {
  it('перезапускает исправные экземпляры под наплывом', () => {
    const s = прогнать({ timeout: 1, threshold: 1 });
    expect(s.restarts).toBeGreaterThan(0);
  });

  it('и выкашивает службу целиком: потери на порядок больше', () => {
    const терпеливая = прогнать({ timeout: 3, threshold: 3, readiness: true });
    const тесная = прогнать({ timeout: 1, threshold: 1, readiness: true });
    expect(терпеливая.errorRate).toBe(0);
    expect(тесная.errorRate).toBeGreaterThan(0.5);
    expect(тесная.restarts).toBeGreaterThan(терпеливая.restarts);
  });

  it('запас на несколько отказов подряд спасает', () => {
    const без = прогнать({ timeout: 1, threshold: 1, readiness: true });
    const с = прогнать({ timeout: 1, threshold: 3, readiness: true });
    expect(с.restarts).toBeLessThan(без.restarts);
  });
});

describe('проба готовности', () => {
  it('убирает запросы в пустоту начисто', () => {
    /* Настоящая её работа: не пускать запросы в того, кто ещё не отвечает.
       Это та самая полминута ошибок после каждой выкатки. */
    const без = прогнать({ timeout: 1, threshold: 3, readiness: false });
    const с = прогнать({ timeout: 1, threshold: 3, readiness: true });
    expect(без.wasted).toBeGreaterThan(0);
    expect(с.wasted).toBe(0);
  });

  it('но общих потерь при обвале не уменьшает, а увеличивает', () => {
    /* Находка, которой не было в замысле, и она правдива: снятый с
       нагрузки экземпляр отдаёт свою долю выжившим, те перегружаются
       сильнее и падают быстрее. Готовность — лекарство от запуска, а не
       от перегрузки, и лекция теперь говорит об этом прямо. */
    const без = прогнать({ timeout: 1, threshold: 1, readiness: false });
    const с = прогнать({ timeout: 1, threshold: 1, readiness: true });
    expect(с.errorRate).toBeGreaterThan(без.errorRate);
    expect(с.restarts).toBeGreaterThan(без.restarts);
  });

  it('при отсутствии перезапусков ничего не меняет', () => {
    const без = прогнать({ timeout: 100, threshold: 5, readiness: false });
    const с = прогнать({ timeout: 100, threshold: 5, readiness: true });
    expect(с.errorRate).toBeCloseTo(без.errorRate, 3);
    expect(с.wasted).toBe(0);
    expect(без.wasted).toBe(0);
  });
});

describe('задание', () => {
  it('терпеливые пробы с готовностью проходят наплыв', () => {
    const s = createSonde({ ...NAPLYV, timeout: 3, threshold: 3, readiness: true }, { maxErrors: 0.05 });
    while (!s.state().done) s.step();
    expect(s.goal().reached).toBe(true);
  });

  it('тесные — не проходят', () => {
    const s = createSonde({ ...NAPLYV, timeout: 1, threshold: 1 }, { maxErrors: 0.05 });
    while (!s.state().done) s.step();
    expect(s.goal().reached).toBe(false);
  });

  it('до конца прогона не засчитывается вовсе', () => {
    const s = createSonde({ ...NAPLYV, timeout: 3, threshold: 3, readiness: true }, { maxErrors: 0.05 });
    for (let i = 0; i < 50; i += 1) s.step();
    expect(s.goal().reached).toBe(false);
    expect(s.goal().score).toBeGreaterThan(0);
  });
});

describe('сброс', () => {
  it('возвращает всё к началу', () => {
    const s = createSonde({ ...NAPLYV, timeout: 1 });
    while (!s.state().done) s.step();
    s.reset();
    expect(s.state().time).toBe(0);
    expect(s.state().restarts).toBe(0);
    expect(s.state().errors).toBe(0);
  });
});
