// 真ボスの計算（lib/trueboss.js。要件定義書 §3-9）の検証。ブラウザ無しで node から叩く。
// 実行: cd shared && node --test tests/trueboss.test.js
// ここで確かめるのは、出る条件・出題の組み立て（6:4・難しさ・重複なし・足りないときの埋め方）・体力・回復・技・HP の回復・負けたら第1形態から。
// 画面の見た目・押したときの動きは trueboss-wiring.test.js（結線）と、実機のスクリーンショットで確かめる。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  trueBossEnabled, trueBossUnlocked, normalizeTrueBoss, trueBossWins, recordTrueBossWin,
  difficultyOf, buildTrueBossPlan, rollFormHp, newTrueBattle, restartAfterLose, answerTrueBattle, rollSkill,
  timeLimitFor, isTimedOut, newTrueRun, currentTrueQuestion, answerTrueRun, rollRunSkill,
  TRUE_FORMS, TRUE_HP_MIN, TRUE_HP_MAX, TRUE_HEAL_GAP_MIN, TRUE_HEAL_GAP_MAX, CURSE_SHARE, rollHealGap, TRUE_QUEUE_PER_FORM, TRUE_DIFFICULTY, SKILL_TURNS, SKILL_SECONDS,
  SKILL_CURSE_DAMAGE, SKILL_CHANCE, STREAK_HEAL,
} from '../js/lib/trueboss.js';
import { bossMood, PLAYER_HP } from '../js/lib/boss.js';
import { defaultState, mergeState } from '../js/lib/progress.js';
import { badgeDefs, awardBadges, badgeTier, badgeView, SECRET_BADGE_IDS, SECRET_BADGE_TEXT } from '../js/lib/badges.js';
import { nextGoals } from '../js/lib/goals.js';

// 乱数を固定する（同じ種なら同じ並び）
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seq = (...vals) => { let i = 0; return () => (i < vals.length ? vals[i++] : vals[vals.length - 1]); };
const counted = (fn) => { const f = () => { f.calls++; return fn(); }; f.calls = 0; return f; };

const miss = (rate, seen = 10) => ({ seen, correct: Math.round(rate * seen), lastOk: false, step: 0, due: 1 });
const okRec = { seen: 3, correct: 3, lastOk: true, step: -1, due: null };
const mkq = (id, d) => ({ id, difficulty: d, syllabus: ['大', '中', '小'] });
// 難しさごとの問題の束（id は d<難しさ>-<番号>）
function bank(counts) {
  const out = [];
  for (const [d, n] of Object.entries(counts)) for (let i = 0; i < n; i++) out.push(mkq('d' + d + '-' + i, Number(d)));
  return out;
}
const ids = (list) => list.map((q) => q.id);
const dOf = (q) => q.difficulty;

// ---------------------------------------------------------------- 切り替え・出る条件

test('trueBossEnabled: config の trueBoss が true のときだけ（DX ほかは出さない）', () => {
  assert.equal(trueBossEnabled({ trueBoss: true }), true);
  assert.equal(trueBossEnabled({}), false);
  assert.equal(trueBossEnabled({ trueBoss: 'true' }), false);
  assert.equal(trueBossEnabled({ trueBoss: 1 }), false);
  assert.equal(trueBossEnabled(null), false);
  assert.equal(trueBossEnabled(undefined), false);
});

test('出る条件: 問題のある全部の章のボスを1回以上倒したとき。1章でも足りなければ出ない', () => {
  const st = (key, n) => ({ key, questions: Array.from({ length: n }, (_, i) => ({ id: key + i })) });
  const stages = [st('T|A', 5), st('T|B', 5), st('T|C', 0)]; // C は問題が無いので数えない
  assert.equal(trueBossUnlocked({ boss: {} }, stages), false);
  assert.equal(trueBossUnlocked({ boss: { 'T|A': 1 } }, stages), false); // 1章足りない
  assert.equal(trueBossUnlocked({ boss: { 'T|B': 3 } }, stages), false);
  assert.equal(trueBossUnlocked({ boss: { 'T|A': 1, 'T|B': 1 } }, stages), true); // C が無くても出る
  assert.equal(trueBossUnlocked({ boss: { 'T|A': 2, 'T|B': 7, 'T|C': 1 } }, stages), true);
  assert.equal(trueBossUnlocked({ boss: { 'T|A': 0, 'T|B': 1 } }, stages), false); // 0 回は倒していない
  assert.equal(trueBossUnlocked({ boss: { 'T|A': -1, 'T|B': 1 } }, stages), false); // 壊れた値
  assert.equal(trueBossUnlocked({ boss: { 'T|A': 1.5, 'T|B': 1 } }, stages), false);
  assert.equal(trueBossUnlocked({ boss: { '消えた章': 9 } }, stages), false); // 木に無い章の記録は数えない
});

test('出る条件: 問題のある章が1つも無い・壊れた入力では出ない（何もしなくても出てしまうのを防ぐ）', () => {
  assert.equal(trueBossUnlocked({ boss: {} }, []), false);
  assert.equal(trueBossUnlocked({ boss: {} }, [{ key: 'T|C', questions: [] }]), false);
  assert.equal(trueBossUnlocked({ boss: { x: 1 } }, null), false);
  assert.equal(trueBossUnlocked(null, [{ key: 'A', questions: [{ id: 1 }] }]), false);
  assert.equal(trueBossUnlocked({}, [{ key: 'A', questions: [{ id: 1 }] }]), false);
  assert.equal(trueBossUnlocked({ boss: [1, 2] }, [{ key: 'A', questions: [{ id: 1 }] }]), false);
  assert.equal(trueBossUnlocked({ boss: { A: 1 } }, [null, { key: 'A', questions: [{ id: 1 }] }]), true); // 壊れた章は読み飛ばす
});

test('倒した回数の記録: 古い記録・壊れた値は0。倒すと1ずつ増える', () => {
  assert.deepEqual(normalizeTrueBoss(undefined), { wins: 0, seen2: false });
  assert.deepEqual(normalizeTrueBoss(null), { wins: 0, seen2: false });
  assert.deepEqual(normalizeTrueBoss([3]), { wins: 0, seen2: false });
  assert.deepEqual(normalizeTrueBoss({ wins: -1 }), { wins: 0, seen2: false });
  assert.deepEqual(normalizeTrueBoss({ wins: 1.5 }), { wins: 0, seen2: false });
  assert.deepEqual(normalizeTrueBoss({ wins: '3' }), { wins: 0, seen2: false });
  assert.deepEqual(normalizeTrueBoss({ wins: 4 }), { wins: 4, seen2: false });
  const s = {};
  assert.equal(trueBossWins(s), 0);
  assert.equal(recordTrueBossWin(s), 1);
  assert.equal(recordTrueBossWin(s), 2);
  assert.equal(trueBossWins(s), 2);
  const broken = { trueBoss: 'x' };
  assert.equal(recordTrueBossWin(broken), 1);
  assert.equal(trueBossWins(null), 0);
});

test('学習記録: defaultState に入っていて、読み込みで正しい形になる', () => {
  assert.deepEqual(defaultState().trueBoss, { wins: 0, seen2: false });
  assert.deepEqual(mergeState({}).trueBoss, { wins: 0, seen2: false });
  assert.deepEqual(mergeState({ trueBoss: { wins: 3 } }).trueBoss, { wins: 3, seen2: false });
  assert.deepEqual(mergeState({ trueBoss: { wins: 'x' } }).trueBoss, { wins: 0, seen2: false });
  assert.deepEqual(mergeState({ trueBoss: 7 }).trueBoss, { wins: 0, seen2: false });
});

// ---------------------------------------------------------------- 出題の組み立て

test('決まりの数字: 3形態・体力5〜10・難しさの範囲は 1-2／2-3／3-4・6:4', () => {
  assert.equal(TRUE_FORMS, 3);
  assert.equal(TRUE_HP_MIN, 5);
  assert.equal(TRUE_HP_MAX, 10);
  assert.deepEqual(TRUE_DIFFICULTY[1], [1, 2]);
  assert.deepEqual(TRUE_DIFFICULTY[2], [2, 3]);
  assert.deepEqual(TRUE_DIFFICULTY[3], [3, 4]);
  assert.equal(Math.round(TRUE_QUEUE_PER_FORM * 0.6), 15); // 25 問のうち苦手 15・それ以外 10
});

test('出題: 形態ごとに25問・苦手が6割（15問）・それ以外が4割（10問）・難しさは形態の範囲・同じ問題を2度出さない', () => {
  const qs = bank({ 1: 80, 2: 120, 3: 80, 4: 20 });
  const qstats = {};
  // 苦手（最後に間違えた）を、どの難しさにも十分な数だけ。残りは答え済みの正解と、まだ答えていない問題
  qs.forEach((q, i) => { if (i % 3 === 0) qstats[q.id] = miss(0.2 + (i % 7) / 20); else if (i % 3 === 1) qstats[q.id] = okRec; });
  const plan = buildTrueBossPlan(qs, qstats, { rng: seeded(1) });
  assert.equal(plan.forms.length, 3);
  assert.equal(plan.perForm, 25);
  const all = plan.forms.flat();
  assert.equal(new Set(ids(all)).size, 75, '同じ問題を2度出さない（形態をまたいでも）');
  plan.forms.forEach((f, k) => {
    assert.equal(f.length, 25, '第' + (k + 1) + '形態の問題の数');
    const [lo, hi] = TRUE_DIFFICULTY[k + 1];
    for (const q of f) assert.ok(dOf(q) >= lo && dOf(q) <= hi, q.id + ' は第' + (k + 1) + '形態の難しさの範囲外');
    const weak = f.filter((q) => qstats[q.id] && qstats[q.id].lastOk === false).length;
    assert.equal(weak, 15, '第' + (k + 1) + '形態の苦手の数（6割）');
  });
  assert.equal(plan.weak, 45);
});

test('出題: 苦手は正答率の低い順（同じなら間違えた回数の多い順）に選ばれる。苦手の中で後回しになるのは、正答率の高いもの', () => {
  const qs = bank({ 3: 40 }); // 全部 難しさ3。第3形態が先に選ぶ
  const qstats = {};
  qs.forEach((q, i) => { qstats[q.id] = miss(i / 40, 40); }); // 正答率 0, 1/40, 2/40 …（番号が小さいほど苦手）
  const plan = buildTrueBossPlan(qs, qstats, { rng: seeded(2) });
  // 40問を 3 形態で分けるので 1 形態 13 問（苦手 8）。第3形態が最初に選ぶので、いちばん苦手な 8 問が第3形態に入る
  assert.equal(plan.perForm, 13);
  const f3 = new Set(ids(plan.forms[2]));
  for (let i = 0; i < 8; i++) assert.ok(f3.has('d3-' + i), '一番苦手な d3-' + i + ' が第3形態に入る');
  assert.ok(!f3.has('d3-39'));
});

test('出題: 同じ正答率なら、間違えた回数の多いほうを先に選ぶ', () => {
  const qs = bank({ 3: 3 });
  const qstats = { 'd3-0': { seen: 2, correct: 1, lastOk: false }, 'd3-1': { seen: 10, correct: 5, lastOk: false }, 'd3-2': { seen: 4, correct: 2, lastOk: false } };
  const plan = buildTrueBossPlan(qs, qstats, { rng: seeded(3), perForm: 1 });
  // perForm=1 → 苦手 round(0.6)=1・それ以外 0。第3形態は、正答率 0.5 で間違えた回数が最も多い d3-1
  assert.deepEqual(ids(plan.forms[2]), ['d3-1']);
});

test('出題: 苦手が0問のとき、それ以外だけで埋める（25問ずつ・重複なし）', () => {
  const qs = bank({ 1: 60, 2: 60, 3: 60, 4: 10 });
  const qstats = {};
  qs.forEach((q, i) => { if (i % 2) qstats[q.id] = okRec; });
  const plan = buildTrueBossPlan(qs, qstats, { rng: seeded(4) });
  assert.equal(plan.weak, 0);
  plan.forms.forEach((f) => assert.equal(f.length, 25));
  assert.equal(new Set(ids(plan.forms.flat())).size, 75);
  plan.forms.forEach((f, k) => f.forEach((q) => { const [lo, hi] = TRUE_DIFFICULTY[k + 1]; assert.ok(dOf(q) >= lo && dOf(q) <= hi); }));
});

test('出題: 全部が苦手のとき、苦手だけで埋める（それ以外の枠も苦手になる）', () => {
  const qs = bank({ 1: 60, 2: 60, 3: 60, 4: 10 });
  const qstats = {};
  qs.forEach((q, i) => { qstats[q.id] = miss((i % 10) / 10); });
  const plan = buildTrueBossPlan(qs, qstats, { rng: seeded(5) });
  assert.equal(plan.weak, 75);
  plan.forms.forEach((f) => { assert.equal(f.length, 25); f.forEach((q) => assert.equal(qstats[q.id].lastOk, false)); });
  assert.equal(new Set(ids(plan.forms.flat())).size, 75);
});

test('出題: 苦手が範囲内に少ししか無いとき（3問）、足りない分はそれ以外で埋めて、苦手は全部入れる', () => {
  const qs = bank({ 1: 60, 2: 60, 3: 60, 4: 10 });
  const qstats = { 'd3-0': miss(0.1), 'd3-1': miss(0.2), 'd3-2': miss(0.3) };
  const plan = buildTrueBossPlan(qs, qstats, { rng: seeded(6) });
  const f3 = ids(plan.forms[2]);
  for (const id of ['d3-0', 'd3-1', 'd3-2']) assert.ok(f3.includes(id));
  assert.equal(plan.forms[2].length, 25);
  assert.equal(plan.weak, 3);
});

test('出題: 難しさ4が足りない（3問しかない）とき、第3形態は難しさ3で埋めて25問そろう', () => {
  const qs = bank({ 1: 50, 2: 100, 3: 60, 4: 3 });
  const plan = buildTrueBossPlan(qs, {}, { rng: seeded(7) });
  const f3 = plan.forms[2];
  assert.equal(f3.length, 25);
  assert.ok(f3.every((q) => dOf(q) >= 3 && dOf(q) <= 4), '範囲（3〜4）の中だけで足りる');
  assert.ok(f3.filter((q) => dOf(q) === 4).length <= 3);
  // 難しさ4が苦手に入っていれば、苦手として優先して入る
  const st = { 'd4-0': miss(0.1), 'd4-1': miss(0.2), 'd4-2': miss(0.3) };
  const withWeak = buildTrueBossPlan(qs, st, { rng: seeded(7) }).forms[2];
  assert.equal(withWeak.filter((q) => dOf(q) === 4).length, 3);
  assert.equal(new Set(ids(plan.forms.flat())).size, 75);
});

test('出題: 範囲の難しさの問題が足りないとき、範囲に近い難しさで埋める（遠い難しさは最後）', () => {
  // 難しさ3・4が合わせて10問しかない。第3形態は 10 問 + 範囲に近い 2（距離1）から 15 問
  const qs = bank({ 1: 60, 2: 60, 3: 8, 4: 2 });
  const plan = buildTrueBossPlan(qs, {}, { rng: seeded(8) });
  const f3 = plan.forms[2];
  assert.equal(f3.length, 25);
  assert.equal(f3.filter((q) => dOf(q) >= 3).length, 10);
  assert.equal(f3.filter((q) => dOf(q) === 2).length, 15);
  assert.equal(f3.filter((q) => dOf(q) === 1).length, 0, '距離1の2で足りるので、1は使わない');
});

test('出題: 難しさが全部同じ（1だけ）でも、どの形態も25問そろう（範囲外は近い順）', () => {
  const qs = bank({ 1: 100 });
  const plan = buildTrueBossPlan(qs, {}, { rng: seeded(9) });
  plan.forms.forEach((f) => assert.equal(f.length, 25));
  assert.equal(new Set(ids(plan.forms.flat())).size, 75);
});

test('出題: 難しさが無い・壊れた問題は 2 として扱う', () => {
  assert.equal(difficultyOf({ difficulty: 3 }), 3);
  assert.equal(difficultyOf({}), 2);
  assert.equal(difficultyOf({ difficulty: 9 }), 2);
  assert.equal(difficultyOf({ difficulty: 0 }), 2);
  assert.equal(difficultyOf({ difficulty: '3' }), 2);
  assert.equal(difficultyOf(null), 2);
});

test('出題: 問題が少ないときは、3つの形態に同じ数ずつ（1つの形態が空にならない）', () => {
  const qs = bank({ 1: 4, 2: 4, 3: 2 }); // 10 問
  const plan = buildTrueBossPlan(qs, {}, { rng: seeded(10) });
  assert.equal(plan.perForm, 3);
  plan.forms.forEach((f) => assert.equal(f.length, 3));
  assert.equal(new Set(ids(plan.forms.flat())).size, 9);
});

test('出題: 問題が3問未満・0問・壊れた入力では、どの形態も空（挑めない）', () => {
  for (const input of [bank({ 2: 2 }), [], null, undefined, 'x']) {
    const plan = buildTrueBossPlan(input, {}, { rng: seeded(11) });
    assert.equal(plan.forms.length, 3);
    plan.forms.forEach((f) => assert.equal(f.length, 0));
  }
  assert.equal(buildTrueBossPlan(bank({ 2: 3 }), {}, { rng: seeded(11) }).forms.every((f) => f.length === 1), true); // 3問ならちょうど1問ずつ
});

test('出題: 同じ ID の問題が重なっていても1問として数える。ID の無い・壊れた問題は読み飛ばす', () => {
  const qs = [...bank({ 2: 30 }), mkq('d2-0', 2), { difficulty: 2 }, null, 5, { id: '', difficulty: 2 }];
  const plan = buildTrueBossPlan(qs, {}, { rng: seeded(12) });
  assert.equal(new Set(ids(plan.forms.flat())).size, plan.forms.flat().length);
  assert.equal(plan.forms.flat().length, 30); // 30問が 3 形態に 10 問ずつ
});

test('出題: 同じ乱数なら同じ並び（再現できる）。別の乱数なら、それ以外の選び方・並びが変わる', () => {
  const qs = bank({ 1: 80, 2: 120, 3: 80, 4: 20 });
  const a = buildTrueBossPlan(qs, {}, { rng: seeded(21) });
  const b = buildTrueBossPlan(qs, {}, { rng: seeded(21) });
  const c = buildTrueBossPlan(qs, {}, { rng: seeded(22) });
  assert.deepEqual(a.forms.map(ids), b.forms.map(ids));
  assert.notDeepEqual(a.forms.map(ids), c.forms.map(ids));
});

test('出題: 答えた記録が壊れていても落ちない（seen が数でない苦手は、苦手として数えない）', () => {
  const qs = bank({ 1: 40, 2: 40, 3: 40, 4: 5 });
  const qstats = { 'd3-0': { seen: 'x', correct: 1, lastOk: false }, 'd3-1': null, 'd3-2': 5, 'd2-0': { seen: 0, lastOk: false } };
  const plan = buildTrueBossPlan(qs, qstats, { rng: seeded(13) });
  assert.equal(plan.weak, 0);
  assert.equal(buildTrueBossPlan(qs, 'x', { rng: seeded(13) }).forms[0].length, 25);
});

// ---------------------------------------------------------------- 体力

test('形態ごとの体力: 5〜10 のどれか。乱数の両端と壊れた値でも範囲に収まる。全部の値が出る', () => {
  assert.equal(rollFormHp(() => 0), 5);
  assert.equal(rollFormHp(() => 0.999999), 10);
  assert.equal(rollFormHp(() => 1), 10);
  assert.equal(rollFormHp(() => 5), 10);
  assert.equal(rollFormHp(() => -1), 5);
  assert.equal(rollFormHp(() => NaN), 5);
  const seen = new Set();
  const r = seeded(31);
  for (let i = 0; i < 500; i++) { const hp = rollFormHp(r); assert.ok(Number.isInteger(hp) && hp >= 5 && hp <= 10); seen.add(hp); }
  assert.deepEqual([...seen].sort((a, b) => a - b), [5, 6, 7, 8, 9, 10]);
});

test('戦いの始まり: 第1形態・体力5〜10・自分の HP は 3（上限も3）・技なし。bossMood がそのまま使える', () => {
  const b = newTrueBattle(() => 0.5);
  assert.equal(b.form, 1);
  assert.ok(b.boss >= 5 && b.boss <= 10);
  assert.equal(b.boss, b.bossMax);
  assert.equal(b.player, PLAYER_HP);
  assert.equal(b.playerMax, 3);
  assert.equal(b.skill, null);
  assert.equal(b.result, null);
  assert.equal(b.streak, 0);
  assert.equal(bossMood(b), 'high');
  assert.equal(bossMood({ ...b, boss: Math.ceil(b.bossMax / 2) }), 'half');
});

const fresh = (hp = 10, over = {}) => ({ form: 1, boss: hp, bossMax: hp, player: 3, playerMax: 3, streak: 0, asked: 0, skill: null, result: null, nextHeal: 10, ...over });

test('正解でボスが1減る（会心の一撃は2）。不正解でこちらが1減る', () => {
  let r = answerTrueBattle(fresh(10), { correct: true });
  assert.equal(r.battle.boss, 9);
  assert.equal(r.events.hit, true);
  assert.equal(r.events.damage, 1);
  r = answerTrueBattle(fresh(10), { correct: true, damage: 2 });
  assert.equal(r.battle.boss, 8);
  assert.equal(r.events.damage, 2);
  r = answerTrueBattle(fresh(10), { correct: true, damage: 0 });
  assert.equal(r.battle.boss, 9, '壊れたダメージは1');
  r = answerTrueBattle(fresh(10), { correct: false });
  assert.equal(r.battle.player, 2);
  assert.equal(r.battle.boss, 10);
  assert.equal(r.events.miss, true);
  assert.equal(r.events.lost, 1);
});

test('元の状態は変えない', () => {
  const b = fresh(10);
  const snap = JSON.stringify(b);
  answerTrueBattle(b, { correct: true });
  answerTrueBattle(b, { correct: false });
  assert.equal(JSON.stringify(b), snap);
});

test('進化: 体力が0になると次の形態になり、体力を決め直す（5〜10）。問題の数・技は数え直し。連続正解は引き継ぐ。第3形態を倒すと勝ち', () => {
  let b = fresh(1, { asked: 4, streak: 0, skill: { kind: 'timed', turns: 2 } });
  let r = answerTrueBattle(b, { correct: true }, () => 0.5);
  assert.deepEqual(r.events.evolved, { from: 1, to: 2 });
  assert.equal(r.battle.form, 2);
  assert.ok(r.battle.boss >= 5 && r.battle.boss <= 10);
  assert.equal(r.battle.boss, r.battle.bossMax);
  assert.equal(r.battle.asked, 0);
  assert.equal(r.battle.skill, null, '進化すると技は解ける');
  assert.equal(r.events.skillEnded, 'timed');
  assert.equal(r.battle.streak, 1, '連続正解は進化をまたいで続く');
  assert.equal(r.battle.result, null);
  b = { ...r.battle, boss: 1 };
  r = answerTrueBattle(b, { correct: true }, () => 0.5);
  assert.equal(r.battle.form, 3);
  assert.equal(r.battle.result, null);
  b = { ...r.battle, boss: 1 };
  r = answerTrueBattle(b, { correct: true }, () => 0.5);
  assert.equal(r.battle.result, 'win');
  assert.equal(r.battle.form, 3, '勝ったあとも第3形態のまま');
  assert.equal(r.events.evolved, null);
});

test('会心の一撃で体力が足りないほど削れても、進化は1回だけ（次の形態の体力はそのまま満タン）', () => {
  const r = answerTrueBattle(fresh(1), { correct: true, damage: 2 }, () => 0);
  assert.equal(r.battle.form, 2);
  assert.equal(r.battle.boss, 5);
});

test('負け: HP が0になると負け。負けたあとの答えは無視する。進化と負けが同時には起きない', () => {
  let b = fresh(10, { player: 1 });
  let r = answerTrueBattle(b, { correct: false });
  assert.equal(r.battle.player, 0);
  assert.equal(r.battle.result, 'lose');
  const again = answerTrueBattle(r.battle, { correct: true });
  assert.equal(again.battle.boss, r.battle.boss, '終わったあとの答えは無視');
  assert.equal(again.battle.result, 'lose');
  assert.equal(again.events.hit, false);
  const won = answerTrueBattle({ ...fresh(10), result: 'win' }, { correct: false });
  assert.equal(won.battle.player, 3);
});

test('負けたら第1形態からやり直す（体力・HP・技・連続も最初に戻る）。負けていない戦いは変えない', () => {
  const lost = fresh(9, { form: 3, player: 0, streak: 2, asked: 7, skill: { kind: 'curse', turns: 1 }, result: 'lose' });
  const n = restartAfterLose(lost, () => 0.5);
  assert.equal(n.form, 1);
  assert.equal(n.result, null);
  assert.equal(n.player, 3);
  assert.equal(n.streak, 0);
  assert.equal(n.asked, 0);
  assert.equal(n.skill, null);
  assert.ok(n.boss >= 5 && n.boss <= 10);
  const going = fresh(9, { form: 2 });
  const same = restartAfterLose(going);
  assert.equal(same.form, 2);
  assert.notEqual(same, going);
  assert.equal(restartAfterLose({ ...going, result: 'win' }).form, 2, '勝ったあとは第1形態に戻さない');
});

// ---------------------------------------------------------------- 自分の HP の回復

test('3問続けて正解すると HP が1回復する（上限3）。回復したら数え直し', () => {
  assert.equal(STREAK_HEAL, 3);
  let b = fresh(50, { player: 1 });
  const step = (c) => { const r = answerTrueBattle(b, { correct: c }); b = r.battle; return r.events; };
  assert.equal(step(true).playerHealed, false);
  assert.equal(b.streak, 1);
  assert.equal(step(true).playerHealed, false);
  assert.equal(b.streak, 2);
  assert.equal(b.player, 1);
  assert.equal(step(true).playerHealed, true, '3問目で回復');
  assert.equal(b.player, 2);
  assert.equal(b.streak, 0, '回復したら数え直し');
  step(true); step(true);
  assert.equal(b.player, 2, '2問ではまだ');
  assert.equal(step(true).playerHealed, true);
  assert.equal(b.player, 3);
  step(true); step(true);
  const e = step(true);
  assert.equal(b.player, 3, '上限3を超えない');
  assert.equal(e.playerHealed, false, '満タンのときは回復の知らせを出さない');
  assert.equal(b.streak, 0);
});

test('連続正解は、不正解で切れる（2問正解のあとの不正解 → 次は1から数える）。回復は不正解の分を取り戻さない', () => {
  let b = fresh(50, { player: 2 });
  const step = (c) => { const r = answerTrueBattle(b, { correct: c }); b = r.battle; return r.events; };
  step(true); step(true); step(false);
  assert.equal(b.streak, 0);
  assert.equal(b.player, 1);
  step(true); step(true);
  assert.equal(b.player, 1, '切れたあとは3問そろうまで回復しない');
  step(true);
  assert.equal(b.player, 2);
});

test('時間切れの不正解も連続を切る。正解でも timedOut なら不正解として数える', () => {
  let b = fresh(50, { player: 2, streak: 2 });
  const r = answerTrueBattle(b, { correct: true, timedOut: true });
  assert.equal(r.battle.player, 1);
  assert.equal(r.battle.streak, 0);
  assert.equal(r.battle.boss, 50, 'ボスは減らない');
  assert.equal(r.events.timedOut, true);
  assert.equal(r.events.miss, true);
});

test('HP の回復は進化をまたいで続く', () => {
  let b = fresh(1, { player: 2, streak: 2 });
  const r = answerTrueBattle(b, { correct: true }, () => 0.5);
  assert.equal(r.battle.form, 2);
  assert.equal(r.battle.player, 3, '進化したその1問でも、3問目の正解なら回復する');
});

// ---------------------------------------------------------------- ボスの回復

test('ボスの回復の間隔: 7〜10問のどれか。乱数の両端と壊れた値でも範囲内。全部の値が出る。戦いの始まり・進化のたびに決まる', () => {
  assert.equal(TRUE_HEAL_GAP_MIN, 7);
  assert.equal(TRUE_HEAL_GAP_MAX, 10);
  assert.equal(rollHealGap(() => 0), 7);
  assert.equal(rollHealGap(() => 0.999999), 10);
  assert.equal(rollHealGap(() => 1), 10);
  assert.equal(rollHealGap(() => NaN), 7);
  assert.equal(rollHealGap(() => -2), 7);
  const seen = new Set();
  const r = seeded(77);
  for (let i = 0; i < 300; i++) seen.add(rollHealGap(r));
  assert.deepEqual([...seen].sort((x, y) => x - y), [7, 8, 9, 10]);
  assert.equal(newTrueBattle(() => 0).nextHeal, 7);
  assert.equal(newTrueBattle(() => 0.999).nextHeal, 10);
});

test('ボスは、形態の中で nextHeal 問目に1回復し、回復のたびに次の間隔を 7〜10 から決め直す', () => {
  let r = answerTrueBattle(fresh(10, { boss: 7, asked: 8, nextHeal: 9 }), { correct: true }, () => 0);
  assert.equal(r.events.bossHealed, true);
  assert.equal(r.battle.boss, 7, '1減って 6、回復で 7');
  assert.equal(r.battle.asked, 9);
  assert.equal(r.battle.nextHeal, 9 + 7, '次は 9 問目から数えて 7 問後（乱数 0 → 間隔 7）');
  r = answerTrueBattle(fresh(10, { boss: 7, asked: 8, nextHeal: 9 }), { correct: true }, () => 0.999);
  assert.equal(r.battle.nextHeal, 9 + 10, '乱数が大きければ間隔 10');
  // まだ間隔が来ていなければ回復しない
  r = answerTrueBattle(fresh(10, { boss: 7, asked: 6, nextHeal: 9 }), { correct: true });
  assert.equal(r.events.bossHealed, false);
  assert.equal(r.battle.boss, 6);
  assert.equal(r.battle.nextHeal, 9);
});

test('ボスの回復: 満タンなら回復しない（最大を超えない）。減ったら、間隔が来ていればすぐ回復する', () => {
  let r = answerTrueBattle(fresh(10, { boss: 10, asked: 8, nextHeal: 9 }), { correct: false });
  assert.equal(r.events.bossHealed, false);
  assert.equal(r.battle.boss, 10);
  assert.equal(r.battle.nextHeal, 9, '回復していないので間隔は決め直さない');
  r = answerTrueBattle({ ...r.battle, player: 3 }, { correct: true }, () => 0);
  assert.equal(r.events.bossHealed, true, '10問目: 9 に減ったので回復する');
  assert.equal(r.battle.boss, 10);
});

test('ボスの回復: 形態が替わると問題の数と回復の間隔を決め直す', () => {
  let b = fresh(1, { asked: 3, nextHeal: 4 });
  b = answerTrueBattle(b, { correct: true }, () => 0).battle;
  assert.equal(b.form, 2);
  assert.equal(b.asked, 0);
  assert.equal(b.nextHeal, 7, '進化後の間隔（乱数 0 → 7）');
  for (let i = 1; i <= 6; i++) { const r = answerTrueBattle(b, { correct: false }); b = r.battle; if (b.player === 0) b = { ...b, player: 3 }; assert.equal(r.events.bossHealed, false); }
});

test('倒した問題・負けた問題では、ボスの回復は起きない', () => {
  const win = answerTrueBattle(fresh(1, { form: 3, asked: 9, nextHeal: 10 }), { correct: true });
  assert.equal(win.battle.result, 'win');
  assert.equal(win.events.bossHealed, false);
  const lose = answerTrueBattle(fresh(10, { asked: 9, boss: 5, player: 1, nextHeal: 10 }), { correct: false });
  assert.equal(lose.battle.result, 'lose');
  assert.equal(lose.events.bossHealed, false);
});

// ---------------------------------------------------------------- 技

test('技の制限時間: 時間制限の技のときだけ15秒。ちょうど15秒は間に合い、15秒を超えたら時間切れ', () => {
  const timed = { kind: 'timed', turns: 3 };
  assert.equal(SKILL_SECONDS, 15);
  assert.equal(timeLimitFor(timed), 15);
  assert.equal(timeLimitFor({ kind: 'curse', turns: 3 }), null);
  assert.equal(timeLimitFor(null), null);
  assert.equal(isTimedOut(timed, 15), false);
  assert.equal(isTimedOut(timed, 14.999), false);
  assert.equal(isTimedOut(timed, 15.001), true);
  assert.equal(isTimedOut(timed, 0), false);
  assert.equal(isTimedOut(timed, NaN), false);
  assert.equal(isTimedOut(timed, Infinity), false);
  assert.equal(isTimedOut(null, 100), false, '技が無ければ時間切れにならない');
  assert.equal(isTimedOut({ kind: 'curse', turns: 3 }, 100), false);
});

test('呪いの技: かかっている間は、不正解で HP が2減る。1しか残っていなければ0で負け。時間制限の技の不正解は1', () => {
  assert.equal(SKILL_CURSE_DAMAGE, 2);
  let r = answerTrueBattle(fresh(10, { skill: { kind: 'curse', turns: 3 } }), { correct: false });
  assert.equal(r.battle.player, 1);
  assert.equal(r.events.lost, 2);
  r = answerTrueBattle(fresh(10, { player: 1, skill: { kind: 'curse', turns: 3 } }), { correct: false });
  assert.equal(r.battle.player, 0);
  assert.equal(r.events.lost, 1, '実際に減った数');
  assert.equal(r.battle.result, 'lose');
  r = answerTrueBattle(fresh(10, { skill: { kind: 'timed', turns: 3 } }), { correct: false, timedOut: true });
  assert.equal(r.battle.player, 2);
  r = answerTrueBattle(fresh(10, { skill: { kind: 'curse', turns: 3 } }), { correct: true });
  assert.equal(r.battle.player, 3, '正解なら呪いは効かない');
});

test('技のターンの減り方: 3ターンの間続き、答えるたびに1ずつ減って、3問目で終わる（正解でも不正解でも）', () => {
  assert.equal(SKILL_TURNS, 3);
  let b = fresh(50, { skill: { kind: 'timed', turns: SKILL_TURNS } });
  let r = answerTrueBattle(b, { correct: true });
  assert.equal(r.battle.skill.turns, 2);
  assert.equal(r.events.skillEnded, null);
  b = r.battle;
  r = answerTrueBattle(b, { correct: false, timedOut: true });
  assert.equal(r.battle.skill.turns, 1);
  b = r.battle;
  r = answerTrueBattle(b, { correct: true });
  assert.equal(r.battle.skill, null, '3問目で解ける');
  assert.equal(r.events.skillEnded, 'timed');
  // 技が無ければ何も起きない
  r = answerTrueBattle(fresh(50), { correct: true });
  assert.equal(r.battle.skill, null);
  assert.equal(r.events.skillEnded, null);
});

test('技を使うか: 技がかかっている・形態の最初の問題・終わった戦いでは使わない（乱数も使わない）', () => {
  const rng = counted(() => 0);
  assert.equal(rollSkill(fresh(10, { asked: 0 }), rng).started, null);
  assert.equal(rollSkill(fresh(10, { asked: 3, skill: { kind: 'timed', turns: 2 } }), rng).started, null);
  assert.equal(rollSkill(fresh(10, { asked: 3, result: 'win' }), rng).started, null);
  assert.equal(rng.calls, 0, '条件を満たさないときは rng を使わない');
  assert.equal(rollSkill(null, rng).started, null);
});

test('技を使うか: 第3形態ほど使ってくる（1:5% 2:8% 3:30%）。第1・第2形態は時間制限だけ。HP2減るは第3形態だけで、技の2割', () => {
  assert.deepEqual(SKILL_CHANCE, { 1: 0.05, 2: 0.08, 3: 0.3 });
  assert.equal(CURSE_SHARE, 0.2);
  const roll = (form, v1, v2 = 0) => rollSkill(fresh(10, { form, asked: 2 }), seq(v1, v2));
  assert.equal(roll(1, 0.049).started !== null, true);
  assert.equal(roll(1, 0.05).started, null, 'ちょうど 5% は使わない');
  assert.equal(roll(2, 0.079).started !== null, true);
  assert.equal(roll(1, 0.07).started, null);
  assert.equal(roll(3, 0.299).started !== null, true);
  assert.equal(roll(2, 0.1).started, null);
  assert.equal(roll(3, 0.3).started, null);
  assert.equal(roll(3, 0.99).started, null);
  // 第1・第2形態は、乱数がどうでも時間制限だけ
  for (const v2 of [0, 0.01, 0.5, 0.99]) { assert.equal(roll(1, 0, v2).started, 'timed'); assert.equal(roll(2, 0, v2).started, 'timed'); }
  // 第3形態: 技のうち 2割（CURSE_SHARE 未満）が HP2減る、残りは時間制限
  assert.equal(roll(3, 0, 0.19).started, 'curse');
  assert.equal(roll(3, 0, 0.2).started, 'timed');
  assert.deepEqual(roll(3, 0, 0.1).battle.skill, { kind: 'curse', turns: 3 });
  // 元は変えない
  const bt = fresh(10, { form: 1, asked: 2 });
  rollSkill(bt, seq(0, 0));
  assert.equal(bt.skill, null);
});

test('技の種類の割合: 第3形態で技が出たうち HP2減るは約2割。第1・第2形態では0', () => {
  const r = seeded(91);
  let curse = 0; let all = 0;
  for (let i = 0; i < 20000; i++) { const x = rollSkill(fresh(10, { form: 3, asked: 2 }), r).started; if (x) { all++; if (x === 'curse') curse++; } }
  assert.ok(Math.abs(curse / all - 0.2) < 0.03, String(curse / all));
  for (const form of [1, 2]) for (let i = 0; i < 3000; i++) assert.notEqual(rollSkill(fresh(10, { form, asked: 2 }), r).started, 'curse');
});

test('技を使う頻度: 第3形態は第1形態より多い（乱数を回して数える）', () => {
  const count = (form) => {
    const r = seeded(40 + form);
    let n = 0;
    for (let i = 0; i < 4000; i++) if (rollSkill(fresh(10, { form, asked: 2 }), r).started) n++;
    return n;
  };
  const c1 = count(1);
  const c2 = count(2);
  const c3 = count(3);
  assert.ok(c1 < c2 && c2 < c3, c1 + ' < ' + c2 + ' < ' + c3);
  assert.ok(Math.abs(c3 / 4000 - 0.3) < 0.03);
});

// ---------------------------------------------------------------- 1回の戦い（問題の順番つき）

function planOf(forms) { return { forms }; }
const qform = (f, n) => Array.from({ length: n }, (_, i) => mkq('f' + f + '-' + i, f));

test('戦いの進み方: 第1形態の問題から順に出て、進化すると第2形態の問題に移る。決着がつくと出す問題は無い', () => {
  let run = newTrueRun(planOf([qform(1, 30), qform(2, 30), qform(3, 30)]), () => 0); // 体力は全部 5
  assert.equal(run.battle.boss, 5);
  assert.equal(currentTrueQuestion(run).id, 'f1-0');
  let asked = [];
  while (!run.battle.result) {
    const q = currentTrueQuestion(run);
    asked.push(q.id);
    run = answerTrueRun(run, { correct: true }, () => 0).run;
  }
  assert.equal(run.battle.result, 'win');
  assert.equal(currentTrueQuestion(run), null);
  // 体力5を全部正解で削ると、回復（10問に1回）の前に倒せるので、1形態あたり5問
  assert.equal(asked.filter((x) => x.startsWith('f1-')).length, 5);
  assert.equal(asked.filter((x) => x.startsWith('f2-')).length, 5);
  assert.equal(asked.filter((x) => x.startsWith('f3-')).length, 5);
  assert.deepEqual(asked.slice(0, 6), ['f1-0', 'f1-1', 'f1-2', 'f1-3', 'f1-4', 'f2-0']);
  assert.equal(new Set(asked).size, asked.length, '全部正解なら同じ問題を2度出さない');
  assert.equal(run.recycled, 0);
});

test('戦いの進み方: 終わった戦いに答えても何も変わらない。問題が無ければ events は null', () => {
  let run = newTrueRun(planOf([qform(1, 3), qform(2, 3), qform(3, 3)]), () => 0);
  const dead = { ...run, battle: { ...run.battle, result: 'lose' } };
  const r = answerTrueRun(dead, { correct: true });
  assert.equal(r.events, null);
  assert.equal(r.run.battle.result, 'lose');
});

test('問題が尽きても決着していなければ、この戦いで出した問題を出し直す（間違えたものが先）', () => {
  // 形態ごとに2問しか無いのに、体力は8。間違えるのを先頭にして出し直す
  let run = newTrueRun(planOf([qform(1, 2), qform(2, 2), qform(3, 2)]), () => 0);
  const order = [];
  run = answerTrueRun(run, { correct: true }, () => 0).run; order.push('f1-0 ok');
  assert.equal(run.recycled, 0);
  run = answerTrueRun(run, { correct: false }, () => 0).run; // f1-1 を間違える。問題が尽きた
  assert.equal(run.recycled, 1);
  assert.equal(currentTrueQuestion(run).id, 'f1-1', '間違えたほうを先に出し直す');
  assert.deepEqual(run.queues[0].map((q) => q.id), ['f1-1', 'f1-0']);
  assert.equal(run.battle.result, null);
});

test('問題が尽きる前に決着がつけば出し直さない（recycled は 0）', () => {
  let run = newTrueRun(planOf([qform(1, 10), qform(2, 10), qform(3, 10)]), () => 0);
  for (let i = 0; i < 4; i++) run = answerTrueRun(run, { correct: true }, () => 0).run;
  assert.equal(run.recycled, 0);
});

test('問題が1つも無ければ出せない（挑めない）。壊れた計画でも落ちない', () => {
  const run = newTrueRun(planOf([[], [], []]), () => 0);
  assert.equal(currentTrueQuestion(run), null);
  assert.equal(newTrueRun(null, () => 0).queues.length, 3);
  assert.equal(currentTrueQuestion(newTrueRun({ forms: [5, null] }, () => 0)), null);
});

test('技の判定を戦いに反映する（rollRunSkill）。反映後の技が戦いの状態に入る', () => {
  const run0 = newTrueRun(planOf([qform(1, 30), qform(2, 30), qform(3, 30)]), () => 0);
  const first = rollRunSkill(run0, seq(0, 0)); // 最初の問題（asked=0）は使わない
  assert.equal(first.started, null);
  const run1 = answerTrueRun(run0, { correct: true }, () => 0).run;
  const run3 = { ...run1, battle: { ...run1.battle, form: 3, asked: 2 } }; // HP2減るは第3形態だけ
  assert.equal(rollRunSkill(run1, seq(0, 0.1)).started, 'timed', '第1形態は時間制限だけ');
  const r = rollRunSkill(run3, seq(0, 0.1));
  assert.equal(r.started, 'curse');
  assert.deepEqual(r.run.battle.skill, { kind: 'curse', turns: 3 });
  assert.equal(run1.battle.skill, null, '元は変えない');
});

test('通しの戦い: 技・回復・進化がからんでも、必ず決着する。正解率ごとの結果と、問題の出し直し（recycled）の回数を数える', () => {
  const stats = {};
  for (const p of [1, 0.9, 0.75, 0.6, 0.4]) {
    const rng = seeded(100 + Math.round(p * 100));
    let wins = 0; let recycledRuns = 0; let maxPerForm = 0; let evolves = 0;
    const N = 400;
    for (let n = 0; n < N; n++) {
      let run = newTrueRun(planOf([qform(1, 25), qform(2, 25), qform(3, 25)]), rng);
      let steps = 0;
      const perForm = [0, 0, 0];
      while (!run.battle.result) {
        assert.ok(++steps < 400, '終わらない戦い（正解率 ' + p + '）');
        run = rollRunSkill(run, rng).run;
        const q = currentTrueQuestion(run);
        assert.ok(q, '出す問題が無い');
        const form = run.battle.form;
        const t = run.battle.skill && run.battle.skill.kind === 'timed';
        const correct = rng() < p;
        const r = answerTrueRun(run, { correct, timedOut: t && p < 1 && rng() < 0.1, damage: rng() < 0.1 ? 2 : 1 }, rng);
        perForm[form - 1]++;
        if (r.events.evolved) evolves++;
        run = r.run;
      }
      if (run.battle.result === 'win') wins++;
      if (run.recycled > 0) recycledRuns++;
      maxPerForm = Math.max(maxPerForm, ...perForm);
    }
    stats[p] = { wins, recycledRuns, maxPerForm, evolves };
  }
  // 全部正解なら必ず勝つ。正解率が高いほど勝つ。弱い人は負ける
  assert.equal(stats[1].wins, 400);
  assert.ok(stats[1].wins > stats[0.9].wins && stats[0.9].wins > stats[0.75].wins && stats[0.75].wins >= stats[0.6].wins && stats[0.6].wins >= stats[0.4].wins, JSON.stringify(stats));
  assert.ok(stats[0.4].wins < 400 * 0.1, '正解率4割ではほとんど勝てない: ' + JSON.stringify(stats));
  assert.ok(stats[0.9].wins > 400 * 0.5, '正解率9割ならたいてい勝つ: ' + JSON.stringify(stats));
  // 25問で足りる（出し直しは、まず起きない）
  for (const p of Object.keys(stats)) assert.ok(stats[p].recycledRuns <= 400 * 0.02, '出し直しが多すぎる(' + p + '): ' + JSON.stringify(stats[p]));
});

test('負けたあと、もう一度挑むと第1形態から（問題も組み立て直す）', () => {
  let run = newTrueRun(planOf([qform(1, 25), qform(2, 25), qform(3, 25)]), () => 0);
  // 第2形態まで進めてから負ける
  while (run.battle.form < 2) run = answerTrueRun(run, { correct: true }, () => 0).run;
  while (!run.battle.result) run = answerTrueRun(run, { correct: false }, () => 0).run;
  assert.equal(run.battle.result, 'lose');
  assert.equal(run.battle.form, 2);
  const again = newTrueRun(planOf([qform(1, 25), qform(2, 25), qform(3, 25)]), () => 0);
  assert.equal(again.battle.form, 1);
  assert.equal(currentTrueQuestion(again).id, 'f1-0');
});

// ---------------------------------------------------------------- 答えの記録（今日の復習の枠に数えない）

test('答えの記録: 問題の記録には入るが、今日の復習の枠（reviewToday）には数えない', async () => {
  const { recordAnswer } = await import('../js/lib/progress.js');
  const s = defaultState();
  const q = { id: 'Q1' };
  const now = new Date(2026, 9, 23, 12, 0, 0);
  // 真ボスの画面は review を渡さない
  const r = recordAnswer(s, q, { correct: false, seconds: 10, now, limit: 40 });
  assert.ok(r.xp >= 0);
  assert.equal(s.qstats.Q1.seen, 1);
  assert.equal(s.qstats.Q1.lastOk, false);
  assert.equal(s.reviewToday.n, 0, '復習の枠には数えない');
  assert.equal(s.totals.answered, 1);
  recordAnswer(s, { id: 'Q2' }, { correct: true, now, limit: 40, review: true });
  assert.equal(s.reviewToday.n, 1, '（比較）復習として解けば数える');
});

// ---------------------------------------------------------------- バッジ（ひみつ）

const tree = () => {
  const a = { key: 'T|A', name: 'A', questions: [{ id: 'a' }], children: [] };
  return { roots: [{ key: 'T', id: 'T', name: 'T', children: [a] }], stages: [a] };
};

test('ひみつのバッジ: 真ボスを出すアプリだけに入る。ひみつの段。倒すまで取れず、倒すと取れる', () => {
  const on = badgeDefs(tree(), { trueBoss: true, secondsPerQuestion: 40 });
  const off = badgeDefs(tree(), { secondsPerQuestion: 40 });
  assert.equal(off.some((d) => d.id === 'true-boss'), false, 'DX ほか（config に無い）には入らない');
  const d = on.find((x) => x.id === 'true-boss');
  assert.ok(d);
  assert.equal(on.length, off.length + 1);
  assert.ok(SECRET_BADGE_IDS.includes('true-boss'));
  assert.equal(badgeTier(d), 'secret');
  const s = defaultState();
  assert.equal(d.test(s), false);
  recordTrueBossWin(s);
  assert.equal(d.test(s), true);
  const got = awardBadges(defaultState(), on, '2026-10-23');
  assert.equal(got.some((x) => x.id === 'true-boss'), false);
  const s2 = defaultState();
  recordTrueBossWin(s2);
  assert.equal(awardBadges(s2, on, '2026-10-23').some((x) => x.id === 'true-boss'), true);
  assert.equal(s2.badges['true-boss'], '2026-10-23');
});

test('ひみつのバッジ: 取るまでは名前も条件も出さない（ひみつのバッジ）。ホームの「次の目標」にも出さない', () => {
  const on = badgeDefs(tree(), { trueBoss: true, secondsPerQuestion: 40 });
  const d = on.find((x) => x.id === 'true-boss');
  const v = badgeView(d, false);
  assert.equal(v.showArt, false);
  assert.equal(v.name, SECRET_BADGE_TEXT.title);
  assert.equal(v.label, SECRET_BADGE_TEXT.name);
  assert.equal(v.showProgress, false);
  assert.ok(!JSON.stringify(v).includes('真ボス'), '条件の語を漏らさない');
  assert.equal(badgeView(d, true).name, d.name, '取ったあとは名前を出す');
  const s = defaultState();
  const goals = nextGoals(tree(), on, s, '2026-10-23', 50);
  assert.ok(goals.every((g) => g.id !== 'true-boss'));
});

test('ひみつのバッジの並び: ノーダメージの次（タップのバッジの前）', () => {
  const ids2 = badgeDefs(tree(), { trueBoss: true, secondsPerQuestion: 40 }).map((d) => d.id);
  const i = ids2.indexOf('true-boss');
  assert.equal(ids2[i - 1], 'boss-flawless');
  assert.equal(ids2[i + 1], 'tap-shiba-100');
});

// ---------------------------------------------------------------- 第2形態を見たか（見るまでは『形態』を画面に出さない）

test('第2形態を見たかの記録: 古い記録・壊れた値は「見ていない」。記録すると true。倒したことがあれば見たことになる。記録しても倒した回数は変わらない', async () => {
  const { trueBossSeenForm2, markTrueBossSeenForm2 } = await import('../js/lib/trueboss.js');
  assert.deepEqual(normalizeTrueBoss({ wins: 2, seen2: true }), { wins: 2, seen2: true });
  for (const bad of [undefined, null, {}, { seen2: 'true' }, { seen2: 1 }, { seen2: false }, [true]]) assert.equal(normalizeTrueBoss(bad).seen2, false, JSON.stringify(bad));
  assert.equal(trueBossSeenForm2({}), false);
  assert.equal(trueBossSeenForm2({ trueBoss: { wins: 0 } }), false);
  assert.equal(trueBossSeenForm2(null), false);
  assert.equal(trueBossSeenForm2({ trueBoss: { wins: 1 } }), true, '倒した人は見たことになる');
  const s = { trueBoss: { wins: 3 } };
  const st = { trueBoss: { wins: 0 } };
  assert.equal(markTrueBossSeenForm2(st), true, '初めて');
  assert.equal(markTrueBossSeenForm2(st), false, '2回目は初めてではない');
  assert.equal(trueBossSeenForm2(st), true);
  assert.equal(trueBossWins(st), 0);
  recordTrueBossWin(st);
  assert.deepEqual(st.trueBoss, { wins: 1, seen2: true }, '倒しても見た印は消えない');
  assert.equal(s.trueBoss.seen2, undefined);
  assert.equal(mergeState({ trueBoss: { wins: 0, seen2: true } }).trueBoss.seen2, true);
});

// ---- アプリごとの言い回し（config.trueBossWords。DX・AIパスポートは塔ではない）----
import { trueBossWords, trueBossLockedText, trueBossAwakeText, DEFAULT_TRUE_BOSS_WORDS } from '../js/lib/trueboss.js';
import { readFileSync as readCfg } from 'node:fs';

test('trueBossWords: config に無い・壊れているときは G検定の言い回し。あれば config のものを使う', () => {
  for (const c of [null, undefined, {}, { trueBossWords: 5 }, { trueBossWords: { place: ' ', ending: 3 } }]) assert.deepEqual(trueBossWords(c), DEFAULT_TRUE_BOSS_WORDS);
  assert.deepEqual(trueBossWords({ trueBossWords: { place: ' みやこ ', ending: 'お', reached: 'ふ' } }), { place: 'みやこ', ending: 'お', reached: 'ふ' });
  assert.equal(trueBossLockedText({}), '塔の いちばん うえに、なにかが ひそんでいる……');
  assert.equal(trueBossAwakeText({}), '塔の いちばん うえで、おおきな なにかが めざめた……');
});

test('3アプリの config.trueBossWords: 塔は G検定だけ。DX は『みやこ』、AIパスポートは『そら』。どれも文として読める', () => {
  const cfg = (a) => JSON.parse(readCfg(new URL('../../' + a + '/config.json', import.meta.url), 'utf8'));
  assert.deepEqual(trueBossWords(cfg('g-kentei')), DEFAULT_TRUE_BOSS_WORDS);
  for (const [a, w] of [['dx-biz', 'みやこ'], ['ai-passport', 'そら']]) {
    const t = trueBossWords(cfg(a));
    for (const k of ['place', 'ending', 'reached']) assert.ok(t[k].includes(w), a + ' の ' + k);
    for (const v of [t.place, t.ending, t.reached, trueBossLockedText(cfg(a)), trueBossAwakeText(cfg(a))]) assert.doesNotMatch(v, /塔|UC-|SCR-|§|MVP/, a + ': ' + v);
    assert.ok(trueBossLockedText(cfg(a)).endsWith('ひそんでいる……') && trueBossAwakeText(cfg(a)).endsWith('めざめた……'));
  }
});
