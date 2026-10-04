// 受験日（利用者が決める）の正規化・過ぎたかの判定・日数。ブラウザ無しで node から叩く。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeExamDate, normalizeExamSettings, needsExamDateAsk, examStatus, examDateDefault, formatExamDate } from '../js/lib/examdate.js';
import { defaultState, mergeState } from '../js/lib/progress.js';

test('normalizeExamDate: 実在する YYYY-MM-DD だけ通す', () => {
  assert.equal(normalizeExamDate('2026-11-06'), '2026-11-06');
  assert.equal(normalizeExamDate('2028-02-29'), '2028-02-29'); // うるう年
  for (const bad of ['2027-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '2026-11-00', '2026-11-31', '2026-1-6', '2026/11/06', '20261106', '', ' 2026-11-06', '2026-11-06 ', 'あした', 'NaN-NaN-NaN', '2019-12-31', '2101-01-01', 20261106, null, undefined, {}, [], true]) {
    assert.equal(normalizeExamDate(bad), null, String(bad));
  }
});

test('既定の設定は「まだ聞いていない」', () => {
  const s = defaultState().settings;
  assert.equal(s.examDate, null);
  assert.equal(s.examAsked, false);
  assert.equal(needsExamDateAsk(s), true);
});

test('古い記録（受験日の項目が無い）は、聞く対象になる', () => {
  const old = mergeState({ v: 1, xp: 300, totals: { answered: 40, correct: 30 }, settings: { sound: true, theme: 'dark' } });
  assert.equal(old.xp, 300);
  assert.equal(old.settings.examAsked, false);
  assert.equal(old.settings.examDate, null);
  assert.equal(needsExamDateAsk(old.settings), true);
});

test('mergeState: 日付を答えた記録・まだ決めていないと答えた記録はそのまま残る', () => {
  const a = mergeState({ settings: { examAsked: true, examDate: '2026-12-02' } }).settings;
  assert.deepEqual([a.examAsked, a.examDate], [true, '2026-12-02']);
  const b = mergeState({ settings: { examAsked: true, examDate: null } }).settings;
  assert.deepEqual([b.examAsked, b.examDate], [true, null]);
  assert.equal(needsExamDateAsk(b), false);
});

test('mergeState: ありえない値は「まだ聞いていない」に戻す', () => {
  for (const bad of ['あした', '2026-02-30', '2026-11-6', 12345, {}, [], false, '']) {
    const s = mergeState({ settings: { examAsked: true, examDate: bad } }).settings;
    assert.deepEqual([s.examAsked, s.examDate], [false, null], JSON.stringify(bad));
  }
  for (const asked of ['yes', 1, 'true', null, undefined]) {
    const s = mergeState({ settings: { examAsked: asked, examDate: 'xx' } }).settings;
    assert.deepEqual([s.examAsked, s.examDate], [false, null], String(asked));
  }
  assert.equal(mergeState({ settings: 'x' }).settings.examAsked, false);
  assert.equal(mergeState({ settings: null }).settings.examDate, null);
});

test('normalizeExamSettings: 日付だけ入っている（読める）なら答えたものとして扱う', () => {
  const s = { examDate: '2026-11-29' };
  normalizeExamSettings(s);
  assert.deepEqual([s.examAsked, s.examDate], [true, '2026-11-29']);
});

test('examStatus: 日をまたぐ境目（前日の23:59 / 当日の0:00 / 翌日の0:00）', () => {
  const st = (date, now) => examStatus({ examAsked: true, examDate: date }, now);
  assert.deepEqual(st('2026-11-06', new Date(2026, 10, 5, 23, 59, 59)), { kind: 'upcoming', date: '2026-11-06', days: 1 });
  assert.deepEqual(st('2026-11-06', new Date(2026, 10, 6, 0, 0, 0)), { kind: 'today', date: '2026-11-06', days: 0 });
  assert.deepEqual(st('2026-11-06', new Date(2026, 10, 6, 23, 59, 59)), { kind: 'today', date: '2026-11-06', days: 0 });
  assert.deepEqual(st('2026-11-06', new Date(2026, 10, 7, 0, 0, 0)), { kind: 'past', date: '2026-11-06', days: -1 });
  assert.equal(st('2026-11-06', new Date(2026, 9, 2, 23, 0)).days, 35);
});

test('examStatus: 月またぎ・年またぎ・うるう日の日数', () => {
  const st = (date, now) => examStatus({ examAsked: true, examDate: date }, now).days;
  assert.equal(st('2027-01-01', new Date(2026, 11, 31, 12)), 1);
  assert.equal(st('2028-03-01', new Date(2028, 1, 28, 12)), 2);
  assert.equal(st('2027-03-01', new Date(2027, 1, 28, 12)), 1);
  assert.equal(st('2026-11-01', new Date(2026, 9, 31, 23, 59)), 1);
});

test('examStatus: まだ決めていない・聞いていない・壊れた値は unset（日数を出さない）', () => {
  const unset = { kind: 'unset', date: null, days: null };
  assert.deepEqual(examStatus({ examAsked: true, examDate: null }), unset);
  assert.deepEqual(examStatus({ examAsked: false, examDate: '2026-11-06' }), unset);
  assert.deepEqual(examStatus({ examAsked: true, examDate: 'xx' }), unset);
  assert.deepEqual(examStatus(null), unset);
  assert.deepEqual(examStatus(undefined), unset);
});

test('examDateDefault: config の日付が読めて、まだ過ぎていなければ初期値にする', () => {
  assert.equal(examDateDefault('2026-11-06', new Date(2026, 9, 4)), '2026-11-06');
  assert.equal(examDateDefault('2026-11-06', new Date(2026, 10, 6, 15)), '2026-11-06');
  assert.equal(examDateDefault('2026-11-06', new Date(2026, 10, 7)), '');
  assert.equal(examDateDefault('壊れ', new Date(2026, 9, 4)), '');
  assert.equal(examDateDefault(undefined, new Date(2026, 9, 4)), '');
});

test('formatExamDate', () => {
  assert.equal(formatExamDate('2026-11-06'), '2026年11月6日');
  assert.equal(formatExamDate('2026-12-02'), '2026年12月2日');
  assert.equal(formatExamDate('x'), '');
});
