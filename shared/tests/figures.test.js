// 図（SVG）の決まり（要件定義書 §7-2）の確認。純粋な部分（lib/figures.js）と、データ検査（tools/check-data.js・check-data-dx.js）が
// 禁止事項・参照切れで落ちること、配っている図が決まりを満たすこと、サービスワーカーが図を取ること。
// 画面（取り込み・見た目）は DOM が要るのでここでは見ない（ブラウザで確かめる）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isFigureId, normalizeFigureIds, figureUrl, svgProblems, viewBoxWidth, scopeIds, FIGURE_ID_RE } from '../js/lib/figures.js';
import { normalizeQuestion, normalizeConcept } from '../js/lib/data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GOOD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" role="img" aria-labelledby="fig-t-a-t fig-t-a-d"><title id="fig-t-a-t">題</title><desc id="fig-t-a-d">説明</desc><rect x="1" y="1" width="10" height="10" class="fa"/><text x="2" y="20" class="t">文字</text></svg>';

test('図の ID: fig- で始まる小文字の英数字とハイフンだけ', () => {
  for (const ok of ['fig-g-activation', 'fig-dx-a1', 'fig-a']) assert.ok(isFigureId(ok), ok);
  for (const ng of ['', 'fig', 'fig-', 'Fig-a', 'fig-A', 'fig_a', 'fig-a--b', 'fig-a/../b', 'x-fig-a', 'fig-a.svg', null, 3, ['fig-a']]) assert.ok(!isFigureId(ng), String(ng));
});

test('figures の正規化: 配列でなければ空・不正な ID と重複は落とし、順は保つ', () => {
  assert.deepEqual(normalizeFigureIds(undefined), []);
  assert.deepEqual(normalizeFigureIds('fig-a'), []);
  assert.deepEqual(normalizeFigureIds(['fig-b', 'bad', 'fig-a', 'fig-b', 7]), ['fig-b', 'fig-a']);
  const q = normalizeQuestion({ id: 'G-01-001', syllabus: ['a'], stem: 's', choices: ['x', 'y'], answer: 0, figures: ['fig-a', '../x'] });
  assert.deepEqual(q.figures, ['fig-a']);
  assert.deepEqual(normalizeQuestion({ id: 'G-01-001', syllabus: ['a'], stem: 's', choices: ['x', 'y'], answer: 0 }).figures, []);
  assert.deepEqual(normalizeConcept({ id: 'C-01-001', title: 't', figures: ['fig-a'] }).figures, ['fig-a']);
  assert.deepEqual(normalizeConcept({ id: 'C-01-001', title: 't' }).figures, []);
});

test('図の URL は data/figures/<ID>.svg。不正な ID は例外', () => {
  assert.equal(figureUrl('https://x.test/g-kentei/data/', 'fig-a-b'), 'https://x.test/g-kentei/data/figures/fig-a-b.svg');
  assert.throws(() => figureUrl('https://x.test/data/', '../secret'));
});

const BAD = {
  script: GOOD.replace('<rect', '<script>alert(1)</script><rect'),
  foreignObject: GOOD.replace('<rect', '<foreignObject><div/></foreignObject><rect'),
  style要素: GOOD.replace('<rect', '<style>.a{fill:red}</style><rect'),
  style属性: GOOD.replace('class="fa"', 'style="fill:red"'),
  image: GOOD.replace('<rect', '<image href="#a"/><rect'),
  イベント属性: GOOD.replace('class="fa"', 'onclick="x()"'),
  外部href: GOOD.replace('<rect', '<use href="https://evil.test/a.svg#b"/><rect'),
  xlink外部: GOOD.replace('<rect', '<use xlink:href="http://evil.test/a.svg#b"/><rect'),
  相対href: GOOD.replace('<rect', '<use href="other.svg#b"/><rect'),
  javascript: GOOD.replace('<rect', '<a href="javascript:alert(1)"><rect'),
  外部url: GOOD.replace('class="fa"', 'fill="url(https://evil.test/p)"'),
  外部URLの文字: GOOD.replace('文字', '見よ http://evil.test/'),
  dataURL: GOOD.replace('<rect', '<use href="data:image/svg+xml;base64,AAAA"/><rect'),
};

test('SVG の禁止事項: 良い図は通り、悪い図はどれも見つかる', () => {
  assert.deepEqual(svgProblems(GOOD), []);
  assert.deepEqual(svgProblems(GOOD.replace('<rect', '<use href="#a"/><rect').replace('class="fa"', 'fill="url(#a)"')), []);
  for (const [name, svg] of Object.entries(BAD)) assert.ok(svgProblems(svg).length > 0, name + ' が見つからない');
  assert.ok(svgProblems('').length > 0);
});

test('viewBox の幅を読む', () => {
  assert.equal(viewBoxWidth(GOOD), 320);
  assert.equal(viewBoxWidth('<svg viewBox="0 0 400.5 10">'), 400.5);
  assert.equal(viewBoxWidth('<svg>'), null);
});

test('id の付け替え: id とそれを指す参照をそろえて直し、他は変えない', () => {
  const t = '<svg><title id="a-t">x</title><desc id="a-d">y</desc><defs><pattern id="p"/></defs><g aria-labelledby="a-t a-d"/><use href="#p"/><rect fill="url(#p)"/><text>#p</text></svg>';
  const o = scopeIds(t, 'f3');
  assert.ok(o.includes('id="a-t-f3"') && o.includes('id="a-d-f3"') && o.includes('id="p-f3"'));
  assert.ok(o.includes('aria-labelledby="a-t-f3 a-d-f3"') && o.includes('href="#p-f3"') && o.includes('url(#p-f3)'));
  assert.ok(o.includes('<text>#p</text>'));
  assert.equal(scopeIds('<svg><rect/></svg>', 'f1'), '<svg><rect/></svg>');
  assert.deepEqual(svgProblems(o), []);
});

// ---- 配っている図 ----
const APPS = ['g-kentei', 'dx-biz'];
function refs(app) {
  const out = [];
  for (const k of ['concepts', 'questions']) {
    const dir = join(root, app, 'data', k);
    if (!existsSync(dir)) continue;
    for (const fn of readdirSync(dir).filter((x) => x.endsWith('.json'))) for (const o of JSON.parse(readFileSync(join(dir, fn), 'utf8'))) if (o.figures !== undefined) out.push({ id: o.id, figures: o.figures });
  }
  return out;
}

test('配っている図: figures が指す SVG が実在し、決まり（禁止事項・viewBox・読み上げ）を満たす', () => {
  let nFig = 0, nRef = 0;
  for (const app of APPS) {
    const dir = join(root, app, 'data', 'figures');
    const files = existsSync(dir) ? readdirSync(dir).filter((x) => x.endsWith('.svg')) : [];
    for (const r of refs(app)) {
      assert.ok(Array.isArray(r.figures), `${app} ${r.id}: figures が配列でない`);
      for (const f of r.figures) { assert.ok(FIGURE_ID_RE.test(f), `${app} ${r.id}: ${f}`); assert.ok(files.includes(f + '.svg'), `${app} ${r.id}: ${f}.svg が無い`); nRef++; }
    }
    for (const fn of files) {
      const t = readFileSync(join(dir, fn), 'utf8');
      assert.deepEqual(svgProblems(t), [], fn);
      assert.ok(viewBoxWidth(t) > 0 && viewBoxWidth(t) <= 360, `${fn}: viewBox の幅 ${viewBoxWidth(t)}`);
      assert.ok(/<svg[^>]*role="img"/.test(t) && /<title[\s>]/.test(t) && /<desc[\s>]/.test(t), `${fn}: 読み上げ用の指定が足りない`);
      assert.equal(fn.replace(/\.svg$/, ''), (/aria-labelledby="([^" ]+)-t /.exec(t) || [])[1], `${fn}: id の接頭辞がファイル名と違う`);
      nFig++;
    }
  }
  assert.ok(nFig >= 6 && nRef >= 50, `図 ${nFig} 枚・参照 ${nRef} 件`);
});

// ---- データ検査が落ちること（tools/check-data.js・check-data-dx.js）----
function fixture(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'cq-fig-'));
  const d = join(dir, 'data');
  for (const k of ['concepts', 'questions', 'figures']) mkdirSync(join(d, k), { recursive: true });
  const src = [{ title: 't', url: 'https://example.com/a' }];
  writeFileSync(join(d, 'syllabus.json'), JSON.stringify([{ title: 'A', children: [{ title: 'B' }] }]));
  const concept = { id: 'C-01-001', syllabus: ['A', 'B'], title: 't', oneLine: 'o', why: 'w', links: [], confusions: [], figures: ['fig-t-a'], sources: src, status: 'verified' };
  const question = { id: 'G-01-001', syllabus: ['A', 'B'], format: 'single', difficulty: 1, stem: 's', choices: ['x', 'y'], answer: 0, explanation: 'e', whyWrong: [null, 'w'], memoryTip: 'm', concepts: ['C-01-001'], figures: ['fig-t-a'], sources: src, status: 'verified' };
  const ctx = { concept, question, svg: GOOD, svgName: 'fig-t-a.svg' };
  if (mutate) mutate(ctx);
  writeFileSync(join(d, 'concepts', '01_x.json'), JSON.stringify([ctx.concept], null, 2) + '\n');
  writeFileSync(join(d, 'questions', '01_x.json'), JSON.stringify([ctx.question], null, 2) + '\n');
  if (ctx.svg !== null) writeFileSync(join(d, 'figures', ctx.svgName), ctx.svg);
  return { dir, files: [join(d, 'questions', '01_x.json'), join(d, 'concepts', '01_x.json')] };
}
function run(tool, mutate) {
  const fx = fixture(mutate);
  try {
    const r = spawnSync(process.execPath, [join(root, 'tools', tool), ...fx.files], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  } finally { rmSync(fx.dir, { recursive: true, force: true }); }
}
const TOOLS = ['check-data.js', 'check-data-dx.js'];

for (const tool of TOOLS) {
  test(`${tool}: 図が決まりどおりなら OK（そのまま通ることを先に確かめる）`, () => {
    // dx 版は id の形式が違う（D-NN-NNN / DC-NN-NNN）ので、その形に直した固定データで確かめる
    const mut = tool === 'check-data-dx.js' ? (c) => { c.concept.id = 'DC-01-001'; c.question.id = 'D-01-001'; c.question.concepts = ['DC-01-001']; } : null;
    const r = run(tool, mut);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /結果: OK/);
  });

  const dxFix = (c) => { if (tool === 'check-data-dx.js') { c.concept.id = 'DC-01-001'; c.question.id = 'D-01-001'; c.question.concepts = ['DC-01-001']; } };
  const cases = [
    ['対応する SVG が無い', (c) => { c.svg = null; }, /対応する SVG が無い/],
    ['ID の形式が不正', (c) => { c.question.figures = ['../x']; }, /ID の形式/],
    ['figures が配列でない', (c) => { c.concept.figures = 'fig-t-a'; }, /配列でない/],
    ['figures に同じ ID が2回', (c) => { c.question.figures = ['fig-t-a', 'fig-t-a']; }, /重複/],
    ['script がある', (c) => { c.svg = BAD.script; }, /<script>/],
    ['外部への href がある', (c) => { c.svg = BAD.外部href; }, /href/],
    ['外部URLの文字がある', (c) => { c.svg = BAD.外部URLの文字; }, /外部のURL/],
    ['style 属性がある', (c) => { c.svg = BAD.style属性; }, /style 属性/],
    ['イベント属性がある', (c) => { c.svg = BAD.イベント属性; }, /イベント属性/],
    ['viewBox の幅が 360 を超える', (c) => { c.svg = GOOD.replace('0 0 320 100', '0 0 400 100'); }, /360 を超える/],
    ['title が無い', (c) => { c.svg = GOOD.replace(/<title[\s\S]*?<\/title>/, ''); }, /<title> が無い/],
    ['desc が無い', (c) => { c.svg = GOOD.replace(/<desc[\s\S]*?<\/desc>/, ''); }, /<desc> が無い/],
    ['role="img" が無い', (c) => { c.svg = GOOD.replace(' role="img"', ''); }, /role="img"/],
    ['使われていない図は警告（NG にはしない）', (c) => { c.concept.figures = []; c.question.figures = []; }, /使われていない/, true],
  ];
  for (const [name, mut, re, okExit] of cases) {
    test(`${tool}: ${name}`, () => {
      const r = run(tool, (c) => { dxFix(c); mut(c); });
      assert.equal(r.code, okExit ? 0 : 1, r.out);
      assert.match(r.out, re);
    });
  }
}

// ---- サービスワーカー ----
test('サービスワーカー: 図を表示するファイルをキャッシュ対象に持ち、図の ID の形が lib と同じ', () => {
  const sw = readFileSync(join(root, 'shared', 'sw-core.js'), 'utf8');
  for (const f of ['views/figure.js', 'lib/figures.js']) {
    assert.ok(sw.includes(`'../shared/js/${f}'`), f + ' が SHARED に無い');
    assert.ok(existsSync(join(root, 'shared', 'js', f)), f);
  }
  assert.ok(sw.includes('data/figures/'), '図を取る処理が無い');
  assert.equal(/const FIGURE_ID = (\/.*\/);/.exec(sw)[1], FIGURE_ID_RE.toString());
  for (const app of APPS) assert.match(readFileSync(join(root, app, 'sw.js'), 'utf8'), /version: '13'/);
});
