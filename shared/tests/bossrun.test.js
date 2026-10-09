// 章のボス戦の流れ（間違えたら最後に並べ直す・勝ち・負け・撃破の記録）の検証。ブラウザ無しで node から叩く。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRun, currentQuestion, answerRun, runResult } from '../js/lib/bossrun.js';
import { bossQuestions, bossInfo, recordBossWin, bossWins, PLAYER_HP } from '../js/lib/boss.js';
import { applyAnswer, dayNumber } from '../js/lib/srs.js';

const qs = (n) => Array.from({ length: n }, (_, i) => ({ id: 'Q' + (i + 1), syllabus: ['大', '中', '小'] }));
const ids = (run) => run.queue.map((q) => q.id);

// 答えの並び（true＝正解）を順に流す。決着がついたら止まる
function play(run, answers) {
  let r = run;
  const asked = [];
  for (const a of answers) {
    const q = currentQuestion(r);
    if (!q) break;
    asked.push(q.id);
    r = answerRun(r, a);
  }
  return { run: r, asked };
}

test('始まり: 体力はボス＝問題の数、自分＝3。先頭の問題が出る', () => {
  const run = newRun(qs(4));
  assert.equal(run.battle.boss, 4);
  assert.equal(run.battle.player, PLAYER_HP);
  assert.equal(currentQuestion(run).id, 'Q1');
  assert.equal(runResult(run), null);
});

test('全部正解なら、問題の数だけ答えて勝ち', () => {
  const { run, asked } = play(newRun(qs(3)), [true, true, true]);
  assert.deepEqual(asked, ['Q1', 'Q2', 'Q3']);
  assert.equal(runResult(run), 'win');
  assert.equal(run.battle.boss, 0);
  assert.equal(currentQuestion(run), null);
});

test('間違えた問題は、その回の最後にもう一度並ぶ（途中では出ない）', () => {
  let r = newRun(qs(4));
  r = answerRun(r, false); // Q1 を間違える
  assert.deepEqual(ids(r), ['Q2', 'Q3', 'Q4']); // すぐには出ない
  assert.deepEqual(r.wrongNext.map((q) => q.id), ['Q1']);
  assert.equal(r.battle.player, PLAYER_HP - 1);
  r = answerRun(r, true);
  r = answerRun(r, true);
  assert.equal(r.requeued, false);
  r = answerRun(r, true); // Q4 を答え終えた。ボスの体力が残る（Q1 の分）ので、Q1 がもう一度並ぶ
  assert.equal(runResult(r), null);
  assert.equal(r.requeued, true);
  assert.equal(r.round, 2);
  assert.deepEqual(ids(r), ['Q1']);
  r = answerRun(r, true);
  assert.equal(runResult(r), 'win'); // 間違えた問題を越えて勝つ
  assert.equal(r.battle.boss, 0);
});

test('1問でも間違えると、問題が尽きても決着がつかない（初めの決め方の抜けを塞ぐ）', () => {
  // 3問・1つ間違え: 3問を答え終えたとき、ボスの体力は 1 残る。ここで止まらず並べ直す
  const { run } = play(newRun(qs(3)), [true, false, true]);
  assert.equal(run.battle.boss, 1);
  assert.equal(runResult(run), null);
  assert.deepEqual(ids(run), ['Q2']);
});

test('並べ直した問題をまた間違えると、また最後に並ぶ。ハートが尽きたら負け', () => {
  let r = newRun(qs(3));
  r = answerRun(r, false); // Q1 ✗（ハート2）
  r = answerRun(r, true); // Q2
  r = answerRun(r, true); // Q3 → Q1 だけ並べ直し
  assert.deepEqual(ids(r), ['Q1']);
  r = answerRun(r, false); // Q1 ✗（ハート1）→ 尽きたのでまた Q1
  assert.deepEqual(ids(r), ['Q1']);
  assert.equal(r.round, 3);
  assert.equal(runResult(r), null);
  r = answerRun(r, false); // ✗（ハート0）
  assert.equal(runResult(r), 'lose');
  assert.equal(r.battle.player, 0);
  assert.equal(currentQuestion(r), null);
});

test('3回間違えれば、すぐ負け（残りの問題は出ない）', () => {
  const { run, asked } = play(newRun(qs(10)), [false, false, false, true, true]);
  assert.equal(runResult(run), 'lose');
  assert.deepEqual(asked, ['Q1', 'Q2', 'Q3']); // 4問目以降は出ない
});

test('決着のあとに答えを渡しても、何も変わらない', () => {
  const { run } = play(newRun(qs(2)), [true, true]);
  const again = answerRun(run, false);
  assert.equal(runResult(again), 'win');
  assert.equal(again.battle.player, PLAYER_HP);
  assert.equal(again.asked, run.asked);
});

test('元の状態は書き換えない（新しい状態を返す）', () => {
  const r0 = newRun(qs(3));
  const before = JSON.stringify(r0);
  answerRun(r0, false);
  answerRun(r0, true);
  assert.equal(JSON.stringify(r0), before);
});

test('どの順で間違えても、問題の数ぶん正解すれば必ず勝つ（ハートが残る限り）', () => {
  // 10問・2回間違える（ハート1のこす）。どこで間違えても勝つ
  for (let a = 0; a < 10; a++) {
    for (let b = a + 1; b < 10; b++) {
      let r = newRun(qs(10));
      let n = 0;
      while (currentQuestion(r)) {
        // 初めの回の a 番目と b 番目だけ間違える。並べ直しは正解する
        const wrongNow = r.round === 1 && (n === a || n === b);
        r = answerRun(r, !wrongNow);
        n++;
        assert.ok(n <= 12, '無限に続く');
      }
      assert.equal(runResult(r), 'win', a + ',' + b);
      assert.equal(n, 12); // 10問＋並べ直し2問
    }
  }
});

test('勝ったあとの流れ: 答えを記録→勝った問題は最後に正解になり、次のボスは残りから作られる。撃破は章ごとに数える', () => {
  const chapter = qs(5);
  const today = dayNumber(new Date(2026, 9, 9));
  const qstats = {};
  for (const q of chapter) qstats[q.id] = applyAnswer({ seen: 0, correct: 0, lastOk: null, step: -1, due: null }, false, today);
  assert.equal(bossInfo(chapter, qstats).available, true);
  let r = newRun(bossQuestions(chapter, qstats));
  assert.equal(r.battle.bossMax, 5);
  // 全問題に答える。Q2 だけ最初に間違える
  let n = 0;
  while (currentQuestion(r)) {
    const q = currentQuestion(r);
    const ok = !(q.id === 'Q2' && n < 5);
    qstats[q.id] = applyAnswer(qstats[q.id], ok, today);
    r = answerRun(r, ok);
    n++;
  }
  assert.equal(runResult(r), 'win');
  assert.equal(n, 6);
  // 全部「最後に正解」になったので、この章のボスは姿を消す
  assert.equal(bossInfo(chapter, qstats).available, false);
  const state = { boss: {} };
  assert.equal(bossWins(state, '大|中'), 0);
  assert.equal(recordBossWin(state, '大|中'), 1);
  assert.equal(recordBossWin(state, '大|中'), 2);
  assert.equal(bossWins(state, '大|中'), 2);
  assert.equal(bossWins(state, '別|章'), 0); // 章ごと
});

test('負けたあと: 正解した問題は「最後に正解」になり、間違えたままの問題だけが次のボスになる（まだ3問以上なら、また現れる）', () => {
  const chapter = qs(5);
  const today = dayNumber(new Date(2026, 9, 9));
  const qstats = {};
  for (const q of chapter) qstats[q.id] = applyAnswer({ seen: 0, correct: 0, lastOk: null, step: -1, due: null }, false, today);
  let r = newRun(bossQuestions(chapter, qstats));
  // Q1 ✓、Q2 ✗、Q3 ✗、Q4 ✗ → 負け
  for (const ok of [true, false, false, false]) {
    const q = currentQuestion(r);
    qstats[q.id] = applyAnswer(qstats[q.id], ok, today);
    r = answerRun(r, ok);
  }
  assert.equal(runResult(r), 'lose');
  const info = bossInfo(chapter, qstats);
  assert.equal(info.missed, 4); // Q2・Q3・Q4・Q5（Q5 は出なかったので間違えたまま）
  assert.equal(info.available, true);
  assert.deepEqual(bossQuestions(chapter, qstats).map((q) => q.id).sort(), ['Q2', 'Q3', 'Q4', 'Q5']);
});
