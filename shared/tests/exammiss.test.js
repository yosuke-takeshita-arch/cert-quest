// 模擬試験でまちがえた問題の記録と戻し方（examMissRecord・examMissItem）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { examMissRecord, examMissItem, shuffleChoices } from '../js/lib/quiz.js';

const Q = { id: 'Q1', choices: ['a', 'b', 'c', 'd'], answer: 2, whyWrong: ['wa', 'wb', null, 'wd'] };
const sqOf = (perm) => ({ q: Q, perm, choices: perm.map((o) => Q.choices[o]), answer: perm.indexOf(Q.answer) });

test('examMissRecord: まちがえた問題と未回答だけを、元の選択肢の番号で残す', () => {
  const s1 = sqOf([3, 2, 1, 0]);
  const rec = examMissRecord([
    { sq: s1, chosen: 0, correct: false }, // 並びの0番＝元の3番
    { sq: sqOf([0, 1, 2, 3]), chosen: 2, correct: true },
    { sq: sqOf([1, 0, 3, 2]), chosen: null, correct: false },
  ]);
  assert.deepEqual(rec, [{ id: 'Q1', perm: [3, 2, 1, 0], chosen: 3 }, { id: 'Q1', perm: [1, 0, 3, 2], chosen: null }]);
  s1.perm[0] = 9; // 記録は写しで持つ
  assert.equal(rec[0].perm[0], 3);
});

test('examMissItem: その回の並びに戻し、正解・選んだ番号・誤答の説明が並びに合う', () => {
  const it = examMissItem(Q, { id: 'Q1', perm: [3, 2, 1, 0], chosen: 3 });
  assert.deepEqual(it.sq.choices, ['d', 'c', 'b', 'a']);
  assert.equal(it.sq.answer, 1);
  assert.equal(it.chosen, 0);
  assert.deepEqual(it.sq.whyWrong, ['wd', null, 'wb', 'wa']);
  assert.equal(examMissItem(Q, { id: 'Q1', perm: [3, 2, 1, 0], chosen: null }).chosen, null);
});

test('examMissItem: 並びが今の選択肢に合わなければ元の並び。問題が無ければ null', () => {
  for (const perm of [[0, 1, 2], [0, 0, 1, 2], [0, 1, 2, 4], undefined, [0, 1, 2, 1.5]]) {
    const it = examMissItem(Q, { id: 'Q1', perm, chosen: 1 });
    assert.deepEqual(it.sq.perm, [0, 1, 2, 3]);
    assert.equal(it.sq.answer, 2);
    assert.equal(it.chosen, 1);
  }
  assert.equal(examMissItem(Q, { id: 'Q1', perm: [0, 1, 2, 3], chosen: 7 }).chosen, null);
  assert.equal(examMissItem(null, { id: 'X' }), null);
});

test('examMissRecord → examMissItem で、shuffleChoices の並びと同じに戻る', () => {
  let s = 1;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 20; k++) {
    const sq = shuffleChoices(Q, rng);
    const [rec] = examMissRecord([{ sq, chosen: 0, correct: false }]);
    const it = examMissItem(Q, rec);
    assert.deepEqual(it.sq.choices, sq.choices);
    assert.equal(it.sq.answer, sq.answer);
    assert.equal(it.chosen, 0);
  }
});

test('drumRollHits: ms の中で、間隔がだんだん詰まり、強さがだんだん上がる', async () => {
  const { drumRollHits, DRUMROLL } = await import('../js/lib/sound.js');
  const hits = drumRollHits(2500);
  assert.equal(hits[0].t, 0);
  assert.ok(hits.every((x) => x.t < 2500));
  assert.ok(hits.length > 25 && hits.length < 60, String(hits.length));
  const gaps = hits.slice(1).map((x, i) => x.t - hits[i].t);
  assert.ok(gaps[0] >= DRUMROLL.startGap - 1 && gaps[gaps.length - 1] < 60);
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] <= gaps[i - 1] + 1);
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i].gain >= hits[i - 1].gain);
  assert.ok(hits.every((x) => x.gain > 0 && x.gain <= 1));
  assert.deepEqual(drumRollHits(0), []);
  assert.deepEqual(drumRollHits(NaN), []);
});
