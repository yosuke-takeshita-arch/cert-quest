// 学習記録の状態と更新。localStorage には触らない（storage.js が担当）。純粋に state を更新する。
import { applyAnswer, dayNumber, dateKey, dueIds } from './srs.js';
import { DEFAULT_DAILY_GOAL, normalizeDailyGoal } from './daily.js';
import { DEFAULT_SFX_VOLUME, DEFAULT_BGM_VOLUME, normalizeSoundSettings } from './sound.js';
import { normalizeExamSettings } from './examdate.js';
import { DEFAULT_TEXT_SIZE, normalizeTextSize } from './textsize.js';
import { DEFAULT_MAP_VIEW, normalizeMapView } from './maplayout.js';
import { normalizeLater } from './later.js';
import { normalizeDochi } from './dochi.js';
import { normalizeForecast } from './forecast.js';
import { normalizeBoss } from './boss.js';
import { answerXp, levelFromXp, updateStreak, starsFor, masteryLevel, STAR_THRESHOLDS } from './scoring.js';

export function defaultState() {
  return {
    v: 1,
    xp: 0,
    totals: { answered: 0, correct: 0 },
    qstats: {},
    daily: {},
    streak: { last: null, count: 0, best: 0 },
    stages: {},
    badges: {},
    exams: [],
    examSeen: {}, // 模試で最後に出た時刻（問題ID → ミリ秒）。次の模試で、まだ出ていない問題・古く出た問題を優先するのに使う
    later: {}, // 「あとで見る」の印（問題ID → 印を付けた時刻のミリ秒）
    challenge: { runs: 0, best: 0 },
    dochi: { runs: 0, best: 0, bestCombo: 0 }, // 「どっち？」早押しの記録（回数・最高の正解数・最高コンボ）
    settings: { sound: false, sfxVolume: DEFAULT_SFX_VOLUME, bgm: false, bgmVolume: DEFAULT_BGM_VOLUME, bgmTrack: 'auto', bgmHome: false, bgmHomeTrack: 'title', vibrate: true, dailyGoal: DEFAULT_DAILY_GOAL, theme: 'light', textSize: DEFAULT_TEXT_SIZE, mapView: DEFAULT_MAP_VIEW, examDate: null, examAsked: false, introSeen: false },
    forecast: {}, // 合格予想の日ごとの記録（'YYYY-MM-DD' → 点。最大60日）
    boss: {}, // 章のボスの撃破回数（章のキー → 回数）
    goalAwarded: null,
  };
}

/** 画面の配色の設定値。light＝明るい／dark＝暗い／auto＝スマホに合わせる。初期は light。 */
export const THEMES = ['light', 'dark', 'auto'];

/** 読んだ保存データを defaultState の形に合わせる（欠けた項目を補う）。 */
export function mergeState(saved) {
  const d = defaultState();
  if (!saved || typeof saved !== 'object') return d;
  const o = { ...d, ...saved };
  for (const k of ['totals', 'streak', 'settings', 'challenge']) o[k] = { ...d[k], ...(saved[k] && typeof saved[k] === 'object' ? saved[k] : {}) };
  for (const k of ['qstats', 'daily', 'stages', 'badges']) if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = {};
  if (!Array.isArray(o.exams)) o.exams = [];
  // 模試で出た時刻。壊れた値（数でないもの）は捨てて「まだ出ていない」扱いにする
  const seen = {};
  if (saved.examSeen && typeof saved.examSeen === 'object' && !Array.isArray(saved.examSeen)) {
    for (const [id, t] of Object.entries(saved.examSeen)) if (typeof t === 'number' && Number.isFinite(t)) seen[id] = t;
  }
  o.examSeen = seen;
  o.later = normalizeLater(saved.later); // 「あとで見る」。古い記録（項目なし）は空、数でない値は捨てる
  o.dochi = normalizeDochi(saved.dochi); // 「どっち？」早押し。古い記録（項目なし）は0、数でない値は0
  o.forecast = normalizeForecast(saved.forecast); // 合格予想の推移。古い記録（項目なし）は空、日付でないキー・範囲外の値は捨てる
  o.boss = normalizeBoss(saved.boss); // 章のボスの撃破回数。古い記録（項目なし）は空
  if (!Number.isFinite(o.xp)) o.xp = 0;
  o.settings.dailyGoal = normalizeDailyGoal(o.settings.dailyGoal);
  if (!THEMES.includes(o.settings.theme)) o.settings.theme = 'light';
  o.settings.textSize = normalizeTextSize(o.settings.textSize); // 文字の大きさ。ありえない値は「ふつう」
  o.settings.mapView = normalizeMapView(o.settings.mapView); // 地図の表示（地図／一覧）。ありえない値は地図
  // BGM は「問題中（bgm・bgmTrack）」と「それ以外（bgmHome・bgmHomeTrack）」の2つの場面に分けた。
  // それ以外の項目が無い古い記録は、これまでの BGM のオン／オフを引き継ぐ（オンだった人は両方オン。曲は問題中が bgmTrack のまま、それ以外はタイトル曲）
  const savedSet = saved.settings && typeof saved.settings === 'object' ? saved.settings : {};
  if (typeof savedSet.bgmHome !== 'boolean') o.settings.bgmHome = savedSet.bgm === true;
  normalizeSoundSettings(o.settings);
  normalizeExamSettings(o.settings);
  o.settings.introSeen = o.settings.introSeen === true; // 使い方の案内を見たか
  if (typeof o.goalAwarded !== 'string') o.goalAwarded = null;
  delete o.charTaps; // キャラクターのタップ回数は起動ごとに数え直す（保存しない）。古い保存データの値は捨てる
  return o;
}

/**
 * 1問の回答を記録する。state を直接更新し、獲得XPなどを返す。
 * sessionStreak: 今回を含む連続正解数（呼び出し側が数える）
 */
export function recordAnswer(state, q, { correct, seconds = null, sessionStreak = 0, now = new Date(), limit = 40, exam = false }) {
  const prev = state.qstats[q.id];
  const firstTry = !prev || !prev.seen;
  const levelBefore = levelFromXp(state.xp).level;
  const xp = answerXp({ correct, firstTry, streak: sessionStreak, seconds, limit, exam });
  state.qstats[q.id] = applyAnswer(prev, correct, dayNumber(now));
  state.xp += xp.total;
  state.totals.answered += 1;
  if (correct) state.totals.correct += 1;
  const key = dateKey(now);
  const day = state.daily[key] || { answered: 0, correct: 0 };
  day.answered += 1;
  if (correct) day.correct += 1;
  state.daily[key] = day;
  state.streak = updateStreak(state.streak, key);
  const levelAfter = levelFromXp(state.xp).level;
  return { xp: xp.total, parts: xp.parts, firstTry, levelBefore, levelAfter, leveledUp: levelAfter > levelBefore };
}

/** ステージ1回分の結果。ベスト星だけ更新。 */
export function recordStageResult(state, stageKey, correct, total, th = STAR_THRESHOLDS) {
  const rate = total ? correct / total : 0;
  const stars = starsFor(rate, th);
  const cur = state.stages[stageKey] || { stars: 0, best: 0, runs: 0 };
  const improved = stars > cur.stars;
  state.stages[stageKey] = { stars: Math.max(cur.stars, stars), best: Math.max(cur.best, rate), runs: cur.runs + 1 };
  return { stars, rate, improved };
}

export function recordExam(state, entry, now = new Date()) {
  state.exams.push({ ...entry, date: dateKey(now), ts: now.getTime() });
  if (state.exams.length > 50) state.exams.shift();
}

/** 模試に出した問題の「最後に出た時刻」を記録する（次の模試の優先づけに使う）。 */
export function recordExamSeen(state, ids, now = new Date()) {
  if (!state.examSeen || typeof state.examSeen !== 'object') state.examSeen = {};
  const t = now.getTime();
  for (const id of ids) state.examSeen[id] = t;
}

export function recordChallenge(state, correct) {
  state.challenge.runs += 1;
  if (correct > state.challenge.best) state.challenge.best = correct;
}

/** ノード（大/中/小項目）の習熟度集計。 */
export function nodeProgress(node, qstats) {
  let answered = 0, lastOk = 0;
  for (const q of node.questions) {
    const r = qstats[q.id];
    if (r && r.seen) {
      answered++;
      if (r.lastOk) lastOk++;
    }
  }
  const total = node.questions.length;
  return { total, answered, lastOk, level: masteryLevel({ total, answered, lastOk }) };
}

export function dueQuestions(state, questionById, now = new Date()) {
  return dueIds(state.qstats, dayNumber(now)).map((id) => questionById.get(id)).filter(Boolean);
}

/** 次に学ぶステージの提案: 未着手のうち先頭 → 要復習 → あと少し。 */
export function suggestStage(stages, qstats) {
  const withQ = stages.filter((s) => s.questions.length);
  const prog = withQ.map((s) => ({ s, p: nodeProgress(s, qstats) }));
  return (
    (prog.find((x) => x.p.level === 'none') ||
      prog.find((x) => x.p.level === 'weak') ||
      prog.find((x) => x.p.level === 'mid') ||
      prog[0] ||
      {}).s || null
  );
}
