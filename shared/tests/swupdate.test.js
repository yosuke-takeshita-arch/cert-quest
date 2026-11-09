// タイトル画面で新しい版の保存を待つ・帯は問題が本当に変わったときだけ（決まりは 要件定義書 3-2-c「見直し」。2026-11-09 先生）。
// 実行: cd shared && node --test tests/swupdate.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './apps.js';
import { waitForSwUpdate, dataFingerprint, parseProgress, monotonicFraction, SW_UPDATING_TEXT, CHECK_TIMEOUT_MS, INSTALL_TIMEOUT_MS } from '../js/lib/swupdate.js';

/** navigator.serviceWorker の偽物。found: update() で新しい版が見つかるか。swapAfter: 見つかってから入れ替わるまでの ms（null なら入れ替わらない） */
function fakeSw({ controller = true, found = false, swapAfter = 10, updateRejects = false, updateHangs = false, alreadyInstalling = false, registerRejects = false } = {}) {
  const listeners = [];
  const msgListeners = [];
  const reg = {
    installing: alreadyInstalling ? {} : null,
    waiting: null,
    update() {
      if (updateRejects) return Promise.reject(new Error('offline'));
      if (updateHangs) return new Promise(() => {});
      if (found) reg.installing = {};
      return Promise.resolve();
    },
  };
  const sw = {
    controller: controller ? {} : null,
    register: () => (registerRejects ? Promise.reject(new Error('x')) : Promise.resolve(reg)),
    addEventListener: (t, f) => { if (t === 'controllerchange') listeners.push(f); if (t === 'message') msgListeners.push(f); },
    removeEventListener: (t, f) => { const i = msgListeners.indexOf(f); if (t === 'message' && i >= 0) msgListeners.splice(i, 1); },
    startMessages() {},
    emit: (data) => { for (const f of msgListeners.slice()) f({ data }); },
    msgCount: () => msgListeners.length,
  };
  if ((found || alreadyInstalling) && swapAfter != null) {
    setTimeout(() => { reg.installing = null; for (const f of listeners.splice(0)) f(); }, swapAfter);
  }
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
