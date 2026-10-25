// 秒数チャレンジのはじめの画面（要件定義書 §6「時間の練習」、2026-10-25 先生決定）の検証。
// 見ているもの: 画面の作り（見出し・説明・きろく・はじめる・戻る）の結線、はじめる を押すまで問題と遊びの曲が始まらないこと、
//   結果の「もう一度」は説明を飛ばすこと、場面の扱いが模擬試験・どっち？と同じこと（ROUTES の play は場面）、名前と秒数が config どおりに出ること
// 見ていないもの: 実際の見た目と押した結果（Playwright で撮って押す）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { challengeName, secondsPerQuestion } from '../js/lib/quiz.js';
import { sceneKind } from '../js/lib/transition.js';
import { XP } from '../js/lib/scoring.js';
import { root } from './apps.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const play = readFileSync(join(shared, 'js', 'views', 'play.js'), 'utf8');
const appSrc = readFileSync(join(shared, 'js', 'app.js'), 'utf8');

function functionBody(src, name) {
  const m = new RegExp('function ' + name + '\\(').exec(src);
  if (!m) throw new Error('関数が見つからない: ' + name);
  const open = src.indexOf('{', src.indexOf(')', m.index));
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error('閉じ括弧が無い: ' + name);
}

test('はじめの画面: 戻る・見出し(challengeName)・説明とルール・きろく・はじめる が並ぶ。問題数・秒数・点は実装と config から作る', () => {
  const intro = functionBody(play, 'drawIntro');
  assert.match(intro, /data-challenge-back/);
  assert.match(intro, /h\('h1', \{ text: challengeName\(app\.config\) \}\)/);
  assert.match(intro, /n \+ '問。1問の制限時間は ' \+ limit \+ ' 秒です/); // 数は S.items.length、秒は secondsPerQuestion(config)
  assert.match(intro, /'\+' \+ XP\.time|\+' \+ XP\.time/); // 時間内の加点は scoring.js の値
  assert.match(intro, /遊び用の曲/);
  assert.match(intro, /data-challenge-record/);
  assert.match(intro, /data-challenge-start[\s\S]*onClick: begin/);
  // 並び: 戻る → 見出し → 説明 → きろく → はじめる
  const order = ['data-challenge-back', "h('h1'", 'data-challenge-intro', 'data-challenge-record', 'data-challenge-start'].map((k) => intro.indexOf(k));
  assert.ok(order.every((x) => x >= 0), String(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.equal(XP.time, 3);
});

test('はじめる を押すまで始まらない: 遊びの曲(setBgmRush(true))と最初の問題の描画は begin() の中だけ。timed のときだけ説明を出す', () => {
  const begin = functionBody(play, 'begin');
  assert.match(begin, /if \(timed\) setBgmRush\(true\)/);
  assert.match(begin, /draw\(\)/);
  assert.equal((play.match(/setBgmRush\(true\)/g) || []).length, 1);
  const render = functionBody(play, 'renderPlay');
  assert.match(render, /if \(timed && !spec\.skipIntro\) drawIntro\(\);[^\n]*\n\s*else begin\(\);/);
  // 説明の最中はキー(1〜8)で答えが入らない
  assert.match(render, /!S\.intro && !S\.answered && \/\^\[1-8\]\$\/\.test\(e\.key\)/);
  // drawIntro は問題の描画(draw)・タイマー・遊びの曲を始めない
  const intro = functionBody(play, 'drawIntro');
  assert.doesNotMatch(intro, /\bdraw\(|setInterval|setBgmRush\(true\)/);
});

test('結果の「もう一度」は説明を飛ばして始める(skipIntro)。ステージ・復習には説明が付かない(timed のみ)', () => {
  assert.match(play, /startSession\(app, \{ \.\.\.spec, skipIntro: true \}\)/);
  assert.match(play, /const timed = spec\.mode === 'challenge'/);
});

test('場面の扱いは模擬試験・どっち？と同じ: play も下のメニューを隠す場面で、ホームから入ると斜めのドット(wipe)', () => {
  assert.match(appSrc, /\['play', 'home', \(\) => renderPlay\(app\), true\]/);
  assert.match(appSrc, /\['exam', 'more', \(\) => renderExam\(app\), true\]/);
  assert.match(appSrc, /\['dochi', 'home', \(\) => renderDochi\(app\), true\]/);
  for (const to of ['play', 'exam', 'dochi']) assert.equal(sceneKind({ name: 'home', full: false }, { name: to, full: true }), 'wipe', to);
});

test('名前と秒数は config どおり(4アプリ): challengeName = 秒数 + 秒チャレンジ', () => {
  const files = ['g-kentei', 'dx-biz', 'ai-passport', join('shindanshi', '1ji'), join('shindanshi', '2ji')].map((d) => join(root, d, 'config.json')).filter((f) => existsSync(f));
  assert.ok(files.length >= 4, String(files.length));
  const want = { 'g-kentei': 40, 'dx-biz': 48, 'ai-passport': 60 };
  for (const f of files) {
    const cfg = JSON.parse(readFileSync(f, 'utf8'));
    const sec = secondsPerQuestion(cfg);
    assert.equal(sec, cfg.secondsPerQuestion);
    assert.equal(challengeName(cfg), cfg.secondsPerQuestion + '秒チャレンジ', f);
    for (const k of Object.keys(want)) if (f.includes(k)) assert.equal(sec, want[k], f);
  }
});
