import{W as u,s as b,a as f,b as m,i as y}from"./base.EFBAa4pS.js";function d(a){return-a.reduce((t,s)=>s>0?t+s*Math.log2(s):t,0)+0}const g=a=>a>0?Math.log2(a):0;function $(a){const t=g(a.length);return t>0?1-d(a)/t:0}function w(a){const t=a.filter(i=>i.weight>0);if(t.length===0)return[];const s=t.reduce((i,e)=>i+e.weight,0);if(t.length===1)return[{symbol:t[0].symbol,probability:1,code:"0"}];let r=0;const n=t.map(i=>({weight:i.weight,symbol:i.symbol,order:r++})),l=()=>{let i=0;for(let e=1;e<n.length;e+=1){const c=n[e],h=n[i];(c.weight<h.weight||c.weight===h.weight&&c.order<h.order)&&(i=e)}return n.splice(i,1)[0]};for(;n.length>1;){const i=l(),e=l();n.push({weight:i.weight+e.weight,left:i,right:e,order:r++})}const p=[],o=(i,e)=>{if(i.symbol!==void 0){p.push({symbol:i.symbol,probability:i.weight/s,code:e});return}i.left&&o(i.left,`${e}0`),i.right&&o(i.right,`${e}1`)};return o(n[0],""),p.sort((i,e)=>e.probability-i.probability||i.symbol.localeCompare(e.symbol))}const x=a=>a.reduce((t,s)=>t+s.probability*s.code.length,0);function q(a){let t=a>>>0;return()=>{t=t+1831565813>>>0;let s=Math.imul(t^t>>>15,1|t);return s=s+Math.imul(s^s>>>7,61|s)^s,((s^s>>>14)>>>0)/4294967296}}function F(a,t,s){const r=q(s);return a.map(n=>r()<t?n^1:n)}const M=a=>a<=0||a>=1?1:1-d([a,1-a]);function k(a){const t=[a[0]??0,a[1]??0,a[2]??0,a[3]??0],s=t[0]^t[1]^t[3],r=t[0]^t[2]^t[3],n=t[1]^t[2]^t[3];return[s,r,t[0],n,t[1],t[2],t[3]]}function C(a){const t=[0,...a.slice(0,7)],s=t[1]^t[3]^t[5]^t[7],r=t[2]^t[3]^t[6]^t[7],n=t[4]^t[5]^t[6]^t[7],l=s+r*2+n*4;return l>0&&l<=7&&(t[l]=t[l]^1),{data:[t[3],t[5],t[6],t[7]],errorAt:l,corrected:l>0}}const E=a=>[...a].flatMap(t=>{const s=t.codePointAt(0);return[7,6,5,4,3,2,1,0].map(r=>s>>r&1)}),v=y`
  .tavola {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    gap: 6px 14px;
    align-items: center;
    margin-bottom: 14px;
    font-variant-numeric: tabular-nums;
  }

  .tavola .lettera {
    font-family: 'Caveat', cursive;
    font-size: max(calc(22px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--паста, #1b3a6b);
  }

  .tavola .codice {
    font-family: 'PT Mono', monospace;
    font-size: max(calc(14px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--грифель, #5c6068);
  }

  .bit {
    display: inline-block;
    width: 1.1em;
    text-align: center;
    font-family: 'PT Mono', monospace;
  }

  .bit.rotto {
    color: var(--красный, #a8402f);
    font-weight: 700;
  }

  .bit.curato {
    color: var(--зелёный, #3f6b4a);
  }
`,T=[{symbol:"о",weight:45},{symbol:"е",weight:25},{symbol:"а",weight:16},{symbol:"и",weight:9},{symbol:"т",weight:5}];class z extends u{constructor(){super(...arguments),this.symbols=[]}static{this.styles=[b,v]}static{this.properties={weights:{state:!0}}}avvia(){const t=this.props.symbols??T;this.symbols=t.map(s=>s.symbol),this.weights=t.map(s=>s.weight)}render(){const t=this.symbols.map((o,i)=>({symbol:o,weight:this.weights[i]??0})),s=w(t),r=s.map(o=>o.probability),n=d(r),l=x(s),p=g(t.filter(o=>o.weight>0).length);return m`<section class="telaio">
      <h4>${this.props.title??"Энтропия и код"}</h4>
      <p class="suggerimento">
        ${this.props.hint??"Двигайте частоты. Чем ровнее распределение, тем больше энтропия и тем меньше можно сэкономить на коде."}
      </p>

      <div class="tavola">
        ${t.map((o,i)=>m`
            <span class="lettera">${o.symbol}</span>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              .value=${String(o.weight)}
              aria-label=${`частота «${o.symbol}»`}
              @input=${e=>{const c=[...this.weights];c[i]=Number(e.target.value),this.weights=c}} />
            <span class="codice">${(s.find(e=>e.symbol===o.symbol)?.probability??0).toFixed(3)}</span>
            <span class="codice">${s.find(e=>e.symbol===o.symbol)?.code??"—"}</span>
          `)}
      </div>

      <div class="quadranti">
        <div class="quadrante"><b>энтропия</b><span>${n.toFixed(3)} бит</span></div>
        <div class="quadrante"><b>максимум</b><span>${p.toFixed(3)} бит</span></div>
        <div class="quadrante"><b>избыточность</b><span>${($(r)*100).toFixed(1)} %</span></div>
        <div class="quadrante"><b>средняя длина кода</b><span>${l.toFixed(3)} бит</span></div>
      </div>

      <p class="esito">
        ${l<n+1?`Код короче энтропии не бывает: ${n.toFixed(2)} ≤ ${l.toFixed(2)} < ${(n+1).toFixed(2)}. Это теорема, а не совпадение.`:""}
      </p>
    </section>`}}class P extends u{constructor(){super(...arguments),this.riferito=!1}static{this.styles=[b,f,v]}static{this.properties={p:{state:!0},hamming:{state:!0},seed:{state:!0}}}avvia(){this.p=this.props.p??.08,this.hamming=!1,this.seed=1}засчитать(t){const s=this.props.goal;!s||this.riferito||!(t===0&&this.p>=s.noise)||(this.riferito=!0,this.riporta({goal:"delivered",reached:!0,score:1}))}render(){const t=this.props.message??"связь",s=E(t).slice(0,32),r=[];for(let e=0;e<s.length;e+=4)r.push(s.slice(e,e+4));const n=this.hamming?r.flatMap(k):s,l=F(n,this.p,this.seed);let p,o=0;if(this.hamming){p=[];for(let e=0;e<l.length;e+=7){const c=C(l.slice(e,e+7));c.corrected&&(o+=1),p.push(...c.data)}p=p.slice(0,s.length)}else p=l;const i=p.reduce((e,c,h)=>e+(c===s[h]?0:1),0);return this.засчитать(i),m`<section class="telaio">
      <h4>${this.props.title??"Канал с шумом"}</h4>
      <p class="suggerimento">
        ${this.props.hint??"Поднимите шум, пока сообщение не развалится. Потом включите избыточность и посмотрите, что изменилось."}
      </p>

      <p class="traccia">
        ${p.map((e,c)=>m`<span class="bit ${e===s[c]?"":"rotto"}">${e}</span>`)}
      </p>

      <div class="quadranti">
        <div class="quadrante"><b>вероятность ошибки</b><span>${(this.p*100).toFixed(1)} %</span></div>
        <div class="quadrante"><b>пропускная способность</b><span>${M(this.p).toFixed(3)} бит/симв.</span></div>
        <div class="quadrante"><b>отправлено бит</b><span>${n.length}</span></div>
        <div class="quadrante ${i===0?"bene":"male"}"><b>испорчено</b><span>${i}</span></div>
        ${this.hamming?m`<div class="quadrante bene"><b>исправлено блоков</b><span>${o}</span></div>`:null}
      </div>

      <div class="manopole">
        <div class="manopola">
          <label for="p"><span>шум канала</span><i>${(this.p*100).toFixed(1)} %</i></label>
          <input
            id="p"
            type="range"
            min="0"
            max="0.5"
            step="0.005"
            .value=${String(this.p)}
            @input=${e=>this.p=Number(e.target.value)} />
        </div>
      </div>

      <div class="azioni">
        <button class="bottone" @click=${()=>this.hamming=!this.hamming}>
          ${this.hamming?"Выключить избыточность":"Включить код Хэмминга"}
        </button>
        <button class="bottone" @click=${()=>this.seed+=1}>Другой шум</button>
      </div>

      <p class="esito ${i===0?"bene":"male"}">
        ${this.hamming?`Семь бит вместо четырёх — и одна ошибка в блоке больше не портит сообщение. Испорчено: ${i}.`:`Без избыточности любая перевёрнутая единица — потерянный бит. Испорчено: ${i}.`}
      </p>
    </section>`}}customElements.define("cy-entropia",z);customElements.define("cy-canale",P);export{P as Canale,z as Entropia};
