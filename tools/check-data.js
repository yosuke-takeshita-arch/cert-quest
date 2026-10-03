#!/usr/bin/env node
// cert-quest 問題・用語カードのデータ検査
// 使い方:
//   node tools/check-data.js <ファイル...>
//   node tools/check-data.js g-kentei/data/questions/01_ai-basics.json g-kentei/data/concepts/01_ai-basics.json
// オプション:
//   --syllabus <path>   シラバスの木（既定: 各ファイルの1つ上のディレクトリの syllabus.json）
//   --strict-links      他章のカードへのリンクが解決できないときも NG にする（既定は WARN）
//
// 判定するもの（要件定義書 §7）
//   - JSON として読めること・ルートが配列であること
//   - 問題: id, syllabus, format, difficulty, stem, choices, answer, explanation, whyWrong,
//           memoryTip, concepts, sources, status がそろっていること
//   - answer が choices の範囲内の整数で、whyWrong の null の位置が answer と一致し、
//     それ以外の whyWrong が空でない文字列であること
//   - 用語カード: id, syllabus, title, oneLine, why, links, confusions, sources, status
//   - syllabus のパスが syllabus.json の木に実在すること
//   - id の形式と重複、問題の concepts が実在するカードを指すこと
//   - sources が {title, url} で url が http(s) であること
//
// 見ていないもの: 内容の正しさ・出典URLが実際に開けるか・出典が答えの根拠を含むか
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let syllabusPath = null;
let strictLinks = false;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--syllabus') { syllabusPath = args[++i]; continue; }
  if (args[i] === '--strict-links') { strictLinks = true; continue; }
  files.push(args[i]);
}
if (files.length === 0) {
  console.error('使い方: node tools/check-data.js <ファイル...> [--syllabus path] [--strict-links]');
  process.exit(2);
}

const errors = [];
const warns = [];
const err = (f, id, msg) => errors.push(`NG ${path.basename(f)} ${id || '-'}: ${msg}`);
const warn = (f, id, msg) => warns.push(`WARN ${path.basename(f)} ${id || '-'}: ${msg}`);

function readJson(f) {
  const raw = fs.readFileSync(f, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) throw new Error('BOM が付いている');
  return JSON.parse(raw);
}

// ---- シラバスの木 ----
function loadSyllabusPaths(p) {
  const tree = readJson(p);
  const set = new Set();
  const walk = (nodes, trail) => {
    for (const n of nodes) {
      const t = trail.concat(n.title);
      set.add(t.join(' > '));
      if (Array.isArray(n.children)) walk(n.children, t);
    }
  };
  if (!Array.isArray(tree)) throw new Error('syllabus.json のルートが配列でない');
  walk(tree, []);
  return set;
}

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const QFMT = new Set(['single', 'not', 'fill', 'scenario']);
const STATUS = new Set(['verified', 'unverified']);

function checkSources(f, id, s) {
  if (!Array.isArray(s) || s.length === 0) { err(f, id, 'sources が空'); return; }
  s.forEach((x, i) => {
    if (!x || !isStr(x.title)) err(f, id, `sources[${i}].title が無い`);
    if (!x || !isStr(x.url) || !/^https?:\/\/\S+$/.test(x.url)) err(f, id, `sources[${i}].url が http(s) でない`);
  });
}

function checkSyllabus(f, id, syl, sylSet) {
  if (!Array.isArray(syl) || syl.length < 2 || !syl.every(isStr)) { err(f, id, 'syllabus が文字列の配列でない'); return; }
  if (sylSet && !sylSet.has(syl.join(' > '))) err(f, id, `syllabus のパスが木に無い: ${syl.join(' > ')}`);
}

function kindOf(f, data) {
  if (/[\\/]questions[\\/]/.test(f)) return 'questions';
  if (/[\\/]concepts[\\/]/.test(f)) return 'concepts';
  if (data.length && 'stem' in data[0]) return 'questions';
  return 'concepts';
}

const loaded = []; // {file, kind, data}
const sylCache = {};
for (const f of files) {
  let data;
  try { data = readJson(f); } catch (e) { err(f, null, `JSON として読めない: ${e.message}`); continue; }
  if (!Array.isArray(data)) { err(f, null, 'ルートが配列でない'); continue; }
  const sp = syllabusPath || path.join(path.dirname(path.dirname(path.resolve(f))), 'syllabus.json');
  if (!(sp in sylCache)) {
    try { sylCache[sp] = loadSyllabusPaths(sp); } catch (e) { sylCache[sp] = null; warn(f, null, `syllabus.json を読めない（パス照合を飛ばす）: ${e.message}`); }
  }
  loaded.push({ file: f, kind: kindOf(f, data), data, syl: sylCache[sp] });
}

// 他章も含めたカード索引（同じ data ディレクトリの concepts/*.json を全部読む）
const conceptIndex = new Map(); // id -> title
const conceptTitles = new Map(); // title -> id
const dirs = new Set(loaded.map((l) => path.join(path.dirname(path.dirname(path.resolve(l.file))), 'concepts')));
for (const d of dirs) {
  if (!fs.existsSync(d)) continue;
  for (const fn of fs.readdirSync(d).filter((x) => x.endsWith('.json'))) {
    try {
      const arr = readJson(path.join(d, fn));
      if (Array.isArray(arr)) for (const c of arr) if (c && c.id) { conceptIndex.set(c.id, c.title); if (c.title) conceptTitles.set(c.title, c.id); }
    } catch (_) { /* 読めないファイルは自分の検査で NG になる */ }
  }
}

const seen = new Map();
for (const { file: f, kind, data, syl } of loaded) {
  data.forEach((o, idx) => {
    const id = o && o.id ? o.id : `#${idx}`;
    if (seen.has(id)) err(f, id, `id が重複（${seen.get(id)} にもある）`); else seen.set(id, path.basename(f));
    if (kind === 'questions') {
      if (!/^G-\d{2}-\d{3}$/.test(id)) err(f, id, 'id が G-NN-NNN 形式でない');
      checkSyllabus(f, id, o.syllabus, syl);
      if (!QFMT.has(o.format)) err(f, id, `format が不正: ${o.format}`);
      if (!Number.isInteger(o.difficulty) || o.difficulty < 1 || o.difficulty > 5) err(f, id, 'difficulty が 1〜5 の整数でない');
      if (!isStr(o.stem)) err(f, id, 'stem が無い');
      if (!Array.isArray(o.choices) || o.choices.length < 2 || !o.choices.every(isStr)) { err(f, id, 'choices が2つ以上の文字列配列でない'); return; }
      if (new Set(o.choices).size !== o.choices.length) err(f, id, 'choices に同じ文字列がある');
      if (!Number.isInteger(o.answer) || o.answer < 0 || o.answer >= o.choices.length) err(f, id, `answer が範囲外: ${o.answer}`);
      if (!isStr(o.explanation)) err(f, id, 'explanation が無い');
      if (!Array.isArray(o.whyWrong) || o.whyWrong.length !== o.choices.length) err(f, id, 'whyWrong の長さが choices と違う');
      else o.whyWrong.forEach((w, i) => {
        if (i === o.answer) { if (w !== null) err(f, id, `whyWrong[${i}] は正解位置なので null であるべき`); }
        else if (!isStr(w)) err(f, id, `whyWrong[${i}] が空（null は正解位置 ${o.answer} だけ）`);
      });
      if (!isStr(o.memoryTip)) err(f, id, 'memoryTip が無い');
      if (!Array.isArray(o.concepts) || o.concepts.length === 0) err(f, id, 'concepts が空');
      else o.concepts.forEach((c) => { if (!conceptIndex.has(c)) err(f, id, `concepts の ${c} が用語カードに無い`); });
      if (o.format === 'fill' && !/（\s*）|\(\s*\)|【\s*】|＿|（[ア-ンあ-ん]）/.test(o.stem)) warn(f, id, 'fill なのに問題文に空欄の印が無い');
      if (o.format === 'not' && !/不適切|適切でない|誤っている|誤り/.test(o.stem)) warn(f, id, 'not なのに問題文に「不適切」等が無い');
    } else {
      if (!/^C-\d{2}-\d{3}$/.test(id)) err(f, id, 'id が C-NN-NNN 形式でない');
      checkSyllabus(f, id, o.syllabus, syl);
      for (const k of ['title', 'oneLine', 'why']) if (!isStr(o[k])) err(f, id, `${k} が無い`);
      for (const k of ['links', 'confusions']) if (!Array.isArray(o[k])) err(f, id, `${k} が配列でない`);
      (o.links || []).forEach((l, i) => {
        if (!l || !(isStr(l.id) || isStr(l.title))) err(f, id, `links[${i}] に id も title も無い`);
        if (!l || !isStr(l.relation)) err(f, id, `links[${i}].relation が無い`);
        if (l && isStr(l.id) && !conceptIndex.has(l.id)) (strictLinks ? err : warn)(f, id, `links[${i}].id ${l.id} が見つからない`);
        if (l && !isStr(l.id) && isStr(l.title) && !conceptTitles.has(l.title)) (strictLinks ? err : warn)(f, id, `links[${i}].title「${l.title}」が未解決（他章の担当待ちなら可）`);
        if (l && l.id === id) err(f, id, 'links が自分自身を指している');
      });
      (o.confusions || []).forEach((c, i) => {
        if (!c || !(isStr(c.id) || isStr(c.title))) err(f, id, `confusions[${i}] に id も title も無い`);
        if (!c || !isStr(c.point)) err(f, id, `confusions[${i}].point が無い`);
        if (c && isStr(c.id) && !conceptIndex.has(c.id)) (strictLinks ? err : warn)(f, id, `confusions[${i}].id ${c.id} が見つからない`);
        if (c && c.id === id) err(f, id, 'confusions が自分自身を指している');
      });
    }
    checkSources(f, id, o.sources);
    if (!STATUS.has(o.status)) err(f, id, `status が不正: ${o.status}`);
  });
}

// 集計
for (const { file: f, kind, data } of loaded) {
  const v = data.filter((o) => o.status === 'verified').length;
  console.log(`${path.basename(path.dirname(f))}/${path.basename(f)}: ${kind} ${data.length}件（verified ${v} / unverified ${data.length - v}）`);
}
warns.forEach((w) => console.log(w));
errors.forEach((e) => console.log(e));
console.log(errors.length ? `結果: NG ${errors.length}件` : '結果: OK');
process.exit(errors.length ? 1 : 0);
