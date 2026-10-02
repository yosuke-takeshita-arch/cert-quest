// 復習の間隔（間隔反復）。ブラウザにも node にも依存しない純粋な関数だけ。
// 間隔は「直前に解いた日からの日数」: 誤答→1日後→3日後→7日後→14日後→卒業。

export const INTERVALS = [1, 3, 7, 14];

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
 */
export function applyAnswer(rec, correct, today, intervals = INTERVALS) {
  const r = { ...newRecord(), ...(rec || {}) };
  r.seen += 1;
  if (correct) r.correct += 1;
  r.lastOk = !!correct;
  if (!correct) {
    r.step = 0;
    r.due = today + intervals[0];
  } else if (r.step >= 0 && r.due !== null && r.due <= today) {
    const next = r.step + 1;
    if (next >= intervals.length) {
      r.step = -1;
      r.due = null;
    } else {
      r.step = next;
      r.due = today + intervals[next];
    }
  }
  return r;
}

export function isDue(rec, today) {
  return !!rec && rec.step >= 0 && rec.due !== null && rec.due <= today;
}

/** 期日が来ている問題IDを、古い期日順で返す。 */
export function dueIds(qstats, today) {
  return Object.keys(qstats || {})
    .filter((id) => isDue(qstats[id], today))
    .sort((a, b) => qstats[a].due - qstats[b].due);
}

/** 今後の復習件数を「今日／明日／あさって以降」で数える。 */
export function upcoming(qstats, today) {
  let now = 0, tomorrow = 0, later = 0;
  for (const id of Object.keys(qstats || {})) {
    const r = qstats[id];
    if (!r || r.step < 0 || r.due === null) continue;
    if (r.due <= today) now++;
    else if (r.due === today + 1) tomorrow++;
    else later++;
  }
  return { now, tomorrow, later };
}
