// 章のボス戦の「1回の戦い」の進み方。純粋な関数だけ（DOM も localStorage も触らない）。計算の部品は boss.js。
// 決まり（要件定義書 3-7）: 出した問題を順に答え、間違えた問題は、その回の最後にもう一度並べる。どちらかの体力が0になるまで続ける。
import { newBattle, applyBossAnswer, needsRetry } from './boss.js';

/** 戦いの始まり。questions は bossQuestions() の結果（古く間違えた順）。 */
export function newRun(questions) {
  const qs = Array.isArray(questions) ? questions.slice() : [];
  return { queue: qs, wrongNext: [], battle: newBattle(qs.length), asked: 0, round: 1, requeued: false };
}

/** いま出す問題。決着がついていれば null。 */
export function currentQuestion(run) {
  if (run.battle.result) return null;
  return run.queue.length ? run.queue[0] : null;
}

/**
 * いまの問題への答えを反映した新しい状態を返す（元は変えない）。
 * 間違えた問題は wrongNext にためておき、出す問題が尽きても決着していなければ、それを並べ直して次の回にする（requeued が true になる）。
 */
export function answerRun(run, correct) {
  const q = currentQuestion(run);
  if (!q) return { ...run, requeued: false };
  const battle = applyBossAnswer(run.battle, !!correct);
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
