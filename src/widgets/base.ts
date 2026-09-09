/**
 * ОСНОВА ВИДЖЕТА.
 *
 * Виджет — элемент с теневым корнем, и вот здесь инкапсуляция как раз к месту:
 * у прибора своя вёрстка, и она не должна ни ломаться от стилей лекции, ни
 * ломать их. Но тетрадь одна на всё, поэтому цвета, шрифты и шаг клетки
 * приходят внутрь переменными — они проходят сквозь теневой корень, и прибор
 * остаётся частью того же листа.
 *
 * Свойства приезжают атрибутом `data-props`: разметку страницы печатает сборка,
 * а виджет читает её при подключении. Так лекция без виджетов не платит за них
 * ни байта, а виджет не зависит от того, как именно его поставили.
 *
 * Цель задания виджет сообщает событием `cy-goal`. Кто его слушает — дело
 * страницы: движок оценки принимает ровно такой отчёт, а лекция без задания
 * просто не слушает.
 */

import { LitElement, css, html, type PropertyValues, type TemplateResult } from 'lit';

export interface GoalReport {
  readonly goal: string;
  readonly reached: boolean;
  readonly score?: number;
}

/** Общий стиль приборов: обводка одним штрихом, ручки, приборные числа. */
export const stile = css`
  :host {
    display: block;
    margin: 0 0 var(--шаг, 26px);
    font-family: 'Literata', Georgia, serif;
    font-size: max(calc(16.5px * var(--кегль, 1)), var(--пол, 0px));
    line-height: var(--шаг, 26px);
    color: var(--текст, #20242c);
  }

  .telaio {
    position: relative;
    padding: 20px 22px 18px;
    background: color-mix(in srgb, var(--бумага, #fffdf6) 62%, transparent);
  }

  .telaio::before {
    content: '';
    position: absolute;
    inset: -6px -8px;
    pointer-events: none;
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200' preserveAspectRatio='none'><path d='M14,10 C90,5 210,7 288,11 C295,12 296,20 296,34 C297,90 296,150 295,178 C294,188 286,190 274,190 C190,193 90,191 22,190 C11,189 7,182 7,170 C5,120 6,50 7,26 C7,16 11,12 22,11' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round' opacity='.55'/></svg>")
      no-repeat center / 100% 100%;
  }

  h4 {
    font-family: 'Caveat', cursive;
    font-weight: 700;
    font-size: max(calc(23px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--паста, #1b3a6b);
    margin: 0 0 2px;
    line-height: 1.1;
  }

  .suggerimento {
    font-family: 'Caveat', cursive;
    font-size: max(calc(18px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--тихий, #6f7682);
    margin: 0 0 14px;
    line-height: 1.2;
  }

  .quadranti {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 26px;
    margin: 0 0 14px;
  }

  .quadrante b {
    display: block;
    font-family: 'Caveat', cursive;
    font-weight: 500;
    font-size: max(calc(17px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--тихий, #6f7682);
    line-height: 1.1;
  }

  .quadrante span {
    font-variant-numeric: tabular-nums;
  }

  .quadrante.male span {
    color: var(--красный, #a8402f);
  }

  .quadrante.bene span {
    color: var(--зелёный, #3f6b4a);
  }

  .manopole {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  }

  .manopola {
    display: grid;
    gap: 3px;
  }

  .manopola label {
    font-family: 'Caveat', cursive;
    font-size: max(calc(18px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--грифель, #5c6068);
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .manopola label i {
    font-style: normal;
    font-family: 'Literata', serif;
    font-size: max(calc(15px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--паста, #1b3a6b);
    font-variant-numeric: tabular-nums;
  }

  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 18px;
    background: none;
    cursor: grab;
  }

  input[type='range']::-webkit-slider-runnable-track {
    height: 3px;
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='3' preserveAspectRatio='none'><path d='M1,2 C60,1 140,2.2 199,1.2' fill='none' stroke='%235c6068' stroke-width='1.2' stroke-linecap='round'/></svg>")
      no-repeat center / 100% 100%;
  }

  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -7px;
    border: 0;
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M8,1.6 C11.6,1.4 14.4,4.4 14.4,8 C14.4,11.7 11.5,14.5 8,14.4 C4.5,14.3 1.7,11.5 1.7,8 C1.7,4.6 4.3,1.9 7.4,1.7' fill='%23fffdf6' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
      no-repeat center;
  }

  input[type='range']::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: 0;
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M8,1.6 C11.6,1.4 14.4,4.4 14.4,8 C14.4,11.7 11.5,14.5 8,14.4 C4.5,14.3 1.7,11.5 1.7,8 C1.7,4.6 4.3,1.9 7.4,1.7' fill='%23fffdf6' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
      no-repeat center;
  }

  .bottone {
    position: relative;
    border: 0;
    background: none;
    cursor: pointer;
    font-family: 'Caveat', cursive;
    font-size: max(calc(20px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--паста, #1b3a6b);
    padding: 7px 18px;
    min-height: 40px;
  }

  .bottone::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='46' preserveAspectRatio='none'><path d='M18,4 C62,1.5 118,3 145,6 C153,7 155,14 154,23 C153,33 152,39 145,41 C112,44 48,43 17,41 C8,40.5 5,34 5.5,24 C6,14 8,7 16,5' fill='none' stroke='%231b3a6b' stroke-width='1.6' stroke-linecap='round'/></svg>")
      no-repeat center / 100% 100%;
  }

  .bottone[disabled] {
    opacity: 0.45;
    cursor: default;
  }

  .azioni {
    display: flex;
    gap: 14px;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 14px;
  }

  canvas,
  svg.tela {
    display: block;
    width: 100%;
    height: auto;
    margin-bottom: 12px;
    touch-action: pan-y;
  }

  .esito {
    font-family: 'Caveat', cursive;
    font-size: max(calc(19px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--грифель, #5c6068);
    margin: 10px 0 0;
    min-height: 1.3em;
  }

  .esito.bene {
    color: var(--зелёный, #3f6b4a);
  }

  .esito.male {
    color: var(--красный, #a8402f);
  }

  :focus-visible {
    outline: 2px solid var(--паста, #1b3a6b);
    outline-offset: 3px;
  }
`;

export abstract class Widget<P = Record<string, unknown>> extends LitElement {
  static override styles = [stile];

  /** Свойства из `data-props`. Читаются один раз при подключении. */
  protected props: P = {} as P;

  override connectedCallback(): void {
    super.connectedCallback();
    const raw = this.getAttribute('data-props');
    if (raw) {
      try {
        this.props = JSON.parse(raw) as P;
      } catch {
        /* Испорченный атрибут не должен ронять лекцию: прибор просто выйдет
           со значениями по умолчанию. */
      }
    }
    this.avvia();
  }

  override disconnectedCallback(): void {
    this.ferma();
    super.disconnectedCallback();
  }

  /** Завести прибор. Здесь создаются модели и запускаются часы. */
  protected avvia(): void {}

  /** Остановить. Обязательно: иначе кадры продолжают идти после ухода. */
  protected ferma(): void {}

  /** Сообщить о цели задания. Слушает страница, если задание есть. */
  protected riporta(report: GoalReport): void {
    this.dispatchEvent(
      new CustomEvent<GoalReport>('cy-goal', { detail: report, bubbles: true, composed: true }),
    );
  }

  protected abstract override render(): TemplateResult;

  /** Кадры: заводятся при появлении на экране и гаснут при уходе. */
  protected loop(step: () => void): () => void {
    let id = 0;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      step();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
  }
}

export { html, css };

/** Мелочи, общие для приборов с гипотезами и следами. */
export const stileTraccia = css`
  .traccia {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    margin: 0 0 12px;
    font-variant-numeric: tabular-nums;
  }

  .passo {
    font-family: 'PT Mono', monospace;
    font-size: max(calc(14px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--паста, #1b3a6b);
    white-space: nowrap;
  }

  .tacito {
    color: var(--тихий, #6f7682);
    font-family: 'Caveat', cursive;
    font-size: max(calc(18px * var(--кегль, 1)), var(--пол, 0px));
  }

  .ipotesi {
    list-style: none;
    padding: 0;
    margin: 14px 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    font-family: 'Caveat', cursive;
    font-size: max(calc(19px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--паста, #1b3a6b);
  }

  /* Отброшенная гипотеза не исчезает, а зачёркивается: видно, что отсеяно. */
  .ipotesi .fuori {
    color: var(--тихий, #6f7682);
    text-decoration: line-through;
    text-decoration-thickness: 1px;
    opacity: 0.65;
  }
`;
