/**
 * ПРОБЫ — игра, в которой читатель роняет здоровую службу своими руками.
 *
 * Три ручки: срок пробы живости, запас отказов и выключатель готовности.
 * Приходит наплыв, который служба обязана пережить, — и переживёт она его
 * или нет, зависит только от ручек. Настройка «срок одна секунда, порог
 * один отказ» — самая частая в жизни — теряет семь запросов из десяти.
 *
 * Считает всё модель из `models/sonde`, проверенная тестами; в них же и
 * закреплено, что наплыв переживаем, а убивают службу пробы.
 */

import { css, html, stile, svg, Widget } from './base';
import { createSonde, NAPLYV, type Sonde, type SondeState } from './models/sonde';

interface Props {
  readonly goal?: { maxErrors: number };
  readonly title?: string;
  readonly hint?: string;
}

/**
 * Прогон считается целиком и мгновенно — часов у прибора нет.
 *
 * Сначала он шёл по кадрам, и это было ошибкой замысла: читатель двигал
 * ручку и ждал, пока наплыв доедет до конца. Ожидание ничему не учит, а
 * сравнивать две настройки становится нельзя — между ними полминуты.
 * Теперь ручка меняет весь исход сразу, как в схемном тренажёре: подвинул
 * сопротивление — ток пересчитался.
 */
interface Kadr {
  readonly t: number;
  readonly ready: number;
  readonly latency: number;
  readonly errors: number;
}

export class SondeWidget extends Widget<Props> {
  static override styles = [
    stile,
    css`
      .repliche {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
        gap: 8px;
        margin: 0 0 12px;
      }

      .replica {
        position: relative;
        padding: 7px 6px 6px;
        min-height: calc(var(--шаг, 26px) * 2.7);
        text-align: center;
        color: var(--паста, #1b3a6b);
      }

      .replica::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='110' height='74' preserveAspectRatio='none'><path d='M11,6 C38,3 76,5 98,8 C104,9 106,15 106,25 C106,46 105,61 101,66 C76,71 36,70 13,67 C7,66 4,60 4,49 C4,28 5,12 8,8' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      .replica.starting::before {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='110' height='74' preserveAspectRatio='none'><path d='M11,6 C38,3 76,5 98,8 C104,9 106,15 106,25 C106,46 105,61 101,66 C76,71 36,70 13,67 C7,66 4,60 4,49 C4,28 5,12 8,8' fill='none' stroke='%23a8402f' stroke-width='1.4' stroke-linecap='round' stroke-dasharray='5 6'/></svg>");
        color: var(--красный, #a8402f);
      }

      .replica b {
        display: block;
        font-family: 'PT Mono', monospace;
        font-weight: 400;
        font-size: max(calc(12.5px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.2;
      }

      .replica i {
        display: block;
        font-style: normal;
        font-family: 'Literata', serif;
        font-size: max(calc(15px * var(--кегль, 1)), var(--пол, 0px));
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
      }

      .replica i.oltre {
        color: var(--красный, #a8402f);
      }

      .replica small {
        display: block;
        font-family: 'Caveat', cursive;
        font-size: max(calc(15px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.1;
        color: var(--тихий, #636a75);
      }

      /* Кривая всего прогона. Она и есть ответ прибора: подвинул ручку —
         сразу видно, что стало со всей историей, а не с текущей секундой. */
      svg.tela {
        display: block;
        width: 100%;
        height: auto;
        margin: 0 0 4px;
        touch-action: pan-y;
      }

      .etichetta {
        margin: 0 0 12px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(17px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.2;
        color: var(--тихий, #636a75);
        min-height: calc(var(--шаг, 26px) * 1.1);
      }

      .interruttore {
        position: relative;
        border: 0;
        background: none;
        cursor: pointer;
        padding: 7px 16px;
        min-height: 44px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(19px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.15;
        color: var(--тихий, #636a75);
      }

      .interruttore[aria-pressed='true'] {
        color: var(--паста, #1b3a6b);
      }

      .interruttore[aria-pressed='true']::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='46' preserveAspectRatio='none'><path d='M18,4 C62,1.5 118,3 145,6 C153,7 155,14 154,23 C153,33 152,39 145,41 C112,44 48,43 17,41 C8,40.5 5,34 5.5,24 C6,14 8,7 16,5' fill='none' stroke='%231b3a6b' stroke-width='1.6' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }
    `,
  ];

  static override properties = {
    timeout: { state: true },
    threshold: { state: true },
    readiness: { state: true },
    tick: { state: true },
  };

  declare timeout: number;
  declare threshold: number;
  declare readiness: boolean;
  declare tick: number;

  private sonde!: Sonde;
  private кадры: Kadr[] = [];
  private reported = false;
  private riferito = 0;

  protected override avvia(): void {
    this.timeout = NAPLYV.timeout;
    this.threshold = NAPLYV.threshold;
    this.readiness = NAPLYV.readiness;
    this.tick = 0;
    this.заново();
  }

  private заново(): void {
    this.sonde = createSonde(
      {
        ...NAPLYV,
        timeout: this.timeout,
        threshold: this.threshold,
        readiness: this.readiness,
      },
      this.props.goal ?? { maxErrors: 0.02 },
    );
    /* Весь наплыв прогоняется здесь же, за один заход: полтораста шагов
       модели — это доли миллисекунды, и ждать их незачем. */
    this.кадры = [];
    while (!this.sonde.state().done) {
      const s = this.sonde.step();
      this.кадры.push({
        t: s.time,
        ready: s.replicas.filter((r) => r.phase === 'running').length,
        latency: Math.max(...s.replicas.map((r) => r.latency), 0),
        errors: s.errorRate,
      });
    }
    this.reported = false;
    this.riferito = 0;
    this.tick += 1;
    this.донести();
  }

  private донести(): void {
    if (this.reported) return;
    const g = this.sonde.goal();
    if (g.reached || g.score >= this.riferito + 0.05) {
      this.riferito = g.score;
      this.reported = g.reached;
      this.riporta(g);
    }
  }

  private manopola(
    label: string,
    key: 'timeout' | 'threshold',
    min: number,
    max: number,
    step: number,
    unit = '',
  ) {
    const value = this[key];
    return html`<div class="manopola">
      <label for=${`s-${key}`}><span>${label}</span><i>${value}${unit}</i></label>
      <input
        id=${`s-${key}`}
        type="range"
        min=${min}
        max=${max}
        step=${step}
        .value=${String(value)}
        @input=${(e: Event) => {
          this[key] = Number((e.target as HTMLInputElement).value);
          /* Ручка меняет прогон, а не текущий: сравнивать половину наплыва
             при одних настройках с половиной при других было бы нечестно. */
          this.заново();
        }} />
    </div>`;
  }

  /**
   * Кривая всего прогона: сколько экземпляров принимают нагрузку.
   *
   * Сначала здесь рисовалось время ответа, и это было неверно выбранной
   * величиной: при полном обвале никто не отвечает, время ответа падает в
   * ноль — и график читался как аккуратный прямоугольник, будто всё хорошо.
   * Число в строю такой двусмысленности не имеет: провал есть провал.
   */
  private tela() {
    const W = 620;
    const H = 170;
    const к = this.кадры;
    if (к.length < 2) return null;
    const всего = NAPLYV.replicas;
    const x = (i: number) => (i / (к.length - 1)) * W;
    const y = (v: number) => H - 10 - (v / всего) * (H - 26);

    /* Ступенями, а не сглаженно: экземпляр либо принимает нагрузку, либо
       нет, и промежуточных значений тут не существует. */
    let путь = `M0,${y(к[0]!.ready).toFixed(1)}`;
    for (let i = 1; i < к.length; i += 1) {
      if (к[i]!.ready !== к[i - 1]!.ready) {
        путь += `L${x(i).toFixed(1)},${y(к[i - 1]!.ready).toFixed(1)}`;
      }
      путь += `L${x(i).toFixed(1)},${y(к[i]!.ready).toFixed(1)}`;
    }

    const с = к.findIndex((f) => f.t >= NAPLYV.surgeAt);
    const до = к.findIndex((f) => f.t >= NAPLYV.surgeAt + NAPLYV.surgeFor);
    const полоса =
      с >= 0
        ? svg`<rect
            x=${x(с).toFixed(1)}
            y="0"
            width=${(x(до < 0 ? к.length - 1 : до) - x(с)).toFixed(1)}
            height=${H}
            fill="var(--красный, #a8402f)"
            opacity="0.17" />`
        : null;

    /* Перезапуски: там, где число в строю упало. */
    const кресты: number[] = [];
    for (let i = 1; i < к.length; i += 1) {
      if (к[i]!.ready < к[i - 1]!.ready) кресты.push(i);
    }

    return html`<svg
      class="tela"
      viewBox="0 0 ${W} ${H}"
      preserveAspectRatio="none"
      role="img"
      aria-label=${`Экземпляров в строю за прогон: минимум ${Math.min(...к.map((f) => f.ready))} из ${всего}, перезапусков ${кресты.length}`}>
      ${полоса}
      ${/* Линейка только по краям: клетка тетради уже проходит под графиком,
            и внутренние линии с ней спорят, а не помогают. */ ''}
      ${[0, всего].map(
        (n) => svg`<line
          x1="0"
          y1=${y(n).toFixed(1)}
          x2=${W}
          y2=${y(n).toFixed(1)}
          stroke="var(--грифель, #5c6068)"
          stroke-width="0.9"
          opacity="0.4" />`,
      )}
      <path
        d=${путь}
        fill="none"
        stroke="var(--паста, #1b3a6b)"
        stroke-width="2"
        stroke-linejoin="round" />
      ${кресты.map(
        (i) => svg`<path
          d=${`M${(x(i) - 5).toFixed(1)},${H - 8} l10,8 M${(x(i) + 5).toFixed(1)},${H - 8} l-10,8`}
          stroke="var(--красный, #a8402f)"
          stroke-width="1.6"
          fill="none" />`,
      )}
    </svg>`;
  }

  private replica(s: SondeState, i: number) {
    const r = s.replicas[i]!;
    const поднимается = r.phase === 'starting';
    return html`<div class="replica ${поднимается ? 'starting' : ''}">
      <b>web-${r.id}</b>
      <i class=${!поднимается && r.latency > this.timeout ? 'oltre' : ''}
        >${поднимается ? '—' : `${r.latency.toFixed(2)} с`}</i
      >
      <small
        >${поднимается
          ? 'поднимается'
          : r.serving
            ? `отказов ${r.fails}`
            : 'вне службы'}</small
      >
    </div>`;
  }

  protected override render() {
    const s = this.sonde.state();
    const цель = this.props.goal ?? { maxErrors: 0.02 };
    const g = this.sonde.goal();

    return html`<section class="telaio">
      <h4>${this.props.title ?? 'Наплыв и пробы'}</h4>
      <p class="suggerimento">
        ${this.props.hint ??
        'Служба обязана пережить наплыв: очередь трёх экземпляров его держит. Убить её могут только ваши настройки. Двиньте срок пробы живости — весь прогон пересчитается сразу.'}
      </p>

      ${this.tela()}
      <p class="etichetta">
        Сколько экземпляров в строю за прогон. Розовым — наплыв, крестиками внизу —
        перезапуски: каждый из них устроила проба живости.
      </p>

      <div class="repliche">${s.replicas.map((_, i) => this.replica(s, i))}</div>
      <p class="etichetta">Состояние в конце прогона.</p>

      <div class="quadranti">
        <div class="quadrante ${s.errorRate > цель.maxErrors ? 'male' : 'bene'}">
          <b>потеряно</b><span>${(s.errorRate * 100).toFixed(1)} %</span>
        </div>
        <div class="quadrante ${s.wasted > 0 ? 'male' : ''}">
          <b>в пустоту</b><span>${s.wasted}</span>
        </div>
        <div class="quadrante ${s.restarts > 0 ? 'male' : ''}">
          <b>перезапусков</b><span>${s.restarts}</span>
        </div>
        <div class="quadrante"><b>время</b><span>${s.time.toFixed(0)} с</span></div>
      </div>

      <div class="manopole">
        ${this.manopola('срок живости', 'timeout', 0.4, 4, 0.1, ' с')}
        ${this.manopola('отказов подряд', 'threshold', 1, 5, 1)}
      </div>

      <div class="azioni">
        <button
          class="interruttore"
          aria-pressed=${this.readiness ? 'true' : 'false'}
          @click=${() => {
            this.readiness = !this.readiness;
            this.заново();
          }}>
          Проба готовности: ${this.readiness ? 'включена' : 'выключена'}
        </button>
        <button
          class="bottone"
          @click=${() => {
            this.timeout = NAPLYV.timeout;
            this.threshold = NAPLYV.threshold;
            this.readiness = NAPLYV.readiness;
            this.заново();
          }}>
          Как было
        </button>
      </div>

      <p class="esito ${g.reached ? 'bene' : ''} ${!g.reached ? 'male' : ''}">
        ${g.reached
          ? 'Наплыв пережит без потерь. Проба живости при этом ни разу не сработала — и это правильно: она отвечает на вопрос «нужен ли перезапуск», а не «хорошо ли идут дела».'
          : `Потеряно ${(s.errorRate * 100).toFixed(0)} % запросов при ${s.restarts} перезапусках — и ни одна программа не была сломана. Убила службу проба: медленно не значит зависла.`}
      </p>
    </section>`;
  }
}

customElements.define('cy-sonde', SondeWidget);
