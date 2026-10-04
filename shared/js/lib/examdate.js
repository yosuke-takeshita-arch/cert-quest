// 受験日（利用者が決める）の扱い。純粋な処理だけ（画面・localStorage には触らない）。
// 保存するのは settings.examDate（'YYYY-MM-DD' または null＝まだ決めていない）と settings.examAsked（聞いたか）。
import { daysUntil } from './scoring.js';

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
/** 受験日として受け付ける年の範囲（これを外れたら、ありえない値として捨てる）。 */
export const EXAM_YEAR_MIN = 2020;
export const EXAM_YEAR_MAX = 2100;

/** 'YYYY-MM-DD' として読める実在の日付ならその文字列、そうでなければ null。 */
export function normalizeExamDate(v) {
  if (typeof v !== 'string') return null;
  const m = YMD.exec(v);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < EXAM_YEAR_MIN || y > EXAM_YEAR_MAX) return null;
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null; // 2/30 など
  return v;
}

/**
 * 保存データの設定（settings）を正す。
 *  - examAsked が true でない → 聞いていない（examDate も捨てる）
 *  - examDate が null → 「まだ決めていない」と答えた
 *  - examDate が日付として読めない → 「まだ聞いていない」に戻す
 * settings を直接書き換える。
 */
export function normalizeExamSettings(settings) {
  const s = settings;
  if (s.examAsked !== true) {
    // 日付だけ入っている（古い形・手で書いた）ときは、読める日付なら答えたものとして扱う
    const only = normalizeExamDate(s.examDate);
    s.examAsked = !!only;
    s.examDate = only;
    return;
  }
  if (s.examDate == null) {
    s.examDate = null;
    return;
  }
  const d = normalizeExamDate(s.examDate);
  if (d) s.examDate = d;
  else { s.examAsked = false; s.examDate = null; }
}

/** 聞く必要があるか（まだ聞いていない）。 */
export function needsExamDateAsk(settings) {
  return !(settings && settings.examAsked === true);
}

/**
 * 受験日の状態。
 *  kind: 'unset'（まだ決めていない／聞いていない）／'upcoming'（あと days 日）／'today'／'past'（過ぎた。days は負）
 */
export function examStatus(settings, now = new Date()) {
  const d = settings ? normalizeExamDate(settings.examDate) : null;
  if (!d || settings.examAsked !== true) return { kind: 'unset', date: null, days: null };
  const days = daysUntil(d, now);
  if (days == null) return { kind: 'unset', date: null, days: null };
  if (days > 0) return { kind: 'upcoming', date: d, days };
  if (days === 0) return { kind: 'today', date: d, days };
  return { kind: 'past', date: d, days };
}

/** 聞くときの日付の初期値。config.examDate が読めて、まだ過ぎていなければそれ。そうでなければ空。 */
export function examDateDefault(configExamDate, now = new Date()) {
  const d = normalizeExamDate(configExamDate);
  if (!d) return '';
  const days = daysUntil(d, now);
  return days != null && days >= 0 ? d : '';
}

/** 画面に出す日付（2026年11月6日）。 */
export function formatExamDate(ymd) {
  const d = normalizeExamDate(ymd);
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return y + '年' + m + '月' + day + '日';
}
