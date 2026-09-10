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

describe('ночная смена', () => {
  /* Ради этого прибор и затевался: разница между «чинить руками» и
     «заявить состояние» должна быть не в рассуждении, а в числах. */
  const ночь = (over: Partial<ClusterSettings>) =>
    базовые({ chaos: 6, seed: 7, ...over });

  it('беда приходит сама и повторяется от захода к заходу', () => {
    const первый = прогнать(ночь({ running: true }), 120);
    const второй = прогнать(ночь({ running: true }), 120);
    const падений = (c: ReturnType<typeof createCluster>) =>
      c.state().events.filter((e) => e.kind === 'killed').length;
    expect(падений(первый)).toBeGreaterThan(0);
    expect(падений(первый)).toBe(падений(второй));
  });

  it('без контроллера и без человека кластер вымирает', () => {
    const c = прогнать(ночь({ running: false }), 400);
    expect(c.state().ready).toBe(0);
  });

  it('заявка держит готовность высоко, ничего не требуя от человека', () => {
    const c = прогнать(ночь({ chaos: 20, running: true }), 600);
    expect(c.state().uptime).toBeGreaterThan(0.8);
    expect(c.state().interventions).toBe(0);
  });

  it('руками — это работа: каждое поднятие считается', () => {
    const c = createCluster(ночь({ running: false }));
    for (let i = 0; i < 3; i += 1) c.raise();
    expect(c.state().interventions).toBe(3);
    expect(c.state().alive).toBe(3);
  });

  it('человек с идеальной реакцией всё равно проигрывает контроллеру', () => {
    /* Играем за безупречного дежурного: он замечает нехватку в тот же миг и
       поднимает столько, сколько надо. Даже так простой у него больше — под
       поднимается не мгновенно, а замечать приходится после падения. */
    const руками = createCluster(ночь({ running: false }));
    const шагов = Math.round(600 / 0.25);
    for (let i = 0; i < шагов; i += 1) {
      руками.step();
      const s = руками.state();
      for (let n = s.alive; n < s.desired; n += 1) руками.raise();
    }
    const сам = прогнать(ночь({ running: true }), 600);
    expect(руками.state().interventions).toBeGreaterThan(10);
    expect(сам.state().uptime).toBeGreaterThanOrEqual(руками.state().uptime - 0.02);
  });
});

describe('два хозяина одного поля', () => {
  it('дают незатухающие колебания заявленного числа', () => {
    const c = прогнать(базовые({ desired: 3, rival: { desired: 5, every: 4 } }), 60);
    const числа = new Set(c.state().wanted.map((w) => w.n));
    expect(числа.size).toBeGreaterThan(1);
    expect(числа.has(5)).toBe(true);
  });

  it('и это видно как непрерывная работа: поды рождаются и гаснут', () => {
    const c = прогнать(базовые({ desired: 2, rival: { desired: 6, every: 5 } }), 120);
    const виды = c.state().events.map((e) => e.kind);
    expect(виды).toContain('created');
    expect(виды).toContain('deleted');
  });

  it('без второго хозяина заявленное стоит на месте', () => {
    const c = прогнать(базовые({ desired: 3 }), 60);
    expect(new Set(c.state().wanted.map((w) => w.n))).toEqual(new Set([3]));
  });
});

describe('тёплый старт', () => {
  it('смена начинается с исправного кластера, а не с пустого', () => {
    /* Без этого читатель приходит на уже проигранную смену: доля времени в
       строю равна нулю с первой секунды, и сделать он ничего не успел. */
    const c = createCluster(базовые({ warm: true, running: false }));
    expect(c.state().ready).toBe(3);
    expect(c.state().uptime).toBe(1);
  });

  it('и по сбросу тоже, иначе «сначала» начинает хуже, чем было', () => {
    const c = createCluster(базовые({ warm: true, running: false, chaos: 3, seed: 3 }));
    for (let i = 0; i < 400; i += 1) c.step();
    expect(c.state().ready).toBeLessThan(3);
    c.reset();
    expect(c.state().ready).toBe(3);
  });

  it('без тёплого старта поднимает контроллер, как и раньше', () => {
    const c = createCluster(базовые());
    expect(c.state().ready).toBe(0);
  });
});
