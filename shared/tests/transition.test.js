// 場面が変わるときの演出（要件定義書 §6-5、2026-10-25 先生決定 A）の検証。
// 見ているもの: どの転換で何が付くか（ROUTES の全組み合わせ）、動きを減らす設定で付かない、覆いが残らない（連打・明けている最中の変更）、
//   app.js の配線（render の順序を崩していない）、css の時間と TIMES の一致、sw-core への登録
// 見ていないもの: 実際の見た目（Playwright で撮って目で見る）、iPhone の Safari での描画
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sceneKind, createTransitioner, TIMES, spiralOrder, diagonalOrder, dotsFilled, wantsTabRise, tabRise, TAB_RISE_MS, TAB_RISE_STEP_MS, TAB_RISE_STAGGER, TAB_RISE_TOTAL_MS } from '../js/lib/transition.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const appSrc = read('../js/app.js');
const css = read('../css/app.css');

// ROUTES を app.js から読む（名前と、4つ目が true か）
const routesBody = appSrc.slice(appSrc.indexOf('const ROUTES = ['), appSrc.indexOf('];', appSrc.indexOf('const ROUTES = [')));
const ROUTES = [...routesBody.matchAll(/^\s*\['(\w+)', '(\w+)',.*?(, true)?\],/gm)].map((m) => ({ name: m[1], full: !!m[3] }));

test('ROUTES の読み取り: 場面は exam・play・dochi・boss・trueboss の5つ', () => {
  assert.ok(ROUTES.length >= 20, String(ROUTES.length));
  assert.deepEqual(ROUTES.filter((r) => r.full).map((r) => r.name).sort(), ['boss', 'dochi', 'exam', 'play', 'trueboss']);
});

test('sceneKind: ふつう→ボス戦・真ボス戦は渦、ふつう→問題・どっち？・模擬試験は横切り、場面→ふつうは明け、それ以外は無し', () => {
  for (const a of ROUTES) {
    for (const b of ROUTES) {
      const got = sceneKind(a, b);
      let want = null;
      if (!a.full && b.full) want = b.name === 'boss' || b.name === 'trueboss' ? 'vortex' : 'wipe';
      else if (a.full && !b.full) want = 'fade';
      assert.equal(got, want, a.name + ' → ' + b.name);
    }
  }
  assert.equal(sceneKind(null, { name: 'home', full: false }), null);
});

// 偽の document / window（setTimeout を手で進める）
function fake({ reduce = false, canvasOk = true } = {}) {
  const appended = [];
  const doc = {
    body: { appendChild(el) { el.parentNode = this; appended.push(el); }, removeChild(el) { el.parentNode = null; const i = appended.indexOf(el); if (i >= 0) appended.splice(i, 1); } },
    createElement(tag) {
      const el = { tag, className: '', attrs: {}, children: [], setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.children.push(c); }, parentNode: null };
      if (tag === 'canvas') el.getContext = () => (canvasOk ? { rects: el.rects, clearRect() { el.rects.length = 0; }, fillRect(...a) { el.rects.push(a); }, set fillStyle(v) { el.fill = v; } } : null);
      if (tag === 'canvas') el.rects = [];
      return el;
    },
  };
  let now = 0;
  let seq = 0;
  const timers = new Map();
  const rafs = [];
  const win = {
    innerWidth: 412,
    innerHeight: 800,
    performance: { now: () => now },
    requestAnimationFrame(fn) { rafs.push(fn); return rafs.length; },
    matchMedia: (q) => ({ matches: reduce && q.includes('prefers-reduced-motion') }),
    setTimeout(fn, ms) { const id = ++seq; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const advance = (ms) => {
    const end = now + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, t]) => t.at <= end).sort((x, y) => x[1].at - y[1].at)[0];
      if (!next) break;
      timers.delete(next[0]);
      now = next[1].at;
      next[1].fn();
    }
    now = end;
  };
  // 描画のコマを1回ぶん進める（rAF の予約を実行する）
  const frame = () => { const a = rafs.splice(0); a.forEach((fn) => fn()); };
  return { doc, win, appended, advance, frame, pending: () => timers.size };
}

test('spiralOrder: 全マスを1回ずつ、外周から時計回りに内側へ巡る', () => {
  for (const [c, r] of [[1, 1], [1, 5], [5, 1], [2, 2], [3, 3], [14, 29], [14, 30], [4, 7]]) {
    const o = spiralOrder(c, r);
    assert.equal(o.length, c * r, c + 'x' + r + ' の数');
    assert.equal(new Set(o.map((p) => p[0] + ',' + p[1])).size, c * r, c + 'x' + r + ' の重なり');
    assert.ok(o.every(([x, y]) => x >= 0 && x < c && y >= 0 && y < r));
    // となり合う順（途中で飛ばない）
    for (let i = 1; i < o.length; i++) assert.equal(Math.abs(o[i][0] - o[i - 1][0]) + Math.abs(o[i][1] - o[i - 1][1]), 1, c + 'x' + r + ' ' + i);
  }
  const o = spiralOrder(3, 3).map((p) => p.join(''));
  assert.deepEqual(o, ['00', '10', '20', '21', '22', '12', '02', '01', '11']); // 右→下→左→上→中心
  assert.equal(spiralOrder(14, 30)[0].join(), '0,0'); // 角から始まる（外側）
});

test('diagonalOrder: 全マスを1回ずつ、左上の角から右下の角へ、斜めの帯（x+y）の順', () => {
  for (const [c, r] of [[1, 1], [1, 5], [5, 1], [2, 2], [3, 3], [14, 29], [14, 30], [4, 7]]) {
    const o = diagonalOrder(c, r);
    assert.equal(o.length, c * r, c + 'x' + r + ' の数');
    assert.equal(new Set(o.map((p) => p[0] + ',' + p[1])).size, c * r, c + 'x' + r + ' の重なり');
    assert.ok(o.every(([x, y]) => x >= 0 && x < c && y >= 0 && y < r));
    for (let i = 1; i < o.length; i++) assert.ok(o[i][0] + o[i][1] >= o[i - 1][0] + o[i - 1][1], c + 'x' + r + ' ' + i + ' 帯が戻らない');
    assert.deepEqual(o[0], [0, 0]);
    assert.deepEqual(o[o.length - 1], [c - 1, r - 1]);
  }
  assert.deepEqual(diagonalOrder(3, 3).map((p) => p.join('')), ['00', '01', '10', '02', '11', '20', '12', '21', '22']);
});

test('go: 斜めのドットは 380ms 隠してから入れ替え、280ms で明けて消える。帯の先頭だけ明るい色、隠しきったら全部黒', () => {
  const f = fake();
  const t = createTransitioner(f.doc, f.win);
  let cov = -1;
  let fillAtSwap = '';
  t.go('wipe', () => { const c = f.appended[0].children[0]; cov = c.rects.length; fillAtSwap = c.fill; });
  const canvas = f.appended[0].children[0];
  assert.equal(canvas.tag, 'canvas');
  assert.match(f.appended[0].className, /scene-wipe.* in$/);
  f.frame();
  f.advance(190);
  f.frame();
  const total = 14 * Math.ceil(800 / Math.ceil(412 / 14));
  assert.ok(canvas.rects.length > total * 0.4 && canvas.rects.length < total * 0.6, canvas.rects.length + ' / ' + total);
  assert.equal(canvas.fill, '#2b3568', '途中は先頭の帯を明るい色で描く');
  // 埋まっているのは左上側（右下の角はまだ）
  assert.ok(!canvas.rects.some((r) => r[0] === 13 * 30 && r[1] === 26 * 30));
  assert.ok(canvas.rects.some((r) => r[0] === 0 && r[1] === 0));
  f.advance(190);
  assert.equal(cov, total, '入れ替えの時点で全部埋まっている');
  assert.equal(fillAtSwap, '#000');
  assert.match(f.appended[0].className, /scene-wipe.* out$/);
  f.frame();
  f.advance(140);
  f.frame();
  assert.ok(canvas.rects.length > 0 && canvas.rects.length < total, '明ける間は半分ほど');
  assert.ok(!canvas.rects.some((r) => r[0] === 0 && r[1] === 0), '明けるときも左上から先に消える');
  assert.ok(canvas.rects.some((r) => r[0] === 13 * 30 && r[1] === 26 * 30));
  f.advance(140);
  assert.equal(f.appended.length, 0);
  f.frame();
  assert.equal(f.pending(), 0);
});

test('go: canvas が使えない端末では、斜めのドットのかわりにふつうの暗転を出す', () => {
  const f = fake({ canvasOk: false });
  const t = createTransitioner(f.doc, f.win);
  let swapped = 0;
  t.go('wipe', () => { swapped++; });
  assert.match(f.appended[0].className, /scene-fade.* in$/);
  f.advance(TIMES.fade.in);
  assert.equal(swapped, 1);
  f.advance(TIMES.fade.out);
  assert.equal(f.appended.length, 0);
});

test('dotsFilled: 隠す間は0→全部、明ける間は全部→0。範囲の外に出ない', () => {
  assert.equal(dotsFilled('in', 0, 100, 700, 300), 0);
  assert.equal(dotsFilled('in', 350, 100, 700, 300), 50);
  assert.equal(dotsFilled('in', 700, 100, 700, 300), 100);
  assert.equal(dotsFilled('in', 9999, 100, 700, 300), 100);
  assert.equal(dotsFilled('out', 0, 100, 700, 300), 100);
  assert.equal(dotsFilled('out', 150, 100, 700, 300), 50);
  assert.equal(dotsFilled('out', 300, 100, 700, 300), 0);
  assert.equal(dotsFilled('out', -5, 100, 700, 300), 100);
});

test('go: 渦は canvas にドットを描く。幅412pxで14列の四角、隠しきってから入れ替え、明けたら canvas ごと消える', () => {
  const f = fake();
  const t = createTransitioner(f.doc, f.win);
  let cov = -1;
  t.go('vortex', () => { cov = f.appended[0].children[0].rects.length; });
  const canvas = f.appended[0].children[0];
  assert.equal(canvas.tag, 'canvas');
  assert.equal(canvas.width, 412);
  assert.equal(canvas.height, 800);
  assert.ok(!('style' in canvas), 'style を書かない（CSP）');
  f.frame();
  assert.equal(canvas.rects.length, 0, '始まりはまだ何も埋まっていない');
  f.advance(350);
  f.frame();
  const half = canvas.rects.length;
  const total = 14 * Math.ceil(800 / Math.ceil(412 / 14));
  assert.ok(half > total * 0.4 && half < total * 0.6, half + ' / ' + total);
  assert.ok(canvas.rects.every((r) => r[2] === 30 && r[3] === 30), '30px の四角（412/14 を切り上げ）');
  assert.equal(canvas.fill, '#000');
  f.advance(350);
  assert.equal(cov, total, '入れ替えの時点で全部のドットが埋まっている');
  f.frame();
  f.advance(150);
  f.frame();
  assert.ok(canvas.rects.length > 0 && canvas.rects.length < total, '明ける間は半分ほど');
  f.advance(150);
  assert.equal(f.appended.length, 0);
  f.frame();
  assert.equal(f.pending(), 0);
});

test('go: canvas が使えない端末では、渦のかわりにふつうの暗転を出す（覆いは必ず消える）', () => {
  const f = fake({ canvasOk: false });
  const t = createTransitioner(f.doc, f.win);
  let swapped = 0;
  t.go('vortex', () => { swapped++; });
  assert.match(f.appended[0].className, /scene-fade.* in$/);
  f.advance(TIMES.fade.in);
  assert.equal(swapped, 1);
  f.advance(TIMES.fade.out);
  assert.equal(f.appended.length, 0);
});

test('go: 渦の隠している最中に clear しても、描画のコマは止まる', () => {
  const f = fake();
  const t = createTransitioner(f.doc, f.win);
  t.go('vortex', () => {});
  f.frame();
  t.clear();
  const c = f.doc.createElement('canvas');
  f.frame(); // 止まった描画は次のコマを予約しない
  f.frame();
  assert.equal(f.appended.length, 0);
  assert.ok(c);
});

test('go: 渦は 700ms 隠してから入れ替え、300ms で明けて消える。入れ替えの時点で覆いが付いている', () => {
  const f = fake();
  const t = createTransitioner(f.doc, f.win);
  let swapped = 0;
  let classAtSwap = '';
  t.go('vortex', () => { swapped++; classAtSwap = f.appended[0] && f.appended[0].className; });
  assert.equal(swapped, 0);
  assert.equal(t.covering, true);
  assert.equal(f.appended.length, 1);
  assert.match(f.appended[0].className, /scene-vortex.* in$/);
  assert.equal(f.appended[0].attrs['aria-hidden'], 'true');
  f.advance(TIMES.vortex.in - 1);
  assert.equal(swapped, 0);
  f.advance(1);
  assert.equal(swapped, 1);
  assert.match(classAtSwap, / in$/);
  assert.equal(t.covering, false);
  assert.match(f.appended[0].className, /scene-vortex.* out$/);
  f.advance(TIMES.vortex.out);
  assert.equal(f.appended.length, 0, '覆いが残る');
  assert.equal(f.pending(), 0);
});

test('go: kind が無いとき・動きを減らす設定のときは、覆いを作らず即座に入れ替える', () => {
  for (const [kind, reduce] of [[null, false], ['vortex', true], ['wipe', true], ['fade', true]]) {
    const f = fake({ reduce });
    const t = createTransitioner(f.doc, f.win);
    let swapped = 0;
    t.go(kind, () => { swapped++; });
    assert.equal(swapped, 1, String(kind) + ' ' + reduce);
    assert.equal(f.appended.length, 0);
    assert.equal(f.pending(), 0);
    assert.equal(t.covering, false);
  }
});

test('go: matchMedia が無い・例外のときは（安全側で）演出を出さず、即座に入れ替える', () => {
  const f = fake();
  f.win.matchMedia = undefined;
  let swapped = 0;
  createTransitioner(f.doc, f.win).go('wipe', () => { swapped++; });
  assert.equal(swapped, 1);
  const g = fake();
  g.win.matchMedia = () => { throw new Error('x'); };
  createTransitioner(g.doc, g.win).go('wipe', () => { swapped++; });
  assert.equal(swapped, 2);
  assert.equal(g.appended.length, 0);
});

test('go: 明けている最中に次の変更が来たら、古い覆いを片付けて新しく始める（覆いは常に1枚以下）', () => {
  const f = fake();
  const t = createTransitioner(f.doc, f.win);
  const log = [];
  t.go('wipe', () => log.push('a'));
  f.advance(TIMES.wipe.in); // 入れ替えた。いま明けている
  assert.deepEqual(log, ['a']);
  t.go('fade', () => log.push('b'));
  assert.equal(f.appended.length, 1);
  assert.match(f.appended[0].className, /scene-fade/);
  f.advance(TIMES.fade.in);
  assert.deepEqual(log, ['a', 'b']);
  f.advance(TIMES.fade.out);
  assert.equal(f.appended.length, 0);
  assert.equal(f.pending(), 0);
});

test('go: 演出なしの変更（kind なし）が明けている最中に来たら、覆いを消して即入れ替える', () => {
  const f = fake();
  const t = createTransitioner(f.doc, f.win);
  t.go('vortex', () => {});
  f.advance(TIMES.vortex.in);
  let swapped = 0;
  t.go(null, () => { swapped++; });
  assert.equal(swapped, 1);
  assert.equal(f.appended.length, 0);
  assert.equal(f.pending(), 0);
});

test('go: 入れ替えが例外を投げても、覆いは明けて消える', () => {
  const f = fake();
  const t = createTransitioner(f.doc, f.win);
  t.go('fade', () => { throw new Error('boom'); });
  assert.throws(() => f.advance(TIMES.fade.in), /boom/);
  f.advance(TIMES.fade.out);
  assert.equal(f.appended.length, 0);
});

test('clear: 隠している最中でも、タイマーごと片付ける（入れ替えは行われない）', () => {
  const f = fake();
  const t = createTransitioner(f.doc, f.win);
  let swapped = 0;
  t.go('wipe', () => { swapped++; });
  t.clear();
  f.advance(1000);
  assert.equal(swapped, 0);
  assert.equal(f.appended.length, 0);
  assert.equal(t.covering, false);
});

test('app.js の配線: 場面の判定を hashchange だけが使い、render の順序（cleanup → backGuard → 描画 → BGM → nav → scrollTo → focus → お祝い）は崩れていない', () => {
  assert.match(appSrc, /import \{ sceneKind, createTransitioner, wantsTabRise, tabRise \} from '\.\/lib\/transition\.js';/);
  assert.match(appSrc, /addEventListener\('hashchange', \(\) => \{\s*if \(transitioner\.covering\) return;\s*const viaTab = tabPressed;\s*tabPressed = false;\s*transitioner\.go\(sceneKind\(shown, routeOfHash\(\)\), \(\) => render\(\{ tab: viaTab \}\)\);\s*\}\);/);
  assert.ok(!/addEventListener\('hashchange', render\)/.test(appSrc), 'hashchange が直接 render を呼んでいる');
  const start = appSrc.indexOf('  function render(opts) {');
  const end = appSrc.indexOf("window.addEventListener('hashchange'");
  const body = appSrc.slice(start, end);
  const order = ['cleanup();', 'backGuard = null;', 'route[2](arg)', 'shown = { name, full };', 'setBgmScene(full);', "nav.classList.toggle('hidden', full);", 'window.scrollTo(0, 0);', 'main.focus({ preventScroll: true });', 'app.flushCelebrations();'];
  let at = -1;
  for (const s of order) {
    const i = body.indexOf(s);
    assert.ok(i > at, s + ' の位置（順序）');
    at = i;
  }
  // 行き先の名前の読み方は render と同じ（2026-10-25、正規表現の \ が抜けて app.js ごと読み込めなくなった。ここで原文を突き合わせる）
  const hashRe = "location.hash.replace(/^#\\/?/, '').split('/')";
  assert.equal(appSrc.split(hashRe).length - 1, 2, 'routeOfHash と render の hash の読み方が違う');
  // 最初の描画と、インストール案内の描き直しは演出なし（直接 render）
  assert.match(appSrc, /\n  render\(\);\n/);
});

test('css: 覆いの時間が TIMES と同じ。操作は隠している間だけ止め、明ける間は通す', () => {
  const dur = (sel) => {
    const m = css.match(new RegExp(sel.replace(/[.]/g, '\\.') + ' \\{[^}]*animation: [\\w-]+ (\\d+)ms'));
    assert.ok(m, sel);
    return Number(m[1]);
  };
  assert.equal(TIMES.vortex.in, 700);
  assert.deepEqual(TIMES.wipe, { in: 380, out: 280 }); // 斜めのドットは JS が canvas に描く。CSS の animation は持たない
  assert.ok(!/\.scene-wipe\.(in|out) \{[^}]*animation/.test(css));
  assert.equal(dur('.scene-fade.in'), TIMES.fade.in);
  assert.equal(dur('.scene-fade.out'), TIMES.fade.out);
  assert.match(css, /\.scene-veil \{[^}]*pointer-events: none/);
  assert.match(css, /\.scene-veil\.in \{ pointer-events: auto/);
  for (const k of ['vortex', 'wipe', 'fade']) assert.ok(TIMES[k].in + TIMES[k].out <= 1000, k + ' は 1 秒以内');
  // CSP（style-src 'self'）に触れない: JS は class だけを付ける
  const src = read('../js/lib/transition.js');
  assert.ok(!/\.style\b|setAttribute\('style'/.test(src));
});

// ---- 下のタブを押したときの浮かび上がり（要件定義書 §6-5、先生決定 B、2026-10-25） ----
test('wantsTabRise: タブを押したときの、ふつう→ふつうだけ。場面との行き来・タブ以外の移動には付けない', () => {
  const n = (full) => ({ name: 'x', full });
  assert.equal(wantsTabRise(true, n(false), n(false)), true);
  assert.equal(wantsTabRise(true, null, n(false)), true);
  assert.equal(wantsTabRise(false, n(false), n(false)), false, 'タブを押していない（カード一覧→カード、戻る）');
  assert.equal(wantsTabRise(true, n(true), n(false)), false, '場面から戻る暗転と重ねない');
  assert.equal(wantsTabRise(true, n(false), n(true)), false);
  assert.equal(wantsTabRise(undefined, n(false), n(false)), false);
  // ROUTES 全組み合わせ: 付くのは両方ふつうの画面のときだけ
  for (const a of ROUTES) for (const b of ROUTES) assert.equal(wantsTabRise(true, a, b), !a.full && !b.full, a.name + ' → ' + b.name);
});

function fakeMain({ reduce = false, kids = 0 } = {}) {
  const classes = new Set();
  const children = [];
  for (let i = 0; i < kids; i++) { const cs = new Set(); children.push({ cs, classList: { add: (c) => cs.add(c), remove: (c) => cs.delete(c) } }); }
  const el = { offsetWidth: 1, children, classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) } };
  const timers = new Map();
  let seq = 0;
  const win = {
    matchMedia: (q) => ({ matches: reduce && q.includes('prefers-reduced-motion') }),
    setTimeout(fn, ms) { const id = ++seq; timers.set(id, { ms, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  return { el, win, classes, timers, children };
}

test('tabRise: class を付け、出きった後に外す（残らない）。連打でも1本のタイマーだけ', () => {
  const f = fakeMain({ kids: 3 });
  assert.equal(tabRise(f.el, f.win), true);
  assert.ok(f.classes.has('tab-rise'));
  assert.equal(f.timers.size, 1);
  assert.equal(tabRise(f.el, f.win), true);
  assert.equal(f.timers.size, 1, '古いタイマーは消してから');
  const [t] = [...f.timers.values()];
  assert.ok(t.ms >= TAB_RISE_TOTAL_MS && t.ms <= TAB_RISE_TOTAL_MS + 100);
  t.fn();
  assert.ok(!f.classes.has('tab-rise'));
  assert.ok(f.children.every((k) => k.cs.size === 0), '子の class も残らない');
});

test('tabRise: 主なかたまりに上から rise-1〜rise-8、9つ目以降は rise-9。連打で class が積み上がらない', () => {
  const f = fakeMain({ kids: 12 });
  tabRise(f.el, f.win);
  assert.deepEqual(f.children.map((k) => [...k.cs].join()), ['rise-1', 'rise-2', 'rise-3', 'rise-4', 'rise-5', 'rise-6', 'rise-7', 'rise-8', 'rise-9', 'rise-9', 'rise-9', 'rise-9']);
  tabRise(f.el, f.win);
  assert.ok(f.children.every((k) => k.cs.size === 1), '付け直しで1つだけ');
  const g = fakeMain({ kids: 0 });
  assert.equal(tabRise(g.el, g.win), true, '中身が空でも壊れない');
});

test('tabRise: main の中が画面1枚（.view）だけなら、その直下のかたまりを順に出す（画面1枚ごと一度に出さない）', () => {
  const f = fakeMain({ kids: 0 });
  const mk = () => { const cs = new Set(); return { cs, children: [], classList: { add: (c) => cs.add(c), remove: (c) => cs.delete(c) } }; };
  const view = mk();
  for (let i = 0; i < 3; i++) view.children.push(mk());
  f.el.children.push(view);
  tabRise(f.el, f.win);
  assert.equal(view.cs.size, 0, '画面の入れ物自体には付けない');
  assert.deepEqual(view.children.map((k) => [...k.cs].join()), ['rise-1', 'rise-2', 'rise-3']);
  [...f.timers.values()][0].fn();
  assert.ok(view.children.every((k) => k.cs.size === 0));
});

test('tabRise: 動き全体が 0.6 秒以内に出きる。ずらしは 40〜60ms・8つまで', () => {
  assert.equal(TAB_RISE_STAGGER, 8);
  assert.ok(TAB_RISE_STEP_MS >= 40 && TAB_RISE_STEP_MS <= 60);
  assert.ok(TAB_RISE_MS >= 300 && TAB_RISE_MS <= 350);
  assert.ok(TAB_RISE_TOTAL_MS <= 600, '出きるまで ' + TAB_RISE_TOTAL_MS);
});

test('tabRise: 動きを減らす設定・matchMedia なし・main なしでは何も付けない', () => {
  const f = fakeMain({ reduce: true, kids: 2 });
  assert.equal(tabRise(f.el, f.win), false);
  assert.equal(f.classes.size, 0);
  assert.ok(f.children.every((k) => k.cs.size === 0));
  const g = fakeMain();
  g.win.matchMedia = undefined;
  assert.equal(tabRise(g.el, g.win), false);
  assert.equal(g.classes.size, 0);
  assert.equal(tabRise(null, g.win), false);
});

test('app.js の配線: タブの click が目印を立て、hashchange が拾って render に渡す。render は描いた後に tabRise。他の render 呼び出しは目印なし', () => {
  assert.match(appSrc, /a\.addEventListener\('click', \(\) => \{\s*tabPressed = true;\s*window\.setTimeout\(\(\) => \{ tabPressed = false; \}, 400\);\s*\}\);/);
  assert.match(appSrc, /function render\(opts\) \{\s*const prevShown = shown;/);
  assert.match(appSrc, /if \(opts && wantsTabRise\(opts\.tab, prevShown, shown\)\) tabRise\(main, window\);/);
  assert.ok(appSrc.indexOf('tabRise(main, window)') > appSrc.indexOf('main.focus({ preventScroll: true });'), '描いた後');
  assert.equal(appSrc.split('render({ tab').length - 1, 1, 'タブの目印を渡すのは hashchange だけ');
});

test('css: .tab-rise は画面の直下のかたまりに、ばね（行き過ぎ）・20px 下から・透明→不透明。遅れは class。覆いは使わない。時間・間隔は TAB_RISE_* と同じ', () => {
  const m = css.match(/\.main\.tab-rise \.rise-9 \{ animation: tab-rise (\d+)ms cubic-bezier\(0\.34, 1\.56, 0\.64, 1\)/);
  assert.ok(m, 'animation（開け閉めと同じばね）');
  assert.equal(Number(m[1]), TAB_RISE_MS);
  const k = css.match(/@keyframes tab-rise \{ from \{ opacity: 0; transform: translateY\((\d+)px\) scale\(([\d.]+)\); \} to \{ opacity: 1; transform: translateY\(0\) scale\(1\); \} \}/);
  assert.ok(k, 'keyframes');
  assert.ok(Number(k[1]) >= 15 && Number(k[1]) <= 25);
  assert.ok(Number(k[2]) >= 0.9 && Number(k[2]) < 1);
  for (let i = 1; i <= TAB_RISE_STAGGER + 1; i++) {
    const r = css.match(new RegExp('\\.main\\.tab-rise \\.rise-' + i + ' \\{ animation-delay: (\\d+)ms; \\}'));
    assert.ok(r, 'rise-' + i);
    assert.equal(Number(r[1]), TAB_RISE_STEP_MS * (Math.min(i, TAB_RISE_STAGGER) - 1), 'rise-' + i + ' の遅れ');
  }
  assert.ok(!/\.main\.tab-rise[^{]*\{[^}]*pointer-events/.test(css), '操作を止めない');
});

test('sw-core.js: transition.js が SHARED に載っている', () => {
  assert.match(read('../sw-core.js'), /'\.\.\/shared\/js\/lib\/transition\.js'/);
});

test('package.json の test 一覧に transition.test.js が入っている（一覧の漏れで回らなかった事故の予防）', () => {
  assert.match(read('../package.json'), /tests\/transition\.test\.js/);
});

test('app.js と transition.js は構文として読み込める（正規表現の \ が抜けて起動できなくなった事故の予防）', async () => {
  const { spawnSync } = await import('node:child_process');
  for (const p of ['../js/app.js', '../js/lib/transition.js']) {
    const r = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(p, import.meta.url))], { encoding: 'utf8' });
    assert.equal(r.status, 0, p + ' ' + r.stderr);
  }
});
