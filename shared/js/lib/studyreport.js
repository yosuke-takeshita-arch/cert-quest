// 学習時間の振り返りの集計（要件定義書 §6-2）。DOM・localStorage・時計には触らない。今日の日付は呼び出し側が渡す。
//
// 日付は 'YYYY-MM-DD'（端末の日付。srs.js の dateKey と同じ区切り）。区切りの計算は「1970-01-01 からの日数」（UTC の暦）でやり、夏時間・時刻に左右されない。
// 週の始まりは月曜。日ごとの秒数は state.studyDays、答えた数・正解数は state.daily。
import { normalizeStudyDays, isDateKey } from './studytime.js';

export const UNITS = ['day', 'week', 'month', 'year'];
export const UNIT_LABEL = { day: '日ごと', week: '週ごと', month: '月ごと', year: '年ごと' };
/** 期間の長さの上限（日）。10年。 */
export const MAX_RANGE_DAYS = 3660;
/** 棒1本の最小の幅（px）。画面が狭い・棒が多いときは、これより細くせず横にスクロールさせる。 */
export const MIN_SLOT_PX = { day: 14, week: 28, month: 40, year: 56 };
/** 日ごとでこれより多い日数を見るときは、週ごとへの切り替えを勧める。 */
export const DAY_UNIT_HINT_OVER = 90;

const DAY_MS = 86400000;
const WEEKDAY = ['月', '火', '水', '木', '金', '土', '日'];

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** 'YYYY-MM-DD' → 1970-01-01 からの日数。実在しない日付は null。 */
export function keyToNum(k) {
  if (!isDateKey(k)) return null;
  return Math.round(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) / DAY_MS);
}

/** 日数 → 'YYYY-MM-DD'。 */
export function numToKey(n) {
  const d = new Date(n * DAY_MS);
  return pad(d.getUTCFullYear(), 4) + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

/** 曜日の番号（月=0 … 日=6）。1970-01-01 は木曜。 */
function weekdayIndex(num) {
  return (((num + 3) % 7) + 7) % 7;
}

/** その日を含む区切り（日・週・月・年）の最初の日（日数）。 */
export function bucketStart(unit, num) {
  if (unit === 'week') return num - weekdayIndex(num);
  if (unit === 'month' || unit === 'year') {
    const d = new Date(num * DAY_MS);
    return Math.round(Date.UTC(d.getUTCFullYear(), unit === 'year' ? 0 : d.getUTCMonth(), 1) / DAY_MS);
  }
  return num;
}

/** 次の区切りの最初の日（日数）。 */
export function nextBucketStart(unit, start) {
  if (unit === 'week') return start + 7;
  if (unit === 'month' || unit === 'year') {
    const d = new Date(start * DAY_MS);
    return Math.round(Date.UTC(d.getUTCFullYear() + (unit === 'year' ? 1 : 0), unit === 'year' ? 0 : d.getUTCMonth() + 1, 1) / DAY_MS);
  }
  return start + 1;
}

/** 単位を切り替えたときの、初めの期間。日＝ここ30日、週＝ここ12週、月＝ここ12か月、年＝ここ5年（週・月・年は、区切りの頭から今日まで）。 */
export function defaultRange(unit, today) {
  const t = keyToNum(today);
  if (t === null) return null;
  const u = UNITS.includes(unit) ? unit : 'day';
  let from;
  if (u === 'day') from = t - 29;
  else if (u === 'week') from = bucketStart('week', t) - 7 * 11;
  else if (u === 'month') {
    const d = new Date(t * DAY_MS);
    from = Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11, 1) / DAY_MS);
  } else {
    const d = new Date(t * DAY_MS);
    from = Math.round(Date.UTC(d.getUTCFullYear() - 4, 0, 1) / DAY_MS);
  }
  return { from: numToKey(from), to: today };
}

/**
 * 期間を整える。壊れた日付は初めの期間にする。終了日が今日より先なら今日にそろえ、開始日が終了日より後なら入れ替え、長さは最長 MAX_RANGE_DAYS（新しい側を残す）。
 * 戻り値: { from, to, swapped, clippedToToday, clippedLength }
 */
export function normalizeRange(unit, from, to, today) {
  const t = keyToNum(today);
  const def = defaultRange(unit, today);
  const out = { from: def ? def.from : today, to: today, swapped: false, clippedToToday: false, clippedLength: false };
  if (t === null) return out;
  let a = keyToNum(from);
  let b = keyToNum(to);
  if (a === null || b === null) return out;
  if (a > b) {
    [a, b] = [b, a];
    out.swapped = true;
  }
  if (b > t) {
    b = t;
    out.clippedToToday = true;
    if (a > b) a = b;
  }
  if (b - a + 1 > MAX_RANGE_DAYS) {
    a = b - MAX_RANGE_DAYS + 1;
    out.clippedLength = true;
  }
  out.from = numToKey(a);
  out.to = numToKey(b);
  return out;
}

function md(num) {
  const d = new Date(num * DAY_MS);
  return d.getUTCMonth() + 1 + '/' + d.getUTCDate();
}
function mdJa(num) {
  const d = new Date(num * DAY_MS);
  return d.getUTCMonth() + 1 + '月' + d.getUTCDate() + '日';
}

/** 秒数を言葉に。1分に満たないときは秒、それ以外は '1時間5分'・'25分'。0は '0分'。 */
export function formatDuration(seconds) {
  const s = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  if (s > 0 && s < 60) return s + '秒';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? h + '時間' + m + '分' : m + '分';
}

/** グラフの縦軸の目盛りの言い方。1時間に満たなければ分、それ以上は時間（小数第1位まで）。 */
export function formatAxis(seconds) {
  if (seconds < 3600) return Math.round(seconds / 60) + '分';
  return Math.round(seconds / 360) / 10 + '時間';
}

const AXIS_STEPS = [600, 1200, 1800, 3600, 7200, 10800, 14400, 21600, 28800, 43200, 86400, 129600, 172800, 259200, 360000, 540000, 720000, 1080000, 1800000, 3600000, 7200000, 18000000, 36000000, 72000000];

/** 縦軸の上端（秒）。棒の最大値以上で、いちばん小さいきりのよい値。 */
export function axisMax(maxSeconds) {
  for (const s of AXIS_STEPS) if (maxSeconds <= s) return s;
  return Math.ceil(maxSeconds / 3600000) * 3600000;
}

/** 棒の下に出す短い名前と、読み上げ用の全部の名前。 */
function labels(unit, start, rangeStart, rangeEnd, partial, isFirst) {
  const d = new Date(start * DAY_MS);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  let short;
  let sub = '';
  let speak;
  if (unit === 'day') {
    short = md(start);
    speak = mdJa(start) + '(' + WEEKDAY[weekdayIndex(start)] + ')';
  } else if (unit === 'week') {
    short = md(start);
    speak = mdJa(rangeStart) + '〜' + mdJa(rangeEnd) + '（月曜はじまりの週）';
  } else if (unit === 'month') {
    short = m + '月';
    if (m === 1 || isFirst) sub = String(y);
    speak = y + '年' + m + '月';
  } else {
    short = String(y);
    speak = y + '年';
  }
  if (partial) speak += '（指定した期間の分だけ）';
  return { label: short, labelSub: sub, speak };
}

/**
 * 期間 [from, to]（両端の日を含む）を単位ごとの棒に分けて数える。
 * state は { studyDays, daily } を持つ記録（壊れた値は読み飛ばす）。today（'YYYY-MM-DD'。省略可）を渡すと、終わりが今日の棒は、先の日がまだ来ていないだけなので partial にしない。
 * 棒（bucket）: { key（区切りの最初の日）, start, end（区切り全体の日数）, from, to（期間に入る日の範囲）, days（期間に入る日数）, partial, seconds, answered, correct, studiedDays, label, labelSub, speak }
 * 戻り値: { unit, from, to, buckets, total: { seconds, answered, correct, studiedDays, rangeDays, averageDays, averageSeconds }, maxSeconds, axisMax, firstRecord }
 *   averageSeconds … 『記録のはじまりの日』と開始日の遅いほうから終了日までの日数で割った1日あたり（記録がまだ無い・期間より後に始まったときは null）
 *   firstRecord    … 学習時間の記録がある最初の日（無ければ null）
 */
export function studyReport(state, unit, from, to, today = null) {
  const u = UNITS.includes(unit) ? unit : 'day';
  const a = keyToNum(from);
  const b = keyToNum(to);
  const t = today === null ? null : keyToNum(today);
  const days = normalizeStudyDays(state && state.studyDays);
  const daily = state && state.daily && typeof state.daily === 'object' && !Array.isArray(state.daily) ? state.daily : {};
  const firstKey = Object.keys(days)[0] || null; // normalizeStudyDays は日付の古い順
  const empty = { unit: u, from, to, buckets: [], total: { seconds: 0, answered: 0, correct: 0, studiedDays: 0, rangeDays: 0, averageDays: 0, averageSeconds: null }, maxSeconds: 0, axisMax: axisMax(0), firstRecord: firstKey };
  if (a === null || b === null || a > b) return empty;

  const buckets = [];
  const byStart = new Map();
  for (let s = bucketStart(u, a); s <= b; s = nextBucketStart(u, s)) {
    const e = nextBucketStart(u, s) - 1;
    const rf = Math.max(s, a);
    const rt = Math.min(e, b);
    // 期間の端で切れた棒。ただし、終わりが『今日』で、その先がまだ来ていない日だけなら、切れたとは言わない（今週・今月・今年）
    const partial = rf > s || (rt < e && !(t !== null && rt >= t));
    const bk = { key: numToKey(s), start: s, end: e, from: numToKey(rf), to: numToKey(rt), days: rt - rf + 1, partial, seconds: 0, answered: 0, correct: 0, studiedDays: 0, ...labels(u, s, rf, rt, partial, buckets.length === 0) };
    buckets.push(bk);
    byStart.set(s, bk);
  }
  const put = (key, fn) => {
    const n = keyToNum(key);
    if (n === null || n < a || n > b) return;
    const bk = byStart.get(bucketStart(u, n));
    if (bk) fn(bk);
  };
  for (const [k, sec] of Object.entries(days)) put(k, (bk) => { bk.seconds += sec; bk.studiedDays += 1; });
  for (const [k, rec] of Object.entries(daily)) {
    if (!rec || typeof rec !== 'object') continue;
    const ans = Number.isFinite(rec.answered) && rec.answered > 0 ? Math.floor(rec.answered) : 0;
    const ok = Number.isFinite(rec.correct) && rec.correct > 0 ? Math.min(Math.floor(rec.correct), ans) : 0;
    put(k, (bk) => { bk.answered += ans; bk.correct += ok; });
  }

  const total = { seconds: 0, answered: 0, correct: 0, studiedDays: 0, rangeDays: b - a + 1, averageDays: 0, averageSeconds: null };
  let maxSeconds = 0;
  for (const bk of buckets) {
    total.seconds += bk.seconds;
    total.answered += bk.answered;
    total.correct += bk.correct;
    total.studiedDays += bk.studiedDays;
    if (bk.seconds > maxSeconds) maxSeconds = bk.seconds;
  }
  const firstNum = firstKey ? keyToNum(firstKey) : null;
  if (firstNum !== null && firstNum <= b) {
    total.averageDays = b - Math.max(a, firstNum) + 1;
    total.averageSeconds = Math.floor(total.seconds / total.averageDays);
  }
  return { unit: u, from, to, buckets, total, maxSeconds, axisMax: axisMax(maxSeconds), firstRecord: firstKey };
}

/** 棒1本を読み上げ・詳細に出す文。例: '10月3日(金)：1時間5分、答えた問題 12問'。 */
export function bucketText(bk) {
  return bk.speak + '：' + formatDuration(bk.seconds) + (bk.answered > 0 ? '、答えた問題 ' + bk.answered + '問' : '');
}
