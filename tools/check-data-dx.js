#!/usr/bin/env node
// cert-quest DXビジネス検定版 データ検査（tools/check-data.js の写し。id 形式だけ D-NN-NNN / DC-NN-NNN に変えた）
// 追加: 学会シラバスの章立て（2026-10-06）・出題の型 qtype・補足の印（下の「DX の章立て」）／--coverage でシラバスのキーワードの扱い漏れを数える
// 使い方:
//   node tools/check-data-dx.js <ファイル...>
//   node tools/check-data-dx.js dx-biz/data/questions/01_dx-basics.json dx-biz/data/concepts/01_dx-basics.json --coverage
// オプション:
//   --coverage          与えたファイルが属する章（2段目）の全キーワードが、問題（stem/choices/explanation）か
//                       カード（title/oneLine/why）の文に出てくるかを数える。キーワードは「／」で分け、
//                       「A（B）」「A (B)」は A か B のどちらかが出れば扱い済み。末尾の「など」は除く。
//                       語が出るかだけを見る（正しく扱っているかは見ない）。未が1件でもあれば NG
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
//   - stemPlain（任意）が、空でない文字列・200文字以内・問題文と別の文であること（要件定義書 §7-3）
//   - sources が {title, url} で url が http(s) であること
//   - figures（任意）の各 ID に対応する data/figures/<ID>.svg が実在すること。data/figures/ の SVG は、script・外部参照などの禁止事項が無く、
//     viewBox の幅が 360 以下で、role="img"・<title>・<desc> を持つこと（要件定義書 §7-2）
//
// DX の章立て（要件定義書 §7-4。2026-10-06 学会シラバスに合わせた）
//   - syllabus.json の木が 領域 ＞ 分類（＝章・ステージ）＞ 知識区分 の3段であること
//   - 領域は、補足でないものがちょうど4つ、補足（"supplement": true）がちょうど1つ。supplement は領域だけに付け、値は true だけ
//   - 補足でない領域の分類は、それぞれ id が「章番号2桁＋分類の記号」（例 01A）で、
//     子がちょうど「基本概念／応用事例／最新事例＆トレンド」の3つ（この順）。章番号は全体で重ならず、補足でない分類は計12
//   - 補足の分類も id は「章番号2桁＋記号」で、章番号は補足でない章より後
//   - 木に知識項目の一覧を入れない（keywords があれば空。シラバスは再配布しない＝先生決定 2026-10-06）
//   - 問題・カードの syllabus は3段（領域・分類・知識区分）で、ファイル名の章番号（NN_）がその分類の章番号と同じ
//   - 問題の qtype が term / relation / causal / loop / tradeoff / interdep / miscon のどれか（必須）
//   - id の番号が 101 以上（作り直し後に足したもの）は、id の章番号がファイル名の章番号と同じ。
//     100 以下は旧章立ての ID をそのまま残しているので見ない（学習記録が問題 ID で保存されているため、ID は変えない）
//
// 正解の長さの偏り（WARN のみ。2026-10-06 追加）
//   - 問題ごと: 正解の文字数が最も長い誤答の2倍以上なら WARN（ID を出す）
//   - ファイルごと・全体で「正解がいちばん長い問題の割合」を LENGTH 行に出し、全体で 40% を超えたら WARN
//
// 相互依存の問題の言い回しの偏り（WARN のみ。2026-10-06 追加。下の INTERDEP_LINK / INTERDEP_DISMISS）
//   qtype が interdep の問題（format が not のものは除く）で、次のどちらかなら WARN（ID を出す）。INTERDEP 行に件数を出す
//   - A: 正解が相互依存の言い回し（INTERDEP_LINK）を1つ以上含み、誤答のどれも1つも含まない
//   - B: 誤答のすべてが片づけの言い回し（INTERDEP_DISMISS）を含み、正解は1つも含まない
//   見ていないもの: 一覧に無い言い回し（言い換えれば素通りする）・意味（「互いに関係が無い」も相互依存の語として数える）・
//   誤答が別の語で関係を述べているか（正解「両方」・誤答「どちらも」は A になる）。良い形は D-11-127（正解と誤答が同じ要素を並べ、1点だけ違う）
//
// 選択肢の語の偏り（WARN のみ。2026-10-06 追加。下の CUE_WORDS）
//   qtype・format を問わず、誤答が2つ以上ある全問題で、CUE_WORDS の語ごとに次のどちらかなら WARN（ID と語を出す）。CUE 行に件数を出す
//   - 誤答のすべてに含まれ、正解には含まれない（例: 誤答3つだけが「ただし」で要素を崩す。点検 review-1006d の D-01-125 ほか）
//   - 正解にだけ含まれ、誤答のどれにも含まれない（例: format が not の問題で、正解＝不適切な文だけが「必ず」「一切」と言い切る）
//   見ていないもの: 一覧に無い語（言い換えれば素通りする）・意味（否定の「だけでは足りない」も「だけ」として数える）・
//   語が出る位置（文頭の「ただし」も文中も同じに数える）・誤答の一部だけに偏る形（4択のうち2つだけ等）・選択肢以外の欄（問題文と正解の語の重なりは見ない）
//
// 見ていないもの: 内容の正しさ・出典URLが実際に開けるか・出典が答えの根拠を含むか・qtype が問題の中身に合っているか（人が読む）
'use strict';

const fs = require('fs');
const path = require('path');

// 相互依存の問題（qtype: interdep）の言い回しの偏りを見る語の一覧（2026-10-06。点検 review-1006b・1006c で2回続けて見つかった型）。
// 実データの正解・誤答を見て作った。部分一致で見る（正規表現。表記ゆれは列挙したものだけ）。
// 意味は見ない。否定（「互いに関係が無い」）も数える。ただし「連携」は「連携しない／せず」を除く（誤答が連携を否定する形があるため）
const INTERDEP_LINK = [
  /互いに/, /互いの/, /互いが/, /相互に/, /前提にな/, /相手の前提/, /はじめて/, /初めて/, /欠けても/, /欠けると/,
  /両方/, /ともに/, /支え合/, /補い合/, /結びつけ/, /結び付け/, /一体で/, /一体と/, /かみ合/, /組み合わさ/,
  /がそろ/, /にそろ/, /そろわ/, /つながっ/, /連携(?!しな|せず|は無|はな)/,
];
// 片づけの言い回し（要素を切り離す・後回しにする・1つで足りるとする）
const INTERDEP_DISMISS = [
  /足りる/, /ればよい/, /ればよく/, /関わらない/, /関わらず/, /関われず/, /関係が無い/, /関係の無い/, /関係なく/, /関係しない/,
  /別の話/, /自然に/, /単独で/, /後から/, /後で/, /一方的/, /一方向/, /完結/, /影響し合わ/, /無くてもよい/, /要らない/,
  /必要は無い/, /必要はない/, /なくてよい/, /済む/, /切り離/, /結び付かない/, /結びつかない/,
];

// 選択肢の語の偏りを見る語の一覧（2026-10-06。点検 review-1006d で、誤答3つにだけ「ただし」が入る型が見つかった）。
// 但し書き・限定・対比・言い切りの短い語。部分一致で見る（正規表現。表記ゆれは列挙したものだけ）。
// 誤検出を潰すための除外: 「だけでなく／だけではなく」（限定ではなく追加）、「どれだけ／それだけ／これだけ／同じだけ」（量の言い方）、
// 「異常に／非常に／正常に／日常に／通常に」（「常に」を含む別の語）
const CUE_WORDS = [
  /ただし/, /しかし/, /のみ/, /(?<!どれ|それ|これ|同じ)だけ(?!でなく|ではなく)/, /ではなく/, /一方で/,
  /必ず/, /(?<!異|非|正|日|通)常に/, /すべて|全て/, /まったく|全く/, /一切/,
];

const args = process.argv.slice(2);
let syllabusPath = null;
let strictLinks = false;
let coverage = false;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--syllabus') { syllabusPath = args[++i]; continue; }
  if (args[i] === '--strict-links') { strictLinks = true; continue; }
  if (args[i] === '--coverage') { coverage = true; continue; }
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

// ---- DX の章立て（領域＞分類＞知識区分・補足の印）----
const CATS = ['基本概念', '応用事例', '最新事例＆トレンド'];
const BODY_DOMAINS = 4;
const BODY_STAGES = 12;
const STAGE_ID_RE = /^(\d{2})[A-Z]$/;
// 木の形を見て、問題を記録し、「領域 > 分類」→ 章番号 の対応を返す
function dxStructure(p, problems) {
  const tree = readJson(p);
  const stageCh = new Map();
  if (!Array.isArray(tree)) { problems.push('ルートが配列でない'); return stageCh; }
  const body = tree.filter((d) => d && d.supplement !== true);
  const supp = tree.filter((d) => d && d.supplement === true);
  if (body.length !== BODY_DOMAINS) problems.push(`補足でない領域が ${body.length} 個（${BODY_DOMAINS} 個であるべき）`);
  if (supp.length !== 1) problems.push(`補足の領域（"supplement": true）が ${supp.length} 個（1 個であるべき）`);
  const seenCh = new Set();
  let nBodyStages = 0; let maxBodyCh = 0; const suppChs = [];
  const noKeywords = (n, where) => { if (n && 'keywords' in n && !(Array.isArray(n.keywords) && n.keywords.length === 0)) problems.push(`${where}: keywords に知識項目が入っている（木には名前までしか入れない）`); };
  const noSuppFlag = (n, where) => { if (n && 'supplement' in n) problems.push(`${where}: supplement は領域にだけ付ける`); };
  tree.forEach((d, i) => {
    const dn = d && d.title ? d.title : `#${i}`;
    if (!d || !isStr(d.id) || !isStr(d.title)) problems.push(`領域 ${dn}: id・title が無い`);
    if (d && 'supplement' in d && d.supplement !== true) problems.push(`領域 ${dn}: supplement の値は true だけ（補足でなければ欄ごと省く）`);
    noKeywords(d, `領域 ${dn}`);
    const isSupp = d && d.supplement === true;
    const stages = d && Array.isArray(d.children) ? d.children : [];
    if (!stages.length) problems.push(`領域 ${dn}: 分類（章）が無い`);
    for (const s of stages) {
      const sn = `${dn} > ${s && s.title}`;
      noKeywords(s, sn); noSuppFlag(s, sn);
      const m = s && typeof s.id === 'string' ? STAGE_ID_RE.exec(s.id) : null;
      if (!m || !isStr(s.title)) { problems.push(`分類 ${sn}: id が「章番号2桁＋記号」（例 01A）でない、または title が無い`); continue; }
      const ch = m[1];
      if (seenCh.has(ch)) problems.push(`分類 ${sn}: 章番号 ${ch} が重なる`);
      seenCh.add(ch);
      stageCh.set(`${d.title} > ${s.title}`, ch);
      const cats = Array.isArray(s.children) ? s.children : [];
      for (const c of cats) { noKeywords(c, `${sn} > ${c && c.title}`); noSuppFlag(c, `${sn} > ${c && c.title}`); if (c && Array.isArray(c.children) && c.children.length) problems.push(`${sn} > ${c.title}: 知識区分の下に子がある（木は3段まで）`); }
      if (isSupp) { suppChs.push(Number(ch)); if (!cats.length) problems.push(`分類 ${sn}: 小項目が無い`); continue; }
      nBodyStages++;
      maxBodyCh = Math.max(maxBodyCh, Number(ch));
      const titles = cats.map((c) => c && c.title);
      if (titles.join('|') !== CATS.join('|')) problems.push(`分類 ${sn}: 子が「${CATS.join('／')}」の3つ（この順）でない: ${titles.join('／')}`);
    }
  });
  if (nBodyStages !== BODY_STAGES) problems.push(`補足でない分類（章）が ${nBodyStages} 個（${BODY_STAGES} 個であるべき）`);
  for (const ch of suppChs) if (ch <= maxBodyCh) problems.push(`補足の章番号 ${String(ch).padStart(2, '0')} が、補足でない章（最大 ${maxBodyCh}）より前にある`);
  return stageCh;
}

const QTYPES = new Set(['term', 'relation', 'causal', 'loop', 'tradeoff', 'interdep', 'miscon']);

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
const stageChCache = {};
for (const f of files) {
  let data;
  try { data = readJson(f); } catch (e) { err(f, null, `JSON として読めない: ${e.message}`); continue; }
  if (!Array.isArray(data)) { err(f, null, 'ルートが配列でない'); continue; }
  const sp = syllabusPath || path.join(path.dirname(path.dirname(path.resolve(f))), 'syllabus.json');
  if (!(sp in sylCache)) {
    try { sylCache[sp] = loadSyllabusPaths(sp); } catch (e) { sylCache[sp] = null; warn(f, null, `syllabus.json を読めない（パス照合を飛ばす）: ${e.message}`); }
    if (sylCache[sp]) {
      const problems = [];
      try { stageChCache[sp] = dxStructure(sp, problems); } catch (e) { problems.push(e.message); stageChCache[sp] = new Map(); }
      for (const pr of problems) err(sp, null, `章立て: ${pr}`);
    } else stageChCache[sp] = null;
  }
  loaded.push({ file: f, kind: kindOf(f, data), data, syl: sylCache[sp], stageCh: stageChCache[sp] });
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
const figDirOf = (f) => path.join(path.dirname(path.dirname(path.resolve(f))), 'figures');
const figUsed = new Map(); // figures ディレクトリ -> 使われた ID の集合
function checkFigureRefs(f, id, figs) {
  if (figs === undefined) return;
  if (!Array.isArray(figs)) { err(f, id, 'figures が配列でない'); return; }
  const dir = figDirOf(f);
  if (!figUsed.has(dir)) figUsed.set(dir, new Set());
  figs.forEach((x, i) => {
    if (typeof x !== 'string' || !FIGURE_ID_RE.test(x)) { err(f, id, `figures[${i}] が図の ID の形式（fig-英小文字・数字・ハイフン）でない`); return; }
    if (figs.indexOf(x) !== i) err(f, id, `figures に ${x} が重複している`);
    figUsed.get(dir).add(x);
    if (!fs.existsSync(path.join(dir, x + '.svg'))) err(f, id, `figures の ${x} に対応する SVG が無い（${path.join(path.basename(path.dirname(dir)), 'figures', x + '.svg')}）`);
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
      const vb = /<svg[^>]*\sviewBox\s*=\s*"\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([-\d.]+)[\s,]+[-\d.]+\s*"/i.exec(text);
      if (!vb) err(fn, id, 'viewBox が無い');
      else if (Number(vb[1]) > 360) err(fn, id, `viewBox の幅が 360 を超える: ${vb[1]}`);
      const root = (/<svg[^>]*>/i.exec(text) || [''])[0];
      if (!/\srole\s*=\s*"img"/.test(root)) err(fn, id, '<svg> に role="img" が無い');
      if (!/<title[\s>]/i.test(text)) err(fn, id, '<title> が無い');
      if (!/<desc[\s>]/i.test(text)) err(fn, id, '<desc> が無い');
      if (!/\saria-labelledby\s*=\s*"[^"]+"/.test(root)) err(fn, id, '<svg> に aria-labelledby が無い');
      if (!(figUsed.get(dir) || new Set()).has(id)) warn(fn, id, 'どのカード・問題の figures からも使われていない');
    }
  }
}

// 任意の欄 stemPlain（問題文を専門用語を使わずに言い直した文。要件定義書 §7-3。回答後の解説に出すので、選択肢の文を含んでもよい）。
const STEM_PLAIN_MAX = 200;
const nfkc = (s) => String(s).normalize('NFKC').replace(/\s/g, '').toLowerCase();
function checkStemPlain(f, id, o) {
  if (!('stemPlain' in o)) return;
  const sp = o.stemPlain;
  if (!isStr(sp)) { err(f, id, 'stemPlain が空・文字列でない（無いなら欄ごと省く）'); return; }
  if (sp !== sp.trim()) err(f, id, 'stemPlain の前後に空白・改行がある');
  if (sp.length > STEM_PLAIN_MAX) err(f, id, `stemPlain が長すぎる（${sp.length} 文字。上限 ${STEM_PLAIN_MAX}）`);
  if (nfkc(sp) === nfkc(o.stem || '')) err(f, id, 'stemPlain が問題文と同じ（言い直しになっていない）');
}

// 正解の長さの偏り（2026-10-06 追加）。「いちばん長い選択肢を選ぶ」だけで当たる問題を見つける。
//   - 問題ごと: 正解の文字数が、最も長い誤答の 2 倍以上なら WARN
//   - ファイルごと・全体: 正解が（同点を除いて）いちばん長い問題の割合を出す。全体で 40% を超えたら WARN
// 文字数は String の length（サロゲートペアは2と数える。日本語の文ではほぼ影響しない）。
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

// 相互依存の問題の言い回しの偏り（2026-10-06 追加。語の一覧はファイル先頭の INTERDEP_LINK / INTERDEP_DISMISS）
const interdepStats = { n: 0, flagged: 0 };
function checkInterdepWording(f, id, o) {
  if (o.qtype !== 'interdep' || o.format === 'not') return;
  if (!Array.isArray(o.choices) || !Number.isInteger(o.answer) || o.answer < 0 || o.answer >= o.choices.length) return;
  const hits = (s, list) => list.filter((re) => re.test(String(s))).map((re) => String(s).match(re)[0]);
  const right = o.choices[o.answer];
  const wrongs = o.choices.filter((_, i) => i !== o.answer);
  if (!wrongs.length) return;
  interdepStats.n++;
  const reasons = [];
  const rl = hits(right, INTERDEP_LINK);
  if (rl.length && wrongs.every((w) => !hits(w, INTERDEP_LINK).length)) reasons.push(`相互依存の言い回し（${rl.join('・')}）が正解にだけあり、誤答のどれにも無い`);
  const wd = wrongs.map((w) => hits(w, INTERDEP_DISMISS));
  if (!hits(right, INTERDEP_DISMISS).length && wd.every((h) => h.length)) reasons.push(`誤答のすべてが片づけの言い回し（${[...new Set(wd.flat())].join('・')}）を含み、正解には無い`);
  if (!reasons.length) return;
  interdepStats.flagged++;
  warn(f, id, `interdep: ${reasons.join('。')}。問いの型だけで正解が選べる（誤答にも同じ要素の関係を書き、1点だけ違える。例 D-11-127）`);
}

// 選択肢の語の偏り（2026-10-06 追加。語の一覧はファイル先頭の CUE_WORDS）
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

const seen = new Map();
for (const { file: f, kind, data, syl, stageCh } of loaded) {
  data.forEach((o, idx) => {
    const id = o && o.id ? o.id : `#${idx}`;
    if (seen.has(id)) err(f, id, `id が重複（${seen.get(id)} にもある）`); else seen.set(id, path.basename(f));
    if (kind === 'questions') {
      if (!/^D-\d{2}-\d{3}$/.test(id)) err(f, id, 'id が D-NN-NNN 形式でない');
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
      checkStemPlain(f, id, o);
      if (!Array.isArray(o.concepts) || o.concepts.length === 0) err(f, id, 'concepts が空');
      else o.concepts.forEach((c) => { if (!conceptIndex.has(c)) err(f, id, `concepts の ${c} が用語カードに無い`); });
      checkAnswerLength(f, id, o);
      checkInterdepWording(f, id, o);
      checkCueWords(f, id, o);
      if (o.format === 'fill' && !/（\s*）|\(\s*\)|【\s*】|＿/.test(o.stem)) warn(f, id, 'fill なのに問題文に空欄の印が無い');
      if (o.format === 'not' && !/不適切|適切でない|誤っている|誤り/.test(o.stem)) warn(f, id, 'not なのに問題文に「不適切」等が無い');
    } else {
      if (!/^DC-\d{2}-\d{3}$/.test(id)) err(f, id, 'id が DC-NN-NNN 形式でない');
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
    // DX の章立て: syllabus は3段、ファイルの章番号＝分類の章番号、新しい ID（101 以上）の章番号＝ファイルの章番号
    {
      const fm = /^(\d{2})_/.exec(path.basename(f));
      if (!fm) err(f, id, 'ファイル名が「章番号2桁_」で始まらない');
      if (Array.isArray(o.syllabus) && o.syllabus.length !== 3) err(f, id, `syllabus が3段（領域・分類・知識区分）でない: ${o.syllabus.join(' > ')}`);
      if (stageCh && Array.isArray(o.syllabus) && o.syllabus.length >= 2) {
        const ch = stageCh.get(o.syllabus.slice(0, 2).join(' > '));
        if (ch === undefined) err(f, id, `syllabus の分類が木に無い: ${o.syllabus.slice(0, 2).join(' > ')}`);
        else if (fm && ch !== fm[1]) err(f, id, `分類の章番号 ${ch} がファイル名の章 ${fm[1]} と違う（${o.syllabus[1]}）`);
      }
      const m = /^(?:D|DC)-(\d{2})-(\d{3})$/.exec(id);
      if (m && Number(m[2]) >= 101 && fm && m[1] !== fm[1]) err(f, id, `新しい ID（101 以上）の章番号 ${m[1]} がファイル名の章 ${fm[1]} と違う`);
    }
    if (kind === 'questions' && !QTYPES.has(o.qtype)) err(f, id, `qtype が無い・不正: ${o.qtype}（${[...QTYPES].join(' / ')} のどれか）`);
    checkSources(f, id, o.sources);
    checkFigureRefs(f, id, o.figures);
    if (!STATUS.has(o.status)) err(f, id, `status が不正: ${o.status}`);
  });
}

checkFigureFiles();

// 集計
for (const { file: f, kind, data } of loaded) {
  const v = data.filter((o) => o.status === 'verified').length;
  console.log(`${path.basename(path.dirname(f))}/${path.basename(f)}: ${kind} ${data.length}件（verified ${v} / unverified ${data.length - v}）`);
}
// 領域ごとの問題数と qtype の内訳（模試は補足でない領域から選ぶ）
{
  const byDomain = new Map();
  for (const { kind, data } of loaded) if (kind === 'questions') for (const o of data) {
    const d = Array.isArray(o.syllabus) ? o.syllabus[0] : '?';
    if (!byDomain.has(d)) byDomain.set(d, {});
    const e = byDomain.get(d); e[o.qtype] = (e[o.qtype] || 0) + 1;
  }
  for (const [d, e] of byDomain) console.log(`QTYPE ${d}: ${Object.values(e).reduce((a, b) => a + b, 0)}問 ${Object.entries(e).map(([k, n]) => k + ' ' + n).join(' / ')}`);
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
// 相互依存の問題の言い回しの偏り（全体）
if (interdepStats.n) console.log(`INTERDEP 全体: 言い回しの偏りがある ${interdepStats.flagged}/${interdepStats.n}`);
// 選択肢の語の偏り（全体）
if (cueStats.n) console.log(`CUE 全体: 語の偏りがある ${cueStats.flagged}/${cueStats.n}`);
// キーワードの扱い漏れ（--coverage）
if (coverage && loaded.length) {
  const cnorm = (s) => String(s).normalize('NFKC').toLowerCase().replace(/[\s　()「」『』、。,.・\-－ー]/g, '');
  let text = '';
  const chapters = new Set();
  for (const { data } of loaded) for (const o of data) {
    if (Array.isArray(o.syllabus)) chapters.add(o.syllabus.slice(0, 2).join(' > '));
    text += ' ' + [o.title, o.oneLine, o.why, o.stem, (o.choices || []).join(' '), o.explanation].filter(Boolean).join(' ');
  }
  const T = cnorm(text);
  const sp = syllabusPath || path.join(path.dirname(path.dirname(path.resolve(loaded[0].file))), 'syllabus.json');
  const tree = readJson(sp);
  const covered = (kw) => {
    const k = kw.normalize('NFKC').replace(/など$/, '').trim();
    const m = k.match(/^(.*?)\s*\((.*)\)\s*$/);
    const cands = m ? [k, m[1], m[2]] : [k];
    return cands.some((c) => cnorm(c) && T.includes(cnorm(c)));
  };
  let total = 0; let miss = 0;
  for (const field of tree) for (const ch of field.children || []) {
    if (!chapters.has(`${field.title} > ${ch.title}`)) continue;
    for (const item of ch.children || []) {
      const kws = (item.keywords || []).flatMap((k) => k.split('／').map((x) => x.trim()).filter(Boolean));
      const missing = kws.filter((k) => !covered(k));
      total += kws.length; miss += missing.length;
      console.log(`COVER ${item.id} ${item.title}: ${kws.length - missing.length}/${kws.length}${missing.length ? '  未: ' + missing.join(' / ') : ''}`);
    }
  }
  console.log(`COVER 合計 ${total - miss}/${total}（未 ${miss}）`);
  if (miss) errors.push(`NG coverage: 扱っていないキーワードが ${miss} 件`);
}

warns.forEach((w) => console.log(w));
errors.forEach((e) => console.log(e));
console.log(errors.length ? `結果: NG ${errors.length}件` : '結果: OK');
process.exit(errors.length ? 1 : 0);
