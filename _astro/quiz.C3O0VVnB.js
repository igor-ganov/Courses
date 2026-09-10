import{W as M,s as O,b as a,i as F}from"./base.EFBAa4pS.js";const m=i=>({ok:!0,value:i}),c=(i,t)=>({ok:!1,issues:[{path:i,message:t}]});function y(i){return i===void 0?"ничего":i===null?"пусто":Array.isArray(i)?"список":typeof i=="number"?Number.isNaN(i)?"не-число":"число":typeof i=="string"?"строка":typeof i=="boolean"?"да/нет":typeof i=="object"?"запись":typeof i}function h(i){return{check:(t,e="")=>i(t,e),where(t,e){return h((r,n)=>{const s=i(r,n);return s.ok?t(s.value)?s:c(n,e):s})}}}function d(i={}){return h((t,e)=>typeof t!="string"?c(e,`ожидалась строка, пришло ${y(t)}`):!i.allowEmpty&&t.trim()===""?c(e,"строка пустая"):i.min!==void 0&&t.length<i.min?c(e,`строка короче ${i.min} знаков`):i.max!==void 0&&t.length>i.max?c(e,`строка длиннее ${i.max} знаков`):m(t))}function k(i={}){return h((t,e)=>typeof t!="number"||Number.isNaN(t)?c(e,`ожидалось число, пришло ${y(t)}`):i.integer&&!Number.isInteger(t)?c(e,"ожидалось целое число"):i.min!==void 0&&t<i.min?c(e,`меньше ${i.min}`):i.max!==void 0&&t>i.max?c(e,`больше ${i.max}`):m(t))}function j(){return h((i,t)=>typeof i=="boolean"?m(i):c(t,`ожидалось да/нет, пришло ${y(i)}`))}function f(i){return h((t,e)=>t===i?m(i):c(e,`ожидалось ${JSON.stringify(i)}`))}function g(i,t={}){return h((e,r)=>{if(!Array.isArray(e))return c(r,`ожидался список, пришло ${y(e)}`);if(t.min!==void 0&&e.length<t.min)return c(r,`нужно хотя бы ${t.min} шт., пришло ${e.length}`);if(t.max!==void 0&&e.length>t.max)return c(r,`не больше ${t.max} шт., пришло ${e.length}`);const n=[],s=[];return e.forEach((o,u)=>{const l=i.check(o,`${r}[${u}]`);l.ok?s.push(l.value):n.push(...l.issues)}),n.length?{ok:!1,issues:n}:m(s)})}const I=Symbol("optional");function z(i){const t=h((e,r)=>e===void 0?m(void 0):i.check(e,r));return Object.assign(t,{[I]:!0})}function b(i){return h((t,e)=>{if(typeof t!="object"||t===null||Array.isArray(t))return c(e,`ожидалась запись, пришло ${y(t)}`);const r=t,n=[],s={};for(const[o,u]of Object.entries(i)){const l=e?`${e}.${o}`:o,p=u.check(r[o],l);p.ok?p.value!==void 0&&(s[o]=p.value):n.push(...p.issues)}for(const o of Object.keys(r))o in i||n.push({path:e,message:`неизвестное поле "${o}"`});return n.length?{ok:!1,issues:n}:m(s)})}const w=new Map;function x(i){if(w.has(i.kind))throw new Error(`вид вопроса "${i.kind}" уже занят`);w.set(i.kind,i)}function L(){return[...w.keys()]}function N(i,t){const e=w.get(i.kind);if(!e)return{correct:!1,score:0,explain:`вид вопроса "${i.kind}" не зарегистрирован`};const r=e.grade(i,t),n=$(r.score),s=r.explain??i.explain;return s===void 0?{correct:r.correct,score:n}:{correct:r.correct,score:n,explain:s}}const $=i=>Number.isFinite(i)?Math.min(1,Math.max(0,i)):0,v={id:d({max:64}),prompt:d({max:600}),difficulty:k({integer:!0,min:1,max:5}),explain:z(d({max:800}))};function S(i){if(typeof i=="number")return Number.isFinite(i)?i:void 0;if(typeof i!="string")return;const t=Number(i.trim().replace(",",".").replace(/\s+/g,""));return Number.isFinite(t)?t:void 0}const A=(i,t)=>Array.isArray(i)?[...new Set(i.filter(e=>Number.isInteger(e)&&e>=0&&e<t))]:[];function q(){x({kind:"choice",label:"Выбор одного",schema:b({kind:f("choice"),...v,options:g(d({max:300}),{min:2}),answer:k({integer:!0,min:0})}),grade:(i,t)=>{const e=typeof t=="number"&&t===i.answer;return{correct:e,score:e?1:0}}}),x({kind:"multi",label:"Выбор нескольких",schema:b({kind:f("multi"),...v,options:g(d({max:300}),{min:2}),answer:g(k({integer:!0,min:0}),{min:1})}),grade:(i,t)=>{const e=A(t,i.options.length),r=new Set(i.answer),n=e.filter(u=>r.has(u)).length,s=e.length-n,o=$((n-s)/r.size);return{correct:n===r.size&&s===0,score:o}}}),x({kind:"numeric",label:"Число",schema:b({kind:f("numeric"),...v,answer:k(),tolerance:k({min:0}),relative:z(j()),unit:z(d({max:32}))}),grade:(i,t)=>{const e=S(t);if(e===void 0)return{correct:!1,score:0};const r=i.relative?Math.abs(i.answer*i.tolerance):i.tolerance,n=Math.abs(e-i.answer)<=r;return{correct:n,score:n?1:0}}}),x({kind:"order",label:"Порядок",schema:b({kind:f("order"),...v,items:g(d({max:300}),{min:3})}),grade:(i,t)=>{const e=A(t,i.items.length);if(e.length!==i.items.length)return{correct:!1,score:0};let r=0;for(let s=1;s<e.length;s+=1)e[s]===e[s-1]+1&&(r+=1);const n=$(r/(i.items.length-1));return{correct:n===1,score:n}}}),x({kind:"match",label:"Сопоставление",schema:b({kind:f("match"),...v,pairs:g(g(d({max:300}),{min:2,max:2}),{min:2})}),grade:(i,t)=>{const e=Array.isArray(t)?t:[];let r=0;for(let s=0;s<i.pairs.length;s+=1)e[s]===s&&(r+=1);const n=$(r/i.pairs.length);return{correct:n===1,score:n}}}),x({kind:"goal",label:"Цель в виджете",schema:b({kind:f("goal"),...v,widget:d({max:64}),goal:d({max:64})}),grade:(i,t)=>{const e=t??{};if(e.goal!==i.goal)return{correct:!1,score:0};const r=e.reached===!0,n=typeof e.score=="number"?$(e.score):0;return{correct:r,score:r?1:n}}})}L().length===0&&q();const Q=F`
  .domanda {
    margin: 0 0 10px;
    font-size: max(calc(17px * var(--кегль, 1)), var(--пол, 0px));
  }

  .numero {
    font-family: 'Caveat', cursive;
    font-size: max(calc(23px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--паста, #1b3a6b);
    margin-right: 6px;
  }

  .opzioni {
    display: grid;
    gap: 2px;
    margin: 0 0 8px;
    padding: 0;
    list-style: none;
  }

  .opzione {
    position: relative;
    display: flex;
    gap: 12px;
    align-items: baseline;
    width: 100%;
    text-align: left;
    border: 0;
    background: none;
    cursor: pointer;
    padding: 7px 8px 7px 6px;
    font: inherit;
    color: var(--текст, #20242c);
    min-height: 40px;
  }

  .opzione .lettera {
    font-family: 'Caveat', cursive;
    font-size: max(calc(21px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--тихий, #6f7682);
    min-width: 18px;
  }

  /* Выбранное обведено галочкой пастой, а не залито цветом: в тетради
     подчёркивают, а не красят. */
  .opzione[aria-checked='true']::before {
    content: '';
    position: absolute;
    left: -4px;
    top: 2px;
    width: 26px;
    height: 26px;
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><path d='M4,13 C7,17 9,20 11,22 C14,15 18,8 23,3' fill='none' stroke='%233f6b4a' stroke-width='2' stroke-linecap='round'/></svg>")
      no-repeat center;
  }

  .opzione[aria-checked='true'] .lettera {
    opacity: 0;
  }

  .opzione[aria-checked='true'] {
    color: var(--зелёный, #3f6b4a);
  }

  .opzione.sbagliata[aria-checked='true'] {
    color: var(--красный, #a8402f);
  }

  .opzione.sbagliata[aria-checked='true']::before {
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><path d='M5,5 C10,10 16,17 21,22 M21,5 C16,10 10,17 5,22' fill='none' stroke='%23a8402f' stroke-width='2' stroke-linecap='round'/></svg>")
      no-repeat center;
  }

  .opzione.giusta {
    color: var(--зелёный, #3f6b4a);
  }

  input[type='text'] {
    font: inherit;
    padding: 6px 8px;
    border: 0;
    border-bottom: 1.4px solid var(--грифель, #5c6068);
    background: none;
    color: var(--текст, #20242c);
    max-width: 12ch;
    font-variant-numeric: tabular-nums;
  }

  /* ── порядок ─────────────────────────────────────────────────────── */

  .ordine {
    display: grid;
    gap: 2px;
    margin: 0 0 8px;
    padding: 0;
    list-style: none;
  }

  .voce {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 4px 0;
  }

  .voce .posto {
    font-family: 'Caveat', cursive;
    font-size: max(calc(21px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--тихий, #6f7682);
    min-width: 18px;
  }

  .voce .testo {
    flex: 1 1 auto;
    min-width: 0;
  }

  .voce.giusta .testo {
    color: var(--зелёный, #3f6b4a);
  }

  .voce.sbagliata .testo {
    color: var(--красный, #a8402f);
  }

  /* Стрелки, а не перетаскивание: пальцем в узкой колонке тащить нечего, а
     клавиатурой перетаскивание вообще недоступно. */
  .freccia {
    border: 0;
    background: none;
    cursor: pointer;
    font: inherit;
    color: var(--паста, #1b3a6b);
    padding: 6px 8px;
    min-width: 34px;
    min-height: 34px;
    line-height: 1;
  }

  .freccia[disabled] {
    opacity: 0.3;
    cursor: default;
  }

  /* ── сопоставление ───────────────────────────────────────────────── */

  .coppie {
    display: grid;
    gap: 6px;
    margin: 0 0 8px;
  }

  .coppia {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .coppia .sinistra {
    flex: 1 1 40%;
    min-width: 0;
  }

  .coppia select {
    flex: 1 1 45%;
    font: inherit;
    padding: 5px 6px;
    min-height: 34px;
    border: 0;
    border-bottom: 1.4px solid var(--грифель, #5c6068);
    background: none;
    color: var(--текст, #20242c);
  }

  .coppia.giusta select {
    color: var(--зелёный, #3f6b4a);
  }

  .coppia.sbagliata select {
    color: var(--красный, #a8402f);
  }

  /* ── цель в приборе ──────────────────────────────────────────────── */

  .compito {
    margin: 0 0 8px;
    color: var(--грифель, #5c6068);
  }

  .avanzamento {
    font-variant-numeric: tabular-nums;
  }

  .spiegazione {
    margin: 8px 0 0;
    color: var(--грифель, #5c6068);
  }
`,W="абвгдежзи";function C(i){return Array.from({length:i},(t,e)=>i-1-e)}class D extends M{static{this.styles=[O,Q]}static{this.properties={scelta:{state:!0},multi:{state:!0},testo:{state:!0},ordine:{state:!0},coppie:{state:!0},rapporto:{state:!0},inviato:{state:!0}}}avvia(){this.scelta=-1,this.multi=[],this.testo="",this.rapporto=void 0,this.inviato=!1;const t=this.question;this.ordine=t?.kind==="order"?C(t.items.length):[],this.coppie=t?.kind==="match"?t.pairs.map(()=>-1):[],t?.kind==="goal"&&(this.слушатель=e=>{const r=e.detail;!r||r.goal!==t.goal||this.inviato||(this.rapporto=r,r.reached&&this.invia())},document.addEventListener("cy-goal",this.слушатель))}ferma(){this.слушатель&&document.removeEventListener("cy-goal",this.слушатель),this.слушатель=void 0}get question(){return this.props.question}answer(){const t=this.question;if(t)return t.kind==="multi"?this.multi:t.kind==="numeric"?this.testo:t.kind==="order"?this.ordine:t.kind==="match"?this.coppie:t.kind==="goal"?this.rapporto:this.scelta}pronto(){const t=this.question;if(!t)return!1;switch(t.kind){case"numeric":return this.testo.trim()!=="";case"multi":return this.multi.length>0;case"order":return!0;case"match":return this.coppie.every(e=>e>=0);case"goal":return this.rapporto!==void 0;default:return this.scelta>=0}}sposta(t,e){const r=t+e;if(r<0||r>=this.ordine.length)return;const n=[...this.ordine];[n[t],n[r]]=[n[r],n[t]],this.ordine=n}invia(){this.inviato=!0;const t=this.question;if(!t)return;const e=N(t,this.answer());this.dispatchEvent(new CustomEvent("cy-answer",{detail:{id:t.id,difficulty:t.difficulty,...e},bubbles:!0,composed:!0}))}render(){const t=this.question;if(!t)return a`<section class="telaio"><p class="esito male">Вопрос не задан.</p></section>`;const e=this.inviato?N(t,this.answer()):void 0,r=t.options??[],n=t.answer;return a`<section class="telaio">
      <p class="domanda">
        ${this.props.number?a`<span class="numero">${this.props.number}.</span>`:null}${t.prompt}
      </p>

      ${t.kind==="choice"||t.kind==="multi"?a`<ul class="opzioni" role=${t.kind==="multi"?"group":"radiogroup"}>
            ${r.map((s,o)=>{const u=t.kind==="multi"?this.multi.includes(o):this.scelta===o,l=this.inviato&&(Array.isArray(n)?n.includes(o):n===o),p=this.inviato&&u&&!l;return a`<li>
                <button
                  class="opzione ${p?"sbagliata":""} ${l?"giusta":""}"
                  role=${t.kind==="multi"?"checkbox":"radio"}
                  aria-checked=${u?"true":"false"}
                  ?disabled=${this.inviato}
                  @click=${()=>{this.inviato||(t.kind==="multi"?this.multi=this.multi.includes(o)?this.multi.filter(E=>E!==o):[...this.multi,o]:this.scelta=o)}}>
                  <span class="lettera">${W[o]??o+1}</span><span>${s}</span>
                </button>
              </li>`})}
          </ul>`:null}

      ${t.kind==="order"?a`<ol class="ordine">
            ${this.ordine.map((s,o)=>{const u=this.inviato&&o>0&&s===this.ordine[o-1]+1,l=this.inviato&&o>0&&!u;return a`<li class="voce ${u?"giusta":""} ${l?"sbagliata":""}">
                <span class="posto">${o+1}.</span>
                <span class="testo">${t.items[s]}</span>
                <button
                  class="freccia"
                  aria-label="Выше: ${t.items[s]}"
                  ?disabled=${this.inviato||o===0}
                  @click=${()=>this.sposta(o,-1)}>
                  ↑
                </button>
                <button
                  class="freccia"
                  aria-label="Ниже: ${t.items[s]}"
                  ?disabled=${this.inviato||o===this.ordine.length-1}
                  @click=${()=>this.sposta(o,1)}>
                  ↓
                </button>
              </li>`})}
          </ol>`:null}

      ${t.kind==="match"?a`<div class="coppie">
            ${t.pairs.map((s,o)=>{const u=this.inviato&&this.coppie[o]===o;return a`<div class="coppia ${this.inviato?u?"giusta":"sbagliata":""}">
                <span class="sinistra">${s[0]}</span>
                <select
                  aria-label="Пара для: ${s[0]}"
                  ?disabled=${this.inviato}
                  @change=${l=>{const p=[...this.coppie];p[o]=Number(l.target.value),this.coppie=p}}>
                  <option value="-1" ?selected=${this.coppie[o]===-1}>— выберите —</option>
                  ${t.pairs.map((l,p)=>a`<option value=${p} ?selected=${this.coppie[o]===p}>${l[1]}</option>`)}
                </select>
              </div>`})}
          </div>`:null}

      ${t.kind==="goal"?a`<p class="compito">
            ${this.rapporto?this.rapporto.reached?"Цель достигнута.":a`Пока пройдено
                    <span class="avanzamento"
                      >${((this.rapporto.score??0)*100).toFixed(0)} %</span
                    >. Можно продолжать в приборе или зачесть как есть.`:"Задание выполняется в приборе рядом. Как только цель будет взята, оно засчитается само."}
          </p>`:null}

      ${t.kind==="numeric"?a`<p>
            <input
              type="text"
              inputmode="decimal"
              aria-label="Ответ"
              ?disabled=${this.inviato}
              .value=${this.testo}
              @input=${s=>this.testo=s.target.value} />
            ${t.unit?a` <span class="tacito">${t.unit}</span>`:null}
          </p>`:null}

      <div class="azioni">
        <button class="bottone" ?disabled=${this.inviato||!this.pronto()} @click=${()=>this.invia()}>
          ${t.kind==="goal"?"Зачесть как есть":"Ответить"}
        </button>
        ${this.inviato&&t.kind!=="goal"?a`<button
              class="bottone"
              @click=${()=>{this.inviato=!1,this.scelta=-1,this.multi=[],this.testo="",t.kind==="order"&&(this.ordine=C(t.items.length)),t.kind==="match"&&(this.coppie=t.pairs.map(()=>-1))}}>
              Ещё раз
            </button>`:null}
      </div>

      ${e?a`<p class="esito ${e.correct?"bene":e.score>0?"":"male"}">
              ${e.correct?"Верно.":e.score>0?`Частично: ${(e.score*100).toFixed(0)} %.`:"Неверно."}
            </p>
            ${e.explain?a`<p class="spiegazione">${e.explain}</p>`:null}`:null}
    </section>`}}customElements.define("cy-quiz",D);export{D as Quiz};
