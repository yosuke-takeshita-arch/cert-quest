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

test('homeMascot: 境界。今日・昨日（まるごと休んだ日が無い）は あいさつ、1日まるごと休んだ(差2日)から うとうと＋おかえり', () => {
  assert.equal(AWAY_DAYS, 2);
  const m = (last) => homeMascot(stateOf(last), '2026-10-10');
  assert.equal(m('2026-10-10').art, 'shiba-hello');
  assert.equal(m('2026-10-09').art, 'shiba-hello');
  assert.equal(m('2026-10-08').art, 'shiba-sleepy');
  assert.equal(m('2026-10-08').text, CHARACTER_TEXT.homeBack);
  assert.equal(m('2026-01-01').art, 'shiba-sleepy');
  assert.equal(m('2026-10-09').text, CHARACTER_TEXT.homeHello);
});

test('homeMascot: まだ学習していない人・壊れた記録・未来の日付は あいさつ', () => {
  assert.equal(homeMascot(stateOf(null), '2026-10-10').art, 'shiba-hello');
  assert.equal(homeMascot({}, '2026-10-10').art, 'shiba-hello');
  assert.equal(homeMascot(undefined, '2026-10-10').art, 'shiba-hello');
  assert.equal(homeMascot(stateOf('xxxx'), '2026-10-10').art, 'shiba-hello');
  assert.equal(homeMascot(stateOf('2027-01-01'), '2026-10-10').art, 'shiba-hello');
});

test('trailingWrong: 末尾から数えた不正解の連続。0問・全問正解・途中の不正解は数えない', () => {
  assert.equal(trailingWrong([]), 0);
  assert.equal(trailingWrong(undefined), 0);
  assert.equal(trailingWrong([true, true]), 0);
  assert.equal(trailingWrong([false]), 1);
  assert.equal(trailingWrong([false, false, true]), 0);
  assert.equal(trailingWrong([true, false, false]), 2);
  assert.equal(trailingWrong([false, false, false]), 3);
  assert.equal(trailingWrong([true, false, false, false, false]), 4);
});

test('shouldCheer: 境界。2問続けてでは出ない／3問めで出る／4・5問めでは出ない／6問めでまた出る／途中で正解すると数え直す', () => {
  const run = (n, head = []) => [...head, ...Array(n).fill(false)];
  assert.equal(shouldCheer(run(0)), false);
  assert.equal(shouldCheer(run(1)), false);
  assert.equal(shouldCheer(run(2)), false);
  assert.equal(shouldCheer(run(3)), true);
  assert.equal(shouldCheer(run(4)), false);
  assert.equal(shouldCheer(run(5)), false);
  assert.equal(shouldCheer(run(6)), true);
  assert.equal(shouldCheer(run(3, [true, true])), true);
  assert.equal(shouldCheer([false, false, false, true]), false);
  assert.equal(shouldCheer([false, false, true, false]), false);
  assert.equal(shouldCheer(null), false);
});

test('explainSensei / TIP_SENSEI: 正解=丸、不正解=大丈夫、覚え方=指さし', () => {
  assert.equal(explainSensei(true), 'sensei-ok');
  assert.equal(explainSensei(false), 'sensei-comfort');
  assert.equal(explainSensei(null), 'sensei-comfort');
  assert.equal(TIP_SENSEI, 'sensei-point');
});

test('examMascot: 境界。70%以上は拍手、69%以下は大丈夫。壊れた値は大丈夫', () => {
  assert.equal(examMascot(100).art, 'sensei-clap');
  assert.equal(examMascot(70).art, 'sensei-clap');
  assert.equal(examMascot(69).art, 'sensei-comfort');
  assert.equal(examMascot(0).art, 'sensei-comfort');
  assert.equal(examMascot(NaN).art, 'sensei-comfort');
  assert.equal(examMascot(undefined).art, 'sensei-comfort');
  assert.equal(examMascot(70).text, CHARACTER_TEXT.examHigh);
  assert.equal(examMascot(69).text, CHARACTER_TEXT.examLow);
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
    homeMascot(stateOf('2026-10-10'), '2026-10-10').art, homeMascot(stateOf('2026-01-01'), '2026-10-10').art,
    explainSensei(true), explainSensei(false), TIP_SENSEI, examMascot(90).art, examMascot(10).art,
    celebrationMascot('level'), celebrationMascot('badge'),
  ];
  for (const a of arts) assert.ok(isCharacterArt(a), a);
  for (const [k, v] of Object.entries(CHARACTER_TEXT)) {
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
