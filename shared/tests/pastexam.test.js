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
import { normalizePastExam, normalizePastExams, pastExamCitation, isPastQuestion, choiceLabelsOf, PAST_EXAM_NO_MAX } from '../js/lib/pastexam.js';
import { shuffleChoices } from '../js/lib/quiz.js';
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
const { explanation, pastExamLine, CHOICE_LABELS } = await import('../js/views/explain.js');

const PE = { year: '令和7年度', period: '秋期', exam: '情報処理安全確保支援士試験', part: '午前Ⅱ', no: 1, modified: false };
const CITE = '出典：令和7年度 秋期 情報処理安全確保支援士試験 午前Ⅱ 問1';
const PE2 = { ...PE, year: '令和5年度', period: '春期', no: 2 };
const PE3 = { ...PE, no: 2 };
const CITE_MULTI = '出典：令和5年度 春期 情報処理安全確保支援士試験 午前Ⅱ 問2／令和7年度 秋期 情報処理安全確保支援士試験 午前Ⅱ 問2';

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
  assert.deepEqual(normalizeQuestion({ ...baseQ, pastExam: PE }).pastExam, [PE], 'オブジェクト1つも、長さ1の配列にそろえる');
  assert.deepEqual(normalizeQuestion({ ...baseQ, pastExam: [PE, PE2] }).pastExam, [PE, PE2]);
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
    ['出典がオブジェクトでない', [PE, 'x'], /pastExam の出典がオブジェクトでない/],
    ['配列の中の1つが崩れている', [PE, { ...PE3, no: 26 }], /pastExam\.no が 1〜25/],
    ['空の配列', [], /pastExam が空の配列/],
    ['文字列', 'x', /pastExam の出典がオブジェクトでない/],
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


test('check-data.js: 複数の出典（配列）を持つ問題は通る。PAST の数は出典でなく問題で数える', () => {
  const r = runCheck((qs) => [...withPast(qs, [PE2, PE3]), { ...qs[0], id: 'SC-01-003', stem: '【サンプル】別の問題文です。' }, { ...qs[0], id: 'SC-01-004', stem: '【サンプル】さらに別の問題文です。' }]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /PAST sc: 過去問題 1 \/ オリジナル 3/, '出典は2つでも過去問題は1問');
  assert.doesNotMatch(r.out, /WARN sc -/);
});

test('check-data.js: 別の問題に同じ出典があれば NG（配列の中でも・オブジェクト1つでも）。同じ問題の中の重複も NG', () => {
  const a = runCheck((qs) => { const o = withPast(qs, [PE2, PE3]); o[0].pastExam = [{ ...PE3 }]; return o; });
  assert.equal(a.code, 1, a.out);
  assert.match(a.out, /同じ過去問題の出典（令和7年度\|秋期\|情報処理安全確保支援士試験\|午前Ⅱ\|2）が SC-01-001 にもある/);
  const b = runCheck((qs) => { const o = withPast(qs, [PE2, PE3]); o[0].pastExam = { ...PE2 }; return o; });
  assert.equal(b.code, 1, b.out);
  assert.match(b.out, /同じ過去問題の出典/);
  const c = runCheck((qs) => withPast(qs, [PE2, { ...PE2, modified: true }]));
  assert.equal(c.code, 1, c.out);
  assert.match(c.out, /同じ問題の中に2回ある/);
});

test('check-data.js: 過去問題の数を出典で数えない。出典が3つでも1問（オリジナル 1 なら WARN は「過去問題（1問）」）', () => {
  const r = runCheck((qs) => withPast(qs, [PE2, PE3, { ...PE, year: '令和3年度', no: 9 }]));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /WARN sc -: 過去問題（1問）がオリジナル（1問）以上/);
});

test('登録: 出典の部品はオフラインでも出る（sw-core.js の SHARED）。テストが package.json の一覧に入っている', () => {
  assert.ok(src('sw-core.js').includes("'../shared/js/lib/pastexam.js'"));
  assert.ok(src('package.json').includes('tests/pastexam.test.js'));
});

// ---- 複数の出典（同じ過去問題が複数の試験に出ていた場合。2026-10-29 先生決定） ----
test('出典の1行(複数): 全部を省略せず「／」でつなぐ。年度・期・試験区分・時間区分・問番号が毎回入る。改変は出典ごと', () => {
  assert.equal(pastExamCitation([PE2, PE3]), CITE_MULTI);
  assert.equal(pastExamCitation([PE2, { ...PE3, modified: true }]), CITE_MULTI + '（一部改変）');
  assert.equal(pastExamCitation([{ ...PE2, modified: true }, PE3]), CITE_MULTI.replace('問2／', '問2（一部改変）／'));
  assert.equal(pastExamCitation([PE]), CITE, '長さ1の配列はオブジェクト1つと同じ');
  assert.equal(pastExamCitation([PE2, PE3, { ...PE, year: '令和3年度', no: 9 }]).split('／').length, 3, '3回出た問題は3つ');
  assert.equal(pastExamCitation([]), '');
  assert.equal(pastExamCitation([PE2, { ...PE3, no: 26 }]), '', '1つでも崩れていれば出典の行を出さない');
});

test('整形(複数): 配列・オブジェクトのどちらも配列にそろえる。空・崩れは null', () => {
  assert.deepEqual(normalizePastExams(PE), [PE]);
  assert.deepEqual(normalizePastExams([PE2, PE3]), [PE2, PE3]);
  for (const bad of [undefined, null, 'x', 5, [], {}, [null], [PE, {}]]) assert.equal(normalizePastExams(bad), null, JSON.stringify(bad));
});

test('画面の部品(複数): pastExamLine と解説は、全部の出典を1行（p）に出す', () => {
  const q = normalizeQuestion({ ...baseQ, pastExam: [PE2, PE3] });
  assert.equal(pastExamLine(q).textContent, CITE_MULTI);
  const lines = explanation(app, sqOf(q), 1, () => {}, { sensei: false }).find((e) => e.attrs['data-past-exam'] === '1');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].textContent, CITE_MULTI);
});

// ---- 過去問題は本試験のとおり: 並べ替えず ア・イ・ウ・エ。オリジナルは今までどおり（2026-10-29 先生決定） ----
const fourQ = { id: 'SC-01-001', syllabus: ['a'], stem: '問題文です。', answer: 2, choices: ['甲', '乙', '丙', '丁'], explanation: '丙が正しい。', whyWrong: ['甲は違う', '乙は違う', null, '丁は違う'] };
const pastQ = normalizeQuestion({ ...fourQ, pastExam: [PE2, PE3] });
const origQ = normalizeQuestion(fourQ);
const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

test('過去問題は選択肢を並べ替えない: どの乱数でも印刷順のまま、answer と whyWrong もそのまま', () => {
  assert.equal(isPastQuestion(pastQ), true);
  assert.equal(isPastQuestion(origQ), false);
  assert.equal(isPastQuestion({ ...fourQ, pastExam: PE }), true, '正規化前（オブジェクト1つ）でも見分ける');
  for (let seed = 1; seed <= 60; seed++) {
    const s = shuffleChoices(pastQ, seeded(seed));
    assert.deepEqual(s.perm, [0, 1, 2, 3], 'seed ' + seed);
    assert.deepEqual(s.choices, ['甲', '乙', '丙', '丁']);
    assert.equal(s.answer, 2);
    assert.deepEqual(s.whyWrong, ['甲は違う', '乙は違う', null, '丁は違う']);
  }
  assert.deepEqual(shuffleChoices(pastQ).choices, ['甲', '乙', '丙', '丁'], '乱数を渡さなくても同じ');
});

test('オリジナルは今までどおり: 並べ替える。answer と whyWrong は選択肢と一緒に動く', () => {
  const perms = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const s = shuffleChoices(origQ, seeded(seed));
    perms.add(s.perm.join(','));
    assert.equal(s.choices[s.answer], '丙', 'seed ' + seed);
    assert.deepEqual([...s.perm].sort(), [0, 1, 2, 3]);
    s.choices.forEach((c, i) => { if (c !== '丙') assert.equal(s.whyWrong[i], fourQ.whyWrong[fourQ.choices.indexOf(c)]); });
  }
  assert.ok(perms.size > 1, '並べ替えが起きている');
  // 出典が崩れている（正規化で null）問題は過去問題として扱わない
  assert.equal(isPastQuestion({ ...fourQ, pastExam: { ...PE, no: 26 } }), false);
});

test('記号: 過去問題は ア・イ・ウ・エ、オリジナルは A〜。8つまで足りる', () => {
  assert.deepEqual(choiceLabelsOf(pastQ).slice(0, 4), ['ア', 'イ', 'ウ', 'エ']);
  assert.deepEqual(choiceLabelsOf(origQ).slice(0, 4), ['A', 'B', 'C', 'D']);
  assert.deepEqual(choiceLabelsOf(origQ), CHOICE_LABELS);
  assert.equal(choiceLabelsOf(pastQ).length, 8);
});

test('解説(explanation): 過去問題は「正解: ウ. 丙」「ア. 甲」「エ. 丁」、オリジナルは A〜D のまま', () => {
  const texts = (q) => {
    const el = explanation(app, shuffleChoices(q, seeded(3)), 0, () => {}, { sensei: false });
    return el.find((e) => typeof e.textContent === 'string' && e.textContent !== '').map((e) => e.textContent);
  };
  const p = texts(pastQ);
  assert.ok(p.includes('正解: ウ. 丙'), p.join(' | '));
  assert.ok(p.includes('ア. 甲') && p.includes('イ. 乙') && p.includes('エ. 丁'), p.join(' | '));
  assert.ok(!p.some((t) => /^[A-D]\. /.test(t)), '過去問題に A〜D の記号が出ない');
  const o = texts(origQ);
  assert.ok(o.some((t) => /^正解: [A-D]\. 丙$/.test(t)), o.join(' | '));
  assert.ok(!o.some((t) => /^[ア-エ]\. /.test(t)), 'オリジナルに ア〜エ が出ない');
});

test('結線: 出題・ボス戦・模擬試験・あとで見る・真ボスが、選択肢の記号を問題ごとに choiceLabelsOf(q) で出す。固定の CHOICE_LABELS を使わない', () => {
  for (const f of ['js/views/play.js', 'js/views/boss.js', 'js/views/exam.js', 'js/views/later.js', 'js/views/trueboss.js']) {
    const s = src(f);
    assert.ok(s.includes('choiceLabelsOf(q)[i]'), f + ' が問題ごとの記号を使っていない');
    assert.ok(!s.includes('CHOICE_LABELS['), f + ' に固定の記号が残っている');
  }
  // 解説（正解・誤答の一覧・あなたの回答）は問題ごとの記号
  const ex = src('js/views/explain.js');
  assert.ok(ex.includes('const labels = choiceLabelsOf(q);') && !ex.includes('CHOICE_LABELS['), 'explain.js');
  // 並べ替えは shuffleChoices 1か所。過去問題を除くのもそこ
  assert.ok(src('js/lib/quiz.js').includes('isPastQuestion(q) ? order'), 'shuffleChoices が過去問題を除いていない');
  // 復習（weak.js）も shuffleChoices を通るので並べ替わらない。通らない呼び出しが無いこと
  for (const f of ['js/views/play.js', 'js/views/boss.js', 'js/views/exam.js', 'js/views/trueboss.js', 'js/views/weak.js']) assert.ok(src(f).includes('shuffleChoices('), f);
});
