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
/** 色分けの「赤」の線（星1の線）。タイルの赤と黄の境目。 */
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

// ---- すべての分野（要件定義書 §6-4）。analyze と同じ unitStats で数える（同じ数を別の数え方で出さない） ----

/** 「すべての分野」の並べ方。tree＝章の順（木の順）、rate＝正答率の低い順。選んだほうは settings.weakOrder に保存する。 */
export const WEAK_ORDERS = ['tree', 'rate'];
export const DEFAULT_WEAK_ORDER = 'tree';

export function normalizeWeakOrder(v) {
  return typeof v === 'string' && WEAK_ORDERS.includes(v) ? v : DEFAULT_WEAK_ORDER;
}

/**
 * 全部の分野（分析の単位ごと）の成績。各要素は unitStats の結果に order（木の順の番号）を足したもの。
 *   tree … 木の順
 *   rate … 判定に入った分野を正答率の低い順（同じなら答えた数の多い順→木の順）、そのあとに判定に足りない分野を木の順
 * 問題の無い分野は analysisUnits が作らないので出ない。
 */
export function allStats(tree, qstats, order = DEFAULT_WEAK_ORDER) {
  const stats = analysisUnits(tree).map((u, i) => ({ ...unitStats(u, qstats), order: i }));
  if (normalizeWeakOrder(order) !== 'rate') return stats;
  const byOrder = (a, b) => a.order - b.order;
  const judged = stats.filter((s) => s.qualified).sort((a, b) => a.rate - b.rate || b.answered - a.answered || byOrder(a, b));
  const rest = stats.filter((s) => !s.qualified).sort(byOrder);
  return [...judged, ...rest];
}

/** 判定に足りない分野で「あと何問答えると正答率が出るか」。判定できる分野（qualified）・判定しない分野（3問未満）は null。 */
export function questionsToJudge(stat) {
  if (!stat || stat.qualified || !stat.judgeable) return null;
  return stat.required - stat.answered;
}

/** その分野で、最後に答えたとき間違えた問題（木の順）。seen が無い・lastOk が真の問題は入らない。 */
export function wrongQuestions(unit, qstats) {
  const out = [];
  for (const q of (unit && unit.questions) || []) {
    const r = qstats && qstats[q.id];
    if (r && r.seen && !r.lastOk) out.push(q);
  }
  return out;
}

/**
 * カードの見出し用: 分野の木の節（key）→ 成績。見出しがちょうど1つの分析の単位に当たるものだけ入れる。
 * 小項目はその小項目の単位。小項目に問題がある章で、章に直接ぶら下がる問題だけの単位（partial かつ node が章）は、
 * 章の見出しの数と読まれて誤解されるので入れない。
 */
export function statsByKey(tree, qstats) {
  const m = new Map();
  for (const s of allStats(tree, qstats)) {
    if (s.unit.partial && s.unit.node === s.unit.stage) continue;
    m.set(s.unit.key, s);
  }
  return m;
}

// ---- よく間違える問題（要件定義書 §6-4）。しきい値はここの1か所 ----
/** 解いた回数がこれ以上の問題だけ（1回だけでは、たまたまかどうか分からない）。 */
export const OFTEN_MIN_SEEN = 2;
/** 間違えた割合（1−正解÷解いた回数）がこれ以上なら「よく間違える」。 */
export const OFTEN_MIN_WRONG_RATE = 0.5;
/** 「よく間違える問題を解く」で出す最大の問題数（上から）。 */
export const OFTEN_SOLVE_MAX = 20;

/**
 * よく間違える問題。questions はデータにある問題（データから外れた問題 ID の記録は数えない）。
 * 各要素: { q, seen, wrong, rate }。並べ方は、間違えた割合の高い順 → 間違えた回数の多い順 → 最後に間違えた（lastOk が false）問題を先 → データの順。
 * 記録に『最後に間違えた日』は残らない（正解すると期日が消える）ので、最後に解いたとき間違えたかどうか（lastOk）で『最後に間違えた』を決める。
 * seen・correct が整数でない・correct が seen より多い・負の記録は、壊れているので数えない。
 */
export function oftenWrong(questions, qstats) {
  const out = [];
  (questions || []).forEach((q, order) => {
    const r = q && qstats && qstats[q.id];
    if (!r || !Number.isInteger(r.seen) || !Number.isInteger(r.correct)) return;
    if (r.seen < OFTEN_MIN_SEEN || r.correct < 0 || r.correct > r.seen) return;
    const wrong = r.seen - r.correct;
    if (wrong / r.seen < OFTEN_MIN_WRONG_RATE) return;
    out.push({ q, seen: r.seen, wrong, rate: wrong / r.seen, last: r.lastOk === false, order });
  });
  return out.sort((a, b) => b.wrong * a.seen - a.wrong * b.seen || b.wrong - a.wrong || Number(b.last) - Number(a.last) || a.order - b.order);
}

/** ホームの「苦手の分析」カードに出す、いちばん苦手な分野の数。 */
export const HOME_WEAK_COUNT = 2;

/**
 * ホームの「苦手の分析」カード（いつも置く。要件定義書 §6-4）。
 *   kind … 'weak'（苦手がある。items にいちばん苦手な HOME_WEAK_COUNT 分野）／'clear'（判定できる所はあるが苦手は無い）／'none'（判定に入る分野がまだ無い）
 */
export function homeWeakCard(analysis) {
  if (!analysis || analysis.state === 'none' || analysis.state === 'learning') return { kind: 'none', items: [] };
  if (analysis.state === 'weak') return { kind: 'weak', items: analysis.weak.slice(0, HOME_WEAK_COUNT) };
  return { kind: 'clear', items: [] };
}

// ---- 見て分かる形（要件定義書 §6-4）: 章ごとの正答率・レーダーチャート・分野のタイル ----

/** タイルの色の境目は、星1の線（HOME_WEAK_BELOW＝60%）と定着の線（WEAK_BELOW＝80%）。 */
export function tileLevel(stat) {
  if (!stat || !stat.qualified) return 'none';
  if (stat.rate < HOME_WEAK_BELOW) return 'ng';
  if (stat.rate < WEAK_BELOW) return 'mid';
  return 'ok';
}

/** 色だけに頼らないタイルの記号（○＝定着／△＝もう少し／×＝苦手／空＝まだ）。 */
export const TILE_MARK = { ok: '○', mid: '△', ng: '×', none: '' };

/**
 * 章ごとの成績（木の順）。分野と同じ決め方（unitStats）で、章の中の全問題を1つの単位として数える。
 * 各要素は unitStats の結果に chapter（章のノード）・order を足したもの。問題の無い章は入らない。
 */
export function chapterStats(tree, qstats) {
  const out = [];
  ((tree && tree.stages) || []).forEach((st) => {
    if (!st.questions.length) return;
    const unit = { key: st.key, name: st.name, path: st.path, stage: st, node: st, partial: false, questions: st.questions };
    out.push({ ...unitStats(unit, qstats), chapter: st, order: out.length });
  });
  return out;
}

/**
 * 章を軸にしたレーダーチャートの形（純粋な計算。SVG は画面側）。
 * 軸は真上から時計回り。値は正答率（0〜1）。判定に足りない章（qualified でない）は value=null で、点は結ばない（0にしない）。
 * 返す形: { axes: [{ i, angle, ox, oy, lx, ly, value, vx, vy }], solid: [[x,y]…]（結ぶ点）, closed: 3つ以上なら多角形 }
 */
export function radarGeometry(stats, { cx = 0, cy = 0, r = 100, labelR = r + 14 } = {}) {
  const n = stats.length;
  const axes = stats.map((s, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const c = Math.cos(angle), sn = Math.sin(angle);
    const value = s.qualified ? s.rate : null;
    return {
      i, angle,
      ox: cx + r * c, oy: cy + r * sn,
      lx: cx + labelR * c, ly: cy + labelR * sn,
      value,
      vx: value == null ? null : cx + r * value * c,
      vy: value == null ? null : cy + r * value * sn,
    };
  });
  const solid = axes.filter((a) => a.value != null).map((a) => [a.vx, a.vy]);
  return { axes, solid, closed: solid.length >= 3 };
}
