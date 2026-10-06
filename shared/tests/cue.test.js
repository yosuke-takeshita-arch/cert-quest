// 選択肢の語の偏りの検査（tools/check-data-dx.js の checkCueWords）。
// 誤答のすべてにだけある語・正解にだけある語（ただし・だけ・必ず など）で WARN が出ること・良い形と除外の語では出ないこと。
// 実行: cd shared && node --test tests/cue.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// DX 版の検査が求めるシラバスの木（4領域×3分類＋補足）の最小形（interdep.test.js と同じ形）
const DX_SYL = [1, 2, 3, 4].map((d) => ({ id: 'D' + d, title: '領域' + d, children: [1, 2, 3].map((k) => { const ch = String((d - 1) * 3 + k).padStart(2, '0'); return { id: ch + 'A', title: '分類' + ch, children: ['基本概念', '応用事例', '最新事例＆トレンド'].map((t) => ({ title: t })) }; }) }))
  .concat([{ id: 'S', title: '補足', supplement: true, children: [{ id: '13S', title: '補足', children: [{ title: 'その他' }] }] }]);

function run(choices, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cq-cue-'));
  try {
    const d = join(dir, 'data');
    for (const k of ['concepts', 'questions']) mkdirSync(join(d, k), { recursive: true });
    const src = [{ title: 't', url: 'https://example.com/a' }];
    const syl = ['領域1', '分類01', '基本概念'];
    const concept = { id: 'DC-01-001', syllabus: syl, title: 't', oneLine: 'o', why: 'w', links: [], confusions: [], sources: src, status: 'verified' };
    const question = { id: 'D-01-001', syllabus: syl, qtype: 'relation', format: 'single', difficulty: 2, stem: '説明として最も適切なものを選びなさい。', choices, answer: 0, explanation: 'e', whyWrong: [null, 'w', 'w', 'w'], memoryTip: 'm', concepts: ['DC-01-001'], sources: src, status: 'verified', ...extra };
    writeFileSync(join(d, 'syllabus.json'), JSON.stringify(DX_SYL));
    writeFileSync(join(d, 'concepts', '01_x.json'), JSON.stringify([concept]));
    writeFileSync(join(d, 'questions', '01_x.json'), JSON.stringify([question]));
    const r = spawnSync(process.execPath, [join(root, 'tools', 'check-data-dx.js'), join(d, 'questions', '01_x.json'), join(d, 'concepts', '01_x.json')], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const RIGHT = '基盤、規制改革、住民の合意は組み合わさって働く。基盤でデータをつなぎ、規制の特例をまとめて求め、計画は住民の意向を踏まえて作る';

test('誤答のすべてにだけ「ただし」がある（点検 review-1006d の型）→ WARN（終了コードは 0 のまま）', () => {
  const r = run([RIGHT, '基盤、規制改革、住民の合意は組み合わさって働く。ただし住民の合意はサービスが始まってから取る', '基盤、規制改革、住民の合意は組み合わさって働く。ただし規制改革は分野ごとに順に進める', '基盤、規制改革、住民の合意は組み合わさって働く。ただし基盤は各サービスが自前で持つ']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /WARN 01_x\.json D-01-001: cue: 「ただし」が誤答のすべてにあり、正解に無い/);
  assert.match(r.out, /CUE 全体: 語の偏りがある 1\/1/);
});

test('正解にだけ「必ず」がある（format が not で、不適切な文だけが言い切る）→ WARN', () => {
  const r = run(['後発の者が必ず同じ規模まで追いつくので、市場シェアは偏らない', 'プラットフォームは提供者と利用者をつなぐ', '取引形態は4つの類型に分けられる', '利用者が増えるほど価値が上がる'], { format: 'not', stem: '適切でないものを選びなさい。' });
  assert.match(r.out, /D-01-001: cue: 「必ず」が正解にだけあり、誤答のどれにも無い/);
});

test('良い形: 同じ語を正解と誤答の両方に使い、1点だけ違える → WARN なし', () => {
  const r = run([RIGHT, '基盤、規制改革、住民の合意は組み合わさって働く。基盤でデータをつなぎ、規制の特例をまとめて求め、住民の合意は始まってから取る', '基盤、規制改革、住民の合意は組み合わさって働く。基盤でデータをつなぎ、規制の特例は分野ごとに順に求め、計画は住民の意向を踏まえて作る', '基盤、規制改革、住民の合意は組み合わさって働く。基盤は各サービスが自前で持ち、規制の特例をまとめて求め、計画は住民の意向を踏まえて作る']);
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /cue:/);
  assert.match(r.out, /CUE 全体: 語の偏りがある 0\/1/);
});

test('誤答の一部（3つのうち2つ）だけにある語は数えない', () => {
  const r = run([RIGHT, 'ただし住民の合意は後で取る', 'ただし規制改革は順に進める', '基盤は各サービスが自前で持つ']);
  assert.doesNotMatch(r.out, /cue:/);
});

test('除外: 「だけでなく」「どれだけ」「異常に」は「だけ」「常に」として数えない', () => {
  const r = run(['入れるだけでなく出すことも含む', '外の知恵を取り込む', '自社の技術を守る', '社内で完結させる']);
  assert.doesNotMatch(r.out, /cue:/);
  const r2 = run(['顧客にどれだけ合うかで決まる', '機能の数で決まる', '広告で決まる', '価格で決まる']);
  assert.doesNotMatch(r2.out, /cue:/);
  const r3 = run(['異常に当日気づける', '翌朝に気づける', '月末に気づける', '気づけない']);
  assert.doesNotMatch(r3.out, /cue:/);
});

test('誤答が1つしかない問題は見ない', () => {
  const r = run(['正しい', 'ただし誤り'], { whyWrong: [null, 'w'] });
  assert.doesNotMatch(r.out, /cue:/);
});
