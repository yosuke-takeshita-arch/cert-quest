// 苦手な分野の分析。純粋な関数だけ（画面は views/weak.js、ホームの一行は views/home.js）。
// 単位は小項目。小項目の無い章は章そのもの。問題は小項目にぶら下がる（data.js の buildTree）。
// 正答率は、地図の色と同じ決め方: 「答えた問題のうち、最後に解いたとき正解だった問題の割合」（progress.js の nodeProgress と同じ数え方）。
// 答えた数が少ないうちは正答率があてにならないので、判定に入れない（下の WEAK_MIN_ANSWERED）。

/** 判定に要る、答えた問題の数（その項目の中の、別々の問題の数）。5問を目安にする。 */
export const WEAK_MIN_ANSWERED = 5;
/** 問題が3問に満たない項目は、全部答えても判定しない（2問では1問まちがえただけで50%になる）。 */
export const WEAK_MIN_QUESTIONS = 3;
/** 正答率がこれ未満なら「苦手」。80%以上は、地図の「定着」と同じ線で、苦手に入れない。 */
export const WEAK_BELOW = 0.8;
/** 苦手として並べる最大の件数。 */
export const WEAK_LIMIT = 4;
/** まだ手を付けていない所として並べる最大の件数。 */
export const UNTOUCHED_LIMIT = 3;
/** 得意として並べる最大の件数。 */
export const STRONG_LIMIT = 2;
/** ホームに一行出すのは、いちばん苦手な所の正答率がこれ未満のとき（星1の線。うるさくしない）。 */
export const HOME_WEAK_BELOW = 0.6;

/**
 * 分析の単位の一覧（木の順）。各要素: { key, name, path, stage, node, partial, questions }
 *   partial … 章のうちの一部の問題だけを指す（＝「ここを解く」で章の星を付けない）
 * 小項目に問題がある章は、その小項目ごと。章に直接ぶら下がる問題が残っていれば、章そのものを1単位として足す。
 * 小項目に問題が1つも無い章は、章そのもの。
 */
export function analysisUnits(tree) {
  const out = [];
  for (const st of (tree && tree.stages) || []) {
    if (!st.questions.length) continue;
    const kids = st.children.filter((c) => c.questions.length);
    if (!kids.length) {
      out.push({ key: st.key, name: st.name, path: st.path, stage: st, node: st, partial: false, questions: st.questions });
      continue;
    }
    const inKids = new Set();
    for (const k of kids) {
      k.questions.forEach((q) => inKids.add(q.id));
      out.push({ key: k.key, name: k.name, path: k.path, stage: st, node: k, partial: true, questions: k.questions });
    }
    const rest = st.questions.filter((q) => !inKids.has(q.id));
    if (rest.length) out.push({ key: st.key, name: st.name, path: st.path, stage: st, node: st, partial: true, questions: rest });
  }
  return out;
}

/** 整数のパーセント（小数は切り捨て。79.5% を「80%」と出して「苦手」と矛盾させない）。答えが無ければ null。 */
export function ratePercent(lastOk, answered) {
  if (!answered) return null;
  return Math.floor((lastOk * 100) / answered);
}

/** 1単位の成績。rate は答えた問題が無ければ null。required は判定に要る数（問題が5問に満たなければ、その全部）。 */
export function unitStats(unit, qstats) {
  let answered = 0, lastOk = 0;
  for (const q of unit.questions) {
    const r = qstats && qstats[q.id];
    if (r && r.seen) {
      answered++;
      if (r.lastOk) lastOk++;
    }
  }
  const total = unit.questions.length;
  const required = Math.min(WEAK_MIN_ANSWERED, total);
  const judgeable = total >= WEAK_MIN_QUESTIONS;
  return {
    unit, total, answered, lastOk, required, judgeable,
    qualified: judgeable && answered >= required,
    rate: answered ? lastOk / answered : null,
    percent: ratePercent(lastOk, answered),
  };
}

/**
 * 分析の結果。
 *   state … 'none'（分析できる問題が無い）／'learning'（答えた数が足りず、まだ分からない）／'weak'（苦手がある）／'clear'（判定できる所はあるが、苦手は無い）
 *   weak … 正答率の低い順（同じなら、答えた数が多い順→木の順）。最大 WEAK_LIMIT 件。weakTotal はそれを切る前の件数
 *   untouched … 答えた数が0の所（木の順）。最大 UNTOUCHED_LIMIT 件。untouchedTotal は切る前の件数
 *   strong … 正答率の高い順。最大 STRONG_LIMIT 件
 *   remaining … state が learning のとき、「あと何問答えると判定できる所が出るか」（いちばん近い項目の残り。1以上）
 */
export function analyze(tree, qstats) {
  const stats = analysisUnits(tree).map((u, i) => ({ ...unitStats(u, qstats), order: i }));
  const byOrder = (a, b) => a.order - b.order;
  const qualified = stats.filter((s) => s.qualified);
  const weakAll = qualified.filter((s) => s.rate < WEAK_BELOW).sort((a, b) => a.rate - b.rate || b.answered - a.answered || byOrder(a, b));
  const strongAll = qualified.filter((s) => s.rate >= WEAK_BELOW).sort((a, b) => b.rate - a.rate || b.answered - a.answered || byOrder(a, b));
  const untouchedAll = stats.filter((s) => s.total > 0 && s.answered === 0).sort(byOrder);
  const judgeable = stats.filter((s) => s.judgeable);
  let state = 'none';
  let remaining = null;
  if (judgeable.length) {
    if (weakAll.length) state = 'weak';
    else if (qualified.length) state = 'clear';
    else {
      state = 'learning';
      remaining = Math.min(...judgeable.map((s) => s.required - s.answered));
    }
  }
  return {
    state, remaining,
    weak: weakAll.slice(0, WEAK_LIMIT), weakTotal: weakAll.length,
    untouched: untouchedAll.slice(0, UNTOUCHED_LIMIT), untouchedTotal: untouchedAll.length,
    strong: strongAll.slice(0, STRONG_LIMIT),
  };
}

/** ホームに一行出す苦手（いちばん苦手な所。正答率が HOME_WEAK_BELOW 以上なら出さない＝null）。 */
export function homeWeak(analysis) {
  const w = analysis && analysis.weak && analysis.weak[0];
  return w && w.rate < HOME_WEAK_BELOW ? w : null;
}

/** ホームの一行の文言。 */
export function homeWeakText(stat) {
  return '苦手：' + stat.unit.name + '（正答率' + stat.percent + '%）を解く';
}
