// バッジの定義と判定。大項目制覇のバッジは、シラバスの木から動的に作る。
// 各バッジの progress(state, todayKey) は「いまどこまで来たか」{ cur, max, unit, action? } を返す。
//   action は、その目標を始めるときの行き先（study=次のステージ／challenge／exam／stage=key のステージ）。
import { levelFromXp, totalXpForLevel, currentStreak } from './scoring.js';
import { secondsPerQuestion } from './quiz.js';
import { DOCHI_ROUNDS, normalizeDochi } from './dochi.js';
import { normalizeBoss, normalizeBossFlawless } from './boss.js';

// 絵のあるバッジ。共通の12個は shared/images/badges/<id>.webp（id と同じ名前）。
// 「どっち？」とボス戦の5つ（dochi-perfect・dochi-combo-10・boss-first・boss-all・boss-flawless）は絵がまだ無く、記号の表示。
// 絵を置くときは、ここの配列に5つの id を足し、shared/sw-core.js の SHARED に './images/badges/<id>.webp' の行を足す。
export const COMMON_BADGE_ART = Object.freeze(['first-answer', 'correct-10', 'correct-100', 'streak-3', 'streak-7', 'streak-30', 'level-5', 'level-10', 'challenge-8', 'exam-first', 'exam-70', 'exam-90', 'dochi-perfect', 'dochi-combo-10', 'boss-first', 'boss-all', 'boss-flawless']);
// 章の制覇バッジを取る星の数（ステージの最大＝完全クリア）。
export const CHAPTER_STARS = 3;
const SAFE_NAME = /^[A-Za-z0-9_-]+$/;

/**
 * ファイル名に使える形にする。英数字・ _ ・ - だけならそのまま。それ以外の文字（日本語など）は _u<16進>_ に置き換える。
 * 例: 'T-CH01' → 'T-CH01' ／ '技術' → '_u6280__u8853_'
 */
export function safeBadgeKey(raw) {
  const s = String(raw == null ? '' : raw);
  if (SAFE_NAME.test(s)) return s;
  return Array.from(s).map((c) => (/[A-Za-z0-9-]/.test(c) ? c : '_u' + c.codePointAt(0).toString(16) + '_')).join('');
}

/** 章（大項目）の制覇バッジの絵の名前。シラバスの id（T, B, CH01 など）があればそれ、無ければ key を安全な形にしたもの。 */
export function majorArtName(major) {
  return 'major-' + safeBadgeKey(major && typeof major.id === 'string' && major.id ? major.id : major && major.key);
}

/** バッジ定義の絵の名前。絵が無いバッジは null。 */
export function badgeArtName(def) {
  if (!def) return null;
  if (typeof def.art === 'string') return def.art;
  return COMMON_BADGE_ART.includes(def.id) ? def.id : null;
}

/**
 * 絵の URL。共通の12個 → sharedBase、章の制覇（major-◯◯）→ appBase。
 * sharedBase / appBase は末尾が / の URL（shared/images/badges/ と <アプリ>/images/badges/）。絵が無い・名前が不正なら null。
 */
export function badgeImageUrl(art, { sharedBase, appBase } = {}) {
  if (typeof art !== 'string' || !SAFE_NAME.test(art)) return null;
  if (art.startsWith('major-')) return appBase ? appBase + art + '.webp' : null;
  return COMMON_BADGE_ART.includes(art) && sharedBase ? sharedBase + art + '.webp' : null;
}

const count = (cur, max, unit) => ({ cur, max, unit, action: { kind: 'study' } });

/** 模擬試験（10問以上）のうち、いちばんよかった正答率（%・整数。切り捨て）。 */
function bestExamPercent(s) {
  let best = 0;
  for (const e of s.exams) if (e.total >= 10) best = Math.max(best, Math.floor((e.correct * 100) / e.total));
  return best;
}

/** 章のボスを倒した回数の合計。 */
function bossTotal(s) {
  return Object.values(normalizeBoss(s.boss)).reduce((a, b) => a + b, 0);
}

export function badgeDefs(tree, config) {
  const sec = secondsPerQuestion(config);
  // 「全章のボス撃破」の全部の章＝問題のある章（地図の章。ボスが出られる章。DX の補足の章もボスが出るので数える）
  const bossStages = ((tree && tree.stages) || []).filter((st) => st.questions.length);
  const defs = [
    { id: 'first-answer', name: 'はじめの一歩', desc: '最初の1問に答えた', test: (s) => s.totals.answered >= 1, progress: (s) => count(s.totals.answered, 1, '問') },
    { id: 'correct-10', name: '10問正解', desc: '通算10問正解', test: (s) => s.totals.correct >= 10, progress: (s) => count(s.totals.correct, 10, '問') },
    { id: 'correct-100', name: '100問正解', desc: '通算100問正解', test: (s) => s.totals.correct >= 100, progress: (s) => count(s.totals.correct, 100, '問') },
    { id: 'streak-3', name: '3日連続', desc: '3日続けて学習', test: (s) => s.streak.best >= 3, progress: (s, today) => count(currentStreak(s.streak, today), 3, '日') },
    { id: 'streak-7', name: '7日連続', desc: '7日続けて学習', test: (s) => s.streak.best >= 7, progress: (s, today) => count(currentStreak(s.streak, today), 7, '日') },
    { id: 'streak-30', name: '30日連続', desc: '30日続けて学習', test: (s) => s.streak.best >= 30, progress: (s, today) => count(currentStreak(s.streak, today), 30, '日') },
    { id: 'level-5', name: 'レベル5', desc: 'レベル5に到達', test: (s) => levelFromXp(s.xp).level >= 5, progress: (s) => count(Math.max(0, Math.floor(s.xp || 0)), totalXpForLevel(5), 'XP') },
    { id: 'level-10', name: 'レベル10', desc: 'レベル10に到達', test: (s) => levelFromXp(s.xp).level >= 10, progress: (s) => count(Math.max(0, Math.floor(s.xp || 0)), totalXpForLevel(10), 'XP') },
    { id: 'challenge-8', name: sec + '秒の達人', desc: sec + '秒チャレンジで8問以上正解', test: (s) => s.challenge.best >= 8, progress: (s) => ({ cur: s.challenge.best, max: 8, unit: '問', action: { kind: 'challenge' } }) },
    { id: 'exam-first', name: '模試デビュー', desc: '模擬試験を1回受けた', test: (s) => s.exams.length >= 1, progress: (s) => ({ cur: s.exams.length, max: 1, unit: '回', action: { kind: 'exam' } }) },
    { id: 'exam-70', name: '模試7割', desc: '模擬試験で正答率70%以上', test: (s) => s.exams.some((e) => e.total >= 10 && e.correct / e.total >= 0.7), progress: (s) => ({ cur: bestExamPercent(s), max: 70, unit: '%', action: { kind: 'exam' } }) },
    { id: 'exam-90', name: '模試9割', desc: '模擬試験で正答率90%以上', test: (s) => s.exams.some((e) => e.total >= 10 && e.correct / e.total >= 0.9), progress: (s) => ({ cur: bestExamPercent(s), max: 90, unit: '%', action: { kind: 'exam' } }) },
    // 「どっち？」とボス戦（要件定義書 §3-8）。「どっち？」は問題の記録を通らないので、結果の画面（app.commit）で判定される
    { id: 'dochi-perfect', name: 'どっち？パーフェクト', desc: '「どっち？」の1回で' + DOCHI_ROUNDS + '問すべて正解', test: (s) => normalizeDochi(s.dochi).best >= DOCHI_ROUNDS, progress: (s) => ({ cur: normalizeDochi(s.dochi).best, max: DOCHI_ROUNDS, unit: '問', action: { kind: 'dochi' } }) },
    { id: 'dochi-combo-10', name: 'コンボ10', desc: '「どっち？」でコンボ（連続正解）10', test: (s) => normalizeDochi(s.dochi).bestCombo >= 10, progress: (s) => ({ cur: normalizeDochi(s.dochi).bestCombo, max: 10, unit: 'コンボ', action: { kind: 'dochi' } }) },
    { id: 'boss-first', name: 'はじめての撃破', desc: '章のボスを初めて倒す', test: (s) => bossTotal(s) >= 1, progress: (s) => ({ cur: bossTotal(s), max: 1, unit: '回', action: { kind: 'boss' } }) },
    { id: 'boss-flawless', name: 'ノーダメージ', desc: 'ハートを1つも減らさずにボスを倒す', test: (s) => normalizeBossFlawless(s.bossFlawless) >= 1, progress: (s) => ({ cur: normalizeBossFlawless(s.bossFlawless), max: 1, unit: '回', action: { kind: 'boss' } }) },
  ];
  // 問題のある章が1つも無いときは作らない（every が空で true になり、何もしなくても取れてしまうため）
  if (bossStages.length) {
    const beaten = (s) => bossStages.filter((st) => normalizeBoss(s.boss)[st.key] >= 1).length;
    defs.splice(defs.findIndex((d) => d.id === 'boss-flawless'), 0, {
      id: 'boss-all',
      name: '全章のボス撃破',
      desc: '問題のある全' + bossStages.length + '章のボスを、1回以上倒す',
      test: (s) => beaten(s) >= bossStages.length,
      progress: (s) => ({ cur: beaten(s), max: bossStages.length, unit: '章', action: { kind: 'boss' } }),
    });
  }
  for (const major of (tree && tree.roots) || []) {
    const stages = major.children.filter((st) => st.questions.length);
    if (!stages.length) continue;
    defs.push({
      id: 'major:' + major.key,
      art: majorArtName(major),
      name: major.name + ' 制覇',
      desc: '「' + major.name + '」の全ステージをクリア（星1以上）',
      test: (s) => stages.every((st) => (s.stages[st.key] || { stars: 0 }).stars >= 1),
      progress: (s) => {
        const cleared = (st) => (s.stages[st.key] || { stars: 0 }).stars >= 1;
        const rest = stages.find((st) => !cleared(st));
        return { cur: stages.filter(cleared).length, max: stages.length, unit: 'ステージ', action: rest ? { kind: 'stage', key: rest.key } : { kind: 'study' } };
      },
    });
  }
  // 章（中項目＝ステージ）の制覇: その章のステージで星3（完全クリア）。大項目の制覇（星1以上で全部）とは条件が違う。
  // 並びは、共通 → 大項目 → 章。id は 'chapter:' + ステージの key。絵の名前は 'major-<章の id>'。
  for (const major of (tree && tree.roots) || []) {
    for (const st of major.children) {
      if (!st.questions.length) continue;
      const stars = (s) => (s.stages[st.key] || { stars: 0 }).stars;
      defs.push({
        id: 'chapter:' + st.key,
        art: majorArtName(st),
        name: st.name + ' 制覇',
        desc: '「' + st.name + '」のステージで星' + CHAPTER_STARS + 'を取る',
        test: (s) => stars(s) >= CHAPTER_STARS,
        progress: (s) => ({ cur: stars(s), max: CHAPTER_STARS, unit: '星', action: { kind: 'stage', key: st.key } }),
      });
    }
  }
  return defs;
}

/**
 * バッジ1つの進み具合。cur は 0〜max に収め、ratio は 0〜1、remaining は max-cur（0 未満にならない）。
 * 進み具合の関数が無い定義でも落ちない（max=0 のとき ratio は 0）。
 */
export function badgeProgress(def, state, todayKey) {
  const p = typeof def.progress === 'function' ? def.progress(state, todayKey) : { cur: 0, max: 0, unit: '' };
  const max = Math.max(0, Number(p.max) || 0);
  const cur = Math.min(max, Math.max(0, Number(p.cur) || 0));
  return { cur, max, unit: p.unit || '', remaining: max - cur, ratio: max ? cur / max : 0, action: p.action || { kind: 'study' } };
}

/** 新しく取れたバッジを state に記録して返す。 */
export function awardBadges(state, defs, todayKey) {
  const got = [];
  for (const d of defs) {
    if (!state.badges[d.id] && d.test(state)) {
      state.badges[d.id] = todayKey;
      got.push(d);
    }
  }
  return got;
}
