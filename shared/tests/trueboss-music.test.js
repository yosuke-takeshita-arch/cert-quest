// 真ボスの曲・効果音の楽譜（lib/trueboss-music.js）と、audio.js の結線の検証。ブラウザ無しで node から叩く。
// 実際の音（耳で聞いた聞こえ方）は確かめられない。ここで確かめるのは、楽譜が読めること・長さが合うこと・章のボスの曲と同じ仕組みで鳴ること・設定に従うこと。
// 実行: cd shared && node --test tests/trueboss-music.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { noteFreq, bossTheme, SYNTH_SFX, sfxLength } from '../js/lib/bossmusic.js';
import {
  trueBossTheme, TRUE_SFX, TRUE_LEAD, TRUE_BASS, TRUE_FINAL_LEAD, TRUE_FINAL_ARP, TRUE_THEME_BPM, TRUE_FINAL_BPM, TRUE_STEP_SEC, TRUE_FINAL_STEP_SEC,
} from '../js/lib/trueboss-music.js';
import { bgmPlan } from '../js/lib/sound.js';

const WAVES = ['square', 'triangle'];

test('曲の楽譜: どの小節も8拍で、全部の音名が読める（旋律・低音・伴奏）', () => {
  for (const [name, bars] of [['旋律', TRUE_LEAD], ['低音', TRUE_BASS], ['第3形態の旋律', TRUE_FINAL_LEAD], ['第3形態の伴奏', TRUE_FINAL_ARP]]) {
    assert.equal(bars.length, 8, name + 'は8小節');
    bars.forEach((bar, i) => {
      const toks = bar.trim().split(/\s+/);
      assert.equal(toks.length, 8, name + ' ' + (i + 1) + '小節目は8拍: ' + bar);
      for (const t of toks) if (t !== '-' && t !== '.') assert.ok(noteFreq(t) > 0, name + ' ' + (i + 1) + '小節目の音名が読めない: ' + t);
    });
  }
});

test('曲1周ぶん: 章のボスの曲（bossTheme）と同じ形（loopSec と voices の { wave, gain, events:[{t,dur,freq}] }）。audio.js がそのまま鳴らせる', () => {
  const ref = bossTheme();
  for (const form of [1, 2, 3]) {
    const th = trueBossTheme(form);
    assert.ok(th.loopSec > 5 && th.loopSec < 30, 'loopSec=' + th.loopSec);
    assert.deepEqual(Object.keys(th).sort(), Object.keys(ref).sort());
    assert.ok(th.voices.length >= 2);
    for (const v of th.voices) {
      assert.ok(WAVES.includes(v.wave));
      assert.ok(v.gain > 0 && v.gain <= 1);
      assert.ok(v.events.length > 0);
      let last = -1;
      for (const e of v.events) {
        assert.ok(Number.isFinite(e.freq) && e.freq > 20 && e.freq < 5000, '周波数: ' + e.freq);
        assert.ok(e.dur > 0 && e.t >= 0);
        assert.ok(e.t + e.dur <= th.loopSec + 1e-9, '1周の外にはみ出す音');
        assert.ok(e.t >= last, '音が時刻順');
        last = e.t;
      }
    }
  }
});

test('曲の長さ: 8小節×8拍ぶん。第1・第2形態は 156 BPM、第3形態は 176 BPM で速い。旋律と低音の長さが同じ', () => {
  const a = trueBossTheme(1);
  const c = trueBossTheme(3);
  assert.ok(Math.abs(a.loopSec - 64 * TRUE_STEP_SEC) < 1e-9);
  assert.ok(Math.abs(c.loopSec - 64 * TRUE_FINAL_STEP_SEC) < 1e-9);
  assert.equal(TRUE_THEME_BPM, 156);
  assert.equal(TRUE_FINAL_BPM, 176);
  assert.ok(c.loopSec < a.loopSec, '第3形態のほうが速い');
  assert.equal(trueBossTheme(2).loopSec, a.loopSec, '第2形態は第1形態と同じ曲');
  assert.equal(trueBossTheme().loopSec, a.loopSec, '省くと第1形態の曲');
  // 低音は旋律と同じ長さ（loop のずれが出ない）
  const total = (th, k) => th.voices[k].events.reduce((m, e) => Math.max(m, e.t + e.dur), 0);
  assert.ok(total(a, 0) <= a.loopSec + 1e-9 && total(a, 1) <= a.loopSec + 1e-9);
  assert.ok(total(c, 0) <= c.loopSec + 1e-9 && total(c, 2) <= c.loopSec + 1e-9);
});

test('第3形態の曲は、声が3つ（旋律・伴奏・低音）で、第1・第2形態の曲や章のボスの曲とは別の曲', () => {
  const a = trueBossTheme(1);
  const c = trueBossTheme(3);
  const ch = bossTheme();
  assert.equal(a.voices.length, 2);
  assert.equal(c.voices.length, 3);
  const sig = (th) => JSON.stringify(th.voices[0].events.map((e) => Math.round(e.freq)));
  assert.notEqual(sig(a), sig(c));
  assert.notEqual(sig(a), sig(ch), '章のボスの曲とは旋律が違う');
  assert.notEqual(sig(c), sig(ch));
  assert.notEqual(a.loopSec, ch.loopSec);
});

test('効果音: 進化・技・回復・エンディング。全部の音が正の周波数・長さで、長さは 進化 1〜2.5 秒・技 1 秒以内・回復 1 秒以内・エンディング 4〜7 秒', () => {
  const len = (name) => TRUE_SFX[name].reduce((m, e) => Math.max(m, e.t + e.dur), 0);
  assert.deepEqual(Object.keys(TRUE_SFX).sort(), ['ending', 'evolve', 'heal', 'skill']);
  for (const [name, ev] of Object.entries(TRUE_SFX)) {
    assert.ok(ev.length > 0, name);
    for (const e of ev) {
      assert.ok(WAVES.includes(e.wave), name);
      assert.ok(e.freq > 0 && e.dur > 0 && e.t >= 0 && e.gain > 0 && e.gain <= 1, name + ' ' + JSON.stringify(e));
      if (e.to) assert.ok(e.to > 0);
    }
  }
  assert.ok(len('evolve') >= 1 && len('evolve') <= 2.5, 'evolve ' + len('evolve'));
  assert.ok(len('skill') > 0 && len('skill') <= 1, 'skill ' + len('skill'));
  assert.ok(len('heal') > 0 && len('heal') <= 1, 'heal ' + len('heal'));
  assert.ok(len('ending') >= 4 && len('ending') <= 7, 'ending ' + len('ending'));
  // 章のボスの効果音と名前が重ならない（playSynth が名前だけで引くので、重なると片方が鳴らない）
  for (const k of Object.keys(TRUE_SFX)) assert.equal(k in SYNTH_SFX, false, k + ' が章のボスの効果音と同じ名前');
  assert.ok(sfxLength('fanfare') > 0, '（比較）章のボスの効果音の長さの数え方は変えていない');
});

test('audio.js の結線: 真ボスの曲は章のボスの曲と同じ仕組み（予約して8小節をくり返す）で、ファイルを取らずプログラムの曲だけ。形態3で曲を替える。効果音は playSynth で引く', () => {
  const src = readFileSync(fileURLToPath(new URL('../js/audio.js', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /import \{ trueBossTheme, TRUE_SFX \} from '\.\/lib\/trueboss-music\.js';/);
  assert.match(src, /M\.theme = M\.trueForm \? trueBossTheme\(M\.trueForm\) : bossTheme\(\)/, '予約する曲を選ぶところ');
  assert.match(src, /if \(M\.trueForm\) \{ startBossSynth\(\); return; \}/, '真ボスはファイルの曲を取らない');
  assert.match(src, /export function startBossTheme\(trueForm = 0\)/);
  assert.match(src, /const score = SYNTH_SFX\[name\] \|\| TRUE_SFX\[name\];/, '効果音の引き方');
  assert.match(src, /scheduleEvents\(c, g, score, /);
  // 曲を替えるとき（第3形態）は、鳴っている曲を小さくして止め、armed のまま新しい曲を始める
  const fn = src.slice(src.indexOf('export function startBossTheme'), src.indexOf('export function stopBossTheme'));
  assert.match(fn, /if \(themeChanged && M\.running\) stopBossMusic\(false\)/);
  assert.match(fn, /M\.armed = true;\s*syncBgm\(\);/);
  // 章のボス（引数なし）に戻ったら、真ボスの曲の印を外す
  assert.match(fn, /const f = Number\.isInteger\(trueForm\) && trueForm >= 1 \? Math\.min\(trueForm, 3\) : 0;/);
  assert.match(fn, /M\.trueForm = f;/);
});

test('BGM の設定に従う: 真ボスの間も、章のボスと同じ boss 場面。BGM（問題中）がオンなら鳴り、オフなら何も鳴らさない', () => {
  const on = { bgm: true, bgmHome: true, bgmTrack: 'calm-loop', bgmHomeTrack: 'title' };
  assert.deepEqual(bgmPlan(on, { inBoss: true }), { scene: 'boss', track: 'boss' });
  assert.equal(bgmPlan({ ...on, bgm: false }, { inBoss: true }), null);
  assert.equal(bgmPlan(on, { inBoss: true, hidden: true }), null);
  // 真ボスの画面が setBgmBoss を立て、曲を始める／止める
  const view = readFileSync(fileURLToPath(new URL('../js/views/trueboss.js', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
  assert.match(view, /setBgmBoss\(true\)/);
  assert.match(view, /startBossTheme\(1\)/);
  assert.match(view, /startBossTheme\(battle\(\)\.form === 3 \? 3 : 2\)/, '進化したら、第3形態だけ別の曲');
  assert.match(view, /stopBossTheme\(\)/);
  assert.match(view, /setBgmBoss\(false\)/);
});
