// 模擬試験の見直しの印の回り方（examFlagStep）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { examFlagStep } from '../js/lib/quiz.js';

const F = [false, true, false, false, true, true, false];

test('examFlagStep: 最初の印・次の印・前の印（cur は含めない）', () => {
  assert.equal(examFlagStep(F, -1, 1), 1);
  assert.equal(examFlagStep(F, 1, 1), 4);
  assert.equal(examFlagStep(F, 4, 1), 5);
  assert.equal(examFlagStep(F, 5, -1), 4);
  assert.equal(examFlagStep(F, 4, -1), 1);
  assert.equal(examFlagStep(F, 2, -1), 1);
});

test('examFlagStep: 端を越えない・印が無ければ -1', () => {
  assert.equal(examFlagStep(F, 5, 1), -1);
  assert.equal(examFlagStep(F, 1, -1), -1);
  assert.equal(examFlagStep(F, 6, 1), -1);
  assert.equal(examFlagStep(F, 0, -1), -1);
  assert.equal(examFlagStep([false, false], -1, 1), -1);
  assert.equal(examFlagStep([], -1, 1), -1);
});

test('examFlagStep: 先頭と末尾の印', () => {
  const G = [true, false, true];
  assert.equal(examFlagStep(G, -1, 1), 0);
  assert.equal(examFlagStep(G, 0, 1), 2);
  assert.equal(examFlagStep(G, 2, -1), 0);
  assert.equal(examFlagStep(G, 3, -1), 2);
});
