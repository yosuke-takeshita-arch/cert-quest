// 問題文の意味（回答後の解説に出す。要件定義書 §7-3）: stemPlain の整形、解説の先頭の欄の出し分け、結線。
// 実行: cd shared && node --test tests/stemplain.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
globalThis.location = { href: 'http://localhost/g-kentei/' };
const { explanation, stemPlainBlock } = await import('../js/views/explain.js');

const concepts = [normalizeConcept({ id: 'C-01-001', title: '過学習', oneLine: '訓練データに合わせすぎること。', why: 'w', syllabus: ['a'] })];
const app = { data: { concepts, conceptIndex: buildConceptIndex(concepts), figures: {} }, state: { settings: {} } };
const mkQ = (o) => normalizeQuestion({ id: 'G-01-001', syllabus: ['a'], stem: '過学習について述べた文はどれか。', answer: 0, choices: ['選択肢甲です', '選択肢乙です'], explanation: '甲が正しい。', concepts: ['C-01-001'], ...o });
const draw = (q) => explanation(app, { q, choices: q.choices, answer: q.answer, whyWrong: [null, '乙は違う'] }, 1, () => {}, { sensei: false });

test('stemPlain: データの整形で残る（前後の空白は削る・無ければ空文字・文字列以外は空文字）', () => {
  assert.equal(mkQ({ stemPlain: '  やさしく言うと  ' }).stemPlain, 'やさしく言うと');
  assert.equal(mkQ({}).stemPlain, '');
  assert.equal(mkQ({ stemPlain: 5 }).stemPlain, '');
});

test('欄: stemPlain があれば「問題文の意味」の欄を返し、中身は stemPlain の文。無い問題は null（空の欄を置かない）', () => {
  const el = stemPlainBlock(mkQ({ stemPlain: '過学習の特徴を選ぶ問題です。' }));
  assert.ok(el.className.includes('stem-plain'));
  assert.equal(el.children[0].textContent, '問題文の意味');
  assert.equal(el.children[1].textContent, '過学習の特徴を選ぶ問題です。');
  assert.equal(stemPlainBlock(mkQ({})), null);
});

test('解説(explanation)の中には欄を置かない（呼ぶ側が先に置くので二重にならない）', () => {
  const box = explanation(app, { q: mkQ({ stemPlain: 'x' }), choices: ['a', 'b'], answer: 0, whyWrong: [null, 'w'] }, 1, () => {}, { sensei: false });
  assert.equal(box.find((e) => e.className.includes('stem-plain')).length, 0);
});

test('順序: どの画面でも、問題文の意味 → まず用語を確認しよう → 解説。stumbleBlock を呼ぶ所は必ず直前に stemPlainBlock がある', () => {
  const play = src('js/views/play.js');
  // 出題画面で答えたあと（間違い）: 意味の追加が stumbleBlock の呼び出しより前、explanation より前
  const iMeaning = play.indexOf('if (meaning) after.appendChild(meaning); //');
  const iStumble = play.indexOf('stumbleBlock(app, sq.q, open)');
  const iExplain = play.indexOf('after.appendChild(explanation(app, sq');
  assert.ok(iMeaning > 0 && iMeaning < iStumble && iStumble < iExplain, '出題画面: 意味 → 用語 → 解説');
  // 正解のときも解説より前（正解の枝の先頭で追加している）
  assert.ok(/if \(correct\) \{\s*if \(meaning\) after\.appendChild\(meaning\);/.test(play));
  // 結果画面の一覧（用語の欄は無い）: 意味 → 解説
  assert.ok(play.includes('stemPlainBlock(r.q), explanation('));
  // 模擬試験の見直し: 意味 → 用語 → 解説
  assert.ok(src('js/views/exam.js').includes('stemPlainBlock(r.q), stumbleBlock(app, r.q, open), explanation('));
});

test('結線: 出題画面(play.js)に「問題文の意味」のボタンを置かない。解説は play.js・exam.js から共通の explanation を使う', () => {
  const play = src('js/views/play.js');
  assert.ok(!/stemhelp|stemHelp|stem-help/.test(play));
  assert.ok(play.includes('explanation(app, sq, chosen'));
  assert.ok(src('js/views/exam.js').includes('explanation(app, r.sq'));
});

test('撤去: 問答の前に出す仕組み(stemhelp)が残っていない。sw-core.js の一覧・CSS からも消えている。2つのアプリの sw.js の version がそろっている', () => {
  assert.ok(!/stemhelp/.test(src('sw-core.js')));
  assert.ok(!/stem-help/.test(src('css/app.css')));
  const ver = (app) => /version:\s*'(\d+)'/.exec(readFileSync(join(root, app, 'sw.js'), 'utf8'))[1];
  assert.equal(ver('g-kentei'), ver('dx-biz'));
  assert.ok(Number(ver('g-kentei')) >= 43);
});

test('stemPlain の上限は 200 文字（tools/check-data*.js）。選択肢の文を含む検査は無い（回答後に出すため）', () => {
  for (const f of ['tools/check-data.js', 'tools/check-data-dx.js']) {
    const s = readFileSync(join(root, f), 'utf8');
    assert.ok(/const STEM_PLAIN_MAX = 200;/.test(s), f);
    assert.ok(!/stemPlain に選択肢/.test(s), f);
  }
});
