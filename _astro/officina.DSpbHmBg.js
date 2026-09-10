import{W as P,s as _,i as K,b as x}from"./base.EFBAa4pS.js";function B(n){let t=null;for(let e=0;e<n.length;e+=1){const i=n[e];if(t){i===t&&(t=null);continue}if(i==='"'||i==="'"){t=i;continue}if(i==="#")return n.slice(0,e)}return n}function D(n,t){const e=n.trim();return e.startsWith('"')&&e.endsWith('"')&&e.length>1||e.startsWith("'")&&e.endsWith("'")&&e.length>1?{kind:"scalar",value:e.slice(1,-1),raw:e,line:t}:e==="true"||e==="false"?{kind:"scalar",value:e==="true",raw:e,line:t}:/^-?\d+(\.\d+)?$/.test(e)?{kind:"scalar",value:Number(e),raw:e,line:t}:{kind:"scalar",value:e,raw:e,line:t}}function R(n){const t=[],e=[];if(n.split(`
`).forEach((r,f)=>{r.includes("	")&&t.push({line:f+1,text:"табуляция: YAML понимает только пробелы"});const c=B(r.replace(/\t/g,"  "));if(c.trim()==="")return;const u=c.length-c.trimStart().length,d=c.trim();if(d==="-"||d.startsWith("- ")){e.push({n:f+1,отступ:u+2,текст:d==="-"?"":d.slice(2).trim(),дефис:!0});return}e.push({n:f+1,отступ:u,текст:d,дефис:!1})}),e.length===0)return{problems:t};let i=0;function s(r){return e[i].дефис?a(r):l(r)}function a(r){const f=e[i].n,c=[];for(;i<e.length&&e[i].отступ===r&&e[i].дефис;){const u=e[i];if(u.текст===""){i+=1,i<e.length&&e[i].отступ>r?c.push(s(e[i].отступ)):t.push({line:u.n,text:"пункт списка пуст"});continue}if(!N(u.текст)){c.push(D(u.текст,u.n)),i+=1;continue}c.push(l(r,!0))}return{kind:"list",items:c,line:f}}function l(r,f=!1){const c=e[i].n,u=[];let d=!0;for(;i<e.length;){const $=e[i];if($.отступ<r||$.дефис&&!(f&&d))break;if($.отступ>r){t.push({line:$.n,text:"лишний отступ: строка глубже, чем предыдущая"}),i+=1;continue}d=!1;const g=N($.текст);if(!g){t.push({line:$.n,text:"не разобрать строку: ожидалось «ключ: значение»"}),i+=1;continue}const[w,z]=g;if(z!==""){u.push([w,D(z,$.n)]),i+=1;continue}i+=1;const p=e[i];if(p&&p.отступ>r){u.push([w,s(p.отступ)]);continue}t.push({line:$.n,text:`у поля «${w}» нет значения`})}return{kind:"map",entries:u,line:c}}const m=s(e[0].отступ);return i<e.length&&t.push({line:e[i].n,text:"строка не на своём отступе"}),{doc:m,problems:t}}function N(n){let t=null;for(let e=0;e<n.length;e+=1){const i=n[e];if(t){i===t&&(t=null);continue}if(i==='"'||i==="'"){t=i;continue}if(i===":"&&(e+1===n.length||n[e+1]===" "))return[n.slice(0,e).trim(),n.slice(e+1).trim()]}}function o(n,t){if(!n)return;if(t==="")return n;const[e,...i]=t.split("."),s=i.join(".");if(n.kind==="map"){const a=n.entries.find(([l])=>l===e);return a?o(a[1],s):void 0}if(n.kind==="list"){const a=Number(e);return Number.isInteger(a)?o(n.items[a],s):void 0}}function v(n){if(!(!n||n.kind!=="scalar"))return typeof n.value=="string"?n.value:String(n.value)}function G(n){if(!(!n||n.kind!=="scalar"))return typeof n.value=="number"?n.value:void 0}function Y(n){return n&&n.kind==="map"?n.entries.map(([t])=>t):[]}function V(n){const t={};if(!n||n.kind!=="map")return t;for(const[e,i]of n.entries){const s=v(i);s!==void 0&&(t[e]=s)}return t}function O(n,t){let e,i=1/0;for(const s of t){const a=H(n.toLowerCase(),s.toLowerCase());a<i&&(i=a,e=s)}return i<=Math.max(1,Math.floor(n.length/3))?e:void 0}function H(n,t){const e=Array.from({length:t.length+1},(i,s)=>s);for(let i=1;i<=n.length;i+=1){let s=e[0];e[0]=i;for(let a=1;a<=t.length;a+=1){const l=e[a];e[a]=Math.min(e[a]+1,e[a-1]+1,s+(n[i-1]===t[a-1]?0:1)),s=l}}return e[t.length]}function A(n){if(n===void 0)return;const t=n.trim();if(/^\d+(\.\d+)?m$/.test(t))return Number(t.slice(0,-1))/1e3;if(/^\d+(\.\d+)?$/.test(t))return Number(t)}function I(n){if(n===void 0)return;const t=n.trim(),e=/^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|K|M|G|T)?$/.exec(t);if(!e)return;const i=Number(e[1]),s={Ki:1/1024/1024,Mi:1/1024,Gi:1,Ti:1024,K:1e3/2**30,M:1e6/2**30,G:1e9/2**30,T:1e12/2**30},a=e[2];return a?i*s[a]:i/2**30}const J={"":["apiVersion","kind","metadata","spec"],metadata:["name","labels","annotations"],spec:["replicas","selector","template","strategy"],"spec.selector":["matchLabels"],"spec.template":["metadata","spec"],"spec.template.metadata":["labels","annotations"],"spec.template.spec":["containers","volumes","nodeSelector","tolerations"]},E=["name","image","resources","ports","volumeMounts","env"];function Q(n,t){for(const[i,s]of Object.entries(J)){const a=o(n,i);if(!(!a||a.kind!=="map"))for(const[l,m]of a.entries){if(s.includes(l))continue;const r=O(l,s);t.push({line:m.line,text:r?`поля «${l}» нет — вы имели в виду «${r}»?`:`поля «${l}» здесь нет`})}}const e=o(n,"spec.template.spec.containers");e&&e.kind==="list"&&e.items.forEach(i=>{for(const s of Y(i)){if(E.includes(s))continue;const a=O(s,E);t.push({line:i.line,text:a?`в контейнере нет поля «${s}» — вы имели в виду «${a}»?`:`в контейнере нет поля «${s}»`})}})}function U(n){const t=[];if(!n||n.kind!=="map")return[{line:1,text:"манифест пуст: нужен объект с apiVersion, kind, metadata и spec"}];const e=v(o(n,"apiVersion"));e===void 0?t.push({line:n.line,text:"нет поля apiVersion"}):e!=="apps/v1"&&t.push({line:o(n,"apiVersion").line,text:`Deployment живёт в apps/v1, а не в «${e}»`});const i=v(o(n,"kind"));i===void 0?t.push({line:n.line,text:"нет поля kind"}):i!=="Deployment"&&t.push({line:o(n,"kind").line,text:`здесь ожидается kind: Deployment, а не «${i}»`}),v(o(n,"metadata.name"))===void 0&&t.push({line:(o(n,"metadata")??n).line,text:"у объекта нет metadata.name"});const s=o(n,"spec.replicas");if(s){const f=G(s);f===void 0?t.push({line:s.line,text:"replicas — число, а не строка"}):!Number.isInteger(f)||f<0?t.push({line:s.line,text:"replicas — целое неотрицательное"}):f>12&&t.push({line:s.line,text:"больше двенадцати на эту обстановку не поместится"})}const a=o(n,"spec.template");a||t.push({line:(o(n,"spec")??n).line,text:"нет spec.template: описания пода, который надо создавать"});const l=o(n,"spec.template.spec.containers");l?l.kind!=="list"?t.push({line:l.line,text:"containers — список: каждый пункт начинается с «- »"}):l.items.length===0?t.push({line:l.line,text:"containers пуст: поду нечего запускать"}):l.items.forEach(f=>{v(o(f,"name"))===void 0&&t.push({line:f.line,text:"у контейнера нет name"}),v(o(f,"image"))===void 0&&t.push({line:f.line,text:"у контейнера нет image"});const c=o(f,"resources.requests");if(c){const u=o(c,"cpu"),d=o(c,"memory");u&&A(v(u))===void 0&&t.push({line:u.line,text:"cpu пишется как «500m» или «2»"}),d&&I(v(d))===void 0&&t.push({line:d.line,text:"memory пишется как «512Mi» или «1Gi»"})}}):a&&t.push({line:a.line,text:"нет spec.template.spec.containers"});const m=V(o(n,"spec.selector.matchLabels")),r=V(o(n,"spec.template.metadata.labels"));if(Object.keys(m).length>0){const f=Object.entries(m).filter(([c,u])=>r[c]!==u);f.length>0&&t.push({line:o(n,"spec.selector.matchLabels").line,text:`отбор набора не совпадает с метками шаблона: ${f.map(([c,u])=>`${c}=${u}`).join(", ")} — таких меток у пода нет`})}return Q(n,t),t.sort((f,c)=>f.line-c.line)}const X=(n,t)=>n.cpu>=t.cpu-1e-9&&n.mem>=t.mem-1e-9;function W(n,t){const{doc:e,problems:i}=R(n),s=[...i,...i.length>0?[]:U(e)],a=V(o(e,"spec.template.metadata.labels")),l=o(e,"spec.template.spec.containers"),m=l&&l.kind==="list"?l.items.map(p=>({name:v(o(p,"name"))??"",image:v(o(p,"image"))??"",mounts:(()=>{const h=o(p,"volumeMounts");return!h||h.kind!=="list"?[]:h.items.map(b=>v(o(b,"name"))??"").filter(Boolean)})()})):[],r=o(e,"spec.template.spec.volumes"),f=r&&r.kind==="list"?r.items.map(p=>v(o(p,"name"))??"").filter(Boolean):[];let c=0,u=0;if(l&&l.kind==="list")for(const p of l.items)c+=A(v(o(p,"resources.requests.cpu")))??0,u+=I(v(o(p,"resources.requests.memory")))??0;const d=s.length>0?0:G(o(e,"spec.replicas"))??1,$=v(o(e,"metadata.name"))??"web",g=t.nodes.map(p=>({name:p.name,cpu:p.cpu,mem:p.mem}));for(const p of t.foreign??[]){const h=g.find(b=>b.name===p.node);h&&(h.cpu-=p.cpu,h.mem-=p.mem)}const w=[];for(let p=0;p<d;p+=1){const h=`${$}-${S[p%S.length]}`;let b=-1,j=-1;if(g.forEach((y,M)=>{if(!X(y,{cpu:c,mem:u}))return;const L=(y.cpu-c)/Math.max(t.nodes[M].cpu,.001)+(y.mem-u)/Math.max(t.nodes[M].mem,.001);L>j&&(j=L,b=M)}),b<0){const y=[];g.some(M=>M.cpu>=c-1e-9)||y.push(`${c} ядра`),g.some(M=>M.mem>=u-1e-9)||y.push(`${u.toFixed(2)} ГБ памяти`),w.push({name:h,perche:y.length>0?`нет узла с ${y.join(" и ")}`:"ни на одном узле не осталось места",labels:a,cpu:c,mem:u,served:!1});continue}g[b].cpu-=c,g[b].mem-=u,w.push({name:h,node:g[b].name,labels:a,cpu:c,mem:u,served:!1})}let z;if(t.service){const p=w.filter(h=>h.node!==void 0).filter(h=>Object.entries(t.service.selector).every(([b,j])=>h.labels[b]===j)).map(h=>h.name);z={name:t.service.name,selector:t.service.selector,endpoints:p};for(const h of w)p.includes(h.name)&&(h.served=!0)}return{problems:s,replicas:d,labels:a,containers:m,volumes:f,requests:{cpu:c,mem:u},nodes:t.nodes,pods:w,...z?{service:z}:{},libero:g.map(p=>({name:p.name,cpu:Number(p.cpu.toFixed(2)),mem:Number(p.mem.toFixed(2))}))}}const S=["a4f","b7k","c2m","d9p","e5t","f3w","g8n","h6r","j1s","k4v","m7x","n2z"],k=n=>n.pods.filter(t=>t.node!==void 0).length;function C(n){if(n.problems.length===0)return;const t=n.problems[0];return{done:!1,why:`Манифест не принят. Строка ${t.line}: ${t.text}`}}const T=[{name:"узел-1",cpu:4,mem:8},{name:"узел-2",cpu:4,mem:8}],F=[{id:"replicas",title:"Пусть будет три",task:"Сделайте так, чтобы работали три экземпляра. Не создавайте их по одному — заявите, сколько их должно быть.",nodes:T,start:`apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.27
`,check(n){const t=C(n);if(t)return t;const e=k(n);return e===3?{done:!0,why:"Три экземпляра работают. Вы не создавали ни одного — вы записали, сколько их должно быть."}:e<3?{done:!1,why:`Работают ${e}. Загляните в spec.replicas.`}:{done:!1,why:`Работают ${e} — это больше, чем нужно.`}}},{id:"opechatka",title:"Почему их всё ещё один",task:"В манифесте заявлено три, а работает один. Найдите, почему, и починьте.",nodes:T,start:`apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replica: 3
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.27
`,check(n){const t=C(n);if(t)return t;const e=k(n);return e===3?{done:!0,why:"Три работают. Настоящий apiserver на такое поле отвечает молчанием: он его просто отбрасывает, и найти опечатку можно только глазами."}:{done:!1,why:`Работает ${e}. Поле, которое вы правите, точно так называется?`}}},{id:"selettore",title:"Служба никого не находит",task:"Служба web-svc отбирает поды по метке app=web. Поды работают, а служба пуста. Сделайте так, чтобы она нашла все три.",nodes:T,service:{name:"web-svc",selector:{app:"web"}},start:`apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: web
          image: nginx:1.27
`,check(n){const t=C(n);if(t)return t;const e=n.service?.endpoints.length??0;return e===3&&k(n)===3?{done:!0,why:"Служба нашла все три. Связь идёт по совпадению метки, а не по имени: список имён устарел бы через секунду."}:k(n)!==3?{done:!1,why:`Работают ${k(n)} из трёх.`}:{done:!1,why:`Служба нашла ${e}. Она ищет app=web; у пода метка ${Object.entries(n.labels).map(([i,s])=>`${i}=${s}`).join(", ")||"не задана"}.`}}},{id:"risorse",title:"Три пода, которые не влезли",task:"Заявлено три экземпляра, а работает меньше: каждый просит слишком много. Уменьшите заявку так, чтобы поместились все три — и не меньше 0,5 ядра и 512Mi на экземпляр.",nodes:[{name:"узел-1",cpu:2,mem:4}],start:`apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.27
          resources:
            requests:
              cpu: "1"
              memory: 2Gi
`,check(n){const t=C(n);if(t)return t;if(k(n)!==3){const e=n.pods.find(i=>i.perche);return{done:!1,why:`Работают ${k(n)} из трёх${e?`: ${e.perche}`:""}. На узле 2 ядра и 4 ГБ.`}}return n.requests.cpu<.5||n.requests.mem<.5?{done:!1,why:`Влезли, но заявка занижена: ${n.requests.cpu} ядра и ${(n.requests.mem*1024).toFixed(0)}Mi. Под без заявки почти невесом для планировщика — и узел, полупустой по учёту, задыхается.`}:{done:!0,why:"Все три помещаются. Заметьте, что считается заявка, а не потребление: узел продаёт ёмкость по обещаниям."}}},{id:"due",title:"Второй контейнер в поде",task:"Рядом с web нужен сборщик логов: контейнер fluent-bit:3.1 по имени shipper. Оба должны монтировать один том logs — объявите его в поде.",nodes:T,start:`apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.27
          volumeMounts:
            - name: logs
`,check(n){const t=C(n);if(t)return t;if(n.containers.length<2)return{done:!1,why:`В поде ${n.containers.length} контейнер. Нужен второй — shipper.`};const e=n.containers.find(s=>s.name==="shipper");return e?e.image.startsWith("fluent-bit")?n.containers.every(s=>s.mounts.includes("logs"))?n.volumes.includes("logs")?k(n)<2?{done:!1,why:`Работают ${k(n)} из двух.`}:{done:!0,why:"Два контейнера в одном поде, общий том, общая судьба. Программу трогать не пришлось — логи забирает сосед."}:{done:!1,why:"Том logs монтируют, но нигде не объявляют. Он объявляется на уровне пода — в spec.template.spec.volumes."}:{done:!1,why:"Том logs монтирует не каждый контейнер, а нужны оба: иначе один пишет, а второй читает пустоту."}:{done:!1,why:`У shipper образ «${e.image}», а нужен fluent-bit:3.1.`}:{done:!1,why:"Второй контейнер есть, но зовут его иначе: нужен shipper."}}}];class Z extends P{constructor(){super(...arguments),this.тексты=new Map,this.взятые=new Set,this.отложено=0}static{this.styles=[_,K`
      /* Полоска уровней. Задача у каждого своя, и перейти к следующему можно
         в любой момент: застрять на одном — не то, чему учит курс. */
      .livelli {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 0 0 10px;
      }

      .livello {
        position: relative;
        border: 0;
        background: none;
        cursor: pointer;
        min-width: 40px;
        min-height: 40px;
        padding: 6px 10px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(19px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.1;
        color: var(--тихий, #636a75);
      }

      .livello[aria-current='true'] {
        color: var(--паста, #1b3a6b);
      }

      .livello[aria-current='true']::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='42' preserveAspectRatio='none'><path d='M9,4 C22,2 36,3 42,6 C46,8 46,14 45,22 C44,31 43,36 39,38 C28,41 15,40 8,38 C4,36 3,30 3,22 C3,13 4,7 8,5' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      .livello.fatto {
        color: var(--зелёный, #3f6b4a);
      }

      .compito {
        margin: 0 0 12px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(20px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.25;
        color: var(--текст, #20242c);
        /* Место под три строки задачи: у разных уровней она разной длины, и
           коробка прибора не должна дышать при переходе. */
        min-height: calc(var(--шаг, 26px) * 3.2);
      }

      /* Редактор. Номера строк слева, как в любом настоящем: беда называется
         номером, и найти его надо глазами, а не считая. */
      .editore {
        display: grid;
        grid-template-columns: 2.2em 1fr;
        margin: 0 0 10px;
        background: color-mix(in srgb, var(--бумага, #fffdf6) 82%, transparent);
      }

      /* Свойство white-space: pre здесь стоять НЕ должно, хотя рука тянется
         его поставить: номера лежат блоками, а перевод строки и отступы
         самого шаблона при pre становятся содержимым — и вся колонка
         съезжает вниз на две строки. Ровно эта ошибка уже была в разборе
         манифеста. */
      .numeri {
        margin: 0;
        padding: 8px 4px 8px 0;
        text-align: right;
        font-family: 'PT Mono', monospace;
        font-size: max(calc(12.5px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.45;
        color: var(--тихий, #636a75);
        user-select: none;
        overflow: hidden;
      }

      .numeri b {
        display: block;
        font-weight: 400;
      }

      .numeri b.male {
        color: var(--красный, #a8402f);
      }

      textarea {
        display: block;
        width: 100%;
        border: 0;
        background: none;
        resize: vertical;
        padding: 8px 8px 8px 6px;
        font-family: 'PT Mono', monospace;
        font-size: max(calc(12.5px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.45;
        color: var(--текст, #20242c);
        white-space: pre;
        overflow-wrap: normal;
        overflow-x: auto;
        tab-size: 2;
      }

      textarea:focus-visible {
        outline: 2px solid var(--паста, #1b3a6b);
        outline-offset: 2px;
      }

      .guasti {
        margin: 0 0 12px;
        padding: 0;
        list-style: none;
        /* Две строки бед отведены заранее. */
        min-height: calc(var(--шаг, 26px) * 2);
        font-family: 'PT Mono', monospace;
        font-size: max(calc(12px * var(--кегль, 1)), var(--пол, 0px));
        line-height: var(--шаг, 26px);
        color: var(--красный, #a8402f);
      }

      .guasti li {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Кластер. Узлы, поды внутри, служба сбоку. */
      .cluster {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 10px;
        margin: 0 0 12px;
      }

      .nodo {
        position: relative;
        padding: 7px 10px 8px;
        min-height: calc(var(--шаг, 26px) * 4.4);
      }

      .nodo::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='170' height='120' preserveAspectRatio='none'><path d='M10,5 C56,2 128,4 160,8 C166,9 168,16 168,30 C169,72 168,104 164,113 C126,118 56,117 14,114 C7,113 4,105 4,90 C3,48 4,15 7,9' fill='none' stroke='%231b3a6b' stroke-width='1.5' stroke-linecap='round'/></svg>")
          no-repeat center / 100% 100%;
      }

      /* Имя узла и остаток места — двумя строками, а не в одну.
         В одну они не влезали: на телефоне колонка узла 150 px, и подпись
         «свободно 4 / 8.0 ГБ» вылезала на соседа. */
      .nodo h5 {
        margin: 0 0 2px;
        font-family: 'Caveat', cursive;
        font-weight: 700;
        font-size: max(calc(18px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.1;
        color: var(--паста, #1b3a6b);
      }

      .nodo h5 i {
        display: block;
        font-style: normal;
        font-weight: 400;
        font-family: 'Literata', serif;
        font-size: max(calc(11.5px * var(--кегль, 1)), var(--пол, 0px));
        font-variant-numeric: tabular-nums;
        color: var(--тихий, #636a75);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .pod {
        position: relative;
        margin: 3px 0 0;
        padding: 2px 6px;
        font-family: 'PT Mono', monospace;
        font-size: max(calc(11.5px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.5;
        color: var(--текст, #20242c);
        background: color-mix(in srgb, var(--паста, #1b3a6b) 8%, transparent);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Под, попавший в службу, помечен пастой слева: связь видно, а не
         додумывают. */
      .pod.servito {
        box-shadow: inset 3px 0 0 var(--зелёный, #3f6b4a);
      }

      .attesa .pod {
        background: color-mix(in srgb, var(--красный, #a8402f) 9%, transparent);
      }

      .attesa {
        margin: 0 0 12px;
        min-height: calc(var(--шаг, 26px) * 1.4);
      }

      .attesa p {
        margin: 0 0 2px;
        font-family: 'Caveat', cursive;
        font-size: max(calc(17px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.2;
        color: var(--красный, #a8402f);
      }

      .servizio {
        margin: 0 0 12px;
        padding: 6px 10px;
        min-height: calc(var(--шаг, 26px) * 2);
        font-family: 'PT Mono', monospace;
        font-size: max(calc(12px * var(--кегль, 1)), var(--пол, 0px));
        line-height: 1.5;
        color: var(--грифель, #5c6068);
        box-shadow: inset 3px 0 0 color-mix(in srgb, var(--паста, #1b3a6b) 45%, transparent);
      }

      .servizio b {
        font-weight: 400;
        color: var(--паста, #1b3a6b);
      }

      .servizio.vuoto {
        color: var(--красный, #a8402f);
        box-shadow: inset 3px 0 0 var(--красный, #a8402f);
      }
    `]}static{this.properties={сейчас:{state:!0},tick:{state:!0}}}get уровни(){const t=this.props.levels;return!t||t.length===0?F:F.filter(e=>t.includes(e.id))}get уровень(){return this.уровни[this.сейчас]??this.уровни[0]}get текст(){return this.тексты.get(this.уровень.id)??this.уровень.start}avvia(){this.сейчас=0,this.tick=0}ferma(){this.отложено&&clearTimeout(this.отложено)}правка(t){this.тексты.set(this.уровень.id,t),this.отложено&&clearTimeout(this.отложено),this.отложено=setTimeout(()=>{this.отложено=0,this.tick+=1,this.донести()},120)}донести(){const t=W(this.текст,this.уровень);if(!this.уровень.check(t).done||this.взятые.has(this.уровень.id)||(this.взятые.add(this.уровень.id),!this.props.goal))return;const e=this.уровни.length,i=this.уровни.filter(s=>this.взятые.has(s.id)).length;this.riporta({goal:"built",reached:i===e,score:i/e})}tastiera(t){if(t.key!=="Tab")return;t.preventDefault();const e=t.target,i=e.selectionStart;e.value=`${e.value.slice(0,i)}  ${e.value.slice(e.selectionEnd)}`,e.selectionStart=e.selectionEnd=i+2,this.правка(e.value)}nodo(t,e){const i=t.nodes[e],s=t.libero[e],a=t.pods.filter(l=>l.node===i.name);return x`<div class="nodo">
      <h5>
        ${i.name}
        <i>${s.cpu} ядра / ${s.mem.toFixed(1)} ГБ</i>
      </h5>
      ${a.map(l=>x`<p class="pod ${l.served?"servito":""}" title=${l.name}>${l.name}</p>`)}
    </div>`}render(){const t=this.уровень,e=W(this.текст,t),i=t.check(e),s=e.pods.filter(m=>m.node===void 0),a=this.текст.split(`
`).length,l=new Set(e.problems.map(m=>m.line));return x`<section class="telaio">
      <h4>${this.props.title??"Мастерская манифеста"}</h4>
      <p class="suggerimento">
        ${this.props.hint??"Правьте манифест — кластер отвечает сразу. Задача у каждого уровня своя; беда называется номером строки."}
      </p>

      <div class="livelli" role="group" aria-label="Уровни">
        ${this.уровни.map((m,r)=>x`<button
            class="livello ${this.взятые.has(m.id)?"fatto":""}"
            aria-current=${r===this.сейчас?"true":"false"}
            aria-label=${`Уровень ${r+1}: ${m.title}`}
            @click=${()=>{this.сейчас=r,this.tick+=1}}>
            ${r+1}
          </button>`)}
      </div>

      <p class="compito"><b>${t.title}.</b> ${t.task}</p>

      <div class="editore">
        <p class="numeri" aria-hidden="true">
          ${Array.from({length:a},(m,r)=>x`<b class=${l.has(r+1)?"male":""}>${r+1}</b>`)}
        </p>
        <textarea
          aria-label="Манифест"
          spellcheck="false"
          autocapitalize="off"
          autocorrect="off"
          autocomplete="off"
          rows=${Math.max(10,a)}
          .value=${this.текст}
          @keydown=${m=>this.tastiera(m)}
          @input=${m=>this.правка(m.target.value)}></textarea>
      </div>

      <ul class="guasti" aria-live="polite">
        ${e.problems.slice(0,2).map(m=>x`<li>строка ${m.line}: ${m.text}</li>`)}
        ${e.problems.length>2?x`<li>и ещё ${e.problems.length-2}</li>`:null}
      </ul>

      <div class="cluster">${e.nodes.map((m,r)=>this.nodo(e,r))}</div>

      <div class="attesa">
        ${s.length>0?x`<p>${s.length} в ожидании: ${s[0].perche}</p>
              ${s.map(m=>x`<span class="pod">${m.name}</span>`)}`:null}
      </div>

      ${e.service?x`<p class="servizio ${e.service.endpoints.length===0?"vuoto":""}">
            <b>${e.service.name}</b> отбирает
            ${Object.entries(e.service.selector).map(([m,r])=>`${m}=${r}`).join(",")} — нашла
            ${e.service.endpoints.length}
          </p>`:null}

      <div class="quadranti">
        <div class="quadrante"><b>заявлено</b><span>${e.replicas}</span></div>
        <div class="quadrante ${s.length>0?"male":"bene"}">
          <b>работают</b><span>${e.pods.length-s.length}</span>
        </div>
        <div class="quadrante"><b>заявка пода</b><span>${e.requests.cpu} / ${(e.requests.mem*1024).toFixed(0)}Mi</span></div>
        <div class="quadrante ${this.взятые.size===this.уровни.length?"bene":""}">
          <b>уровней взято</b><span>${this.взятые.size} из ${this.уровни.length}</span>
        </div>
      </div>

      <div class="azioni">
        <button
          class="bottone"
          @click=${()=>{this.тексты.delete(t.id),this.tick+=1}}>
          Сначала
        </button>
        ${i.done&&this.сейчас+1<this.уровни.length?x`<button
              class="bottone"
              @click=${()=>{this.сейчас+=1,this.tick+=1}}>
              Дальше
            </button>`:null}
      </div>

      <p class="esito ${i.done?"bene":""}">${i.why}</p>
    </section>`}}customElements.define("cy-officina",Z);export{Z as Officina};
