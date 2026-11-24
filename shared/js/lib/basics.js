// 基礎のことば（<アプリ>/data/basics.json）の読み込み・整形と、文中で見つける照合。DOM は触らない（テストできる）。決まりは要件定義書 §7-5。
// 形: [ { id, term, aliases?, oneLine, why, figures?, related? } ]
//   term と aliases … 文中で見つける語。notIn … 語を含むが別の言葉になる複合語の一覧（その中では印を付けない）。related … つながる試験範囲のカードの ID。figures … data/figures/ の図の ID。
// 試験範囲の外の言葉なので、地図・問題・模試・進み具合には入れない（app.data.basics と app.data.basicsMatcher だけが持つ）。
// ファイルが無い・空・壊れているときは、基礎のことばの無いアプリとして動く（画面は何も出さない）。
import { normalizeFigureIds } from './figures.js';

export const BASICS_FILE = 'basics.json';
export const MIN_TERM_LEN = 2; // これより短い語は文中で見つけない（「式」「値」のような1字の語は、どこにでも出て下線だらけになる）

const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : []);

/** 1語の整形。id と term が無ければ null。aliases は空・重複・term と同じものを落とす。 */
export function normalizeBasic(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.term !== 'string' || !raw.term.trim()) return null;
  const term = raw.term.trim();
  const aliases = [];
  for (const a of strs(raw.aliases)) if (a !== term && !aliases.includes(a)) aliases.push(a);
  const related = [];
  for (const r of strs(raw.related)) if (!related.includes(r)) related.push(r);
  return {
    id: raw.id.trim(),
    term,
    aliases,
    oneLine: typeof raw.oneLine === 'string' ? raw.oneLine.trim() : '',
    why: typeof raw.why === 'string' ? raw.why.trim() : '',
    figures: normalizeFigureIds(raw.figures),
    related,
    notIn: [...new Set(strs(raw.notIn))],
  };
}

/** 読んだ JSON を { items, problems } にする。配列（または { basics: [...] }）でなければ空。形が崩れた1語・id の重複は捨てて problems に書く。 */
export function normalizeBasics(raw, file = BASICS_FILE) {
  const problems = [];
  const arr = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray(raw.basics) ? raw.basics : null;
  if (!arr) {
    if (raw != null) problems.push({ file, reason: '基礎のことばの配列ではない' });
    return { items: [], problems };
  }
  const items = [];
  const seen = new Set();
  arr.forEach((r, k) => {
    const b = normalizeBasic(r);
    if (!b) return problems.push({ file, reason: '形が不正な語を捨てた(' + k + '番目' + (r && r.id ? ' ' + r.id : '') + ')' });
    if (seen.has(b.id)) return problems.push({ file, reason: 'IDの重複を捨てた(' + b.id + ')' });
    seen.add(b.id);
    items.push(b);
  });
  return { items, problems };
}

/**
 * basics.json を読む。ファイルが無い(404)・読めない・壊れているときは、基礎のことば無し（items が空）で返す。投げない。
 * fetchFn は (url) => Response。読み込みの進み具合には数えない（ボスのデータと同じ。無くてもアプリは動く）。
 */
export async function loadBasics(url, fetchFn = (u) => fetch(u)) {
  try {
    const res = await fetchFn(url);
    if (!res || !res.ok) {
      const status = res ? res.status : 0;
      return { items: [], problems: status && status !== 404 ? [{ file: BASICS_FILE, reason: '読み込み失敗(' + status + ')' }] : [] };
    }
    return normalizeBasics(await res.json());
  } catch (e) {
    return { items: [], problems: [{ file: BASICS_FILE, reason: '読み込み失敗(' + String(e && e.message ? e.message : e) + ')' }] };
  }
}

// ---- 文中で見つける照合 ----

/**
 * 照合用に、1文字ずつ全角→半角・大文字→小文字にそろえる（NFKC）。文字数は変えない（結果の位置を元の文に当てるため）。
 * 1文字が複数字に変わるもの（㌔ など）は、そろえずそのまま残す。
 */
export function fold(s) {
  const t = String(s == null ? '' : s);
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    const n = c.normalize('NFKC').toLowerCase();
    out += n.length === 1 ? n : c;
  }
  return out;
}

const ASCII_WORD = /[a-z0-9]/;

/** カードの title から、文中で見つける形を作る: title 全体・括弧の前（「次元削減（PCA）」→「次元削減」）・括弧の中（「PCA」）。 */
export function titleForms(title) {
  const t = String(title == null ? '' : title).trim();
  if (!t) return [];
  const forms = [t];
  const m = /^(.*?)\s*[（(]([^（）()]*)[）)]\s*$/.exec(t);
  if (m) {
    if (m[1].trim()) forms.push(m[1].trim());
    if (m[2].trim()) forms.push(m[2].trim());
  }
  return forms;
}

/**
 * 照合の道具を作る。basics … normalizeBasics の items、concepts … 試験範囲のカード（title だけ使う）。
 * 決まり（要件定義書 §7-5）: カードの title（と括弧の前・中）は『基礎のことばを付けない語』として、基礎のことばと同じ場所に入れる。
 * 長い語が勝つので、「次元削減」というカードがあれば、その中の「次元」には印を付けない。
 * 基礎のことばの語が、カードの title の形とちょうど同じ文字列のときは、基礎のことばが勝つ（印を付ける。『CNN』は『畳み込みニューラルネットワーク (CNN)』の括弧の中と同じ）。
 * notIn と同じ文字列のときは notIn が勝つ（今までどおり）。
 */
export function buildMatcher(basics, concepts) {
  const byKey = new Map(); // 照合用の文字列 -> { key, len, id, card }。id が null ＝ 見つけても印を付けない語（card が true ＝ カードの title 由来）
  const add = (form, id, card = false) => {
    const key = fold(form).trim();
    if (key.length < MIN_TERM_LEN) return;
    const old = byKey.get(key);
    if (!old) byKey.set(key, { key, len: key.length, id, card });
    else if (old.card && !card) byKey.set(key, { key, len: key.length, id, card: false }); // カードの title と同じ形の基礎のことば（と notIn）は、カードに勝つ
  };
  for (const c of Array.isArray(concepts) ? concepts : []) for (const f of titleForms(c && c.title)) add(f, null, true);
  // notIn … 基礎のことばの語を含むが、別の言葉になる複合語（『スパムフィルタ』の中の『フィルタ』）。カードの title と同じ『付けない語』として入れる
  for (const b of Array.isArray(basics) ? basics : []) for (const n of b.notIn || []) add(n, null);
  for (const b of Array.isArray(basics) ? basics : []) for (const f of [b.term, ...(b.aliases || [])]) add(f, b.id);
  const byFirst = new Map();
  for (const e of byKey.values()) {
    const k = e.key[0];
    if (!byFirst.has(k)) byFirst.set(k, []);
    byFirst.get(k).push(e);
  }
  const hasBasics = [...byKey.values()].some((e) => e.id);
  return { byFirst, byKey, hasBasics };
}

/**
 * カード自身の title の形（title 全体・括弧の前・中）と同じ基礎のことばの id の集合を返す。
 * カードの画面で seen の最初に入れる（CNN のカードを開いているのに、本文の CNN に印を付けて同じ説明の窓を開かせない）。
 */
export function basicIdsOfTitle(matcher, title) {
  const ids = new Set();
  if (!matcher || !matcher.byKey) return ids;
  for (const f of titleForms(title)) {
    const e = matcher.byKey.get(fold(f).trim());
    if (e && e.id) ids.add(e.id);
  }
  return ids;
}

/**
 * 文を、[{ text }, { text, id }, ...] に分ける（id が付いたものが基礎のことば）。つなげると元の文と同じ。
 * seen … 印を付けた基礎のことばの id の集合（呼ぶ側が渡す。1つの区画で同じ語に印を付けるのは最初の1回だけ。渡さなければ、この文の中だけ）。
 *        その語自身の基礎のことばを開いているときは、最初から入れておくと、自分の語には印を付けない。
 * 決まり: 長い語を優先・同じ長さならカード・重ならない。英数字で始まる／終わる語は、前／後ろが英数字なら見つけない（API が RAPID の中で見つからない）。
 */
export function segmentText(text, matcher, seen = new Set()) {
  const s = String(text == null ? '' : text);
  if (!s) return [];
  if (!matcher || !matcher.hasBasics) return [{ text: s }];
  const ft = fold(s);
  const cands = [];
  for (let i = 0; i < ft.length; i++) {
    const list = matcher.byFirst.get(ft[i]);
    if (!list) continue;
    for (const e of list) {
      if (!ft.startsWith(e.key, i)) continue;
      const end = i + e.len;
      if (ASCII_WORD.test(e.key[0]) && i > 0 && ASCII_WORD.test(ft[i - 1])) continue;
      if (ASCII_WORD.test(e.key[e.len - 1]) && end < ft.length && ASCII_WORD.test(ft[end])) continue;
      cands.push({ start: i, end, e });
    }
  }
  if (!cands.length) return [{ text: s }];
  // 長い順（同じ長さなら カードを先、次に前のほう）に取り、すでに取った範囲と重なるものは捨てる
  cands.sort((a, b) => b.e.len - a.e.len || (a.e.id === null ? 0 : 1) - (b.e.id === null ? 0 : 1) || a.start - b.start);
  const taken = new Array(ft.length).fill(false);
  const picked = [];
  for (const c of cands) {
    let free = true;
    for (let k = c.start; k < c.end; k++) if (taken[k]) { free = false; break; }
    if (!free) continue;
    for (let k = c.start; k < c.end; k++) taken[k] = true;
    picked.push(c);
  }
  picked.sort((a, b) => a.start - b.start);
  const out = [];
  let pos = 0;
  const pushPlain = (a, b) => {
    if (b <= a) return;
    const t = s.slice(a, b);
    if (out.length && !out[out.length - 1].id) out[out.length - 1].text += t;
    else out.push({ text: t });
  };
  for (const c of picked) {
    if (!c.e.id || seen.has(c.e.id)) continue; // カードの title・すでに印を付けた語は、ふつうの文字のまま
    pushPlain(pos, c.start);
    out.push({ text: s.slice(c.start, c.end), id: c.e.id });
    seen.add(c.e.id);
    pos = c.end;
  }
  pushPlain(pos, s.length);
  return out;
}
