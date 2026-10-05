// キャラクター（柴犬と先生）: どの場面でどの絵を出すかの決まりと、素材・オフライン登録の食い違い。
// 実行: cd shared && node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHARACTER_ART, CHARACTER_TEXT, CHARACTER_NAMES, characterName, AWAY_DAYS, isCharacterArt, characterImageUrl, daysSinceLastStudy, homeMascot,
  trailingWrong, shouldCheer, explainSensei, TIP_SENSEI, examMascot, celebrationMascot,
} from '../js/lib/characters.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const stateOf = (last) => ({ streak: { last, count: 1, best: 1 } });

test('素材: 12枚が shared/images/characters/ にあり、webp で、中身がある', () => {
  assert.equal(CHARACTER_ART.length, 12);
  assert.equal(new Set(CHARACTER_ART).size, 12);
  for (const n of CHARACTER_ART) {
    const p = join(shared, 'images', 'characters', n + '.webp');
    assert.ok(existsSync(p), n + ' が無い');
    assert.ok(statSync(p).size > 5000, n + ' が小さすぎる');
    assert.equal(readFileSync(p).subarray(0, 4).toString('latin1'), 'RIFF', n + ' が webp でない');
  }
});

test('素材: 全部が sw-core.js の SHARED に入っている（オフラインでも出る）。characters.js 自身も入っている', () => {
  const sw = readFileSync(join(shared, 'sw-core.js'), 'utf8');
  for (const n of CHARACTER_ART) assert.ok(sw.includes("'../shared/images/characters/" + n + ".webp'"), n + ' が sw-core.js の SHARED に無い');
  assert.ok(sw.includes("'../shared/js/lib/characters.js'"), 'characters.js が SHARED に無い');
});

test('素材: 絵の置き場と実ファイルの食い違い（置いてあるのに一覧に無い絵が無い）', () => {
  const sw = readFileSync(join(shared, 'sw-core.js'), 'utf8');
  const listed = [...sw.matchAll(/images\/characters\/([A-Za-z0-9_-]+)\.webp/g)].map((m) => m[1]);
  assert.deepEqual([...listed].sort(), [...CHARACTER_ART].sort());
});

test('isCharacterArt / characterImageUrl: 知っている名前だけ。基準なし・知らない名前・変な入力は null', () => {
  assert.equal(isCharacterArt('shiba-hello'), true);
  assert.equal(isCharacterArt('../x'), false);
  assert.equal(isCharacterArt(null), false);
  assert.equal(characterImageUrl('sensei-ok', 'https://x/c/'), 'https://x/c/sensei-ok.webp');
  assert.equal(characterImageUrl('nobody', 'https://x/c/'), null);
  assert.equal(characterImageUrl('sensei-ok', ''), null);
  assert.equal(characterImageUrl('sensei-ok', undefined), null);
});

test('daysSinceLastStudy: 今日=0・昨日=1・月またぎ・まだ学習していない/壊れた値=null・時計が戻っても0未満にならない', () => {
  assert.equal(daysSinceLastStudy(stateOf('2026-10-04'), '2026-10-04'), 0);
  assert.equal(daysSinceLastStudy(stateOf('2026-10-03'), '2026-10-04'), 1);
  assert.equal(daysSinceLastStudy(stateOf('2026-09-30'), '2026-10-04'), 4);
  assert.equal(daysSinceLastStudy(stateOf('2026-12-31'), '2027-01-02'), 2);
  assert.equal(daysSinceLastStudy(stateOf('2026-10-10'), '2026-10-04'), 0);
  assert.equal(daysSinceLastStudy(stateOf(null), '2026-10-04'), null);
  assert.equal(daysSinceLastStudy({}, '2026-10-04'), null);
  assert.equal(daysSinceLastStudy(null, '2026-10-04'), null);
  assert.equal(daysSinceLastStudy(stateOf('あした'), '2026-10-04'), null);
  assert.equal(daysSinceLastStudy(stateOf('2026-10-03'), undefined), null);
});

// ホームの一言。now は Date。2026-10-10 は土曜、10-11 は日曜、10-12 は月曜。
const T = CHARACTER_TEXT;
const at = (y, mo, d, h = 15, mi = 0) => new Date(y, mo - 1, d, h, mi, 0);
// 使っている人の状態（記録あり）。last=最後の学習日、count=連続日数、exam=受験日、done=今日答えた数
function used({ last = '2026-10-10', count = 1, exam = null, done = 0, goal = 10, today = '2026-10-10' } = {}) {
  return {
    xp: 50, totals: { answered: 20 }, qstats: { q1: { seen: 1 } },
    streak: { last, count, best: count },
    settings: { dailyGoal: goal, examDate: exam, examAsked: exam !== null },
    daily: done ? { [today]: { answered: done } } : {},
  };
}

test('homeMascot: 休んだ日数の境界。昨日までは あいさつ、1日まるごと休んだ(差2日)から うとうと＋おかえり', () => {
  assert.equal(AWAY_DAYS, 2);
  const now = at(2026, 10, 10);
  const m = (last) => homeMascot(used({ last }), now);
  assert.equal(m('2026-10-10').text, T.homeWeekend);
  assert.equal(m('2026-10-09').text, T.homeWeekend);
  assert.equal(m('2026-10-08').art, 'shiba-sleepy');
  assert.equal(m('2026-10-08').text, T.homeBack);
  assert.equal(m('2026-01-01').text, T.homeBack);
});

test('homeMascot: 1問も答えていない人は「はじめまして」。壊れた記録・未来の日付・state なし・壊れた時刻は落ちない', () => {
  const now = at(2026, 10, 12);
  assert.equal(homeMascot({}, now).text, T.homeFirst);
  assert.equal(homeMascot({ streak: { last: null, count: 0 } }, now).text, T.homeFirst);
  assert.equal(homeMascot(undefined, now).art, 'shiba-hello');
  assert.equal(homeMascot(null, now).art, 'shiba-hello');
  assert.equal(homeMascot(used({ last: 'xxxx' }), now).art, 'shiba-hello');
  assert.equal(homeMascot(used({ last: '2027-01-01' }), now).text, T.homeHello);
  assert.equal(homeMascot(used(), new Date('x')).text, T.homeHello);
  assert.ok(homeMascot(used()).art.startsWith('shiba-'));
});

test('homeMascot: 時間帯の境界（平日・受験日なし・連続1日。14〜16時は ふだんのあいさつ）', () => {
  const t = (h, mi) => homeMascot(used({ last: '2026-10-12', today: '2026-10-12' }), at(2026, 10, 12, h, mi));
  assert.equal(t(0, 0).text, T.homeLate);
  assert.equal(t(4, 59).text, T.homeLate);
  assert.equal(t(5, 0).text, T.homeMorning);
  assert.equal(t(10, 59).text, T.homeMorning);
  assert.equal(t(11, 0).text, T.homeNoon);
  assert.equal(t(13, 59).text, T.homeNoon);
  assert.equal(t(14, 0).text, T.homeHello);
  assert.equal(t(16, 59).text, T.homeHello);
  assert.equal(t(17, 0).text, T.homeEvening);
  assert.equal(t(20, 59).text, T.homeEvening);
  assert.equal(t(21, 0).text, T.homeNight);
  assert.equal(t(23, 59).text, T.homeNight);
  assert.equal(t(0, 0).art, 'shiba-sleepy');
  assert.equal(t(5, 0).art, 'shiba-hello');
});

test('homeMascot: 土曜・日曜は「お休みの日も」、月曜は ふだん（どれも昼下がり）', () => {
  const w = (d) => homeMascot(used({ last: '2026-10-' + d, today: '2026-10-' + d }), at(2026, 10, Number(d), 15));
  assert.equal(w('10').text, T.homeWeekend);
  assert.equal(w('11').text, T.homeWeekend);
  assert.equal(w('12').text, T.homeHello);
});

test('homeMascot: 受験日の境界（当日・明日・2日・7日・8日・過ぎた・壊れた・未設定）', () => {
  const now = at(2026, 10, 12, 15);
  const m = (exam) => homeMascot(used({ last: '2026-10-12', today: '2026-10-12', exam }), now);
  assert.equal(m('2026-10-12').text, T.homeExamToday);
  assert.equal(m('2026-10-12').art, 'shiba-cheer');
  assert.equal(m('2026-10-13').text, T.homeExamTomorrow);
  assert.equal(m('2026-10-14').text, '本番まであと2日！ ラストスパート！');
  assert.equal(m('2026-10-19').text, T.homeExamNear(7));
  assert.equal(m('2026-10-20').text, T.homeHello);
  assert.equal(m('2026-10-11').text, T.homeHello);
  assert.equal(m('はてな').text, T.homeHello);
  assert.equal(m(null).text, T.homeHello);
});

test('homeMascot: 連続日数は 3日以上でほめる（2日はほめない）。今日まだ学習していなくても、昨日までの連続は数える', () => {
  const now = at(2026, 10, 12, 15);
  assert.equal(homeMascot(used({ last: '2026-10-12', count: 2, today: '2026-10-12' }), now).text, T.homeHello);
  const m3 = homeMascot(used({ last: '2026-10-12', count: 3, today: '2026-10-12' }), now);
  assert.equal(m3.text, '3日連続！ その調子！');
  assert.equal(m3.art, 'shiba-clap');
  assert.equal(homeMascot(used({ last: '2026-10-11', count: 5, today: '2026-10-12' }), now).text, T.homeStreak(5));
});

test('homeMascot: 今日の目標は ちょうど達成でバンザイ、1足りないと出ない', () => {
  const now = at(2026, 10, 12, 15);
  const m = (done) => homeMascot(used({ last: '2026-10-12', today: '2026-10-12', done, goal: 10 }), now);
  assert.equal(m(10).text, T.homeGoalDone);
  assert.equal(m(10).art, 'shiba-banzai');
  assert.equal(m(9).text, T.homeHello);
  assert.equal(m(25).text, T.homeGoalDone);
});

test('homeMascot: 優先順の衝突。上の番号が勝つ', () => {
  const day = '2026-10-12';
  const base = { last: day, today: day };
  assert.equal(homeMascot(used({ ...base, done: 10 }), at(2026, 10, 12, 2)).text, T.homeGoalDone); // 5 が 6 に勝つ
  assert.equal(homeMascot(used({ ...base, count: 5, exam: '2026-10-13' }), at(2026, 10, 12, 8)).text, T.homeExamTomorrow); // 4 が 8 に勝つ
  assert.equal(homeMascot(used({ ...base, done: 10, exam: '2026-10-13' }), at(2026, 10, 12, 15)).text, T.homeExamTomorrow); // 4 が 5 に勝つ
  assert.equal(homeMascot(used({ ...base, exam: '2026-10-15' }), at(2026, 10, 12, 1)).text, T.homeLate); // 6 が 7 に勝つ
  assert.equal(homeMascot(used({ ...base, count: 5, exam: '2026-10-15' }), at(2026, 10, 12, 8)).text, T.homeExamNear(3)); // 7 が 8 に勝つ
  assert.equal(homeMascot(used({ ...base, count: 5 }), at(2026, 10, 12, 8)).text, T.homeStreak(5)); // 8 が 9 に勝つ
  assert.equal(homeMascot(used({ last: '2026-10-09', exam: '2026-10-12' }), at(2026, 10, 12, 8)).text, T.homeBack); // 2 が 3 に勝つ
  assert.equal(homeMascot({ settings: { examDate: '2026-10-12', examAsked: true } }, at(2026, 10, 12, 8)).text, T.homeFirst); // 1 が 3 に勝つ
});

test('homeMascot: 同じ日・同じ時間帯なら、何度呼んでも同じ一言（乱数を使わない）', () => {
  const s = used({ last: '2026-10-12', today: '2026-10-12' });
  const a = homeMascot(s, at(2026, 10, 12, 8, 0));
  for (let i = 0; i < 20; i++) assert.deepEqual(homeMascot(s, at(2026, 10, 12, 8, i)), a);
});

test('一言の文言: 名前の呼び方（柴犬）を入れない。根拠のない効果の主張を書かない', () => {
  const texts = Object.values(T).map((v) => (typeof v === 'function' ? v(5) : v));
  for (const x of texts) assert.ok(!/柴犬/.test(x), x);
  assert.ok(!texts.some((x) => /覚えやすい|効果的|科学/.test(x)));
});

test('celebrationMascot: レベルと1日の目標=バンザイ、バッジと星=拍手、知らない種類=出さない', () => {
  assert.equal(celebrationMascot('level'), 'shiba-banzai');
  assert.equal(celebrationMascot('goal'), 'shiba-banzai');
  assert.equal(celebrationMascot('badge'), 'shiba-clap');
  assert.equal(celebrationMascot('stars'), 'shiba-clap');
  assert.equal(celebrationMascot('other'), null);
  assert.equal(celebrationMascot(undefined), null);
});

test('決まりが返す絵は、全部が素材の一覧にある。文言に名前（先生・柴犬）を入れていない', () => {
  const arts = [
    homeMascot(used(), at(2026, 10, 10)).art, homeMascot(used({ last: '2026-01-01' }), at(2026, 10, 10)).art,
    homeMascot({}, at(2026, 10, 10)).art, homeMascot(used({ exam: '2026-10-10' }), at(2026, 10, 10)).art, homeMascot(used({ exam: '2026-10-11' }), at(2026, 10, 10)).art,
    homeMascot(used({ done: 10 }), at(2026, 10, 10)).art, homeMascot(used({ count: 4 }), at(2026, 10, 10)).art, homeMascot(used(), at(2026, 10, 10, 2)).art,
    explainSensei(true), explainSensei(false), TIP_SENSEI, examMascot(90).art, examMascot(10).art,
    celebrationMascot('level'), celebrationMascot('badge'),
  ];
  for (const a of arts) assert.ok(isCharacterArt(a), a);
  for (const [k, raw] of Object.entries(CHARACTER_TEXT)) {
    const v = typeof raw === 'function' ? raw(5) : raw;
    assert.ok(v.length > 0, k);
    // 種類の呼び方（先生・柴犬）は使わず、名前で呼ぶ。名前は CHARACTER_NAMES のものだけ
    assert.ok(!/柴犬|しば/.test(v.replace(CHARACTER_NAMES.sensei, '')), k + ' に種類の呼び方が入っている');
  }
});

test('名前: 柴犬はサニー、先生はあい先生。知らない絵は空', () => {
  assert.equal(characterName('shiba-hello'), 'サニー');
  assert.equal(characterName('sensei-ok'), 'あい先生');
  assert.equal(characterName('x'), '');
  assert.equal(characterName(null), '');
  assert.equal(CHARACTER_NAMES.shiba, 'サニー');
  assert.equal(CHARACTER_NAMES.sensei, 'あい先生');
});
