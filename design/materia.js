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
 * продавливает его.
 *
 * КАК ГНЁТСЯ БУМАГА. Она нерастяжима: растянуть лист примерно в (L/h)² ≈ 10⁵
 * раз дороже, чем согнуть, а изгиб сохраняет гауссову кривизну — у плоского
 * листа она нулевая, значит и после нажатия нулевая всюду. Ямок и чаш бумага
 * не делает: для них нужна двойная кривизна, то есть растяжение. Получается
 * развёртывающийся конус, z(ρ,θ) = ρ·ψ(θ): вдоль каждого луча из точки
 * касания лист прямой, вся кривизна поперёк лучей, а сектор шириной 139°
 * отходит от опоры. На границах сектора ψ ломается — оттуда рёбра, на
 * которых ломается свет, и они-то и видны.
 *
 * Прогиб не рисуется тенью: то же поле смещает сами пиксели страницы через
 * feDisplacementMap, поэтому едут буквы, линейки и клетка. Свет и текст
 * гнутся согласованно, потому что поле у них одно.
 *
 * Схемы, числа и источники — /geometria.html и /tocchi.html.
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
    'uniform float uAsse; uniform float uRaggio; uniform float uAffondo; uniform float uPiega;\n' +
    'out vec4 fragColor;\n' +
    'float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }\n' +
    'float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);\n' +
    '  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }\n' +
    // Коробление от рук — единственное, что здесь отвечает на движение лампы.
    'float sheet(vec2 p){ float s=0., a=.5; p*=5.5;\n' +
    '  for(int i=0;i<3;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s*.26; }\n' +
    // ── КОНУС ────────────────────────────────────────────────────────
    // Бумага нерастяжима, поэтому под пальцем она складывается в
    // развёртывающийся конус: z(ρ,θ) = ρ·ψ(θ). Вдоль каждого луча из точки
    // касания лист ПРЯМОЙ, вся кривизна поперёк лучей. Сектор шириной 139°
    // отходит от опоры, и на его границах ψ ломается — оттуда рёбра, на
    // которых ломается свет. Ямки с двойной кривизной у бумаги не бывает:
    // для неё нужно растяжение, а оно на пять порядков дороже изгиба.
    // Подробности и источники — /geometria.html.
    'const float SETT = 2.42601;\n' +
    'const float KLIFT = 1.15;\n' +
    // Косинус, а не его квадрат: на границе сектора нужен излом, иначе
    // ребра не будет.
    // У границы лист держат — деформация туда не доходит.
    'float tenuta(float t){ return 1. - smoothstep(1., 1.35, t); }\n' +
    // Ядро: у вершины точного конуса кривизна расходится, поэтому там
    // бумага тянется и форма скругляется. R_c ~ h^⅓R^⅔ — примерно
    // десятая часть радиуса. Заодно это снимает алиасинг в вершине.
    'float nucleo(float t){ return smoothstep(0., .12, t); }\n' +
    // Высота и наклон одним заходом: atan и приведение угла стоят дороже
    // всего остального, а нужны они обоим.
    'vec3 cono(vec2 p, vec2 c, float amt, float raggio){\n' +
    '  if (amt < .001) return vec3(0.);\n' +
    '  vec2 d = p - c; float rho = max(length(d), 1e-4);\n' +
    '  float t = rho/raggio; if (t > 1.35) return vec3(0.);\n' +
    '  float a = atan(d.y,d.x) - uAsse;\n' +
    '  a = mod(a + 3.14159265, 6.2831853) - 3.14159265;\n' +
    '  float dentro = step(abs(a), SETT*.5);\n' +
    '  float w = 3.14159265*a/SETT;\n' +
    '  float pa = 1. + KLIFT*cos(w)*dentro;\n' +
    '  float pd = -KLIFT*(3.14159265/SETT)*sin(w)*dentro;\n' +
    '  float psi0 = amt*uAffondo;\n' +
    '  float g = tenuta(t)*nucleo(t);\n' +
    '  vec2 rad = d/rho; vec2 tng = vec2(-rad.y, rad.x);\n' +
    '  vec2 grad = (rad*psi0*pa + tng*psi0*pd)*g;\n' +
    '  return vec3(psi0*(rho*pa - raggio)*tenuta(t), grad); }\n' +
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
    // Коробление даёт нормаль разностью вперёд — три выборки вместо пяти,
    // на гладком поле разницы не видно. Конус приходит готовым наклоном.
    '  float h = sheet(p);\n' +
    '  float e = 1.6/uRes.y;\n' +
    '  float hx = sheet(p+vec2(e,0.)) - h;\n' +
    '  float hy = sheet(p+vec2(0.,e)) - h;\n' +
    '  vec3 cn = cono(p, ptr, uPress, uRaggio); float hc = cn.x; vec2 gc = cn.yz;\n' +
    '  vec3 n = normalize(vec3(-(hx*uRelief*2.+gc.x*uPiega), -(hy*uRelief*2.+gc.y*uPiega), 1.));\n' +
    '  vec3 view = vec3(0.,0.,1.);\n' +
    '  vec3 key = normalize(vec3(-.42,.55,.72));\n' +
    '  vec3 toP = vec3(ptr-p, .30); float dP = length(toP); vec3 dirP = toP/max(dP,1e-4);\n' +
    '  float fall = uPresence/(1.+26.*dP*dP);\n' +
    '  float rough = .86;\n' +
    '  float lit = orenNayar(n,key,view,rough)*.72 + orenNayar(n,dirP,view,rough)*fall*.85;\n' +
    '  float through = pow(max(0.,(dot(n,key)+.55)/1.55), 2.2)*.30;\n' +
    '  float ao = clamp(.80 + h*.55 + hc*1.6, .45, 1.10);\n' +
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

  /* ── ПРОГИБ ───────────────────────────────────────────────────────
     Страница гнётся по-настоящему: feDisplacementMap смещает уже
     нарисованные пиксели — буквы, линейки, клетку, — а не рисует тень под
     ними. Поле то же, по которому шейдер считает свет, поэтому блик и текст
     гнутся согласованно.

     Карта не испечена на сборке, а считается под каждое нажатие: масштаб
     конуса задаёт расстояние до ближайшего края, сектор разворачивается
     туда, где листу есть куда уйти. Нажатие у края и нажатие посередине —
     разные деформации, одной картинкой их не покрыть.

     Смещение чисто радиальное: бумага нерастяжима, поэтому точка, лежавшая
     в ρ от вершины, остаётся в ρ от неё — но вдоль наклонённой генератрисы,
     и сверху это ρ·cos φ(θ). Поперёк луча не смещается ничего.

     feFlood под картой обязателен: за её пределами каналы были бы нулевыми,
     то есть смещением на половину масштаба, и вся остальная страница поехала
     бы вбок. Серый 128 — это ноль. Область фильтра держится в пределах
     экрана, иначе браузер растрирует под фильтр весь лист во всю длину. */

  var SETTORE = (139 * Math.PI) / 180;
  var KLIFT = 1.15;
  /* Глубина под пальцем постоянна — палец жмёт одинаково, — а вот ψ = Δ/R
     зависит от того, где нажали: у края конус вчетверо круче, чем посреди
     страницы. Тридцать пикселей — это уже щедро: в настоящей бумаге при
     таком радиусе смещение печати было бы долей пикселя, и видно было бы
     только светотень. */
  var ГЛУБИНА = 30;
  /* Но ψ = Δ/R нельзя отпускать на волю: у края R маленькое, и получается
     наклон в тридцать градусов — в лист шириной в ладонь вдавлено три
     сантиметра. У настоящей бумаги ψ порядка 0,05; держим в этих пределах,
     иначе печать не гнётся, а рвётся. */
  var ПОЛОГО = 0.03;
  var КРУТО = 0.16;

  function psiA(a) {
    var t = ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    if (Math.abs(t) > SETTORE / 2) return 1;
    return 1 + KLIFT * Math.cos((Math.PI * t) / SETTORE);
  }

  function tenuta(t) {
    if (t <= 1) return 1;
    if (t >= 1.35) return 0;
    var u = (t - 1) / 0.35;
    return 1 - u * u * (3 - 2 * u);
  }

  /* Лист держат боковые края окна; верх и низ свободны — там страница
     продолжается прокруткой. Отсюда масштаб конуса и разворот сектора. */
  function opora(x, y, w, h) {
    var R = Math.max(Math.min(x, w - x), 24);
    var su = Math.max(y, 1);
    var giu = Math.max(h - y, 1);
    var asse = 1 / (giu * giu) >= 1 / (su * su) ? Math.PI / 2 : -Math.PI / 2;
    return { R: R, asse: asse };
  }

  /* Карта смещения под конкретное нажатие. 64×64 хватает: поле гладкое,
     а рёбра всё равно рисует свет, а не сдвиг пикселей. */
  var СЕТКА = 96;
  var холст = null;
  /* Поле зависит только от радиуса и разворота сектора, поэтому радиус
     округляется до четверти сотни пикселей и карты переиспользуются:
     пересчёт стоит несколько миллисекунд, а нажатий много. */
  var кэш = {};

  function mappaCono(R, asse, psi0) {
    var ключ = Math.round(R / 24) + ':' + (asse > 0 ? 'g' : 's');
    if (кэш[ключ]) return кэш[ключ];
    if (!холст) {
      холст = document.createElement('canvas');
      холст.width = СЕТКА;
      холст.height = СЕТКА;
    }
    var ctx = холст.getContext('2d');
    var img = ctx.createImageData(СЕТКА, СЕТКА);
    var L = R * 1.35;
    var поле = new Float32Array(СЕТКА * СЕТКА * 2);
    var пик = 1e-6;
    for (var j = 0; j < СЕТКА; j++) {
      for (var i = 0; i < СЕТКА; i++) {
        var dx = (((i + 0.5) / СЕТКА) * 2 - 1) * L;
        var dy = (((j + 0.5) / СЕТКА) * 2 - 1) * L;
        var rho = Math.sqrt(dx * dx + dy * dy);
        var o = (j * СЕТКА + i) * 2;
        if (rho > 1e-3) {
          var psi = psi0 * psiA(Math.atan2(dy, dx) - asse);
          // Печать съезжает к вершине на ρ(1−cos φ). Карта читается наоборот
          // — пиксель берётся со сдвигом, — поэтому пишем вектор наружу.
          var k = (1 - Math.cos(Math.atan(psi))) * tenuta(rho / R);
          поле[o] = dx * k;
          поле[o + 1] = dy * k;
          пик = Math.max(пик, Math.abs(поле[o]), Math.abs(поле[o + 1]));
        }
      }
    }
    for (var q = 0; q < СЕТКА * СЕТКА; q++) {
      var b = q * 4;
      img.data[b] = Math.round(128 + (127 * поле[q * 2]) / пик);
      img.data[b + 1] = Math.round(128 + (127 * поле[q * 2 + 1]) / пик);
      img.data[b + 2] = 128;
      img.data[b + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    кэш[ключ] = { url: холст.toDataURL('image/png'), пик: пик, сторона: 2 * L };
    return кэш[ключ];
  }

  function filtro(id) {
    return (
      '<filter id="' + id + '" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" ' +
      'x="0" y="0" width="0" height="0" color-interpolation-filters="sRGB">' +
      '<feFlood flood-color="#808080" result="zero"/>' +
      '<feImage x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="mappa"/>' +
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
      '.foglio{position:relative;min-height:100%;transform-origin:50% 50%;' +
      // Долгое нажатие на телефоне — это выделение текста и меню «копировать».
      // Лист трогают, а не читают буфером обмена, поэтому выделение с него
      // снимаем: в самой платформе его придётся возвращать точечно — на
      // цитаты, формулы и код.
      '-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}';
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
    // Насколько наклон конуса разворачивает нормаль: коробление приходит
    // разностью высот, конус — готовым наклоном, их надо привести к одному.
    var piegaLuce = parseFloat(d.piega || '0.28');

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
      'uScorrimento', 'uAsse', 'uRaggio', 'uAffondo', 'uPiega'].forEach(
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
    var raggio = 0.5; // радиус конуса в высотах окна
    var asse = -Math.PI / 2; // куда развёрнут сектор отрыва
    var campo = { url: '', пик: 1, сторона: 0 };
    var affondo = 0.1; // ψ0 = Δ/R — наклон генератрисы в секторе контакта

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
      var h = window.innerHeight;
      var cx = pressoX * w;
      var cy = pressoY * h;
      regione('piega-foglio', 0, window.scrollY - 40, w, h + 80);
      regione('piega-grana', 0, 0, w, h);
      posa(mappaFoglio, cx, cy + window.scrollY, campo.сторона);
      posa(mappaGrana, cx, cy, campo.сторона);
      // Размах — из самого поля: пик смещения в пикселях, умноженный на два,
      // потому что карта кодирует диапазон ±½ масштаба.
      var forza = (2 * campo.пик * d).toFixed(2);
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
      gl.uniform1f(u.uAsse, asse);
      gl.uniform1f(u.uRaggio, raggio);
      gl.uniform1f(u.uAffondo, affondo);
      gl.uniform1f(u.uPiega, piegaLuce);
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
      // Снимать деформацию можно только когда лист снова плоский, а не когда
      // цикл кончился: пока палец держат, пружина стоит в единице и кадров
      // нет — но лист-то согнут.
      piega(!pressed && sp.x < 0.002);
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
    /* Новое касание — новое поле: и масштаб конуса, и разворот сектора
       зависят от того, где нажали. Считается один раз на нажатие: 64×64
       выборки и упаковка в PNG — около трёх миллисекунд. */
    function nuovoCampo() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      var op = opora(pressoX * w, pressoY * h, w, h);
      affondo = Math.max(ПОЛОГО, Math.min(КРУТО, ГЛУБИНА / op.R));
      campo = mappaCono(op.R, op.asse, affondo);
      mappaFoglio.setAttribute('href', campo.url);
      mappaGrana.setAttribute('href', campo.url);
      raggio = op.R / Math.max(h, 1);
      asse = -op.asse; // в шейдере ось Y смотрит вверх
    }

    function mira(ev) {
      tx = ev.clientX / Math.max(window.innerWidth, 1);
      ty = 1 - ev.clientY / Math.max(window.innerHeight, 1);
      pressoX = tx;
      pressoY = ev.clientY / Math.max(window.innerHeight, 1);
      present = 1;
    }

    /* На тачскрине нажатие начинается одинаково и для касания, и для
       прокрутки, поэтому лист гнётся не сразу: через сто миллисекунд, если
       палец не уехал. Тогда и короткий тап, и удержание дают прогиб, а свайп
       не даёт ничего — иначе страница кланялась бы на каждой прокрутке. */
    var giu = null;
    var mosso = false;
    var attesa = null;

    function molla() {
      if (attesa) clearTimeout(attesa);
      attesa = null;
    }

    window.addEventListener(
      'pointerdown',
      function (ev) {
        giu = { x: ev.clientX, y: ev.clientY, t: performance.now() };
        mosso = false;
        mira(ev);
        nuovoCampo();
        molla();
        if (coarse) {
          attesa = setTimeout(function () {
            if (!mosso) {
              pressed = true;
              wake();
            }
          }, 100);
        } else {
          pressed = true;
        }
        wake();
      },
      { passive: true },
    );

    /* Уехал палец — значит это прокрутка, а не нажатие. */
    window.addEventListener(
      'pointermove',
      function (ev) {
        if (!coarse || !giu || mosso) return;
        if (Math.abs(ev.clientX - giu.x) < 12 && Math.abs(ev.clientY - giu.y) < 12) return;
        mosso = true;
        molla();
        pressed = false;
        wake();
      },
      { passive: true },
    );

    window.addEventListener(
      'pointerup',
      function (ev) {
        molla();
        // Короткий тап палец отпускает раньше, чем лист успел согнуться, —
        // тогда прогиб делается импульсом, чтобы касание всё-таки чувствовалось.
        var tap = coarse && giu && !mosso && !pressed && performance.now() - giu.t < 260;
        giu = null;
        if (tap) {
          mira(ev);
          pressed = true;
          setTimeout(function () { pressed = false; wake(); }, 110);
        } else {
          pressed = false;
        }
        wake();
      },
      { passive: true },
    );
    window.addEventListener(
      'pointercancel',
      function () { molla(); giu = null; mosso = true; wake(); },
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
    nuovoCampo();
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
