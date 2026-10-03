// 1日の目標・バッジの進み具合・次の目標の選び方。ブラウザ無しで node から叩く。
// 実行: cd shared && node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DAILY_GOAL, normalizeDailyGoal, answeredOn, dailyProgress, awardDailyGoal } from '../js/lib/daily.js';
import { badgeDefs, badgeProgress, awardBadges } from '../js/lib/badges.js';
import { nextGoals } from '../js/lib/goals.js';
import { defaultState, mergeState, recordAnswer } from '../js/lib/progress.js';
import { dateKey } from '../js/lib/srs.js';

const ans = (state, when, i = 0) => recordAnswer(state, { id: 'q' + i }, { correct: true, now: when });

function tree() {
  const st = (key, n) => ({ key, name: 'ステージ' + key, questions: Array.from({ length: n }, (_, i) => ({ id: key + i })), children: [] });
  const s1 = st('A1', 10);
  const s2 = st('A2', 10);
  const s3 = st('B1', 10);
  const empty = st('C1', 0);
  return { roots: [{ key: 'A', name: '技術', children: [s1, s2] }, { key: 'B', name: '法', children: [s3] }, { key: 'C', name: '空', children: [empty] }], stages: [s1, s2, s3, empty] };
}

test('1日の目標: 不正な値は10問、1〜500に収める', () => {
  assert.equal(DEFAULT_DAILY_GOAL, 10);
  for (const bad of [undefined, null, 'abc', NaN, 0, -3, 0.5, Infinity]) assert.equal(normalizeDailyGoal(bad), 10, String(bad));
  assert.equal(normalizeDailyGoal(1), 1);
  assert.equal(normalizeDailyGoal('20'), 20);
  assert.equal(normalizeDailyGoal(7.9), 7);
  assert.equal(normalizeDailyGoal(500), 500);
  assert.equal(normalizeDailyGoal(501), 500);
});

test('1日の目標: 0問・あと1問・ちょうど・超えた', () => {
  const s = defaultState();
  const k = '2026-10-03';
  assert.equal(answeredOn(s, k), 0);
  let p = dailyProgress(s, k);
  assert.deepEqual([p.goal, p.answered, p.remaining, p.ratio, p.done], [10, 0, 10, 0, false]);
  s.daily[k] = { answered: 9, correct: 5 };
  p = dailyProgress(s, k);
  assert.deepEqual([p.remaining, p.done], [1, false]);
  s.daily[k].answered = 10;
  p = dailyProgress(s, k);
  assert.deepEqual([p.remaining, p.ratio, p.done], [0, 1, true]);
  s.daily[k].answered = 25;
  p = dailyProgress(s, k);
  assert.deepEqual([p.remaining, p.ratio, p.done], [0, 1, true]);
});

test('1日の目標: 達成のお祝いは1日1回。目標を下げても同じ日には出し直さない', () => {
  const s = defaultState();
  const k = '2026-10-03';
  s.daily[k] = { answered: 9, correct: 9 };
  assert.equal(awardDailyGoal(s, k), false);
  s.daily[k].answered = 10;
  assert.equal(awardDailyGoal(s, k), true);
  assert.equal(s.goalAwarded, k);
  s.daily[k].answered = 11;
  assert.equal(awardDailyGoal(s, k), false);
  s.settings.dailyGoal = 5;
  assert.equal(awardDailyGoal(s, k), false);
});

test('1日の目標: 目標を下げて、すでに超えていたら、その日1回だけ出る', () => {
  const s = defaultState();
  const k = '2026-10-03';
  s.daily[k] = { answered: 6, correct: 6 };
  assert.equal(awardDailyGoal(s, k), false);
  s.settings.dailyGoal = 5;
  assert.equal(awardDailyGoal(s, k), true);
  assert.equal(awardDailyGoal(s, k), false);
});

test('1日の目標: 日をまたぐと数え直し、翌日はまた1回お祝いが出る（23:59:59 と 0:00:00 の境目）', () => {
  const s = defaultState();
  s.settings.dailyGoal = 2;
  const before = new Date(2026, 9, 3, 23, 59, 59);
  const after = new Date(2026, 9, 4, 0, 0, 0);
  ans(s, before, 1);
  ans(s, before, 2);
  assert.equal(dateKey(before), '2026-10-03');
  assert.equal(dateKey(after), '2026-10-04');
  assert.equal(awardDailyGoal(s, dateKey(before)), true);
  ans(s, after, 3);
  assert.equal(dailyProgress(s, '2026-10-03').answered, 2);
  assert.equal(dailyProgress(s, '2026-10-04').answered, 1);
  assert.equal(awardDailyGoal(s, '2026-10-04'), false);
  ans(s, after, 4);
  assert.equal(awardDailyGoal(s, '2026-10-04'), true);
  assert.equal(awardDailyGoal(s, '2026-10-04'), false);
});

test('保存データ: 配色の設定は初期が light。dark / auto は残り、不正な値と古い記録は light になる', () => {
  assert.equal(defaultState().settings.theme, 'light');
  assert.equal(mergeState({ settings: { sound: true } }).settings.theme, 'light');
  assert.equal(mergeState({ settings: { theme: 'dark' } }).settings.theme, 'dark');
  assert.equal(mergeState({ settings: { theme: 'auto' } }).settings.theme, 'auto');
  assert.equal(mergeState({ settings: { theme: 'blue' } }).settings.theme, 'light');
});

test('保存データ: 古い記録（目標の項目なし）を読んでも初期値で埋まる。不正な値も直る', () => {
  const old = { v: 1, xp: 120, totals: { answered: 12, correct: 9 }, settings: { sound: true } };
  const m = mergeState(old);
  assert.equal(m.settings.dailyGoal, 10);
  assert.equal(m.settings.sound, true);
  assert.equal(m.settings.vibrate, true);
  assert.equal(m.goalAwarded, null);
  assert.equal(m.xp, 120);
  assert.equal(mergeState({ settings: { dailyGoal: 'x' }, goalAwarded: 5 }).settings.dailyGoal, 10);
  assert.equal(mergeState({ settings: { dailyGoal: 30 }, goalAwarded: '2026-10-03' }).settings.dailyGoal, 30);
  assert.equal(mergeState({ settings: { dailyGoal: 30 }, goalAwarded: '2026-10-03' }).goalAwarded, '2026-10-03');
  assert.equal(mergeState(null).settings.dailyGoal, 10);
});

test('バッジの進み具合: 0・途中・ちょうど・超えた（上限で止める）', () => {
  const defs = badgeDefs({ roots: [] }, {});
  const c100 = defs.find((d) => d.id === 'correct-100');
  const s = defaultState();
  const k = '2026-10-03';
  let p = badgeProgress(c100, s, k);
  assert.deepEqual([p.cur, p.max, p.remaining, p.ratio, p.unit], [0, 100, 100, 0, '問']);
  s.totals.correct = 73;
  p = badgeProgress(c100, s, k);
  assert.deepEqual([p.cur, p.max, p.remaining], [73, 100, 27]);
  s.totals.correct = 100;
  p = badgeProgress(c100, s, k);
  assert.deepEqual([p.cur, p.remaining, p.ratio], [100, 0, 1]);
  s.totals.correct = 130;
  p = badgeProgress(c100, s, k);
  assert.deepEqual([p.cur, p.remaining, p.ratio], [100, 0, 1]);
});

test('バッジの進み具合: 連続日数は途切れたら0、レベルは残りXP', () => {
  const defs = badgeDefs({ roots: [] }, {});
  const s = defaultState();
  s.streak = { last: '2026-10-01', count: 5, best: 5 };
  assert.equal(badgeProgress(defs.find((d) => d.id === 'streak-7'), s, '2026-10-02').cur, 5, '昨日まで続いていれば今日も続き');
  assert.equal(badgeProgress(defs.find((d) => d.id === 'streak-7'), s, '2026-10-03').cur, 0, '1日空いたら0');
  s.xp = 460;
  const lv5 = badgeProgress(defs.find((d) => d.id === 'level-5'), s, '2026-10-03');
  assert.deepEqual([lv5.cur, lv5.max, lv5.remaining, lv5.unit], [460, 500, 40, 'XP']);
});

test('バッジの進み具合: 模試は10問以上のうち最高の正答率（切り捨て）。9問の模試は数えない', () => {
  const defs = badgeDefs({ roots: [] }, {});
  const e70 = defs.find((d) => d.id === 'exam-70');
  const s = defaultState();
  assert.equal(badgeProgress(e70, s, 'k').cur, 0);
  s.exams = [{ total: 9, correct: 9 }, { total: 100, correct: 69 }, { total: 20, correct: 12 }];
  assert.equal(badgeProgress(e70, s, 'k').cur, 69);
  assert.equal(e70.test(s), false);
  s.exams.push({ total: 10, correct: 7 });
  assert.equal(e70.test(s), true);
  const p = badgeProgress(e70, s, 'k');
  assert.deepEqual([p.cur, p.remaining], [70, 0]);
});

test('バッジの進み具合: 大項目の制覇はクリアしたステージ数、行き先は未クリアの先頭', () => {
  const t = tree();
  const defs = badgeDefs(t, {});
  const major = defs.find((d) => d.id === 'major:A');
  const s = defaultState();
  let p = badgeProgress(major, s, 'k');
  assert.deepEqual([p.cur, p.max, p.unit, p.action], [0, 2, 'ステージ', { kind: 'stage', key: 'A1' }]);
  s.stages.A1 = { stars: 1, best: 0.6, runs: 1 };
  p = badgeProgress(major, s, 'k');
  assert.deepEqual([p.cur, p.action], [1, { kind: 'stage', key: 'A2' }]);
  assert.equal(defs.some((d) => d.id === 'major:C'), false, '問題のない大項目にバッジは無い');
});

test('進み具合の関数が無い定義でも落ちない', () => {
  const p = badgeProgress({ id: 'x', name: 'x', test: () => false }, defaultState(), 'k');
  assert.deepEqual([p.cur, p.max, p.ratio], [0, 0, 0]);
});

test('次の目標: 残りの割合が小さい順に3つまで。取ったバッジは出ない', () => {
  const t = tree();
  const defs = badgeDefs(t, {});
  const s = defaultState();
  const k = '2026-10-03';
  s.totals = { answered: 40, correct: 73 };
  s.streak = { last: k, count: 5, best: 5 };
  s.xp = 460;
  awardBadges(s, defs, k);
  const g = nextGoals(t, defs, s, k, 3);
  assert.equal(g.length, 3);
  assert.deepEqual(g.map((x) => x.title), ['レベル5', '100問正解', '7日連続']);
  assert.equal(g[0].remainText, 'あと40XP');
  assert.equal(g[1].remainText, 'あと27問');
  assert.equal(g[2].remainText, 'あと2日');
  for (let i = 1; i < g.length; i++) assert.ok(g[i - 1].ratio >= g[i].ratio);
  assert.ok(!g.some((x) => x.title === 'はじめの一歩' || x.title === '10問正解'));
});

test('次の目標: 件数の上限（0・1・多すぎ）と、同じ割合なら定義の順', () => {
  const t = tree();
  const defs = badgeDefs(t, {});
  const s = defaultState();
  const k = '2026-10-03';
  assert.equal(nextGoals(t, defs, s, k, 0).length, 0);
  assert.equal(nextGoals(t, defs, s, k, 1).length, 1);
  const all = nextGoals(t, defs, s, k, 999);
  assert.equal(all.length, defs.length, '星の候補は無いので、未取得のバッジ全部');
  assert.equal(all[0].id, 'first-answer', '全部0なら定義の先頭から');
});

test('次の目標: 星3になっていないステージ（挑戦済み）が候補に入る。未挑戦・星3・問題なしは入らない', () => {
  const t = tree();
  const defs = badgeDefs(t, {});
  const s = defaultState();
  const k = '2026-10-03';
  s.stages.A1 = { stars: 2, best: 0.85, runs: 3 };
  s.stages.A2 = { stars: 3, best: 1, runs: 1 };
  s.stages.B1 = { stars: 0, best: 0.2, runs: 0 };
  s.stages.C1 = { stars: 1, best: 0.7, runs: 1 };
  const stars = nextGoals(t, defs, s, k, 999).filter((x) => x.kind === 'stars');
  assert.deepEqual(stars.map((x) => x.id), ['stars:A1']);
  assert.equal(stars[0].title, 'ステージA1（星3）');
  assert.equal(stars[0].remainText, 'あと星1つ');
  assert.deepEqual(stars[0].action, { kind: 'stage', key: 'A1' });
});

test('次の目標: すべて取り終えたら0件', () => {
  const t = { roots: [], stages: [] };
  const defs = badgeDefs(t, {});
  const s = defaultState();
  for (const d of defs) s.badges[d.id] = '2026-10-03';
  assert.deepEqual(nextGoals(t, defs, s, '2026-10-03', 3), []);
});
