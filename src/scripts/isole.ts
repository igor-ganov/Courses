/**
 * ОСТРОВА — отложенная загрузка приборов.
 *
 * Лекция приезжает разметкой, без единого байта скрипта на текст. Прибор
 * оживает, когда до него доскроллили: тогда — и только тогда — грузится его
 * кусок.
 *
 * Список ниже литеральный, и это вынужденно: собиратель обязан увидеть каждый
 * `import()` глазами, чтобы выделить отдельный кусок. Построить его циклом по
 * реестру нельзя. Чтобы он не разъехался с реестром, за этим следит тест —
 * один, и он падает ровно в тот день, когда кто-то добавит прибор и забудет
 * строчку здесь.
 */

export const ISOLE: Record<string, () => Promise<unknown>> = {
  'cy-contorno': () => import('~/widgets/contorno'),
  'cy-varieta': () => import('~/widgets/varieta'),
  'cy-scatola': () => import('~/widgets/varieta'),
  'cy-entropia': () => import('~/widgets/informazione'),
  'cy-canale': () => import('~/widgets/informazione'),
  'cy-automa': () => import('~/widgets/automi'),
  'cy-vita': () => import('~/widgets/automi'),
  'cy-logistica': () => import('~/widgets/dinamica'),
  'cy-lorenz': () => import('~/widgets/dinamica'),
  'cy-quiz': () => import('~/widgets/quiz'),
};

/** Завести наблюдателя. Возвращает функцию отписки — для тестов и для ухода. */
export function accendiIsole(root: ParentNode = document): () => void {
  const цели = [...root.querySelectorAll<HTMLElement>('[data-blocco]')];
  if (цели.length === 0) return () => {};

  const оживить = (el: HTMLElement) => {
    const загрузка = ISOLE[el.localName];
    if (!загрузка) return;
    /* Дважды один и тот же кусок не грузится: `import()` кэширует сам, но
       пометка избавляет от лишних обещаний на каждом пересечении. */
    if (el.dataset.acceso) return;
    el.dataset.acceso = '1';
    void загрузка();
  };

  if (!('IntersectionObserver' in globalThis)) {
    цели.forEach(оживить);
    return () => {};
  }

  const наблюдатель = new IntersectionObserver(
    (записи) => {
      for (const з of записи) {
        if (!з.isIntersecting) continue;
        оживить(з.target as HTMLElement);
        наблюдатель.unobserve(з.target);
      }
    },
    /* Запас в пол-экрана: прибор успевает завестись до того, как читатель до
       него доедет, и не мигает пустотой. */
    { rootMargin: '50% 0px' },
  );

  цели.forEach((el) => наблюдатель.observe(el));
  return () => наблюдатель.disconnect();
}
