// 章のボス戦の計算の検証。ブラウザ無しで node から叩く。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chapterKey, isMissed, missedByChapter, bossInfo, bossQuestions, newBattle, applyBossAnswer, needsRetry,
  normalizeBoss, recordBossWin, bossWins, BOSS_MIN, BOSS_MAX, PLAYER_HP,
} from '../js/lib/boss.js';
import { applyAnswer, dayNumber } from '../js/lib/srs.js';
import { buildTree } from '../js/lib/data.js';

const mk = (n, ch = ['大', '中', '小'], pre = 'Q') => Array.from({ length: n }, (_, i) => ({ id: `${pre}${i + 1}`, syllabus: ch }));
const wrong = (due) => ({ seen: 1, correct: 0, lastOk: false, step: 0, due });
const right = { seen: 1, correct: 1, lastOk: true, step: -1, due: null };

test('章のキーは地図のステージ（buildTree の stage.key）と同じ。中項目が無ければ 全般', () => {
  const qs = [
    { id: 'a', syllabus: ['G', 'M', 's'], stem: 'x', choices: ['1', '2'], answer: 0 },
    { id: 'b', syllabus: ['G'], stem: 'x', choices: ['1', '2'], answer: 0 },
    { id: 'c', syllabus: ['G', 'M'], stem: 'x', choices: ['1', '2'], answer: 0 },
  ];
  const tree = buildTree(null, qs, []);
  for (const st of tree.stages) for (const q of st.questions) assert.equal(chapterKey(q), st.key, q.id);
  assert.equal(chapterKey(qs[0]), 'G|M');
  assert.equal(chapterKey(qs[1]), 'G|全般');
  assert.equal(chapterKey({ syllabus: [] }), null);
  assert.equal(chapterKey(null), null);
  assert.equal(chapterKey({ syllabus: ['a', ''] }), null);
});

test('最後に間違えた問題だけを集める（未回答・正解は含めない）', () => {
  assert.equal(isMissed(wrong(5)), true);
  assert.equal(isMissed(right), false);
  assert.equal(isMissed(undefined), false);
  assert.equal(isMissed({ seen: 0, lastOk: false }), false);
  assert.equal(isMissed({ seen: 2, lastOk: null }), false);
});

test('間違いがちょうど2問ならボスは出ない／3問で出る／11問でも出す問題は10問', () => {
  for (const [n, avail, count] of [[0, false, 0], [1, false, 0], [2, false, 0], [3, true, 3], [10, true, 10], [11, true, 10], [20, true, 10]]) {
    const qs = mk(25);
    const st = {};
    qs.slice(0, n).forEach((q, i) => (st[q.id] = wrong(10 + i)));
    qs.slice(n).forEach((q) => (st[q.id] = right));
    const info = bossInfo(qs, st);
    assert.equal(info.missed, n, 'n=' + n);
    assert.equal(info.available, avail, 'n=' + n);
    assert.equal(info.need, Math.max(0, BOSS_MIN - n));
    assert.equal(bossQuestions(qs, st).length, count, 'n=' + n);
  }
  assert.equal(BOSS_MAX, 10);
  assert.equal(BOSS_MIN, 3);
});

test('答え0問・データが空でも落ちない', () => {
  assert.deepEqual(bossQuestions(mk(5), {}), []);
  assert.deepEqual(bossQuestions([], {}), []);
  assert.deepEqual(bossQuestions(null, null), []);
  assert.deepEqual(missedByChapter(mk(5), undefined), {});
  assert.equal(bossInfo(undefined, undefined).available, false);
});

test('全部正解ならボスは出ない／全部不正解で13問なら10問（古い順）', () => {
  const qs = mk(13);
  assert.deepEqual(bossQuestions(qs, Object.fromEntries(qs.map((q) => [q.id, right]))), []);
  const st = Object.fromEntries(qs.map((q, i) => [q.id, wrong(100 - i)])); // Q13 が一番古い（due が小さい）
  assert.deepEqual(bossQuestions(qs, st).map((q) => q.id), ['Q13', 'Q12', 'Q11', 'Q10', 'Q9', 'Q8', 'Q7', 'Q6', 'Q5', 'Q4']);
});

test('並べ方: due が小さい（古く間違えた）順。同じ due は問題データの順。due が壊れたものは最後', () => {
  const qs = mk(6);
  const st = { Q1: wrong(9), Q2: wrong(5), Q3: wrong(5), Q4: { seen: 1, lastOk: false, due: null }, Q5: wrong(7), Q6: right };
  assert.deepEqual(bossQuestions(qs, st).map((q) => q.id), ['Q2', 'Q3', 'Q5', 'Q1', 'Q4']);
});

test('実際の記録（applyAnswer）でも due が間違えた日の順になる。間違えた後に正解した問題は外れる', () => {
  const qs = mk(5);
  const st = {};
  const day = (d) => dayNumber(new Date(2026, 9, d));
  st.Q1 = applyAnswer(undefined, false, day(5));
  st.Q2 = applyAnswer(undefined, false, day(1)); // 一番古い
  st.Q3 = applyAnswer(undefined, false, day(3));
  st.Q4 = applyAnswer(applyAnswer(undefined, false, day(2)), true, day(2)); // 間違えたがすぐ正解 → 外れる
  st.Q5 = applyAnswer(applyAnswer(undefined, true, day(1)), false, day(4)); // 正解の後に間違えた → 入る
  assert.deepEqual(bossQuestions(qs, st).map((q) => q.id), ['Q2', 'Q3', 'Q5', 'Q1']);
});

test('章ごとに分ける。別の章の間違いは数えない。データから消えた問題IDは数えない', () => {
  const a = mk(2, ['A', 'a', 'x'], 'A');
  const b = mk(3, ['B', 'b', 'x'], 'B');
  const st = { A1: wrong(1), A2: wrong(2), B1: wrong(1), B2: wrong(2), B3: wrong(3), GONE1: wrong(1), GONE2: wrong(1), GONE3: wrong(1) };
  const m = missedByChapter([...a, ...b], st);
  assert.deepEqual(Object.keys(m).sort(), ['A|a', 'B|b']);
  assert.equal(m['A|a'].length, 2);
  assert.equal(m['B|b'].length, 3);
  assert.equal(bossInfo(a, st).available, false);
  assert.equal(bossInfo(b, st).available, true);
  assert.equal(bossInfo(a, { GONE1: wrong(1), GONE2: wrong(1), GONE3: wrong(1) }).missed, 0); // 消えた問題だけ間違えていても出ない
});

test('体力: ボス＝問題数、自分＝3。正解でボス−1、不正解で自分−1', () => {
  let b = newBattle(5);
  assert.deepEqual(b, { boss: 5, bossMax: 5, player: PLAYER_HP, playerMax: 3, result: null });
  b = applyBossAnswer(b, true);
  assert.equal(b.boss, 4);
  assert.equal(b.player, 3);
  b = applyBossAnswer(b, false);
  assert.equal(b.boss, 4);
  assert.equal(b.player, 2);
  assert.equal(b.result, null);
});

test('勝ち: ボスの体力が0（最小の3問）／負け: 自分の体力が0（3回目の不正解）', () => {
  let b = newBattle(3);
  for (let i = 0; i < 3; i++) b = applyBossAnswer(b, true);
  assert.equal(b.result, 'win');
  assert.equal(b.boss, 0);
  let c = newBattle(10);
  c = applyBossAnswer(c, false);
  c = applyBossAnswer(c, false);
  assert.equal(c.result, null); // 2回間違えてもまだ
  c = applyBossAnswer(c, false);
  assert.equal(c.result, 'lose');
  assert.equal(c.player, 0);
});

test('終わった後の答えは無視する／元の状態は変えない／正解の途中で間違えても最後に勝てる', () => {
  const b0 = newBattle(2);
  const b1 = applyBossAnswer(b0, true);
  assert.equal(b0.boss, 2); // 元は変えない
  const win = applyBossAnswer(applyBossAnswer(applyBossAnswer(b1, false), true), true);
  assert.equal(win.result, 'win');
  assert.deepEqual(applyBossAnswer(win, false), win);
  const lose = [false, false, false].reduce(applyBossAnswer.bind(null), newBattle(4));
  assert.deepEqual(applyBossAnswer(lose, true), lose);
});

test('全問を答え終えても決着しない場合（間違えた分だけボスが残る）を検出できる', () => {
  let b = newBattle(3);
  b = applyBossAnswer(b, true);
  b = applyBossAnswer(b, false);
  b = applyBossAnswer(b, true); // 3問答えて、ボスは1残る
  assert.equal(b.boss, 1);
  assert.equal(needsRetry(b, 0), true);
  assert.equal(needsRetry(b, 1), false);
  assert.equal(needsRetry(applyBossAnswer(b, true), 0), false); // 勝った
});

test('体力の境界: 問題0・壊れた値', () => {
  assert.equal(newBattle(0).boss, 0);
  assert.equal(newBattle(-3).boss, 0);
  assert.equal(newBattle(2.5).boss, 0);
  assert.equal(newBattle(NaN).boss, 0);
  assert.equal(newBattle(1).player, 3);
});

test('撃破の記録: 古い記録（項目なし）は空。壊れた値は捨てる', () => {
  for (const bad of [undefined, null, 'x', 5, [1], true]) assert.deepEqual(normalizeBoss(bad), {}, String(bad));
  assert.deepEqual(normalizeBoss({ 'A|a': 2, 'B|b': 0, 'C|c': -1, 'D|d': 1.5, 'E|e': '3', 'F|f': NaN, 'G|g': null, 'H|h': 1, '': 4 }), { 'A|a': 2, 'H|h': 1 });
});

test('撃破の回数が増える。state に項目が無くても、壊れていても落ちない', () => {
  const s = {};
  assert.equal(recordBossWin(s, 'A|a'), 1);
  assert.equal(recordBossWin(s, 'A|a'), 2);
  assert.equal(recordBossWin(s, 'B|b'), 1);
  assert.deepEqual(s.boss, { 'A|a': 2, 'B|b': 1 });
  assert.equal(bossWins(s, 'A|a'), 2);
  assert.equal(bossWins(s, 'Z|z'), 0);
  assert.equal(bossWins({}, 'A|a'), 0);
  const broken = { boss: [1, 2] };
  assert.equal(recordBossWin(broken, 'A|a'), 1);
  assert.deepEqual(broken.boss, { 'A|a': 1 });
  assert.equal(bossWins({ boss: { 'A|a': 'x' } }, 'A|a'), 0);
});
