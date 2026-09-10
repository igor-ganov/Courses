import{W as S,b,w as H}from"./base.EFBAa4pS.js";function x(d){let e=d>>>0;return()=>{e=e+1831565813>>>0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function I(d){return d()+d()-1}const R=4e3;function z(d,e){let t={antiWindup:!0,...d},o=x(t.seed),i=0,s=t.start??t.ambient,a=0,p=t.start??t.ambient,l=0,r=0,c=0,u=0,$=[],m=[];const n=()=>({time:i,output:s,measured:p,control:l,error:r,integral:a,settled:c});function g(){o=x(t.seed),i=0,s=t.start??t.ambient,a=0,p=t.start??t.ambient,l=0,r=0,c=0,u=0,$=[],m=[]}function F(){const h=t.dt,M=s+(t.noise>0?I(o)*t.noise:0);r=t.setpoint-M;const q=(M-p)/h,k=t.kp*r+t.ki*a-t.kd*q;l=Math.min(t.uMax,Math.max(t.uMin,k));const w=k!==l&&Math.sign(r)===Math.sign(k-l);t.antiWindup&&w||(a+=r*h);const W=Math.max(0,Math.round(t.delay/h));$.push(l);const j=$.length>W?$.shift():0,L=t.ambient+t.gain*j;s+=(L-s)/t.tau*h,p=M,i+=h,e&&(c=Math.abs(t.setpoint-s)<=e.tolerance?c+h:0,u=Math.max(u,c));const y=n();return m.push(y),m.length>R&&m.shift(),y}return{step:F,state:n,history:()=>m,reset:g,settings:()=>t,set(h){t={...t,...h},h.seed!==void 0&&(o=x(t.seed))},goal(){return e?{goal:"settled",reached:u>=e.hold,score:Math.min(1,u/e.hold)}:{goal:"settled",reached:!1,score:0}}}}const f=620,v=200;class A extends S{constructor(){super(...arguments),this.reported=!1,this.riferito=0}static{this.properties={kp:{state:!0},ki:{state:!0},kd:{state:!0},delay:{state:!0},noise:{state:!0},running:{state:!0},tick:{state:!0}}}avvia(){const e=this.props;this.kp=e.kp??3,this.ki=e.ki??0,this.kd=e.kd??0,this.delay=e.delay??0,this.noise=e.noise??0,this.running=!0,this.tick=0;const t={setpoint:e.setpoint??21,ambient:e.ambient??5,gain:1.6,tau:12,delay:this.delay,kp:this.kp,ki:this.ki,kd:this.kd,uMin:0,uMax:100,noise:this.noise,seed:20260909,dt:.25};this.loopModel=z(t,this.props.goal),this.stop=this.loop(()=>{if(this.running){for(let o=0;o<4;o+=1)this.loopModel.step();if(this.tick+=1,this.props.goal&&!this.reported){const o=this.loopModel.goal();(o.reached||o.score>=this.riferito+.05)&&(this.riferito=o.score,this.reported=o.reached,this.riporta(o))}}})}ferma(){this.stop?.()}set(e,t){this[e]=t,this.loopModel.set({[e]:t})}reset(){this.reported=!1,this.riferito=0,this.loopModel.reset(),this.tick+=1}grafico(){const e=this.loopModel.history();if(e.length<2)return b``;const t=Math.min(e.length,900),o=e.slice(-t),i=this.loopModel.settings();let s=i.ambient,a=i.setpoint;for(const n of o)s=Math.min(s,n.output),a=Math.max(a,n.output);const p=Math.max(1,(a-s)*.15);s-=p,a+=p;const l=n=>n/(t-1)*f,r=n=>v-(n-s)/(a-s)*v,c=o.map((n,g)=>`${g?"L":"M"}${l(g).toFixed(1)},${r(n.output).toFixed(1)}`).join(""),u=o.map((n,g)=>`${g?"L":"M"}${l(g).toFixed(1)},${(v-n.control/100*26).toFixed(1)}`).join(""),$=r(i.setpoint).toFixed(1),m=this.props.goal?H`<rect
          x="0"
          y=${r(i.setpoint+this.props.goal.tolerance).toFixed(1)}
          width=${f}
          height=${Math.abs(r(i.setpoint-this.props.goal.tolerance)-r(i.setpoint+this.props.goal.tolerance)).toFixed(1)}
          fill="var(--зелёный, #3f6b4a)"
          opacity="0.08" />`:null;return b`<svg
      class="tela"
      viewBox="0 0 ${f} ${v}"
      preserveAspectRatio="none"
      role="img"
      aria-label="График температуры и воздействия во времени">
      ${m}
      <line x1="0" y1=${$} x2=${f} y2=${$} stroke="var(--поле, #d98b8b)" stroke-width="1.2" stroke-dasharray="6 5" />
      <path d=${u} fill="none" stroke="var(--грифель, #5c6068)" stroke-width="1" opacity="0.45" />
      <path d=${c} fill="none" stroke="var(--паста, #1b3a6b)" stroke-width="1.8" stroke-linejoin="round" />
    </svg>`}render(){const e=this.loopModel.state(),o=this.loopModel.settings().setpoint-e.output,i=Math.abs(o)<.4,s=this.props.goal?this.loopModel.goal():void 0;return b`<section class="telaio">
      <h4>${this.props.title??"Контур регулирования"}</h4>
      <p class="suggerimento">
        ${this.props.hint??"Крутите усиление. Одного пропорционального мало: остаётся статическая ошибка. Добавьте интеграл — и посмотрите, что сделает запаздывание."}
      </p>

      ${this.grafico()}

      <div class="quadranti">
        <div class="quadrante"><b>температура</b><span>${e.output.toFixed(2)} °</span></div>
        <div class="quadrante ${i?"bene":"male"}"><b>ошибка</b><span>${o.toFixed(2)} °</span></div>
        <div class="quadrante"><b>воздействие</b><span>${e.control.toFixed(0)} %</span></div>
        <div class="quadrante"><b>время</b><span>${e.time.toFixed(0)} с</span></div>
        ${s?b`<div class="quadrante ${s.reached?"bene":""}">
              <b>удержано</b><span>${(s.score*100).toFixed(0)} %</span>
            </div>`:null}
      </div>

      <div class="manopole">
        ${this.manopola("усиление P","kp",0,30,.1)}
        ${this.manopola("интеграл I","ki",0,3,.02)}
        ${this.manopola("производная D","kd",0,30,.5)}
        ${this.manopola("запаздывание","delay",0,15,.5," с")}
        ${this.manopola("шум датчика","noise",0,1.5,.05," °")}
      </div>

      <div class="azioni">
        <button class="bottone" @click=${()=>this.running=!this.running}>
          ${this.running?"Пауза":"Дальше"}
        </button>
        <button class="bottone" @click=${()=>this.reset()}>Сначала</button>
      </div>

      ${s?b`<p class="esito ${s.reached?"bene":""}">
            ${s.reached?"Удержано. Обратите внимание, какой ценой: посмотрите на воздействие.":`Цель: удержать ${this.props.goal.tolerance} ° в течение ${this.props.goal.hold} с.`}
          </p>`:null}
    </section>`}manopola(e,t,o,i,s,a=""){const p=this[t];return b`<div class="manopola">
      <label for=${`m-${t}`}><span>${e}</span><i>${p.toFixed(s<.1?2:1)}${a}</i></label>
      <input
        id=${`m-${t}`}
        type="range"
        min=${o}
        max=${i}
        step=${s}
        .value=${String(p)}
        @input=${l=>this.set(t,Number(l.target.value))} />
    </div>`}}customElements.define("cy-contorno",A);export{A as Contorno};
