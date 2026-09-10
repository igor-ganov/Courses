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

import { css, html, stile, Widget } from './base';
import { createSonde, NAPLYV, type Sonde, type SondeState } from './models/sonde';

interface Props {
  readonly goal?: { maxErrors: number };
  readonly title?: string;
  readonly hint?: string;
}

/** Шагов модели на кадр: наплыв в двадцать секунд проходит за пять реальных. */
const ШАГОВ = 4;

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

      /* Полоса нагрузки: наплыв видно как событие, а не как цифру. */
      .carico {
        position: relative;
        height: 6px;
        margin: 0 0 4px;
        background: color-mix(in srgb, var(--грифель, #5c6068) 16%, transparent);
      }

      .carico i {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--паста, #1b3a6b);
      }

      .carico.surge i {
        background: var(--красный, #a8402f);
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
  private stop?: () => void;
  private reported = false;
  private riferito = 0;

  protected override avvia(): void {
    this.timeout = NAPLYV.timeout;
    this.threshold = NAPLYV.threshold;
    this.readiness = NAPLYV.readiness;
    this.tick = 0;
    this.заново();
    this.stop = this.loop(() => {
      if (this.sonde.state().done) return;
      for (let i = 0; i < ШАГОВ; i += 1) this.sonde.step();
      this.tick += 1;
      this.донести();
    });
  }

  protected override ferma(): void {
    this.stop?.();
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
    this.reported = false;
    this.riferito = 0;
    this.tick += 1;
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
    const доля = Math.min(1, s.load / NAPLYV.surge);

    return html`<section class="telaio">
      <h4>${this.props.title ?? 'Наплыв и пробы'}</h4>
      <p class="suggerimento">
        ${this.props.hint ??
        'Служба обязана пережить наплыв: очередь трёх экземпляров его держит. Убить её могут только ваши настройки. Двиньте срок пробы живости и посмотрите, что будет.'}
      </p>

      <div
        class="carico ${s.surging ? 'surge' : ''}"
        role="img"
        aria-label=${`Нагрузка ${s.load} запросов в секунду`}>
        <i style=${`width:${(доля * 100).toFixed(0)}%`}></i>
      </div>
      <p class="etichetta">
        ${s.surging ? `Наплыв: ${s.load} запросов в секунду` : `Спокойно: ${s.load} запросов в секунду`}
      </p>

      <div class="repliche">${s.replicas.map((_, i) => this.replica(s, i))}</div>

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
        <button class="bottone" @click=${() => this.заново()}>Сначала</button>
      </div>

      <p class="esito ${g.reached ? 'bene' : ''} ${s.done && !g.reached ? 'male' : ''}">
        ${s.done
          ? g.reached
            ? 'Наплыв пережит без потерь. Проба живости при этом ни разу не сработала — и это правильно: она отвечает на вопрос «нужен ли перезапуск», а не «хорошо ли идут дела».'
            : `Потеряно ${(s.errorRate * 100).toFixed(0)} % запросов при ${s.restarts} перезапусках — и ни одна программа не была сломана. Убила службу проба: медленно не значит зависла.`
          : s.restarts > 0
            ? 'Пошли перезапуски. Смотрите, что происходит с временем ответа у выживших.'
            : `Держите потери ниже ${(цель.maxErrors * 100).toFixed(0)} % до конца прогона.`}
      </p>
    </section>`;
  }
}

customElements.define('cy-sonde', SondeWidget);
