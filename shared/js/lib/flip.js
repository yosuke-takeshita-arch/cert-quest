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

/** 節（cardtree.js の cardSections の1要素）の下の全部のカード。並びは木の順。 */
export function sectionCards(sec) {
  const out = [...(sec.cards || [])];
  for (const ch of sec.children || []) out.push(...sectionCards(ch));
  return out;
}

/**
 * 苦手な分野（要件定義書 §3-4-c）。中項目・小項目（深さ1以上）のうち、正答率が判定できて weakBelow を下回るもの。
 * rates は weakness.js の statsByKey の結果（節の key → { qualified, rate, percent }）。正答率の低い順（同じなら木の順）に最大 max 個。
 * 戻り値: [{ sec, stat }]
 */
export function flipWeakSections(sections, rates, weakBelow, max = 5) {
  const out = [];
  const walk = (s, depth) => {
    const st = depth >= 1 ? rates.get(s.key) : null;
    if (st && st.qualified && st.rate < weakBelow && s.count > 0) out.push({ sec: s, stat: st, i: out.length });
    for (const ch of s.children || []) walk(ch, depth + 1);
  };
  for (const s of sections) walk(s, 0);
  out.sort((a, b) => a.stat.rate - b.stat.rate || a.i - b.i);
  return out.slice(0, max).map(({ sec, stat }) => ({ sec, stat }));
}
