/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const U=globalThis,R=U.ShadowRoot&&(U.ShadyCSS===void 0||U.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,z=Symbol(),j=new WeakMap;let Q=class{constructor(t,e,s){if(this._$cssResult$=!0,s!==z)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(R&&t===void 0){const s=e!==void 0&&e.length===1;s&&(t=j.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),s&&j.set(e,t))}return t}toString(){return this.cssText}};const ot=r=>new Q(typeof r=="string"?r:r+"",void 0,z),X=(r,...t)=>{const e=r.length===1?r[0]:t.reduce((s,i,n)=>s+(o=>{if(o._$cssResult$===!0)return o.cssText;if(typeof o=="number")return o;throw Error("Value passed to 'css' function must be a 'css' function result: "+o+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+r[n+1],r[0]);return new Q(e,r,z)},at=(r,t)=>{if(R)r.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const e of t){const s=document.createElement("style"),i=U.litNonce;i!==void 0&&s.setAttribute("nonce",i),s.textContent=e.cssText,r.appendChild(s)}},B=R?r=>r:r=>r instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return ot(e)})(r):r;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:ht,defineProperty:lt,getOwnPropertyDescriptor:ct,getOwnPropertyNames:pt,getOwnPropertySymbols:dt,getPrototypeOf:ut}=Object,O=globalThis,I=O.trustedTypes,ft=I?I.emptyScript:"",$t=O.reactiveElementPolyfillSupport,A=(r,t)=>r,N={toAttribute(r,t){switch(t){case Boolean:r=r?ft:null;break;case Object:case Array:r=r==null?r:JSON.stringify(r)}return r},fromAttribute(r,t){let e=r;switch(t){case Boolean:e=r!==null;break;case Number:e=r===null?null:Number(r);break;case Object:case Array:try{e=JSON.parse(r)}catch{e=null}}return e}},tt=(r,t)=>!ht(r,t),W={attribute:!0,type:String,converter:N,reflect:!1,useDefault:!1,hasChanged:tt};Symbol.metadata??=Symbol("metadata"),O.litPropertyMetadata??=new WeakMap;let _=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=W){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const s=Symbol(),i=this.getPropertyDescriptor(t,s,e);i!==void 0&&lt(this.prototype,t,i)}}static getPropertyDescriptor(t,e,s){const{get:i,set:n}=ct(this.prototype,t)??{get(){return this[e]},set(o){this[e]=o}};return{get:i,set(o){const l=i?.call(this);n?.call(this,o),this.requestUpdate(t,l,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??W}static _$Ei(){if(this.hasOwnProperty(A("elementProperties")))return;const t=ut(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(A("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(A("properties"))){const e=this.properties,s=[...pt(e),...dt(e)];for(const i of s)this.createProperty(i,e[i])}const t=this[Symbol.metadata];if(t!==null){const e=litPropertyMetadata.get(t);if(e!==void 0)for(const[s,i]of e)this.elementProperties.set(s,i)}this._$Eh=new Map;for(const[e,s]of this.elementProperties){const i=this._$Eu(e,s);i!==void 0&&this._$Eh.set(i,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const s=new Set(t.flat(1/0).reverse());for(const i of s)e.unshift(B(i))}else t!==void 0&&e.push(B(t));return e}static _$Eu(t,e){const s=e.attribute;return s===!1?void 0:typeof s=="string"?s:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const s of e.keys())this.hasOwnProperty(s)&&(t.set(s,this[s]),delete this[s]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return at(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,s){this._$AK(t,s)}_$ET(t,e){const s=this.constructor.elementProperties.get(t),i=this.constructor._$Eu(t,s);if(i!==void 0&&s.reflect===!0){const n=(s.converter?.toAttribute!==void 0?s.converter:N).toAttribute(e,s.type);this._$Em=t,n==null?this.removeAttribute(i):this.setAttribute(i,n),this._$Em=null}}_$AK(t,e){const s=this.constructor,i=s._$Eh.get(t);if(i!==void 0&&this._$Em!==i){const n=s.getPropertyOptions(i),o=typeof n.converter=="function"?{fromAttribute:n.converter}:n.converter?.fromAttribute!==void 0?n.converter:N;this._$Em=i;const l=o.fromAttribute(e,n.type);this[i]=l??this._$Ej?.get(i)??l,this._$Em=null}}requestUpdate(t,e,s,i=!1,n){if(t!==void 0){const o=this.constructor;if(i===!1&&(n=this[t]),s??=o.getPropertyOptions(t),!((s.hasChanged??tt)(n,e)||s.useDefault&&s.reflect&&n===this._$Ej?.get(t)&&!this.hasAttribute(o._$Eu(t,s))))return;this.C(t,e,s)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:s,reflect:i,wrapped:n},o){s&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,o??e??this[t]),n!==!0||o!==void 0)||(this._$AL.has(t)||(this.hasUpdated||s||(e=void 0),this._$AL.set(t,e)),i===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[i,n]of this._$Ep)this[i]=n;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[i,n]of s){const{wrapped:o}=n,l=this[i];o!==!0||this._$AL.has(i)||l===void 0||this.C(i,void 0,n,l)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(s=>s.hostUpdate?.()),this.update(e)):this._$EM()}catch(s){throw t=!1,this._$EM(),s}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(t){}firstUpdated(t){}};_.elementStyles=[],_.shadowRootOptions={mode:"open"},_[A("elementProperties")]=new Map,_[A("finalized")]=new Map,$t?.({ReactiveElement:_}),(O.reactiveElementVersions??=[]).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const L=globalThis,V=r=>r,M=L.trustedTypes,F=M?M.createPolicy("lit-html",{createHTML:r=>r}):void 0,et="$lit$",$=`lit$${Math.random().toFixed(9).slice(2)}$`,st="?"+$,gt=`<${st}>`,v=document,C=()=>v.createComment(""),E=r=>r===null||typeof r!="object"&&typeof r!="function",D=Array.isArray,mt=r=>D(r)||typeof r?.[Symbol.iterator]=="function",T=`[ 	
\f\r]`,x=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,J=/-->/g,Z=/>/g,g=RegExp(`>|${T}(?:([^\\s"'>=/]+)(${T}*=${T}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),K=/'/g,Y=/"/g,it=/^(?:script|style|textarea|title)$/i,rt=r=>(t,...e)=>({_$litType$:r,strings:t,values:e}),Ut=rt(1),Mt=rt(2),b=Symbol.for("lit-noChange"),p=Symbol.for("lit-nothing"),G=new WeakMap,m=v.createTreeWalker(v,129);function nt(r,t){if(!D(r)||!r.hasOwnProperty("raw"))throw Error("invalid template strings array");return F!==void 0?F.createHTML(t):t}const vt=(r,t)=>{const e=r.length-1,s=[];let i,n=t===2?"<svg>":t===3?"<math>":"",o=x;for(let l=0;l<e;l++){const a=r[l];let c,d,h=-1,u=0;for(;u<a.length&&(o.lastIndex=u,d=o.exec(a),d!==null);)u=o.lastIndex,o===x?d[1]==="!--"?o=J:d[1]!==void 0?o=Z:d[2]!==void 0?(it.test(d[2])&&(i=RegExp("</"+d[2],"g")),o=g):d[3]!==void 0&&(o=g):o===g?d[0]===">"?(o=i??x,h=-1):d[1]===void 0?h=-2:(h=o.lastIndex-d[2].length,c=d[1],o=d[3]===void 0?g:d[3]==='"'?Y:K):o===Y||o===K?o=g:o===J||o===Z?o=x:(o=g,i=void 0);const f=o===g&&r[l+1].startsWith("/>")?" ":"";n+=o===x?a+gt:h>=0?(s.push(c),a.slice(0,h)+et+a.slice(h)+$+f):a+$+(h===-2?l:f)}return[nt(r,n+(r[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),s]};class S{constructor({strings:t,_$litType$:e},s){let i;this.parts=[];let n=0,o=0;const l=t.length-1,a=this.parts,[c,d]=vt(t,e);if(this.el=S.createElement(c,s),m.currentNode=this.el.content,e===2||e===3){const h=this.el.content.firstChild;h.replaceWith(...h.childNodes)}for(;(i=m.nextNode())!==null&&a.length<l;){if(i.nodeType===1){if(i.hasAttributes())for(const h of i.getAttributeNames())if(h.endsWith(et)){const u=d[o++],f=i.getAttribute(h).split($),P=/([.?@])?(.*)/.exec(u);a.push({type:1,index:n,name:P[2],strings:f,ctor:P[1]==="."?bt:P[1]==="?"?yt:P[1]==="@"?xt:H}),i.removeAttribute(h)}else h.startsWith($)&&(a.push({type:6,index:n}),i.removeAttribute(h));if(it.test(i.tagName)){const h=i.textContent.split($),u=h.length-1;if(u>0){i.textContent=M?M.emptyScript:"";for(let f=0;f<u;f++)i.append(h[f],C()),m.nextNode(),a.push({type:2,index:++n});i.append(h[u],C())}}}else if(i.nodeType===8)if(i.data===st)a.push({type:2,index:n});else{let h=-1;for(;(h=i.data.indexOf($,h+1))!==-1;)a.push({type:7,index:n}),h+=$.length-1}n++}}static createElement(t,e){const s=v.createElement("template");return s.innerHTML=t,s}}function y(r,t,e=r,s){if(t===b)return t;let i=s!==void 0?e._$Co?.[s]:e._$Cl;const n=E(t)?void 0:t._$litDirective$;return i?.constructor!==n&&(i?._$AO?.(!1),n===void 0?i=void 0:(i=new n(r),i._$AT(r,e,s)),s!==void 0?(e._$Co??=[])[s]=i:e._$Cl=i),i!==void 0&&(t=y(r,i._$AS(r,t.values),i,s)),t}class _t{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:s}=this._$AD,i=(t?.creationScope??v).importNode(e,!0);m.currentNode=i;let n=m.nextNode(),o=0,l=0,a=s[0];for(;a!==void 0;){if(o===a.index){let c;a.type===2?c=new k(n,n.nextSibling,this,t):a.type===1?c=new a.ctor(n,a.name,a.strings,this,t):a.type===6&&(c=new At(n,this,t)),this._$AV.push(c),a=s[++l]}o!==a?.index&&(n=m.nextNode(),o++)}return m.currentNode=v,i}p(t){let e=0;for(const s of this._$AV)s!==void 0&&(s.strings!==void 0?(s._$AI(t,s,e),e+=s.strings.length-2):s._$AI(t[e])),e++}}class k{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,s,i){this.type=2,this._$AH=p,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=s,this.options=i,this._$Cv=i?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return e!==void 0&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=y(this,t,e),E(t)?t===p||t==null||t===""?(this._$AH!==p&&this._$AR(),this._$AH=p):t!==this._$AH&&t!==b&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):mt(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==p&&E(this._$AH)?this._$AA.nextSibling.data=t:this.T(v.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:s}=t,i=typeof s=="number"?this._$AC(t):(s.el===void 0&&(s.el=S.createElement(nt(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===i)this._$AH.p(e);else{const n=new _t(i,this),o=n.u(this.options);n.p(e),this.T(o),this._$AH=n}}_$AC(t){let e=G.get(t.strings);return e===void 0&&G.set(t.strings,e=new S(t)),e}k(t){D(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let s,i=0;for(const n of t)i===e.length?e.push(s=new k(this.O(C()),this.O(C()),this,this.options)):s=e[i],s._$AI(n),i++;i<e.length&&(this._$AR(s&&s._$AB.nextSibling,i),e.length=i)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const s=V(t).nextSibling;V(t).remove(),t=s}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}}class H{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,s,i,n){this.type=1,this._$AH=p,this._$AN=void 0,this.element=t,this.name=e,this._$AM=i,this.options=n,s.length>2||s[0]!==""||s[1]!==""?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=p}_$AI(t,e=this,s,i){const n=this.strings;let o=!1;if(n===void 0)t=y(this,t,e,0),o=!E(t)||t!==this._$AH&&t!==b,o&&(this._$AH=t);else{const l=t;let a,c;for(t=n[0],a=0;a<n.length-1;a++)c=y(this,l[s+a],e,a),c===b&&(c=this._$AH[a]),o||=!E(c)||c!==this._$AH[a],c===p?t=p:t!==p&&(t+=(c??"")+n[a+1]),this._$AH[a]=c}o&&!i&&this.j(t)}j(t){t===p?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class bt extends H{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===p?void 0:t}}class yt extends H{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==p)}}class xt extends H{constructor(t,e,s,i,n){super(t,e,s,i,n),this.type=5}_$AI(t,e=this){if((t=y(this,t,e,0)??p)===b)return;const s=this._$AH,i=t===p&&s!==p||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,n=t!==p&&(s===p||i);i&&this.element.removeEventListener(this.name,this,s),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class At{constructor(t,e,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){y(this,t)}}const wt=L.litHtmlPolyfillSupport;wt?.(S,k),(L.litHtmlVersions??=[]).push("3.3.3");const Ct=(r,t,e)=>{const s=e?.renderBefore??t;let i=s._$litPart$;if(i===void 0){const n=e?.renderBefore??null;s._$litPart$=i=new k(t.insertBefore(C(),n),n,void 0,e??{})}return i._$AI(r),i};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const q=globalThis;class w extends _{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Ct(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return b}}w._$litElement$=!0,w.finalized=!0,q.litElementHydrateSupport?.({LitElement:w});const Et=q.litElementPolyfillSupport;Et?.({LitElement:w});(q.litElementVersions??=[]).push("4.2.2");const St=X`
  :host {
    display: block;
    margin: 0 0 var(--шаг, 26px);
    font-family: 'Literata', Georgia, serif;
    font-size: max(calc(16.5px * var(--кегль, 1)), var(--пол, 0px));
    line-height: var(--шаг, 26px);
    color: var(--текст, #20242c);
  }

  .telaio {
    position: relative;
    padding: 20px 22px 18px;
    background: color-mix(in srgb, var(--бумага, #fffdf6) 62%, transparent);
  }

  /* Обводка прибора. Путь заполняет поле почти целиком, и это не придирка
     к рисунку: раньше его нижняя линия лежала на 95 % высоты поля, а поле
     растягивается под прибор — и на высоком приборе линия проходила сквозь
     последнюю строку итога, обрезая её на глазах. Поймано на игре с пробами,
     где итог занимает четыре строки; на приборах пониже это просто не
     показывалось. */
  .telaio::before {
    content: '';
    position: absolute;
    inset: -8px;
    pointer-events: none;
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200' preserveAspectRatio='none'><path d='M16,5 C92,2 212,4 290,8 C297,9 298,17 298,32 C299,95 298,161 297,191 C296,196 288,197 276,196 C192,198 92,196 24,195 C13,194 9,187 9,173 C7,119 8,49 9,23 C9,12 13,6 24,5' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round' opacity='.55'/></svg>")
      no-repeat center / 100% 100%;
  }

  h4 {
    font-family: 'Caveat', cursive;
    font-weight: 700;
    font-size: max(calc(23px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--паста, #1b3a6b);
    margin: 0 0 2px;
    line-height: 1.1;
  }

  .suggerimento {
    font-family: 'Caveat', cursive;
    font-size: max(calc(18px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--тихий, #6f7682);
    margin: 0 0 14px;
    line-height: 1.2;
  }

  /* Приборные числа лежат в сетке, а не в переносимой строке.

     Гибкая строка с переносом меняет число рядов, когда меняется ширина
     содержимого, — а содержимое здесь меняется каждый кадр: «19.55°»
     становится «9.5°», «1.45°» — «12.30°». На узком экране ряд то влезал,
     то нет, прибор дышал по высоте, и весь текст под ним прыгал по
     нескольку раз в секунду. Сквозная проверка намеряла на витке про
     обратную связь восемнадцать сдвигов подряд и CLS 1,17.

     В сетке число колонок зависит только от ширины прибора, а высота
     ряда задана. Что бы ни показывали приборы, коробка не меняется. */
  .quadranti {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
    gap: 6px 20px;
    margin: 0 0 14px;
  }

  .quadrante {
    min-height: calc(var(--шаг, 26px) * 1.7);
  }

  .quadrante b {
    display: block;
    font-family: 'Caveat', cursive;
    font-weight: 500;
    font-size: max(calc(17px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--тихий, #6f7682);
    line-height: 1.1;
  }

  .quadrante b,
  .quadrante span {
    /* Подпись не переносится, а обрезается: перенос — это опять смена
       высоты, а обрезанную подпись читатель хотя бы видит целиком в
       заголовке прибора. */
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .quadrante span {
    font-variant-numeric: tabular-nums;
  }

  .quadrante.male span {
    color: var(--красный, #a8402f);
  }

  .quadrante.bene span {
    color: var(--зелёный, #3f6b4a);
  }

  .manopole {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  }

  .manopola {
    display: grid;
    gap: 3px;
  }

  .manopola label {
    font-family: 'Caveat', cursive;
    font-size: max(calc(18px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--грифель, #5c6068);
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .manopola label i {
    font-style: normal;
    font-family: 'Literata', serif;
    font-size: max(calc(15px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--паста, #1b3a6b);
    font-variant-numeric: tabular-nums;
  }

  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 18px;
    background: none;
    cursor: grab;
  }

  input[type='range']::-webkit-slider-runnable-track {
    height: 3px;
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='3' preserveAspectRatio='none'><path d='M1,2 C60,1 140,2.2 199,1.2' fill='none' stroke='%235c6068' stroke-width='1.2' stroke-linecap='round'/></svg>")
      no-repeat center / 100% 100%;
  }

  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -7px;
    border: 0;
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M8,1.6 C11.6,1.4 14.4,4.4 14.4,8 C14.4,11.7 11.5,14.5 8,14.4 C4.5,14.3 1.7,11.5 1.7,8 C1.7,4.6 4.3,1.9 7.4,1.7' fill='%23fffdf6' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
      no-repeat center;
  }

  input[type='range']::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: 0;
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M8,1.6 C11.6,1.4 14.4,4.4 14.4,8 C14.4,11.7 11.5,14.5 8,14.4 C4.5,14.3 1.7,11.5 1.7,8 C1.7,4.6 4.3,1.9 7.4,1.7' fill='%23fffdf6' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
      no-repeat center;
  }

  .bottone {
    position: relative;
    border: 0;
    background: none;
    cursor: pointer;
    font-family: 'Caveat', cursive;
    font-size: max(calc(20px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--паста, #1b3a6b);
    padding: 7px 18px;
    min-height: 40px;
  }

  .bottone::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='46' preserveAspectRatio='none'><path d='M18,4 C62,1.5 118,3 145,6 C153,7 155,14 154,23 C153,33 152,39 145,41 C112,44 48,43 17,41 C8,40.5 5,34 5.5,24 C6,14 8,7 16,5' fill='none' stroke='%231b3a6b' stroke-width='1.6' stroke-linecap='round'/></svg>")
      no-repeat center / 100% 100%;
  }

  .bottone:active {
    transform: translateY(1.2px);
  }

  .bottone[disabled] {
    opacity: 0.45;
    cursor: default;
  }

  .bottone[disabled]:active {
    transform: none;
  }

  /* Селекторы страницы сквозь теневой корень не проходят, поэтому запрет
     выделения на нажимаемом приходится повторить и здесь. Подсветка касания
     наследуется и снята на html — но пусть стоит и тут: прибор должен вести
     себя одинаково, куда бы его ни поставили. */
  button,
  input[type='range'] {
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: none;
    user-select: none;
  }

  /* Взамен снятой подсветки — своё касание. Нажатие обязано отзываться:
     кнопка, которая на палец не отвечает вовсе, читается как сломанная. */
  button:active {
    transform: translateY(1px);
  }

  .azioni {
    display: flex;
    gap: 14px;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 14px;
  }

  canvas,
  svg.tela {
    display: block;
    width: 100%;
    height: auto;
    margin-bottom: 12px;
    touch-action: pan-y;
  }

  /* Строка итога меняется по ходу расчёта и бывает то в одну строку, то в
     три. Место отведено под три: пусть внизу прибора остаётся воздух, лишь
     бы текст под прибором не ездил. */
  .esito {
    font-family: 'Caveat', cursive;
    font-size: max(calc(19px * var(--кегль, 1)), var(--пол, 0px));
    line-height: 1.25;
    color: var(--грифель, #5c6068);
    margin: 10px 0 0;
    min-height: 3.75em;
  }

  .esito.bene {
    color: var(--зелёный, #3f6b4a);
  }

  .esito.male {
    color: var(--красный, #a8402f);
  }

  :focus-visible {
    outline: 2px solid var(--паста, #1b3a6b);
    outline-offset: 3px;
  }
`;class Ot extends w{constructor(){super(...arguments),this.props={}}static{this.styles=[St]}connectedCallback(){super.connectedCallback();const t=this.getAttribute("data-props");if(t)try{this.props=JSON.parse(t)}catch{}this.avvia()}disconnectedCallback(){this.ferma(),super.disconnectedCallback()}avvia(){}ferma(){}riporta(t){this.dispatchEvent(new CustomEvent("cy-goal",{detail:t,bubbles:!0,composed:!0}))}loop(t){let e=0,s=!0;const i=()=>{s&&(t(),e=requestAnimationFrame(i))};return e=requestAnimationFrame(i),()=>{s=!1,cancelAnimationFrame(e)}}updated(t){super.updated(t)}}const Ht=X`
  .traccia {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    margin: 0 0 12px;
    font-variant-numeric: tabular-nums;
  }

  .passo {
    font-family: 'PT Mono', monospace;
    font-size: max(calc(14px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--паста, #1b3a6b);
    white-space: nowrap;
  }

  .tacito {
    color: var(--тихий, #6f7682);
    font-family: 'Caveat', cursive;
    font-size: max(calc(18px * var(--кегль, 1)), var(--пол, 0px));
  }

  .ipotesi {
    list-style: none;
    padding: 0;
    margin: 14px 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    font-family: 'Caveat', cursive;
    font-size: max(calc(19px * var(--кегль, 1)), var(--пол, 0px));
    color: var(--паста, #1b3a6b);
  }

  /* Отброшенная гипотеза не исчезает, а зачёркивается: видно, что отсеяно. */
  .ipotesi .fuori {
    color: var(--тихий, #6f7682);
    text-decoration: line-through;
    text-decoration-thickness: 1px;
    opacity: 0.65;
  }
`;export{Ot as W,Ht as a,Ut as b,X as i,St as s,Mt as w};
