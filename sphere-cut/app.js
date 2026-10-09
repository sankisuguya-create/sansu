import * as THREE from './three.module.min.js';

/* ---------- 定数 ---------- */
// 選べる球（高さ＝直径）。lenText(k) は「高さ×k」の長さを表す文字列
const SPHERES = [
  { label: '3cm',  H: 3,   bg: 'eraser', text: k => { let v = Math.round(30 * k) / 10; if (k < 1 && v >= 3) v = 2.9; return (Number.isInteger(v) ? v : v.toFixed(1)) + 'cm'; } },
  { label: '1m',   H: 100, bg: 'desk',   text: k => { let v = Math.round(100 * k); if (k < 1 && v >= 100) v = 99; return v === 100 ? '1m' : v + 'cm'; } },
  { label: '300m', H: 300, bg: 'tree',   text: k => Math.min(Math.round(300 * k), k < 1 ? 299 : 300) + 'm' },
];
let SP = SPHERES[0];
// 中心を通らない切り口（k<1）は、四捨五入で高さと同じ数にならないよう1目もり下げる
const lenText = k => SP.text(k);
const SNAP = 0.08;             // まんなかへの吸着幅（球の半径の8%以内なら真ん中にそろえる）
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
   寸法の目安：消しゴム 5.5×2.3×1.1cm（倒して置く）・えんぴつ 太さ約0.7cm／児童机（JIS 4号）高さ64cm・幅60cm／東京スカイツリー 高さ634m・脚部の幅 約68m */
const bgSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
bgSvg.id = 'bg'; stage.insertBefore(bgSvg, stage.firstChild);
function drawBg() {
  bgSvg.innerHTML = '';
  if (!stage.clientWidth) return;
  const k = 2 / SP.H, G = -1;
  const W0 = { eraser: 5.5, desk: 60, tree: 68 }[SP.bg] * k;
  const R = Math.min(-1.3, -halfW + W0 * { eraser: 0.5, desk: 0.5, tree: 0.75 }[SP.bg]);
  const sc = toPx(1, 0)[0] - toPx(0, 0)[0];             // 1単位あたりのpx
  const X = x => toPx(x, 0)[0], Y = y => toPx(0, y)[1];
  const el = (t, a, p = bgSvg) => svgEl(t, a, p);
  // 共通の定義（グラデーション・影）
  bgSvg.insertAdjacentHTML('beforeend', `<defs>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
    <linearGradient id="gRubber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f1f0ec"/><stop offset="1" stop-color="#d9d7d0"/></linearGradient>
    <linearGradient id="gSleeveV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a6fd0"/><stop offset=".5" stop-color="#2b5cc0"/><stop offset="1" stop-color="#1d4596"/></linearGradient>
    <linearGradient id="gWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2bd88"/><stop offset=".6" stop-color="#cfa067"/><stop offset="1" stop-color="#a97a46"/></linearGradient>
    <linearGradient id="gSteelV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7d838b"/><stop offset=".35" stop-color="#d7dbe0"/><stop offset=".6" stop-color="#a3a9b1"/><stop offset="1" stop-color="#5f656d"/></linearGradient>
    <linearGradient id="gSteelH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a9098"/><stop offset=".4" stop-color="#d9dde2"/><stop offset="1" stop-color="#6a7078"/></linearGradient>
    <linearGradient id="gBox" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa0a8"/><stop offset="1" stop-color="#70767e"/></linearGradient>
    <linearGradient id="gDeskTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4ae7a"/><stop offset="1" stop-color="#b8895a"/></linearGradient>
    <linearGradient id="gFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8b98e"/><stop offset="1" stop-color="#c19a68"/></linearGradient>
    <linearGradient id="gCity" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9adb2"/><stop offset="1" stop-color="#8d9298"/></linearGradient>
    <linearGradient id="gTree" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c9d4e0"/><stop offset=".45" stop-color="#f2f6fa"/><stop offset="1" stop-color="#aebccb"/></linearGradient>
  </defs>`);
  const g = el('g', { opacity: .92 });
  // 足元：3cm＝机の天板／1m＝教室の床／300m＝東京の街並み
  // 地面は奥（画面の上）へ続く面として描き、上へ行くほど薄くして背景に溶かす
  const yG = Y(G), Wpx = stage.clientWidth, Hpx = stage.clientHeight;
  const yH = Math.max(0, Y(G + 1.4));                                        // 奥の端（ここで完全に消える）
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  bgSvg.querySelector('defs').insertAdjacentHTML('beforeend', `
    <linearGradient id="gFade" gradientUnits="userSpaceOnUse" x1="0" y1="${yH}" x2="0" y2="${yG}">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".75" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>
    <mask id="mFade" maskUnits="userSpaceOnUse" x="0" y="0" width="${Wpx}" height="${Hpx}">
      <rect x="0" y="${yH}" width="${Wpx}" height="${yG - yH}" fill="url(#gFade)"/>
      <rect x="0" y="${yG}" width="${Wpx}" height="${Hpx - yG + 2}" fill="#fff"/></mask>`);
  const gr = el('g', { mask: 'url(#mFade)' }); bgSvg.insertBefore(gr, g);   // 地面は物の後ろ
  // 奥行き：奥の端 yH から手前へ、間隔が等比で広がる横線の位置
  const depthRows = (n, last) => { const ys = []; for (let i = 0; i <= n; i++) ys.push(yH + (last - yH) * Math.pow(i / n, 1.8)); return ys; };
  if (SP.bg === 'eraser') {
    el('rect', { x: 0, y: yH, width: Wpx, height: Hpx - yH, fill: 'url(#gDeskTop)' }, gr);
    for (const y of depthRows(26, Hpx)) {
      const w = rnd();
      el('path', { d: `M0 ${y} C ${Wpx * .3} ${y - 4 + w * 8}, ${Wpx * .7} ${y + 4 - w * 8}, ${Wpx} ${y}`, stroke: '#8a5d30', 'stroke-width': 1, opacity: .16, fill: 'none' }, gr);
    }
  } else if (SP.bg === 'desk') {
    el('rect', { x: 0, y: yH, width: Wpx, height: Hpx - yH, fill: 'url(#gFloor)' }, gr);
    const ys = depthRows(30, Hpx + 40);
    ys.forEach((y, i) => {
      if (i === ys.length - 1) return;
      const h = Math.max(1, ys[i + 1] - y);
      el('line', { x1: 0, y1: y, x2: Wpx, y2: y, stroke: '#7a5530', 'stroke-width': 1, opacity: .3 }, gr);
      const len = Math.max(60, 120 + h * 14), off = (i % 3) * len / 3;                     // 板の継ぎ目（手前ほど長い）
      for (let x = -off; x < Wpx; x += len)
        el('line', { x1: x, y1: y, x2: x, y2: y + h, stroke: '#7a5530', 'stroke-width': 1, opacity: .25 }, gr);
      if (i % 2) el('rect', { x: 0, y, width: Wpx, height: h, fill: '#fff', opacity: .05 }, gr);
    });
  } else {
    el('rect', { x: 0, y: yH, width: Wpx, height: Hpx - yH, fill: 'url(#gCity)' }, gr);
    // 奥から手前へ、ビルの列を重ねる（奥ほど小さく・淡く）。手前の列は縮尺どおり（高さ10〜60m）
    const rows = depthRows(9, yG);
    rows.forEach((base, i) => {
      const f = Math.max(.12, (base - yH) / (yG - yH));                       // 奥行きによる縮み
      const tone0 = 215 - 25 * f;
      for (let x = -10 - rnd() * 40; x < Wpx; ) {
        const bw = (20 + rnd() * 50) * k * sc * f, bh = (10 + Math.pow(rnd(), 2) * 50) * k * sc * f;
        const tone = tone0 + rnd() * 25 | 0;
        el('rect', { x, y: base - bh, width: Math.max(1, bw - 1), height: bh, fill: `rgb(${tone},${tone + 3},${tone + 8})` }, gr);
        if (f > .6 && bh > 6 && bw > 5) for (let wy = base - bh + 2; wy < base - 2; wy += 3)
          el('rect', { x: x + 1.5, y: wy, width: bw - 4, height: 1, fill: '#7f8ea0', opacity: .4 }, gr);
        x += bw;
      }
    });
    for (let y = yG + 8, h = 4; y < Hpx; y += h * 3, h *= 1.3)               // 手前の道路の帯
      el('rect', { x: 0, y, width: Wpx, height: h, fill: '#e8e6df', opacity: .35 }, gr);
  }
  if (SP.bg === 'eraser') {
    // 机の上に倒れた消しゴムと、奥に置いたえんぴつ（どちらも球と同じ縮尺）
    // 消しゴム 長さ5.5cm・幅2.3cm・厚さ1.1cm／えんぴつ 太さ約0.7cm・削った部分約1.8cm
    // 奥行きは斜め投影：奥へ1cmにつき右へ0.4cm・上へ0.3cm
    const ox = 0.4 * k, oy = 0.3 * k;
    const poly = (pts, fill, extra = {}) => el('polygon', { points: pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' '), fill, ...extra }, g);
    // えんぴつ（手前の机の上）：画面の右下から、先を中央下へ向けて斜めに置く。太さ約0.7cm・削った部分約1.8cm
    {
      const d = 0.72 * k * sc, cone = 1.8 * k * sc, lead = 0.35 * k * sc, len = 2000;
      const tip = toPx(0.35, G - 0.32), ang = 16;                               // 先の位置（球の下端より手前）と傾き
      const pg = el('g', { transform: `translate(${tip[0]},${tip[1]}) rotate(${ang})` }, g);
      const R2 = (x0, y0, x1, y1, fill, o = 1) => el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill, opacity: o }, pg);
      el('rect', { x: cone * .3, y: d * .35, width: len, height: d * .5, fill: '#000', opacity: .18, filter: 'url(#soft)' }, pg);   // 影
      R2(cone, -d / 2, len, -d / 6, '#4d8a5f'); R2(cone, -d / 6, len, d / 6, '#2f6b43'); R2(cone, d / 6, len, d / 2, '#1f4a2e');   // 六角柱の3面
      R2(cone, -d * .42, len, -d * .34, '#fff', .25);                                                     // つや
      el('polygon', { points: `${lead},${-d * .12} ${cone},${-d / 2} ${cone},${d / 2} ${lead},${d * .12}`, fill: '#e3b77e' }, pg);   // 削った木
      el('polygon', { points: `${lead},0 ${cone},0 ${cone},${d / 2} ${lead},${d * .12}`, fill: '#c99659' }, pg);
      el('polygon', { points: `0,0 ${lead},${-d * .12} ${lead},${d * .12}`, fill: '#2b2b2b' }, pg);       // しん
      // 塗装と木のさかいめ（波形）：波の山まで塗装の色で塗る（3面の色に合わせる）
      pg.insertAdjacentHTML('beforeend', `<defs><linearGradient id="gPaint" gradientUnits="userSpaceOnUse" x1="0" y1="${-d / 2}" x2="0" y2="${d / 2}">
        <stop offset="0" stop-color="#4d8a5f"/><stop offset=".333" stop-color="#4d8a5f"/><stop offset=".333" stop-color="#2f6b43"/>
        <stop offset=".667" stop-color="#2f6b43"/><stop offset=".667" stop-color="#1f4a2e"/><stop offset="1" stop-color="#1f4a2e"/></linearGradient></defs>`);
      let wave = `M${cone + 1} ${-d / 2}`; for (let i = 0; i <= 6; i++) wave += ` L${cone - (i % 2 ? d * .12 : 0)} ${-d / 2 + d * i / 6}`;
      el('path', { d: wave + ` L${cone + 1} ${d / 2} Z`, fill: 'url(#gPaint)' }, pg);
    }
    // 消しゴム（手前）
    {
      const L = 5.5 * k, H = 1.1 * k, D = 2.3 * k, dx = D / k * ox, dy = D / k * oy;
      const x1 = R - dx, x0 = x1 - L;
      el('ellipse', { cx: X((x0 + R) / 2), cy: Y(G) + 3, rx: (R - x0) * sc / 2 + 6, ry: 7, fill: '#000', opacity: .2, filter: 'url(#soft)' }, g);
      poly([[x0, G], [x1, G], [x1, G + H], [x0, G + H]], 'url(#gRubber)', { stroke: '#c8c5bc', 'stroke-width': 1 });   // 手前の面
      poly([[x0, G + H], [x1, G + H], [x1 + dx, G + H + dy], [x0 + dx, G + H + dy]], '#fbfaf7', { stroke: '#d6d3cb', 'stroke-width': 1 });   // 上の面
      poly([[x1, G], [x1 + dx, G + dy], [x1 + dx, G + H + dy], [x1, G + H]], '#dcd9d1', { stroke: '#c8c5bc', 'stroke-width': 1 });   // 右の面
      // 紙のケース（長さの14%〜80%）
      const s0 = x0 + L * .14, s1 = x0 + L * .8, pad = 0.02;
      poly([[s0, G - pad], [s1, G - pad], [s1, G + H + pad], [s0, G + H + pad]], '#2b5cc0');
      poly([[s0, G + H + pad], [s1, G + H + pad], [s1 + dx, G + H + dy + pad], [s0 + dx, G + H + dy + pad]], '#4a7ae0');
      for (const f of [.15, .85]) {
        const yy = G + H * f;
        poly([[s0, yy], [s1, yy], [s1, yy + .015], [s0, yy + .015]], '#fff', { opacity: .7 });
      }
      poly([[s0 + dx * .5, G + H + dy * .5 + pad], [s1 + dx * .5, G + H + dy * .5 + pad], [s1 + dx * .5, G + H + dy * .5 + pad + .015], [s0 + dx * .5, G + H + dy * .5 + pad + .015]], '#fff', { opacity: .6 });
      poly([[x0 + 0.03, G + H * .7], [x1 - 0.03, G + H * .7], [x1 - 0.03, G + H * .82], [x0 + 0.03, G + H * .82]], '#fff', { opacity: .5 });   // つや
    }
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
    // 天板（木目）
    el('rect', { x: xl, y: yTop, width: xr - xl, height: yTopB - yTop, rx: 3, fill: 'url(#gWood)' }, g);
    for (let i = 1; i < 4; i++)
      el('path', { d: `M${xl} ${yTop + (yTopB - yTop) * i / 4} C ${xl + (xr - xl) * .3} ${yTop + (yTopB - yTop) * (i / 4 - .15)}, ${xl + (xr - xl) * .6} ${yTop + (yTopB - yTop) * (i / 4 + .15)}, ${xr} ${yTop + (yTopB - yTop) * i / 4}`,
        stroke: '#8a5d30', 'stroke-width': 1, opacity: .35, fill: 'none' }, g);
    el('rect', { x: xl, y: yTop, width: xr - xl, height: 2, fill: '#fff', opacity: .5 }, g);
    el('rect', { x: xl, y: yTopB - 2, width: xr - xl, height: 2, fill: '#6d4a26', opacity: .5 }, g);
    // 右下の床：ドッジボール（直径20cm）となわとび（持ち手15cm、なわは輪にまとめる）
    {
      const [bx, by] = toPx(halfW - 0.5, G - 0.12);            // ボールの接地点
      const br = 10 * k * sc;                                   // 半径10cm
      bgSvg.querySelector('defs').insertAdjacentHTML('beforeend', `
        <radialGradient id="gBall" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#ffd0d6"/><stop offset=".45" stop-color="#e8506a"/><stop offset="1" stop-color="#9c2a3e"/></radialGradient>`);
      // なわとび（ボールの右手前）
      const [rx, ry] = toPx(halfW - 0.22, G - 0.3);
      const rw = 13 * k * sc, rh = rw * .32;
      el('ellipse', { cx: rx, cy: ry + 2, rx: rw + 3, ry: rh + 2, fill: '#000', opacity: .15, filter: 'url(#soft)' }, g);
      for (let i = 0; i < 4; i++)
        el('ellipse', { cx: rx + i * 1.5 - 2, cy: ry - i * 1.2, rx: rw - i * 1.8, ry: rh - i * .7, fill: 'none', stroke: i % 2 ? '#2f7fd0' : '#3b8fe0', 'stroke-width': 2.4 }, g);
      const hl = 15 * k * sc, hw = Math.max(3, 2.5 * k * sc);
      for (const [hx, hy, a] of [[rx - rw * .9, ry + rh * .6, -20], [rx - rw * .2, ry + rh * 1.1, 8]]) {
        const hg = el('g', { transform: `translate(${hx},${hy}) rotate(${a})` }, g);
        el('rect', { x: -hl / 2, y: -hw / 2, width: hl, height: hw, rx: hw / 2, fill: '#f2c230', stroke: '#c79a12', 'stroke-width': 1 }, hg);
        el('rect', { x: -hl / 2 + hl * .15, y: -hw / 2 + 1, width: hl * .6, height: hw * .3, rx: 1, fill: '#fff', opacity: .5 }, hg);
      }
      // ドッジボール
      el('ellipse', { cx: bx, cy: by + 2, rx: br * 1.1, ry: br * .28, fill: '#000', opacity: .22, filter: 'url(#soft)' }, g);
      el('circle', { cx: bx, cy: by - br, r: br, fill: 'url(#gBall)' }, g);
      el('path', { d: `M${bx - br * .95} ${by - br * 1.15} Q ${bx} ${by - br * .55} ${bx + br * .95} ${by - br * 1.15}`, stroke: '#7d1f30', 'stroke-opacity': .5, 'stroke-width': 1.2, fill: 'none' }, g);   // 表面の溝
      el('path', { d: `M${bx - br * .2} ${by - br * 1.98} Q ${bx + br * .35} ${by - br} ${bx - br * .2} ${by - br * .02}`, stroke: '#7d1f30', 'stroke-opacity': .45, 'stroke-width': 1.2, fill: 'none' }, g);
    }
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
   300m：大きな構造物。たくさんの板（パネル）を継ぎ合わせた面。板ごとのわずかな色むら・継ぎ目・
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
// 真ん中に合ったときの印（球の中心の点と「まんなか」）
const kCenter = svgEl('g', { 'pointer-events': 'none' });
svgEl('circle', { r: 7, fill: '#1f4fd1', stroke: '#fff', 'stroke-width': 3 }, kCenter);
const kCTxt = svgEl('text', { y: -16, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, fill: '#1f4fd1',
  stroke: '#fff', 'stroke-width': 5, 'paint-order': 'stroke' }, kCenter);
kCTxt.textContent = 'まんなか';
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
  const atC = st.d === 0;
  kLine.setAttribute('stroke', atC ? '#1f4fd1' : '#111');
  kLine.setAttribute('stroke-width', atC ? 6 : 4);
  if (!kCenter.parentNode) kG.insertBefore(kCenter, kHit);
  kCenter.style.display = atC ? '' : 'none';
  const [ox, oy] = toPx(0, 0); kCenter.setAttribute('transform', `translate(${ox},${oy})`);
  $('gPos').classList.toggle('at-center', atC);
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
// snap：スライダーで動かしたときだけ真ん中に吸着させる。
// 線のドラッグや2点指定では吸着させない（極を通るが中心を外れた線を、真ん中扱いにしないため）
function setD(d, snap = false) {
  d = Math.max(-0.97, Math.min(0.97, d));
  if (snap && Math.abs(d) < SNAP) d = 0;
  else if (!snap && Math.abs(d) < 0.003) d = 0;
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

$('pos').addEventListener('input', e => setD(+e.target.value / 100, true));
$('toCenter').addEventListener('click', () => { if (!st.cut) setD(0); });
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
// 選択カードの球：本体と同じ虹色・北が白、質感も本体に合わせる（3cm＝つや、1m＝つや消し、300m＝板の継ぎ目）
function cardSvg(i, bg) {
  const id = 'c' + i, cx = 8, r = 50;
  let extra = '';
  if (bg === 'eraser') {
    extra = `<ellipse cx="${cx}" cy="4" rx="${r}" ry="9" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="1.2"/>
      <ellipse cx="${cx - 16}" cy="-24" rx="10" ry="7" fill="#fff" opacity=".95" transform="rotate(-25 ${cx - 16} -24)"/>
      <circle cx="${cx - 16}" cy="-24" r="3" fill="#fff"/>`;
  } else if (bg === 'tree') {
    let lines = '';
    for (const y of [-38, -24, -10, 4, 18, 32]) { const rx = Math.sqrt(r * r - y * y); lines += `<ellipse cx="${cx}" cy="${y + 4}" rx="${rx}" ry="${rx * .18}" fill="none" stroke="#283040" stroke-opacity=".55" stroke-width="${y === 4 ? 2.2 : 1}"/>`; }
    for (const rx of [12, 26, 38, 47]) lines += `<ellipse cx="${cx}" cy="0" rx="${rx}" ry="${r}" fill="none" stroke="#283040" stroke-opacity=".5" stroke-width="${rx === 26 ? 2 : 1}"/>`;
    lines += `<line x1="${cx}" y1="${-r}" x2="${cx}" y2="${r}" stroke="#283040" stroke-opacity=".55" stroke-width="2"/>`;
    extra = `<g clip-path="url(#${id}clip)">${lines}<rect x="${cx - r}" y="${-r}" width="${2 * r}" height="${2 * r}" fill="url(#${id}panel)" opacity=".35"/></g>
      <circle cx="${cx}" r="${r}" fill="#b9c3d2" opacity=".18"/>`;
  }
  return `<svg viewBox="-80 -64 160 128" aria-hidden="true">
    <defs>
      <linearGradient id="${id}rb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f9a85"/><stop offset=".35" stop-color="#b4a64c"/><stop offset=".65" stop-color="#e09a5c"/><stop offset="1" stop-color="#d7738a"/></linearGradient>
      <linearGradient id="${id}wh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <radialGradient id="${id}sh" cx="42%" cy="38%" r="65%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${bg === 'eraser' ? .35 : .28}"/></radialGradient>
      <clipPath id="${id}clip"><circle cx="${cx}" r="${r}"/></clipPath>
      <pattern id="${id}panel" width="6" height="5" patternUnits="userSpaceOnUse"><rect width="6" height="5" fill="none" stroke="#283040" stroke-width=".6"/></pattern>
    </defs>
    <line x1="-62" y1="-50" x2="0" y2="-50" stroke="#1f4fd1" stroke-width="2" stroke-dasharray="4 4"/>
    <line x1="-62" y1="50" x2="0" y2="50" stroke="#1f4fd1" stroke-width="2" stroke-dasharray="4 4"/>
    <circle cx="${cx}" r="${r}" fill="url(#${id}rb)"/>
    <circle cx="${cx}" r="${r}" fill="url(#${id}wh)"/>
    ${extra}
    <circle cx="${cx}" r="${r}" fill="url(#${id}sh)"/>
    <line x1="-58" y1="-50" x2="-58" y2="50" stroke="#1f4fd1" stroke-width="3" stroke-dasharray="7 5"/>
  </svg>`;
}
const picker = document.createElement('div'); picker.id = 'picker';
picker.innerHTML = '<h2>どの球を切る？</h2><div class="pk-row"></div>';
SPHERES.forEach((sp, i) => {
  const b = document.createElement('button'); b.className = 'pk';
  b.innerHTML = cardSvg(i, sp.bg) + `<span class="pk-n">${i + 1}</span><span class="pk-t">高さ ${sp.label}</span>`;
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
