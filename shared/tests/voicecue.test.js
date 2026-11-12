// 出典の名乗り・控えめな言い方の偏りの検査（tools/check-voice-cue.cjs。tools/check-data.js と tools/check-data-dx.js が呼ぶ。SOURCE-CUE・HEDGE-CUE）。
// 2026-11-12、4アプリの問題を手で直した型（一部の選択肢だけが「白書は、…としている」と出典を名乗り、名乗る側がいつも正しい文）で WARN が出ること・
// 担当が手がかりでないと判断して残した形（法律が主語・中身の語・文の途中の「とされるので」・答えの側にも似た言い方）では出ないこと。
// 実行: cd shared && node --test tests/voicecue.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// DX 版の検査が求めるシラバスの木（segmajority.test.js と同じ形）
const DX_SYL = [1, 2, 3, 4].map((d) => ({ id: 'D' + d, title: '領域' + d, children: [1, 2, 3].map((k) => { const ch = String((d - 1) * 3 + k).padStart(2, '0'); return { id: ch + 'A', title: '分類' + ch, children: ['基本概念', '応用事例', '最新事例＆トレンド'].map((t) => ({ title: t })) }; }) }))
  .concat([{ id: 'S', title: '補足', supplement: true, children: [{ id: '13S', title: '補足', children: [{ title: 'その他' }] }] }]);
const GK_SYL = [{ title: '章1', children: [{ title: '節1' }] }];

const CHECKERS = {
  gk: { tool: 'check-data.js', syl: GK_SYL, path: ['章1', '節1'], qid: 'G-01-001', cid: 'C-01-001', extra: {} },
  dx: { tool: 'check-data-dx.js', syl: DX_SYL, path: ['領域1', '分類01', '基本概念'], qid: 'D-01-001', cid: 'DC-01-001', extra: { qtype: 'relation' } },
};

const NOT_STEM = '説明として不適切なものを１つ選びなさい。';
const OK_STEM = '説明として最も適切なものを選びなさい。';

function run(which, choices, answer, extra = {}) {
  const c = CHECKERS[which];
  const dir = mkdtempSync(join(tmpdir(), 'cq-voice-'));
  try {
    const d = join(dir, 'data');
    for (const k of ['concepts', 'questions']) mkdirSync(join(d, k), { recursive: true });
    const src = [{ title: 't', url: 'https://example.com/a' }];
    const concept = { id: c.cid, syllabus: c.path, title: 't', oneLine: 'o', why: 'w', links: [], confusions: [], sources: src, status: 'verified' };
    const whyWrong = choices.map((_, i) => (i === answer ? null : 'w'));
    const question = { id: c.qid, syllabus: c.path, format: 'single', difficulty: 2, stem: OK_STEM, choices, answer, explanation: 'e', whyWrong, memoryTip: 'm', concepts: [c.cid], sources: src, status: 'verified', ...c.extra, ...extra };
    writeFileSync(join(d, 'syllabus.json'), JSON.stringify(c.syl));
    writeFileSync(join(d, 'concepts', '01_x.json'), JSON.stringify([concept]));
    writeFileSync(join(d, 'questions', '01_x.json'), JSON.stringify([question]));
    const r = spawnSync(process.execPath, [join(root, 'tools', c.tool), join(d, 'questions', '01_x.json'), join(d, 'concepts', '01_x.json')], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const notQ = { format: 'not', stem: NOT_STEM };

// 直す前の AP-02-009 の形（不適切なものを選ぶ問題で、正しい文1つだけが出典を名乗る）
const AP_009 = [
  '並列に計算できるので、学習に使う文章の量が少なくても高い性能が出る',
  'RNNは前の語の計算を待ってから次に進むので、学習を並列にしにくい',
  'GPUは多くの計算を同時に行うのが得意で、Transformerの学習と相性がよい',
  '白書は、GPUの進化による計算資源の拡充を、生成AIブームの背景に挙げている',
];

for (const which of Object.keys(CHECKERS)) {
  const qid = CHECKERS[which].qid;

  test(`${which}: 不適切なものを選ぶ問題で、正しい文1つだけが「白書は、…挙げている」と名乗る（直す前の AP-02-009）→ SOURCE-CUE（終了コードは 0 のまま）`, () => {
    const r = run(which, AP_009, 0, notQ);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, new RegExp(`WARN 01_x\\.json ${qid}: SOURCE-CUE: 出典を名乗る選択肢が 4つ中 1つだけで、みな正しい文`));
    assert.match(r.out, /SOURCE 全体: 出典の名乗りで答えが絞れる 1\/1/);
  });

  test(`${which}: 出典を問題文に移し、選択肢を中身だけにした形（直した AP-02-009）→ WARN なし`, () => {
    const fixed = AP_009.slice(0, 3).concat(['GPUの進化による計算資源の拡充は、生成AIブームの背景の1つになった']);
    const r = run(which, fixed, 0, { format: 'not', stem: '令和6年版情報通信白書の記述も踏まえて、' + NOT_STEM });
    assert.doesNotMatch(r.out, /SOURCE-CUE|HEDGE-CUE/);
    assert.match(r.out, /SOURCE 全体: 出典の名乗りで答えが絞れる 0\/1/);
  });

  test(`${which}: 括弧つきの出典名（情報通信白書（令和元年版）は、…としている）を2つの正しい文が名乗る（直す前の D-01-026）→ SOURCE-CUE と HEDGE-CUE`, () => {
    const r = run(which, [
      '情報通信白書（令和元年版）は、我が国のICTの導入は現在でも業務の効率化が中心になっているとしている',
      'DXレポート2.2は、デジタル投資の内訳はDXレポート発出後も変化がなく、既存ビジネスの維持・運営に約8割が占められているとしている',
      'ラン・ザ・ビジネス予算とバリューアップ予算の比率は、おおむね8対2である',
      'SoRとSoEは対立するもので、攻めのICTを始めるには守りのICTを廃止する必要がある',
    ], 3, notQ);
    assert.match(r.out, /SOURCE-CUE: 出典を名乗る選択肢が 4つ中 2つだけで、みな正しい文/);
    assert.match(r.out, /HEDGE-CUE: 文の終わりが控えめな言い方（とされる・としている 等）の選択肢が 4つ中 2つだけで、みな正しい文/);
  });

  test(`${which}: 答え（誤った文）だけが「文化庁の考え方では、…とされる。」と名乗る（直す前の G-07-043）→ SOURCE-CUE（みな誤った文）`, () => {
    const r = run(which, [
      'クローラは、リンクをたどってWebページを自動で巡回するプログラムである。',
      '文化庁の考え方では、robots.txtで拒む意思表示があるだけで、第30条の4の対象外になるとされる。',
      'Webサイトの運営者は、robots.txtにルールを書くだけで、アクセスしてほしくない範囲を示せる。',
      '公開されている個人情報でも、個人情報保護のルールの対象になる。',
    ], 1, notQ);
    assert.match(r.out, /SOURCE-CUE: 出典を名乗る選択肢が 4つ中 1つだけで、みな誤った文/);
  });

  test(`${which}: 答えの側にも同じ名乗りがある（正しい文と誤った文の両方が「白書は、」）→ WARN なし`, () => {
    const r = run(which, [
      '白書は、生成AIの学習には少ない文章で足りると述べている',
      'RNNは前の語の計算を待ってから次に進むので、学習を並列にしにくい',
      'GPUは多くの計算を同時に行うのが得意で、Transformerの学習と相性がよい',
      '白書は、GPUの進化による計算資源の拡充を、生成AIブームの背景に挙げている',
    ], 0, notQ);
    assert.doesNotMatch(r.out, /SOURCE-CUE|HEDGE-CUE/);
  });

  test(`${which}: 法律が主語（著作権法は、…と定義している）・中身の語（統合報告書は、）・文の途中の名乗り（〜が、Sカーブの考え方では）→ SOURCE-CUE なし`, () => {
    const rest = ['機械学習は、データから規則を学ぶ方法である', '教師なし学習は、正解の付いていないデータを使う', '強化学習は、報酬が大きくなる行動を学ぶ'];
    for (const named of [
      '著作権法は、著作物を、思想又は感情を創作的に表現したものと定義している',
      '統合報告書は、財務の情報と財務以外の情報をまとめて示す書類として作られている',
      '伸びは小さいが、Sカーブの考え方では、限界に近い技術の伸びは小さくなる',
      '調査は、取引で問題となりうる行為が行われていないかを把握するために行われた',
    ]) {
      const r = run(which, rest.concat([named]), 0, notQ);
      assert.doesNotMatch(r.out, /SOURCE-CUE/, named);
    }
  });

  test(`${which}: ふつうの問題で正解だけが文の終わりで「とされる」→ HEDGE-CUE（みな正しい文）。誤答にも同じ言い方があれば出ない`, () => {
    const base = ['囲碁は、チェスや将棋に比べて探索の組合せが桁違いに多いとされる', '囲碁は、チェスより盤が小さい', '囲碁は、1手で2つの石を置く', '囲碁は、駒の種類が多い'];
    assert.match(run(which, base, 0).out, /HEDGE-CUE: 文の終わりが控えめな言い方（とされる・としている 等）の選択肢が 4つ中 1つだけで、みな正しい文/);
    const both = base.slice(0, 3).concat(['囲碁は、駒の種類が多いと考えられている']);
    assert.doesNotMatch(run(which, both, 0).out, /HEDGE-CUE/);
  });

  test(`${which}: 文の途中の「とされるので」・中身の語（見落としている・盗もうとしている・〜を対象としている）→ HEDGE-CUE なし`, () => {
    const rest = ['データを見る前に有意水準を決める', 'p値が小さいほど帰無仮説を棄却しやすい', '検定統計量が棄却域に入れば棄却する'];
    for (const s of [
      'DevOpsでは障害が起きてもすぐに直せばよいとされるので、安定性は目標から外す',
      '担当者は、ログの異常を見落としている',
      '攻撃者が、アカウント名とパスワードを盗もうとしている',
      'このガイドラインは、AI開発者・AI提供者・AI利用者の3つの主体を対象としている',
    ]) {
      const r = run(which, rest.concat([s]), 0, notQ);
      assert.doesNotMatch(r.out, /HEDGE-CUE/, s);
    }
  });

  test(`${which}: 答えの側に似た言い方（誤った文2つが「〜としている」、正解が「〜を目指すとする」。AP-04-294 の形）→ HEDGE-CUE なし`, () => {
    const r = run(which, [
      'AI人材とはプログラムを書く技術者のことなので、国が育成するのは開発者に限られるとしている',
      'AI人材の育成は企業の責任なので、国は施策を講じないとしている',
      '国は関係者と連携して多様な人材を育て、国民の一人一人がAI適正活用人材を目指すとする',
      'AIの研究開発の成果を、広く国民に知らせる',
    ], 2, {});
    assert.doesNotMatch(r.out, /HEDGE-CUE/);
  });

  test(`${which}: combo の問題は見ない`, () => {
    const r = run(which, ['（ア）白書は、Aとしている　（イ）B', '（ア）C　（イ）D', '（ア）E　（イ）F', '（ア）G　（イ）H'], 0, { format: 'combo', stem: '（ア）と（イ）に入る語の組み合わせを選びなさい。' });
    assert.doesNotMatch(r.out, /SOURCE-CUE|HEDGE-CUE/);
  });
}
