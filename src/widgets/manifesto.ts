/**
 * МАНИФЕСТ — заявка, которую можно потрогать построчно.
 *
 * Kubernetes преподаётся по манифестам, и обычная подача — простыня YAML с
 * абзацем пояснений под ней. Читатель при этом ищет глазами, к какой строке
 * относится третье предложение, и обычно не находит.
 *
 * Здесь пояснение привязано к строке и приходит по касанию. Заодно видно
 * деление, ради которого манифест и устроен так, как устроен: `spec` — что
 * заявлено, `status` — что есть на самом деле. Первое пишет человек, второе
 * пишет кластер, и путать их — главная ошибка начинающего.
 *
 * Прибор без модели: считать здесь нечего, это чтение. Зато место под
 * пояснение отведено заранее — иначе раскрытая строка раздвигала бы текст.
 */

import { css, html, stile, Widget } from './base';

interface Riga {
  readonly text: string;
  readonly note?: string;
  readonly part?: 'spec' | 'status' | 'meta';
}

interface Props {
  readonly lines?: readonly Riga[];
  readonly title?: string;
  readonly hint?: string;
}

/** Строк пояснения видно всегда столько: коробка не должна дышать. */
const СТРОК = 4;

export class Manifesto extends Widget<Props> {
  static override styles = [
    stile,
    css`
      .foglio {
        margin: 0 0 12px;
        font-family: 'PT Mono', monospace;
        font-size: max(calc(13.5px * var(--кегль, 1)), var(--пол, 0px));
        line-height: calc(var(--шаг, 26px) * 0.92);
        overflow-x: auto;
        overscroll-behavior-x: contain;
      }

      .riga {
        display: block;
        width: 100%;
        border: 0;
        background: none;
        font: inherit;
        color: var(--текст, #20242c);
        text-align: left;
        padding: 0 2px;
        white-space: pre;
        cursor: default;
      }

      /* Строка с пояснением подчёркнута карандашом, а не покрашена: цвет в
         манифесте уже занят делением на заявку и отчёт. */
      button.riga {
        cursor: pointer;
        background-image: linear-gradient(
          var(--тихий, #636a75),
          var(--тихий, #636a75)
        );
        background-repeat: no-repeat;
        background-position: 2px 92%;
        background-size: calc(100% - 4px) 1px;
      }

      button.riga:hover,
      button.riga[aria-expanded='true'] {
        background-image: linear-gradient(var(--паста, #1b3a6b), var(--паста, #1b3a6b));
        background-size: calc(100% - 4px) 1.4px;
        color: var(--паста, #1b3a6b);
      }

      .riga.spec {
        color: var(--паста, #1b3a6b);
      }

      .riga.status {
        color: var(--грифель, #5c6068);
      }

      .legenda {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 18px;
        margin: 0 0 10px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(17px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.2;
        color: var(--тихий, #636a75);
      }

      .legenda b {
        font-weight: 500;
      }

      .legenda .spec b {
        color: var(--паста, #1b3a6b);
      }

      .legenda .status b {
        color: var(--грифель, #5c6068);
      }

      /* Место под пояснение отведено под четыре строки заранее. Раскрытая
         строка не должна двигать текст под прибором — это тот самый сдвиг,
         который читатель ловит уже пальцем на ссылке. */
      .nota {
        min-height: calc(var(--шаг, 26px) * 4);
        margin: 0;
        font-family: 'Caveat', cursive;
        font-size: max(calc(19px * var(--кегль, 1)), var(--пол, 0px));
        line-height: var(--шаг, 26px);
        color: var(--грифель, #5c6068);
      }

      .nota code {
        font-family: 'PT Mono', monospace;
        font-size: max(calc(13.5px * var(--кегль, 1)), var(--пол, 0px));
        color: var(--паста, #1b3a6b);
      }
    `,
  ];

  static override properties = { aperta: { state: true } };

  declare aperta: number;

  protected override avvia(): void {
    this.aperta = -1;
  }

  private get righe(): readonly Riga[] {
    return this.props.lines ?? [];
  }

  private riga(r: Riga, i: number) {
    const класс = `riga ${r.part ?? ''}`;
    if (!r.note) return html`<span class=${класс}>${r.text}</span>`;
    /* Текст прижат к скобкам вплотную, и это не придирка к оформлению:
       при `white-space: pre` перевод строки и отступы самого шаблона
       становятся содержимым, и каждая строка манифеста занимает три. */
    return html`<button
      class=${класс}
      aria-expanded=${this.aperta === i ? 'true' : 'false'}
      @click=${() => (this.aperta = this.aperta === i ? -1 : i)}
    >${r.text}</button>`;
  }

  protected override render() {
    const открытая = this.righe[this.aperta];
    const есть = (part: Riga['part']) => this.righe.some((r) => r.part === part);

    return html`<section class="telaio">
      <h4>${this.props.title ?? 'Заявка'}</h4>
      <p class="suggerimento">
        ${this.props.hint ?? 'Коснитесь подчёркнутой строки — она расскажет, зачем она здесь.'}
      </p>

      ${есть('spec') || есть('status')
        ? html`<p class="legenda">
            ${есть('spec') ? html`<span class="spec"><b>spec</b> — что заявлено</span>` : null}
            ${есть('status') ? html`<span class="status"><b>status</b> — что есть</span>` : null}
          </p>`
        : null}

      <div class="foglio">${this.righe.map((r, i) => this.riga(r, i))}</div>

      <p class="nota" aria-live="polite">
        ${открытая?.note ?? 'Подчёркнутые строки объясняют себя сами — по касанию.'}
      </p>
    </section>`;
  }
}

customElements.define('cy-manifesto', Manifesto);
