import{W as m,s as x,i as $,b as p}from"./base.EFBAa4pS.js";function k(f){let t={...f},e=0,s=0,i=0,o=0,n=0,c=0,d=0,r=0,l=0,h=0;function u(){e=0,s=0,i=0,o=0,n=t.period,c=0,d=0,r=0,l=0,h=0}u();function g(){return{time:Number(e.toFixed(2)),rate:Math.round(h),total:Math.round(s),changes:i,perChange:i>0?Number((s/i).toFixed(2)):0,queued:o,bursting:e<d}}function v(){const a=t.dt;return e+=a,t.modo==="porta"?(n-=a,n<=0&&(n=t.period,t.cheap||(s+=t.objects*t.watchers,r+=t.objects*t.watchers))):(c-=a,c<=0&&o>0&&(o-=1,s+=1,r+=1,c=.25)),l+=a,l>=1&&(h=r/l,r=0,l=0),g()}return{step:v,state:g,reset:u,settings:()=>t,set(a){t={...t,...a},(a.modo!==void 0||a.cheap!==void 0)&&u()},burst(a=100){if(i+=a,d=e+.6,t.modo==="porta"){t.cheap&&(s+=a*t.watchers,r+=a*t.watchers);return}o+=t.cheap?o>0?0:1:a}}}const b={modo:"porta",objects:1e3,watchers:30,period:1,cheap:!1,dt:.1},w={modo:"coda",objects:1e3,watchers:1,period:1,cheap:!1,dt:.1},C={porta:{дорого:"Опрос",дорогоМелко:"каждый тянет весь список раз в секунду",дёшево:"Слежение",дёшевоМелко:"дверь шлёт только изменения",работа:"объектов через дверь",темп:"в секунду",пачка:"Выкатка: 100 изменений",итогДорого:"Тридцать тысяч объектов в секунду через одну дверь — и это в спокойном кластере, где ничего не происходит. Дверь становится узким местом раньше всего остального.",итогДёшево:"В спокойном кластере дверь молчит. Платит она только за само изменение — по одному сообщению каждому, кто следит; читают все из своих копий."},coda:{дорого:"По событию",дорогоМелко:"каждое изменение — своя обработка",дёшево:"По ключу",дёшевоМелко:"повтор ключа очередь не удлиняет",работа:"обработок",темп:"в секунду",пачка:"Выкатка: 100 изменений",итогДорого:"Сто изменений одного объекта дали сто обработок, и разбирает их очередь долго. Каждая следующая работает по картине, которая уже устарела.",итогДёшево:"Сто изменений дали один ключ и одну обработку. Схлопывать можно только потому, что обработка смотрит на состояние, а не на событие: текущая картина уже вобрала все сто."}};class q extends m{static{this.styles=[x,$`
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

      /* Полоса работы: видно не число, а поток. */
      .flusso {
        position: relative;
        height: 8px;
        margin: 0 0 4px;
        background: color-mix(in srgb, var(--грифель, #5c6068) 16%, transparent);
      }

      .flusso i {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--паста, #1b3a6b);
      }

      .flusso.molto i {
        background: var(--красный, #a8402f);
      }

      .etichetta {
        margin: 0 0 12px;
        min-height: calc(var(--шаг, 26px) * 1.1);
        font-family: 'Caveat', cursive;
        font-size: max(calc(17px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.2;
        color: var(--тихий, #636a75);
      }

      /* Очередь — рядок клеток: длина очереди видна как длина, а не как цифра. */
      .fila {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        margin: 0 0 12px;
        min-height: calc(var(--шаг, 26px) * 2.6);
        align-content: flex-start;
      }

      .cella {
        width: 9px;
        height: 9px;
        background: var(--паста, #1b3a6b);
      }

      .cella.oltre {
        background: var(--красный, #a8402f);
      }
    `]}static{this.properties={дёшево:{state:!0},tick:{state:!0}}}get обличье(){return this.props.modo??"porta"}get слова(){return C[this.обличье]}avvia(){this.дёшево=!1,this.tick=0,this.coda=k({...this.обличье==="porta"?b:w,cheap:!1}),this.stop=this.loop(()=>{for(let t=0;t<2;t+=1)this.coda.step();this.tick+=1})}ferma(){this.stop?.()}сторона(t){this.дёшево!==t&&(this.дёшево=t,this.coda.set({cheap:t}),this.tick+=1)}fila(t){const e=Math.min(40,t.queued);return p`<div class="fila" role="img" aria-label=${`В очереди ${t.queued}`}>
      ${Array.from({length:e},()=>p`<span class="cella ${t.queued>10?"oltre":""}"></span>`)}
      ${t.queued>e?p`<span class="etichetta">и ещё ${t.queued-e}</span>`:null}
    </div>`}render(){const t=this.coda.state(),e=this.слова,s=this.обличье==="porta"?b.objects*b.watchers:8,i=Math.min(1,t.rate/s);return p`<section class="telaio">
      <h4>${this.props.title??(this.обличье==="porta"?"Одна дверь":"Очередь ключей")}</h4>
      <p class="suggerimento">
        ${this.props.hint??(this.обличье==="porta"?"Тысяча объектов, тридцать наблюдателей. Переключите способ и посмотрите на поток через дверь.":"Нажмите «выкатку» — она даёт сто изменений одного объекта. Потом переключите способ и нажмите снова.")}
      </p>

      <div class="scelta" role="group" aria-label="Способ">
        <button
          class="lato"
          aria-pressed=${this.дёшево?"false":"true"}
          @click=${()=>this.сторона(!1)}>
          ${e.дорого}<small>${e.дорогоМелко}</small>
        </button>
        <button
          class="lato"
          aria-pressed=${this.дёшево?"true":"false"}
          @click=${()=>this.сторона(!0)}>
          ${e.дёшево}<small>${e.дёшевоМелко}</small>
        </button>
      </div>

      <div
        class="flusso ${i>.5?"molto":""}"
        role="img"
        aria-label=${`${t.rate} ${e.работа} ${e.темп}`}>
        <i style=${`width:${(i*100).toFixed(0)}%`}></i>
      </div>
      <p class="etichetta">${t.rate} ${e.работа} ${e.темп}</p>

      ${this.обличье==="coda"?this.fila(t):null}

      <div class="quadranti">
        <div class="quadrante ${this.дёшево?"bene":"male"}">
          <b>${e.работа}</b><span>${t.total}</span>
        </div>
        <div class="quadrante"><b>изменений</b><span>${t.changes}</span></div>
        <div class="quadrante ${this.дёшево?"bene":"male"}">
          <b>на изменение</b><span>${t.changes>0?t.perChange:"—"}</span>
        </div>
        <div class="quadrante"><b>время</b><span>${t.time.toFixed(0)} с</span></div>
      </div>

      <div class="azioni">
        <button class="bottone" @click=${()=>this.coda.burst()}>${e.пачка}</button>
        <button
          class="bottone"
          @click=${()=>{this.coda.reset(),this.tick+=1}}>
          Сначала
        </button>
      </div>

      <p class="esito ${this.дёшево?"bene":"male"}">
        ${this.дёшево?e.итогДёшево:e.итогДорого}
      </p>
    </section>`}}customElements.define("cy-coda",q);export{q as CodaWidget};
