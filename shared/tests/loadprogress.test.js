// タイトル画面のゲージの数え方。ブラウザは使わない。
// 実行: cd shared && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countDataFiles, fraction, createLoadTracker } from '../js/lib/loadprogress.js';
import { loadData } from '../js/lib/data.js';

const ok = (json) => ({ ok: true, status: 200, json: async () => json, clone() { return this; } });
const ng = (status) => ({ ok: false, status, json: async () => ({}), clone() { return this; } });

test('countDataFiles: index.json 自身 + syllabus + questions + concepts', () => {
  assert.equal(countDataFiles({ syllabus: 's.json', questions: ['a', 'b'], concepts: ['c'] }), 5);
  assert.equal(countDataFiles({ questions: ['a'] }), 2);
  assert.equal(countDataFiles({ syllabus: 's.json', questions: [], concepts: [] }), 2);
});

test('countDataFiles: 文字列でないものは数えない。形が崩れていたら1', () => {
  assert.equal(countDataFiles({ syllabus: 5, questions: ['a', 3, null], concepts: 'x' }), 2);
  assert.equal(countDataFiles(null), 1);
  assert.equal(countDataFiles([]), 1);
  assert.equal(countDataFiles('x'), 1);
});

test('fraction: 0〜1。総数が分からない・0・負・NaN は0、超えたら1', () => {
  assert.equal(fraction(0, 10), 0);
  assert.equal(fraction(5, 10), 0.5);
  assert.equal(fraction(10, 10), 1);
  assert.equal(fraction(11, 10), 1);
  assert.equal(fraction(3, null), 0);
  assert.equal(fraction(3, 0), 0);
  assert.equal(fraction(3, -1), 0);
  assert.equal(fraction(NaN, 10), 0);
  assert.equal(fraction(-2, 10), 0);
});

test('tracker: 最初の応答(index.json)で総数が分かる。それまでは割合0。進むたびに通知', async () => {
  const seen = [];
  const t = createLoadTracker((s) => seen.push(s));
  const idx = { syllabus: 's.json', questions: ['q1.json', 'q2.json'], concepts: ['c1.json'] };
  const f = t.wrap(async (u) => (u.endsWith('index.json') ? ok(idx) : ok([])));
  assert.deepEqual(t.state(), { done: 0, total: null, fraction: 0 });
  await f('http://x/index.json');
  assert.deepEqual(t.state(), { done: 1, total: 5, fraction: 0.2 });
  await Promise.all(['s.json', 'q1.json', 'q2.json', 'c1.json'].map((n) => f('http://x/' + n)));
  assert.deepEqual(t.state(), { done: 5, total: 5, fraction: 1 });
  assert.equal(seen.length, 5);
  assert.ok(seen.every((s, i) => i === 0 || s.fraction >= seen[i - 1].fraction), '割合は戻らない');
});

test('tracker: 404 も通信エラーも「終わった」と数える。通信エラーはそのまま投げ直す', async () => {
  const t = createLoadTracker();
  const idx = { questions: ['a.json', 'b.json'] };
  const f = t.wrap(async (u) => {
    if (u.endsWith('index.json')) return ok(idx);
    if (u.endsWith('a.json')) return ng(404);
    throw new Error('offline');
  });
  await f('http://x/index.json');
  await f('http://x/a.json');
  await assert.rejects(() => f('http://x/b.json'), /offline/);
  assert.deepEqual(t.state(), { done: 3, total: 3, fraction: 1 });
});

test('tracker: index.json が取れない・壊れていても総数1で終わる（止まらない）', async () => {
  const t1 = createLoadTracker();
  await t1.wrap(async () => ng(404))('http://x/index.json');
  assert.deepEqual(t1.state(), { done: 1, total: 1, fraction: 1 });
  const t2 = createLoadTracker();
  const bad = { ok: true, status: 200, clone() { return { json: async () => { throw new Error('bad json'); } }; } };
  await t2.wrap(async () => bad)('http://x/index.json');
  assert.deepEqual(t2.state(), { done: 1, total: 1, fraction: 1 });
  const t3 = createLoadTracker();
  await assert.rejects(() => t3.wrap(async () => { throw new Error('net'); })('http://x/index.json'), /net/);
  assert.deepEqual(t3.state(), { done: 1, total: 1, fraction: 1 });
});

test('tracker: 応答の本文を消費しない（clone して読む。元の応答はそのまま返す）', async () => {
  let cloned = 0;
  const res = { ok: true, status: 200, json: async () => ({ questions: [] }), clone() { cloned++; return { json: async () => ({ questions: [] }) }; } };
  const r = await createLoadTracker().wrap(async () => res)('http://x/index.json');
  assert.equal(r, res);
  assert.equal(cloned, 1);
});

test('tracker.complete: 数え間違いがあってもゲージを満たす', () => {
  const t = createLoadTracker();
  t.complete();
  assert.deepEqual(t.state(), { done: 1, total: 1, fraction: 1 });
});

test('loadData と組み合わせて、ファイルの数どおりに1になる（無いファイルも数える）', async () => {
  const files = {
    'index.json': { syllabus: 's.json', questions: ['q1.json'], concepts: ['c1.json', 'c2.json'] },
    's.json': { tree: [] },
    'q1.json': [],
    'c1.json': [],
  };
  const t = createLoadTracker();
  const fetchFn = t.wrap(async (u) => {
    const k = u.split('/').pop();
    return k in files ? ok(files[k]) : ng(404); // c2.json は無い
  });
  await loadData({ dataBase: 'http://x/data/', fetchFn });
  assert.deepEqual(t.state(), { done: 5, total: 5, fraction: 1 });
});
