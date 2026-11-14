// 引退した用語カードの見せ方（2026-11-14 先生決定 A。要件定義書 §7-6）。
// 門番が先生に出した案（逐語）「用語の一覧、『どっち？』、カードめくりからは隠す。解説やほかのカードのリンクから開いたときだけ、
// 『古い事例（2025年5月の事実）』の印を付けて見せる。リンクは切れんし、古い事実を新しいもののようにも見せん」。先生（逐語）「A」。
// 見ること:
//   - 読み込み（shared/js/lib/data.js の loadData）が、引退したカードを concepts と木から外し、retiredConcepts に分ける。
//     conceptIndex と backlinks には残す（リンクを切らない）。同じ題名なら引退していないカードに解決する
//   - concepts と木から作るもの（カードの一覧の木・カードめくり・カードのあとで見る・基礎のことばの照合）に出ない
//   - どっち？（lib/dochi.js の buildPairs）は、引退したカードの組も、引退したカードを相手にする組も作らない
//   - 印の文字（retiredLabel）と、画面（偽の DOM）で: リンクから開いたカードに『古い事例』の印と説明の1行、『未確認』は出さない、
//     『あとで見る』を出さない。解説の『まず用語を確認しよう』『関連する用語カード』、ほかのカードの『つながり』から引退したカードへ行ける
// 実行: cd shared && node --test tests/retiredcard.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData, resolveRef, retiredLabel } from '../js/lib/data.js';
import { buildPairs } from '../js/lib/dochi.js';
import { cardSections } from '../js/lib/cardtree.js';
import { flipDeck, flipCounts, sectionCards } from '../js/lib/flip.js';
import { laterCardItems, laterCardCount } from '../js/lib/later.js';
import { buildMatcher, fold } from '../js/lib/basics.js';

// ---- 読み込み ----
const C = (id, title, extra = {}) => ({ id, syllabus: ['大', '中', '小'], title, oneLine: title + 'の一行目。', why: 'w', links: [], confusions: [], sources: [], status: 'verified', ...extra });
const FILES = {
  'index.json': { syllabus: 'syllabus.json', questions: ['q.json'], concepts: ['c.json'] },
  'syllabus.json': [{ title: '大', children: [{ title: '中', children: [{ title: '小' }] }] }],
  'q.json': [],
  'c.json': [
    C('C-A', '新しい事例', { links: [{ id: 'C-OLD', relation: 'related' }], confusions: [{ id: 'C-OLD', point: '年が違う' }] }),
    C('C-OLD', '古い事例のカード', { status: 'retired', asOf: '2025-05', reviewBy: '2026-05', links: [{ id: 'C-A', relation: 'related' }], confusions: [{ id: 'C-A', point: '新旧' }] }),
    C('C-B', '別のカード', { confusions: [{ id: 'C-A', point: 'ちがい' }] }),
    C('C-NOSYL', '分野の無い古いカード', { status: 'retired', syllabus: [] }),
    C('C-SAME-OLD', '同じ題名', { status: 'retired' }), // 引退していないカードと同じ題名（引退したほうが先に並んでいても、題名では新しいほうに解決する）
    C('C-SAME', '同じ題名'),
  ],
};
function fakeFetch(files) {
  return async (url) => {
    const name = url.replace('http://x/data/', '');
    if (!(name in files)) return { ok: false, status: 404, json: async () => { throw new Error('404'); } };
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(files[name])) };
  };
}
const load = () => loadData({ dataBase: 'http://x/data/', fetchFn: fakeFetch(FILES) });
const ids = (xs) => xs.map((c) => c.id);

test('loadData: 引退したカードは concepts と木に入らず retiredConcepts に入る。conceptIndex と backlinks には残る', async () => {
  const d = await load();
  assert.deepEqual(ids(d.concepts), ['C-A', 'C-B', 'C-SAME']);
  assert.deepEqual(ids(d.retiredConcepts), ['C-OLD', 'C-NOSYL', 'C-SAME-OLD']);
  // 木のどの節にも入らない（章・地図の『カード◯枚』はここから数える）
  for (const n of d.tree.byKey.values()) assert.ok(!n.concepts.some((c) => c.status === 'retired'), n.key);
  assert.equal(d.tree.stages.find((s) => s.name === '中').concepts.length, 3);
  // リンクは切らない: ID でも題名でも引ける
  assert.equal(d.conceptIndex.byId.get('C-OLD').id, 'C-OLD');
  assert.equal(resolveRef({ title: '古い事例のカード' }, d.conceptIndex).concept.id, 'C-OLD');
  // 同じ題名なら、引退していないほうに解決する
  assert.equal(resolveRef({ title: '同じ題名' }, d.conceptIndex).concept.id, 'C-SAME');
  // 引退したカードから張られたつながりも、引退したカードへのつながりも残る
  assert.ok(d.backlinks.get('C-A').some((b) => b.from.id === 'C-OLD' && b.kind === 'link'));
  assert.ok(d.backlinks.get('C-OLD').some((b) => b.from.id === 'C-A' && b.kind === 'link'));
  assert.equal(d.problems.length, 0);
});

test('一覧の木・カードめくり・カードのあとで見る・基礎のことばの照合に、引退したカードは出ない（記録は消さない）', async () => {
  const d = await load();
  const secs = cardSections(d.tree, d.concepts);
  const all = secs.flatMap(sectionCards);
  assert.deepEqual(ids(all).sort(), ['C-A', 'C-B', 'C-SAME']);
  assert.ok(!secs.some((s) => s.key === '#loose'), '分野の無い引退したカードで「その他」の節ができた');
  // カードめくり（views/flip.js は app.data.concepts と cardSections から山を作る）
  const state = { flip: { 'C-OLD': { ok: false, at: 1 } }, laterCards: { 'C-OLD': 5, 'C-A': 3 } };
  assert.deepEqual(ids(flipDeck(state, d.concepts)), ['C-A', 'C-B', 'C-SAME']);
  assert.deepEqual(flipCounts(state, d.concepts), { ok: 0, ng: 0, fresh: 3 });
  // カードのあとで見る（印は記録に残り、status を戻せば一覧に戻る）
  assert.deepEqual(laterCardItems(state, d.concepts).map((x) => x.c.id), ['C-A']);
  assert.equal(laterCardCount(state, d.concepts), 1);
  assert.equal(state.laterCards['C-OLD'], 5);
  // 基礎のことばの照合（app.js が buildMatcher(basics, data.concepts) で作る）: 引退したカードの題名は『印を付けない語』に入れない
  const m = buildMatcher([], d.concepts);
  assert.ok(m.byKey.has(fold('新しい事例').trim()));
  assert.ok(!m.byKey.has(fold('古い事例のカード').trim()));
});

test('どっち？: 引退したカードの組も、引退したカードを相手にする組も作らない', async () => {
  const d = await load();
  const { pairs, skipped } = buildPairs(d.concepts, d.conceptIndex);
  assert.deepEqual(pairs.map((p) => p.key), ['C-B>C-A']); // C-A>C-OLD（相手が引退）は作らない
  assert.equal(skipped.retired, 1);
  // 引退したカードを一覧に混ぜて渡しても、そのカードの組は作らない
  const mixed = buildPairs(d.concepts.concat(d.retiredConcepts), d.conceptIndex);
  assert.deepEqual(mixed.pairs.map((p) => p.key), ['C-B>C-A']);
  assert.equal(mixed.skipped.retired, 2); // C-A>C-OLD と C-OLD>C-A
});

test('retiredLabel: asOf があれば年月つき、無い・形が違えば「古い事例」だけ。引退していなければ空', () => {
  assert.equal(retiredLabel({ status: 'retired', asOf: '2025-05' }), '古い事例（2025年5月の事実）');
  assert.equal(retiredLabel({ status: 'retired', asOf: '2024-12' }), '古い事例（2024年12月の事実）');
  assert.equal(retiredLabel({ status: 'retired', asOf: null }), '古い事例');
  assert.equal(retiredLabel({ status: 'retired', asOf: '2025-5' }), '古い事例');
  assert.equal(retiredLabel({ status: 'retired' }), '古い事例');
  assert.equal(retiredLabel({ status: 'verified', asOf: '2025-05' }), '');
  assert.equal(retiredLabel({ status: 'unverified' }), '');
  assert.equal(retiredLabel(null), '');
});

// ---------- 画面（DOM の代わりの偽物で動かして見る。basics.test.js と同じ形）----------
class FakeEl {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.className = ''; this.textContent = ''; this.value = ''; this.style = {}; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  removeAttribute(k) { delete this.attrs[k]; }
  get classList() { return { toggle() {}, add() {}, remove() {}, contains: () => false }; }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  find(pred, out = []) { if (pred(this)) out.push(this); for (const c of this.children) if (c instanceof FakeEl) c.find(pred, out); return out; }
  text() { return this.textContent + this.children.map((c) => (c instanceof FakeEl ? c.text() : c.text)).join(''); }
}
globalThis.document = { createElement: (t) => new FakeEl(t), createTextNode: (s) => ({ text: s }) };
globalThis.location = { href: 'http://localhost/g-kentei/', hash: '#/cards' };
globalThis.history = { back() {} };
const { cardBody, statusChip, retiredChip } = await import('../js/views/cards.js');
const { stumbleBlock, explanation } = await import('../js/views/explain.js');

const mkApp = (d) => ({ data: { ...d, basics: [], basicsMatcher: null }, state: { settings: {}, laterCards: {} }, go() {}, dataBase: 'http://localhost/g-kentei/data/' });
const marks = (el) => el.find((e) => e.hasAttribute && e.hasAttribute('data-retired'));
const unverified = (el) => el.find((e) => e.className === 'chip unverified');
const linkTo = (el, title) => el.find((e) => e.tag === 'button' && e.className === 'chip link' && e.text() === title);

test('画面: リンクから開いた引退カードに『古い事例（2025年5月の事実）』の印と説明。『未確認』と『あとで見る』は出さない', async () => {
  const d = await load();
  const app = mkApp(d);
  const old = cardBody(app, d.conceptIndex.byId.get('C-OLD'), () => {});
  assert.deepEqual(marks(old).map((e) => e.text()), ['古い事例（2025年5月の事実）']);
  assert.equal(marks(old)[0].className, 'chip warn');
  assert.ok(marks(old)[0].getAttribute('title'));
  assert.equal(unverified(old).length, 0);
  assert.equal(old.find((e) => e.hasAttribute && e.hasAttribute('data-retired-note')).length, 1);
  assert.equal(old.find((e) => e.className === 'later-row').length, 0);
  // asOf の無い引退カードは「古い事例」だけ
  const nos = cardBody(app, d.conceptIndex.byId.get('C-NOSYL'), () => {});
  assert.deepEqual(marks(nos).map((e) => e.text()), ['古い事例']);
  // 引退していないカードには印が無く、『あとで見る』がある。つながり・混同から引退したカードへ行ける（リンクは切れない）
  const a = cardBody(app, d.conceptIndex.byId.get('C-A'), () => {});
  assert.equal(marks(a).length, 0);
  assert.equal(a.find((e) => e.className === 'later-row').length, 1);
  assert.ok(linkTo(a, '古い事例のカード').length >= 2, 'つながり・よくある混同・このカードに来るもののリンクが無い');
  // 『未確認』は引退には出さず、unverified には今までどおり出す
  assert.equal(statusChip('retired'), null);
  assert.equal(statusChip('verified'), null);
  assert.equal(statusChip('unverified').text(), '未確認');
  assert.equal(retiredChip(d.conceptIndex.byId.get('C-A')), null);
});

test('画面: 解説の『まず用語を確認しよう』は引退カードの題名の横に印を付け、『関連する用語カード』から開ける', async () => {
  const d = await load();
  const app = mkApp(d);
  const q = { id: 'Q1', format: 'single', concepts: ['C-OLD', 'C-B'], explanation: 'e', memoryTip: '', figures: [], sources: [] };
  const st = stumbleBlock(app, q, () => {});
  assert.deepEqual(marks(st).map((e) => e.text()), ['古い事例（2025年5月の事実）']);
  // 印は引退カードの項目にだけ付く
  const items = st.find((e) => e.className === 'stumble-item');
  assert.deepEqual(items.map((it) => marks(it).length), [1, 0]);
  const ex = explanation(app, { q, choices: ['甲', '乙'], answer: 0, whyWrong: [null, 'x'] }, 1, () => {}, { sensei: false, later: false });
  assert.equal(linkTo(ex, '古い事例のカード').length >= 1, true);
});
