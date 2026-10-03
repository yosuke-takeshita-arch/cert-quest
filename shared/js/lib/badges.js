// バッジの定義と判定。大項目制覇のバッジは、シラバスの木から動的に作る。
// 各バッジの progress(state, todayKey) は「いまどこまで来たか」{ cur, max, unit, action? } を返す。
//   action は、その目標を始めるときの行き先（study=次のステージ／challenge／exam／stage=key のステージ）。
import { levelFromXp, totalXpForLevel, currentStreak } from './scoring.js';
import { secondsPerQuestion } from './quiz.js';

const count = (cur, max, unit) => ({ cur, max, unit, action: { kind: 'study' } });

/** 模擬試験（10問以上）のうち、いちばんよかった正答率（%・整数。切り捨て）。 */
function bestExamPercent(s) {
  let best = 0;
  for (const e of s.exams) if (e.total >= 10) best = Math.max(best, Math.floor((e.correct * 100) / e.total));
  return best;
}

export function badgeDefs(tree, config) {
  const sec = secondsPerQuestion(config);
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
  ];
  for (const major of (tree && tree.roots) || []) {
    const stages = major.children.filter((st) => st.questions.length);
    if (!stages.length) continue;
    defs.push({
      id: 'major:' + major.key,
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
