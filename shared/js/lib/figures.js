// 図（SVG）の純粋な部分。画面に出す処理は views/figure.js。決まりは要件定義書 §7-2。
// ここは DOM を使わない（テストできる）。tools/check-data.js の SVG の安全検査と、禁止事項を同じにしてある（片方を直したら、もう片方も直す）。

export const FIGURE_ID_RE = /^fig-[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const FIGURE_MAX_VIEWBOX_WIDTH = 360;

export const isFigureId = (v) => typeof v === 'string' && FIGURE_ID_RE.test(v);

/** figures 欄の正規化。形式に合う ID だけを、重複なしで元の順に残す。配列でなければ空。 */
export function normalizeFigureIds(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const x of v) if (isFigureId(x) && !out.includes(x)) out.push(x);
  return out;
}

/** 図の ID から、SVG のURL。dataBase は data/ のURL（末尾 /）。 */
export function figureUrl(dataBase, id) {
  if (!isFigureId(id)) throw new Error('図の ID が不正: ' + id);
  return new URL('figures/' + id + '.svg', dataBase).href;
}

const XMLNS_DECL = /\sxmlns(?::[a-z]+)?\s*=\s*"http:\/\/www\.w3\.org\/[^"]*"/gi;

/**
 * SVG の文字列の、禁止事項を探す。見つかったものの説明の配列（問題が無ければ空）。
 * 禁止: script・foreignObject・style（要素と属性）・image・イベント属性・# で始まらない href・外部への参照・javascript:/data:
 */
export function svgProblems(text) {
  const p = [];
  if (typeof text !== 'string' || !text.trim()) return ['SVG が空'];
  if (!/<svg[\s>]/i.test(text)) p.push('<svg> が無い');
  if (/<script[\s>\/]/i.test(text)) p.push('<script> がある');
  if (/<foreignObject[\s>\/]/i.test(text)) p.push('<foreignObject> がある');
  if (/<style[\s>\/]/i.test(text)) p.push('<style> がある（色は共通CSSのクラスで付ける）');
  if (/\sstyle\s*=/i.test(text)) p.push('style 属性がある（色は共通CSSのクラスで付ける）');
  if (/<image[\s>\/]/i.test(text)) p.push('<image> がある');
  if (/\son[a-z]+\s*=/i.test(text)) p.push('イベント属性（onclick など）がある');
  const hrefs = text.match(/\s(?:xlink:)?href\s*=\s*("[^"]*"|'[^']*')/gi) || [];
  for (const m of hrefs) {
    const v = m.replace(/^[^=]*=\s*/, '').slice(1, -1).trim();
    if (!v.startsWith('#')) p.push('# で始まらない href がある: ' + v.slice(0, 40));
  }
  if (/\s(?:xlink:)?href\s*=\s*[^"'\s>]/i.test(text)) p.push('引用符の無い href がある');
  if (/url\(\s*(?!["']?\s*#)/i.test(text)) p.push('url() が # 以外を指している');
  if (/javascript:/i.test(text)) p.push('javascript: がある');
  if (/\bdata:/i.test(text)) p.push('data: がある');
  if (/@import/i.test(text)) p.push('@import がある');
  const rest = text.replace(XMLNS_DECL, '');
  if (/(?:https?:)?\/\/[a-z0-9]/i.test(rest)) p.push('外部のURL（http など）がある');
  return p;
}

/** viewBox の幅（数）。無い・読めなければ null。 */
export function viewBoxWidth(text) {
  const m = /<svg[^>]*\sviewBox\s*=\s*"\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\s*"/i.exec(text || '');
  if (!m) return null;
  const w = Number(m[3]);
  return Number.isFinite(w) ? w : null;
}

/**
 * 同じ図を1つの画面に2回以上入れても id がぶつからないように、id に接尾辞を付ける（id と、それを指す
 * aria-labelledby / aria-describedby / href="#…" / url(#…) をそろえて直す）。
 */
export function scopeIds(text, suffix) {
  const ids = [];
  text.replace(/\sid\s*=\s*"([^"]+)"/g, (_, id) => { if (!ids.includes(id)) ids.push(id); return ''; });
  if (!ids.length) return text;
  const map = new Map(ids.map((id) => [id, id + '-' + suffix]));
  let out = text.replace(/(\sid\s*=\s*")([^"]+)(")/g, (_, a, id, c) => a + (map.get(id) || id) + c);
  out = out.replace(/(\saria-(?:labelledby|describedby)\s*=\s*")([^"]*)(")/g, (_, a, v, c) => a + v.split(/\s+/).filter(Boolean).map((t) => map.get(t) || t).join(' ') + c);
  out = out.replace(/(\s(?:xlink:)?href\s*=\s*")#([^"]+)(")/g, (_, a, id, c) => a + '#' + (map.get(id) || id) + c);
  out = out.replace(/url\(\s*#([^)\s]+)\s*\)/g, (_, id) => 'url(#' + (map.get(id) || id) + ')');
  return out;
}
