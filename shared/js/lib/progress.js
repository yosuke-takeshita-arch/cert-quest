// 学習記録の状態と更新。localStorage には触らない（storage.js が担当）。純粋に state を更新する。
import { applyAnswer, dayNumber, dateKey, dueIds } from './srs.js';
import { DEFAULT_DAILY_GOAL, normalizeDailyGoal } from './daily.js';
import { DEFAULT_SFX_VOLUME, DEFAULT_BGM_VOLUME, normalizeSoundSettings } from './sound.js';
import { normalizeExamSettings, examDayNumber } from './examdate.js';
import { reviewPlan, normalizeReviewToday, reviewDoneToday, bumpReviewToday } from './review.js';
import { DEFAULT_TEXT_SIZE, normalizeTextSize } from './textsize.js';
import { DEFAULT_MAP_VIEW, normalizeMapView } from './maplayout.js';
import { DEFAULT_CARD_VIEW, normalizeCardView } from './cardtree.js';
import { DEFAULT_WEAK_ORDER, normalizeWeakOrder } from './weakness.js';
import { normalizeLater } from './later.js';
import { normalizeDochi } from './dochi.js';
import { normalizeForecast } from './forecast.js';
import { normalizeBoss, normalizeBossFlawless, normalizeBossMet } from './boss.js';
import { normalizeTrueBoss } from './trueboss.js';
import { normalizeStudySeconds, normalizeStudyDays } from './studytime.js';
import { normalizeCharTap100 } from './characters.js';
import { answerXp, scaleXp, levelFromXp, updateStreak, starsFor, masteryLevel, STAR_THRESHOLDS } from './scoring.js';

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
    settings: { sound: false, sfxVolume: DEFAULT_SFX_VOLUME, bgm: false, bgmVolume: DEFAULT_BGM_VOLUME, bgmTrack: 'auto', bgmHome: false, bgmHomeTrack: 'title', vibrate: true, dailyGoal: DEFAULT_DAILY_GOAL, theme: 'light', textSize: DEFAULT_TEXT_SIZE, mapView: DEFAULT_MAP_VIEW, cardView: DEFAULT_CARD_VIEW, weakOrder: DEFAULT_WEAK_ORDER, examDate: null, examAsked: false, introSeen: false },
    forecast: {}, // 合格予想の日ごとの記録（'YYYY-MM-DD' → 点。最大60日）
    boss: {}, // 章のボスの撃破回数（章のキー → 回数）
    bossMet: {}, // 一度でも現れた章のボス（章のキー → true）。会うまでは名前も姿も隠す
    bossFlawless: 0, // ハートを1つも減らさずにボスを倒した回数（バッジ「ノーダメージ」用）
    trueBoss: { wins: 0, seen2: false, lifted: false, awakened: false }, // 真ボスを倒した回数（要件定義書 §3-9。バッジ『真ボス』用）
    charTap100: { shiba: false, sensei: false }, // サニー／あい先生を100回タップした事実（バッジ用）。回数そのものは保存しない
    goalAwarded: null,
    reviewToday: { day: null, n: 0 }, // 「復習」として解いた数（その日の dayNumber と数）。1日60問の枠から引く。日が変われば数え直し。要件定義書 §6-3
    studySeconds: 0, // 総学習時間（秒）。アプリを開いて画面が前に出ている時間（studytime.js）。過去の分は記録が無いので0から
    studyDays: {}, // 学習時間の日ごとの記録（'YYYY-MM-DD' → その日の秒数）。古い日は消さない。daily には混ぜない（daily に記録がある日＝答えた日、の判定に使っているため）。要件定義書 §6-2
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
  o.bossMet = normalizeBossMet(saved.bossMet); // 一度でも現れた章のボス。古い記録（項目なし）は空（倒したことがあれば会ったことにする。hasMetBoss）
  o.bossFlawless = normalizeBossFlawless(saved.bossFlawless); // ノーダメージで倒した回数。古い記録（項目なし）・壊れた値は0
  o.trueBoss = normalizeTrueBoss(saved.trueBoss); // 真ボスを倒した回数。古い記録（項目なし）・壊れた値は0
  o.charTap100 = normalizeCharTap100(saved.charTap100); // タップのバッジ用。古い記録（項目なし）・壊れた値は両方 false
  o.reviewToday = normalizeReviewToday(saved.reviewToday); // 今日の復習として解いた数。古い記録（項目なし）・壊れた値は「記録なし」
  o.studySeconds = normalizeStudySeconds(saved.studySeconds); // 総学習時間。古い記録（項目なし）・壊れた値は0
  o.studyDays = normalizeStudyDays(saved.studyDays); // 学習時間の日ごと。古い記録（項目なし）は空、日付でないキー・壊れた値は捨てる
  if (!Number.isFinite(o.xp)) o.xp = 0;
  o.settings.dailyGoal = normalizeDailyGoal(o.settings.dailyGoal);
  if (!THEMES.includes(o.settings.theme)) o.settings.theme = 'light';
  o.settings.textSize = normalizeTextSize(o.settings.textSize); // 文字の大きさ。ありえない値は「ふつう」
  o.settings.mapView = normalizeMapView(o.settings.mapView); // 地図の表示（地図／一覧）。ありえない値は地図
  o.settings.cardView = normalizeCardView(o.settings.cardView); // カードの表示（分野で見る／一覧・検索）。ありえない値は分野で見る
  o.settings.weakOrder = normalizeWeakOrder(o.settings.weakOrder); // 「すべての分野」の並べ方（章の順／正答率の低い順）。ありえない値は章の順
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
export function recordAnswer(state, q, { correct, seconds = null, sessionStreak = 0, now = new Date(), limit = 40, exam = false, review = false, xpMul = 1 }) {
  const prev = state.qstats[q.id];
  const firstTry = !prev || !prev.seen;
  const levelBefore = levelFromXp(state.xp).level;
  const xp = answerXp({ correct, firstTry, streak: sessionStreak, seconds, limit, exam });
  if (xpMul !== 1) xp.total = scaleXp(xp.total, xpMul); // ボス戦の倍率（切り上げ）。内訳（parts）は倍率の前のまま
  const today = dayNumber(now);
  state.qstats[q.id] = applyAnswer(prev, correct, today, undefined, examDayNumber(state.settings)); // 受験日より後になる復習は卒業
  if (review) state.reviewToday = bumpReviewToday(state.reviewToday, today); // 「復習」として解いた数（1日60問の枠から引く）
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

/** ごほうびの XP（ボス戦の撃破など）を足す。レベルが上がったかも返す。0以下・数でないものは足さない。 */
export function addBonusXp(state, amount) {
  const levelBefore = levelFromXp(state.xp).level;
  const n = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
  state.xp += n;
  const levelAfter = levelFromXp(state.xp).level;
  return { xp: n, levelBefore, levelAfter, leveledUp: levelAfter > levelBefore };
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

/** 今日の復習の計画（上限を当てた数・あふれ・残り）。決まりは lib/review.js の reviewPlan。データにある問題だけ数える。 */
export function todayReviewPlan(state, questionById, now = new Date()) {
  const today = dayNumber(now);
  return reviewPlan(state.qstats, today, reviewDoneToday(state.reviewToday, today), questionById);
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
