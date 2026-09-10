import{W as i,s as o,i as n,b as r}from"./base.EFBAa4pS.js";class p extends i{static{this.styles=[o,n`
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
    `]}static{this.properties={aperta:{state:!0}}}avvia(){this.aperta=-1}get righe(){return this.props.lines??[]}riga(t,a){const e=`riga ${t.part??""}`;return t.note?r`<button
      class=${e}
      aria-expanded=${this.aperta===a?"true":"false"}
      @click=${()=>this.aperta=this.aperta===a?-1:a}
    >${t.text}</button>`:r`<span class=${e}>${t.text}</span>`}render(){const t=this.righe[this.aperta],a=e=>this.righe.some(s=>s.part===e);return r`<section class="telaio">
      <h4>${this.props.title??"Заявка"}</h4>
      <p class="suggerimento">
        ${this.props.hint??"Коснитесь подчёркнутой строки — она расскажет, зачем она здесь."}
      </p>

      ${a("spec")||a("status")?r`<p class="legenda">
            ${a("spec")?r`<span class="spec"><b>spec</b> — что заявлено</span>`:null}
            ${a("status")?r`<span class="status"><b>status</b> — что есть</span>`:null}
          </p>`:null}

      <div class="foglio">${this.righe.map((e,s)=>this.riga(e,s))}</div>

      <p class="nota" aria-live="polite">
        ${t?.note??"Подчёркнутые строки объясняют себя сами — по касанию."}
      </p>
    </section>`}}customElements.define("cy-manifesto",p);export{p as Manifesto};
