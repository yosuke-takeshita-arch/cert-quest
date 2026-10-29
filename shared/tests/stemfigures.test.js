// 答える前に問題文の下へ出す図・表 stemFigures（要件定義書 §7）: データの整形、部品の出し分け、問題を出す画面すべてへの結線。データ検査（check-data）の落ち方は figures.test.js。
// 実行: cd shared && node --test tests/stemfigures.test.js
// 見ていないもの: 実ブラウザでの見た目（幅360pxで横にはみ出さない・明暗両方で読める）。DOM は最小の偽物なので、SVG が実際に描かれるところまでは見ない。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeQuestion } from '../js/lib/data.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const view = (n) => readFileSync(join(shared, 'js', 'views', n), 'utf8');

class FakeEl {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.className = ''; this.textContent = ''; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener() {}
  find(pred, out = []) { if (pred(this)) out.push(this); for (const c of this.children) if (c instanceof FakeEl) c.find(pred, out); return out; }
}
globalThis.document = { createElement: (t) => new FakeEl(t), createTextNode: (s) => ({ text: s }) };
globalThis.location = { href: 'http://localhost/sc/' };
globalThis.fetch = () => new Promise(() => {}); // 図の取得は待たせたままにする（ここでは枠の出し分けだけ見る）
const { stemFigureBlock } = await import('../js/views/explain.js');

const app = { dataBase: 'http://localhost/sc/data/' };
const mkQ = (o) => normalizeQuestion({ id: 'S-01-001', syllabus: ['a'], stem: '表中の項番1と2に当てはまるものはどれか。', answer: 0, choices: ['ア', 'イ'], ...o });

test('stemFigures: 整形（不正な ID と重複は落とす・無ければ空配列）。figures とは別の欄', () => {
  assert.deepEqual(mkQ({}).stemFigures, []);
  assert.deepEqual(mkQ({ stemFigures: 'fig-a' }).stemFigures, []);
  assert.deepEqual(mkQ({ stemFigures: ['fig-b', '../x', 'fig-a', 'fig-b'] }).stemFigures, ['fig-b', 'fig-a']);
  const q = mkQ({ figures: ['fig-x'], stemFigures: ['fig-y'] });
  assert.deepEqual(q.figures, ['fig-x']);
  assert.deepEqual(q.stemFigures, ['fig-y']);
});

test('部品: stemFigures がある問題は図の枠を返し、順に並べる。無い問題は null（何も出さない）', () => {
  const blk = stemFigureBlock(app, mkQ({ stemFigures: ['fig-s-a', 'fig-s-b'] }));
  assert.ok(blk, '枠が返らない');
  assert.deepEqual(blk.find((e) => e.attrs['data-fig']).map((e) => e.attrs['data-fig']), ['fig-s-a', 'fig-s-b']);
  assert.match(blk.className, /stem-figures/);
  assert.equal(stemFigureBlock(app, mkQ({})), null);
  assert.equal(stemFigureBlock(app, mkQ({ figures: ['fig-x'] })), null, 'figures（解説の図）は答える前には出さない');
});

// 問題を出す画面（問題文を card に置く場所）すべてで、問題文の後・選択肢の前に呼んでいること
const SCREENS = [
  ['play.js', "class: 'choices'"],
  ['boss.js', "class: 'choices'"],
  ['trueboss.js', "class: 'choices'"],
  ['exam.js', "class: 'choices'"],
  ['later.js', "class: 'read-choices'"],
];
for (const [file, choicesMark] of SCREENS) {
  test(`${file}: 問題文の直後・選択肢の前に stemFigureBlock を置く`, () => {
    const s = view(file);
    const stem = s.indexOf("class: 'stem', text: q.stem");
    const fig = s.indexOf(file === 'exam.js' ? 'stemFigureBlock(app, q),' : 'card.appendChild(stemFig)'); // 呼ぶだけでなく card に足していること
    const ch = s.indexOf(choicesMark);
    assert.ok(stem >= 0 && fig >= 0 && ch >= 0, `${file}: 目印が見つからない`);
    assert.ok(stem < fig && fig < ch, `${file}: 順が 問題文 → 図 → 選択肢 になっていない`);
  });
}

test('見直しの一覧（開くと問題文が出ない所）にも出す: play・boss・exam・trueboss・weak', () => {
  for (const f of ['play.js', 'boss.js', 'exam.js', 'trueboss.js', 'weak.js']) {
    const s = view(f);
    const n = (s.match(/stemFigureBlock\(app, (?:r|x)\.q\)/g) || []).length;
    assert.equal(n, 1, `${f}: 見直しの一覧に stemFigureBlock が ${n} 回（1回のはず）`);
  }
});

test('問題文を card に置く画面を漏らさない: views/ で class: stem の p を作るファイルはすべて stemFigureBlock を呼ぶ', () => {
  for (const f of readdirSync(join(shared, 'js', 'views')).filter((x) => x.endsWith('.js'))) {
    const s = view(f);
    if (/class: 'stem', text: q\.stem/.test(s)) assert.ok(s.includes('stemFigureBlock(app, q)'), `${f}: 問題文を描いているのに stemFigureBlock が無い`);
  }
});
