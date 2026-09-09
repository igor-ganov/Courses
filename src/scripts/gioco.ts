/**
 * ИГРА — то, что превращает чтение в счёт.
 *
 * Правила показа держатся на одном: **страница остаётся целой и без этого
 * скрипта**. Лекция читается, приборы работают, вопросы проверяются. Игра
 * добавляет память между заходами: опыт, звание, отметку «сдано», срок
 * повторения. Поэтому она грузится последней и ничего не строит с нуля —
 * только помечает уже стоящую разметку.
 *
 * Хранилище — localStorage, и обращение к нему обёрнуто: в приватном окне
 * и при запрете куки чтение бросает исключение, а курс от этого падать не
 * должен. Отказ хранилища означает «сессия не запомнится», а не «страница
 * сломалась».
 */

import { createProgress, THRESHOLDS, type Progress } from '~/engine/progress';
import { createSessione } from '~/engine/sessione';

const хранилище = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Приватное окно. Считаем ход, но не помним его — это лучше падения. */
    }
  },
};

let ход: Progress | undefined;

/** Общий счёт страницы. Создаётся лениво: на титульной он не нужен. */
export function progresso(): Progress {
  ход ??= createProgress({ clock: { now: () => Date.now() }, store: хранилище });
  return ход;
}

/* ── полоса состояния ──────────────────────────────────────────────── */

/**
 * Шапка со званием и опытом. Разметка ставится скриптом целиком: без него
 * в шапке пусто, и это правильный вид страницы без игры.
 */
function disegnaStato(host: HTMLElement, p: Progress): void {
  const r = p.rank();
  const s = p.snapshot();
  const снизу = THRESHOLDS[r.index] ?? 0;
  const доля = r.next ? Math.min(1, (r.xp - снизу) / (r.next - снизу)) : 1;
  const срочные = p.due().length;

  host.innerHTML =
    `<b class="grado">${r.title}</b>` +
    `<span class="barra" role="img" aria-label="опыт ${r.xp}${r.next ? ` из ${r.next}` : ''}">` +
    `<i style="--riempita:${доля.toFixed(3)}"></i></span>` +
    `<span class="punti">${r.xp}${r.next ? `<span class="tacito">/${r.next}</span>` : ''}</span>` +
    (s.streak.current > 1 ? `<span class="serie" title="дней подряд">${s.streak.current} дн.</span>` : '') +
    (срочные > 0 ? `<a class="ripasso" href="${host.dataset.ripasso ?? '#'}">на повторение: ${срочные}</a>` : '');
}

/* ── отметки на оглавлении ─────────────────────────────────────────── */

/**
 * Пометить ссылки на витки. Разметка приезжает нейтральной, а состояние —
 * личное дело читателя и потому проставляется здесь.
 */
export function segnaIndice(root: ParentNode, p: Progress): void {
  const сдано = p.done();
  for (const узел of root.querySelectorAll<HTMLElement>('[data-livello]')) {
    const ключ = узел.dataset.livello!;
    const л = p.level(ключ);
    узел.dataset.stato = сдано.has(ключ) ? 'fatto' : л.attempts > 0 ? 'iniziato' : 'nuovo';
    if (л.attempts > 0) {
      узел.style.setProperty('--padronanza', л.mastery.toFixed(3));
      узел.title = `освоено на ${Math.round(л.mastery * 100)} %, подходов: ${л.attempts}`;
    }
  }
}

/* ── виток ─────────────────────────────────────────────────────────── */

/**
 * Что приезжает в `cy-answer`.
 *
 * Донесения приборов (`cy-goal`) сюда не приходят, и это решение. Задание с
 * целью — такой же вопрос, как остальные: он ловит донесение своего прибора
 * сам, оценивает его тем же движком и отправляет обычный `cy-answer`. Если бы
 * счёт слушал ещё и `cy-goal`, одно и то же действие читателя считалось бы
 * дважды — и по-разному, потому что у донесения нет ни трудности, ни разбора.
 */
interface Dettaglio {
  readonly id?: string;
  readonly score?: number;
  readonly difficulty?: number;
  readonly correct?: boolean;
}

/**
 * Завести счёт на странице витка. Ключ и число работ приезжают в разметке:
 * страница знает, сколько на ней вопросов и целей, а скрипт — нет.
 *
 * Возвращает отписку. Она нужна тестам и переходам без перезагрузки; на
 * обычной странице её никто не зовёт, и это нормально.
 */
export function avviaLivello(root: ParentNode, p: Progress): (() => void) | undefined {
  const узел = root.querySelector<HTMLElement>('[data-livello-corrente]');
  if (!узел) return undefined;

  const ключ = узел.dataset.livelloCorrente!;
  const всего = Number(узел.dataset.lavori ?? '0');
  if (!(всего > 0)) return undefined;

  const sessione = createSessione(всего);
  const счётчик = узел.querySelector<HTMLElement>('[data-conteggio]');
  const итог = узел.querySelector<HTMLElement>('[data-esito]');
  /* Слушаем на документе, а не на узле шапки: задания стоят по всей лекции,
     а событие всплывает и выходит из теневого корня (composed). */
  const лист: EventTarget = root instanceof Document ? root : (root as Element);
  let записано = false;

  const обновить = () => {
    if (счётчик) счётчик.textContent = `${sessione.fatto} из ${sessione.totale}`;
    узел.dataset.stato = sessione.compiuto() ? 'fatto' : sessione.fatto > 0 ? 'iniziato' : 'nuovo';
    if (!sessione.compiuto() || записано) return;

    /* Записываем виток один раз за заход. Иначе перерешивание одного вопроса
       после сдачи давало бы новую запись в движок продвижения, а тот честно
       считал бы это отдельным подходом. */
    записано = true;
    const r = p.record(ключ, { score: sessione.voto(), difficulty: sessione.difficolta() });
    if (итог) {
      итог.hidden = false;
      итог.innerHTML =
        `<b>Виток пройден на ${Math.round(sessione.voto() * 100)} %.</b> ` +
        `+${r.xpGained} опыта${r.rankUp ? `, новое звание: ${p.rank().title}` : ''}.` +
        (r.badges.length > 0 ? ` Знак: ${r.badges.join(', ')}.` : '');
    }
    for (const полоса of document.querySelectorAll<HTMLElement>('[data-stato-gioco]')) disegnaStato(полоса, p);
  };

  const принять = (событие: Event) => {
    const д = ((событие as CustomEvent<Dettaglio>).detail ?? {}) as Dettaglio;
    if (д.id === undefined) return;
    const score = typeof д.score === 'number' ? д.score : д.correct ? 1 : 0;
    sessione.segna({ id: д.id, score, difficulty: д.difficulty ?? 3 });
    обновить();
  };

  лист.addEventListener('cy-answer', принять);
  обновить();
  return () => лист.removeEventListener('cy-answer', принять);
}

/** Точка входа страницы: всё, что найдёт, — то и заведёт. */
export function avviaGioco(root: ParentNode = document): void {
  const p = progresso();
  for (const полоса of root.querySelectorAll<HTMLElement>('[data-stato-gioco]')) disegnaStato(полоса, p);
  segnaIndice(root, p);
  avviaLivello(root, p);
}
