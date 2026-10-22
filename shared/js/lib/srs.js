// 復習の間隔（間隔反復）。ブラウザにも node にも依存しない純粋な関数だけ。
// 間隔は「直前に解いた日からの日数」: 誤答→1日後→3日後→7日後→卒業（要件定義書 §6-3。2026-10-23 に14日後をやめた）。

export const INTERVALS = [1, 3, 7];

/** 端末のローカル日付を「1970-01-01 からの日数」にする。時刻・夏時間に左右されない。 */
export function dayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

export function dateKey(date) {
  const p = (n) => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + p(date.getMonth() + 1) + '-' + p(date.getDate());
}

export function newRecord() {
  // step: -1=復習待ちではない／0〜: INTERVALS の何番目を待っているか。due: 復習すべき日（dayNumber）
  return { seen: 0, correct: 0, lastOk: null, step: -1, due: null };
}

/**
 * 1回の回答を記録した新しい記録を返す（元は変えない）。
 * - 誤答: いつでも最初（step 0、翌日）に戻す
 * - 正解: 復習待ちで、期日が来ている場合だけ次の間隔へ進める。最後の間隔を終えたら卒業（復習待ちから外す）
 *   期日前の正解（ステージ練習でたまたま当たった等）では間隔を飛ばさない
 * - examDay（受験日の dayNumber。無ければ null）: 次の復習の日が受験日より後になるなら、その問題は卒業にする（本番の前に役に立たないため）。
 *   受験日がすでに過ぎている（today より前）ときは何もしない＝ふつうの間隔。
 *   誤答で卒業にするとき（受験日の前日・当日）は、「最後に間違えた問題」を古い順に並べるボス戦のために due（間違えた日+1）は残す。step が -1 なので復習には出ない。
 */
export function applyAnswer(rec, correct, today, intervals = INTERVALS, examDay = null) {
  const r = { ...newRecord(), ...(rec || {}) };
  r.seen += 1;
  if (correct) r.correct += 1;
  r.lastOk = !!correct;
  const limit = Number.isFinite(examDay) && examDay >= today ? examDay : null;
  if (!correct) {
    r.step = 0;
    r.due = today + intervals[0];
    if (limit !== null && r.due > limit) r.step = -1;
  } else if (r.step >= 0 && r.due !== null && r.due <= today) {
    const next = r.step + 1;
    if (next >= intervals.length || (limit !== null && today + intervals[next] > limit)) {
      r.step = -1;
      r.due = null;
    } else {
      r.step = next;
      r.due = today + intervals[next];
    }
  }
  return r;
}

/**
 * 復習待ちの記録か。これまでの記録で14日後を待っている（step が INTERVALS の長さ以上）ものは、すでに3回正解しているので卒業として扱う。
 * 記録は書き換えない（次に答えたとき applyAnswer が卒業にする）。
 */
export function isWaiting(rec) {
  return !!rec && Number.isInteger(rec.step) && rec.step >= 0 && rec.step < INTERVALS.length && Number.isFinite(rec.due);
}

export function isDue(rec, today) {
  return isWaiting(rec) && rec.due <= today;
}

/** 期日が来ている問題IDを、古い期日順で返す。 */
export function dueIds(qstats, today) {
  return Object.keys(qstats || {})
    .filter((id) => isDue(qstats[id], today))
    .sort((a, b) => qstats[a].due - qstats[b].due);
}

/**
 * 今後の復習件数を「今日／明日／あさって以降」で数える。
 * validIds（Map か Set。has(id) を持つもの）を渡すと、そこに無い問題ID（データから外した問題の記録）は数えない。記録は消さない。
 */
export function upcoming(qstats, today, validIds) {
  let now = 0, tomorrow = 0, later = 0;
  for (const id of Object.keys(qstats || {})) {
    if (validIds && !validIds.has(id)) continue;
    const r = qstats[id];
    if (!isWaiting(r)) continue;
    if (r.due <= today) now++;
    else if (r.due === today + 1) tomorrow++;
    else later++;
  }
  return { now, tomorrow, later };
}
