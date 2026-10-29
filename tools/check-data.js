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
//     （形は資格ごと。G検定 G-NN-NNN／C-NN-NNN、生成AIパスポート AP-NN-NNN／C-AP-NN-NNN。下の ID_FORMS）
//   - stemPlain（任意）が、空でない文字列・200文字以内・問題文と別の文であること（要件定義書 §7-3）
//   - pastExam（任意。過去問題の出典。要件定義書 §7・§12）が、year・period・exam・part（空でない文字）・no（1〜25の整数）・modified（true／false）の6つだけで、同じ出典がアプリの中で2回無いこと。
//     同じ過去問題が複数の試験に出ていれば1問にまとめ、pastExam を配列にして出典を並べる（1つならオブジェクト1つでもよい）。数えるのは出典ではなく問題。
//     PAST 行に過去問題とオリジナルの数を出し、オリジナルが過去問題以下なら WARN（決まりは『オリジナルのほうが多い』）
//   - sources が {title, url} で url が http(s) であること
//   - figures（任意）の各 ID に対応する data/figures/<ID>.svg が実在すること。data/figures/ の SVG は、script・外部参照などの禁止事項が無く、
//     viewBox の幅が 360 以下で、role="img"・<title>・<desc> を持つこと（要件定義書 §7-2）
//   - 基礎のことば（data/basics.json。要件定義書 §7-5）: id・term・oneLine・why・aliases・related・figures。決まりは tools/check-basics.cjs の冒頭（G検定・DX・AIパスポートで同じ検査）
//   - 正解の長さの偏り（WARN）: 正解が最も長い誤答の2倍以上の問題／全体で正解がいちばん長い問題が40%を超えること
//
// 選択肢の語の偏り（WARN のみ。2026-10-06 追加。下の CUE_WORDS。tools/check-data-dx.js の checkCueWords と同じ判定・同じ語の一覧）
//   format を問わず、誤答が2つ以上ある全問題で、CUE_WORDS の語ごとに次のどちらかなら WARN（ID と語を出す）。CUE 行に件数を出す
//   - 誤答のすべてに含まれ、正解には含まれない（例: 誤答3つだけが「ただし」で要素を崩す）
//   - 正解にだけ含まれ、誤答のどれにも含まれない（例: format が not の問題で、正解＝不適切な文だけが「必ず」「一切」と言い切る）
//   見ていないもの: 一覧に無い語（言い換えれば素通りする）・意味（否定の「だけでは足りない」も「だけ」として数える）・
//   語が出る位置（文頭の「ただし」も文中も同じに数える）・誤答の一部だけに偏る形（4択のうち2つだけ等）・選択肢以外の欄（問題文と正解の語の重なりは見ない）
//   （語の一覧と判定は DX 版の写し。片方を直したら、もう片方も直す。検査が別ファイルの実行スクリプトなので、共有の部品にはしていない）
//
// 部分ごとの多数決（WARN のみ。2026-10-21 追加。下の checkSegMajority。tools/check-data-dx.js と同じ判定）
//   combo 以外の問題で、選択肢を部分に分け、違いのある部分が2つ以上あり、そのすべてで正解の言い方がほかより多く出るなら WARN（SEG-MAJORITY）。SEG 行に件数を出す
//   見ていないものは checkSegMajority の前のコメント
//
// 見ていないもの: 内容の正しさ・出典URLが実際に開けるか・出典が答えの根拠を含むか
'use strict';

const fs = require('fs');
const path = require('path');
const { checkBasics } = require('./check-basics.cjs'); // 基礎のことば（data/basics.json）の検査。G検定・DX・AIパスポートで共通

const args = process.argv.slice(2);
let syllabusPath = null;
let strictLinks = false;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--syllabus') { syllabusPath = args[++i]; continue; }
  if (args[i] === '--strict-links') { strictLinks = true; continue; }
  files.push(args[i]);
}
// アプリの basics.json（基礎のことば）は、その data/ の問題・カードを渡したときに自動で一緒に検査する（渡し忘れを防ぐ）
for (const f of files.slice()) {
  const b = path.join(path.dirname(path.dirname(path.resolve(f))), 'basics.json');
  if (!/basics[.]json$/.test(f) && fs.existsSync(b) && !files.some((x) => path.resolve(x) === b)) files.push(b);
}
if (files.length === 0) {
  console.error('使い方: node tools/check-data.js <ファイル...> [--syllabus path] [--strict-links]');
  process.exit(2);
}

const errors = [];
const warns = [];
const err = (f, id, msg) => errors.push(`NG ${path.basename(f)} ${id || '-'}: ${msg}`);
const warn = (f, id, msg) => warns.push(`WARN ${path.basename(f)} ${id || '-'}: ${msg}`);

// 基礎のことば（<アプリ>/data/basics.json。要件定義書 §7-5）は data/ の直下にある（問題・カードは data/questions/・data/concepts/ の下）
const isBasicsFile = (f) => /(^|[\\/])basics\.json$/.test(f);
const dataRootOf = (f) => (isBasicsFile(f) ? path.dirname(path.resolve(f)) : path.dirname(path.dirname(path.resolve(f))));

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
const QFMT = new Set(['single', 'not', 'fill', 'scenario', 'combo']);
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
  if (isBasicsFile(f)) { loaded.push({ file: f, kind: 'basics', data, syl: null }); continue; } // 基礎のことばは試験範囲の外。シラバスの木とは照合しない
  const sp = syllabusPath || path.join(path.dirname(path.dirname(path.resolve(f))), 'syllabus.json');
  if (!(sp in sylCache)) {
    try { sylCache[sp] = loadSyllabusPaths(sp); } catch (e) { sylCache[sp] = null; warn(f, null, `syllabus.json を読めない（パス照合を飛ばす）: ${e.message}`); }
  }
  loaded.push({ file: f, kind: kindOf(f, data), data, syl: sylCache[sp] });
}

// 他章も含めたカード索引（同じ data ディレクトリの concepts/*.json を全部読む）
const conceptIndex = new Map(); // id -> title
const conceptTitles = new Map(); // title -> id
const dirs = new Set(loaded.map((l) => path.join(dataRootOf(l.file), 'concepts')));
for (const d of dirs) {
  if (!fs.existsSync(d)) continue;
  for (const fn of fs.readdirSync(d).filter((x) => x.endsWith('.json'))) {
    try {
      const arr = readJson(path.join(d, fn));
      if (Array.isArray(arr)) for (const c of arr) if (c && c.id) { conceptIndex.set(c.id, c.title); if (c.title) conceptTitles.set(c.title, c.id); }
    } catch (_) { /* 読めないファイルは自分の検査で NG になる */ }
  }
}

// ---- 図（要件定義書 §7-2）----
// figures の ID に対応する data/figures/<ID>.svg が実在すること。data/figures/ の SVG すべてが、禁止事項（script・外部参照など）を含まず、
// viewBox の幅が 360 以下で、role="img" と <title>・<desc> を持つこと。どこからも使われない SVG は警告。
// （SVG の禁止事項は shared/js/lib/figures.js の svgProblems と同じにしてある。片方を直したら、もう片方も直す）
const FIGURE_ID_RE = /^fig-[a-z0-9]+(?:-[a-z0-9]+)*$/;
function svgProblems(text) {
  const p = [];
  if (!/<svg[\s>]/i.test(text)) p.push('<svg> が無い');
  if (/<script[\s>\/]/i.test(text)) p.push('<script> がある');
  if (/<foreignObject[\s>\/]/i.test(text)) p.push('<foreignObject> がある');
  if (/<style[\s>\/]/i.test(text)) p.push('<style> がある（色は共通CSSのクラスで付ける）');
  if (/\sstyle\s*=/i.test(text)) p.push('style 属性がある（色は共通CSSのクラスで付ける）');
  if (/<image[\s>\/]/i.test(text)) p.push('<image> がある');
  if (/\son[a-z]+\s*=/i.test(text)) p.push('イベント属性（onclick など）がある');
  for (const m of text.match(/\s(?:xlink:)?href\s*=\s*("[^"]*"|'[^']*')/gi) || []) {
    const v = m.replace(/^[^=]*=\s*/, '').slice(1, -1).trim();
    if (!v.startsWith('#')) p.push('# で始まらない href がある: ' + v.slice(0, 40));
  }
  if (/\s(?:xlink:)?href\s*=\s*[^"'\s>]/i.test(text)) p.push('引用符の無い href がある');
  if (/url\(\s*(?!["']?\s*#)/i.test(text)) p.push('url() が # 以外を指している');
  if (/javascript:/i.test(text)) p.push('javascript: がある');
  if (/\bdata:/i.test(text)) p.push('data: がある');
  if (/@import/i.test(text)) p.push('@import がある');
  if (/(?:https?:)?\/\/[a-z0-9]/i.test(text.replace(/\sxmlns(?::[a-z]+)?\s*=\s*"http:\/\/www\.w3\.org\/[^"]*"/gi, ''))) p.push('外部のURL（http など）がある');
  return p;
}
// XML として読めるか（2026-10-12、fig-g-fasttext に生の < が入り、HTML に埋めた表示では見えるのに .svg 単体では読めなかった）。
// 完全な XML の解析はせず、よく起きる2つだけを見る: タグの外に生の < がある／& が文字参照になっていない。
// 画面の svgProblems（shared/js/lib/figures.js）とは別の関数にしてある（こちらは検査だけ）。
function xmlProblems(text) {
  const p = [];
  const body = text.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '').replace(/<\?[\s\S]*?\?>/g, '');
  const rest = body.replace(/<\/?[A-Za-z][^<>]*>/g, '');
  const lt = rest.indexOf('<');
  if (lt >= 0) p.push('タグの外に生の < がある（&lt; と書く）: ' + rest.slice(lt, lt + 30));
  const amp = /&(?!(?:[A-Za-z][A-Za-z0-9]*|#[0-9]+|#x[0-9A-Fa-f]+);)/.exec(body);
  if (amp) p.push('文字参照になっていない & がある（&amp; と書く）: ' + body.slice(amp.index, amp.index + 30));
  return p;
}
const figDirOf = (f) => path.join(dataRootOf(f), 'figures');
const figUsed = new Map(); // figures ディレクトリ -> 使われた ID の集合
function checkFigureRefs(f, id, figs, key = 'figures') { // key は欄の名前（figures ＝ 答えた後の解説の図、stemFigures ＝ 答える前に問題文の下へ出す図。どちらも同じ検査）
  if (figs === undefined) return;
  if (!Array.isArray(figs)) { err(f, id, `${key} が配列でない`); return; }
  const dir = figDirOf(f);
  if (!figUsed.has(dir)) figUsed.set(dir, new Set());
  figs.forEach((x, i) => {
    if (typeof x !== 'string' || !FIGURE_ID_RE.test(x)) { err(f, id, `${key}[${i}] が図の ID の形式（fig-英小文字・数字・ハイフン）でない`); return; }
    if (figs.indexOf(x) !== i) err(f, id, `${key} に ${x} が重複している`);
    figUsed.get(dir).add(x);
    if (!fs.existsSync(path.join(dir, x + '.svg'))) err(f, id, `${key} の ${x} に対応する SVG が無い（${path.join(path.basename(path.dirname(dir)), 'figures', x + '.svg')}）`);
  });
}
function checkFigureFiles() {
  for (const dir of new Set([...dirs].map((d) => path.join(path.dirname(d), 'figures')).concat([...figUsed.keys()]))) {
    if (!fs.existsSync(dir)) continue;
    for (const fn of fs.readdirSync(dir).filter((x) => x.endsWith('.svg'))) {
      const id = fn.replace(/\.svg$/, '');
      const text = fs.readFileSync(path.join(dir, fn), 'utf8');
      if (!FIGURE_ID_RE.test(id)) err(fn, id, 'SVG のファイル名が図の ID の形式でない');
      for (const m of svgProblems(text)) err(fn, id, m);
      for (const m of xmlProblems(text)) err(fn, id, m);
      const vb = /<svg[^>]*\sviewBox\s*=\s*"\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([-\d.]+)[\s,]+[-\d.]+\s*"/i.exec(text);
      if (!vb) err(fn, id, 'viewBox が無い');
      else if (Number(vb[1]) > 360) err(fn, id, `viewBox の幅が 360 を超える: ${vb[1]}`);
      const root = (/<svg[^>]*>/i.exec(text) || [''])[0];
      if (!/\srole\s*=\s*"img"/.test(root)) err(fn, id, '<svg> に role="img" が無い');
      if (!/<title[\s>]/i.test(text)) err(fn, id, '<title> が無い');
      if (!/<desc[\s>]/i.test(text)) err(fn, id, '<desc> が無い');
      if (!/\saria-labelledby\s*=\s*"[^"]+"/.test(root)) err(fn, id, '<svg> に aria-labelledby が無い');
      if (!(figUsed.get(dir) || new Set()).has(id)) warn(fn, id, 'どのカード・問題の figures・stemFigures からも使われていない');
    }
  }
}

// 任意の欄 stemPlain（問題文を専門用語を使わずに言い直した文。要件定義書 §7-3。回答後の解説に出すので、選択肢の文を含んでもよい）。
const STEM_PLAIN_MAX = 200;
const nfkc = (s) => String(s).normalize('NFKC').replace(/\s/g, '').toLowerCase();
// 選択肢は画面で並び替えて出す（scenario を除く）。解説で「3つ目の文」「選択肢B」のように位置で指すと、
// 画面の並びと合わず、どの文のことか分からない（2026-10-16、G-05-073 で先生が気づいた。24問あった）。
// 位置ではなく『正解の文』や文の中身で指す。
const POSITION_REF = /[1-4１-４一二三四]つ目の(文|選択肢)|[1-4１-４]番目の(文|選択肢)|選択肢\s*[A-DＡ-Ｄ1-4１-４]|(^|。)[1-4１-４]つ目は/;
function checkChoicePositionRefs(f, id, o) {
  if (o.format === 'scenario') return;
  const texts = [['explanation', o.explanation], ['memoryTip', o.memoryTip], ...(o.whyWrong || []).map((w, i) => [`whyWrong[${i}]`, w])];
  for (const [k, s] of texts) {
    const m = isStr(s) && POSITION_REF.exec(s);
    if (m) err(f, id, `${k} が選択肢を位置で指している（「${m[0]}」）。選択肢は並び替えて出すので、文の中身で指す`);
  }
}

function checkStemPlain(f, id, o) {
  if (!('stemPlain' in o)) return;
  const sp = o.stemPlain;
  if (!isStr(sp)) { err(f, id, 'stemPlain が空・文字列でない（無いなら欄ごと省く）'); return; }
  if (sp !== sp.trim()) err(f, id, 'stemPlain の前後に空白・改行がある');
  if (sp.length > STEM_PLAIN_MAX) err(f, id, `stemPlain が長すぎる（${sp.length} 文字。上限 ${STEM_PLAIN_MAX}）`);
  if (nfkc(sp) === nfkc(o.stem || '')) err(f, id, 'stemPlain が問題文と同じ（言い直しになっていない）');
}

// 正解の長さの偏り。正解だけが目立って長いと、中身を知らなくても長いものを選べば当たる。
// 1問ごとに、正解が最も長い誤答の LEN_RATIO_WARN 倍以上なら WARN。
// ファイルごと・全体で「正解がいちばん長い問題」の割合を出し、全体で LONGEST_SHARE_WARN を超えたら WARN（4択の偶然なら 25%）。
// （tools/check-data-dx.js の checkAnswerLength と同じ。片方を直したら、もう片方も直す）
const LEN_RATIO_WARN = 2;
const LONGEST_SHARE_WARN = 0.4;
const lenStats = new Map(); // ファイル名 -> { n, longest }
function checkAnswerLength(f, id, o) {
  if (!Array.isArray(o.choices) || !Number.isInteger(o.answer) || o.answer < 0 || o.answer >= o.choices.length) return;
  const L = o.choices.map((c) => String(c).length);
  const others = L.filter((_, i) => i !== o.answer);
  if (!others.length) return;
  const maxWrong = Math.max(...others);
  const key = path.basename(f);
  if (!lenStats.has(key)) lenStats.set(key, { n: 0, longest: 0 });
  const st = lenStats.get(key);
  st.n++;
  if (L[o.answer] > maxWrong) st.longest++;
  if (maxWrong > 0 && L[o.answer] >= LEN_RATIO_WARN * maxWrong) warn(f, id, `正解（${L[o.answer]}字）が最も長い誤答（${maxWrong}字）の ${LEN_RATIO_WARN} 倍以上。長さだけで正解が分かる`);
}

// 選択肢の語の偏り（2026-10-06 追加。tools/check-data-dx.js の CUE_WORDS・checkCueWords の写し。片方を直したら、もう片方も直す）。
// 但し書き・限定・対比・言い切りの短い語。部分一致で見る（正規表現。表記ゆれは列挙したものだけ）。
// 誤検出を潰すための除外: 「だけでなく／だけではなく」（限定ではなく追加）、「どれだけ／それだけ／これだけ／同じだけ」（量の言い方）、
// 「異常に／非常に／正常に／日常に／通常に」（「常に」を含む別の語）
const CUE_WORDS = [
  /ただし/, /しかし/, /のみ/, /(?<!どれ|それ|これ|同じ)だけ(?!でなく|ではなく)/, /ではなく/, /一方で/,
  /必ず/, /(?<!異|非|正|日|通)常に/, /すべて|全て/, /まったく|全く/, /一切/,
];
// COMBO-MODE: 組み合わせ問題で、どの欄でも正解の語がほかのどの語より多く出ていたらエラー（2026-10-18、先生が実機で気づいた。
// 誤答を「正解から1欄だけ変えたもの」で作ると、各欄でいちばん多く出る語を選ぶだけで正解できる。同数はよい）
const COMBO_MARK = /（([ア-ン])）/g;
function splitComboChoice(choice) {
  const parts = {};
  const idx = [];
  let m;
  COMBO_MARK.lastIndex = 0;
  while ((m = COMBO_MARK.exec(choice))) idx.push([m[1], m.index, m.index + m[0].length]);
  idx.forEach(([k, , end], i) => {
    const stop = i + 1 < idx.length ? idx[i + 1][1] : choice.length;
    parts[k] = choice.slice(end, stop).trim();
  });
  return parts;
}
function checkComboMode(f, id, o) {
  if (!Array.isArray(o.choices) || !o.choices.every(isStr) || !Number.isInteger(o.answer) || o.answer < 0 || o.answer >= o.choices.length) return;
  const sp = o.choices.map(splitComboChoice);
  const ans = sp[o.answer];
  const keys = Object.keys(ans);
  if (!sp.every((p) => keys.every((k) => k in p))) { err(f, id, 'COMBO-MODE: combo の選択肢で欄（ア）（イ）…の並びがそろっていない'); return; }
  const leak = keys.filter((k) => {
    const c = {};
    sp.forEach((p) => (c[p[k]] = (c[p[k]] || 0) + 1));
    return Object.keys(c).every((v) => v === ans[k] || c[v] < c[ans[k]]);
  });
  if (leak.length) err(f, id, `COMBO-MODE: 欄 ${leak.map((k) => `（${k}）`).join('')} で正解の語がいちばん多く出る（各欄の最多の語を選ぶと正解できる。正解の語の回数をほかの語以下にする）`);
}
// SEG-MAJORITY（WARN のみ。2026-10-21 追加。tools/check-data-dx.js の写し。片方を直したら、もう片方も直す）
// COMBO-MODE と同じ型を、組み合わせ以外の文の選択肢（single・not・scenario・fill）で見る。
// 誤答3つがどれも正解の文を1か所だけ書き換えた形だと、どの部分でも正解の言い方が4つ中3回出て、
// 部分ごとに多数派の言い方を選べば中身を知らなくても正解に当たる（実例 D-01-125。2026-10-21 の点検で3アプリの誤答を並べ直した）。
// 判定:
//   1. 選択肢を SEG_SPLIT（→ ⇒ 。 、 ， ； ／ 全角の空白）で部分に分ける。比べる前に NFKC にし、空白・括弧・中黒を除く
//   2. 正解の部分ごとに、誤答の同じ部分を決める。4つとも部分の数が同じなら位置で並べる（並べ替えの問題も位置で比べる）。
//      数が違うときは、同じ部分の最長の並び（LCS）で対応を取り、対応しなかった正解の部分は、前後の対応した部分のあいだにある誤答の部分すべてと比べる
//   3. 部分ごとに「正解と同じ言い方の数（正解を含む）」と「ほかの言い方でいちばん多い数」を比べる。
//      誤答どうしの言い方は、あいだの部分を1つでも共有していれば同じ言い方として数える（数え上げを多めにして、誤検出を減らす側に倒す）
//   4. 4つとも同じ部分は数えない。違いのある部分が2つ以上あり、そのすべてで正解の言い方がほかより多い（同数はよい）なら WARN
// 「ほぼ同じ言い回し」: 正規化した文字列が同じか、ひらがなを除いた文字列と打ち消しの語（ない・なく・ず・ぬ・ません）の数が同じなら同じ言い方とする
//   （「IT投資が非効率になり」と「IT投資は非効率になるが」は同じ。「できる」と「できない」・「α」と「β」・「1㎡」と「10㎡」は別）。
// 見ていないもの:
//   - 区切りの無い文（1つの部分にしかならない文。語の差し替えだけの選択肢）。区切りの記号の無い所で言い換えた部分（「〜ので」「〜ため」でつないだ1文の中）
//   - 言い回しが違うが意味が同じもの（「ランタイムが読める形」と「各機器のランタイムが読める形」は別の言い方と数える）。漢字やカタカナが1字でも違えば別の言い方
//   - 同数で止まるが、大半の部分で正解が多数派の形（例: 4つの部分のうち3つで正解が多数派、1つは正解だけ）。ほかの3つと最も似た選択肢が正解、という似ている度合いの偏り
//   - 部分の数が違う選択肢の対応の取り違え（LCS は同じ言い方の部分だけを手がかりにする）
//   - combo と、選択肢が「（ア）〇〇　（イ）△△」の組の問題（COMBO-MODE が見る）
const SEG_SPLIT = /→|⇒|。|、|，|；|／|　/;
const SEG_NEG = /ない|なく|ず|ぬ|ません/g;
const segNorm = (s) => String(s).normalize('NFKC').replace(/[\s「」『』（）()・。、，]/g, '');
const segKey = (s) => s.replace(/[ぁ-ゖ]/g, '') + '#' + (s.match(SEG_NEG) || []).length;
const segSame = (a, b) => a === b || segKey(a) === segKey(b);
const segsOf = (c) => String(c).split(SEG_SPLIT).map(segNorm).filter((x) => x.length > 0);
function segAlign(A, D) {
  // 正解の部分 A[i] ごとに { kept: 同じ言い方の部分が対応した } か { kept: false, span: 対応先の候補の誤答の部分 } を返す
  if (A.length === D.length) return A.map((a, i) => (segSame(a, D[i]) ? { kept: true } : { kept: false, span: [D[i]] }));
  const n = A.length; const m = D.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = segSame(A[i], D[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const map = new Array(n).fill(-1);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (segSame(A[i], D[j]) && L[i][j] === L[i + 1][j + 1] + 1) { map[i] = j; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  return map.map((v, k) => {
    if (v >= 0) return { kept: true };
    let lo = -1; for (let x = k - 1; x >= 0; x--) if (map[x] >= 0) { lo = map[x]; break; }
    let hi = m; for (let x = k + 1; x < n; x++) if (map[x] >= 0) { hi = map[x]; break; }
    return { kept: false, span: D.slice(lo + 1, hi) };
  });
}
const segStats = { n: 0, flagged: 0 };
function checkSegMajority(f, id, o) {
  if (!Array.isArray(o.choices) || o.choices.length < 3 || !o.choices.every(isStr) || !Number.isInteger(o.answer) || o.answer < 0 || o.answer >= o.choices.length) return;
  segStats.n++;
  const all = o.choices.map(segsOf);
  const A = all[o.answer];
  if (A.length < 2) return;
  const others = all.filter((_, i) => i !== o.answer).map((D) => segAlign(A, D));
  const meet = (x, y) => (x.length === 0 && y.length === 0) || x.some((a) => y.some((b) => segSame(a, b)));
  let informative = 0;
  for (let i = 0; i < A.length; i++) {
    const kept = others.filter((r) => r[i].kept).length;
    if (kept === others.length) continue;
    informative++;
    const spans = others.filter((r) => !r[i].kept).map((r) => r[i].span);
    let rival = 0;
    for (const s of spans) rival = Math.max(rival, spans.filter((x) => meet(x, s)).length);
    if (1 + kept <= rival) return;
  }
  if (informative < 2) return;
  segStats.flagged++;
  warn(f, id, `SEG-MAJORITY: 違いのある部分 ${informative} か所のどれでも、正解の言い方がほかの言い方より多く出る（部分ごとに多数派を選ぶと正解できる。部分ごとに正解の言い方の回数をほかの言い方以下にする。3つの部分なら誤答を abb・bab・bba）`);
}
const cueStats = { n: 0, flagged: 0 };
function checkCueWords(f, id, o) {
  if (!Array.isArray(o.choices) || !Number.isInteger(o.answer) || o.answer < 0 || o.answer >= o.choices.length) return;
  const right = String(o.choices[o.answer]);
  const wrongs = o.choices.filter((_, i) => i !== o.answer).map(String);
  if (wrongs.length < 2) return;
  cueStats.n++;
  const reasons = [];
  for (const re of CUE_WORDS) {
    const inRight = re.test(right);
    const inWrong = wrongs.map((w) => re.test(w));
    if (!inRight && inWrong.every(Boolean)) reasons.push(`「${wrongs[0].match(re)[0]}」が誤答のすべてにあり、正解に無い`);
    else if (inRight && !inWrong.some(Boolean)) reasons.push(`「${right.match(re)[0]}」が正解にだけあり、誤答のどれにも無い`);
  }
  if (!reasons.length) return;
  cueStats.flagged++;
  warn(f, id, `cue: ${reasons.join('。')}。語だけで正解が選べる（同じ語を正解と誤答の両方に使うか、どちらからも外し、別の書き方で1点だけ違える）`);
}

// id の形は資格ごとに決める（2026-10-13 生成AIパスポートを足した）。data ディレクトリの1つ上のフォルダ名（アプリの id）で引く。
// 一覧に無いフォルダ（g-kentei や、テストが作る一時ディレクトリ）は G検定の形。
// 生成AIパスポートを G- にしないのは、誤りの報告（shared/js/lib/report.js）の件名に id がそのまま出て、G検定の問題と見分けにくくなるため。
const ID_FORMS = {
  'ai-passport': { q: /^AP-\d{2}-\d{3}$/, qLabel: 'AP-NN-NNN', c: /^C-AP-\d{2}-\d{3}$/, cLabel: 'C-AP-NN-NNN', b: /^B-AP-\d{3}$/, bLabel: 'B-AP-NNN' },
  // 情報処理安全確保支援士のアプリ（2026-10-29。アプリの id は sc）。過去問題も同じ形の id（出典は pastExam に持つ）
  'sc': { q: /^SC-\d{2}-\d{3}$/, qLabel: 'SC-NN-NNN', c: /^C-SC-\d{2}-\d{3}$/, cLabel: 'C-SC-NN-NNN', b: /^B-SC-\d{3}$/, bLabel: 'B-SC-NNN' },
};
const ID_DEFAULT = { q: /^G-\d{2}-\d{3}$/, qLabel: 'G-NN-NNN', c: /^C-\d{2}-\d{3}$/, cLabel: 'C-NN-NNN', b: /^B-\d{3}$/, bLabel: 'B-NNN' };
const idFormOf = (f) => ID_FORMS[path.basename(path.dirname(dataRootOf(f)))] || ID_DEFAULT;

// 過去問題の出典（任意の欄 pastExam。要件定義書 §7・§12）。出す欄は5つ＋改変の有無がそろっていること。問番号は 1〜25。
// 同じ過去問題（年度・期・試験区分・時間区分・問番号が同じ）を2回載せない。期の名前（春期・秋期・10月）は年度で違うので、書いた文字をそのまま見る。
const PAST_EXAM_KEYS = ['year', 'period', 'exam', 'part', 'no', 'modified'];
const PAST_EXAM_NO_MAX = 25; // shared/js/lib/pastexam.js の PAST_EXAM_NO_MAX と同じ値（片方を直したら、もう片方も直す）
const pastSeen = new Map(); // 出典の文字 -> id
const pastStats = new Map(); // 問題ファイルのあるアプリのフォルダ -> { past, original }
function checkPastExam(f, id, o) {
  const dir = path.dirname(dataRootOf(f)) + '|' + path.basename(path.dirname(dataRootOf(f)));
  if (!pastStats.has(dir)) pastStats.set(dir, { app: path.basename(path.dirname(dataRootOf(f))), past: 0, original: 0 });
  const st = pastStats.get(dir);
  if (!('pastExam' in o)) { st.original++; return; }
  st.past++;
  // 1つの過去問題が複数の試験に出ていれば、出典は配列で書く（1つなら、オブジェクト1つでもよい）。1問は1回だけ数える
  const list = Array.isArray(o.pastExam) ? o.pastExam : [o.pastExam];
  if (Array.isArray(o.pastExam) && !list.length) { err(f, id, 'pastExam が空の配列（出典を1つ以上書く）'); return; }
  const inThis = new Set();
  for (const p of list) {
    checkOnePastExam(f, id, p);
    if (p && isStr(p.year) && isStr(p.period) && isStr(p.exam) && isStr(p.part) && Number.isInteger(p.no)) {
      const key = [p.year, p.period, p.exam, p.part, p.no].join('|');
      if (inThis.has(key)) err(f, id, `同じ過去問題の出典（${key}）が同じ問題の中に2回ある`);
      else if (pastSeen.has(key)) err(f, id, `同じ過去問題の出典（${key}）が ${pastSeen.get(key)} にもある（同じ過去問題は1問にまとめ、pastExam を配列にして出典を並べる）`);
      else pastSeen.set(key, id);
      inThis.add(key);
    }
  }
}
function checkOnePastExam(f, id, p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) { err(f, id, 'pastExam の出典がオブジェクトでない'); return; }
  for (const k of ['year', 'period', 'exam', 'part']) {
    if (!isStr(p[k])) err(f, id, `pastExam.${k} が無い・空（出典の行に出す文字。欄が1つ欠けると出典にならない）`);
    else if (p[k] !== p[k].trim() || /[\r\n]/.test(p[k])) err(f, id, `pastExam.${k} の前後に空白、または改行がある`);
  }
  if (!Number.isInteger(p.no) || p.no < 1 || p.no > PAST_EXAM_NO_MAX) err(f, id, `pastExam.no が 1〜${PAST_EXAM_NO_MAX} の整数でない: ${p.no}`);
  if (typeof p.modified !== 'boolean') err(f, id, 'pastExam.modified が true／false でない（改変していなければ false と書く。省かない）');
  for (const k of Object.keys(p)) if (!PAST_EXAM_KEYS.includes(k)) err(f, id, `pastExam に知らない欄がある: ${k}`);
}

const seen = new Map();
for (const { file: f, kind, data, syl } of loaded) {
  const idForm = idFormOf(f);
  if (kind === 'basics') { checkBasics({ file: f, data, idRe: idForm.b, idLabel: idForm.bLabel, seen, conceptIndex, checkFigureRefs, err, warn, isStr }); continue; }
  data.forEach((o, idx) => {
    const id = o && o.id ? o.id : `#${idx}`;
    if (seen.has(id)) err(f, id, `id が重複（${seen.get(id)} にもある）`); else seen.set(id, path.basename(f));
    if (kind === 'questions') {
      if (!idForm.q.test(id)) err(f, id, `id が ${idForm.qLabel} 形式でない`);
      checkSyllabus(f, id, o.syllabus, syl);
      checkPastExam(f, id, o);
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
      checkChoicePositionRefs(f, id, o);
      checkStemPlain(f, id, o);
      if (!Array.isArray(o.concepts) || o.concepts.length === 0) err(f, id, 'concepts が空');
      else o.concepts.forEach((c) => { if (!conceptIndex.has(c)) err(f, id, `concepts の ${c} が用語カードに無い`); });
      checkAnswerLength(f, id, o);
      checkCueWords(f, id, o);
      if (o.format === 'fill' && !/（\s*）|\(\s*\)|【\s*】|＿|（[ア-ンあ-ん]）/.test(o.stem)) warn(f, id, 'fill なのに問題文に空欄の印が無い');
      if (o.format === 'not' && !/不適切|適切でない|誤っている|誤り|効果がない/.test(o.stem)) warn(f, id, 'not なのに問題文に「不適切」等が無い');
      // 適切でないものを選ばせるのに札が出ない問題を止める（要件定義書 §7 の negative）
      if ('negative' in o && o.negative !== true) err(f, id, 'negative は true だけ書く（違うなら欄ごと省く）');
      if (/(不適切な|適切でない|誤っている|誤りを含む|正しくない|効果がない)もの/.test(o.stem) && o.format !== 'not' && o.negative !== true) err(f, id, '問題文が適切でないものを選ばせるのに、format が not でも negative でもない（札が出ない）');
      // combo: 問題文に空欄（ア）があり、どの選択肢も（ア）から始まる語の組（要件定義書 §7 の format）。並べ替えても崩れないよう、選択肢どうしを番号で指さない
      if (o.format === 'combo') {
        if (!/（ア）/.test(o.stem) || !/（イ）/.test(o.stem)) err(f, id, 'combo なのに問題文に空欄（ア）（イ）が無い');
        if (Array.isArray(o.choices) && o.choices.some((c) => typeof c !== 'string' || !/^（ア）/.test(c.trim()) || !/（イ）/.test(c))) err(f, id, 'combo の選択肢が「（ア）〇〇　（イ）△△」の形でない');
        if (Array.isArray(o.choices) && new Set(o.choices.map((c) => String(c).replace(/\s+/g, ''))).size !== o.choices.length) err(f, id, 'combo の選択肢に同じ組がある');
        checkComboMode(f, id, o);
      } else if (Array.isArray(o.choices) && o.choices.every((c) => isStr(c) && /^（ア）/.test(c.trim()) && /（イ）/.test(c))) {
        // fill 等でも選択肢が「（ア）〇〇　（イ）△△」の組なら、同じ手がかりが出るので同じ検査をかける
        checkComboMode(f, id, o);
      } else {
        checkSegMajority(f, id, o);
      }
    } else {
      if (!idForm.c.test(id)) err(f, id, `id が ${idForm.cLabel} 形式でない`);
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
    checkFigureRefs(f, id, o.figures);
    checkFigureRefs(f, id, o.stemFigures, 'stemFigures');
    if (!STATUS.has(o.status)) err(f, id, `status が不正: ${o.status}`);
  });
}

checkFigureFiles();

// 集計
for (const { file: f, kind, data } of loaded) {
  if (kind === 'basics') { console.log(`${path.basename(path.dirname(f))}/${path.basename(f)}: basics ${data.length}語`); continue; }
  const v = data.filter((o) => o.status === 'verified').length;
  console.log(`${path.basename(path.dirname(f))}/${path.basename(f)}: ${kind} ${data.length}件（verified ${v} / unverified ${data.length - v}）`);
}
// 正解の長さの偏り（ファイルごと・全体）
{
  let n = 0; let longest = 0;
  const pct = (a, b) => (b ? (100 * a / b).toFixed(0) : '0') + '%';
  for (const [fn, st] of lenStats) {
    n += st.n; longest += st.longest;
    console.log(`LENGTH ${fn}: 正解がいちばん長い ${st.longest}/${st.n}（${pct(st.longest, st.n)}）`);
  }
  if (n) {
    console.log(`LENGTH 全体: 正解がいちばん長い ${longest}/${n}（${pct(longest, n)}）`);
    if (longest / n > LONGEST_SHARE_WARN) warns.push(`WARN 全体 -: 正解がいちばん長い問題が ${pct(longest, n)}（${longest}/${n}）で ${LONGEST_SHARE_WARN * 100}% を超える。長さで正解が当たりやすい`);
  }
}
// 過去問題とオリジナルの数（過去問題の出典 pastExam を持つ問題。オリジナルのほうが多いことが決まり。要件定義書 §12）
for (const { app, past, original } of pastStats.values()) {
  if (!past) continue;
  console.log(`PAST ${app}: 過去問題 ${past} / オリジナル ${original}`);
  if (original <= past) warns.push(`WARN ${app} -: 過去問題（${past}問）がオリジナル（${original}問）以上（オリジナルを過去問題より多くする決まり。渡したファイルが一部だけなら、全部を渡して数え直す）`);
}
// 選択肢の語の偏り（全体）
if (cueStats.n) console.log(`CUE 全体: 語の偏りがある ${cueStats.flagged}/${cueStats.n}`);
// 部分ごとの多数決で正解に当たる（全体）
if (segStats.n) console.log(`SEG 全体: 部分ごとの多数派が正解になる ${segStats.flagged}/${segStats.n}`);
warns.forEach((w) => console.log(w));
errors.forEach((e) => console.log(e));
console.log(errors.length ? `結果: NG ${errors.length}件` : '結果: OK');
process.exit(errors.length ? 1 : 0);
