import{W as h,s as g,i as u,b as d}from"./base.EFBAa4pS.js";function v(s,e){const t=s.labels[e.key];return e.op==="eq"?t===e.value:t!==e.value}function m(s){let e=s.conditions.map(()=>!1);function t(){const a=s.conditions.filter((o,n)=>e[n]);return s.pods.filter(o=>a.every(n=>v(o,n))).map(o=>o.id)}function i(){const a=t(),o=new Set(s.target),n=new Set(a),p=[...o].filter(r=>!n.has(r)),l=a.filter(r=>!o.has(r));return{pods:s.pods,conditions:s.conditions,on:[...e],matched:a,missing:p,extra:l,solved:p.length===0&&l.length===0}}return{state:i,toggle(a){a<0||a>=e.length||(e[a]=!e[a])},reset(){e=s.conditions.map(()=>!1)},goal(){const a=i(),o=s.target.length,n=o-a.missing.length,p=Math.max(0,(n-a.extra.length)/Math.max(1,o));return{goal:"selected",reached:a.solved,score:Math.min(1,p)}}}}const b={pods:[{id:1,name:"web-a",labels:{app:"web",tier:"frontend",release:"stable"}},{id:2,name:"web-b",labels:{app:"web",tier:"frontend",release:"canary"}},{id:3,name:"api-c",labels:{app:"api",tier:"backend",release:"stable"}},{id:4,name:"api-d",labels:{app:"api",tier:"backend",release:"canary"}},{id:5,name:"cache-e",labels:{app:"cache",tier:"backend",release:"stable"}},{id:6,name:"web-f",labels:{app:"web",tier:"backend",release:"stable"}}],conditions:[{key:"app",op:"eq",value:"web"},{key:"app",op:"eq",value:"api"},{key:"tier",op:"eq",value:"frontend"},{key:"tier",op:"eq",value:"backend"},{key:"release",op:"ne",value:"canary"}],target:[1,6]},f={eq:"=",ne:"!="};function w(s){return s?d`<span
    style=${`display:block;width:100%;height:100%;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14'><path d='${s==="preso"?"M2,8 C3.5,9.5 4.5,11 5.5,12.5 C7.5,9 9.5,5 12.5,2":s==="troppo"?"M7,2 C7.2,5 7.1,9 7,12.5 M2,7.2 C5,7 9,7.1 12.5,7":"M2,7.2 C5,7 9,7.1 12.5,7"}' fill='none' stroke='${s==="preso"?"%233f6b4a":"%23a8402f"}' stroke-width='1.8' stroke-linecap='round'/></svg>") no-repeat center/100% 100%`}
  ></span>`:null}class x extends h{constructor(){super(...arguments),this.reported=!1,this.riferito=0}static{this.styles=[g,u`
      .condizioni {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 0 0 14px;
        /* Два ряда отведены заранее: условий пять, и на узком экране они
           встают в два ряда — но всегда в два, сколько бы ни было включено. */
        min-height: calc(var(--шаг, 26px) * 3.4);
        align-content: flex-start;
      }

      .cond {
        position: relative;
        border: 0;
        background: none;
        cursor: pointer;
        padding: 6px 14px;
        min-height: 40px;
        font-family: 'PT Mono', monospace;
        font-size: max(calc(13px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.2;
        color: var(--тихий, #636a75);
      }

      .cond[aria-pressed='true'] {
        color: var(--паста, #1b3a6b);
      }

      .cond[aria-pressed='true']::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='42' preserveAspectRatio='none'><path d='M16,4 C54,2 104,3 126,6 C133,7 135,13 134,21 C133,30 132,36 126,38 C96,41 42,40 15,38 C8,37 5,31 5,22 C5,13 8,7 14,5' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      .cond[aria-pressed='false']::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='42' preserveAspectRatio='none'><path d='M16,4 C54,2 104,3 126,6 C133,7 135,13 134,21 C133,30 132,36 126,38 C96,41 42,40 15,38 C8,37 5,31 5,22 C5,13 8,7 14,5' fill='none' stroke='%235c6068' stroke-width='1.1' stroke-linecap='round' stroke-dasharray='4 5' opacity='.5'/></svg>")
          no-repeat center / 100% 100%;
      }

      /* Метки не обрезаются: значение метки — это и есть содержание задачи,
         и «tier=fr...» превращает головоломку в угадайку. Поэтому клетка
         шире (на телефоне их два в ряд), а строки не усекаются. */
      .campo {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
        gap: 8px;
        margin: 0 0 12px;
      }

      .pod {
        position: relative;
        padding: 7px 10px 6px;
        min-height: calc(var(--шаг, 26px) * 3);
      }

      .pod::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80' preserveAspectRatio='none'><path d='M12,6 C40,3 82,5 106,8 C112,9 114,15 114,26 C114,50 113,66 109,72 C82,77 38,76 14,73 C8,72 5,66 5,54 C5,30 6,12 9,8' fill='none' stroke='%235c6068' stroke-width='1.1' stroke-linecap='round' stroke-dasharray='4 5' opacity='.45'/></svg>")
          no-repeat center / 100% 100%;
      }

      /* Попал и нужен — обведён пастой. Попал и лишний — красным.
         Нужен и не попал — красным пунктиром: видно, что его потеряли. */
      .pod.preso::before {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80' preserveAspectRatio='none'><path d='M12,6 C40,3 82,5 106,8 C112,9 114,15 114,26 C114,50 113,66 109,72 C82,77 38,76 14,73 C8,72 5,66 5,54 C5,30 6,12 9,8' fill='none' stroke='%231b3a6b' stroke-width='1.7' stroke-linecap='round'/></svg>");
      }

      .pod.troppo::before {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80' preserveAspectRatio='none'><path d='M12,6 C40,3 82,5 106,8 C112,9 114,15 114,26 C114,50 113,66 109,72 C82,77 38,76 14,73 C8,72 5,66 5,54 C5,30 6,12 9,8' fill='none' stroke='%23a8402f' stroke-width='1.7' stroke-linecap='round'/></svg>");
      }

      .pod.perso::before {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80' preserveAspectRatio='none'><path d='M12,6 C40,3 82,5 106,8 C112,9 114,15 114,26 C114,50 113,66 109,72 C82,77 38,76 14,73 C8,72 5,66 5,54 C5,30 6,12 9,8' fill='none' stroke='%23a8402f' stroke-width='1.4' stroke-linecap='round' stroke-dasharray='5 6'/></svg>");
      }

      .pod b {
        display: block;
        font-family: 'PT Mono', monospace;
        font-weight: 400;
        font-size: max(calc(12.5px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.2;
        color: var(--паста, #1b3a6b);
      }

      .pod span {
        display: block;
        font-family: 'PT Mono', monospace;
        font-size: max(calc(11px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.35;
        color: var(--тихий, #636a75);
        white-space: nowrap;
      }

      /* Знаки нарисованы, а не набраны. Причина простая: галочки в урезанных
         шрифтах тетради нет, и набранная превратилась бы в квадратик. Но и
         будь она там — рисовать вернее: на листе, где всё сделано пастой в
         один проход, типографский знак читается как чужой. */
      .segno {
        position: absolute;
        top: 5px;
        right: 8px;
        width: 14px;
        height: 14px;
      }

      .segno svg {
        display: block;
        width: 100%;
        height: 100%;
      }
    `]}static{this.properties={tick:{state:!0}}}avvia(){this.tick=0,this.sel=m(b)}toggle(e){if(this.sel.toggle(e),this.tick+=1,!this.props.goal||this.reported)return;const t=this.sel.goal();(t.reached||t.score>=this.riferito+.2)&&(this.riferito=t.score,this.reported=t.reached,this.riporta(t))}pod(e,t){const i=e.pods.find(r=>r.id===t),a=e.matched.includes(t),o=e.extra.includes(t),n=e.missing.includes(t),p=o?"troppo":n?"perso":a?"preso":"",l=o?"лишний":n?"потерян":a?"взят":"";return d`<div class="pod ${p}" aria-label=${`${i.name}${l?", "+l:""}`}>
      <span class="segno" aria-hidden="true">${w(o?"troppo":n?"perso":a?"preso":"")}</span>
      <b>${i.name}</b>
      ${Object.entries(i.labels).map(([r,c])=>d`<span>${r}=${c}</span>`)}
    </div>`}render(){const e=this.sel.state();return d`<section class="telaio">
      <h4>${this.props.title??"Отбор по метке"}</h4>
      <p class="suggerimento">
        ${this.props.hint??"Включайте условия и смотрите на выборку: галочка — взят и нужен, плюс — лишний, минус — нужен, но потерян."}
      </p>

      <div class="condizioni" role="group" aria-label="Условия отбора">
        ${e.conditions.map((t,i)=>d`<button
            class="cond"
            aria-pressed=${e.on[i]?"true":"false"}
            @click=${()=>this.toggle(i)}>
            ${t.key}${f[t.op]}${t.value}
          </button>`)}
      </div>

      <div class="campo">${e.pods.map(t=>this.pod(e,t.id))}</div>

      <div class="quadranti">
        <div class="quadrante ${e.solved?"bene":""}"><b>отобрано</b><span>${e.matched.length}</span></div>
        <div class="quadrante ${e.extra.length>0?"male":""}"><b>лишних</b><span>${e.extra.length}</span></div>
        <div class="quadrante ${e.missing.length>0?"male":""}"><b>потеряно</b><span>${e.missing.length}</span></div>
      </div>

      <div class="azioni">
        <button
          class="bottone"
          @click=${()=>{this.sel.reset(),this.tick+=1}}>
          Снять всё
        </button>
      </div>

      <p class="esito ${e.solved?"bene":""}">
        ${e.solved?"Попали ровно в нужных. Заметьте, что условие описывает признак, а не перечисляет имена: поды сменятся — условие останется верным.":e.missing.length>0?"Кого-то потеряли. Посмотрите, чем потерянный отличается от взятых, — и не то ли это отличие, которое к делу не относится.":"Взяли лишнего. Служба будет слать на него запросы, а он к делу не относится."}
      </p>
    </section>`}}customElements.define("cy-selettore",x);export{x as SelettoreWidget};
