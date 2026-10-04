// キャラクター（柴犬と先生）: どの場面でどの絵を出すかの決まり。純粋な関数だけ（画面の部品は ui.js の characterImg / mascotLine）。
// 柴犬＝お祝いと応援。先生＝解説の案内。1画面に1人まで（要件定義書 §6）。
// 名前は 2026-10-05 に先生が決めた（柴犬＝サニー、先生＝あい先生）。名前と一言は、下の CHARACTER_NAMES と CHARACTER_TEXT の1か所にまとめる。
import { keyDiff } from './scoring.js';

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
  homeBack: 'おかえり！ また会えてうれしいよ',
  cheer: 'ここで覚えれば本番で取れる！',
  examHigh: 'よくできました！ この調子！',
  examLow: 'だいじょうぶ。まちがえたところが伸びしろだよ',
  aboutShiba: 'Aisunia のマスコット、サニーだよ！ 解説では、あい先生が案内してくれるよ',
};

/** 何日あいたら「おかえり」にするか。最後に学習した日の差がこの日数以上（＝1日まるごと休んだ）。 */
export const AWAY_DAYS = 2;
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

/** ホームの柴犬。しばらく休んでいたら、うとうとして「おかえり」。 */
export function homeMascot(state, todayKey) {
  const away = daysSinceLastStudy(state, todayKey);
  if (away !== null && away >= AWAY_DAYS) return { art: 'shiba-sleepy', text: CHARACTER_TEXT.homeBack };
  return { art: 'shiba-hello', text: CHARACTER_TEXT.homeHello };
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

/** お祝いの柴犬。レベルアップと1日の目標＝バンザイ、バッジと星＝拍手。知らない種類は出さない。 */
export function celebrationMascot(kind) {
  if (kind === 'level' || kind === 'goal') return 'shiba-banzai';
  if (kind === 'badge' || kind === 'stars') return 'shiba-clap';
  return null;
}
