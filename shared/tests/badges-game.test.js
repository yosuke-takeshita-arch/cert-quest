// 「どっち？」とボス戦のバッジ5つ（要件定義書 §3-8）の判定・記録・古い記録の読み込み。
// 実行: cd shared && node --test tests/badges-game.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgeDefs, awardBadges, badgeProgress, badgeArtName, COMMON_BADGE_ART } from '../js/lib/badges.js';
import { defaultState, mergeState } from '../js/lib/progress.js';
import { recordDochi, DOCHI_ROUNDS } from '../js/lib/dochi.js';
import { recordBossWin, normalizeBossFlawless, isFlawlessWin, newBattle, applyBossAnswer, PLAYER_HP } from '../js/lib/boss.js';
import { parseBackup, serializeBackup } from '../js/lib/backup.js';

const NEW5 = ['dochi-perfect', 'dochi-combo-10', 'boss-first', 'boss-all', 'boss-flawless'];

// 章3つ（1つは問題なし）。ボスが出られる章は問題のある2つだけ
function tree() {
  const st = (key, n) => ({ key, name: '章' + key, questions: Array.from({ length: n }, (_, i) => ({ id: key + i })), children: [] });
  const a = st('T|A', 10);
  const b = st('T|B', 10);
  const c = st('T|C', 0);
  return { roots: [{ key: 'T', id: 'T', name: 'T', children: [a, b, c] }], stages: [a, b, c] };
}
const defs = () => badgeDefs(tree(), { challenge: {}, secondsPerQuestion: 40 });
const def = (id) => defs().find((d) => d.id === id);

test('5つが共通の並びの 13〜17 番目に、この順で並ぶ（boss-first → boss-all → boss-flawless）', () => {
  const ids = defs().map((d) => d.id);
  assert.deepEqual(ids.slice(12, 17), ['dochi-perfect', 'dochi-combo-10', 'boss-first', 'boss-all', 'boss-flawless']);
  assert.equal(new Set(ids).size, ids.length);
});

test('絵はまだ無い: 5つとも絵の名前は null（記号の表示）', () => {
  for (const id of NEW5) {
    assert.equal(badgeArtName(def(id)), null, id);
    assert.equal(COMMON_BADGE_ART.includes(id), false, id);
  }
});

test('dochi-perfect: 19問では取れず、20問で取れる（境目）', () => {
  const s = defaultState();
  s.dochi = { runs: 1, best: DOCHI_ROUNDS - 1, bestCombo: 3 };
  assert.equal(def('dochi-perfect').test(s), false);
  s.dochi.best = DOCHI_ROUNDS;
  assert.equal(def('dochi-perfect').test(s), true);
});

test('dochi-combo-10: コンボ9では取れず、10で取れる（境目）', () => {
  const s = defaultState();
  s.dochi = { runs: 1, best: 9, bestCombo: 9 };
  assert.equal(def('dochi-combo-10').test(s), false);
  s.dochi.bestCombo = 10;
  assert.equal(def('dochi-combo-10').test(s), true);
});

test('「どっち？」の結果を記録すると（recordDochi → awardBadges）、その場で取れる', () => {
  const s = defaultState();
  recordDochi(s, 19, 9);
  assert.deepEqual(awardBadges(s, defs(), '2026-10-09').map((d) => d.id), []);
  recordDochi(s, 20, 20);
  assert.deepEqual(awardBadges(s, defs(), '2026-10-09').map((d) => d.id), ['dochi-perfect', 'dochi-combo-10']);
  assert.equal(s.badges['dochi-perfect'], '2026-10-09');
  assert.deepEqual(awardBadges(s, defs(), '2026-10-10').map((d) => d.id), []); // 二度は取らない・日付も変わらない
  assert.equal(s.badges['dochi-perfect'], '2026-10-09');
});

test('boss-first: 撃破0回では取れず、1回で取れる。どの章でもよい', () => {
  const s = defaultState();
  assert.equal(def('boss-first').test(s), false);
  recordBossWin(s, 'T|B');
  assert.equal(def('boss-first').test(s), true);
});

test('boss-all: 問題のある全章（この木では2章）を倒すまで取れない。1章足りないと取れない', () => {
  const s = defaultState();
  const d = def('boss-all');
  assert.equal(d.test(s), false);
  recordBossWin(s, 'T|A');
  assert.equal(d.test(s), false); // 1章だけ
  assert.deepEqual(badgeProgress(d, s, '2026-10-09').remaining, 1);
  recordBossWin(s, 'T|A'); // 同じ章を何度倒しても増えない
  assert.equal(d.test(s), false);
  recordBossWin(s, '消えた章');  // 木に無い章の記録は数えない
  assert.equal(d.test(s), false);
  recordBossWin(s, 'T|B');
  assert.equal(d.test(s), true);
});

test('boss-all: 問題の無い章（T|C）は「全部の章」に入れない。説明に章の数が出る。説明と進み具合の数が合う', () => {
  const d = def('boss-all');
  assert.match(d.desc, /全2章/);
  const p = badgeProgress(d, defaultState(), '2026-10-09');
  assert.deepEqual([p.cur, p.max, p.unit], [0, 2, '章']);
});

test('boss-all: 問題のある章が1つも無い木では作らない（何もしなくても取れてしまうのを防ぐ）', () => {
  const none = badgeDefs({ roots: [], stages: [] }, { challenge: {}, secondsPerQuestion: 40 });
  assert.equal(none.some((d) => d.id === 'boss-all'), false);
  assert.equal(badgeDefs(null, {}).some((d) => d.id === 'boss-all'), false);
  const s = defaultState();
  assert.deepEqual(awardBadges(s, none, '2026-10-09').map((d) => d.id), []);
});

test('boss-flawless: ハートを減らして勝つと取れない・減らさずに勝つと取れる', () => {
  const s = defaultState();
  const d = def('boss-flawless');
  // ハートを1つ減らして勝った
  let b = newBattle(2);
  b = applyBossAnswer(b, false);
  b = applyBossAnswer(b, true);
  b = applyBossAnswer(b, true);
  assert.equal(b.result, 'win');
  assert.equal(b.player, PLAYER_HP - 1);
  assert.equal(isFlawlessWin(b), false);
  recordBossWin(s, 'T|A', isFlawlessWin(b));
  assert.equal(d.test(s), false);
  assert.equal(s.bossFlawless, 0);
  assert.equal(def('boss-first').test(s), true);
  // 減らさずに勝った
  let c = newBattle(2);
  c = applyBossAnswer(c, true);
  c = applyBossAnswer(c, true);
  assert.equal(isFlawlessWin(c), true);
  recordBossWin(s, 'T|A', isFlawlessWin(c));
  assert.equal(s.bossFlawless, 1);
  assert.equal(d.test(s), true);
});

test('isFlawlessWin: 負け・途中・空はノーダメージではない', () => {
  assert.equal(isFlawlessWin(newBattle(2)), false); // 途中（体力は満タンだが勝っていない）
  let lose = newBattle(5);
  for (let i = 0; i < PLAYER_HP; i++) lose = applyBossAnswer(lose, false);
  assert.equal(lose.result, 'lose');
  assert.equal(isFlawlessWin(lose), false);
  assert.equal(isFlawlessWin(null), false);
  assert.equal(isFlawlessWin(undefined), false);
});

test('古い記録（bossFlawless も dochi も boss も無い）を読める。バッジは取れていない', () => {
  const old = { v: 1, xp: 10, totals: { answered: 3, correct: 2 }, badges: { 'first-answer': '2026-09-01' } };
  const s = mergeState(old);
  assert.equal(s.bossFlawless, 0);
  assert.deepEqual(s.dochi, { runs: 0, best: 0, bestCombo: 0 });
  assert.deepEqual(s.boss, {});
  assert.deepEqual(awardBadges(s, defs(), '2026-10-09').map((d) => d.id).filter((id) => NEW5.includes(id)), []);
});

test('壊れた値は捨てる: bossFlawless は正の整数だけ。dochi・boss の壊れた値は 0 / 捨てる', () => {
  for (const bad of ['3', -1, 0.5, NaN, Infinity, null, undefined, {}, [], true]) {
    assert.equal(mergeState({ bossFlawless: bad }).bossFlawless, 0, String(bad));
    assert.equal(normalizeBossFlawless(bad), 0, String(bad));
  }
  assert.equal(mergeState({ bossFlawless: 4 }).bossFlawless, 4);
  const s = mergeState({ dochi: { runs: 'x', best: -3, bestCombo: NaN }, boss: { 'T|A': 'x', 'T|B': -1, 'T|C': 1.5 } });
  assert.deepEqual(s.dochi, { runs: 0, best: 0, bestCombo: 0 });
  assert.deepEqual(s.boss, {});
  // 壊れた値のまま判定しても、バッジは取れない・落ちない
  const broken = defaultState();
  broken.dochi = { best: 'x', bestCombo: null };
  broken.boss = { 'T|A': 'x' };
  broken.bossFlawless = 'x';
  assert.deepEqual(awardBadges(broken, defs(), '2026-10-09').map((d) => d.id).filter((id) => NEW5.includes(id)), []);
});

test('書き出し・読み込みで bossFlawless が残る', () => {
  const s = defaultState();
  s.bossFlawless = 2;
  const back = parseBackup(serializeBackup('g-kentei', s), 'g-kentei');
  assert.ok(back.ok, JSON.stringify(back));
  assert.equal(back.state.bossFlawless, 2);
});

test('進み具合: 5つとも max があり、行き先がある（次の目標に出せる）', () => {
  const s = defaultState();
  for (const id of NEW5) {
    const p = badgeProgress(def(id), s, '2026-10-09');
    assert.ok(p.max > 0, id);
    assert.ok(['dochi', 'boss'].includes(p.action.kind), id);
  }
});
