// 真ボスが初めて現れる演出（要件定義書 §3-9『出現の演出』、2026-10-25 先生決定）の検証。
// 実行: cd shared && node --test tests/awaken.test.js
// 状態（1回だけ・倒した人には出さない・古い記録）は lib/trueboss.js を直接。演出の手順（views/awaken.js）は、小さな偽の画面部品と偽の時計で動かして確かめる。
// 本物のブラウザでの見た目・タップは、実機のスクリーンショットで確かめる（ここでは言えない）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  normalizeTrueBoss, trueBossAwakenToShow, trueBossAwakenRecordOnly, markAwakened, trueBossEntranceReady, trueBossAwakeText, recordTrueBossWin,
} from '../js/lib/trueboss.js';
import { mergeState } from '../js/lib/progress.js';
import { AWAKEN_PLAN, AWAKEN_PLAN_REDUCED, AWAKEN_START_MS, awakenPlan, awakenTextStep, AWAKEN_TEXT_MAX_MS, runAwakening } from '../js/views/awaken.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => readFileSync(root + p, 'utf8').replace(/\r\n/g, '\n');
const code = (p) => read(p).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join('\n');

const stages = [{ key: 'a', questions: [1] }, { key: 'b', questions: [1] }];
const cfg = { trueBoss: true, trueBossWords: { place: '塔の いちばん うえ' } };
const beatenAll = (extra = {}) => ({ boss: { a: 1, b: 1 }, ...extra });

// ---- 状態 ----
test('記録: 出現の演出を出したか（awakened）。古い記録（項目なし）・壊れた値は false。倒した人でも項目が無ければ false（見たことにするのは地図を開いたとき）', () => {
  assert.equal(normalizeTrueBoss(undefined).awakened, false);
  assert.equal(normalizeTrueBoss(null).awakened, false);
  assert.equal(normalizeTrueBoss({ wins: 0 }).awakened, false, '古い記録（項目なし）');
  assert.equal(normalizeTrueBoss({ wins: 2 }).awakened, false);
  assert.equal(normalizeTrueBoss({ awakened: 'true' }).awakened, false, '文字列は壊れた値');
  assert.equal(normalizeTrueBoss({ awakened: 1 }).awakened, false);
  assert.equal(normalizeTrueBoss({ awakened: true }).awakened, true);
  assert.equal(normalizeTrueBoss([true]).awakened, false);
  assert.equal(mergeState({}).trueBoss.awakened, false, '新しい記録の初期値');
  assert.equal(mergeState({ trueBoss: { wins: 0, awakened: true } }).trueBoss.awakened, true, '保存した値は読み込んでも残る');
  assert.equal(mergeState({ trueBoss: { awakened: 'x' } }).trueBoss.awakened, false);
});

test('1回だけ出る: 現れていて未撃破・未演出のときだけ。出したと記録したら二度と出ない（地図を開き直しても）', () => {
  const s = beatenAll();
  assert.equal(trueBossAwakenToShow(cfg, s, stages), true, '最後の章のボスを倒して地図に戻った');
  markAwakened(s);
  assert.equal(s.trueBoss.awakened, true);
  assert.equal(trueBossAwakenToShow(cfg, s, stages), false, '開き直しても繰り返さない');
  assert.equal(trueBossAwakenToShow(cfg, JSON.parse(JSON.stringify(s)), stages), false, '保存して読み直しても');
  assert.equal(trueBossAwakenToShow(cfg, { boss: { a: 1 } }, stages), false, '現れる前（最後の章がまだ）');
  assert.equal(trueBossAwakenToShow({ trueBoss: false }, beatenAll(), stages), false, '真ボスを出さないアプリでは何も起きない');
  assert.equal(trueBossAwakenToShow({}, beatenAll(), stages), false);
  assert.equal(trueBossAwakenToShow(null, beatenAll(), stages), false);
  assert.equal(trueBossAwakenToShow(cfg, beatenAll(), []), false, '章が無ければ現れない');
  assert.equal(trueBossAwakenToShow(cfg, null, stages), false);
});

test('すでに真ボスを倒した人には出さず、記録だけ見たことにする（今の利用者に、知っている出現をあとから見せない）', () => {
  const s = beatenAll({ trueBoss: { wins: 3, seen2: true, lifted: true } }); // 古い記録（awakened の項目なし）
  assert.equal(trueBossAwakenToShow(cfg, s, stages), false, '出さない');
  assert.equal(trueBossAwakenRecordOnly(cfg, s), true, '見たことにだけする対象');
  markAwakened(s);
  assert.equal(trueBossAwakenRecordOnly(cfg, s), false);
  assert.deepEqual(normalizeTrueBoss(s.trueBoss), { wins: 3, seen2: true, lifted: true, awakened: true });
  assert.equal(trueBossAwakenRecordOnly({ trueBoss: false }, { trueBoss: { wins: 1 } }), false, '真ボスを出さないアプリでは触らない');
  assert.equal(trueBossAwakenRecordOnly(cfg, beatenAll()), false, '未撃破の人は演出の対象（記録だけ、ではない）');
  // 演出を見たあとに倒した人: 勝ちを記録しても演出の記録は消えない
  const t = beatenAll();
  markAwakened(t);
  recordTrueBossWin(t);
  assert.equal(normalizeTrueBoss(t.trueBoss).awakened, true);
});

test('入口は、演出を見るまで（または倒したことがあるまで）出さない。復習の画面でも同じ', () => {
  assert.equal(trueBossEntranceReady(beatenAll()), false, '条件を満たしていても、演出の前は出さない');
  assert.equal(trueBossEntranceReady(null), false);
  assert.equal(trueBossEntranceReady({ trueBoss: { awakened: false } }), false);
  const s = beatenAll();
  markAwakened(s);
  assert.equal(trueBossEntranceReady(s), true, '演出のあと');
  assert.equal(trueBossEntranceReady({ trueBoss: { wins: 1 } }), true, 'すでに倒した人は、これまでどおり出る');
  assert.equal(trueBossEntranceReady({ trueBoss: { wins: 0, awakened: 'yes' } }), false);
  // 入口を作る関数（地図と復習の画面が共通で呼ぶ）が、要素を作る前に null を返す
  const view = code('shared/js/views/trueboss.js');
  const place = view.slice(view.indexOf('export function trueBossPlace'), view.indexOf('function buildCrackLayer'));
  assert.match(place, /if \(!trueBossEntranceReady\(app\.state\)\) return null;/);
  assert.ok(place.indexOf('trueBossEntranceReady') < place.indexOf('h('), '要素を作る前に null を返す');
  const home = code('shared/js/views/home.js');
  assert.match(home, /trueBossPlace\(app, '#\/review'\)/, '復習の画面は、記録だけ見る（演出は地図で出す）');
});

// ---- 手順の表 ----
test('時刻の表: 時刻の順で、演出は 5〜7 秒（地図が出てから始めるまでの待ちは別）。入口は文のあと、最後に閉じる', () => {
  const ats = AWAKEN_PLAN.map((s) => s.at);
  assert.deepEqual(ats, [...ats].sort((a, b) => a - b), '時刻の順');
  const last = AWAKEN_PLAN[AWAKEN_PLAN.length - 1];
  assert.equal(last.name, 'end');
  assert.ok(last.at >= 5000 && last.at <= 7000, '5〜7秒: ' + last.at);
  const t = Object.fromEntries(AWAKEN_PLAN.map((s) => [s.name, s.at]));
  assert.ok(t.quake < t.haze && t.haze < t.curse && t.curse < t.bolt && t.bolt < t.shadow && t.shadow < t.text && t.text < t.place && t.place < t.fadeOut && t.fadeOut < t.end, '地鳴り→もや→呪われた地図→稲光→影→文→入口→閉じる');
  assert.ok(t.quakeEnd < t.bolt, '揺れが止まってから稲光');
  assert.ok(AWAKEN_START_MS >= 500, '章の画面から戻る覆いが明けてから始める');
  // 文を1文字ずつ出す時間は、入口が現れるまでに終わる
  const text = trueBossAwakeText(cfg);
  const len = Array.from(text).length;
  assert.ok(t.text + (len - 1) * awakenTextStep(len) < t.place, '文が出終わってから入口');
  assert.ok((len - 1) * awakenTextStep(len) <= AWAKEN_TEXT_MAX_MS);
  assert.ok(99 * awakenTextStep(100) <= AWAKEN_TEXT_MAX_MS, '長めの文（100字）でも上限を超えない');
  assert.equal(awakenPlan(false), AWAKEN_PLAN);
  assert.equal(awakenPlan(true), AWAKEN_PLAN_REDUCED);
});

test('動きを減らす設定の表: 一度に出す（instant）だけ。揺れ・もや・稲光・影・1文字ずつの手順が無い', () => {
  assert.deepEqual(AWAKEN_PLAN_REDUCED.map((s) => s.name), ['instant', 'end']);
  assert.equal(AWAKEN_PLAN_REDUCED[0].at, 0);
  for (const bad of ['quake', 'haze', 'bolt', 'shadow', 'text', 'heartbeat']) assert.ok(!AWAKEN_PLAN_REDUCED.some((s) => s.name === bad), bad);
});

test('表の名前ぜんぶに、手順（handlers）がある', () => {
  const src = code('shared/js/views/awaken.js');
  const body = src.slice(src.indexOf('const handlers = {'), src.indexOf('function begin()'));
  for (const s of [...AWAKEN_PLAN, ...AWAKEN_PLAN_REDUCED]) assert.match(body, new RegExp('\\b' + s.name + '(\\(\\)|,| \\{)'), s.name);
});

// ---- 偽の画面部品・偽の時計で動かす ----
function makeEnv() {
  let now = 0; let seq = 0;
  const timers = [];
  const fakeSetTimeout = (fn, ms) => { const id = ++seq; timers.push({ id, at: now + (ms || 0), fn }); return id; };
  const fakeClearTimeout = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
  const advance = (ms) => {
    const until = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at || a.id - b.id);
      if (!timers.length || timers[0].at > until) break;
      const t = timers.shift();
      now = t.at;
      t.fn();
    }
    now = until;
  };
  const mkEl = (tag) => {
    const cls = new Set();
    const el = {
      tag, children: [], parent: null, attrs: {}, listeners: {}, _text: '', isConnected: false, everAdded: new Set(), scrolled: 0,
      get className() { return [...cls].join(' '); },
      set className(v) { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => cls.add(c)); },
      classList: { add: (...a) => a.forEach((c) => { cls.add(c); el.everAdded.add(c); }), remove: (...a) => a.forEach((c) => cls.delete(c)), has: (c) => cls.has(c) },
      get textContent() { return el._text; },
      set textContent(v) { el._text = String(v); },
      setAttribute(k, v) { el.attrs[k] = v; if (k === 'class') el.className = v; },
      addEventListener(t, f) { (el.listeners[t] = el.listeners[t] || []).push(f); },
      appendChild(c) { c.parent = el; el.children.push(c); c.setConnected(el.isConnected); return c; },
      setConnected(v) { el.isConnected = v; el.children.forEach((k) => k.setConnected(v)); },
      remove() { if (el.parent) { el.parent.children = el.parent.children.filter((x) => x !== el); el.parent = null; } el.setConnected(false); },
      querySelector(sel) {
        const c = sel.slice(1);
        const walk = (n) => { for (const k of n.children) { if (k.classList && k.classList.has(c)) return k; const r = walk(k); if (r) return r; } return null; };
        return walk(el);
      },
      scrollIntoView() { el.scrolled += 1; },
      click() { (el.listeners.click || []).forEach((f) => f({ stopPropagation() {} })); },
    };
    return el;
  };
  const body = mkEl('body');
  body.isConnected = true;
  const winListeners = {};
  const fakeDoc = {
    body,
    createElement: mkEl,
    createElementNS: (ns, tag) => mkEl(tag),
    createTextNode: (t) => ({ nodeType: 3, text: String(t), children: [], setConnected() {}, remove() {} }),
  };
  const fakeWin = {
    addEventListener: (t, f) => { (winListeners[t] = winListeners[t] || []).push(f); },
    removeEventListener: (t, f) => { winListeners[t] = (winListeners[t] || []).filter((x) => x !== f); },
    matchMedia: () => ({ matches: false }),
  };
  const saved = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, document: globalThis.document, window: globalThis.window };
  globalThis.setTimeout = fakeSetTimeout; globalThis.clearTimeout = fakeClearTimeout; globalThis.document = fakeDoc; globalThis.window = fakeWin;
  const restore = () => { globalThis.setTimeout = saved.setTimeout; globalThis.clearTimeout = saved.clearTimeout; globalThis.document = saved.document; globalThis.window = saved.window; };
  const fire = (t) => (winListeners[t] || []).slice().forEach((f) => f());
  const scene = (connected = true) => {
    const rootEl = mkEl('section'); rootEl.isConnected = connected;
    const board = mkEl('div'); const layer = mkEl('div'); layer.classList.add('rising');
    const place = mkEl('div'); place.classList.add('awaken-wait');
    rootEl.appendChild(place); rootEl.appendChild(board); board.appendChild(layer); rootEl.setConnected(connected);
    return { root: rootEl, board, layer, place };
  };
  return { advance, body, restore, fire, scene, timers, now: () => now };
}
const app = { config: cfg, state: { settings: { sound: false, vibrate: false } } };
const overlayOf = (env) => env.body.children.find((c) => c.classList && c.classList.has('awaken-overlay'));

test('演出の手順（動きあり）: 平和な地図のまま待つ → 揺れ → もや → 呪われた地図 → 稲光 → 影 → 文が1文字ずつ → 入口 → 閉じる。最後は呪われた地図と入口が残る', () => {
  const env = makeEnv();
  try {
    const ctl = env.scene();
    runAwakening(ctl, { app, imageUrl: './images/bosses/true-1.webp', reduced: false });
    env.advance(AWAKEN_START_MS - 1);
    assert.equal(overlayOf(env), undefined, '地図が出てすぐは何もしない');
    assert.equal(ctl.board.classList.has('cursed'), false, '平和な地図のまま');
    env.advance(1);
    const ov = overlayOf(env);
    assert.ok(ov, '始まった');
    assert.equal(ctl.root.classList.has('awaken-quake'), true, '地鳴りで揺れる');
    assert.equal(ctl.place.classList.has('awaken-wait'), true, '入口はまだ隠れている');
    assert.equal(ctl.board.classList.has('cursed'), false);
    env.advance(150);
    assert.equal(ov.querySelector('.awaken-haze').classList.has('on'), true, '暗いもやが広がる');
    env.advance(450);
    assert.equal(ctl.board.classList.has('cursed'), true, '呪われた地図に変わる');
    assert.equal(ctl.layer.classList.has('rising'), false);
    env.advance(1700); // 2300
    assert.equal(ctl.root.classList.has('awaken-quake'), false, '揺れは止まる');
    assert.equal(ov.querySelector('.awaken-bolt').classList.has('on'), false);
    env.advance(200); // 2500
    assert.equal(ov.querySelector('.awaken-bolt').classList.has('on'), true, '稲光');
    assert.equal(ov.querySelector('.awaken-shadow').classList.has('on'), false);
    env.advance(300); // 2800
    assert.equal(ov.querySelector('.awaken-shadow').classList.has('on'), true, '影が浮かぶ');
    assert.ok(ov.querySelector('.awaken-eye'), '一つ目が光る');
    env.advance(800); // 3600: 文が始まる
    const tx = ov.querySelector('.awaken-text');
    env.advance(awakenTextStep(Array.from(trueBossAwakeText(cfg)).length) * 3);
    assert.ok(tx.textContent.length >= 1 && tx.textContent.length < trueBossAwakeText(cfg).length, '1文字ずつ出ている途中: ' + tx.textContent);
    env.advance(1300 - awakenTextStep(Array.from(trueBossAwakeText(cfg)).length) * 3); // 4900
    assert.equal(tx.textContent, trueBossAwakeText(cfg), '文が出そろう');
    assert.equal(ctl.place.classList.has('awaken-wait'), true, '文のあとで入口');
    env.advance(100); // 5000
    assert.equal(ctl.place.classList.has('awaken-wait'), false, '入口が現れる');
    assert.equal(ctl.place.classList.has('awaken-in'), true, '光りながら');
    assert.ok(ctl.place.scrolled >= 1, '入口が見える位置へ');
    env.advance(1300); // 6300
    assert.equal(overlayOf(env), undefined, '閉じる');
    assert.equal(ctl.board.classList.has('cursed'), true);
    assert.equal(ctl.place.classList.has('awaken-wait'), false);
    assert.equal(ctl.place.classList.has('awaken-in'), false, '光る動きの class も外れる');
    env.advance(3000);
    assert.equal(env.timers.length, 0, '時計の予約が残らない');
  } finally { env.restore(); }
});

test('タップで飛ばせる: 途中で押すと、すぐ最後の姿（呪われた地図・入口あり・揺れなし・重ねた層なし）。そのあと何も起きない', () => {
  const env2 = makeEnv();
  try {
    const ctl = env2.scene();
    runAwakening(ctl, { app, imageUrl: './x.webp', reduced: false });
    env2.advance(AWAKEN_START_MS + 300); // 揺れの最中
    const ov = overlayOf(env2);
    assert.equal(ctl.root.classList.has('awaken-quake'), true);
    assert.equal(ctl.board.classList.has('cursed'), false);
    ov.click(); // 画面のどこかをタップ
    assert.equal(overlayOf(env2), undefined, '層は消える');
    assert.equal(ctl.board.classList.has('cursed'), true, '呪われた地図');
    assert.equal(ctl.layer.classList.has('rising'), false);
    assert.equal(ctl.root.classList.has('awaken-quake'), false, '揺れは止まる');
    assert.equal(ctl.place.classList.has('awaken-wait'), false, '入口は出ている');
    assert.equal(ctl.place.scrolled, 1, '飛ばしたときも、入口が見える位置へ動かす');
    assert.equal(env2.timers.length, 0, '予約を全部消した');
    env2.advance(20000);
    assert.equal(overlayOf(env2), undefined);
    assert.equal(ctl.root.classList.has('awaken-quake'), false);
  } finally { env2.restore(); }
  // 「とばす」ボタンでも同じ
  const env3 = makeEnv();
  try {
    const ctl = env3.scene();
    runAwakening(ctl, { app, imageUrl: './x.webp', reduced: false });
    env3.advance(AWAKEN_START_MS + 4000);
    const ov = overlayOf(env3);
    const skip = ov.querySelector('.awaken-skip');
    assert.ok(skip, 'とばすボタンがある');
    skip.click();
    assert.equal(overlayOf(env3), undefined);
    assert.equal(ctl.place.classList.has('awaken-wait'), false);
  } finally { env3.restore(); }
});

test('動きを減らす設定: 揺れ・もや・稲光・影・1文字ずつを出さない。呪われた地図と文と入口が一度に出て、少しして閉じる', () => {
  const env = makeEnv();
  try {
    const ctl = env.scene();
    ctl.layer.classList.remove('rising'); // home.js は動きを減らす設定では最初から呪われた地図にする
    ctl.board.classList.add('cursed');
    runAwakening(ctl, { app, imageUrl: './x.webp', reduced: true });
    env.advance(60);
    const ov = overlayOf(env);
    assert.ok(ov && ov.classList.has('calm'));
    assert.equal(ov.querySelector('.awaken-haze'), null);
    assert.equal(ov.querySelector('.awaken-bolt'), null);
    assert.equal(ov.querySelector('.awaken-shadow'), null);
    assert.equal(ctl.root.everAdded.has('awaken-quake'), false, '一度も揺らさない');
    const tx = ov.querySelector('.awaken-text');
    assert.equal(tx.textContent, trueBossAwakeText(cfg), '文は一度に出る');
    assert.equal(ctl.place.classList.has('awaken-wait'), false, '入口も一度に');
    env.advance(3600);
    assert.equal(overlayOf(env), undefined, '閉じる');
    assert.equal(env.timers.length, 0);
  } finally { env.restore(); }
});

test('画面が替わっていた・途中で離れたら、何も出さず（または層を外し）最後の姿だけ整える', () => {
  const env = makeEnv();
  try {
    const ctl = env.scene(false); // 画面に付いていない
    runAwakening(ctl, { app, imageUrl: './x.webp', reduced: false });
    env.advance(AWAKEN_START_MS + 100);
    assert.equal(overlayOf(env), undefined, '層を出さない');
    assert.equal(ctl.place.classList.has('awaken-wait'), false, '入口は隠したままにしない');
    assert.equal(ctl.board.classList.has('cursed'), true);
  } finally { env.restore(); }
  const env2 = makeEnv();
  try {
    const ctl = env2.scene();
    runAwakening(ctl, { app, imageUrl: './x.webp', reduced: false });
    env2.advance(AWAKEN_START_MS + 500);
    assert.ok(overlayOf(env2));
    env2.fire('hashchange'); // ほかの画面へ
    assert.equal(overlayOf(env2), undefined, '離れたら層を残さない');
    assert.equal(ctl.root.classList.has('awaken-quake'), false);
    assert.equal(ctl.place.scrolled, 0, '画面が替わったときは、スクロールしない');
    assert.equal(env2.timers.length, 0);
  } finally { env2.restore(); }
});

test('一覧表示（地図の板が無い）でも、層・文・入口の演出は出る。板が無くても壊れない', () => {
  const env = makeEnv();
  try {
    const ctl = env.scene();
    ctl.board = null; ctl.layer = null;
    runAwakening(ctl, { app, imageUrl: './x.webp', reduced: false });
    env.advance(AWAKEN_START_MS + 6400);
    assert.equal(overlayOf(env), undefined);
    assert.equal(ctl.place.classList.has('awaken-wait'), false);
  } finally { env.restore(); }
});

// ---- 結線・見た目の決まり（文字列で確かめる。見た目そのものは実機で撮る） ----
test('結線: 地図を作るとき、先に記録して保存してから入口を作り、演出の最後まで隠す。動きを減らす設定では最初から呪われた地図', () => {
  const home = code('shared/js/views/home.js');
  assert.match(home, /const awaken = trueBossAwakenToShow\(app\.config, state, data\.tree\.stages\);\n\s*if \(awaken \|\| trueBossAwakenRecordOnly\(app\.config, state\)\) \{ markAwakened\(state\); app\.commit\(\); \}\n\s*const tbPlace = trueBossPlace\(app, '#\/map'\);/, '記録 → 保存 → 入口の順（途中で離れても繰り返さない）');
  assert.match(home, /tbPlace\.classList\.add\('awaken-wait'\)/);
  assert.match(home, /if \(awakenCtl\) runAwakening\(awakenCtl, \{ app, imageUrl: trueBossImageUrl\(1\), reduced: prefersReducedMotion\(\) \}\);/);
  assert.ok(home.indexOf('if (awakenCtl) runAwakening') > home.indexOf('  draw(false);'), '地図を描いてから演出');
  assert.match(home, /const awakening = cursed && !!awakenCtl && !awakenCtl\.used && !prefersReducedMotion\(\);/);
  assert.match(home, /if \(!awakening\) board\.classList\.add\('cursed'\);\n\s*board\.appendChild\(layer\);/, '動きを減らす設定・2回目以降は最初から呪われた地図');
  assert.match(home, /layer\.classList\.add\('rising'\)/);
});

test('見た目: style 属性・インラインの style を使わない（CSP）。動きは class と CSS。動きを減らす設定で止める', () => {
  const src = code('shared/js/views/awaken.js');
  assert.doesNotMatch(src, /\.style\b|style:|innerHTML/);
  const css = read('shared/css/app.css');
  assert.match(css, /\.map-curse\.rising \{ opacity: 0; \}/);
  assert.match(css, /\.boss-place\.awaken-wait \{ visibility: hidden; \}/, '場所は空けたまま隠す（画面がずれない）');
  assert.match(css, /\.awaken-overlay \{[^}]*position: fixed;[^}]*z-index: 96;/);
  assert.match(css, /\.awaken-quake \{ animation: awaken-quake 2\.3s linear; \}/);
  const red = css.slice(css.indexOf('/* 真ボスが現れる演出: 揺れ・もやの広がり'));
  assert.match(red, /\.awaken-quake, \.awaken-bolt\.on, \.awaken-shadow\.on, \.boss-place\.awaken-in \{ animation: none !important; \}/);
  assert.match(red, /\.awaken-haze, \.awaken-overlay, \.awaken-text \{ transition: none; \}/);
});

test('音: 既存の効果音（地鳴り・衝撃・鼓動・現れる音）を、音の設定のまま鳴らす。新しい音のファイルは作らない', () => {
  const src = code('shared/js/views/awaken.js');
  assert.match(src, /rumble\(\) \{ sfx\('rumble'\); \}/);
  assert.match(src, /sfx\('impact'\)/);
  assert.match(src, /heartbeat\(\) \{ sfx\('heartbeat'\); \}/);
  assert.match(src, /playSynth\(settings, 'appear'\)/);
  assert.match(src, /const settings = app && app\.state \? app\.state\.settings : null;/, '音の設定（オフなら鳴らさない）を渡す');
  assert.doesNotMatch(src, /new Audio|\.mp3|\.ogg|\.wav/);
  const snd = read('shared/js/lib/sound.js');
  for (const k of ['rumble', 'impact', 'heartbeat']) assert.match(snd, new RegExp('\\n  ' + k + ': \\{ key:'), k);
  assert.match(read('shared/js/audio.js'), /export function playSfx\(settings, name, onMissing, boost = 1, rate = 1\) \{\n  if \(!settings \|\| !settings\.sound/, '音の設定がオフなら鳴らさない');
});

test('登録: オフラインでも出る（sw-core.js の SHARED）。テストが package.json の一覧に入っている', () => {
  assert.ok(read('shared/sw-core.js').includes("'../shared/js/views/awaken.js'"));
  assert.ok(read('shared/package.json').includes('tests/awaken.test.js'));
});

test('利用者の画面に、開発用の語（ID・段階の記号・未実装）を出さない', () => {
  assert.doesNotMatch(code('shared/js/views/awaken.js'), /(UC|SCR|TST|LAW)-\d|§\d|\bMVP\b|\bP[0-9]\b|未実装|未対応|TODO|\(仮\)|（仮）/);
});
