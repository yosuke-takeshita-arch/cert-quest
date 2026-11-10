// 画面が見えている間だけ進む時計（js/lib/pauseclock.js。2026-11-10 の決定）:
// 時間制限のある場面（秒数チャレンジ・どっち？早押し・真ボスの時間制限の技・模擬試験）は、アプリを裏に回している間、時計を止める。
// 実行: cd shared && node --test tests/pauseclock.test.js
// 見ていないもの: 本物のブラウザ・スマホが、裏に回したときに出来事（visibilitychange 等）を本当に届けるか。ここでは偽の document・window で出来事を作っている
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPauseClock, installPauseClock, visibleNow, HEARTBEAT_MS, MAX_GAP_MS } from '../js/lib/pauseclock.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(shared, p), 'utf8');

/** 手で進める時刻。 */
function fakeTime(start = 1000000) {
  let t = start;
  return { now: () => t, add: (ms) => { t += ms; }, set: (v) => { t = v; } };
}

/** 出来事を受け取れる偽の相手（document・window の代わり）。 */
function fakeTarget(extra = {}) {
  const ls = new Map();
  return {
    ...extra,
    addEventListener(type, fn) {
      if (!ls.has(type)) ls.set(type, new Set());
      ls.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      if (ls.has(type)) ls.get(type).delete(fn);
    },
    fire(type) {
      [...(ls.get(type) || [])].forEach((fn) => fn({ type }));
    },
    count() {
      let n = 0;
      ls.forEach((s) => { n += s.size; });
      return n;
    },
  };
}

/** 偽の document と window。beat() で、時計を確かめ直すタイマーを1回鳴らす。 */
function fakePage() {
  const doc = fakeTarget({ visibilityState: 'visible' });
  const timers = new Map();
  let seq = 0;
  const win = fakeTarget({
    setInterval(fn, ms) {
      seq += 1;
      timers.set(seq, { fn, ms });
      return seq;
    },
    clearInterval(id) {
      timers.delete(id);
    },
  });
  const beat = () => [...timers.values()].forEach((t) => t.fn());
  const hide = () => { doc.visibilityState = 'hidden'; doc.fire('visibilitychange'); };
  const show = () => { doc.visibilityState = 'visible'; doc.fire('visibilitychange'); };
  return { doc, win, timers, beat, hide, show };
}

test('createPauseClock: 動いている間だけ進む。止めている間は進まず、動かすと続きから', () => {
  const T = fakeTime();
  const c = createPauseClock({ now: T.now });
  assert.equal(c.now(), 0);
  assert.equal(c.running, true);
  T.add(3000);
  assert.equal(c.now(), 3000);
  c.pause();
  assert.equal(c.running, false);
  T.add(45000);
  assert.equal(c.now(), 3000, '止めている間は進まない');
  c.resume();
  assert.equal(c.now(), 3000, '動かした瞬間は、止める前のまま');
  T.add(2000);
  assert.equal(c.now(), 5000, '続きから進む');
});

test('createPauseClock: 何回止めて動かしても、動いていた時間の合計だけになる', () => {
  const T = fakeTime();
  const c = createPauseClock({ now: T.now });
  let want = 0;
  for (let i = 0; i < 200; i++) {
    T.add(7 + (i % 5)); // 動いている
    want += 7 + (i % 5);
    c.pause();
    T.add(1000 + i * 13); // 止まっている
    c.resume();
  }
  assert.equal(c.now(), want);
});

test('createPauseClock: 止めた状態で作れる。pause・resume を続けて2回呼んでも変わらない', () => {
  const T = fakeTime();
  const c = createPauseClock({ now: T.now, running: false });
  assert.equal(c.running, false);
  T.add(5000);
  assert.equal(c.now(), 0);
  c.pause();
  c.pause();
  T.add(5000);
  assert.equal(c.now(), 0);
  c.resume();
  T.add(400);
  c.resume(); // 動いている最中にもう一度呼んでも、それまでの分は消えない
  T.add(600);
  assert.equal(c.now(), 1000);
});

test('時間切れにならない: 40秒の問題を3秒見て、45秒止めて、戻ると残り37秒（止めている間にタイマーが遅れて鳴っても同じ）', () => {
  const T = fakeTime();
  const c = createPauseClock({ now: T.now });
  const LIMIT = 40;
  const t0 = c.now(); // 問題を出した
  const left = () => Math.max(0, LIMIT - (c.now() - t0) / 1000);
  T.add(3000);
  assert.equal(left(), 37);
  c.pause();
  for (let i = 0; i < 45; i++) {
    T.add(1000);
    assert.equal(left(), 37, '止めている間に画面のタイマーが鳴っても、残りは減らない（時間切れにしない）');
  }
  c.resume();
  assert.equal(left(), 37);
  T.add(1000);
  assert.equal(left(), 36);
  assert.ok((c.now() - t0) / 1000 <= LIMIT, '「制限時間の中で正解」の判定も、同じ時計（4秒）で見る');
  assert.equal((c.now() - t0) / 1000, 4);
});

test('createPauseClock: maxGap より長く空いた分は数えない（出来事が届かずに止められたときの守り）。時刻が戻ったときも数えない', () => {
  const T = fakeTime();
  const c = createPauseClock({ now: T.now, maxGap: 5000 });
  T.add(5000);
  assert.equal(c.now(), 5000, 'ちょうど maxGap は数える');
  T.add(5001);
  assert.equal(c.now(), 5000, 'maxGap を超えたら、その間は止まっていたものとする');
  T.add(1000);
  assert.equal(c.now(), 6000, 'そのあとはふつうに進む');
  T.add(-3000);
  assert.equal(c.now(), 6000, '端末の時計が戻っても、減らない');
  T.add(500);
  assert.equal(c.now(), 6500);
  const d = createPauseClock({ now: T.now }); // 守りなし
  T.add(3600000);
  assert.equal(d.now(), 3600000);
});

test('installPauseClock: 裏に回る（hidden）と止まり、戻る（visible）と動く', () => {
  const T = fakeTime();
  const P = fakePage();
  const c = createPauseClock({ now: T.now });
  installPauseClock(c, { doc: P.doc, win: P.win });
  T.add(2000);
  P.hide();
  assert.equal(c.running, false);
  T.add(60000);
  assert.equal(c.now(), 2000);
  P.show();
  assert.equal(c.running, true);
  T.add(1500);
  assert.equal(c.now(), 3500);
});

test('installPauseClock: pagehide・freeze でも止まり、pageshow・resume で画面が見えていれば動く（見えていなければ止まったまま）', () => {
  const T = fakeTime();
  const P = fakePage();
  const c = createPauseClock({ now: T.now });
  installPauseClock(c, { doc: P.doc, win: P.win });
  P.win.fire('pagehide');
  assert.equal(c.running, false);
  T.add(9000);
  P.win.fire('pageshow');
  assert.equal(c.running, true);
  assert.equal(c.now(), 0);
  P.doc.fire('freeze');
  assert.equal(c.running, false);
  P.doc.fire('resume');
  assert.equal(c.running, true);
  // 画面が見えていないのに pageshow・resume が来ても、動かさない
  P.doc.visibilityState = 'hidden';
  P.win.fire('pagehide');
  P.win.fire('pageshow');
  assert.equal(c.running, false);
  P.doc.fire('resume');
  assert.equal(c.running, false);
});

test('installPauseClock: 出来事を取りこぼしても、次の確かめ（' + HEARTBEAT_MS + 'ミリ秒ごと）で画面の状態に合わせる', () => {
  const T = fakeTime();
  const P = fakePage();
  const c = createPauseClock({ now: T.now });
  installPauseClock(c, { doc: P.doc, win: P.win });
  assert.equal(P.timers.size, 1);
  assert.equal([...P.timers.values()][0].ms, HEARTBEAT_MS);
  P.doc.visibilityState = 'hidden'; // 出来事は来ない
  T.add(1000);
  P.beat();
  assert.equal(c.running, false, '確かめで止まる');
  T.add(30000);
  P.beat();
  assert.equal(c.now(), 1000);
  P.doc.visibilityState = 'visible'; // 出来事は来ない
  P.beat();
  assert.equal(c.running, true, '確かめで動く');
  T.add(500);
  assert.equal(c.now(), 1500);
});

test('installPauseClock: 確かめのたびに時計を読むので、だれも読んでいなくても見えていた時間は数える。確かめごと止まっていた（端末が眠った）分は数えない', () => {
  const T = fakeTime();
  const P = fakePage();
  const c = createPauseClock({ now: T.now, maxGap: MAX_GAP_MS });
  installPauseClock(c, { doc: P.doc, win: P.win });
  for (let i = 0; i < 20; i++) {
    T.add(HEARTBEAT_MS);
    P.beat();
  }
  assert.equal(c.now(), 20 * HEARTBEAT_MS, 'MAX_GAP_MS より長い時間でも、見えていれば全部数える');
  T.add(10 * 60000); // 出来事も確かめも無いまま10分（止められていた）
  P.beat();
  assert.equal(c.now(), 20 * HEARTBEAT_MS, '止められていた10分は数えない');
  assert.ok(MAX_GAP_MS > HEARTBEAT_MS * 2, '確かめが少し遅れただけで時間を落とさない幅がある');
});

test('installPauseClock: 戻り値を呼ぶと、つなぎ（出来事とタイマー）が全部外れる', () => {
  const T = fakeTime();
  const P = fakePage();
  const c = createPauseClock({ now: T.now });
  const stop = installPauseClock(c, { doc: P.doc, win: P.win });
  assert.equal(P.doc.count(), 3, 'document: visibilitychange・freeze・resume');
  assert.equal(P.win.count(), 2, 'window: pagehide・pageshow');
  stop();
  assert.equal(P.doc.count(), 0);
  assert.equal(P.win.count(), 0);
  assert.equal(P.timers.size, 0);
  P.hide();
  assert.equal(c.running, true, '外したあとは止まらない');
});

test('visibleNow: document が無い所（テスト）でも落ちない。0 から始まり、戻らない', () => {
  const a = visibleNow();
  const b = visibleNow();
  assert.ok(Number.isFinite(a) && a >= 0);
  assert.ok(a < 60000, '日付の値（Date.now()）ではない');
  assert.ok(b >= a);
});

test('結線: 時間制限のある4つの画面が同じ時計（visibleNow）を読む。問題の時間を Date.now() の差で数えていない', () => {
  for (const f of ['js/views/play.js', 'js/views/dochi.js', 'js/views/trueboss.js', 'js/views/exam.js']) {
    const s = src(f);
    assert.ok(s.includes("import { visibleNow } from '../lib/pauseclock.js';"), f + ' が pauseclock.js を読んでいない');
    assert.ok(!s.includes('S.t0 = Date.now()'), f + ': 問題を出した時刻を Date.now() で取っている');
    assert.ok(!s.includes('Date.now() - S.t0'), f + ': 使った時間を Date.now() の差で数えている');
    assert.ok(!s.includes('S.deadline - Date.now()'), f + ': 残り時間を Date.now() との差で数えている');
  }
  // 残りの表示・時間切れ・経験値の判定（seconds）が、同じ S.t0 から作られている
  const play = src('js/views/play.js');
  assert.ok(play.includes('S.t0 = visibleNow();'));
  assert.ok(play.includes('const sec = (visibleNow() - S.t0) / 1000;'), '残りの表示と時間切れ');
  assert.ok(play.includes('const seconds = (visibleNow() - S.t0) / 1000;'), '答えたときの秒数（経験値の判定に渡す）');
  const dochi = src('js/views/dochi.js');
  assert.ok(dochi.includes('S.t0 = visibleNow();'));
  assert.ok(dochi.includes('(visibleNow() - S.t0) / 1000'));
  const tb = src('js/views/trueboss.js');
  assert.ok(tb.includes('S.t0 = visibleNow();'));
  assert.ok(tb.includes('lim - (visibleNow() - t0) / 1000'), '時間制限の技の残り');
  assert.ok(tb.includes('const seconds = (visibleNow() - S.t0) / 1000;'), '時間切れ・経験値・会心の判定');
  const exam = src('js/views/exam.js');
  assert.ok(exam.includes('mmss(S.deadline - visibleNow())'), '残り時間の表示');
  assert.ok(exam.includes('const left = S.deadline - visibleNow();'), '時間切れの判定');
  assert.ok(exam.includes('Math.round((visibleNow() - S.t0) / 60000)'), '記録に残す、かかった分');
});

test('登録: 時計はオフラインでも出る（sw-core.js の SHARED）。テストが package.json の一覧に入っている', () => {
  assert.ok(src('sw-core.js').includes("'../shared/js/lib/pauseclock.js'"), 'pauseclock.js が sw-core.js の SHARED に無い（電波なしで、時間制限のある画面が開けない）');
  assert.ok(src('package.json').includes('tests/pauseclock.test.js'), 'tests/pauseclock.test.js が package.json の一覧に無い');
});
