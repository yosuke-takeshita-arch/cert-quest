// 模擬試験の「続きから」（2026-11-10 の決定）:
// 解いている途中の模擬試験を端末に取っておき、アプリを閉じても続きから始められる。採点したとき・「戻る」でやめたときに消す。
// 取っておくのは問題の ID と並び・答え・見直しの印・いまの問題・残りの時間・始めた日時・試験の形だけ（問題の文や解説は入れない）。
// 実行: cd shared && node --test tests/examresume.test.js
// 見ていないもの: 画面（入口のボタン・小窓・一言）と、本物の localStorage。画面は views/exam.js の文字を読んでいるだけで、動かしてはいない
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shuffleChoices, examRunSnapshot, examRunRestore, examRunSummary, EXAM_RUN_VERSION } from '../js/lib/quiz.js';
import { examRunKey, createExamRunStore } from '../js/lib/storage.js';
import { singleKey, subjectKey, openExamRunKey, openExamRunStore } from '../js/lib/subjects.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(shared, p), 'utf8');

/** テスト用の問題（作りもの）。 */
function makeQ(id, n = 4, extra = {}) {
  const choices = [];
  for (let i = 0; i < n; i++) choices.push('選択肢' + id + '-' + i);
  return { id, stem: '問題文' + id, choices, answer: 1, whyWrong: choices.map((_, i) => (i === 1 ? null : 'ちがう理由' + id + '-' + i)), explanation: '解説' + id, syllabus: [1, 1], qtype: 'term', ...extra };
}

/** 決まった順に数を返す乱数（テストのたびに同じ並びになる）。 */
function seq() {
  let i = 0;
  const xs = [0.83, 0.12, 0.47, 0.91, 0.05, 0.66, 0.29, 0.74, 0.38, 0.57];
  return () => xs[i++ % xs.length];
}

const PAST = { year: '令和0年度', period: '春期', exam: 'テスト試験', part: '科目A', no: 3, modified: false };

function fixture() {
  const questions = [
    makeQ('Q1'), makeQ('Q2'), makeQ('Q3', 5), makeQ('Q4'),
    makeQ('S1', 4, { format: 'scenario' }),
    makeQ('P1', 4, { pastExam: PAST }),
    makeQ('Q9'), // 試験に出ていない問題
  ];
  const rng = seq();
  const items = questions.slice(0, 6).map((q) => shuffleChoices(q, rng));
  const S = { items, answers: [2, null, 4, 0, null, 1], flags: [false, true, false, false, true, false], cur: 3 };
  const info = { leftMs: 5400123.4, startedAt: 1790000000000, count: 6, minutes: 120, reduced: true };
  return { questions, S, info };
}

/** 保存を1回 文字にして読み直す（localStorage を通ったのと同じ形にする）。 */
const roundTrip = (x) => JSON.parse(JSON.stringify(x));

test('examRunSnapshot: ID・並び・答え・印・いまの問題・残り・始めた日時・試験の形だけを取っておく（問題の文や解説は入れない）', () => {
  const { S, info } = fixture();
  const snap = examRunSnapshot(S, info);
  assert.deepEqual(Object.keys(snap).sort(), ['answers', 'count', 'cur', 'flags', 'ids', 'leftMs', 'minutes', 'perms', 'reduced', 'startedAt', 'v']);
  assert.equal(snap.v, EXAM_RUN_VERSION);
  assert.deepEqual(snap.ids, ['Q1', 'Q2', 'Q3', 'Q4', 'S1', 'P1']);
  assert.deepEqual(snap.perms, S.items.map((sq) => sq.perm));
  assert.deepEqual(snap.answers, [2, null, 4, 0, null, 1]);
  assert.deepEqual(snap.flags, [false, true, false, false, true, false]);
  assert.equal(snap.cur, 3);
  assert.equal(snap.leftMs, 5400123, '残りはミリ秒の整数');
  assert.equal(snap.startedAt, 1790000000000);
  assert.equal(snap.count, 6);
  assert.equal(snap.minutes, 120);
  assert.equal(snap.reduced, true);
  const text = JSON.stringify(snap);
  for (const word of ['問題文', '選択肢', '解説', 'ちがう理由']) assert.ok(!text.includes(word), '保存に「' + word + '」が入っている');
  // 残りがマイナス（時間切れの直前に裏へ回った）でも 0 で止める
  assert.equal(examRunSnapshot(S, { ...info, leftMs: -250 }).leftMs, 0);
  // 取っておいた並びは、解いている最中のものと別物（あとから書き換わらない）
  snap.perms[0][0] = 99;
  assert.notEqual(S.items[0].perm[0], 99);
});

test('examRunRestore: 文字にして読み直しても、答え・印・いまの問題・残り・試験の形・選択肢の並びがそのまま戻る', () => {
  const { questions, S, info } = fixture();
  const run = examRunRestore(roundTrip(examRunSnapshot(S, info)), questions);
  assert.ok(run);
  assert.deepEqual(run.answers, S.answers);
  assert.deepEqual(run.flags, S.flags);
  assert.equal(run.cur, 3);
  assert.equal(run.leftMs, 5400123);
  assert.equal(run.startedAt, 1790000000000);
  assert.deepEqual([run.count, run.minutes, run.reduced], [6, 120, true]);
  assert.equal(run.items.length, 6);
  run.items.forEach((sq, i) => {
    const was = S.items[i];
    assert.equal(sq.q, questions[i], '問題は、いまのデータのものを指す');
    assert.deepEqual(sq.perm, was.perm);
    assert.deepEqual(sq.choices, was.choices);
    assert.equal(sq.answer, was.answer);
    assert.deepEqual(sq.whyWrong, was.whyWrong);
  });
  // 並べ替えた問題が本当に入っている（全部が元の順のままなら、このテストは並びを見ていないことになる）
  assert.ok(S.items.some((sq) => sq.perm.some((x, j) => x !== j)));
  // 場面判断と過去問題は元の順のまま
  assert.deepEqual(run.items[4].perm, [0, 1, 2, 3]);
  assert.deepEqual(run.items[5].perm, [0, 1, 2, 3]);
});

test('examRunRestore: 保存が壊れているときは null（形がちがう・版がちがう・数が合わない・型がちがう）', () => {
  const { questions, S, info } = fixture();
  const good = () => roundTrip(examRunSnapshot(S, info));
  assert.ok(examRunRestore(good(), questions), '元の保存は戻せる');
  const bad = (name, change) => {
    const x = good();
    const y = change(x);
    assert.equal(examRunRestore(y === undefined ? x : y, questions), null, name);
  };
  bad('null', () => null);
  bad('文字', () => 'abc');
  bad('数', () => 3);
  bad('配列', () => []);
  bad('空のオブジェクト', () => ({}));
  bad('版が無い', (x) => { delete x.v; });
  bad('版がちがう', (x) => { x.v = EXAM_RUN_VERSION + 1; });
  bad('ids が配列でない', (x) => { x.ids = 'Q1'; });
  bad('perms が無い', (x) => { delete x.perms; });
  bad('answers が配列でない', (x) => { x.answers = {}; });
  bad('flags が無い', (x) => { delete x.flags; });
  bad('問題が0問', (x) => { x.ids = []; x.perms = []; x.answers = []; x.flags = []; x.count = 0; });
  bad('answers の数が合わない', (x) => { x.answers.pop(); });
  bad('flags の数が合わない', (x) => { x.flags.push(false); });
  bad('perms の数が合わない', (x) => { x.perms.pop(); });
  bad('count が問題の数と合わない', (x) => { x.count = 5; });
  bad('同じ問題が2回', (x) => { x.ids[1] = x.ids[0]; x.perms[1] = x.perms[0]; });
  bad('minutes が 0', (x) => { x.minutes = 0; });
  bad('minutes が文字', (x) => { x.minutes = '120'; });
  bad('leftMs が無い', (x) => { delete x.leftMs; });
  bad('leftMs がマイナス', (x) => { x.leftMs = -1; });
  bad('leftMs が試験の時間より長い', (x) => { x.leftMs = 120 * 60000 + 1; });
  bad('leftMs が文字', (x) => { x.leftMs = '1000'; });
  bad('startedAt が無い', (x) => { delete x.startedAt; });
  bad('cur がマイナス', (x) => { x.cur = -1; });
  bad('cur が問題の数以上', (x) => { x.cur = 6; });
  bad('cur が小数', (x) => { x.cur = 1.5; });
  bad('reduced が真偽でない', (x) => { x.reduced = 1; });
  bad('答えが選択肢の数以上', (x) => { x.answers[0] = 4; });
  bad('答えがマイナス', (x) => { x.answers[0] = -1; });
  bad('答えが文字', (x) => { x.answers[0] = '2'; });
  bad('答えが undefined（null でない）', (x) => { x.answers[1] = undefined; });
  bad('印が真偽でない', (x) => { x.flags[0] = 0; });
  bad('並びが配列でない', (x) => { x.perms[0] = null; });
  bad('並びに同じ番号が2回', (x) => { x.perms[0] = [0, 0, 1, 2]; });
  bad('並びに範囲の外の番号', (x) => { x.perms[0] = [0, 1, 2, 4]; });
  bad('並びに小数', (x) => { x.perms[0] = [0, 1, 2, 2.5]; });
  // ちょうどの境目は戻せる
  const edge = good();
  edge.leftMs = 120 * 60000;
  edge.cur = 5;
  assert.ok(examRunRestore(edge, questions));
  const zero = good();
  zero.leftMs = 0;
  zero.cur = 0;
  assert.ok(examRunRestore(zero, questions), '残り 0 は戻せる（始めるとすぐ時間切れの採点になる）');
});

test('examRunRestore: 保存の問題がいまのデータに無いときは null（1問でも無ければ全体をやめる）', () => {
  const { questions, S, info } = fixture();
  const snap = roundTrip(examRunSnapshot(S, info));
  assert.equal(examRunRestore(snap, questions.filter((q) => q.id !== 'Q3')), null, 'Q3 が消えた');
  assert.equal(examRunRestore(snap, questions.filter((q) => q.id !== 'P1')), null, '最後の問題が消えた');
  assert.equal(examRunRestore(snap, []), null);
  assert.equal(examRunRestore(snap, null), null);
  assert.equal(examRunRestore(snap, undefined), null);
  // 試験に出ていない問題が消えただけなら、続けられる
  assert.ok(examRunRestore(snap, questions.filter((q) => q.id !== 'Q9')));
  // 問題が増えただけでも、続けられる（始めたときの形のまま）
  assert.ok(examRunRestore(snap, questions.concat([makeQ('Q10')])));
});

test('examRunRestore: 選択肢の数がいまの問題と合わないときは null（増えた・減った）', () => {
  const { questions, S, info } = fixture();
  const snap = roundTrip(examRunSnapshot(S, info));
  const swap = (id, q) => questions.map((x) => (x.id === id ? q : x));
  assert.equal(examRunRestore(snap, swap('Q1', makeQ('Q1', 5))), null, '4つ → 5つ');
  assert.equal(examRunRestore(snap, swap('Q3', makeQ('Q3', 4))), null, '5つ → 4つ');
  assert.equal(examRunRestore(snap, swap('Q2', { ...makeQ('Q2'), choices: null })), null, '選択肢が無い');
  // 数が同じなら戻せる
  assert.ok(examRunRestore(snap, swap('Q1', makeQ('Q1', 4))));
});

test('examRunRestore: 並べ替えない決まりの問題（場面判断・過去問題）を並べ替えた保存は null', () => {
  const { questions, S, info } = fixture();
  const a = roundTrip(examRunSnapshot(S, info));
  a.perms[4] = [1, 0, 2, 3]; // 場面判断
  assert.equal(examRunRestore(a, questions), null);
  const b = roundTrip(examRunSnapshot(S, info));
  b.perms[5] = [3, 2, 1, 0]; // 過去問題
  assert.equal(examRunRestore(b, questions), null);
  // ふつうの問題が、あとから過去問題（出典つき）に変わったとき: 並べ替えた保存からは続けない
  const c = roundTrip(examRunSnapshot(S, info));
  const moved = S.items.findIndex((sq) => sq.perm.some((x, j) => x !== j));
  assert.ok(moved >= 0 && moved < 4);
  const qs = questions.map((q, i) => (i === moved ? { ...q, pastExam: PAST } : q));
  assert.equal(examRunRestore(c, qs), null);
});

test('examRunSummary: 入口の「続きから」に出す数（問題の数・答えた数・残りの分は切り上げで最小1）', () => {
  const { questions, S, info } = fixture();
  const run = examRunRestore(roundTrip(examRunSnapshot(S, info)), questions);
  assert.deepEqual(examRunSummary(run), { total: 6, answered: 4, minutesLeft: 91 }); // 5400123 ミリ秒 = 90分と少し → 約91分
  assert.equal(examRunSummary({ ...run, leftMs: 90 * 60000 }).minutesLeft, 90);
  assert.equal(examRunSummary({ ...run, leftMs: 90 * 60000 + 1 }).minutesLeft, 91);
  assert.equal(examRunSummary({ ...run, leftMs: 59999 }).minutesLeft, 1);
  assert.equal(examRunSummary({ ...run, leftMs: 0 }).minutesLeft, 1, '0分とは出さない');
  assert.equal(examRunSummary({ ...run, answers: run.answers.map(() => null) }).answered, 0);
  assert.equal(examRunSummary({ ...run, answers: run.answers.map(() => 0) }).answered, 6, '番号 0 の答えも「答えた」に数える');
});

test('examRunKey: 学習の記録とは別の鍵。アプリ・科目・サンプルごとに分かれる', () => {
  assert.equal(examRunKey('certquest:g-kentei:v1'), 'certquest:g-kentei:v1:examrun');
  const keys = [
    singleKey('g-kentei', false), singleKey('g-kentei', true), singleKey('dx', false),
    subjectKey('shindanshi', 'keizai', false), subjectKey('shindanshi', 'zaimu', false), subjectKey('shindanshi', 'keizai', true),
  ];
  const runKeys = keys.map(examRunKey);
  assert.equal(new Set(runKeys).size, keys.length, '途中の試験の鍵どうしが重なっている');
  for (const k of runKeys) assert.ok(!keys.includes(k), '学習の記録の鍵と重なっている: ' + k);
});

/** 偽の localStorage。 */
function fakeStore() {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

test('createExamRunStore: 書く・読む・消す。何も無いときは「壊れている」としない', () => {
  const { questions, S, info } = fixture();
  const st = fakeStore();
  const store = createExamRunStore('k:examrun', st);
  assert.deepEqual(store.load(), { run: null, broken: false });
  assert.equal(store.save(examRunSnapshot(S, info)), true);
  assert.deepEqual([...st.m.keys()], ['k:examrun'], '決めた鍵にだけ書く');
  const got = store.load();
  assert.equal(got.broken, false);
  assert.ok(examRunRestore(got.run, questions), '読み直したものから続きを始められる');
  store.clear();
  assert.equal(st.m.size, 0);
  assert.deepEqual(store.load(), { run: null, broken: false });
});

test('createExamRunStore: 読めない中身は broken（入口で消して、一言を出す）', () => {
  for (const raw of ['{"v":1,"ids":[', 'abc', '123', '"x"', 'null', '[1,2]', 'true']) {
    const st = fakeStore();
    st.m.set('k', raw);
    assert.deepEqual(createExamRunStore('k', st).load(), { run: null, broken: true }, raw);
  }
  const st = fakeStore();
  st.m.set('k', '');
  assert.deepEqual(createExamRunStore('k', st).load(), { run: null, broken: false }, '空の文字は、何も無いのと同じ');
});

test('createExamRunStore: 読めない・書けない・消せない端末でも落ちない（保存できなくても試験は止めない）', () => {
  const boom = () => { throw new Error('使えない'); };
  const store = createExamRunStore('k', { getItem: boom, setItem: boom, removeItem: boom });
  assert.deepEqual(store.load(), { run: null, broken: false });
  assert.equal(store.save({ v: 1 }), false);
  assert.doesNotThrow(() => store.clear());
  const none = createExamRunStore('k', null); // 置き場そのものが無い
  assert.deepEqual(none.load(), { run: null, broken: false });
  assert.equal(none.save({ v: 1 }), false);
  assert.doesNotThrow(() => none.clear());
});

test('結線（views/exam.js）: 入口に「続きから」と「消して、新しく始める」。始められないときは消して一言', () => {
  const s = src('js/views/exam.js');
  assert.ok(s.includes('const runStore = openExamRunStore(app);'), '鍵は lib/subjects.js の openExamRunStore から取る');
  assert.ok(!s.includes('examRunKey(') && !s.includes('subjectKey(') && !s.includes('singleKey('), '鍵の式を views/exam.js にも書いている（lib/subjects.js の1か所だけにする）');
  assert.ok(s.includes('examRunRestore(got.run, app.data.questions)'));
  assert.ok(s.includes("'続きから', h('span', { class: 'exam-resume-sub', text: '（' + sum.total + '問中 ' + sum.answered + '問 回答ずみ・残り 約' + sum.minutesLeft + '分）' })"), 'ボタンの文は「続きから（N問中 M問 回答ずみ・残り 約X分）」');
  assert.ok(s.includes("'消して、新しく始める'"));
  assert.ok(s.includes("title: '消して、新しく始めますか？'"), '消す前に小窓で確かめる');
  assert.ok(s.includes("text: '問題が新しくなったため、前回の続きからは始められません。'"));
  // 始められない保存は消して、一言は1回だけ
  const load = s.slice(s.indexOf('const loadRun = () => {'), s.indexOf('app.guardBack('));
  assert.ok(load.includes('runStore.clear();') && load.includes('lostNote = true;'));
  const intro = s.slice(s.indexOf('const resume = loadRun();'), s.indexOf("'試験を始める'"));
  assert.ok(intro.includes('lostNote = false;'), '一言を出したら、次は出さない');
  assert.ok(intro.indexOf('if (lostNote)') < intro.indexOf('lostNote = false;'));
});

test('結線（views/exam.js）: 描き直すたびと裏に回るときに取っておく。採点したとき・「戻る」でやめたときに消す', () => {
  const s = src('js/views/exam.js');
  assert.ok(s.includes('clear(root);\n      saveRun(true);'), '描き直し（答えた・印・別の問題へ）のたびに保存');
  assert.ok(s.includes("document.addEventListener('visibilitychange', onHidden);"));
  assert.ok(s.includes("window.addEventListener('pagehide', onPageHide);"));
  const save = s.slice(s.indexOf('const saveRun = (byUser) => {'), s.indexOf('const onHidden = () => {'));
  assert.ok(save.includes('if (S.done) return;'), '採点したあとは保存しない');
  assert.ok(save.includes('try {') && save.includes('} catch (e) {'), '保存に失敗しても試験を止めない');
  assert.ok(save.includes('leftMs: S.deadline - visibleNow()'), '残りは、止まる時計から');
  // 採点
  const fin = s.slice(s.indexOf('async function finish(auto) {'), s.indexOf('result(results, ok, majors, auto);'));
  assert.ok(fin.includes('S.done = true;\n      cleanup();\n      runStore.clear();'), '採点したら消す');
  // 「戻る」でやめた
  const guard = s.slice(s.indexOf('app.guardBack(async () => {'), s.indexOf('function intro()'));
  assert.ok(guard.includes("confirmQuit('ここまでの答えは採点されず、記録にも残りません。')"));
  assert.ok(guard.includes('running.quit = true;') && guard.includes('runStore.clear();'));
  assert.ok(guard.indexOf('if (leave &&') < guard.indexOf('runStore.clear();'), '「やめる」を選んだときだけ消す');
});

test('結線（views/exam.js）: 「模擬試験で見た時刻」と結果の記録は、採点のときに1回だけ（続きから・途中でやめる では書かない）', () => {
  const s = src('js/views/exam.js');
  const count = (w) => s.split(w).length - 1;
  assert.equal(count('recordExamSeen(app.state'), 1);
  assert.equal(count('recordExam(app.state'), 1);
  const fin = s.slice(s.indexOf('async function finish(auto) {'), s.indexOf('result(results, ok, majors, auto);'));
  assert.ok(fin.includes('recordExamSeen(app.state') && fin.includes('recordExam(app.state'), '書くのは採点（finish）の中');
  assert.ok(fin.indexOf('if (S.done) return;') < fin.indexOf('recordExamSeen(app.state'));
});

// ---- 「学習記録を消す」で、途中の模擬試験も消す（2026-11-10 の決定）----
// 鍵の式は lib/subjects.js の openExamRunKey の1か所だけ。模擬試験の画面と app.js の resetAll の両方がそこを呼ぶ。
// 見ていないもの: app.js は丸ごとは動かしていない（画面と本物の localStorage が要るため）。
//   resetAll の中身だけを app.js の文字から切り出して、偽のアプリ・偽の localStorage で動かしている。
//   設定の画面の「消す」ボタンから resetAll までのつながり（views/more.js）と、本物のブラウザでの動きは見ていない。

/** 偽の app（鍵を作るのに要るものだけ）。 */
const keyApp = (id, subjectId, sample) => ({ baseConfig: { id }, config: { id }, subject: subjectId ? { id: subjectId } : null, sample: !!sample });

test('openExamRunKey: 科目なし・科目あり・サンプルのそれぞれで、学習の記録の鍵の後ろに :examrun を付けた鍵', () => {
  assert.equal(openExamRunKey(keyApp('g-kentei', null, false)), 'certquest:g-kentei:v1:examrun');
  assert.equal(openExamRunKey(keyApp('g-kentei', null, true)), 'certquest:g-kentei:sample:v1:examrun');
  assert.equal(openExamRunKey(keyApp('shindanshi', 'keizai', false)), 'certquest:shindanshi:keizai:v1:examrun');
  assert.equal(openExamRunKey(keyApp('shindanshi', 'keizai', true)), 'certquest:shindanshi:sample:keizai:v1:examrun');
  // 学習の記録の鍵（singleKey / subjectKey）とそろっている
  assert.equal(openExamRunKey(keyApp('dx', null, false)), examRunKey(singleKey('dx', false)));
  assert.equal(openExamRunKey(keyApp('shindanshi', 'zaimu', false)), examRunKey(subjectKey('shindanshi', 'zaimu', false)));
  assert.notEqual(openExamRunKey(keyApp('shindanshi', 'keizai', false)), openExamRunKey(keyApp('shindanshi', 'zaimu', false)), '科目ごとに別の鍵');
  // 科目を開くと config は科目の分を重ねたものに替わる。アプリの id はアプリ全体の config（baseConfig）から取る
  assert.equal(openExamRunKey({ baseConfig: { id: 'shindanshi' }, config: { id: 'ほかの名前' }, subject: { id: 'keizai' }, sample: false }), 'certquest:shindanshi:keizai:v1:examrun');
  // baseConfig が無いときは config の id。id が無いときは 'app'
  assert.equal(openExamRunKey({ config: { id: 'dx' }, subject: null, sample: false }), 'certquest:dx:v1:examrun');
  assert.equal(openExamRunKey({ baseConfig: {}, config: {}, subject: null, sample: false }), 'certquest:app:v1:examrun');
  assert.equal(openExamRunKey({ baseConfig: {}, config: {}, subject: { id: 'keizai' }, sample: false }), 'certquest:app:keizai:v1:examrun');
});

test('openExamRunStore: 模擬試験の画面が書いた途中の試験を、同じ鍵で読める・消せる（科目なし・科目あり・サンプル）', () => {
  for (const a of [keyApp('g-kentei', null, false), keyApp('g-kentei', null, true), keyApp('shindanshi', 'keizai', false), keyApp('shindanshi', 'keizai', true)]) {
    const fake = fakeStore();
    assert.equal(openExamRunStore(a, fake).save({ v: 1, ids: ['q1'] }), true);
    assert.deepEqual([...fake.m.keys()], [openExamRunKey(a)], '書いた先が openExamRunKey の鍵');
    assert.deepEqual(openExamRunStore(a, fake).load(), { run: { v: 1, ids: ['q1'] }, broken: false });
    openExamRunStore(a, fake).clear();
    assert.equal(fake.m.size, 0);
  }
});

/** app.js の resetAll の中身を切り出して、動かせる形にする（app.js を丸ごとは読み込めないため）。 */
function resetAllFromSource() {
  const s = src('js/app.js');
  const head = '    resetAll() {\n';
  const from = s.indexOf(head);
  assert.ok(from >= 0, 'app.js に resetAll が見つからない');
  const to = s.indexOf('\n    },\n', from);
  assert.ok(to > from, 'resetAll の終わりが見つからない');
  const body = s.slice(from + head.length, to);
  // resetAll が外から使っている名前。増えたらここに足す（足りないと ReferenceError で落ちて気づく）
  return new Function('app', 'openExamRunStore', 'defaultState', 'levelFromXp', 'syncBgm', 'toast', body);
}

/** 偽のアプリ。記録は偽の localStorage に置く。calls … 呼ばれたものの順。 */
function fakeResetApp({ id, subjectId, fake }) {
  const calls = [];
  const studyKey = subjectId ? subjectKey(id, subjectId, false) : singleKey(id, false);
  const app = {
    baseConfig: { id }, config: { id }, subject: subjectId ? { id: subjectId } : null, sample: false,
    storage: { clear: () => { calls.push('storage.clear'); fake.removeItem(studyKey); }, load: () => ({ xp: 120 }) },
    state: { xp: 120 }, pending: ['x'], session: {}, lastLevel: 9,
    applyScheme: () => calls.push('applyScheme'), applyTextSize: () => calls.push('applyTextSize'),
    go: (hash) => calls.push('go ' + hash),
  };
  return { app, calls, studyKey };
}
const resetDeps = (calls) => [() => ({ xp: 0 }), () => ({ level: 3 }), () => calls.push('syncBgm'), (text) => calls.push('toast ' + text)];

test('学習記録を消すと、途中の模擬試験も消える（app.js の resetAll。科目の無いアプリ）', () => {
  const fake = fakeStore();
  const { app, calls, studyKey } = fakeResetApp({ id: 'g-kentei', fake });
  fake.setItem(studyKey, '{"xp":120}');
  fake.setItem(examRunKey(studyKey), '{"v":1}');
  fake.setItem(examRunKey(singleKey('dx', false)), '{"v":1}'); // ほかのアプリの途中の試験
  resetAllFromSource()(app, (a) => openExamRunStore(a, fake), ...resetDeps(calls));
  assert.equal(fake.getItem(studyKey), null, '学習の記録が残っている');
  assert.equal(fake.getItem(examRunKey(studyKey)), null, '途中の模擬試験が残っている');
  assert.equal(fake.getItem(examRunKey(singleKey('dx', false))), '{"v":1}', 'ほかのアプリの途中の試験まで消している');
  assert.deepEqual(app.state, { xp: 0 });
  assert.equal(calls[calls.length - 1], 'go #/home');
});

test('科目のあるアプリでは、いまの科目の途中の模擬試験だけ消える。別の科目の途中の模擬試験は残る', () => {
  const fake = fakeStore();
  const { app, calls, studyKey } = fakeResetApp({ id: 'shindanshi', subjectId: 'keizai', fake });
  const other = subjectKey('shindanshi', 'zaimu', false);
  fake.setItem(studyKey, '{"cards":{}}');
  fake.setItem(examRunKey(studyKey), '{"v":1,"ids":["k1"]}');
  fake.setItem(other, '{"cards":{}}');
  fake.setItem(examRunKey(other), '{"v":1,"ids":["z1"]}');
  resetAllFromSource()(app, (a) => openExamRunStore(a, fake), ...resetDeps(calls));
  assert.equal(fake.getItem(examRunKey(studyKey)), null, 'いまの科目の途中の模擬試験が残っている');
  assert.equal(fake.getItem(examRunKey(other)), '{"v":1,"ids":["z1"]}', '別の科目の途中の模擬試験まで消している');
  assert.equal(fake.getItem(other), '{"cards":{}}', '別の科目の学習の記録まで消している');
  assert.equal(fake.getItem(studyKey), null);
  assert.equal(calls[calls.length - 1], 'go #/home');
});

test('途中の模擬試験を消すのに失敗しても、学習記録を消す流れは止まらない', () => {
  const fake = fakeStore();
  const { app, calls, studyKey } = fakeResetApp({ id: 'g-kentei', fake });
  fake.setItem(studyKey, '{"xp":120}');
  const boom = () => { throw new Error('消せない'); };
  assert.doesNotThrow(() => resetAllFromSource()(app, boom, ...resetDeps(calls)));
  assert.equal(fake.getItem(studyKey), null, '学習の記録が消えていない');
  assert.deepEqual(app.state, { xp: 0 });
  assert.deepEqual(app.pending, []);
  assert.equal(app.session, null);
  assert.deepEqual(calls, ['storage.clear', 'applyScheme', 'applyTextSize', 'syncBgm', 'toast 学習記録を消しました', 'go #/home']);
});

test('結線（app.js）: resetAll は lib/subjects.js の openExamRunStore(app) を呼ぶ（鍵の式を app.js に書かない）', () => {
  const s = src('js/app.js');
  assert.ok(/import \{[^}]*\bopenExamRunStore\b[^}]*\} from '\.\/lib\/subjects\.js';/.test(s), 'openExamRunStore を lib/subjects.js から読み込んでいない');
  const body = s.slice(s.indexOf('    resetAll() {\n'), s.indexOf('\n    },\n', s.indexOf('    resetAll() {\n')));
  assert.ok(body.includes('openExamRunStore(app).clear();'));
  assert.ok(body.indexOf('app.storage.clear();') < body.indexOf('openExamRunStore(app).clear();'), '学習の記録を先に消す');
  assert.ok(!s.includes('examRunKey(') && !s.includes(':examrun'), '鍵の式を app.js にも書いている（lib/subjects.js の1か所だけにする）');
  const subj = src('js/lib/subjects.js');
  assert.equal(subj.split('examRunKey(').length - 1, 1, '鍵を作る所は lib/subjects.js の中でも1か所');
});

test('登録: テストが package.json の一覧に入っている', () => {
  assert.ok(src('package.json').includes('tests/examresume.test.js'), 'tests/examresume.test.js が package.json の一覧に無い');
});
