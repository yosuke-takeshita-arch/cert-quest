// 取っていないバッジの見せ方（3段）とタップのバッジ（要件定義書 §3-8-b）。
// 実行: cd shared && node --test tests/badges-tier.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgeDefs, awardBadges, badgeTier, badgeView, SHADOW_BADGE_IDS, SECRET_BADGE_IDS, SECRET_BADGE_TEXT } from '../js/lib/badges.js';
import { nextGoals } from '../js/lib/goals.js';
import { defaultState, mergeState } from '../js/lib/progress.js';
import { recordTap, markTapBadge, normalizeCharTap100, TAP_BADGE_COUNT } from '../js/lib/characters.js';
import { parseBackup, serializeBackup } from '../js/lib/backup.js';

function tree() {
  const st = (key, n) => ({ key, name: '章' + key, questions: Array.from({ length: n }, (_, i) => ({ id: key + i })), children: [] });
  const a = st('T|A', 10);
  const b = st('T|B', 10);
  return { roots: [{ key: 'T', id: 'T', name: 'T', children: [a, b] }], stages: [a, b] };
}
// 真ボスを出すアプリ（G検定。config の trueBoss）の定義。ひみつの『真ボス』のバッジ（要件定義書 §3-9）も入る
const defs = () => badgeDefs(tree(), { challenge: {}, secondsPerQuestion: 40, trueBoss: true });
const def = (id) => defs().find((d) => d.id === id);

test('段: 姿がわからない6つ・ひみつ8つ（真ボスを含む）、それ以外（章の制覇・大項目の制覇を含む）はふつう', () => {
  assert.equal(SHADOW_BADGE_IDS.length, 6);
  assert.equal(SECRET_BADGE_IDS.length, 8);
  const all = defs();
  for (const id of SHADOW_BADGE_IDS) assert.equal(badgeTier(all.find((d) => d.id === id)), 'shadow', id);
  for (const id of SECRET_BADGE_IDS) assert.equal(badgeTier(all.find((d) => d.id === id)), 'secret', id); // boss-all・タップの2つも定義に在る
  const normal = ['first-answer', 'correct-10', 'streak-3', 'level-5', 'exam-first', 'boss-first'];
  for (const id of normal) assert.equal(badgeTier(def(id)), 'normal', id);
  assert.equal(badgeTier(def('major:T')), 'normal');
  assert.equal(badgeTier(def('chapter:T|A')), 'normal');
  // 3つの段は重ならず、全部で 8 + 6 + 8 の共通バッジ（+ 大項目・章）
  const tiers = all.map((d) => badgeTier(d));
  assert.equal(tiers.filter((x) => x === 'shadow').length, 6);
  assert.equal(tiers.filter((x) => x === 'secret').length, 8);
  assert.equal(new Set([...SHADOW_BADGE_IDS, ...SECRET_BADGE_IDS]).size, 14);
  assert.equal(badgeTier(null), 'normal');
});

test('見え方: ふつうは条件と棒を出す／姿がわからないは影＋名前・条件・棒／ひみつは『？』だけ', () => {
  const n = badgeView(def('first-answer'), undefined);
  assert.deepEqual([n.showArt, n.silhouette, n.name, n.showProgress], [true, false, 'はじめの一歩', true]);
  const s = badgeView(def('correct-100'), undefined);
  assert.deepEqual([s.showArt, s.silhouette, s.name, s.desc, s.showProgress], [true, true, '100問正解', '通算100問正解', true]);
  const x = badgeView(def('streak-30'), undefined);
  assert.equal(x.showArt, false);
  assert.equal(x.name, SECRET_BADGE_TEXT.title);
  assert.equal(x.desc, SECRET_BADGE_TEXT.desc);
  assert.equal(x.showProgress, false);
  // ひみつの見え方に、本当の名前・条件が1文字も入らない（読み上げ用の label も）
  for (const id of SECRET_BADGE_IDS) {
    const d = def(id);
    const v = badgeView(d, undefined);
    const text = JSON.stringify(v);
    assert.ok(!text.includes(d.name), id + ' name');
    assert.ok(!text.includes(d.desc), id + ' desc');
  }
});

test('見え方: 取ったバッジは、どの段でも名前・条件を全部出す（影にしない）', () => {
  for (const id of [...SHADOW_BADGE_IDS, ...SECRET_BADGE_IDS, 'first-answer']) {
    const d = def(id);
    const v = badgeView(d, '2026-10-20');
    assert.equal(v.got, true, id);
    assert.equal(v.showArt, true, id);
    assert.equal(v.silhouette, false, id);
    assert.equal(v.name, d.name, id);
    assert.equal(v.desc, d.desc, id);
    assert.equal(v.showProgress, false, id);
    assert.equal(v.label, d.name, id);
  }
});

test('次の目標: ひみつのバッジは、あと少しで取れる状態でも候補に出ない', () => {
  const s = defaultState();
  s.totals = { answered: 50, correct: 50 };
  s.streak = { last: '2026-10-20', count: 29, best: 29 }; // streak-30 まであと1日
  s.exams = [{ total: 100, correct: 89 }]; // exam-90 まであと1%
  s.dochi = { runs: 1, best: 19, bestCombo: 9 }; // dochi-perfect まであと1問
  const goals = nextGoals(tree(), defs(), s, '2026-10-20', 100);
  const ids = goals.map((g) => g.id);
  for (const id of SECRET_BADGE_IDS) assert.ok(!ids.includes(id), id);
  // 姿がわからない段は、これまでどおり候補に出る
  assert.ok(ids.includes('correct-100'));
  assert.ok(ids.includes('streak-7'));
  // 取っていないタップのバッジも候補に出ない
  assert.ok(!ids.includes('tap-shiba-100') && !ids.includes('tap-sensei-100'));
});

test('タップ: 99回では立たず100回で立つ。立つのは新しく立った1回だけ（境目）', () => {
  const s = defaultState();
  const session = { charTaps: { shiba: 0, sensei: 0 } };
  let first = null;
  for (let i = 1; i <= 120; i++) {
    const r = recordTap(session, 'shiba');
    if (markTapBadge(s, 'shiba', r.count)) {
      assert.equal(first, null, '2回立たない');
      first = r.count;
    }
  }
  assert.equal(first, TAP_BADGE_COUNT);
  assert.equal(s.charTap100.shiba, true);
  assert.equal(s.charTap100.sensei, false); // あい先生は別に数える
  assert.equal(markTapBadge(defaultState(), 'shiba', 99), false);
  assert.equal(markTapBadge(defaultState(), 'sensei', 100), true);
  assert.equal(markTapBadge(defaultState(), 'dog', 100), false);
  assert.equal(markTapBadge(null, 'shiba', 100), false);
  assert.equal(markTapBadge(defaultState(), 'shiba', 100.5), false);
  assert.equal(markTapBadge(defaultState(), 'shiba', '100'), false);
});

test('タップ: 立った記録でバッジが取れ、それぞれ別のバッジ。二度は取らない', () => {
  const s = defaultState();
  assert.deepEqual(awardBadges(s, defs(), '2026-10-20').map((d) => d.id), []);
  markTapBadge(s, 'shiba', 100);
  assert.deepEqual(awardBadges(s, defs(), '2026-10-20').map((d) => d.id), ['tap-shiba-100']);
  markTapBadge(s, 'sensei', 100);
  assert.deepEqual(awardBadges(s, defs(), '2026-10-21').map((d) => d.id), ['tap-sensei-100']);
  assert.equal(s.badges['tap-shiba-100'], '2026-10-20');
  assert.deepEqual(awardBadges(s, defs(), '2026-10-22').map((d) => d.id), []);
  assert.equal(def('tap-shiba-100').name, 'サニーとなかよし');
  assert.equal(def('tap-sensei-100').name, 'あい先生の根気くらべ');
});

test('古い保存データ: 項目なし・壊れた値は両方 false。タップ回数そのものは保存されない', () => {
  assert.deepEqual(mergeState({}).charTap100, { shiba: false, sensei: false });
  assert.deepEqual(mergeState({ charTap100: 'yes' }).charTap100, { shiba: false, sensei: false });
  assert.deepEqual(mergeState({ charTap100: [true, true] }).charTap100, { shiba: false, sensei: false });
  assert.deepEqual(mergeState({ charTap100: { shiba: 1, sensei: 'true' } }).charTap100, { shiba: false, sensei: false });
  assert.deepEqual(mergeState({ charTap100: { shiba: true, sensei: false, x: true } }).charTap100, { shiba: true, sensei: false });
  assert.equal('charTaps' in mergeState({ charTaps: { shiba: 500, sensei: 5 } }), false); // 既存の決まり: 回数は捨てる
  assert.deepEqual(normalizeCharTap100(null), { shiba: false, sensei: false });
  // 古い記録で、すでに取ったバッジ（取得の記録）は変わらない
  const old = mergeState({ badges: { 'streak-30': '2026-09-01' } });
  assert.equal(old.badges['streak-30'], '2026-09-01');
});

test('書き出し → 読み込み: 100回に達した事実が残る', () => {
  const s = defaultState();
  markTapBadge(s, 'sensei', 100);
  const r = parseBackup(serializeBackup('g-kentei', s), 'g-kentei');
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.charTap100, { shiba: false, sensei: true });
});
