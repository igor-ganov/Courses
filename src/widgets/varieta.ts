/**
 * РАЗНООБРАЗИЕ — два прибора на одну мысль.
 *
 * `<cy-varieta>` — игра Эшби. Сначала у читателя ход на каждую помеху, и он
 * побеждает всегда. Потом ход отнимают, и он перестаёт побеждать — не потому,
 * что стал играть хуже. Это единственный известный мне способ объяснить закон
 * необходимого разнообразия так, чтобы он остался.
 *
 * `<cy-scatola>` — чёрный ящик. Внутрь заглянуть нельзя; можно подавать вход и
 * смотреть выход, отсеивая гипотезы. Кибернетика вся про это: систему опознают,
 * тыкая в неё.
 */

import { html, stile, stileTraccia, Widget } from './base';
import {
  createBlackBox,
  createVarietyGame,
  residualVariety,
  variety,
  type BlackBox,
  type Machine,
  type VarietyGame,
  type VarietyTable,
} from './models/varieta';

const ТАБЛИЦА: VarietyTable = {
  disturbances: ['мороз', 'зной', 'сквозняк', 'сырость'],
  moves: ['греть', 'студить', 'закрыть', 'сушить'],
  outcomes: [
    [0, 2, 1, 1],
    [2, 0, 1, 1],
    [1, 1, 0, 1],
    [1, 1, 1, 0],
  ],
};

interface GiocoProps {
  readonly moves?: number;
  readonly target?: number;
  readonly title?: string;
  readonly hint?: string;
}

export class Varieta extends Widget<GiocoProps> {
  static override properties = { tick: { state: true }, moves: { state: true } };
  declare tick: number;
  declare moves: number;

  private game!: VarietyGame;
  private reported = false;
  private ultimo = '';

  protected override avvia(): void {
    this.tick = 0;
    this.moves = this.props.moves ?? ТАБЛИЦА.moves.length;
    this.nuovo();
  }

  private table(): VarietyTable {
    /* Урезаем набор ходов, оставляя помехи: ровно так закон и проверяется. */
    return {
      disturbances: ТАБЛИЦА.disturbances,
      moves: ТАБЛИЦА.moves.slice(0, this.moves),
      outcomes: ТАБЛИЦА.outcomes.map((row) => row.slice(0, this.moves)),
    };
  }

  private nuovo(): void {
    this.reported = false;
    this.ultimo = '';
    this.game = createVarietyGame(this.table(), {
      seed: 20260909,
      target: this.props.target ?? 8,
    });
    this.tick += 1;
  }

  private gioca(move: number): void {
    const round = this.game.play(move);
    this.ultimo = round.ok
      ? 'Удержано.'
      : `Не отработано: на «${ТАБЛИЦА.disturbances[round.disturbance]}» нужного хода нет.`;
    this.tick += 1;
    const g = this.game.goal();
    if (g.reached && !this.reported) {
      this.reported = true;
      this.riporta(g);
    }
  }

  protected override render() {
    const t = this.table();
    const счёт = this.game.score();
    const помеха = this.game.current();
    const нехватка = residualVariety(t.disturbances.length, t.moves.length);

    return html`<section class="telaio">
      <h4>${this.props.title ?? 'Игра Эшби: разнообразие против разнообразия'}</h4>
      <p class="suggerimento">
        ${this.props.hint ??
        'Среда бросает помеху — отвечайте ходом. Потом уберите себе один ход и попробуйте снова.'}
      </p>

      <div class="quadranti">
        <div class="quadrante"><b>помеха</b><span>${t.disturbances[помеха]}</span></div>
        <div class="quadrante ${счёт.held === счёт.total ? 'bene' : 'male'}">
          <b>удержано</b><span>${счёт.held} из ${счёт.total}</span>
        </div>
        <div class="quadrante"><b>разнообразие среды</b><span>${variety(t.disturbances.length).toFixed(2)} бит</span></div>
        <div class="quadrante ${нехватка > 0 ? 'male' : 'bene'}">
          <b>не хватает</b><span>${нехватка.toFixed(2)} бит</span>
        </div>
      </div>

      <div class="azioni">
        ${t.moves.map(
          (m, i) => html`<button class="bottone" @click=${() => this.gioca(i)}>${m}</button>`,
        )}
      </div>

      <div class="azioni">
        <button
          class="bottone"
          ?disabled=${this.moves <= 1}
          @click=${() => {
            this.moves -= 1;
            this.nuovo();
          }}>
          Отнять ход
        </button>
        <button
          class="bottone"
          ?disabled=${this.moves >= ТАБЛИЦА.moves.length}
          @click=${() => {
            this.moves += 1;
            this.nuovo();
          }}>
          Вернуть ход
        </button>
        <button class="bottone" @click=${() => this.nuovo()}>Сначала</button>
      </div>

      <p class="esito ${this.ultimo.startsWith('Удержано') ? 'bene' : this.ultimo ? 'male' : ''}">
        ${this.ultimo ||
        (нехватка > 0
          ? 'Ходов меньше, чем помех: часть помех отработать нечем, как ни играй.'
          : 'Ход есть на каждую помеху — идеальная игра выигрывает всегда.')}
      </p>
    </section>`;
  }
}

/* ── чёрный ящик ────────────────────────────────────────────────────── */

const МАШИНЫ: Machine[] = [
  {
    name: 'триггер',
    states: 2,
    next: [
      [0, 1],
      [1, 0],
    ],
    out: [
      ['тихо', 'тихо'],
      ['звон', 'звон'],
    ],
  },
  {
    name: 'эхо',
    states: 1,
    next: [[0, 0]],
    out: [['тихо', 'звон']],
  },
  {
    name: 'счётчик до двух',
    states: 3,
    next: [
      [0, 1],
      [1, 2],
      [2, 0],
    ],
    out: [
      ['тихо', 'тихо'],
      ['тихо', 'тихо'],
      ['звон', 'звон'],
    ],
  },
  {
    name: 'молчун',
    states: 1,
    next: [[0, 0]],
    out: [['тихо', 'тихо']],
  },
];

interface ScatolaProps {
  readonly hidden?: string;
  readonly title?: string;
  readonly hint?: string;
}

export class Scatola extends Widget<ScatolaProps> {
  static override styles = [stile, stileTraccia];
  static override properties = { tick: { state: true } };
  declare tick: number;

  private box!: BlackBox;
  private reported = false;

  protected override avvia(): void {
    this.tick = 0;
    const скрытая = МАШИНЫ.find((m) => m.name === this.props.hidden) ?? МАШИНЫ[0]!;
    this.box = createBlackBox(скрытая);
  }

  private send(input: number): void {
    this.box.send(input);
    this.tick += 1;
    const g = this.box.goal(МАШИНЫ);
    if (g.reached && !this.reported) {
      this.reported = true;
      this.riporta(g);
    }
  }

  protected override render() {
    const след = this.box.trace();
    const живы = this.box.survivors(МАШИНЫ);

    return html`<section class="telaio">
      <h4>${this.props.title ?? 'Чёрный ящик'}</h4>
      <p class="suggerimento">
        ${this.props.hint ??
        'Внутрь заглянуть нельзя. Подавайте вход, смотрите выход и отсеивайте гипотезы — пока не останется одна.'}
      </p>

      <div class="quadranti">
        <div class="quadrante"><b>подано</b><span>${след.length}</span></div>
        <div class="quadrante ${живы.length === 1 ? 'bene' : ''}">
          <b>гипотез осталось</b><span>${живы.length} из ${МАШИНЫ.length}</span>
        </div>
      </div>

      <p class="traccia">
        ${след.length === 0
          ? html`<span class="tacito">Ящик молчит, пока в него не ткнут.</span>`
          : след.map(
              (s) => html`<span class="passo">${s.input ? '1' : '0'}&nbsp;→&nbsp;${s.output}</span>`,
            )}
      </p>

      <div class="azioni">
        <button class="bottone" @click=${() => this.send(0)}>Подать 0</button>
        <button class="bottone" @click=${() => this.send(1)}>Подать 1</button>
        <button
          class="bottone"
          @click=${() => {
            this.box.reset();
            this.reported = false;
            this.tick += 1;
          }}>
          Сначала
        </button>
      </div>

      <ul class="ipotesi">
        ${МАШИНЫ.map(
          (m) => html`<li class=${живы.includes(m) ? '' : 'fuori'}>${m.name}</li>`,
        )}
      </ul>

      <p class="esito ${живы.length === 1 ? 'bene' : ''}">
        ${живы.length === 1
          ? `Осталась одна: «${живы[0]!.name}». Заметьте — ящик так и не открыли.`
          : 'Ищите вход, на котором гипотезы расходятся. Тот, на котором они ведут себя одинаково, ничего не сообщает.'}
      </p>
    </section>`;
  }
}

customElements.define('cy-varieta', Varieta);
customElements.define('cy-scatola', Scatola);
