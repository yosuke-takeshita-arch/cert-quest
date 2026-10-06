// 模擬試験の設計図（領域×型の配分）。DXビジネス検定の本番の枠。
import test from 'node:test';
import assert from 'node:assert/strict';
import { blueprintCells, pickExamByBlueprint, readBlueprint, byQtype, examPlan } from '../js/lib/quiz.js';
import { normalizeQuestion, buildTree } from '../js/lib/data.js';

const BP = { perRoot: 25, qtypeGroups: [{ types: ['term', 'relation'], count: 25 }, { types: ['causal', 'loop'], count: 50 }, { types: ['tradeoff', 'interdep', 'miscon'], count: 25 }] };
const ROOTS = ['R1', 'R2', 'R3', 'R4'];
const TYPES = ['term', 'relation', 'causal', 'loop', 'tradeoff', 'interdep', 'miscon'];
const lcg = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
// 各領域・各型を n 問ずつ（補足の領域 SUP も同数）
const make = (n, roots = [...ROOTS, 'SUP'], types = TYPES) => {
  const out = [];
  for (const r of roots) for (const t of types) for (let i = 0; i < n; i++) out.push({ id: r + '-' + t + '-' + i, syllabus: [r, 'c'], qtype: t });
  return out;
};
const groupOf = (t) => BP.qtypeGroups.findIndex((g) => g.types.includes(t));
const count = (items, f) => items.filter(f).length;

test('表の行の合計は各領域25、列の合計は25/50/25', () => {
  const cells = blueprintCells(BP, 4);
  assert.equal(cells.length, 4);
  cells.forEach((row) => assert.equal(row.reduce((a, b) => a + b, 0), 25));
  [0, 1, 2].forEach((g) => assert.equal(cells.reduce((a, row) => a + row[g], 0), BP.qtypeGroups[g].count));
  // 領域ごとの割り振りは 6〜7 / 12〜13 / 6〜7 に収まる
  cells.forEach((row) => { assert.ok(row[0] >= 6 && row[0] <= 7); assert.ok(row[1] >= 12 && row[1] <= 13); assert.ok(row[2] >= 6 && row[2] <= 7); });
});

test('設計図どおり: 100問・領域ごと25問・型グループ25/50/25（乱数を変えても同じ）', () => {
  const qs = make(20);
  for (const seed of [1, 2, 3, 99]) {
    const r = pickExamByBlueprint(qs, BP, ROOTS, lcg(seed));
    assert.equal(r.items.length, 100);
    assert.equal(r.filled, 0);
    ROOTS.forEach((root) => assert.equal(count(r.items, (q) => q.syllabus[0] === root), 25));
    [25, 50, 25].forEach((n, g) => assert.equal(count(r.items, (q) => groupOf(q.qtype) === g), n));
  }
});

test('補足の領域は出ない・同じ問題は2回出ない', () => {
  const r = pickExamByBlueprint(make(20), BP, ROOTS, lcg(5));
  assert.equal(count(r.items, (q) => q.syllabus[0] === 'SUP'), 0);
  assert.equal(new Set(r.items.map((q) => q.id)).size, r.items.length);
});

test('型が足りないとき: 落ちず、同じ領域の別の型で埋め、filled に数が出る', () => {
  // 構造型（causal/loop/tradeoff/interdep/miscon）が各領域に2問ずつしか無い
  const qs = [...make(30, ROOTS, ['term', 'relation']), ...make(2, ROOTS, ['causal', 'loop', 'tradeoff', 'interdep', 'miscon'])];
  const r = pickExamByBlueprint(qs, BP, ROOTS, lcg(7));
  assert.equal(r.items.length, 100);
  ROOTS.forEach((root) => assert.equal(count(r.items, (q) => q.syllabus[0] === root), 25)); // 領域の数は守る
  assert.ok(r.filled > 0);
  assert.equal(new Set(r.items.map((q) => q.id)).size, 100);
  // 型が足りる分は本番どおりに出す（構造型は各領域の10問を全部使う）
  assert.equal(count(r.items, (q) => !['term', 'relation'].includes(q.qtype)), 40);
});

test('型が無い問題だけでも落ちない（全部が補い）', () => {
  const qs = make(40, [...ROOTS, 'SUP'], [undefined]).map((q) => ({ ...q, qtype: '' }));
  const r = pickExamByBlueprint(qs, BP, ROOTS, lcg(3));
  assert.equal(r.items.length, 100);
  assert.equal(r.filled, 100);
});

test('ある領域の問題が全体で足りないときは、全体から埋める', () => {
  const qs = [...make(20, ['R1', 'R2', 'R3']), ...make(1, ['R4'], ['term', 'relation', 'causal'])]; // R4 は3問だけ
  const r = pickExamByBlueprint(qs, BP, ROOTS, lcg(11));
  assert.equal(r.items.length, 100);
  assert.equal(count(r.items, (q) => q.syllabus[0] === 'R4'), 3);
  assert.ok(r.filled >= 22);
  assert.equal(new Set(r.items.map((q) => q.id)).size, 100);
});

test('全体で100問に満たないときは有る分だけ（落ちない）', () => {
  const r = pickExamByBlueprint(make(1), BP, ROOTS, lcg(1));
  assert.equal(r.items.length, 28);
  assert.equal(count(r.items, (q) => q.syllabus[0] === 'SUP'), 0);
  assert.equal(examPlan({ questions: 100, minutes: 80 }, r.items.length).reduced, true);
});

test('readBlueprint: 設計図が無い・壊れているときは null（G検定は従来のまま）', () => {
  assert.equal(readBlueprint({ questions: 145, minutes: 120 }), null);
  assert.equal(readBlueprint(undefined), null);
  assert.equal(readBlueprint({ blueprint: { perRoot: 0, qtypeGroups: [] } }), null);
  assert.equal(readBlueprint({ blueprint: { perRoot: 25, qtypeGroups: [{ types: [], count: 3 }] } }), null);
  assert.equal(readBlueprint({ blueprint: BP }), BP);
});

test('データ: qtype は決まった7つだけ通す／補足の領域は木に印が付く', () => {
  const base = { id: 'x1', syllabus: ['a'], stem: 's', choices: ['p', 'q'], answer: 0 };
  assert.equal(normalizeQuestion({ ...base, qtype: 'causal' }).qtype, 'causal');
  assert.equal(normalizeQuestion({ ...base, qtype: 'bogus' }).qtype, '');
  assert.equal(normalizeQuestion(base).qtype, '');
  const tree = buildTree([{ id: 'B', title: '基礎', children: [] }, { id: 'S', title: '補足', supplement: true, children: [] }], [], []);
  assert.equal(tree.roots.find((r) => r.name === '基礎').supplement, false);
  assert.equal(tree.roots.find((r) => r.name === '補足').supplement, true);
});

test('byQtype: 型別に集計し、型の順に並べる', () => {
  const r = byQtype([{ qtype: 'loop', correct: true }, { qtype: 'term', correct: false }, { qtype: 'term', correct: true }, { qtype: '', correct: true }]);
  assert.deepEqual(r.map((x) => x.qtype), ['term', 'loop', '']);
  assert.equal(r[0].total, 2);
  assert.equal(r[0].rate, 0.5);
});
