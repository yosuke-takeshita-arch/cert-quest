// カードめくり（要件定義書 §3-4-c）と、印を付けたカードの問題（§3-4-b）の検証。ブラウザ無しで node から叩く。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFlip, markFlip, flipDeck, flipCounts, sectionCards, flipWeakSections, FLIP_MAX } from '../js/lib/flip.js';
import { laterCardQuestions, toggleLaterCard } from '../js/lib/later.js';
import { defaultState, mergeState } from '../js/lib/progress.js';
import { parseBackup, serializeBackup } from '../js/lib/backup.js';

const C = ['c1', 'c2', 'c3', 'c4', 'c5'].map((id, i) => ({ id, title: id, syllabus: [i < 3 ? '第1章' : '第2章'] }));

test('初期の記録は flip が空。古い記録（項目なし）も空で補う', () => {
  assert.deepEqual(defaultState().flip, {});
  assert.deepEqual(mergeState({ xp: 5 }).flip, {});
});

test('壊れた値は捨てる', () => {
  for (const bad of [null, 'x', 5, [1], true]) assert.deepEqual(normalizeFlip(bad), {}, String(bad));
  const m = mergeState({ flip: { a: { ok: true, at: 10 }, b: { ok: 'yes', at: 10 }, c: { ok: false, at: -1 }, d: null, e: { ok: false, at: 20, x: 1 }, f: 3 } });
  assert.deepEqual(m.flip, { a: { ok: true, at: 10 }, e: { ok: false, at: 20 } });
});

test('最後に押したほうだけ残る', () => {
  const s = defaultState();
  markFlip(s, 'c1', false, new Date(100));
  markFlip(s, 'c1', true, new Date(200));
  assert.deepEqual(s.flip, { c1: { ok: true, at: 200 } });
  const t = {};
  markFlip(t, 'c2', false, new Date(5));
  assert.deepEqual(t.flip, { c2: { ok: false, at: 5 } });
});

test('出す順: まだ（古い順）→ めくっていない（カードの順）→ 覚えた（古い順）', () => {
  const s = defaultState();
  markFlip(s, 'c4', true, new Date(50));
  markFlip(s, 'c1', true, new Date(10));
  markFlip(s, 'c5', false, new Date(300));
  markFlip(s, 'c3', false, new Date(100));
  assert.deepEqual(flipDeck(s, C).map((c) => c.id), ['c3', 'c5', 'c2', 'c1', 'c4']);
  assert.deepEqual(flipCounts(s, C), { ok: 2, ng: 2, fresh: 1 });
});

test('1回は最大20枚。境界 19・20・21', () => {
  const many = (n) => Array.from({ length: n }, (_, i) => ({ id: 'k' + i, syllabus: ['x'] }));
  assert.equal(FLIP_MAX, 20);
  assert.equal(flipDeck(defaultState(), many(19)).length, 19);
  assert.equal(flipDeck(defaultState(), many(20)).length, 20);
  assert.equal(flipDeck(defaultState(), many(21)).length, 20);
  assert.equal(flipDeck(defaultState(), []).length, 0);
});

test('データから消えたカードの記録は数えず、記録には残す', () => {
  const s = defaultState();
  markFlip(s, 'gone', false, new Date(1));
  assert.deepEqual(flipCounts(s, C), { ok: 0, ng: 0, fresh: 5 });
  assert.equal(flipDeck(s, C)[0].id, 'c1');
  assert.ok(s.flip.gone);
});

const SEC = [
  { key: 'A', name: '技術', count: 4, cards: [], children: [
    { key: 'A1', name: '機械学習', count: 3, cards: [C[0]], children: [
      { key: 'A1a', name: '教師あり', count: 2, cards: [C[1], C[2]], children: [] }] },
    { key: 'A2', name: '深層学習', count: 1, cards: [C[3]], children: [] }] },
  { key: 'B', name: '法律', count: 1, cards: [], children: [
    { key: 'B1', name: '個人情報', count: 1, cards: [C[4]], children: [] }] },
];

test('節の下の全部のカード（木の順）', () => {
  assert.deepEqual(sectionCards(SEC[0]).map((c) => c.id), ['c1', 'c2', 'c3', 'c4']);
  assert.deepEqual(sectionCards(SEC[0].children[0].children[0]).map((c) => c.id), ['c2', 'c3']);
  assert.deepEqual(sectionCards({ key: 'z' }), []);
});

test('苦手な分野: しきい値を下回り判定できる中項目・小項目だけ、正答率の低い順。大項目は入れない', () => {
  const st = (rate, qualified = true) => ({ rate, qualified, percent: Math.round(rate * 100) });
  const rates = new Map([['A', st(0.1)], ['A1', st(0.6)], ['A1a', st(0.79)], ['A2', st(0.8)], ['B1', st(0.3)], ['B', st(0.2, false)]]);
  // 0.8 ちょうどは苦手でない（境界）。0.79 は苦手。大項目 A は入れない
  assert.deepEqual(flipWeakSections(SEC, rates, 0.8).map((x) => x.sec.key), ['B1', 'A1', 'A1a']);
  assert.deepEqual(flipWeakSections(SEC, rates, 0.8, 2).map((x) => x.sec.key), ['B1', 'A1']);
  rates.set('B1', st(0.3, false)); // 答えた数が足りない分野は入れない
  assert.deepEqual(flipWeakSections(SEC, rates, 0.8).map((x) => x.sec.key), ['A1', 'A1a']);
  assert.deepEqual(flipWeakSections(SEC, new Map(), 0.8), []);
});

test('苦手な分野: 同じ正答率なら木の順', () => {
  const st = { rate: 0.5, qualified: true, percent: 50 };
  const rates = new Map([['B1', st], ['A2', st], ['A1', st]]);
  assert.deepEqual(flipWeakSections(SEC, rates, 0.8).map((x) => x.sec.key), ['A1', 'A2', 'B1']);
});

test('書き出し・読み込みで flip が残る', () => {
  const s = defaultState();
  markFlip(s, 'c2', false, new Date(1234));
  const r = parseBackup(serializeBackup('g-kentei', s, new Date(5000)), 'g-kentei');
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.flip, { c2: { ok: false, at: 1234 } });
});

// ---- 印を付けたカードの問題（§3-4-b） ----
const Q = [
  { id: 'q1', concepts: ['c2'] },
  { id: 'q2', concepts: ['c1', 'c2'] },
  { id: 'q3', concepts: ['c3'] },
  { id: 'q4', concepts: [] },
  { id: 'q5', concepts: ['c1'] },
];
const byId = new Map(C.map((c) => [c.id, c]));
const conceptOf = (x) => byId.get(x) || null;

test('印のカードにつながる問題を、カードの並び→問題の順で、重ねずに集める', () => {
  const s = defaultState();
  toggleLaterCard(s, 'c1', new Date(100));
  toggleLaterCard(s, 'c2', new Date(200));
  // 新しい順: c2 → c1。c2 の q1・q2、c1 の q5（q2 は重ねない）
  assert.deepEqual(laterCardQuestions(s, C, Q, conceptOf, 'recent').map((q) => q.id), ['q1', 'q2', 'q5']);
  // 章の順: c1 → c2。c1 の q2・q5、c2 の q1
  assert.deepEqual(laterCardQuestions(s, C, Q, conceptOf, 'chapter').map((q) => q.id), ['q2', 'q5', 'q1']);
});

test('印が無い・つながる問題が無い・消えたカードの印は0問', () => {
  const s = defaultState();
  assert.deepEqual(laterCardQuestions(s, C, Q, conceptOf), []);
  toggleLaterCard(s, 'c4', new Date(1));
  toggleLaterCard(s, 'gone', new Date(2));
  assert.deepEqual(laterCardQuestions(s, C, Q, conceptOf), []);
  assert.deepEqual(laterCardQuestions(s, C, [{ id: 'qx' }], conceptOf), []);
});
