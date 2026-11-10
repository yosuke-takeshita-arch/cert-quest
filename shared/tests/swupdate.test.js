// タイトル画面で新しい版の保存を待つ・帯は問題が本当に変わったときだけ（決まりは 要件定義書 3-2-c「見直し」。2026-11-09 先生）。
// 実行: cd shared && node --test tests/swupdate.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './apps.js';
import { waitForSwUpdate, dataFingerprint, parseProgress, monotonicFraction, SW_UPDATING_TEXT, CHECK_TIMEOUT_MS, INSTALL_TIMEOUT_MS } from '../js/lib/swupdate.js';

const realSetTimeout = globalThis.setTimeout; // 偽物の中の待ちは、これで動かす（下の「時間の上限が残らない」のテストが setTimeout を数えるため）
const later = (ms, f) => realSetTimeout(f, ms);
const sleep = (ms) => new Promise((r) => later(ms, r));

/** 受け取り中の service worker の偽物。set('redundant') などで状態を変えると、聞いている人に知らせる */
function fakeWorker(state = 'installing') {
  const ls = [];
  const w = {
    state,
    addEventListener: (t, f) => { if (t === 'statechange') ls.push(f); },
    removeEventListener: (t, f) => { const i = ls.indexOf(f); if (t === 'statechange' && i >= 0) ls.splice(i, 1); },
    set(s) { w.state = s; for (const f of ls.slice()) f({ target: w }); },
    count: () => ls.length,
  };
  return w;
}

/**
 * navigator.serviceWorker の偽物。found: update() で新しい版が見つかるか。swapAfter: 見つかってから入れ替わるまでの ms（null なら入れ替わらない）
 * failAfter: 見つかってから受け取りが失敗する（redundant になる）までの ms。keepRef: 失敗の知らせの時点で、reg.installing がまだ失敗したものを指したまま（本物のブラウザの順番）
 * count(): いま聞いている数（入れ替わり・進み具合・新しい版の見つかり・状態の変わり目の合計）。抜けたあとは 0 のはず
 */
function fakeSw({ controller = true, found = false, swapAfter = 10, updateRejects = false, updateHangs = false, alreadyInstalling = false, registerRejects = false, failAfter = null, keepRef = false } = {}) {
  const ls = { controllerchange: [], message: [] };
  const regLs = [];
  const workers = [];
  const mkWorker = (state) => { const w = fakeWorker(state); workers.push(w); return w; };
  const reg = {
    installing: null,
    waiting: null,
    active: null,
    addEventListener: (t, f) => { if (t === 'updatefound') regLs.push(f); },
    removeEventListener: (t, f) => { const i = regLs.indexOf(f); if (t === 'updatefound' && i >= 0) regLs.splice(i, 1); },
    update() {
      if (updateRejects) return Promise.reject(new Error('offline'));
      if (updateHangs) return new Promise(() => {});
      if (found) sw.find();
      return Promise.resolve();
    },
  };
  const sw = {
    controller: controller ? {} : null,
    reg,
    register: () => (registerRejects ? Promise.reject(new Error('x')) : Promise.resolve(reg)),
    addEventListener: (t, f) => { if (ls[t]) ls[t].push(f); },
    removeEventListener: (t, f) => { const i = ls[t] ? ls[t].indexOf(f) : -1; if (i >= 0) ls[t].splice(i, 1); },
    startMessages() {},
    emit: (data) => { for (const f of ls.message.slice()) f({ data }); },
    msgCount: () => ls.message.length,
    count: () => ls.controllerchange.length + ls.message.length + regLs.length + workers.reduce((n, w) => n + w.count(), 0),
    mkWorker,
    /** 新しい版が見つかる（reg.installing に入り、updatefound を知らせる） */
    find() {
      const w = mkWorker('installing');
      reg.installing = w;
      for (const f of regLs.slice()) f();
      schedule(w);
      return w;
    },
    /** 入れ替わる（controllerchange を知らせる） */
    swap() { for (const f of ls.controllerchange.slice()) f(); },
  };
  /** 受け取りが失敗する。本物では、状態が redundant に変わった知らせが先で、reg.installing が空になるのはそのあと */
  const fail = (w) => {
    if (keepRef) { w.set('redundant'); later(1, () => { if (reg.installing === w) reg.installing = null; }); } else { reg.installing = null; w.set('redundant'); }
  };
  function schedule(w) {
    if (failAfter != null) later(failAfter, () => fail(w));
    else if (swapAfter != null) later(swapAfter, () => { reg.installing = null; reg.active = w; w.set('activating'); sw.swap(); w.set('activated'); });
  }
  sw.fail = fail;
  if (alreadyInstalling) { const w = mkWorker('installing'); reg.installing = w; schedule(w); }
  return sw;
}

test('新しい版があれば、入れ替わるまで待ち、「受け取り中」を1回出す', async () => {
  let notes = 0;
  const r = await waitForSwUpdate(fakeSw({ found: true }), { onUpdating: () => notes++ });
  assert.equal(r.state, 'updated');
  assert.equal(notes, 1);
});

test('すでに受け取りが始まっていても（開いたとき自動で確かめられた）、入れ替わるまで待つ', async () => {
  const r = await waitForSwUpdate(fakeSw({ alreadyInstalling: true }));
  assert.equal(r.state, 'updated');
});

test('新しい版が無ければ待たない。「受け取り中」も出さない', async () => {
  let notes = 0;
  const r = await waitForSwUpdate(fakeSw({ found: false }), { onUpdating: () => notes++ });
  assert.equal(r.state, 'none');
  assert.equal(notes, 0);
});

test('初めて入れたとき（controller が無い）は待たない', async () => {
  const r = await waitForSwUpdate(fakeSw({ controller: false, found: true, swapAfter: null }));
  assert.equal(r.state, 'first');
});

test('電波が無い（確かめが失敗）ときは待たずに始める', async () => {
  assert.equal((await waitForSwUpdate(fakeSw({ updateRejects: true }))).state, 'error');
  assert.equal((await waitForSwUpdate(fakeSw({ registerRejects: true }))).state, 'error');
});

test('確かめが返ってこないときは上限で打ち切る', async () => {
  const r = await waitForSwUpdate(fakeSw({ updateHangs: true }), { checkMs: 30 });
  assert.equal(r.state, 'timeout');
});

test('受け取りが終わらないときは上限で打ち切る（いまの版で始める）', async () => {
  const r = await waitForSwUpdate(fakeSw({ found: true, swapAfter: null }), { installMs: 30 });
  assert.equal(r.state, 'timeout');
});

// ---- 受け取りが途中で失敗したら、上限（45秒）を待たずに、いまの版で始める（2026-11-10） ----
// どのテストも、上限は長いまま（installMs 3000。本番は 45000）にして、「上限より前に返ること」を時間で確かめる。

test('受け取りが失敗したら、上限を待たずに failed を返す（update で見つかり、そのあと失敗）', async () => {
  for (const keepRef of [false, true]) {
    let notes = 0;
    const sw = fakeSw({ found: true, failAfter: 20, keepRef });
    const t0 = Date.now();
    const r = await waitForSwUpdate(sw, { onUpdating: () => notes++, installMs: 3000 });
    assert.equal(r.state, 'failed', 'keepRef=' + keepRef);
    assert.ok(Date.now() - t0 < 1000, '上限を待っている: ' + (Date.now() - t0) + 'ms');
    assert.equal(notes, 1, '失敗する前に「受け取り中」は出ている');
    assert.equal(sw.count(), 0, '聞くのを全部やめる');
  }
});

test('開いた時点でもう受け取りが始まっていて、それが失敗したときも failed', async () => {
  for (const keepRef of [false, true]) {
    const sw = fakeSw({ alreadyInstalling: true, failAfter: 20, keepRef });
    const t0 = Date.now();
    const r = await waitForSwUpdate(sw, { installMs: 3000 });
    assert.equal(r.state, 'failed', 'keepRef=' + keepRef);
    assert.ok(Date.now() - t0 < 1000);
    assert.equal(sw.count(), 0);
  }
});

test('開いた時点で、失敗したもの（redundant）が reg.installing に残っているだけなら、待たずに failed（「受け取り中」は出さない）', async () => {
  const sw = fakeSw({});
  sw.reg.installing = sw.mkWorker('redundant');
  let notes = 0;
  const r = await waitForSwUpdate(sw, { onUpdating: () => notes++, installMs: 3000 });
  assert.equal(r.state, 'failed');
  assert.equal(notes, 0);
  assert.equal(sw.count(), 0);
});

test('確かめている途中で見つかり（updatefound）、確かめが返る前に失敗したとき: failed（「受け取り中」は出さない）', async () => {
  for (const keepRef of [false, true]) {
    const sw = fakeSw({ failAfter: 5, keepRef });
    sw.reg.update = () => new Promise((resolve) => { later(10, () => sw.find()); later(40, resolve); });
    let notes = 0;
    const t0 = Date.now();
    const r = await waitForSwUpdate(sw, { onUpdating: () => notes++, installMs: 3000 });
    assert.equal(r.state, 'failed', 'keepRef=' + keepRef);
    assert.ok(Date.now() - t0 < 1000);
    assert.equal(notes, 0);
    assert.equal(sw.count(), 0);
  }
});

test('見つかったその場で失敗したとき（確かめが返る前に、もう redundant）: failed', async () => {
  const sw = fakeSw({});
  sw.reg.update = () => { const w = sw.find(); sw.fail(w); return Promise.resolve(); };
  const r = await waitForSwUpdate(sw, { installMs: 3000 });
  assert.equal(r.state, 'failed');
  assert.equal(sw.count(), 0);
});

test('確かめが上限で打ち切られたあとに見つかった版が失敗したときも、上限を待たない', async () => {
  // 確かめ（update）は返ってこないが、その間に新しい版が見つかって受け取りが始まり、失敗する
  const sw = fakeSw({ failAfter: 60 });
  sw.reg.update = () => { later(10, () => sw.find()); return new Promise(() => {}); };
  const t0 = Date.now();
  const r = await waitForSwUpdate(sw, { checkMs: 30, installMs: 3000 });
  assert.equal(r.state, 'failed');
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(sw.count(), 0);
});

test('古い待ちの版が、新しい版に置き換わって redundant になっただけなら、失敗にしない（入れ替わりまで待つ）', async () => {
  const sw = fakeSw({});
  const w1 = sw.mkWorker('installed');
  const w2 = sw.mkWorker('installing');
  sw.reg.waiting = w1;
  sw.reg.installing = w2;
  // w2 の受け取りが終わる → w2 が待ちになり、w1 は捨てられる → w2 が動き始める → 少しあとで入れ替わりの知らせ
  later(10, () => { sw.reg.installing = null; sw.reg.waiting = w2; w2.set('installed'); w1.set('redundant'); });
  later(30, () => { sw.reg.waiting = null; sw.reg.active = w2; w2.set('activating'); });
  later(60, () => { sw.swap(); w2.set('activated'); });
  const r = await waitForSwUpdate(sw, { installMs: 3000 });
  assert.equal(r.state, 'updated');
  assert.equal(sw.count(), 0);
});

test('どの出口でも、聞いていたものを全部やめる', async () => {
  const cases = [
    ['updated', () => fakeSw({ found: true }), {}],
    ['updated', () => fakeSw({ alreadyInstalling: true }), {}],
    ['none', () => fakeSw({ found: false }), {}],
    ['error', () => fakeSw({ updateRejects: true }), {}],
    ['timeout', () => fakeSw({ updateHangs: true }), { checkMs: 20 }],
    ['timeout', () => fakeSw({ found: true, swapAfter: null }), { installMs: 20 }],
    ['failed', () => fakeSw({ found: true, failAfter: 10 }), { installMs: 3000 }],
  ];
  for (const [want, make, opts] of cases) {
    const sw = make(); // 使う直前に作る（偽物の中の時間は、作ったときから進む）
    const r = await waitForSwUpdate(sw, opts);
    assert.equal(r.state, want);
    assert.equal(sw.count(), 0, want + ' で抜けたあとに聞いているものが残っている');
  }
});

test('抜けたあとに、時間の上限（タイマー）が残らない（残ると、このテストのファイルが45秒終わらない）', async () => {
  const live = new Set();
  const st = globalThis.setTimeout;
  const ct = globalThis.clearTimeout;
  globalThis.setTimeout = (f, ms, ...a) => { const id = st(f, ms, ...a); live.add(id); return id; };
  globalThis.clearTimeout = (id) => { live.delete(id); return ct(id); };
  try {
    for (const sw of [fakeSw({ found: true }), fakeSw({ found: false }), fakeSw({ found: true, failAfter: 10 }), fakeSw({ updateRejects: true })]) {
      await waitForSwUpdate(sw); // 上限は本番のまま（確かめ 5秒・受け取り 45秒）
      assert.equal(live.size, 0, '止めていないタイマーが ' + live.size + ' 個ある');
    }
  } finally {
    globalThis.setTimeout = st;
    globalThis.clearTimeout = ct;
    for (const id of live) ct(id);
  }
});

test('上限の長さと文言', () => {
  assert.equal(CHECK_TIMEOUT_MS, 5000);
  assert.equal(INSTALL_TIMEOUT_MS, 45000);
  assert.equal(SW_UPDATING_TEXT, '新しい版をダウンロード中…');
});

test('ダウンロードの進み具合を受け取って渡す。入れ替わったら聞くのをやめる', async () => {
  const sw = fakeSw({ found: true, swapAfter: 40 });
  const got = [];
  const run = waitForSwUpdate(sw, { onProgress: (p) => got.push(p) });
  await new Promise((r) => setTimeout(r, 10));
  sw.emit({ type: 'cq-install-progress', done: 3, total: 10 });
  sw.emit({ type: 'ほかの知らせ', done: 1, total: 2 });
  sw.emit({ type: 'cq-install-progress', done: 10, total: 10 });
  assert.equal((await run).state, 'updated');
  assert.deepEqual(got, [{ done: 3, total: 10 }, { done: 10, total: 10 }]);
  assert.equal(sw.msgCount(), 0, '聞くのをやめる');
});

test('進み具合の知らせの読み方: 形が違うものは捨てる。done は total を超えない', () => {
  assert.equal(parseProgress(null), null);
  assert.equal(parseProgress({ type: 'x', done: 1, total: 2 }), null);
  assert.equal(parseProgress({ type: 'cq-install-progress', done: 1, total: 0 }), null);
  assert.equal(parseProgress({ type: 'cq-install-progress', done: -1, total: 3 }), null);
  assert.equal(parseProgress({ type: 'cq-install-progress', done: 'a', total: 3 }), null);
  assert.deepEqual(parseProgress({ type: 'cq-install-progress', done: 5, total: 3 }), { done: 3, total: 3 });
});

test('ゲージは戻らない（総数があとから増えても）', () => {
  const fr = monotonicFraction();
  assert.equal(fr({ done: 5, total: 10 }), 0.5);
  assert.equal(fr({ done: 6, total: 40 }), 0.5, '総数が増えて割合が下がっても、前の値のまま');
  assert.equal(fr({ done: 30, total: 40 }), 0.75);
  assert.equal(fr({ done: 40, total: 40 }), 1);
});

test('sw-core.js: 取るたびに数え、画面へ知らせる。本体は1つでも取れなければ失敗のまま', () => {
  const sw = readFileSync(join(root, 'shared/sw-core.js'), 'utf8');
  assert.ok(sw.includes("type: 'cq-install-progress'"));
  assert.ok(sw.includes('includeUncontrolled: true'), 'まだ自分が動かしていない画面にも知らせる');
  const install = sw.slice(sw.indexOf("self.addEventListener('install'"));
  assert.ok(install.includes('await cache.addAll([new Request(u'), '本体は addAll で取る（取れなければ失敗）');
  assert.ok(install.indexOf('prefetchData(cache, dir)') < install.indexOf('core.map('), 'データを先に取り、総数をはやく決める');
  assert.ok(install.indexOf('progressSend(true)') < install.indexOf('skipWaiting()'));
  const pre = sw.slice(sw.indexOf('async function prefetchData'), sw.indexOf("self.addEventListener('install'"));
  assert.ok((pre.match(/progressTick\(\);/g) || []).length >= 6, 'データ・ボス・真ボス・基礎のことば・図のそれぞれで数える');
  assert.ok(pre.includes('progressAdd(figureIds.size)'));
});

test('データの指紋: 同じなら同じ、問題が1問増えても・解説が1文字変わっても違う。カードの違いも見る', () => {
  const a = { questions: [{ id: 'q1', explanation: 'あ' }], concepts: [{ id: 'c1' }] };
  const same = JSON.parse(JSON.stringify(a));
  assert.equal(dataFingerprint(a), dataFingerprint(same));
  assert.notEqual(dataFingerprint(a), dataFingerprint({ ...a, questions: [...a.questions, { id: 'q2' }] }));
  assert.notEqual(dataFingerprint(a), dataFingerprint({ ...a, questions: [{ id: 'q1', explanation: 'い' }] }));
  assert.notEqual(dataFingerprint(a), dataFingerprint({ ...a, concepts: [{ id: 'c2' }] }));
});

test('結線: タイトル画面で待ってから読む。遊んでいる間の入れ替わりは、読み直して比べ、同じなら帯を出さない。新ファイルを先取りする', () => {
  const app = readFileSync(join(root, 'shared/js/app.js'), 'utf8');
  const wait = app.indexOf('await waitForSwUpdate(navigator.serviceWorker');
  const load = app.indexOf('loaded = await loadFor(curSub');
  const ready = app.indexOf('await title.ready(');
  assert.ok(wait > 0 && wait < load && load < ready, '待つ → データを読む → タップの順');
  assert.ok(app.includes('title.setNote(SW_UPDATING_TEXT)'));
  assert.ok(app.includes('title.setDownload(dlFraction(p), p.done, p.total, SW_UPDATING_TEXT)'));
  const onChange = app.slice(app.indexOf("addEventListener('controllerchange'"));
  const body = onChange.slice(0, onChange.indexOf('\n    });'));
  assert.ok(body.includes('dataFingerprint(fresh.data) === dataFingerprint(shown)'));
  assert.ok(body.indexOf('if (same) return;') < body.indexOf('showUpdateNotice()'), '同じなら帯の前で抜ける');
  const title = readFileSync(join(root, 'shared/js/views/title.js'), 'utf8');
  assert.ok(title.includes('setNote(text)') && title.includes('setDownload(fraction, done, total, label)'));
  const sw = readFileSync(join(root, 'shared/sw-core.js'), 'utf8');
  assert.ok(sw.includes("'../shared/js/lib/swupdate.js'"));
});
