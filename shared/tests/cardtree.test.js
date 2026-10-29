// 用語カードを分野で見る（シラバスの分け方で並べる）: 並べ方の計算、表示の設定の保存、画面とオフライン登録との突き合わせ。
// 2026-10-14 先生「技術分野→機械学習の概要→教師あり学習 の分け方で観れないのが残念。全カードがズラッと並んで検索できる画面は残して」。
// 見ていないもの: 実際の見た目（開け閉め・戻ったときの位置）。それは画面で確かめる。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { CARD_VIEWS, DEFAULT_CARD_VIEW, normalizeCardView, cardSections } from '../js/lib/cardtree.js';
import { buildTree, loadData } from '../js/lib/data.js';
import { defaultState, mergeState } from '../js/lib/progress.js';
import { createStorage } from '../js/lib/storage.js';
import { parseBackup, serializeBackup } from '../js/lib/backup.js';
import { APPS, APPS_WITHOUT_CONTENT, root } from './apps.js';

const read = (p) => readFileSync(join(root, p), 'utf8');
const fileFetch = async (u) => {
  try {
    const t = readFileSync(fileURLToPath(u), 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(t), text: async () => t };
  } catch { return { ok: false, status: 404, json: async () => null, text: async () => '' }; }
};
const concept = (id, syllabus) => ({ id, title: id, oneLine: '', syllabus, links: [], confusions: [], sources: [], figures: [] });
const allCards = (secs) => {
  const out = [];
  const walk = (s) => { out.push(...s.cards); s.children.forEach(walk); };
  secs.forEach(walk);
  return out;
};

test('表示の設定: 2つ、初期は分野で見る。正規化・古い記録・保存と読み出し・書き出しで保たれる', () => {
  assert.deepEqual(CARD_VIEWS, ['tree', 'all']);
  assert.equal(DEFAULT_CARD_VIEW, 'tree');
  for (const k of CARD_VIEWS) assert.equal(normalizeCardView(k), k);
  for (const bad of [undefined, null, '', 'list', 'TREE', ' all', 1, true, {}, ['all'], '__proto__', 'toString']) assert.equal(normalizeCardView(bad), 'tree', String(bad));
  assert.equal(defaultState().settings.cardView, 'tree');
  assert.equal(mergeState({ settings: { theme: 'dark' } }).settings.cardView, 'tree', '古い記録（項目なし）');
  assert.equal(mergeState({ settings: { cardView: 'all' } }).settings.cardView, 'all');
  assert.equal(mergeState({ settings: { cardView: 'bad' } }).settings.cardView, 'tree');
  const mem = new Map();
  const fake = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const s = createStorage('k', fake).load();
  s.settings.cardView = 'all';
  createStorage('k', fake).save(s);
  assert.equal(createStorage('k', fake).load().settings.cardView, 'all');
  const out = parseBackup(serializeBackup('x', s, new Date('2026-10-14T00:00:00Z')), 'x');
  assert.equal(out.ok, true);
  assert.equal(out.state.settings.cardView, 'all');
});

test('並べ方: シラバスの順。カードの無い節は出さない。中項目に直接付いたカードと小項目のカードを分ける。分け方の無いカードは最後の「その他」', () => {
  const syl = [
    { name: '技術', children: [{ name: '機械学習', children: ['教師あり', '教師なし'] }, { name: '空の中項目', children: ['x'] }] },
    { name: '法律', children: [{ name: '個人情報', children: ['定義'] }] },
    { name: '空の分野', children: [{ name: 'y', children: ['z'] }] },
  ];
  const cs = [
    concept('a', ['法律', '個人情報', '定義']),
    concept('b', ['技術', '機械学習', '教師なし']),
    concept('c', ['技術', '機械学習', '教師あり']),
    concept('d', ['技術', '機械学習']),
    concept('e', []),
    concept('f', ['技術']),
  ];
  const tree = buildTree(syl, [], cs);
  const secs = cardSections(tree, cs);
  assert.deepEqual(secs.map((s) => s.name), ['技術', '法律', 'その他'], 'シラバスの順・空の分野は出さない・その他は最後');
  const tech = secs[0];
  assert.equal(tech.count, 4);
  assert.deepEqual(tech.cards, [], '分野の直下にカードは置かない（1段だけのカードは「全般」へ）');
  assert.deepEqual(tech.children.map((s) => s.name), ['機械学習', '全般'], '空の中項目は出さない');
  const ml = tech.children[0];
  assert.deepEqual(ml.cards.map((c) => c.id), ['d'], '中項目に直接付いたカード');
  assert.deepEqual(ml.children.map((s) => [s.name, s.count, s.cards.map((c) => c.id).join()]), [['教師あり', 1, 'c'], ['教師なし', 1, 'b']], '小項目はシラバスの順');
  assert.deepEqual(tech.children[1].cards.map((c) => c.id), ['f']);
  assert.deepEqual(secs[2].cards.map((c) => c.id), ['e']);
  assert.equal(new Set(secs.map((s) => s.key)).size, secs.length, 'key が重ならない（開いた節を覚えるのに使う）');
});

for (const app of APPS) {
  test(`${app}: 本物のデータで、どのカードも分野で見る画面にちょうど1回出て、数が合う`, async () => {
    const d = await loadData({ dataBase: pathToFileURL(join(root, app, 'data')).href + '/', fetchFn: fileFetch });
    if (!APPS_WITHOUT_CONTENT.includes(app)) assert.ok(d.concepts.length > 0, app + ' のカードが読めていない');
    const secs = cardSections(d.tree, d.concepts);
    const shown = allCards(secs);
    assert.equal(shown.length, d.concepts.length, '出たカードの数 = 全部のカードの数');
    assert.equal(new Set(shown).size, shown.length, '同じカードが2回出ない');
    const check = (s) => {
      assert.equal(s.count, s.cards.length + s.children.reduce((n, ch) => n + ch.count, 0), s.name + ' の数が中身の合計と合わない');
      s.children.forEach(check);
    };
    secs.forEach(check);
  });
}

test('画面: 切り替えの2つのボタン・選んだ表示の保存・検索の一覧を残す・オフライン登録', () => {
  const v = read('shared/js/views/cards.js');
  assert.match(v, /'分野で見る'/);
  assert.match(v, /'一覧・検索'/);
  assert.match(v, /state\.settings\.cardView\s*=/, '選んだ表示を保存する');
  assert.match(v, /app\.commit\(\)/);
  assert.match(v, /cardSections\(app\.data\.tree, app\.data\.concepts\)/);
  assert.match(v, /type: 'search'/, '検索の一覧は残す');
  assert.match(read('shared/sw-core.js'), /'\.\.\/shared\/js\/lib\/cardtree\.js'/, 'オフラインで開けるよう先取りに載せる');
  const css = read('shared/css/app.css');
  for (const cls of ['.card-tree-inner', 'details.card-sub', '.card-small-title']) assert.ok(css.includes(cls), cls + ' の見た目が無い');
});
