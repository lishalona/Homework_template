// =========================================================
// TIME CAPSULE — 홀로그램 구체 렌더러 (p5.js WEBGL)
//
// 화면의 모든 구체를 풀스크린 셰이더 한 번으로 그린다.
// app.js는 Orbs API로 "장면"(구체 배치)만 바꾸면 되고,
// 구체는 새 위치로 부드럽게 흘러간다.
// =========================================================

const MAX_ORBS = 16;

// 캡슐 색상: a = 밝은 쪽, b = 가운데, c = 가장자리(깊은 색)
const PALETTES = [
  { name: "EMBER", a: "#FFB06A", b: "#F2445E", c: "#4B2BC8" },
  { name: "GLACIER", a: "#E6F2FF", b: "#79A4FF", c: "#3A2CB0" },
  { name: "IRIS", a: "#FFB8E2", b: "#A774FF", c: "#2F56F0" },
  { name: "MINT", a: "#C9FFEA", b: "#58C7F5", c: "#6A3DDB" },
  { name: "DUSK", a: "#FFD3AB", b: "#FF6FA0", c: "#5638D8" },
  { name: "LAGOON", a: "#A2F4EE", b: "#3E7BFA", c: "#251A7A" },
  { name: "SOLAR", a: "#FFE08A", b: "#FF7A45", c: "#8A2BA6" },
  { name: "OPAL", a: "#FFFFFF", b: "#D6BEFF", c: "#5CC6F5" },
  { name: "NOCTURNE", a: "#5A73D6", b: "#1E2466", c: "#FF9A6B" },
];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// ---------------- ORB STATE ----------------

const Orbs = (() => {
  const list = [];
  const byId = new Map();
  let bindings = [];
  let lastNow = performance.now() / 1000;
  let selfDriving = false;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 마우스는 캔버스가 아닌 window에서 직접 받는다 (캔버스는 클릭을 받지 않음)
  const mouse = {
    x: innerWidth / 2,
    y: innerHeight / 2,
    tx: innerWidth / 2,
    ty: innerHeight / 2,
  };

  addEventListener(
    "pointermove",
    (e) => {
      mouse.tx = e.clientX;
      mouse.ty = e.clientY;
    },
    { passive: true },
  );

  function paletteRgb(i) {
    const p = PALETTES[((i % PALETTES.length) + PALETTES.length) % PALETTES.length];
    return [hexToRgb(p.a), hexToRgb(p.b), hexToRgb(p.c)];
  }

  function create(spec) {
    const cols = paletteRgb(spec.palette || 0);
    const seed = spec.seed ?? Math.random() * 6.28;

    const o = {
      id: spec.id,
      // 현재 값
      x: spec.x,
      y: spec.y,
      r: (spec.r || 100) * 0.72,
      alpha: 0,
      blur: spec.blur || 0,
      hover: 0,
      ready: 0,
      seam: 0,
      swirl: 0,
      open: 0,
      cols: cols.map((c) => c.slice()),
      // 목표 값
      tx: spec.x,
      ty: spec.y,
      tr: spec.r,
      ta: 1,
      tblur: spec.blur || 0,
      thover: 0,
      tready: 0,
      tseam: 0,
      tswirl: 0,
      topen: 0,
      tcols: cols,
      // 개성
      seed,
      angle: spec.angle ?? seed * 1.7,
      depth: 0.3,
      scroll: 0.2,
      amp: 1,
      k: 0.06,
      order: 0,
      leaving: false,
      flashStart: -1,
      flashDur: 1,
      // 화면에 그려지는 값 (떠다님 + 패럴랙스 적용)
      sx: spec.x,
      sy: spec.y,
      sr: 0,
    };

    list.push(o);
    byId.set(o.id, o);
    return o;
  }

  function apply(o, s) {
    if (s.x != null) o.tx = s.x;
    if (s.y != null) o.ty = s.y;
    if (s.r != null) o.tr = s.r;
    if (s.alpha != null) o.ta = s.alpha;
    if (s.palette != null) o.tcols = paletteRgb(s.palette);
    if (s.blur != null) o.tblur = s.blur;
    if (s.hover != null) o.thover = s.hover;
    if (s.ready != null) o.tready = s.ready;
    if (s.seam != null) o.tseam = s.seam;
    if (s.swirl != null) o.tswirl = s.swirl;
    if (s.open != null) o.topen = s.open;
    if (s.depth != null) o.depth = s.depth;
    if (s.scroll != null) o.scroll = s.scroll;
    if (s.amp != null) o.amp = s.amp;
    if (s.k != null) o.k = s.k;
  }

  // 장면 교체: 새 목록에 있는 구체는 이동, 없는 구체는 사라짐
  function setScene(specs) {
    const keep = new Set();

    specs.forEach((s, i) => {
      const o = byId.get(s.id) || create(s);

      apply(o, {
        alpha: 1,
        hover: 0,
        ready: 0,
        seam: 0,
        swirl: 0,
        open: 0,
        amp: 1,
        k: 0.06,
        ...s,
      });

      o.leaving = false;
      o.order = i;
      keep.add(s.id);
    });

    for (const o of list) {
      if (keep.has(o.id)) continue;
      o.leaving = true;
      o.ta = 0;
      o.tr = o.r * 0.82;
      o.order = -1;
    }

    list.sort((a, b) => a.order - b.order);
  }

  function update(id, s) {
    const o = byId.get(id);
    if (o) apply(o, s);
  }

  function updateAll(s, exceptId) {
    for (const o of list) if (o.id !== exceptId) apply(o, s);
  }

  function flash(id, dur = 1.2) {
    const o = byId.get(id);
    if (!o) return;
    o.flashStart = performance.now() / 1000;
    o.flashDur = dur;
  }

  function rename(from, to) {
    const o = byId.get(from);
    if (!o) return;
    byId.delete(from);
    o.id = to;
    byId.set(to, o);
    for (const b of bindings) if (b.id === from) b.id = to;
  }

  function get(id) {
    const o = byId.get(id);
    return o ? { x: o.sx, y: o.sy, r: o.sr, tr: o.tr } : null;
  }

  // DOM 요소를 구체 위치에 붙인다
  // mode "box": 구체를 덮는 원형 클릭 영역 / "point": 구체 기준 한 점
  function bind(id, el, opt = {}) {
    bindings.push({
      id,
      el,
      mode: opt.mode || "point",
      ax: opt.ax || 0,
      ay: opt.ay || 0,
      dx: opt.dx || 0,
      dy: opt.dy || 0,
      fade: opt.fade !== false,
      size: -1,
    });
  }

  function clearBindings() {
    bindings = [];
  }

  // 매 프레임: 값 보간 → 떠다님/패럴랙스 → 바인딩 위치 갱신
  function tick(now) {
    const dt = Math.min(0.05, Math.max(0.001, now - lastNow));
    lastNow = now;

    const f = dt * 60;
    const ease = (k) => 1 - Math.pow(1 - k, f);

    const mk = ease(0.07);
    mouse.x += (mouse.tx - mouse.x) * mk;
    mouse.y += (mouse.ty - mouse.y) * mk;

    const nx = mouse.x / innerWidth - 0.5;
    const ny = mouse.y / innerHeight - 0.5;
    const scrollY = window.scrollY;

    const eHover = ease(0.1);
    const eSlow = ease(0.045);
    const eCol = ease(0.035);

    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      const e = ease(o.k);

      o.x += (o.tx - o.x) * e;
      o.y += (o.ty - o.y) * e;
      o.r += (o.tr - o.r) * e;
      o.alpha += (o.ta - o.alpha) * ease(o.leaving ? 0.09 : 0.05);
      o.blur += (o.tblur - o.blur) * eSlow;
      o.hover += (o.thover - o.hover) * eHover;
      o.ready += (o.tready - o.ready) * eSlow;
      o.seam += (o.tseam - o.seam) * eSlow;
      o.swirl += (o.tswirl - o.swirl) * eSlow;
      o.open += (o.topen - o.open) * ease(0.035);

      for (let c = 0; c < 3; c++) {
        for (let ch = 0; ch < 3; ch++) {
          o.cols[c][ch] += (o.tcols[c][ch] - o.cols[c][ch]) * eCol;
        }
      }

      if (o.leaving && o.alpha < 0.01) {
        list.splice(i, 1);
        byId.delete(o.id);
        continue;
      }

      // 천천히 떠다님
      const m = reduceMotion ? 0 : o.amp;
      const amp = Math.min(16, o.r * 0.06) * m;
      const fx = (Math.sin(now * 0.23 + o.seed * 3.1) + 0.5 * Math.sin(now * 0.11 + o.seed)) * amp;
      const fy = Math.cos(now * 0.19 + o.seed * 2.3) * amp;

      // 마우스 패럴랙스 + 스크롤 패럴랙스
      o.sx = o.x + fx + nx * o.depth * 46 * o.amp;
      o.sy = o.y + fy + ny * o.depth * 32 * o.amp - scrollY * o.scroll;
      o.sr = o.r * (1 + o.hover * 0.045);
    }

    for (const b of bindings) {
      const o = byId.get(b.id);

      if (!o) {
        b.el.style.opacity = "0";
        continue;
      }

      if (b.mode === "box") {
        const d = Math.round(o.sr * 2);
        if (d !== b.size) {
          b.el.style.width = d + "px";
          b.el.style.height = d + "px";
          b.size = d;
        }
        b.el.style.transform = `translate3d(${(o.sx - o.sr).toFixed(1)}px, ${(o.sy - o.sr).toFixed(1)}px, 0)`;
      } else {
        const px = o.sx + o.sr * b.ax + b.dx;
        const py = o.sy + o.sr * b.ay + b.dy;
        b.el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
      }

      if (b.fade) b.el.style.opacity = Math.min(1, o.alpha * 1.15).toFixed(3);
    }
  }

  // 셰이더 uniform 배열로 묶기
  function pack(now) {
    const geo = [];
    const fx = [];
    const fx2 = [];
    const seam = [];
    const ca = [];
    const cb = [];
    const cc = [];
    let n = 0;

    for (const o of list) {
      if (n >= MAX_ORBS) break;
      if (o.alpha < 0.003 || o.sr < 0.5) continue;

      let fl = 0;
      if (o.flashStart >= 0) {
        const p = (now - o.flashStart) / o.flashDur;
        if (p >= 1) o.flashStart = -1;
        else fl = Math.max(p, 0.0001);
      }

      geo.push(o.sx, o.sy, o.sr, o.alpha);
      fx.push(o.seed, o.blur, o.hover, fl);
      fx2.push(o.ready, o.swirl, o.angle, o.open);
      seam.push(o.seam);
      ca.push(...o.cols[0]);
      cb.push(...o.cols[1]);
      cc.push(...o.cols[2]);
      n++;
    }

    for (let i = n; i < MAX_ORBS; i++) {
      geo.push(0, 0, 0, 0);
      fx.push(0, 0, 0, 0);
      fx2.push(0, 0, 0, 0);
      seam.push(0);
      ca.push(0, 0, 0);
      cb.push(0, 0, 0);
      cc.push(0, 0, 0);
    }

    return { n, geo, fx, fx2, seam, ca, cb, cc };
  }

  // WebGL을 못 쓰는 환경에서도 라벨 위치는 계속 갱신
  function selfDrive() {
    if (selfDriving) return;
    selfDriving = true;
    const loop = () => {
      tick(performance.now() / 1000);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  return {
    setScene,
    update,
    updateAll,
    flash,
    rename,
    get,
    has: (id) => byId.has(id),
    bind,
    clearBindings,
    tick,
    pack,
    mouse,
    selfDrive,
    isSelfDriving: () => selfDriving,
    lastTick: () => lastNow,
  };
})();

// ---------------- SHADER ----------------

const ORB_VERT = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vUv;

void main() {
  vUv = aTexCoord;
  // 행렬을 무시하고 화면 전체를 덮는 사각형으로 그린다
  gl_Position = vec4(aTexCoord * 2.0 - 1.0, aPosition.z * 0.0, 1.0);
}
`;

const ORB_FRAG = `
precision highp float;
#define MAX ${MAX_ORBS}

varying vec2 vUv;

uniform vec2 uRes;
uniform float uDensity;
uniform float uTime;
uniform vec2 uMouse;
uniform vec3 uBg;
uniform int uCount;

uniform vec4 uGeo[MAX];   // x, y, r, alpha
uniform vec4 uFx[MAX];    // seed, blur, hover, flash
uniform vec4 uFx2[MAX];   // ready, swirl, gradient angle, open
uniform float uSeam[MAX];
uniform vec3 uColA[MAX];
uniform vec3 uColB[MAX];
uniform vec3 uColC[MAX];

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y * uDensity - gl_FragCoord.y) / uDensity;
  vec3 col = uBg;
  float t = uTime;

  for (int i = 0; i < MAX; i++) {
    if (i >= uCount) break;

    vec4 g = uGeo[i];
    float r = max(g.z, 1.0);
    vec2 d = p - g.xy;
    float dist = length(d);
    vec4 f = uFx[i];
    vec4 f2 = uFx2[i];
    float flash = f.w;

    // 영향 범위 밖이면 건너뜀 (성능)
    if (dist > r * (2.3 + flash * 3.0)) continue;

    vec3 A = uColA[i];
    vec3 B = uColB[i];
    vec3 C = uColC[i];

    float seed = f.x;
    float blur = f.y;
    float hov = f.z;
    float ready = f2.x;
    float swirl = f2.y;
    float gang = f2.z;
    float opn = f2.w;

    float ang = atan(d.y, d.x + 0.0001);

    // 유기적으로 살짝 일그러지는 윤곽
    float wob = 0.010 * sin(3.0 * ang + t * 0.55 + seed)
              + 0.007 * sin(5.0 * ang - t * 0.8 + seed * 1.9)
              + (hov * 0.6 + swirl) * 0.013 * sin(4.0 * ang + t * 2.1 + seed);

    // 마우스 쪽으로 부풀어 오름 (hover)
    vec2 toM = uMouse - g.xy;
    float mA = atan(toM.y, toM.x + 0.0001);
    float facing = max(cos(ang - mA), 0.0);
    float bulge = hov * 0.045 * facing * facing * facing * facing;

    float R = r * (1.0 + wob + bulge);
    float q = dist / R;

    // 한쪽은 선명하고 반대쪽은 번지는 가장자리
    float side = 0.5 + 0.5 * cos(ang - seed * 2.0);
    float soft = mix(0.008, 0.06, side) + blur * mix(0.1, 0.34, side);
    soft = max(soft, 1.4 / R);
    float body = 1.0 - smoothstep(1.0 - soft, 1.0 + soft * 0.35, q);

    // 바깥으로 번지는 빛 (halo)
    float halo = 1.0 - smoothstep(1.0, 1.85 + blur * 0.6, q);
    halo = halo * halo * (0.2 + ready * (0.22 + 0.14 * sin(t * 2.2 + seed)));
    vec3 haloCol = mix(uBg, mix(B, C, 0.35), 0.5);
    col = mix(col, haloCol, halo * g.w * (1.0 - body));

    if (body > 0.001) {
      float qq = min(q, 1.0);
      vec2 nxy = (d / max(dist, 0.0001)) * qq;
      float z = sqrt(max(1.0 - qq * qq, 0.0));
      vec3 n = vec3(nxy, z);

      // 굴절: 가장자리로 갈수록 내부 좌표가 확대됨
      vec2 uv = n.xy * (1.0 + 0.45 * (1.0 - z));
      float ts = t * (0.22 + swirl * 1.3 + hov * 0.35);
      float flow = sin(uv.x * 2.1 + ts + seed) * 0.5
                 + sin(uv.y * 2.7 - ts * 0.8 + seed * 1.7) * 0.5
                 + sin((uv.x + uv.y) * 3.3 + ts * 1.3) * 0.25;

      // 마우스 위치에 따라 빛의 방향이 조금씩 바뀜
      vec2 mo = clamp(toM / (r * 3.0), -1.0, 1.0);
      vec2 dir = vec2(cos(gang), sin(gang));
      float gr = dot(uv, dir) * 0.55 + 0.5 + flow * 0.16 - dot(mo, dir) * 0.08;

      vec3 c = mix(A, B, smoothstep(0.05, 0.7, gr));
      c = mix(c, C, smoothstep(0.5, 1.1, gr) * 0.9);

      // 가장자리(프레넬)는 깊은 색으로
      float fres = (1.0 - z) * (1.0 - z);
      c = mix(c, C, fres * 0.45);

      // 유리 같은 하이라이트
      vec3 L = normalize(vec3(-0.4 + mo.x * 0.35, -0.5 + mo.y * 0.35, 0.75));
      float lit = max(dot(n, L), 0.0);
      float lit2 = lit * lit;
      float lit8 = lit2 * lit2 * lit2 * lit2;
      c += vec3(1.0) * lit8 * 0.2;
      c *= 0.9 + 0.12 * lit;

      // 가장자리의 무지개빛 분산
      vec3 iri = 0.5 + 0.5 * cos(6.2831 * (qq * 1.4 + ang * 0.159 + t * 0.04 + seed + vec3(0.0, 0.33, 0.67)));
      float band = smoothstep(0.72, 0.96, qq) * (1.0 - smoothstep(0.98, 1.04, q));
      c = mix(c, iri, band * 0.2 * (0.6 + 0.4 * side));

      // 봉인선: 캡슐의 이음매처럼 구체를 가로지르는 얇은 곡선
      vec3 axis = normalize(vec3(sin(seed * 1.3) * 0.35, 1.0, 0.35 * cos(seed * 1.3)));
      float sd = abs(dot(n, axis));
      float lw = 1.3 / R + 0.004;
      float seamLine = (1.0 - smoothstep(lw * 0.35, lw, sd)) * uSeam[i] * smoothstep(0.0, 0.35, z);
      c = mix(c, vec3(1.0), seamLine * (0.42 + ready * 0.3));

      // 개봉 가능: 안쪽이 숨 쉬듯 밝아짐
      c = mix(c, vec3(1.0), ready * (0.05 + 0.05 * sin(t * 2.2 + seed)) * z * z);

      // 개봉: 빛으로 씻겨 나감
      c = mix(c, mix(uBg, vec3(1.0), 0.45), opn * smoothstep(0.0, 1.0, z) * 0.88);

      col = mix(col, c, body * g.w);
    }

    // 봉인 · 개봉 순간 퍼지는 빛
    if (flash > 0.0) {
      float fr = 0.85 + flash * 2.4;
      float k = (q - fr) * 3.0 / (0.4 + flash);
      float ring = exp(-k * k) * (1.0 - flash);
      float bloom = (1.0 - smoothstep(0.0, 1.0 + flash * 1.5, q)) * (1.0 - flash) * 0.55;
      float amt = ring * 0.7 + bloom * smoothstep(0.0, 0.12, flash);
      col = mix(col, vec3(1.0), clamp(amt, 0.0, 1.0) * g.w);
    }
  }

  // 미세한 그레인 (그라데이션 계단 방지)
  col += (hash(p + fract(t)) - 0.5) * (3.0 / 255.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------- P5 ----------------

let orbShader = null;
const BG = hexToRgb("#F3F2EF");

function setup() {
  try {
    const cnv = createCanvas(windowWidth, windowHeight, WEBGL);
    cnv.parent("orb-layer");
    // 구체는 원래 부드러운 형태라 해상도를 낮춰도 티가 나지 않는다 → 성능 확보
    pixelDensity(1);
    noStroke();
    orbShader = createShader(ORB_VERT, ORB_FRAG);
  } catch (err) {
    console.warn("WebGL을 사용할 수 없어 구체 없이 실행합니다.", err);
    fallback();
  }
}

function draw() {
  const now = performance.now() / 1000;
  if (!Orbs.isSelfDriving()) Orbs.tick(now);
  if (!orbShader) return;

  try {
    const u = Orbs.pack(now);

    shader(orbShader);
    orbShader.setUniform("uRes", [width, height]);
    orbShader.setUniform("uDensity", pixelDensity());
    orbShader.setUniform("uTime", now % 1000);
    orbShader.setUniform("uMouse", [Orbs.mouse.x, Orbs.mouse.y]);
    orbShader.setUniform("uBg", BG);
    orbShader.setUniform("uCount", u.n);
    orbShader.setUniform("uGeo", u.geo);
    orbShader.setUniform("uFx", u.fx);
    orbShader.setUniform("uFx2", u.fx2);
    orbShader.setUniform("uSeam", u.seam);
    orbShader.setUniform("uColA", u.ca);
    orbShader.setUniform("uColB", u.cb);
    orbShader.setUniform("uColC", u.cc);

    plane(width, height);
  } catch (err) {
    console.warn("셰이더 오류 — 구체 없이 실행합니다.", err);
    orbShader = null;
    fallback();
  }
}

function fallback() {
  document.documentElement.classList.add("no-webgl");
  noLoop();
  Orbs.selfDrive();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
