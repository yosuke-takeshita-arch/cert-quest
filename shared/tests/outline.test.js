// lib/outline.js（ロゴの縁を光の粒がたどる演出の、輪郭の取り出し）の検証
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alphaMask, dilate, largestComponent, traceBoundary, simplify, outlinePath } from '../js/lib/outline.js';

// 文字の絵から型抜きを作る（# が 1）
function grid(rows) {
  const h = rows.length, w = rows[0].length;
  const m = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => { m[y * w + x] = c === '#' ? 1 : 0; }));
  return { m, w, h };
}
const centers = (list) => list.map(([x, y]) => [x - 0.5, y - 0.5]);

test('traceBoundary: 3×3 の四角は、左上から時計回りに外まわりの8画素をたどり、中の画素は通らない', () => {
  const { m, w, h } = grid(['.....', '.###.', '.###.', '.###.', '.....']);
  assert.deepEqual(centers(traceBoundary(m, w, h)), [[1, 1], [2, 1], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [1, 2]]);
});

test('traceBoundary: へこんだ形（L字）でも、外まわりの画素を全部たどって出発点の手前で止まる', () => {
  const { m, w, h } = grid(['......', '.#....', '.#....', '.####.', '......']);
  const pts = centers(traceBoundary(m, w, h));
  const key = (p) => p.join(',');
  const all = new Set([[1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3]].map(key));
  assert.deepEqual(new Set(pts.map(key)), all);
  assert.deepEqual(pts[0], [1, 1]);
  // 隣り合う点はどれも8方向の隣（飛ばない）
  for (let i = 1; i < pts.length; i++) assert.ok(Math.max(Math.abs(pts[i][0] - pts[i - 1][0]), Math.abs(pts[i][1] - pts[i - 1][1])) === 1, String(pts[i]));
});

// 穴の無いかたまりなら、外まわり＝「上下左右のどれかが空か画像の外」の画素の全部
function edgeSet(m, w, h) {
  const s = new Set();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m[y * w + x]) continue;
    const empty = (nx, ny) => nx < 0 || ny < 0 || nx >= w || ny >= h || !m[ny * w + nx];
    if (empty(x + 1, y) || empty(x - 1, y) || empty(x, y + 1) || empty(x, y - 1)) s.add(x + ',' + y);
  }
  return s;
}
for (const [name, rows] of [
  ['ひし形', ['.......', '...#...', '..###..', '.#####.', '..###..', '...#...', '.......']],
  ['階段とでっぱり', ['........', '.#......', '.##..#..', '.###.##.', '.######.', '..#..#..', '........']],
  ['斜めにつながる形', ['......', '.#....', '..#...', '...##.', '..#...', '......']],
]) {
  test(`traceBoundary: ${name}でも、外まわりの画素を全部、隣どうしでたどる`, () => {
    const { m, w, h } = grid(rows);
    const pts = centers(traceBoundary(m, w, h));
    assert.deepEqual(new Set(pts.map((p) => p.join(','))), edgeSet(m, w, h));
    for (let i = 1; i < pts.length; i++) assert.ok(Math.max(Math.abs(pts[i][0] - pts[i - 1][0]), Math.abs(pts[i][1] - pts[i - 1][1])) === 1, String(pts[i]));
  });
}

test('traceBoundary: 画素が1つなら1点、空なら空', () => {
  const one = grid(['...', '.#.', '...']);
  assert.deepEqual(centers(traceBoundary(one.m, one.w, one.h)), [[1, 1]]);
  const none = grid(['...', '...']);
  assert.deepEqual(traceBoundary(none.m, none.w, none.h), []);
});

test('largestComponent: 大きいかたまりだけを残す。1 が無ければ null', () => {
  const { m, w, h } = grid(['##....', '##..##', '....##', '....##']);
  const c = largestComponent(m, w, h);
  assert.equal(c.reduce((s, v) => s + v, 0), 6);
  assert.equal(c[0], 0);
  assert.equal(c[1 * w + 4], 1);
  assert.equal(largestComponent(new Uint8Array(4), 2, 2), null);
});

test('dilate: 1画素の切れ目をふさいで、2つのかたまりを1つにする', () => {
  const { m, w, h } = grid(['.......', '.##.##.', '.......']);
  assert.equal(largestComponent(m, w, h).reduce((s, v) => s + v, 0), 2);
  const d = dilate(m, w, h, 1);
  assert.equal(largestComponent(d, w, h).reduce((s, v) => s + v, 0), d.reduce((s, v) => s + v, 0));
});

test('simplify: まっすぐな線は両端だけになり、角は残る', () => {
  assert.deepEqual(simplify([[0, 0], [1, 0], [2, 0], [3, 0]], 0.5), [[0, 0], [3, 0]]);
  assert.deepEqual(simplify([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], 0.5), [[0, 0], [2, 0], [2, 2]]);
});

test('alphaMask・outlinePath: 円の絵から閉じた path を作り、点は円のまわり（ふくらませた分の内側）に乗る。透明なら空', () => {
  const w = 40, h = 30, cx = 20, cy = 15, r = 10;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) rgba[(y * w + x) * 4 + 3] = 255;
  assert.equal(alphaMask(rgba, w, h).reduce((s, v) => s + v, 0) > 250, true);
  const d = outlinePath(rgba, w, h);
  assert.match(d, /^M[\d. ]+(L[\d. ]+)+Z$/);
  const nums = d.slice(1, -1).split('L').map((s) => s.split(' ').map(Number));
  assert.ok(nums.length >= 8, '点が少なすぎる: ' + nums.length);
  for (const [x, y] of nums) {
    const dist = Math.hypot(x - cx, y - cy);
    assert.ok(dist > r - 1.5 && dist < r + 2.5, `円から外れた点 ${x},${y}（中心から ${dist.toFixed(2)}）`);
  }
  assert.equal(outlinePath(new Uint8ClampedArray(w * h * 4), w, h), '');
});
