// グループ（details）の開け閉めの動き（要件定義書 §6-6、2026-10-25 先生の要望）の検証。
// 見ているもの: 動きの形（行き過ぎの量・秒数）、開く/閉じる/連打/動きを減らす設定、終わると高さの指定が残らない、
//   全部の details に効く配線（app.js・sw-core・css）、クラスだけで動かす（CSP）
// 見ていないもの: 実際の見た目（Playwright で撮って目で見る）、iPhone の Safari での描画
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installExpand, overshoot, openFrames, closeFrames, EXPAND_MS } from '../js/lib/expand.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

const px = (s) => Number(String(s).replace('px', ''));

test('overshoot: 伸びる量の 5%、6〜16px に収まる。伸びないときは 0', () => {
  assert.equal(overshoot(50, 50), 0);
  assert.equal(overshoot(80, 40), 0);
  assert.equal(overshoot(50, 90), 6); // 40 の 5% = 2 → 下限 6
  assert.equal(overshoot(0, 200), 10);
  assert.equal(overshoot(0, 5000), 16); // 上限
});

test('openFrames: 行き過ぎて戻る（頂点は目標より大きく、最後は目標ちょうど）。closeFrames: 行き過ぎなし', () => {
  const f = openFrames(56, 456);
  assert.equal(f.length, 3);
  assert.equal(px(f[0].height), 56);
  assert.ok(px(f[1].height) > 456 && px(f[1].height) <= 456 + 16);
  assert.equal(px(f[2].height), 456);
  assert.ok(f[1].offset > 0 && f[1].offset < 1);
  const c = closeFrames(456, 56);
  assert.equal(c.length, 2);
  assert.equal(px(c[0].height), 456);
  assert.equal(px(c[1].height), 56);
  assert.ok(EXPAND_MS.open >= 300 && EXPAND_MS.open <= 500, '開く 0.3〜0.5 秒');
  assert.ok(EXPAND_MS.close < EXPAND_MS.open);
});

// 偽の document / details。高さ: 閉じていれば 50、開いていれば 50 + 中身 300。動いている最中は animate の「いまの高さ」。
function fake({ reduce = false, canAnimate = true } = {}) {
  let handler = null;
  const doc = {
    addEventListener(type, fn, cap) { assert.equal(type, 'click'); assert.equal(cap, true, '先に捕まえる（capture）'); handler = fn; },
    removeEventListener(type, fn) { if (handler === fn) handler = null; },
  };
  const win = { matchMedia: (q) => ({ matches: reduce && q.includes('prefers-reduced-motion') }) };
  const makeDetails = () => {
    const cls = new Set();
    const det = {
      localName: 'details', open: false, cls, current: null, animations: [],
      classList: {
        add(...a) { a.forEach((c) => cls.add(c)); },
        remove(...a) { a.forEach((c) => cls.delete(c)); },
        toggle(c, on) { if (on) cls.add(c); else cls.delete(c); },
        contains(c) { return cls.has(c); },
      },
      getBoundingClientRect() {
        if (det.current && det.current.height !== null) return { height: det.current.height };
        return { height: det.open ? 350 : 50 };
      },
      animate: canAnimate ? function (frames, opts) {
        const anim = { frames, opts, height: null, onfinish: null, cancelled: false, cancel() { this.cancelled = true; if (det.current === this) det.current = null; } };
        det.current = anim;
        det.animations.push(anim);
        return anim;
      } : undefined,
    };
    const sum = {
      parentNode: det, contains(x) { return x === sum; },
      closest(sel) { return sel === 'summary' ? sum : null; },
    };
    det.sum = sum;
    return det;
  };
  const click = (det, target) => {
    const t = target || det.sum;
    const e = { target: t, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    handler(e);
    return e;
  };
  return { doc, win, makeDetails, click, get handler() { return handler; } };
}

test('開く: 本来の挙動を止めて animate（閉じた高さ→中身の高さ、行き過ぎあり）。終わると open のまま・指定も class も残らない', () => {
  const f = fake();
  installExpand(f.doc, f.win);
  const det = f.makeDetails();
  const e = f.click(det);
  assert.equal(e.defaultPrevented, true);
  assert.equal(det.open, true);
  assert.equal(det.animations.length, 1);
  const a = det.animations[0];
  assert.equal(px(a.frames[0].height), 50);
  assert.equal(px(a.frames[2].height), 350);
  assert.ok(px(a.frames[1].height) > 350);
  assert.equal(a.opts.duration, EXPAND_MS.open);
  assert.equal(a.opts.fill, 'forwards');
  assert.ok(det.cls.has('is-expanding'));
  assert.ok(!det.cls.has('is-closing'));
  a.onfinish();
  assert.equal(det.open, true);
  assert.equal(det.cls.size, 0, 'class が残らない');
  assert.equal(a.cancelled, true, 'fill で残した高さの指定を外す');
});

test('閉じる: 動いている間は open のまま（中身が見える）、終わって open が外れる。矢印は最初から戻す', () => {
  const f = fake();
  installExpand(f.doc, f.win);
  const det = f.makeDetails();
  det.open = true;
  f.click(det);
  const a = det.animations[0];
  assert.equal(det.open, true, '縮んでいる間は開いたまま');
  assert.ok(det.cls.has('is-closing'));
  assert.equal(px(a.frames[0].height), 350);
  assert.equal(px(a.frames[1].height), 50);
  assert.equal(a.opts.duration, EXPAND_MS.close);
  a.onfinish();
  assert.equal(det.open, false);
  assert.equal(det.cls.size, 0);
  assert.equal(a.cancelled, true);
});

test('連打: 開く途中で押すと、そのときの高さから閉じる向きへ。前の動きの終わりの処理は何もしない', () => {
  const f = fake();
  installExpand(f.doc, f.win);
  const det = f.makeDetails();
  f.click(det); // 開く
  const first = det.animations[0];
  first.height = 200; // 途中の高さ
  f.click(det); // 逆向き
  assert.equal(det.animations.length, 2);
  assert.equal(first.cancelled, true);
  assert.equal(first.onfinish, null, '前の動きの終わりは外す');
  const second = det.animations[1];
  assert.equal(px(second.frames[0].height), 200, '途中の高さから');
  assert.equal(px(second.frames[1].height), 50);
  assert.ok(det.cls.has('is-closing'));
  second.height = 120;
  f.click(det); // また開く向き
  const third = det.animations[2];
  assert.equal(px(third.frames[0].height), 120);
  assert.equal(px(third.frames[third.frames.length - 1].height), 350);
  assert.ok(!det.cls.has('is-closing'));
  third.onfinish();
  assert.equal(det.open, true);
  assert.equal(det.cls.size, 0);
});

test('動きを減らす設定・animate が無い環境: 何もせず（本来の挙動に任せる）。高さの変わらないときは動かさず確定', () => {
  for (const opt of [{ reduce: true }, { canAnimate: false }]) {
    const f = fake(opt);
    installExpand(f.doc, f.win);
    const det = f.makeDetails();
    const e = f.click(det);
    assert.equal(e.defaultPrevented, false, JSON.stringify(opt));
    assert.equal(det.open, false);
    assert.equal(det.animations.length, 0);
  }
  // 中身が空で高さが変わらない
  const f = fake();
  installExpand(f.doc, f.win);
  const det = f.makeDetails();
  det.getBoundingClientRect = () => ({ height: 50 });
  f.click(det);
  assert.equal(det.animations.length, 0);
  assert.equal(det.open, true);
  assert.equal(det.cls.size, 0);
});

test('summary の外・見出しの中のボタンは対象にしない。見張りは外せる', () => {
  const f = fake();
  const off = installExpand(f.doc, f.win);
  const det = f.makeDetails();
  // summary の外のクリック
  const e1 = { target: { closest: () => null }, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  f.handler(e1);
  assert.equal(e1.defaultPrevented, false);
  // 見出しの中のボタン
  const btn = { closest: (sel) => (sel === 'summary' ? det.sum : btn) };
  det.sum.contains = (x) => x === btn || x === det.sum;
  const e2 = { target: btn, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  f.handler(e2);
  assert.equal(e2.defaultPrevented, false);
  assert.equal(det.animations.length, 0);
  off();
  assert.equal(f.handler, null);
});

test('入れ子: 外側と内側のそれぞれが、自分の details だけを動かす', () => {
  const f = fake();
  installExpand(f.doc, f.win);
  const outer = f.makeDetails();
  const inner = f.makeDetails();
  f.click(outer);
  f.click(inner);
  assert.equal(outer.animations.length, 1);
  assert.equal(inner.animations.length, 1);
  outer.animations[0].onfinish();
  assert.equal(outer.cls.size, 0);
  assert.ok(inner.cls.has('is-expanding'), '内側の動きは外側の終わりに巻き込まれない');
});

test('配線: app.js が起動時に1回だけ見張りを足す。sw-core に載る。css は動いている間だけはみ出しを隠し、矢印は is-closing で戻る', () => {
  const app = read('../js/app.js');
  assert.match(app, /import \{ installExpand \} from '\.\/lib\/expand\.js';/);
  assert.equal(app.split('installExpand(document, window)').length - 1, 1);
  assert.match(read('../sw-core.js'), /'\.\.\/shared\/js\/lib\/expand\.js'/);
  const css = read('../css/app.css');
  assert.match(css, /details\.is-expanding \{ overflow: hidden; \}/);
  assert.match(css, /\.card-major\[open\]:not\(\.is-closing\) > summary::before/);
  assert.match(css, /details\.card-sub\[open\]:not\(\.is-closing\) > summary::before/);
});

test('全部の details に効く: 見張りは document に1つ。画面側に個別の開け閉めの処理を書いていない', () => {
  const src = read('../js/lib/expand.js');
  assert.match(src, /doc\.addEventListener\('click', onClick, true\)/);
  // CSP（style-src 'self'）に触れない: 高さは animate の指定だけで、要素に style を書かない（開いた後に高さが残らない）
  assert.ok(!/\.style\b|setAttribute\('style'|cssText/.test(src.replace(/\/\/.*$/gm, '')));
  assert.match(src, /fill: 'forwards'/);
  assert.match(src, /anim\.cancel\(\)/);
  // Safari で使えないものは使わない
  assert.ok(!/details-content|interpolate-size/.test(src.replace(/\/\/.*$/gm, '')));
  // views の details は、どれも summary を持つ素の details（独自の開け閉めを足していない）
  const dir = fileURLToPath(new URL('../js/views/', import.meta.url));
  let n = 0;
  for (const f of readdirSync(dir)) {
    const s = readFileSync(dir + f, 'utf8');
    n += (s.match(/h\('details'/g) || []).length;
    assert.ok(!/addEventListener\('click'[^)]*summary|summary[^;]*preventDefault/.test(s), f + ' に独自の開け閉めがある');
  }
  assert.ok(n >= 6,'views の details の数: ' + n);
});

test('package.json の test 一覧に expand.test.js が入っている', () => {
  assert.match(read('../package.json'), /tests\/expand\.test\.js/);
});

test('app.js と expand.js は構文として読み込める', async () => {
  const { spawnSync } = await import('node:child_process');
  for (const p of ['../js/app.js', '../js/lib/expand.js']) {
    const r = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(p, import.meta.url))], { encoding: 'utf8' });
    assert.equal(r.status, 0, p + ' ' + r.stderr);
  }
});

// ---- ボタンで開け閉めする折りたたみ（toggleExpand。真ボスの結果・苦手の分析のよく間違える問題）----
import { toggleExpand } from '../js/lib/expand.js';

function fakePanel({ canAnimate = true } = {}) {
  const cls = new Set();
  const attrs = {};
  const btn = { getAttribute: (k) => (k in attrs ? attrs[k] : null), setAttribute: (k, v) => { attrs[k] = String(v); }, attrs };
  const panel = {
    hidden: true, cls, animations: [], current: null, built: 0,
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c) },
    getBoundingClientRect() { if (panel.current && panel.current.height !== null) return { height: panel.current.height }; return { height: panel.hidden ? 0 : 200 }; },
    animate: canAnimate ? function (frames, opts) {
      const anim = { frames, opts, height: null, onfinish: null, cancelled: false, cancel() { this.cancelled = true; if (panel.current === this) panel.current = null; } };
      panel.current = anim; panel.animations.push(anim); return anim;
    } : undefined,
  };
  const win = { matchMedia: () => ({ matches: false }), getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '12px' }) };
  return { btn, panel, win };
}

test('toggleExpand 開く: aria-expanded が true、中身は高さを測る前に作る、0 から行き過ぎて戻る。終わると hidden なし・class なし・動きの指定なし', () => {
  const { btn, panel, win } = fakePanel();
  const r = toggleExpand(btn, panel, () => { panel.built++; assert.equal(panel.hidden, false, '作るときは表示済み'); }, win);
  assert.equal(r, true);
  assert.equal(btn.getAttribute('aria-expanded'), 'true');
  assert.equal(panel.built, 1);
  const a = panel.animations[0];
  assert.equal(px(a.frames[0].height), 0);
  assert.equal(a.frames[0].paddingBottom, '0px', '高さ 0 では余白も 0');
  assert.ok(px(a.frames[1].height) > 200);
  assert.equal(px(a.frames[2].height), 200);
  assert.equal(a.frames[2].paddingBottom, '12px');
  assert.equal(a.opts.duration, EXPAND_MS.open);
  assert.ok(panel.cls.has('is-expanding'));
  a.onfinish();
  assert.equal(panel.hidden, false);
  assert.equal(panel.cls.size, 0);
  assert.equal(a.cancelled, true);
});

test('toggleExpand 閉じる: 縮み終わるまで見せ、終わって hidden。戻り値 false、aria-expanded は押した瞬間に false', () => {
  const { btn, panel, win } = fakePanel();
  panel.hidden = false; btn.setAttribute('aria-expanded', 'true');
  const r = toggleExpand(btn, panel, null, win);
  assert.equal(r, false);
  assert.equal(btn.getAttribute('aria-expanded'), 'false');
  assert.equal(panel.hidden, false);
  const a = panel.animations[0];
  assert.equal(px(a.frames[0].height), 200);
  assert.equal(px(a.frames[a.frames.length - 1].height), 0);
  assert.equal(a.opts.duration, EXPAND_MS.close);
  a.onfinish();
  assert.equal(panel.hidden, true);
  assert.equal(panel.cls.size, 0);
});

test('toggleExpand 連打: 途中の高さから逆向き。前の動きの終わりは無効。最後の向きで確定', () => {
  const { btn, panel, win } = fakePanel();
  toggleExpand(btn, panel, null, win);
  const first = panel.animations[0];
  first.height = 90;
  assert.equal(toggleExpand(btn, panel, null, win), false);
  assert.equal(first.cancelled, true);
  assert.equal(first.onfinish, null);
  const second = panel.animations[1];
  assert.equal(px(second.frames[0].height), 90);
  assert.equal(btn.getAttribute('aria-expanded'), 'false');
  second.height = 40;
  assert.equal(toggleExpand(btn, panel, null, win), true);
  const third = panel.animations[2];
  assert.equal(px(third.frames[0].height), 40);
  third.onfinish();
  assert.equal(panel.hidden, false);
  assert.equal(btn.getAttribute('aria-expanded'), 'true');
});

test('toggleExpand 動きを減らす設定・animate なし: 動かさず即座に切り換え（中身は開くときに作る）', () => {
  for (const mode of ['reduce', 'noanim']) {
    const { btn, panel, win } = fakePanel({ canAnimate: mode !== 'noanim' });
    if (mode === 'reduce') win.matchMedia = (q) => ({ matches: q.includes('prefers-reduced-motion') });
    assert.equal(toggleExpand(btn, panel, () => { panel.built++; }, win), true);
    assert.equal(panel.hidden, false, mode);
    assert.equal(panel.built, 1);
    assert.equal(panel.animations.length, 0);
    assert.equal(toggleExpand(btn, panel, () => { panel.built++; }, win), false);
    assert.equal(panel.hidden, true, mode);
    assert.equal(panel.built, 1, '閉じるときは作らない');
  }
});

test('配線: 真ボスの結果（まとまり・1問）と苦手の分析のよく間違える問題が toggleExpand を使い、個別の hidden 切り換えを持たない。aria-expanded で開け閉めする所は全部ここ', async () => {
  const { readdirSync } = await import('node:fs');
  const dir = fileURLToPath(new URL('../js/views/', import.meta.url));
  const users = [];
  for (const f of readdirSync(dir)) {
    const s = readFileSync(dir + f, 'utf8');
    if (/'aria-expanded'/.test(s)) {
      users.push(f);
      assert.match(s, /toggleExpand\(/, f + ' は toggleExpand を使う');
      assert.ok(!/\.hidden = was|setAttribute\('aria-expanded'/.test(s), f + ' に個別の開け閉めが残っている');
    }
  }
  assert.deepEqual(users.sort(), ['trueboss.js', 'weak.js']);
  const css = read('../css/app.css');
  assert.match(css, /\.tb-q-panel\.is-expanding, \.tb-group-body\.is-expanding \{ overflow: hidden; \}/);
  const src = read('../js/lib/expand.js');
  assert.ok(!/\.style\b|setAttribute\('style'|cssText/.test(src.replace(/\/\/.*$/gm, '')));
});
