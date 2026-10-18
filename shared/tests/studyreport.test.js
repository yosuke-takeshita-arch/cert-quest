// 学習時間の振り返りの検証（要件定義書 §6-2）。ブラウザ無しで node から叩く。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  UNITS, MAX_RANGE_DAYS, keyToNum, numToKey, bucketStart, nextBucketStart, defaultRange, normalizeRange,
  studyReport, formatDuration, formatAxis, axisMax, bucketText, formatBarValue, barPx, labelEvery, matchColumns, MIN_SLOT_PX, PLOT_PX, placeBarValues, barValueWidthPx,
} from '../js/lib/studyreport.js';
import { addStudySeconds, normalizeStudyDays, isDateKey, MAX_DAY_SECONDS, MAX_STUDY_DAYS } from '../js/lib/studytime.js';
import { defaultState, mergeState, recordAnswer } from '../js/lib/progress.js';
import { serializeBackup, parseBackup, buildSubjectsBackup, parseSubjectsBackup } from '../js/lib/backup.js';
import { COMMON_KEYS, createSubjectStore } from '../js/lib/subjects.js';
import { currentStreak } from '../js/lib/scoring.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(shared, p), 'utf8');

/** 日付 → 秒数 の表から、振り返りに渡す記録を作る。 */
const st = (days, daily = {}) => ({ studyDays: days, daily });
const dayOf = (key) => (new Date(key + 'T00:00:00Z').getUTCDay() + 6) % 7; // 月=0 … 日=6

// ---- 日付の計算 ----

test('日数と日付の変換: 往復できる。うるう年（2024・2000）は2/29がある。2100年・存在しない日付は無い', () => {
  for (const k of ['1970-01-01', '2024-02-29', '2000-02-29', '2026-12-31', '2027-01-01', '2026-10-17']) assert.equal(numToKey(keyToNum(k)), k);
  assert.equal(keyToNum('2024-03-01') - keyToNum('2024-02-28'), 2);
  assert.equal(keyToNum('2026-03-01') - keyToNum('2026-02-28'), 1);
  assert.equal(keyToNum('2100-02-29'), null);
  assert.equal(keyToNum('2026-02-30'), null);
  assert.equal(keyToNum('2026-13-01'), null);
  assert.equal(keyToNum('2026-1-1'), null);
  assert.equal(keyToNum(undefined), null);
});

test('週の始まりは月曜（月〜日のどの日でも、その週の月曜になる。月・年をまたぐ週も）', () => {
  // 2026-10-12 は月曜
  assert.equal(dayOf('2026-10-12'), 0);
  for (let i = 0; i < 7; i++) assert.equal(numToKey(bucketStart('week', keyToNum('2026-10-12') + i)), '2026-10-12');
  assert.equal(numToKey(bucketStart('week', keyToNum('2026-10-19'))), '2026-10-19');
  // 年またぎの週: 2026-12-28(月) 〜 2027-01-03(日)
  assert.equal(dayOf('2026-12-28'), 0);
  assert.equal(numToKey(bucketStart('week', keyToNum('2027-01-01'))), '2026-12-28');
  assert.equal(numToKey(bucketStart('week', keyToNum('2027-01-03'))), '2026-12-28');
  assert.equal(numToKey(bucketStart('week', keyToNum('2027-01-04'))), '2027-01-04');
  // 月またぎの週: 2026-08-31(月) 〜 2026-09-06(日)
  assert.equal(numToKey(bucketStart('week', keyToNum('2026-09-02'))), '2026-08-31');
  // 1970-01-01（木）より前でも崩れない
  assert.equal(numToKey(bucketStart('week', keyToNum('1969-12-31'))), '1969-12-29');
});

test('月・年の区切り: 月末・うるう年・年の変わり目', () => {
  assert.equal(numToKey(bucketStart('month', keyToNum('2026-10-31'))), '2026-10-01');
  assert.equal(numToKey(nextBucketStart('month', keyToNum('2026-10-01'))), '2026-11-01');
  assert.equal(numToKey(nextBucketStart('month', keyToNum('2026-12-01'))), '2027-01-01');
  assert.equal(numToKey(nextBucketStart('month', keyToNum('2024-02-01'))), '2024-03-01'); // 2月は29日まで
  assert.equal(numToKey(bucketStart('year', keyToNum('2026-12-31'))), '2026-01-01');
  assert.equal(numToKey(nextBucketStart('year', keyToNum('2024-01-01'))), '2025-01-01');
  assert.equal(numToKey(bucketStart('day', keyToNum('2026-10-17'))), '2026-10-17');
});

// ---- 期間 ----

test('初めの期間: 日＝ここ30日（今日を含む）、週＝ここ12週、月＝ここ12か月、年＝ここ5年', () => {
  const today = '2026-10-17'; // 土曜
  assert.deepEqual(defaultRange('day', today), { from: '2026-09-18', to: today });
  assert.equal(studyReport(st({}), 'day', '2026-09-18', today).buckets.length, 30);
  assert.deepEqual(defaultRange('week', today), { from: '2026-07-27', to: today });
  const w = studyReport(st({}), 'week', '2026-07-27', today);
  assert.equal(w.buckets.length, 12);
  assert.equal(w.buckets[0].partial, false);
  assert.deepEqual(defaultRange('month', today), { from: '2025-11-01', to: today });
  assert.equal(studyReport(st({}), 'month', '2025-11-01', today).buckets.length, 12);
  assert.deepEqual(defaultRange('year', today), { from: '2022-01-01', to: today });
  assert.equal(studyReport(st({}), 'year', '2022-01-01', today).buckets.length, 5);
  assert.equal(defaultRange('day', '2024-03-01').from, '2024-02-01'); // うるう年（2月は29日まであるので、30日前は2/1）
  assert.equal(defaultRange('day', '2023-03-01').from, '2023-01-31'); // 2月が28日の年
  assert.equal(defaultRange('day', 'x'), null);
  assert.deepEqual(defaultRange('???', today), defaultRange('day', today));
});

test('期間を整える: 入れ替え・今日より先は今日・長すぎは新しい側を残す・壊れた日付は初めの期間', () => {
  const today = '2026-10-17';
  const ok = normalizeRange('day', '2026-10-01', '2026-10-10', today);
  assert.deepEqual([ok.from, ok.to, ok.swapped, ok.clippedToToday, ok.clippedLength], ['2026-10-01', '2026-10-10', false, false, false]);
  const sw = normalizeRange('day', '2026-10-10', '2026-10-01', today);
  assert.deepEqual([sw.from, sw.to, sw.swapped], ['2026-10-01', '2026-10-10', true]);
  const fut = normalizeRange('day', '2026-10-01', '2027-01-01', today);
  assert.deepEqual([fut.from, fut.to, fut.clippedToToday], ['2026-10-01', today, true]);
  const allFuture = normalizeRange('day', '2027-01-01', '2027-02-01', today);
  assert.deepEqual([allFuture.from, allFuture.to], [today, today]); // 開始日も今日より先なら今日の1日
  const one = normalizeRange('day', today, today, today);
  assert.deepEqual([one.from, one.to], [today, today]);
  const long = normalizeRange('day', '2000-01-01', today, today);
  assert.equal(long.clippedLength, true);
  assert.equal(long.to, today);
  assert.equal(keyToNum(long.to) - keyToNum(long.from) + 1, MAX_RANGE_DAYS);
  const bad = normalizeRange('week', 'abc', '2026-10-01', today);
  assert.deepEqual([bad.from, bad.to], [defaultRange('week', today).from, today]);
});

// ---- 集計 ----

test('日ごと: 記録の無い日も0の棒になる。期間の両端の日は含み、外の日は含まない', () => {
  const days = { '2026-10-09': 999, '2026-10-10': 600, '2026-10-12': 90, '2026-10-14': 30, '2026-10-15': 777 };
  const r = studyReport(st(days), 'day', '2026-10-10', '2026-10-14');
  assert.deepEqual(r.buckets.map((b) => b.key), ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14']);
  assert.deepEqual(r.buckets.map((b) => b.seconds), [600, 0, 90, 0, 30]);
  assert.equal(r.total.seconds, 720);
  assert.equal(r.total.studiedDays, 3);
  assert.equal(r.total.rangeDays, 5);
  assert.equal(r.maxSeconds, 600);
  assert.equal(r.axisMax, 600);
  assert.equal(r.buckets[0].partial, false);
  // 1日だけの期間
  const one = studyReport(st(days), 'day', '2026-10-10', '2026-10-10');
  assert.equal(one.buckets.length, 1);
  assert.equal(one.total.seconds, 600);
});

test('週ごと: 期間が週の途中から始まる・終わるとき、期間に入る日だけ数える（partial と日数）。棒の合計＝期間の合計', () => {
  // 2026-10-14(水)〜10-27(火): 週は 10-12・10-19・10-26 の3本
  const days = { '2026-10-12': 1000, '2026-10-14': 100, '2026-10-18': 200, '2026-10-19': 300, '2026-10-26': 400, '2026-10-27': 500, '2026-10-28': 6000 };
  const r = studyReport(st(days), 'week', '2026-10-14', '2026-10-27');
  assert.deepEqual(r.buckets.map((b) => b.key), ['2026-10-12', '2026-10-19', '2026-10-26']);
  assert.deepEqual(r.buckets.map((b) => b.seconds), [300, 300, 900]); // 10-12 は期間の外なので入らない
  assert.deepEqual(r.buckets.map((b) => b.days), [5, 7, 2]);
  assert.deepEqual(r.buckets.map((b) => b.partial), [true, false, true]);
  assert.deepEqual([r.buckets[0].from, r.buckets[0].to], ['2026-10-14', '2026-10-18']);
  assert.equal(r.total.seconds, 1500);
  assert.equal(r.total.rangeDays, 14);
  assert.equal(r.buckets.reduce((s, b) => s + b.days, 0), 14);
  assert.match(r.buckets[0].speak, /指定した期間の分だけ/);
  assert.doesNotMatch(r.buckets[1].speak, /指定した期間の分だけ/);
});

test('今日で終わる棒は、先の日がまだ来ていないだけなので partial にしない（今週・今月・今年）。今日より前で切れた棒は partial', () => {
  const today = '2026-10-17'; // 土曜
  const w = studyReport(st({}), 'week', '2026-10-05', today, today);
  assert.deepEqual(w.buckets.map((b) => b.partial), [false, false]); // 10/12 の週は日曜（10/18）まで来ていないが、今日までで切れただけ
  assert.equal(w.buckets[1].days, 6);
  assert.equal(studyReport(st({}), 'week', '2026-10-05', today).buckets[1].partial, true); // today を渡さなければ従来どおり
  const m = studyReport(st({}), 'month', '2026-09-01', today, today);
  assert.deepEqual(m.buckets.map((b) => b.partial), [false, false]);
  assert.doesNotMatch(m.buckets[1].speak, /指定した期間の分だけ/);
  const y = studyReport(st({}), 'year', '2025-01-01', today, today);
  assert.deepEqual(y.buckets.map((b) => b.partial), [false, false]);
  // 今日より前で終わる期間は、その週の残りが過去にあるので partial
  const past = studyReport(st({}), 'week', '2026-10-05', '2026-10-14', today);
  assert.equal(past.buckets[1].partial, true);
  assert.equal(past.buckets[1].days, 3);
});

test('週ごと: 月をまたぐ週・年をまたぐ週は1本にまとまる', () => {
  const days = { '2026-12-28': 10, '2026-12-31': 20, '2027-01-01': 30, '2027-01-03': 40, '2027-01-04': 50 };
  const r = studyReport(st(days), 'week', '2026-12-28', '2027-01-10');
  assert.deepEqual(r.buckets.map((b) => b.key), ['2026-12-28', '2027-01-04']);
  assert.deepEqual(r.buckets.map((b) => b.seconds), [100, 50]);
  assert.equal(r.buckets.every((b) => !b.partial), true);
});

test('月ごと: 月末・年またぎ・うるう年の2月', () => {
  const days = { '2023-12-31': 1, '2024-01-01': 2, '2024-01-31': 4, '2024-02-01': 8, '2024-02-29': 16, '2024-03-01': 32, '2025-02-28': 64 };
  const r = studyReport(st(days), 'month', '2024-01-01', '2024-03-31');
  assert.deepEqual(r.buckets.map((b) => b.key), ['2024-01-01', '2024-02-01', '2024-03-01']);
  assert.deepEqual(r.buckets.map((b) => b.seconds), [6, 24, 32]); // 2/29 は2月、3/1 は3月
  assert.deepEqual(r.buckets.map((b) => b.days), [31, 29, 31]);
  assert.equal(r.buckets.every((b) => !b.partial), true);
  assert.deepEqual(r.buckets.map((b) => b.label), ['1月', '2月', '3月']);
  assert.equal(r.buckets[0].labelSub, '2024'); // 最初の棒と1月には年を添える
  assert.equal(r.buckets[1].labelSub, '');
  assert.equal(r.buckets[0].speak, '2024年1月');
  // 年をまたぐ
  const y = studyReport(st(days), 'month', '2023-12-01', '2024-01-31');
  assert.deepEqual(y.buckets.map((b) => [b.key, b.seconds]), [['2023-12-01', 1], ['2024-01-01', 6]]);
  // 途中の日から: 部分
  const p = studyReport(st(days), 'month', '2024-02-15', '2024-03-10');
  assert.deepEqual(p.buckets.map((b) => [b.seconds, b.days, b.partial]), [[16, 15, true], [32, 10, true]]);
});

test('年ごと: 年の変わり目（12/31 と 1/1）・うるう年の日数・途中までの年', () => {
  const days = { '2023-12-31': 1, '2024-01-01': 2, '2024-12-31': 4, '2025-01-01': 8, '2025-06-30': 16 };
  const r = studyReport(st(days), 'year', '2024-01-01', '2025-10-17');
  assert.deepEqual(r.buckets.map((b) => [b.key, b.seconds, b.days, b.partial]), [['2024-01-01', 6, 366, false], ['2025-01-01', 24, 290, true]]);
  assert.deepEqual(r.buckets.map((b) => b.label), ['2024', '2025']);
  assert.equal(r.buckets[0].speak, '2024年');
});

test('答えた数（daily）も同じ区切りで数える。壊れた daily は読み飛ばす', () => {
  const daily = {
    '2026-10-12': { answered: 10, correct: 7 },
    '2026-10-13': { answered: 5, correct: 9 }, // 正解が答えた数より多いのは壊れている → 答えた数までに抑える
    '2026-10-14': { answered: 'x', correct: -3 },
    '2026-10-15': null,
    '2026-10-16': 'abc',
    '2026-10-20': { answered: 99, correct: 99 }, // 期間の外
    'bad-key': { answered: 5, correct: 5 },
  };
  const r = studyReport(st({}, daily), 'week', '2026-10-12', '2026-10-18');
  assert.equal(r.buckets[0].answered, 15);
  assert.equal(r.buckets[0].correct, 12);
  assert.equal(r.total.answered, 15);
  assert.match(bucketText(r.buckets[0]), /答えた問題 15問/);
  assert.equal(studyReport({ studyDays: {}, daily: [] }, 'day', '2026-10-12', '2026-10-12').total.answered, 0);
});

test('平均: 記録のはじまりの日より前を0日として薄めない。記録が無い・期間より後に始まったときは出さない', () => {
  const days = { '2026-10-15': 3600, '2026-10-17': 3600 };
  const r = studyReport(st(days), 'day', '2026-09-18', '2026-10-17');
  assert.equal(r.firstRecord, '2026-10-15');
  assert.equal(r.total.averageDays, 3); // 10/15〜10/17
  assert.equal(r.total.averageSeconds, 2400);
  assert.equal(r.total.rangeDays, 30);
  const mid = studyReport(st(days), 'day', '2026-10-16', '2026-10-17'); // 期間が記録の後に始まる
  assert.equal(mid.total.averageDays, 2);
  assert.equal(mid.total.averageSeconds, 1800);
  const before = studyReport(st(days), 'day', '2026-10-01', '2026-10-10'); // 記録が始まる前の期間
  assert.equal(before.total.averageSeconds, null);
  assert.equal(before.total.seconds, 0);
  const none = studyReport(st({}), 'day', '2026-10-01', '2026-10-10');
  assert.equal(none.total.averageSeconds, null);
  assert.equal(none.firstRecord, null);
  assert.equal(none.buckets.length, 10);
  assert.equal(none.axisMax, 600);
});

test('壊れた保存データ・壊れた引数でも落ちない', () => {
  for (const bad of [null, undefined, 5, 'x', [], { studyDays: 'x', daily: 5 }, { studyDays: [1, 2], daily: [] }, { studyDays: { '2026-10-12': 'a', abc: 5, '2026-02-30': 100, '2026-10-13': -5, '2026-10-14': NaN, '2026-10-15': Infinity } }]) {
    const r = studyReport(bad, 'day', '2026-10-12', '2026-10-16');
    assert.equal(r.buckets.length, 5);
    assert.equal(r.total.seconds, 0);
  }
  assert.equal(studyReport(st({}), 'day', '2026-10-16', '2026-10-12').buckets.length, 0); // 開始が終了より後
  assert.equal(studyReport(st({}), 'day', 'x', '2026-10-12').buckets.length, 0);
  assert.equal(studyReport(st({}), 'bogus', '2026-10-12', '2026-10-13').unit, 'day');
  assert.deepEqual(UNITS, ['day', 'week', 'month', 'year']);
});

test('日ごとで1年・10年でも棒の数が合う（棒の数＝日数）', () => {
  const r = studyReport(st({}), 'day', '2025-10-18', '2026-10-17');
  assert.equal(r.buckets.length, 365);
  const long = studyReport(st({}), 'day', numToKey(keyToNum('2026-10-17') - MAX_RANGE_DAYS + 1), '2026-10-17');
  assert.equal(long.buckets.length, MAX_RANGE_DAYS);
});

// ---- 言い方 ----

test('時間の言い方: 秒・分・時間、縦軸の目盛り、縦軸の上端', () => {
  assert.equal(formatDuration(0), '0分');
  assert.equal(formatDuration(45), '45秒');
  assert.equal(formatDuration(60), '1分');
  assert.equal(formatDuration(3900), '1時間5分');
  assert.equal(formatDuration(-5), '0分');
  assert.equal(formatDuration('x'), '0分');
  assert.equal(formatAxis(300), '5分');
  assert.equal(formatAxis(1800), '30分');
  assert.equal(formatAxis(3600), '1時間');
  assert.equal(formatAxis(5400), '1.5時間');
  assert.equal(axisMax(0), 600);
  assert.equal(axisMax(600), 600);
  assert.equal(axisMax(601), 1200);
  assert.equal(axisMax(3601), 7200);
  assert.equal(axisMax(86400), 86400);
  assert.ok(axisMax(86400 * 365) >= 86400 * 365);
  assert.equal(bucketText({ speak: '10月3日(金)', seconds: 3900, answered: 0 }), '10月3日(金)：1時間5分');
});

test('日の名前: 曜日つきで読み上げる', () => {
  const r = studyReport(st({ '2026-10-17': 1500 }), 'day', '2026-10-17', '2026-10-17');
  assert.equal(r.buckets[0].speak, '10月17日(土)');
  assert.equal(r.buckets[0].label, '10/17');
  assert.equal(bucketText(r.buckets[0]), '10月17日(土)：25分');
});

// ---- 記録（studytime.js） ----

test('addStudySeconds: 合計とその日の分に足す。日付は渡した時刻の端末の日付（0時をまたぐと次の日）', () => {
  const s = defaultState();
  addStudySeconds(s, 30, new Date(2026, 9, 17, 23, 59, 0));
  addStudySeconds(s, 20, new Date(2026, 9, 17, 12, 0, 0));
  addStudySeconds(s, 10, new Date(2026, 9, 18, 0, 0, 1));
  assert.deepEqual(s.studyDays, { '2026-10-17': 50, '2026-10-18': 10 });
  assert.equal(s.studySeconds, 60);
  // 日付を渡さなくても動く（今日の分になる）
  const t = defaultState();
  addStudySeconds(t, 5);
  assert.equal(Object.keys(t.studyDays).length, 1);
  assert.equal(Object.values(t.studyDays)[0], 5);
});

test('addStudySeconds: 負・0・壊れた値は足さない。古い日は消えない。1日の上限は24時間。壊れた studyDays は作り直す', () => {
  const s = defaultState();
  const d = new Date(2026, 0, 5, 9, 0, 0);
  addStudySeconds(s, 0, d);
  addStudySeconds(s, -10, d);
  addStudySeconds(s, NaN, d);
  assert.deepEqual(s.studyDays, {});
  addStudySeconds(s, 100, new Date(2020, 1, 29, 9, 0, 0));
  for (let i = 0; i < 300; i++) addStudySeconds(s, 1, new Date(2026, 0, 1 + (i % 28), 9, 0, 0));
  assert.equal(s.studyDays['2020-02-29'], 100); // 古い日は残る
  assert.equal(Object.keys(s.studyDays).length, 29);
  addStudySeconds(s, MAX_DAY_SECONDS, d);
  addStudySeconds(s, 500, d);
  assert.equal(s.studyDays['2026-01-05'], MAX_DAY_SECONDS);
  const broken = { studySeconds: 0, studyDays: 'abc' };
  addStudySeconds(broken, 7, d);
  assert.deepEqual(broken.studyDays, { '2026-01-05': 7 });
  const arr = { studySeconds: 0, studyDays: [1, 2] };
  addStudySeconds(arr, 7, d);
  assert.deepEqual(arr.studyDays, { '2026-01-05': 7 });
  const bad = { studySeconds: 0, studyDays: { '2026-01-05': 'x' } };
  addStudySeconds(bad, 3, d);
  assert.equal(bad.studyDays['2026-01-05'], 3);
});

test('学習時間を足しても daily（答えた記録）は増えない。連続日数の判定を変えない', () => {
  const s = defaultState();
  addStudySeconds(s, 600, new Date(2026, 9, 17, 9, 0, 0));
  assert.deepEqual(s.daily, {});
  assert.equal(currentStreak(s.streak, '2026-10-17'), 0);
});

test('normalizeStudyDays: 日付でないキー・数でない値・負・0は捨て、小数は切り捨て、上限を超えたら上限。配列・文字列は空', () => {
  assert.deepEqual(normalizeStudyDays(undefined), {});
  assert.deepEqual(normalizeStudyDays(null), {});
  assert.deepEqual(normalizeStudyDays('x'), {});
  assert.deepEqual(normalizeStudyDays([1, 2]), {});
  assert.deepEqual(normalizeStudyDays({ '2026-10-17': 90.9, '2026-10-16': 0, '2026-10-15': -1, '2026-10-14': '60', '2026-10-13': NaN, '2026-02-30': 5, x: 5, '2026-10-12': 999999, '2026-10-11': 0.5 }), { '2026-10-12': MAX_DAY_SECONDS, '2026-10-17': 90 });
  assert.equal(isDateKey('2024-02-29'), true);
  assert.equal(isDateKey('2023-02-29'), false);
  // 日付の古い順に並ぶ
  assert.deepEqual(Object.keys(normalizeStudyDays({ '2026-10-17': 5, '2025-01-01': 5, '2026-01-01': 5 })), ['2025-01-01', '2026-01-01', '2026-10-17']);
  // 数年分はそのまま残る（消さない）
  const big = {};
  for (let i = 0; i < 365 * 5; i++) big[numToKey(keyToNum('2022-01-01') + i)] = 60;
  assert.equal(Object.keys(normalizeStudyDays(big)).length, 365 * 5);
  assert.equal(MAX_STUDY_DAYS > 365 * 50, true);
});

test('保存の形: 新しい記録は空。古い記録（項目なし）・壊れた値は空。値は残る', () => {
  assert.deepEqual(defaultState().studyDays, {});
  assert.deepEqual(mergeState({ xp: 1 }).studyDays, {});
  assert.deepEqual(mergeState({ studyDays: 'abc' }).studyDays, {});
  assert.deepEqual(mergeState({ studyDays: { '2026-10-17': 300, bad: 1 } }).studyDays, { '2026-10-17': 300 });
});

test('答えた記録（recordAnswer）は studyDays を変えず、studyDays だけの日が daily に現れない', () => {
  const s = defaultState();
  addStudySeconds(s, 100, new Date(2026, 9, 17, 9, 0, 0));
  recordAnswer(s, { id: 'q1' }, { correct: true, now: new Date(2026, 9, 18, 9, 0, 0) });
  assert.deepEqual(Object.keys(s.daily), ['2026-10-18']);
  assert.deepEqual(s.studyDays, { '2026-10-17': 100 });
});

test('書き出し・読み込み（科目なし）: 日ごとの学習時間が入る。無い古いファイルも読める。壊れた値は捨てる', () => {
  const s = defaultState();
  s.studyDays = { '2026-10-16': 600, '2026-10-17': 1200 };
  const text = serializeBackup('g-kentei', s);
  assert.deepEqual(JSON.parse(text).state.studyDays, s.studyDays);
  assert.deepEqual(parseBackup(text, 'g-kentei').state.studyDays, s.studyDays);
  const old = JSON.parse(text);
  delete old.state.studyDays;
  const r = parseBackup(JSON.stringify(old), 'g-kentei');
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.studyDays, {});
  old.state.studyDays = { '2026-10-16': 'x', nope: 5, '2026-10-17': 30 };
  assert.deepEqual(parseBackup(JSON.stringify(old), 'g-kentei').state.studyDays, { '2026-10-17': 30 });
});

test('書き出し・読み込み（科目あり）: 共通の記録に日ごとの学習時間が入り、科目ごとの記録には入らない', () => {
  assert.equal(COMMON_KEYS.includes('studyDays'), true);
  const backing = new Map();
  const mem = { getItem: (k) => (backing.has(k) ? backing.get(k) : null), setItem: (k, v) => backing.set(k, String(v)), removeItem: (k) => backing.delete(k) };
  const store = createSubjectStore({ appId: 'shindanshi-1ji', subjects: [{ id: 'economics', folder: '01_economics', name: '経済' }], backing: mem });
  store.open('economics').save(mergeState({ studyDays: { '2026-10-17': 900 } }));
  assert.deepEqual(store.open('economics').load().studyDays, { '2026-10-17': 900 }); // 読み直しても残る
  const data = store.exportAll();
  assert.deepEqual(data.common.studyDays, { '2026-10-17': 900 });
  assert.equal('studyDays' in data.subjects.economics, false);
  const text = JSON.stringify(buildSubjectsBackup('shindanshi-1ji', data));
  assert.deepEqual(parseSubjectsBackup(text, 'shindanshi-1ji').common.studyDays, { '2026-10-17': 900 });
  const old = JSON.parse(text);
  delete old.common.studyDays;
  assert.deepEqual(parseSubjectsBackup(JSON.stringify(old), 'shindanshi-1ji').common.studyDays, {});
});

// ---- 結線 ----

test('棒の上の数値: 0は出さない。1分未満・分・時間:分・100時間以上。切り捨て（detail の formatDuration と同じ向き）', () => {
  assert.equal(formatBarValue(0), '');
  assert.equal(formatBarValue(-5), '');
  assert.equal(formatBarValue(NaN), '');
  assert.equal(formatBarValue(1), '<1分');
  assert.equal(formatBarValue(59), '<1分');
  assert.equal(formatBarValue(60), '1分');
  assert.equal(formatBarValue(45 * 60), '45分');
  assert.equal(formatBarValue(59 * 60 + 59), '59分');
  assert.equal(formatBarValue(3600), '1:00');
  assert.equal(formatBarValue(3900), '1:05');
  assert.equal(formatBarValue(10 * 3600 + 9 * 60), '10:09');
  assert.equal(formatBarValue(99 * 3600 + 59 * 60), '99:59');
  assert.equal(formatBarValue(100 * 3600), '100時間');
  assert.equal(formatBarValue(2000 * 3600 + 1800), '2000時間');
});

test('棒の高さ: 0は2px、記録があれば最低3px、上端でPLOT_PX。上端を超える値は上端に抑える', () => {
  assert.equal(barPx(0, 3600), 2);
  assert.equal(barPx(5, 86400), 3);
  assert.equal(barPx(3600, 3600), PLOT_PX);
  assert.equal(barPx(1800, 3600), PLOT_PX / 2);
  assert.equal(barPx(9999, 3600), PLOT_PX);
  assert.equal(barPx(100, 0), 2);
  assert.equal(barPx(NaN, 3600), 2);
});

test('名前を出す間隔: 約46pxおき', () => {
  assert.equal(labelEvery(14), 4);
  assert.equal(labelEvery(40), 2);
  assert.equal(labelEvery(56), 1);
  assert.equal(labelEvery(1000), 1);
});

test('棒の上の数値（横書き1行）: 重なるなら横に寄せる・1段上げる。それでも重なる・はみ出すときだけ隠す', () => {
  const P = (t, h, s, o) => placeBarValues(t, h, s, o);
  // 幅の見積もり: 数字は0.62字、漢字は1字（11px）
  assert.equal(barValueWidthPx('37分'), Math.ceil((0.62 * 2 + 1) * 11));
  assert.equal(barValueWidthPx(''), 0);
  // 1本だけ → 真上・真ん中
  assert.deepEqual(P(['', '', '', '37分'], [2, 2, 2, 100], 14, { first: 3 }), { level: [-1, -1, -1, 0], shift: [0, 0, 0, 0] });
  // 先生の画面（2026-10-18 8:58）: 選んだ 10/17（38分）の右隣が背の高い 10/18（53分）。真ん中だと高い棒にかかって隠れていた
  // → 空いている左へ寄せて出す。10/18 は真上
  assert.deepEqual(P(['', '', '38分', '53分'], [2, 2, 101, 141], 14, { first: 2 }), { level: [-1, -1, 0, 0], shift: [0, 0, -6, 0] });
  // 先生の画面（同じ日 8:31）: 同じくらいの高さの隣どうし → 右（新しい日）が0段、左は1段上げて両方出す
  assert.deepEqual(P(['', '', '37分', '38分'], [2, 2, 120, 118], 14, { first: 0 }), { level: [-1, -1, 1, 0], shift: [0, 0, 0, 0] });
  // 選んだ棒を先に置く（選んだ棒が0段、右が1段）
  assert.deepEqual(P(['', '37分', '38分'], [2, 100, 100], 14, { first: 1 }).level, [-1, 0, 1]);
  // 同じ高さの4本 → 寄せと段を組み合わせて4つとも出す
  assert.deepEqual(P(['37分', '37分', '37分', '37分'], [100, 100, 100, 100], 14), { level: [1, 0, 1, 0], shift: [-6, -6, 0, 0] });
  // 背の高い棒に両側をはさまれた低い棒: どちらへ寄せても高い棒にかかる → 隠す（押せば詳細で読める）
  assert.deepEqual(P(['1:18', '33分', '1:18'], [120, 50, 120], 14).level, [1, -1, 0]);
  // 片側だけ高い → 空いている側へ寄せて出す
  assert.deepEqual(P(['', '33分', '1:18'], [2, 50, 120], 14), { level: [-1, 0, 0], shift: [0, -6, 0] });
  // 余白の上端（202px）を超える段には置かない。最大の高さの3本でも、寄せと段で3つとも出る
  assert.deepEqual(P(['37分', '37分', '37分'], [PLOT_PX, PLOT_PX, PLOT_PX], 14), { level: [0, 1, 0], shift: [-6, 0, 0] });
  // 左右の余白（14px）からはみ出す寄せはしない: 大きい字の左端の棒は左へ寄せられない
  const big = P(['10:09', '', ''], [100, 2, 2], 14, { fontPx: 16 });
  assert.equal(big.shift[0] >= 0, true);
  // 週ごと（40px）では『1:05』どうしは重ならない
  assert.deepEqual(P(['1:05', '1:05', '1:05'], [100, 100, 100], 40), { level: [0, 0, 0], shift: [0, 0, 0] });
  // 文字が大きい設定（16px）では、詰まって段が上がる（棒より短い数値は寄せない）
  assert.deepEqual(P(['10:09', '10:09', '10:09'], [100, 100, 100], 40, { fontPx: 16 }).level, [0, 1, 0]);
  // 空の数値（0分の日）は出さないし、場所も取らない
  assert.deepEqual(P(['37分', '', '37分'], [100, 2, 100], 14), { level: [0, -1, 0], shift: [-6, 0, 0] });
  assert.deepEqual(P([], [], 14), { level: [], shift: [] });
});

test('切り替えで棒を結ぶ: 右端（今）をそろえて引き継ぎ、左の余りは消える／新しく出る（30本→12本、12本→5本、0本から）', () => {
  assert.deepEqual(matchColumns(30, 12), { leave: 18, enter: 0, keep: 12 });
  assert.deepEqual(matchColumns(12, 30), { leave: 0, enter: 18, keep: 12 });
  assert.deepEqual(matchColumns(12, 12), { leave: 0, enter: 0, keep: 12 });
  assert.deepEqual(matchColumns(0, 5), { leave: 0, enter: 5, keep: 0 });
  assert.deepEqual(matchColumns(5, 0), { leave: 5, enter: 0, keep: 0 });
  assert.deepEqual(matchColumns(undefined, NaN), { leave: 0, enter: 0, keep: 0 });
});

test('動き: 棒の高さ・幅は CSS の transition、数値と縦軸は数え上がり。動きを減らす設定では止まる（CSS の一括停止＋画面側の判定）', () => {
  const css = read('css/app.css');
  assert.match(css, /\.sr-bar \{[^}]*transition: height/);
  assert.match(css, /\.sr-col \{[^}]*transition: flex-grow/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation: none !important; transition: none !important;/);
  const v = read('js/views/studyreport.js');
  assert.match(v, /prefers-reduced-motion: reduce/);
  assert.match(v, /tween\(axisTop/);
  assert.match(v, /tween\(it\.val/);
  assert.match(v, /matchColumns\(items\.length, n\)/);
});

test('結線: オフライン登録・テスト登録・ルート・ホームの入口・記録を足す所', () => {
  const sw = read('sw-core.js');
  for (const f of ['js/lib/studyreport.js', 'js/views/studyreport.js']) assert.ok(sw.includes("'../shared/" + f + "'"), f + ' が sw-core.js の SHARED に無い');
  assert.match(read('package.json'), /tests\/studyreport\.test\.js/);
  const app = read('js/app.js');
  assert.match(app, /\['study', 'home', \(\) => renderStudyReport\(app\)\]/);
  assert.match(app, /import \{ renderStudyReport \} from '\.\/views\/studyreport\.js'/);
  const home = read('js/views/home.js');
  assert.match(home, /'data-study-time': '1'[^\n]*onClick: \(\) => app\.go\('#\/study'\)/);
  assert.match(read('js/studyclock.js'), /addStudySeconds\(app\.state, r\.seconds, new Date\(now\(\)\)\)/);
});

test('画面: 4つの単位・期間の指定・読み上げ用の名前・横スクロールの最小幅・週ごとへの切り替えがある', () => {
  const v = read('js/views/studyreport.js');
  assert.match(v, /UNITS\.forEach/);
  assert.match(v, /type: 'date'/);
  assert.match(v, /setAttribute\('aria-label', bucketText\(bk\)\)/);
  assert.match(v, /MIN_SLOT_PX\[unit\]/);
  assert.match(v, /minWidth = minW/);
  assert.match(v, /scrollLeft = scroll\.scrollWidth/);
  assert.match(v, /data-sr-to-week/);
  for (const u of UNITS) assert.ok(MIN_SLOT_PX_OK(u), u + ' の最小幅');
  const css = read('css/app.css');
  for (const c of ['.sr-cols', '.sr-col', '.sr-bar', '.sr-scroll', '.sr-tab', '.sr-date', '.sr-stats', '.sr-detail']) assert.ok(css.includes(c + ' ') || css.includes(c + '{') || css.includes(c + ','), c + ' が app.css に無い');
});

function MIN_SLOT_PX_OK(u) {
  return Number.isInteger(MIN_SLOT_PX[u]) && MIN_SLOT_PX[u] >= 14; // これより細い棒は押しにくい
}
