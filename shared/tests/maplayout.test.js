// 冒険の地図: 道と印の位置の計算、表示の設定、CSS・画面・オフライン登録との突き合わせ。
// 実行: cd shared && node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAP_VIEWS, DEFAULT_MAP_VIEW, normalizeMapView, mapLayout,
  MAP_DOT, MAP_STEP, MAP_LANES, MAP_WOBBLE, MAP_LABEL_GAP, MAP_LABEL_TO_NODE,
} from '../js/lib/maplayout.js';
import { defaultState, mergeState } from '../js/lib/progress.js';
import { createStorage } from '../js/lib/storage.js';
import { parseBackup, serializeBackup } from '../js/lib/backup.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(shared, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// 本物の資格の分野ごとの章の数
const G = [8, 2]; // G検定: 技術分野8章 + 法律・倫理分野2章（10章）
const DX = [4, 4, 4]; // DX: 3分野×4章（12章）
const cases = { G, DX, 一章だけ: [1], 章なし: [0], 分野なし: [], 空の分野がまざる: [0, 3, 0, 2], 一分野に多い: [30] };
const groupsOf = (counts) => counts.map((count) => ({ count }));

test('印の数: 章の数と同じ。通し番号は 0 から、下（y が大きい）から上へ進む', () => {
  for (const [name, counts] of Object.entries(cases)) {
    const lay = mapLayout(groupsOf(counts));
    const total = counts.reduce((a, b) => a + b, 0);
    assert.equal(lay.nodes.length, total, name);
    lay.nodes.forEach((n, i) => assert.equal(n.index, i, name));
    for (let i = 1; i < lay.nodes.length; i++) assert.ok(lay.nodes[i].y < lay.nodes[i - 1].y, name + ': 上へ進む');
  }
  assert.equal(mapLayout(groupsOf(G)).nodes.length, 10);
  assert.equal(mapLayout(groupsOf(DX)).nodes.length, 12);
});

test('章が1つ・0・分野なしでも壊れない（高さは正、道は無いか有限の数だけ）', () => {
  for (const bad of [undefined, null, 'x', 5, {}]) assert.deepEqual(mapLayout(bad).nodes, []);
  for (const [name, counts] of Object.entries(cases)) {
    const lay = mapLayout(groupsOf(counts));
    assert.ok(lay.height > 0 && Number.isFinite(lay.height), name);
    if (!lay.nodes.length) {
      assert.equal(lay.path, '', name);
      assert.deepEqual(lay.labels, [], name);
    } else {
      assert.match(lay.path, /^M [-0-9. ]+( C [-0-9., ]+)+$/, name);
      assert.ok(!/NaN|Infinity/.test(lay.path), name);
    }
  }
  const one = mapLayout(groupsOf([1]));
  assert.equal(one.nodes.length, 1);
  assert.equal(one.labels.length, 1);
  // 章の数が正の整数でないものは、章なしとして数える
  assert.equal(mapLayout([{ count: -2 }, { count: 1.5 }, { count: '3' }, null, { count: 2 }]).nodes.length, 2);
});

test('印どうしが重ならない（縦の間隔が印の直径より広い）。名札の置き場も確保する', () => {
  for (const [name, counts] of Object.entries(cases)) {
    const lay = mapLayout(groupsOf(counts));
    for (let i = 0; i < lay.nodes.length; i++) {
      for (let j = i + 1; j < lay.nodes.length; j++) {
        const dy = Math.abs(lay.nodes[i].y - lay.nodes[j].y);
        assert.ok(dy >= MAP_DOT + 1, name + ' 印 ' + i + ' と ' + j + ' が近い: ' + dy);
      }
    }
    for (let i = 1; i < lay.nodes.length; i++) {
      if (lay.nodes[i].group === lay.nodes[i - 1].group) {
        assert.ok(lay.nodes[i - 1].y - lay.nodes[i].y >= MAP_STEP - 0.01, name + ': 同じ分野の印の間隔');
      }
    }
    // 札と印も重ならない
    for (const lb of lay.labels) {
      for (const n of lay.nodes) assert.ok(Math.abs(lb.y - n.y) >= MAP_DOT / 2 + 2, name + ': 札と印');
    }
  }
});

test('すべてが地図の中に収まる: x は幅の内側（印の半径ぶんの余白）、y は 0 から高さまで', () => {
  const lo = Math.min(...MAP_LANES) - MAP_WOBBLE;
  const hi = Math.max(...MAP_LANES) + MAP_WOBBLE;
  // 幅 320px・とても大きい文字（20.8px/rem）でも、印（半径 2.25rem）が外にはみ出さない
  const radiusRate = (MAP_DOT / 2 * 20.8) / 320;
  assert.ok(lo > radiusRate, '左の余白 ' + lo + ' > ' + radiusRate);
  assert.ok(1 - hi > radiusRate, '右の余白');
  for (const [name, counts] of Object.entries(cases)) {
    const lay = mapLayout(groupsOf(counts));
    for (const n of lay.nodes) {
      assert.ok(n.x >= lo - 1e-9 && n.x <= hi + 1e-9, name + ' x=' + n.x);
      assert.ok(n.y > MAP_DOT / 2 && n.y < lay.height - MAP_DOT / 2, name + ' y=' + n.y);
    }
    for (const lb of lay.labels) assert.ok(lb.y > 0 && lb.y < lay.height, name);
    assert.equal(lay.viewBox, '0 0 100 ' + lay.height);
  }
});

test('左右の道筋を交互に通り、名札は中央側に出る（左の印は右へ、右の印は左へ）', () => {
  const lay = mapLayout(groupsOf(DX));
  lay.nodes.forEach((n, i) => {
    assert.equal(n.side, i % 2 === 0 ? 'right' : 'left');
    if (i % 2 === 0) assert.ok(n.x < 0.5, '偶数番目は左');
    else assert.ok(n.x > 0.5, '奇数番目は右');
  });
});

test('分野の見出し: 章のある分野ごとに1枚。その分野の最初の印の下、前の分野の最後の印の上にある', () => {
  const lay = mapLayout(groupsOf(DX));
  assert.deepEqual(lay.labels.map((l) => l.group), [0, 1, 2]);
  for (const lb of lay.labels) {
    const mine = lay.nodes.filter((n) => n.group === lb.group);
    const first = mine[0];
    assert.ok(lb.y > first.y, '見出しは最初の印より下（先に目に入る）');
    assert.ok(lb.y - first.y >= MAP_LABEL_TO_NODE - 0.01);
    const prev = lay.nodes.filter((n) => n.group < lb.group).pop();
    if (prev) {
      assert.ok(lb.y < prev.y, '見出しは前の分野の最後の印より上');
      assert.ok(prev.y - lb.y >= MAP_LABEL_GAP - 0.01);
    }
  }
  // 空の分野には見出しを出さない。group は元の並びの番号のまま
  assert.deepEqual(mapLayout(groupsOf([0, 3, 0, 2])).labels.map((l) => l.group), [1, 3]);
  assert.deepEqual(mapLayout(groupsOf([0, 3, 0, 2])).nodes.map((n) => n.group), [1, 1, 1, 3, 3]);
});

test('同じ入力なら同じ結果（乱数を使わない）。入力を書き換えない', () => {
  const g = groupsOf(DX);
  const snap = JSON.stringify(g);
  assert.deepEqual(mapLayout(g), mapLayout(groupsOf(DX)));
  assert.equal(JSON.stringify(g), snap);
});

test('道: 印の中心をすべて通る（パスの終点に各印の座標がある）', () => {
  const lay = mapLayout(groupsOf(G));
  const ends = [...lay.path.matchAll(/, ([-0-9.]+) ([-0-9.]+)(?= C|$)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  for (const n of lay.nodes) {
    assert.ok(ends.some(([x, y]) => Math.abs(x - n.x * 100) < 0.011 && Math.abs(y - n.y) < 0.011), '印 ' + n.index);
  }
});

test('表示の設定: 2つ、初期は地図。正規化・保存データ・保存と読み出し・書き出しで保たれる', () => {
  assert.deepEqual(MAP_VIEWS, ['map', 'list']);
  assert.equal(DEFAULT_MAP_VIEW, 'map');
  for (const k of MAP_VIEWS) assert.equal(normalizeMapView(k), k);
  for (const bad of [undefined, null, '', 'grid', 'MAP', ' list', 1, true, {}, [], ['list'], '__proto__', 'toString']) assert.equal(normalizeMapView(bad), 'map', String(bad));
  assert.equal(defaultState().settings.mapView, 'map');
  assert.equal(mergeState({ settings: { theme: 'dark' } }).settings.mapView, 'map', '古い記録（項目なし）');
  assert.equal(mergeState(null).settings.mapView, 'map');
  assert.equal(mergeState({ settings: { mapView: 'list' } }).settings.mapView, 'list');
  assert.equal(mergeState({ settings: { mapView: 'bad' } }).settings.mapView, 'map');
  const mem = new Map();
  const fake = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const st = createStorage('k', fake);
  const s = st.load();
  s.settings.mapView = 'list';
  st.save(s);
  assert.equal(createStorage('k', fake).load().settings.mapView, 'list');
  const out = parseBackup(serializeBackup('x', s, new Date('2026-10-05T00:00:00Z')), 'x');
  assert.equal(out.ok, true);
  assert.equal(out.state.settings.mapView, 'list');
});

test('画面: 切り替え・保存・自動スクロール・背景の絵（mapImage）・一覧の残し方', () => {
  const home = read('shared/js/views/home.js');
  assert.match(home, /mapLayout\(/);
  assert.match(home, /state\.settings\.mapView\s*=/, '選んだ表示を保存する');
  assert.match(home, /app\.commit\(\)/);
  assert.match(home, /'一覧で見る'/);
  assert.match(home, /config\.mapImage/, '背景の絵は config.json の mapImage から');
  assert.match(home, /scrollIntoView/, 'いまいる章へ自動で動く');
  assert.match(home, /suggestStage\(data\.tree\.stages/, 'いまいる所は、ホームの「次の章」と同じ考え方');
  assert.match(home, /characterImg\('shiba-/, 'いまいる所にサニー');
  assert.match(home, /details/, '一覧の表示（大項目ごとに開閉）を残している');
  assert.match(home, /'#\/stage\/'/, '印を押すとステージへ');
  assert.doesNotMatch(home, /\.style\.(?!setProperty)[a-zA-Z]+\s*=/, 'style の直接代入をしない（CSS 変数だけ）');
});

test('CSS: 動きを減らす設定で止まる。文字は rem（px 直書きなし）。押せる印は 48px 以上', () => {
  const css = read('shared/css/app.css');
  assert.match(css, /prefers-reduced-motion: reduce\)\s*\{\s*\*, \*::before, \*::after \{ animation: none !important/);
  const block = css.slice(css.indexOf('/* ---- 冒険の地図'), css.indexOf('/* ---- 出題 ---- */'));
  assert.ok(block.length > 500);
  assert.equal(/font-size:\s*[0-9.]+px/.test(block), false);
  assert.match(block, /\.map-dot[\s\S]*?width: 4\.5rem; height: 4\.5rem/);
  assert.equal(MAP_DOT, 4.5);
  assert.ok(MAP_DOT * 14.4 >= 48, '一番小さい文字の設定（14.4px）でも48px以上');
  for (const k of ['map-pop', 'map-pulse', 'map-hop']) assert.match(block, new RegExp('@keyframes ' + k));
  assert.match(block, /\.map-switch-btn \{[^}]*min-height: 48px/);
  // 背景の絵が無い間はグラデーション。絵は object-fit で敷く
  assert.match(block, /linear-gradient\(to top/);
  assert.match(block, /\.map-bg \{[^}]*object-fit: cover/);
});

test('オフライン登録と版: maplayout.js を登録。両アプリの版は33以上。絵が無い間は appFiles に map.webp を入れない', () => {
  assert.match(read('shared/sw-core.js'), /shared\/js\/lib\/maplayout\.js/);
  assert.match(read('shared/package.json'), /tests\/maplayout\.test\.js/);
  for (const a of ['g-kentei', 'dx-biz']) {
    const sw = read(a + '/sw.js');
    const v = sw.match(/version:\s*'(\d+)'/);
    assert.ok(v && Number(v[1]) >= 33, a + ' の version は 33 以上');
    // 絵（images/map.webp）を置いたら、config.json に mapImage を足し、appFiles に './images/map.webp' を足す（要件定義書 §6「冒険の地図」）。
    // 置いていないのに入れると、インストールが404で失敗する。置いたのに入れないと、オフラインで絵が出ない。
    const present = existsSync(join(root, a, 'images', 'map.webp'));
    const cfg = JSON.parse(read(a + '/config.json'));
    assert.equal(sw.includes("'./images/map.webp'"), present, a + ': 絵があるときだけ appFiles に入れる');
    assert.equal(typeof cfg.mapImage === 'string', present, a + ': 絵があるときだけ config.json に mapImage');
  }
});

test('要件定義書に、冒険の地図の要件がある', () => {
  const doc = read('docs/01_要件定義/要件定義書.md');
  assert.match(doc, /冒険の地図/);
  assert.match(doc, /mapImage/);
  assert.match(doc, /images\/map\.webp/);
});
