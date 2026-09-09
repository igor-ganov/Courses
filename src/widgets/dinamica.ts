/**
 * ДИНАМИКА — два прибора про предел предсказания.
 *
 * `<cy-logistica>` — диаграмма бифуркаций с движком по r. Читатель видит, как
 * покой сменяется двумя состояниями, четырьмя, хаосом, и как внутри хаоса
 * открывается окно периода три. Одна строчка кода, и такое поведение.
 *
 * `<cy-lorenz>` — аттрактор в объёме, который можно повернуть пальцем. Рядом
 * идёт вторая точка, отличающаяся на миллиардную долю: сначала они неразличимы,
 * потом расходятся. Это и есть горизонт предсказания, и его надо видеть, а не
 * читать про него.
 *
 * Объём здесь считается вручную — поворот, перспектива и сортировка по глубине
 * умещаются в тридцать строк. Тащить ради одного прибора трёхмерную библиотеку
 * в офлайн-первое приложение значило бы добавить полмегабайта в кэш ради того,
 * что и так рисуется.
 */

import { css, html, stile, Widget } from './base';
import {
  LORENZ,
  attractorAt,
  distance,
  lorenzStep,
  lorenzTrail,
  lyapunov,
  period,
  type LorenzPoint,
} from './models/dinamica';

const stileTela = css`
  canvas {
    width: 100%;
    height: auto;
    touch-action: none;
    background: color-mix(in srgb, var(--бумага, #fffdf6) 70%, transparent);
  }
`;

/* ── логистическое отображение ──────────────────────────────────────── */

interface LogisticaProps {
  readonly r?: number;
  readonly title?: string;
  readonly hint?: string;
}

export class Logistica extends Widget<LogisticaProps> {
  static override styles = [stile, stileTela];
  static override properties = { r: { state: true } };
  declare r: number;

  private canvas: HTMLCanvasElement | undefined;
  /** Диаграмма не зависит от ручки, поэтому рисуется один раз. */
  private нарисована = false;

  protected override avvia(): void {
    this.r = this.props.r ?? 3.2;
  }

  protected override updated(): void {
    this.disegna();
  }

  private disegna(): void {
    this.canvas ??= this.renderRoot.querySelector('canvas') ?? undefined;
    const canvas = this.canvas;
    if (!canvas) return;
    const W = 620;
    const H = 260;
    if (!this.нарисована) {
      canvas.width = W;
      canvas.height = H;
      this.нарисована = true;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(27,58,107,0.5)';
    for (let px = 0; px < W; px += 1) {
      const r = 2.4 + (px / W) * (4 - 2.4);
      for (const x of attractorAt(r, { warmup: 300, samples: 90 })) {
        ctx.fillRect(px, H - x * H, 1, 1);
      }
    }

    /* Отметка текущего r — красная линия поля тетради. */
    const px = ((this.r - 2.4) / (4 - 2.4)) * W;
    ctx.strokeStyle = '#d98b8b';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, H);
    ctx.stroke();
  }

  protected override render() {
    const точки = attractorAt(this.r);
    const п = period(точки);
    const λ = lyapunov(this.r);

    return html`<section class="telaio">
      <h4>${this.props.title ?? 'Удвоения периода и хаос'}</h4>
      <p class="suggerimento">
        ${this.props.hint ??
        'x → r·x·(1−x). Одна строчка. Ведите r вправо и смотрите, где кончается предсказуемость.'}
      </p>

      <canvas role="img" aria-label="Диаграмма бифуркаций логистического отображения"></canvas>

      <div class="quadranti">
        <div class="quadrante"><b>r</b><span>${this.r.toFixed(4)}</span></div>
        <div class="quadrante"><b>период</b><span>${п === Infinity ? 'нет' : п}</span></div>
        <div class="quadrante ${λ > 0 ? 'male' : 'bene'}">
          <b>показатель Ляпунова</b><span>${λ.toFixed(3)}</span>
        </div>
      </div>

      <div class="manopole">
        <div class="manopola">
          <label for="r"><span>параметр r</span><i>${this.r.toFixed(4)}</i></label>
          <input
            id="r"
            type="range"
            min="2.4"
            max="4"
            step="0.0005"
            .value=${String(this.r)}
            @input=${(e: Event) => (this.r = Number((e.target as HTMLInputElement).value))} />
        </div>
      </div>

      <div class="azioni">
        <button class="bottone" @click=${() => (this.r = 2.8)}>покой</button>
        <button class="bottone" @click=${() => (this.r = 3.2)}>период 2</button>
        <button class="bottone" @click=${() => (this.r = 3.5)}>период 4</button>
        <button class="bottone" @click=${() => (this.r = 3.83)}>окно 3</button>
        <button class="bottone" @click=${() => (this.r = 3.9)}>хаос</button>
      </div>

      <p class="esito ${λ > 0 ? 'male' : ''}">
        ${λ > 0
          ? 'Соседние траектории расходятся: сколько ни уточняй начальное значение, горизонт предсказания конечен.'
          : 'Траектории сходятся: система забывает начальное состояние и приходит к одному и тому же.'}
      </p>
    </section>`;
  }
}

/* ── Лоренц ─────────────────────────────────────────────────────────── */

/** Сколько точек живого следа. Примерно пятнадцать секунд процесса. */
const СЛЕД = 3000;
/** Сколько точек у фона. Хватает, чтобы обе доли прорисовались плотно. */
const ФОН = 9000;

interface LorenzProps {
  readonly rho?: number;
  readonly title?: string;
  readonly hint?: string;
}

export class Lorenz extends Widget<LorenzProps> {
  static override styles = [stile, stileTela];
  static override properties = {
    rho: { state: true },
    running: { state: true },
    spread: { state: true },
  };
  declare rho: number;
  declare running: boolean;
  declare spread: number;

  private canvas: HTMLCanvasElement | undefined;
  private stop?: () => void;
  private a: LorenzPoint = { x: 1, y: 1, z: 1 };
  private b: LorenzPoint = { x: 1 + 1e-9, y: 1, z: 1 };
  private trailA: LorenzPoint[] = [];
  private trailB: LorenzPoint[] = [];
  /**
   * Само множество — бледной нитью под живыми следами.
   *
   * Без него прибор показывает короткий обрывок кривой: две точки успевают
   * пройти секунд за десять едва один виток, и никакой «бабочки» читатель не
   * видит — он видит закорючку и вынужден верить на слово. Между тем весь
   * смысл витка в том, что у хаоса ЕСТЬ структура: траектория непредсказуема,
   * а множество, по которому она гуляет, устойчиво. Значит, структуру надо
   * показать сразу, а не через двадцать пять секунд ожидания.
   *
   * Считается один раз при заходе и при смене ρ, из другого начального
   * условия и с отброшенным разгоном: подмешивать его к живым следам нельзя —
   * они как раз про то, как расходятся две близкие точки.
   */
  private sfondo: LorenzPoint[] = [];
  /** Центр по вертикали и мера размера — отсюда берётся масштаб. */
  private centro = 25;
  private raggioXY = 21;
  private altezza = 25;
  /* Начальный вид — почти классический разрез xz, в котором «бабочка» и
     узнаётся: при нулевом повороте взгляд идёт вдоль оси y. Небольшой угол
     и наклон оставлены нарочно, чтобы с первого кадра было видно, что фигура
     объёмная и её можно повернуть. */
  private angle = 0.3;
  private tilt = 0.1;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  protected override avvia(): void {
    this.rho = this.props.rho ?? LORENZ.rho;
    this.running = true;
    this.spread = 0;
    this.misura();
    this.stop = this.loop(() => {
      if (this.running) {
        const k = { ...LORENZ, rho: this.rho };
        for (let i = 0; i < 8; i += 1) {
          this.a = lorenzStep(this.a, 0.005, k);
          this.b = lorenzStep(this.b, 0.005, k);
          this.trailA.push(this.a);
          this.trailB.push(this.b);
        }
        if (this.trailA.length > СЛЕД) {
          this.trailA.splice(0, this.trailA.length - СЛЕД);
          this.trailB.splice(0, this.trailB.length - СЛЕД);
        }
        this.spread = distance(this.a, this.b);
      }
      this.disegna();
    });
  }

  /**
   * Пересчитать фон и заодно измерить фигуру.
   *
   * Масштаб берётся из размеров самой фигуры, а не подобран числом: при ρ = 10
   * аттрактор вырождается в точку, при ρ = 60 он вдвое выше, и постоянный
   * множитель означал бы, что на одном конце движка смотреть не на что, а на
   * другом фигура не помещается.
   */
  private misura(): void {
    const k = { ...LORENZ, rho: this.rho };
    /* Разгон отбрасывается: первые витки идут от произвольной точки к
       множеству и к нему не принадлежат. */
    let p: LorenzPoint = { x: -8, y: 7, z: 27 };
    for (let i = 0; i < 2000; i += 1) p = lorenzStep(p, 0.006, k);
    this.sfondo = lorenzTrail(p, ФОН, 0.006, k);

    let zmin = Infinity;
    let zmax = -Infinity;
    let rxy = 1e-3;
    for (const т of this.sfondo) {
      if (т.z < zmin) zmin = т.z;
      if (т.z > zmax) zmax = т.z;
      rxy = Math.max(rxy, Math.hypot(т.x, т.y));
    }
    this.centro = (zmin + zmax) / 2;
    this.altezza = Math.max((zmax - zmin) / 2, 1e-3);
    this.raggioXY = rxy;
  }

  protected override ferma(): void {
    this.stop?.();
  }

  /** Поворот вокруг вертикали, наклон, слабая перспектива. */
  private project(p: LorenzPoint, W: number, H: number): [number, number, number] {
    const x = p.x;
    const y = p.y;
    const z = p.z - this.centro;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    const ct = Math.cos(this.tilt);
    const st = Math.sin(this.tilt);
    const depth = ry * ct - z * st;
    const up = ry * st + z * ct;
    const k = 320 / (320 + depth);
    /* По горизонтали фигуру разворачивает поворот, поэтому мерой служит
       радиус в плоскости xy, а не размах по одной оси. */
    const м = Math.min((0.44 * W) / this.raggioXY, (0.44 * H) / this.altezza);
    return [W / 2 + rx * м * k, H / 2 - up * м * k, depth];
  }

  private disegna(): void {
    this.canvas ??= this.renderRoot.querySelector('canvas') ?? undefined;
    const canvas = this.canvas;
    if (!canvas) return;
    const W = 460;
    const H = 380;
    if (canvas.width !== W) {
      canvas.width = W;
      canvas.height = H;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    const линия = (trail: LorenzPoint[], colour: string, width: number) => {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      trail.forEach((p, i) => {
        const [x, y] = this.project(p, W, H);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    /* Множество — под следами и почти незаметно: оно фон, а не предмет. */
    линия(this.sfondo, 'rgba(92,96,104,0.16)', 0.8);
    линия(this.trailA, 'rgba(27,58,107,0.75)', 1.2);
    линия(this.trailB, 'rgba(168,64,47,0.75)', 1.2);

    for (const [p, colour] of [
      [this.a, '#1b3a6b'],
      [this.b, '#a8402f'],
    ] as const) {
      const [x, y] = this.project(p, W, H);
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private ruota(event: PointerEvent): void {
    if (!this.dragging) return;
    this.angle += (event.clientX - this.lastX) * 0.01;
    this.tilt = Math.max(-1.4, Math.min(1.4, this.tilt + (event.clientY - this.lastY) * 0.01));
    this.lastX = event.clientX;
    this.lastY = event.clientY;
  }

  protected override render() {
    return html`<section class="telaio">
      <h4>${this.props.title ?? 'Аттрактор Лоренца: детерминированный и непредсказуемый'}</h4>
      <p class="suggerimento">
        ${this.props.hint ??
        'Две точки отличаются на миллиардную долю. Поверните фигуру пальцем и подождите — сначала они неразличимы.'}
      </p>

      <canvas
        role="img"
        aria-label="Аттрактор Лоренца, две близкие траектории"
        @pointerdown=${(e: PointerEvent) => {
          this.dragging = true;
          this.lastX = e.clientX;
          this.lastY = e.clientY;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        @pointermove=${(e: PointerEvent) => this.ruota(e)}
        @pointerup=${() => (this.dragging = false)}
        @pointercancel=${() => (this.dragging = false)}></canvas>

      <div class="quadranti">
        <div class="quadrante"><b>ρ</b><span>${this.rho.toFixed(1)}</span></div>
        <div class="quadrante ${this.spread > 1 ? 'male' : 'bene'}">
          <b>расстояние между точками</b><span>${this.spread.toExponential(2)}</span>
        </div>
      </div>

      <div class="manopole">
        <div class="manopola">
          <label for="rho"><span>параметр ρ</span><i>${this.rho.toFixed(1)}</i></label>
          <input
            id="rho"
            type="range"
            min="1"
            max="60"
            step="0.5"
            .value=${String(this.rho)}
            @input=${(e: Event) => {
              this.rho = Number((e.target as HTMLInputElement).value);
              /* Другое ρ — другое множество и другой масштаб. Считается это
                 на ходу, потому что движок крутят именно ради того, чтобы
                 увидеть, как множество меняет вид. */
              this.misura();
            }} />
        </div>
      </div>

      <div class="azioni">
        <button class="bottone" @click=${() => (this.running = !this.running)}>
          ${this.running ? 'Пауза' : 'Дальше'}
        </button>
        <button
          class="bottone"
          @click=${() => {
            this.a = { x: 1, y: 1, z: 1 };
            this.b = { x: 1 + 1e-9, y: 1, z: 1 };
            this.trailA = [];
            this.trailB = [];
            this.spread = 0;
          }}>
          Сначала
        </button>
      </div>

      <p class="esito ${this.spread > 1 ? 'male' : ''}">
        ${this.spread > 1
          ? 'Точки разошлись. Никакой ошибки в счёте не было — так устроена сама система.'
          : 'Пока неразличимы. Подождите.'}
      </p>
    </section>`;
  }
}

customElements.define('cy-logistica', Logistica);
customElements.define('cy-lorenz', Lorenz);
