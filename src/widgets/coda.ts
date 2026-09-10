/**
 * ОЧЕРЕДЬ И ДВЕРЬ — один прибор в двух обличьях.
 *
 * Обличья разные, задача одна: не платить за каждое событие в отдельности.
 * На витке про единственную дверь читатель сравнивает опрос со слежением,
 * на витке про очередь — обработку по событию с обработкой по ключу. Числа
 * в обоих случаях расходятся на порядок, и это видно на счётчике, а не в
 * рассуждении.
 *
 * Считает всё модель из `models/coda`, проверенная тестами.
 */

import { css, html, stile, Widget } from './base';
import { createCoda, DVER, OCHERED, type Coda, type CodaState, type Modo } from './models/coda';

interface Props {
  readonly modo?: Modo;
  readonly title?: string;
  readonly hint?: string;
}

/** Подписи обоих обличий: слова разные, механика одна. */
const СЛОВА = {
  porta: {
    дорого: 'Опрос',
    дорогоМелко: 'каждый тянет весь список раз в секунду',
    дёшево: 'Слежение',
    дёшевоМелко: 'дверь шлёт только изменения',
    работа: 'объектов через дверь',
    темп: 'в секунду',
    пачка: 'Выкатка: 100 изменений',
    итогДорого:
      'Тридцать тысяч объектов в секунду через одну дверь — и это в спокойном кластере, где ничего не происходит. Дверь становится узким местом раньше всего остального.',
    итогДёшево:
      'В спокойном кластере дверь молчит. Платит она только за само изменение — по одному сообщению каждому, кто следит; читают все из своих копий.',
  },
  coda: {
    дорого: 'По событию',
    дорогоМелко: 'каждое изменение — своя обработка',
    дёшево: 'По ключу',
    дёшевоМелко: 'повтор ключа очередь не удлиняет',
    работа: 'обработок',
    темп: 'в секунду',
    пачка: 'Выкатка: 100 изменений',
    итогДорого:
      'Сто изменений одного объекта дали сто обработок, и разбирает их очередь долго. Каждая следующая работает по картине, которая уже устарела.',
    итогДёшево:
      'Сто изменений дали один ключ и одну обработку. Схлопывать можно только потому, что обработка смотрит на состояние, а не на событие: текущая картина уже вобрала все сто.',
  },
} as const;

export class CodaWidget extends Widget<Props> {
  static override styles = [
    stile,
    css`
      .scelta {
        display: flex;
        gap: 10px;
        margin: 0 0 14px;
        flex-wrap: wrap;
      }

      .lato {
        position: relative;
        border: 0;
        background: none;
        cursor: pointer;
        padding: 8px 18px;
        min-height: 44px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(20px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.15;
        color: var(--тихий, #636a75);
        text-align: left;
      }

      .lato[aria-pressed='true'] {
        color: var(--паста, #1b3a6b);
      }

      .lato[aria-pressed='true']::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='48' preserveAspectRatio='none'><path d='M20,5 C70,2 150,4 182,8 C190,9 192,16 191,25 C190,35 188,42 181,44 C140,47 60,46 20,43 C11,42 7,35 7,25 C7,15 10,8 18,6' fill='none' stroke='%231b3a6b' stroke-width='1.6' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      .lato small {
        display: block;
        font-family: 'Literata', serif;
        font-size: max(calc(12.5px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.25;
        color: var(--тихий, #636a75);
      }

      /* Полоса работы: видно не число, а поток. */
      .flusso {
        position: relative;
        height: 8px;
        margin: 0 0 4px;
        background: color-mix(in srgb, var(--грифель, #5c6068) 16%, transparent);
      }

      .flusso i {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--паста, #1b3a6b);
      }

      .flusso.molto i {
        background: var(--красный, #a8402f);
      }

      .etichetta {
        margin: 0 0 12px;
        min-height: calc(var(--шаг, 26px) * 1.1);
        font-family: 'Caveat', cursive;
        font-size: max(calc(17px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.2;
        color: var(--тихий, #636a75);
      }

      /* Очередь — рядок клеток: длина очереди видна как длина, а не как цифра. */
      .fila {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        margin: 0 0 12px;
        min-height: calc(var(--шаг, 26px) * 2.6);
        align-content: flex-start;
      }

      .cella {
        width: 9px;
        height: 9px;
        background: var(--паста, #1b3a6b);
      }

      .cella.oltre {
        background: var(--красный, #a8402f);
      }
    `,
  ];

  static override properties = {
    дёшево: { state: true },
    tick: { state: true },
  };

  declare дёшево: boolean;
  declare tick: number;

  private coda!: Coda;
  private stop?: () => void;

  private get обличье(): Modo {
    return this.props.modo ?? 'porta';
  }

  private get слова() {
    return СЛОВА[this.обличье];
  }

  protected override avvia(): void {
    this.дёшево = false;
    this.tick = 0;
    this.coda = createCoda({
      ...(this.обличье === 'porta' ? DVER : OCHERED),
      cheap: false,
    });
    this.stop = this.loop(() => {
      for (let i = 0; i < 2; i += 1) this.coda.step();
      this.tick += 1;
    });
  }

  protected override ferma(): void {
    this.stop?.();
  }

  private сторона(дёшево: boolean): void {
    if (this.дёшево === дёшево) return;
    this.дёшево = дёшево;
    this.coda.set({ cheap: дёшево });
    this.tick += 1;
  }

  private fila(s: CodaState) {
    /* Клеток рисуется не больше сорока: сто клеток на телефоне превращаются
       в серую полосу, из которой длину не прочесть. Остаток — числом. */
    const видно = Math.min(40, s.queued);
    return html`<div class="fila" role="img" aria-label=${`В очереди ${s.queued}`}>
      ${Array.from({ length: видно }, () => html`<span class="cella ${s.queued > 10 ? 'oltre' : ''}"></span>`)}
      ${s.queued > видно ? html`<span class="etichetta">и ещё ${s.queued - видно}</span>` : null}
    </div>`;
  }

  protected override render() {
    const s = this.coda.state();
    const w = this.слова;
    const порог = this.обличье === 'porta' ? DVER.objects * DVER.watchers : 8;
    const доля = Math.min(1, s.rate / порог);

    return html`<section class="telaio">
      <h4>${this.props.title ?? (this.обличье === 'porta' ? 'Одна дверь' : 'Очередь ключей')}</h4>
      <p class="suggerimento">
        ${this.props.hint ??
        (this.обличье === 'porta'
          ? 'Тысяча объектов, тридцать наблюдателей. Переключите способ и посмотрите на поток через дверь.'
          : 'Нажмите «выкатку» — она даёт сто изменений одного объекта. Потом переключите способ и нажмите снова.')}
      </p>

      <div class="scelta" role="group" aria-label="Способ">
        <button
          class="lato"
          aria-pressed=${this.дёшево ? 'false' : 'true'}
          @click=${() => this.сторона(false)}>
          ${w.дорого}<small>${w.дорогоМелко}</small>
        </button>
        <button
          class="lato"
          aria-pressed=${this.дёшево ? 'true' : 'false'}
          @click=${() => this.сторона(true)}>
          ${w.дёшево}<small>${w.дёшевоМелко}</small>
        </button>
      </div>

      <div
        class="flusso ${доля > 0.5 ? 'molto' : ''}"
        role="img"
        aria-label=${`${s.rate} ${w.работа} ${w.темп}`}>
        <i style=${`width:${(доля * 100).toFixed(0)}%`}></i>
      </div>
      <p class="etichetta">${s.rate} ${w.работа} ${w.темп}</p>

      ${this.обличье === 'coda' ? this.fila(s) : null}

      <div class="quadranti">
        <div class="quadrante ${this.дёшево ? 'bene' : 'male'}">
          <b>${w.работа}</b><span>${s.total}</span>
        </div>
        <div class="quadrante"><b>изменений</b><span>${s.changes}</span></div>
        <div class="quadrante ${this.дёшево ? 'bene' : 'male'}">
          <b>на изменение</b><span>${s.changes > 0 ? s.perChange : '—'}</span>
        </div>
        <div class="quadrante"><b>время</b><span>${s.time.toFixed(0)} с</span></div>
      </div>

      <div class="azioni">
        <button class="bottone" @click=${() => this.coda.burst()}>${w.пачка}</button>
        <button
          class="bottone"
          @click=${() => {
            this.coda.reset();
            this.tick += 1;
          }}>
          Сначала
        </button>
      </div>

      <p class="esito ${this.дёшево ? 'bene' : 'male'}">
        ${this.дёшево ? w.итогДёшево : w.итогДорого}
      </p>
    </section>`;
  }
}

customElements.define('cy-coda', CodaWidget);
