// 「あとで見る」の保存・互換・一覧の並びの検証。ブラウザ無しで node から叩く。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLater, isLater, toggleLater, laterItems, laterCount } from '../js/lib/later.js';
import { defaultState, mergeState } from '../js/lib/progress.js';
import { parseBackup, serializeBackup } from '../js/lib/backup.js';

const Q = ['A-1', 'A-2', 'B-1', 'B-2', 'C-1'].map((id) => ({ id, stem: id }));

test('初期の記録は later が空', () => {
  assert.deepEqual(defaultState().later, {});
});

test('古い記録（later の項目なし）は空で補う', () => {
  const old = defaultState();
  delete old.later;
  assert.deepEqual(mergeState(old).later, {});
  assert.deepEqual(mergeState({ xp: 5 }).later, {});
});

test('壊れた値は捨てる（数でないもの・配列・null・負数・0・NaN）', () => {
  for (const bad of [null, 'x', 5, [1, 2], undefined, true]) assert.deepEqual(mergeState({ later: bad }).later, {}, String(bad));
  const m = mergeState({ later: { a: 100, b: 'x', c: null, d: NaN, e: -1, f: 0, g: Infinity, h: {}, i: 200 } });
  assert.deepEqual(m.later, { a: 100, i: 200 });
});

test('印のオン／オフ: 付ける→付いている→外す→外れている。時刻が入る', () => {
  const s = defaultState();
  assert.equal(isLater(s, 'A-1'), false);
  assert.equal(toggleLater(s, 'A-1', new Date(1000)), true);
  assert.equal(s.later['A-1'], 1000);
  assert.equal(isLater(s, 'A-1'), true);
  assert.equal(toggleLater(s, 'A-1', new Date(2000)), false);
  assert.equal(isLater(s, 'A-1'), false);
  assert.deepEqual(s.later, {});
});

test('later の項目が無い state でも切り替えで壊れない', () => {
  const s = {};
  assert.equal(toggleLater(s, 'A-1', new Date(5)), true);
  assert.deepEqual(s.later, { 'A-1': 5 });
});

test('一覧: 印を付けた新しい順（同時刻は問題の並び順）', () => {
  const s = defaultState();
  s.later = { 'B-1': 300, 'A-1': 100, 'C-1': 300, 'A-2': 200 };
  assert.deepEqual(laterItems(s, Q, 'recent').map((x) => x.q.id), ['B-1', 'C-1', 'A-2', 'A-1']);
  assert.equal(laterItems(s, Q, 'recent')[0].at, 300);
});

test('一覧: 章の順（問題データの並び順）', () => {
  const s = defaultState();
  s.later = { 'C-1': 1, 'A-2': 2, 'B-2': 3 };
  assert.deepEqual(laterItems(s, Q, 'chapter').map((x) => x.q.id), ['A-2', 'B-2', 'C-1']);
});

test('一覧: データから消えた問題の ID は出さない。件数にも数えない。記録には残る', () => {
  const s = defaultState();
  s.later = { 'A-1': 10, 'GONE-9': 20 };
  assert.deepEqual(laterItems(s, Q).map((x) => x.q.id), ['A-1']);
  assert.equal(laterCount(s, Q), 1);
  assert.equal(s.later['GONE-9'], 20);
});

test('一覧: 0件のとき空の配列', () => {
  assert.deepEqual(laterItems(defaultState(), Q), []);
  assert.deepEqual(laterItems(null, Q), []);
  assert.equal(laterCount(defaultState(), Q), 0);
});

test('normalizeLater: 元のオブジェクトを書き換えない', () => {
  const raw = { a: 1, b: 'x' };
  normalizeLater(raw);
  assert.deepEqual(raw, { a: 1, b: 'x' });
});

test('バックアップ: later が書き出され、読み込みで戻る。壊れた値は読み込みで捨てる', () => {
  const s = defaultState();
  toggleLater(s, 'A-1', new Date(1234));
  const r = parseBackup(serializeBackup('g-kentei', s), 'g-kentei');
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.later, { 'A-1': 1234 });
  const text = JSON.stringify({ kind: 'cert-quest-backup', app: 'g-kentei', version: 1, state: { ...s, later: { x: 'bad', y: 5 } } });
  assert.deepEqual(parseBackup(text, 'g-kentei').state.later, { y: 5 });
});

test('バックアップ: later の無い古いファイルは空で読める', () => {
  const old = defaultState();
  delete old.later;
  const text = JSON.stringify({ kind: 'cert-quest-backup', app: 'dx-biz', version: 1, state: old });
  const r = parseBackup(text, 'dx-biz');
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.later, {});
});
