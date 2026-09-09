/**
 * ЗАДАНИЕ — вопрос из движка оценки на странице.
 *
 * Виджет ничего не решает сам: он показывает вопрос, собирает ответ и зовёт
 * `gradeAnswer`. Оценка чистая и живёт отдельно — иначе её пришлось бы
 * проверять через экран, а через экран её никто не проверяет.
 *
 * Ответ показывается только после того, как читатель ответил. Разбор приходит
 * всегда, даже на верный ответ: угадавший и знающий должны разойтись хотя бы
 * здесь.
 */

import { css, html, stile, Widget, type GoalReport } from './base';
import { gradeAnswer, standardQuestions, questionKinds, type QuestionBase } from '~/engine/assessment';

/* Стандартные виды регистрируются один раз на страницу. Реестр глобален, и
   повторная регистрация — ошибка по построению. */
if (questionKinds().length === 0) standardQuestions();

const stileDomanda = css`
  .domanda {
    margin: 0 0 10px;
    font-size: max(calc(17px * var(--кегль, 1)), var(--пол, 0px));
  }

  .numero {
    font-family: 'Caveat', cursive;
    font-size: max(calc(23px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--паста, #1b3a6b);
    margin-right: 6px;
  }

  .opzioni {
    display: grid;
    gap: 2px;
    margin: 0 0 8px;
    padding: 0;
    list-style: none;
  }

  .opzione {
    position: relative;
    display: flex;
    gap: 12px;
    align-items: baseline;
    width: 100%;
    text-align: left;
    border: 0;
    background: none;
    cursor: pointer;
    padding: 7px 8px 7px 6px;
    font: inherit;
    color: var(--текст, #20242c);
    min-height: 40px;
  }

  .opzione .lettera {
    font-family: 'Caveat', cursive;
    font-size: max(calc(21px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--тихий, #6f7682);
    min-width: 18px;
  }

  /* Выбранное обведено галочкой пастой, а не залито цветом: в тетради
     подчёркивают, а не красят. */
  .opzione[aria-checked='true']::before {
    content: '';
    position: absolute;
    left: -4px;
    top: 2px;
    width: 26px;
    height: 26px;
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><path d='M4,13 C7,17 9,20 11,22 C14,15 18,8 23,3' fill='none' stroke='%233f6b4a' stroke-width='2' stroke-linecap='round'/></svg>")
      no-repeat center;
  }

  .opzione[aria-checked='true'] .lettera {
    opacity: 0;
  }

  .opzione[aria-checked='true'] {
    color: var(--зелёный, #3f6b4a);
  }

  .opzione.sbagliata[aria-checked='true'] {
    color: var(--красный, #a8402f);
  }

  .opzione.sbagliata[aria-checked='true']::before {
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><path d='M5,5 C10,10 16,17 21,22 M21,5 C16,10 10,17 5,22' fill='none' stroke='%23a8402f' stroke-width='2' stroke-linecap='round'/></svg>")
      no-repeat center;
  }

  .opzione.giusta {
    color: var(--зелёный, #3f6b4a);
  }

  input[type='text'] {
    font: inherit;
    padding: 6px 8px;
    border: 0;
    border-bottom: 1.4px solid var(--грифель, #5c6068);
    background: none;
    color: var(--текст, #20242c);
    max-width: 12ch;
    font-variant-numeric: tabular-nums;
  }

  /* ── порядок ─────────────────────────────────────────────────────── */

  .ordine {
    display: grid;
    gap: 2px;
    margin: 0 0 8px;
    padding: 0;
    list-style: none;
  }

  .voce {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 4px 0;
  }

  .voce .posto {
    font-family: 'Caveat', cursive;
    font-size: max(calc(21px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--тихий, #6f7682);
    min-width: 18px;
  }

  .voce .testo {
    flex: 1 1 auto;
    min-width: 0;
  }

  .voce.giusta .testo {
    color: var(--зелёный, #3f6b4a);
  }

  .voce.sbagliata .testo {
    color: var(--красный, #a8402f);
  }

  /* Стрелки, а не перетаскивание: пальцем в узкой колонке тащить нечего, а
     клавиатурой перетаскивание вообще недоступно. */
  .freccia {
    border: 0;
    background: none;
    cursor: pointer;
    font: inherit;
    color: var(--паста, #1b3a6b);
    padding: 6px 8px;
    min-width: 34px;
    min-height: 34px;
    line-height: 1;
  }

  .freccia[disabled] {
    opacity: 0.3;
    cursor: default;
  }

  /* ── сопоставление ───────────────────────────────────────────────── */

  .coppie {
    display: grid;
    gap: 6px;
    margin: 0 0 8px;
  }

  .coppia {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .coppia .sinistra {
    flex: 1 1 40%;
    min-width: 0;
  }

  .coppia select {
    flex: 1 1 45%;
    font: inherit;
    padding: 5px 6px;
    min-height: 34px;
    border: 0;
    border-bottom: 1.4px solid var(--грифель, #5c6068);
    background: none;
    color: var(--текст, #20242c);
  }

  .coppia.giusta select {
    color: var(--зелёный, #3f6b4a);
  }

  .coppia.sbagliata select {
    color: var(--красный, #a8402f);
  }

  /* ── цель в приборе ──────────────────────────────────────────────── */

  .compito {
    margin: 0 0 8px;
    color: var(--грифель, #5c6068);
  }

  .avanzamento {
    font-variant-numeric: tabular-nums;
  }

  .spiegazione {
    margin: 8px 0 0;
    color: var(--грифель, #5c6068);
  }
`;

const ЛИТЕРЫ = 'абвгдежзи';

/**
 * Начальная раскладка для вопроса на порядок.
 *
 * Правильный порядок — тот, в котором пункты записаны, поэтому показывать их
 * как записано нельзя: ответ был бы уже дан. Перестановка при этом должна
 * быть заведомо неверной и заведомо одинаковой при каждом заходе — иначе
 * читатель, вернувшийся к витку, решает другую задачу.
 *
 * Разворот подходит по обоим условиям: он не совпадает с исходным ни при
 * каком числе пунктов больше одного, и он один и тот же всегда.
 */
function меша(n: number): number[] {
  return Array.from({ length: n }, (_, i) => n - 1 - i);
}

interface QuizProps {
  readonly question?: QuestionBase & Record<string, unknown>;
  readonly number?: number;
}

export class Quiz extends Widget<QuizProps> {
  static override styles = [stile, stileDomanda];
  static override properties = {
    scelta: { state: true },
    multi: { state: true },
    testo: { state: true },
    ordine: { state: true },
    coppie: { state: true },
    rapporto: { state: true },
    inviato: { state: true },
  };
  declare scelta: number;
  declare multi: number[];
  declare testo: string;
  /** Порядок: где сейчас стоит каждый пункт. Значение — исходный номер. */
  declare ordine: number[];
  /** Сопоставление: против какого правого поставлен каждый левый. */
  declare coppie: number[];
  /** Последнее донесение прибора для задания с целью. */
  declare rapporto: GoalReport | undefined;
  declare inviato: boolean;

  /* Задание с целью выполняется не здесь, а в приборе, который стоит рядом в
     лекции. Донесение всплывает по документу, и вопрос ловит своё по имени
     цели: связывать вопрос с элементом прибора значило бы требовать от
     автора порядка блоков, а он вправе поставить прибор и до, и после. */
  private слушатель: ((событие: Event) => void) | undefined;

  protected override avvia(): void {
    this.scelta = -1;
    this.multi = [];
    this.testo = '';
    this.rapporto = undefined;
    this.inviato = false;

    const q = this.question;
    this.ordine = q?.kind === 'order' ? меша((q.items as string[]).length) : [];
    this.coppie = q?.kind === 'match' ? (q.pairs as string[][]).map(() => -1) : [];

    if (q?.kind === 'goal') {
      this.слушатель = (событие) => {
        const донесение = (событие as CustomEvent<GoalReport>).detail;
        if (!донесение || донесение.goal !== q.goal || this.inviato) return;
        this.rapporto = донесение;
        /* Дошёл до цели — засчитываем сразу: просить после этого нажать
           «Ответить» значит делать вид, что задание ещё не сделано. */
        if (донесение.reached) this.invia();
      };
      document.addEventListener('cy-goal', this.слушатель);
    }
  }

  protected override ferma(): void {
    if (this.слушатель) document.removeEventListener('cy-goal', this.слушатель);
    this.слушатель = undefined;
  }

  private get question(): (QuestionBase & Record<string, unknown>) | undefined {
    return this.props.question;
  }

  private answer(): unknown {
    const q = this.question;
    if (!q) return undefined;
    if (q.kind === 'multi') return this.multi;
    if (q.kind === 'numeric') return this.testo;
    if (q.kind === 'order') return this.ordine;
    if (q.kind === 'match') return this.coppie;
    if (q.kind === 'goal') return this.rapporto;
    return this.scelta;
  }

  /** Готов ли ответ к отправке. Пустое отправлять незачем. */
  private pronto(): boolean {
    const q = this.question;
    if (!q) return false;
    switch (q.kind) {
      case 'numeric':
        return this.testo.trim() !== '';
      case 'multi':
        return this.multi.length > 0;
      case 'order':
        return true;
      case 'match':
        return this.coppie.every((c) => c >= 0);
      case 'goal':
        return this.rapporto !== undefined;
      default:
        return this.scelta >= 0;
    }
  }

  private sposta(da: number, verso: number): void {
    const куда = da + verso;
    if (куда < 0 || куда >= this.ordine.length) return;
    const next = [...this.ordine];
    [next[da], next[куда]] = [next[куда]!, next[da]!];
    this.ordine = next;
  }

  private invia(): void {
    this.inviato = true;
    const q = this.question;
    if (!q) return;
    const grade = gradeAnswer(q, this.answer());
    this.dispatchEvent(
      new CustomEvent('cy-answer', {
        detail: { id: q.id, difficulty: q.difficulty, ...grade },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected override render() {
    const q = this.question;
    if (!q) {
      return html`<section class="telaio"><p class="esito male">Вопрос не задан.</p></section>`;
    }
    const grade = this.inviato ? gradeAnswer(q, this.answer()) : undefined;
    const опции = (q.options as string[] | undefined) ?? [];
    const верный = q.answer as number | number[] | undefined;

    return html`<section class="telaio">
      <p class="domanda">
        ${this.props.number ? html`<span class="numero">${this.props.number}.</span>` : null}${q.prompt}
      </p>

      ${q.kind === 'choice' || q.kind === 'multi'
        ? html`<ul class="opzioni" role=${q.kind === 'multi' ? 'group' : 'radiogroup'}>
            ${опции.map((opt, i) => {
              const выбрано = q.kind === 'multi' ? this.multi.includes(i) : this.scelta === i;
              const правильный =
                this.inviato &&
                (Array.isArray(верный) ? верный.includes(i) : верный === i);
              const ошибка = this.inviato && выбрано && !правильный;
              return html`<li>
                <button
                  class="opzione ${ошибка ? 'sbagliata' : ''} ${правильный ? 'giusta' : ''}"
                  role=${q.kind === 'multi' ? 'checkbox' : 'radio'}
                  aria-checked=${выбрано ? 'true' : 'false'}
                  ?disabled=${this.inviato}
                  @click=${() => {
                    if (this.inviato) return;
                    if (q.kind === 'multi') {
                      this.multi = this.multi.includes(i)
                        ? this.multi.filter((x) => x !== i)
                        : [...this.multi, i];
                    } else this.scelta = i;
                  }}>
                  <span class="lettera">${ЛИТЕРЫ[i] ?? i + 1}</span><span>${opt}</span>
                </button>
              </li>`;
            })}
          </ul>`
        : null}

      ${q.kind === 'order'
        ? html`<ol class="ordine">
            ${this.ordine.map((исходный, место) => {
              /* После ответа подсвечивается не «на своём ли месте», а целый
                 стык с предыдущим: оценка считает именно стыки, и показывать
                 иное значило бы объяснять читателю чужую арифметику. */
              const стык =
                this.inviato && место > 0 && исходный === this.ordine[место - 1]! + 1;
              const разрыв = this.inviato && место > 0 && !стык;
              return html`<li class="voce ${стык ? 'giusta' : ''} ${разрыв ? 'sbagliata' : ''}">
                <span class="posto">${место + 1}.</span>
                <span class="testo">${(q.items as string[])[исходный]}</span>
                <button
                  class="freccia"
                  aria-label="Выше: ${(q.items as string[])[исходный]}"
                  ?disabled=${this.inviato || место === 0}
                  @click=${() => this.sposta(место, -1)}>
                  ↑
                </button>
                <button
                  class="freccia"
                  aria-label="Ниже: ${(q.items as string[])[исходный]}"
                  ?disabled=${this.inviato || место === this.ordine.length - 1}
                  @click=${() => this.sposta(место, 1)}>
                  ↓
                </button>
              </li>`;
            })}
          </ol>`
        : null}

      ${q.kind === 'match'
        ? html`<div class="coppie">
            ${(q.pairs as string[][]).map((пара, i) => {
              const верно = this.inviato && this.coppie[i] === i;
              return html`<div class="coppia ${this.inviato ? (верно ? 'giusta' : 'sbagliata') : ''}">
                <span class="sinistra">${пара[0]}</span>
                <select
                  aria-label="Пара для: ${пара[0]}"
                  ?disabled=${this.inviato}
                  @change=${(e: Event) => {
                    const next = [...this.coppie];
                    next[i] = Number((e.target as HTMLSelectElement).value);
                    this.coppie = next;
                  }}>
                  <option value="-1" ?selected=${this.coppie[i] === -1}>— выберите —</option>
                  ${(q.pairs as string[][]).map(
                    (правая, j) =>
                      html`<option value=${j} ?selected=${this.coppie[i] === j}>${правая[1]}</option>`,
                  )}
                </select>
              </div>`;
            })}
          </div>`
        : null}

      ${q.kind === 'goal'
        ? html`<p class="compito">
            ${this.rapporto
              ? this.rapporto.reached
                ? 'Цель достигнута.'
                : html`Пока пройдено
                    <span class="avanzamento"
                      >${((this.rapporto.score ?? 0) * 100).toFixed(0)} %</span
                    >. Можно продолжать в приборе или зачесть как есть.`
              : 'Задание выполняется в приборе рядом. Как только цель будет взята, оно засчитается само.'}
          </p>`
        : null}

      ${q.kind === 'numeric'
        ? html`<p>
            <input
              type="text"
              inputmode="decimal"
              aria-label="Ответ"
              ?disabled=${this.inviato}
              .value=${this.testo}
              @input=${(e: Event) => (this.testo = (e.target as HTMLInputElement).value)} />
            ${q.unit ? html` <span class="tacito">${q.unit}</span>` : null}
          </p>`
        : null}

      <div class="azioni">
        <button class="bottone" ?disabled=${this.inviato || !this.pronto()} @click=${() => this.invia()}>
          ${q.kind === 'goal' ? 'Зачесть как есть' : 'Ответить'}
        </button>
        ${this.inviato && q.kind !== 'goal'
          ? html`<button
              class="bottone"
              @click=${() => {
                this.inviato = false;
                this.scelta = -1;
                this.multi = [];
                this.testo = '';
                if (q.kind === 'order') this.ordine = меша((q.items as string[]).length);
                if (q.kind === 'match') this.coppie = (q.pairs as string[][]).map(() => -1);
              }}>
              Ещё раз
            </button>`
          : null}
      </div>

      ${grade
        ? html`<p class="esito ${grade.correct ? 'bene' : grade.score > 0 ? '' : 'male'}">
              ${grade.correct
                ? 'Верно.'
                : grade.score > 0
                  ? `Частично: ${(grade.score * 100).toFixed(0)} %.`
                  : 'Неверно.'}
            </p>
            ${grade.explain ? html`<p class="spiegazione">${grade.explain}</p>` : null}`
        : null}
    </section>`;
  }
}

customElements.define('cy-quiz', Quiz);
