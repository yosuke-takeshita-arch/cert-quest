// 総学習時間の検証（要件定義書 §6-1）。ブラウザ無しで node から叩く。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IDLE_LIMIT_MS, MAX_GAP_MS, startClock, advance, addStudySeconds, normalizeStudySeconds, formatStudyTime,
} from '../js/lib/studytime.js';
import { defaultState, mergeState } from '../js/lib/progress.js';
import { buildBackup, parseBackup, buildSubjectsBackup, parseSubjectsBackup, serializeBackup } from '../js/lib/backup.js';
import { COMMON_KEYS, createSubjectStore, splitState } from '../js/lib/subjects.js';

const T0 = Date.UTC(2026, 9, 13, 0, 0, 0);
const S = 1000;

/** 5秒おきの tick を from から to まで進めた合計秒数（clock も返す）。 */
function runTicks(clock, from, to, step = 5 * S) {
  let total = 0;
  let c = clock;
  for (let t = from + step; t <= to; t += step) {
    const r = advance(c, 'tick', t);
    c = r.clock;
    total += r.seconds;
  }
  return { clock: c, total };
}

test('操作が続けば、時間がそのまま数えられる', () => {
  let c = startClock(T0);
  let total = 0;
  for (let t = T0 + 5 * S; t <= T0 + 60 * S; t += 5 * S) {
    let r = advance(c, 'tick', t - 1 * S);
    c = r.clock; total += r.seconds;
    r = advance(c, 'input', t);
    c = r.clock; total += r.seconds;
  }
  assert.equal(total, 60);
});

test('境界: 最後の操作からちょうど2分までは数え、2分+1秒の分は数えない', () => {
  const start = startClock(T0);
  // ちょうど2分（120秒）無操作
  const a = runTicks(start, T0, T0 + IDLE_LIMIT_MS);
  assert.equal(a.total, 120);
  // 2分+1秒 … tick が5秒刻みなので、2分+5秒まで進めても増えるのは120秒のまま
  const b = runTicks(start, T0, T0 + IDLE_LIMIT_MS + 5 * S);
  assert.equal(b.total, 120);
  // 1秒刻みで 2分+1秒 まで
  const c = runTicks(start, T0, T0 + IDLE_LIMIT_MS + 1 * S, 1 * S);
  assert.equal(c.total, 120);
  // 2分-1秒 では 119 秒
  const d = runTicks(start, T0, T0 + IDLE_LIMIT_MS - 1 * S, 1 * S);
  assert.equal(d.total, 119);
});

test('境界: 2分の途中で刻みが跨ぐときも、2分ちょうどで切れる（端数）', () => {
  // 7秒刻みだと 119秒目の次が 126秒目。120秒を超えた分は数えない
  const r = runTicks(startClock(T0), T0, T0 + 130 * S, 7 * S);
  assert.equal(r.total, 120);
});

test('2分止まったあとに操作が戻ると、また数え始める', () => {
  let { clock, total } = runTicks(startClock(T0), T0, T0 + 200 * S);
  assert.equal(total, 120);
  let r = advance(clock, 'input', T0 + 200 * S + 1);
  clock = r.clock;
  assert.equal(r.seconds, 0); // 操作の瞬間までは無操作なので増えない
  const more = runTicks(clock, T0 + 200 * S + 1, T0 + 200 * S + 1 + 30 * S);
  assert.equal(more.total, 30);
});

test('画面が裏に回ると止まり、前に戻ると再開する（hidden → visible）', () => {
  let c = startClock(T0);
  let r = advance(c, 'tick', T0 + 5 * S);
  c = r.clock;
  assert.equal(r.seconds, 5);
  r = advance(c, 'hidden', T0 + 8 * S); // 裏に回るまでの3秒は数える
  c = r.clock;
  assert.equal(r.seconds, 3);
  // 裏にいる間（10分）。tick が来ても数えない
  let total = 0;
  for (let t = T0 + 8 * S; t <= T0 + 600 * S; t += 5 * S) {
    r = advance(c, 'tick', t);
    c = r.clock; total += r.seconds;
  }
  assert.equal(total, 0);
  r = advance(c, 'visible', T0 + 605 * S); // 戻った瞬間までは数えない
  c = r.clock;
  assert.equal(r.seconds, 0);
  r = advance(c, 'tick', T0 + 610 * S);
  assert.equal(r.seconds, 5);
});

test('日付をまたいでも、そのまま数え続ける（合計は日で区切らない）', () => {
  const mid = Date.UTC(2026, 9, 13, 14, 59, 50); // JST 2026-10-13 23:59:50
  let c = startClock(mid);
  let total = 0;
  for (let t = mid + 5 * S; t <= mid + 20 * S; t += 5 * S) {
    const r = advance(c, 'input', t);
    c = r.clock; total += r.seconds;
  }
  assert.equal(total, 20);
});

test('端末の時計が戻った（負の差）: 増えず、マイナスにもならず、そこから数え直す', () => {
  let c = startClock(T0);
  let r = advance(c, 'tick', T0 + 5 * S);
  c = r.clock;
  r = advance(c, 'tick', T0 + 5 * S - 3600 * S); // 1時間戻る
  c = r.clock;
  assert.equal(r.seconds, 0);
  assert.equal(c.carry >= 0, true);
  // 戻った先の時刻から5秒進めば、5秒数える（最後の操作が未来のままで数えが止まることはない）
  r = advance(c, 'tick', T0 + 10 * S - 3600 * S);
  assert.equal(r.seconds, 5);
});

test('すごく長い間隔（スリープ明け）: 一気に加算しない', () => {
  let c = startClock(T0);
  c = advance(c, 'input', T0 + 5 * S).clock;
  // 8時間後に tick。最後の操作が5秒前でも、空いた間は数えない
  let r = advance(c, 'tick', T0 + 8 * 3600 * S);
  assert.equal(r.seconds, 0);
  // 操作が戻ると、そこから数える
  c = advance(r.clock, 'input', T0 + 8 * 3600 * S + 1 * S).clock;
  r = advance(c, 'tick', T0 + 8 * 3600 * S + 6 * S);
  assert.equal(r.seconds, 5);
  // 間隔の上限ちょうど（30秒）は数え、+1ms は数えない
  const base = advance(startClock(T0), 'input', T0).clock;
  assert.equal(advance(base, 'tick', T0 + MAX_GAP_MS).seconds, 30);
  assert.equal(advance(base, 'tick', T0 + MAX_GAP_MS + 1).seconds, 0);
});

test('1秒未満の端数は持ち越し、失われない', () => {
  let c = startClock(T0);
  let total = 0;
  for (let i = 1; i <= 10; i++) {
    const r = advance(c, 'input', T0 + i * 400); // 0.4秒刻みで10回 = 4秒
    c = r.clock; total += r.seconds;
  }
  assert.equal(total, 4);
});

test('advance は渡した状態を書き換えない', () => {
  const c = startClock(T0);
  const before = JSON.stringify(c);
  advance(c, 'tick', T0 + 5 * S);
  assert.equal(JSON.stringify(c), before);
});

test('normalizeStudySeconds: 壊れた値は0、小数は切り捨て', () => {
  for (const v of [undefined, null, 'abc', NaN, Infinity, -5, {}, [], '100']) assert.equal(normalizeStudySeconds(v), 0, String(v));
  assert.equal(normalizeStudySeconds(59.9), 59);
  assert.equal(normalizeStudySeconds(3600), 3600);
});

test('addStudySeconds: 足す。負・壊れた値は足さない', () => {
  const s = defaultState();
  assert.equal(addStudySeconds(s, 90), 90);
  assert.equal(addStudySeconds(s, -50), 90);
  assert.equal(addStudySeconds(s, NaN), 90);
  assert.equal(addStudySeconds(s, 10), 100);
  s.studySeconds = 'x';
  assert.equal(addStudySeconds(s, 5), 5);
});

test('formatStudyTime: 12時間34分／1時間未満は分だけ／1分未満は0分', () => {
  assert.equal(formatStudyTime(12 * 3600 + 34 * 60 + 59), '12時間34分');
  assert.equal(formatStudyTime(3600), '1時間0分');
  assert.equal(formatStudyTime(25 * 60), '25分');
  assert.equal(formatStudyTime(59), '0分');
  assert.equal(formatStudyTime(0), '0分');
  assert.equal(formatStudyTime(undefined), '0分');
  assert.equal(formatStudyTime(-100), '0分');
});

test('記録: 新しい記録は0から。古い記録（項目なし）・壊れた値は0。値は残る', () => {
  assert.equal(defaultState().studySeconds, 0);
  assert.equal(mergeState({ xp: 10 }).studySeconds, 0);
  assert.equal(mergeState({ studySeconds: 'abc' }).studySeconds, 0);
  assert.equal(mergeState({ studySeconds: 4500 }).studySeconds, 4500);
});

test('書き出し・読み込み（科目なし）: 学習時間が入る。学習時間の無い古いファイルも読める', () => {
  const s = defaultState();
  s.studySeconds = 7200;
  const text = serializeBackup('g-kentei', s);
  assert.equal(JSON.parse(text).state.studySeconds, 7200);
  assert.equal(parseBackup(text, 'g-kentei').state.studySeconds, 7200);
  // 古いファイル: studySeconds の無い state
  const old = JSON.parse(text);
  delete old.state.studySeconds;
  const r = parseBackup(JSON.stringify(old), 'g-kentei');
  assert.equal(r.ok, true);
  assert.equal(r.state.studySeconds, 0);
});

test('書き出し・読み込み（科目あり）: 共通の記録に学習時間が入る。古いファイルも読める', () => {
  assert.equal(COMMON_KEYS.includes('studySeconds'), true);
  const store = createSubjectStore({ appId: 'shindanshi-1ji', subjects: [{ id: 'economics', folder: '01_economics', name: '経済' }], backing: memoryBacking() });
  const flat = mergeState({ studySeconds: 3661 });
  store.open('economics').save(flat);
  const data = store.exportAll();
  assert.equal(data.common.studySeconds, 3661);
  assert.equal('studySeconds' in data.subjects.economics, false); // 科目ごとの記録には入らない
  const text = JSON.stringify(buildSubjectsBackup('shindanshi-1ji', data));
  assert.equal(parseSubjectsBackup(text, 'shindanshi-1ji').common.studySeconds, 3661);
  const old = JSON.parse(text);
  delete old.common.studySeconds;
  const r = parseSubjectsBackup(JSON.stringify(old), 'shindanshi-1ji');
  assert.equal(r.ok, true);
  assert.equal(r.common.studySeconds, 0);
  assert.equal(splitState(flat).common.studySeconds, 3661);
});

test('buildBackup の state は defaultState と同じ項目（studySeconds を含む）', () => {
  assert.equal('studySeconds' in buildBackup('g-kentei', defaultState()).state, true);
});

function memoryBacking() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
