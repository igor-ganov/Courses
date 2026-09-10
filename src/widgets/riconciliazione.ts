/**
 * СВЕРКА — прибор, на котором видно единственное движение Kubernetes.
 *
 * Читатель заявляет число, роняет поды пальцем и видит, что их никто не
 * восстанавливает по команде: расхождение закрывает цикл. Выключатель
 * контроллера здесь главная ручка — пока он не выключен, работа контроллера
 * невидима, потому что похожа на то, что «всё само работает».
 *
 * Считает всё модель из `models/riconciliazione`, проверенная тестами; здесь
 * только рисование и ручки.
 */

import { css, html, stile, Widget } from './base';
import { createCluster, type Cluster, type ClusterState, type Pod } from './models/riconciliazione';

interface Props {
  readonly desired?: number;
  readonly resync?: number;
  readonly startup?: number;
  readonly rival?: { desired: number; every: number };
  readonly goal?: { hold: number };
  readonly title?: string;
  readonly hint?: string;
}

/** Мест под поды всегда столько: коробка прибора не должна дышать. */
const МЕСТ = 8;
/** Строк ленты видно всегда столько — по той же причине. */
const СТРОК = 5;

const ФАЗА: Record<Pod['phase'], string> = {
  pending: 'ждёт узла',
  creating: 'поднимается',
  running: 'работает',
  terminating: 'гасится',
};

export class Riconciliazione extends Widget<Props> {
  static override styles = [
    stile,
    css`
      /* Мест всегда восемь, занятых — сколько заявлено. Сетка с автоподбором
         меняла бы число рядов вместе с числом подов, а вместе с рядами ездил
         бы весь текст под прибором. */
      .griglia {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(74px, 1fr));
        gap: 8px;
        margin: 0 0 14px;
      }

      .posto {
        position: relative;
        min-height: calc(var(--шаг, 26px) * 2.6);
        padding: 6px 4px 4px;
        border: 0;
        background: none;
        font: inherit;
        text-align: center;
        cursor: pointer;
        color: var(--паста, #1b3a6b);
      }

      .posto[disabled] {
        cursor: default;
      }

      /* Обводка одним штрихом, как у всей тетради: рамок нет, есть след пасты. */
      .posto.pieno::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='90' height='70' preserveAspectRatio='none'><path d='M10,5 C34,3 62,4 80,7 C85,8 86,14 86,24 C86,44 85,58 81,62 C60,66 30,65 11,63 C6,62 4,56 4,45 C4,26 5,11 8,7' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      .posto.vuoto::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='90' height='70' preserveAspectRatio='none'><path d='M10,5 C34,3 62,4 80,7 C85,8 86,14 86,24 C86,44 85,58 81,62 C60,66 30,65 11,63 C6,62 4,56 4,45 C4,26 5,11 8,7' fill='none' stroke='%235c6068' stroke-width='1.1' stroke-linecap='round' stroke-dasharray='5 6' opacity='.4'/></svg>")
          no-repeat center / 100% 100%;
      }

      .nome {
        display: block;
        font-family: 'PT Mono', monospace;
        font-size: max(calc(13px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.15;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .fase {
        display: block;
        font-family: 'Caveat', cursive;
        font-size: max(calc(16px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.1;
        color: var(--тихий, #636a75);
      }

      .posto.lavora .fase {
        color: var(--зелёный, #3f6b4a);
      }

      .posto.spegne .nome {
        text-decoration: line-through;
        opacity: 0.55;
      }

      /* Поднимающийся под — полоска, а не мигание: мигание на странице с
         текстом читается как поломка, а полоска говорит «идёт». */
      .barra {
        position: absolute;
        left: 12%;
        right: 12%;
        bottom: 8px;
        height: 2px;
        background: color-mix(in srgb, var(--паста, #1b3a6b) 22%, transparent);
      }

      .barra i {
        display: block;
        height: 100%;
        background: var(--паста, #1b3a6b);
      }

      .nastro {
        margin: 0 0 12px;
        padding: 0;
        list-style: none;
        min-height: calc(var(--шаг, 26px) * 5);
        font-family: 'PT Mono', monospace;
        font-size: max(calc(13px * var(--кегль, 1)), var(--пол, 0px));
        line-height: var(--шаг, 26px);
        color: var(--грифель, #5c6068);
      }

      .nastro li {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .nastro .t {
        color: var(--тихий, #636a75);
      }

      .nastro .killed {
        color: var(--красный, #a8402f);
      }

      .nastro .started {
        color: var(--зелёный, #3f6b4a);
      }

      .spento {
        color: var(--красный, #a8402f);
      }

      /* График нужен только там, где есть второй хозяин: дребезг словами
         описывается плохо, а пилой — сразу. */
      svg.pila {
        display: block;
        width: 100%;
        height: auto;
        margin: 0 0 12px;
      }
    `,
  ];

  static override properties = {
    desired: { state: true },
    acceso: { state: true },
    tick: { state: true },
  };

  declare desired: number;
  declare acceso: boolean;
  declare tick: number;

  private cluster!: Cluster;
  private stop?: () => void;
  private reported = false;
  private riferito = 0;

  protected override avvia(): void {
    const p = this.props;
    this.desired = p.desired ?? 3;
    this.acceso = true;
    this.tick = 0;

    this.cluster = createCluster(
      {
        desired: this.desired,
        resync: p.resync ?? 0.5,
        startup: p.startup ?? 2.5,
        shutdown: 1.2,
        running: true,
        dt: 0.25,
        ...(p.rival ? { rival: p.rival } : {}),
      },
      p.goal,
    );

    this.stop = this.loop(() => {
      /* Два шага на кадр: за секунду реального времени проходит около
         полуминуты кластерного, и читатель успевает увидеть, как поднимается
         замена, не успев отвести взгляд. */
      for (let i = 0; i < 2; i += 1) this.cluster.step();
      this.tick += 1;
      if (this.props.goal && !this.reported) {
        const g = this.cluster.goal();
        if (g.reached || g.score >= this.riferito + 0.05) {
          this.riferito = g.score;
          this.reported = g.reached;
          this.riporta(g);
        }
      }
    });
  }

  protected override ferma(): void {
    this.stop?.();
  }

  private posto(s: ClusterState, i: number) {
    const p = s.pods[i];
    if (!p) {
      return html`<div class="posto vuoto" aria-hidden="true">
        <span class="nome">&nbsp;</span><span class="fase">&nbsp;</span>
      </div>`;
    }
    const доля =
      p.phase === 'creating' ? Math.min(1, p.age / this.cluster.settings().startup) : 0;
    return html`<button
      class="posto pieno ${p.phase === 'running' ? 'lavora' : ''} ${p.phase === 'terminating' ? 'spegne' : ''}"
      aria-label=${`Уронить под ${p.name}, сейчас ${ФАЗА[p.phase]}`}
      ?disabled=${p.phase === 'terminating'}
      @click=${() => this.cluster.kill(p.id)}>
      <span class="nome">${p.name}</span>
      <span class="fase">${ФАЗА[p.phase]}</span>
      ${p.phase === 'creating'
        ? html`<span class="barra"><i style=${`width:${(доля * 100).toFixed(0)}%`}></i></span>`
        : null}
    </button>`;
  }

  private nastro(s: ClusterState) {
    const строки = s.events.slice(-СТРОК);
    /* Лента дополняется пустыми строками до полной высоты: короткая лента,
       дорастая, раздвигала бы прибор. */
    const пусто = Math.max(0, СТРОК - строки.length);
    return html`<ul class="nastro" aria-label="Лента событий">
      ${строки.map(
        (e) => html`<li>
          <span class="t">${e.at.toFixed(1)} с</span> <span class=${e.kind}>${e.text}</span>
        </li>`,
      )}
      ${Array.from({ length: пусто }, () => html`<li aria-hidden="true">&nbsp;</li>`)}
    </ul>`;
  }

  /** Пила заявленного числа и готовых рядом с ним. Только при сопернике. */
  private pila(s: ClusterState) {
    const точек = s.wanted.length;
    if (!this.props.rival || точек < 4) return null;
    const W = 620;
    const H = 120;
    const макс = Math.max(1, ...s.wanted.map((w) => w.n), s.desired, 1);
    const x = (i: number) => (i / (точек - 1)) * W;
    const y = (v: number) => H - (v / (макс + 0.4)) * H;
    const путь = s.wanted
      .map((w, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(w.n).toFixed(1)}`)
      .join('');
    return html`<svg
      class="pila"
      viewBox="0 0 ${W} ${H}"
      preserveAspectRatio="none"
      role="img"
      aria-label="Заявленное число экземпляров во времени: пила между двумя значениями">
      <path
        d=${путь}
        fill="none"
        stroke="var(--паста, #1b3a6b)"
        stroke-width="2"
        stroke-linejoin="round" />
    </svg>`;
  }

  private scala(n: number): void {
    this.desired = n;
    this.cluster.set({ desired: n });
  }

  private acceleratore(): void {
    this.acceso = !this.acceso;
    this.cluster.set({ running: this.acceso });
  }

  private daccapo(): void {
    this.reported = false;
    this.riferito = 0;
    this.cluster.reset();
    this.cluster.set({ desired: this.desired, running: this.acceso });
    this.tick += 1;
  }

  protected override render() {
    const s = this.cluster.state();
    const сошлось = s.ready === s.desired;
    const цель = this.props.goal ? this.cluster.goal() : undefined;

    return html`<section class="telaio">
      <h4>${this.props.title ?? 'Цикл сверки'}</h4>
      <p class="suggerimento">
        ${this.props.hint ??
        'Уроните под пальцем — его никто не воскрешает по команде: контроллер просто видит, что заявленному числу не хватает одного. Выключите контроллер и уроните снова.'}
      </p>

      ${this.pila(s)}

      <div class="griglia">
        ${Array.from({ length: МЕСТ }, (_, i) => this.posto(s, i))}
      </div>

      ${this.nastro(s)}

      <div class="quadranti">
        <div class="quadrante"><b>заявлено</b><span>${s.desired}</span></div>
        <div class="quadrante ${сошлось ? 'bene' : 'male'}"><b>готовы</b><span>${s.ready}</span></div>
        <div class="quadrante"><b>существуют</b><span>${s.alive}</span></div>
        <div class="quadrante"><b>время</b><span>${s.time.toFixed(0)} с</span></div>
        ${цель
          ? html`<div class="quadrante ${цель.reached ? 'bene' : ''}">
              <b>сведено</b><span>${(цель.score * 100).toFixed(0)} %</span>
            </div>`
          : null}
      </div>

      <div class="manopole">
        <div class="manopola">
          <label for="m-desired"><span>заявлено экземпляров</span><i>${this.desired}</i></label>
          <input
            id="m-desired"
            type="range"
            min="0"
            max=${МЕСТ}
            step="1"
            .value=${String(this.desired)}
            @input=${(e: Event) => this.scala(Number((e.target as HTMLInputElement).value))} />
        </div>
      </div>

      <div class="azioni">
        <button class="bottone" @click=${() => this.acceleratore()}>
          ${this.acceso ? 'Остановить контроллер' : 'Пустить контроллер'}
        </button>
        <button class="bottone" @click=${() => this.daccapo()}>Сначала</button>
      </div>

      <p class="esito ${цель?.reached ? 'bene' : ''} ${!this.acceso ? 'male' : ''}">
        ${!this.acceso
          ? 'Контроллер остановлен. Заявка на месте, поды падают — и никто ничего не делает. Вот чем он занимался.'
          : цель
            ? цель.reached
              ? 'Сведено и удержано. Заметьте: вы ни разу не сказали «создай под».'
              : `Цель: держать готовых столько, сколько заявлено, ${this.props.goal!.hold} с подряд.`
            : сошлось
              ? 'Заявленное и настоящее сошлись. Роняйте.'
              : 'Расхождение. Контроллер закроет его сам — посмотрите, за сколько.'}
      </p>
    </section>`;
  }
}

customElements.define('cy-riconciliazione', Riconciliazione);
