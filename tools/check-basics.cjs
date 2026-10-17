// 基礎のことば（<アプリ>/data/basics.json。要件定義書 §7-5）の検査。tools/check-data.js と tools/check-data-dx.js が呼ぶ（G検定・DX・AIパスポートで同じ検査にするため、1つにまとめた）。
// 単独では動かさない。
//
// NG にするもの
//   - id が形式どおり（アプリごとに caller が渡す）で、重複しない
//   - term・oneLine・why が空でない文字列
//   - aliases（任意）が、空でない文字列の配列で、重複しない
//   - figures（任意）の各 ID に対応する SVG が data/figures/ に実在する（caller の checkFigureRefs が見る）
//   - notIn（任意）が、空でない文字列の配列（語を含む複合語。含まない・語そのものは WARN）
//   - related（任意）が文字列の配列で、各 ID が試験範囲のカードに実在する
// WARN にするもの（文中で見つけるときの働きが変わるが、アプリは動く）
//   - term・aliases が2字より短い（文中では見つけない。lib/basics.js の MIN_TERM_LEN）
//   - 同じ語が、別の語（または同じ語の別の呼び方）にもある（文中では先の語が勝つ）
//   - 語が、試験範囲のカードの title（括弧の前・中を含む）と同じ（文中では必ずカードが勝ち、印は付かない）
//   - oneLine が長すぎる（80字超。一言ではなくなる）
// 見ていないもの: 説明の正しさ・やさしさ・図の中身（人が読む）／語が実際の解説の文に出てくるか（出てこない語は、使われないだけ）
'use strict';

const MIN_TERM_LEN = 2; // shared/js/lib/basics.js の MIN_TERM_LEN と同じ（tests/basics.test.js が一致を確かめる）
const ONE_LINE_MAX = 80;

// shared/js/lib/basics.js の fold / titleForms と同じ（tests/basics.test.js が同じ結果を返すことを確かめる）
function fold(s) {
  const t = String(s == null ? '' : s);
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    const n = c.normalize('NFKC').toLowerCase();
    out += n.length === 1 ? n : c;
  }
  return out;
}
function titleForms(title) {
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
 * ctx: { file, data, idRe, idLabel, seen(Map id→ファイル名), conceptIndex(Map id→title), checkFigureRefs(f, id, figs), err(f, id, msg), warn(f, id, msg), isStr }
 */
function checkBasics(ctx) {
  const { file: f, data, idRe, idLabel, seen, conceptIndex, checkFigureRefs, err, warn, isStr } = ctx;
  const base = require('path').basename(f);
  const cardForms = new Map(); // 照合用の文字列 -> カードの title
  for (const t of conceptIndex.values()) for (const form of titleForms(t)) { const k = fold(form).trim(); if (k && !cardForms.has(k)) cardForms.set(k, t); }
  const forms = new Map(); // 照合用の文字列 -> 先に出てきた語の id
  data.forEach((o, idx) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) { err(f, `#${idx}`, '基礎のことばが辞書でない'); return; }
    const id = o.id ? o.id : `#${idx}`;
    if (!isStr(o.id) || !idRe.test(o.id)) err(f, id, `id が ${idLabel} 形式でない`);
    if (seen.has(id)) err(f, id, `id が重複（${seen.get(id)} にもある）`); else seen.set(id, base);
    for (const k of ['term', 'oneLine', 'why']) if (!isStr(o[k])) err(f, id, `${k} が無い`);
    if (isStr(o.oneLine) && o.oneLine.length > ONE_LINE_MAX) warn(f, id, `oneLine が長い（${o.oneLine.length}字。${ONE_LINE_MAX}字以内の一言にする。くわしくは why へ）`);
    let aliasOk = true;
    if ('aliases' in o) {
      if (!Array.isArray(o.aliases) || !o.aliases.every(isStr)) { err(f, id, 'aliases が空でない文字列の配列でない（無いなら欄ごと省く）'); aliasOk = false; }
      else if (new Set(o.aliases).size !== o.aliases.length) err(f, id, 'aliases に同じ語が重複している');
    }
    const words = [];
    if (isStr(o.term)) words.push(o.term);
    if (aliasOk && Array.isArray(o.aliases)) for (const a of o.aliases) if (isStr(a)) words.push(a);
    const mine = new Set();
    for (const w of words) {
      const k = fold(w).trim();
      if (k.length < MIN_TERM_LEN) { warn(f, id, `「${w}」は${MIN_TERM_LEN}字より短く、文中では見つけない`); continue; }
      if (mine.has(k)) { warn(f, id, `「${w}」が同じ語の中で重複している`); continue; }
      mine.add(k);
      if (forms.has(k) && forms.get(k) !== id) warn(f, id, `「${w}」が ${forms.get(k)} にもある（文中では先の ${forms.get(k)} が勝つ）`);
      else forms.set(k, id);
      if (cardForms.has(k)) warn(f, id, `「${w}」が試験範囲のカード「${cardForms.get(k)}」の title と同じ（文中ではカードが勝ち、印は付かない）`);
    }
    if ('notIn' in o) {
      if (!Array.isArray(o.notIn) || !o.notIn.every(isStr)) err(f, id, 'notIn が空でない文字列の配列でない（無いなら欄ごと省く）');
      else {
        const ks = words.map((w) => fold(w).trim()).filter((k) => k.length >= MIN_TERM_LEN);
        for (const n of o.notIn) {
          const nk = fold(n).trim();
          if (!ks.some((k) => nk.includes(k))) warn(f, id, `notIn の「${n}」が、この語（または別の呼び方）を含んでいない（意味がない）`);
          else if (ks.includes(nk)) warn(f, id, `notIn の「${n}」が語そのもの（その語に印が付かなくなる）`);
        }
      }
    }
    if ('related' in o) {
      if (!Array.isArray(o.related) || !o.related.every(isStr)) err(f, id, 'related が文字列（カードの ID）の配列でない');
      else {
        if (new Set(o.related).size !== o.related.length) err(f, id, 'related に同じ ID が重複している');
        o.related.forEach((r) => { if (!conceptIndex.has(r)) err(f, id, `related の ${r} が試験範囲のカードに無い`); });
      }
    }
    checkFigureRefs(f, id, o.figures);
  });
}

module.exports = { checkBasics, fold, titleForms, MIN_TERM_LEN, ONE_LINE_MAX };
