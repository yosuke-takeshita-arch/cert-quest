// 真ボスの結線の検証（要件定義書 §3-9）。ブラウザ無しなので、ソースの文字列と設定ファイルを照らす。
// ここで言えるのは『結線されている』まで。『押したら動く』『見た目が崩れない』は、実機（ローカルの静的サーバ）で押して撮ったスクリーンショットで確かめる。
// 実行: cd shared && node --test tests/trueboss-wiring.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => readFileSync(root + p, 'utf8').replace(/\r\n/g, '\n');
const code = (p) => read(p).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join('\n'); // コメントは除く

/** 関数宣言 name の本体（次の 2 スペース字下げの function / 末尾の手前まで）。 */
function fnBody(src, name) {
  const i = src.indexOf('  function ' + name + '(');
  assert.ok(i >= 0, name + ' が見つからない');
  const m = /\n  (async )?function \w+\(/g;
  m.lastIndex = i + 10;
  const n = m.exec(src);
  return src.slice(i, n ? n.index : src.length);
}

test('config: 真ボスを出すのは G検定だけ（trueBoss が true）。DX・AIパスポートには無い', () => {
  assert.equal(JSON.parse(read('g-kentei/config.json')).trueBoss, true);
  for (const app of ['dx-biz', 'ai-passport']) assert.equal(JSON.parse(read(app + '/config.json')).trueBoss, undefined, app);
  assert.equal(existsSync(root + 'g-kentei/data/trueboss.json'), true);
  for (const app of ['dx-biz', 'ai-passport']) assert.equal(existsSync(root + app + '/data/trueboss.json'), false, app + ' に真ボスのデータが入っている');
});

test('config: sw.js の version と config.json の appVersion は、この作業では上げていない（公開は門番が決める）', () => {
  // 値そのものは公開のたびに変わる。ここでは、形（appVersion が 0.9.x）が崩れていないことだけ見る
  assert.match(JSON.parse(read('g-kentei/config.json')).appVersion, /^\d+\.\d+\.\d+$/);
});

test('app.js: 真ボスの画面の道（trueboss）と、データの読み込み（config の trueBoss のときだけ）が結線されている', () => {
  const app = read('shared/js/app.js');
  assert.match(app, /import \{ renderTrueBoss \} from '\.\/views\/trueboss\.js';/);
  assert.match(app, /\['trueboss', 'map', \(\) => renderTrueBoss\(app\), true\]/, '下のメニューを隠す画面（4つ目の true）');
  assert.match(app, /loaded\.data\.trueBoss = trueBossEnabled\(config\) \? await loadTrueBossData\(/);
});

test('sw-core.js: 新しい4つの JS と trueboss.json の先取りが入っている（オフラインでも真ボスが出る）', () => {
  const sw = read('shared/sw-core.js');
  for (const f of ['lib/trueboss.js', 'lib/trueboss-data.js', 'lib/trueboss-music.js', 'views/trueboss.js']) {
    assert.ok(sw.includes("'../shared/js/" + f + "'"), f + ' が SHARED に無い');
    assert.ok(existsSync(root + 'shared/js/' + f), f + ' が無い');
  }
  assert.match(sw, /base \+ 'trueboss\.json'/);
});

test('package.json: 新しいテスト4本が一覧に入っている', () => {
  const pkg = read('shared/package.json');
  for (const t of ['trueboss.test.js', 'trueboss-data.test.js', 'trueboss-music.test.js', 'trueboss-wiring.test.js']) assert.ok(pkg.includes('tests/' + t), t);
});

test('入口: 地図と復習の画面に、真ボスの入口（trueBossPlace）がある。真ボスを出さないアプリでは null', () => {
  const home = read('shared/js/views/home.js');
  assert.match(home, /import \{ trueBossPlace \} from '\.\/trueboss\.js';/);
  assert.match(home, /trueBossPlace\(app, '#\/map'\)/);
  assert.match(home, /trueBossPlace\(app, '#\/review'\)/);
  const view = read('shared/js/views/trueboss.js');
  assert.match(view, /export function trueBossPlace\(app, back\) \{\n  if \(!trueBossEnabled\(app\.config\)\) return null;/);
});

test('出る条件は画面に出さない（章のボスと同じ考え）。現れていない間は『？？？』と影だけ', () => {
  const view = code('shared/js/views/trueboss.js');
  assert.doesNotMatch(view, /全章|すべての章|全部の章|ボスをすべて|倒すと現れ|倒すと出/, '条件を書いている');
  assert.match(view, /unknownName: '？？？'/);
  assert.match(view, /trueBossArt\(1, 'off unknown'\)/);
  // 章のボスを全部倒した勝ちのあとの一言（合図）は出すが、条件は書かない
  const boss = code('shared/js/views/boss.js');
  assert.match(boss, /TRUE_BOSS_AWAKE = '塔の いちばん うえで、おおきな なにかが めざめた……'/);
  assert.match(boss, /if \(win && !awakeBefore && trueBossAwake\(\)\)/);
});

test('戦いの最中は解説を出さない。解説（explanation）を呼ぶのは、結果の画面（showResult）だけ', () => {
  const src = code('shared/js/views/trueboss.js');
  const calls = src.match(/explanation\(app,/g) || [];
  assert.equal(calls.length, 1, 'explanation( を呼ぶ場所の数');
  assert.ok(fnBody(src, 'showResult').includes('explanation(app, x.sq, x.chosen'), '結果の画面で呼ぶ');
  for (const f of ['answer', 'drawQuestion', 'evolveSequence', 'defeatSequence']) assert.ok(!fnBody(src, f).includes('explanation('), f + ' が解説を出している');
  // 戦いの最中に正解の選択肢を教えない（選んだ選択肢の○×だけ）
  assert.ok(!/classList\.toggle\('ok', i === sq\.answer\)/.test(fnBody(src, 'answer')), '正解の選択肢に色を付けている');
  assert.ok(!/stumbleBlock|laterButton/.test(fnBody(src, 'answer')), '戦いの最中にヒントや「あとで見る」を出している');
  // 結果には、答えた問題の一覧と、用語カード（openCardSheet）への道がある
  const result = fnBody(src, 'showResult');
  assert.match(result, /openCardSheet\(app, id\)/);
  assert.match(result, /S\.log\.filter\(\(x\) => x\.form === f\)/);
});

test('答えの記録: 問題の記録（recordAnswer）に入れるが、今日の復習の枠（review）は渡さない', () => {
  const src = code('shared/js/views/trueboss.js');
  assert.match(fnBody(src, 'answer'), /app\.recordAnswer\(sq\.q, \{ correct, seconds, sessionStreak: S\.streak, limit \}\)/);
  assert.doesNotMatch(src, /review: true/);
});

test('負けたら第1形態から: 『もう一度挑む』は begin()（新しい計画と第1形態）を呼ぶ。勝ちの記録は endBattle で1回だけ', () => {
  const src = code('shared/js/views/trueboss.js');
  assert.match(fnBody(src, 'again'), /begin\(\)/);
  assert.match(fnBody(src, 'begin'), /buildTrueBossPlan\(app\.data\.questions, app\.state\.qstats/);
  assert.match(fnBody(src, 'begin'), /newTrueRun\(plan, app\.rng\)/);
  const end = fnBody(src, 'endBattle');
  assert.match(end, /if \(win && !S\.recorded\)/);
  assert.match(end, /recordTrueBossWin\(app\.state\)/);
  assert.match(end, /if \(win && !S\.endingShown\) \{ endingScreen\(showResult\); return; \}/, '勝ったときだけ、結果の前にエンディング');
  assert.equal((src.match(/recordTrueBossWin\(/g) || []).length, 1);
});

test('エンディングはとばせる（ボタンと、画面のタップ）。動きを減らす設定では全部を一度に出す', () => {
  const src = code('shared/js/views/trueboss.js');
  const fn = fnBody(src, 'endingScreen');
  assert.match(fn, /'data-tb-ending-go': '1', onClick: finishEnding/);
  assert.match(fn, /onClick: revealAll/);
  assert.match(fn, /if \(R\) \{ revealAll\(\); return; \}/);
});

test('時間制限の技: 残り時間を数え、0 になったら不正解として自動で答える。答えたら数えるのを止める', () => {
  const src = code('shared/js/views/trueboss.js');
  assert.match(fnBody(src, 'startTimer'), /answer\(null, true\)/);
  assert.match(fnBody(src, 'answer'), /stopTick\(\)/);
  assert.match(fnBody(src, 'answer'), /isTimedOut\(before\.skill, seconds\)/);
  assert.match(src, /const cleanup = \(\) => \{\n    clearTimers\(\);\n    stopTick\(\);/, '画面を離れたら数えるのを止める');
});

test('利用者の画面に、開発用の語（ID・段階の記号・未実装）を出さない。API の値をそのまま出さない', () => {
  const src = code('shared/js/views/trueboss.js') + code('shared/js/lib/trueboss-data.js');
  assert.doesNotMatch(src, /(UC|SCR|TST|LAW)-\d|§\d|\bMVP\b|\bP[0-9]\b|未実装|未対応|TODO|\(仮\)|（仮）/);
  const data = read('g-kentei/data/trueboss.json');
  const shown = JSON.parse(data);
  delete shown._note; // 差し替えの案内（画面に出さない）
  assert.doesNotMatch(JSON.stringify(shown), /(UC|SCR|TST|LAW)-\d|§\d|MVP|未実装|TODO/);
});

test('CSS: 新しい部品の動き（星のまたたき・文字の現れ）は、動きを減らす設定で止まる。CSP の邪魔になるインライン style は書かない', () => {
  const css = read('shared/css/app.css');
  const block = css.slice(css.indexOf('/* ---- 真ボス（views/trueboss.js'), css.indexOf('/* 科目を選ぶ画面'));
  assert.ok(block.length > 500, '真ボスの CSS の区画が見つからない');
  const red = block.slice(block.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(red, /\.tb-star \{ animation: none;/);
  assert.match(red, /\.tb-ending-title, \.tb-ending-line \{ transition: none; \}/);
  // 進化の演出（殻のひび・揺れ・光）も、動きを減らす設定では止まる
  assert.match(red, /\.boss-fig\.shake, \.boss-fig\.swell, \.boss-fig\.emerge, \.boss-fig\.spread, \.tb-crack, \.tb-burst \{ animation: none; \}/);
  const view = read('shared/js/views/trueboss.js');
  assert.doesNotMatch(view, /setAttribute\('style'|innerHTML|\bstyle:\s*['"{]/, 'インライン style / innerHTML');
});
