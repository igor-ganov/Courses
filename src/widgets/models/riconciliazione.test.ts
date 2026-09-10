import { describe, expect, it } from 'vitest';
import { createCluster, type ClusterSettings } from './riconciliazione';

/* Проверяется не «работает ли виджет», а то, ради чего его показывают: что
   сведение состояний — это цикл, а не команда, и что у него есть свойства,
   которые читатель должен унести с собой.

   Каждый случай здесь соответствует утверждению из лекции. Если утверждение
   в лекции изменится, а модель нет — падёт проверка, а не читатель. */

const базовые = (over: Partial<ClusterSettings> = {}): ClusterSettings => ({
  desired: 3,
  resync: 0.5,
  startup: 2,
  shutdown: 1,
  running: true,
  dt: 0.25,
  ...over,
});

function прогнать(settings: ClusterSettings, seconds: number) {
  const c = createCluster(settings);
  const шагов = Math.round(seconds / settings.dt);
  for (let i = 0; i < шагов; i += 1) c.step();
  return c;
}

describe('цикл сверки', () => {
  it('сам приводит к заявленному: никто не приказывал создавать', () => {
    const c = прогнать(базовые(), 20);
    expect(c.state().ready).toBe(3);
  });

  it('существующий и готовый — не одно и то же', () => {
    /* Первый же проход контроллера создаёт всё заявленное, но готовых ещё
       нет ни одного: между «объект есть» и «он работает» лежит запуск, и
       почти всё, что в Kubernetes выглядит загадочно, живёт в этом зазоре. */
    const c = createCluster(базовые({ startup: 2 }));
    c.step();
    expect(c.state().alive).toBe(3);
    expect(c.state().ready).toBe(0);
  });

  it('не создаёт лишних, пока созданные ещё поднимаются', () => {
    /* Самая частая ошибка своего первого контроллера: считать готовых вместо
       существующих. Тогда за время запуска он насоздаёт по одному на период
       опроса — здесь получилось бы четырнадцать вместо трёх. */
    const c = прогнать(базовые({ startup: 5, resync: 0.5 }), 4);
    expect(c.state().alive).toBe(3);
  });

  it('поднимает замену упавшему — и не по приказу, а по расхождению', () => {
    const c = прогнать(базовые(), 20);
    const жертва = c.state().pods[0]!;
    c.kill(жертва.id);
    expect(c.state().ready).toBe(2);

    for (let i = 0; i < Math.round(20 / 0.25); i += 1) c.step();
    expect(c.state().ready).toBe(3);
    expect(c.state().pods.some((p) => p.id === жертва.id)).toBe(false);
  });

  it('гасит лишних, если заявили меньше', () => {
    const c = прогнать(базовые({ desired: 5 }), 20);
    expect(c.state().ready).toBe(5);
    c.set({ desired: 2 });
    for (let i = 0; i < Math.round(20 / 0.25); i += 1) c.step();
    expect(c.state().ready).toBe(2);
  });
});

describe('остановленный контроллер', () => {
  it('ничего не чинит: расхождение остаётся расхождением', () => {
    const c = прогнать(базовые(), 20);
    c.set({ running: false });
    c.kill(c.state().pods[0]!.id);
    for (let i = 0; i < Math.round(30 / 0.25); i += 1) c.step();
    expect(c.state().ready).toBe(2);
  });

  it('пущенный снова — доводит до заявленного без напоминаний', () => {
    const c = прогнать(базовые(), 20);
    c.set({ running: false });
    c.kill(c.state().pods[0]!.id);
    for (let i = 0; i < 20; i += 1) c.step();
    c.set({ running: true });
    for (let i = 0; i < Math.round(20 / 0.25); i += 1) c.step();
    expect(c.state().ready).toBe(3);
  });
});

describe('период опроса', () => {
  it('чем реже контроллер смотрит, тем дольше живёт расхождение', () => {
    const быстрый = прогнать(базовые({ resync: 0.25 }), 20);
    const медленный = прогнать(базовые({ resync: 6 }), 20);
    быстрый.kill(быстрый.state().pods[0]!.id);
    медленный.kill(медленный.state().pods[0]!.id);
    for (let i = 0; i < Math.round(3 / 0.25); i += 1) {
      быстрый.step();
      медленный.step();
    }
    expect(быстрый.state().alive).toBe(3);
    expect(медленный.state().alive).toBe(2);
  });
});

describe('лента событий', () => {
  it('рассказывает, что сделал контроллер, а не что приказал человек', () => {
    const c = прогнать(базовые(), 20);
    const виды = c.state().events.map((e) => e.kind);
    expect(виды).toContain('created');
    expect(виды).toContain('started');
  });

  it('падение пода попадает в ленту отдельно от гашения', () => {
    const c = прогнать(базовые(), 20);
    c.kill(c.state().pods[0]!.id);
    expect(c.state().events.at(-1)!.kind).toBe('killed');
  });
});

describe('задание', () => {
  it('засчитывается за удержание, а не за достижение', () => {
    const c = createCluster(базовые(), { hold: 10 });
    for (let i = 0; i < Math.round(8 / 0.25); i += 1) c.step();
    expect(c.goal().reached).toBe(false);
    for (let i = 0; i < Math.round(20 / 0.25); i += 1) c.step();
    expect(c.goal().reached).toBe(true);
  });

  it('падение сбрасывает удержание: расхождение — это расхождение', () => {
    const c = createCluster(базовые(), { hold: 30 });
    for (let i = 0; i < Math.round(20 / 0.25); i += 1) c.step();
    expect(c.state().held).toBeGreaterThan(5);
    c.kill(c.state().pods[0]!.id);
    c.step();
    expect(c.state().held).toBe(0);
  });

  it('даёт частичный балл: «нет» без числа не говорит, близко ли было', () => {
    const c = createCluster(базовые(), { hold: 100 });
    for (let i = 0; i < Math.round(30 / 0.25); i += 1) c.step();
    const s = c.goal().score;
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
});
