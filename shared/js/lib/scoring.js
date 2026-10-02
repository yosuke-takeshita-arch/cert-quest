// XP・レベル・連続日数・星・習熟度。純粋な関数だけ。

export const XP = { base: 10, firstTry: 5, streakStep: 2, streakMax: 5, time: 3, examBase: 5 };

/**
 * 1問ぶんのXP。
 *  base      正解で10
 *  firstTry  その問題を初めて解いて正解なら +5
 *  streak    連続正解（今回を含めて2問目から）で (連続数-1)×2、最大 +10
 *  time      制限時間（既定40秒）以内の正解で +3
 * 誤答は0。試験モード(exam)は本番を再現するため、基本点のみ。
 */
export function answerXp({ correct, firstTry = false, streak = 0, seconds = null, limit = 40, exam = false }) {
  const parts = { base: 0, first: 0, streak: 0, time: 0 };
  if (!correct) return { total: 0, parts };
  if (exam) {
    parts.base = XP.examBase;
    return { total: parts.base, parts };
  }
  parts.base = XP.base;
  if (firstTry) parts.first = XP.firstTry;
  if (streak >= 2) parts.streak = Math.min(streak - 1, XP.streakMax) * XP.streakStep;
  if (seconds !== null && seconds <= limit) parts.time = XP.time;
  return { total: parts.base + parts.first + parts.streak + parts.time, parts };
}

/** レベルLに到達するのに必要な累計XP。Lv1=0, Lv2=50, Lv3=150, Lv4=300 ... */
export function totalXpForLevel(level) {
  return 25 * (level - 1) * level;
}

export function levelFromXp(xp) {
  const x = Math.max(0, Math.floor(xp || 0));
  let level = 1;
  while (totalXpForLevel(level + 1) <= x) level++;
  const floor = totalXpForLevel(level);
  const need = totalXpForLevel(level + 1) - floor;
  const into = x - floor;
  return { level, into, need, progress: need ? into / need : 0 };
}

/** 連続日数の更新。todayKey/lastは 'YYYY-MM-DD'。新しい streak を返す。 */
export function updateStreak(streak, todayKey) {
  const s = { last: null, count: 0, best: 0, ...(streak || {}) };
  if (s.last === todayKey) return s;
  if (s.last && keyDiff(s.last, todayKey) === 1) s.count += 1;
  else s.count = 1;
  s.last = todayKey;
  if (s.count > s.best) s.best = s.count;
  return s;
}

/** 表示用の連続日数。昨日までに途切れていたら0。 */
export function currentStreak(streak, todayKey) {
  if (!streak || !streak.last) return 0;
  const d = keyDiff(streak.last, todayKey);
  return d === 0 || d === 1 ? streak.count : 0;
}

export function keyDiff(a, b) {
  const t = (k) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
  };
  return Math.round(t(b) - t(a));
}

/** 受験日までの日数。今日なら0、過ぎていれば負。 */
export function daysUntil(examDate, now = new Date()) {
  if (!examDate) return null;
  const [y, m, d] = String(examDate).split('-').map(Number);
  if (!y || !m || !d) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86400000);
}

export const STAR_THRESHOLDS = [0.6, 0.8, 0.9];

/** 正答率→星(0〜3)。 */
export function starsFor(rate, th = STAR_THRESHOLDS) {
  if (rate >= th[2]) return 3;
  if (rate >= th[1]) return 2;
  if (rate >= th[0]) return 1;
  return 0;
}

/**
 * 習熟度。none=未着手 / weak=要復習 / mid=あと少し / strong=定着 / empty=問題なし
 * 「最後に解いた結果が正解だった問題」の割合で決める。
 */
export function masteryLevel({ total, answered, lastOk }) {
  if (!total) return 'empty';
  if (!answered) return 'none';
  const frac = lastOk / total;
  if (frac >= 0.8) return 'strong';
  if (frac >= 0.4) return 'mid';
  return 'weak';
}

export const MASTERY_LABEL = { empty: '準備中', none: '未着手', weak: '要復習', mid: 'あと少し', strong: '定着' };
