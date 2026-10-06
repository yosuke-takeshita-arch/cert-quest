// ブラウザ無しで node から叩く。実行: cd shared && node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAnswer, newRecord, isDue, dueIds, upcoming, dayNumber, dateKey, INTERVALS } from '../js/lib/srs.js';
import { answerXp, levelFromXp, totalXpForLevel, updateStreak, currentStreak, daysUntil, starsFor, masteryLevel } from '../js/lib/scoring.js';
import { shuffle, shuffleChoices, pickQuestions, examPlan, byMajor, secondsPerQuestion, challengeName } from '../js/lib/quiz.js';
import { badgeDefs } from '../js/lib/badges.js';
import { loadData, resolveRef, buildConceptIndex } from '../js/lib/data.js';
import { defaultState, recordAnswer, recordStageResult } from '../js/lib/progress.js';
import { createStorage } from '../js/lib/storage.js';

// 固定の乱数（再現できるように）
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test('復習間隔: 誤答→翌日→3日→7日→14日→卒業', () => {
  assert.deepEqual(INTERVALS, [1, 3, 7, 14]);
  let r = applyAnswer(newRecord(), false, 100);
  assert.equal(r.step, 0);
  assert.equal(r.due, 101);
  r = applyAnswer(r, true, 101);
  assert.equal(r.due, 104);
  r = applyAnswer(r, true, 104);
  assert.equal(r.due, 111);
  r = applyAnswer(r, true, 111);
  assert.equal(r.due, 125);
  r = applyAnswer(r, true, 125);
  assert.equal(r.step, -1);
  assert.equal(r.due, null);
  assert.equal(isDue(r, 999), false);
});

test('復習間隔: 復習中に誤答すると最初に戻る／期日前の正解では進めない', () => {
  let r = applyAnswer(newRecord(), false, 100);
  r = applyAnswer(r, true, 101);
  r = applyAnswer(r, true, 104); // step2, due 111
  const early = applyAnswer(r, true, 105); // 期日前
  assert.equal(early.step, r.step);
  assert.equal(early.due, r.due);
  const back = applyAnswer(r, false, 105);
  assert.equal(back.step, 0);
  assert.equal(back.due, 106);
});

test('復習間隔: 最初から正解の問題は復習に入らない／dueIdsは期日順', () => {
  const ok = applyAnswer(undefined, true, 100);
  assert.equal(ok.step, -1);
  assert.equal(ok.due, null);
  const qs = { a: { ...newRecord(), step: 0, due: 105 }, b: { ...newRecord(), step: 1, due: 103 }, c: { ...newRecord(), step: 0, due: 200 } };
  assert.deepEqual(dueIds(qs, 110), ['b', 'a']);
});

test('日付: dayNumber は日付の差を正しく数える（月末・うるう年）', () => {
  assert.equal(dayNumber(new Date(2028, 2, 1)) - dayNumber(new Date(2028, 1, 28)), 2); // 2028はうるう年
  assert.equal(dayNumber(new Date(2026, 11, 1)) - dayNumber(new Date(2026, 10, 30)), 1);
  assert.equal(dateKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('XP: 基本・初見・連続・時間', () => {
  assert.equal(answerXp({ correct: false, firstTry: true, streak: 5, seconds: 1 }).total, 0);
  assert.equal(answerXp({ correct: true }).total, 10);
  assert.equal(answerXp({ correct: true, firstTry: true }).total, 15);
  assert.equal(answerXp({ correct: true, streak: 1 }).total, 10);
  assert.equal(answerXp({ correct: true, streak: 2 }).total, 12);
  assert.equal(answerXp({ correct: true, streak: 99 }).total, 20); // 連続ボーナスは最大+10
  assert.equal(answerXp({ correct: true, seconds: 40 }).total, 13); // 40秒ちょうどは時間内
  assert.equal(answerXp({ correct: true, seconds: 40.1 }).total, 10);
  assert.equal(answerXp({ correct: true, firstTry: true, streak: 3, seconds: 5, exam: true }).total, 5);
});

test('レベル: 境界', () => {
  assert.equal(levelFromXp(0).level, 1);
  assert.equal(levelFromXp(49).level, 1);
  assert.equal(levelFromXp(50).level, 2);
  assert.equal(levelFromXp(149).level, 2);
  assert.equal(levelFromXp(150).level, 3);
  assert.equal(totalXpForLevel(10), 2250);
  const l = levelFromXp(100);
  assert.equal(l.into, 50);
  assert.equal(l.need, 100);
  assert.equal(l.progress, 0.5);
  assert.equal(levelFromXp(-5).level, 1);
});

test('連続日数: 同日は増えない／翌日は+1／空くと1に戻る／月またぎ', () => {
  let s = updateStreak(null, '2026-10-31');
  assert.equal(s.count, 1);
  s = updateStreak(s, '2026-10-31');
  assert.equal(s.count, 1);
  s = updateStreak(s, '2026-11-01');
  assert.equal(s.count, 2);
  s = updateStreak(s, '2026-11-03');
  assert.equal(s.count, 1);
  assert.equal(s.best, 2);
  assert.equal(currentStreak(s, '2026-11-03'), 1);
  assert.equal(currentStreak(s, '2026-11-04'), 1);
  assert.equal(currentStreak(s, '2026-11-05'), 0);
});

test('受験日までの日数・星・習熟度', () => {
  assert.equal(daysUntil('2026-11-06', new Date(2026, 9, 2, 23, 0)), 35);
  assert.equal(daysUntil('2026-11-06', new Date(2026, 10, 6, 0, 1)), 0);
  assert.equal(daysUntil('2026-11-06', new Date(2026, 10, 7)), -1);
  assert.equal(starsFor(0.59), 0);
  assert.equal(starsFor(0.6), 1);
  assert.equal(starsFor(0.8), 2);
  assert.equal(starsFor(0.9), 3);
  assert.equal(masteryLevel({ total: 0, answered: 0, lastOk: 0 }), 'empty');
  assert.equal(masteryLevel({ total: 5, answered: 0, lastOk: 0 }), 'none');
  assert.equal(masteryLevel({ total: 5, answered: 5, lastOk: 1 }), 'weak');
  assert.equal(masteryLevel({ total: 5, answered: 5, lastOk: 2 }), 'mid');
  assert.equal(masteryLevel({ total: 5, answered: 5, lastOk: 4 }), 'strong');
});

test('選択肢シャッフル: answer と whyWrong の対応を崩さない（200通りの乱数で）', () => {
  const q = {
    id: 'X', choices: ['A', 'B', 'C', 'D'], answer: 1,
    whyWrong: ['Aは違う', null, 'Cは違う', 'Dは違う'],
  };
  let moved = false;
  for (let seed = 1; seed <= 200; seed++) {
    const s = shuffleChoices(q, seeded(seed));
    assert.equal(s.choices[s.answer], 'B');
    assert.equal(s.whyWrong[s.answer], null);
    s.choices.forEach((c, i) => {
      if (i !== s.answer) assert.equal(s.whyWrong[i], c + 'は違う');
    });
    assert.deepEqual([...s.choices].sort(), ['A', 'B', 'C', 'D']);
    if (s.answer !== 1) moved = true;
  }
  assert.ok(moved, '位置が全く動かないのはシャッフルになっていない');
  assert.deepEqual(q.choices, ['A', 'B', 'C', 'D']); // 元は変えない
});

test('出題: 未回答→前回誤答→前回正解の順で n 件まで', () => {
  const pool = ['u1', 'u2', 'w1', 'r1', 'r2'].map((id) => ({ id }));
  const stats = { w1: { seen: 1, lastOk: false }, r1: { seen: 2, lastOk: true }, r2: { seen: 1, lastOk: true } };
  const picked = pickQuestions(pool, stats, 3, seeded(7)).map((q) => q.id).sort();
  assert.deepEqual(picked, ['u1', 'u2', 'w1']);
  assert.equal(pickQuestions(pool, stats, 99, seeded(7)).length, 5);
  assert.equal(shuffle([1, 2, 3, 4, 5], seeded(3)).length, 5);
});

test('模試の縮小版と大項目別集計', () => {
  const full = examPlan({ questions: 145, minutes: 100 }, 500);
  assert.deepEqual([full.count, full.minutes, full.reduced], [145, 100, false]);
  const small = examPlan({ questions: 145, minutes: 100 }, 29);
  assert.deepEqual([small.count, small.minutes, small.reduced], [29, 20, true]);
  const r = byMajor([{ major: 'A', correct: true }, { major: 'A', correct: false }, { major: 'B', correct: true }]);
  assert.equal(r.find((x) => x.major === 'A').rate, 0.5);
  assert.equal(r.find((x) => x.major === 'B').total, 1);
});

test('進捗: 初見の連続正解でXPが積み上がり、誤答は復習に入る', () => {
  const st = defaultState();
  const now = new Date(2026, 9, 2, 10, 0);
  const q1 = { id: 'q1' }, q2 = { id: 'q2' };
  const a = recordAnswer(st, q1, { correct: true, sessionStreak: 1, seconds: 10, now });
  assert.equal(a.xp, 10 + 5 + 3);
  const b = recordAnswer(st, q2, { correct: false, sessionStreak: 0, seconds: 10, now });
  assert.equal(b.xp, 0);
  assert.equal(st.qstats.q2.step, 0);
  assert.equal(st.totals.answered, 2);
  assert.equal(st.daily['2026-10-02'].answered, 2);
  assert.equal(st.streak.count, 1);
  const s = recordStageResult(st, 'k', 9, 10);
  assert.equal(s.stars, 3);
  assert.equal(recordStageResult(st, 'k', 1, 10).stars, 0);
  assert.equal(st.stages.k.stars, 3); // ベスト星は下がらない
});

test('保存: localStorage が使えなくても落ちない', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('x'); } };
  const s = createStorage('k', broken);
  const st = s.load();
  assert.equal(st.xp, 0);
  st.xp = 77;
  assert.equal(s.save(st), false);
  assert.equal(s.load().xp, 77); // メモリには残る
  assert.equal(s.persistent, false);
  const none = createStorage('k', null);
  assert.equal(none.load().xp, 0);
  // 正常系
  const mem = new Map();
  const ok = createStorage('k', { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) });
  const s2 = ok.load();
  s2.xp = 5;
  ok.save(s2);
  assert.equal(ok.load().xp, 5);
  mem.set('k', '{壊れたJSON');
  assert.equal(ok.load().xp, 5); // 壊れていたら、この起動中にメモリへ持っている分に戻る
  const fresh = createStorage('k', { getItem: () => '{壊れたJSON', setItem() {}, removeItem() {} });
  assert.equal(fresh.load().xp, 0); // 何も持っていなければ初期状態
});

// ---- データ読み込み ----
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

test('データ: 404のファイルは飛ばす／形が不正な問題は捨てる／syllabus.json無しでも木ができる', async () => {
  const files = {
    'index.json': { syllabus: 'syllabus.json', questions: ['questions/a.json', 'questions/gone.json'], concepts: ['concepts/gone.json', 'concepts/a.json'] },
    'questions/a.json': [Q('Q1', ['大', '中', '小']), Q('Q1', ['大', '中', '小']), Q('BAD', ['大'], { answer: 9 }), Q('Q2', ['大'])],
    'concepts/a.json': [C('C1', '勾配消失'), { id: 'noTitle' }],
  };
  const d = await loadData({ dataBase: 'http://x/data/', fetchFn: fakeFetch(files) });
  assert.equal(d.indexFound, true);
  assert.equal(d.questions.length, 2);
  assert.equal(d.concepts.length, 1);
  assert.ok(d.missing.includes('questions/gone.json'));
  assert.ok(d.missing.includes('syllabus.json'));
  assert.equal(d.problems.length, 3); // 重複・不正answer・タイトル無しカード
  assert.equal(d.tree.roots.length, 1);
  assert.deepEqual(d.tree.stages.map((s) => s.name).sort(), ['中', '全般']); // 中項目が無い問題は「全般」
  assert.equal(d.tree.stages.find((s) => s.name === '中').children[0].name, '小');
});

test('データ: index.json 自体が無くても落ちず空で返す', async () => {
  const d = await loadData({ dataBase: 'http://x/data/', fetchFn: fakeFetch({}) });
  assert.equal(d.indexFound, false);
  assert.equal(d.questions.length, 0);
  assert.equal(d.tree.stages.length, 0);
});

test('データ: syllabus.json の形（title/children の配列）から木を作り、問題を紐づける', async () => {
  const files = {
    'index.json': { syllabus: 'syllabus.json', questions: ['q.json'], concepts: [] },
    'syllabus.json': [{ id: 'T', title: '技術', children: [{ id: 'T-1', title: '章1', children: [{ id: 'T-01', title: '項目1', children: [], keywords: ['k'] }] }] }],
    'q.json': { questions: [Q('Q1', ['技術', '章1', '項目1'])] },
  };
  const d = await loadData({ dataBase: 'http://x/data/', fetchFn: fakeFetch(files) });
  const stage = d.tree.stages[0];
  assert.equal(stage.name, '章1');
  assert.equal(stage.questions.length, 1);
  assert.equal(d.tree.roots[0].questions.length, 1);
  assert.equal(stage.children[0].keywords[0], 'k');
});

test('用語カードの参照: id で解決／id が無く title だけでも解決／解決できなければ文字だけ', () => {
  const idx = buildConceptIndex([C('C-A', 'ReLU'), C('C-B', 'シグモイド関数')]);
  assert.equal(resolveRef({ id: 'C-A', relation: 'solves' }, idx).concept.title, 'ReLU');
  const t = resolveRef({ title: 'シグモイド関数', relation: 'cause' }, idx);
  assert.equal(t.concept.id, 'C-B');
  assert.equal(t.relation, 'cause');
  assert.equal(resolveRef({ title: 'ｒｅｌｕ' }, idx).concept.id, 'C-A'); // 全角・大文字小文字の違いを吸収
  const none = resolveRef({ title: '未作成の用語', point: 'p' }, idx);
  assert.equal(none.concept, null);
  assert.equal(none.label, '未作成の用語');
  assert.equal(none.point, 'p');
  assert.equal(resolveRef({ id: 'C-ZZZ' }, idx).concept, null);
  assert.equal(resolveRef('C-B', idx).concept.title, 'シグモイド関数');
});

test('場面判断（scenario）は選択肢を並べ替えない／ほかの形式は並べ替える', () => {
  const base = { id: 'S', choices: ['A社では…', 'B社では…', 'C社では…', 'D社では…'], answer: 2, whyWrong: ['a', 'b', null, 'd'] };
  const sc = { ...base, format: 'scenario' };
  for (let seed = 1; seed <= 200; seed++) {
    const s = shuffleChoices(sc, seeded(seed));
    assert.deepEqual(s.choices, sc.choices);
    assert.equal(s.answer, 2);
    assert.deepEqual(s.whyWrong, sc.whyWrong);
    assert.deepEqual(s.perm, [0, 1, 2, 3]);
  }
  let moved = false;
  for (let seed = 1; seed <= 50; seed++) {
    const s = shuffleChoices({ ...base, format: 'single' }, seeded(seed));
    if (s.choices.join() !== base.choices.join()) moved = true;
  }
  assert.ok(moved, 'single は今まで通り並べ替わる');
});

test('秒数の表示は config から作る（キー無し・不正値は40秒）', () => {
  assert.equal(secondsPerQuestion({ secondsPerQuestion: 37 }), 37);
  assert.equal(challengeName({ secondsPerQuestion: 37 }), '37秒チャレンジ');
  assert.equal(challengeName({ secondsPerQuestion: 40 }), '40秒チャレンジ');
  assert.equal(challengeName({}), '40秒チャレンジ');
  assert.equal(secondsPerQuestion({ secondsPerQuestion: 0 }), 40);
  const b = badgeDefs({ roots: [] }, { secondsPerQuestion: 37 }).find((d) => d.id === 'challenge-8');
  assert.equal(b.name, '37秒の達人');
  assert.equal(b.desc, '37秒チャレンジで8問以上正解');
});

test('復習の予定: validIds を渡すと、データに無い問題（外した問題）の記録は数えない。記録そのものは変えない', () => {
  const qstats = {
    a: { seen: 1, correct: 0, lastOk: false, step: 0, due: 10 },
    gone: { seen: 1, correct: 0, lastOk: false, step: 0, due: 9 },
    b: { seen: 1, correct: 0, lastOk: false, step: 0, due: 11 },
    c: { seen: 1, correct: 0, lastOk: false, step: 1, due: 20 },
    done: { seen: 3, correct: 3, lastOk: true, step: -1, due: null },
  };
  assert.deepEqual(upcoming(qstats, 10), { now: 2, tomorrow: 1, later: 1 });
  assert.deepEqual(upcoming(qstats, 10, new Map([['a', 1], ['b', 1], ['c', 1]])), { now: 1, tomorrow: 1, later: 1 });
  assert.deepEqual(upcoming(qstats, 10, new Set()), { now: 0, tomorrow: 0, later: 0 });
  assert.equal(Object.keys(qstats).length, 5);
});
