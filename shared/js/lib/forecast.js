// 合格予想メーターの計算。純粋な関数だけ（DOM も localStorage も触らない）。画面はあとで別に作る。
// 仕様: 要件定義書 3-6。state.forecast = { 'YYYY-MM-DD': 点 }（最大60日）。日付の区切りは srs.js の dateKey と同じ。
import { chapterKey } from './boss.js';

export const UNANSWERED_VALUE = 0.25; // 間違えた・まだ答えていない問題の見込み（4択の当てずっぽう）
export const FORECAST_MAX_DAYS = 60;
export const TOP_GAINS = 3;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function validDateKey(k) {
  const m = typeof k === 'string' ? DATE_RE.exec(k) : null;
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** 1問の見込み。最後に正解なら1、それ以外（間違い・未回答）は 0.25。 */
export function questionValue(rec) {
  return rec && rec.seen > 0 && rec.lastOk === true ? 1 : UNANSWERED_VALUE;
}

/**
 * 予想の点と、章ごとの内訳・伸びしろ。
 * questions: データにある問題の全部（記録に残るだけの消えた問題は数えない）。
 * opts.weights: 章のキー → 重み。省略すると問題の数の割合。公式の配点が分かったらここに渡す（合計は1でなくてよい。無い章は0）。
 * 返り値: { total, answered, score, chapters, top }
 *   score    … 0〜100 の小数（丸めない）。答えた問題が0なら null（予想を出さない）
 *   chapters … [{ key, total, answered, correct, remaining, gain }]（問題データの出てきた順）
 *              remaining＝最後に正解していない数、gain＝この章を全部正解できたときの上がる点
 *   top      … gain の大きい順（同じなら先に出てきた章）に、gain>0 の章を最大3つ
 */
export function forecast(questions, qstats, opts = {}) {
  const st = qstats && typeof qstats === 'object' ? qstats : {};
  const byKey = new Map();
  let total = 0;
  let answered = 0;
  for (const q of Array.isArray(questions) ? questions : []) {
    const key = chapterKey(q);
    if (key === null) continue;
    let c = byKey.get(key);
    if (!c) byKey.set(key, (c = { key, total: 0, answered: 0, correct: 0 }));
    const rec = st[q.id];
    c.total++;
    total++;
    if (rec && rec.seen > 0) {
      c.answered++;
      answered++;
    }
    if (rec && rec.seen > 0 && rec.lastOk === true) c.correct++;
  }
  const chapters = [...byKey.values()].map((c) => ({ ...c, remaining: c.total - c.correct, gain: 0 }));

  const w = opts.weights && typeof opts.weights === 'object' ? opts.weights : null;
  const weightOf = (c) => {
    if (!w) return c.total;
    const x = w[c.key];
    return typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0;
  };
  let sumW = chapters.reduce((s, c) => s + weightOf(c), 0);
  const useCount = sumW <= 0; // 重みが使えなければ問題の数の割合に戻す
  if (useCount) sumW = total;

  let score = null;
  if (answered > 0 && sumW > 0) {
    score = 0;
    for (const c of chapters) {
      const share = (useCount ? c.total : weightOf(c)) / sumW;
      score += share * ((c.correct + UNANSWERED_VALUE * c.remaining) / c.total) * 100;
      c.gain = (share * ((1 - UNANSWERED_VALUE) * c.remaining) / c.total) * 100;
    }
  }
  const top = chapters
    .map((c, i) => ({ c, i }))
    .filter((x) => x.c.gain > 0)
    .sort((a, b) => (b.c.gain === a.c.gain ? a.i - b.i : b.c.gain - a.c.gain))
    .slice(0, TOP_GAINS)
    .map((x) => x.c);
  return { total, answered, score, chapters, top };
}

/** 合格の線。公式に公表されている資格だけ 0〜100 の数で渡す。それ以外（未公表・壊れた値）は null＝線を出さない。 */
export function normalizeLine(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 100 ? v : null;
}

// ---- 日ごとの推移 ----

/** 読んだ保存データの forecast を正しい形にする。古い記録（項目なし）は空。日付でないキー・0〜100 の数でない値は捨て、新しい60日だけ残す。 */
export function normalizeForecast(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const keys = Object.keys(raw)
    .filter((k) => validDateKey(k) && typeof raw[k] === 'number' && Number.isFinite(raw[k]) && raw[k] >= 0 && raw[k] <= 100)
    .sort();
  for (const k of keys.slice(-FORECAST_MAX_DAYS)) out[k] = raw[k];
  return out;
}

/**
 * その日の予想を記録する（小数第1位に丸める）。同じ日は上書き。60日を超えたら古い日から捨てる。
 * score が null（答えた問題が0）や範囲外なら何もしない。戻り値は記録したか。
 */
export function recordForecast(state, dateKey, score) {
  if (!validDateKey(dateKey) || typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) return false;
  const f = normalizeForecast(state.forecast);
  f[dateKey] = Math.round(score * 10) / 10;
  state.forecast = normalizeForecast(f);
  return Object.prototype.hasOwnProperty.call(state.forecast, dateKey); // 60日より古い日付だけの場合は残らない
}

/** 折れ線用。日付の古い順の [{ date, score }]。 */
export function forecastSeries(raw) {
  const f = normalizeForecast(raw);
  return Object.keys(f)
    .sort()
    .map((date) => ({ date, score: f[date] }));
}
