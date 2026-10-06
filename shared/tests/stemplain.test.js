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
const { explanation } = await import('../js/views/explain.js');

const concepts = [normalizeConcept({ id: 'C-01-001', title: '過学習', oneLine: '訓練データに合わせすぎること。', why: 'w', syllabus: ['a'] })];
const app = { data: { concepts, conceptIndex: buildConceptIndex(concepts), figures: {} }, state: { settings: {} } };
const mkQ = (o) => normalizeQuestion({ id: 'G-01-001', syllabus: ['a'], stem: '過学習について述べた文はどれか。', answer: 0, choices: ['選択肢甲です', '選択肢乙です'], explanation: '甲が正しい。', concepts: ['C-01-001'], ...o });
const draw = (q) => explanation(app, { q, choices: q.choices, answer: q.answer, whyWrong: [null, '乙は違う'] }, 1, () => {}, { sensei: false });

test('stemPlain: データの整形で残る（前後の空白は削る・無ければ空文字・文字列以外は空文字）', () => {
  assert.equal(mkQ({ stemPlain: '  やさしく言うと  ' }).stemPlain, 'やさしく言うと');
  assert.equal(mkQ({}).stemPlain, '');
  assert.equal(mkQ({ stemPlain: 5 }).stemPlain, '');
});

test('解説: stemPlain があれば、先頭に「問題文の意味」の欄が出て、中身は stemPlain の文', () => {
  const box = draw(mkQ({ stemPlain: '過学習の特徴を選ぶ問題です。' }));
  const first = box.children[0];
  assert.ok(first.className.includes('stem-plain'), '先頭の欄');
  assert.equal(first.children[0].textContent, '問題文の意味');
  assert.equal(first.children[1].textContent, '過学習の特徴を選ぶ問題です。');
  assert.equal(box.find((e) => e.className.includes('stem-plain')).length, 1);
});

test('解説: stemPlain が無い問題には欄を出さない（空の欄を置かない）', () => {
  const box = draw(mkQ({}));
  assert.equal(box.find((e) => e.className.includes('stem-plain')).length, 0);
  assert.ok(box.children[0].className.includes('ex-block')); // 正解の理由が先頭のまま
});

test('結線: 問題を解く画面(play.js)に「問題文の意味」のボタンを置かない。解説は play.js・exam.js から共通の explanation を使う', () => {
  const play = src('js/views/play.js');
  assert.ok(!/stemhelp|stemHelp|stem-help/.test(play));
  assert.ok(/explanation\(app, sq, chosen/.test(play));
  assert.ok(/explanation\(app, r\.sq/.test(src('js/views/exam.js')));
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
