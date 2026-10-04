// バッジの絵: どこにある絵を使うかの決まり（純粋な関数）と、素材・オフライン登録の食い違い。
// 実行: cd shared && node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMON_BADGE_ART, safeBadgeKey, majorArtName, badgeArtName, badgeImageUrl, badgeDefs } from '../js/lib/badges.js';
import { nextGoals } from '../js/lib/goals.js';
import { defaultState } from '../js/lib/progress.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const bases = { sharedBase: 'https://x/shared/images/badges/', appBase: 'https://x/app/images/badges/' };

function tree() {
  const st = (key, n) => ({ key, name: 'S' + key, questions: Array.from({ length: n }, (_, i) => ({ id: key + i })), children: [] });
  const a = st('A1', 10);
  return { roots: [{ key: '技術分野', id: 'T', name: '技術分野', children: [a] }, { key: '法・倫理 分野', name: '法・倫理 分野', children: [st('B1', 10)] }], stages: [a] };
}

test('safeBadgeKey: 英数字・_・- はそのまま。日本語・記号・空白は _u<16進>_ に。同じ入力は同じ出力', () => {
  assert.equal(safeBadgeKey('T-CH01'), 'T-CH01');
  assert.equal(safeBadgeKey('a_b-9'), 'a_b-9');
  assert.equal(safeBadgeKey('技術'), '_u6280__u8853_');
  assert.equal(safeBadgeKey('法 A/B'), '_u6cd5__u20_A_u2f_B');
  assert.equal(safeBadgeKey('技術'), safeBadgeKey('技術'));
  for (const raw of ['技術分野', 'a b', '../x', '😀', 'α', '|', '']) assert.match(safeBadgeKey(raw), /^[A-Za-z0-9_-]*$/, raw);
  assert.notEqual(safeBadgeKey('技術'), safeBadgeKey('技能'));
  assert.equal(safeBadgeKey(null), '');
  assert.equal(safeBadgeKey(undefined), '');
});

test('majorArtName: シラバスの id があればそれ。無ければ key を安全な形に', () => {
  assert.equal(majorArtName({ id: 'T', key: '技術分野' }), 'major-T');
  assert.equal(majorArtName({ id: 'CH01', key: 'x' }), 'major-CH01');
  assert.equal(majorArtName({ id: null, key: '技術' }), 'major-_u6280__u8853_');
  assert.equal(majorArtName({ key: 'abc' }), 'major-abc');
  assert.equal(majorArtName({ id: '', key: 'abc' }), 'major-abc');
  assert.match(majorArtName({ id: '../../etc', key: 'k' }), /^major-[A-Za-z0-9_-]+$/);
});

test('badgeArtName: 共通12個は id と同じ名前、章の制覇は art、それ以外は null', () => {
  assert.equal(badgeArtName({ id: 'streak-7' }), 'streak-7');
  assert.equal(badgeArtName({ id: 'major:技術分野', art: 'major-T' }), 'major-T');
  assert.equal(badgeArtName({ id: 'unknown-badge' }), null);
  assert.equal(badgeArtName(null), null);
  assert.equal(badgeArtName(undefined), null);
});

test('badgeImageUrl: 共通→shared、major-◯◯→アプリ、不正・未知・基準なしは null', () => {
  assert.equal(badgeImageUrl('streak-7', bases), 'https://x/shared/images/badges/streak-7.webp');
  assert.equal(badgeImageUrl('major-T', bases), 'https://x/app/images/badges/major-T.webp');
  assert.equal(badgeImageUrl('major-_u6280_', bases), 'https://x/app/images/badges/major-_u6280_.webp');
  for (const bad of [null, undefined, '', 42, 'nope', '../streak-7', 'streak-7/../x', 'major-技術', 'major-a.b', 'a b']) assert.equal(badgeImageUrl(bad, bases), null, String(bad));
  assert.equal(badgeImageUrl('streak-7', {}), null);
  assert.equal(badgeImageUrl('major-T', { sharedBase: 'https://x/s/' }), null);
  assert.equal(badgeImageUrl('streak-7'), null);
});

test('badgeDefs: 共通12個は絵あり、章の制覇は major-◯◯ の絵の名前（シラバス id 優先）', () => {
  const defs = badgeDefs(tree(), { challenge: {}, secondsPerQuestion: 40 });
  const common = defs.filter((d) => !d.id.startsWith('major:'));
  assert.equal(common.length, 12);
  for (const d of common) assert.equal(badgeArtName(d), d.id, d.id);
  const majors = defs.filter((d) => d.id.startsWith('major:'));
  assert.deepEqual(majors.map((d) => badgeArtName(d)), ['major-T', 'major-_u6cd5__u30fb__u502b__u7406__u20__u5206__u91ce_']);
});

test('絵の素材: 共通の12個が全部 shared/images/badges/ にあり、各 badgeDefs の id と一致し、オフライン登録（sw-core.js）にも入っている', () => {
  assert.equal(COMMON_BADGE_ART.length, 12);
  assert.equal(new Set(COMMON_BADGE_ART).size, 12);
  const ids = badgeDefs(tree(), { challenge: {}, secondsPerQuestion: 40 }).filter((d) => !d.id.startsWith('major:')).map((d) => d.id);
  assert.deepEqual([...COMMON_BADGE_ART].sort(), [...ids].sort());
  const sw = readFileSync(join(shared, 'sw-core.js'), 'utf8');
  for (const id of COMMON_BADGE_ART) {
    const p = join(shared, 'images', 'badges', id + '.webp');
    assert.ok(existsSync(p), id + '.webp がない');
    assert.ok(statSync(p).size > 1000, id + '.webp が小さすぎる');
    assert.ok(sw.includes("'../shared/images/badges/" + id + ".webp'"), id + ' が sw-core.js の SHARED にない');
    assert.equal(readFileSync(p).subarray(8, 12).toString('latin1'), 'WEBP', id);
  }
});

test('次の目標: バッジの目標は絵の名前を持つ（星の目標・絵なしは null）', () => {
  const t = tree();
  const defs = badgeDefs(t, { challenge: {}, secondsPerQuestion: 40 });
  const s = defaultState();
  const goals = nextGoals(t, defs, s, '2026-10-04', 100);
  const first = goals.find((g) => g.id === 'first-answer');
  assert.equal(first.art, 'first-answer');
  assert.equal(goals.find((g) => g.id === 'major:技術分野').art, 'major-T');
  s.stages.A1 = { stars: 1, runs: 1 };
  const withStars = nextGoals(t, defs, s, '2026-10-04', 100).find((g) => g.kind === 'stars');
  assert.equal(withStars.art, null);
});
