// 苦手な分野の分析: 単位の作り方、判定に要る数（境目）、並び順、得意・未着手、ホームの一行、画面の結線。
// 実行: cd shared && node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTree } from '../js/lib/data.js';
import {
  WEAK_MIN_ANSWERED, WEAK_MIN_QUESTIONS, WEAK_BELOW, WEAK_LIMIT, UNTOUCHED_LIMIT, STRONG_LIMIT, HOME_WEAK_BELOW,
  analysisUnits, ratePercent, unitStats, analyze, homeWeakCard, HOME_WEAK_COUNT,
  chapterStats, radarGeometry, tileLevel, TILE_MARK,
  allStats, questionsToJudge, wrongQuestions, statsByKey, normalizeWeakOrder, WEAK_ORDERS, DEFAULT_WEAK_ORDER,
} from '../js/lib/weakness.js';
import { weakMascot, isCharacterArt, characterName } from '../js/lib/characters.js';
import { pickQuestions } from '../js/lib/quiz.js';
import { APPS, swVersion, minVersion } from './apps.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');

// 小項目 name に n 問ある木を作る。spec: [[大, 章, 小, 問題数], ...]（小が null なら章に直接ぶら下がる）
function make(spec) {
  const qs = [];
  for (const [maj, st, sm, n] of spec) {
    for (let i = 0; i < n; i++) qs.push({ id: [maj, st, sm || '-', i].join('/'), syllabus: sm ? [maj, st, sm] : [maj, st] });
  }
  return { tree: buildTree(null, qs, []), qs };
}
// 先頭から k 問を答えた記録。ok 問が最後に正解
function answers(qs, prefix, k, ok) {
  const out = {};
  qs.filter((q) => q.id.startsWith(prefix + '/')).slice(0, k).forEach((q, i) => { out[q.id] = { seen: 1, correct: i < ok ? 1 : 0, lastOk: i < ok, step: -1, due: null }; });
  return out;
}

test('定数: 最低の数は5問、3問未満の項目は判定しない、苦手は80%未満（地図の定着と同じ線）', () => {
  assert.equal(WEAK_MIN_ANSWERED, 5);
  assert.equal(WEAK_MIN_QUESTIONS, 3);
  assert.equal(WEAK_BELOW, 0.8);
  assert.ok(WEAK_LIMIT >= 3 && WEAK_LIMIT <= 5);
  assert.ok(STRONG_LIMIT >= 1 && STRONG_LIMIT <= 2);
  assert.ok(UNTOUCHED_LIMIT >= 1);
  assert.ok(HOME_WEAK_BELOW <= WEAK_BELOW);
});

test('analysisUnits: 小項目ごと。小項目の無い章は章そのもの。章に直接の問題が残れば、章を1単位として足す', () => {
  const { tree } = make([['A', 'S1', 'a', 6], ['A', 'S1', 'b', 7], ['A', 'S2', null, 4], ['B', 'S3', 'c', 5]]);
  const u = analysisUnits(tree);
  assert.deepEqual(u.map((x) => x.name), ['a', 'b', 'S2', 'c']);
  assert.deepEqual(u.map((x) => x.partial), [true, true, false, true]);
  assert.equal(u[2].stage, u[2].node);
  const m = make([['A', 'S1', 'a', 6], ['A', 'S1', null, 3]]);
  const um = analysisUnits(m.tree);
  assert.deepEqual(um.map((x) => [x.name, x.questions.length, x.partial]), [['a', 6, true], ['S1', 3, true]]);
  assert.deepEqual(analysisUnits(null), []);
  assert.deepEqual(analysisUnits({ stages: [] }), []);
});

test('ratePercent: 切り捨て（79.5% を80%と出さない）。答えが無ければ null。浮動小数の誤差で1ずれない', () => {
  assert.equal(ratePercent(0, 0), null);
  assert.equal(ratePercent(1, 3), 33);
  assert.equal(ratePercent(2, 3), 66);
  assert.equal(ratePercent(159, 200), 79);
  assert.equal(ratePercent(29, 100), 29);
  assert.equal(ratePercent(7, 10), 70);
  assert.equal(ratePercent(5, 5), 100);
  assert.equal(ratePercent(0, 5), 0);
});

test('境目: 答えた数がちょうど5問は判定する／4問は判定しない', () => {
  const { tree, qs } = make([['A', 'S', 'x', 10]]);
  const u = analysisUnits(tree)[0];
  const at5 = unitStats(u, answers(qs, 'A/S/x', 5, 1));
  const at4 = unitStats(u, answers(qs, 'A/S/x', 4, 1));
  assert.equal(at5.qualified, true);
  assert.equal(at4.qualified, false);
  assert.equal(analyze(tree, answers(qs, 'A/S/x', 5, 1)).state, 'weak');
  const a4 = analyze(tree, answers(qs, 'A/S/x', 4, 1));
  assert.equal(a4.state, 'learning');
  assert.equal(a4.weak.length, 0);
  assert.equal(a4.remaining, 1); // あと1問で判定できる
});

test('境目: 問題が5問に満たない項目は、その全部を答えたら判定する。3問未満の項目は全部答えても判定しない', () => {
  const four = make([['A', 'S', 'x', 4]]);
  assert.equal(unitStats(analysisUnits(four.tree)[0], answers(four.qs, 'A/S/x', 4, 0)).qualified, true);
  assert.equal(unitStats(analysisUnits(four.tree)[0], answers(four.qs, 'A/S/x', 3, 0)).qualified, false);
  const three = make([['A', 'S', 'x', 3]]);
  assert.equal(unitStats(analysisUnits(three.tree)[0], answers(three.qs, 'A/S/x', 3, 0)).qualified, true);
  const two = make([['A', 'S', 'x', 2]]);
  const s2 = unitStats(analysisUnits(two.tree)[0], answers(two.qs, 'A/S/x', 2, 0));
  assert.equal(s2.judgeable, false);
  assert.equal(s2.qualified, false);
  assert.equal(analyze(two.tree, answers(two.qs, 'A/S/x', 2, 0)).state, 'none'); // 判定できる項目が1つも無い
});

test('全部不正解は0%の苦手、全部正解は100%で苦手に入れない（得意に入る）', () => {
  const { tree, qs } = make([['A', 'S', 'x', 6], ['A', 'S', 'y', 6]]);
  const st = { ...answers(qs, 'A/S/x', 6, 0), ...answers(qs, 'A/S/y', 6, 6) };
  const a = analyze(tree, st);
  assert.equal(a.state, 'weak');
  assert.deepEqual(a.weak.map((s) => [s.unit.name, s.percent]), [['x', 0]]);
  assert.deepEqual(a.strong.map((s) => [s.unit.name, s.percent]), [['y', 100]]);
});

test('全部が80%以上なら clear（苦手は無し）。79%台は苦手、ちょうど80%は苦手でない', () => {
  const { tree, qs } = make([['A', 'S', 'x', 5]]);
  const eighty = analyze(tree, answers(qs, 'A/S/x', 5, 4)); // 4/5 = 80%
  assert.equal(eighty.state, 'clear');
  assert.equal(eighty.weak.length, 0);
  assert.equal(eighty.strong.length, 1);
  const sixty = analyze(tree, answers(qs, 'A/S/x', 5, 3)); // 60%
  assert.equal(sixty.state, 'weak');
  const big = make([['A', 'S', 'x', 20]]);
  assert.equal(analyze(big.tree, answers(big.qs, 'A/S/x', 20, 16)).state, 'clear'); // 80%
  assert.equal(analyze(big.tree, answers(big.qs, 'A/S/x', 20, 15)).state, 'weak'); // 75%
});

test('並び: 正答率の低い順。同じなら答えた数の多い順、それも同じなら木の順', () => {
  const { tree, qs } = make([['A', 'S', 'a', 10], ['A', 'S', 'b', 10], ['A', 'S', 'c', 10], ['A', 'S', 'd', 10], ['A', 'S', 'e', 10]]);
  const st = {
    ...answers(qs, 'A/S/a', 5, 2), // 40%・5問
    ...answers(qs, 'A/S/b', 10, 4), // 40%・10問（aより答えた数が多い）
    ...answers(qs, 'A/S/c', 5, 2), // 40%・5問（aと同じ。木の順でaが先）
    ...answers(qs, 'A/S/d', 5, 0), // 0%
    ...answers(qs, 'A/S/e', 5, 3), // 60%
  };
  const a = analyze(tree, st);
  assert.deepEqual(a.weak.map((s) => s.unit.name), ['d', 'b', 'a', 'c']); // WEAK_LIMIT で切る
  assert.equal(a.weak.length, WEAK_LIMIT);
  assert.equal(a.weakTotal, 5);
  assert.equal(a.weak[a.weak.length - 1].unit.name, 'c');
});

test('得意: 高い順に STRONG_LIMIT 件まで。判定に入らない項目（4問だけ全問正解）は得意にも入れない', () => {
  const { tree, qs } = make([['A', 'S', 'a', 6], ['A', 'S', 'b', 6], ['A', 'S', 'c', 6], ['A', 'S', 'd', 10]]);
  const st = { ...answers(qs, 'A/S/a', 6, 5), ...answers(qs, 'A/S/b', 6, 6), ...answers(qs, 'A/S/c', 6, 6), ...answers(qs, 'A/S/d', 4, 4) };
  const a = analyze(tree, st);
  assert.deepEqual(a.strong.map((s) => s.unit.name), ['b', 'c']);
  assert.equal(a.strong.length, STRONG_LIMIT);
  assert.ok(!a.strong.some((s) => s.unit.name === 'd'));
});

test('まだ手を付けていない所: 答えた数が0の項目だけ。木の順で UNTOUCHED_LIMIT 件まで、全件数も返す', () => {
  const { tree, qs } = make([['A', 'S', 'a', 6], ['A', 'S', 'b', 6], ['A', 'S', 'c', 6], ['A', 'S', 'd', 6], ['A', 'S', 'e', 6]]);
  const a = analyze(tree, answers(qs, 'A/S/a', 1, 1));
  assert.deepEqual(a.untouched.map((s) => s.unit.name), ['b', 'c', 'd']);
  assert.equal(a.untouched.length, UNTOUCHED_LIMIT);
  assert.equal(a.untouchedTotal, 4);
  assert.equal(a.state, 'learning');
  assert.equal(a.remaining, 4); // aはあと4問（5-1）。ほかは5問
});

test('まだ何も答えていない: learning、あと5問。苦手・得意は空', () => {
  const { tree } = make([['A', 'S', 'a', 8]]);
  const a = analyze(tree, {});
  assert.equal(a.state, 'learning');
  assert.equal(a.remaining, WEAK_MIN_ANSWERED);
  assert.deepEqual([a.weak, a.strong], [[], []]);
  assert.equal(analyze(tree, undefined).state, 'learning');
});

test('問題が1つも無い木: none。壊れた記録（seen が無い・lastOk が文字）でも落ちない', () => {
  assert.equal(analyze(buildTree(null, [], []), {}).state, 'none');
  assert.equal(analyze(null, {}).state, 'none');
  const { tree, qs } = make([['A', 'S', 'a', 6]]);
  const broken = { [qs[0].id]: { lastOk: true }, [qs[1].id]: null, [qs[2].id]: { seen: 'x', lastOk: 'no' } };
  const a = analyze(tree, broken);
  assert.ok(['learning', 'weak', 'clear'].includes(a.state));
});

test('同じ問題を何度答えても、答えた数は「別々の問題」の数（最後の結果で数える）', () => {
  const { tree, qs } = make([['A', 'S', 'a', 8]]);
  const st = { [qs[0].id]: { seen: 9, correct: 0, lastOk: false } };
  const s = unitStats(analysisUnits(tree)[0], st);
  assert.equal(s.answered, 1);
  assert.equal(s.qualified, false);
});

test('ホームの苦手の分析カード: 苦手があれば低い順に2分野まで。苦手なしは clear、判定に入る分野がまだ無いときは none（いつも出す）', () => {
  const { tree, qs } = make([['A', 'S', 'x', 10], ['A', 'S', 'y', 10], ['A', 'S', 'z', 10]]);
  const st = { ...answers(qs, 'A/S/x', 10, 5), ...answers(qs, 'A/S/y', 10, 7), ...answers(qs, 'A/S/z', 10, 6) };
  const c = homeWeakCard(analyze(tree, st));
  assert.equal(c.kind, 'weak');
  assert.deepEqual(c.items.map((s) => s.unit.name), ['x', 'z']); // 50%・60%（70%のyは3番目）
  assert.equal(c.items.length, HOME_WEAK_COUNT);
  assert.equal(homeWeakCard(analyze(tree, answers(qs, 'A/S/x', 10, 6))).items.length, 1); // 60%でも出す（以前の60%未満だけの決まりは外した）
  assert.equal(homeWeakCard(analyze(tree, answers(qs, 'A/S/x', 10, 9))).kind, 'clear');
  assert.equal(homeWeakCard(analyze(tree, {})).kind, 'none');
  assert.equal(homeWeakCard(analyze(buildTree(null, [], []), {})).kind, 'none');
  assert.equal(homeWeakCard(null).kind, 'none');
  assert.deepEqual(homeWeakCard(null).items, []);
});

test('tileLevel: 60%未満は赤、60〜79%は黄、80%以上は緑、判定に足りない・未回答は灰。境目の前後', () => {
  const { tree, qs } = make([['A', 'S', 'a', 10]]);
  const lv = (ok, k = 10) => tileLevel(allStats(tree, answers(qs, 'A/S/a', k, ok))[0]);
  assert.equal(lv(5), 'ng'); // 50%
  assert.equal(lv(6), 'mid'); // 60%ちょうどは黄
  assert.equal(lv(7), 'mid'); // 70%
  assert.equal(lv(8), 'ok'); // 80%ちょうどは緑
  assert.equal(lv(10), 'ok');
  assert.equal(lv(0), 'ng');
  assert.equal(lv(2, 4), 'none'); // 4問しか答えていない＝判定に足りない
  assert.equal(tileLevel(allStats(tree, {})[0]), 'none');
  assert.equal(tileLevel(null), 'none');
  assert.deepEqual(Object.keys(TILE_MARK).sort(), ['mid', 'ng', 'none', 'ok']);
  assert.equal(TILE_MARK.none, '');
  assert.equal(new Set([TILE_MARK.ok, TILE_MARK.mid, TILE_MARK.ng]).size, 3, '色だけに頼らない（記号が3つ違う）');
});

test('chapterStats: 章ごとに、章の中の全問題を1単位として同じ決め方で数える。問題の無い章は入らない', () => {
  const { tree, qs } = make([['A', 'S1', 'a', 6], ['A', 'S1', 'b', 6], ['A', 'S2', null, 4], ['B', 'S3', 'c', 2]]);
  const st = { ...answers(qs, 'A/S1/a', 6, 6), ...answers(qs, 'A/S1/b', 6, 0) };
  const ch = chapterStats(tree, st);
  assert.deepEqual(ch.map((s) => s.unit.name), ['S1', 'S2', 'S3']);
  assert.equal(ch[0].total, 12);
  assert.equal(ch[0].answered, 12);
  assert.equal(ch[0].percent, 50); // 6/12
  assert.equal(ch[0].qualified, true);
  assert.equal(ch[1].qualified, false);
  assert.equal(ch[2].judgeable, false); // 2問の章は全部答えても判定しない（分野と同じ決まり）
  // 章の1つが、その中の分野の数え方と食い違わない（分野の答えた数の合計＝章の答えた数）
  const parts = allStats(tree, st).filter((s) => s.unit.stage.key === ch[0].unit.key);
  assert.equal(parts.reduce((n, s) => n + s.answered, 0), ch[0].answered);
  assert.deepEqual(chapterStats(null, {}), []);
});

test('radarGeometry: 軸は真上から時計回り。判定に足りない章は value=null で点を結ばない（0にしない）', () => {
  const { tree, qs } = make([['A', 'S1', null, 10], ['A', 'S2', null, 10], ['A', 'S3', null, 10], ['A', 'S4', null, 10]]);
  const st = { ...answers(qs, 'A/S1', 10, 10), ...answers(qs, 'A/S2', 10, 5), ...answers(qs, 'A/S3', 3, 3) };
  const g = radarGeometry(chapterStats(tree, st), { cx: 100, cy: 100, r: 50 });
  assert.equal(g.axes.length, 4);
  assert.ok(Math.abs(g.axes[0].ox - 100) < 1e-9 && Math.abs(g.axes[0].oy - 50) < 1e-9, '1本目は真上');
  assert.ok(Math.abs(g.axes[1].ox - 150) < 1e-9 && Math.abs(g.axes[1].oy - 100) < 1e-9, '2本目は右（時計回り）');
  assert.equal(g.axes[0].value, 1);
  assert.equal(g.axes[1].value, 0.5);
  assert.ok(Math.abs(g.axes[1].vx - 125) < 1e-9, '50%は半径の半分');
  assert.equal(g.axes[2].value, null);
  assert.equal(g.axes[3].value, null);
  assert.equal(g.axes[2].vx, null);
  assert.equal(g.solid.length, 2);
  assert.equal(g.closed, false);
  const all3 = radarGeometry(chapterStats(tree, { ...st, ...answers(qs, 'A/S3', 10, 10) }), { cx: 0, cy: 0, r: 10 });
  assert.equal(all3.solid.length, 3);
  assert.equal(all3.closed, true);
  assert.deepEqual(radarGeometry([], {}).axes, []);
  assert.equal(radarGeometry(chapterStats(tree, {}), {}).solid.length, 0);
  assert.ok(g.axes.every((a) => Number.isFinite(a.lx) && Number.isFinite(a.ly)));
});

test('「ここを解く」の出題: 未回答→前回まちがえた→前回正解の順（pickQuestions）で、その範囲の問題だけ', () => {
  const { tree, qs } = make([['A', 'S', 'x', 8], ['A', 'S', 'y', 8]]);
  const st = { ...answers(qs, 'A/S/x', 6, 3) };
  const u = analysisUnits(tree)[0];
  const picked = pickQuestions(u.questions, st, 4, () => 0.5);
  assert.equal(picked.length, 4);
  assert.ok(picked.every((q) => q.id.startsWith('A/S/x/')));
  // 未回答（x の最後の2問）と前回まちがえた問題が先に入り、前回正解の問題は入らない
  const ids = new Set(picked.map((q) => q.id));
  for (const q of u.questions) {
    const r = st[q.id];
    if (r && r.lastOk) assert.ok(!ids.has(q.id), q.id + ' は前回正解なので後回し');
  }
});

test('weakMascot: 状態ごとに先生が1人。分析できない（none）・数が不正のときは出さない', () => {
  assert.equal(weakMascot('weak').art, 'sensei-point');
  assert.equal(weakMascot('clear').art, 'sensei-ok');
  const l = weakMascot('learning', 3);
  assert.equal(l.art, 'sensei-think');
  assert.ok(l.text.includes('あと3問') && l.text.includes('苦手が分かる'));
  assert.equal(weakMascot('learning', 0), null);
  assert.equal(weakMascot('learning', NaN), null);
  assert.equal(weakMascot('none'), null);
  for (const m of [weakMascot('weak'), weakMascot('clear'), l]) {
    assert.ok(isCharacterArt(m.art));
    assert.equal(characterName(m.art), 'あい先生');
  }
});

test('結線: オフライン登録・テスト登録・両アプリの版・もっと／ルート／ホームの入口', () => {
  const sw = readFileSync(join(shared, 'sw-core.js'), 'utf8');
  assert.ok(sw.includes("'../shared/js/lib/weakness.js'"));
  assert.ok(sw.includes("'../shared/js/views/weak.js'"));
  const pkg = readFileSync(join(shared, 'package.json'), 'utf8');
  assert.ok(pkg.includes('tests/weakness.test.js'));
  for (const app of APPS) {
    assert.ok(swVersion(app) >= minVersion(app, 31), app + ' の版が31以上（後から作ったアプリは1以上）');
  }
  const appjs = readFileSync(join(shared, 'js', 'app.js'), 'utf8');
  assert.ok(/\['weak',\s*'more',\s*\(k\)\s*=>\s*renderWeak\(app,\s*k\)\]/.test(appjs));
  assert.ok(readFileSync(join(shared, 'js', 'views', 'more.js'), 'utf8').includes("go('#/weak')"));
  const home = readFileSync(join(shared, 'js', 'views', 'home.js'), 'utf8');
  assert.ok(home.includes('homeWeakCard(') && home.includes('weakSpec(') && !home.includes('weak-line'));
});

// ---- すべての分野（要件定義書 §6-4） ----

test('allStats: 章の順は木の順。数は analyze と同じ（同じ数を別に数えない）', () => {
  const { tree, qs } = make([['A', 'S', 'a', 10], ['A', 'S', 'b', 10], ['A', 'S', 'c', 10]]);
  const st = { ...answers(qs, 'A/S/a', 5, 1), ...answers(qs, 'A/S/b', 5, 5) };
  const all = allStats(tree, st, 'tree');
  assert.deepEqual(all.map((s) => s.unit.name), ['a', 'b', 'c']);
  const an = analyze(tree, st);
  assert.equal(an.weak[0].percent, all[0].percent);
  assert.equal(an.strong[0].percent, all[1].percent);
  assert.equal(allStats(tree, st).length, 3, '並べ方を省くと章の順');
  assert.deepEqual(allStats(buildTree(null, [], []), {}), []);
  assert.deepEqual(allStats(null, {}), []);
});

test('allStats: 正答率の低い順。判定に入った分野が先、足りない分野（未着手・途中）は章の順で最後。同じ率は答えた数の多い順', () => {
  const { tree, qs } = make([['A', 'S', 'a', 10], ['A', 'S', 'b', 10], ['A', 'S', 'c', 10], ['A', 'S', 'd', 10], ['A', 'S', 'e', 10]]);
  const st = {
    ...answers(qs, 'A/S/a', 5, 5), // 100%
    ...answers(qs, 'A/S/b', 3, 0), // 判定に足りない（3問）
    ...answers(qs, 'A/S/d', 10, 5), // 50%・10問
    ...answers(qs, 'A/S/e', 5, 2), // 40%
  };
  assert.deepEqual(allStats(tree, st, 'rate').map((s) => s.unit.name), ['e', 'd', 'a', 'b', 'c']);
  const same = { ...answers(qs, 'A/S/a', 5, 2), ...answers(qs, 'A/S/d', 10, 4) }; // 40%と40%
  assert.deepEqual(allStats(tree, same, 'rate').map((s) => s.unit.name).slice(0, 2), ['d', 'a'], '答えた数の多いほうが先');
  assert.deepEqual(allStats(tree, st, 'bad').map((s) => s.unit.name), ['a', 'b', 'c', 'd', 'e'], 'ありえない並べ方は章の順');
});

test('allStats: 小項目の無い章は章として出る。小項目に問題が無ければ出ない', () => {
  const { tree } = make([['A', 'S1', 'a', 6], ['A', 'S2', null, 4]]);
  assert.deepEqual(allStats(tree, {}).map((s) => s.unit.name), ['a', 'S2']);
});

test('questionsToJudge: 判定に足りない分野だけ「あと何問」。判定済み・3問未満の分野は null', () => {
  const { tree, qs } = make([['A', 'S', 'x', 10], ['A', 'S', 'y', 2], ['A', 'S', 'z', 4]]);
  const st = { ...answers(qs, 'A/S/x', 3, 1), ...answers(qs, 'A/S/z', 4, 4) };
  const by = (n, rec) => allStats(tree, rec).find((s) => s.unit.name === n);
  assert.equal(questionsToJudge(by('x', st)), 2); // 5-3
  assert.equal(questionsToJudge(by('y', st)), null); // 2問しか無い
  assert.equal(questionsToJudge(by('z', st)), null); // 4問全部答えて判定済み
  assert.equal(questionsToJudge(null), null);
  assert.equal(questionsToJudge(by('x', {})), 5);
});

test('wrongQuestions: 最後に間違えた問題だけ（木の順）。正解・未回答・壊れた記録は入らない。0問なら空', () => {
  const { tree, qs } = make([['A', 'S', 'x', 6]]);
  const u = analysisUnits(tree)[0];
  const st = {
    [qs[0].id]: { seen: 3, correct: 1, lastOk: false },
    [qs[1].id]: { seen: 1, correct: 1, lastOk: true },
    // qs[2] は未回答
    [qs[3].id]: { seen: 2, correct: 2, lastOk: false },
    [qs[4].id]: null,
    [qs[5].id]: { lastOk: false }, // seen が無い
  };
  assert.deepEqual(wrongQuestions(u, st).map((q) => q.id), [qs[0].id, qs[3].id]);
  assert.deepEqual(wrongQuestions(u, {}), []);
  assert.deepEqual(wrongQuestions(u, undefined), []);
  assert.deepEqual(wrongQuestions(null, st), []);
  assert.deepEqual(wrongQuestions(u, answers(qs, 'A/S/x', 6, 6)), []);
  // ほかの分野の間違いは入らない
  const two = make([['A', 'S', 'x', 3], ['A', 'S', 'y', 3]]);
  assert.deepEqual(wrongQuestions(analysisUnits(two.tree)[0], answers(two.qs, 'A/S/y', 3, 0)), []);
});

test('statsByKey: 小項目・小項目の無い章は入る。小項目を持つ章に直接ぶら下がる問題だけの単位は章の見出しに当てない', () => {
  const m = make([['A', 'S1', 'a', 6], ['A', 'S1', null, 3], ['A', 'S2', null, 4]]);
  const map = statsByKey(m.tree, {});
  assert.deepEqual([...map.keys()].sort(), ['A|S1|a', 'A|S2'].sort());
  assert.equal(map.get('A|S1|a').total, 6);
  assert.equal(map.has('A|S1'), false, 'S1 の見出しには数を出さない');
  const st = answers(m.qs, 'A/S2', 4, 3);
  assert.equal(statsByKey(m.tree, st).get('A|S2').percent, 75);
  assert.equal(statsByKey(m.tree, st).get('A|S2').percent, allStats(m.tree, st).find((s) => s.unit.key === 'A|S2').percent, '苦手の分析と同じ数');
});

test('並べ方の設定: 既定は章の順。ありえない値は章の順', () => {
  assert.deepEqual(WEAK_ORDERS, ['tree', 'rate']);
  assert.equal(DEFAULT_WEAK_ORDER, 'tree');
  assert.equal(normalizeWeakOrder('rate'), 'rate');
  for (const v of [undefined, null, 3, 'x', {}]) assert.equal(normalizeWeakOrder(v), 'tree');
});

test('結線: 設定の保存・画面（すべての分野／まちがえた問題を解く）・カードの見出し・出題', async () => {
  const { defaultState, mergeState } = await import('../js/lib/progress.js');
  assert.equal(defaultState().settings.weakOrder, 'tree');
  assert.equal(mergeState({ settings: { weakOrder: 'rate' } }).settings.weakOrder, 'rate');
  assert.equal(mergeState({ settings: { weakOrder: 'bad' } }).settings.weakOrder, 'tree');
  assert.equal(mergeState({ settings: { theme: 'dark' } }).settings.weakOrder, 'tree', '古い記録（項目なし）');
  const weak = readFileSync(join(shared, 'js', 'views', 'weak.js'), 'utf8');
  assert.ok(weak.includes('すべての分野') && weak.includes('まちがえた問題を解く') && weak.includes('全部解く'));
  assert.ok(/state\.settings\.weakOrder\s*=/.test(weak), '選んだ並べ方を保存する');
  assert.ok(weak.includes('wrongSpec(') && weak.includes('allStats('));
  const cards = readFileSync(join(shared, 'js', 'views', 'cards.js'), 'utf8');
  assert.ok(cards.includes('statsByKey(') && cards.includes("'#/weak/'"));
  const home = readFileSync(join(shared, 'js', 'views', 'home.js'), 'utf8');
  assert.ok(home.includes('export function wrongSpec') && home.includes('wrongQuestions('));
});

test('結線: ホームのカードをいつも置く・復習の画面の入口・苦手の分析の画面のレーダーとタイル', () => {
  const home = readFileSync(join(shared, 'js', 'views', 'home.js'), 'utf8');
  assert.ok(home.includes('weakHomeCard(app)') && home.includes('data-review-weak-entry'));
  const rv = home.slice(home.indexOf('export function renderReview'));
  assert.ok(rv.indexOf('data-review-weak-entry') < rv.indexOf('復習を始める'), '復習の画面のいちばん上に入口');
  const weak = readFileSync(join(shared, 'js', 'views', 'weak.js'), 'utf8');
  assert.ok(weak.includes('radarGeometry(') && weak.includes('chapterStats(') && weak.includes('tileLevel(') && weak.includes('TILE_MARK'));
  assert.ok(weak.indexOf('overview(app)') < weak.indexOf('weakMascot(a.state'), '画面のいちばん上に置く');
});
