// 相互依存の問題（qtype: interdep）の言い回しの偏りの検査（tools/check-data-dx.js の checkInterdepWording）。
// 正解だけが相互依存の言い回しを使う／誤答がみな片づけの言い回し、のときに WARN が出ること・良い形では出ないこと。
// 実行: cd shared && node --test tests/interdep.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// DX 版の検査が求めるシラバスの木（4領域×3分類＋補足）の最小形（figures.test.js と同じ形）
const DX_SYL = [1, 2, 3, 4].map((d) => ({ id: 'D' + d, title: '領域' + d, children: [1, 2, 3].map((k) => { const ch = String((d - 1) * 3 + k).padStart(2, '0'); return { id: ch + 'A', title: '分類' + ch, children: ['基本概念', '応用事例', '最新事例＆トレンド'].map((t) => ({ title: t })) }; }) }))
  .concat([{ id: 'S', title: '補足', supplement: true, children: [{ id: '13S', title: '補足', children: [{ title: 'その他' }] }] }]);

function run(choices, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cq-interdep-'));
  try {
    const d = join(dir, 'data');
    for (const k of ['concepts', 'questions']) mkdirSync(join(d, k), { recursive: true });
    const src = [{ title: 't', url: 'https://example.com/a' }];
    const syl = ['領域1', '分類01', '基本概念'];
    const concept = { id: 'DC-01-001', syllabus: syl, title: 't', oneLine: 'o', why: 'w', links: [], confusions: [], sources: src, status: 'verified' };
    const question = { id: 'D-01-001', syllabus: syl, qtype: 'interdep', format: 'single', difficulty: 2, stem: '要素の関係として最も適切なものを選びなさい。', choices, answer: 0, explanation: 'e', whyWrong: [null, 'w', 'w', 'w'], memoryTip: 'm', concepts: ['DC-01-001'], sources: src, status: 'verified', ...extra };
    writeFileSync(join(d, 'syllabus.json'), JSON.stringify(DX_SYL));
    writeFileSync(join(d, 'concepts', '01_x.json'), JSON.stringify([concept]));
    writeFileSync(join(d, 'questions', '01_x.json'), JSON.stringify([question]));
    const r = spawnSync(process.execPath, [join(root, 'tools', 'check-data-dx.js'), join(d, 'questions', '01_x.json'), join(d, 'concepts', '01_x.json')], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// 正解は同じ文。誤答の書き方だけを変えて確かめる
const RIGHT = '承認の手順、研修、画面の工夫は互いに支え合う。理由を考えてから承認しないと、手順だけでは防げない';

test('偏り A: 相互依存の言い回しが正解にだけある → WARN（終了コードは 0 のまま）', () => {
  const r = run([RIGHT, '承認の手順を整えることが中心になる。研修と画面は補助の役で、手順の質で防げる', '研修で欠点を教えることが中心になる。担当者が詳しければ、表示の有無は小さな違いになる', '画面に生成物と表示することが中心になる。表示があれば担当者は注意して読む']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /WARN 01_x\.json D-01-001: interdep: 相互依存の言い回し（互いに・支え合）が正解にだけあり/);
  assert.match(r.out, /INTERDEP 全体: 言い回しの偏りがある 1\/1/);
});

test('偏り B: 誤答のすべてが片づけの言い回しを含み、正解には無い → WARN', () => {
  const right = '承認の手順、研修、画面の工夫がそろわないと鵜呑みは防げない';
  const r = run([right.replace('がそろわないと', 'の3つを合わせて整えないと'), '承認の手順を入れれば足りる', '研修は後から受ければよい', '画面の工夫は承認とは関わらない']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /D-01-001: interdep: 誤答のすべてが片づけの言い回し（足りる・ればよい・後から・関わらない）を含み、正解には無い/);
});

test('良い形: 誤答も同じ相互依存の言い回しで、1点だけ違う → WARN なし', () => {
  const r = run([RIGHT, '承認の手順と研修は互いに支え合うが、画面の工夫は見た目の問題にとどまる', '承認の手順と画面の工夫は互いに支え合うが、研修は無くても注意して読む', '3つは互いに支え合うが、承認は速さが要なので考え込まずに即決する']);
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /interdep:/);
  assert.match(r.out, /INTERDEP 全体: 言い回しの偏りがある 0\/1/);
});

test('誤答の「連携しない」は相互依存の語として数えない（連携を否定した誤答だけなら A になる）', () => {
  const r = run(['外部と社内の力は連携してはじめて成果になる', '外部と連携しなくても自社の研究だけで同じ成果が出る', '提携の数を増やすほど成果は比例して増える', '提携で費用を下げることが主な目的になる']);
  assert.match(r.out, /D-01-001: interdep: 相互依存の言い回し（はじめて・連携）が正解にだけあり/);
});

test('対象外: qtype が interdep でない／format が not の問題は見ない', () => {
  const choices = [RIGHT, '承認の手順を入れれば足りる', '研修は後から受ければよい', '画面の工夫は承認とは関わらない'];
  assert.doesNotMatch(run(choices, { qtype: 'relation' }).out, /interdep:/);
  assert.doesNotMatch(run(choices, { format: 'not', stem: '不適切なものを選びなさい。' }).out, /interdep:/);
});
