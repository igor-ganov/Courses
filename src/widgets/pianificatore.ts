/**
 * ПЛАНИРОВЩИК — прибор, на котором видно оба приёма размещения.
 *
 * Читатель отправляет поды и видит не результат, а решение: какие узлы
 * отсеяны и почему, сколько баллов у оставшихся. Прибор, показывающий
 * только «под уехал на узел-2», не учит ничему — размещение выглядит
 * произволом, а оно им не является.
 *
 * Отправлять можно любой под, а не только первый: порядок здесь и есть
 * задача. Планировщик порядком не распоряжается — он видит по одному поду
 * за раз, — а тот, кто пишет заявки, распоряжается.
 *
 * Считает всё модель из `models/pianificatore`, проверенная тестами.
 */

import { css, html, stile, Widget } from './base';
import {
  createScheduler,
  OBSTANOVKA,
  type Carico,
  type Scheduler,
  type SchedulerState,
} from './models/pianificatore';

interface Props {
  readonly goal?: { placed: number };
  readonly title?: string;
  readonly hint?: string;
}

export class Pianificatore extends Widget<Props> {
  static override styles = [
    stile,
    css`
      .nodi {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
        margin: 0 0 14px;
      }

      .nodo {
        position: relative;
        padding: 8px 12px 10px;
        /* Высота задана: узел с двумя подами и узел с пятью занимают одинаково,
           иначе прибор дышал бы при каждой отправке. */
        min-height: calc(var(--шаг, 26px) * 4.6);
      }

      .nodo::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='120' preserveAspectRatio='none'><path d='M12,6 C60,3 130,5 168,9 C174,10 176,18 176,32 C176,72 175,102 171,111 C130,116 60,115 15,112 C8,111 5,102 5,88 C5,48 6,18 9,10' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      /* Отсеянный узел гасится, а не прячется: видно, что он рассматривался. */
      .nodo.fuori {
        opacity: 0.45;
      }

      .nodo.scelto::after {
        content: '';
        position: absolute;
        inset: -4px;
        pointer-events: none;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='120' preserveAspectRatio='none'><path d='M12,6 C60,3 130,5 168,9 C174,10 176,18 176,32 C176,72 175,102 171,111 C130,116 60,115 15,112 C8,111 5,102 5,88 C5,48 6,18 9,10' fill='none' stroke='%233f6b4a' stroke-width='1.8' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      .nodo h5 {
        margin: 0 0 4px;
        font-family: 'Caveat', cursive;
        font-weight: 700;
        font-size: max(calc(19px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.1;
        color: var(--паста, #1b3a6b);
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }

      .nodo h5 i {
        font-style: normal;
        font-family: 'Literata', serif;
        font-size: max(calc(14px * var(--кегль, 1)), var(--пол, 0px));
        font-variant-numeric: tabular-nums;
        color: var(--грифель, #5c6068);
      }

      /* Одна шкала — одна строка: имя, полоса, число. Двухрядная сетка тут
         уже была, и числа в ней висели посреди пустого места, оторванные от
         своей полосы. */
      .scala {
        display: grid;
        grid-template-columns: 3.9em 1fr auto;
        align-items: center;
        gap: 0 7px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(16px * var(--кегль, 1)), var(--пол, 0px));
        line-height: calc(var(--шаг, 26px) * 0.85);
        color: var(--тихий, #636a75);
      }

      .scala b {
        font-weight: 500;
        font-family: 'Literata', serif;
        font-size: max(calc(12.5px * var(--кегль, 1)), var(--пол, 0px));
        font-variant-numeric: tabular-nums;
        color: var(--грифель, #5c6068);
        white-space: nowrap;
      }

      .barra {
        position: relative;
        height: 6px;
        background: color-mix(in srgb, var(--грифель, #5c6068) 18%, transparent);
      }

      .barra i {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--паста, #1b3a6b);
      }

      .barra.pieno i {
        background: var(--красный, #a8402f);
      }

      .abitanti {
        margin: 6px 0 0;
        font-family: 'PT Mono', monospace;
        font-size: max(calc(12px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.35;
        color: var(--грифель, #5c6068);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .coda {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 0 0 10px;
        /* Два ряда фишек отведены заранее: очередь пустеет по ходу дела. */
        min-height: calc(var(--шаг, 26px) * 2.8);
        align-content: flex-start;
      }

      .fiche {
        position: relative;
        border: 0;
        background: none;
        cursor: pointer;
        padding: 5px 14px;
        min-height: 40px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(18px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.1;
        color: var(--паста, #1b3a6b);
      }

      .fiche::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='42' preserveAspectRatio='none'><path d='M14,4 C48,2 90,3 108,6 C114,7 116,13 115,21 C114,30 113,35 107,37 C82,40 36,39 13,37 C7,36 4,31 4,22 C4,13 6,7 12,5' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      .fiche b {
        font-weight: 500;
      }

      .fiche span {
        /* Отступ обязателен: рукописное имя заваливается вправо и без него
           упирается в цифры — «веб-11 / 2Г» вместо «веб-1  1/2Г». */
        margin-left: 6px;
        font-family: 'Literata', serif;
        font-size: max(calc(13px * var(--кегль, 1)), var(--пол, 0px));
        color: var(--тихий, #636a75);
        font-variant-numeric: tabular-nums;
      }

      .fiche.attesa {
        color: var(--красный, #a8402f);
        cursor: default;
      }

      .fiche.attesa::before {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='42' preserveAspectRatio='none'><path d='M14,4 C48,2 90,3 108,6 C114,7 116,13 115,21 C114,30 113,35 107,37 C82,40 36,39 13,37 C7,36 4,31 4,22 C4,13 6,7 12,5' fill='none' stroke='%23a8402f' stroke-width='1.5' stroke-linecap='round' stroke-dasharray='4 5'/></svg>");
      }

      .etichetta {
        margin: 0 0 4px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(17px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.2;
        color: var(--тихий, #636a75);
      }
    `,
  ];

  static override properties = { tick: { state: true } };

  declare tick: number;

  private sched!: Scheduler;
  private reported = false;

  protected override avvia(): void {
    this.tick = 0;
    this.sched = createScheduler(OBSTANOVKA, this.props.goal);
  }

  private invia(id: number): void {
    this.sched.invia(id);
    this.tick += 1;
    if (this.props.goal && !this.reported) {
      const g = this.sched.goal();
      if (g.reached) {
        this.reported = true;
        this.riporta(g);
      }
    }
  }

  private daccapo(): void {
    this.reported = false;
    this.sched.reset();
    this.tick += 1;
  }

  private nodo(s: SchedulerState, i: number) {
    const n = s.nodi[i]!;
    const o = s.occupato[i]!;
    const v = s.ultimo?.verdetti.find((x) => x.nodo === n.id);
    const жильцы = s.posti.filter((p) => p.nodo === n.id).map((p) => p.pod.name);

    const шкала = (имя: string, взято: number, всего: number, ед: string) => {
      const доля = Math.min(1, взято / всего);
      return html`<div class="scala">
        <span>${имя}</span>
        <span class="barra ${доля > 0.98 ? 'pieno' : ''}"
          ><i style=${`width:${(доля * 100).toFixed(0)}%`}></i
        ></span>
        <b>${взято.toFixed(взято % 1 ? 1 : 0)}/${всего}${ед}</b>
      </div>`;
    };

    return html`<div
      class="nodo ${v && !v.adatto ? 'fuori' : ''} ${s.ultimo?.nodo === n.id ? 'scelto' : ''}">
      <h5>
        <span>${n.name}</span>
        <i>${v ? (v.adatto ? `${v.punti} б.` : (v.perche ?? 'не подошёл')) : ''}</i>
      </h5>
      ${шкала('ядра', o.cpu, n.cpu, '')} ${шкала('память', o.mem, n.mem, ' Г')}
      <p class="abitanti">${жильцы.length > 0 ? жильцы.join(' · ') : ' '}</p>
    </div>`;
  }

  private fiche(p: Carico, ждёт: boolean) {
    const подпись = html`<b>${p.name}</b> <span>${p.cpu} / ${p.mem}Г</span>`;
    if (ждёт) {
      return html`<span class="fiche attesa" title="Не нашлось узла">${подпись}</span>`;
    }
    return html`<button
      class="fiche"
      aria-label=${`Отправить под ${p.name}, заявка ${p.cpu} ядра и ${p.mem} гигабайт`}
      @click=${() => this.invia(p.id)}>
      ${подпись}
    </button>`;
  }

  protected override render() {
    const s = this.sched.state();
    const цель = this.props.goal ? this.sched.goal() : undefined;
    const всё = s.coda.length === 0;

    return html`<section class="telaio">
      <h4>${this.props.title ?? 'Куда поедет под'}</h4>
      <p class="suggerimento">
        ${this.props.hint ??
        'Отправляйте поды по одному, в любом порядке. Серым отмечены узлы, отсеянные на первом приёме; числом — баллы оставшихся.'}
      </p>

      <div class="nodi">${s.nodi.map((_, i) => this.nodo(s, i))}</div>

      <p class="etichetta">Ждут отправки — коснитесь, чтобы отправить</p>
      <div class="coda">
        ${s.coda.map((p) => this.fiche(p, false))}
        ${s.attesa.map((p) => this.fiche(p, true))}
        ${s.coda.length === 0 && s.attesa.length === 0
          ? html`<span class="etichetta">пусто: все размещены</span>`
          : null}
      </div>

      <div class="quadranti">
        <div class="quadrante ${s.attesa.length === 0 ? 'bene' : ''}">
          <b>размещено</b><span>${s.posti.length}</span>
        </div>
        <div class="quadrante ${s.attesa.length > 0 ? 'male' : ''}">
          <b>в ожидании</b><span>${s.attesa.length}</span>
        </div>
        <div class="quadrante"><b>не отправлены</b><span>${s.coda.length}</span></div>
        <div class="quadrante">
          <b>свободно ядер</b>
          <span
            >${s.nodi
              .reduce((с, n, i) => с + n.cpu - s.occupato[i]!.cpu, 0)
              .toFixed(1)}</span
          >
        </div>
      </div>

      <div class="azioni">
        <button class="bottone" @click=${() => this.daccapo()}>Сначала</button>
      </div>

      <p class="esito ${цель?.reached ? 'bene' : ''} ${s.attesa.length > 0 ? 'male' : ''}">
        ${s.attesa.length > 0
          ? 'Под остался в ожидании. Свободные ядра ещё есть — но лежат кусками по разным узлам, и целиком заявка не помещается никуда. Начните сначала и отправьте крупные раньше мелких.'
          : цель
            ? цель.reached
              ? 'Все размещены. Планировщик не мог этого добиться сам: он видит по одному поду за раз и не знает, что придёт следующим.'
              : всё
                ? 'Очередь пуста.'
                : `Цель: разместить все ${this.props.goal!.placed}, не оставив никого в ожидании.`
            : 'Отправляйте поды и смотрите на баллы.'}
      </p>
    </section>`;
  }
}

customElements.define('cy-pianificatore', Pianificatore);
