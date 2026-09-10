/**
 * ОТБОР ПО МЕТКЕ — прибор, в котором надо попасть условием ровно в цель.
 *
 * Читатель включает условия и видит выборку живьём: кто подошёл, кого не
 * хватает, кто лишний. Головоломка решается двумя условиями, но набор
 * подобран так, что очевидный путь — отбирать по месту — теряет своего.
 *
 * Считает всё модель из `models/selettore`, проверенная тестами.
 */

import { css, html, stile, Widget } from './base';
import {
  createSelettore,
  NABOR,
  type Condizione,
  type Selettore,
  type SelettoreState,
} from './models/selettore';

interface Props {
  readonly goal?: boolean;
  readonly title?: string;
  readonly hint?: string;
}

const ЗНАК: Record<Condizione['op'], string> = { eq: '=', ne: '!=' };

/** Галочка, плюс и минус — росчерком, а не знаком из шрифта. */
function ЗНАЧОК(вид: 'preso' | 'troppo' | 'perso' | '') {
  if (!вид) return null;
  const цвет = вид === 'preso' ? '%233f6b4a' : '%23a8402f';
  const путь =
    вид === 'preso'
      ? 'M2,8 C3.5,9.5 4.5,11 5.5,12.5 C7.5,9 9.5,5 12.5,2'
      : вид === 'troppo'
        ? 'M7,2 C7.2,5 7.1,9 7,12.5 M2,7.2 C5,7 9,7.1 12.5,7'
        : 'M2,7.2 C5,7 9,7.1 12.5,7';
  return html`<span
    style=${`display:block;width:100%;height:100%;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14'><path d='${путь}' fill='none' stroke='${цвет}' stroke-width='1.8' stroke-linecap='round'/></svg>") no-repeat center/100% 100%`}
  ></span>`;
}

export class SelettoreWidget extends Widget<Props> {
  static override styles = [
    stile,
    css`
      .condizioni {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 0 0 14px;
        /* Два ряда отведены заранее: условий пять, и на узком экране они
           встают в два ряда — но всегда в два, сколько бы ни было включено. */
        min-height: calc(var(--шаг, 26px) * 3.4);
        align-content: flex-start;
      }

      .cond {
        position: relative;
        border: 0;
        background: none;
        cursor: pointer;
        padding: 6px 14px;
        min-height: 40px;
        font-family: 'PT Mono', monospace;
        font-size: max(calc(13px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.2;
        color: var(--тихий, #636a75);
      }

      .cond[aria-pressed='true'] {
        color: var(--паста, #1b3a6b);
      }

      .cond[aria-pressed='true']::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='42' preserveAspectRatio='none'><path d='M16,4 C54,2 104,3 126,6 C133,7 135,13 134,21 C133,30 132,36 126,38 C96,41 42,40 15,38 C8,37 5,31 5,22 C5,13 8,7 14,5' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      .cond[aria-pressed='false']::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='42' preserveAspectRatio='none'><path d='M16,4 C54,2 104,3 126,6 C133,7 135,13 134,21 C133,30 132,36 126,38 C96,41 42,40 15,38 C8,37 5,31 5,22 C5,13 8,7 14,5' fill='none' stroke='%235c6068' stroke-width='1.1' stroke-linecap='round' stroke-dasharray='4 5' opacity='.5'/></svg>")
          no-repeat center / 100% 100%;
      }

      /* Метки не обрезаются: значение метки — это и есть содержание задачи,
         и «tier=fr...» превращает головоломку в угадайку. Поэтому клетка
         шире (на телефоне их два в ряд), а строки не усекаются. */
      .campo {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
        gap: 8px;
        margin: 0 0 12px;
      }

      .pod {
        position: relative;
        padding: 7px 10px 6px;
        min-height: calc(var(--шаг, 26px) * 3);
      }

      .pod::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80' preserveAspectRatio='none'><path d='M12,6 C40,3 82,5 106,8 C112,9 114,15 114,26 C114,50 113,66 109,72 C82,77 38,76 14,73 C8,72 5,66 5,54 C5,30 6,12 9,8' fill='none' stroke='%235c6068' stroke-width='1.1' stroke-linecap='round' stroke-dasharray='4 5' opacity='.45'/></svg>")
          no-repeat center / 100% 100%;
      }

      /* Попал и нужен — обведён пастой. Попал и лишний — красным.
         Нужен и не попал — красным пунктиром: видно, что его потеряли. */
      .pod.preso::before {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80' preserveAspectRatio='none'><path d='M12,6 C40,3 82,5 106,8 C112,9 114,15 114,26 C114,50 113,66 109,72 C82,77 38,76 14,73 C8,72 5,66 5,54 C5,30 6,12 9,8' fill='none' stroke='%231b3a6b' stroke-width='1.7' stroke-linecap='round'/></svg>");
      }

      .pod.troppo::before {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80' preserveAspectRatio='none'><path d='M12,6 C40,3 82,5 106,8 C112,9 114,15 114,26 C114,50 113,66 109,72 C82,77 38,76 14,73 C8,72 5,66 5,54 C5,30 6,12 9,8' fill='none' stroke='%23a8402f' stroke-width='1.7' stroke-linecap='round'/></svg>");
      }

      .pod.perso::before {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80' preserveAspectRatio='none'><path d='M12,6 C40,3 82,5 106,8 C112,9 114,15 114,26 C114,50 113,66 109,72 C82,77 38,76 14,73 C8,72 5,66 5,54 C5,30 6,12 9,8' fill='none' stroke='%23a8402f' stroke-width='1.4' stroke-linecap='round' stroke-dasharray='5 6'/></svg>");
      }

      .pod b {
        display: block;
        font-family: 'PT Mono', monospace;
        font-weight: 400;
        font-size: max(calc(12.5px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.2;
        color: var(--паста, #1b3a6b);
      }

      .pod span {
        display: block;
        font-family: 'PT Mono', monospace;
        font-size: max(calc(11px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.35;
        color: var(--тихий, #636a75);
        white-space: nowrap;
      }

      /* Знаки нарисованы, а не набраны. Причина простая: галочки в урезанных
         шрифтах тетради нет, и набранная превратилась бы в квадратик. Но и
         будь она там — рисовать вернее: на листе, где всё сделано пастой в
         один проход, типографский знак читается как чужой. */
      .segno {
        position: absolute;
        top: 5px;
        right: 8px;
        width: 14px;
        height: 14px;
      }

      .segno svg {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ];

  static override properties = { tick: { state: true } };

  declare tick: number;

  private sel!: Selettore;
  private reported = false;
  private riferito = 0;

  protected override avvia(): void {
    this.tick = 0;
    this.sel = createSelettore(NABOR);
  }

  private toggle(i: number): void {
    this.sel.toggle(i);
    this.tick += 1;
    if (!this.props.goal || this.reported) return;
    const g = this.sel.goal();
    if (g.reached || g.score >= this.riferito + 0.2) {
      this.riferito = g.score;
      this.reported = g.reached;
      this.riporta(g);
    }
  }

  private pod(s: SelettoreState, id: number) {
    const p = s.pods.find((x) => x.id === id)!;
    const взят = s.matched.includes(id);
    const лишний = s.extra.includes(id);
    const потерян = s.missing.includes(id);
    const класс = лишний ? 'troppo' : потерян ? 'perso' : взят ? 'preso' : '';
    const знак = лишний ? 'лишний' : потерян ? 'потерян' : взят ? 'взят' : '';
    /* Состояние пода уходит в подпись целиком: цвет обводки и знак читалке
       не видны, а без них строка «web-f app=web tier=backend» ничего не
       говорит о том, взят под или потерян. */
    return html`<div class="pod ${класс}" aria-label=${`${p.name}${знак ? ', ' + знак : ''}`}>
      <span class="segno" aria-hidden="true">${ЗНАЧОК(лишний ? 'troppo' : потерян ? 'perso' : взят ? 'preso' : '')}</span>
      <b>${p.name}</b>
      ${Object.entries(p.labels).map(([k, v]) => html`<span>${k}=${v}</span>`)}
    </div>`;
  }

  protected override render() {
    const s = this.sel.state();

    return html`<section class="telaio">
      <h4>${this.props.title ?? 'Отбор по метке'}</h4>
      <p class="suggerimento">
        ${this.props.hint ??
        'Включайте условия и смотрите на выборку: галочка — взят и нужен, плюс — лишний, минус — нужен, но потерян.'}
      </p>

      <div class="condizioni" role="group" aria-label="Условия отбора">
        ${s.conditions.map(
          (c, i) => html`<button
            class="cond"
            aria-pressed=${s.on[i] ? 'true' : 'false'}
            @click=${() => this.toggle(i)}>
            ${c.key}${ЗНАК[c.op]}${c.value}
          </button>`,
        )}
      </div>

      <div class="campo">${s.pods.map((p) => this.pod(s, p.id))}</div>

      <div class="quadranti">
        <div class="quadrante ${s.solved ? 'bene' : ''}"><b>отобрано</b><span>${s.matched.length}</span></div>
        <div class="quadrante ${s.extra.length > 0 ? 'male' : ''}"><b>лишних</b><span>${s.extra.length}</span></div>
        <div class="quadrante ${s.missing.length > 0 ? 'male' : ''}"><b>потеряно</b><span>${s.missing.length}</span></div>
      </div>

      <div class="azioni">
        <button
          class="bottone"
          @click=${() => {
            this.sel.reset();
            this.tick += 1;
          }}>
          Снять всё
        </button>
      </div>

      <p class="esito ${s.solved ? 'bene' : ''}">
        ${s.solved
          ? 'Попали ровно в нужных. Заметьте, что условие описывает признак, а не перечисляет имена: поды сменятся — условие останется верным.'
          : s.missing.length > 0
            ? 'Кого-то потеряли. Посмотрите, чем потерянный отличается от взятых, — и не то ли это отличие, которое к делу не относится.'
            : 'Взяли лишнего. Служба будет слать на него запросы, а он к делу не относится.'}
      </p>
    </section>`;
  }
}

customElements.define('cy-selettore', SelettoreWidget);
