// データの読み込みと整形。資格固有のことは書かない。
import { normalizeFigureIds } from './figures.js';
// 存在しないファイル(404)は飛ばす。形が崩れた問題・カードは捨てて problems に記録する。

const norm = (s) => String(s == null ? '' : s).normalize('NFKC').trim().toLowerCase();

async function fetchJson(url, fetchFn) {
  try {
    const res = await fetchFn(url);
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, json: await res.json() };
  } catch (e) {
    return { ok: false, status: 0, error: String(e && e.message ? e.message : e) };
  }
}

export function normalizeQuestion(q) {
  if (!q || typeof q !== 'object') return null;
  if (typeof q.id !== 'string' || !q.id) return null;
  if (!Array.isArray(q.syllabus) || !q.syllabus.length || !q.syllabus.every((s) => typeof s === 'string' && s)) return null;
  if (typeof q.stem !== 'string' || !q.stem) return null;
  if (!Array.isArray(q.choices) || q.choices.length < 2 || !q.choices.every((c) => typeof c === 'string')) return null;
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) return null;
  const whyWrong = Array.isArray(q.whyWrong) ? q.whyWrong.slice(0, q.choices.length) : [];
  while (whyWrong.length < q.choices.length) whyWrong.push(null);
  whyWrong[q.answer] = null;
  return {
    id: q.id,
    syllabus: q.syllabus,
    format: ['single', 'not', 'fill', 'scenario'].includes(q.format) ? q.format : 'single',
    qtype: ['term', 'relation', 'causal', 'loop', 'tradeoff', 'interdep', 'miscon'].includes(q.qtype) ? q.qtype : '', // 出題の型（任意。模試の配分に使う）
    difficulty: Number.isFinite(q.difficulty) ? q.difficulty : null,
    stem: q.stem,
    stemPlain: typeof q.stemPlain === 'string' ? q.stemPlain.trim() : '', // 問題文の言い直し（任意。無ければ ''）
    choices: q.choices,
    answer: q.answer,
    explanation: typeof q.explanation === 'string' ? q.explanation : '',
    whyWrong,
    memoryTip: typeof q.memoryTip === 'string' ? q.memoryTip : '',
    concepts: Array.isArray(q.concepts) ? q.concepts : [],
    figures: normalizeFigureIds(q.figures),
    sources: Array.isArray(q.sources) ? q.sources.filter((s) => s && typeof s.url === 'string') : [],
    status: q.status === 'verified' ? 'verified' : 'unverified',
  };
}

export function normalizeConcept(c) {
  if (!c || typeof c !== 'object') return null;
  if (typeof c.id !== 'string' || !c.id) return null;
  if (typeof c.title !== 'string' || !c.title) return null;
  return {
    id: c.id,
    syllabus: Array.isArray(c.syllabus) ? c.syllabus.filter((s) => typeof s === 'string' && s) : [],
    title: c.title,
    oneLine: typeof c.oneLine === 'string' ? c.oneLine : '',
    why: typeof c.why === 'string' ? c.why : '',
    links: Array.isArray(c.links) ? c.links : [],
    confusions: Array.isArray(c.confusions) ? c.confusions : [],
    figures: normalizeFigureIds(c.figures),
    sources: Array.isArray(c.sources) ? c.sources.filter((s) => s && typeof s.url === 'string') : [],
    status: c.status === 'verified' ? 'verified' : 'unverified',
  };
}

// ---- シラバスの木 ----

function nodeName(x) {
  if (typeof x === 'string') return x;
  if (x && typeof x === 'object') return x.name || x.title || x.label || null;
  return null;
}
function nodeChildren(x) {
  if (!x || typeof x !== 'object') return [];
  for (const k of ['children', 'items', 'sections', 'topics', 'sub']) if (Array.isArray(x[k])) return x[k];
  return [];
}
function rootList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    for (const k of ['tree', 'syllabus', 'majors', 'items', 'children', 'sections']) if (Array.isArray(raw[k])) return raw[k];
  }
  return [];
}

/**
 * 木を作る。syllabus.json（無ければ空）に、問題・カードの syllabus 経路にしか無い項目を足す。
 * 深さ0=大項目 / 1=中項目(=ステージ) / 2=小項目。中項目が無い問題は「全般」ステージに入れる。
 */
export function buildTree(syllabusRaw, questions, concepts) {
  const byKey = new Map();
  const roots = [];
  const ensure = (path) => {
    const key = path.join('|');
    let n = byKey.get(key);
    if (n) return n;
    n = { name: path[path.length - 1], depth: path.length - 1, path: path.slice(), key, children: [], parent: null, questions: [], concepts: [], keywords: [], id: null, supplement: false };
    byKey.set(key, n);
    if (path.length === 1) roots.push(n);
    else {
      const p = ensure(path.slice(0, -1));
      n.parent = p;
      p.children.push(n);
    }
    return n;
  };
  const walk = (list, path, depth) => {
    for (const x of list) {
      const name = nodeName(x);
      if (!name) continue;
      const n = ensure([...path, name]);
      if (x && typeof x === 'object') {
        if (typeof x.id === 'string') n.id = x.id;
        if (depth === 0 && x.supplement === true) n.supplement = true; // 補足の領域（模試に出さない）
        if (Array.isArray(x.keywords)) n.keywords = x.keywords.filter((k) => typeof k === 'string');
      }
      if (depth < 2) walk(nodeChildren(x), n.path, depth + 1);
    }
  };
  walk(rootList(syllabusRaw), [], 0);

  const pathOf = (syl) => {
    const p = syl.slice(0, 3);
    if (p.length === 1) p.push('全般');
    return p;
  };
  for (const q of questions) {
    const p = pathOf(q.syllabus);
    for (let i = 1; i <= p.length; i++) ensure(p.slice(0, i)).questions.push(q);
    q._path = p;
  }
  for (const c of concepts) {
    if (!c.syllabus.length) continue;
    const p = pathOf(c.syllabus);
    for (let i = 1; i <= p.length; i++) ensure(p.slice(0, i)).concepts.push(c);
    c._path = p;
  }
  const stages = [];
  for (const r of roots) for (const s of r.children) stages.push(s);
  return { roots, stages, byKey };
}

// ---- 用語カードの参照の解決 ----

export function buildConceptIndex(concepts) {
  const byId = new Map();
  const byTitle = new Map();
  for (const c of concepts) {
    if (!byId.has(c.id)) byId.set(c.id, c);
    const t = norm(c.title);
    if (t && !byTitle.has(t)) byTitle.set(t, c);
  }
  return { byId, byTitle };
}

/**
 * links / confusions / q.concepts の1要素を解決する。
 * id があれば id で、無ければ（または見つからなければ）title の一致で。解決できなければ concept は null。
 */
export function resolveRef(ref, index) {
  if (ref == null) return { concept: null, label: '', relation: '', point: '' };
  const r = typeof ref === 'string' ? { id: ref, title: ref } : ref;
  let concept = null;
  if (typeof r.id === 'string' && r.id) concept = index.byId.get(r.id) || null;
  if (!concept && typeof r.title === 'string' && r.title) concept = index.byTitle.get(norm(r.title)) || null;
  if (!concept && typeof r.id === 'string' && r.id) concept = index.byTitle.get(norm(r.id)) || null;
  return {
    concept,
    label: concept ? concept.title : r.title || r.id || '',
    relation: typeof r.relation === 'string' ? r.relation : '',
    point: typeof r.point === 'string' ? r.point : '',
  };
}

/** 各カードへ「どのカードから張られているか」。 */
export function buildBacklinks(concepts, index) {
  const back = new Map();
  const add = (toId, entry) => {
    if (!back.has(toId)) back.set(toId, []);
    back.get(toId).push(entry);
  };
  for (const c of concepts) {
    for (const l of c.links) {
      const r = resolveRef(l, index);
      if (r.concept && r.concept.id !== c.id) add(r.concept.id, { from: c, relation: r.relation, kind: 'link' });
    }
    for (const f of c.confusions) {
      const r = resolveRef(f, index);
      if (r.concept && r.concept.id !== c.id) add(r.concept.id, { from: c, point: r.point, kind: 'confusion' });
    }
  }
  return back;
}

/**
 * index.json を起点に全部読む。
 * dataBase は index.json のあるディレクトリのURL（末尾 /）。index 内のパスはそこからの相対。
 */
export async function loadData({ dataBase, fetchFn = (u) => fetch(u) }) {
  const problems = [];
  const missing = [];
  const idxUrl = new URL('index.json', dataBase).href;
  const idx = await fetchJson(idxUrl, fetchFn);
  if (!idx.ok || !idx.json || typeof idx.json !== 'object') {
    return finish({ indexFound: false, syllabusRaw: null, questions: [], concepts: [], problems, missing: ['index.json'] });
  }
  const rel = (p) => new URL(p, idxUrl).href;
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

  const syllabusP = typeof idx.json.syllabus === 'string' ? fetchJson(rel(idx.json.syllabus), fetchFn) : Promise.resolve({ ok: false, status: 404 });
  const qFiles = list(idx.json.questions);
  const cFiles = list(idx.json.concepts);
  const [syl, qRes, cRes] = await Promise.all([
    syllabusP,
    Promise.all(qFiles.map((f) => fetchJson(rel(f), fetchFn))),
    Promise.all(cFiles.map((f) => fetchJson(rel(f), fetchFn))),
  ]);

  let syllabusRaw = null;
  if (syl.ok) syllabusRaw = syl.json;
  else missing.push(String(idx.json.syllabus || 'syllabus'));

  const questions = [];
  const seenQ = new Set();
  qRes.forEach((r, i) => {
    if (!r.ok) {
      missing.push(qFiles[i]);
      if (r.status !== 404) problems.push({ file: qFiles[i], reason: '読み込み失敗(' + (r.status || r.error) + ')' });
      return;
    }
    const arr = Array.isArray(r.json) ? r.json : r.json && Array.isArray(r.json.questions) ? r.json.questions : null;
    if (!arr) return problems.push({ file: qFiles[i], reason: '問題の配列ではない' });
    arr.forEach((raw, k) => {
      const q = normalizeQuestion(raw);
      if (!q) return problems.push({ file: qFiles[i], reason: '形が不正な問題を捨てた(' + k + '番目' + (raw && raw.id ? ' ' + raw.id : '') + ')' });
      if (seenQ.has(q.id)) return problems.push({ file: qFiles[i], reason: 'IDの重複を捨てた(' + q.id + ')' });
      seenQ.add(q.id);
      questions.push(q);
    });
  });

  const concepts = [];
  const seenC = new Set();
  cRes.forEach((r, i) => {
    if (!r.ok) {
      missing.push(cFiles[i]);
      if (r.status !== 404) problems.push({ file: cFiles[i], reason: '読み込み失敗(' + (r.status || r.error) + ')' });
      return;
    }
    const arr = Array.isArray(r.json) ? r.json : r.json && Array.isArray(r.json.concepts) ? r.json.concepts : null;
    if (!arr) return problems.push({ file: cFiles[i], reason: 'カードの配列ではない' });
    arr.forEach((raw, k) => {
      const c = normalizeConcept(raw);
      if (!c) return problems.push({ file: cFiles[i], reason: '形が不正なカードを捨てた(' + k + '番目' + (raw && raw.id ? ' ' + raw.id : '') + ')' });
      if (seenC.has(c.id)) return problems.push({ file: cFiles[i], reason: 'IDの重複を捨てた(' + c.id + ')' });
      seenC.add(c.id);
      concepts.push(c);
    });
  });

  // ボスの名前・せりふのファイル（無くてもよい。読むのは app.js。ここでは読み込みの進み具合に数えないよう、名前だけ返す）
  const bossesFile = typeof idx.json.bosses === 'string' && idx.json.bosses ? idx.json.bosses : 'bosses.json';
  return finish({ indexFound: true, syllabusRaw, questions, concepts, problems, missing, bossesFile });

  function finish(d) {
    const tree = buildTree(d.syllabusRaw, d.questions, d.concepts);
    const conceptIndex = buildConceptIndex(d.concepts);
    return {
      indexFound: d.indexFound,
      questions: d.questions,
      questionById: new Map(d.questions.map((q) => [q.id, q])),
      concepts: d.concepts,
      conceptIndex,
      backlinks: buildBacklinks(d.concepts, conceptIndex),
      tree,
      problems: d.problems,
      missing: d.missing,
      bossesFile: d.bossesFile || 'bosses.json',
      bosses: [], // app.js が bosses.json を読んで入れる（章のボスの名前・せりふ。lib/bossdata.js）
    };
  }
}
