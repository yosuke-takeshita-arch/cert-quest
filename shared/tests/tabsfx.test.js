// 下のタブを押したときの『ピッ』（2026-10-25 先生決定 B）。実際に鳴るかは実機で確かめる。ここでは配線と条件を見る。
// 実行: cd shared && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SFX_FILES, TAB_SFX_BOOST, shouldPlayTabSfx, sfxGain } from '../js/lib/sound.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(shared, '..');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const app = read(join(shared, 'js', 'app.js'));
const audio = read(join(shared, 'js', 'audio.js'));

test('タブの音: SFX_FILES に載り、ファイルが実在して小さく、sw-core.js の SFX と audio-licenses.md にも載っている', () => {
  assert.equal(SFX_FILES.tab, 'select_002.ogg');
  const p = join(shared, 'audio', 'sfx', SFX_FILES.tab);
  assert.ok(existsSync(p));
  assert.ok(statSync(p).size < 10 * 1024);
  assert.ok(read(join(shared, 'sw-core.js')).includes("'select_002.ogg'"));
  const doc = read(join(root, 'docs', 'sources', 'audio-licenses.md'));
  const row = doc.split('\n').find((l) => l.includes('`select_002.ogg`'));
  assert.ok(row && /\| CC0 \|/.test(row));
  assert.ok(!Object.entries(SFX_FILES).some(([k, v]) => k !== 'tab' && v === SFX_FILES.tab));
});

test('タブの音: 控えめな音量（1 未満）', () => {
  assert.ok(TAB_SFX_BOOST > 0 && TAB_SFX_BOOST < 1);
});

test('タブの音: 今いるタブを押し直したときは鳴らさない。別のタブ・同じタブでも別の画面（アドレスが違う）なら鳴らす', () => {
  assert.equal(shouldPlayTabSfx(true, '#/home', '#/home'), false);
  assert.equal(shouldPlayTabSfx(false, '#/home', '#/map'), true);
  assert.equal(shouldPlayTabSfx(true, '#/stage/abc', '#/map'), true);
  assert.equal(shouldPlayTabSfx(false, '', '#/home'), true);
  assert.equal(shouldPlayTabSfx(undefined, '#/home', '#/home'), true);
});

test('タブの音の配線: 下のタブの click で playSfx(…, tab) を呼ぶ。条件は shouldPlayTabSfx。ファイルが読めなければ何も鳴らさない', () => {
  const j = app.indexOf('nav.appendChild(a)');
  const i = app.lastIndexOf("a.addEventListener('click'", j);
  assert.ok(i > 0 && j > i);
  const body = app.slice(i, j);
  assert.match(body, /if \(shouldPlayTabSfx\(a\.getAttribute\('aria-current'\) === 'page', window\.location\.hash, n\.hash\)\) playSfx\(app\.state\.settings, 'tab', \(\) => \{\}, TAB_SFX_BOOST\)/);
  // タブの click の中だけ。ほかの場所（画面の替わり・ボタン）では tab を鳴らさない
  assert.equal(app.split("'tab'").length - 1, 1);
  assert.ok(!body.includes('tabPressed')); // transition.test.js が見る目印の click とは別の listener
});

test('タブの音: 効果音の設定（sound）がオフなら鳴らさない／音量 0 でも鳴らさない（playSfx の入口）', () => {
  const i = audio.indexOf('export function playSfx(');
  const head = audio.slice(i, audio.indexOf('resumeCtx();', i));
  assert.match(head, /!settings\.sound/);
  assert.match(head, /gain <= 0\) return/);
  assert.equal(sfxGain(0), 0);
});
