// 部分ごとの多数決で正解に当たる型の検査（tools/check-data.js と tools/check-data-dx.js の checkSegMajority。SEG-MAJORITY）。
// 誤答がみな正解を1か所だけ変えた形（実例 D-01-125）で WARN が出ること・直した形（abb・bab・bba）や並べ替えの問題では出ないこと。
// 実行: cd shared && node --test tests/segmajority.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// DX 版の検査が求めるシラバスの木（cue.test.js と同じ形）
const DX_SYL = [1, 2, 3, 4].map((d) => ({ id: 'D' + d, title: '領域' + d, children: [1, 2, 3].map((k) => { const ch = String((d - 1) * 3 + k).padStart(2, '0'); return { id: ch + 'A', title: '分類' + ch, children: ['基本概念', '応用事例', '最新事例＆トレンド'].map((t) => ({ title: t })) }; }) }))
  .concat([{ id: 'S', title: '補足', supplement: true, children: [{ id: '13S', title: '補足', children: [{ title: 'その他' }] }] }]);
const GK_SYL = [{ title: '章1', children: [{ title: '節1' }] }];

const CHECKERS = {
  gk: { tool: 'check-data.js', syl: GK_SYL, path: ['章1', '節1'], qid: 'G-01-001', cid: 'C-01-001', extra: {} },
  dx: { tool: 'check-data-dx.js', syl: DX_SYL, path: ['領域1', '分類01', '基本概念'], qid: 'D-01-001', cid: 'DC-01-001', extra: { qtype: 'relation' } },
};

function run(which, choices, answer = 0, extra = {}) {
  const c = CHECKERS[which];
  const dir = mkdtempSync(join(tmpdir(), 'cq-seg-'));
  try {
    const d = join(dir, 'data');
    for (const k of ['concepts', 'questions']) mkdirSync(join(d, k), { recursive: true });
    const src = [{ title: 't', url: 'https://example.com/a' }];
    const concept = { id: c.cid, syllabus: c.path, title: 't', oneLine: 'o', why: 'w', links: [], confusions: [], sources: src, status: 'verified' };
    const whyWrong = choices.map((_, i) => (i === answer ? null : 'w'));
    const question = { id: c.qid, syllabus: c.path, format: 'single', difficulty: 2, stem: '説明として最も適切なものを選びなさい。', choices, answer, explanation: 'e', whyWrong, memoryTip: 'm', concepts: [c.cid], sources: src, status: 'verified', ...c.extra, ...extra };
    writeFileSync(join(d, 'syllabus.json'), JSON.stringify(c.syl));
    writeFileSync(join(d, 'concepts', '01_x.json'), JSON.stringify([concept]));
    writeFileSync(join(d, 'questions', '01_x.json'), JSON.stringify([question]));
    const r = spawnSync(process.execPath, [join(root, 'tools', c.tool), join(d, 'questions', '01_x.json'), join(d, 'concepts', '01_x.json')], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// 3つの部分 a・b・c と、それぞれの誤りの言い方 x・y・z
const HEAD = '基盤、規制改革、住民の合意は組み合わさって働く。';
const P = { a: '基盤でサービスの間のデータをつなぎ', x: '基盤は各サービスが自前のデータを置く場で', b: '規制の特例を同時にまとめて求め', y: '規制の特例は分野ごとに1つずつ順に求め', c: '計画は住民の意向を踏まえて作る', z: '住民の合意はサービスが始まってから取る' };
const s = (p, q, r) => `${HEAD}${P[p]}、${P[q]}、${P[r]}`;

for (const which of Object.keys(CHECKERS)) {
  test(`${which}: 誤答がみな正解を1か所だけ変えた形（abc に xbc・ayc・abz。D-01-125 の型）→ WARN（終了コードは 0 のまま）`, () => {
    const r = run(which, [s('a', 'b', 'c'), s('x', 'b', 'c'), s('a', 'y', 'c'), s('a', 'b', 'z')]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, new RegExp(`WARN 01_x\\.json ${CHECKERS[which].qid}: SEG-MAJORITY: 違いのある部分 3 か所`));
    assert.match(r.out, /SEG 全体: 部分ごとの多数派が正解になる 1\/1/);
  });

  test(`${which}: 正解が何番目にあっても同じに見る（answer が 2）`, () => {
    const r = run(which, [s('x', 'b', 'c'), s('a', 'y', 'c'), s('a', 'b', 'c'), s('a', 'b', 'z')], 2);
    assert.match(r.out, /SEG-MAJORITY/);
  });

  test(`${which}: 直した形（abc に ayz・xbz・xyc。どの部分も正解の言い方とほかが2回ずつ）→ WARN なし`, () => {
    const r = run(which, [s('a', 'b', 'c'), s('a', 'y', 'z'), s('x', 'b', 'z'), s('x', 'y', 'c')]);
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.out, /SEG-MAJORITY/);
    assert.match(r.out, /SEG 全体: 部分ごとの多数派が正解になる 0\/1/);
  });

  test(`${which}: 2つの部分で ab・ba・bb に直した形 → WARN なし。直す前の aB・Ab・ab 型（正解 AB）→ WARN`, () => {
    assert.doesNotMatch(run(which, ['MAE 2.5、RMSE 3', 'MAE 2.5、RMSE 9', 'MAE 0.5、RMSE 3', 'MAE 0.5、RMSE 9']).out, /SEG-MAJORITY/);
    assert.match(run(which, ['MAE 2.5、RMSE 3', 'MAE 2.5、RMSE 9', 'MAE 0.5、RMSE 3', 'MAE 7、RMSE 3']).out, /SEG-MAJORITY: 違いのある部分 2 か所/);
  });

  test(`${which}: 助詞・送り仮名だけ違う言い回しは同じ言い方として数える → WARN`, () => {
    const r = run(which, [
      'IT部門が現行業務の支援にとどまる→業務プロセスが個別最適になる→IT投資が非効率になり、変革が妨げられる',
      'IT部門が攻めの投資を担う→業務プロセスは個別最適になる→IT投資は非効率になり、変革が妨げられる',
      'IT部門は現行業務の支援にとどまる→業務プロセスが全社で標準化される→IT投資が非効率になり、変革は妨げられる',
      'IT部門が現行業務の支援にとどまる→業務プロセスが個別最適となる→IT投資が抑えられ、変革が進む',
    ]);
    assert.match(r.out, /SEG-MAJORITY/);
  });

  test(`${which}: 1字の違い（α と β）・打ち消し（できる と できない）は別の言い方 → 同数なら WARN なし`, () => {
    // 3つ目の部分は αカット 1回・βカット 2回。α と β を同じに数えると誤って WARN になる
    const r = run(which, ['Bの値は11以下に決まり、根はAを選ぶので、残りの子は調べない（αカット）', 'Bの値は11以上に決まり、根はAを選ぶので、残りの子は調べない（βカット）', 'Bの値は11以下に決まり、根はBを選ぶので、残りの子は調べない（βカット）', 'Bの値は11以下に決まり、根はAを選ぶので、残りの子も調べる']);
    assert.doesNotMatch(r.out, /SEG-MAJORITY/);
    // 1つ目の部分は「使えない」1回・「使える」2回。打ち消しを無視して同じに数えると誤って WARN になる
    const r2 = run(which, ['予測に使えない、学習に回す', '予測に使える、学習に足す', '予測に使える、学習に回す', '予測を外す、学習に混ぜる']);
    assert.doesNotMatch(r2.out, /SEG-MAJORITY/);
  });

  test(`${which}: 誤答の部分の数が違っても（1つの部分を2つに言い換える）対応を取って WARN`, () => {
    const r = run(which, [
      'データを集める→AIで分析して予測する→結果を機器に返す→品質を上げる',
      'データを集める→グラフにして見える化する→見える化で先も読める→結果を機器に返す→品質を上げる',
      'データを集める→AIで分析して予測する→結果は報告書にまとめる→品質を上げる',
      'データを集める→AIで分析して予測する→結果を機器に返す→費用を下げる',
    ]);
    assert.match(r.out, /SEG-MAJORITY: 違いのある部分 3 か所/);
  });

  test(`${which}: 部分の数が違い、2つの誤答が同じ所を別の形で言い換える（グラフ・見える化）→ 同じ言い方として数え、WARN なし`, () => {
    const r = run(which, [
      'データを集める→AIで分析して予測する→結果を機器に返す→品質を上げる',
      'データを集める→グラフにして見える化する→見える化で先も読める→機器には返さない→人が点検を決める',
      'データを集める→AIで分析して予測する→結果は報告書にまとめる→品質を上げる',
      'データを集める→グラフにして見える化する→見える化で先も読める→結果を機器に返す→品質を上げる',
    ]);
    assert.doesNotMatch(r.out, /SEG-MAJORITY/);
  });

  test(`${which}: 並べ替えの問題は位置で比べる（どの位置も2回ずつ）→ WARN なし`, () => {
    const r = run(which, ['チューリングテスト → ダートマス会議 → エキスパートシステム → 第3次ブーム', 'ダートマス会議 → チューリングテスト → エキスパートシステム → 第3次ブーム', 'チューリングテスト → ダートマス会議 → 第3次ブーム → エキスパートシステム', 'ダートマス会議 → チューリングテスト → 第3次ブーム → エキスパートシステム']);
    assert.doesNotMatch(r.out, /SEG-MAJORITY/);
  });

  test(`${which}: 並べ替えでも、どの位置でも正解の語が最多なら WARN（ABC に BAC・CBA・ACB）`, () => {
    const r = run(which, ['デジュール → デファクト → フォーラム', 'デファクト → デジュール → フォーラム', 'フォーラム → デファクト → デジュール', 'デジュール → フォーラム → デファクト']);
    assert.match(r.out, /SEG-MAJORITY: 違いのある部分 3 か所/);
  });

  test(`${which}: 欄の語の組（ア：〜　イ：〜）でどの欄も正解の語が最多 → WARN`, () => {
    const r = run(which, ['ア：Causal　イ：Dilated', 'ア：Depthwise　イ：Transposed', 'ア：Transposed　イ：Dilated', 'ア：Causal　イ：Depthwise'], 0, { format: 'fill', stem: '（ア）と（イ）に入る語の組み合わせを選びなさい。（　）' });
    assert.match(r.out, /SEG-MAJORITY: 違いのある部分 2 か所/);
  });

  test(`${which}: 区切りの無い文・違いのある部分が1つだけ → 見ない（WARN なし）`, () => {
    assert.doesNotMatch(run(which, ['教師あり学習', '教師なし学習', '半教師あり学習', '強化学習']).out, /SEG-MAJORITY/);
    assert.doesNotMatch(run(which, ['画像を入力し、ラベルを出す', '画像を入力し、文を出す', '画像を入力し、音を出す', '画像を入力し、数を出す']).out, /SEG-MAJORITY/);
    // 誤答の1つが助詞だけ違う正解の言い直し（違いのある部分は「ラベル」の1つだけ）。この型の欠陥ではないので出さない
    assert.doesNotMatch(run(which, ['画像を入力し、ラベルを出す', '画像が入力され、ラベルを出す', '画像を入力し、文を出す', '画像を入力し、音を出す']).out, /SEG-MAJORITY/);
  });

  test(`${which}: 誤答が1つしかない問題は見ない`, () => {
    const r = run(which, ['A、B', 'A、C'], 0);
    assert.doesNotMatch(r.out, /SEG-MAJORITY/);
  });
}

test('gk: 選択肢が「（ア）〇〇　（イ）△△」の組の問題は COMBO-MODE が見るので、SEG-MAJORITY は出さない', () => {
  const r = run('gk', ['（ア）入力　（イ）出力', '（ア）忘却　（イ）出力', '（ア）入力　（イ）忘却', '（ア）更新　（イ）リセット'], 0, { format: 'combo', stem: '（ア）と（イ）に入る語の組み合わせを選びなさい。' });
  assert.doesNotMatch(r.out, /SEG-MAJORITY/);
  assert.match(r.out, /COMBO-MODE/);
});
