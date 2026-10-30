// 「あとで見る」の印。state.later = { 問題ID: 印を付けた時刻（ミリ秒） }。純粋な関数だけ（画面は views/later.js）。

/** 読んだ保存データの later を正しい形にする。数でない値・ID でないものは捨てる。 */
export function normalizeLater(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, t] of Object.entries(raw)) {
    if (id && typeof t === 'number' && Number.isFinite(t) && t > 0) out[id] = t;
  }
  return out;
}

export function isLater(state, id) {
  return !!state.later && Object.prototype.hasOwnProperty.call(state.later, id);
}

/** 印のオン／オフを切り替える。戻り値は切り替えた後の状態（true＝印あり）。 */
export function toggleLater(state, id, now = new Date()) {
  if (!state.later || typeof state.later !== 'object') state.later = {};
  if (isLater(state, id)) {
    delete state.later[id];
    return false;
  }
  state.later[id] = now.getTime();
  return true;
}

/**
 * 印を付けた問題の一覧。データに無い（消えた）問題は出さない。
 * order: 'recent'＝印を付けた新しい順（同時刻は問題の並び順）／'chapter'＝問題データの並び順（章の順）
 * 戻り値: [{ q, at }]
 */
export function laterItems(state, questions, order = 'recent') {
  const later = normalizeLater(state && state.later);
  const items = [];
  questions.forEach((q, i) => {
    if (Object.prototype.hasOwnProperty.call(later, q.id)) items.push({ q, at: later[q.id], i });
  });
  if (order === 'chapter') items.sort((a, b) => a.i - b.i);
  else items.sort((a, b) => b.at - a.at || a.i - b.i);
  return items.map(({ q, at }) => ({ q, at }));
}

/** 一覧に出る件数（消えた問題を数えない）。 */
export function laterCount(state, questions) {
  return laterItems(state, questions).length;
}

// ---- 用語カード（要件定義書 §3-4-b）。state.laterCards = { カードID: 印を付けた時刻（ミリ秒） } ----

export function isLaterCard(state, id) {
  return !!state.laterCards && Object.prototype.hasOwnProperty.call(state.laterCards, id);
}

/** カードの印のオン／オフを切り替える。戻り値は切り替えた後の状態（true＝印あり）。 */
export function toggleLaterCard(state, id, now = new Date()) {
  if (!state.laterCards || typeof state.laterCards !== 'object') state.laterCards = {};
  if (isLaterCard(state, id)) {
    delete state.laterCards[id];
    return false;
  }
  state.laterCards[id] = now.getTime();
  return true;
}

/**
 * 印を付けたカードの一覧。データに無い（消えた）カードは出さない。
 * order: 'recent'＝印を付けた新しい順／'chapter'＝カードデータの並び順
 * 戻り値: [{ c, at }]
 */
export function laterCardItems(state, concepts, order = 'recent') {
  const later = normalizeLater(state && state.laterCards);
  const items = [];
  concepts.forEach((c, i) => {
    if (Object.prototype.hasOwnProperty.call(later, c.id)) items.push({ c, at: later[c.id], i });
  });
  if (order === 'chapter') items.sort((a, b) => a.i - b.i);
  else items.sort((a, b) => b.at - a.at || a.i - b.i);
  return items.map(({ c, at }) => ({ c, at }));
}

export function laterCardCount(state, concepts) {
  return laterCardItems(state, concepts).length;
}

/**
 * 印を付けたカードにつながる問題（要件定義書 §3-4-b）。カードの並び（order）→ 同じカードの中では問題データの順。重ねない。
 * conceptOf(ref) は q.concepts の1要素をカードに解決する関数（resolveRef を包んで渡す）。
 */
export function laterCardQuestions(state, concepts, questions, conceptOf, order = 'recent') {
  const out = [];
  const seen = new Set();
  for (const { c } of laterCardItems(state, concepts, order)) {
    for (const q of questions) {
      if (seen.has(q.id) || !(q.concepts || []).some((x) => conceptOf(x) === c)) continue;
      seen.add(q.id);
      out.push(q);
    }
  }
  return out;
}
