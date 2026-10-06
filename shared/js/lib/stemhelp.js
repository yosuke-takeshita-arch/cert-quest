// 「問題文の意味」: 問題文を平易に言い直した文（stemPlain）と、問題文に出てくる用語カードの一言説明。
// 答える前に見られるので、答えの手がかりになるカードは出さない（下の「出さない決まり」）。純粋な関数だけ（画面は views/stemhelp.js）。
import { resolveRef } from './data.js';

/** stemPlain の長さの上限（文字数）。問題文の言い直しなので、長い解説にしない。tools/check-data*.js も同じ値を使う。 */
export const STEM_PLAIN_MAX = 200;
/** 用語カードを出す数の上限（多すぎると問題文より長くなり、かえって読みにくい）。 */
export const MAX_TERMS = 5;
/** 一言説明と選択肢が、これ以上の長さで同じ文字並びを共有したら、答えの手がかりとみなして出さない（記号・空白を除いた文字数）。 */
export const OVERLAP_LIMIT = 10;

const norm = (s) => String(s == null ? '' : s).normalize('NFKC').toLowerCase();
const squash = (s) => norm(s).replace(/[\s、。，．,.・:：;；「」『』（）()［］\[\]]/g, '');
const isAscii = (s) => /^[\x00-\x7f]+$/.test(s);
const isWordCh = (ch) => !!ch && /[a-z0-9_]/.test(ch);

/** 題名の呼び名: 全体・「（」より前・かっこの中（例: 『ReLU（ランプ関数）』→ relu（ランプ関数）／relu／ランプ関数）。 */
export function titleVariants(title) {
  const full = norm(title).trim();
  const out = new Set([full]);
  const m = /^(.*?)[（(]([^）)]*)[）)]/.exec(full);
  if (m) {
    if (m[1].trim()) out.add(m[1].trim());
    // かっこの中は、略称・別名だけを呼び名にする（全部が英数字、または全部が日本語。『DXレポート』のような混ざった語は、別の用語と取り違えやすいので使わない）
    const inner = m[2].trim();
    if (inner && (isAscii(inner) || ![...inner].some((c) => c.charCodeAt(0) < 128))) out.add(inner);
  }
  return [...out].filter((v) => (isAscii(v) ? v.length >= 3 : v.length >= 2));
}

/** text の中で variant が出てくる位置（英数字の語の途中は除く）。無ければ -1。 */
function findVariant(text, v) {
  let from = 0;
  for (;;) {
    const i = text.indexOf(v, from);
    if (i < 0) return -1;
    if (!isAscii(v) || (!isWordCh(text[i - 1]) && !isWordCh(text[i + v.length]))) return i;
    from = i + 1;
  }
}

/** 最長の共通部分文字列の長さ。 */
export function longestCommon(a, b) {
  let best = 0;
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) best = cur[j];
      }
    }
    prev = cur;
  }
  return best;
}

/**
 * 出さない決まり（理由: 答える前にこのボタンを押せるので、カードが答えを教えてはいけない）:
 *  ① 題名（または呼び名）が、どれかの選択肢の中に出てくる。→ その用語が選択肢で問われている。説明を出すと、その選択肢の当たり外れが分かる。
 *  ② どれかの選択肢が、題名の中に含まれる（選択肢が用語そのもの。例: 「〜を何というか」で選択肢が用語名）。
 *  ③ 一言説明が、どれかの選択肢と OVERLAP_LIMIT 文字以上同じ文字並びを共有している。→ 説明が選択肢の言い換えになっている。
 * 正解の選択肢だけでなく全選択肢で判定する（誤答の説明を見て消去法で答えが分かるのも手がかりのため）。
 * 迷う場合は出さない側に倒す（出さなくても学習は止まらない。出して答えが分かると、問題の意味が無くなる）。
 */
export function leaksAnswer(card, variants, choices) {
  const fullTitle = norm(card.title).trim();
  const oneLine = squash(card.oneLine);
  for (const raw of choices) {
    const ch = norm(raw).trim();
    if (!ch) continue;
    if (variants.some((v) => ch.includes(v))) return true;
    if (ch.length >= 2 && fullTitle.includes(ch)) return true;
    if (oneLine && longestCommon(oneLine, squash(raw)) >= OVERLAP_LIMIT) return true;
  }
  return false;
}

/**
 * 問題文の意味に出すもの。
 *  plain: stemPlain（無ければ ''）
 *  terms: 問題文に題名が出てくる用語カード（出てくる順。MAX_TERMS まで。oneLine が空のカードと、出さない決まりに当たるカードは除く）
 * q.concepts は「関連カード」で、多くは答え側の用語（実データで題名が問題文に無いものが約8割）なので、それだけでは出さない。
 * 題名が問題文に出てくるものだけを出し、q.concepts にあるカードは同じ位置なら先に並べる。
 * choices は、シャッフル後の選択肢（sq.choices）でも q.choices でもよい（並びは判定に関係しない）。
 */
export function stemHelp(q, concepts, index, choices) {
  const plain = typeof q.stemPlain === 'string' ? q.stemPlain.trim() : '';
  const stem = norm(q.stem);
  const chs = choices || q.choices;
  const related = new Set();
  for (const x of q.concepts || []) {
    const r = resolveRef(x, index);
    if (r.concept) related.add(r.concept.id);
  }
  const hits = [];
  for (const c of concepts) {
    if (!c.oneLine) continue;
    const variants = titleVariants(c.title);
    let best = null;
    for (const v of variants) {
      const i = findVariant(stem, v);
      if (i >= 0 && (!best || v.length > best.len)) best = { at: i, len: v.length };
    }
    if (!best) continue;
    if (leaksAnswer(c, variants, chs)) continue;
    hits.push({ c, at: best.at, end: best.at + best.len, rel: related.has(c.id) ? 0 : 1 });
  }
  // 別の用語の題名にすっぽり含まれる題名は捨てる（「機械学習」の中の「学習」を別に出さない）
  hits.sort((a, b) => b.end - b.at - (a.end - a.at) || a.at - b.at);
  const kept = [];
  for (const h of hits) if (!kept.some((k) => h.at >= k.at && h.end <= k.end)) kept.push(h);
  kept.sort((a, b) => a.at - b.at || a.rel - b.rel);
  return { plain, terms: kept.slice(0, MAX_TERMS).map((h) => h.c) };
}
