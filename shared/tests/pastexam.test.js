// 過去問題の出典（問題データの任意の欄 pastExam。要件定義書 §7・§12。2026-10-29、情報処理安全確保支援士のアプリを足したとき）:
// 欄の整形・出典の1行・問題の画面と解説に出ること・tools/check-data.js の検査。
// 実行: cd shared && node --test tests/pastexam.test.js
// 見ていないもの: 実ブラウザでの見え方（文字の大きさ・折り返し）。画面は偽の DOM に組み立てた結果だけ見る
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizePastExam, pastExamCitation, PAST_EXAM_NO_MAX } from '../js/lib/pastexam.js';
import { normalizeQuestion, normalizeConcept, buildConceptIndex } from '../js/lib/data.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(shared, '..');
const src = (p) => readFileSync(join(shared, p), 'utf8');

class FakeEl {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.className = ''; this.textContent = ''; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  find(pred, out = []) { if (pred(this)) out.push(this); for (const c of this.children) if (c instanceof FakeEl) c.find(pred, out); return out; }
}
globalThis.document = { createElement: (t) => new FakeEl(t), createTextNode: (s) => ({ text: s }) };
globalThis.location = { href: 'http://localhost/sc/' };
const { explanation, pastExamLine } = await import('../js/views/explain.js');

const PE = { year: '令和7年度', period: '秋期', exam: '情報処理安全確保支援士試験', part: '午前Ⅱ', no: 1, modified: false };
const CITE = '出典：令和7年度 秋期 情報処理安全確保支援士試験 午前Ⅱ 問1';

test('出典の1行: 年度・期・試験区分・時間区分・問番号を並べる。改変した問題は末尾に（一部改変）', () => {
  assert.equal(pastExamCitation(PE), CITE);
  assert.equal(pastExamCitation({ ...PE, modified: true }), CITE + '（一部改変）');
});

test('出典の1行: 期の名前は計算せずデータの文字をそのまま出す（春期・秋期・2020年度の10月）', () => {
  assert.equal(pastExamCitation({ ...PE, year: '令和2年度', period: '10月', part: '午前Ⅱ', no: 25 }), '出典：令和2年度 10月 情報処理安全確保支援士試験 午前Ⅱ 問25');
  assert.equal(pastExamCitation({ ...PE, year: '令和3年度', period: '春期', no: 12 }), '出典：令和3年度 春期 情報処理安全確保支援士試験 午前Ⅱ 問12');
});

test('整形: 欄がそろっていなければ null（出典の行を出さない）。問番号は 1〜25 の整数、modified は真偽値', () => {
  assert.equal(PAST_EXAM_NO_MAX, 25);
  assert.deepEqual(normalizePastExam({ ...PE, year: '  令和7年度 ' }), PE, '前後の空白は削る');
  for (const bad of [undefined, null, 'x', [], 5, {}]) assert.equal(normalizePastExam(bad), null, String(bad));
  for (const k of ['year', 'period', 'exam', 'part']) {
    assert.equal(normalizePastExam({ ...PE, [k]: '' }), null, k + ' が空');
    assert.equal(normalizePastExam({ ...PE, [k]: '   ' }), null, k + ' が空白だけ');
    assert.equal(normalizePastExam({ ...PE, [k]: 7 }), null, k + ' が文字でない');
    const { [k]: _gone, ...rest } = PE;
    assert.equal(normalizePastExam(rest), null, k + ' が無い');
  }
  for (const no of [0, 26, -1, 1.5, '1', null, NaN]) assert.equal(normalizePastExam({ ...PE, no }), null, 'no=' + String(no));
  for (const no of [1, 2, 24, 25]) assert.ok(normalizePastExam({ ...PE, no }), 'no=' + no);
  for (const modified of [undefined, null, 'false', 0, 1]) assert.equal(normalizePastExam({ ...PE, modified }), null, 'modified=' + String(modified));
  assert.equal(pastExamCitation(null), '');
  assert.equal(pastExamCitation({ ...PE, no: 26 }), '');
});

const baseQ = { id: 'SC-01-001', syllabus: ['a'], stem: '問題文です。', answer: 0, choices: ['甲です', '乙です'], explanation: '甲が正しい。' };

test('normalizeQuestion: pastExam を整えて持つ。無い・崩れていれば null（問題そのものは捨てない）', () => {
  assert.deepEqual(normalizeQuestion({ ...baseQ, pastExam: PE }).pastExam, PE);
  assert.equal(normalizeQuestion(baseQ).pastExam, null);
  const broken = normalizeQuestion({ ...baseQ, pastExam: { ...PE, no: 26 } });
  assert.ok(broken, '出典が崩れていても問題は残る');
  assert.equal(broken.pastExam, null);
});

const concepts = [normalizeConcept({ id: 'C-SC-01-001', title: '用語', oneLine: '一行。', why: 'w', syllabus: ['a'] })];
const app = { data: { concepts, conceptIndex: buildConceptIndex(concepts), figures: {} }, state: { settings: {} } };
const sqOf = (q) => ({ q, choices: q.choices, answer: q.answer, whyWrong: [null, '乙は違う'] });

test('画面の部品: pastExamLine は出典の1行（p）を返す。出典が無い問題は null', () => {
  const el = pastExamLine(normalizeQuestion({ ...baseQ, pastExam: { ...PE, modified: true } }));
  assert.equal(el.tag, 'p');
  assert.equal(el.textContent, CITE + '（一部改変）');
  assert.ok(el.className.includes('past-exam'));
  assert.equal(el.attrs['data-past-exam'], '1');
  assert.equal(pastExamLine(normalizeQuestion(baseQ)), null);
});

test('解説(explanation): 出典の行が入る。出典の無い問題には入らない', () => {
  const lines = (q) => explanation(app, sqOf(q), 1, () => {}, { sensei: false }).find((e) => e.attrs['data-past-exam'] === '1');
  const withPe = lines(normalizeQuestion({ ...baseQ, pastExam: PE }));
  assert.equal(withPe.length, 1);
  assert.equal(withPe[0].textContent, CITE);
  assert.equal(lines(normalizeQuestion(baseQ)).length, 0);
});

test('問題の画面: 出題・ボス戦・模試・あとで見る・真ボスの5つの画面が、問題文の直後に出典の行を出す（結線）', () => {
  for (const f of ['js/views/play.js', 'js/views/boss.js', 'js/views/exam.js', 'js/views/later.js', 'js/views/trueboss.js']) {
    const s = src(f);
    assert.match(s, /import \{[^}]*\bpastExamLine\b[^}]*\} from '\.\/explain\.js'/, f + ' が pastExamLine を取り込んでいない');
    assert.ok(s.includes('pastExamLine(q)'), f + ' が出典の行を出していない');
  }
  // 解説は6つの画面が explanation() を通る。出典はその中で出すので、画面ごとに足さない
  const ex = src('js/views/explain.js');
  assert.ok(ex.indexOf('const past = pastExamLine(q);') > ex.indexOf('export function explanation('), '解説の中で出す');
});

// ---- tools/check-data.js ----
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

/** 一時ディレクトリに <tmp>/sc/data/ を作り（フォルダ名 sc で ID の形が sc 用になる）、問題を入れて check-data.js を走らせる */
function runCheck(questions) {
  const dir = mkdtempSync(join(tmpdir(), 'cq-past-'));
  try {
    const d = join(dir, 'sc', 'data');
    mkdirSync(join(d, 'questions'), { recursive: true });
    mkdirSync(join(d, 'concepts'), { recursive: true });
    const sample = readJson('sc/data/_sample/questions/sample.json');
    const cpt = readJson('sc/data/_sample/concepts/sample.json');
    cpt[0].id = 'C-SC-01-001';
    writeFileSync(join(d, 'syllabus.json'), JSON.stringify(readJson('sc/data/_sample/syllabus.json')));
    writeFileSync(join(d, 'concepts', '01.json'), JSON.stringify(cpt));
    const qs = questions(sample.map((q, i) => ({ ...q, id: 'SC-01-' + String(i + 1).padStart(3, '0'), concepts: ['C-SC-01-001'] })));
    writeFileSync(join(d, 'questions', '01.json'), JSON.stringify(qs));
    const r = spawnSync(process.execPath, [join(root, 'tools', 'check-data.js'), join(d, 'questions', '01.json'), join(d, 'concepts', '01.json')], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const withPast = (qs, pe) => { const o = qs.map((q) => ({ ...q })); o[1].pastExam = pe; return o; };

test('サンプル: 出典つきの問題が1問あり、サンプルのとおり出典の1行になる。検査も通る（過去問題 1 / オリジナル 1 の WARN だけ）', () => {
  const sample = readJson('sc/data/_sample/questions/sample.json');
  const pe = sample.filter((q) => q.pastExam);
  assert.equal(pe.length, 1);
  assert.equal(pastExamCitation(pe[0].pastExam), CITE);
  assert.match(pe[0].stem, /実際の試験問題ではありません/, 'サンプルの問題文に、本物の過去問題ではないと書く');
  const r = runCheck((qs) => qs);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /PAST sc: 過去問題 1 \/ オリジナル 1/);
  assert.match(r.out, /WARN sc -: 過去問題（1問）がオリジナル（1問）以上/);
});

test('check-data.js: オリジナルが過去問題より多ければ WARN は出ない', () => {
  const r = runCheck((qs) => [...qs, { ...qs[0], id: 'SC-01-003', stem: '【サンプル】別の問題文です。' }]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /PAST sc: 過去問題 1 \/ オリジナル 2/);
  assert.doesNotMatch(r.out, /WARN sc -/);
});

test('check-data.js: 出典が崩れていれば NG（問番号 0・26・小数、欄の欠け、真偽値でない modified、知らない欄、空白だけの欄）', () => {
  const bads = [
    ['no=26', { ...PE, no: 26 }, /pastExam\.no が 1〜25/],
    ['no=0', { ...PE, no: 0 }, /pastExam\.no が 1〜25/],
    ['no=1.5', { ...PE, no: 1.5 }, /pastExam\.no が 1〜25/],
    ['no が文字', { ...PE, no: '3' }, /pastExam\.no が 1〜25/],
    ['part が無い', (({ part, ...r }) => r)(PE), /pastExam\.part が無い/],
    ['year が空白だけ', { ...PE, year: '  ' }, /pastExam\.year が無い・空/],
    ['period の前後に空白', { ...PE, period: ' 秋期' }, /pastExam\.period の前後に空白/],
    ['modified が無い', (({ modified, ...r }) => r)(PE), /pastExam\.modified が true／false でない/],
    ['modified が文字', { ...PE, modified: 'false' }, /pastExam\.modified が true／false でない/],
    ['知らない欄', { ...PE, note: 'x' }, /pastExam に知らない欄がある: note/],
    ['配列', [PE], /pastExam がオブジェクトでない/],
  ];
  for (const [name, pe, re] of bads) {
    const r = runCheck((qs) => withPast(qs, pe));
    assert.equal(r.code, 1, name + '\n' + r.out);
    assert.match(r.out, re, name + '\n' + r.out);
  }
});

test('check-data.js: 同じ過去問題の出典を2回載せたら NG。modified:true の出典は通る', () => {
  const dup = runCheck((qs) => { const o = withPast(qs, PE); o[0].pastExam = { ...PE }; return o; });
  assert.equal(dup.code, 1, dup.out);
  assert.match(dup.out, /同じ過去問題の出典/);
  const mod = runCheck((qs) => withPast(qs, { ...PE, modified: true }));
  assert.equal(mod.code, 0, mod.out);
});

test('登録: 出典の部品はオフラインでも出る（sw-core.js の SHARED）。テストが package.json の一覧に入っている', () => {
  assert.ok(src('sw-core.js').includes("'../shared/js/lib/pastexam.js'"));
  assert.ok(src('package.json').includes('tests/pastexam.test.js'));
});
