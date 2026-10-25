// 場面が変わるときの演出（要件定義書 §6-5、2026-10-25 先生決定 A）の検証。
// 見ているもの: どの転換で何が付くか（ROUTES の全組み合わせ）、動きを減らす設定で付かない、覆いが残らない（連打・明けている最中の変更）、
//   app.js の配線（render の順序を崩していない）、css の時間と TIMES の一致、sw-core への登録
// 見ていないもの: 実際の見た目（Playwright で撮って目で見る）、iPhone の Safari での描画
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sceneKind, createTransitioner, TIMES } from '../js/lib/transition.js';

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
function fake({ reduce = false } = {}) {
  const appended = [];
  const doc = {
    body: { appendChild(el) { el.parentNode = this; appended.push(el); }, removeChild(el) { el.parentNode = null; const i = appended.indexOf(el); if (i >= 0) appended.splice(i, 1); } },
    createElement() { return { className: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, parentNode: null }; },
  };
  let now = 0;
  let seq = 0;
  const timers = new Map();
  const win = {
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
  return { doc, win, appended, advance, pending: () => timers.size };
}

test('go: 渦は 450ms 隠してから入れ替え、350ms で明けて消える。入れ替えの時点で覆いが付いている', () => {
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
  assert.match(appSrc, /import \{ sceneKind, createTransitioner \} from '\.\/lib\/transition\.js';/);
  assert.match(appSrc, /addEventListener\('hashchange', \(\) => \{\s*if \(transitioner\.covering\) return;\s*transitioner\.go\(sceneKind\(shown, routeOfHash\(\)\), render\);\s*\}\);/);
  assert.ok(!/addEventListener\('hashchange', render\)/.test(appSrc), 'hashchange が直接 render を呼んでいる');
  const start = appSrc.indexOf('  function render() {');
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
  assert.equal(dur('.scene-vortex.in::before'), TIMES.vortex.in);
  assert.equal(dur('.scene-vortex.out'), TIMES.vortex.out);
  assert.equal(dur('.scene-wipe.in'), TIMES.wipe.in);
  assert.equal(dur('.scene-wipe.out'), TIMES.wipe.out);
  assert.equal(dur('.scene-fade.in'), TIMES.fade.in);
  assert.equal(dur('.scene-fade.out'), TIMES.fade.out);
  assert.match(css, /\.scene-veil \{[^}]*pointer-events: none/);
  assert.match(css, /\.scene-veil\.in \{ pointer-events: auto/);
  for (const k of ['vortex', 'wipe', 'fade']) assert.ok(TIMES[k].in + TIMES[k].out <= 1000, k + ' は 1 秒以内');
  // CSP（style-src 'self'）に触れない: JS は class だけを付ける
  const src = read('../js/lib/transition.js');
  assert.ok(!/\.style\b|setAttribute\('style'/.test(src));
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
