// 復習の量を抑える（要件定義書 §6-3）: 間隔3回・14日待ちは卒業・受験日で打ち切り・1日60問を苦手な順に。
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAnswer, isDue, dueIds, upcoming, dayNumber, INTERVALS } from '../js/lib/srs.js';
import { REVIEW_DAILY_LIMIT, REVIEW_SESSION_SIZE, sortedDueIds, reviewPlan, moreIds, normalizeReviewToday, reviewDoneToday, bumpReviewToday } from '../js/lib/review.js';
import { defaultState, mergeState, recordAnswer, todayReviewPlan } from '../js/lib/progress.js';
import { examDayNumber } from '../js/lib/examdate.js';

const rec = (seen, correct, due, step = 0) => ({ seen, correct, lastOk: false, step, due });

test('間隔は翌日・3日・7日の3回。3回目の正解で卒業', () => {
  assert.deepEqual(INTERVALS, [1, 3, 7]);
  let r = applyAnswer(undefined, false, 10);
  assert.deepEqual([r.step, r.due], [0, 11]);
  r = applyAnswer(r, true, 11);
  assert.deepEqual([r.step, r.due], [1, 14]);
  r = applyAnswer(r, true, 14);
  assert.deepEqual([r.step, r.due], [2, 21]);
  r = applyAnswer(r, true, 21);
  assert.deepEqual([r.step, r.due], [-1, null]);
});

test('14日後を待っている古い記録（step 3）は卒業扱い: 復習に出ず、予定にも数えず、記録は消さない。次に答えると卒業', () => {
  const old = { seen: 4, correct: 3, lastOk: true, step: 3, due: 5 };
  assert.equal(isDue(old, 100), false);
  assert.deepEqual(dueIds({ a: old }, 100), []);
  assert.deepEqual(upcoming({ a: old }, 100), { now: 0, tomorrow: 0, later: 0 });
  assert.deepEqual(old, { seen: 4, correct: 3, lastOk: true, step: 3, due: 5 }); // 書き換えない
  const g = applyAnswer(old, true, 100);
  assert.deepEqual([g.step, g.due], [-1, null]);
  const w = applyAnswer(old, false, 100); // 間違えれば最初から
  assert.deepEqual([w.step, w.due], [0, 101]);
});

test('壊れた記録は復習待ちに数えない（step が整数でない・due が数でない）', () => {
  const qs = { a: { step: 0, due: null }, b: { step: 'x', due: 1 }, c: { step: 0, due: 'z' }, d: { step: 0, due: NaN }, e: { step: 1.5, due: 1 }, f: null, g: { step: 0, due: 1 } };
  assert.deepEqual(dueIds(qs, 10), ['g']);
});

test('受験日の境界: 前日・当日・翌日に次の復習が来る場合', () => {
  const exam = 100;
  const at = (today) => applyAnswer({ seen: 2, correct: 1, lastOk: false, step: 1, due: today }, true, today, undefined, exam); // 次は7日後
  assert.equal(at(93).step, 2); // 93+7=100: 受験日ちょうど → 残す
  assert.equal(at(93).due, 100);
  assert.equal(at(94).step, -1); // 94+7=101: 受験日の翌日 → 卒業
  assert.equal(at(92).step, 2); // 99: 受験日の前日 → 残す
  // 誤答: 次は翌日。受験日の前日の誤答は受験日に出る／受験日当日の誤答は翌日＝受験日より後
  assert.equal(applyAnswer(undefined, false, 99, undefined, exam).step, 0);
  assert.equal(applyAnswer(undefined, false, 99, undefined, exam).due, 100);
  const onDay = applyAnswer(undefined, false, 100, undefined, exam);
  assert.equal(onDay.step, -1);
  assert.equal(onDay.due, 101); // ボス戦の並びのために間違えた日+1は残す
  assert.equal(isDue(onDay, 200), false);
  assert.equal(onDay.lastOk, false);
});

test('受験日が未設定・過ぎた後は、ふつうの間隔', () => {
  assert.equal(applyAnswer(undefined, false, 100, undefined, null).step, 0);
  assert.equal(applyAnswer(undefined, false, 100, undefined, undefined).step, 0);
  assert.equal(applyAnswer(undefined, false, 100, undefined, 50).step, 0); // 受験日はもう過ぎている
  assert.equal(applyAnswer(undefined, false, 100, undefined, 50).due, 101);
  assert.equal(applyAnswer({ seen: 1, correct: 0, lastOk: false, step: 0, due: 100 }, true, 100, undefined, 99).step, 1);
});

test('examDayNumber: 聞いて決めた受験日だけ。未設定・未確認・壊れた値は null', () => {
  const d = dayNumber(new Date(2026, 10, 6));
  assert.equal(examDayNumber({ examAsked: true, examDate: '2026-11-06' }), d);
  assert.equal(examDayNumber({ examAsked: true, examDate: null }), null);
  assert.equal(examDayNumber({ examAsked: false, examDate: '2026-11-06' }), null);
  assert.equal(examDayNumber({ examAsked: true, examDate: '2026-02-30' }), null);
  assert.equal(examDayNumber(undefined), null);
});

test('recordAnswer は設定の受験日で打ち切る（受験日当日に間違えた問題は復習に出ない）', () => {
  const s = defaultState();
  s.settings.examAsked = true;
  s.settings.examDate = '2026-11-06';
  recordAnswer(s, { id: 'q1' }, { correct: false, now: new Date(2026, 10, 6, 9) });
  assert.equal(s.qstats.q1.step, -1);
  recordAnswer(s, { id: 'q2' }, { correct: false, now: new Date(2026, 10, 5, 9) });
  assert.equal(s.qstats.q2.step, 0);
  assert.equal(s.qstats.q2.due, dayNumber(new Date(2026, 10, 6)));
});

// ---- 1日60問 ----

test('並び: ①正答率の低い順 ②間違えた回数の多い順 ③期日の古い順', () => {
  const qs = {
    hi: rec(10, 9, 5),     // 0.9
    lo: rec(10, 1, 9),     // 0.1
    mid1: rec(2, 1, 8),    // 0.5, 間違い1
    mid2: rec(10, 5, 8),   // 0.5, 間違い5 → mid1 より先
    same1: rec(4, 2, 7),   // 0.5, 間違い2, 期日7
    same2: rec(4, 2, 6),   // 0.5, 間違い2, 期日6 → same1 より先
  };
  assert.deepEqual(sortedDueIds(qs, 20), ['lo', 'mid2', 'same2', 'same1', 'mid1', 'hi']);
});

test('並び: 正答率も間違いも期日も同じなら ID の順（毎回同じ並び）。壊れた記録は最後', () => {
  const qs = { b: rec(2, 1, 5), a: rec(2, 1, 5), bad: { seen: 0, correct: 0, step: 0, due: 1 } };
  assert.deepEqual(sortedDueIds(qs, 10), ['a', 'b', 'bad']);
});

test('並び: 期日がちょうど今日のものは入り、明日のものは入らない。validIds に無い問題は入らない', () => {
  const qs = { a: rec(2, 0, 10), b: rec(2, 0, 11), gone: rec(2, 0, 1) };
  assert.deepEqual(sortedDueIds(qs, 10, new Set(['a', 'b'])), ['a']);
  assert.deepEqual(sortedDueIds(qs, 11, new Set(['a', 'b'])), ['a', 'b']);
});

function many(n) {
  const qs = {};
  for (let i = 0; i < n; i++) qs['q' + String(i).padStart(3, '0')] = rec(10, i % 10, 1); // 正答率 0〜0.9
  return qs;
}

test('上限: 59・60・61問。あふれは消さず、数に出す', () => {
  assert.equal(REVIEW_DAILY_LIMIT, 60);
  const p59 = reviewPlan(many(59), 5, 0);
  assert.deepEqual([p59.total, p59.ids.length, p59.over, p59.finished], [59, 59, 0, false]);
  const p60 = reviewPlan(many(60), 5, 0);
  assert.deepEqual([p60.total, p60.ids.length, p60.over], [60, 60, 0]);
  const p61 = reviewPlan(many(61), 5, 0);
  assert.deepEqual([p61.total, p61.ids.length, p61.over], [61, 60, 1]);
  assert.equal(p61.rest.length, 61); // 残りも全部持つ
});

test('上限: 選ばれた60問は、あふれた問題よりすべて苦手（正答率が低いか同じ）', () => {
  const qs = many(250);
  const p = reviewPlan(qs, 5, 0);
  const rate = (id) => qs[id].correct / qs[id].seen;
  const worstOut = Math.min(...p.rest.slice(60).map(rate));
  assert.ok(Math.max(...p.ids.map(rate)) <= worstOut);
  assert.equal(p.ids.length, 60);
  assert.equal(p.over, 190);
});

test('今日の枠: 解くほど減り、60問を解き終えたら ids は空・finished。残りは「もっと復習する」で同じ順', () => {
  let qs = many(100);
  const first = reviewPlan(qs, 5, 0);
  // 20問解いた（正解して期日が先へ進んだ）あと
  for (const id of first.ids.slice(0, 20)) qs = { ...qs, [id]: applyAnswer(qs[id], true, 5) };
  const mid = reviewPlan(qs, 5, 20);
  assert.equal(mid.ids.length, 40);
  assert.deepEqual(mid.ids, first.ids.slice(20, 60)); // 続きから（同じ順）
  assert.equal(mid.finished, false);
  // 60問終えた
  for (const id of first.ids.slice(20, 60)) qs = { ...qs, [id]: applyAnswer(qs[id], true, 5) };
  const end = reviewPlan(qs, 5, 60);
  assert.deepEqual([end.ids.length, end.finished, end.total, end.over], [0, true, 40, 40]);
  assert.deepEqual(moreIds(end), end.rest.slice(0, 20));
  assert.equal(moreIds(end).length, 20);
  assert.equal(REVIEW_SESSION_SIZE, 20);
  // 全部終えたら finished ではなく 0 件
  const none = reviewPlan({}, 5, 60);
  assert.deepEqual([none.ids.length, none.finished, none.total], [0, false, 0]);
});

test('今日の枠: 59問解いたら残りは1問、61問解いていても枠は 0（マイナスにならない）', () => {
  const qs = many(100);
  assert.equal(reviewPlan(qs, 5, 59).ids.length, 1);
  assert.equal(reviewPlan(qs, 5, 60).ids.length, 0);
  assert.equal(reviewPlan(qs, 5, 61).ids.length, 0);
  assert.equal(reviewPlan(qs, 5, -3).ids.length, 60);
  assert.equal(reviewPlan(qs, 5, 'x').ids.length, 60);
});

test('数えた数の保存: 日が変われば数え直し。壊れた値・項目なしは記録なし', () => {
  assert.deepEqual(normalizeReviewToday(undefined), { day: null, n: 0 });
  assert.deepEqual(normalizeReviewToday({ day: 'a', n: 3 }), { day: null, n: 0 });
  assert.deepEqual(normalizeReviewToday({ day: 5, n: -1 }), { day: null, n: 0 });
  assert.deepEqual(normalizeReviewToday({ day: 5, n: 1.5 }), { day: null, n: 0 });
  assert.deepEqual(normalizeReviewToday({ day: 5, n: 3 }), { day: 5, n: 3 });
  assert.equal(reviewDoneToday({ day: 5, n: 3 }, 5), 3);
  assert.equal(reviewDoneToday({ day: 5, n: 3 }, 6), 0);
  assert.deepEqual(bumpReviewToday({ day: 5, n: 3 }, 5), { day: 5, n: 4 });
  assert.deepEqual(bumpReviewToday({ day: 5, n: 3 }, 6), { day: 6, n: 1 });
  assert.deepEqual(bumpReviewToday(undefined, 6), { day: 6, n: 1 });
  assert.deepEqual(mergeState({}).reviewToday, { day: null, n: 0 });
  assert.deepEqual(mergeState({ reviewToday: { day: 7, n: 2 } }).reviewToday, { day: 7, n: 2 });
});

test('recordAnswer: review:true のときだけ今日の復習として数える。todayReviewPlan に枠が反映される', () => {
  const s = defaultState();
  const now = new Date(2026, 9, 23, 10);
  const today = dayNumber(now);
  const byId = new Map();
  for (let i = 0; i < 70; i++) {
    const id = 'q' + i;
    byId.set(id, { id });
    s.qstats[id] = rec(10, 1, today - 1);
  }
  assert.equal(todayReviewPlan(s, byId, now).ids.length, 60);
  recordAnswer(s, { id: 'q0' }, { correct: true, now }); // ステージ練習などの1問は数えない
  assert.equal(s.reviewToday.n, 0);
  for (let i = 1; i <= 3; i++) recordAnswer(s, { id: 'q' + i }, { correct: true, now, review: true });
  assert.deepEqual(s.reviewToday, { day: today, n: 3 });
  const p = todayReviewPlan(s, byId, now);
  assert.equal(p.ids.length, 57); // 枠は 60-3。期日が来ているのは 70-4=66 問
  assert.equal(p.total, 66);
  assert.equal(p.over, 9);
});
