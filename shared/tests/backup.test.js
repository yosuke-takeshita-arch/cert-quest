// 学習記録の書き出しと読み込みの検証。ブラウザ無しで node から叩く。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_KIND, BACKUP_VERSION, backupFileName, buildBackup, serializeBackup, parseBackup, backupSummary } from '../js/lib/backup.js';
import { defaultState, mergeState, recordAnswer } from '../js/lib/progress.js';

const sample = () => {
  const s = defaultState();
  recordAnswer(s, { id: 'G-01-001' }, { correct: true, now: new Date(2026, 9, 4, 9) });
  recordAnswer(s, { id: 'G-01-002' }, { correct: false, now: new Date(2026, 9, 4, 9, 5) });
  s.badges['first-step'] = '2026-10-04';
  s.settings.examAsked = true;
  s.settings.examDate = '2026-11-06';
  s.settings.theme = 'dark';
  return s;
};

test('ファイル名: 資格の id と日付が入る', () => {
  assert.equal(backupFileName('g-kentei', new Date(2026, 9, 4, 23, 59)), 'g-kentei-record-2026-10-04.json');
  assert.equal(backupFileName('dx-biz', new Date(2027, 0, 5)), 'dx-biz-record-2027-01-05.json');
  assert.equal(backupFileName('../あ/x y', new Date(2026, 0, 1)), 'xy-record-2026-01-01.json');
});

test('書き出し: 形（kind・app・version・exportedAt・state）', () => {
  const now = new Date(Date.UTC(2026, 9, 4, 1, 2, 3));
  const b = buildBackup('g-kentei', sample(), now);
  assert.deepEqual(Object.keys(b).sort(), ['app', 'exportedAt', 'kind', 'state', 'version']);
  assert.equal(b.kind, BACKUP_KIND);
  assert.equal(b.app, 'g-kentei');
  assert.equal(b.version, BACKUP_VERSION);
  assert.equal(b.exportedAt, '2026-10-04T01:02:03.000Z');
});

test('書き出し: 入るのは学習記録と設定だけ。知らない項目は入れない', () => {
  const base = sample();
  const dirty = { ...base, email: 'a@example.com', name: '山田', phone: '090-0000-0000', settings: { ...base.settings, note: 'x' } };
  const b = buildBackup('g-kentei', dirty);
  assert.deepEqual(Object.keys(b.state).sort(), Object.keys(defaultState()).sort());
  const text = JSON.stringify(b);
  for (const w of ['a@example.com', '山田', '090-0000-0000', '"email"', '"phone"', '"name"']) assert.ok(!text.includes(w), w);
});

test('書き出し → 読み込み: 同じ記録に戻る', () => {
  const s = sample();
  const r = parseBackup(serializeBackup('g-kentei', s), 'g-kentei');
  assert.equal(r.ok, true);
  assert.deepEqual(r.state, mergeState(s));
  assert.ok(r.state.qstats['G-01-001'].seen);
  assert.equal(r.state.settings.examDate, '2026-11-06');
});

test('書き出し → 読み込み: 合格予想の推移とボスの撃破回数が残る（古い・壊れた値は直る）', () => {
  const s = sample();
  s.forecast = { '2026-10-03': 41.5, '2026-10-04': 47 };
  s.boss = { 'AとB|C': 2 };
  const r = parseBackup(serializeBackup('g-kentei', s), 'g-kentei');
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.forecast, { '2026-10-03': 41.5, '2026-10-04': 47 });
  assert.deepEqual(r.state.boss, { 'AとB|C': 2 });
  assert.ok('forecast' in buildBackup('g-kentei', s).state && 'boss' in buildBackup('g-kentei', s).state);
  // 項目の無い古い記録は空で補う。日付でないキー・範囲外の点・回数が正の整数でないものは捨てる
  assert.deepEqual(mergeState({}).forecast, {});
  assert.deepEqual(mergeState({}).boss, {});
  const bad = mergeState({ forecast: { x: 5, '2026-10-05': 120, '2026-10-06': 'a', '2026-10-07': 60 }, boss: { a: 0, b: 1.5, c: 3 } });
  assert.deepEqual(bad.forecast, { '2026-10-07': 60 });
  assert.deepEqual(bad.boss, { c: 3 });
});

test('読み込み: 別の資格のファイルは断る', () => {
  assert.deepEqual(parseBackup(serializeBackup('dx-biz', sample()), 'g-kentei'), { ok: false, reason: 'otherApp' });
});

test('読み込み: 壊れたファイルは断る', () => {
  for (const bad of ['', '{', 'abc', '[1,2]', 'null', '123', '"x"', '{"kind":"cert-quest-backup"', undefined, null, 5]) {
    const r = parseBackup(bad, 'g-kentei');
    assert.equal(r.ok, false, String(bad));
    assert.equal(r.reason, 'broken', String(bad));
  }
});

test('読み込み: 学習記録のファイルではない JSON は断る', () => {
  assert.equal(parseBackup('{"a":1}', 'g-kentei').reason, 'notBackup');
  assert.equal(parseBackup(JSON.stringify(sample()), 'g-kentei').reason, 'notBackup');
});

test('読み込み: 項目が欠けた・型が違うものは断る', () => {
  const ok = JSON.parse(serializeBackup('g-kentei', sample()));
  const cases = [
    { ...ok, app: undefined }, { ...ok, app: 5 }, { ...ok, app: '' },
    { ...ok, version: undefined }, { ...ok, version: '1' }, { ...ok, version: 0 }, { ...ok, version: 1.5 }, { ...ok, version: -1 },
    { ...ok, state: undefined }, { ...ok, state: null }, { ...ok, state: [] }, { ...ok, state: 'x' },
  ];
  for (const c of cases) {
    const r = parseBackup(JSON.stringify(c), 'g-kentei');
    assert.equal(r.ok, false, JSON.stringify(c).slice(0, 60));
    assert.equal(r.reason, 'broken');
  }
});

test('読み込み: 新しい版は断り、古い版（項目が足りない記録）は補って受け入れる', () => {
  const ok = JSON.parse(serializeBackup('g-kentei', sample()));
  assert.equal(parseBackup(JSON.stringify({ ...ok, version: BACKUP_VERSION + 1 }), 'g-kentei').reason, 'newer');
  const old = { kind: BACKUP_KIND, app: 'g-kentei', version: 1, state: { v: 1, xp: 120, totals: { answered: 12, correct: 9 }, settings: { sound: true } } };
  const r = parseBackup(JSON.stringify(old), 'g-kentei');
  assert.equal(r.ok, true);
  assert.equal(r.state.xp, 120);
  assert.equal(r.state.settings.sound, true);
  assert.equal(r.state.settings.examAsked, false);
  assert.deepEqual(r.state.exams, []);
  assert.equal(r.state.settings.dailyGoal, defaultState().settings.dailyGoal);
});

test('読み込み: 中身は mergeState の正規化を通る（ありえない値は直る）', () => {
  const evil = { kind: BACKUP_KIND, app: 'g-kentei', version: 1, state: { xp: 'たくさん', qstats: [1], exams: 'x', settings: { theme: 'neon', examAsked: true, examDate: 'あした', dailyGoal: -5 }, extra: { email: 'a@b.c' } } };
  const r = parseBackup(JSON.stringify(evil), 'g-kentei');
  assert.equal(r.ok, true);
  assert.equal(r.state.xp, 0);
  assert.deepEqual(r.state.qstats, {});
  assert.deepEqual(r.state.exams, []);
  assert.equal(r.state.settings.theme, 'light');
  assert.equal(r.state.settings.examAsked, false);
  assert.equal(r.state.settings.examDate, null);
  assert.equal('extra' in r.state, false);
});

test('読み込み: 大きすぎる文字列は断る', () => {
  assert.equal(parseBackup('x'.repeat(5 * 1024 * 1024 + 1), 'g-kentei').reason, 'tooBig');
});

test('backupSummary', () => {
  assert.deepEqual(backupSummary(sample()), { answered: 2, xp: sample().xp, streakBest: 1, badges: 1 });
});
