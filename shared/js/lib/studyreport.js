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
export const MIN_SLOT_PX = { day: 14, week: 40, month: 48, year: 56 };
/** 棒の上の数値の文字の大きさ（px。CSS の .sr-val の 0.6875rem と合わせる）と、隣の数値との最小のすき間（px）。 */
export const BAR_VALUE_FONT_PX = 11;
export const BAR_VALUE_GAP_PX = 4;
/** 棒の上端と数値のすき間（px。CSS の .sr-val の margin-bottom 6px と合わせる）。 */
export const BAR_VALUE_MARGIN_PX = 6;
/** 数値が棒の並びの左右へはみ出してよい幅（px。画面側の左右の余白 16px より少し内側）。 */
export const BAR_VALUE_EDGE_PX = 14;
/** 棒の高さの最大（px）。縦軸の上端（axisMax）がこの高さ。 */
export const PLOT_PX = 160;
/** 棒の上の数値を置ける高さ（グラフの下端から、上の余白の上端の 2px 下まで。CSS の .sr-cols の padding-top 44px と合わせる）と、上げてよい段の数。 */
export const BAR_VALUE_ROOM_PX = PLOT_PX + 44 - 2;
export const BAR_VALUE_MAX_LEVEL = 1;
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

/**
 * 棒の上に出す短い数値。1分に満たなければ '<1分'、1時間に満たなければ '45分'、100時間までは '1:05'（時間:分）、それ以上は '120時間'。0は空（出さない）。
 * 正確な数字は棒の読み上げ・詳細の文（formatDuration）にもある。ここは狭い幅で読める短さを優先。
 */
export function formatBarValue(seconds) {
  const s = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  if (s <= 0) return '';
  if (s < 60) return '<1分';
  const m = Math.floor(s / 60);
  if (m < 60) return m + '分';
  const h = Math.floor(m / 60);
  return h >= 100 ? h + '時間' : h + ':' + pad(m % 60);
}

/** 棒の上の数値の幅（px）の見積もり。文字の大きさ fontPx の太字で、数字・記号は約0.62字、漢字・かなは1字。 */
export function barValueWidthPx(text, fontPx = BAR_VALUE_FONT_PX) {
  let em = 0;
  for (const ch of String(text || '')) em += /[0-9<:]/.test(ch) ? 0.62 : 1;
  return Math.ceil(em * fontPx);
}

/**
 * 棒の上の数値（横書き1行）を、どの段・どの横位置に置くか決める。
 * texts は左からの数値（空は出さない）、heights は棒の高さ（px）、slotPx は棒1本の幅。
 * opts.first は必ず先に置く棒（選んでいる棒。無ければ -1）、opts.fontPx は数値の文字の大きさ（文字の大きさの設定で変わる）、
 * opts.roomPx はグラフの下端から上の余白の上端までの高さ。
 * 数値は棒の真上（0段・真ん中）に置き、ほかの数値・ほかの棒と重なるなら、左に寄せる・右に寄せる・1段上げる、を順に試す
 * （2026-10-18 先生「タップしないと表示されない」「前日のが出てこない」。隣どうしの数値を隠さず両方出す。
 * 細い棒では数値が棒より長く、背の高い隣の棒にかかって隠れていたので、空いている側へ寄せる）。
 * どれでも重なる・余白の上端を超えるときだけ出さない。置く順は、選んでいる棒、それから右（新しい日）から。
 * 戻り値は { level, shift }。level は段の番号（0, 1）で出さないものは -1（棒を押すと下の詳細の文で読める）、shift は横にずらす px（左が負）。
 */
export function placeBarValues(texts, heights, slotPx, opts = {}) {
  const first = opts.first ?? -1;
  const fontPx = opts.fontPx || BAR_VALUE_FONT_PX;
  const roomPx = opts.roomPx || BAR_VALUE_ROOM_PX;
  const gap = BAR_VALUE_GAP_PX;
  const step = fontPx + 2;
  const n = texts.length;
  const level = new Array(n).fill(-1);
  const shift = new Array(n).fill(0);
  const placed = []; // [左, 右, 下, 上]（下端から上向きの px）
  const order = [];
  if (first >= 0 && first < n) order.push(first);
  for (let i = n - 1; i >= 0; i--) if (i !== first) order.push(i);
  for (const i of order) {
    if (!texts[i]) continue;
    const c = (i + 0.5) * slotPx;
    const w = barValueWidthPx(texts[i], fontPx);
    const lo0 = c - w / 2;
    // 横位置の候補: 真ん中、自分の棒の右端にそろえる（左に寄せる）、自分の棒の左端にそろえる（右に寄せる）
    const shifts = [0];
    if (w > slotPx) shifts.push(Math.round((i + 1) * slotPx - 1 - w - lo0), Math.round(i * slotPx + 1 - lo0));
    let done = false;
    // 上げるのは1段まで（2段上げると、どの棒の数値か分かりにくかった）
    for (let lv = 0; lv <= BAR_VALUE_MAX_LEVEL && !done; lv++) {
      const bottom = (heights[i] || 0) + BAR_VALUE_MARGIN_PX + lv * step;
      const top = bottom + fontPx;
      if (top > roomPx) break;
      for (const dx of shifts) {
        const lo = lo0 + dx;
        const hi = lo + w;
        if (lo < -BAR_VALUE_EDGE_PX || hi > n * slotPx + BAR_VALUE_EDGE_PX) continue; // グラフの左右の余白からはみ出す
        // 横に重なる、ほかの棒のうち、いちばん高いもの（数値はその上に出す）
        let under = heights[i] || 0;
        for (let j = 0; j < n; j++) {
          if (j !== i && lo < (j + 1) * slotPx - 1 && hi > j * slotPx + 1) under = Math.max(under, heights[j] || 0);
        }
        if (bottom < under + 1) continue; // ほかの棒に重なる
        if (placed.some(([pa, pb, pd, pu]) => lo < pb + gap && hi > pa - gap && bottom < pu + 1 && top > pd - 1)) continue;
        placed.push([lo, hi, bottom, top]);
        level[i] = lv;
        shift[i] = dx;
        done = true;
        break;
      }
    }
  }
  return { level, shift };
}

/** 棒の高さ（px）。0 は 2px の細い線、記録がある日は最低 3px（見えなくならないように）。 */
export function barPx(seconds, axisMaxSeconds, plotPx = PLOT_PX) {
  if (!(seconds > 0) || !(axisMaxSeconds > 0)) return 2;
  return Math.max(3, Math.round((Math.min(seconds, axisMaxSeconds) / axisMaxSeconds) * plotPx));
}

/** 下の日付などの名前を、何本おきに出すか（約46pxあけて、重ならないように）。 */
export function labelEvery(slotPx) {
  return Math.max(1, Math.ceil(46 / slotPx));
}

/**
 * 単位や期間を切り替えたとき、古い棒の並びと新しい棒の並びを、新しい側（右端＝今）をそろえて結ぶ。
 * 戻り値: { leave: 消える古い棒の数（左側）, enter: 新しく出る棒の数（左側）, keep: 引き継ぐ棒の数 }
 */
export function matchColumns(oldCount, newCount) {
  const o = Math.max(0, Math.floor(oldCount) || 0);
  const n = Math.max(0, Math.floor(newCount) || 0);
  const keep = Math.min(o, n);
  return { leave: o - keep, enter: n - keep, keep };
}
