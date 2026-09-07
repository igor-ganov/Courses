/* МАТЕРИЯ — освещённая поверхность под страницей.
 *
 * Не тень и не картинка текстуры. Строится поле высот, из него берётся
 * нормаль в каждом пикселе, и по нормали считается свет:
 *
 *   — Орен–Найар вместо Ламберта, потому что бумага шероховатая: она не
 *     гаснет по косинусу, как пластик, а держит яркость до самого края.
 *     Именно ламбертова модель делает бумагу в графике похожей на картон.
 *   — Просвет: тонкий лист пропускает свет сквозь себя, поэтому у сгиба
 *     тёмная сторона всё равно светится. Обёрнутый косинус.
 *   — Слабый широкий GGX — тот блеск, что виден на каландрированной бумаге
 *     под скользящим углом.
 *   — Затенение складок берётся из самого поля высот, а не рисуется.
 *
 * Курсор здесь одновременно лампа и палец: он подсвечивает лист вблизи и
 * продавливает его. Прогиб не рисуется тенью — он смещает сами пиксели
 * страницы через feDisplacementMap, поэтому едут буквы, линейки и клетка.
 * Поле прогиба общее у шейдера и у карты смещения, так что свет и текст
 * гнутся согласованно: нормаль считается уже от продавленной высоты, и блик
 * сам огибает провал. В этом весь смысл затеи.
 *
 * РАЗДЕЛЕНИЕ ПО ЧАСТОТАМ — из-за него всё это едет на телефоне.
 * Свет отвечает только на медленное коробление листа: его и считает шейдер,
 * вполовину разрешения, потому что поле гладкое и растягивание незаметно.
 * Волокна и зерно от лампы почти не зависят, поэтому они печатаются один раз
 * в бесшовную плитку и умножаются поверх в полном разрешении: резко и даром.
 * Раньше шейдер брал ~49 выборок шума на пиксель в полном разрешении, теперь
 * ~9 на пиксель в половине — и только пока пружины не успокоились.
 */

(function () {
  'use strict';

  var VERT =
    '#version 300 es\n' +
    'precision highp float;\n' +
    'const vec2 Q[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));\n' +
    'void main(){ gl_Position = vec4(Q[gl_VertexID], 0., 1.); }';

  var FRAG =
    '#version 300 es\n' +
    'precision highp float;\n' +
    'uniform vec2 uRes; uniform vec2 uPointer; uniform float uPress; uniform float uPresence;\n' +
    'uniform float uScorrimento;\n' +
    'uniform vec3 uPaper; uniform vec3 uShade; uniform vec3 uLight;\n' +
    'uniform float uRelief; uniform float uWarm;\n' +
    'out vec4 fragColor;\n' +
    'float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }\n' +
    'float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);\n' +
    '  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }\n' +
    // Коробление от рук — единственное, что здесь отвечает на движение лампы.
    'float sheet(vec2 p){ float s=0., a=.5; p*=5.5;\n' +
    '  for(int i=0;i<3;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s*.26; }\n' +
    // Прогиб. Не ямка в идеальном круге: лист под пальцем ведёт себя как
    // защемлённая по краям пластина — просаживается на всю ширину и спадает
    // к краям. Вдоль волокон бумага жёстче, поэтому пятно вытянуто, а линия
    // схода рваная: радиус гуляет по углу. То же поле печатается в
    // design/piega.png и смещает им саму страницу, поэтому свет и буквы
    // гнутся заодно.
    'float piega(vec2 p, vec2 c, float amt, float raggio){\n' +
    '  if (amt < .001) return 0.;\n' +
    '  vec2 d = (p-c)/raggio; d.y *= 1.34;\n' +
    '  float r = length(d); if (r > 1.4) return 0.;\n' +
    '  float a = atan(d.y, d.x);\n' +
    '  float R = .72 + .42*vnoise(vec2(cos(a)*2.4+9., sin(a)*2.4+4.));\n' +
    '  float t = clamp(1.-r/R, 0., 1.);\n' +
    '  float w = t*t*(3.-2.*t) * (.82 + .34*vnoise(d*3.6 + vec2(21.,13.)));\n' +
    '  return -amt*w*.19; }\n' +
    'float surf(vec2 p, vec2 c, float amt, float raggio){ return sheet(p) + piega(p,c,amt,raggio); }\n' +
    'float orenNayar(vec3 n, vec3 l, vec3 v, float r){\n' +
    '  float nl=dot(n,l), nv=dot(n,v); if(nl<=0.) return 0.;\n' +
    '  float s2=r*r; float A=1.-.5*(s2/(s2+.33)); float B=.45*(s2/(s2+.09));\n' +
    '  float al=acos(clamp(nl,-1.,1.)), av=acos(clamp(nv,-1.,1.));\n' +
    '  float alpha=max(al,av), beta=min(al,av);\n' +
    '  vec3 lp=normalize(l-n*nl), vp=normalize(v-n*nv);\n' +
    '  return nl*(A + B*max(0.,dot(lp,vp))*sin(alpha)*tan(beta)); }\n' +
    'float ggx(vec3 n, vec3 l, vec3 v, float r){ vec3 h=normalize(l+v); float a=r*r;\n' +
    '  float nh=max(dot(n,h),0.); float d=(nh*nh)*(a*a-1.)+1.; return (a*a)/(3.14159*d*d+1e-5); }\n' +
    'void main(){\n' +
    '  vec2 uv = gl_FragCoord.xy/uRes; float asp = uRes.x/max(uRes.y,1.);\n' +
    // Лист не стоит под текстом, а едет вместе с ним: рисуем по-прежнему
    // только экран, но выборку сдвигаем на прокрутку — коробление, волокна
    // и зерно оказываются приклеены к странице, а не к окну.
    '  vec2 p = vec2(uv.x*asp, uv.y + uScorrimento); vec2 ptr = vec2(uPointer.x*asp, uPointer.y + uScorrimento);\n' +
    // Разность вперёд, а не центральная: три выборки поля вместо пяти,
    // на гладком короблении разницы не видно.
    '  float raggio = .95*asp;\n' +
    '  float h = surf(p, ptr, uPress, raggio);\n' +
    '  float e = 1.6/uRes.y;\n' +
    '  float hx = surf(p+vec2(e,0.),ptr,uPress,raggio) - h;\n' +
    '  float hy = surf(p+vec2(0.,e),ptr,uPress,raggio) - h;\n' +
    '  vec3 n = normalize(vec3(-hx*uRelief*2., -hy*uRelief*2., 1.));\n' +
    '  vec3 view = vec3(0.,0.,1.);\n' +
    '  vec3 key = normalize(vec3(-.42,.55,.72));\n' +
    '  vec3 toP = vec3(ptr-p, .30); float dP = length(toP); vec3 dirP = toP/max(dP,1e-4);\n' +
    '  float fall = uPresence/(1.+26.*dP*dP);\n' +
    '  float rough = .86;\n' +
    '  float lit = orenNayar(n,key,view,rough)*.72 + orenNayar(n,dirP,view,rough)*fall*.85;\n' +
    '  float through = pow(max(0.,(dot(n,key)+.55)/1.55), 2.2)*.30;\n' +
    '  float ao = clamp(.80 + h*.55 + piega(p,ptr,uPress,raggio)*1.5, .45, 1.10);\n' +
    '  float sheen = ggx(n,key,view,.55)*.030 + ggx(n,dirP,view,.45)*.045*fall;\n' +
    '  float expo = .93 + (lit-.55)*.42 + through*.30;\n' +
    '  expo *= mix(1., ao, .45);\n' +
    '  vec3 c = uPaper * clamp(expo, .70, 1.12);\n' +
    '  c = mix(c, uShade, clamp((1.-clamp(expo,0.,1.))*.55, 0., .45));\n' +
    '  c += uLight*sheen + uLight*fall*uWarm;\n' +
    '  vec2 ctr = uv-.5; c *= 1. - dot(ctr,ctr)*.16;\n' +
    '  fragColor = vec4(c,1.); }';

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    var ok = gl.getShaderParameter(sh, gl.COMPILE_STATUS);
    return { ok: ok, shader: sh, log: ok ? '' : gl.getShaderInfoLog(sh) };
  }

  function rgb(value, fallback) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(value || '').trim());
    var hex = m ? m[1] : fallback;
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
    ];
  }

  /* ── ВОЛОКНА И ЗЕРНО ───────────────────────────────────────────────
     Бесшовная плитка 160×160, умножается поверх света в полном разрешении:
     резко и даром. Печатает её design/grana.mjs на сборке — считать полмиллиона
     синусов в браузере при каждом запуске незачем, картинка всегда одна.
     Сорта бумаги отличаются силой пучков, а не рисунком, поэтому разницу
     делает прозрачность, и плитка одна на все направления. */

  var СОРТ_ПЛИТКИ = 0.06;

  var src = document.currentScript && document.currentScript.src;
  var БАЗА = src ? src.slice(0, src.lastIndexOf('/') + 1) : '';
  var GRANA = БАЗА + 'grana.png';
  var MAPPA = БАЗА + 'piega.png';

  /* ── ПРОГИБ ───────────────────────────────────────────────────────
     Страница гнётся по-настоящему: feDisplacementMap смещает уже
     нарисованные пиксели — буквы, линейки, клетку, зерно, — а не рисует
     тень под ними. Вектор смещения берётся из design/piega.png, из того же
     поля, по которому шейдер считает свет, поэтому блик и текст едут
     согласованно.

     feFlood под картой обязателен: за её пределами каналы были бы нулевыми,
     то есть смещением на половину масштаба, и вся остальная страница поехала
     бы вбок. Серый 128 — это ноль.

     Область фильтра задаётся вручную и держится в пределах экрана: иначе
     браузер растрирует под фильтр весь лист во всю длину документа, и первый
     кадр нажатия спотыкается на этом. За пределами области фильтр обрезает,
     но там всё равно то, что за краем окна. */
  function filtro(id) {
    return (
      '<filter id="' + id + '" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" ' +
      'x="0" y="0" width="0" height="0" color-interpolation-filters="sRGB">' +
      '<feFlood flood-color="#808080" result="zero"/>' +
      '<feImage href="' + MAPPA + '" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="mappa"/>' +
      '<feMerge result="campo"><feMergeNode in="zero"/><feMergeNode in="mappa"/></feMerge>' +
      '<feDisplacementMap in="SourceGraphic" in2="campo" scale="0" ' +
      'xChannelSelector="R" yChannelSelector="G"/>' +
      '</filter>'
    );
  }

  /* Затухающая пружина: у материала есть масса, поэтому свет догоняет
     курсор, а вмятина возвращается не мгновенно. */
  var calm =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* На тачскрине лампу за пальцем не водят: палец приходит и уходит, а не
     скользит, и каждое движение — это скролл. Свет стоит, вмятина от касания. */
  var coarse =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

  function step(s, target, dt, k, c) {
    if (calm) {
      s.x = target;
      s.v = 0;
      return s;
    }
    var remaining = Math.min(dt, 0.25);
    while (remaining > 0) {
      var h = Math.min(1 / 240, remaining);
      s.v += (k * (target - s.x) - c * s.v) * h;
      s.x += s.v * h;
      remaining -= h;
    }
    return s;
  }

  /* ── ЛИСТ ─────────────────────────────────────────────────────────
     Страница переезжает внутрь .foglio, а холст и зерно остаются снаружи:
     элемент с трансформацией становится системой отсчёта для position:fixed
     внутри себя, и подложка уехала бы вместе с текстом. Перспектива живёт
     на .scena по той же причине.

     Делается это до первой отрисовки: перенос узлов меняет схлопывание
     полей, и сделанный позже он дёрнул бы вёрстку — тот самый layout shift.
     А вот стекло и зерно ждут простоя: они ничего не двигают, зато шейдер
     компилируется небыстро. */
  function vesti(canvas) {
    var scena = document.createElement('div');
    scena.className = 'scena';
    var foglio = document.createElement('div');
    foglio.className = 'foglio';
    scena.appendChild(foglio);

    var grana = document.createElement('div');
    grana.className = 'grana';
    grana.setAttribute('aria-hidden', 'true');
    grana.style.cssText =
      'position:fixed;inset:0;z-index:-1;pointer-events:none;' +
      'background-repeat:repeat;background-size:128px 128px;mix-blend-mode:multiply;' +
      'background-image:url(' + GRANA + ')';

    Array.prototype.slice.call(document.body.children).forEach(function (el) {
      var skip =
        el === canvas || el.tagName === 'SCRIPT' || el.hasAttribute('data-fisso');
      if (!skip) foglio.appendChild(el);
    });
    document.body.insertBefore(scena, canvas.nextSibling);
    document.body.appendChild(grana);

    var difese = document.createElement('div');
    difese.setAttribute('aria-hidden', 'true');
    difese.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    difese.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">' +
      filtro('piega-foglio') + filtro('piega-grana') +
      '</svg>';
    document.body.appendChild(difese);

    var regole = document.createElement('style');
    regole.textContent =
      '.scena{perspective:900px;perspective-origin:var(--presso-x,50%) var(--presso-y,50%)}' +
      '.foglio{position:relative;min-height:100%;transform-origin:50% 50%}';
    document.head.appendChild(regole);

    return { scena: scena, foglio: foglio, grana: grana, svg: difese };
  }

  function start(canvas, parti) {
    var gl = null;
    try {
      gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false });
    } catch (err) {
      gl = null;
    }
    if (!gl) {
      document.documentElement.setAttribute('data-materia', 'dipinta');
      return;
    }

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs.ok || !fs.ok) {
      console.warn('materia:', vs.log || fs.log);
      document.documentElement.setAttribute('data-materia', 'dipinta');
      return;
    }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs.shader);
    gl.attachShader(prog, fs.shader);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindVertexArray(gl.createVertexArray());
    document.documentElement.setAttribute('data-materia', 'illuminata');

    var d = canvas.dataset;
    var paper = rgb(d.carta, 'f3ece0');
    var shade = rgb(d.ombra, '8f8474');
    var light = rgb(d.luce, 'fff6e2');
    var relief = parseFloat(d.rilievo || '11');
    var fibre = parseFloat(d.fibra || '0.055');
    var warm = parseFloat(d.calore || '0.06');

    // Карту прогиба греем заранее: иначе первый же кадр нажатия ждёт,
    // пока картинка раскодируется, и спотыкается.
    new Image().src = MAPPA;

    /* Печатная подложка — клетка, сетка синьки, лента телетайпа — часть листа
       и едет с текстом. Но растягивать её на всю длину документа нельзя:
       браузер тогда красит полотно во весь документ. Поэтому она размером с
       окно, сдвигается по прокрутке вместе с рисунком — и приклеена к тексту,
       хотя красится всегда один экран. */
    var strati = [];

    function rileggi() {
      strati = Array.prototype.slice.call(document.querySelectorAll('[data-scorre]'));
    }

    var grana = parti.grana;
    grana.style.opacity = Math.min(1, fibre / СОРТ_ПЛИТКИ).toFixed(2);

    var u = {};
    ['uRes', 'uPointer', 'uPress', 'uPresence', 'uPaper', 'uShade', 'uLight', 'uRelief', 'uWarm',
      'uScorrimento'].forEach(
      function (name) {
        u[name] = gl.getUniformLocation(prog, name);
      },
    );

    var sx = { x: 0.5, v: 0 };
    var sy = { x: 0.7, v: 0 };
    var sp = { x: 0, v: 0 };
    var sPresence = { x: 0, v: 0 };
    var tx = 0.5;
    var ty = 0.7;
    var pressed = false;
    var present = 0;
    var last = 0;
    var running = false;
    var scorrimento = 0;
    var pressoX = 0.5;
    var pressoY = 0.5;

    var scena = parti.scena;
    var foglio = parti.foglio;

    /* Прогиб. Настоящий локальный изгиб одним элементом CSS не сделать —
       но точка схода перспективы ставится туда, куда нажали, и лист уходит
       от глаза: тогда вблизи пальца страница почти не сдвигается, а к краям
       смещение растёт. Читается это именно как продавленная под пальцем
       бумага, а не как «страница отъехала». Плюс небольшой наклон в сторону
       нажатия, чтобы движение не было чистым зумом.

       Дрожь при возврате даёт сама пружина: демпфирование заметно ниже
       критического (ζ≈0.37), поэтому лист проскакивает покой, выгибается в
       обратную сторону примерно на треть и качается, затухая. */
    var mappaFoglio = parti.svg.querySelector('#piega-foglio feImage');
    var scalaFoglio = parti.svg.querySelector('#piega-foglio feDisplacementMap');
    var mappaGrana = parti.svg.querySelector('#piega-grana feImage');
    var scalaGrana = parti.svg.querySelector('#piega-grana feDisplacementMap');

    function regione(id, x, y, w, h) {
      var f = parti.svg.querySelector('#' + id);
      f.setAttribute('x', x.toFixed(0));
      f.setAttribute('y', y.toFixed(0));
      f.setAttribute('width', w.toFixed(0));
      f.setAttribute('height', h.toFixed(0));
    }

    function posa(img, cx, cy, lato) {
      img.setAttribute('x', (cx - lato / 2).toFixed(1));
      img.setAttribute('y', (cy - lato / 2).toFixed(1));
      img.setAttribute('width', lato.toFixed(1));
      img.setAttribute('height', lato.toFixed(1));
    }

    function piega(finito) {
      var d = sp.x;
      // Наклон всего листа остаётся: смещение пикселей даёт сам прогиб, а
      // поворот — то, что лист при этом уходит от глаза целиком.
      foglio.style.transform = finito
        ? ''
        : 'translateZ(' + -22 * d + 'px)' +
          'rotateX(' + (0.5 - pressoY) * 2.2 * d + 'deg)' +
          'rotateY(' + (pressoX - 0.5) * 2.2 * d + 'deg)';
      scena.style.setProperty('--presso-x', (pressoX * 100).toFixed(1) + '%');
      scena.style.setProperty('--presso-y', (pressoY * 100).toFixed(1) + '%');

      // Фильтр включается только на время прогиба: в покое он не стоит
      // ничего, потому что его нет.
      if (finito) {
        foglio.style.filter = '';
        foglio.style.willChange = '';
        grana.style.filter = '';
        return;
      }
      var w = window.innerWidth;
      var lato = w * 1.9;
      var cx = pressoX * w;
      var cy = pressoY * window.innerHeight;
      var h = window.innerHeight;
      regione('piega-foglio', 0, window.scrollY - 40, w, h + 80);
      regione('piega-grana', 0, 0, w, h);
      posa(mappaFoglio, cx, cy + window.scrollY, lato);
      posa(mappaGrana, cx, cy, lato);
      // Масштаб — полный размах смещения: ±0,85% ширины окна на пике.
      // Больше — и буквы рвутся в клочья, меньше — прогиб не читается.
      var forza = (2 * 0.012 * w * d).toFixed(2);
      scalaFoglio.setAttribute('scale', forza);
      scalaGrana.setAttribute('scale', forza);
      foglio.style.filter = 'url(#piega-foglio)';
      foglio.style.willChange = 'transform,filter';
      // Зерно живёт в координатах окна, поэтому у него своя копия фильтра с
      // той же картой, но поставленной по экрану, а не по документу.
      grana.style.filter = 'url(#piega-grana)';
    }

    function draw() {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      gl.uniform2f(u.uPointer, sx.x, sy.x);
      gl.uniform1f(u.uPress, sp.x);
      gl.uniform1f(u.uPresence, sPresence.x);
      gl.uniform3fv(u.uPaper, paper);
      gl.uniform3fv(u.uShade, shade);
      gl.uniform3fv(u.uLight, light);
      gl.uniform1f(u.uRelief, relief);
      gl.uniform1f(u.uWarm, warm);
      gl.uniform1f(u.uScorrimento, scorrimento);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /* Свет один на всю страницу: те же координаты уходят в CSS-переменные,
       поэтому тени карточек и блик на кнопке знают, где лампа. Пишутся они
       только вместе с кадром — иначе пересчёт стилей всей страницы идёт
       вхолостую шестьдесят раз в секунду. */
    function vars() {
      var root = document.documentElement.style;
      root.setProperty('--luce-x', sx.x.toFixed(3));
      root.setProperty('--luce-y', (1 - sy.x).toFixed(3));
      root.setProperty('--luce-dx', (sx.x - 0.5).toFixed(3));
      root.setProperty('--luce-dy', (0.5 - sy.x).toFixed(3));
      root.setProperty('--premuto', sp.x.toFixed(3));
    }

    function tick(now) {
      var dt = last === 0 ? 1 / 60 : (now - last) / 1000;
      last = now;
      step(sx, tx, dt, 120, 22);
      step(sy, ty, dt, 120, 22);
      // Демпфирование заметно ниже критического (ζ≈0.36): лист проскакивает
      // мимо покоя и дрожит, возвращаясь, — как настоящая бумага.
      step(sp, pressed ? 1 : 0, dt, 480, 16);
      step(sPresence, present, dt, 120, 22);
      var busy =
        Math.abs(sx.x - tx) > 1e-3 ||
        Math.abs(sy.x - ty) > 1e-3 ||
        Math.abs(sp.x - (pressed ? 1 : 0)) > 1e-3 ||
        Math.abs(sp.v) > 1e-3 ||
        Math.abs(sPresence.x - present) > 1e-3;
      draw();
      vars();
      // Трансформацию снимаем только когда цикл кончился: иначе на нулях
      // качающейся пружины лист мигал бы между «согнут» и «плоский».
      piega(!busy);
      running = busy;
      if (busy) requestAnimationFrame(tick);
    }

    function wake() {
      if (running) return;
      running = true;
      last = 0;
      requestAnimationFrame(tick);
    }

    /* Свет — поле гладкое, поэтому считается в неполном разрешении и
       растягивается: вчетверо меньше пикселей, разницы не видно. Зерно
       поверх идёт отдельной плиткой и остаётся резким. */
    var wide = 0;
    var high = 0;

    function resize() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      // Адресная строка на телефоне ездит и меняет высоту — это не смена
      // раскладки, пересчитывать под неё нечего.
      if (w === wide && Math.abs(h - high) < 120) return;
      wide = w;
      high = h;
      var scala = coarse ? 0.5 : 0.6;
      canvas.width = Math.max(1, Math.floor(w * scala));
      canvas.height = Math.max(1, Math.floor(h * scala));
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      draw();
      wake();
    }

    /* Смена сорта бумаги: лампа та же, лист другой. */
    window.materia = {
      // Витрина разворачивает направление из template — подложку в нём надо
      // взять на поводок.
      rileggi: function () { rileggi(); scorri(); },
      setStock: function (stock) {
        paper = rgb(stock.carta, 'f3ece0');
        shade = rgb(stock.ombra, '8f8474');
        light = rgb(stock.luce, 'fff6e2');
        relief = parseFloat(stock.rilievo || relief);
        warm = parseFloat(stock.calore || warm);
        var f = parseFloat(stock.fibra);
        if (f === f) {
          fibre = f;
          grana.style.opacity = Math.min(1, fibre / СОРТ_ПЛИТКИ).toFixed(2);
        }
        draw();
      },
    };

    if (!coarse) {
      window.addEventListener(
        'pointermove',
        function (ev) {
          tx = ev.clientX / Math.max(window.innerWidth, 1);
          ty = 1 - ev.clientY / Math.max(window.innerHeight, 1);
          present = 1;
          wake();
        },
        { passive: true },
      );
    }
    function mira(ev) {
      tx = ev.clientX / Math.max(window.innerWidth, 1);
      ty = 1 - ev.clientY / Math.max(window.innerHeight, 1);
      pressoX = tx;
      pressoY = ev.clientY / Math.max(window.innerHeight, 1);
      present = 1;
    }

    /* На тачскрине нажатие начинается одинаково и для касания, и для
       прокрутки, поэтому лист гнётся не по нажатию, а по состоявшемуся
       касанию: палец опустился и поднялся, не уехав. Иначе страница
       кланялась бы на каждом свайпе. */
    var giu = null;
    window.addEventListener(
      'pointerdown',
      function (ev) {
        giu = { x: ev.clientX, y: ev.clientY, t: performance.now() };
        mira(ev);
        if (!coarse) pressed = true;
        wake();
      },
      { passive: true },
    );
    window.addEventListener(
      'pointerup',
      function (ev) {
        pressed = false;
        var tocco =
          coarse &&
          giu &&
          Math.abs(ev.clientX - giu.x) < 12 &&
          Math.abs(ev.clientY - giu.y) < 12 &&
          performance.now() - giu.t < 600;
        giu = null;
        if (tocco) {
          mira(ev);
          pressed = true;
          setTimeout(function () { pressed = false; wake(); }, 90);
        }
        wake();
      },
      { passive: true },
    );
    window.addEventListener(
      'pointercancel',
      function () { giu = null; pressed = false; wake(); },
      { passive: true },
    );
    document.addEventListener('pointerleave', function () { present = 0; pressed = false; wake(); });
    window.addEventListener('resize', resize, { passive: true });

    /* Прокрутка не анимируется пружиной: лист приклеен к тексту намертво,
       поэтому смещение берётся прямо из окна и кадр рисуется один.

       Печатная подложка — клетка, сетка синьки, лента телетайпа — тоже часть
       листа и едет с текстом. Но растягивать её на всю длину документа
       нельзя: браузер растрирует полотно во весь документ, и первая
       отрисовка встаёт. Поэтому подложка размером с окно, а прилипание
       делает сдвиг фона. */
    function scorri() {
      var h = Math.max(window.innerHeight, 1);
      scorrimento = window.scrollY / h;
      var y = window.scrollY;
      grana.style.backgroundPositionY = -y + 'px';
      strati.forEach(function (el) {
        el.style.transform = 'translateY(' + y + 'px)';
        el.style.backgroundPositionY = -y + 'px';
      });
      if (!running) draw();
    }
    window.addEventListener('scroll', scorri, { passive: true });

    rileggi();
    resize();
    scorri();
  }

  function appenaLibero(fn) {
    var idle = window.requestIdleCallback;
    if (idle) idle(fn, { timeout: 800 });
    else setTimeout(fn, 1);
  }

  window.addEventListener('DOMContentLoaded', function () {
    var canvas = document.querySelector('canvas[data-materia]');
    if (!canvas) return;
    var parti = vesti(canvas);
    var accendi = function () {
      appenaLibero(function () { start(canvas, parti); });
    };
    if (document.readyState === 'complete') accendi();
    else window.addEventListener('load', accendi);
  });
})();
