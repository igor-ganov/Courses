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

import { css, html, stile, Widget } from './base';
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

  .spiegazione {
    margin: 8px 0 0;
    color: var(--грифель, #5c6068);
  }
`;

const ЛИТЕРЫ = 'абвгдежзи';

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
    inviato: { state: true },
  };
  declare scelta: number;
  declare multi: number[];
  declare testo: string;
  declare inviato: boolean;

  protected override avvia(): void {
    this.scelta = -1;
    this.multi = [];
    this.testo = '';
    this.inviato = false;
  }

  private get question(): (QuestionBase & Record<string, unknown>) | undefined {
    return this.props.question;
  }

  private answer(): unknown {
    const q = this.question;
    if (!q) return undefined;
    if (q.kind === 'multi') return this.multi;
    if (q.kind === 'numeric') return this.testo;
    return this.scelta;
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
        <button
          class="bottone"
          ?disabled=${this.inviato ||
          (q.kind === 'numeric' ? this.testo.trim() === '' : q.kind === 'multi' ? this.multi.length === 0 : this.scelta < 0)}
          @click=${() => this.invia()}>
          Ответить
        </button>
        ${this.inviato
          ? html`<button
              class="bottone"
              @click=${() => {
                this.inviato = false;
                this.scelta = -1;
                this.multi = [];
                this.testo = '';
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
