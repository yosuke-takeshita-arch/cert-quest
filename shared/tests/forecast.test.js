// 合格予想メーターの計算の検証。ブラウザ無しで node から叩く。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  forecast, questionValue, normalizeLine, normalizePassGuide, passGuideLabel, passGuideStatus, normalizeForecast, recordForecast, forecastSeries,
  FORECAST_MAX_DAYS, UNANSWERED_VALUE,
} from '../js/lib/forecast.js';
import { dateKey } from '../js/lib/srs.js';

const mk = (ch, n, start = 1) => Array.from({ length: n }, (_, i) => ({ id: `${ch.split("|")[0]}-${start + i}`, syllabus: [ch.split('|')[0], ch.split('|')[1] || '中', '小'] }));
const ok = { seen: 1, correct: 1, lastOk: true, step: -1, due: null };
const ng = { seen: 1, correct: 0, lastOk: false, step: 0, due: 10 };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('答えた問題が0なら予想を出さない（score は null）', () => {
  const r = forecast(mk('A|a', 4), {});
  assert.equal(r.score, null);
  assert.equal(r.answered, 0);
  assert.equal(r.total, 4);
  assert.deepEqual(forecast([], {}), { total: 0, answered: 0, score: null, chapters: [], top: [] });
  assert.equal(forecast(null, null).score, null);
});

test('全部正解は100、全部不正解は25、1問だけ正解は（1+0.25×(n-1)）÷n×100', () => {
  const qs = mk('A|a', 4);
  const all = Object.fromEntries(qs.map((q) => [q.id, ok]));
  const none = Object.fromEntries(qs.map((q) => [q.id, ng]));
  near(forecast(qs, all).score, 100);
  near(forecast(qs, none).score, 25);
  near(forecast(qs, { 'A-1': ok }).score, ((1 + 0.25 * 3) / 4) * 100);
  near(forecast(qs, { 'A-1': ng }).score, 25); // 1問だけ答えて間違い
});

test('最後に正解だけが1。いったん間違えて今は正解なら1、正解した後に間違えたら0.25', () => {
  assert.equal(questionValue(ok), 1);
  assert.equal(questionValue(ng), UNANSWERED_VALUE);
  assert.equal(questionValue(undefined), UNANSWERED_VALUE);
  assert.equal(questionValue({ seen: 0, lastOk: true }), UNANSWERED_VALUE); // 壊れた記録（seen が0）
  assert.equal(questionValue({ seen: 3, correct: 2, lastOk: null }), UNANSWERED_VALUE);
});

test('既定の重みは問題の数の割合＝全体の平均と同じ。章ごとの内訳が出る', () => {
  const qs = [...mk('A|a', 3), ...mk('B|b', 1)];
  const st = { 'A-1': ok, 'A-2': ok, 'A-3': ok }; // A章は全部正解、B章は未回答
  const r = forecast(qs, st);
  near(r.score, ((3 + 0.25) / 4) * 100);
  assert.deepEqual(r.chapters.map((c) => [c.key, c.total, c.answered, c.correct, c.remaining]), [['A|a', 3, 3, 3, 0], ['B|b', 1, 0, 0, 1]]);
});

test('伸びしろ＝その章の正解していない数×0.75÷全問題の数×100。全章が全部正解した分の合計＝100−予想', () => {
  const qs = [...mk('A|a', 6), ...mk('B|b', 2), ...mk('C|c', 2)];
  const st = { 'A-1': ok, 'B-1': ng };
  const r = forecast(qs, st);
  near(r.chapters[0].gain, (5 * 0.75) / 10 * 100);
  near(r.chapters[1].gain, (2 * 0.75) / 10 * 100);
  near(r.chapters[2].gain, (2 * 0.75) / 10 * 100);
  near(r.chapters.reduce((s, c) => s + c.gain, 0), 100 - r.score);
});

test('伸びしろの上位3つ: 大きい順、同じなら先に出た章、0の章は入れない、章が3つ未満なら少ない', () => {
  const qs = [...mk('A|a', 1), ...mk('B|b', 5), ...mk('C|c', 3), ...mk('D|d', 3), ...mk('E|e', 2)];
  const st = { 'A-1': ok, 'B-1': ok };
  const r = forecast(qs, st);
  assert.deepEqual(r.top.map((c) => c.key), ['B|b', 'C|c', 'D|d']); // B は4問残り、C・D は3問（同じなら先に出た C）
  const gains = r.top.map((c) => c.gain);
  assert.ok(gains[0] >= gains[1] && gains[1] >= gains[2]);
  const full = Object.fromEntries(qs.map((q) => [q.id, ok]));
  assert.deepEqual(forecast(qs, full).top, []); // 全部正解なら伸びしろなし
  assert.equal(forecast(mk('A|a', 2), { 'A-1': ng }).top.length, 1);
});

test('公式の配点（重み）を渡すとその割合で平均する。重みが無い章は0。使えなければ問題の数の割合', () => {
  const qs = [...mk('A|a', 9), ...mk('B|b', 1)];
  const st = { 'A-1': ok, 'B-1': ok }; // A は 1/9 正解、B は全部正解
  const r = forecast(qs, st, { weights: { 'A|a': 1, 'B|b': 1 } });
  near(r.score, 50 * ((1 + 0.25 * 8) / 9 + 1));
  const r2 = forecast(qs, st, { weights: { 'A|a': 0, 'B|b': 1 } });
  near(r2.score, 100);
  assert.deepEqual(r2.top, []); // 重み0のA章の伸びしろは0
  const r3 = forecast(qs, st, { weights: { x: 1 } }); // 該当する章が無い
  near(r3.score, forecast(qs, st).score);
  const r4 = forecast(qs, st, { weights: { 'A|a': -1, 'B|b': NaN } });
  near(r4.score, forecast(qs, st).score);
});

test('データから消えた問題IDが qstats に残っていても数えない', () => {
  const qs = mk('A|a', 2);
  const st = { 'A-1': ok, 'ZZ-9': ok, 'ZZ-8': ok };
  const r = forecast(qs, st);
  assert.equal(r.total, 2);
  assert.equal(r.answered, 1);
  near(r.score, ((1 + 0.25) / 2) * 100);
  assert.equal(forecast(qs, { 'ZZ-9': ok }).score, null); // 消えた問題だけ答えていた → 予想なし
});

test('章を決められない問題（syllabus が壊れている）は数えない。中項目が無ければ 全般 の章', () => {
  const qs = [{ id: 'x' }, { id: 'y', syllabus: [] }, { id: 'z', syllabus: ['大'] }];
  const r = forecast(qs, { z: ok });
  assert.equal(r.total, 1);
  assert.equal(r.chapters[0].key, '大|全般');
});

test('合格の線: 0より大きく100以下の数だけ。それ以外は null（線を出さない）', () => {
  assert.equal(normalizeLine(70), 70);
  assert.equal(normalizeLine(100), 100);
  for (const bad of [null, undefined, 0, -1, 101, NaN, '70', Infinity, {}]) assert.equal(normalizeLine(bad), null, String(bad));
});

test('合格の目安の幅: 正しい幅だけ通す。無い・min>max・範囲外・文字列は null（出さない）', () => {
  assert.deepEqual(normalizePassGuide({ min: 70, max: 80 }), { min: 70, max: 80 });
  assert.deepEqual(normalizePassGuide({ min: 80, max: 80 }), { min: 80, max: 80 });
  assert.deepEqual(normalizePassGuide({ min: 1, max: 100 }), { min: 1, max: 100 });
  const bad = [undefined, null, 70, '70', [70, 80], {}, { min: 70 }, { max: 80 }, { min: 80, max: 70 }, { min: 0, max: 80 }, { min: -5, max: 80 },
    { min: 70, max: 101 }, { min: '70', max: '80' }, { min: NaN, max: 80 }, { min: 70, max: Infinity }, { min: null, max: 80 }];
  for (const b of bad) {
    assert.equal(normalizePassGuide(b), null, JSON.stringify(b));
    assert.equal(passGuideLabel(b), null);
    assert.equal(passGuideStatus(b, 75), null);
  }
});

test('合格の目安の言い方: 非公開と分かる。合格と断定しない', () => {
  const g = { min: 70, max: 80 };
  assert.equal(passGuideLabel(g), '合格の目安 70〜80%（公式は非公開）');
  assert.equal(passGuideStatus(g, 80), '目安（70〜80%）の上まで届いています。');
  assert.equal(passGuideStatus(g, 79.9), '目安（70〜80%）に届いています。');
  assert.equal(passGuideStatus(g, 70), '目安（70〜80%）に届いています。');
  assert.equal(passGuideStatus(g, 69.5), '目安（70〜80%）まで、あと 1 ポイントです。');
  assert.equal(passGuideStatus(g, 0), '目安（70〜80%）まで、あと 70 ポイントです。');
  assert.equal(passGuideStatus(g, NaN), null);
  assert.equal(passGuideStatus(g, '75'), null);
  for (const pct of [0, 50, 69, 70, 75, 80, 100]) assert.doesNotMatch(passGuideStatus(g, pct), /合格(です|できます|確実)/);
});

test('ai-passport/config.json の目安の幅は 70〜80。幅の無い資格（G検定・DX）には足していない', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (p) => JSON.parse(readFileSync(new URL('../../' + p, import.meta.url), 'utf8'));
  assert.deepEqual(normalizePassGuide(read('ai-passport/config.json').passGuide), { min: 70, max: 80 });
  for (const app of ['g-kentei', 'dx-biz']) assert.equal(read(app + '/config.json').passGuide, undefined, app);
});

test('推移: 古い記録（項目なし）や壊れた値は空／捨てる', () => {
  for (const bad of [undefined, null, 'x', 5, [1, 2], true]) assert.deepEqual(normalizeForecast(bad), {}, String(bad));
  const m = normalizeForecast({
    '2026-10-01': 50, '2026-10-02': '60', '2026-10-03': NaN, '2026-10-04': -1, '2026-10-05': 101, '2026-10-06': null,
    '2026-02-30': 40, '2026/10/07': 40, abc: 40, '2026-10-08': 0, '2026-10-09': 100, '2026-10-10': Infinity,
  });
  assert.deepEqual(m, { '2026-10-01': 50, '2026-10-08': 0, '2026-10-09': 100 });
});

test('推移: 60日目まで残り、61日目で一番古い日が消える。順序が入れ替わっていても古い順に捨てる', () => {
  const st = { forecast: {} };
  const day = (i) => dateKey(new Date(2026, 0, 1 + i)); // 2026-01-01 から
  for (let i = 0; i < FORECAST_MAX_DAYS; i++) assert.equal(recordForecast(st, day(i), 50), true);
  assert.equal(Object.keys(st.forecast).length, 60);
  assert.ok(day(0) in st.forecast);
  recordForecast(st, day(60), 60); // 61日目
  assert.equal(Object.keys(st.forecast).length, 60);
  assert.ok(!(day(0) in st.forecast));
  assert.ok(day(1) in st.forecast && day(60) in st.forecast);
  // 60日分より前の日付を後から入れても、新しい60日が残る（その日付は残らない）
  assert.equal(recordForecast(st, day(-5), 10), false);
  assert.equal(Object.keys(st.forecast).length, 60);
  assert.ok(!(day(-5) in st.forecast));
  assert.equal(forecastSeries(st.forecast)[0].date, day(1));
});

test('推移: 同じ日は上書き。小数第1位に丸める。null・範囲外・日付でないものは記録しない', () => {
  const st = {};
  assert.equal(recordForecast(st, '2026-10-09', 41.26), true);
  assert.deepEqual(st.forecast, { '2026-10-09': 41.3 });
  recordForecast(st, '2026-10-09', 50);
  assert.deepEqual(st.forecast, { '2026-10-09': 50 });
  for (const bad of [null, undefined, NaN, -0.1, 100.1, '50']) assert.equal(recordForecast(st, '2026-10-10', bad), false, String(bad));
  assert.equal(recordForecast(st, 'x', 50), false);
  assert.equal(recordForecast(st, '2026-13-01', 50), false);
  assert.deepEqual(st.forecast, { '2026-10-09': 50 });
});

test('推移: 壊れた forecast がある state に記録しても落ちない。折れ線用は日付の古い順', () => {
  const st = { forecast: 'こわれた' };
  assert.equal(recordForecast(st, '2026-10-09', 30), true);
  recordForecast(st, '2026-10-07', 20);
  assert.deepEqual(forecastSeries(st.forecast), [{ date: '2026-10-07', score: 20 }, { date: '2026-10-09', score: 30 }]);
  assert.deepEqual(forecastSeries(undefined), []);
});

test('日付の区切りは srs.js の dateKey と同じ形（YYYY-MM-DD、ローカル日付）', () => {
  const st = {};
  assert.equal(recordForecast(st, dateKey(new Date(2026, 11, 31, 23, 59)), 10), true);
  assert.equal(recordForecast(st, dateKey(new Date(2028, 1, 29)), 10), true); // うるう日
  assert.deepEqual(Object.keys(st.forecast), ['2026-12-31', '2028-02-29']);
});
