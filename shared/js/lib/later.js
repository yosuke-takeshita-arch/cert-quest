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
