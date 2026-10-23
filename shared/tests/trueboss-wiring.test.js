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
  assert.match(result, /group\('wrong', '不正解だった問題', S\.log\.filter\(\(x\) => !x\.correct\)\)/);
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
  assert.match(red, /\.boss-fig\.shake, \.boss-fig\.swell, \.boss-fig\.emerge, \.boss-fig\.spread, \.tb-crack-line\.on, \.tb-eye-glow\.on, \.tb-burst, \.tb-glow\.on, \.tb-orb\.on, \.tb-gold-flash \{ animation: none; \}/);
  const view = read('shared/js/views/trueboss.js');
  assert.doesNotMatch(view, /setAttribute\('style'|innerHTML|\bstyle:\s*['"{]/, 'インライン style / innerHTML');
});

test('第1形態のあいだは「第1形態」を出さない（札・問題の上の文字）。進化してから「第2形態」を出し、進化直後の問題の上の文字も直す', () => {
  const src = code('shared/js/views/trueboss.js');
  assert.match(src, /const roundLabel = \(\) => \(battle\(\)\.form > 1 \? '真ボス・第' \+ battle\(\)\.form \+ '形態' : '真ボス'\);/);
  assert.match(src, /ui\.formEl\.textContent = battle\(\)\.form > 1 \? '第' \+ battle\(\)\.form \+ '形態' : '';/);
  assert.match(src, /ui\.formEl\.classList\.toggle\('hidden', battle\(\)\.form === 1\)/);
  assert.match(src, /ui\.qarea\.querySelector\('\.boss-round'\)/, '進化直後に、答え済みの問題の上の文字も新しい形態に直す');
  assert.doesNotMatch(src, /'第1形態'|第' \+ 1 \+ '形態/, '第1形態の文字を直に書いていない');
});

test('第1→2の進化: 偽の撃破では崩れて消えない → 鼓動（だんだん速く）と地鳴りと揺れ → 一つ目がまたたいてから強く光る → ひびが1本ずつ → 割れる（崩れるのはここだけ）→ 第2形態', () => {
  const src = code('shared/js/views/trueboss.js');
  const fn = fnBody(src, 'evolveSequence');
  const fake = fn.slice(fn.indexOf("figClass('add', 'glow');"), fn.indexOf('at(T.shake'));
  assert.ok(fake.length > 500, '偽の撃破〜目が光るまでの区画が見つからない');
  // 偽の撃破の区画では、崩れる処理（crumble）も、消える（gone）も呼ばない
  assert.doesNotMatch(fake, /crumble\(/);
  assert.doesNotMatch(fake, /'gone'/);
  assert.match(fake, /figClass\('add', 'slump'\)/, '暗い灰色に沈む');
  assert.match(fake, /' を たおした！'/);
  assert.match(fake, /playBossSfx\(app\.state\.settings, 'win'\)/, '勝利の音はそのまま');
  assert.match(fake, /T\.heartbeats\.forEach\(\(t, k\) => at\(t, \(\) => \{ evoSfx\(k < T\.heartbeatFastFrom \? 'heartbeat' : 'heartbeatfast'\); flash\(ui\.fig, 'beat', 260\)/, '鼓動（前半は遅い・後半は速い。鼓動に合わせて絵が明るくなる）');
  assert.match(fake, /evoSfx\('rumble'\)/);
  assert.match(fake, /k >= T\.strongQuakeFrom \? 'quake2' : 'quake'/, '揺れがだんだん強く');
  assert.match(fake, /T\.eyeBlinks\.forEach/, '目がまたたく');
  assert.match(fake, /crackLayer\.eye\.classList\.add\('blink'\)/);
  assert.match(fake, /figClass\('remove', 'slump'\); figClass\('add', 'revive'\); crackLayer\.eye\.classList\.add\('on'\)/, 'そのあと強く光り、灰色が戻りはじめる');
  assert.doesNotMatch(fake, /flash\(ui\.fig, 'appear'/, '崩れた殻がもどってくる段は無い');
  // 崩れる処理は、evolveSequence の中で1回だけ（割れる瞬間）
  assert.equal((fn.match(/crumble\(/g) || []).length, 1);
  assert.match(fn, /crumble\('#b08d3c'\); \/\/ 殻が崩れるのは、ここ/);
  // 順番
  const order = ["figClass('add', 'slump')", "'heartbeat' : 'heartbeatfast'", "evoSfx('rumble')", "classList.add('blink')", "classList.add('on')", "at(T.shake", 'crackLayer.lines[k]', 'crumble(', "evoSfx('shatter1')", 'at(T.swap'];
  let last = -1;
  for (const k of order) { const i = fn.indexOf(k, last + 1); assert.ok(i > last, k + ' が順番どおりに無い'); last = i; }
  // 動きを減らす設定では、色（暗い灰色）と文と音だけ
  assert.match(fn, /figClass\('add', 'slump'\); \/\/ 色（暗い灰色）だけ/);
  assert.match(fn, /if \(R\) \{/);
});

test('第2→3の進化: 曲が止まって暗く → 宙で静止 → 光の玉が1つずつ金色に灯る → 力をためる音と揺れがだんだん強く → 金色の光が弾ける → 第3形態と決めぜりふ → 第3形態の曲', () => {
  const src = code('shared/js/views/trueboss.js');
  const fn = fnBody(src, 'evolveSequence');
  assert.match(fn, /stopBossTheme\(\);\n\s*const R = reduced\(\);/, '最初に曲を止める');
  const to3 = fn.slice(fn.indexOf("root.classList.add('tb-dim')"));
  assert.ok(to3.length > 600);
  assert.match(to3, /ui\.float\.classList\.add\('still'\)/, '宙で静止（浮かぶ動きを止める）');
  assert.match(to3, /orbTimes\(T\)\.forEach\(\(t, k\) => at\(t, \(\) => \{ orbLayer\.orbs\[k\]\.classList\.add\('on'\); evoSfx\('orb', k\); \}\)\)/, '玉が1つずつ灯り、そのたびに音（k が大きいほど高い）');
  assert.match(to3, /at\(T\.charge, \(\) => evoSfx\('charge'\)\)/);
  assert.match(to3, /T\.quakes\.forEach\(\(t, k\) => at\(t, \(\) => \{ flash\(ui\.scene, k >= T\.strongQuakeFrom \? 'quake2' : 'quake'/);
  assert.match(to3, /h\('div', \{ class: 'tb-gold-flash'/, '金色の光');
  assert.match(to3, /evoSfx\('impact'\)/);
  const order = ["'tb-dim'", "'still'", "classList.add('on'); evoSfx('orb'", 'evoSfx(\'charge\')', "'quake2'", 'tb-gold-flash', "evoSfx('impact')", 'at(T.swap, () => swap())', 'finishText(T.text)'];
  let last = -1;
  for (const k of order) { const i = to3.indexOf(k, last + 1); assert.ok(i > last, k + ' が順番どおりに無い'); last = i; }
  // 第3形態の曲は、決めぜりふのあと（swap のなかで、T.music - T.swap 後に始める）。飛ばしたときは、すぐ
  assert.match(fn, /if \(immediate \|\| from1\) startMusic\(\); else later\(startMusic, T\.music - T\.swap\);/);
  assert.match(fn, /startMusic\(\); \/\/ タップで飛ばしたとき/);
  // 動きを減らす設定: 玉は最初から全部金色（動かない）。揺れ・点滅・金色の光の動きなし
  assert.match(fn, /orbLayer\.orbs\.forEach\(\(o\) => o\.classList\.add\('on'\)\);/);
  const reduced2 = fn.slice(fn.indexOf('if (R) {'), fn.indexOf("figClass('add', 'glow');"));
  assert.doesNotMatch(reduced2, /quake|tb-gold-flash|blink/);
});

test('進化の効果音のフック: 名前つきで、鳴らす時刻の表（EVO_1_TO_2・EVO_2_TO_3）に合わせて呼ぶ。素材が無い間は、プログラムの音で鳴る', () => {
  const src = code('shared/js/views/trueboss.js');
  const fn = fnBody(src, 'evolveSequence');
  for (const name of ['rumble', 'shatter1', 'shatter2', 'charge', 'impact', 'finalhit']) assert.ok(fn.includes("evoSfx('" + name + "'"), name);
  assert.ok(fn.includes("'heartbeat' : 'heartbeatfast'"), '鼓動');
  assert.ok(fn.includes("evoSfx(k % 2 ? 'crack2' : 'crack1', 0, [0.7, 0.85, 1, 1.1][k])"), 'ひび');
  assert.match(fn, /evoSfx\('orb', k\)/);
  assert.match(src, /function evoSfx\(name, i = 0, boost = 1\) \{\n\s*if \(name === 'orb'\) playBossSfx\(app\.state\.settings, 'orb', 1, orbRate\(i\), 'orb' \+ Math\.min/);
  const snd = read('shared/js/lib/sound.js');
  for (const [kind, key] of [['heartbeat', 'trueheartbeat'], ['heartbeatfast', 'trueheartbeatfast'], ['charge', 'truecharge'], ['impact', 'trueimpact']]) assert.ok(snd.includes(kind + ": { key: '" + key + "'"), kind);
  const au = read('shared/js/audio.js');
  assert.ok(au.includes("if (!SFX_FILES[e.key]) { if (synth) playSynth(settings, synth); return; }"), 'ファイルが無い種類は、プログラムの音');
  // 素材の SFX_FILES のキーは、まだ無い（素材が入ったら足す）
  for (const k of ['trueheartbeat', 'trueheartbeatfast', 'trueorb', 'truecharge', 'trueimpact', 'truehit']) assert.match(snd, new RegExp('  ' + k + ": 'true-")); // 素材のファイル（2026-10-23 先生が選んだ）が SFX_FILES にある
});

test('進化の演出は、四角い白い面を使わない: 割れる光・金色の光は丸い放射の光。タップで飛ばせる', () => {
  const css = read('shared/css/app.css');
  assert.match(css, /\.tb-glow \{[^}]*radial-gradient\(circle closest-side/);
  assert.match(css, /\.tb-gold-flash \{[^}]*position: fixed; inset: 0;[^}]*radial-gradient\(circle at/);
  assert.doesNotMatch(css, /\.tb-gold-flash \{[^}]*background: #fff/);
  const fn = fnBody(code('shared/js/views/trueboss.js'), 'evolveSequence');
  assert.doesNotMatch(fn, /ui\.flash\.classList\.add\('on'\)/, '全面の白いフラッシュ（.boss-flash）を使わない');
  assert.match(fn, /S\.skipFx = finish;/);
  assert.match(fn, /clearTimers\(\);\n\s*ui\.fx\.textContent = '';\n\s*ui\.flash\.classList\.remove\('on'\);\n\s*cleanupFx\(\);\n\s*swap\(true\);/, '飛ばすと、暗さ・静止・金色の光を消して、すぐ第2・第3形態にする');
});

test('光の玉は絵の箱に重ねる: 絵と同じ正方形の SVG に、TRUE_ORBS の位置（絵の中の割合）で置く', () => {
  const src = code('shared/js/views/trueboss.js');
  const b = src.slice(src.indexOf('function buildOrbLayer'), src.indexOf('const rand ='));
  assert.match(b, /setAttribute\('viewBox', '0 0 100 100'\)/);
  assert.match(b, /setAttribute\('preserveAspectRatio', 'xMidYMid meet'\)/);
  assert.match(b, /TRUE_ORBS\.map/);
  assert.match(b, /fig\.appendChild\(svg\)/);
  const css = read('shared/css/app.css');
  assert.match(css, /\.tb-orb-layer \{ position: absolute; inset: 0; width: 100%; height: 100%;/);
});

test('ひびは絵の箱に重ねる: 絵（.boss-fig）の中に、絵と同じ正方形（viewBox 0 0 100 100）の SVG を置く。位置は絵の中の割合。絵が浮かんでも揺れても一緒に動く', () => {
  const src = code('shared/js/views/trueboss.js');
  const fn = fnBody(src, 'evolveSequence');
  assert.match(fn, /buildCrackLayer\(ui\.fig\)/);
  const b = src.slice(src.indexOf('function buildCrackLayer'), src.indexOf('const rand ='));
  assert.match(b, /setAttribute\('viewBox', '0 0 100 100'\)/);
  assert.match(b, /setAttribute\('preserveAspectRatio', 'xMidYMid meet'\)/, '絵（contain で中央）と同じ正方形に収める');
  assert.match(b, /fig\.appendChild\(svg\)/);
  assert.match(b, /TRUE_CRACKS\.map/);
  const css = read('shared/css/app.css');
  assert.match(css, /\.boss-fig \{ position: relative; \}/, '絵の箱が基準になる');
  assert.match(css, /\.tb-crack-layer \{ position: absolute; inset: 0; width: 100%; height: 100%;/, 'SVG は絵の箱いっぱい');
  assert.doesNotMatch(css, /\.tb-crack \{/, '絵の外に置く古いひび（span）は無い');
  // 絵が入る箱と SVG が同じ箱: SVG は fig の子で、img も fig の子（stage の子ではない）
  assert.doesNotMatch(src, /ui\.fx\.appendChild\(c\)/);
});

test('浮かぶ動き: 第2・第3形態だけ、絵の外側の入れ物（.tb-float）にゆっくり上下の動きが付く。第1形態は付かない。動きを減らす設定で止まる', () => {
  const view = code('shared/js/views/trueboss.js');
  assert.match(view, /ui\.float\.classList\.toggle\('f2', battle\(\)\.form === 2\)/);
  assert.match(view, /ui\.float\.classList\.toggle\('f3', battle\(\)\.form === 3\)/);
  assert.doesNotMatch(view, /classList\.toggle\('f1'/, '第1形態には付けない');
  assert.match(view, /h\('div', \{ class: 'tb-float', 'data-tb-float': '1' \}, fig\)/, 'fig を入れ物で包む');
  const css = read('shared/css/app.css');
  assert.match(css, /\.tb-float\.f2 \{[^}]*animation: tb-float 3\.4s ease-in-out infinite;/);
  assert.match(css, /\.tb-float\.f3 \{[^}]*animation: tb-float 4\.4s ease-in-out infinite;/);
  assert.doesNotMatch(css, /\.tb-float \{[^}]*animation/, '基本の .tb-float（第1形態）には動きを付けない');
  assert.doesNotMatch(css, /\.tb-float\.f1/);
  // 動きは入れ物だけ。絵（.boss-fig）の点滅・揺れ・進化・崩れの動きとは別の要素なので、重ならない
  const keyframes = css.match(/@keyframes tb-float \{[^\n]*/)[0];
  assert.match(keyframes, /translateY/);
  const red = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(red, /\.tb-float\.f2, \.tb-float\.f3 \{ animation: none; \}/);
  assert.doesNotMatch(css, /\.boss-fig[^{]*\{[^}]*tb-float/, '絵そのものには付けない');
});

test('結果の一覧: 「不正解だった問題」を上・「正解だった問題」を下の2つの折りたたみ。最初は閉じる。0問のまとまりは出さない。1問ずつ開閉できる', () => {
  const src = code('shared/js/views/trueboss.js');
  const r = fnBody(src, 'showResult');
  // 順番: 不正解 → 正解（list の子として並べる）
  const iw = r.indexOf("group('wrong', '不正解だった問題'");
  const ir = r.indexOf("group('right', '正解だった問題'");
  assert.ok(iw > 0 && ir > iw, '不正解が上、正解が下');
  assert.match(r, /if \(!rows\.length\) return null;/, '0問のまとまりは出さない');
  assert.match(r, /text: '（' \+ rows\.length \+ '問）'/, '「◯問」を出す');
  // 最初は閉じる（まとまりも1問も）。開閉は button の aria-expanded と、中身の hidden
  assert.match(r, /'aria-expanded': 'false', 'aria-controls': body\.id/);
  assert.match(r, /'aria-expanded': 'false', 'aria-controls': panel\.id/);
  assert.match(r, /hidden: true/);
  assert.match(r, /panel\.hidden = was;/);
  assert.match(r, /btn\.setAttribute\('aria-expanded', was \? 'false' : 'true'\)/);
  // 1問をタップすると解説・図・用語カードが開く。開いたときに作る（もう一度タップで閉じる）
  assert.match(r, /explanation\(app, x\.sq, x\.chosen, open, \{ sensei: false \}\)/);
  assert.match(r, /if \(toggle\(btn, panel\) && !built\)/);
  // まとまり・1問は button（押せる）。問題文の初めの部分を出す
  assert.match(r, /h\('button', \{ class: 'tb-group-btn', type: 'button'/);
  assert.match(r, /h\('button', \{ class: 'tb-q-btn', type: 'button'/);
  assert.doesNotMatch(r, /h\('details'/, '古い details は使わない');
});

test('結果の一覧のCSS: 押せる高さ48px以上。問題文は2行までに切る（開くと全文）。まとまりの色は不正解=赤・正解=緑（色の変数）', () => {
  const css = read('shared/css/app.css');
  assert.match(css, /\.tb-group-btn \{[^}]*min-height: 48px;/);
  assert.match(css, /\.tb-q-btn \{[^}]*min-height: 48px;/);
  assert.match(css, /\.tb-q-btn \.tb-stem \{[^}]*-webkit-line-clamp: 2;/);
  assert.match(css, /\.tb-group\.wrong \.tb-group-btn \{ border-color: var\(--ng\); \}/);
  assert.match(css, /\.tb-group\.right \.tb-group-btn \{ border-color: var\(--ok\); \}/);
  assert.match(css, /\.tb-q-btn\[aria-expanded="true"\] \.tb-stem \{ display: block; -webkit-line-clamp: unset; \}/);
  assert.doesNotMatch(css, /\.tb-group-body \{[^}]*display:|\.tb-q-panel \{[^}]*display:/, 'display を決めると hidden が効かなくなる');
});

test('第2形態を見るまでは「形態」「進化」を画面に出さない（負けた結果・決まりの文・やめる確認・やり直しのボタン）。見たあとは出してよい', async () => {
  const src = code('shared/js/views/trueboss.js');
  const { ruleText } = await import('../js/views/trueboss.js').catch(() => ({}));
  // 結果の画面（負け）
  const r = fnBody(src, 'showResult');
  assert.match(r, /\(trueBossSeenForm2\(app\.state\) \? '第' \+ battle\(\)\.form \+ '形態で、' : ''\) \+ 'HP がなくなりました/);
  assert.match(r, /win \|\| !trueBossSeenForm2\(app\.state\) \? 'もう一度挑む' : 'もう一度挑む（第1形態から）'/);
  // やめる確認
  assert.match(src, /やり直すときは' \+ \(trueBossSeenForm2\(app\.state\) \? '第1形態から' : '最初から'\) \+ 'です/);
  // 決まりの文（最初の問題の上）
  assert.match(src, /text: ruleText\(trueBossSeenForm2\(app\.state\)\)/);
  assert.match(src, /\(seen2 \? 'ボスは進化して、だんだん 手ごわくなります。' : ''\) \+ STREAK_HEAL \+ '問続けて正解すると/);
  // 第2形態を見た印は、第2形態に替わる瞬間（swap）に付ける
  assert.match(fnBody(src, 'evolveSequence'), /if \(markTrueBossSeenForm2\(app\.state\)\) app\.commit\(\)/);
  // 「形態」の文字を直に書いている行は、すべて『見たあと』に出るものだけ（札・問題の上・結果）。許可した行以外に無い
  const lines = src.split('\n').filter((l) => /形態/.test(l) && /['"`].*形態.*['"`]/.test(l));
  for (const l of lines) {
    const ok = /battle\(\)\.form > 1|trueBossSeenForm2|seen2|ev\.evolved|' \+ f \+ '形態|第' \+ battle\(\)\.form|形態から' : '最初から'/.test(l);
    assert.ok(ok, '第2形態を見る前に出るかもしれない「形態」の文: ' + l.trim().slice(0, 100));
  }
  // 入口（地図・復習）と、データ（せりふ）には「形態」を出さない
  const entry = src.slice(src.indexOf('export function trueBossPlace'), src.indexOf('function buildCrackLayer'));
  assert.doesNotMatch(entry, /形態|進化/);
  const data = JSON.parse(read('g-kentei/data/trueboss.json'));
  for (const f of data.forms) for (const arr of Object.values(f.lines)) for (const t of arr) assert.doesNotMatch(t, /形態/, t);
  for (const t of data.lines.ending) assert.doesNotMatch(t, /形態/);
  assert.doesNotMatch(read('shared/js/lib/badges.js').match(/id: 'true-boss'[\s\S]*?progress/)[0], /形態|進化/);
});

test('回復の見せ方: ダメージの文が出終わってから、窓を新しいページにして1つずつ出す。自分の回復 → ボスの回復の順。ダメージの文には混ぜない', () => {
  const src = code('shared/js/views/trueboss.js');
  const fn = fnBody(src, 'answer');
  const perform = fn.slice(fn.indexOf('const perform = () => {'));
  // ダメージのページ（lines）に、回復の文を足していない
  const damage = perform.slice(0, perform.indexOf('else if (ev.playerHealed || ev.bossHealed)'));
  assert.doesNotMatch(damage, /傷を癒やした|いえた/);
  // ページの順: 自分の回復 → ボスの回復
  const pi = perform.indexOf("'あなたの きずが すこし いえた。'");
  const bi = perform.indexOf("' は 傷を癒やした！'");
  assert.ok(pi > 0 && bi > pi, '自分の回復が先');
  assert.match(perform, /if \(ev\.playerHealed\) \{\n\s*pages\.push/);
  assert.match(perform, /if \(ev\.bossHealed\) \{\n\s*pages\.push/);
  // ページの送り: 出終わると arm → タップか約1.4秒で、前の文を消して次のページ
  assert.match(perform, /say\(lines, \{ onDone: arm \}\)/);
  assert.match(perform, /S\.healWait = turnPage;\n\s*later\(turnPage, 1400\);/);
  assert.match(perform, /pages\.shift\(\)\(\)/);
  assert.match(fnBody(src, 'onTap'), /else if \(typing\) typing\.finish\(\);\n\s*else if \(S\.healWait\) S\.healWait\(\);/);
  // ボスの回復: 緑の光（絵のふちに沿う）+ きらきら + 音
  const he = fnBody(src, 'healEffect');
  assert.match(he, /playBossSfx\(app\.state\.settings, 'heal'\)/);
  assert.match(he, /figClass\('add', 'healing'\)/);
  assert.match(he, /reduced\(\) \? null : buildSparkLayer\(ui\.fig\)/, '動きを減らす設定では粒を出さない');
  const css = read('shared/css/app.css');
  assert.match(css, /\.boss-fig\.healing \.boss-img, \.boss-fig\.healing \.boss-fig-sym \{ filter: drop-shadow\(0 0 4px #9dffb0\) drop-shadow\(0 0 12px #2ecc71\)/);
  assert.match(css, /\.tb-spark-layer \{ position: absolute; inset: 0; width: 100%; height: 100%;/);
  const red = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(red, /\.boss-fig\.healing \.boss-img, \.boss-fig\.healing \.boss-fig-sym, \.tb-spark \{ animation: none; \}/);
  assert.match(read('shared/js/lib/sound.js'), /heal: \{ key: 'trueheal', synth: 'heal' \}/);
});

test('自分の回復の見せ方: 答えた瞬間はハートを増やさない。回復のページになった瞬間に、増えるハート1つが緑に光る（上の帯のハートも）。専用の音（playerheal）。進化・撃破のときは、そのまま出す', () => {
  const src = code('shared/js/views/trueboss.js');
  const fn = fnBody(src, 'answer');
  // 答えた瞬間のハートは、回復の分を引いた数
  assert.match(fn, /paintHp\(\{ \.\.\.b, player: b\.player - \(ev\.playerHealed \? 1 : 0\) \}, -1\);/);
  // 回復のページ: ハートを増やして緑に光らせる（paintHp の gainAt）。音
  const eff = fnBody(src, 'playerHealEffect');
  assert.match(eff, /playBossSfx\(app\.state\.settings, 'playerheal'\)/);
  assert.match(eff, /paintHp\(b, -1, b\.player - 1\)/);
  // paintHp は、帯のハート（miniHp）も同じ関数で描く。増えたハートに gain を付ける
  const ph = fnBody(src, 'paintHp');
  assert.match(ph, /\[ui\.hp, ui\.miniHp\]\.forEach/);
  assert.match(ph, /\(i === gainAt \? ' gain' : ''\)/);
  // 進化・撃破のときは、回復のページを出さず、ハートをそのまま出す
  assert.match(fn, /if \(b\.result === 'win' \|\| ev\.evolved\) paintHp\(b, -1\);/);
  const css = read('shared/css/app.css');
  assert.match(css, /\.boss-hearts \.icon\.heart\.gain \{ color: #5fe37a;/, '緑に光る');
  // 動きを減らす設定: 動き（animation）は止め、緑の色だけ残る（gain の color は animation の外）
  const red = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(red, /\.boss-hearts \.icon\.heart\.gain \{ animation: none; \}/);
  // 音のフック: 専用のファイル。ボスの回復（trueheal）とは別
  const snd = read('shared/js/lib/sound.js');
  assert.match(snd, /playerheal: \{ key: 'trueplayerheal', synth: 'playerheal' \}/);
  assert.match(snd, /trueplayerheal: 'true-playerheal_magical-1\.ogg'/);
  assert.notEqual(snd.match(/trueplayerheal: '([^']+)'/)[1], snd.match(/trueheal: '([^']+)'/)[1]);
});

test('形態の絵の入れ替え: 先に読み込んで decode まで済ませる。新しい絵が済んでから前の絵を外す。読み込み中は記号を出さず、失敗したときだけ記号', () => {
  const src = code('shared/js/views/trueboss.js');
  // 先読み: decode まで。失敗は null（次の呼び出しで読み直す）
  const pre = src.slice(src.indexOf('export function preloadFormImage(form)'), src.indexOf('export function preloadFormImages'));
  assert.match(pre, /img\.decode\(\)\.then\(\(\) => resolve\(img\), \(\) => resolve\(null\)\)/);
  assert.match(pre, /formImages\.delete\(form\)/);
  // 表示用のコピーも decode を待つ
  const ready = src.slice(src.indexOf('async function readyImage'), src.indexOf('/** 小さな丸'));
  assert.match(ready, /await preloadFormImage\(form\)/);
  assert.match(ready, /await el\.decode\(\)/);
  // 記号を出すのは、絵が無い（読み込みに失敗した）ときだけ。読み込み中（最初の呼び出しの時点）には出さない
  const fig = src.slice(src.indexOf('function fillFigure(wrap, form)'), src.indexOf('/** 真ボスに挑む'));
  assert.doesNotMatch(fig.slice(0, fig.indexOf('return readyImage(form).then')), /boss-fig-sym|clear\(wrap\)/, '読み込み中に、中身を消したり記号を出したりしない');
  assert.match(fig, /if \(img\) \{ wrap\.appendChild\(img\); wrap\.classList\.add\('has-img'\); \} else \{[^}]*boss-fig-sym/);
  const art = src.slice(src.indexOf('function fillArt('), src.indexOf('export function trueBossArt'));
  assert.doesNotMatch(art.slice(0, art.indexOf('return readyImage(form).then')), /TRUE_BOSS_SYMBOL/, '丸の絵も、読み込み中に記号を出さない');
  // 進化で替えるとき: 新しい絵の入れ替えが済んでから、前の絵を隠していた gone などを外す
  const evo = fnBody(src, 'evolveSequence');
  assert.match(evo, /paintForm\(\)\.then\(\(\) => \{\n\s*figClass\('remove', 'glow', 'blinkoff', 'gone'/);
  assert.doesNotMatch(evo.slice(0, evo.indexOf('paintForm().then')), /figClass\('remove', [^)]*'gone'/, '入れ替えの前に gone を外さない');
  assert.match(fnBody(src, 'paintForm'), /return Promise\.all\(\[fillFigure\(ui\.fig, battle\(\)\.form\), fillArt\(ui\.miniArt, battle\(\)\.form, false\)\]\)/);
  // 先読みの場所: 入口を出したとき・画面を開いたとき
  assert.match(src, /preloadFormImages\(\); \/\/ 入口を出したときに/);
  assert.match(src, /preloadFormImages\(\); \/\/ 3形態の絵を先に読み込む/);
  assert.doesNotMatch(src, /function loadFormImage/, '読み込み中に記号を出す古い読み込みは無い');
});

test('自分の回復の音のファイル: 実在し、ライセンスの記録・sw-core.js にある。ボスの回復の音とは別のファイル', () => {
  const doc = read('docs/sources/audio-licenses.md');
  const f = 'true-playerheal_magical-1.ogg';
  assert.ok(existsSync(root + 'shared/audio/sfx/' + f));
  assert.equal(readFileSync(root + 'shared/audio/sfx/' + f).length, 14993);
  assert.ok(doc.includes(f) && doc.includes('magical_1_0.ogg') && doc.includes('59,071'));
  assert.ok(read('shared/sw-core.js').includes("'" + f + "'"));
  assert.ok(read('shared/js/views/about.js').includes('JaggedStone'));
});

test('自分の回復の光は、約1.5秒でふつうの赤に戻る（gain を外す）', () => {
  const eff = fnBody(code('shared/js/views/trueboss.js'), 'playerHealEffect');
  assert.match(eff, /later\(\(\) => \{ \[ui\.hp, ui\.miniHp\]\.forEach\(\(box\) => \{ if \(box\) box\.querySelectorAll\('\.gain'\)\.forEach\(\(e\) => e\.classList\.remove\('gain'\)\); \}\); \}, 1500\)/);
});
