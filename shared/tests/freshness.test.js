// 最新事例の鮮度と引退（2026-11-14 先生決定。要件定義書 §7-6）。
// 先生の問い（逐語）「古いトレンドの問題は消して、新しいトレンドはどんどん採用していかないといけないよね」、門番の案に先生（逐語）「全部おすすめでいい」。
// 見ること:
//   - 読み込み（shared/js/lib/data.js）が asOf・reviewBy・status "retired" を落とさずに持つ
//   - 引退した問題が、出題のもとになる questions・questionById・シラバスの木（ステージ）に入らず、retiredQuestions に入る。
//     そこから作る出題（模試の設計図・復習・あとで見る・よく間違える問題）にも出ない。学習記録は消さない
//   - 検査（tools/check-freshness.cjs を tools/check-data.js・tools/check-data-dx.js が呼ぶ）が、形の誤りを NG に、
//     見直す月が来たものを ID つきで WARN にし、引退で模試の配分が割り込むと WARN を出す
// 実行: cd shared && node --test tests/freshness.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadData, normalizeQuestion, normalizeConcept, isRetired } from '../js/lib/data.js';
import { pickExamByBlueprint, orderExamUnseenFirst } from '../js/lib/quiz.js';
import { dueQuestions, todayReviewPlan } from '../js/lib/progress.js';
import { laterItems } from '../js/lib/later.js';
import { oftenWrong } from '../js/lib/weakness.js';
import { dayNumber } from '../js/lib/srs.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---- 読み込み ----
const Q = (id, syl, extra = {}) => ({
  id, syllabus: syl, format: 'single', difficulty: 1, stem: 's' + id, choices: ['a', 'b', 'c'], answer: 0,
  explanation: 'e', whyWrong: [null, 'b違う', 'c違う'], memoryTip: 'm', concepts: [], sources: [], status: 'verified', ...extra,
});
const C = (id, title, extra = {}) => ({ id, syllabus: ['大', '中', '小'], title, oneLine: 'o', why: 'w', links: [], confusions: [], sources: [], status: 'verified', ...extra });

function fakeFetch(files) {
  return async (url) => {
    const name = url.replace('http://x/data/', '');
    if (!(name in files)) return { ok: false, status: 404, json: async () => { throw new Error('404'); } };
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(files[name])) };
  };
}

test('normalizeQuestion: asOf・reviewBy・retired を落とさない。形の違う年月は null、知らない status は unverified', () => {
  const q = normalizeQuestion(Q('Q1', ['大', '中'], { asOf: '2025-10', reviewBy: '2026-10', status: 'retired' }));
  assert.equal(q.asOf, '2025-10');
  assert.equal(q.reviewBy, '2026-10');
  assert.equal(q.status, 'retired');
  assert.equal(isRetired(q), true);
  const plain = normalizeQuestion(Q('Q2', ['大', '中']));
  assert.equal(plain.asOf, null);
  assert.equal(plain.reviewBy, null);
  assert.equal(plain.status, 'verified');
  assert.equal(isRetired(plain), false);
  for (const bad of ['2025-13', '2025-1', '2025/10', '25-10', 202510, '']) assert.equal(normalizeQuestion(Q('Q3', ['大'], { asOf: bad })).asOf, null, String(bad));
  assert.equal(normalizeQuestion(Q('Q4', ['大'], { status: 'old' })).status, 'unverified');
  assert.equal(normalizeQuestion(Q('Q5', ['大'], { status: 'unverified' })).status, 'unverified');
});

test('normalizeConcept: カードも asOf・reviewBy・retired を落とさない', () => {
  const c = normalizeConcept(C('C1', 't', { asOf: '2026-01', reviewBy: '2027-01', status: 'retired' }));
  assert.deepEqual([c.asOf, c.reviewBy, c.status], ['2026-01', '2027-01', 'retired']);
  assert.deepEqual([normalizeConcept(C('C2', 'u')).asOf, normalizeConcept(C('C2', 'u', { status: 'x' })).status], [null, 'unverified']);
});

async function loadWithRetired() {
  const files = {
    'index.json': { syllabus: 'syllabus.json', questions: ['q.json'], concepts: ['c.json'] },
    'syllabus.json': [{ title: '大', children: [{ title: '中', children: [{ title: '小' }] }, { title: '古いだけの章', children: [{ title: '小2' }] }] }],
    'q.json': [
      Q('Q-NEW', ['大', '中', '小'], { asOf: '2026-09', reviewBy: '2027-09' }),
      Q('Q-OLD', ['大', '中', '小'], { asOf: '2024-05', reviewBy: '2025-05', status: 'retired' }),
      Q('Q-ONLYOLD', ['大', '古いだけの章', '小2'], { status: 'retired' }),
      Q('Q-OLD', ['大', '中', '小']), // 引退した問題と同じ ID は、いままでどおり重複として捨てる
    ],
    'c.json': [C('C-OLD', '古いカード', { status: 'retired', asOf: '2024-05', reviewBy: '2025-05' })],
  };
  return loadData({ dataBase: 'http://x/data/', fetchFn: fakeFetch(files) });
}

test('loadData: 引退した問題は questions・questionById・木に入らず、retiredQuestions に入る', async () => {
  const d = await loadWithRetired();
  assert.deepEqual(d.questions.map((q) => q.id), ['Q-NEW']);
  assert.equal(d.questionById.has('Q-OLD'), false);
  assert.equal(d.questionById.has('Q-NEW'), true);
  assert.deepEqual(d.retiredQuestions.map((q) => q.id), ['Q-OLD', 'Q-ONLYOLD']);
  assert.equal(d.questions[0].asOf, '2026-09');
  // ステージ・小項目・大項目のどこにも入らない（ボス戦・章の練習・苦手・地図の習熟はここから作る）
  const stage = d.tree.stages.find((s) => s.name === '中');
  assert.deepEqual(stage.questions.map((q) => q.id), ['Q-NEW']);
  assert.deepEqual(stage.children[0].questions.map((q) => q.id), ['Q-NEW']);
  assert.deepEqual(d.tree.roots[0].questions.map((q) => q.id), ['Q-NEW']);
  // 問題が全部引退した章は、ステージは残るが問題が0（地図・ボス・バッジは問題の無い章として扱う）
  assert.equal(d.tree.stages.find((s) => s.name === '古いだけの章').questions.length, 0);
  // 同じ ID の重複は、引退していてもいままでどおり捨てて problems に書く
  assert.ok(d.problems.some((p) => p.reason.includes('IDの重複') && p.reason.includes('Q-OLD')));
  // カードは読み込みで落とさない（見せ方は先生の判断待ち）
  assert.deepEqual(d.concepts.map((c) => [c.id, c.status]), [['C-OLD', 'retired']]);
});

test('引退した問題は、出題の関数に渡る一覧に無いので、模試・復習・あとで見る・よく間違える問題のどれにも出ない。記録は消さない', async () => {
  const d = await loadWithRetired();
  const today = dayNumber(new Date(2026, 10, 14));
  // 引退した問題も、引退していない問題も、復習の期日が来ていて・あとで見るに入っていて・よく間違えている記録を持つ
  const rec = { step: 0, due: today - 1, seen: 4, correct: 0, lastOk: false };
  const state = { qstats: { 'Q-OLD': { ...rec }, 'Q-NEW': { ...rec } }, later: { 'Q-OLD': 1, 'Q-NEW': 2 }, reviewToday: null };
  const before = JSON.stringify(state);
  const now = new Date(2026, 10, 14);
  assert.deepEqual(dueQuestions(state, d.questionById, now).map((q) => q.id), ['Q-NEW']);
  assert.deepEqual(todayReviewPlan(state, d.questionById, now).ids, ['Q-NEW']);
  assert.deepEqual(laterItems(state, d.questions).map((x) => x.q.id), ['Q-NEW']);
  assert.deepEqual(oftenWrong(d.questions, state.qstats).map((x) => x.q.id), ['Q-NEW']);
  assert.deepEqual(orderExamUnseenFirst(d.questions, () => 0).map((q) => q.id), ['Q-NEW']);
  const bp = { perRoot: 2, qtypeGroups: [{ types: ['term'], count: 2 }] };
  assert.deepEqual(pickExamByBlueprint(d.questions, bp, ['大'], () => 0).items.map((q) => q.id), ['Q-NEW']);
  assert.equal(JSON.stringify(state), before); // 学習記録は消さない（status を戻せば記録ごと出題に戻る）
});

// ---- 検査 ----
// DX 版の検査が求めるシラバスの木（voicecue.test.js と同じ形）。領域 d の章は (d-1)*3+1〜(d-1)*3+3
const DX_SYL = [1, 2, 3, 4].map((d) => ({ id: 'D' + d, title: '領域' + d, children: [1, 2, 3].map((k) => { const ch = String((d - 1) * 3 + k).padStart(2, '0'); return { id: ch + 'A', title: '分類' + ch, children: ['基本概念', '応用事例', '最新事例＆トレンド'].map((t) => ({ title: t })) }; }) }))
  .concat([{ id: 'S', title: '補足', supplement: true, children: [{ id: '13S', title: '補足', children: [{ title: 'その他' }] }] }]);
const GK_SYL = [{ title: '章1', children: [{ title: '節1' }] }];
const SRC = [{ title: 't', url: 'https://example.com/a' }];
const STEM = '説明として最も適切なものを選びなさい。';

const CHECKERS = {
  gk: { tool: 'check-data.js', syl: GK_SYL, path: () => ['章1', '節1'], qid: (n) => 'G-01-' + String(n).padStart(3, '0'), cid: 'C-01-001', file: () => '01_x.json', extra: {} },
  dx: { tool: 'check-data-dx.js', syl: DX_SYL, path: (d = 1) => ['領域' + d, '分類' + String((d - 1) * 3 + 1).padStart(2, '0'), '最新事例＆トレンド'], qid: (n, d = 1) => 'D-' + String((d - 1) * 3 + 1).padStart(2, '0') + '-' + String(n).padStart(3, '0'), cid: 'DC-01-001', file: (d = 1) => String((d - 1) * 3 + 1).padStart(2, '0') + '_x.json', extra: { qtype: 'relation' } },
};

const choicesOf = (n) => ['甲は' + n + 'で増える', '乙は' + n + 'で減る', '丙は' + n + 'で止まる', '丁は' + n + 'で回る'];
function question(c, n, d, extra) {
  return { id: c.qid(n, d), syllabus: c.path(d), format: 'single', difficulty: 2, stem: STEM, choices: choicesOf(n), answer: 0, explanation: 'e', whyWrong: [null, 'w', 'w', 'w'], memoryTip: 'm', concepts: [c.cid], sources: SRC, status: 'verified', ...c.extra, ...extra };
}

/** 一時ディレクトリにアプリ1つぶんを作って検査を回す。qs は [{ n, d, extra }]。config を渡すと <アプリ>/config.json と data/index.json を置く */
function run(which, qs, { today = '2026-11', concept = {}, config = null } = {}) {
  const c = CHECKERS[which];
  const dir = mkdtempSync(join(tmpdir(), 'cq-fresh-'));
  try {
    const app = join(dir, 'app');
    const d = join(app, 'data');
    for (const k of ['concepts', 'questions']) mkdirSync(join(d, k), { recursive: true });
    writeFileSync(join(d, 'syllabus.json'), JSON.stringify(c.syl));
    writeFileSync(join(d, 'concepts', '01_x.json'), JSON.stringify([{ id: c.cid, syllabus: c.path(1), title: 't', oneLine: 'o', why: 'w', links: [], confusions: [], sources: SRC, status: 'verified', ...concept }]));
    const byFile = new Map();
    for (const q of qs) {
      const fn = c.file(q.d);
      if (!byFile.has(fn)) byFile.set(fn, []);
      byFile.get(fn).push(question(c, q.n, q.d, q.extra || {}));
    }
    for (const [fn, arr] of byFile) writeFileSync(join(d, 'questions', fn), JSON.stringify(arr));
    if (config) {
      writeFileSync(join(app, 'config.json'), JSON.stringify(config));
      writeFileSync(join(d, 'index.json'), JSON.stringify({ syllabus: 'syllabus.json', questions: [...byFile.keys()].map((fn) => 'questions/' + fn), concepts: ['concepts/01_x.json'] }));
    }
    const files = [...byFile.keys()].map((fn) => join(d, 'questions', fn)).concat([join(d, 'concepts', '01_x.json')]);
    const r = spawnSync(process.execPath, [join(root, 'tools', c.tool), ...files, '--today', today], { encoding: 'utf8' });
    const out = (r.stdout || '') + (r.stderr || '');
    return { status: r.status, out, lines: out.split(/\r?\n/) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const ng = (r, re) => r.lines.filter((l) => l.startsWith('NG ') && re.test(l));
const wn = (r, re) => r.lines.filter((l) => l.startsWith('WARN ') && re.test(l));
const line = (r, head) => r.lines.find((l) => l.startsWith(head)) || '';

for (const which of ['gk', 'dx']) {
  test(`検査（${which}）: 何も書かなければ通り、STALE 行は 0件`, () => {
    const r = run(which, [{ n: 1 }]);
    assert.equal(r.status, 0, r.out);
    assert.match(line(r, 'STALE 全体'), /見直す月が来た 0件/);
  });

  test(`検査（${which}）: asOf・reviewBy の形の誤り・片方だけ・reviewBy が後でない、は NG`, () => {
    const cases = [
      [{ asOf: '2026-13', reviewBy: '2027-01' }, /asOf の形が/],
      [{ asOf: '2026-01', reviewBy: '2027/01' }, /reviewBy の形が/],
      [{ asOf: '2026-01' }, /2つそろえて書く（reviewBy が無い）/],
      [{ reviewBy: '2027-01' }, /2つそろえて書く（asOf が無い）/],
      [{ asOf: '2026-01', reviewBy: '2026-01' }, /より後でない/],
      [{ asOf: '2026-05', reviewBy: '2025-05' }, /より後でない/],
    ];
    for (const [extra, re] of cases) {
      const r = run(which, [{ n: 1, extra }]);
      assert.equal(r.status, 1, JSON.stringify(extra) + '\n' + r.out);
      assert.equal(ng(r, re).length, 1, JSON.stringify(extra) + '\n' + r.out);
    }
    // 1年後ちょうどは通る。1年より先は WARN（NG ではない）
    const ok = run(which, [{ n: 1, extra: { asOf: '2026-03', reviewBy: '2027-03' } }]);
    assert.equal(ok.status, 0, ok.out);
    assert.equal(wn(ok, /12か月後より先/).length, 0);
    const far = run(which, [{ n: 1, extra: { asOf: '2026-03', reviewBy: '2027-04' } }]);
    assert.equal(far.status, 0, far.out);
    assert.equal(wn(far, /12か月後より先/).length, 1, far.out);
  });

  test(`検査（${which}）: 見直す月が来たものを ID つきで WARN し、件数を STALE 行に出す（前の月は出さない）`, () => {
    const c = CHECKERS[which];
    const r = run(which, [
      { n: 1, extra: { asOf: '2025-11', reviewBy: '2026-11' } }, // 今日の月＝見直しの月が来た
      { n: 2, extra: { asOf: '2025-03', reviewBy: '2026-03' } }, // 過ぎた
      { n: 3, extra: { asOf: '2025-12', reviewBy: '2026-12' } }, // まだ
      { n: 4, extra: { asOf: '2024-01', reviewBy: '2025-01', status: 'retired' } }, // 引退済みは出さない
    ], { today: '2026-11' });
    assert.equal(r.status, 0, r.out);
    const stale = wn(r, /STALE:/);
    assert.deepEqual(stale.map((l) => l.split(' ')[2].replace(':', '')).sort(), [c.qid(1), c.qid(2)].sort(), r.out);
    assert.match(line(r, 'STALE 全体'), /見直す月が来た 2件（問題 2・カード 0。今日 2026-11）/);
    assert.match(line(r, 'RETIRED 全体'), /引退 問題 1・カード 0/);
    // 1か月前の日付で回すと、2026-11 の分は出ない
    const early = run(which, [{ n: 1, extra: { asOf: '2025-11', reviewBy: '2026-11' } }], { today: '2026-10' });
    assert.equal(wn(early, /STALE:/).length, 0, early.out);
  });

  test(`検査（${which}）: status の retired は NG にしない。知らない status は NG。引退したカードは WARN`, () => {
    assert.equal(run(which, [{ n: 1, extra: { status: 'retired' } }]).status, 0);
    const bad = run(which, [{ n: 1, extra: { status: 'old' } }]);
    assert.equal(ng(bad, /status が不正/).length, 1, bad.out);
    const card = run(which, [{ n: 1 }], { concept: { status: 'retired', asOf: '2024-01', reviewBy: '2025-01' } });
    assert.equal(card.status, 0, card.out);
    assert.equal(wn(card, /カードの引退/).length, 1, card.out);
    assert.equal(wn(card, /STALE:/).length, 0, card.out); // 引退したカードは見直しの対象にしない
    const staleCard = run(which, [{ n: 1 }], { concept: { asOf: '2024-01', reviewBy: '2025-01' } });
    assert.match(line(staleCard, 'STALE 全体'), /（問題 0・カード 1。/);
  });

  test(`検査（${which}）: --today の形が違えば止まる`, () => {
    const r = run(which, [{ n: 1 }], { today: '2026-1' });
    assert.equal(r.status, 2, r.out);
  });
}

test('検査（dx）: FRESH 行に『最新事例＆トレンド』で asOf の無い数を出す', () => {
  const r = run('dx', [{ n: 1 }, { n: 2, extra: { asOf: '2026-01', reviewBy: '2027-01' } }]);
  assert.match(line(r, 'FRESH 最新事例'), /問題 2問のうち asOf なし 1・カード 1枚のうち asOf なし 1/, r.out);
});

// 模試の配分: 4領域×1問、型は relation だけ。領域1の relation が引退すると、領域1は別の型（term）で補うことになる
const EXAM_CFG = { exam: { questions: 4, minutes: 4, blueprint: { perRoot: 1, qtypeGroups: [{ types: ['relation'], count: 4 }] } } };
const fourDomains = (d1) => [...d1, { n: 2, d: 2 }, { n: 3, d: 3 }, { n: 4, d: 4 }];

test('検査（dx）: 引退で模試の配分が割り込まなければ WARN を出さず、EXAM 行に数を出す', () => {
  const r = run('dx', fourDomains([{ n: 1, d: 1 }, { n: 5, d: 1, extra: { status: 'retired' } }]), { config: EXAM_CFG });
  assert.equal(r.status, 0, r.out);
  assert.match(line(r, 'EXAM app'), /4領域×1問。型を満たせず別の型で補う問題 引退を除くと 0問・模試 4問（引退 1問を含めると 0問・4問）/, r.out);
  assert.equal(wn(r, /EXAM:/).length, 0, r.out);
});

test('検査（dx）: 引退で領域・型の枠が足りなくなると WARN（足りない枠の名前つき）', () => {
  const r = run('dx', fourDomains([{ n: 1, d: 1, extra: { status: 'retired' } }, { n: 5, d: 1, extra: { qtype: 'term' } }]), { config: EXAM_CFG });
  assert.equal(r.status, 0, r.out);
  const w = wn(r, /EXAM:/);
  assert.equal(w.length, 1, r.out);
  assert.match(w[0], /補う問題 0→1問/);
  assert.match(w[0], /領域1・relation（要る 1・引退を除くと 0）/);
});

test('検査（dx）: 引退で模試の問題数が減ると WARN', () => {
  const r = run('dx', fourDomains([{ n: 1, d: 1, extra: { status: 'retired' } }]), { config: EXAM_CFG });
  const w = wn(r, /EXAM:/);
  assert.equal(w.length, 1, r.out);
  assert.match(w[0], /模試 4→3問/);
});

test('検査（gk）: 設計図の無い資格は EXAM 行を出さない', () => {
  const r = run('gk', [{ n: 1, extra: { status: 'retired' } }], { config: { exam: { questions: 1, minutes: 1 } } });
  assert.equal(r.status, 0, r.out);
  assert.equal(line(r, 'EXAM '), '', r.out);
});
