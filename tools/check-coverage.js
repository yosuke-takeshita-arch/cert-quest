#!/usr/bin/env node
// シラバスのキーワードが、問題・用語カードのどこかで扱われているかを数える
// 使い方: node tools/check-coverage.js <問題ファイル> <カードファイル> [...]
//   与えたファイルの syllabus が属する「章」（2段目）を対象に、その章のキーワード（章に置いたもの＋全小項目のもの）を照合する
//   照合先: カードの title / oneLine / why、問題の stem / choices / explanation
//   正規化: 空白・中黒以外の記号を除き、大文字小文字・全角半角を同一視
//   「A (B)」形式は A か B のどちらかが出れば扱い済み。「A・B」形式は A と B の両方が要る
// 見ていないもの: その語が「正しく」「十分に」扱われているか（語が出てくるかだけを見る）
'use strict';
const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);
if (!files.length) { console.error('使い方: node tools/check-coverage.js <files...>'); process.exit(2); }

const norm = (s) => String(s).normalize('NFKC').toLowerCase().replace(/[\s　（）()「」『』、。,.]/g, '');
const syl = JSON.parse(fs.readFileSync(path.join(path.dirname(path.dirname(path.resolve(files[0]))), 'syllabus.json'), 'utf8'));

let text = '';
const chapters = new Set();
for (const f of files) {
  for (const o of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    chapters.add(o.syllabus.slice(0, 2).join(' > '));
    text += [o.title, o.oneLine, o.why, o.stem, (o.choices || []).join(' '), o.explanation].filter(Boolean).join(' ');
  }
}
const T = norm(text);

function covered(kw) {
  const parts = kw.split('・').map((p) => p.trim()).filter(Boolean);
  const partsToCheck = parts.length > 1 && !/\(/.test(kw) ? parts : [kw];
  return partsToCheck.every((p) => {
    const m = p.normalize('NFKC').match(/^(.*?)\s*\((.*)\)\s*$/); // 全角の「（）」も（生成AIパスポートのシラバスは全角）
    const cands = m ? [p, m[1], m[2]] : [p];
    return cands.some((c) => norm(c) && T.includes(norm(c)));
  });
}

// キーワードの置き場はシラバスごとに違う。G検定は3段目（小項目）、生成AIパスポートは2段目（中項目。小項目の keywords は []）。
// 2段目と3段目の両方を読む（2026-10-13。それまでは3段目だけを読み、生成AIパスポートでは0件になっていた）
let total = 0; let miss = 0;
const report = (id, title, kws, label) => {
  const list = Array.isArray(kws) ? kws : [];
  if (!list.length) return;
  const missing = list.filter((k) => !covered(k));
  total += list.length; miss += missing.length;
  console.log(`${id} ${title}${label}: ${list.length - missing.length}/${list.length}${missing.length ? '  未: ' + missing.join(' / ') : ''}`);
};
for (const field of syl) for (const ch of field.children) {
  if (!chapters.has(`${field.title} > ${ch.title}`)) continue;
  report(ch.id, ch.title, ch.keywords, '（章・中項目）');
  for (const item of ch.children || []) report(item.id, item.title, item.keywords, '');
}
if (!total) { console.log('合計 0/0: 対象の章にキーワードが1つも無い（シラバスの置き場を読めていない）'); process.exit(1); }
console.log(`合計 ${total - miss}/${total}（未 ${miss}）`);
process.exit(miss ? 1 : 0);
