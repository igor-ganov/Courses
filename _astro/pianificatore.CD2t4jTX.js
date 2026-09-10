import{W as k,s as y,i as z,b as h}from"./base.EFBAa4pS.js";const C=()=>({cpu:0,mem:0});function M(p,t){let a=p.nodi.map(C),i=[],s=[...p.coda],r=[],c;function g(o){const n=p.nodi[o],e=a[o];return{cpu:n.cpu-e.cpu,mem:n.mem-e.mem}}function d(o,n){const e=g(o);return e.cpu<n.cpu&&e.mem<n.mem?{adatto:!1,perche:"мало ядер и памяти"}:e.cpu<n.cpu?{adatto:!1,perche:"мало ядер"}:e.mem<n.mem?{adatto:!1,perche:"мало памяти"}:{adatto:!0}}function f(o,n){const e=p.nodi[o],u=a[o],l=(u.cpu+n.cpu)/e.cpu,v=(u.mem+n.mem)/e.mem,b=(1-l+(1-v))/2,m=1-Math.abs(l-v);return Math.round((b*.5+m*.5)*100)}function x(){return{nodi:p.nodi,occupato:a.map(o=>({...o})),posti:i.map(o=>({...o})),coda:[...s],attesa:[...r],...c?{ultimo:c}:{}}}return{state:x,invia(o){const n=o===void 0?0:s.findIndex(m=>m.id===o);if(n<0)return;const e=s.splice(n,1)[0];if(!e)return;const u=p.nodi.map((m,$)=>{const w=d($,e);return{nodo:m.id,adatto:w.adatto,...w.perche?{perche:w.perche}:{},punti:w.adatto?f($,e):0}});let l=-1,v=-1;if(u.forEach((m,$)=>{m.adatto&&m.punti>v&&(v=m.punti,l=$)}),l<0)return r.push(e),c={pod:e.id,verdetti:u},c;const b=a[l];return a[l]={cpu:b.cpu+e.cpu,mem:b.mem+e.mem},i.push({pod:e,nodo:p.nodi[l].id}),c={pod:e.id,nodo:p.nodi[l].id,verdetti:u},c},reset(){a=p.nodi.map(C),i=[],s=[...p.coda],r=[],c=void 0},goal(){return t?{goal:"placed",reached:i.length>=t.placed&&r.length===0,score:Math.min(1,i.length/t.placed)}:{goal:"placed",reached:!1,score:0}}}}const A={nodi:[{id:1,name:"узел-1",cpu:4,mem:8},{id:2,name:"узел-2",cpu:4,mem:8}],coda:[{id:1,name:"веб-1",cpu:1,mem:2},{id:2,name:"веб-2",cpu:1,mem:2},{id:3,name:"веб-3",cpu:1,mem:2},{id:4,name:"веб-4",cpu:1,mem:2},{id:5,name:"счёт",cpu:3,mem:2}]};class q extends k{constructor(){super(...arguments),this.reported=!1}static{this.styles=[y,z`
      .nodi {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
        margin: 0 0 14px;
      }

      .nodo {
        position: relative;
        padding: 8px 12px 10px;
        /* Высота задана: узел с двумя подами и узел с пятью занимают одинаково,
           иначе прибор дышал бы при каждой отправке. */
        min-height: calc(var(--шаг, 26px) * 4.6);
      }

      .nodo::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='120' preserveAspectRatio='none'><path d='M12,6 C60,3 130,5 168,9 C174,10 176,18 176,32 C176,72 175,102 171,111 C130,116 60,115 15,112 C8,111 5,102 5,88 C5,48 6,18 9,10' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      /* Отсеянный узел гасится, а не прячется: видно, что он рассматривался. */
      .nodo.fuori {
        opacity: 0.45;
      }

      .nodo.scelto::after {
        content: '';
        position: absolute;
        inset: -4px;
        pointer-events: none;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='120' preserveAspectRatio='none'><path d='M12,6 C60,3 130,5 168,9 C174,10 176,18 176,32 C176,72 175,102 171,111 C130,116 60,115 15,112 C8,111 5,102 5,88 C5,48 6,18 9,10' fill='none' stroke='%233f6b4a' stroke-width='1.8' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      .nodo h5 {
        margin: 0 0 4px;
        font-family: 'Caveat', cursive;
        font-weight: 700;
        font-size: max(calc(19px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.1;
        color: var(--паста, #1b3a6b);
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }

      .nodo h5 i {
        font-style: normal;
        font-family: 'Literata', serif;
        font-size: max(calc(14px * var(--кегль, 1)), var(--пол, 0px));
        font-variant-numeric: tabular-nums;
        color: var(--грифель, #5c6068);
      }

      /* Одна шкала — одна строка: имя, полоса, число. Двухрядная сетка тут
         уже была, и числа в ней висели посреди пустого места, оторванные от
         своей полосы. */
      .scala {
        display: grid;
        grid-template-columns: 3.9em 1fr auto;
        align-items: center;
        gap: 0 7px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(16px * var(--кегль, 1)), var(--пол, 0px));
        line-height: calc(var(--шаг, 26px) * 0.85);
        color: var(--тихий, #636a75);
      }

      .scala b {
        font-weight: 500;
        font-family: 'Literata', serif;
        font-size: max(calc(12.5px * var(--кегль, 1)), var(--пол, 0px));
        font-variant-numeric: tabular-nums;
        color: var(--грифель, #5c6068);
        white-space: nowrap;
      }

      .barra {
        position: relative;
        height: 6px;
        background: color-mix(in srgb, var(--грифель, #5c6068) 18%, transparent);
      }

      .barra i {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--паста, #1b3a6b);
      }

      .barra.pieno i {
        background: var(--красный, #a8402f);
      }

      .abitanti {
        margin: 6px 0 0;
        font-family: 'PT Mono', monospace;
        font-size: max(calc(12px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.35;
        color: var(--грифель, #5c6068);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .coda {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 0 0 10px;
        /* Два ряда фишек отведены заранее: очередь пустеет по ходу дела. */
        min-height: calc(var(--шаг, 26px) * 2.8);
        align-content: flex-start;
      }

      .fiche {
        position: relative;
        border: 0;
        background: none;
        cursor: pointer;
        padding: 5px 14px;
        min-height: 40px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(18px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.1;
        color: var(--паста, #1b3a6b);
      }

      .fiche::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='42' preserveAspectRatio='none'><path d='M14,4 C48,2 90,3 108,6 C114,7 116,13 115,21 C114,30 113,35 107,37 C82,40 36,39 13,37 C7,36 4,31 4,22 C4,13 6,7 12,5' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      .fiche b {
        font-weight: 500;
      }

      .fiche span {
        /* Отступ обязателен: рукописное имя заваливается вправо и без него
           упирается в цифры — «веб-11 / 2Г» вместо «веб-1  1/2Г». */
        margin-left: 6px;
        font-family: 'Literata', serif;
        font-size: max(calc(13px * var(--кегль, 1)), var(--пол, 0px));
        color: var(--тихий, #636a75);
        font-variant-numeric: tabular-nums;
      }

      .fiche.attesa {
        color: var(--красный, #a8402f);
        cursor: default;
      }

      .fiche.attesa::before {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='42' preserveAspectRatio='none'><path d='M14,4 C48,2 90,3 108,6 C114,7 116,13 115,21 C114,30 113,35 107,37 C82,40 36,39 13,37 C7,36 4,31 4,22 C4,13 6,7 12,5' fill='none' stroke='%23a8402f' stroke-width='1.5' stroke-linecap='round' stroke-dasharray='4 5'/></svg>");
      }

      .etichetta {
        margin: 0 0 4px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(17px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.2;
        color: var(--тихий, #636a75);
      }
    `]}static{this.properties={tick:{state:!0}}}avvia(){this.tick=0,this.sched=M(A,this.props.goal)}invia(t){if(this.sched.invia(t),this.tick+=1,this.props.goal&&!this.reported){const a=this.sched.goal();a.reached&&(this.reported=!0,this.riporta(a))}}daccapo(){this.reported=!1,this.sched.reset(),this.tick+=1}nodo(t,a){const i=t.nodi[a],s=t.occupato[a],r=t.ultimo?.verdetti.find(d=>d.nodo===i.id),c=t.posti.filter(d=>d.nodo===i.id).map(d=>d.pod.name),g=(d,f,x,o)=>{const n=Math.min(1,f/x);return h`<div class="scala">
        <span>${d}</span>
        <span class="barra ${n>.98?"pieno":""}"
          ><i style=${`width:${(n*100).toFixed(0)}%`}></i
        ></span>
        <b>${f.toFixed(f%1?1:0)}/${x}${o}</b>
      </div>`};return h`<div
      class="nodo ${r&&!r.adatto?"fuori":""} ${t.ultimo?.nodo===i.id?"scelto":""}">
      <h5>
        <span>${i.name}</span>
        <i>${r?r.adatto?`${r.punti} б.`:r.perche??"не подошёл":""}</i>
      </h5>
      ${g("ядра",s.cpu,i.cpu,"")} ${g("память",s.mem,i.mem," Г")}
      <p class="abitanti">${c.length>0?c.join(" · "):" "}</p>
    </div>`}fiche(t,a){const i=h`<b>${t.name}</b> <span>${t.cpu} / ${t.mem}Г</span>`;return a?h`<span class="fiche attesa" title="Не нашлось узла">${i}</span>`:h`<button
      class="fiche"
      aria-label=${`Отправить под ${t.name}, заявка ${t.cpu} ядра и ${t.mem} гигабайт`}
      @click=${()=>this.invia(t.id)}>
      ${i}
    </button>`}render(){const t=this.sched.state(),a=this.props.goal?this.sched.goal():void 0,i=t.coda.length===0;return h`<section class="telaio">
      <h4>${this.props.title??"Куда поедет под"}</h4>
      <p class="suggerimento">
        ${this.props.hint??"Отправляйте поды по одному, в любом порядке. Серым отмечены узлы, отсеянные на первом приёме; числом — баллы оставшихся."}
      </p>

      <div class="nodi">${t.nodi.map((s,r)=>this.nodo(t,r))}</div>

      <p class="etichetta">Ждут отправки — коснитесь, чтобы отправить</p>
      <div class="coda">
        ${t.coda.map(s=>this.fiche(s,!1))}
        ${t.attesa.map(s=>this.fiche(s,!0))}
        ${t.coda.length===0&&t.attesa.length===0?h`<span class="etichetta">пусто: все размещены</span>`:null}
      </div>

      <div class="quadranti">
        <div class="quadrante ${t.attesa.length===0?"bene":""}">
          <b>размещено</b><span>${t.posti.length}</span>
        </div>
        <div class="quadrante ${t.attesa.length>0?"male":""}">
          <b>в ожидании</b><span>${t.attesa.length}</span>
        </div>
        <div class="quadrante"><b>не отправлены</b><span>${t.coda.length}</span></div>
        <div class="quadrante">
          <b>свободно ядер</b>
          <span
            >${t.nodi.reduce((s,r,c)=>s+r.cpu-t.occupato[c].cpu,0).toFixed(1)}</span
          >
        </div>
      </div>

      <div class="azioni">
        <button class="bottone" @click=${()=>this.daccapo()}>Сначала</button>
      </div>

      <p class="esito ${a?.reached?"bene":""} ${t.attesa.length>0?"male":""}">
        ${t.attesa.length>0?"Под остался в ожидании. Свободные ядра ещё есть — но лежат кусками по разным узлам, и целиком заявка не помещается никуда. Начните сначала и отправьте крупные раньше мелких.":a?a.reached?"Все размещены. Планировщик не мог этого добиться сам: он видит по одному поду за раз и не знает, что придёт следующим.":i?"Очередь пуста.":`Цель: разместить все ${this.props.goal.placed}, не оставив никого в ожидании.`:"Отправляйте поды и смотрите на баллы."}
      </p>
    </section>`}}customElements.define("cy-pianificatore",q);export{q as Pianificatore};
