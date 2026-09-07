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
 * вдавливает в него ямку с приподнятым валиком по краю — бумага ведь не
 * сжимается, а вытесняется. Нормаль считается уже от продавленной высоты,
 * поэтому блик сам огибает вмятину. В этом весь смысл затеи.
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
    'uniform vec3 uPaper; uniform vec3 uShade; uniform vec3 uLight;\n' +
    'uniform float uRelief; uniform float uWarm;\n' +
    'out vec4 fragColor;\n' +
    'float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }\n' +
    'float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);\n' +
    '  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }\n' +
    // Коробление от рук — единственное, что здесь отвечает на движение лампы.
    'float sheet(vec2 p){ float s=0., a=.5; p*=5.5;\n' +
    '  for(int i=0;i<3;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s*.26; }\n' +
    // Палец не сминает бумагу, а вытесняет её: ямка плюс валик.
    'float dent(vec2 p, vec2 c, float amt){ float d=length(p-c);\n' +
    '  return amt*(exp(-((d-.115)*(d-.115))/.0026)*.28 - exp(-(d*d)/.0090)); }\n' +
    'float surf(vec2 p, vec2 c, float amt){ return sheet(p) + dent(p,c,amt); }\n' +
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
    '  vec2 p = vec2(uv.x*asp, uv.y); vec2 ptr = vec2(uPointer.x*asp, uPointer.y);\n' +
    // Разность вперёд, а не центральная: три выборки поля вместо пяти,
    // на гладком короблении разницы не видно.
    '  float h = surf(p, ptr, uPress);\n' +
    '  float e = 1.6/uRes.y;\n' +
    '  float hx = surf(p+vec2(e,0.),ptr,uPress) - h;\n' +
    '  float hy = surf(p+vec2(0.,e),ptr,uPress) - h;\n' +
    '  vec3 n = normalize(vec3(-hx*uRelief*2., -hy*uRelief*2., 1.));\n' +
    '  vec3 view = vec3(0.,0.,1.);\n' +
    '  vec3 key = normalize(vec3(-.42,.55,.72));\n' +
    '  vec3 toP = vec3(ptr-p, .30); float dP = length(toP); vec3 dirP = toP/max(dP,1e-4);\n' +
    '  float fall = uPresence/(1.+26.*dP*dP);\n' +
    '  float rough = .86;\n' +
    '  float lit = orenNayar(n,key,view,rough)*.72 + orenNayar(n,dirP,view,rough)*fall*.85;\n' +
    '  float through = pow(max(0.,(dot(n,key)+.55)/1.55), 2.2)*.30;\n' +
    '  float ao = clamp(.80 + h*.55 - max(0.,-dent(p,ptr,uPress))*1.5, .45, 1.10);\n' +
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
     Печатаются один раз в бесшовную плитку 160×160 и умножаются поверх
     света. Шум взят с обёрнутой решёткой (индексы по модулю периода),
     поэтому стык плитки не виден. Пучки идут в двух направлениях —
     это и отличает бумагу от штукатурки. */

  function tileHash(x, y) {
    var h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return h - Math.floor(h);
  }

  function wrapped(x, y, px, py) {
    var x0 = Math.floor(x), y0 = Math.floor(y);
    var fx = x - x0, fy = y - y0;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var a = tileHash(((x0 % px) + px) % px, ((y0 % py) + py) % py);
    var b = tileHash((((x0 + 1) % px) + px) % px, ((y0 % py) + py) % py);
    var c = tileHash(((x0 % px) + px) % px, (((y0 + 1) % py) + py) % py);
    var d = tileHash((((x0 + 1) % px) + px) % px, (((y0 + 1) % py) + py) % py);
    return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy;
  }

  function grainTile(fibre) {
    var N = 160;
    var cv = document.createElement('canvas');
    cv.width = N;
    cv.height = N;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(N, N);
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var u = x / N, v = y / N;
        // Пучки идут в двух направлениях, но слабо: если дать им волю,
        // бумага становится мешковиной. Основной тон держит зерно.
        var fa = wrapped(u * 5, v * 40, 5, 40);
        var fb = wrapped(u * 36, v * 5, 36, 5);
        var grain = tileHash(x, y);
        var dark = (1 - fa) * fibre * 0.5 + (1 - fb) * fibre * 0.5 + (1 - grain) * 0.035;
        var value = Math.round(255 * Math.max(0, 1 - dark));
        // Зерно чуть тёплое: нейтрально-серое умножение выпивает из бумаги
        // цвет и оставляет бетон.
        var i = (y * N + x) * 4;
        img.data[i] = Math.min(255, value + 4);
        img.data[i + 1] = value;
        img.data[i + 2] = Math.max(0, value - 5);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png');
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

  function start(canvas) {
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

    var grana = document.createElement('div');
    grana.className = 'grana';
    grana.setAttribute('aria-hidden', 'true');
    grana.style.cssText =
      'position:fixed;inset:0;z-index:-1;pointer-events:none;' +
      'background-repeat:repeat;background-size:160px 160px;mix-blend-mode:multiply';
    grana.style.backgroundImage = 'url(' + grainTile(fibre) + ')';
    document.body.appendChild(grana);

    var u = {};
    ['uRes', 'uPointer', 'uPress', 'uPresence', 'uPaper', 'uShade', 'uLight', 'uRelief', 'uWarm'].forEach(
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
      step(sp, pressed ? 1 : 0, dt, 420, 26);
      step(sPresence, present, dt, 120, 22);
      draw();
      vars();
      var busy =
        Math.abs(sx.x - tx) > 1e-3 ||
        Math.abs(sy.x - ty) > 1e-3 ||
        Math.abs(sp.x - (pressed ? 1 : 0)) > 1e-3 ||
        Math.abs(sPresence.x - present) > 1e-3;
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
      setStock: function (stock) {
        paper = rgb(stock.carta, 'f3ece0');
        shade = rgb(stock.ombra, '8f8474');
        light = rgb(stock.luce, 'fff6e2');
        relief = parseFloat(stock.rilievo || relief);
        warm = parseFloat(stock.calore || warm);
        var f = parseFloat(stock.fibra);
        if (f === f && f !== fibre) {
          fibre = f;
          grana.style.backgroundImage = 'url(' + grainTile(fibre) + ')';
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
    window.addEventListener(
      'pointerdown',
      function (ev) {
        tx = ev.clientX / Math.max(window.innerWidth, 1);
        ty = 1 - ev.clientY / Math.max(window.innerHeight, 1);
        present = 1;
        pressed = true;
        wake();
      },
      { passive: true },
    );
    window.addEventListener('pointerup', function () { pressed = false; wake(); }, { passive: true });
    document.addEventListener('pointerleave', function () { present = 0; pressed = false; wake(); });
    window.addEventListener('resize', resize, { passive: true });

    resize();
  }

  window.addEventListener('DOMContentLoaded', function () {
    var canvas = document.querySelector('canvas[data-materia]');
    if (canvas) start(canvas);
  });
})();
