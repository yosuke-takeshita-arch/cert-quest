// 章のボス戦の計算の検証。ブラウザ無しで node から叩く。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chapterKey, isMissed, missedByChapter, bossInfo, bossQuestions, newBattle, applyBossAnswer, needsRetry,
  normalizeBoss, recordBossWin, bossWins, BOSS_MIN, BOSS_QUEUE_MAX, BOSS_HP_MIN, BOSS_HP_MAX, PLAYER_HP,
  accuracyOf, rollBossHp, isCritical, bossMood, BOSS_MOOD_TEXT, CRIT_SECONDS, CRIT_CHANCE, CRIT_DAMAGE,
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

test('間違いがちょうど2問ならボスは出ない／3問で出る（出す問題は、答えたことのある問題を全部。上限は BOSS_QUEUE_MAX）', () => {
  for (const [n, avail, count] of [[0, false, 0], [1, false, 0], [2, false, 0], [3, true, 20], [10, true, 20], [11, true, 20], [20, true, 20]]) {
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
  assert.equal(BOSS_QUEUE_MAX, 20);
  assert.equal(BOSS_MIN, 3);
});

test('答え0問・データが空でも落ちない', () => {
  assert.deepEqual(bossQuestions(mk(5), {}), []);
  assert.deepEqual(bossQuestions([], {}), []);
  assert.deepEqual(bossQuestions(null, null), []);
  assert.deepEqual(missedByChapter(mk(5), undefined), {});
  assert.equal(bossInfo(undefined, undefined).available, false);
});

test('全部正解ならボスは出ない／間違えた問題が13問なら、13問とも出る（同じ正解率・同じ間違えた回数なら、問題データの順）', () => {
  const qs = mk(13);
  assert.deepEqual(bossQuestions(qs, Object.fromEntries(qs.map((q) => [q.id, right]))), []);
  const st = Object.fromEntries(qs.map((q, i) => [q.id, wrong(100 - i)])); // due の順は関係ない（正解率で並べる）
  assert.deepEqual(bossQuestions(qs, st).map((q) => q.id), qs.map((q) => q.id));
});

// 答えた記録（seen・correct）から作る
const rec = (seen, correct, lastOk) => ({ seen, correct, lastOk, step: 0, due: 10 });

test('並べ方: 正解率の低い順。同じなら間違えた回数の多い順。それも同じなら問題データの順', () => {
  const qs = mk(8);
  const st = {
    Q1: rec(4, 3, true), // 0.75
    Q2: rec(2, 0, false), // 0 ・間違え2
    Q3: rec(4, 0, false), // 0 ・間違え4
    Q4: rec(1, 0, false), // 0 ・間違え1
    Q6: rec(2, 1, false), // 0.5 ・間違え1
    Q7: rec(2, 0, false), // Q2 と同じ（0・間違え2）→ データの順で Q2 が先
    Q8: rec(4, 2, false), // 0.5 ・間違え2 → Q6（間違え1）より先
  };
  assert.deepEqual(bossQuestions(qs, st).map((q) => q.id), ['Q3', 'Q2', 'Q7', 'Q4', 'Q8', 'Q6', 'Q1', 'Q5']);
});

test('答えたことのある問題が尽きたら、まだ答えていない問題を、問題データの順に後ろへ足す。答えた問題は、正解済みでも先に並ぶ', () => {
  const qs = mk(8);
  const st = { Q5: rec(1, 0, false), Q6: rec(1, 0, false), Q7: rec(1, 0, false), Q2: rec(3, 3, true) };
  assert.deepEqual(bossQuestions(qs, st).map((q) => q.id), ['Q5', 'Q6', 'Q7', 'Q2', 'Q1', 'Q3', 'Q4', 'Q8']);
  assert.deepEqual(bossQuestions(qs, st, 5).map((q) => q.id), ['Q5', 'Q6', 'Q7', 'Q2', 'Q1']); // 上限
  assert.deepEqual(bossQuestions(qs, st, 0), []);
});

test('正解率の計算: 答えたことが無い・壊れた記録は null。correct が壊れていれば 0 として扱う', () => {
  assert.deepEqual(accuracyOf(rec(4, 1, false)), { rate: 0.25, wrong: 3 });
  for (const bad of [undefined, null, {}, { seen: 0 }, { seen: -1 }, { seen: 1.5 }, { seen: '2' }]) assert.equal(accuracyOf(bad), null, JSON.stringify(bad));
  assert.deepEqual(accuracyOf({ seen: 3, correct: 'x' }), { rate: 0, wrong: 3 });
  assert.deepEqual(accuracyOf({ seen: 3, correct: 9 }), { rate: 1, wrong: 0 }); // 答えた数を超えない
});

test('実際の記録（applyAnswer）でも、正解率の低い順に並ぶ。間違えた後に正解した問題も、答えたことのある問題として並ぶ', () => {
  const qs = mk(5);
  const st = {};
  const day = (d) => dayNumber(new Date(2026, 9, d));
  st.Q1 = applyAnswer(undefined, false, day(5)); // 0/1
  st.Q2 = applyAnswer(undefined, false, day(1)); // 0/1
  st.Q3 = applyAnswer(undefined, false, day(3)); // 0/1
  st.Q4 = applyAnswer(applyAnswer(undefined, false, day(2)), true, day(2)); // 1/2（最後は正解）
  st.Q5 = applyAnswer(applyAnswer(undefined, true, day(1)), false, day(4)); // 1/2（最後は間違い）
  assert.equal(bossInfo(qs, st).available, true); // 最後に間違えたのは Q1・Q2・Q3・Q5
  assert.deepEqual(bossQuestions(qs, st).map((q) => q.id), ['Q1', 'Q2', 'Q3', 'Q4', 'Q5']);
});

test('ボスの体力: 5〜10 のどれかを同じ確率で。出す問題の数より大きくしない。壊れた乱数でも範囲内', () => {
  assert.equal(BOSS_HP_MIN, 5);
  assert.equal(BOSS_HP_MAX, 10);
  const seen = new Set();
  for (let k = 0; k < 600; k++) seen.add(rollBossHp(() => k / 600));
  assert.deepEqual([...seen].sort((a, b) => a - b), [5, 6, 7, 8, 9, 10]);
  assert.equal(rollBossHp(() => 0), 5);
  assert.equal(rollBossHp(() => 0.999999), 10);
  assert.equal(rollBossHp(() => 1), 10); // 1 でも 10 を超えない
  for (const bad of [NaN, -1, 5, Infinity, undefined, 'x']) {
    const hp = rollBossHp(() => bad);
    assert.ok(hp >= 5 && hp <= 10, String(bad));
  }
  assert.equal(rollBossHp(() => 0.99, 3), 3); // 出す問題が3問なら、3まで
  assert.equal(rollBossHp(() => 0, 7), 5);
  assert.equal(rollBossHp(() => 0.5, 0), 0);
});

test('会心の一撃: 正解で、10秒以内（ちょうど10秒も）で、乱数が 0.25 未満のときだけ。条件を満たさないときは乱数を使わない', () => {
  assert.equal(CRIT_SECONDS, 10);
  assert.equal(CRIT_CHANCE, 0.25);
  assert.equal(CRIT_DAMAGE, 2);
  assert.equal(isCritical(true, 3, () => 0), true);
  assert.equal(isCritical(true, 10, () => 0.249), true); // 10秒ちょうどは含む
  assert.equal(isCritical(true, 0, () => 0), true);
  assert.equal(isCritical(true, 3, () => 0.25), false); // 0.25 は含まない（4回に1回）
  assert.equal(isCritical(true, 10.001, () => 0), false);
  assert.equal(isCritical(false, 3, () => 0), false);
  for (const bad of [NaN, -1, Infinity, undefined, null]) assert.equal(isCritical(true, bad, () => 0), false, String(bad));
  let used = 0;
  const rng = () => { used++; return 0; };
  isCritical(false, 1, rng);
  isCritical(true, 30, rng);
  assert.equal(used, 0);
  isCritical(true, 1, rng);
  assert.equal(used, 1);
  // 出る割合は 4 回に 1 回
  let n = 0;
  for (let k = 0; k < 1000; k++) if (isCritical(true, 5, () => k / 1000)) n++;
  assert.equal(n, 250);
});

test('会心の一撃はボスの体力を2減らす。体力が1しか残っていなくても、0 を下回らず勝つ。間違えたときの damage は無視', () => {
  let b = applyBossAnswer(newBattle(6), true, CRIT_DAMAGE);
  assert.equal(b.boss, 4);
  b = applyBossAnswer(b, true, 2);
  b = applyBossAnswer(b, true, 2);
  assert.equal(b.boss, 0);
  assert.equal(b.result, 'win');
  assert.equal(applyBossAnswer(newBattle(1), true, 2).boss, 0);
  const miss = applyBossAnswer(newBattle(6), false, 2);
  assert.equal(miss.boss, 6);
  assert.equal(miss.player, PLAYER_HP - 1);
  for (const bad of [0, -3, 1.5, NaN, undefined, '2']) assert.equal(applyBossAnswer(newBattle(6), true, bad).boss, 5, String(bad)); // 壊れた値は 1
});

test('様子の文の境目: 残りの割合が 0.6 を超える＝まだ余裕、0.3 を超える＝半分くらい、それ以下＝かなり弱っている。決着後・体力不明は null', () => {
  const m = (boss, bossMax) => bossMood({ boss, bossMax });
  assert.equal(m(10, 10), 'high');
  assert.equal(m(7, 10), 'high'); // 0.7
  assert.equal(m(6, 10), 'half'); // ちょうど 0.6 は半分くらい
  assert.equal(m(4, 10), 'half'); // 0.4
  assert.equal(m(3, 10), 'low'); // ちょうど 0.3 は少ない
  assert.equal(m(1, 10), 'low');
  assert.equal(m(4, 5), 'high'); // 体力5: 1回正解
  assert.equal(m(3, 5), 'half'); // 0.6
  assert.equal(m(2, 5), 'half'); // 0.4
  assert.equal(m(1, 5), 'low');
  assert.equal(m(0, 5), null);
  assert.equal(m(3, 0), null);
  assert.equal(bossMood(null), null);
  assert.equal(bossMood({}), null);
  assert.deepEqual(BOSS_MOOD_TEXT, { high: 'まだ余裕の様子だ', half: 'すこしよろめいた', low: 'かなり弱っている！' });
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

test('体力: ボスは渡した数、自分＝3。正解でボス−1、不正解で自分−1', () => {
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
