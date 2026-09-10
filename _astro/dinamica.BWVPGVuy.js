import{W as M,s as k,b as q,i as Y}from"./base.EFBAa4pS.js";const v=(n,t)=>t*n*(1-n);function $(n,t={}){const i=t.warmup??600,a=t.samples??200;let s=t.x0??.5;for(let e=0;e<i;e+=1)s=v(s,n);const o=[];for(let e=0;e<a;e+=1)s=v(s,n),o.push(s);return o}function w(n,t=1e-4){const i=[];for(const a of n)if(i.some(s=>Math.abs(s-a)<t)||i.push(a),i.length>64)return 1/0;return i.length}function A(n,t=4e3,i=.4){let a=i,s=0,o=0;for(let e=0;e<t;e+=1){a=v(a,n);const r=Math.abs(n*(1-2*a));r>0&&(s+=Math.log(r),o+=1)}return o>0?s/o:0}const d={sigma:10,rho:28,beta:8/3},g=(n,t)=>({x:t.sigma*(n.y-n.x),y:n.x*(t.rho-n.z)-n.y,z:n.x*n.y-t.beta*n.z}),f=(n,t,i)=>({x:n.x+t.x*i,y:n.y+t.y*i,z:n.z+t.z*i});function b(n,t,i=d){const a=g(n,i),s=g(f(n,a,t/2),i),o=g(f(n,s,t/2),i),e=g(f(n,o,t),i);return{x:n.x+(a.x+2*s.x+2*o.x+e.x)*t/6,y:n.y+(a.y+2*s.y+2*o.y+e.y)*t/6,z:n.z+(a.z+2*s.z+2*o.z+e.z)*t/6}}function B(n,t,i=.006,a=d){const s=[n];let o=n;for(let e=0;e<t;e+=1)o=b(o,i,a),s.push(o);return s}const I=(n,t)=>Math.hypot(n.x-t.x,n.y-t.y,n.z-t.z),S=Y`
  canvas {
    width: 100%;
    height: auto;
    touch-action: none;
    background: color-mix(in srgb, var(--бумага, #fffdf6) 70%, transparent);
  }
`;class R extends M{constructor(){super(...arguments),this.нарисована=!1}static{this.styles=[k,S]}static{this.properties={r:{state:!0}}}avvia(){this.r=this.props.r??3.2}updated(){this.disegna()}disegna(){this.canvas??=this.renderRoot.querySelector("canvas")??void 0;const t=this.canvas;if(!t)return;const i=620,a=260;this.нарисована||(t.width=i,t.height=a,this.нарисована=!0);const s=t.getContext("2d");if(!s)return;s.clearRect(0,0,i,a),s.fillStyle="rgba(27,58,107,0.5)";for(let e=0;e<i;e+=1){const r=2.4+e/i*1.6;for(const h of $(r,{warmup:300,samples:90}))s.fillRect(e,a-h*a,1,1)}const o=(this.r-2.4)/(4-2.4)*i;s.strokeStyle="#d98b8b",s.lineWidth=1.4,s.beginPath(),s.moveTo(o,0),s.lineTo(o,a),s.stroke()}render(){const t=$(this.r),i=w(t),a=A(this.r);return q`<section class="telaio">
      <h4>${this.props.title??"Удвоения периода и хаос"}</h4>
      <p class="suggerimento">
        ${this.props.hint??"x → r·x·(1−x). Одна строчка. Ведите r вправо и смотрите, где кончается предсказуемость."}
      </p>

      <canvas role="img" aria-label="Диаграмма бифуркаций логистического отображения"></canvas>

      <div class="quadranti">
        <div class="quadrante"><b>r</b><span>${this.r.toFixed(4)}</span></div>
        <div class="quadrante"><b>период</b><span>${i===1/0?"нет":i}</span></div>
        <div class="quadrante ${a>0?"male":"bene"}">
          <b>показатель Ляпунова</b><span>${a.toFixed(3)}</span>
        </div>
      </div>

      <div class="manopole">
        <div class="manopola">
          <label for="r"><span>параметр r</span><i>${this.r.toFixed(4)}</i></label>
          <input
            id="r"
            type="range"
            min="2.4"
            max="4"
            step="0.0005"
            .value=${String(this.r)}
            @input=${s=>this.r=Number(s.target.value)} />
        </div>
      </div>

      <div class="azioni">
        <button class="bottone" @click=${()=>this.r=2.8}>покой</button>
        <button class="bottone" @click=${()=>this.r=3.2}>период 2</button>
        <button class="bottone" @click=${()=>this.r=3.5}>период 4</button>
        <button class="bottone" @click=${()=>this.r=3.83}>окно 3</button>
        <button class="bottone" @click=${()=>this.r=3.9}>хаос</button>
      </div>

      <p class="esito ${a>0?"male":""}">
        ${a>0?"Соседние траектории расходятся: сколько ни уточняй начальное значение, горизонт предсказания конечен.":"Траектории сходятся: система забывает начальное состояние и приходит к одному и тому же."}
      </p>
    </section>`}}const x=3e3,T=9e3;class E extends M{constructor(){super(...arguments),this.a={x:1,y:1,z:1},this.b={x:1+1e-9,y:1,z:1},this.trailA=[],this.trailB=[],this.sfondo=[],this.centro=25,this.raggioXY=21,this.altezza=25,this.angle=.3,this.tilt=.1,this.dragging=!1,this.lastX=0,this.lastY=0}static{this.styles=[k,S]}static{this.properties={rho:{state:!0},running:{state:!0},spread:{state:!0}}}avvia(){this.rho=this.props.rho??d.rho,this.running=!0,this.spread=0,this.misura(),this.stop=this.loop(()=>{if(this.running){const t={...d,rho:this.rho};for(let i=0;i<8;i+=1)this.a=b(this.a,.005,t),this.b=b(this.b,.005,t),this.trailA.push(this.a),this.trailB.push(this.b);this.trailA.length>x&&(this.trailA.splice(0,this.trailA.length-x),this.trailB.splice(0,this.trailB.length-x)),this.spread=I(this.a,this.b)}this.disegna()})}misura(){const t={...d,rho:this.rho};let i={x:-8,y:7,z:27};for(let e=0;e<2e3;e+=1)i=b(i,.006,t);this.sfondo=B(i,T,.006,t);let a=1/0,s=-1/0,o=.001;for(const e of this.sfondo)e.z<a&&(a=e.z),e.z>s&&(s=e.z),o=Math.max(o,Math.hypot(e.x,e.y));this.centro=(a+s)/2,this.altezza=Math.max((s-a)/2,.001),this.raggioXY=o}ferma(){this.stop?.()}project(t,i,a){const s=t.x,o=t.y,e=t.z-this.centro,r=Math.cos(this.angle),h=Math.sin(this.angle),l=s*r-o*h,p=s*h+o*r,c=Math.cos(this.tilt),u=Math.sin(this.tilt),m=p*c-e*u,X=p*u+e*c,y=320/(320+m),z=Math.min(.44*i/this.raggioXY,.44*a/this.altezza);return[i/2+l*z*y,a/2-X*z*y,m]}disegna(){this.canvas??=this.renderRoot.querySelector("canvas")??void 0;const t=this.canvas;if(!t)return;const i=460,a=380;t.width!==i&&(t.width=i,t.height=a);const s=t.getContext("2d");if(!s)return;s.clearRect(0,0,i,a);const o=(e,r,h)=>{s.strokeStyle=r,s.lineWidth=h,s.beginPath(),e.forEach((l,p)=>{const[c,u]=this.project(l,i,a);p===0?s.moveTo(c,u):s.lineTo(c,u)}),s.stroke()};o(this.sfondo,"rgba(92,96,104,0.16)",.8),o(this.trailA,"rgba(27,58,107,0.75)",1.2),o(this.trailB,"rgba(168,64,47,0.75)",1.2);for(const[e,r]of[[this.a,"#1b3a6b"],[this.b,"#a8402f"]]){const[h,l]=this.project(e,i,a);s.fillStyle=r,s.beginPath(),s.arc(h,l,3,0,Math.PI*2),s.fill()}}ruota(t){this.dragging&&(this.angle+=(t.clientX-this.lastX)*.01,this.tilt=Math.max(-1.4,Math.min(1.4,this.tilt+(t.clientY-this.lastY)*.01)),this.lastX=t.clientX,this.lastY=t.clientY)}render(){return q`<section class="telaio">
      <h4>${this.props.title??"Аттрактор Лоренца: детерминированный и непредсказуемый"}</h4>
      <p class="suggerimento">
        ${this.props.hint??"Две точки отличаются на миллиардную долю. Поверните фигуру пальцем и подождите — сначала они неразличимы."}
      </p>

      <canvas
        role="img"
        aria-label="Аттрактор Лоренца, две близкие траектории"
        @pointerdown=${t=>{this.dragging=!0,this.lastX=t.clientX,this.lastY=t.clientY,t.target.setPointerCapture(t.pointerId)}}
        @pointermove=${t=>this.ruota(t)}
        @pointerup=${()=>this.dragging=!1}
        @pointercancel=${()=>this.dragging=!1}></canvas>

      <div class="quadranti">
        <div class="quadrante"><b>ρ</b><span>${this.rho.toFixed(1)}</span></div>
        <div class="quadrante ${this.spread>1?"male":"bene"}">
          <b>расстояние между точками</b><span>${this.spread.toExponential(2)}</span>
        </div>
      </div>

      <div class="manopole">
        <div class="manopola">
          <label for="rho"><span>параметр ρ</span><i>${this.rho.toFixed(1)}</i></label>
          <input
            id="rho"
            type="range"
            min="1"
            max="60"
            step="0.5"
            .value=${String(this.rho)}
            @input=${t=>{this.rho=Number(t.target.value),this.misura()}} />
        </div>
      </div>

      <div class="azioni">
        <button class="bottone" @click=${()=>this.running=!this.running}>
          ${this.running?"Пауза":"Дальше"}
        </button>
        <button
          class="bottone"
          @click=${()=>{this.a={x:1,y:1,z:1},this.b={x:1+1e-9,y:1,z:1},this.trailA=[],this.trailB=[],this.spread=0}}>
          Сначала
        </button>
      </div>

      <p class="esito ${this.spread>1?"male":""}">
        ${this.spread>1?"Точки разошлись. Никакой ошибки в счёте не было — так устроена сама система.":"Пока неразличимы. Подождите."}
      </p>
    </section>`}}customElements.define("cy-logistica",R);customElements.define("cy-lorenz",E);export{R as Logistica,E as Lorenz};
