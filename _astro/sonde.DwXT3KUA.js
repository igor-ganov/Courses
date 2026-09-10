import{W as C,s as M,i as A,b,w}from"./base.EFBAa4pS.js";function R(k,r){let e={...k},t=0,o=[],n=0,l=0,h=0;function p(){t=0,n=0,l=0,h=0,o=Array.from({length:e.replicas},(i,c)=>({id:c+1,phase:"running",age:0,fails:0,latency:e.base,restarts:0,доПробы:e.period*(c+1)/e.replicas}))}p();const f=()=>t>=e.surgeAt&&t<e.surgeAt+e.surgeFor,m=()=>f()?e.surge:e.calm,u=i=>e.readiness?i.phase==="running":!0,s=()=>t>=e.surgeAt+e.surgeFor+10;function v(){return{time:Number(t.toFixed(2)),replicas:o.map(i=>({id:i.id,phase:i.phase,latency:Number(i.latency.toFixed(3)),fails:i.fails,serving:u(i),restarts:i.restarts})),load:m(),surging:f(),requests:Math.round(n),errors:Math.round(l),wasted:Math.round(h),errorRate:n>0?Number((l/n).toFixed(4)):0,restarts:o.reduce((i,c)=>i+c.restarts,0),done:s()}}function F(){if(s())return v();const i=e.dt;t+=i;for(const a of o)a.age+=i,a.phase==="starting"&&a.age>=e.startup&&(a.phase="running",a.age=0,a.fails=0);const c=o.filter(u),x=m()*i;if(n+=x,c.length===0){l+=x;for(const a of o)a.latency=0,a.доПробы-=i,a.доПробы<=0&&(a.доПробы=e.period);return v()}const $=m()/c.length;for(const a of o){if(!u(a)){a.latency=0;continue}const g=$/e.capacity;a.latency=e.base*(1+g*g)}for(const a of c){const g=x/c.length;if(a.phase==="starting"){l+=g,h+=g;continue}const y=$/e.capacity;y>e.queue&&(l+=g*Math.min(1,(y-e.queue)/y))}for(const a of o)a.доПробы-=i,!(a.доПробы>0)&&(a.доПробы=e.period,a.phase==="running"&&(a.latency>e.timeout?a.fails+=1:a.fails=0,a.fails>=e.threshold&&(a.phase="starting",a.age=0,a.fails=0,a.restarts+=1,a.latency=0)));return v()}return{step:F,state:v,reset:p,settings:()=>e,set(i){e={...e,...i}},goal(){if(!r)return{goal:"endured",reached:!1,score:0};const i=v(),c=i.done&&i.errorRate<=r.maxErrors,x=Math.min(1,t/(e.surgeAt+e.surgeFor+10)),$=Math.max(0,1-i.errorRate/Math.max(r.maxErrors,.001)/4);return{goal:"endured",reached:c,score:Math.min(1,x*$)}}}}const d={replicas:3,capacity:20,queue:2,base:.3,calm:45,surge:100,surgeAt:5,surgeFor:20,startup:4,period:2,timeout:1,threshold:1,readiness:!1,dt:.1};class q extends C{constructor(){super(...arguments),this.кадры=[],this.reported=!1,this.riferito=0}static{this.styles=[M,A`
      .repliche {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
        gap: 8px;
        margin: 0 0 12px;
      }

      .replica {
        position: relative;
        padding: 7px 6px 6px;
        min-height: calc(var(--шаг, 26px) * 2.7);
        text-align: center;
        color: var(--паста, #1b3a6b);
      }

      .replica::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='110' height='74' preserveAspectRatio='none'><path d='M11,6 C38,3 76,5 98,8 C104,9 106,15 106,25 C106,46 105,61 101,66 C76,71 36,70 13,67 C7,66 4,60 4,49 C4,28 5,12 8,8' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      .replica.starting::before {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='110' height='74' preserveAspectRatio='none'><path d='M11,6 C38,3 76,5 98,8 C104,9 106,15 106,25 C106,46 105,61 101,66 C76,71 36,70 13,67 C7,66 4,60 4,49 C4,28 5,12 8,8' fill='none' stroke='%23a8402f' stroke-width='1.4' stroke-linecap='round' stroke-dasharray='5 6'/></svg>");
        color: var(--красный, #a8402f);
      }

      .replica b {
        display: block;
        font-family: 'PT Mono', monospace;
        font-weight: 400;
        font-size: max(calc(12.5px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.2;
      }

      .replica i {
        display: block;
        font-style: normal;
        font-family: 'Literata', serif;
        font-size: max(calc(15px * var(--кегль, 1)), var(--пол, 0px));
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
      }

      .replica i.oltre {
        color: var(--красный, #a8402f);
      }

      .replica small {
        display: block;
        font-family: 'Caveat', cursive;
        font-size: max(calc(15px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.1;
        color: var(--тихий, #636a75);
      }

      /* Кривая всего прогона. Она и есть ответ прибора: подвинул ручку —
         сразу видно, что стало со всей историей, а не с текущей секундой. */
      svg.tela {
        display: block;
        width: 100%;
        height: auto;
        margin: 0 0 4px;
        touch-action: pan-y;
      }

      .etichetta {
        margin: 0 0 12px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(17px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.2;
        color: var(--тихий, #636a75);
        min-height: calc(var(--шаг, 26px) * 1.1);
      }

      .interruttore {
        position: relative;
        border: 0;
        background: none;
        cursor: pointer;
        padding: 7px 16px;
        min-height: 44px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(19px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.15;
        color: var(--тихий, #636a75);
      }

      .interruttore[aria-pressed='true'] {
        color: var(--паста, #1b3a6b);
      }

      .interruttore[aria-pressed='true']::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='46' preserveAspectRatio='none'><path d='M18,4 C62,1.5 118,3 145,6 C153,7 155,14 154,23 C153,33 152,39 145,41 C112,44 48,43 17,41 C8,40.5 5,34 5.5,24 C6,14 8,7 16,5' fill='none' stroke='%231b3a6b' stroke-width='1.6' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }
    `]}static{this.properties={timeout:{state:!0},threshold:{state:!0},readiness:{state:!0},tick:{state:!0}}}avvia(){this.timeout=d.timeout,this.threshold=d.threshold,this.readiness=d.readiness,this.tick=0,this.заново()}заново(){for(this.sonde=R({...d,timeout:this.timeout,threshold:this.threshold,readiness:this.readiness},this.props.goal??{maxErrors:.02}),this.кадры=[];!this.sonde.state().done;){const r=this.sonde.step();this.кадры.push({t:r.time,ready:r.replicas.filter(e=>e.phase==="running").length,latency:Math.max(...r.replicas.map(e=>e.latency),0),errors:r.errorRate})}this.reported=!1,this.riferito=0,this.tick+=1,this.донести()}донести(){if(this.reported)return;const r=this.sonde.goal();(r.reached||r.score>=this.riferito+.05)&&(this.riferito=r.score,this.reported=r.reached,this.riporta(r))}manopola(r,e,t,o,n,l=""){const h=this[e];return b`<div class="manopola">
      <label for=${`s-${e}`}><span>${r}</span><i>${h}${l}</i></label>
      <input
        id=${`s-${e}`}
        type="range"
        min=${t}
        max=${o}
        step=${n}
        .value=${String(h)}
        @input=${p=>{this[e]=Number(p.target.value),this.заново()}} />
    </div>`}tela(){const t=this.кадры;if(t.length<2)return null;const o=d.replicas,n=s=>s/(t.length-1)*620,l=s=>160-s/o*144;let h=`M0,${l(t[0].ready).toFixed(1)}`;for(let s=1;s<t.length;s+=1)t[s].ready!==t[s-1].ready&&(h+=`L${n(s).toFixed(1)},${l(t[s-1].ready).toFixed(1)}`),h+=`L${n(s).toFixed(1)},${l(t[s].ready).toFixed(1)}`;const p=t.findIndex(s=>s.t>=d.surgeAt),f=t.findIndex(s=>s.t>=d.surgeAt+d.surgeFor),m=p>=0?w`<rect
            x=${n(p).toFixed(1)}
            y="0"
            width=${(n(f<0?t.length-1:f)-n(p)).toFixed(1)}
            height=${170}
            fill="var(--красный, #a8402f)"
            opacity="0.17" />`:null,u=[];for(let s=1;s<t.length;s+=1)t[s].ready<t[s-1].ready&&u.push(s);return b`<svg
      class="tela"
      viewBox="0 0 ${620} ${170}"
      preserveAspectRatio="none"
      role="img"
      aria-label=${`Экземпляров в строю за прогон: минимум ${Math.min(...t.map(s=>s.ready))} из ${o}, перезапусков ${u.length}`}>
      ${m}
      ${""}
      ${[0,o].map(s=>w`<line
          x1="0"
          y1=${l(s).toFixed(1)}
          x2=${620}
          y2=${l(s).toFixed(1)}
          stroke="var(--грифель, #5c6068)"
          stroke-width="0.9"
          opacity="0.4" />`)}
      <path
        d=${h}
        fill="none"
        stroke="var(--паста, #1b3a6b)"
        stroke-width="2"
        stroke-linejoin="round" />
      ${u.map(s=>w`<path
          d=${`M${(n(s)-5).toFixed(1)},162 l10,8 M${(n(s)+5).toFixed(1)},162 l-10,8`}
          stroke="var(--красный, #a8402f)"
          stroke-width="1.6"
          fill="none" />`)}
    </svg>`}replica(r,e){const t=r.replicas[e],o=t.phase==="starting";return b`<div class="replica ${o?"starting":""}">
      <b>web-${t.id}</b>
      <i class=${!o&&t.latency>this.timeout?"oltre":""}
        >${o?"—":`${t.latency.toFixed(2)} с`}</i
      >
      <small
        >${o?"поднимается":t.serving?`отказов ${t.fails}`:"вне службы"}</small
      >
    </div>`}render(){const r=this.sonde.state(),e=this.props.goal??{maxErrors:.02},t=this.sonde.goal();return b`<section class="telaio">
      <h4>${this.props.title??"Наплыв и пробы"}</h4>
      <p class="suggerimento">
        ${this.props.hint??"Служба обязана пережить наплыв: очередь трёх экземпляров его держит. Убить её могут только ваши настройки. Двиньте срок пробы живости — весь прогон пересчитается сразу."}
      </p>

      ${this.tela()}
      <p class="etichetta">
        Сколько экземпляров в строю за прогон. Розовым — наплыв, крестиками внизу —
        перезапуски: каждый из них устроила проба живости.
      </p>

      <div class="repliche">${r.replicas.map((o,n)=>this.replica(r,n))}</div>
      <p class="etichetta">Состояние в конце прогона.</p>

      <div class="quadranti">
        <div class="quadrante ${r.errorRate>e.maxErrors?"male":"bene"}">
          <b>потеряно</b><span>${(r.errorRate*100).toFixed(1)} %</span>
        </div>
        <div class="quadrante ${r.wasted>0?"male":""}">
          <b>в пустоту</b><span>${r.wasted}</span>
        </div>
        <div class="quadrante ${r.restarts>0?"male":""}">
          <b>перезапусков</b><span>${r.restarts}</span>
        </div>
        <div class="quadrante"><b>время</b><span>${r.time.toFixed(0)} с</span></div>
      </div>

      <div class="manopole">
        ${this.manopola("срок живости","timeout",.4,4,.1," с")}
        ${this.manopola("отказов подряд","threshold",1,5,1)}
      </div>

      <div class="azioni">
        <button
          class="interruttore"
          aria-pressed=${this.readiness?"true":"false"}
          @click=${()=>{this.readiness=!this.readiness,this.заново()}}>
          Проба готовности: ${this.readiness?"включена":"выключена"}
        </button>
        <button
          class="bottone"
          @click=${()=>{this.timeout=d.timeout,this.threshold=d.threshold,this.readiness=d.readiness,this.заново()}}>
          Как было
        </button>
      </div>

      <p class="esito ${t.reached?"bene":""} ${t.reached?"":"male"}">
        ${t.reached?"Наплыв пережит без потерь. Проба живости при этом ни разу не сработала — и это правильно: она отвечает на вопрос «нужен ли перезапуск», а не «хорошо ли идут дела».":`Потеряно ${(r.errorRate*100).toFixed(0)} % запросов при ${r.restarts} перезапусках — и ни одна программа не была сломана. Убила службу проба: медленно не значит зависла.`}
      </p>
    </section>`}}customElements.define("cy-sonde",q);export{q as SondeWidget};
