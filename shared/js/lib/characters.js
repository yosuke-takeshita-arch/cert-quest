// キャラクター（柴犬と先生）: どの場面でどの絵を出すかの決まり。純粋な関数だけ（画面の部品は ui.js の characterImg / mascotLine）。
// 柴犬＝お祝いと応援。先生＝解説の案内。1画面に1人まで（要件定義書 §6）。
// 名前は 2026-10-05 に先生が決めた（柴犬＝サニー、先生＝あい先生）。名前と一言は、下の CHARACTER_NAMES と CHARACTER_TEXT の1か所にまとめる。
import { keyDiff, currentStreak } from './scoring.js';
import { dateKey } from './srs.js';
import { examStatus } from './examdate.js';
import { dailyProgress } from './daily.js';
import { recordIsEmpty } from './intro.js';

/** 素材（shared/images/characters/ の .webp の名前）。sw-core.js の SHARED にも同じものを入れる。 */
export const CHARACTER_ART = [
  'shiba-hello', 'shiba-banzai', 'shiba-clap', 'shiba-cheer', 'shiba-think', 'shiba-sleepy',
  'sensei-hello', 'sensei-point', 'sensei-ok', 'sensei-comfort', 'sensei-think', 'sensei-clap',
];

/** キャラクターの名前。吹き出しの上に小さく出す。 */
export const CHARACTER_NAMES = { shiba: 'サニー', sensei: 'あい先生' };

/** 絵の名前から、話している人の名前。知らない絵は空。 */
export function characterName(art) {
  if (typeof art !== 'string') return '';
  if (art.startsWith('shiba-')) return CHARACTER_NAMES.shiba;
  if (art.startsWith('sensei-')) return CHARACTER_NAMES.sensei;
  return '';
}

/** キャラクターが言う一言。文言はここ1か所にまとめる。 */
export const CHARACTER_TEXT = {
  homeHello: '今日もいっしょにがんばろう！',
  homeFirst: 'はじめまして！ サニーだよ。まずは1問、解いてみよう！',
  homeExamToday: '今日は本番！ 落ち着いていけば大丈夫。応援してるよ！',
  homeExamTomorrow: 'いよいよ明日が本番！ 今日は軽く見直して、早めに休もう',
  homeGoalDone: '今日の目標、達成！ えらい！',
  homeLate: 'こんな時間まで…！ 寝るのも大事だよ',
  homeExamNear: (n) => '本番まであと' + n + '日！ ラストスパート！',
  homeStreak: (n) => n + '日連続！ その調子！',
  homeMorning: 'おはよう！ 朝の1問からはじめよう',
  homeNoon: 'お昼休みに、ちょっとだけ解いていこう',
  homeEvening: 'おつかれさま！ 今日の分、少しずつ進めよう',
  homeNight: '夜もがんばってるね。キリのいいところで休もう',
  homeWeekend: 'お休みの日も、いっしょにがんばろう！',
  homeBack: 'おかえり！ また会えてうれしいよ',
  cheer: 'ここで覚えれば本番で取れる！',
  examHigh: 'よくできました！ この調子！',
  examLow: 'だいじょうぶ。まちがえたところが伸びしろだよ',
  aboutShiba: 'Aisunia のマスコット、サニーだよ！ 解説では、あい先生が案内してくれるよ',
  weakFound: 'ここから解くと、いちばん伸びるよ',
  weakClear: '苦手と言える所は、いまのところ無いよ。この調子！',
};

/** 何日あいたら「おかえり」にするか。最後に学習した日の差がこの日数以上（＝1日まるごと休んだ）。 */
export const AWAY_DAYS = 2;
/** 受験日まで何日以内なら「ラストスパート」にするか（2日前〜この日数）。 */
export const EXAM_NEAR_DAYS = 7;
/** 連続日数がこの日数以上なら、ほめる。 */
export const STREAK_PRAISE_DAYS = 3;
/** 不正解が何問続いたら応援を出すか。 */
export const CHEER_RUN = 3;
/** 模擬試験の正答率（%）がこれ以上なら、ほめる。 */
export const EXAM_HIGH_RATE = 70;

/** 素材の名前として正しいか（URL に入れる前の確認）。 */
export function isCharacterArt(name) {
  return typeof name === 'string' && CHARACTER_ART.includes(name);
}

/** 絵の URL。知らない名前・基準なしは null。 */
export function characterImageUrl(name, base) {
  if (!base || !isCharacterArt(name)) return null;
  return base + name + '.webp';
}

/** 最後に学習した日から今日まで何日たったか。まだ学習していない・日付が読めないときは null。時計が戻っていても 0 未満にはしない。 */
export function daysSinceLastStudy(state, todayKey) {
  const last = state && state.streak && state.streak.last;
  if (typeof last !== 'string' || typeof todayKey !== 'string') return null;
  const d = keyDiff(last, todayKey);
  return Number.isFinite(d) ? Math.max(0, d) : null;
}

/** ホームの柴犬。状況と時間帯で一言が変わる。上から順に、最初に当てはまった1つだけ（要件定義書 §6 キャラクター）。
 *  now は Date（端末の時刻）。同じ日・同じ時間帯なら、開き直しても同じ一言（乱数は使わない）。 */
export function homeMascot(state, now = new Date()) {
  const T = CHARACTER_TEXT;
  const s = state && typeof state === 'object' ? state : {};
  const ok = now instanceof Date && !Number.isNaN(now.getTime());
  if (!ok) return { art: 'shiba-hello', text: T.homeHello };
  const key = dateKey(now);
  const hour = now.getHours();
  if (state && recordIsEmpty(state)) return { art: 'shiba-hello', text: T.homeFirst };
  const away = daysSinceLastStudy(s, key);
  if (away !== null && away >= AWAY_DAYS) return { art: 'shiba-sleepy', text: T.homeBack };
  const days = examStatus(s.settings, now).days;
  if (days === 0) return { art: 'shiba-cheer', text: T.homeExamToday };
  if (days === 1) return { art: 'shiba-cheer', text: T.homeExamTomorrow };
  if (dailyProgress(s, key).done) return { art: 'shiba-banzai', text: T.homeGoalDone };
  if (hour < 5) return { art: 'shiba-sleepy', text: T.homeLate };
  if (days !== null && days >= 2 && days <= EXAM_NEAR_DAYS) return { art: 'shiba-cheer', text: T.homeExamNear(days) };
  const streak = currentStreak(s.streak, key);
  if (streak >= STREAK_PRAISE_DAYS) return { art: 'shiba-clap', text: T.homeStreak(streak) };
  if (hour >= 5 && hour <= 10) return { art: 'shiba-hello', text: T.homeMorning };
  if (hour >= 11 && hour <= 13) return { art: 'shiba-hello', text: T.homeNoon };
  if (hour >= 17 && hour <= 20) return { art: 'shiba-hello', text: T.homeEvening };
  if (hour >= 21) return { art: 'shiba-hello', text: T.homeNight };
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  return { art: 'shiba-hello', text: weekend ? T.homeWeekend : T.homeHello };
}

/** いま不正解が何問続いているか。corrects は答えた順の正誤（true＝正解）。 */
export function trailingWrong(corrects) {
  let n = 0;
  for (let i = (corrects || []).length - 1; i >= 0; i--) {
    if (corrects[i]) break;
    n++;
  }
  return n;
}

/** 応援を出すか。3問続けて不正解になった問題で出す（4・5問めでは出さず、6問めでもう一度）。 */
export function shouldCheer(corrects) {
  const n = trailingWrong(corrects);
  return n >= CHEER_RUN && n % CHEER_RUN === 0;
}

/** 問題の解説の先生。正解なら丸、不正解なら「大丈夫」。 */
export function explainSensei(correct) {
  return correct ? 'sensei-ok' : 'sensei-comfort';
}

/** 解説の「覚え方」の先生。 */
export const TIP_SENSEI = 'sensei-point';

/** 模擬試験の結果の先生。rate は正答率（%）。 */
export function examMascot(rate) {
  if (Number.isFinite(rate) && rate >= EXAM_HIGH_RATE) return { art: 'sensei-clap', text: CHARACTER_TEXT.examHigh };
  return { art: 'sensei-comfort', text: CHARACTER_TEXT.examLow };
}

/** 苦手の分析の先生。state は weakness.js の analyze の state。remaining は『あと何問で判定できるか』。分析できない（none）ときは出さない（null）。 */
export function weakMascot(state, remaining) {
  if (state === 'weak') return { art: 'sensei-point', text: CHARACTER_TEXT.weakFound };
  if (state === 'clear') return { art: 'sensei-ok', text: CHARACTER_TEXT.weakClear };
  if (state === 'learning' && Number.isFinite(remaining) && remaining > 0) return { art: 'sensei-think', text: 'あと' + remaining + '問、同じ項目の問題に答えると、苦手が分かるよ' };
  return null;
}

/** お祝いの柴犬。レベルアップと1日の目標＝バンザイ、バッジと星＝拍手。知らない種類は出さない。 */
export function celebrationMascot(kind) {
  if (kind === 'level' || kind === 'goal') return 'shiba-banzai';
  if (kind === 'badge' || kind === 'stars') return 'shiba-clap';
  return null;
}

// ---- キャラクターをタップする遊び（隠しセリフ）。要件定義書 §6 キャラクター。回数はキャラごとに数え、記録（state.charTaps）に残す ----
/** タップ回数を数えるキャラ。 */
export const TAP_WHO = ['shiba', 'sensei'];

/** 隠しセリフが出る回数と、その文言。文言はここ1か所にまとめる。 */
export const CHARACTER_TAP_TEXT = {
  shiba: {
    10: 'くすぐったいよ〜！',
    20: 'わん！ わんわん！',
    30: 'そんなに押したら、目が回るよ〜',
    50: '…もしかして、ぼくのこと好き？',
    100: '100回！ その根気、勉強にも使っちゃおう！',
  },
  sensei: {
    10: 'はい、なんでしょう？',
    20: '質問は、解説を読んでからにしましょうね',
    30: '先生をつついても、点数は上がりませんよ',
    50: '…休憩も、学習のうちですよ',
    100: '100回…。その集中力、本番で見せてくださいね',
  },
};

/** 数え上げの上限（壊れた値が入っても、桁があふれないように）。 */
export const TAP_MAX = 1000000;

/** 絵の名前から、タップを数えるキャラ（shiba／sensei）。知らない絵は null。 */
export function tapWho(art) {
  if (typeof art !== 'string') return null;
  if (art.startsWith('shiba-')) return 'shiba';
  if (art.startsWith('sensei-')) return 'sensei';
  return null;
}

/** 保存されたタップ回数を {shiba, sensei} の形に直す。欠け・負・小数・文字・NaN は0か切り捨てで正す。 */
export function normalizeCharTaps(v) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const out = {};
  for (const k of TAP_WHO) {
    const n = o[k];
    out[k] = typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), TAP_MAX) : 0;
  }
  return out;
}

/** この回数ちょうどで出す隠しセリフ。節目でなければ null。100回のあとは100回ごと（200, 300…）に100回の文。 */
export function tapLine(who, count) {
  const lines = CHARACTER_TAP_TEXT[who];
  if (!lines || !Number.isInteger(count) || count < 1) return null;
  if (lines[count]) return lines[count];
  if (count > 100 && count % 100 === 0) return lines[100];
  return null;
}

/** 1回タップしたことを記録に足す。state.charTaps を直接更新し、{ count, line } を返す（line は節目のときだけ文、それ以外は null）。知らないキャラは null。 */
export function recordTap(state, who) {
  if (!state || typeof state !== 'object' || !TAP_WHO.includes(who)) return null;
  const taps = normalizeCharTaps(state.charTaps);
  taps[who] = Math.min(taps[who] + 1, TAP_MAX);
  state.charTaps = taps;
  return { count: taps[who], line: tapLine(who, taps[who]) };
}
