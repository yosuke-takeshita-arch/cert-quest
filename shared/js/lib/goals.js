// 「次の目標」の選び方。純粋な関数だけ。
// 候補 = まだ取っていないバッジ ＋ 星3になっていないステージ（1回は挑戦したもの）。
// 「近さ」は、達成までの残りの割合（1 - 進み具合）が小さい順。同じなら定義の順。
import { badgeProgress, badgeArtName } from './badges.js';

export const MAX_STAGE_STARS = 3;

/**
 * 近い順の目標の配列を返す（最大 limit 個）。
 * 各要素: { id, kind:'badge'|'stars', title, remainText, cur, max, ratio, action, label, art }
 *   art … バッジの絵の名前（絵が無い・星の目標は null。URL は badges.js の badgeImageUrl で作る）
 *   remainText … 「あと2日」「あと40XP」「あと星1つ」
 *   label      … 棒の横に出す「いま 3/7 日」
 */
export function nextGoals(tree, defs, state, todayKey, limit = 3) {
  const out = [];
  const chapterIds = new Set(defs.filter((d) => typeof d.id === 'string' && d.id.startsWith('chapter:')).map((d) => d.id));
  for (const d of defs) {
    if (state.badges[d.id]) continue;
    const p = badgeProgress(d, state, todayKey);
    if (!p.max) continue;
    out.push({
      id: d.id,
      kind: 'badge',
      title: d.name,
      remainText: 'あと' + p.remaining + p.unit,
      cur: p.cur,
      max: p.max,
      ratio: p.ratio,
      action: p.action,
      label: 'いま ' + p.cur + '/' + p.max + ' ' + p.unit,
      art: badgeArtName(d),
    });
  }
  for (const st of (tree && tree.stages) || []) {
    const rec = state.stages[st.key];
    if (!st.questions.length || !rec || !(rec.runs > 0) || rec.stars >= MAX_STAGE_STARS) continue;
    if (chapterIds.has('chapter:' + st.key) && !state.badges['chapter:' + st.key]) continue; // 同じ「星3まで」は、章の制覇バッジの目標（絵つき）で出すので重ねない
    const remaining = MAX_STAGE_STARS - rec.stars;
    out.push({
      id: 'stars:' + st.key,
      kind: 'stars',
      title: st.name + '（星' + MAX_STAGE_STARS + '）',
      remainText: 'あと星' + remaining + 'つ',
      cur: rec.stars,
      max: MAX_STAGE_STARS,
      ratio: rec.stars / MAX_STAGE_STARS,
      action: { kind: 'stage', key: st.key },
      label: 'いま 星' + rec.stars + '/' + MAX_STAGE_STARS,
      art: null,
    });
  }
  return out
    .map((g, i) => ({ g, i }))
    .sort((a, b) => (1 - a.g.ratio) - (1 - b.g.ratio) || a.i - b.i)
    .slice(0, Math.max(0, limit))
    .map((x) => x.g);
}
