/**
 * МАСТЕРСКАЯ — прибор, в котором читатель пишет манифест, а кластер отвечает.
 *
 * Устройство взято у CSS Grid Garden: настоящий синтаксис в редакторе,
 * мгновенный ответ картинки, задача уровня словами и переход к следующей.
 * Ползунков здесь нет намеренно — ползунок учит ползунку.
 *
 * Три вещи, без которых это не работает:
 *
 *   — ответ мгновенный. Читатель правит строку и сразу видит, что стало с
 *     кластером: поды, узлы, служба. Кнопки «применить» нет, потому что
 *     пауза между действием и ответом рвёт связь между ними;
 *   — беды называются с номером строки. Настоящий apiserver незнакомое поле
 *     молча отбрасывает, и на этом теряют часы; здесь оно названо и рядом
 *     предложено близкое;
 *   — при неудаче сказано, что именно не так, а не «неверно». Отказ без
 *     объяснения — это викторина, от которой и уходим.
 *
 * Считает всё модель из `models/officina`, проверенная тестами: в них
 * закреплено, что начальный манифест каждого уровня задачу НЕ решает, а
 * задуманное решение — решает.
 */

import { css, html, stile, Widget } from './base';
import { LIVELLI, valuta, type Livello, type Quadro } from './models/officina';

interface Props {
  /** Показать только эти уровни, по их именам. По умолчанию — все. */
  readonly levels?: readonly string[];
  readonly goal?: boolean;
  readonly title?: string;
  readonly hint?: string;
}

export class Officina extends Widget<Props> {
  static override styles = [
    stile,
    css`
      /* Полоска уровней. Задача у каждого своя, и перейти к следующему можно
         в любой момент: застрять на одном — не то, чему учит курс. */
      .livelli {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 0 0 10px;
      }

      .livello {
        position: relative;
        border: 0;
        background: none;
        cursor: pointer;
        min-width: 40px;
        min-height: 40px;
        padding: 6px 10px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(19px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.1;
        color: var(--тихий, #636a75);
      }

      .livello[aria-current='true'] {
        color: var(--паста, #1b3a6b);
      }

      .livello[aria-current='true']::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='42' preserveAspectRatio='none'><path d='M9,4 C22,2 36,3 42,6 C46,8 46,14 45,22 C44,31 43,36 39,38 C28,41 15,40 8,38 C4,36 3,30 3,22 C3,13 4,7 8,5' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      .livello.fatto {
        color: var(--зелёный, #3f6b4a);
      }

      .compito {
        margin: 0 0 12px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(20px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.25;
        color: var(--текст, #20242c);
        /* Место под три строки задачи: у разных уровней она разной длины, и
           коробка прибора не должна дышать при переходе. */
        min-height: calc(var(--шаг, 26px) * 3.2);
      }

      /* Редактор. Номера строк слева, как в любом настоящем: беда называется
         номером, и найти его надо глазами, а не считая. */
      .editore {
        display: grid;
        grid-template-columns: 2.2em 1fr;
        margin: 0 0 10px;
        background: color-mix(in srgb, var(--бумага, #fffdf6) 82%, transparent);
      }

      /* Свойство white-space: pre здесь стоять НЕ должно, хотя рука тянется
         его поставить: номера лежат блоками, а перевод строки и отступы
         самого шаблона при pre становятся содержимым — и вся колонка
         съезжает вниз на две строки. Ровно эта ошибка уже была в разборе
         манифеста. */
      .numeri {
        margin: 0;
        padding: 8px 4px 8px 0;
        text-align: right;
        font-family: 'PT Mono', monospace;
        font-size: max(calc(12.5px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.45;
        color: var(--тихий, #636a75);
        user-select: none;
        overflow: hidden;
      }

      .numeri b {
        display: block;
        font-weight: 400;
      }

      .numeri b.male {
        color: var(--красный, #a8402f);
      }

      textarea {
        display: block;
        width: 100%;
        border: 0;
        background: none;
        resize: vertical;
        padding: 8px 8px 8px 6px;
        font-family: 'PT Mono', monospace;
        font-size: max(calc(12.5px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.45;
        color: var(--текст, #20242c);
        white-space: pre;
        overflow-wrap: normal;
        overflow-x: auto;
        tab-size: 2;
      }

      textarea:focus-visible {
        outline: 2px solid var(--паста, #1b3a6b);
        outline-offset: 2px;
      }

      .guasti {
        margin: 0 0 12px;
        padding: 0;
        list-style: none;
        /* Две строки бед отведены заранее. */
        min-height: calc(var(--шаг, 26px) * 2);
        font-family: 'PT Mono', monospace;
        font-size: max(calc(12px * var(--кегль, 1)), var(--пол, 0px));
        line-height: var(--шаг, 26px);
        color: var(--красный, #a8402f);
      }

      .guasti li {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Кластер. Узлы, поды внутри, служба сбоку. */
      .cluster {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 10px;
        margin: 0 0 12px;
      }

      .nodo {
        position: relative;
        padding: 7px 10px 8px;
        min-height: calc(var(--шаг, 26px) * 4.4);
      }

      .nodo::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='170' height='120' preserveAspectRatio='none'><path d='M10,5 C56,2 128,4 160,8 C166,9 168,16 168,30 C169,72 168,104 164,113 C126,118 56,117 14,114 C7,113 4,105 4,90 C3,48 4,15 7,9' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      /* Имя узла и остаток места — двумя строками, а не в одну.
         В одну они не влезали: на телефоне колонка узла 150 px, и подпись
         «свободно 4 / 8.0 ГБ» вылезала на соседа. */
      .nodo h5 {
        margin: 0 0 2px;
        font-family: 'Caveat', cursive;
        font-weight: 700;
        font-size: max(calc(18px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.1;
        color: var(--паста, #1b3a6b);
      }

      .nodo h5 i {
        display: block;
        font-style: normal;
        font-weight: 400;
        font-family: 'Literata', serif;
        font-size: max(calc(11.5px * var(--кегль, 1)), var(--пол, 0px));
        font-variant-numeric: tabular-nums;
        color: var(--тихий, #636a75);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .pod {
        position: relative;
        margin: 3px 0 0;
        padding: 2px 6px;
        font-family: 'PT Mono', monospace;
        font-size: max(calc(11.5px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.5;
        color: var(--текст, #20242c);
        background: color-mix(in srgb, var(--паста, #1b3a6b) 8%, transparent);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Под, попавший в службу, помечен пастой слева: связь видно, а не
         додумывают. */
      .pod.servito {
        box-shadow: inset 3px 0 0 var(--зелёный, #3f6b4a);
      }

      .attesa .pod {
        background: color-mix(in srgb, var(--красный, #a8402f) 9%, transparent);
      }

      .attesa {
        margin: 0 0 12px;
        min-height: calc(var(--шаг, 26px) * 1.4);
      }

      .attesa p {
        margin: 0 0 2px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(17px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.2;
        color: var(--красный, #a8402f);
      }

      .servizio {
        margin: 0 0 12px;
        padding: 6px 10px;
        min-height: calc(var(--шаг, 26px) * 2);
        font-family: 'PT Mono', monospace;
        font-size: max(calc(12px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.5;
        color: var(--грифель, #5c6068);
        box-shadow: inset 3px 0 0 color-mix(in srgb, var(--паста, #1b3a6b) 45%, transparent);
      }

      .servizio b {
        font-weight: 400;
        color: var(--паста, #1b3a6b);
      }

      .servizio.vuoto {
        color: var(--красный, #a8402f);
        box-shadow: inset 3px 0 0 var(--красный, #a8402f);
      }
    `,
  ];

  static override properties = {
    сейчас: { state: true },
    tick: { state: true },
  };

  declare сейчас: number;
  declare tick: number;

  /** Текст манифеста по каждому уровню: переход туда и обратно не теряет правок. */
  private тексты = new Map<string, string>();
  private взятые = new Set<string>();
  private отложено = 0;

  private get уровни(): readonly Livello[] {
    const имена = this.props.levels;
    if (!имена || имена.length === 0) return LIVELLI;
    return LIVELLI.filter((l) => имена.includes(l.id));
  }

  private get уровень(): Livello {
    return this.уровни[this.сейчас] ?? this.уровни[0]!;
  }

  private get текст(): string {
    return this.тексты.get(this.уровень.id) ?? this.уровень.start;
  }

  protected override avvia(): void {
    this.сейчас = 0;
    this.tick = 0;
  }

  protected override ferma(): void {
    if (this.отложено) clearTimeout(this.отложено);
  }

  private правка(значение: string): void {
    this.тексты.set(this.уровень.id, значение);
    /* Ответ мгновенный, но не на каждую букву: разбор с раскладкой на
       каждое нажатие — это работа на кадр, а печатают быстрее кадра. */
    if (this.отложено) clearTimeout(this.отложено);
    this.отложено = setTimeout(() => {
      this.отложено = 0;
      this.tick += 1;
      this.донести();
    }, 120) as unknown as number;
  }

  private донести(): void {
    const q = valuta(this.текст, this.уровень);
    if (!this.уровень.check(q).done) return;
    if (this.взятые.has(this.уровень.id)) return;
    this.взятые.add(this.уровень.id);
    if (!this.props.goal) return;
    const всего = this.уровни.length;
    const взято = this.уровни.filter((l) => this.взятые.has(l.id)).length;
    this.riporta({ goal: 'built', reached: взято === всего, score: взято / всего });
  }

  private tastiera(e: KeyboardEvent): void {
    /* Табуляция в YAML запрещена, а палец тянется к ней: подставляем два
       пробела. Иначе читатель получает беду за то, чего не хотел. */
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const поле = e.target as HTMLTextAreaElement;
    const с = поле.selectionStart;
    поле.value = `${поле.value.slice(0, с)}  ${поле.value.slice(поле.selectionEnd)}`;
    поле.selectionStart = поле.selectionEnd = с + 2;
    this.правка(поле.value);
  }

  private nodo(q: Quadro, i: number) {
    const узел = q.nodes[i]!;
    const свободно = q.libero[i]!;
    const свои = q.pods.filter((p) => p.node === узел.name);
    return html`<div class="nodo">
      <h5>
        ${узел.name}
        <i>${свободно.cpu} ядра / ${свободно.mem.toFixed(1)} ГБ</i>
      </h5>
      ${свои.map(
        (p) => html`<p class="pod ${p.served ? 'servito' : ''}" title=${p.name}>${p.name}</p>`,
      )}
    </div>`;
  }

  protected override render() {
    const l = this.уровень;
    const q = valuta(this.текст, l);
    const э = l.check(q);
    const ждут = q.pods.filter((p) => p.node === undefined);
    const строк = this.текст.split('\n').length;
    const бедныеСтроки = new Set(q.problems.map((p) => p.line));

    return html`<section class="telaio">
      <h4>${this.props.title ?? 'Мастерская манифеста'}</h4>
      <p class="suggerimento">
        ${this.props.hint ??
        'Правьте манифест — кластер отвечает сразу. Задача у каждого уровня своя; беда называется номером строки.'}
      </p>

      <div class="livelli" role="group" aria-label="Уровни">
        ${this.уровни.map(
          (у, i) => html`<button
            class="livello ${this.взятые.has(у.id) ? 'fatto' : ''}"
            aria-current=${i === this.сейчас ? 'true' : 'false'}
            aria-label=${`Уровень ${i + 1}: ${у.title}`}
            @click=${() => {
              this.сейчас = i;
              this.tick += 1;
            }}>
            ${i + 1}
          </button>`,
        )}
      </div>

      <p class="compito"><b>${l.title}.</b> ${l.task}</p>

      <div class="editore">
        <p class="numeri" aria-hidden="true">
          ${Array.from(
            { length: строк },
            (_, i) => html`<b class=${бедныеСтроки.has(i + 1) ? 'male' : ''}>${i + 1}</b>`,
          )}
        </p>
        <textarea
          aria-label="Манифест"
          spellcheck="false"
          autocapitalize="off"
          autocorrect="off"
          autocomplete="off"
          rows=${Math.max(10, строк)}
          .value=${this.текст}
          @keydown=${(e: KeyboardEvent) => this.tastiera(e)}
          @input=${(e: Event) => this.правка((e.target as HTMLTextAreaElement).value)}></textarea>
      </div>

      <ul class="guasti" aria-live="polite">
        ${q.problems.slice(0, 2).map((p) => html`<li>строка ${p.line}: ${p.text}</li>`)}
        ${q.problems.length > 2 ? html`<li>и ещё ${q.problems.length - 2}</li>` : null}
      </ul>

      <div class="cluster">${q.nodes.map((_, i) => this.nodo(q, i))}</div>

      <div class="attesa">
        ${ждут.length > 0
          ? html`<p>${ждут.length} в ожидании: ${ждут[0]!.perche}</p>
              ${ждут.map((p) => html`<span class="pod">${p.name}</span>`)}`
          : null}
      </div>

      ${q.service
        ? html`<p class="servizio ${q.service.endpoints.length === 0 ? 'vuoto' : ''}">
            <b>${q.service.name}</b> отбирает
            ${Object.entries(q.service.selector).map(([k, v]) => `${k}=${v}`).join(',')} — нашла
            ${q.service.endpoints.length}
          </p>`
        : null}

      <div class="quadranti">
        <div class="quadrante"><b>заявлено</b><span>${q.replicas}</span></div>
        <div class="quadrante ${ждут.length > 0 ? 'male' : 'bene'}">
          <b>работают</b><span>${q.pods.length - ждут.length}</span>
        </div>
        <div class="quadrante"><b>заявка пода</b><span>${q.requests.cpu} / ${(q.requests.mem * 1024).toFixed(0)}Mi</span></div>
        <div class="quadrante ${this.взятые.size === this.уровни.length ? 'bene' : ''}">
          <b>уровней взято</b><span>${this.взятые.size} из ${this.уровни.length}</span>
        </div>
      </div>

      <div class="azioni">
        <button
          class="bottone"
          @click=${() => {
            this.тексты.delete(l.id);
            this.tick += 1;
          }}>
          Сначала
        </button>
        ${э.done && this.сейчас + 1 < this.уровни.length
          ? html`<button
              class="bottone"
              @click=${() => {
                this.сейчас += 1;
                this.tick += 1;
              }}>
              Дальше
            </button>`
          : null}
      </div>

      <p class="esito ${э.done ? 'bene' : ''}">${э.why}</p>
    </section>`;
  }
}

customElements.define('cy-officina', Officina);
