import * as THREE from './three.module.min.js';

/* ---------- 定数 ---------- */
// 選べる球（高さ＝直径）。lenText(k) は「高さ×k」の長さを表す文字列
const SPHERES = [
  { label: '3cm',  H: 3,   bg: 'eraser', text: k => { const v = Math.round(30 * k) / 10; return (Number.isInteger(v) ? v : v.toFixed(1)) + 'cm'; } },
  { label: '1m',   H: 100, bg: 'desk',   text: k => { const v = Math.round(100 * k); return v === 100 ? '1m' : v + 'cm'; } },
  { label: '200m', H: 200, bg: 'tree',   text: k => Math.round(200 * k) + 'm' },
];
let SP = SPHERES[0];
const lenText = k => SP.text(k);
const SNAP = 0.04;             // まんなかへの吸着幅
const SVGNS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);
const TEACHER = document.body.dataset.mode === 'teacher';

/* ---------- 状態 ---------- */
const st = {
  theta: Math.PI / 2,          // 包丁の法線の向き（画面内）。π/2 = よこ線
  d: 0.40,                     // 中心からの距離（球の半径=1）
  showNum: true,                 // 直径はデフォルトで表示
  twoMode: false, twoPts: [],
  cut: null,                   // 切断中の情報
  history: [],
};

/* ---------- three.js ---------- */
const cv = $('cv'), stage = $('stage'), overlay = $('overlay');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
cam.position.set(0, 0, 10);
scene.add(new THREE.AmbientLight(0xffffff, 1.6));
const dl = new THREE.DirectionalLight(0xffffff, 1.6);
dl.position.set(1.2, 1.6, 2.5); scene.add(dl);

let halfW = 1, halfH = 1;
/* ---------- 背景の比較物（画面左端に見切れる形で、球と同じ縮尺） ----------
   球の高さ＝画面上の2単位。k＝1cm（または1m）あたりの単位数。地面＝球の下端 y=-1。
   寸法の目安：消しゴム 長さ5.5cm・高さ1.1cm／児童机（JIS 4号）高さ64cm・幅60cm／東京スカイツリー 高さ634m・脚部の幅 約68m */
const bgSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
bgSvg.id = 'bg'; stage.insertBefore(bgSvg, stage.firstChild);
function drawBg() {
  bgSvg.innerHTML = '';
  if (!stage.clientWidth) return;
  const k = 2 / SP.H, G = -1;
  const W0 = { eraser: 5.5, desk: 60, tree: 68 }[SP.bg] * k;
  const R = Math.min(-1.3, -halfW + W0 * { eraser: 0.45, desk: 0.5, tree: 0.75 }[SP.bg]);
  const sc = toPx(1, 0)[0] - toPx(0, 0)[0];             // 1単位あたりのpx
  const X = x => toPx(x, 0)[0], Y = y => toPx(0, y)[1];
  const el = (t, a, p = bgSvg) => svgEl(t, a, p);
  // 共通の定義（グラデーション・影）
  bgSvg.insertAdjacentHTML('beforeend', `<defs>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
    <linearGradient id="gRubber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f1f0ec"/><stop offset="1" stop-color="#d9d7d0"/></linearGradient>
    <linearGradient id="gSleeve" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f8f6b"/><stop offset=".5" stop-color="#2f7a58"/><stop offset="1" stop-color="#215a41"/></linearGradient>
    <linearGradient id="gWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2bd88"/><stop offset=".6" stop-color="#cfa067"/><stop offset="1" stop-color="#a97a46"/></linearGradient>
    <linearGradient id="gSteelV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7d838b"/><stop offset=".35" stop-color="#d7dbe0"/><stop offset=".6" stop-color="#a3a9b1"/><stop offset="1" stop-color="#5f656d"/></linearGradient>
    <linearGradient id="gSteelH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a9098"/><stop offset=".4" stop-color="#d9dde2"/><stop offset="1" stop-color="#6a7078"/></linearGradient>
    <linearGradient id="gBox" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa0a8"/><stop offset="1" stop-color="#70767e"/></linearGradient>
    <linearGradient id="gTree" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c9d4e0"/><stop offset=".45" stop-color="#f2f6fa"/><stop offset="1" stop-color="#aebccb"/></linearGradient>
  </defs>`);
  const g = el('g', { opacity: .92 });
  // 床（机の上・地面）
  el('line', { x1: 0, y1: Y(G), x2: X(R + 0.12), y2: Y(G), stroke: '#c9c2b2', 'stroke-width': 2 }, g);

  if (SP.bg === 'eraser') {
    const L = 5.5 * k, T = 1.1 * k, x0 = X(R - L), x1 = X(R), y0 = Y(G + T), y1 = Y(G);
    el('ellipse', { cx: (x0 + x1) / 2, cy: y1 + 2, rx: (x1 - x0) / 2, ry: 6, fill: '#000', opacity: .18, filter: 'url(#soft)' }, g);
    el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: .12 * sc * k * 1.5, fill: 'url(#gRubber)', stroke: '#c8c5bc', 'stroke-width': 1.5 }, g);
    el('rect', { x: x0 + 4, y: y0 + 3, width: x1 - x0 - 8, height: (y1 - y0) * .18, rx: 4, fill: '#fff', opacity: .8 }, g);   // つや
    // 紙のケース（はしが少し欠けた、使いかけ）
    const s0 = X(R - L * 0.86), s1 = X(R - L * 0.2);
    el('rect', { x: s0, y: y0 - 2, width: s1 - s0, height: y1 - y0 + 4, rx: 3, fill: 'url(#gSleeve)' }, g);
    el('rect', { x: s0, y: y0 + (y1 - y0) * .38, width: s1 - s0, height: (y1 - y0) * .12, fill: '#fff', opacity: .85 }, g);
    el('rect', { x: s0, y: y0 - 2, width: 3, height: y1 - y0 + 4, fill: '#000', opacity: .15 }, g);
    el('path', { d: `M${x1 - 6} ${y0 + 2} q 5 ${(y1 - y0) * .3} 0 ${(y1 - y0) * .6}`, stroke: '#d8d5cd', 'stroke-width': 2, fill: 'none' }, g);   // 角のすりへり
  } else if (SP.bg === 'desk') {
    const W = 60 * k, Ht = 64 * k, top = 2.5 * k, leg = 2.6 * k, box = 13 * k;
    const xl = X(R - W), xr = X(R), yTop = Y(G + Ht), yTopB = Y(G + Ht - top), yG = Y(G);
    el('ellipse', { cx: (xl + xr) / 2, cy: yG + 2, rx: (xr - xl) / 2 + 6, ry: 7, fill: '#000', opacity: .16, filter: 'url(#soft)' }, g);
    // あし（スチールパイプ）
    for (const lx of [R - W + 1.5 * k, R - 1.5 * k - leg]) {
      el('rect', { x: X(lx), y: yTopB, width: leg * sc, height: yG - yTopB - 4, fill: 'url(#gSteelV)' }, g);
      el('rect', { x: X(lx) - 1, y: yG - 6, width: leg * sc + 2, height: 6, rx: 2, fill: '#2b2b2b' }, g);   // ゴムの足
    }
    // 横の棒
    const yb = Y(G + 17 * k);
    el('rect', { x: X(R - W + 1.5 * k), y: yb, width: (W - 3 * k) * sc, height: 2 * k * sc, fill: 'url(#gSteelH)' }, g);
    // 物入れ（スチール、手前が開いている）
    const bx0 = X(R - W + 3 * k), bx1 = X(R - 3 * k), by0 = yTopB, by1 = Y(G + Ht - top - box);
    el('rect', { x: bx0, y: by0, width: bx1 - bx0, height: by1 - by0, fill: 'url(#gBox)' }, g);
    el('rect', { x: bx0 + 6, y: by0 + 4, width: bx1 - bx0 - 12, height: (by1 - by0) - 10, rx: 3, fill: '#3d4148' }, g);
    el('rect', { x: bx0 + 10, y: by1 - 14, width: (bx1 - bx0) * .5, height: 8, fill: '#e9e4d8' }, g);   // 中のノート
    // 天板（木目）
    el('rect', { x: xl, y: yTop, width: xr - xl, height: yTopB - yTop, rx: 3, fill: 'url(#gWood)' }, g);
    for (let i = 1; i < 4; i++)
      el('path', { d: `M${xl} ${yTop + (yTopB - yTop) * i / 4} C ${xl + (xr - xl) * .3} ${yTop + (yTopB - yTop) * (i / 4 - .15)}, ${xl + (xr - xl) * .6} ${yTop + (yTopB - yTop) * (i / 4 + .15)}, ${xr} ${yTop + (yTopB - yTop) * i / 4}`,
        stroke: '#8a5d30', 'stroke-width': 1, opacity: .35, fill: 'none' }, g);
    el('rect', { x: xl, y: yTop, width: xr - xl, height: 2, fill: '#fff', opacity: .5 }, g);
    el('rect', { x: xl, y: yTopB - 2, width: xr - xl, height: 2, fill: '#6d4a26', opacity: .5 }, g);
  } else {
    const Hm = 634, cx = R - 0.34;
    const wAt = h => 0.68 * (1 - 0.72 * Math.pow(h / Hm, 0.8)) / 2;
    const hs = []; for (let h = 0; h < Hm; h += 10) hs.push(h); hs.push(Hm);
    const pts = [...hs.map(h => [cx - wAt(h), G + h * k]), ...[...hs].reverse().map(h => [cx + wAt(h), G + h * k])];
    el('ellipse', { cx: X(cx), cy: Y(G) + 2, rx: wAt(0) * sc + 10, ry: 7, fill: '#000', opacity: .15, filter: 'url(#soft)' }, g);
    el('polygon', { points: pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' '), fill: 'url(#gTree)', opacity: .55 }, g);
    // 鉄骨のトラス：外側の柱・中央の柱・斜めの部材・水平の帯
    const st = { stroke: '#8597ab', fill: 'none' };
    const side = sgn => hs.map(h => `${X(cx + sgn * wAt(h))},${Y(G + h * k)}`).join(' ');
    el('polyline', { points: side(-1), 'stroke-width': 3.5, ...st }, g);
    el('polyline', { points: side(1), 'stroke-width': 3.5, ...st }, g);
    el('line', { x1: X(cx), y1: Y(G), x2: X(cx), y2: Y(G + Hm * k), 'stroke-width': 2.5, ...st }, g);
    for (let h = 0; h < Hm; h += 25) {
      const h2 = h + 25, a = [cx - wAt(h), G + h * k], b = [cx + wAt(h), G + h * k], a2 = [cx - wAt(h2), G + h2 * k], b2 = [cx + wAt(h2), G + h2 * k], m2 = [cx, G + h2 * k], m = [cx, G + h * k];
      for (const [p, q] of [[a, m2], [m, a2], [b, m2], [m, b2]])
        el('line', { x1: X(p[0]), y1: Y(p[1]), x2: X(q[0]), y2: Y(q[1]), 'stroke-width': 1.3, ...st }, g);
      el('line', { x1: X(a[0]), y1: Y(a[1]), x2: X(b[0]), y2: Y(b[1]), 'stroke-width': 1.8, ...st }, g);
    }
    // 展望台（350m・450m）
    for (const [h0, h1, w] of [[340, 365, 0.25], [445, 455, 0.18]]) {
      el('rect', { x: X(cx - w), y: Y(G + h1 * k), width: 2 * w * sc, height: (h1 - h0) * k * sc, rx: 4, fill: 'url(#gSteelH)', stroke: '#6d7f93' }, g);
      el('rect', { x: X(cx - w) + 3, y: Y(G + h1 * k) + (h1 - h0) * k * sc * .3, width: 2 * w * sc - 6, height: (h1 - h0) * k * sc * .35, fill: '#4a6a8c', opacity: .7 }, g);
    }
    // 根元の建物
    el('rect', { x: X(cx - wAt(0) - 0.25), y: Y(G + 30 * k), width: (2 * wAt(0) + 0.5) * sc, height: 30 * k * sc, rx: 3, fill: '#d6dbe1', stroke: '#9aa6b3' }, g);
  }
}
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  halfH = 1.75; halfW = halfH * w / h;
  if (halfW < 1.75) { halfW = 1.75; halfH = halfW * h / w; }
  Object.assign(cam, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
  cam.updateProjectionMatrix();
  overlay.setAttribute('viewBox', `0 0 ${w} ${h}`); bgSvg.setAttribute('viewBox', `0 0 ${w} ${h}`); drawBg();
  dirty = true; drawKnife();
}

/* 虹色の球（経度で色相、緯度で明るさ） */
// OKLCH（知覚的に均一な色空間）で色を作る：どの色相でも明るさが揃うので、
// HSLで起きる黄・水色・マゼンタ付近の明るい筋が出ない。
function oklchToLinear(L, C, h) {
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const cl = v => Math.min(1, Math.max(0, v));
  return [cl(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
          cl(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
          cl(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)];
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const sphereGeo = (() => {
  const g = new THREE.SphereGeometry(1, 96, 64);
  const p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = Math.atan2(z, x);
    const r = Math.sqrt(Math.max(0, 1 - y * y));      // 回転軸からの距離
    const w = smooth(0.35, 1.0, y);                   // 北極へ向かって白へ
    const L = 0.75 + (0.99 - 0.75) * w;
    const C = 0.12 * r * (1 - w);                     // 彩度は軸距離に比例（極で0）。白へ寄るほど0
    col.push(...oklchToLinear(L, C, h));              // 頂点色は線形RGBで渡す
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
})();
// 極の印：球面に貼った平らな円（陰影なし）
const dotGeo = new THREE.CircleGeometry(0.05, 32);
const dotRingGeo = new THREE.RingGeometry(0.05, 0.062, 32);

/* ---------- 表面の質感：大きさの手がかり ----------
   3cm ：プラスチック玉。強いつや（小さく鋭いハイライト）と、型の合わせ目の細い線。
   1m  ：これまでどおりのつや消し。
   200m：大きな構造物。たくさんの板（パネル）を継ぎ合わせた面。板ごとのわずかな色むら・継ぎ目・
         太い補強の帯・リベット列で「細かい部品の集まり＝巨大」を示し、遠くの物のように少しかすませる。
   色そのものは頂点色（虹色）のまま。質感はテクスチャを掛け合わせて表す。 */
const texCache = {};
function surfaceTexture(kind) {
  if (texCache[kind] !== undefined) return texCache[kind];
  if (kind === 'desk') return (texCache[kind] = null);
  const W = 2048, H = 1024, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
  if (kind === 'eraser') {
    // 型の合わせ目（赤道）：ごく細い線と、わずかな段差の明暗
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(0, H / 2 - 2, W, 3);
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(0, H / 2 + 1, W, 2);
  } else {
    // 巨大構造物：板・継ぎ目・帯・リベット（極付近は板が細かくなりすぎるので間引く）
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const rows = 40, cols = 80, ph = H / rows, pw = W / cols;
    for (let r = 0; r < rows; r++) {
      const lat = Math.abs(90 - (r + 0.5) * 180 / rows);
      const step = lat > 75 ? 8 : lat > 60 ? 4 : lat > 45 ? 2 : 1;      // 高緯度ほど横に長い板にする
      for (let q = 0; q < cols; q += step) {
        const v = 0.86 + rnd() * 0.12;
        c.fillStyle = `rgb(${255 * v | 0},${255 * v | 0},${255 * (v + .02) | 0})`;
        c.fillRect(q * pw, r * ph, pw * step, ph);
        c.fillStyle = 'rgba(40,45,55,.55)';                               // 継ぎ目
        c.fillRect(q * pw, r * ph, 2, ph); c.fillRect(q * pw, r * ph, pw * step, 2);
        if (lat < 60) {                                                    // リベット列
          c.fillStyle = 'rgba(30,30,40,.35)';
          for (let t = 1; t < 6; t++) c.fillRect(q * pw + t * pw * step / 6, r * ph + 5, 2, 2);
        }
      }
    }
    c.fillStyle = 'rgba(25,30,40,.6)';                                      // 補強の帯（30°ごと・45°ごと）
    for (let r = 0; r <= rows; r += rows / 6) c.fillRect(0, r * ph - 4, W, 8);
    for (let q = 0; q < cols; q += cols / 8) c.fillRect(q * pw - 4, H * 0.12, 8, H * 0.76);
    c.fillStyle = 'rgba(185,195,210,.22)'; c.fillRect(0, 0, W, H);           // 遠くのかすみ
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return (texCache[kind] = tex);
}
function bodyMaterial(o) {
  const map = surfaceTexture(SP.bg);
  if (SP.bg === 'eraser')
    return new THREE.MeshPhongMaterial({ vertexColors: true, map, shininess: 140, specular: 0xbbbbbb, ...o });
  if (SP.bg === 'tree')
    return new THREE.MeshLambertMaterial({ vertexColors: true, map, ...o });
  return new THREE.MeshLambertMaterial({ vertexColors: true, ...o });
}
function makeMats(planes) {
  const o = planes ? { clippingPlanes: planes } : {};
  return {
    body: bodyMaterial(o),
    white: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, ...o }),
    black: new THREE.MeshBasicMaterial({ color: 0x151515, side: THREE.DoubleSide, ...o }),
  };
}
function buildBody(m) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(sphereGeo, m.body));
  const mk = (mat, y) => {
    const d = new THREE.Mesh(dotGeo, mat); d.position.set(0, y, 0); d.rotation.x = -Math.PI / 2; g.add(d);
  };
  mk(m.white, 1.003); mk(m.black, -1.003);
  const ring = new THREE.Mesh(dotRingGeo, m.black); ring.position.set(0, 1.003, 0); ring.rotation.x = -Math.PI / 2; g.add(ring);
  return g;
}
let sphereGroup = buildBody(makeMats());
scene.add(sphereGroup);
function rebuildSphere() {
  const q = sphereGroup.quaternion.clone();
  scene.remove(sphereGroup);
  sphereGroup = buildBody(makeMats()); sphereGroup.quaternion.copy(q); scene.add(sphereGroup);
}

/* ---------- 包丁の線（SVG） ---------- */
const nVec = () => new THREE.Vector3(Math.cos(st.theta), Math.sin(st.theta), 0);
const toPx = (x, y) => [ (x / halfW * 0.5 + 0.5) * stage.clientWidth, (0.5 - y / halfH * 0.5) * stage.clientHeight ];
function toWorld(e) {
  const r = stage.getBoundingClientRect();
  return [ ((e.clientX - r.left) / r.width - 0.5) * 2 * halfW, (0.5 - (e.clientY - r.top) / r.height) * 2 * halfH ];
}
function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
}
const hG = svgEl('g', { 'pointer-events': 'none' }, overlay);   // 高さの点線
const kG = svgEl('g', {}, overlay);
const kShadow = svgEl('line', { stroke: '#fff', 'stroke-width': 9, 'stroke-linecap': 'round', opacity: .8 }, kG);
const kLine = svgEl('line', { stroke: '#111', 'stroke-width': 4, 'stroke-dasharray': '14 8', 'stroke-linecap': 'round' }, kG);
const kHit = svgEl('line', { stroke: 'transparent', 'stroke-width': 44, class: 'hit' }, kG);
const knobs = [0, 1].map(() => {
  const g = svgEl('g', { class: 'knob' }, kG);
  svgEl('circle', { r: 24, fill: '#fff', stroke: '#111', 'stroke-width': 3 }, g);
  svgEl('path', { d: 'M-9 -4 A10 10 0 1 1 -4 9 M-9 -4 l-1 -7 M-9 -4 l7 -1', fill: 'none', stroke: '#111', 'stroke-width': 2.6, 'stroke-linecap': 'round' }, g);
  return g;
});
const twoG = svgEl('g', {}, overlay);

function drawHeight() { hG.innerHTML = ''; }   // 切断画面では高さを表示しない（背景の比較物で大きさを伝える）
function drawHeightUnused() {
  hG.innerHTML = '';
  const c = st.cut;
  // 球のまま、または「切り口を見る」で正面を向けた後だけ表示（どちらも画面上の球の輪郭は半径1）
  if (c && !(c.face && !c.qTarget)) return;
  const xL = -Math.min(halfW - 0.12, 1.62);
  const [ax, top] = toPx(xL, 1), [, bot] = toPx(xL, -1), [cx] = toPx(0, 0);
  const col = '#1f4fd1';
  for (const y of [top, bot])
    svgEl('line', { x1: ax - 10, y1: y, x2: cx, y2: y, stroke: col, 'stroke-width': 2, 'stroke-dasharray': '6 6' }, hG);
  svgEl('line', { x1: ax, y1: top, x2: ax, y2: bot, stroke: col, 'stroke-width': 3, 'stroke-dasharray': '10 6' }, hG);
  for (const [y, s] of [[top, 1], [bot, -1]])
    svgEl('path', { d: `M${ax - 8} ${y + s * 12} L${ax} ${y} L${ax + 8} ${y + s * 12}`, fill: 'none', stroke: col, 'stroke-width': 3 }, hG);
  const mid = (top + bot) / 2;
  svgEl('rect', { x: ax - 18, y: mid - 62, width: 36, height: 124, rx: 8, fill: '#f6f4ef' }, hG);
  const t = svgEl('text', { x: ax, y: mid, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'writing-mode': 'vertical-rl',
    'font-size': 22, 'font-weight': 700, fill: col }, hG);
  t.textContent = '高さ ' + SP.label;
}
function drawKnife() {
  drawHeight();
  if (!stage.clientWidth) return;
  const n = nVec(), m = [-n.y, n.x];
  const cx = n.x * st.d, cy = n.y * st.d, L = 1.25;
  const a = toPx(cx - m[0] * L, cy - m[1] * L), b = toPx(cx + m[0] * L, cy + m[1] * L);
  for (const l of [kShadow, kLine, kHit]) {
    l.setAttribute('x1', a[0]); l.setAttribute('y1', a[1]);
    l.setAttribute('x2', b[0]); l.setAttribute('y2', b[1]);
  }
  knobs[0].setAttribute('transform', `translate(${a[0]},${a[1]})`);
  knobs[1].setAttribute('transform', `translate(${b[0]},${b[1]})`);
  kG.style.display = st.cut ? 'none' : '';
  $('pos').value = Math.round(st.d * 100);
  let deg = Math.round(st.theta * 180 / Math.PI) % 180; if (deg < 0) deg += 180;
  $('ang').value = deg;
  updateHint();
}
function setTheta(t) {
  // 法線が反転したら位置も反転させ、線の見た目の位置を保つ
  if (Math.cos(t - st.theta) < 0) { t += Math.PI; }
  st.theta = t; drawKnife();
}
function setD(d) {
  d = Math.max(-0.97, Math.min(0.97, d));
  if (Math.abs(d) < SNAP) d = 0;
  st.d = d; drawKnife();
}

/* ---------- 入力 ---------- */
let drag = null;
kHit.addEventListener('pointerdown', e => {
  if (st.twoMode) return;
  e.stopPropagation(); kHit.setPointerCapture(e.pointerId);
  drag = { kind: 'move' };
});
knobs.forEach(k => k.addEventListener('pointerdown', e => {
  if (st.twoMode) return;
  e.stopPropagation(); k.setPointerCapture(e.pointerId);
  const [x, y] = toWorld(e);
  drag = { kind: 'rot', phi0: Math.atan2(y, x), th0: st.theta };
}));
cv.addEventListener('pointerdown', e => {
  if (st.twoMode && !st.cut) { addTwoPoint(e); return; }
  cv.setPointerCapture(e.pointerId);
  drag = { kind: 'spin', x: e.clientX, y: e.clientY };
});
function onMove(e) {
  if (!drag) return;
  if (drag.kind === 'spin') {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    const len = Math.hypot(dx, dy); if (!len) return;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(dy / len, dx / len, 0), len * 0.009);
    const tgt = st.cut ? st.cut.group : sphereGroup;
    if (st.cut) st.cut.qTarget = null;
    tgt.quaternion.premultiply(q); dirty = true;
  } else if (drag.kind === 'move') {
    const [x, y] = toWorld(e); const n = nVec();
    setD(x * n.x + y * n.y);
  } else if (drag.kind === 'rot') {
    const [x, y] = toWorld(e);
    let dphi = Math.atan2(y, x) - drag.phi0;
    st.theta = drag.th0 + dphi; drawKnife();   // 中心のまわりに回す：中心からの距離は変わらない
  }
}
function onUp() { drag = null; }
for (const el of [cv, kHit, ...knobs]) {
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
}

$('pos').addEventListener('input', e => setD(+e.target.value / 100));
$('ang').addEventListener('input', e => setTheta(+e.target.value * Math.PI / 180));

/* 2点で線をひく */
$('tTwo').addEventListener('click', () => {
  st.twoMode = !st.twoMode; st.twoPts = [];
  $('tTwo').setAttribute('aria-pressed', st.twoMode);
  twoG.innerHTML = ''; updateHint();
});
function addTwoPoint(e) {
  const p = toWorld(e); st.twoPts.push(p);
  const px = toPx(p[0], p[1]);
  svgEl('circle', { cx: px[0], cy: px[1], r: 10, fill: '#111' }, twoG);
  if (st.twoPts.length === 2) {
    const [a, b] = st.twoPts;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (Math.hypot(dx, dy) > 0.05) {
      let t = Math.atan2(dx, -dy);                // 線に垂直な向き
      const n = [Math.cos(t), Math.sin(t)];
      let d = a[0] * n[0] + a[1] * n[1];
      st.theta = t; setD(d);
    }
    setTimeout(() => { twoG.innerHTML = ''; }, 350);
    st.twoMode = false; st.twoPts = [];
    $('tTwo').setAttribute('aria-pressed', false);
  }
  updateHint();
}
function updateHint() {
  const h = $('hint');
  if (st.twoMode) h.textContent = st.twoPts.length ? 'もう1点おしてください' : '線の1点目をおしてください';
  else if (st.cut) h.textContent = '球をドラッグすると回せます';
  else h.textContent = '球をドラッグで回す／線をドラッグで動かす／○で線を回す';
}

/* ---------- 切る ---------- */
const capMat = new THREE.MeshBasicMaterial({ color: 0xf3efe6, side: THREE.DoubleSide });
const ringMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
const markMat = new THREE.MeshBasicMaterial({ color: 0x1f4fd1, side: THREE.DoubleSide });

function makeCap(r) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CircleGeometry(r, 72), capMat));
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.97, r, 72), ringMat); ring.position.z = 0.002; g.add(ring);
  const c = new THREE.Mesh(new THREE.CircleGeometry(0.035, 20), markMat); c.position.z = 0.003; g.add(c);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(2 * r * 0.97, 0.025), markMat);
  bar.position.z = 0.003; bar.userData.isBar = true; g.add(bar);
  // 直径の長さを切り口に直接書く（「直径の長さ」ボタンで表示）
  const cvs = document.createElement('canvas'); cvs.width = 512; cvs.height = 192;
  const ctx = cvs.getContext('2d');
  ctx.font = 'bold 140px "BIZ UDPGothic","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 18; ctx.strokeStyle = '#f3efe6'; ctx.lineJoin = 'round';
  const txt = lenText(r);
  ctx.strokeText(txt, 256, 100); ctx.fillStyle = '#1f4fd1'; ctx.fillText(txt, 256, 100);
  const tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace;
  const lw = Math.max(0.42, Math.min(0.95, r * 1.1)), lh = lw * 192 / 512;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  label.position.set(0, lh * 0.5 + 0.02, 0.004); label.userData.isBar = true; label.userData.isLabel = true; g.add(label);
  return g;
}

function doCut() {
  if (st.cut) return;
  const n = nVec(), d = st.d, r = Math.sqrt(1 - d * d);
  const q = sphereGroup.quaternion.clone();
  const group = new THREE.Group();
  const halves = [1, -1].map(sgn => {
    const plane = new THREE.Plane();
    const hg = new THREE.Group();
    const inner = buildBody(makeMats([plane]));
    inner.quaternion.copy(q); hg.add(inner);
    const cap = makeCap(r);
    const out = n.clone().multiplyScalar(-sgn);           // 切り口の外向き
    // 文字が正面から読める向きにそろえる（x軸＝包丁の線の向き）
    const xAx = new THREE.Vector3(n.y, -n.x, 0);
    const yAx = new THREE.Vector3().crossVectors(out, xAx);
    cap.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, yAx, out));
    cap.position.copy(n).multiplyScalar(d).addScaledVector(out, 0.001);
    // 下側の半分は、上の半分に隠れないよう数値を直径の線の下に書く
    if (sgn < 0) cap.children.forEach(o => { if (o.userData.isLabel) o.position.y *= -1; });
    hg.add(cap); group.add(hg);
    return { sgn, plane, hg, cap };
  });
  scene.add(group); sphereGroup.visible = false;
  // 切り口が見えるよう、包丁の線を軸に少し手前へ傾ける
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-n.y, n.x, 0), -0.75);
  st.cut = { n, d, r, group, halves, s: 0, sTarget: 0.5, qTarget: tilt, tilt, face: false };
  applyNumVisibility();

  const rec = { theta: st.theta, d, k: r };   // k = 切り口の直径 ÷ 球の高さ
  st.history.push(rec);
  renderSide(rec); renderHistory();
  setButtons(); drawKnife(); dirty = true;
}
function uncut() {
  const c = st.cut; if (!c) return;
  sphereGroup.quaternion.copy(c.group.quaternion).multiply(sphereGroup.quaternion);
  scene.remove(c.group);
  c.group.traverse(o => { if (o.material && o.material.clippingPlanes) o.material.dispose(); });
  st.cut = null; sphereGroup.visible = true;
  setButtons(); drawKnife(); dirty = true;
}
function toggleFace() {
  const c = st.cut; if (!c) return;
  c.face = !c.face;
  const B = c.halves[1];
  if (c.face) {
    // かたほう（線の上側にあった方）の切り口を正面へ
    c.qTarget = new THREE.Quaternion().setFromUnitVectors(c.n.clone().negate(), new THREE.Vector3(0, 0, 1));
    B.hg.visible = false; c.sTarget = 0;
  } else {
    c.qTarget = c.tilt.clone(); B.hg.visible = true; c.sTarget = 0.5;
  }
  $('bFace').textContent = c.face ? '両方を見る' : '切り口を見る';
  dirty = true;
}
function setButtons() {
  const cut = !!st.cut;
  $('bCut').disabled = cut; $('bFace').disabled = !cut; $('bBack').disabled = !cut;
  $('bFace').textContent = '切り口を見る';
  for (const id of ['gPos', 'gAng', 'tTwo']) $(id).classList.toggle('disabled', cut);
}
$('bCut').addEventListener('click', doCut);
$('bBack').addEventListener('click', uncut);
$('bFace').addEventListener('click', toggleFace);
$('tReset').addEventListener('click', () => {
  if (st.cut) st.cut.qTarget = new THREE.Quaternion();
  else sphereGroup.quaternion.identity();
  dirty = true;
});
if ($('tNum')) $('tNum').addEventListener('click', () => {
  st.showNum = !st.showNum; $('tNum').setAttribute('aria-pressed', st.showNum);
  applyNumVisibility(); renderSide(st.history[st.history.length - 1]); renderHistory();
});
function applyNumVisibility() {
  if (!st.cut) return;
  st.cut.halves.forEach(h => h.cap.children.forEach(o => { if (o.userData.isBar) o.visible = st.showNum; }));
  dirty = true;
}

/* ---------- 右パネル ---------- */
const fmt = v => (Math.round(v * 10) / 10).toFixed(1);
function renderSide(rec) {
  const s = $('cutView'); if (!s) return; s.innerHTML = '';
  svgEl('circle', { r: 100, fill: 'none', stroke: '#b9b3a6', 'stroke-width': 2, 'stroke-dasharray': '6 5' }, s);
  if (!rec) { $('cutText').textContent = ''; svgEl('text', { y: 6, 'text-anchor': 'middle', 'font-size': 15, fill: '#5b6270' }, s).textContent = 'まだ切っていません'; return; }
  const r = rec.k * 100;
  svgEl('circle', { r, fill: '#f3efe6', stroke: '#333', 'stroke-width': 3 }, s);
  svgEl('circle', { r: 4, fill: '#1f4fd1' }, s);
  if (st.showNum) {
    svgEl('line', { x1: -r, x2: r, stroke: '#1f4fd1', 'stroke-width': 3 }, s);
    $('cutText').innerHTML = `直径 ${lenText(rec.k)} <span style="font-size:13px;color:#5b6270;font-weight:400">（球の高さ ${SP.label}＝点線）</span>`;
  } else {
    $('cutText').innerHTML = '<span style="font-size:13px;color:#5b6270;font-weight:400">点線＝球と同じ大きさの円</span>';
  }
}
function renderHistory() {
  const box = $('hist'); if (!box) return; box.innerHTML = '';
  const max = Math.max(...st.history.map(h => h.k));
  st.history.forEach((h, i) => {
    const el = document.createElement('div');
    el.className = 'hi' + (st.history.length > 1 && max - h.k < 0.006 ? ' max' : '');
    const s = svgEl('svg', { width: 64, height: 64, viewBox: '-34 -34 68 68' });
    svgEl('circle', { r: 28, fill: '#fff', stroke: '#888', 'stroke-width': 1.5 }, s);
    const nx = Math.cos(h.theta), ny = -Math.sin(h.theta);  // SVGはyが下向き
    const cx = nx * h.d * 28, cy = ny * h.d * 28, mx = -ny, my = nx;
    svgEl('line', { x1: cx - mx * 33, y1: cy - my * 33, x2: cx + mx * 33, y2: cy + my * 33, stroke: '#111', 'stroke-width': 2.5, 'stroke-dasharray': '5 3' }, s);
    el.appendChild(s);
    const s2 = svgEl('svg', { width: 64, height: 64, viewBox: '-32 -32 64 64' });
    svgEl('circle', { r: 28, fill: 'none', stroke: '#ccc', 'stroke-dasharray': '3 3' }, s2);
    svgEl('circle', { r: h.k * 28, fill: '#f3efe6', stroke: '#333', 'stroke-width': 2 }, s2);
    el.appendChild(s2);
    const t = document.createElement('div');
    t.textContent = st.showNum ? `${i + 1}．${lenText(h.k)}` : `${i + 1}`;
    el.appendChild(t);
    el.addEventListener('click', () => { if (st.cut) uncut(); st.theta = h.theta; setD(h.d); renderSide(h); });
    box.appendChild(el);
  });
  box.scrollTop = box.scrollHeight; box.scrollLeft = box.scrollWidth;
}

/* ---------- 描画ループ（変化があるときだけ描く：4GB機対策） ---------- */
let dirty = true;
const tmpPlane = new THREE.Plane();
function tick() {
  const c = st.cut;
  if (c) {
    if (Math.abs(c.s - c.sTarget) > 1e-4) { c.s += (c.sTarget - c.s) * 0.15; dirty = true; }
    if (c.qTarget) {
      c.group.quaternion.slerp(c.qTarget, 0.15);
      if (c.group.quaternion.angleTo(c.qTarget) < 1e-3) { c.group.quaternion.copy(c.qTarget); c.qTarget = null; }
      dirty = true;
    }
    if (dirty) {
      c.group.updateMatrixWorld(true);
      c.halves.forEach(h => {
        h.hg.position.copy(c.n).multiplyScalar(h.sgn * c.s);
        // 半分Aは n·p ≥ d+s を残す／半分Bは -n·p ≥ -(d-s) を残す
        tmpPlane.normal.copy(c.n).multiplyScalar(h.sgn);
        tmpPlane.constant = h.sgn > 0 ? -(c.d + c.s) : (c.d - c.s);
        h.plane.copy(tmpPlane).applyMatrix4(c.group.matrixWorld);
      });
      c.group.updateMatrixWorld(true);
    }
  }
  if (dirty) { renderer.render(scene, cam); dirty = false; if (st.cut) drawHeight(); }
  requestAnimationFrame(tick);
}

new ResizeObserver(resize).observe(stage);
/* ---------- 最初の画面：球をえらぶ ---------- */
const picker = document.createElement('div'); picker.id = 'picker';
picker.innerHTML = '<h2>どの球を切る？</h2><div class="pk-row"></div>';
SPHERES.forEach((sp, i) => {
  const b = document.createElement('button'); b.className = 'pk';
  b.innerHTML = `<svg viewBox="-80 -64 160 128" aria-hidden="true">
    <defs><radialGradient id="pg${i}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#d9c27a"/><stop offset="1" stop-color="#6f8f9a"/></radialGradient></defs>
    <line x1="-62" y1="-50" x2="0" y2="-50" stroke="#1f4fd1" stroke-width="2" stroke-dasharray="4 4"/>
    <line x1="-62" y1="50" x2="0" y2="50" stroke="#1f4fd1" stroke-width="2" stroke-dasharray="4 4"/>
    <circle cx="8" r="50" fill="url(#pg${i})" stroke="#333" stroke-width="2"/>
    <line x1="-58" y1="-50" x2="-58" y2="50" stroke="#1f4fd1" stroke-width="3" stroke-dasharray="7 5"/>
  </svg><span class="pk-n">${i + 1}</span><span class="pk-t">高さ ${sp.label}</span>`;
  b.addEventListener('click', () => chooseSphere(sp));
  picker.querySelector('.pk-row').appendChild(b);
});
document.body.appendChild(picker);
function chooseSphere(sp) {
  SP = sp; if (st.cut) uncut(); rebuildSphere();
  st.history = []; renderSide(); renderHistory();
  $('spTag').textContent = '高さ ' + sp.label + ' の球';
  picker.hidden = true; drawBg(); drawKnife(); dirty = true;
}
const tag = document.createElement('span'); tag.id = 'spTag'; tag.className = 'sptag';
const pickBtn = document.createElement('button'); pickBtn.className = 'tog'; pickBtn.id = 'bPick'; pickBtn.textContent = '球をえらぶ';
pickBtn.addEventListener('click', () => { picker.hidden = false; });
const hd = document.querySelector('header'); hd.insertBefore(tag, hd.querySelector('.sp')); hd.insertBefore(pickBtn, $('tReset'));

resize(); setButtons(); renderSide(); updateHint();
requestAnimationFrame(tick);

/* ---------- 教師用：履歴スライド ---------- */
if (TEACHER) {
  const ov = $('slides'), sv1 = $('sKnife'), sv2 = $('sCut');
  let idx = 0;
  function drawSlide() {
    const n = st.history.length;
    $('sCount').textContent = n ? `${idx + 1} / ${n}` : '0 / 0';
    $('sPrev').disabled = idx <= 0; $('sNext').disabled = idx >= n - 1;
    sv1.innerHTML = ''; sv2.innerHTML = '';
    if (!n) { $('sTitle').textContent = 'まだ切っていません'; return; }
    const h = st.history[idx];
    $('sTitle').textContent = `${idx + 1}回目の切り方`;
    // 切り方：球（円）と切断ライン。切った部分の線は実線で強調
    const R = 100;
    svgEl('circle', { r: R, fill: 'var(--cap)', stroke: 'var(--ink)', 'stroke-width': 3 }, sv1);
    svgEl('circle', { r: 4, fill: 'var(--sub)' }, sv1);
    const nx = Math.cos(h.theta), ny = -Math.sin(h.theta), mx = -ny, my = nx;
    const cx = nx * h.d * R, cy = ny * h.d * R, half = Math.sqrt(1 - h.d * h.d) * R;
    svgEl('line', { x1: cx - mx * 125, y1: cy - my * 125, x2: cx + mx * 125, y2: cy + my * 125,
      stroke: 'var(--ink)', 'stroke-width': 3, 'stroke-dasharray': '10 7' }, sv1);
    svgEl('line', { x1: cx - mx * half, y1: cy - my * half, x2: cx + mx * half, y2: cy + my * half,
      stroke: 'var(--accent)', 'stroke-width': 6, 'stroke-linecap': 'round' }, sv1);
    // 切り口：球と同じ大きさの円（点線）と、切り口の円＋直径
    const r = h.k * R;
    svgEl('circle', { r: R, fill: 'none', stroke: 'var(--sub)', 'stroke-width': 2, 'stroke-dasharray': '6 6' }, sv2);
    svgEl('circle', { r, fill: 'var(--cap)', stroke: 'var(--ink)', 'stroke-width': 3 }, sv2);
    svgEl('line', { x1: -r, x2: r, stroke: 'var(--accent)', 'stroke-width': 4 }, sv2);
    svgEl('circle', { r: 4, fill: 'var(--accent)' }, sv2);
    const t = svgEl('text', { y: -14, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 700, fill: 'var(--accent)',
      stroke: 'var(--cap)', 'stroke-width': 6, 'paint-order': 'stroke' }, sv2);
    t.textContent = lenText(h.k);
    const thumbs = $('sThumbs'); thumbs.innerHTML = '';
    st.history.forEach((x, i) => {
      const b = document.createElement('button'); b.className = 'th' + (i === idx ? ' on' : '');
      b.textContent = `${i + 1}`; b.setAttribute('aria-label', `${i + 1}回目`);
      b.addEventListener('click', () => { idx = i; drawSlide(); });
      thumbs.appendChild(b);
    });
    thumbs.children[idx]?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  const go = k => { idx = Math.max(0, Math.min(st.history.length - 1, idx + k)); drawSlide(); };
  $('bSlide').addEventListener('click', () => { idx = Math.max(0, st.history.length - 1); ov.hidden = false; drawSlide(); });
  $('sClose').addEventListener('click', () => { ov.hidden = true; });
  $('sPrev').addEventListener('click', () => go(-1));
  $('sNext').addEventListener('click', () => go(1));
  document.addEventListener('keydown', e => {
    if (ov.hidden) return;
    if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'Escape') ov.hidden = true;
  });
  let sx = null;
  $('sBody').addEventListener('pointerdown', e => { sx = e.clientX; });
  $('sBody').addEventListener('pointerup', e => { if (sx !== null && Math.abs(e.clientX - sx) > 50) go(e.clientX < sx ? 1 : -1); sx = null; });
}
