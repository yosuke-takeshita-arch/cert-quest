// バッジの定義と判定。大項目制覇のバッジは、シラバスの木から動的に作る。
import { levelFromXp } from './scoring.js';

export function badgeDefs(tree) {
  const defs = [
    { id: 'first-answer', name: 'はじめの一歩', desc: '最初の1問に答えた', test: (s) => s.totals.answered >= 1 },
    { id: 'correct-10', name: '10問正解', desc: '通算10問正解', test: (s) => s.totals.correct >= 10 },
    { id: 'correct-100', name: '100問正解', desc: '通算100問正解', test: (s) => s.totals.correct >= 100 },
    { id: 'streak-3', name: '3日連続', desc: '3日続けて学習', test: (s) => s.streak.best >= 3 },
    { id: 'streak-7', name: '7日連続', desc: '7日続けて学習', test: (s) => s.streak.best >= 7 },
    { id: 'streak-30', name: '30日連続', desc: '30日続けて学習', test: (s) => s.streak.best >= 30 },
    { id: 'level-5', name: 'レベル5', desc: 'レベル5に到達', test: (s) => levelFromXp(s.xp).level >= 5 },
    { id: 'level-10', name: 'レベル10', desc: 'レベル10に到達', test: (s) => levelFromXp(s.xp).level >= 10 },
    { id: 'challenge-8', name: '40秒の達人', desc: '40秒チャレンジで8問以上正解', test: (s) => s.challenge.best >= 8 },
    { id: 'exam-first', name: '模試デビュー', desc: '模擬試験を1回受けた', test: (s) => s.exams.length >= 1 },
    { id: 'exam-70', name: '模試7割', desc: '模擬試験で正答率70%以上', test: (s) => s.exams.some((e) => e.total >= 10 && e.correct / e.total >= 0.7) },
    { id: 'exam-90', name: '模試9割', desc: '模擬試験で正答率90%以上', test: (s) => s.exams.some((e) => e.total >= 10 && e.correct / e.total >= 0.9) },
  ];
  for (const major of (tree && tree.roots) || []) {
    const stages = major.children.filter((st) => st.questions.length);
    if (!stages.length) continue;
    defs.push({
      id: 'major:' + major.key,
      name: major.name + ' 制覇',
      desc: '「' + major.name + '」の全ステージをクリア（星1以上）',
      test: (s) => stages.every((st) => (s.stages[st.key] || { stars: 0 }).stars >= 1),
    });
  }
  return defs;
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
