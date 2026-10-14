// 絵の輪郭（いちばん大きいかたまりの外まわり）を取り出す。純粋な関数だけ。
// 2026-10-14 先生の要望「キラッと光ってほしい。できれば縁を辿るように」。タイトルのロゴの縁を光の粒が一周する演出に使う（views/title.js）。
// 輪郭は絵ごとに違うので、ファイルに持たず、画面を開いたときに絵の透明度から作る。

// 8方向。画像の座標（y は下向き）で時計回り: 東・南東・南・南西・西・北西・北・北東
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/** 透明度の配列（RGBA の4つおき）から 0/1 の型抜きを作る。threshold より不透明な画素を 1 にする */
export function alphaMask(rgba, w, h, threshold = 128) {
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = rgba[i * 4 + 3] > threshold ? 1 : 0;
  return m;
}

/** 型抜きを r 画素ふくらませる（細い切れ目でかたまりが分かれないように） */
export function dilate(mask, w, h, r = 1) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[ny * w + nx] = 1;
        }
      }
    }
  }
  return out;
}

/** いちばん大きいかたまり（8方向でつながる 1 の画素）だけを残した型抜き。1 が無ければ null */
export function largestComponent(mask, w, h) {
  const label = new Int32Array(w * h);
  let best = 0, bestSize = 0, next = 0;
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || label[i]) continue;
    next++;
    let size = 0;
    label[i] = next;
    stack.push(i);
    while (stack.length) {
      const p = stack.pop();
      size++;
      const px = p % w, py = (p - px) / w;
      for (const [dx, dy] of DIRS) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (mask[q] && !label[q]) { label[q] = next; stack.push(q); }
      }
    }
    if (size > bestSize) { bestSize = size; best = next; }
  }
  if (!best) return null;
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = label[i] === best ? 1 : 0;
  return out;
}

/**
 * かたまりの外まわりを、時計回りにたどった画素の中心の列で返す（ムーア近傍の追跡）。
 * mask は1つのかたまりだけを持つこと（largestComponent の戻り値）。空なら []。
 */
export function traceBoundary(mask, w, h) {
  let start = -1;
  for (let i = 0; i < w * h; i++) if (mask[i]) { start = i; break; }
  if (start < 0) return [];
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const sx = start % w, sy = (start - sx) / w;
  const pts = [[sx + 0.5, sy + 0.5]];
  let x = sx, y = sy;
  let from = 5; // 最初の画素は走査で最初に見つけたものなので、西・北西・北・北東は空。北西から探す
  let firstK = -1;
  const limit = 4 * w * h + 8;
  for (let step = 0; step < limit; step++) {
    let k = -1;
    for (let j = 0; j < 8; j++) {
      const d = (from + j) % 8;
      if (at(x + DIRS[d][0], y + DIRS[d][1])) { k = d; break; }
    }
    if (k < 0) return pts; // 1画素だけのかたまり
    // 出発点に戻り、最初と同じ向きに出るなら一周した（Jacob の止め方）
    if (x === sx && y === sy) {
      if (firstK === k) break;
      if (firstK < 0) firstK = k;
    }
    x += DIRS[k][0]; y += DIRS[k][1];
    if (!(x === sx && y === sy)) pts.push([x + 0.5, y + 0.5]);
    // 次は、いま来た向きのすぐ外側（空だと分かっている画素の次）から探す
    from = k % 2 === 0 ? (k + 7) % 8 : (k + 6) % 8;
  }
  return pts;
}

/** 折れ線を間引く（ダグラス・ポイカー）。eps より近い点を落とす。閉じた輪は始点を末尾に足してから渡す */
export function simplify(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    let far = -1, farD = eps;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const d = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > farD) { farD = d; far = i; }
    }
    if (far >= 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/**
 * 透明度の配列から、ロゴの外まわりの SVG の path（d 属性）を作る。かたまりが無ければ ''。
 * rgba … w×h の RGBA（canvas の getImageData().data）
 */
export function outlinePath(rgba, w, h, { threshold = 128, grow = 1, eps = 0.8 } = {}) {
  const comp = largestComponent(dilate(alphaMask(rgba, w, h, threshold), w, h, grow), w, h);
  if (!comp) return '';
  const ring = traceBoundary(comp, w, h);
  if (ring.length < 3) return '';
  const pts = simplify([...ring, ring[0]], eps);
  pts.pop();
  const f = (v) => Math.round(v * 10) / 10;
  return 'M' + pts.map(([x, y]) => f(x) + ' ' + f(y)).join('L') + 'Z';
}
