/**
 * АВТОМАТЫ — правило в строку, поведение не в строку.
 *
 * `<cy-automa>` — элементарный клеточный автомат. Читатель крутит номер правила
 * и видит, как из восьми бит получается то узор, то шум, то структура, которая
 * ползёт. Правило 110 полно по Тьюрингу; на этом виджете это не утверждение, а
 * наблюдение.
 *
 * `<cy-vita>` — «Жизнь» на торе, с фигурами и рисованием пальцем. Здесь важно
 * не любование, а то, что читатель сам ставит клетки и не может предсказать,
 * что получится, хотя знает правило целиком.
 */

import { css, html, stile, Widget } from './base';
import {
  FIGURES,
  createGrid,
  elementaryRun,
  lifeStep,
  population,
  setCells,
  type Grid,
} from './models/automi';

const stileTela = css`
  canvas {
    width: 100%;
    height: auto;
    image-rendering: pixelated;
    cursor: crosshair;
    touch-action: none;
    background: color-mix(in srgb, var(--бумага, #fffdf6) 70%, transparent);
  }
`;

interface AutomaProps {
  readonly rule?: number;
  readonly width?: number;
  readonly steps?: number;
  readonly title?: string;
  readonly hint?: string;
}

const ИЗВЕСТНЫЕ: Record<number, string> = {
  30: 'шум из порядка: этим правилом когда-то делали случайные числа',
  90: 'треугольник Серпинского — правило есть XOR соседей',
  110: 'полно по Тьюрингу: на нём можно вычислить всё вычислимое',
  184: 'поток машин: заторы возникают сами и едут назад',
  250: 'ровная решётка — правило почти ничего не решает',
};

export class Automa extends Widget<AutomaProps> {
  static override styles = [stile, stileTela];
  static override properties = { rule: { state: true } };
  declare rule: number;

  private canvas: HTMLCanvasElement | undefined;

  protected override avvia(): void {
    this.rule = this.props.rule ?? 90;
  }

  protected override updated(): void {
    this.disegna();
  }

  private disegna(): void {
    this.canvas ??= this.renderRoot.querySelector('canvas') ?? undefined;
    const canvas = this.canvas;
    if (!canvas) return;
    const width = this.props.width ?? 201;
    const steps = this.props.steps ?? 110;
    canvas.width = width;
    canvas.height = steps + 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const рядов = elementaryRun(width, this.rule, steps);
    const img = ctx.createImageData(width, steps + 1);
    /* Цвет пасты прямо числами: внутри теневого корня переменную из CSS в
       канву не передать, а разъезжаться с тетрадью нельзя. */
    const [r, g, b] = [0x1b, 0x3a, 0x6b];
    рядов.forEach((row, y) => {
      row.forEach((cell, x) => {
        const o = (y * width + x) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = cell ? 235 : 0;
      });
    });
    ctx.clearRect(0, 0, width, steps + 1);
    ctx.putImageData(img, 0, 0);
  }

  protected override render() {
    return html`<section class="telaio">
      <h4>${this.props.title ?? `Правило ${this.rule}`}</h4>
      <p class="suggerimento">
        ${ИЗВЕСТНЫЕ[this.rule] ??
        this.props.hint ??
        'Восемь бит правила решают всё. Время идёт сверху вниз, край замкнут в кольцо.'}
      </p>

      <canvas aria-label=${`Клеточный автомат, правило ${this.rule}`} role="img"></canvas>

      <div class="manopole">
        <div class="manopola">
          <label for="rule"><span>номер правила</span><i>${this.rule}</i></label>
          <input
            id="rule"
            type="range"
            min="0"
            max="255"
            step="1"
            .value=${String(this.rule)}
            @input=${(e: Event) => (this.rule = Number((e.target as HTMLInputElement).value))} />
        </div>
      </div>

      <div class="azioni">
        ${[30, 90, 110, 184].map(
          (r) => html`<button class="bottone" @click=${() => (this.rule = r)}>${r}</button>`,
        )}
      </div>
    </section>`;
  }
}

/* ── «Жизнь» ────────────────────────────────────────────────────────── */

interface VitaProps {
  readonly figure?: string;
  readonly width?: number;
  readonly height?: number;
  readonly title?: string;
  readonly hint?: string;
}

export class Vita extends Widget<VitaProps> {
  static override styles = [stile, stileTela];
  static override properties = { generation: { state: true }, running: { state: true } };
  declare generation: number;
  declare running: boolean;

  private grid!: Grid;
  private stop?: () => void;
  private canvas: HTMLCanvasElement | undefined;
  private lastFrame = 0;

  protected override avvia(): void {
    this.generation = 0;
    this.running = true;
    const w = this.props.width ?? 64;
    const h = this.props.height ?? 40;
    this.grid = setCells(
      createGrid(w, h),
      (FIGURES[this.props.figure ?? 'планёр'] ?? FIGURES.планёр!).map(
        ([x, y]) => [x + Math.floor(w / 2) - 2, y + Math.floor(h / 2) - 2] as const,
      ),
    );

    this.stop = this.loop(() => {
      if (!this.running) return;
      /* Восемь кадров на поколение: иначе «Жизнь» проносится так, что читатель
         не успевает увидеть ни одного перехода. */
      this.lastFrame += 1;
      if (this.lastFrame % 8) return;
      this.grid = lifeStep(this.grid);
      this.generation += 1;
    });
  }

  protected override ferma(): void {
    this.stop?.();
  }

  protected override updated(): void {
    this.disegna();
  }

  private disegna(): void {
    this.canvas ??= this.renderRoot.querySelector('canvas') ?? undefined;
    const canvas = this.canvas;
    if (!canvas) return;
    const { width, height } = this.grid;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(width, height);
    for (let i = 0; i < this.grid.cells.length; i += 1) {
      const o = i * 4;
      img.data[o] = 0x1b;
      img.data[o + 1] = 0x3a;
      img.data[o + 2] = 0x6b;
      img.data[o + 3] = this.grid.cells[i] ? 235 : 0;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(img, 0, 0);
  }

  /** Рисование пальцем: клетка ставится там, куда ткнули. */
  private tocca(event: PointerEvent): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * this.grid.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * this.grid.height);
    this.grid = setCells(this.grid, [[x, y]]);
    this.generation += 0; // перерисовать, не считая это поколением
    this.requestUpdate();
  }

  protected override render() {
    return html`<section class="telaio">
      <h4>${this.props.title ?? '«Жизнь»: правило известно целиком'}</h4>
      <p class="suggerimento">
        ${this.props.hint ??
        'Живая с двумя или тремя соседями выживает, мёртвая ровно с тремя оживает. Всё. Попробуйте предсказать, что будет через двадцать шагов.'}
      </p>

      <canvas
        role="img"
        aria-label="Поле «Жизни»"
        @pointerdown=${(e: PointerEvent) => this.tocca(e)}
        @pointermove=${(e: PointerEvent) => e.buttons && this.tocca(e)}></canvas>

      <div class="quadranti">
        <div class="quadrante"><b>поколение</b><span>${this.generation}</span></div>
        <div class="quadrante"><b>живых клеток</b><span>${population(this.grid)}</span></div>
      </div>

      <div class="azioni">
        <button class="bottone" @click=${() => (this.running = !this.running)}>
          ${this.running ? 'Пауза' : 'Дальше'}
        </button>
        ${Object.keys(FIGURES).map(
          (имя) => html`<button
            class="bottone"
            @click=${() => {
              const w = this.grid.width;
              const h = this.grid.height;
              this.grid = setCells(
                createGrid(w, h),
                FIGURES[имя]!.map(([x, y]) => [x + Math.floor(w / 2) - 2, y + Math.floor(h / 2) - 2] as const),
              );
              this.generation = 0;
            }}>
            ${имя}
          </button>`,
        )}
      </div>
    </section>`;
  }
}

customElements.define('cy-automa', Automa);
customElements.define('cy-vita', Vita);
