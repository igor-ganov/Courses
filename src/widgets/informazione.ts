/**
 * ИНФОРМАЦИЯ — два прибора.
 *
 * `<cy-entropia>` — стол с буквами: читатель двигает частоты и видит, как
 * меняются энтропия, избыточность и длины кодовых слов. Главное, что здесь
 * должно случиться: частому символу код становится короче не по договорённости,
 * а сам, из счёта.
 *
 * `<cy-canale>` — канал с шумом и код Хэмминга. Избыточность перестаёт быть
 * ругательством ровно в тот момент, когда читатель включает её и видит, что
 * сообщение доходит.
 */

import { css, html, stile, stileTraccia, Widget } from './base';
import {
  averageLength,
  bitsOf,
  channelCapacity,
  entropy,
  hammingDecode,
  hammingEncode,
  huffman,
  maxEntropy,
  noisyChannel,
  redundancy,
} from './models/informazione';

const stileTavola = css`
  .tavola {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    gap: 6px 14px;
    align-items: center;
    margin-bottom: 14px;
    font-variant-numeric: tabular-nums;
  }

  .tavola .lettera {
    font-family: 'Caveat', cursive;
    font-size: max(calc(22px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--паста, #1b3a6b);
  }

  .tavola .codice {
    font-family: 'PT Mono', monospace;
    font-size: max(calc(14px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--грифель, #5c6068);
  }

  .bit {
    display: inline-block;
    width: 1.1em;
    text-align: center;
    font-family: 'PT Mono', monospace;
  }

  .bit.rotto {
    color: var(--красный, #a8402f);
    font-weight: 700;
  }

  .bit.curato {
    color: var(--зелёный, #3f6b4a);
  }
`;

interface EntropiaProps {
  readonly symbols?: readonly { symbol: string; weight: number }[];
  readonly title?: string;
  readonly hint?: string;
}

const ПО_УМОЛЧАНИЮ = [
  { symbol: 'о', weight: 45 },
  { symbol: 'е', weight: 25 },
  { symbol: 'а', weight: 16 },
  { symbol: 'и', weight: 9 },
  { symbol: 'т', weight: 5 },
];

export class Entropia extends Widget<EntropiaProps> {
  static override styles = [stile, stileTavola];
  static override properties = { weights: { state: true } };
  declare weights: number[];

  private symbols: string[] = [];

  protected override avvia(): void {
    const набор = this.props.symbols ?? ПО_УМОЛЧАНИЮ;
    this.symbols = набор.map((s) => s.symbol);
    this.weights = набор.map((s) => s.weight);
  }

  protected override render() {
    const пары = this.symbols.map((symbol, i) => ({ symbol, weight: this.weights[i] ?? 0 }));
    const код = huffman(пары);
    const вероятности = код.map((c) => c.probability);
    const H = entropy(вероятности);
    const L = averageLength(код);
    const макс = maxEntropy(пары.filter((p) => p.weight > 0).length);

    return html`<section class="telaio">
      <h4>${this.props.title ?? 'Энтропия и код'}</h4>
      <p class="suggerimento">
        ${this.props.hint ??
        'Двигайте частоты. Чем ровнее распределение, тем больше энтропия и тем меньше можно сэкономить на коде.'}
      </p>

      <div class="tavola">
        ${пары.map(
          (p, i) => html`
            <span class="lettera">${p.symbol}</span>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              .value=${String(p.weight)}
              aria-label=${`частота «${p.symbol}»`}
              @input=${(e: Event) => {
                const next = [...this.weights];
                next[i] = Number((e.target as HTMLInputElement).value);
                this.weights = next;
              }} />
            <span class="codice">${(код.find((c) => c.symbol === p.symbol)?.probability ?? 0).toFixed(3)}</span>
            <span class="codice">${код.find((c) => c.symbol === p.symbol)?.code ?? '—'}</span>
          `,
        )}
      </div>

      <div class="quadranti">
        <div class="quadrante"><b>энтропия</b><span>${H.toFixed(3)} бит</span></div>
        <div class="quadrante"><b>максимум</b><span>${макс.toFixed(3)} бит</span></div>
        <div class="quadrante"><b>избыточность</b><span>${(redundancy(вероятности) * 100).toFixed(1)} %</span></div>
        <div class="quadrante"><b>средняя длина кода</b><span>${L.toFixed(3)} бит</span></div>
      </div>

      <p class="esito">
        ${L < H + 1
          ? `Код короче энтропии не бывает: ${H.toFixed(2)} ≤ ${L.toFixed(2)} < ${(H + 1).toFixed(2)}. Это теорема, а не совпадение.`
          : ''}
      </p>
    </section>`;
  }
}

/* ── канал ──────────────────────────────────────────────────────────── */

interface CanaleProps {
  readonly message?: string;
  readonly p?: number;
  readonly title?: string;
  readonly hint?: string;
}

export class Canale extends Widget<CanaleProps> {
  static override styles = [stile, stileTraccia, stileTavola];
  static override properties = {
    p: { state: true },
    hamming: { state: true },
    seed: { state: true },
  };
  declare p: number;
  declare hamming: boolean;
  declare seed: number;

  protected override avvia(): void {
    this.p = this.props.p ?? 0.08;
    this.hamming = false;
    this.seed = 1;
  }

  protected override render() {
    const текст = this.props.message ?? 'связь';
    const исходные = bitsOf(текст).slice(0, 32);

    /* Без кода биты идут как есть; с кодом каждая четвёрка превращается в
       семёрку, и та же вероятность ошибки перестаёт портить сообщение. */
    const блоки: number[][] = [];
    for (let i = 0; i < исходные.length; i += 4) блоки.push(исходные.slice(i, i + 4));

    const отправлено = this.hamming ? блоки.flatMap(hammingEncode) : исходные;
    const принято = noisyChannel(отправлено, this.p, this.seed);

    let восстановлено: number[];
    let исправлено = 0;
    if (this.hamming) {
      восстановлено = [];
      for (let i = 0; i < принято.length; i += 7) {
        const r = hammingDecode(принято.slice(i, i + 7));
        if (r.corrected) исправлено += 1;
        восстановлено.push(...r.data);
      }
      восстановлено = восстановлено.slice(0, исходные.length);
    } else {
      восстановлено = принято;
    }

    const битых = восстановлено.reduce((n, b, i) => n + (b === исходные[i] ? 0 : 1), 0);

    return html`<section class="telaio">
      <h4>${this.props.title ?? 'Канал с шумом'}</h4>
      <p class="suggerimento">
        ${this.props.hint ??
        'Поднимите шум, пока сообщение не развалится. Потом включите избыточность и посмотрите, что изменилось.'}
      </p>

      <p class="traccia">
        ${восстановлено.map(
          (b, i) =>
            html`<span class="bit ${b === исходные[i] ? '' : 'rotto'}">${b}</span>`,
        )}
      </p>

      <div class="quadranti">
        <div class="quadrante"><b>вероятность ошибки</b><span>${(this.p * 100).toFixed(1)} %</span></div>
        <div class="quadrante"><b>пропускная способность</b><span>${channelCapacity(this.p).toFixed(3)} бит/симв.</span></div>
        <div class="quadrante"><b>отправлено бит</b><span>${отправлено.length}</span></div>
        <div class="quadrante ${битых === 0 ? 'bene' : 'male'}"><b>испорчено</b><span>${битых}</span></div>
        ${this.hamming
          ? html`<div class="quadrante bene"><b>исправлено блоков</b><span>${исправлено}</span></div>`
          : null}
      </div>

      <div class="manopole">
        <div class="manopola">
          <label for="p"><span>шум канала</span><i>${(this.p * 100).toFixed(1)} %</i></label>
          <input
            id="p"
            type="range"
            min="0"
            max="0.5"
            step="0.005"
            .value=${String(this.p)}
            @input=${(e: Event) => (this.p = Number((e.target as HTMLInputElement).value))} />
        </div>
      </div>

      <div class="azioni">
        <button class="bottone" @click=${() => (this.hamming = !this.hamming)}>
          ${this.hamming ? 'Выключить избыточность' : 'Включить код Хэмминга'}
        </button>
        <button class="bottone" @click=${() => (this.seed += 1)}>Другой шум</button>
      </div>

      <p class="esito ${битых === 0 ? 'bene' : 'male'}">
        ${this.hamming
          ? `Семь бит вместо четырёх — и одна ошибка в блоке больше не портит сообщение. Испорчено: ${битых}.`
          : `Без избыточности любая перевёрнутая единица — потерянный бит. Испорчено: ${битых}.`}
      </p>
    </section>`;
  }
}

customElements.define('cy-entropia', Entropia);
customElements.define('cy-canale', Canale);
