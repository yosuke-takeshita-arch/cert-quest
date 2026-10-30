// カードめくり（要件定義書 §3-4-c）。state.flip = { カードID: { ok: 覚えたか, at: 押した時刻のミリ秒 } }。純粋な関数だけ（画面は views/flip.js）。

export const FLIP_MAX = 20;

/** 読んだ保存データの flip を正しい形にする。形の合わない値は捨てる。 */
export function normalizeFlip(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (!id || !v || typeof v !== 'object' || typeof v.ok !== 'boolean') continue;
    if (typeof v.at !== 'number' || !Number.isFinite(v.at) || v.at <= 0) continue;
    out[id] = { ok: v.ok, at: v.at };
  }
  return out;
}

/** 「覚えた」（ok=true）／「まだ」（ok=false）を記録する。最後に押したほうだけ残す。 */
export function markFlip(state, id, ok, now = new Date()) {
  if (!state.flip || typeof state.flip !== 'object' || Array.isArray(state.flip)) state.flip = {};
  state.flip[id] = { ok: !!ok, at: now.getTime() };
}

/**
 * 1回にめくるカード。「まだ」（古く押した順）→ まだめくっていない（カードの順）→「覚えた」（古く押した順）。最大 max 枚。
 */
export function flipDeck(state, cards, max = FLIP_MAX) {
  const rec = normalizeFlip(state && state.flip);
  const notYet = [];
  const fresh = [];
  const known = [];
  cards.forEach((c, i) => {
    const r = rec[c.id];
    if (!r) fresh.push({ c, i });
    else (r.ok ? known : notYet).push({ c, i, at: r.at });
  });
  const byAt = (a, b) => a.at - b.at || a.i - b.i;
  notYet.sort(byAt);
  known.sort(byAt);
  return [...notYet, ...fresh, ...known].slice(0, max).map((x) => x.c);
}

/** 範囲の中の数（覚えた・まだ・めくっていない）。 */
export function flipCounts(state, cards) {
  const rec = normalizeFlip(state && state.flip);
  let ok = 0;
  let ng = 0;
  for (const c of cards) {
    const r = rec[c.id];
    if (r) r.ok ? ok++ : ng++;
  }
  return { ok, ng, fresh: cards.length - ok - ng };
}

/** 大項目（シラバスの1段目）ごとに分ける。並びはカードデータの順で最初に出た順。 */
export function flipMajors(cards) {
  const m = new Map();
  for (const c of cards) {
    const k = (c.syllabus && c.syllabus[0]) || 'その他';
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(c);
  }
  return [...m].map(([name, list]) => ({ name, cards: list }));
}
