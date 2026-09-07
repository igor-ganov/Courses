/* МАТЕРИЯ — освещённая поверхность под страницей.
 *
 * Не тень и не картинка текстуры. Строится поле высот (коробление листа,
 * пучки волокон, зерно), из него берётся нормаль в каждом пикселе, и по
 * нормали считается свет:
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
 * Каждый макет задаёт свой сорт материала атрибутами data-*.
 * Перерисовка идёт только пока пружины не успокоились.
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
    'uniform float uRelief; uniform float uFibre; uniform float uWarm;\n' +
    'out vec4 fragColor;\n' +
    'float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }\n' +
    'float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);\n' +
    '  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }\n' +
    'float fbm(vec2 p, int oct){ float s=0., a=.5; for(int i=0;i<6;i++){ if(i>=oct) break; s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }\n' +
    // Лист: медленное коробление от рук, пучки волокон в двух направлениях, зерно.
    'float sheet(vec2 p){\n' +
    '  float cockle = fbm(p*5.5, 4);\n' +
    '  float fa = fbm(vec2(p.x*3.0, p.y*230.), 2);\n' +
    '  float fb = fbm(vec2(p.x*250., p.y*2.6), 2);\n' +
    '  return cockle*.34 + (fa+fb)*uFibre + vnoise(p*620.)*.03; }\n' +
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
    '  float h = surf(p, ptr, uPress);\n' +
    '  vec2 e = vec2(1.4/uRes.y, 0.);\n' +
    '  float hx = surf(p+e.xy,ptr,uPress) - surf(p-e.xy,ptr,uPress);\n' +
    '  float hy = surf(p+e.yx,ptr,uPress) - surf(p-e.yx,ptr,uPress);\n' +
    '  vec3 n = normalize(vec3(-hx*uRelief, -hy*uRelief, 1.));\n' +
    '  vec3 view = vec3(0.,0.,1.);\n' +
    '  vec3 key = normalize(vec3(-.42,.55,.72));\n' +
    '  vec3 toP = vec3(ptr-p, .30); float dP = length(toP); vec3 dirP = toP/max(dP,1e-4);\n' +
    '  float fall = uPresence/(1.+26.*dP*dP);\n' +
    '  float rough = .86;\n' +
    '  float lit = orenNayar(n,key,view,rough)*.72 + orenNayar(n,dirP,view,rough)*fall*.85;\n' +
    '  float through = pow(max(0.,(dot(n,key)+.55)/1.55), 2.2)*.30;\n' +
    '  float ao = clamp(.80 + h*.55 - max(0.,-dent(p,ptr,uPress))*1.5, .45, 1.10);\n' +
    '  float sheen = ggx(n,key,view,.55)*.030 + ggx(n,dirP,view,.45)*.045*fall;\n' +
    '  float mottle = fbm(p*3.1+11., 3) - .5;\n' +
    '  float speck = smoothstep(.990,.999, vnoise(p*760.));\n' +
    '  float expo = .93 + (lit-.55)*.42 + through*.30;\n' +
    '  expo *= mix(1., ao, .45);\n' +
    '  vec3 c = uPaper * clamp(expo, .70, 1.12);\n' +
    '  c = mix(c, uShade, clamp((1.-clamp(expo,0.,1.))*.55, 0., .45));\n' +
    '  c *= 1. + mottle*.022;\n' +
    '  c = mix(c, uShade, speck*.14);\n' +
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

  /* Затухающая пружина: у материала есть масса, поэтому свет догоняет
     курсор, а вмятина возвращается не мгновенно. */
  function step(s, target, dt, k, c) {
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
    var relief = parseFloat(d.rilievo || '26');
    var fibre = parseFloat(d.fibra || '0.13');
    var warm = parseFloat(d.calore || '0.06');

    var u = {};
    ['uRes', 'uPointer', 'uPress', 'uPresence', 'uPaper', 'uShade', 'uLight', 'uRelief', 'uFibre', 'uWarm'].forEach(
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
      gl.uniform1f(u.uFibre, fibre);
      gl.uniform1f(u.uWarm, warm);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function tick(now) {
      var dt = last === 0 ? 1 / 60 : (now - last) / 1000;
      last = now;
      step(sx, tx, dt, 120, 22);
      step(sy, ty, dt, 120, 22);
      step(sp, pressed ? 1 : 0, dt, 420, 26);
      step(sPresence, present, dt, 120, 22);
      draw();
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

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      draw();
      wake();
    }

    /* Свет один на всю страницу: те же координаты уходят в CSS-переменные,
       поэтому тени карточек и блик на кнопке знают, где лампа. */
    function vars() {
      var root = document.documentElement.style;
      root.setProperty('--luce-x', sx.x.toFixed(4));
      root.setProperty('--luce-y', (1 - sy.x).toFixed(4));
      root.setProperty('--luce-dx', (sx.x - 0.5).toFixed(4));
      root.setProperty('--luce-dy', (0.5 - sy.x).toFixed(4));
      root.setProperty('--premuto', sp.x.toFixed(4));
    }

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
    window.addEventListener('pointerdown', function () { pressed = true; wake(); }, { passive: true });
    window.addEventListener('pointerup', function () { pressed = false; wake(); }, { passive: true });
    document.addEventListener('pointerleave', function () { present = 0; pressed = false; wake(); });
    window.addEventListener('resize', resize);

    var loop = function (now) {
      vars();
      requestAnimationFrame(loop);
      void now;
    };
    requestAnimationFrame(loop);

    resize();
  }

  window.addEventListener('DOMContentLoaded', function () {
    var canvas = document.querySelector('canvas[data-materia]');
    if (canvas) start(canvas);
  });
})();
