/**
 * ЛАБОРАТОРИЯ КОНТУРА — ручки, график и живой объект.
 *
 * Читатель крутит усиление и видит, что происходит. Всё, что он видит, считает
 * модель из `models/contorno`, проверенная тестами: здесь только рисование и
 * ручки. Разделение не ради красоты — иначе физику пришлось бы проверять
 * через экран, а через экран её никто не проверяет.
 */

import { html, svg, Widget } from './base';
import { createLoop, type Loop, type LoopSettings } from './models/contorno';

interface Props {
  readonly setpoint?: number;
  readonly ambient?: number;
  readonly delay?: number;
  readonly noise?: number;
  readonly kp?: number;
  readonly ki?: number;
  readonly kd?: number;
  readonly goal?: { tolerance: number; hold: number };
  readonly title?: string;
  readonly hint?: string;
}

const W = 620;
const H = 200;

export class Contorno extends Widget<Props> {
  static override properties = {
    kp: { state: true },
    ki: { state: true },
    kd: { state: true },
    delay: { state: true },
    noise: { state: true },
    running: { state: true },
    tick: { state: true },
  };

  declare kp: number;
  declare ki: number;
  declare kd: number;
  declare delay: number;
  declare noise: number;
  declare running: boolean;
  declare tick: number;

  private loopModel!: Loop;
  private stop?: () => void;
  private reported = false;
  /** Лучшая доля, о которой уже донесли: чтобы не доносить каждый кадр. */
  private riferito = 0;

  protected override avvia(): void {
    const p = this.props;
    this.kp = p.kp ?? 3;
    this.ki = p.ki ?? 0;
    this.kd = p.kd ?? 0;
    this.delay = p.delay ?? 0;
    this.noise = p.noise ?? 0;
    this.running = true;
    this.tick = 0;

    const settings: LoopSettings = {
      setpoint: p.setpoint ?? 21,
      ambient: p.ambient ?? 5,
      gain: 1.6,
      tau: 12,
      delay: this.delay,
      kp: this.kp,
      ki: this.ki,
      kd: this.kd,
      uMin: 0,
      uMax: 100,
      noise: this.noise,
      seed: 20260909,
      dt: 0.25,
    };
    this.loopModel = createLoop(settings, this.props.goal);

    this.stop = this.loop(() => {
      if (!this.running) return;
      /* Четыре шага на кадр: модель идёт с шагом 0,25 с, и так за секунду
         реального времени проходит примерно минута процесса — иначе читатель
         не дожидается ни перерегулирования, ни установления. */
      for (let i = 0; i < 4; i += 1) this.loopModel.step();
      this.tick += 1;
      if (this.props.goal && !this.reported) {
        const g = this.loopModel.goal();
        /* Доносится не только успех, но и продвижение — заметными шагами.
           Иначе задание с целью становится тупиком: пока цель не взята,
           вопрос рядом не знает вообще ничего и не может ни показать,
           насколько читатель близок, ни зачесть попытку. Шаг в двадцатую
           долю выбран так, чтобы донесений было десятка два за попытку,
           а не по одному на кадр. */
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

  private set(key: 'kp' | 'ki' | 'kd' | 'delay' | 'noise', value: number): void {
    this[key] = value;
    this.loopModel.set({ [key]: value });
  }

  private reset(): void {
    this.reported = false;
    this.riferito = 0;
    this.loopModel.reset();
    this.tick += 1;
  }

  /** График: истина сплошной, задание пунктиром, воздействие снизу. */
  private grafico() {
    const log = this.loopModel.history();
    if (log.length < 2) return html``;
    const сколько = Math.min(log.length, 900);
    const срез = log.slice(-сколько);
    const set = this.loopModel.settings();

    let min = set.ambient;
    let max = set.setpoint;
    for (const s of срез) {
      min = Math.min(min, s.output);
      max = Math.max(max, s.output);
    }
    const запас = Math.max(1, (max - min) * 0.15);
    min -= запас;
    max += запас;

    const x = (i: number) => (i / (сколько - 1)) * W;
    const y = (v: number) => H - ((v - min) / (max - min)) * H;

    const путь = срез.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.output).toFixed(1)}`).join('');
    const воздействие = срез
      .map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${(H - (s.control / 100) * 26).toFixed(1)}`)
      .join('');
    const задание = y(set.setpoint).toFixed(1);
    const допуск = this.props.goal
      ? svg`<rect
          x="0"
          y=${y(set.setpoint + this.props.goal.tolerance).toFixed(1)}
          width=${W}
          height=${Math.abs(y(set.setpoint - this.props.goal.tolerance) - y(set.setpoint + this.props.goal.tolerance)).toFixed(1)}
          fill="var(--зелёный, #3f6b4a)"
          opacity="0.08" />`
      : null;

    return html`<svg
      class="tela"
      viewBox="0 0 ${W} ${H}"
      preserveAspectRatio="none"
      role="img"
      aria-label="График температуры и воздействия во времени">
      ${допуск}
      <line x1="0" y1=${задание} x2=${W} y2=${задание} stroke="var(--поле, #d98b8b)" stroke-width="1.2" stroke-dasharray="6 5" />
      <path d=${воздействие} fill="none" stroke="var(--грифель, #5c6068)" stroke-width="1" opacity="0.45" />
      <path d=${путь} fill="none" stroke="var(--паста, #1b3a6b)" stroke-width="1.8" stroke-linejoin="round" />
    </svg>`;
  }

  protected override render() {
    const s = this.loopModel.state();
    const set = this.loopModel.settings();
    const ошибка = set.setpoint - s.output;
    const близко = Math.abs(ошибка) < 0.4;
    const цель = this.props.goal ? this.loopModel.goal() : undefined;

    return html`<section class="telaio">
      <h4>${this.props.title ?? 'Контур регулирования'}</h4>
      <p class="suggerimento">
        ${this.props.hint ??
        'Крутите усиление. Одного пропорционального мало: остаётся статическая ошибка. Добавьте интеграл — и посмотрите, что сделает запаздывание.'}
      </p>

      ${this.grafico()}

      <div class="quadranti">
        <div class="quadrante"><b>температура</b><span>${s.output.toFixed(2)} °</span></div>
        <div class="quadrante ${близко ? 'bene' : 'male'}"><b>ошибка</b><span>${ошибка.toFixed(2)} °</span></div>
        <div class="quadrante"><b>воздействие</b><span>${s.control.toFixed(0)} %</span></div>
        <div class="quadrante"><b>время</b><span>${s.time.toFixed(0)} с</span></div>
        ${цель
          ? html`<div class="quadrante ${цель.reached ? 'bene' : ''}">
              <b>удержано</b><span>${(цель.score * 100).toFixed(0)} %</span>
            </div>`
          : null}
      </div>

      <div class="manopole">
        ${this.manopola('усиление P', 'kp', 0, 30, 0.1)}
        ${this.manopola('интеграл I', 'ki', 0, 3, 0.02)}
        ${this.manopola('производная D', 'kd', 0, 30, 0.5)}
        ${this.manopola('запаздывание', 'delay', 0, 15, 0.5, ' с')}
        ${this.manopola('шум датчика', 'noise', 0, 1.5, 0.05, ' °')}
      </div>

      <div class="azioni">
        <button class="bottone" @click=${() => (this.running = !this.running)}>
          ${this.running ? 'Пауза' : 'Дальше'}
        </button>
        <button class="bottone" @click=${() => this.reset()}>Сначала</button>
      </div>

      ${цель
        ? html`<p class="esito ${цель.reached ? 'bene' : ''}">
            ${цель.reached
              ? 'Удержано. Обратите внимание, какой ценой: посмотрите на воздействие.'
              : `Цель: удержать ${this.props.goal!.tolerance} ° в течение ${this.props.goal!.hold} с.`}
          </p>`
        : null}
    </section>`;
  }

  private manopola(
    label: string,
    key: 'kp' | 'ki' | 'kd' | 'delay' | 'noise',
    min: number,
    max: number,
    step: number,
    unit = '',
  ) {
    const value = this[key];
    return html`<div class="manopola">
      <label for=${`m-${key}`}><span>${label}</span><i>${value.toFixed(step < 0.1 ? 2 : 1)}${unit}</i></label>
      <input
        id=${`m-${key}`}
        type="range"
        min=${min}
        max=${max}
        step=${step}
        .value=${String(value)}
        @input=${(e: Event) => this.set(key, Number((e.target as HTMLInputElement).value))} />
    </div>`;
  }
}

customElements.define('cy-contorno', Contorno);
