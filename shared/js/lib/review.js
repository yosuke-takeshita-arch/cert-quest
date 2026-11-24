// 「今日の復習」の量を抑える（要件定義書 §6-3）。ブラウザにも node にも依存しない純粋な関数だけ。
// 期日が来た問題を、苦手な順に並べて、1日に出す数（REVIEW_DAILY_LIMIT）だけ選ぶ。あふれた問題は消さず、期日が来たまま残る（次の日にまた候補になる）。
import { dueIds } from './srs.js';

/** 1日に出す復習の数の目安。解ける数の上限ではない（「もっと復習する」で続けられる）。 */
export const REVIEW_DAILY_LIMIT = 60;

/** 正答率（正解÷解いた回数）と間違えた回数。解いた回数が正の整数でない壊れた記録は、いちばん後回し（正答率1・間違い0）。 */
function accuracy(rec) {
  if (!rec || !Number.isInteger(rec.seen) || rec.seen <= 0) return { rate: 1, wrong: 0 };
  const correct = Number.isInteger(rec.correct) ? Math.min(Math.max(rec.correct, 0), rec.seen) : 0;
  return { rate: correct / rec.seen, wrong: rec.seen - correct };
}

/**
 * 期日が来ている問題IDを、苦手な順に並べる。①正答率の低い順 ②間違えた回数の多い順 ③期日の古い順（それも同じなら ID の順）。
 * validIds（has(id) を持つ Map／Set）を渡すと、そこに無い問題（データから外した問題の記録）は入れない。
 */
export function sortedDueIds(qstats, today, validIds) {
  const st = qstats && typeof qstats === 'object' ? qstats : {};
  return dueIds(st, today)
    .filter((id) => !validIds || validIds.has(id))
    .map((id) => ({ id, ...accuracy(st[id]), due: st[id].due }))
    .sort((a, b) => (a.rate !== b.rate ? a.rate - b.rate : a.wrong !== b.wrong ? b.wrong - a.wrong : a.due !== b.due ? a.due - b.due : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((x) => x.id);
}

/**
 * 今日の復習の計画。
 *  total: 期日が来ている問題の数（上限を当てる前）
 *  ids:   今日出す問題（苦手な順。残りの枠 = limit − done だけ）
 *  over:  ids に入らなかった数（total − ids の数）。あふれ。
 *  rest:  期日が来ている問題すべて（苦手な順）。「もっと復習する」はここの先頭から出す
 *  done:  今日すでに復習として解いた数
 *  finished: 今日の枠を使い切ったのに、まだ期日の来た問題が残っている
 * 「1日に60問」は、今日解いた数（done）を引いた残りの枠で数える。解くほど件数が減り、枠を使い切ったら ids は空になる。
 */
export function reviewPlan(qstats, today, done = 0, validIds, limit = REVIEW_DAILY_LIMIT) {
  const rest = sortedDueIds(qstats, today, validIds);
  const d = Number.isInteger(done) && done > 0 ? done : 0;
  const quota = Math.max(0, limit - d);
  const ids = rest.slice(0, quota);
  return { total: rest.length, ids, over: rest.length - ids.length, rest, done: d, finished: quota === 0 && rest.length > 0 };
}

/** 1回の出題の数。今日の枠（最大60問）の中から、苦手な順に20問ずつ出す。 */
export const REVIEW_SESSION_SIZE = 20;

/** 「もっと復習する」で出す問題。残りの先頭から limit 問（同じ苦手な順）。 */
export function moreIds(plan, limit = REVIEW_SESSION_SIZE) {
  return plan.rest.slice(0, limit);
}

// ---- 今日の復習として解いた数（保存する。reviewToday = { day, n }） ----

const MAX_DONE = 100000;

/** 読んだ保存データを { day, n } にそろえる。壊れた値・項目なしは「記録なし」（day: null, n: 0）。 */
export function normalizeReviewToday(v) {
  if (v && typeof v === 'object' && Number.isInteger(v.day) && v.day >= 0 && Number.isInteger(v.n) && v.n >= 0) {
    return { day: v.day, n: Math.min(v.n, MAX_DONE) };
  }
  return { day: null, n: 0 };
}

/** 今日（dayNumber）復習として解いた数。別の日の記録は 0。 */
export function reviewDoneToday(reviewToday, today) {
  const r = normalizeReviewToday(reviewToday);
  return r.day === today ? r.n : 0;
}

/** 復習として1問解いたと数える（今日の分に足す。日が変わっていたら 1 から）。 */
export function bumpReviewToday(reviewToday, today) {
  return { day: today, n: Math.min(reviewDoneToday(reviewToday, today) + 1, MAX_DONE) };
}
