import{W as f,s as m,b as h,i as R}from"./base.EFBAa4pS.js";function M(e,t){const s=e.length;return e.map((n,i)=>{const a=e[(i-1+s)%s],r=e[i],o=e[(i+1)%s],l=a<<2|r<<1|o;return t>>l&1})}function S(e){const t=new Array(e).fill(0);return t[Math.floor(e/2)]=1,t}function q(e,t,s,n){const i=[S(e)];for(let a=0;a<s;a+=1)i.push(M(i[i.length-1],t));return i}const A=(e,t)=>({width:e,height:t,cells:new Uint8Array(e*t)}),p=(e,t,s)=>e.cells[(s+e.height)%e.height*e.width+(t+e.width)%e.width]??0;function g(e,t){const s=new Uint8Array(e.cells);for(const[n,i]of t)s[(i+e.height)%e.height*e.width+(n+e.width)%e.width]=1;return{...e,cells:s}}function U(e){const t=new Uint8Array(e.cells.length);for(let s=0;s<e.height;s+=1)for(let n=0;n<e.width;n+=1){let i=0;for(let r=-1;r<=1;r+=1)for(let o=-1;o<=1;o+=1)o===0&&r===0||(i+=p(e,n+o,s+r));const a=p(e,n,s)===1;t[s*e.width+n]=a?i===2||i===3?1:0:i===3?1:0}return{...e,cells:t}}const k=e=>e.cells.reduce((t,s)=>t+s,0);function E(e,t,s=.28,n=1){const i=I(n),a=new Uint8Array(e*t);for(let r=0;r<a.length;r+=1)a[r]=i()<s?1:0;return{width:e,height:t,cells:a}}function I(e){let t=e>>>0;return()=>{t=t+1831565813>>>0;let s=Math.imul(t^t>>>15,1|t);return s=s+Math.imul(s^s>>>7,61|s)^s,((s^s>>>14)>>>0)/4294967296}}const u={планёр:[[1,0],[2,1],[0,2],[1,2],[2,2]],мигалка:[[0,1],[1,1],[2,1]],жаба:[[1,1],[2,1],[3,1],[0,2],[1,2],[2,2]],блок:[[0,0],[1,0],[0,1],[1,1]]},v=R`
  canvas {
    width: 100%;
    height: auto;
    image-rendering: pixelated;
    cursor: crosshair;
    touch-action: none;
    background: color-mix(in srgb, var(--бумага, #fffdf6) 70%, transparent);
  }
`,C={30:"шум из порядка: этим правилом когда-то делали случайные числа",90:"треугольник Серпинского — правило есть XOR соседей",110:"полно по Тьюрингу: на нём можно вычислить всё вычислимое",184:"поток машин: заторы возникают сами и едут назад",250:"ровная решётка — правило почти ничего не решает"};class D extends f{static{this.styles=[m,v]}static{this.properties={rule:{state:!0}}}avvia(){this.rule=this.props.rule??90}updated(){this.disegna()}disegna(){this.canvas??=this.renderRoot.querySelector("canvas")??void 0;const t=this.canvas;if(!t)return;const s=this.props.width??201,n=this.props.steps??110;t.width=s,t.height=n+1;const i=t.getContext("2d");if(!i)return;const a=q(s,this.rule,n),r=i.createImageData(s,n+1),[o,l,b]=[27,58,107];a.forEach(($,y)=>{$.forEach((w,x)=>{const c=(y*s+x)*4;r.data[c]=o,r.data[c+1]=l,r.data[c+2]=b,r.data[c+3]=w?235:0})}),i.clearRect(0,0,s,n+1),i.putImageData(r,0,0)}render(){return h`<section class="telaio">
      <h4>${this.props.title??`Правило ${this.rule}`}</h4>
      <p class="suggerimento">
        ${C[this.rule]??this.props.hint??"Восемь бит правила решают всё. Время идёт сверху вниз, край замкнут в кольцо."}
      </p>

      <canvas aria-label=${`Клеточный автомат, правило ${this.rule}`} role="img"></canvas>

      <div class="manopole">
        <div class="manopola">
          <label for="rule"><span>номер правила</span><i>${this.rule}</i></label>
          <input
            id="rule"
            type="range"
            min="0"
            max="255"
            step="1"
            .value=${String(this.rule)}
            @input=${t=>this.rule=Number(t.target.value)} />
        </div>
      </div>

      <div class="azioni">
        ${[30,90,110,184].map(t=>h`<button class="bottone" @click=${()=>this.rule=t}>${t}</button>`)}
      </div>
    </section>`}}const d="россыпь";class F extends f{constructor(){super(...arguments),this.lastFrame=0}static{this.styles=[m,v]}static{this.properties={generation:{state:!0},running:{state:!0}}}avvia(){this.generation=0,this.running=!0;const t=this.props.width??64,s=this.props.height??40;this.grid=this.posa(this.props.figure??d,t,s),this.stop=this.loop(()=>{this.running&&(this.lastFrame+=1,!(this.lastFrame%8)&&(this.grid=U(this.grid),this.generation+=1))})}posa(t,s,n){return t===d||!u[t]?E(s,n):g(A(s,n),u[t].map(([i,a])=>[i+Math.floor(s/2)-2,a+Math.floor(n/2)-2]))}ferma(){this.stop?.()}updated(){this.disegna()}disegna(){this.canvas??=this.renderRoot.querySelector("canvas")??void 0;const t=this.canvas;if(!t)return;const{width:s,height:n}=this.grid;t.width=s,t.height=n;const i=t.getContext("2d");if(!i)return;const a=i.createImageData(s,n);for(let r=0;r<this.grid.cells.length;r+=1){const o=r*4;a.data[o]=27,a.data[o+1]=58,a.data[o+2]=107,a.data[o+3]=this.grid.cells[r]?235:0}i.clearRect(0,0,s,n),i.putImageData(a,0,0)}tocca(t){const s=this.canvas;if(!s)return;const n=s.getBoundingClientRect(),i=Math.floor((t.clientX-n.left)/n.width*this.grid.width),a=Math.floor((t.clientY-n.top)/n.height*this.grid.height);this.grid=g(this.grid,[[i,a]]),this.generation+=0,this.requestUpdate()}render(){return h`<section class="telaio">
      <h4>${this.props.title??"«Жизнь»: правило известно целиком"}</h4>
      <p class="suggerimento">
        ${this.props.hint??"Живая с двумя или тремя соседями выживает, мёртвая ровно с тремя оживает. Всё. Попробуйте предсказать, что будет через двадцать шагов."}
      </p>

      <canvas
        role="img"
        aria-label="Поле «Жизни»"
        @pointerdown=${t=>this.tocca(t)}
        @pointermove=${t=>t.buttons&&this.tocca(t)}></canvas>

      <div class="quadranti">
        <div class="quadrante"><b>поколение</b><span>${this.generation}</span></div>
        <div class="quadrante"><b>живых клеток</b><span>${k(this.grid)}</span></div>
      </div>

      <div class="azioni">
        <button class="bottone" @click=${()=>this.running=!this.running}>
          ${this.running?"Пауза":"Дальше"}
        </button>
        ${[d,...Object.keys(u)].map(t=>h`<button
            class="bottone"
            @click=${()=>{this.grid=this.posa(t,this.grid.width,this.grid.height),this.generation=0}}>
            ${t}
          </button>`)}
      </div>
    </section>`}}customElements.define("cy-automa",D);customElements.define("cy-vita",F);export{D as Automa,F as Vita};
