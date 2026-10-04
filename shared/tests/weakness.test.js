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
  analysisUnits, ratePercent, unitStats, analyze, homeWeak, homeWeakText,
} from '../js/lib/weakness.js';
import { weakMascot, isCharacterArt, characterName } from '../js/lib/characters.js';
import { pickQuestions } from '../js/lib/quiz.js';

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

test('ホームの一行: 一番苦手な所が60%未満のときだけ。60%ちょうど・苦手なし・分析なしは出さない', () => {
  const { tree, qs } = make([['A', 'S', 'x', 10]]);
  const low = analyze(tree, answers(qs, 'A/S/x', 10, 5)); // 50%
  assert.equal(homeWeak(low).unit.name, 'x');
  assert.equal(homeWeakText(homeWeak(low)), '苦手：x（正答率50%）を解く');
  assert.equal(homeWeak(analyze(tree, answers(qs, 'A/S/x', 10, 6))), null); // 60%
  assert.equal(homeWeak(analyze(tree, answers(qs, 'A/S/x', 10, 9))), null);
  assert.equal(homeWeak(analyze(tree, {})), null);
  assert.equal(homeWeak(null), null);
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
  for (const app of ['g-kentei', 'dx-biz']) {
    const v = readFileSync(join(shared, '..', app, 'sw.js'), 'utf8').match(/version:\s*'(\d+)'/);
    assert.ok(v && Number(v[1]) >= 31, app + ' の版が31以上');
  }
  const appjs = readFileSync(join(shared, 'js', 'app.js'), 'utf8');
  assert.ok(/\['weak',\s*'more',\s*\(\)\s*=>\s*renderWeak\(app\)\]/.test(appjs));
  assert.ok(readFileSync(join(shared, 'js', 'views', 'more.js'), 'utf8').includes("go('#/weak')"));
  const home = readFileSync(join(shared, 'js', 'views', 'home.js'), 'utf8');
  assert.ok(home.includes('homeWeak(') && home.includes('weakSpec('));
});
