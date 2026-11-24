// 1日の目標（1日に答える問題数）。純粋な関数だけ。日付の区切りは srs.js の dateKey（端末の日付）に合わせる。

export const DEFAULT_DAILY_GOAL = 10;
export const MAX_DAILY_GOAL = 500;
export const DAILY_GOAL_CHOICES = [5, 10, 15, 20, 30, 50, 100];

/** 保存された値を目標の問題数（1〜500の整数）に直す。不正なら10。 */
export function normalizeDailyGoal(v) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1) return DEFAULT_DAILY_GOAL;
  return Math.min(MAX_DAILY_GOAL, n);
}

/** 今日答えた問題数。 */
export function answeredOn(state, todayKey) {
  const d = state && state.daily && state.daily[todayKey];
  const n = d && Number.isFinite(d.answered) ? d.answered : 0;
  return Math.max(0, n);
}

/** 今日の進み具合。ratio は 0〜1（超えても1）。remaining は 0 未満にならない。 */
export function dailyProgress(state, todayKey) {
  const goal = normalizeDailyGoal(state && state.settings && state.settings.dailyGoal);
  const answered = answeredOn(state, todayKey);
  return { goal, answered, remaining: Math.max(0, goal - answered), ratio: Math.min(1, answered / goal), done: answered >= goal };
}

/**
 * 今日の目標を達成していて、まだ今日のお祝いを出していなければ true を返し、出したことを state に記録する。
 * 1日1回。目標を後から下げても、その日にもう出していれば出さない。
 */
export function awardDailyGoal(state, todayKey) {
  if (state.goalAwarded === todayKey) return false;
  if (!dailyProgress(state, todayKey).done) return false;
  state.goalAwarded = todayKey;
  return true;
}
