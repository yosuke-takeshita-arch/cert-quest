// 章のボス戦の「1回の戦い」の進み方。純粋な関数だけ（DOM も localStorage も触らない）。計算の部品は boss.js。
// 決まり（要件定義書 3-7）: 出した問題を順に答え、間違えた問題は、その回の最後にもう一度並べる。どちらかの体力が0になるまで続ける。
import { newBattle, applyBossAnswer, needsRetry } from './boss.js';

/**
 * 戦いの始まり。questions は bossQuestions() の結果（正解率の低い順）。
 * bossHp はボスの体力（rollBossHp() の結果）。省くと問題の数。問題の数より大きくは出来ない（出す問題より多いと、倒せなくなるため）。
 */
export function newRun(questions, bossHp) {
  const qs = Array.isArray(questions) ? questions.slice() : [];
  const hp = Number.isInteger(bossHp) && bossHp > 0 ? Math.min(bossHp, qs.length) : qs.length;
  return { queue: qs, wrongNext: [], battle: newBattle(hp), asked: 0, round: 1, requeued: false };
}

/** いま出す問題。決着がついていれば null。 */
export function currentQuestion(run) {
  if (run.battle.result) return null;
  return run.queue.length ? run.queue[0] : null;
}

/**
 * いまの問題への答えを反映した新しい状態を返す（元は変えない）。damage は正解のときボスが減る数（会心の一撃は 2）。
 * 間違えた問題は wrongNext にためておき、出す問題が尽きても決着していなければ、それを並べ直して次の回にする（requeued が true になる）。
 */
export function answerRun(run, correct, damage = 1) {
  const q = currentQuestion(run);
  if (!q) return { ...run, requeued: false };
  const battle = applyBossAnswer(run.battle, !!correct, damage);
  let queue = run.queue.slice(1);
  let wrongNext = correct ? run.wrongNext : [...run.wrongNext, q];
  let round = run.round;
  let requeued = false;
  if (needsRetry(battle, queue.length) && wrongNext.length) {
    queue = wrongNext;
    wrongNext = [];
    round++;
    requeued = true;
  }
  return { queue, wrongNext, battle, asked: run.asked + 1, round, requeued };
}

/** 決着がついたか（'win' / 'lose' / null）。 */
export function runResult(run) {
  return run.battle.result;
}
