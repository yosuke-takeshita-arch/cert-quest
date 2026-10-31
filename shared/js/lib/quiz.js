// 出題まわりの純粋な関数。rng（0以上1未満の乱数を返す関数）を差し替えられるのでテストできる。
import { isPastQuestion } from './pastexam.js';

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 1問あたりの制限秒数（config.secondsPerQuestion。無ければ40）。 */
export function secondsPerQuestion(config) {
  const n = config && Number(config.secondsPerQuestion);
  return n > 0 ? n : 40;
}

/** 「37秒チャレンジ」のような表示名。秒数は config から作る。 */
export function challengeName(config) {
  return secondsPerQuestion(config) + '秒チャレンジ';
}

/**
 * 選択肢をシャッフルする（format が scenario のときと、過去問題〔出典 pastExam を持つ問題〕は元の順のまま）。answer と whyWrong は選択肢と一緒に動かし、対応を崩さない。
 * perm[新しい位置] = 元の位置。
 */
export function shuffleChoices(q, rng = Math.random) {
  const order = q.choices.map((_, i) => i);
  // 場面判断（scenario）は「A社では…」のように選択肢が記号と結びついているので、並べ替えない。
  // 過去問題は本試験に出たとおりの順（ア・イ・ウ・エ）で見せる決まり（要件定義書 §12）。並べ替えない。
  const perm = q.format === 'scenario' || isPastQuestion(q) ? order : shuffle(order, rng);
  return {
    q,
    perm,
    choices: perm.map((o) => q.choices[o]),
    answer: perm.indexOf(q.answer),
    whyWrong: perm.map((o) => (q.whyWrong && q.whyWrong[o] !== undefined ? q.whyWrong[o] : null)),
  };
}

/**
 * 出題する問題を選ぶ。優先順: 未回答 → 前回まちがえた → 前回正解。各グループ内はランダム。
 * n を超えない。選んだ後の並びもシャッフルする。
 */
export function pickQuestions(pool, qstats, n, rng = Math.random) {
  const unseen = [], wrong = [], right = [];
  for (const q of pool) {
    const r = qstats && qstats[q.id];
    if (!r || !r.seen) unseen.push(q);
    else if (r.lastOk === false) wrong.push(q);
    else right.push(q);
  }
  const ordered = [...shuffle(unseen, rng), ...shuffle(wrong, rng), ...shuffle(right, rng)];
  return shuffle(ordered.slice(0, n), rng);
}

/** 模擬試験の問題数と制限時間。足りない間は有る分で縮小し、時間も比例して縮める。 */
export function examPlan(exam, available) {
  const full = exam.questions;
  const count = Math.min(full, available);
  const minutes = count >= full ? exam.minutes : Math.max(1, Math.round((exam.minutes * count) / full));
  return { count, minutes, reduced: count < full, fullCount: full, fullMinutes: exam.minutes };
}

/** 大項目別の集計。results: [{major, correct}] */
export function byMajor(results) {
  const m = new Map();
  for (const r of results) {
    const e = m.get(r.major) || { major: r.major, total: 0, correct: 0 };
    e.total += 1;
    if (r.correct) e.correct += 1;
    m.set(r.major, e);
  }
  return [...m.values()].map((e) => ({ ...e, rate: e.total ? e.correct / e.total : 0 }));
}

/**
 * 模擬試験の中分類別の正答率（要件定義書の模擬試験「中分類別の正答率」）。results は { major, middle, correct }。
 * 大項目（major）→ その中の中分類の一覧（正答率の低い順。同じ率は問題数の多い順）の Map。中分類が無い問題は「その他」にまとめる。
 */
export const NO_MIDDLE = 'その他';
export function byMiddle(results) {
  const out = new Map();
  for (const r of results) {
    const mid = typeof r.middle === 'string' && r.middle ? r.middle : NO_MIDDLE;
    if (!out.has(r.major)) out.set(r.major, new Map());
    const m = out.get(r.major);
    const e = m.get(mid) || { middle: mid, total: 0, correct: 0 };
    e.total += 1;
    if (r.correct) e.correct += 1;
    m.set(mid, e);
  }
  const res = new Map();
  for (const [major, m] of out) {
    res.set(major, [...m.values()].map((e) => ({ ...e, rate: e.correct / e.total })).sort((a, b) => a.rate - b.rate || b.total - a.total));
  }
  return res;
}

/** 出題の型（qtype）の表示名。 */
export const QTYPE_LABEL = {
  term: '用語理解', relation: '関係理解', causal: '因果連鎖', loop: '循環構造',
  tradeoff: 'トレードオフ', interdep: '相互依存', miscon: '誤構造検出',
};

/** 配列 weights を total に合わせて整数に割り振る（最大剰余法。同じ余りは前のものを優先）。 */
function apportion(weights, total) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!(sum > 0) || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (w * total) / sum);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - out[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => { if (rest-- > 0) out[i] += 1; });
  return out;
}

/**
 * 模試の設計図から「領域×型グループ」の表を作る。行の合計＝perRoot、列の合計＝各グループの count。
 * 領域を順に見て、残りの必要数に比例して割り振る（最後の領域で列の合計がぴったり合う）。
 */
export function blueprintCells(blueprint, rootCount) {
  const groups = blueprint.qtypeGroups;
  const per = blueprint.perRoot;
  const col = apportion(groups.map((g) => g.count), per * rootCount); // 設計図の合計が合わないときも行の合計を優先する
  const rows = [];
  for (let r = 0; r < rootCount; r++) {
    const rowNeed = apportion(col, per);
    // 残りの必要数に比例（残りが行の合計に満たない列は、その残り以上は取らない）
    const row = rowNeed.map((n, g) => Math.min(n, col[g]));
    let short = per - row.reduce((a, b) => a + b, 0);
    for (let g = 0; short > 0 && g < row.length; g++) { const add = Math.min(short, col[g] - row[g]); row[g] += add; short -= add; }
    row.forEach((n, g) => { col[g] -= n; });
    rows.push(row);
  }
  return rows;
}

/**
 * 設計図つきの模試の出題。補足の領域は出さない。
 * 1) 領域×型グループの表どおりに、その領域・その型の問題から選ぶ
 * 2) 足りない分は、同じ領域の別の型（型が未設定のものを含む）で埋める
 * 3) それでも足りなければ、全体（補足を除く）から埋める
 * 戻り値 { items: 並びをシャッフル済みの問題, filled: 型を満たせず別の型で補った数, perRoot, groupCounts }
 * 足りない数は乱数に依らない（rng は選ぶ問題と並びだけを変える）。
 */
/**
 * 設計図の無い資格（G検定・AIパスポート）の模試の並び: 模試でまだ出ていない問題 → 模試で出たのが古い順。
 * 同じ順位の中はランダム（shuffle の後の安定ソート）。先頭から本番の問題数だけ使う。2026-10-18 先生決定 A
 */
export function orderExamUnseenFirst(questions, rng = Math.random, examSeen = null) {
  const seenAt = (q) => {
    const t = examSeen && typeof examSeen === 'object' ? examSeen[q.id] : undefined;
    return typeof t === 'number' && Number.isFinite(t) ? t : -Infinity;
  };
  return shuffle(questions, rng).sort((a, b) => {
    const x = seenAt(a), y = seenAt(b);
    return x === y ? 0 : x < y ? -1 : 1;
  });
}

export function pickExamByBlueprint(questions, blueprint, roots, rng = Math.random, examSeen = null) {
  const groups = blueprint.qtypeGroups;
  const groupOf = new Map();
  groups.forEach((g, i) => g.types.forEach((t) => groupOf.set(t, i)));
  const cells = blueprintCells(blueprint, roots.length);
  const rootIdx = new Map(roots.map((r, i) => [r, i]));
  // 各枠の中の優先: 模試でまだ出ていない → 模試で出たのが古い順。同じ順位の中はランダム（安定ソートなので shuffle の順が残る）。
  const seenAt = (q) => {
    const t = examSeen && typeof examSeen === 'object' ? examSeen[q.id] : undefined;
    return typeof t === 'number' && Number.isFinite(t) ? t : -Infinity;
  };
  const pool = shuffle(questions.filter((q) => rootIdx.has(q.syllabus[0])), rng).sort((a, b) => {
    const x = seenAt(a), y = seenAt(b);
    return x === y ? 0 : x < y ? -1 : 1;
  });
  const used = new Set();
  const picked = [];
  const take = (q) => { used.add(q.id); picked.push(q); };
  const deficit = roots.map(() => 0);
  roots.forEach((root, r) => {
    groups.forEach((g, gi) => {
      let n = cells[r][gi];
      for (const q of pool) {
        if (n <= 0) break;
        if (used.has(q.id) || q.syllabus[0] !== root || groupOf.get(q.qtype) !== gi) continue;
        take(q); n--;
      }
      deficit[r] += n;
    });
  });
  let filled = 0;
  roots.forEach((root, r) => {
    for (const q of pool) {
      if (deficit[r] <= 0) break;
      if (used.has(q.id) || q.syllabus[0] !== root) continue;
      take(q); deficit[r]--; filled++;
    }
  });
  let left = deficit.reduce((a, b) => a + b, 0);
  for (const q of pool) {
    if (left <= 0) break;
    if (used.has(q.id)) continue;
    take(q); left--; filled++;
  }
  return { items: shuffle(picked, rng), filled, perRoot: blueprint.perRoot, total: cells.reduce((a, row) => a + row.reduce((x, y) => x + y, 0), 0) };
}

/** 設計図として使える形か。使えなければ null（その資格は従来の選び方になる）。 */
export function readBlueprint(exam) {
  const b = exam && exam.blueprint;
  if (!b || !(b.perRoot > 0) || !Array.isArray(b.qtypeGroups) || !b.qtypeGroups.length) return null;
  const ok = b.qtypeGroups.every((g) => g && Array.isArray(g.types) && g.types.length && g.types.every((t) => typeof t === 'string') && g.count >= 0);
  return ok ? b : null;
}

/** 型別の集計。results: [{qtype, correct}]。型の無い問題（''）は「その他」にまとめる。 */
export function byQtype(results) {
  const m = new Map();
  for (const r of results) {
    const k = r.qtype || '';
    const e = m.get(k) || { qtype: k, total: 0, correct: 0 };
    e.total += 1;
    if (r.correct) e.correct += 1;
    m.set(k, e);
  }
  const order = Object.keys(QTYPE_LABEL);
  const key = (t) => (order.indexOf(t) < 0 ? 99 : order.indexOf(t));
  return [...m.values()].map((e) => ({ ...e, rate: e.total ? e.correct / e.total : 0 })).sort((a, b) => key(a.qtype) - key(b.qtype));
}

/**
 * 模擬試験の見直しの印（要件定義書の模擬試験「見直しの印」）。flags は問題ごとの真偽の配列。
 * cur から dir（+1 で後ろ、-1 で前）へ向かって、cur を含めずに最初に印のある番号。無ければ -1。最初の印は examFlagStep(flags, -1, 1)。
 */
export function examFlagStep(flags, cur, dir) {
  const step = dir < 0 ? -1 : 1;
  for (let i = cur + step; i >= 0 && i < flags.length; i += step) if (flags[i]) return i;
  return -1;
}

/**
 * 模擬試験でまちがえた問題の記録（要件定義書の模擬試験「まちがえた問題をあとから見る」）。
 * results は採点の結果（{ sq, chosen, correct }。chosen はその回の並びでの番号か null）。
 * 返すのは { id, perm, chosen } の配列。chosen は元の選択肢の番号（未回答は null）。
 */
export function examMissRecord(results) {
  return results.filter((r) => !r.correct).map((r) => ({
    id: r.sq.q.id,
    perm: r.sq.perm.slice(),
    chosen: r.chosen === null || r.chosen === undefined ? null : r.sq.perm[r.chosen],
  }));
}

/**
 * 記録から、結果の画面と同じ形の { sq, chosen } に戻す。q が無ければ null。
 * perm が今の選択肢の数に合う並べ替えでなければ、元の並びで見せる。chosen はその並びでの番号（未回答・不明は null）。
 */
export function examMissItem(q, rec) {
  if (!q || !rec) return null;
  const n = q.choices.length;
  const p = Array.isArray(rec.perm) ? rec.perm : [];
  const valid = p.length === n && new Set(p).size === n && p.every((x) => Number.isInteger(x) && x >= 0 && x < n);
  const perm = valid ? p.slice() : q.choices.map((_, i) => i);
  const sq = {
    q,
    perm,
    choices: perm.map((o) => q.choices[o]),
    answer: perm.indexOf(q.answer),
    whyWrong: perm.map((o) => (q.whyWrong && q.whyWrong[o] !== undefined ? q.whyWrong[o] : null)),
  };
  const ci = Number.isInteger(rec.chosen) ? perm.indexOf(rec.chosen) : -1;
  return { sq, chosen: ci >= 0 ? ci : null };
}
