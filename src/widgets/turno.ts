/**
 * НОЧНАЯ СМЕНА — игра, в которой читатель сначала проигрывает.
 *
 * Первый виток курса утверждает, что заявка лучше команды. Утверждение
 * можно прочесть и согласиться, ничего не поняв: всякий согласится, что
 * автоматика лучше ручного труда. Понимание приходит, когда читатель сам
 * подежурит — раз в несколько секунд его будят, он тыкает «поднять», и
 * всё равно доля времени в строю выходит хуже, чем у контроллера, который
 * не получал ни одной команды.
 *
 * Поэтому здесь именно игра, а не показ: есть счёт, есть проигрыш и есть
 * переключатель, после которого счёт становится другим сам. Ночь одна и та
 * же при каждом заходе — иначе сравнивать нечего.
 *
 * Считает всё модель из `models/riconciliazione`, проверенная тестами;
 * в ней же и проверено, что безупречный дежурный контроллеру проигрывает.
 */

import { css, html, stile, Widget } from './base';
import { createCluster, type Cluster, type ClusterState } from './models/riconciliazione';

/* Шаг модели на один кадр. Шесть кластерных секунд на реальную: смена в две
   минуты проходится за двадцать секунд, а падение случается раз в пару
   секунд — успеть можно, но расслабиться нельзя. */
const ШАГ = 0.1;

interface Props {
  readonly desired?: number;
  /** В среднем раз в столько секунд падает под. */
  readonly chaos?: number;
  /** Какую долю времени в строю считать выигрышем. */
  readonly goal?: { uptime: number; over: number };
  readonly title?: string;
  readonly hint?: string;
}



export class Turno extends Widget<Props> {
  static override styles = [
    stile,
    css`
      /* Переключатель режима — главная ручка прибора, и выглядит он как
         выбор, а не как галочка: читатель должен понимать, что играет за
         одну из двух сторон. */
      .scelta {
        display: flex;
        gap: 10px;
        margin: 0 0 14px;
        flex-wrap: wrap;
      }

      .lato {
        position: relative;
        border: 0;
        background: none;
        cursor: pointer;
        padding: 8px 18px;
        min-height: 44px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(20px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.15;
        color: var(--тихий, #636a75);
        text-align: left;
      }

      .lato[aria-pressed='true'] {
        color: var(--паста, #1b3a6b);
      }

      .lato[aria-pressed='true']::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='48' preserveAspectRatio='none'><path d='M20,5 C70,2 150,4 182,8 C190,9 192,16 191,25 C190,35 188,42 181,44 C140,47 60,46 20,43 C11,42 7,35 7,25 C7,15 10,8 18,6' fill='none' stroke='%231b3a6b' stroke-width='1.6' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      .lato small {
        display: block;
        font-family: 'Literata', serif;
        font-size: max(calc(12.5px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.25;
        color: var(--тихий, #636a75);
      }

      .fila {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(74px, 1fr));
        gap: 8px;
        margin: 0 0 14px;
      }

      .posto {
        position: relative;
        min-height: calc(var(--шаг, 26px) * 2.3);
        padding: 6px 4px 4px;
        text-align: center;
        color: var(--паста, #1b3a6b);
      }

      .posto::before {
        content: '';
        position: absolute;
        inset: 0;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='90' height='64' preserveAspectRatio='none'><path d='M10,5 C34,3 62,4 80,7 C85,8 86,13 86,22 C86,40 85,52 81,56 C60,60 30,59 11,57 C6,56 4,50 4,41 C4,24 5,10 8,7' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      .posto.vuoto {
        color: var(--красный, #a8402f);
      }

      .posto.vuoto::before {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='90' height='64' preserveAspectRatio='none'><path d='M10,5 C34,3 62,4 80,7 C85,8 86,13 86,22 C86,40 85,52 81,56 C60,60 30,59 11,57 C6,56 4,50 4,41 C4,24 5,10 8,7' fill='none' stroke='%23a8402f' stroke-width='1.3' stroke-linecap='round' stroke-dasharray='5 6' opacity='.65'/></svg>");
      }

      .nome {
        display: block;
        font-family: 'PT Mono', monospace;
        font-size: max(calc(12.5px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.15;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .stato {
        display: block;
        font-family: 'Caveat', cursive;
        font-size: max(calc(16px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.1;
        color: var(--тихий, #636a75);
      }

      .posto.lavora .stato {
        color: var(--зелёный, #3f6b4a);
      }

      /* Полоса смены: у игры должен быть виден конец, иначе это не игра. */
      .turno {
        position: relative;
        height: 2px;
        margin: 0 0 14px;
        background: color-mix(in srgb, var(--грифель, #5c6068) 16%, transparent);
      }

      .turno i {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--паста, #1b3a6b);
      }

      .sveglia {
        font-family: 'Caveat', cursive;
        font-size: max(calc(20px * var(--кегль, 1)), var(--пол, 0px));
        color: var(--красный, #a8402f);
        min-height: calc(var(--шаг, 26px) * 1.2);
        margin: 0 0 6px;
        line-height: 1.2;
      }
    `,
  ];

  static override properties = {
    сам: { state: true },
    tick: { state: true },
  };

  declare сам: boolean;
  declare tick: number;

  private cluster!: Cluster;
  private stop?: () => void;
  private reported = false;
  private riferito = 0;

  private get цель() {
    return this.props.goal ?? { uptime: 0.85, over: 120 };
  }

  protected override avvia(): void {
    this.сам = true;
    this.tick = 0;
    this.заново();
    this.stop = this.loop(() => {
      /* Смена кончается. Игра без конца — это показ: счёт должен где-то
         остановиться, чтобы его можно было сравнить с другим счётом. */
      if (this.cluster.state().time >= this.цель.over) return;
      this.cluster.step();
      this.tick += 1;
      this.донести();
    });
  }

  protected override ferma(): void {
    this.stop?.();
  }

  private заново(): void {
    this.cluster = createCluster({
      desired: this.props.desired ?? 3,
      resync: 0.5,
      /* Полторы секунды на подъём, а не две с половиной, как в остальных
         приборах. Числа здесь подобраны так, чтобы стороны расходились
         явно: контроллер закрывает расхождение за секунду с небольшим и
         выходит на девяносто процентов времени в строю, а человеку нужно
         сперва заметить — и он остаётся около семидесяти. При прежних
         числах обе стороны давали семьдесят с небольшим, и игра не
         показывала ровно того, ради чего затевалась. */
      startup: 1.5,
      shutdown: 1,
      /* Дежурит человек — значит контроллера нет. Это и есть выбор стороны. */
      running: !this.сам,
      chaos: this.props.chaos ?? 20,
      seed: 20260910,
      /* Смена начинается с исправного кластера: дежурство портится по ходу
         дела, а не встречает читателя уже проигранным. */
      warm: true,
      /* Шаг мелкий, и на кадр он один. Здесь это принципиально: остальные
         приборы гонят время в тридцать раз быстрее реального, чтобы читатель
         увидел установление, не отводя взгляда, — а это игра, и играть в
         неё надо в человеческом темпе. При прежней скорости смена в сто
         двадцать секунд пролетала за четыре реальных: нажать успевал только
         тот, кто уже знал, куда нажимать. */
      dt: ШАГ,
    });
    this.reported = false;
    this.riferito = 0;
    this.tick += 1;
  }

  /** Итог смены — то, чем игра засчитывается. */
  private итог(s: ClusterState) {
    const доля = Math.min(1, s.time / this.цель.over);
    const выиграл = s.time >= this.цель.over && s.uptime >= this.цель.uptime;
    return { доля, выиграл, uptime: s.uptime };
  }

  private донести(): void {
    if (this.reported) return;
    const и = this.итог(this.cluster.state());
    /* Балл — доля пройденной смены, помноженная на достигнутую готовность:
       «нет» без числа не говорит читателю, близко он был или нет. */
    const балл = Math.min(1, и.доля * (и.uptime / this.цель.uptime));
    if (и.выиграл || балл >= this.riferito + 0.05) {
      this.riferito = балл;
      this.reported = и.выиграл;
      this.riporta({ goal: 'survived', reached: и.выиграл, score: балл });
    }
  }

  private сторона(сам: boolean): void {
    if (this.сам === сам) return;
    this.сам = сам;
    /* Смена начинается заново: сравнивать половину ночи руками с половиной
       ночи под контроллером было бы нечестно в обе стороны. */
    this.заново();
  }

  protected override render() {
    const s = this.cluster.state();
    const и = this.итог(s);
    const мало = s.alive < s.desired;
    const конец = s.time >= this.цель.over;

    return html`<section class="telaio">
      <h4>${this.props.title ?? 'Ночная смена'}</h4>
      <p class="suggerimento">
        ${this.props.hint ??
        'Три экземпляра должны работать всю ночь. Поды падают сами. Сначала подежурьте руками, потом переключитесь на заявку и сравните два числа: долю времени в строю и число пробуждений.'}
      </p>

      <div class="scelta" role="group" aria-label="Кто держит состояние">
        <button
          class="lato"
          aria-pressed=${this.сам ? 'true' : 'false'}
          @click=${() => this.сторона(true)}>
          Дежурю сам
          <small>контроллера нет, поднимать руками</small>
        </button>
        <button
          class="lato"
          aria-pressed=${this.сам ? 'false' : 'true'}
          @click=${() => this.сторона(false)}>
          Заявил состояние
          <small>«пусть будет ${s.desired}» — и спать</small>
        </button>
      </div>

      <div
        class="turno"
        role="progressbar"
        aria-valuenow=${Math.round(и.доля * 100)}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Сколько смены прошло">
        <i style=${`width:${(и.доля * 100).toFixed(0)}%`}></i>
      </div>

      <p class="sveglia">
        ${конец ? '' : this.сам && мало ? `Не хватает ${s.desired - s.alive}. Поднимайте.` : ''}
      </p>

      <div class="fila">
        ${Array.from({ length: s.desired }, (_, i) => {
          const p = s.pods[i];
          if (!p) {
            return html`<div class="posto vuoto">
              <span class="nome">пусто</span>
              <span class="stato">простой</span>
            </div>`;
          }
          return html`<div class="posto ${p.phase === 'running' ? 'lavora' : ''}">
            <span class="nome">${p.name}</span>
            <span class="stato">${p.phase === 'running' ? 'работает' : 'поднимается'}</span>
          </div>`;
        })}
      </div>

      <div class="quadranti">
        <div class="quadrante ${s.uptime >= this.цель.uptime ? 'bene' : 'male'}">
          <b>в строю</b><span>${(s.uptime * 100).toFixed(0)} %</span>
        </div>
        <div class="quadrante ${s.interventions > 0 ? 'male' : ''}">
          <b>пробуждений</b><span>${s.interventions}</span>
        </div>
        <div class="quadrante"><b>готовы</b><span>${s.ready} из ${s.desired}</span></div>
        <div class="quadrante"><b>смена</b><span>${s.time.toFixed(0)} с</span></div>
      </div>

      <div class="azioni">
        <button
          class="bottone"
          ?disabled=${!this.сам || !мало || конец}
          @click=${() => {
            this.cluster.raise();
            this.tick += 1;
          }}>
          Поднять под
        </button>
        <button class="bottone" @click=${() => this.заново()}>Сначала</button>
      </div>

      <p class="esito ${и.выиграл ? 'bene' : ''} ${конец && !и.выиграл ? 'male' : ''}">
        ${конец
          ? и.выиграл
            ? this.сам
              ? `Смена выстояна — ${s.interventions} пробуждений за ночь. Теперь ту же ночь под заявкой: пробуждений там будет ноль.`
              : 'Смена пройдена, пробуждений ноль. Ни одной команды «создай под» отдано не было — было записано, сколько их должно быть.'
            : `Смена не выстояна: в строю ${(s.uptime * 100).toFixed(0)} % при нужных ${(this.цель.uptime * 100).toFixed(0)} %. Та же ночь под заявкой проходится сама.`
          : this.сам
            ? `Держите ${(this.цель.uptime * 100).toFixed(0)} % времени в строю до конца смены. Каждое падение — ваше пробуждение.`
            : `Контроллер держит сам. Досмотрите смену до конца и сравните с тем, что вышло руками.`}
      </p>
    </section>`;
  }
}

customElements.define('cy-turno', Turno);
