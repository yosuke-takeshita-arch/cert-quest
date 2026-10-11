// バッジの絵: どこにある絵を使うかの決まり（純粋な関数）と、素材・オフライン登録の食い違い。
// 実行: cd shared && node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMON_BADGE_ART, safeBadgeKey, majorArtName, badgeArtName, badgeImageUrl, badgeDefs, awardBadges, badgeProgress } from '../js/lib/badges.js';
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

// 共通のバッジ＝12個（絵あり）＋「どっち？」とボス戦の5つ（絵が届いたら COMMON_BADGE_ART に足し、ここから外す）
const PENDING_ART = ['dochi-combo-10', 'boss-first', 'boss-all', 'boss-flawless'];

test('badgeDefs: 共通12個は絵あり、5つは絵なし、章の制覇は major-◯◯ の絵の名前（シラバス id 優先）', () => {
  const defs = badgeDefs(tree(), { challenge: {}, secondsPerQuestion: 40 });
  const common = defs.filter((d) => !d.id.startsWith('major:') && !d.id.startsWith('chapter:'));
  assert.equal(common.length, 17);
  for (const d of common) assert.equal(badgeArtName(d), PENDING_ART.includes(d.id) ? null : d.id, d.id);
  const majors = defs.filter((d) => d.id.startsWith('major:'));
  assert.deepEqual(majors.map((d) => badgeArtName(d)), ['major-T', 'major-_u6cd5__u30fb__u502b__u7406__u20__u5206__u91ce_']);
});

test('絵の素材: 共通の12個が全部 shared/images/badges/ にあり、各 badgeDefs の id と一致し、オフライン登録（sw-core.js）にも入っている', () => {
  assert.ok(COMMON_BADGE_ART.length >= 12);
  assert.equal(new Set(COMMON_BADGE_ART).size, COMMON_BADGE_ART.length);
  const ids = badgeDefs(tree(), { challenge: {}, secondsPerQuestion: 40 }).filter((d) => !d.id.startsWith('major:') && !d.id.startsWith('chapter:')).map((d) => d.id);
  // 絵のあるものは、全部が定義の id にある。定義の id で絵が無いものは、絵待ちの5つだけ
  assert.deepEqual(COMMON_BADGE_ART.filter((a) => !ids.includes(a)), []);
  assert.deepEqual(ids.filter((i) => !COMMON_BADGE_ART.includes(i)).sort(), PENDING_ART.filter((i) => !COMMON_BADGE_ART.includes(i)).sort());
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
  const defs = badgeDefs(t, { challenge: {}, secondsPerQuestion: 40 }).filter((d) => !d.id.startsWith('chapter:'));
  const s = defaultState();
  const goals = nextGoals(t, defs, s, '2026-10-04', 100);
  const first = goals.find((g) => g.id === 'first-answer');
  assert.equal(first.art, 'first-answer');
  assert.equal(goals.find((g) => g.id === 'major:技術分野').art, 'major-T');
  s.stages.A1 = { stars: 1, runs: 1 };
  const withStars = nextGoals(t, defs, s, '2026-10-04', 100).find((g) => g.kind === 'stars');
  assert.equal(withStars.art, null);
});

// ---- 章の制覇バッジ（条件: その章のステージで星3） ----

function twoChapterTree() {
  const st = (key, id, n) => ({ key, id, name: '章' + key, questions: Array.from({ length: n }, (_, i) => ({ id: key + i })), children: [] });
  const c1 = st('T|C1', 'T-CH01', 10);
  const c2 = st('T|C2', 'T-CH02', 10);
  const empty = st('T|C3', 'T-CH03', 0);
  const d1 = st('L|D1', 'L-CH01', 10);
  return { roots: [{ key: 'T', id: 'T', name: '技術', children: [c1, c2, empty] }, { key: 'L', id: 'L', name: '法律', children: [d1] }], stages: [c1, c2, empty, d1] };
}
const defsOf = (t) => badgeDefs(t, { challenge: {}, secondsPerQuestion: 40 });

test('章の制覇: id は chapter:<ステージの key>、絵は major-<章の id>、名前は「◯◯ 制覇」。問題の無い章は作らない', () => {
  const defs = defsOf(twoChapterTree());
  const ch = defs.filter((d) => d.id.startsWith('chapter:'));
  assert.deepEqual(ch.map((d) => d.id), ['chapter:T|C1', 'chapter:T|C2', 'chapter:L|D1']);
  assert.deepEqual(ch.map((d) => badgeArtName(d)), ['major-T-CH01', 'major-T-CH02', 'major-L-CH01']);
  assert.deepEqual(ch.map((d) => d.name), ['章T|C1 制覇', '章T|C2 制覇', '章L|D1 制覇']);
  assert.equal(new Set(defs.map((d) => d.id)).size, defs.length);
});

test('章の制覇: 並びは 共通12個 → 大項目 → 章。既存の12個と大項目の id は変わらない', () => {
  const defs = defsOf(twoChapterTree());
  const ids = defs.map((d) => d.id);
  assert.deepEqual([...ids.slice(0, 12)].sort(), [...COMMON_BADGE_ART.slice(0, 12)].sort());
  assert.deepEqual(ids.slice(12, 17), ['dochi-perfect', 'dochi-combo-10', 'boss-first', 'boss-all', 'boss-flawless']);
  assert.deepEqual(ids.slice(17), ['major:T', 'major:L', 'chapter:T|C1', 'chapter:T|C2', 'chapter:L|D1']);
});

test('章の制覇: 星2では取れない・星3で取れる・ほかの章の星3では取れない', () => {
  const defs = defsOf(twoChapterTree());
  const c1 = defs.find((d) => d.id === 'chapter:T|C1');
  const s = defaultState();
  assert.equal(c1.test(s), false);
  s.stages['T|C1'] = { stars: 2, best: 90, runs: 1 };
  assert.equal(c1.test(s), false);
  s.stages['T|C1'] = { stars: 3, best: 100, runs: 2 };
  assert.equal(c1.test(s), true);
  const s2 = defaultState();
  s2.stages['T|C2'] = { stars: 3, best: 100, runs: 1 };
  assert.equal(c1.test(s2), false);
  assert.equal(defs.find((d) => d.id === 'chapter:T|C2').test(s2), true);
});

test('章の制覇: 大項目の制覇（星1以上で全部）とは別。星1だけで大項目は取れて、章は取れない', () => {
  const defs = defsOf(twoChapterTree());
  const s = defaultState();
  s.stages['T|C1'] = { stars: 1, best: 50, runs: 1 };
  s.stages['T|C2'] = { stars: 1, best: 50, runs: 1 };
  assert.equal(defs.find((d) => d.id === 'major:T').test(s), true);
  assert.equal(defs.find((d) => d.id === 'chapter:T|C1').test(s), false);
});

test('章の制覇: 取ると awardBadges で記録され、取得済みの記録は変わらない。進み具合は星の数（0〜3）', () => {
  const defs = defsOf(twoChapterTree());
  const s = defaultState();
  s.badges['major:T'] = '2026-09-01';
  s.stages['T|C1'] = { stars: 3, best: 100, runs: 1 };
  s.stages['T|C2'] = { stars: 1, best: 60, runs: 1 };
  const got = awardBadges(s, defs, '2026-10-04').map((d) => d.id);
  assert.deepEqual(got, ['chapter:T|C1']);
  assert.equal(s.badges['major:T'], '2026-09-01');
  const c2 = defs.find((d) => d.id === 'chapter:T|C2');
  const p = badgeProgress(c2, s, '2026-10-04');
  assert.deepEqual([p.cur, p.max, p.remaining, p.unit], [1, 3, 2, '星']);
  assert.deepEqual(p.action, { kind: 'stage', key: 'T|C2' });
});

test('次の目標: 章の制覇バッジは絵つきで出て、同じ「星3まで」の星の目標とは重ならない', () => {
  const t = twoChapterTree();
  const defs = defsOf(t);
  const s = defaultState();
  s.stages['T|C1'] = { stars: 2, best: 80, runs: 1 };
  const goals = nextGoals(t, defs, s, '2026-10-04', 100);
  const g = goals.find((x) => x.id === 'chapter:T|C1');
  assert.equal(g.art, 'major-T-CH01');
  assert.equal(g.ratio, 2 / 3);
  assert.equal(goals.some((x) => x.id === 'stars:T|C1'), false);
});

test('章の制覇: 実データ（G検定10・DX13＝12分類＋補足）の章が全部バッジになり、id・絵の名前が重ならない。G検定は絵が全部ある', async () => {
  const { buildTree } = await import('../js/lib/data.js');
  const repo = join(shared, '..');
  const expected = { 'g-kentei': 10, 'dx-biz': 13 };
  for (const app of ['g-kentei', 'dx-biz']) {
    const syl = JSON.parse(readFileSync(join(repo, app, 'data', 'syllabus.json'), 'utf8'));
    const qs = [];
    for (const r of syl) for (const c of r.children) qs.push({ id: c.id + 'q', syllabus: [r.title, c.title] });
    const tree = buildTree(syl, qs, []);
    const defs = badgeDefs(tree, JSON.parse(readFileSync(join(repo, app, 'config.json'), 'utf8')));
    const ch = defs.filter((d) => d.id.startsWith('chapter:'));
    assert.equal(ch.length, expected[app], app);
    const arts = ch.map((d) => badgeArtName(d));
    assert.equal(new Set(arts).size, arts.length, app + ' の絵の名前が重なる');
    for (const a of arts) assert.match(a, /^major-[A-Za-z0-9_-]+$/);
    assert.equal(new Set(defs.map((d) => d.id)).size, defs.length);
    if (app === 'g-kentei') {
      const sw = readFileSync(join(repo, app, 'sw.js'), 'utf8');
      const files = [...defs.filter((d) => d.id.startsWith('major:') || d.id.startsWith('chapter:')).map((d) => badgeArtName(d))];
      assert.equal(files.length, 12);
      for (const a of files) {
        const p = join(repo, app, 'images', 'badges', a + '.webp');
        assert.ok(existsSync(p), a + '.webp がない');
        assert.equal(readFileSync(p).subarray(8, 12).toString('latin1'), 'WEBP', a);
        assert.ok(sw.includes("'./images/badges/" + a + ".webp'"), a + ' が g-kentei/sw.js の appFiles にない');
      }
    }
  }
});
