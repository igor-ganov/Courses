import{W as B,s as E,i as H,b as c}from"./base.EFBAa4pS.js";const I=40,m="abcdefghijklmnopqrstuvwxyz0123456789";function F(p){return m[p*7%m.length]+m[(p*13+5)%m.length]+m[(p*3+11)%m.length]}function N(p){let s=p>>>0;return()=>{s=s+1831565813>>>0;let e=Math.imul(s^s>>>15,1|s);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}const L=400;function S(p,s){let e={...p},i=0,r=0,a=[],g=[],h=0,f=0,l=0,v=N(e.seed??20260910),w=0,k=0,b=[],x=0,y=e.desired,$=!0;if(e.warm)for(let t=0;t<e.desired;t+=1)r+=1,a.push({id:r,name:`web-${F(r)}`,phase:"running",age:0});const C=t=>t.phase==="running",M=t=>t.phase!=="terminating";function u(t,o){g.push({at:Number(i.toFixed(2)),kind:t,text:o}),g.length>I&&g.shift()}function q(){return{time:i,desired:e.desired,pods:a.map(t=>({id:t.id,name:t.name,phase:t.phase,age:Number(t.age.toFixed(2)),ready:C(t)})),ready:a.filter(C).length,alive:a.filter(M).length,events:[...g],held:Number(f.toFixed(2)),uptime:i>0?Number((k/i).toFixed(4)):1,interventions:w,wanted:[...b]}}function z(){r+=1;const t=`web-${F(r)}`;a.push({id:r,name:t,phase:"pending",age:0}),u("created",`создан ${t}`)}function W(){if(i=0,r=0,a=[],g=[],h=0,f=0,v=N(e.seed??20260910),w=0,k=0,b=[],x=0,$=!0,e={...e,desired:y},e.warm)for(let t=0;t<e.desired;t+=1)r+=1,a.push({id:r,name:`web-${F(r)}`,phase:"running",age:0});l=0}function P(){const t=a.filter(M).length;if(t<e.desired){for(let o=t;o<e.desired;o+=1)z();return}if(t>e.desired){let o=t-e.desired;for(let n=a.length-1;n>=0&&o>0;n-=1){const d=a[n];M(d)&&(d.phase="terminating",d.age=0,u("deleted",`гасится ${d.name}`),o-=1)}}}function T(){const t=e.dt;i+=t;for(const n of a)n.age+=t;for(const n of a)n.phase==="pending"?(n.phase="creating",n.age=0):n.phase==="creating"&&n.age>=e.startup&&(n.phase="running",n.age=0,u("started",`${n.name} готов`));if(a=a.filter(n=>!(n.phase==="terminating"&&n.age>=e.shutdown)),e.chaos&&e.chaos>0&&a.length>0&&v()<t/e.chaos){const n=a[Math.floor(v()*a.length)];n&&(a=a.filter(d=>d!==n),u("killed",`${n.name} упал сам`))}if(e.rival&&e.rival.every>0&&(x-=t,x<=0)){x=e.rival.every;const n=$?e.rival.desired:y,d=$?"второй хозяин":"выкладка по файлу";$=!$,e.desired!==n&&(u("scaled",`${d} ставит ${n}`),e={...e,desired:n},h=0)}h-=t,h<=0&&(h=e.resync,e.running&&P());const o=a.filter(C).length===e.desired;return o&&(k+=t),s&&(f=o?f+t:0,l=Math.max(l,f)),b.push({at:Number(i.toFixed(2)),n:e.desired}),b.length>L&&b.shift(),q()}return{step:T,state:q,reset:W,settings:()=>e,set(t){const o=e;e={...e,...t},t.desired!==void 0&&t.desired!==o.desired&&(y=t.desired,u("scaled",`заявлено ${t.desired} вместо ${o.desired}`),h=0),t.running!==void 0&&t.running!==o.running&&u(t.running?"resumed":"paused",t.running?"контроллер пущен":"контроллер остановлен")},kill(t){const o=a.findIndex(d=>d.id===t);if(o<0)return;const n=a[o];a.splice(o,1),u("killed",`${n.name} упал`)},raise(){w+=1,z()},goal(){return s?{goal:"held",reached:l>=s.hold,score:Math.min(1,l/s.hold)}:{goal:"held",reached:!1,score:0}}}}const A=8,R=5,j={pending:"ждёт узла",creating:"поднимается",running:"работает",terminating:"гасится"};class _ extends B{constructor(){super(...arguments),this.reported=!1,this.riferito=0}static{this.styles=[E,H`
      /* Мест всегда восемь, занятых — сколько заявлено. Сетка с автоподбором
         меняла бы число рядов вместе с числом подов, а вместе с рядами ездил
         бы весь текст под прибором. */
      .griglia {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(74px, 1fr));
        gap: 8px;
        margin: 0 0 14px;
      }

      .posto {
        position: relative;
        min-height: calc(var(--шаг, 26px) * 2.6);
        padding: 6px 4px 4px;
        border: 0;
        background: none;
        font: inherit;
        text-align: center;
        cursor: pointer;
        color: var(--паста, #1b3a6b);
      }

      .posto[disabled] {
        cursor: default;
      }

      /* Обводка одним штрихом, как у всей тетради: рамок нет, есть след пасты. */
      .posto.pieno::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='90' height='70' preserveAspectRatio='none'><path d='M10,5 C34,3 62,4 80,7 C85,8 86,14 86,24 C86,44 85,58 81,62 C60,66 30,65 11,63 C6,62 4,56 4,45 C4,26 5,11 8,7' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      .posto.vuoto::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='90' height='70' preserveAspectRatio='none'><path d='M10,5 C34,3 62,4 80,7 C85,8 86,14 86,24 C86,44 85,58 81,62 C60,66 30,65 11,63 C6,62 4,56 4,45 C4,26 5,11 8,7' fill='none' stroke='%235c6068' stroke-width='1.1' stroke-linecap='round' stroke-dasharray='5 6' opacity='.4'/></svg>")
          no-repeat center / 100% 100%;
      }

      .nome {
        display: block;
        font-family: 'PT Mono', monospace;
        font-size: max(calc(13px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.15;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .fase {
        display: block;
        font-family: 'Caveat', cursive;
        font-size: max(calc(16px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.1;
        color: var(--тихий, #636a75);
      }

      .posto.lavora .fase {
        color: var(--зелёный, #3f6b4a);
      }

      .posto.spegne .nome {
        text-decoration: line-through;
        opacity: 0.55;
      }

      /* Поднимающийся под — полоска, а не мигание: мигание на странице с
         текстом читается как поломка, а полоска говорит «идёт». */
      .barra {
        position: absolute;
        left: 12%;
        right: 12%;
        bottom: 8px;
        height: 2px;
        background: color-mix(in srgb, var(--паста, #1b3a6b) 22%, transparent);
      }

      .barra i {
        display: block;
        height: 100%;
        background: var(--паста, #1b3a6b);
      }

      .nastro {
        margin: 0 0 12px;
        padding: 0;
        list-style: none;
        min-height: calc(var(--шаг, 26px) * 5);
        font-family: 'PT Mono', monospace;
        font-size: max(calc(13px * var(--кегль, 1)), var(--пол, 0px));
        line-height: var(--шаг, 26px);
        color: var(--грифель, #5c6068);
      }

      .nastro li {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .nastro .t {
        color: var(--тихий, #636a75);
      }

      .nastro .killed {
        color: var(--красный, #a8402f);
      }

      .nastro .started {
        color: var(--зелёный, #3f6b4a);
      }

      .spento {
        color: var(--красный, #a8402f);
      }

      /* График нужен только там, где есть второй хозяин: дребезг словами
         описывается плохо, а пилой — сразу. */
      svg.pila {
        display: block;
        width: 100%;
        height: auto;
        margin: 0 0 12px;
      }
    `]}static{this.properties={desired:{state:!0},acceso:{state:!0},tick:{state:!0}}}avvia(){const s=this.props;this.desired=s.desired??3,this.acceso=!0,this.tick=0,this.cluster=S({desired:this.desired,resync:s.resync??.5,startup:s.startup??2.5,shutdown:1.2,running:!0,dt:.25,...s.rival?{rival:s.rival}:{}},s.goal),this.stop=this.loop(()=>{for(let e=0;e<2;e+=1)this.cluster.step();if(this.tick+=1,this.props.goal&&!this.reported){const e=this.cluster.goal();(e.reached||e.score>=this.riferito+.05)&&(this.riferito=e.score,this.reported=e.reached,this.riporta(e))}})}ferma(){this.stop?.()}posto(s,e){const i=s.pods[e];if(!i)return c`<div class="posto vuoto" aria-hidden="true">
        <span class="nome">&nbsp;</span><span class="fase">&nbsp;</span>
      </div>`;const r=i.phase==="creating"?Math.min(1,i.age/this.cluster.settings().startup):0;return c`<button
      class="posto pieno ${i.phase==="running"?"lavora":""} ${i.phase==="terminating"?"spegne":""}"
      aria-label=${`Уронить под ${i.name}, сейчас ${j[i.phase]}`}
      ?disabled=${i.phase==="terminating"}
      @click=${()=>this.cluster.kill(i.id)}>
      <span class="nome">${i.name}</span>
      <span class="fase">${j[i.phase]}</span>
      ${i.phase==="creating"?c`<span class="barra"><i style=${`width:${(r*100).toFixed(0)}%`}></i></span>`:null}
    </button>`}nastro(s){const e=s.events.slice(-R),i=Math.max(0,R-e.length);return c`<ul class="nastro" aria-label="Лента событий">
      ${e.map(r=>c`<li>
          <span class="t">${r.at.toFixed(1)} с</span> <span class=${r.kind}>${r.text}</span>
        </li>`)}
      ${Array.from({length:i},()=>c`<li aria-hidden="true">&nbsp;</li>`)}
    </ul>`}pila(s){const e=s.wanted.length;if(!this.props.rival||e<4)return null;const i=620,r=120,a=Math.max(1,...s.wanted.map(l=>l.n),s.desired,1),g=l=>l/(e-1)*i,h=l=>r-l/(a+.4)*r,f=s.wanted.map((l,v)=>`${v?"L":"M"}${g(v).toFixed(1)},${h(l.n).toFixed(1)}`).join("");return c`<svg
      class="pila"
      viewBox="0 0 ${i} ${r}"
      preserveAspectRatio="none"
      role="img"
      aria-label="Заявленное число экземпляров во времени: пила между двумя значениями">
      <path
        d=${f}
        fill="none"
        stroke="var(--паста, #1b3a6b)"
        stroke-width="2"
        stroke-linejoin="round" />
    </svg>`}scala(s){this.desired=s,this.cluster.set({desired:s})}acceleratore(){this.acceso=!this.acceso,this.cluster.set({running:this.acceso})}daccapo(){this.reported=!1,this.riferito=0,this.cluster.reset(),this.cluster.set({desired:this.desired,running:this.acceso}),this.tick+=1}render(){const s=this.cluster.state(),e=s.ready===s.desired,i=this.props.goal?this.cluster.goal():void 0;return c`<section class="telaio">
      <h4>${this.props.title??"Цикл сверки"}</h4>
      <p class="suggerimento">
        ${this.props.hint??"Уроните под пальцем — его никто не воскрешает по команде: контроллер просто видит, что заявленному числу не хватает одного. Выключите контроллер и уроните снова."}
      </p>

      ${this.pila(s)}

      <div class="griglia">
        ${Array.from({length:A},(r,a)=>this.posto(s,a))}
      </div>

      ${this.nastro(s)}

      <div class="quadranti">
        <div class="quadrante"><b>заявлено</b><span>${s.desired}</span></div>
        <div class="quadrante ${e?"bene":"male"}"><b>готовы</b><span>${s.ready}</span></div>
        <div class="quadrante"><b>существуют</b><span>${s.alive}</span></div>
        <div class="quadrante"><b>время</b><span>${s.time.toFixed(0)} с</span></div>
        ${i?c`<div class="quadrante ${i.reached?"bene":""}">
              <b>сведено</b><span>${(i.score*100).toFixed(0)} %</span>
            </div>`:null}
      </div>

      <div class="manopole">
        <div class="manopola">
          <label for="m-desired"><span>заявлено экземпляров</span><i>${this.desired}</i></label>
          <input
            id="m-desired"
            type="range"
            min="0"
            max=${A}
            step="1"
            .value=${String(this.desired)}
            @input=${r=>this.scala(Number(r.target.value))} />
        </div>
      </div>

      <div class="azioni">
        <button class="bottone" @click=${()=>this.acceleratore()}>
          ${this.acceso?"Остановить контроллер":"Пустить контроллер"}
        </button>
        <button class="bottone" @click=${()=>this.daccapo()}>Сначала</button>
      </div>

      <p class="esito ${i?.reached?"bene":""} ${this.acceso?"":"male"}">
        ${this.acceso?i?i.reached?"Сведено и удержано. Заметьте: вы ни разу не сказали «создай под».":`Цель: держать готовых столько, сколько заявлено, ${this.props.goal.hold} с подряд.`:e?"Заявленное и настоящее сошлись. Роняйте.":"Расхождение. Контроллер закроет его сам — посмотрите, за сколько.":"Контроллер остановлен. Заявка на месте, поды падают — и никто ничего не делает. Вот чем он занимался."}
      </p>
    </section>`}}customElements.define("cy-riconciliazione",_);export{_ as Riconciliazione};
