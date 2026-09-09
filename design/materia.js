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

  /* Шейдер считает ровно то, что есть в расчёте, и ничего сверх того.
     Никакого шума «для живости»: у плоского листа под ровным светом ровный
     тон, и это правда. Тень появляется только там, где лист согнут, и имеет
     форму конуса — клинья с рёбрами, а не пятно.

     Лампа одна и неподвижная, сверху слева. Шара света, ездящего за
     пальцем, нет: палец не светится. */
  var FRAG =
    '#version 300 es\n' +
    'precision highp float;\n' +
    'uniform vec2 uRes; uniform vec2 uPointer; uniform float uPress;\n' +
    'uniform float uScorrimento;\n' +
    'uniform vec3 uPaper; uniform vec3 uShade;\n' +
    'uniform float uAsse; uniform float uRaggio; uniform float uProfondo; uniform float uPiega;\n' +
    'const float PIATTO = .03; const float RIPIDO = .16;\n' +
    'uniform vec3 uBordi;\n' +
    'out vec4 fragColor;\n' +
    // ── КОНУС ────────────────────────────────────────────────────────
    // Бумага нерастяжима, поэтому под пальцем она складывается в
    // развёртывающийся конус: z(ρ,θ) = ρ·ψ(θ). Вдоль каждого луча из точки
    // касания лист ПРЯМОЙ, вся кривизна поперёк лучей. Сектор шириной 139°
    // отходит от опоры, и на его границах ψ ломается — оттуда рёбра, на
    // которых ломается свет. Подробности и источники — /geometria.html.
    'const float SETT = 2.42601;\n' +
    'const float KLIFT = 1.15;\n' +
    // Докуда идёт деформация вдоль луча. Лист держат боковые поля страницы —
    // это уходит в uBordi.xy; сверху и снизу края нет вовсе, там страница
    // продолжается прокруткой, поэтому вдоль полосы размах задан отдельно
    // (uBordi.z) и он длинный: полтора листа в ширину.
    'float bordo(vec2 c, vec2 dir){\n' +
    '  float t = uBordi.z;\n' +
    '  if (dir.x >  1e-5) t = min(t, (uBordi.y - c.x)/dir.x);\n' +
    '  else if (dir.x < -1e-5) t = min(t, (uBordi.x - c.x)/dir.x);\n' +
    '  return max(t, 1e-3); }\n' +
    // Высота и наклон одним заходом: atan и приведение угла стоят дороже
    // всего остального, а нужны они обоим.
    //
    //   z(ρ,θ) = ψ·(ρ·pa − b)
    //
    // У вершины это −ψb = −Δ, у края ровно ноль в любую сторону: лист приходит
    // к плоскости сам, гасить поле отдельной функцией не нужно и нельзя.
    // Прежняя версия множила на затухание и постоянную −Δ вместе с ним, отчего
    // поверх конуса вырастал купол высотой в Δ. А Δ/b вчетверо больше самого ψ,
    // так что купол забивал конус — это его и было видно круглым пятном.
    'vec3 cono(vec2 p, vec2 c, float amt, float rc){\n' +
    '  if (amt < .001) return vec3(0.);\n' +
    '  vec2 d = p - c; float rho = max(length(d), 1e-4);\n' +
    '  vec2 rad = d/rho;\n' +
    '  float b = bordo(c, rad);\n' +
    // Ядро: у вершины точного конуса кривизна расходится, там бумага тянется.
    // Скругляем сам радиус — размером с подушечку пальца.
    '  float q = sqrt(rho*rho + rc*rc);\n' +
    '  float rs = rho*rho/q;\n' +
    '  float drs = rho*(rho*rho + 2.*rc*rc)/(q*q*q);\n' +
    '  float t = rs/b; if (t >= 1.) return vec3(0.);\n' +
    '  float a = atan(d.y,d.x) - uAsse;\n' +
    '  a = mod(a + 3.14159265, 6.2831853) - 3.14159265;\n' +
    '  float dentro = step(abs(a), SETT*.5);\n' +
    '  float w = 3.14159265*a/SETT;\n' +
    // Сектор отрыва спадает к краю как (1−t²): у самой границы лист снова
    // ложится, иначе на ней остаётся ступенька в 1,15Δ.
    '  float co = KLIFT*cos(w)*dentro;\n' +
    // ψ = Δ/b, и b своё в каждую сторону: палец продавлен на Δ, а лист
    // прихвачен там, где кончается. Оттого к близкому краю конус круче, к
    // далёкому положе — форма перестаёт быть круглой сама, без подгонки.
    '  float psi = amt*clamp(uProfondo/b, PIATTO, RIPIDO);\n' +
    // Наклон вдоль луча — сама генератриса; поперёк луча — излом ψ на границах
    // сектора, оттуда рёбра. Оба порядка ψ: ничего не забивает конус.
    '  float gr = psi*(1. + co*(1. - 3.*t*t))*drs;\n' +
    '  float gt = psi*(-KLIFT*(3.14159265/SETT)*sin(w)*dentro*(1.-t*t))*rs/rho;\n' +
    '  vec2 tng = vec2(-rad.y, rad.x);\n' +
    '  return vec3(psi*(rs*(1. + co*(1.-t*t)) - b), rad*gr + tng*gt); }\n' +
    // Орен–Найар вместо Ламберта: бумага шероховатая и не гаснет по косинусу,
    // как пластик. Именно ламбертова модель делает её похожей на картон.
    'float orenNayar(vec3 n, vec3 l, vec3 v, float r){\n' +
    '  float nl=dot(n,l), nv=dot(n,v); if(nl<=0.) return 0.;\n' +
    '  float s2=r*r; float A=1.-.5*(s2/(s2+.33)); float B=.45*(s2/(s2+.09));\n' +
    '  float al=acos(clamp(nl,-1.,1.)), av=acos(clamp(nv,-1.,1.));\n' +
    '  float alpha=max(al,av), beta=min(al,av);\n' +
    // У плоского листа взгляд совпадает с нормалью, и проекция вида на
    // касательную плоскость — нулевой вектор: normalize от него даёт NaN, а
    // NaN протаскивается до самого цвета и сажает экспозицию на нижний упор.
    // Ровный лист от этого красился ощутимо темнее согнутого — та самая
    // «тень на фоне», которой неоткуда было взяться.
    '  vec3 lp=l-n*nl, vp=v-n*nv; float ll=length(lp), lv=length(vp);\n' +
    '  float cosfi = (ll>1e-4 && lv>1e-4) ? dot(lp,vp)/(ll*lv) : 0.;\n' +
    '  return nl*(A + B*max(0.,cosfi)*sin(alpha)*tan(beta)); }\n' +
    // Слабый широкий GGX — блеск каландрированной бумаги под скользящим углом.
    'float ggx(vec3 n, vec3 l, vec3 v, float r){ vec3 h=normalize(l+v); float a=r*r;\n' +
    '  float nh=max(dot(n,h),0.); float d=(nh*nh)*(a*a-1.)+1.; return (a*a)/(3.14159*d*d+1e-5); }\n' +
    'void main(){\n' +
    '  vec2 uv = gl_FragCoord.xy/uRes; float asp = uRes.x/max(uRes.y,1.);\n' +
    // Лист едет вместе с текстом: рисуем только экран, но выборку сдвигаем на
    // прокрутку. Знак важен: uv.y растёт вверх, документ вниз.
    '  vec2 p = vec2(uv.x*asp, uScorrimento - uv.y);\n' +
    // Палец приходит уже в координатах листа: складывать прокрутку и место
    // касания нужно там, где они сняты вместе, а не здесь.
    '  vec2 ptr = vec2(uPointer.x*asp, uPointer.y);\n' +
    '  vec3 cn = cono(p, ptr, uPress, uRaggio);\n' +
    '  vec3 n = normalize(vec3(-cn.y*uPiega, cn.z*uPiega, 1.));\n' +
    '  vec3 view = vec3(0.,0.,1.);\n' +
    '  vec3 key = normalize(vec3(-.42,.55,.72));\n' +
    '  float lit = orenNayar(n,key,view,.86);\n' +
    // Просвет: тонкий лист пропускает свет сквозь себя, поэтому у сгиба
    // тёмная сторона всё равно светится. Обёрнутый косинус.
    '  float through = pow(max(0.,(dot(n,key)+.55)/1.55), 2.2)*.30;\n' +

    '  float sheen = ggx(n,key,view,.55)*.030;\n' +
    '  float expo = .93 + (lit-.55)*.42 + through*.30;\n' +
    '  vec3 c = uPaper * clamp(expo, .74, 1.045);\n' +
    '  c = mix(c, uShade, clamp((1.-clamp(expo,0.,1.))*.55, 0., .45));\n' +
    '  c += vec3(1.) * sheen;\n' +
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
  /* Глубина под пальцем постоянна — палец жмёт одинаково, — а наклон
     генератрисы ψ = Δ/b свой в каждую сторону: b это расстояние до края
     листа вдоль луча. К близкому краю конус круче, к далёкому положе,
     и оттого форма выходит несимметричной сама собой. */
  var ГЛУБИНА = 30;
  /* Но ψ нельзя отпускать на волю: у края b маленькое, и получается наклон
     в тридцать градусов — в лист шириной в ладонь вдавлено три сантиметра.
     У настоящей бумаги ψ порядка 0,05; держим в этих пределах, иначе печать
     не гнётся, а рвётся. Те же числа стоят константами в шейдере. */
  var ПОЛОГО = 0.03;
  var КРУТО = 0.16;
  /* Ядро — подушечка пальца, и она не зависит от размера экрана: у вершины
     точного конуса кривизна расходится, там бумага правда тянется. */
  var ЯДРО = 34;
  /* Смещение печати честно ничтожно: при ψ=0,05 точка на полуметре съезжает
     к вершине на ρ(1−cos φ) — доли пикселя. Прогиб был бы виден одной только
     светотенью. Двигать буквы всё-таки хочется, поэтому смещение усилено
     вчетверо — и это единственная неправда во всём поле. */
  var УВЕЛ = 4;

  /* Косинус профиля сектора отрыва, без множителя (1−t²): его добавляет
     вызывающий, потому что вдоль луча он свой. */
  function lobo(a) {
    var t = ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    if (Math.abs(t) > SETTORE / 2) return 0;
    return KLIFT * Math.cos((Math.PI * t) / SETTORE);
  }

  /* Докуда идёт деформация вдоль луча. Лист держат боковые поля страницы;
     сверху и снизу края нет вовсе — там страница продолжается прокруткой,
     поэтому размах вдоль полосы задан отдельно, и он длинный: полтора листа
     в ширину, то есть заведомо больше половины экрана. Ни в одном направлении
     нет кружка вокруг пальца — он бы и читался шаром. */
  var ВДОЛЬ = 1.5;

  function bordo(cx, w, dx, dy) {
    var t = ВДОЛЬ * w;
    if (dx > 1e-5) t = Math.min(t, (w - cx) / dx);
    else if (dx < -1e-5) t = Math.min(t, -cx / dx);
    return Math.max(t, 1);
  }

  /* Разворот сектора отрыва: лист держат боковые края, верх и низ свободны,
     поэтому сектор уходит туда, где листу есть куда деться. */
  function opora(y, h) {
    var su = Math.max(y, 1);
    var giu = Math.max(h - y, 1);
    return 1 / (giu * giu) >= 1 / (su * su) ? Math.PI / 2 : -Math.PI / 2;
  }

  /* Размах смещения для данного места пальца: максимум того же поля по редкой
     сетке — двадцать четыре луча по двадцать точек. Нужен он каждый кадр,
     потому что карта огрублена до сорока пикселей, а размах обязан меняться
     плавно: иначе при ведении вбок прогиб идёт ступеньками (замерено — до
     21 px скачка между соседними кадрами у самого края). Пятьсот итераций —
     ничто рядом с самим фильтром. */
  function ampiezza(cx, w, asse) {
    var макс = 1e-6;
    for (var a = 0; a < 24; a++) {
      var th = (a / 24) * 2 * Math.PI;
      var ct = Math.cos(th);
      var st = Math.sin(th);
      var b = bordo(cx, w, ct, st);
      var co = lobo(th - asse);
      var psi = Math.max(ПОЛОГО, Math.min(КРУТО, ГЛУБИНА / b));
      // Карта хранит составляющие по осям, и нормирована по наибольшей.
      var ось = Math.max(Math.abs(ct), Math.abs(st));
      for (var n = 1; n <= 20; n++) {
        var rho = (n / 20) * b;
        var q = Math.sqrt(rho * rho + ЯДРО * ЯДРО);
        var rs = (rho * rho) / q;
        var drs = (rho * (rho * rho + 2 * ЯДРО * ЯДРО)) / (q * q * q);
        var t = rs / b;
        if (t >= 1) continue;
        var уклон = psi * (1 + co * (1 - 3 * t * t)) * drs;
        var m = УВЕЛ * (1 - 1 / Math.sqrt(1 + уклон * уклон)) * (1 - t * t) * rs * ось;
        if (m > макс) макс = m;
      }
    }
    return макс;
  }

  /* Карта смещения под конкретное нажатие. Плитка накрывает ровно тот
     прямоугольник, куда доходит поле, — не квадрат вокруг пальца: конус
     несимметричен, и квадрат пришлось бы брать вдвое больше, теряя вдвое
     разрешение впустую. Клетка выходит около десятка пикселей, но поле
     гладкое, а рёбра рисует свет, а не сдвиг пикселей. */
  var СЕТКА = 128;
  var холст = null;
  /* Форма поля не зависит от того, на какой высоте палец: край, который её
     задаёт, — боковой, а по вертикали листу конца нет. Значит ключ — только
     положение поперёк листа и куда развёрнут сектор; вертикальный свайп идёт
     на одной карте.

     Шаг огрубления неравномерен. У самого поля страницы ψ = Δ/x меняется
     гиперболически, в середине — почти никак, поэтому равный шаг в пикселях
     даёт у края скачок формы, а в середине лишние пересчёты. Логит выравнивает:
     около восьми пикселей у края и сорока посередине, всего два десятка карт
     на всю ширину. */
  var ШАГ = 0.39;
  var кэш = {};
  var кэшРазмер = 0;

  function chiave(cx, w) {
    var u = Math.min(0.98, Math.max(0.02, cx / Math.max(w, 1)));
    return Math.round(Math.log(u / (1 - u)) / ШАГ);
  }

  function mappaCono(cx, w, giu) {
    var n = chiave(cx, w);
    var ключ = n + ':' + Math.round(w / 40) + ':' + (giu > 0 ? 'g' : 's');
    if (кэш[ключ]) return кэш[ключ];
    if (кэшРазмер > 24) {
      кэш = {};
      кэшРазмер = 0;
    }
    if (!холст) {
      холст = document.createElement('canvas');
      холст.width = СЕТКА;
      холст.height = СЕТКА;
    }
    var ctx = холст.getContext('2d');
    var img = ctx.createImageData(СЕТКА, СЕТКА);
    // Считаем на середину той ячейки огрубления, в которую попал палец.
    cx = w / (1 + Math.exp(-n * ШАГ));
    var asse = giu;
    // Размах поля: вбок — до полей страницы, но не дальше размаха вдоль
    // полосы; вдоль полосы края нет вовсе.
    var вдоль = ВДОЛЬ * w;
    var влево = Math.min(cx, вдоль);
    var вправо = Math.min(w - cx, вдоль);
    var x0 = cx - влево;
    var ширина = влево + вправо;
    var высота = 2 * вдоль;
    var поле = new Float32Array(СЕТКА * СЕТКА * 2);
    var пик = 1e-6;
    for (var j = 0; j < СЕТКА; j++) {
      for (var i = 0; i < СЕТКА; i++) {
        var dx = x0 + ((i + 0.5) / СЕТКА) * ширина - cx;
        var dy = ((j + 0.5) / СЕТКА) * высота - вдоль;
        var rho = Math.sqrt(dx * dx + dy * dy);
        var o = (j * СЕТКА + i) * 2;
        if (rho <= 1e-3) continue;
        // Всё как в шейдере: расстояние до края вдоль луча задаёт и долю пути,
        // и наклон генератрисы ψ = Δ/b; радиус скруглён тем же ядром.
        var b = bordo(cx, w, dx / rho, dy / rho);
        var q = Math.sqrt(rho * rho + ЯДРО * ЯДРО);
        var rs = (rho * rho) / q;
        var drs = (rho * (rho * rho + 2 * ЯДРО * ЯДРО)) / (q * q * q);
        var t = rs / b;
        if (t >= 1) continue;
        var co = lobo(Math.atan2(dy, dx) - asse);
        var psi = Math.max(ПОЛОГО, Math.min(КРУТО, ГЛУБИНА / b));
        var уклон = psi * (1 + co * (1 - 3 * t * t)) * drs;
        // Печать съезжает к вершине на ρ(1−cos φ): лист под наклоном короче в
        // проекции. У закреплённого края материал стоять обязан, поэтому сдвиг
        // возвращается к нулю — тот же множитель (1−t²), что у сектора.
        // Карта читается наоборот, пиксель берётся со сдвигом, поэтому пишем
        // вектор наружу.
        // 1 − cos(arctg u) = 1 − 1/√(1+u²): то же число без двух тригонометрий,
        // а считается оно под каждым текселем карты.
        var k = (УВЕЛ * (1 - 1 / Math.sqrt(1 + уклон * уклон)) * (1 - t * t) * rs) / rho;
        поле[o] = dx * k;
        поле[o + 1] = dy * k;
        пик = Math.max(пик, Math.abs(поле[o]), Math.abs(поле[o + 1]));
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
    // Плитка описана смещениями вершины от своего края: ставят её по живому
    // пальцу, а не по тому огрублённому месту, на котором считали.
    кэш[ключ] = {
      url: холст.toDataURL('image/png'),
      пик: пик,
      // Тот же размах, посчитанный редкой сеткой на том же месте: живой размах
      // делится на него, и отношение убирает ступеньку огрубления.
      эталон: ampiezza(cx, w, asse),
      влево: влево,
      вдоль: вдоль,
      ширина: ширина,
      высота: высота,
    };
    кэшРазмер += 1;
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
    var fibre = parseFloat(d.fibra || '0.055');
    // Насколько наклон конуса разворачивает нормаль: коробление приходит
    // разностью высот, конус — готовым наклоном, их надо привести к одному.
    /* Наклон, с которым свет читает поле. Единица — правда: ψ у бумаги
       порядка 0,05, и прогиб был бы виден на пределе различимого. Здесь он
       усилен, как и смещение печати, иначе эффекта попросту не видно. */
    var piegaLuce = parseFloat(d.piega || '1.1');

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
    ['uRes', 'uPointer', 'uPress', 'uPaper', 'uShade',
      'uScorrimento', 'uAsse', 'uRaggio', 'uProfondo', 'uPiega', 'uBordi'].forEach(
      function (name) {
        u[name] = gl.getUniformLocation(prog, name);
      },
    );

    var sp = { x: 0, v: 0 };
    var pressed = false;
    var last = 0;
    var running = false;
    var scorrimento = 0;
    // Где палец держит лист: по горизонтали в пикселях окна, по вертикали в
    // пикселях документа.
    var целX = 0;
    var целY = 0;
    /* Размах смещения тоже на пружине, и тоже критической. Карта огрублена, и
       на границе ячейки размах меняется ступенькой — у самого поля страницы до
       семи пикселей за кадр, потому что там ψ = Δ/x меняется гиперболически и
       редкая выборка размаха не поспевает за точной. Пружина превращает
       ступеньку в спуск за семьдесят миллисекунд, и её не видно. */
    var fa = { x: 0, v: 0 };
    var цельРазмаха = 0;
    var nucleo = 0.05; // радиус ядра в высотах окна — подушечка пальца
    var asse = -Math.PI / 2; // куда развёрнут сектор отрыва
    var campo = { url: '', пик: 1, эталон: 1, влево: 0, вдоль: 0, ширина: 0, высота: 0 };
    // Сторона сектора отрыва выбирается один раз, когда палец опустился: если
    // пересчитывать её на ходу, посреди экрана она переворачивается разом и
    // весь конус скачком встаёт вверх ногами.
    var verso = Math.PI / 2;
    var profondo = 0.04; // Δ — насколько продавлен палец, в высотах окна

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

    function posa(img, cx, cy) {
      img.setAttribute('x', (cx - campo.влево).toFixed(1));
      img.setAttribute('y', (cy - campo.вдоль).toFixed(1));
      img.setAttribute('width', campo.ширина.toFixed(1));
      img.setAttribute('height', campo.высота.toFixed(1));
    }

    /* Фильтр во весь экран — самое дорогое, что здесь есть, и при ведении
       пальцем он пересчитывается каждый кадр. Обновлять его через кадр было
       заманчиво, но тогда свет идёт на шестидесяти герцах, а сдвиг пикселей на
       тридцати: под движущимся пальцем блик отрывается от букв, и видно это
       сразу. Лучше платить за каждый кадр. */
    function piega(finito) {
      var d = sp.x;
      var w = window.innerWidth;
      var h = window.innerHeight;
      var cy = schermoY();
      var pressoY = cy / Math.max(h, 1);
      var pressoX = puntoX() / Math.max(w, 1);
      // Наклон всего листа остаётся: смещение пикселей даёт сам прогиб, а
      // поворот — то, что лист при этом уходит от глаза целиком.
      // Наклон всего листа — мышиная роскошь: на тачскрине он стоит четыре
      // миллисекунды на кадр, а под ведомым пальцем его не разглядеть.
      foglio.style.transform = finito || coarse
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
      foglio.style.filter = 'url(#piega-foglio)';
      foglio.style.willChange = 'transform,filter';
      regione('piega-foglio', 0, window.scrollY - 40, w, h + 80);
      regione('piega-grana', 0, 0, w, h);
      // Вершина плитки ставится точно под палец. Карта считалась на
      // огрублённое место, но огрубление меняет только форму — на доли
      // процента, — а не то, где у неё вершина. Лист живёт в координатах
      // документа, зерно — в координатах окна.
      var cx = pressoX * w;
      posa(mappaFoglio, cx, целY);
      posa(mappaGrana, cx, cy);
      var forza = (fa.x * d).toFixed(2);
      scalaFoglio.setAttribute('scale', forza);
      scalaGrana.setAttribute('scale', forza);
      // Зерно живёт в координатах окна, поэтому у него своя копия фильтра с
      // той же картой, но поставленной по экрану, а не по документу. На
      // тачскрине его не гнём: второй фильтр во весь экран стоит столько же,
      // сколько первый, а ведут прогиб там пальцем — по движущемуся кадру
      // зерно всё равно не прочесть.
      if (!coarse) grana.style.filter = 'url(#piega-grana)';
    }

    function draw() {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      // Тот же якорь, что у карты: (clientY + scrollY)/h − 1 — координата
      // документа в высотах окна, снятая в обработчике касания.
      var hh = Math.max(window.innerHeight, 1);
      gl.uniform2f(u.uPointer, целX / Math.max(window.innerWidth, 1), целY / hh - 1);
      gl.uniform1f(u.uPress, sp.x);
      gl.uniform3fv(u.uPaper, paper);
      gl.uniform3fv(u.uShade, shade);
      gl.uniform1f(u.uScorrimento, scorrimento);
      gl.uniform1f(u.uAsse, asse);
      gl.uniform1f(u.uRaggio, nucleo);
      gl.uniform1f(u.uProfondo, profondo);
      gl.uniform1f(u.uPiega, piegaLuce);
      // Границы листа в тех же координатах, что и p: по горизонтали весь
      // экран, по вертикали — окно, сдвинутое прокруткой.
      var asp = canvas.width / Math.max(canvas.height, 1);
      gl.uniform3f(u.uBordi, 0, asp, ВДОЛЬ * asp);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /* Лампа неподвижна — сверху слева, как в шейдере. Её положение уходит в
       CSS один раз: тени карточек и фаски оттиска знают, откуда свет, и не
       ездят за курсором. Меняется только --premuto. */
    function lampada() {
      var root = document.documentElement.style;
      root.setProperty('--luce-x', '0.29');
      root.setProperty('--luce-y', '0.22');
      root.setProperty('--luce-dx', '-0.21');
      root.setProperty('--luce-dy', '0.28');
    }

    function vars() {
      document.documentElement.style.setProperty('--premuto', sp.x.toFixed(3));
    }

    function tick(now) {
      var dt = last === 0 ? 1 / 60 : (now - last) / 1000;
      last = now;
      // Демпфирование заметно ниже критического (ζ≈0.37): лист проскакивает
      // мимо покоя и дрожит, возвращаясь, — как настоящая бумага.
      step(sp, pressed ? 1 : 0, dt, 480, 16);
      inseguire(dt);
      var busy =
        Math.abs(sp.x - (pressed ? 1 : 0)) > 1e-3 ||
        Math.abs(sp.v) > 1e-3 ||
        (pressed && Math.abs(fa.x - цельРазмаха) > 0.05);
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
        var f = parseFloat(stock.fibra);
        if (f === f) {
          fibre = f;
          grana.style.opacity = Math.min(1, fibre / СОРТ_ПЛИТКИ).toFixed(2);
        }
        draw();
      },
    };

    /* Новое поле — на каждое новое место пальца: форма конуса зависит от того,
       где нажали, потому что её задают края листа. Карта переиспользуется,
       пока палец не ушёл дальше сорока пикселей. */
    var ключПоля = '';

    function nuovoCampo() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      var cx = puntoX();
      var ключ = chiave(cx, w) + ':' + (verso > 0 ? 'g' : 's');
      nucleo = ЯДРО / Math.max(h, 1);
      profondo = ГЛУБИНА / Math.max(h, 1);
      asse = -verso;
      if (ключ === ключПоля) return;
      ключПоля = ключ;
      campo = mappaCono(cx, w, verso);
      mappaFoglio.setAttribute('href', campo.url);
      mappaGrana.setAttribute('href', campo.url);
    }

    /* Палец держит не точку экрана, а точку листа. Поэтому запоминается
       координата в документе, и снимается она в том же обработчике, что и
       само касание: clientY и scrollY из одного мгновения.

       Складывать их порознь нельзя, а раньше именно так и было — clientY брался
       из touchmove, а scrollY из кадра. На прокрутке эти два источника идут
       вразнобой (события касания приходят к главному потоку когда придут, а
       страница едет своим ходом), их разность гуляет, и вершина конуса скачет
       вокруг пальца. Теперь при чистой прокрутке якорь просто не меняется:
       палец стоит на том же месте листа — там же стоит и прогиб. */
    function mira(ev) {
      целX = ev.clientX;
      целY = ev.clientY + window.scrollY;
    }

    /* Вершина идёт за пальцем не рывком, а пружиной — критической, без
       перелёта: палец переставляется скачками (события касания приходят
       нерегулярно, а кадр занят фильтром), и если сажать конус прямо на
       последнее событие, он скачет. Бумага так себя не ведёт: она тянется
       за пальцем.

       Пружина живёт в координатах листа, поэтому прокрутка её не трогает:
       при чистой прокрутке цель не меняется вовсе. */
    /* Размах смещения в пикселях: пик карты, умноженный на два (карта кодирует
       диапазон ±½ масштаба) и поправленный на живое место пальца — карта-то
       посчитана на середину ячейки огрубления. */
    function respiro() {
      if (!(campo.эталон > 0)) return 0;
      return (2 * campo.пик * ampiezza(puntoX(), window.innerWidth, verso)) / campo.эталон;
    }

    /* Вершина садится прямо на палец, без сглаживания. Пружина на положении
       выглядит заманчиво, но замерена и отвергнута: на дрожащем потоке событий
       она снимает от пяти до двадцати процентов дрожи (сгладить кадровую дрожь
       может только фильтр медленнее кадра, а он и отстаёт на кадр), зато сама
       вносит рывок и отставание — при быстром ведении 20 px и того и другого,
       против 0,4 px рывка без неё. Дрожь брали не отсюда: её давала рассинхронка
       касания с прокруткой, и она уже вылечена якорем в координатах листа.

       Сглаживать нужно размах, а не место: он меняется ступенькой на границе
       ячейки огрубления, но ступеньки эти редкие — их пружина и гасит. */
    function inseguire(dt) {
      // Цель размаха считается один раз за кадр: она же нужна и для проверки,
      // успокоилось ли всё, а пятьсот выборок дважды за кадр — уже заметно.
      цельРазмаха = pressed ? respiro() : fa.x;
      step(fa, цельРазмаха, dt, 900, 60);
    }

    /* Где вершина конуса. Отдельных «сглаженных» координат нет: карта должна
       выбираться по тому месту, куда палец пришёл, а не по прошлому кадру. */
    function puntoX() {
      return целX;
    }

    // Где вершина сейчас на экране: координата листа минус текущая прокрутка.
    function schermoY() {
      return целY - window.scrollY;
    }

    /* ── ПАЛЕЦ ────────────────────────────────────────────────────────
       На тачскрине лист гнётся сразу по касанию и ведёт прогиб за пальцем,
       в том числе на свайпе. Одна тонкость: как только начинается прокрутка,
       система забирает указатель себе и шлёт pointercancel — pointer-события
       после этого не приходят вовсе. А touchmove продолжает идти, поэтому на
       тачскрине палец слушаем именно им.

       На мыши всё проще: pointer-события никто не отнимает. */

    var giu = null;

    function tenere(x, y, ново) {
      mira({ clientX: x, clientY: y });
      if (ново) verso = opora(y, Math.max(window.innerHeight, 1));
      nuovoCampo();
      // Нарастание прогиба ведёт пружина нажатия, размах при этом должен уже
      // стоять на своём значении, иначе первое касание приходит вполсилы.
      if (ново) { fa.x = respiro(); fa.v = 0; }
      pressed = true;
      wake();
    }

    function lasciare() {
      giu = null;
      pressed = false;
      wake();
    }

    if (coarse) {
      window.addEventListener(
        'touchstart',
        function (ev) {
          var t = ev.touches[0];
          if (!t) return;
          giu = performance.now();
          tenere(t.clientX, t.clientY, true);
        },
        { passive: true },
      );
      window.addEventListener(
        'touchmove',
        function (ev) {
          var t = ev.touches[0];
          if (!t || giu === null) return;
          tenere(t.clientX, t.clientY);
        },
        { passive: true },
      );
      var отпустить = function () {
        if (giu === null) return;
        // Совсем короткое касание не успевает согнуть лист: придерживаем
        // прогиб, чтобы тап чувствовался так же, как удержание.
        var коротко = performance.now() - giu < 120;
        giu = null;
        if (коротко) setTimeout(lasciare, 110);
        else lasciare();
      };
      window.addEventListener('touchend', отпустить, { passive: true });
      window.addEventListener('touchcancel', отпустить, { passive: true });
    } else {
      // Курсор без нажатия ничего не делает: лист гнётся, только когда его
      // трогают.
      window.addEventListener(
        'pointermove',
        function (ev) {
          if (!pressed) return;
          mira(ev);
          nuovoCampo();
          wake();
        },
        { passive: true },
      );
      window.addEventListener(
        'pointerdown',
        function (ev) { tenere(ev.clientX, ev.clientY, true); },
        { passive: true },
      );
      window.addEventListener('pointerup', lasciare, { passive: true });
      document.addEventListener('pointerleave', lasciare);
    }

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
      if (running) return;
      draw();
      // Пока палец держат, пружина стоит в единице и кадров нет. Но область
      // фильтра задана в координатах документа по текущему окну — если её не
      // подвинуть, прогиб обрежется по старому экрану.
      if (pressed) piega(false);
    }
    window.addEventListener('scroll', scorri, { passive: true });

    lampada();
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
