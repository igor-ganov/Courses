import{W as m,s as v,a as g,b as u}from"./base.EFBAa4pS.js";const d=i=>i>0?Math.log2(i):0,$=(i,s)=>Math.max(0,d(i)-d(s));function p(i){let s=i>>>0;return()=>{s=s+1831565813>>>0;let t=Math.imul(s^s>>>15,1|s);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function f(i,s){let t=p(s.seed),a=Math.floor(t()*i.disturbances.length),e=[];return{current:()=>a,play(o){const r=i.outcomes[a]?.[o]??Number.POSITIVE_INFINITY,n={disturbance:a,move:o,outcome:r,ok:r===0};return e.push(n),a=Math.floor(t()*i.disturbances.length),n},rounds:()=>e,score:()=>({held:e.filter(o=>o.ok).length,total:e.length}),goal(){const o=e.filter(r=>r.ok).length;return{goal:"held",reached:o>=s.target,score:Math.min(1,o/s.target)}},reset(){t=p(s.seed),a=Math.floor(t()*i.disturbances.length),e=[]}}}function x(i){let s=0,t=[];const a=(e,o)=>{let r=0;return o.map(n=>{const h=e.out[r]?.[n]??"";return r=e.next[r]?.[n]??0,h})};return{send(e){const o=i.out[s]?.[e]??"";return s=i.next[s]?.[e]??0,t.push({input:e,output:o}),o},trace:()=>t,survivors(e){const o=t.map(n=>n.input),r=t.map(n=>n.output);return e.filter(n=>a(n,o).every((h,b)=>h===r[b]))},reset(){s=0,t=[]},goal(e){const o=this.survivors(e),r=o.length===1&&o[0]?.name===i.name,n=Math.max(e.length,1),h=n>1?(n-o.length)/(n-1):0;return{goal:"identified",reached:r,score:Math.min(1,Math.max(0,h))}}}}const c={disturbances:["мороз","зной","сквозняк","сырость"],moves:["греть","студить","закрыть","сушить"],outcomes:[[0,2,1,1],[2,0,1,1],[1,1,0,1],[1,1,1,0]]};class k extends m{constructor(){super(...arguments),this.reported=!1,this.ultimo=""}static{this.properties={tick:{state:!0},moves:{state:!0}}}avvia(){this.tick=0,this.moves=this.props.moves??c.moves.length,this.nuovo()}table(){return{disturbances:c.disturbances,moves:c.moves.slice(0,this.moves),outcomes:c.outcomes.map(s=>s.slice(0,this.moves))}}nuovo(){this.reported=!1,this.ultimo="",this.game=f(this.table(),{seed:20260909,target:this.props.target??8}),this.tick+=1}gioca(s){const t=this.game.play(s);this.ultimo=t.ok?"Удержано.":`Не отработано: на «${c.disturbances[t.disturbance]}» нужного хода нет.`,this.tick+=1;const a=this.game.goal();this.reported||(this.reported=a.reached,this.riporta(a))}render(){const s=this.table(),t=this.game.score(),a=this.game.current(),e=$(s.disturbances.length,s.moves.length);return u`<section class="telaio">
      <h4>${this.props.title??"Игра Эшби: разнообразие против разнообразия"}</h4>
      <p class="suggerimento">
        ${this.props.hint??"Среда бросает помеху — отвечайте ходом. Потом уберите себе один ход и попробуйте снова."}
      </p>

      <div class="quadranti">
        <div class="quadrante"><b>помеха</b><span>${s.disturbances[a]}</span></div>
        <div class="quadrante ${t.held===t.total?"bene":"male"}">
          <b>удержано</b><span>${t.held} из ${t.total}</span>
        </div>
        <div class="quadrante"><b>разнообразие среды</b><span>${d(s.disturbances.length).toFixed(2)} бит</span></div>
        <div class="quadrante ${e>0?"male":"bene"}">
          <b>не хватает</b><span>${e.toFixed(2)} бит</span>
        </div>
      </div>

      <div class="azioni">
        ${s.moves.map((o,r)=>u`<button class="bottone" @click=${()=>this.gioca(r)}>${o}</button>`)}
      </div>

      <div class="azioni">
        <button
          class="bottone"
          ?disabled=${this.moves<=1}
          @click=${()=>{this.moves-=1,this.nuovo()}}>
          Отнять ход
        </button>
        <button
          class="bottone"
          ?disabled=${this.moves>=c.moves.length}
          @click=${()=>{this.moves+=1,this.nuovo()}}>
          Вернуть ход
        </button>
        <button class="bottone" @click=${()=>this.nuovo()}>Сначала</button>
      </div>

      <p class="esito ${this.ultimo.startsWith("Удержано")?"bene":this.ultimo?"male":""}">
        ${this.ultimo||(e>0?"Ходов меньше, чем помех: часть помех отработать нечем, как ни играй.":"Ход есть на каждую помеху — идеальная игра выигрывает всегда.")}
      </p>
    </section>`}}const l=[{name:"триггер",states:2,next:[[0,1],[1,0]],out:[["тихо","тихо"],["звон","звон"]]},{name:"эхо",states:1,next:[[0,0]],out:[["тихо","звон"]]},{name:"счётчик до двух",states:3,next:[[0,1],[1,2],[2,0]],out:[["тихо","тихо"],["тихо","тихо"],["звон","звон"]]},{name:"молчун",states:1,next:[[0,0]],out:[["тихо","тихо"]]}];class M extends m{constructor(){super(...arguments),this.reported=!1}static{this.styles=[v,g]}static{this.properties={tick:{state:!0}}}avvia(){this.tick=0;const s=l.find(t=>t.name===this.props.hidden)??l[0];this.box=x(s)}send(s){this.box.send(s),this.tick+=1;const t=this.box.goal(l);this.reported||(this.reported=t.reached,this.riporta(t))}render(){const s=this.box.trace(),t=this.box.survivors(l);return u`<section class="telaio">
      <h4>${this.props.title??"Чёрный ящик"}</h4>
      <p class="suggerimento">
        ${this.props.hint??"Внутрь заглянуть нельзя. Подавайте вход, смотрите выход и отсеивайте гипотезы — пока не останется одна."}
      </p>

      <div class="quadranti">
        <div class="quadrante"><b>подано</b><span>${s.length}</span></div>
        <div class="quadrante ${t.length===1?"bene":""}">
          <b>гипотез осталось</b><span>${t.length} из ${l.length}</span>
        </div>
      </div>

      <p class="traccia">
        ${s.length===0?u`<span class="tacito">Ящик молчит, пока в него не ткнут.</span>`:s.map(a=>u`<span class="passo">${a.input?"1":"0"}&nbsp;→&nbsp;${a.output}</span>`)}
      </p>

      <div class="azioni">
        <button class="bottone" @click=${()=>this.send(0)}>Подать 0</button>
        <button class="bottone" @click=${()=>this.send(1)}>Подать 1</button>
        <button
          class="bottone"
          @click=${()=>{this.box.reset(),this.reported=!1,this.tick+=1}}>
          Сначала
        </button>
      </div>

      <ul class="ipotesi">
        ${l.map(a=>u`<li class=${t.includes(a)?"":"fuori"}>${a.name}</li>`)}
      </ul>

      <p class="esito ${t.length===1?"bene":""}">
        ${t.length===1?`Осталась одна: «${t[0].name}». Заметьте — ящик так и не открыли.`:"Ищите вход, на котором гипотезы расходятся. Тот, на котором они ведут себя одинаково, ничего не сообщает."}
      </p>
    </section>`}}customElements.define("cy-varieta",k);customElements.define("cy-scatola",M);export{M as Scatola,k as Varieta};
