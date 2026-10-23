// ボス戦の経験値（要件定義書 §3-9『ボス戦の経験値』）: 倍率（切り上げ）・撃破のごほうび・学習記録の XP の合計。
// 実行: cd shared && node --test tests/boss-xp.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BOSS_XP, scaleXp, answerXp, levelFromXp } from '../js/lib/scoring.js';
import { defaultState, recordAnswer, addBonusXp } from '../js/lib/progress.js';

const read = (p) => readFileSync(fileURLToPath(new URL('../' + p, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const q = (id) => ({ id, syllabus: ['a', 'b', 'c'] });

test('倍率とごほうびの数はここ1か所: 章のボス 1.5倍・+30、真ボス 2倍・+150', () => {
  assert.deepEqual({ ...BOSS_XP }, { chapterMul: 1.5, chapterWin: 30, trueMul: 2, trueWin: 150 });
  assert.throws(() => { BOSS_XP.chapterWin = 1; }, TypeError, '書き換えられない');
});

test('scaleXp: 倍率をかけて切り上げ。0・負・壊れた値は 0', () => {
  assert.equal(scaleXp(10, 1.5), 15);
  assert.equal(scaleXp(15, 1.5), 23, '22.5 は切り上げて 23');
  assert.equal(scaleXp(13, 1.5), 20, '19.5 → 20');
  assert.equal(scaleXp(18, 1.5), 27);
  assert.equal(scaleXp(1, 1.5), 2);
  assert.equal(scaleXp(10, 2), 20);
  assert.equal(scaleXp(15, 2), 30);
  assert.equal(scaleXp(33, 2), 66);
  assert.equal(scaleXp(15, 1.1), 17, '16.5 は切り上げて 17（小数の誤差で 18 にならない）');
  assert.equal(scaleXp(10, 1), 10);
  for (const bad of [0, -5, NaN, null, undefined, 'x', Infinity]) assert.equal(scaleXp(bad, 1.5), 0, String(bad));
  for (const bad of [0, -1, NaN, null, undefined, Infinity]) assert.equal(scaleXp(10, bad), 0, String(bad));
});

test('recordAnswer: xpMul をかけた XP が、答えの XP・記録の合計・レベルに入る。誤答は 0 のまま。xpMul 無しはこれまでどおり', () => {
  const now = new Date(2026, 9, 24, 12, 0, 0);
  const base = answerXp({ correct: true, firstTry: true, streak: 0, seconds: 5, limit: 40 }).total; // 10+5+3=18
  assert.equal(base, 18);
  const s0 = defaultState();
  const r0 = recordAnswer(s0, q('x1'), { correct: true, seconds: 5, now });
  assert.equal(r0.xp, 18);
  assert.equal(s0.xp, 18);
  const s1 = defaultState();
  const r1 = recordAnswer(s1, q('x1'), { correct: true, seconds: 5, now, xpMul: BOSS_XP.chapterMul });
  assert.equal(r1.xp, 27, '18 × 1.5 = 27');
  assert.equal(s1.xp, 27, '記録の XP も倍率ぶん');
  const s2 = defaultState();
  const r2 = recordAnswer(s2, q('x1'), { correct: true, seconds: 5, now, xpMul: BOSS_XP.trueMul });
  assert.equal(r2.xp, 36);
  assert.equal(s2.xp, 36);
  const s3 = defaultState();
  const r3 = recordAnswer(s3, q('x1'), { correct: false, seconds: 5, now, xpMul: 2 });
  assert.equal(r3.xp, 0);
  assert.equal(s3.xp, 0);
  assert.equal(s3.totals.answered, 1);
  // 切り上げが出る例: 連続正解で 10+(2-1)*2=12 → 12×1.5=18。10+2+... 15 → 22.5 → 23
  const s4 = defaultState();
  s4.qstats.x9 = { seen: 1, correct: 1, lastOk: true, step: 0, due: null };
  const r4 = recordAnswer(s4, q('x9'), { correct: true, seconds: 50, sessionStreak: 3, now, xpMul: 1.5 }); // 10 + 4 = 14（初めてでない・時間超過）→ 21
  assert.equal(r4.xp, 21);
  assert.deepEqual(Object.keys(r1.parts).sort(), ['base', 'first', 'streak', 'time'], '内訳は倍率の前のまま');
});

test('addBonusXp: ごほうびを記録の XP に足し、レベルが上がったかも返す。0以下・壊れた値は足さない', () => {
  const s = defaultState();
  const a = addBonusXp(s, BOSS_XP.chapterWin);
  assert.equal(a.xp, 30);
  assert.equal(s.xp, 30);
  assert.equal(a.levelBefore, 1);
  assert.equal(a.leveledUp, false);
  const b = addBonusXp(s, BOSS_XP.trueWin);
  assert.equal(s.xp, 180);
  assert.equal(b.leveledUp, true, '30 → 180 で Lv1 → Lv3');
  assert.equal(b.levelAfter, levelFromXp(180).level);
  for (const bad of [0, -10, NaN, undefined, null, 'x', Infinity]) { const t = defaultState(); assert.equal(addBonusXp(t, bad).xp, 0, String(bad)); assert.equal(t.xp, 0); }
  assert.equal(addBonusXp(defaultState(), 12.9).xp, 12);
});

test('学習記録の XP の合計: 1回の勝ち＝（1問ごとの倍率ぶん）＋ごほうび。章のボス・真ボス', () => {
  const now = new Date(2026, 9, 24, 12, 0, 0);
  for (const [mul, win] of [[BOSS_XP.chapterMul, BOSS_XP.chapterWin], [BOSS_XP.trueMul, BOSS_XP.trueWin]]) {
    const s = defaultState();
    let shown = 0;
    for (let i = 0; i < 6; i++) shown += recordAnswer(s, q('b' + i), { correct: true, seconds: 5, sessionStreak: i + 1, now, xpMul: mul }).xp;
    shown += addBonusXp(s, win).xp;
    assert.equal(s.xp, shown, '画面の「獲得」の合計と、記録の XP が同じ');
  }
});

test('画面: 章のボスも真ボスも、答えは倍率つきで記録し、勝った1回だけごほうびを足す。撃破の数え上げ・結果に内訳を出す', () => {
  for (const [file, mul, win] of [['js/views/boss.js', 'chapterMul', 'chapterWin'], ['js/views/trueboss.js', 'trueMul', 'trueWin']]) {
    const src = read(file);
    assert.ok(src.includes('xpMul: BOSS_XP.' + mul), file);
    assert.ok(src.includes("b.result === 'win' && !S.winBonus) { S.winBonus = BOSS_XP." + win + '; S.xp += S.winBonus; app.addXp(S.winBonus); }'), file + ': 勝ったときだけ・1回だけ');
    assert.match(src, /撃破のごほうび \+' \+ \(S\.winBonus \|\| 0\)/, file + ': 数え上げのあとに内訳');
    assert.match(src, /win && S\.winBonus \? h\('p', \{ class: 'small muted', 'data-boss-xp-bonus-result': '1'/, file + ': 結果の内訳（勝ったときだけ）');
    assert.match(src, /bonusEl\.classList\.remove\('hidden'\)/, file);
  }
  assert.match(read('js/app.js'), /addXp\(amount\) \{\s*const r = addBonusXp\(app\.state, amount\);\s*app\.commit\(\);/, '保存とレベルアップのお祝いは commit に任せる');
  assert.doesNotMatch(read('js/views/boss.js'), /BOSS_XP\.true/);
});
