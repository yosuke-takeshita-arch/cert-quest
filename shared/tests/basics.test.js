// 基礎のことば（要件定義書 §7-5）の確認: データの読み込み、文中で見つける照合、検査（tools/check-basics.cjs）、サービスワーカーの先取り、画面の結線。
// 実行: cd shared && node --test tests/basics.test.js
// 画面の見え方・押したときの窓は DOM が要るのでここでは見ない（ブラウザで確かめる）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import {
  normalizeBasic, normalizeBasics, loadBasics, fold, titleForms, buildMatcher, segmentText, MIN_TERM_LEN, BASICS_FILE,
} from '../js/lib/basics.js';
import { loadData, normalizeConcept, buildConceptIndex } from '../js/lib/data.js';
import { APPS } from './apps.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(shared, '..');
const src = (p) => readFileSync(join(shared, p), 'utf8');
const require = createRequire(import.meta.url);

const B = (id, term, extra = {}) => normalizeBasic({ id, term, oneLine: term + 'の一言', why: term + 'の説明', ...extra });
const C = (id, title) => ({ id, title });
const join_ = (segs) => segs.map((s) => s.text).join('');
const linked = (segs) => segs.filter((s) => s.id).map((s) => s.text + ':' + s.id);

// ---------- 読み込み ----------

test('1語の整形: id と term が無ければ捨てる。aliases は空・重複・term と同じものを落とし、related も重複を落とす', () => {
  assert.equal(normalizeBasic(null), null);
  assert.equal(normalizeBasic({ term: 'a' }), null);
  assert.equal(normalizeBasic({ id: 'B-001' }), null);
  assert.equal(normalizeBasic({ id: 'B-001', term: '  ' }), null);
  const b = normalizeBasic({ id: ' B-001 ', term: ' 次元 ', aliases: ['次元数', '', '次元', '次元数', 5, ' 軸の数 '], oneLine: ' 一言 ', related: ['C-1', 'C-1', '', 'C-2'], figures: ['fig-g-a', '../x', 'fig-g-a'] });
  assert.equal(b.id, 'B-001');
  assert.equal(b.term, '次元');
  assert.deepEqual(b.aliases, ['次元数', '軸の数']);
  assert.equal(b.oneLine, '一言');
  assert.equal(b.why, '');
  assert.deepEqual(b.related, ['C-1', 'C-2']);
  assert.deepEqual(b.figures, ['fig-g-a']);
  const c = normalizeBasic({ id: 'B-002', term: 'x1' });
  assert.deepEqual([c.aliases, c.related, c.figures, c.oneLine, c.why], [[], [], [], '', '']);
});

test('配列の整形: 形が崩れた1語・id の重複は捨てて problems に書く。{ basics: [...] } でもよい。配列でないものは空', () => {
  const r = normalizeBasics([{ id: 'B-001', term: 'a1' }, null, { id: 'B-001', term: 'dup' }, { id: 'B-002' }, { id: 'B-003', term: 'c3' }]);
  assert.deepEqual(r.items.map((x) => x.id), ['B-001', 'B-003']);
  assert.equal(r.problems.length, 3);
  assert.deepEqual(normalizeBasics({ basics: [{ id: 'B-001', term: 'a1' }] }).items.map((x) => x.id), ['B-001']);
  assert.deepEqual(normalizeBasics([]), { items: [], problems: [] });
  assert.deepEqual(normalizeBasics({ foo: 1 }).items, []);
  assert.equal(normalizeBasics({ foo: 1 }).problems.length, 1);
  assert.equal(normalizeBasics('壊れた').problems.length, 1);
  assert.deepEqual(normalizeBasics(undefined), { items: [], problems: [] });
});

const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (body instanceof Error) throw body; return body; } });

test('basics.json を読む: 無い(404)・空・壊れた JSON・通信の失敗でも投げず、基礎のことば無しで返る（404 と空は問題として数えない）', async () => {
  const ok = await loadBasics('http://x/basics.json', async () => resp(200, [{ id: 'B-001', term: '次元' }]));
  assert.deepEqual(ok.items.map((b) => b.term), ['次元']);
  assert.deepEqual(await loadBasics('http://x/basics.json', async () => resp(404, null)), { items: [], problems: [] });
  assert.deepEqual(await loadBasics('http://x/basics.json', async () => resp(200, [])), { items: [], problems: [] });
  const bad = await loadBasics('http://x/basics.json', async () => resp(200, new SyntaxError('Unexpected token')));
  assert.deepEqual(bad.items, []);
  assert.equal(bad.problems.length, 1);
  const server = await loadBasics('http://x/basics.json', async () => resp(500, null));
  assert.deepEqual(server.items, []);
  assert.equal(server.problems.length, 1);
  const net = await loadBasics('http://x/basics.json', async () => { throw new TypeError('Failed to fetch'); });
  assert.deepEqual(net.items, []);
  assert.equal(net.problems.length, 1);
  const wrongShape = await loadBasics('http://x/basics.json', async () => resp(200, { oops: true }));
  assert.deepEqual(wrongShape.items, []);
});

test('loadData: index.json の basics で名前を変えられ、書かなければ basics.json。basics と basicsMatcher は app.js が入れるので最初は空', async () => {
  const mk = (index) => async (u) => {
    if (u.endsWith('index.json')) return resp(200, index);
    return resp(404, null);
  };
  const a = await loadData({ dataBase: 'http://x/data/', fetchFn: mk({ syllabus: 's.json', questions: [], concepts: [] }) });
  assert.equal(a.basicsFile, BASICS_FILE);
  assert.equal(BASICS_FILE, 'basics.json');
  assert.deepEqual(a.basics, []);
  assert.equal(a.basicsMatcher, null);
  const b = await loadData({ dataBase: 'http://x/data/', fetchFn: mk({ syllabus: 's.json', questions: [], concepts: [], basics: 'kiso.json' }) });
  assert.equal(b.basicsFile, 'kiso.json');
  const none = await loadData({ dataBase: 'http://x/data/', fetchFn: async () => resp(404, null) });
  assert.equal(none.basicsFile, BASICS_FILE);
});

// ---------- 照合 ----------

test('fold: 全角→半角・大文字→小文字にそろえ、文字数は変えない（位置を元の文に当てるため）', () => {
  assert.equal(fold('ＡＰＩ Ａｐｉ'), 'api api');
  assert.equal(fold('次元'), '次元');
  for (const s of ['㌔メートル', 'ﾊﾟﾗﾒｰﾀ', '𠮷野家のAPI', 'İstanbul', 'ａｂｃ１２３']) assert.equal(fold(s).length, s.length, s);
  assert.equal(fold(null), '');
});

test('titleForms: title 全体・括弧の前・括弧の中（全角でも半角でも）', () => {
  assert.deepEqual(titleForms('次元削減'), ['次元削減']);
  assert.deepEqual(titleForms('再帰型ニューラルネットワーク（RNN）'), ['再帰型ニューラルネットワーク（RNN）', '再帰型ニューラルネットワーク', 'RNN']);
  assert.deepEqual(titleForms('多次元尺度構成法 (MDS)'), ['多次元尺度構成法 (MDS)', '多次元尺度構成法', 'MDS']);
  assert.deepEqual(titleForms(''), []);
  assert.deepEqual(titleForms(null), []);
});

const m1 = buildMatcher([B('B-001', '次元', { aliases: ['次元数'] }), B('B-002', 'パラメータ', { aliases: ['パラメーター'] }), B('B-003', 'API')], [C('C-1', '次元削減'), C('C-2', 'ハイパーパラメータ'), C('C-3', '主成分分析（PCA）')]);

test('長い語が勝つ: 「次元削減」（カード）の中の「次元」には印を付けない。単独の「次元」は付く', () => {
  const s = segmentText('次元削減では次元を減らす。', m1);
  assert.equal(join_(s), '次元削減では次元を減らす。');
  assert.deepEqual(linked(s), ['次元:B-001']);
  assert.deepEqual(s.map((x) => x.text), ['次元削減では', '次元', 'を減らす。']);
});

test('カードの title の中の語には印を付けない（ハイパーパラメータの中のパラメータ）。括弧の前・中も同じ（PCA）', () => {
  assert.deepEqual(linked(segmentText('ハイパーパラメータを調整する', m1)), []);
  assert.deepEqual(linked(segmentText('パラメータとハイパーパラメータ', m1)), ['パラメータ:B-002']);
  assert.deepEqual(linked(segmentText('主成分分析（PCA）と次元', m1)), ['次元:B-001']);
});

test('同じ長さで重なるなら、後ろから始まるカードでも、カードが勝つ（基礎のことばの「基礎学習」とカードの「学習理論」）', () => {
  const m = buildMatcher([B('B-1', '基礎学習')], [C('C-1', '学習理論')]);
  assert.deepEqual(linked(segmentText('基礎学習理論', m)), []);
  assert.deepEqual(linked(segmentText('基礎学習', m)), ['基礎学習:B-1']); // 重ならなければ付く
});

test('同じ文字列で、カードの title と基礎のことばが重なるなら、カードが勝つ（印は付かない）', () => {
  const m = buildMatcher([B('B-001', '過学習')], [C('C-1', '過学習')]);
  assert.deepEqual(linked(segmentText('過学習を防ぐ', m)), []);
  const m2 = buildMatcher([B('B-001', '過学習')], []);
  assert.deepEqual(linked(segmentText('過学習を防ぐ', m2)), ['過学習:B-001']);
});

test('基礎のことば同士でも長い語が勝つ（ハイパーパラメータを基礎の語にしたら、パラメータではなくそちら）', () => {
  const m = buildMatcher([B('B-1', 'パラメータ'), B('B-2', 'ハイパーパラメータ')], []);
  assert.deepEqual(linked(segmentText('ハイパーパラメータとパラメータ', m)), ['ハイパーパラメータ:B-2', 'パラメータ:B-1']);
});

test('1つの塊（seen）で同じ語は最初の1回だけ。別名も同じ語として数える。塊が違えば（新しい seen）また付く', () => {
  const seen = new Set();
  assert.deepEqual(linked(segmentText('次元と次元と次元数', m1, seen)), ['次元:B-001']);
  assert.deepEqual(linked(segmentText('次元がまた出る', m1, seen)), []); // 同じ区画の次の文
  assert.deepEqual(linked(segmentText('次元がまた出る', m1, new Set())), ['次元:B-001']);
  const s = segmentText('次元数と次元', m1, new Set());
  assert.deepEqual(linked(s), ['次元数:B-001']);
  assert.equal(join_(s), '次元数と次元');
  // seen に自分の id を入れておけば、自分の語には印を付けない
  assert.deepEqual(linked(segmentText('次元は次元', m1, new Set(['B-001']))), []);
});

test('英字の語は単語の境目を見る: RAPID の中の API は見つけない。API・api・ＡＰＩ・「このAPIは」は見つける。APIs は見つけない', () => {
  assert.deepEqual(linked(segmentText('RAPID', m1)), []);
  assert.deepEqual(linked(segmentText('MAPIX', m1)), []);
  assert.deepEqual(linked(segmentText('MAPI を使う', m1)), []); // 前だけが英数字（後ろは空白）
  assert.deepEqual(linked(segmentText('API2 を使う', m1)), []); // 数字も単語の一部
  assert.deepEqual(linked(segmentText('APIs を使う', m1)), []);
  assert.deepEqual(linked(segmentText('API を使う', m1)), ['API:B-003']);
  assert.deepEqual(linked(segmentText('このAPIは便利', m1)), ['API:B-003']);
  assert.deepEqual(linked(segmentText('(API)', m1)), ['API:B-003']);
  assert.deepEqual(linked(segmentText('REST-API', m1)), ['API:B-003']);
  const z = segmentText('ＡＰＩを呼ぶ', buildMatcher([B('B-3', 'API')], []));
  assert.deepEqual(linked(z), ['ＡＰＩ:B-3']); // 画面には元の文字（全角）のまま
  assert.deepEqual(linked(segmentText('api', buildMatcher([B('B-3', 'API')], []))), ['api:B-3']);
});

test('語が無い文・空の文・基礎のことばが無いアプリ・{} の道具でも、そのまま返る', () => {
  assert.deepEqual(segmentText('ふつうの文です。', m1), [{ text: 'ふつうの文です。' }]);
  assert.deepEqual(segmentText('', m1), []);
  assert.deepEqual(segmentText(null, m1), []);
  assert.deepEqual(segmentText('次元', null), [{ text: '次元' }]);
  const none = buildMatcher([], [C('C-1', '次元削減')]); // カードだけ（基礎のことばが0）
  assert.equal(none.hasBasics, false);
  assert.deepEqual(segmentText('次元削減', none), [{ text: '次元削減' }]);
  assert.deepEqual(segmentText('次元', buildMatcher(undefined, undefined)), [{ text: '次元' }]);
});

test('短すぎる語（' + MIN_TERM_LEN + '字より短い）は見つけない', () => {
  const m = buildMatcher([B('B-1', '式'), B('B-2', 'x'), B('B-3', 'ab')], []);
  assert.deepEqual(linked(segmentText('式 x ab', m)), ['ab:B-3']);
});

test('notIn: 語を含むが別の言葉になる複合語の中では印を付けない（スパムフィルタの中のフィルタ）。単独のフィルタには付く', () => {
  const b = normalizeBasic({ id: 'B-1', term: 'フィルタ', oneLine: 'a', why: 'b', notIn: ['スパムフィルタ', ' フィルターバブル ', 'スパムフィルタ', '', 3] });
  assert.deepEqual(b.notIn, ['スパムフィルタ', 'フィルターバブル']);
  assert.deepEqual(normalizeBasic({ id: 'B-2', term: 'x1' }).notIn, []);
  const m = buildMatcher([b], []);
  assert.deepEqual(linked(segmentText('スパムフィルタとフィルタ', m)), ['フィルタ:B-1']);
  assert.deepEqual(linked(segmentText('フィルターバブル', m)), []);
  assert.deepEqual(linked(segmentText('協調フィルタリング', m)), ['フィルタ:B-1']); // notIn に無い複合語は付く（中身の担当が notIn に足す）
  const without = buildMatcher([normalizeBasic({ id: 'B-1', term: 'フィルタ', oneLine: 'a', why: 'b' })], []);
  assert.deepEqual(linked(segmentText('スパムフィルタ', without)), ['フィルタ:B-1']);
});

test('HTML の記号を含む文でも、つなげると元の文と同じ。記号は文字のまま（印の位置が崩れない）', () => {
  const t = '<script>alert(1)</script>次元&amp;"\'次元';
  const s = segmentText(t, m1);
  assert.equal(join_(s), t);
  assert.deepEqual(linked(s), ['次元:B-001']);
  assert.ok(s[0].text.startsWith('<script>'));
  for (const bad of ['<img src=x onerror=alert(1)>', '&lt;b&gt;', '"><svg/onload=1>']) assert.equal(join_(segmentText(bad + '次元' + bad, m1)), bad + '次元' + bad);
});

test('どんな文でも、つなげると元の文と同じ（ランダムな文字列 2000 本）', () => {
  const pool = ['次', '元', '削', '減', 'パ', 'ラ', 'メ', 'ー', 'タ', 'A', 'P', 'I', 'a', '１', ' ', '。', '<', '&', '㌔', '𠮷', 'ﾊ'];
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let withLink = 0;
  for (let i = 0; i < 2000; i++) {
    let t = '';
    const n = Math.floor(rnd() * 24);
    for (let k = 0; k < n; k++) t += pool[Math.floor(rnd() * pool.length)];
    const segs = segmentText(t, m1);
    assert.equal(join_(segs), t, JSON.stringify(t));
    for (const sg of segs) assert.ok(sg.text.length > 0);
    if (segs.some((x) => x.id)) withLink++;
  }
  assert.ok(withLink > 20, '印の付く文が少なすぎて確かめになっていない: ' + withLink);
});

// ---------- 検査（tools/check-basics.cjs を check-data.js・check-data-dx.js が呼ぶ）----------

test('検査の fold・titleForms・MIN_TERM_LEN は、アプリ本体（lib/basics.js）と同じ結果を返す', () => {
  const cjs = require('../../tools/check-basics.cjs');
  assert.equal(cjs.MIN_TERM_LEN, MIN_TERM_LEN);
  for (const s of ['ＡＰＩ', '次元', '㌔メートル', 'ﾊﾟﾗﾒｰﾀ', '𠮷野家のAPI', 'İstanbul', '']) assert.equal(cjs.fold(s), fold(s), s);
  for (const s of ['次元削減', '再帰型ニューラルネットワーク（RNN）', '多次元尺度構成法 (MDS)', '', '（PCA）']) assert.deepEqual(cjs.titleForms(s), titleForms(s), s);
});

function runTool(tool, appDir, basics, concepts, opts = {}) {
  const d = mkdtempSync(join(tmpdir(), 'cq-basics-'));
  try {
    const data = join(d, appDir, 'data');
    mkdirSync(join(data, 'concepts'), { recursive: true });
    writeFileSync(join(data, 'concepts', '01_x.json'), JSON.stringify(concepts));
    if (opts.figures) {
      mkdirSync(join(data, 'figures'), { recursive: true });
      for (const f of opts.figures) writeFileSync(join(data, 'figures', f + '.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" role="img" aria-labelledby="a-t a-d"><title id="a-t">題</title><desc id="a-d">説明</desc><rect x="1" y="1" width="10" height="10"/></svg>');
    }
    writeFileSync(join(data, 'basics.json'), typeof basics === 'string' ? basics : JSON.stringify(basics));
    const r = spawnSync(process.execPath, [join(root, 'tools', tool), join(data, 'basics.json')], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}
const GOOD_CONCEPTS = [{ id: 'C-01-001', title: '次元削減' }, { id: 'C-01-002', title: '主成分分析（PCA）' }];
const goodBasic = (o = {}) => ({ id: 'B-001', term: '次元', aliases: ['次元数'], oneLine: 'データを表す数字の個数。', why: '身長・体重・年齢なら3次元。', related: ['C-01-001'], ...o });

test('検査（G検定）: 良いデータは OK。語の数を出す', () => {
  const r = runTool('check-data.js', 'g-kentei', [goodBasic(), goodBasic({ id: 'B-002', term: 'ベクトル', aliases: undefined, related: undefined })], GOOD_CONCEPTS);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /basics 2語/);
  assert.match(r.out, /結果: OK/);
});

const NG_CASES = {
  'id の形式': [goodBasic({ id: 'X-1' })],
  'id の重複': [goodBasic(), goodBasic({ term: 'ほか' })],
  'term が無い': [goodBasic({ term: '' })],
  'oneLine が無い': [goodBasic({ oneLine: undefined })],
  'why が無い': [goodBasic({ why: ' ' })],
  'aliases が配列でない': [goodBasic({ aliases: '次元数' })],
  'aliases に空': [goodBasic({ aliases: [''] })],
  'aliases の重複': [goodBasic({ aliases: ['次元数', '次元数'] })],
  'related が配列でない': [goodBasic({ related: 'C-01-001' })],
  'related が実在しない': [goodBasic({ related: ['C-99-999'] })],
  'related の重複': [goodBasic({ related: ['C-01-001', 'C-01-001'] })],
  'figures の SVG が無い': [goodBasic({ figures: ['fig-g-nothing'] })],
  'figures の形式': [goodBasic({ figures: ['../x'] })],
  '1語が辞書でない': [goodBasic(), 'ただの文字'],
};
for (const [name, data] of Object.entries(NG_CASES)) {
  test('検査（G検定）: ' + name + ' は NG', () => {
    const r = runTool('check-data.js', 'g-kentei', data, GOOD_CONCEPTS);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /結果: NG/);
  });
}

test('検査: notIn が配列でないのは NG。語を含まない・語そのものは WARN。含んでいれば何も言わない', () => {
  assert.equal(runTool('check-data.js', 'g-kentei', [goodBasic({ notIn: 'x' })], GOOD_CONCEPTS).code, 1);
  assert.equal(runTool('check-data.js', 'g-kentei', [goodBasic({ notIn: [''] })], GOOD_CONCEPTS).code, 1);
  const ok = runTool('check-data.js', 'g-kentei', [goodBasic({ notIn: ['高次元データ'] })], GOOD_CONCEPTS);
  assert.equal(ok.code, 0, ok.out);
  assert.doesNotMatch(ok.out, /notIn/);
  const none = runTool('check-data.js', 'g-kentei', [goodBasic({ notIn: ['関係ない語'] })], GOOD_CONCEPTS);
  assert.equal(none.code, 0);
  assert.match(none.out, /WARN basics\.json B-001: notIn の「関係ない語」/);
  const same = runTool('check-data.js', 'g-kentei', [goodBasic({ notIn: ['次元'] })], GOOD_CONCEPTS);
  assert.match(same.out, /語そのもの/);
});

test('検査: アプリの data/ の問題・カードを渡すだけで、同じ data/ の basics.json も自動で検査する（渡し忘れても NG が出る）', () => {
  for (const [tool, app] of [['check-data.js', 'g-kentei'], ['check-data-dx.js', 'dx-biz']]) {
    const d = mkdtempSync(join(tmpdir(), 'cq-basics-'));
    try {
      const data = join(d, app, 'data');
      mkdirSync(join(data, 'concepts'), { recursive: true });
      writeFileSync(join(data, 'concepts', '01_x.json'), '[]');
      writeFileSync(join(data, 'basics.json'), JSON.stringify([{ id: 'ZZ', term: '', oneLine: '', why: '' }]));
      const r = spawnSync(process.execPath, [join(root, 'tools', tool), join(data, 'concepts', '01_x.json')], { encoding: 'utf8' });
      assert.equal(r.status, 1, tool + r.stdout);
      assert.match(r.stdout, /basics\.json ZZ/);
      // 明示的に basics.json も渡しても二重に検査しない
      const r2 = spawnSync(process.execPath, [join(root, 'tools', tool), join(data, 'concepts', '01_x.json'), join(data, 'basics.json')], { encoding: 'utf8' });
      assert.equal((r2.stdout.match(/basics\.json ZZ: id が/g) || []).length, 1, tool);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  }
});

test('検査: ルートが配列でない・壊れた JSON は NG', () => {
  assert.equal(runTool('check-data.js', 'g-kentei', { id: 'B-001' }, GOOD_CONCEPTS).code, 1);
  assert.equal(runTool('check-data.js', 'g-kentei', '[{ "id": ', GOOD_CONCEPTS).code, 1);
});

test('検査: 図が実在すれば OK（図の SVG の決まりも同じ検査で見る）', () => {
  const r = runTool('check-data.js', 'g-kentei', [goodBasic({ figures: ['fig-g-basic-x'] })], GOOD_CONCEPTS, { figures: ['fig-g-basic-x'] });
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /WARN .*fig-g-basic-x/);
});

const WARN_CASES = {
  '2字より短い語': [goodBasic({ term: '式', aliases: undefined })],
  '別の語と同じ語': [goodBasic(), goodBasic({ id: 'B-002', term: '次元' })],
  '試験範囲のカードの title と同じ語': [goodBasic({ term: '次元削減', aliases: undefined })],
  'カードの括弧の中（PCA）と同じ語': [goodBasic({ term: 'pca', aliases: undefined })],
  'oneLine が長い': [goodBasic({ oneLine: 'あ'.repeat(81) })],
};
for (const [name, data] of Object.entries(WARN_CASES)) {
  test('検査（G検定）: ' + name + ' は WARN（NG にはしない）', () => {
    const r = runTool('check-data.js', 'g-kentei', data, GOOD_CONCEPTS);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /WARN basics\.json B-00\d/, r.out);
  });
}

test('検査: 括弧の前の語（主成分分析）も、カードの title と同じ語として WARN する', () => {
  const r = runTool('check-data.js', 'g-kentei', [goodBasic({ term: '主成分分析', aliases: undefined })], GOOD_CONCEPTS);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /WARN basics\.json B-001: 「主成分分析」が試験範囲のカード/);
});

test('検査: id の形はアプリごと（G検定 B-NNN・AIパスポート B-AP-NNN・DX DB-NNN）', () => {
  assert.equal(runTool('check-data.js', 'ai-passport', [goodBasic({ id: 'B-AP-001' })], GOOD_CONCEPTS).code, 0);
  assert.equal(runTool('check-data.js', 'ai-passport', [goodBasic({ id: 'B-001' })], GOOD_CONCEPTS).code, 1);
  assert.equal(runTool('check-data.js', 'g-kentei', [goodBasic({ id: 'B-AP-001' })], GOOD_CONCEPTS).code, 1);
  assert.equal(runTool('check-data-dx.js', 'dx-biz', [goodBasic({ id: 'DB-001' })], GOOD_CONCEPTS).code, 0);
  assert.equal(runTool('check-data-dx.js', 'dx-biz', [goodBasic({ id: 'B-001' })], GOOD_CONCEPTS).code, 1);
});

test('検査（DX）: G検定と同じ検査（NG の例・WARN の例・図）', () => {
  const dx = (data, o) => runTool('check-data-dx.js', 'dx-biz', data, GOOD_CONCEPTS, o);
  const ok = dx([goodBasic({ id: 'DB-001' })]);
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /basics 1語/);
  assert.equal(dx([goodBasic({ id: 'DB-001', related: ['C-99-999'] })]).code, 1);
  assert.equal(dx([goodBasic({ id: 'DB-001', figures: ['fig-dx-none'] })]).code, 1);
  assert.equal(dx([goodBasic({ id: 'DB-001', figures: ['fig-dx-a'] })], { figures: ['fig-dx-a'] }).code, 0);
  assert.equal(dx([goodBasic({ id: 'DB-001', term: '' })]).code, 1);
  const w = dx([goodBasic({ id: 'DB-001', term: '次元削減', aliases: undefined })]);
  assert.equal(w.code, 0, w.out);
  assert.match(w.out, /WARN basics\.json DB-001/);
});

test('検査: basics.json が無くても、問題・カードの検査は今までどおり（基礎のことばは任意）', () => {
  const d = mkdtempSync(join(tmpdir(), 'cq-basics-'));
  try {
    mkdirSync(join(d, 'g-kentei', 'data', 'concepts'), { recursive: true });
    writeFileSync(join(d, 'g-kentei', 'data', 'concepts', '01_x.json'), '[]');
    const r = spawnSync(process.execPath, [join(root, 'tools', 'check-data.js'), join(d, 'g-kentei', 'data', 'concepts', '01_x.json')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('配っている basics.json（あれば）は、検査を通り、アプリの読み込みでも1語も捨てられない', async () => {
  let checked = 0;
  for (const a of APPS) {
    const f = join(root, a, 'data', 'basics.json');
    let raw;
    try { raw = readFileSync(f, 'utf8'); } catch (e) { continue; }
    checked++;
    const tool = a === 'dx-biz' ? 'check-data-dx.js' : 'check-data.js';
    const r = spawnSync(process.execPath, [join(root, 'tools', tool), f], { encoding: 'utf8' });
    assert.equal(r.status, 0, a + '\n' + r.stdout);
    const n = normalizeBasics(JSON.parse(raw));
    assert.deepEqual(n.problems, [], a);
    assert.equal(n.items.length, JSON.parse(raw).length, a);
  }
  assert.ok(checked >= 0);
});

// ---------- サービスワーカー ----------

async function runInstall(fetchMap, cfg = {}) {
  const swSrc = readFileSync(join(shared, 'sw-core.js'), 'utf8');
  const handlers = {};
  const put = [];
  const fetched = [];
  const self = {
    CERT_QUEST: { appId: 't', version: '1', appFiles: ['./'], ...cfg },
    location: new URL('https://example.test/app/sw.js'), // 本物の URL（new URL(相対, location) の基準に使われるので、href だけの辞書では足りない）
    addEventListener: (t, fn) => { handlers[t] = fn; },
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  const cacheObj = { addAll: async () => {}, put: async (u) => { put.push(typeof u === 'string' ? u : u.url); } };
  const ctx = {
    self,
    caches: { open: async () => cacheObj, keys: async () => [], delete: async () => true },
    fetch: async (req) => {
      const u = new URL(typeof req === 'string' ? req : req.url, 'https://example.test/app/sw.js').href; // sw-core は ./data/... の相対で呼ぶ
      fetched.push(u);
      const hit = fetchMap[u.replace('https://example.test/app/', '')];
      if (hit === undefined) return { ok: false, status: 404, clone() { return this; }, json: async () => { throw new Error('404'); } };
      return { ok: true, status: 200, clone() { return this; }, json: async () => hit };
    },
    URL, Request: class { constructor(u) { this.url = u; } }, Response, Promise, console, setTimeout,
  };
  vm.runInNewContext(swSrc, ctx);
  let p;
  handlers.install({ waitUntil: (x) => { p = x; } });
  await p;
  return { put, fetched };
}
const IDX = { syllabus: 's.json', questions: ['q.json'], concepts: ['c.json'] };

test('サービスワーカー: basics.json をインストール時に取って保存し、その figures が指す図も取る（問題・カードの図と合わせて重複なし）', async () => {
  const r = await runInstall({
    'data/index.json': IDX, 'data/s.json': [], 'data/q.json': [], 'data/c.json': [{ id: 'C-1', figures: ['fig-g-a'] }],
    'data/basics.json': [{ id: 'B-001', term: '次元', figures: ['fig-g-basic-dimension', 'fig-g-a', '../bad'] }],
  });
  const put = r.put.map((u) => u.replace('https://example.test/app/', ''));
  assert.ok(put.includes('data/basics.json'), put.join(','));
  assert.ok(put.includes('data/figures/fig-g-basic-dimension.svg') === false, '図の本体はテストの fetch に無い(404)ので保存されない');
  const figFetches = r.fetched.map((u) => u.replace('https://example.test/app/', '')).filter((u) => u.includes('figures/'));
  assert.deepEqual(figFetches.sort(), ['data/figures/fig-g-a.svg', 'data/figures/fig-g-basic-dimension.svg']);
});

test('サービスワーカー: 図の本体があれば保存する。index.json の basics で名前を変えられる', async () => {
  const r = await runInstall({
    'data/index.json': { ...IDX, basics: 'kiso.json' }, 'data/s.json': [], 'data/q.json': [], 'data/c.json': [],
    'data/kiso.json': { basics: [{ id: 'B-001', term: '次元', figures: ['fig-g-basic-dimension'] }] },
    'data/figures/fig-g-basic-dimension.svg': {},
  });
  const put = r.put.map((u) => u.replace('https://example.test/app/', ''));
  assert.ok(put.includes('data/kiso.json'));
  assert.ok(put.includes('data/figures/fig-g-basic-dimension.svg'));
});

test('サービスワーカー: basics.json が無い(404)・壊れていても、インストールは続き、問題・カードは保存される', async () => {
  const none = await runInstall({ 'data/index.json': IDX, 'data/s.json': [], 'data/q.json': [], 'data/c.json': [] });
  assert.ok(none.put.some((u) => u.endsWith('data/c.json')));
  assert.ok(!none.put.some((u) => u.includes('basics')));
  const broken = await runInstall({ 'data/index.json': IDX, 'data/s.json': [], 'data/q.json': [], 'data/c.json': [], 'data/basics.json': 'x' });
  assert.ok(broken.put.some((u) => u.endsWith('data/c.json')));
});

test('サービスワーカー: 新しい JS 3本が SHARED（先取りの一覧）に載っていて、実在する', () => {
  const sw = src('sw-core.js');
  for (const f of ['js/lib/basics.js', 'js/views/basics.js', 'js/views/richtext.js']) {
    assert.ok(sw.includes("'../shared/" + f + "'"), f + ' が SHARED に無い');
    assert.ok(readFileSync(join(shared, f), 'utf8').length > 100);
  }
});

// ---------- 画面の結線（DOM の代わりの偽物で動かして見る）----------

class FakeEl {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.className = ''; this.textContent = ''; this.value = ''; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  get classList() { return { toggle() {}, add() {}, remove() {} }; }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  find(pred, out = []) { if (pred(this)) out.push(this); for (const c of this.children) if (c instanceof FakeEl) c.find(pred, out); return out; }
  text() { return this.textContent + this.children.map((c) => (c instanceof FakeEl ? c.text() : c.text)).join(''); }
}
globalThis.document = { createElement: (t) => new FakeEl(t), createTextNode: (s) => ({ text: s }) };
globalThis.location = { href: 'http://localhost/g-kentei/', hash: '#/cards' };
globalThis.history = { back() {} };
const { richText, richEl, setBasicOpener } = await import('../js/views/richtext.js');
const { explanation, stumbleBlock } = await import('../js/views/explain.js');
const { cardBody } = await import('../js/views/cards.js');
const { renderBasicList, renderBasic, basicBody } = await import('../js/views/basics.js'); // 読み込むと、印を押したときの窓が richtext.js に結ばれる

const concepts = [
  normalizeConcept({ id: 'C-01-001', title: '次元削減', oneLine: '次元を減らす。', why: '次元が高いと次元の呪いが起きる。', syllabus: ['a'], confusions: [{ id: 'C-01-002', point: 'パラメータの数とは別。' }] }),
  normalizeConcept({ id: 'C-01-002', title: '過学習', oneLine: 'パラメータが多すぎて起きる。', why: 'w', syllabus: ['a'] }),
];
const basics = normalizeBasics([
  { id: 'B-001', term: '次元', aliases: ['次元数'], oneLine: '数字の個数。', why: 'ベクトルの長さ。', related: ['C-01-001'] },
  { id: 'B-002', term: 'パラメータ', oneLine: '調整できる数字。', why: '次元とは別。' },
  { id: 'B-003', term: 'ベクトル', oneLine: '数字の並び。', why: '' },
]).items;
const mkApp = (withBasics = true) => ({ data: { concepts, conceptIndex: buildConceptIndex(concepts), backlinks: new Map(), questions: [], basics: withBasics ? basics : [], basicsMatcher: withBasics ? buildMatcher(basics, concepts) : null }, state: { settings: {} }, go() {}, dataBase: 'http://localhost/g-kentei/data/' });
const terms = (el) => el.find((e) => e.tag === 'button' && e.className.includes('basic-term'));

test('richText: 印は <button>（読み上げ対象・data-basic 付き）。文字は文字のまま入る（HTML として解釈しない）', () => {
  const parts = richText(mkApp(), '<b>次元</b>とパラメータ', new Set());
  const btns = parts.filter((p) => p instanceof FakeEl);
  assert.equal(btns.length, 2);
  assert.deepEqual(btns.map((b) => b.getAttribute('data-basic')), ['B-001', 'B-002']);
  assert.deepEqual(btns.map((b) => b.tag), ['button', 'button']);
  assert.equal(btns[0].getAttribute('type'), 'button');
  assert.equal(btns[0].getAttribute('aria-haspopup'), 'dialog');
  assert.equal(btns[0].children[0].text, '次元');
  assert.equal(parts[0], '<b>'); // 文字列のまま（呼ぶ側の h() が文字として入れる）
  assert.equal(btns[0].listeners.click.length, 1);
});

test('richText: 基礎のことばが無いアプリ（matcher 無し・空）では、文字列1つだけ返す', () => {
  assert.deepEqual(richText(mkApp(false), '次元とパラメータ', new Set()), ['次元とパラメータ']);
  assert.deepEqual(richText({ data: {} }, '次元', new Set()), ['次元']);
  assert.deepEqual(richText(null, '次元'), ['次元']);
  assert.deepEqual(richText(mkApp(), null), []); // 空の文は何も出さない
});

test('richEl: 印の付く語が無い文・基礎のことばが無いアプリでは、これまでと同じ text 指定の要素', () => {
  const plain = richEl(mkApp(), 'p', { class: 'x' }, '印の付く語は無い', new Set());
  assert.equal(plain.textContent, '印の付く語は無い');
  assert.equal(plain.children.length, 0);
  assert.equal(plain.className, 'x');
  const off = richEl(mkApp(false), 'p', {}, '次元', new Set());
  assert.equal(off.textContent, '次元');
  assert.equal(terms(off).length, 0);
  const on = richEl(mkApp(), 'p', { class: 'one-line' }, '次元が大事', new Set());
  assert.equal(on.className, 'one-line');
  assert.equal(on.text(), '次元が大事');
  assert.equal(terms(on).length, 1);
});

test('カード: 一言と説明は続けて1区画（同じ語は最初の1回）。「次元削減」の中の次元には付かない。自分の title には付かない', () => {
  const el = cardBody(mkApp(), concepts[0], () => {});
  const ts = terms(el);
  // 一言「次元を減らす。」→ 次元(1回目)。説明「次元が高いと次元の呪いが…」→ 同じ区画なので付かない。混同の「パラメータの数とは別。」→ パラメータ
  assert.deepEqual(ts.map((t) => t.getAttribute('data-basic')), ['B-001', 'B-002']);
  const one = el.find((e) => e.className === 'one-line')[0];
  assert.equal(terms(one).length, 1);
  assert.equal(one.text(), '次元を減らす。');
  const off = cardBody(mkApp(false), concepts[0], () => {});
  assert.equal(terms(off).length, 0);
  assert.equal(off.find((e) => e.className === 'one-line')[0].textContent, '次元を減らす。'); // これまでと同じ作り
});

const sq = (o = {}) => ({ q: { id: 'G-1', format: 'single', concepts: ['C-01-002'], explanation: '次元が高く、次元数も多い。', memoryTip: 'パラメータは調整できる数字。', figures: [], sources: [], ...o }, choices: ['甲', '乙', '丙'], answer: 0, whyWrong: [null, 'パラメータが違う。パラメータは別。', 'パラメータもベクトルも違う。ベクトルは並び。'] });
const draw = (app, s = sq(), chosen = 1) => explanation(app, s, chosen, () => {}, { sensei: false, later: false });

test('解説: 正解の理由・誤答の説明・覚え方に印が付く。区画ごとに最初の1回（誤答の説明は1区画）', () => {
  const el = draw(mkApp());
  const ts = terms(el);
  assert.deepEqual(ts.map((t) => t.getAttribute('data-basic')), ['B-001', 'B-002', 'B-003', 'B-002']);
  // 正解の理由: 次元(1回)・次元数(同じ語なので付かない)／誤答: パラメータ(1回)・ベクトル(1回)／覚え方: パラメータ(別の区画なのでまた付く)
  const why = el.find((e) => e.tag === 'span' && e.className === 'why');
  assert.equal(why.length, 2);
  assert.equal(terms(why[0]).length, 1);
  assert.equal(why[0].text(), 'パラメータが違う。パラメータは別。');
  const none = draw(mkApp(false));
  assert.equal(terms(none).length, 0);
  assert.ok(none.find((e) => e.tag === 'span' && e.className === 'why')[0].textContent.includes('パラメータが違う'));
});

test('解説: 選択肢の文・正解の見出し（正解: A. …）には印を付けない', () => {
  const s = sq();
  s.choices = ['次元の説明', 'パラメータの説明', 'ベクトルの説明'];
  const el = draw(mkApp(), s);
  const strongs = el.find((e) => e.tag === 'strong');
  assert.equal(strongs.length, 1);
  assert.equal(terms(strongs[0]).length, 0);
  const lbl = el.find((e) => e.tag === 'span' && e.className === 'lbl');
  for (const l of lbl) assert.equal(terms(l).length, 0);
});

test('まず用語を確認しよう: カードの一言・混同の違いに印。用語の丸ボタン（カードへ飛ぶ）はそのまま別物', () => {
  const app = mkApp();
  const el = stumbleBlock(app, sq().q, () => {});
  const chips = el.find((e) => e.tag === 'button' && e.className.includes('chip'));
  assert.ok(chips.length >= 1);
  for (const c of chips) assert.ok(!c.className.includes('basic-term'));
  assert.deepEqual(terms(el).map((t) => t.getAttribute('data-basic')), ['B-002']); // 過学習の一言「パラメータが多すぎて起きる。」
  // 丸ボタンの文字（カードの title）の中には、印のボタンを入れ子にしない
  for (const c of chips) assert.equal(terms(c).length, 0);
});

test('基礎のことばのカード: 一言・説明・つながる試験範囲のカード。自分の語には印を付けず、ほかの基礎のことばには付く', () => {
  const app = mkApp();
  const el = basicBody(app, basics[0], () => {});
  assert.ok(el.text().includes('次元'));
  assert.deepEqual(terms(el).map((t) => t.getAttribute('data-basic')), ['B-003']); // 説明「ベクトルの長さ。」のベクトル。自分（次元）は付かない
  const chips = el.find((e) => e.tag === 'button' && e.className.includes('chip link'));
  assert.deepEqual(chips.map((c) => c.children[0].text), ['次元削減']);
  const bare = basicBody(app, basics[2], () => {}); // why が空・related なし
  assert.equal(bare.find((e) => e.className === 'why').length, 0);
  assert.equal(bare.find((e) => e.className.includes('chip link')).length, 0);
});

const { renderCardList } = await import('../js/views/cards.js');
test('カード一覧の入口: 語があるアプリだけ『基礎のことば（N語）』を先頭に出す。語が0・欄が無いアプリには出さない（カードが0枚でも入口は出る）', () => {
  const listApp = (basicsArr, conceptsArr = concepts) => {
    const a = mkApp();
    a.data.basics = basicsArr;
    a.data.concepts = conceptsArr;
    a.state = { settings: { cardView: 'all' } };
    a.commit = () => {};
    return a;
  };
  const entries = (el) => el.find((e) => e.attrs['data-basics-entry'] !== undefined);
  const on = renderCardList(listApp(basics));
  assert.equal(entries(on).length, 1);
  assert.ok(entries(on)[0].text().includes('基礎のことば（3語）'));
  assert.equal(entries(on)[0].tag, 'button');
  assert.equal(entries(renderCardList(listApp([]))).length, 0);
  const noField = listApp([]);
  delete noField.data.basics;
  assert.equal(entries(renderCardList(noField)).length, 0);
  assert.equal(entries(renderCardList(listApp(basics, []))).length, 1);
});

test('一覧・1語の画面: 語が無い／見つからないときは、準備中・見つかりませんを出して壊れない', () => {
  const empty = renderBasicList(mkApp(false));
  assert.ok(empty.text().includes('準備中'));
  const list = renderBasicList(mkApp());
  assert.equal(list.find((e) => e.getAttribute('data-basic-row')).length, 3);
  const one = renderBasic(mkApp(), 'B-001');
  assert.equal(one.find((e) => e.getAttribute('data-basic-card') === 'B-001').length, 1);
  assert.ok(renderBasic(mkApp(), 'B-999').text().includes('見つかりません'));
  assert.ok(renderBasic(mkApp(false), 'B-001').text().includes('見つかりません'));
});

test('開く窓が結ばれていないとき（画面のファイルを読んでいない）は、印を付けず文字のまま', () => {
  setBasicOpener(null);
  assert.deepEqual(richText(mkApp(), '次元', new Set()), ['次元']);
});

// ---------- ソースの決まり ----------

test('ソース: 基礎のことばの画面は innerHTML を使わない。ルート・読み込み・入口が結ばれている', () => {
  for (const f of ['js/lib/basics.js', 'js/views/basics.js', 'js/views/richtext.js']) assert.doesNotMatch(src(f), /\.(innerHTML|outerHTML)\b|insertAdjacentHTML|document\.write/, f); // コメントでの言及は許す。使う形（.innerHTML など）だけ止める
  const app = src('js/app.js');
  assert.match(app, /\['basics', 'cards'/);
  assert.match(app, /\['basic', 'cards'/);
  assert.match(app, /loadBasics\(new URL\(loaded\.data\.basicsFile/);
  assert.match(app, /buildMatcher\(loaded\.data\.basics, loaded\.data\.concepts\)/);
  const cards = src('js/views/cards.js');
  assert.match(cards, /Array\.isArray\(d\.basics\) \? d\.basics\.length : 0/); // 語が無いアプリでは入口を出さない
  assert.match(cards, /app\.go\('#\/basics'\)/);
  // 文を出すところ（カードの一言・説明、解説の理由・誤答・覚え方、まず用語を確認しよう）が richEl を通っている
  assert.equal((cards.match(/richEl\(app/g) || []).length, 3);
  assert.equal((src('js/views/explain.js').match(/richEl\(app/g) || []).length, 5);
});

test('ソース: 問題の途中（play・exam・dochi・boss）の画面では、窓から別の画面へ移る道を出さない（解いている問題が消える）', () => {
  const v = src('js/views/basics.js');
  assert.match(v, /\(play\|exam\|dochi\|boss\)/);
  assert.match(v, /inGame\(\) \? null/);
});

test('ソース: 窓の Esc は一番上の窓だけ閉じる（窓の上に窓が開く）。窓の名前は引数で変えられる', () => {
  const ui = src('js/ui.js');
  assert.match(ui, /opts\.label \|\| '用語カード'/);
  assert.match(ui, /all\[all\.length - 1\] === back/);
});

test('ソース: 印の文字の色は周りと同じ（--text 系）で、下線は点線（色だけに頼らない）。暗い配色専用の上書きは要らない', () => {
  const css = src('css/app.css');
  const rule = /button\.basic-term \{[^}]*\}/.exec(css);
  assert.ok(rule, 'button.basic-term の規則が無い');
  assert.match(rule[0], /color: inherit/);
  assert.match(rule[0], /underline dotted/);
  assert.doesNotMatch(rule[0], /#[0-9a-fA-F]{3,6}/); // 色の直書きをしない（変数だけ）
  assert.match(css, /\.basics-entry \{[^}]*var\(--accent-soft\)/);
});

test('配っているアプリ: basics.json が無いアプリでも、一覧に載るアプリ全部で index.json が壊れていない', () => {
  assert.ok(APPS.length >= 3);
  for (const a of APPS) {
    const idx = JSON.parse(readFileSync(join(root, a, 'data', 'index.json'), 'utf8'));
    if ('basics' in idx) assert.equal(typeof idx.basics, 'string', a);
  }
});
