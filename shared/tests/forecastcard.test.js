// 合格予想メーターのカード（views/forecast.js）の、DOM を使わない部分と、答えたあとの記録。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayScore } from '../js/views/forecast.js';
import { forecast, recordForecast } from '../js/lib/forecast.js';
import { defaultState, recordAnswer } from '../js/lib/progress.js';

test('displayScore: 切り捨てて整数にする。全問正解の誤差は 100、範囲外・数でないものは丸める／null', () => {
  assert.equal(displayScore(62.9), 62);
  assert.equal(displayScore(25), 25);
  assert.equal(displayScore(99.99999999999999), 100);
  assert.equal(displayScore(99.9), 99);
  assert.equal(displayScore(0), 0);
  assert.equal(displayScore(null), null);
  assert.equal(displayScore(NaN), null);
});

test('答えたあとに予想を記録できる（1日1件・同じ日は上書き）', () => {
  const qs = ['A', 'B', 'C', 'D'].map((id) => ({ id, syllabus: ['大', '章1'] }));
  const s = defaultState();
  assert.equal(forecast(qs, s.qstats).score, null); // 答えた問題が0
  recordAnswer(s, qs[0], { correct: true, now: new Date(2026, 9, 9, 9) });
  assert.equal(recordForecast(s, '2026-10-09', forecast(qs, s.qstats).score), true);
  assert.deepEqual(s.forecast, { '2026-10-09': 43.8 }); // (1 + 0.25×3) ÷ 4 = 0.4375 → 43.75 を小数第1位に丸めて 43.8
});
