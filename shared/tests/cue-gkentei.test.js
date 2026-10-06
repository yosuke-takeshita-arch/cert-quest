// 選択肢の語の偏りの検査（G検定版 tools/check-data.js の checkCueWords。DX 版 tools/check-data-dx.js の写し）。
// DX 版のテスト（cue.test.js）と同じ場面で、G検定版でも同じ判定になること。
// 実行: cd shared && node --test tests/cue-gkentei.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SYL = [{ title: '章1', children: [{ title: '節1' }] }];

function run(choices, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cq-cue-gk-'));
  try {
    const d = join(dir, 'data');
    for (const k of ['concepts', 'questions']) mkdirSync(join(d, k), { recursive: true });
    const src = [{ title: 't', url: 'https://example.com/a' }];
    const syl = ['章1', '節1'];
    const concept = { id: 'C-01-001', syllabus: syl, title: 't', oneLine: 'o', why: 'w', links: [], confusions: [], sources: src, status: 'verified' };
    const question = { id: 'G-01-001', syllabus: syl, format: 'single', difficulty: 2, stem: '説明として最も適切なものを選びなさい。', choices, answer: 0, explanation: 'e', whyWrong: [null, 'w', 'w', 'w'], memoryTip: 'm', concepts: ['C-01-001'], sources: src, status: 'verified', ...extra };
    writeFileSync(join(d, 'syllabus.json'), JSON.stringify(SYL));
    writeFileSync(join(d, 'concepts', '01_x.json'), JSON.stringify([concept]));
    writeFileSync(join(d, 'questions', '01_x.json'), JSON.stringify([question]));
    const r = spawnSync(process.execPath, [join(root, 'tools', 'check-data.js'), join(d, 'questions', '01_x.json'), join(d, 'concepts', '01_x.json')], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const RIGHT = '畳み込み層で局所的な特徴を取り出し、プーリング層で位置のずれに強くし、全結合層で分類する';

test('誤答のすべてにだけ「ただし」がある → WARN（終了コードは 0 のまま）', () => {
  const r = run([RIGHT, '畳み込み層で局所的な特徴を取り出す。ただしプーリング層は位置のずれに弱くする', '畳み込み層で局所的な特徴を取り出す。ただし全結合層は使わない', '畳み込み層で局所的な特徴を取り出す。ただし層は1つだけにする']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /WARN 01_x\.json G-01-001: cue: 「ただし」が誤答のすべてにあり、正解に無い/);
  assert.match(r.out, /CUE 全体: 語の偏りがある 1\/1/);
});

test('正解にだけ「必ず」「常に」がある（format が not で、不適切な文だけが言い切る）→ WARN', () => {
  const r = run(['有意水準を小さくすると、第2種の誤りも必ず小さくなる', '第1種の誤りの確率を有意水準という', '帰無仮説が誤りなのに棄却しない誤りを第2種の誤りという', 'ずれが大きいほど第2種の誤りは起きにくい'], { format: 'not', stem: '最も不適切なものを選びなさい。' });
  assert.match(r.out, /G-01-001: cue: 「必ず」が正解にだけあり、誤答のどれにも無い/);
  const r2 = run(['KL情報量は、PとQを入れ替えても常に同じ値になる', '分布の違いを表す', '同じ分布なら0になる', 'VAEの誤差関数に使う'], { format: 'not', stem: '最も不適切なものを選びなさい。' });
  assert.match(r2.out, /G-01-001: cue: 「常に」が正解にだけあり/);
});

test('良い形: 同じ語を正解と誤答の両方に使う／どちらにも使わない → WARN なし', () => {
  const r = run(['少数の例を示すだけで多くのタスクをこなす', 'ルールを書くだけで範囲を示せる', '画像と文章から学習する', '規模を大きくすると性能が下がる']);
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /cue:/);
  assert.match(r.out, /CUE 全体: 語の偏りがある 0\/1/);
});

test('誤答の一部（3つのうち2つ）だけにある語は数えない', () => {
  const r = run([RIGHT, 'ただしプーリングは使わない', 'ただし全結合層は使わない', '層は1つにする']);
  assert.doesNotMatch(r.out, /cue:/);
});

test('除外: 「だけでなく」「どれだけ」「非常に」は「だけ」「常に」として数えない', () => {
  const r = run(['精度だけでなく公平性も見る', '精度を見る', '速度を見る', '費用を見る']);
  assert.doesNotMatch(r.out, /cue:/);
  const r2 = run(['予測がどれだけ外れたかを測る', '学習の速さを測る', 'データの量を測る', '層の数を測る']);
  assert.doesNotMatch(r2.out, /cue:/);
  const r3 = run(['非常に大きなモデルで学ぶ', '小さなモデルで学ぶ', 'ルールで動く', '人手で書く']);
  assert.doesNotMatch(r3.out, /cue:/);
});

test('誤答が1つしかない問題は見ない', () => {
  const r = run(['正しい', 'ただし誤り'], { whyWrong: [null, 'w'] });
  assert.doesNotMatch(r.out, /cue:/);
});

test('語の一覧は DX 版と同じ（片方だけ直したら落ちる）', () => {
  const pick = (f) => {
    const m = readFileSync(join(root, 'tools', f), 'utf8').match(/const CUE_WORDS = \[[\s\S]*?\];/);
    assert.ok(m, f + ' に CUE_WORDS が無い');
    return m[0];
  };
  assert.equal(pick('check-data.js'), pick('check-data-dx.js'));
});
