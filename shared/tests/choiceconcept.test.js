// 誤答の語のカードが concepts に無い（tools/check-choice-concepts.cjs。tools/check-data.js と tools/check-data-dx.js が呼ぶ。CHOICE-CONCEPT）。
// 2026-11-12、DX の D-05-017 で、誤答（ドミナント戦略・密度の経済・デジュールスタンダード）のカードが concepts に入っておらず、
// 解いた後に開けなかった。誤答の文がカードの title（括弧の外・中の別名も）や取り違え欄の title と完全一致するのに concepts に無いと WARN が出ること、
// concepts にあれば出ないこと、正解の選択肢と文章の選択肢は見ないこと。
// 実行: cd shared && node --test tests/choiceconcept.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// DX 版の検査が求めるシラバスの木（voicecue.test.js と同じ形）
const DX_SYL = [1, 2, 3, 4].map((d) => ({ id: 'D' + d, title: '領域' + d, children: [1, 2, 3].map((k) => { const ch = String((d - 1) * 3 + k).padStart(2, '0'); return { id: ch + 'A', title: '分類' + ch, children: ['基本概念', '応用事例', '最新事例＆トレンド'].map((t) => ({ title: t })) }; }) }))
  .concat([{ id: 'S', title: '補足', supplement: true, children: [{ id: '13S', title: '補足', children: [{ title: 'その他' }] }] }]);
const GK_SYL = [{ title: '章1', children: [{ title: '節1' }] }];

const CHECKERS = {
  gk: { tool: 'check-data.js', syl: GK_SYL, path: ['章1', '節1'], qid: 'G-01-001', cid: (n) => 'C-01-00' + n, extra: {} },
  dx: { tool: 'check-data-dx.js', syl: DX_SYL, path: ['領域1', '分類01', '基本概念'], qid: 'D-01-001', cid: (n) => 'DC-01-00' + n, extra: { qtype: 'relation' } },
};

// カード: 1 範囲の経済（正解）・2 RPA（Robotic Process Automation）・3 デファクトスタンダード（取り違え欄にデジュールスタンダード）
function run(which, choices, answer, conceptNums) {
  const c = CHECKERS[which];
  const dir = mkdtempSync(join(tmpdir(), 'cq-choicecon-'));
  try {
    const d = join(dir, 'data');
    for (const k of ['concepts', 'questions']) mkdirSync(join(d, k), { recursive: true });
    const src = [{ title: 't', url: 'https://example.com/a' }];
    const card = (n, title, confusions = []) => ({ id: c.cid(n), syllabus: c.path, title, oneLine: 'o', why: 'w', links: [], confusions, sources: src, status: 'verified' });
    const concepts = [
      card(1, '範囲の経済'),
      card(2, 'RPA（Robotic Process Automation）'),
      card(3, 'デファクトスタンダード', [{ title: 'デジュールスタンダード', point: 'p' }]),
    ];
    const whyWrong = choices.map((_, i) => (i === answer ? null : 'w'));
    const question = { id: c.qid, syllabus: c.path, format: 'single', difficulty: 2, stem: '最も適切なものを選びなさい。', choices, answer, explanation: 'e', whyWrong, memoryTip: 'm', concepts: conceptNums.map(c.cid), sources: src, status: 'verified', ...c.extra };
    writeFileSync(join(d, 'syllabus.json'), JSON.stringify(c.syl));
    writeFileSync(join(d, 'concepts', '01_x.json'), JSON.stringify(concepts));
    writeFileSync(join(d, 'questions', '01_x.json'), JSON.stringify([question]));
    const r = spawnSync(process.execPath, [join(root, 'tools', c.tool), join(d, 'questions', '01_x.json'), join(d, 'concepts', '01_x.json')], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

for (const which of Object.keys(CHECKERS)) {
  const { qid, cid } = CHECKERS[which];

  test(`${which}: 誤答「RPA」（title の括弧の外）と「デジュールスタンダード」（取り違え欄）のカードが concepts に無い（直す前の D-05-017 の型）→ CHOICE-CONCEPT（終了コードは 0 のまま）`, () => {
    const r = run(which, ['範囲の経済', 'RPA', 'デジュールスタンダード', '規模の経済'], 0, [1]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, new RegExp(`WARN 01_x\\.json ${qid}: CHOICE-CONCEPT: .*「RPA」→ ${cid(2)}.*「デジュールスタンダード」→ ${cid(3)}`));
    assert.match(r.out, /CHOICE-CONCEPT 全体: 誤答の語のカードが concepts に無い 1\/1/);
  });

  test(`${which}: 括弧の中の別名（Robotic Process Automation）と組み合わせの欄（（ア）〜）も見る → CHOICE-CONCEPT`, () => {
    const r = run(which, ['（ア）範囲の経済　（イ）規模の経済', '（ア）Robotic Process Automation　（イ）規模の経済'], 0, [1]);
    assert.match(r.out, new RegExp(`CHOICE-CONCEPT: .*「Robotic Process Automation」→ ${cid(2)}`));
  });

  test(`${which}: 誤答のカードを concepts の末尾に足した形（直した D-05-017）→ WARN なし`, () => {
    const r = run(which, ['範囲の経済', 'RPA', 'デジュールスタンダード', '規模の経済'], 0, [1, 2, 3]);
    assert.doesNotMatch(r.out, /CHOICE-CONCEPT:/);
    assert.match(r.out, /CHOICE-CONCEPT 全体: 誤答の語のカードが concepts に無い 0\/1/);
  });

  test(`${which}: 正解の選択肢と、文章の中に語が出るだけの誤答は見ない → WARN なし`, () => {
    const r = run(which, ['RPA', 'RPAで請求書の入力を自動にする', '範囲の経済を使って事業を広げる', '規模の経済'], 0, [1]);
    assert.doesNotMatch(r.out, /CHOICE-CONCEPT:/);
  });
}
