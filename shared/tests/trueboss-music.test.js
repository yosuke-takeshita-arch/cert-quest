// 真ボスの曲・効果音の楽譜（lib/trueboss-music.js）と、audio.js の結線の検証。ブラウザ無しで node から叩く。
// 実際の音（耳で聞いた聞こえ方）は確かめられない。ここで確かめるのは、楽譜が読めること・長さが合うこと・章のボスの曲と同じ仕組みで鳴ること・設定に従うこと。
// 実行: cd shared && node --test tests/trueboss-music.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { noteFreq, bossTheme, SYNTH_SFX, sfxLength } from '../js/lib/bossmusic.js';
import {
  trueBossTheme, TRUE_SFX, TRUE_LEAD, TRUE_BASS, TRUE_FINAL_LEAD, TRUE_FINAL_ARP, TRUE_THEME_BPM, TRUE_FINAL_BPM, TRUE_STEP_SEC, TRUE_FINAL_STEP_SEC,
} from '../js/lib/trueboss-music.js';
import { bgmPlan, TRUE_BOSS_BGM, BGM_TRACKS, BGM_GAIN_MAX, TARGET_BGM_RMS, bgmGain, normalizeBgmTrack, SFX_FILES, BOSS_SFX } from '../js/lib/sound.js';

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
  const orbs = Array.from({ length: 13 }, (_, i) => 'orb' + i);
  assert.deepEqual(Object.keys(TRUE_SFX).sort(), ['charge', 'ending', 'evolve', 'heal', 'heartbeat', 'impact', ...orbs, 'skill'].sort());
  // 光の玉が灯る音は、1つごとに高くなる
  const f0 = (k) => TRUE_SFX['orb' + k][0].freq;
  for (let k = 1; k < 13; k++) assert.ok(f0(k) > f0(k - 1), 'orb' + k + ' は orb' + (k - 1) + ' より高い');
  assert.ok(len('heartbeat') > 0.2 && len('heartbeat') < 0.6 && len('impact') > 0.5 && len('impact') <= 1.5 && len('charge') >= 2 && len('charge') <= 4);
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

test('audio.js の結線: 真ボスの曲は形態ごとのファイル（TRUE_BOSS_BGM）をくり返し、取れなければプログラムの曲。形態が替わったら曲を替える。効果音は playSynth で引く', () => {
  const src = readFileSync(fileURLToPath(new URL('../js/audio.js', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /import \{ trueBossTheme, TRUE_SFX \} from '\.\/lib\/trueboss-music\.js';/);
  assert.match(src, /M\.theme = M\.trueForm \? trueBossTheme\(Math\.min\(M\.trueForm, 3\)\) : bossTheme\(\)/, 'プログラムの曲（ファイルが取れないとき）を選ぶところ');
  assert.match(src, /\(M\.trueForm \? TRUE_BOSS_BGM\[M\.trueForm\] : BOSS_BGM\)\.file/, 'ファイルの曲を選ぶところ');
  assert.match(src, /M\.el\.loop = M\.trueForm !== 4/, 'エンディング（4）だけくり返さない');
  assert.match(src, /if \(M\.trueForm === 4\) \{ scheduleEvents\(c, M\.gain, TRUE_SFX\.ending/, 'エンディングの曲が取れないときは短いファンファーレ');
  assert.match(src, /export function startBossTheme\(trueForm = 0\)/);
  assert.match(src, /const score = SYNTH_SFX\[name\] \|\| TRUE_SFX\[name\];/, '効果音の引き方');
  assert.match(src, /scheduleEvents\(c, g, score, /);
  // 曲が替わるとき（形態が替わった）は、鳴っている曲を小さくして止め、armed のまま新しい曲を始める
  const fn = src.slice(src.indexOf('export function startBossTheme'), src.indexOf('export function stopBossTheme'));
  assert.match(fn, /const themeChanged = f !== M\.trueForm;/);
  assert.match(fn, /if \(themeChanged && M\.running\) stopBossMusic\(false\)/);
  assert.match(fn, /M\.armed = true;\s*syncBgm\(\);/);
  // 章のボス（引数なし）に戻ったら、真ボスの曲の印を外す
  assert.match(fn, /const f = Number\.isInteger\(trueForm\) && trueForm >= 1 \? Math\.min\(trueForm, 4\) : 0;/);
  assert.match(fn, /M\.trueForm = f;/);
  // 音量は曲ごとの trim（ファイルが取れないときは synth の補正）
  assert.match(src, /TRUE_BOSS_SYNTH_TRIM : BOSS_BGM\.synthTrim\) : e\.trim/);
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
  assert.match(view, /startBossTheme\(battle\(\)\.form\)/, '進化したら、その形態の曲に替える');
  assert.match(view, /startBossTheme\(4\)/, 'エンディングの曲');
  assert.match(view, /stopBossTheme\(\)/);
  assert.match(view, /setBgmBoss\(false\)/);
});

// ---- 外部の素材（2026-10-23。CC0）----
const sharedDir = fileURLToPath(new URL('..', import.meta.url));
const licenses = () => readFileSync(sharedDir + '../docs/sources/audio-licenses.md', 'utf8');

test('真ボスの曲のファイル: 4つとも実在し、mp3 で 1曲3MB 以下。ライセンスの記録に載っている。設定の曲の一覧には入らない。trim は目盛り100でも割れない値', () => {
  assert.deepEqual(Object.keys(TRUE_BOSS_BGM), ['1', '2', '3', '4']);
  const doc = licenses();
  for (const [form, t] of Object.entries(TRUE_BOSS_BGM)) {
    const p = sharedDir + 'audio/bgm/' + t.file;
    assert.ok(existsSync(p), p);
    assert.match(t.file, /\.mp3$/);
    assert.ok(statSync(p).size <= 3 * 1024 * 1024, t.file + ' が3MBを超えている');
    assert.ok(doc.includes(t.file), t.file + ' が audio-licenses.md に無い');
    assert.ok(!BGM_TRACKS.some((x) => x.file === t.file), '設定の曲の一覧に入っている');
    assert.ok(t.trim > 0 && t.trim < 1, form);
    assert.ok(t.peak * t.trim * BGM_GAIN_MAX < 1, '目盛り100で割れる: ' + form);
    // rms から決めた trim と合っている（素材を替えたら測り直す）
    assert.ok(Math.abs(t.trim - TARGET_BGM_RMS / (t.rms * bgmGain(40))) < 0.002, 'trim が rms と合っていない: ' + form);
  }
  for (const w of ['Centurion_of_war', 'Yoiyami', 'final-stand-0', 'CC0 1.0 Universal']) assert.ok(doc.includes(w), w);
  assert.equal(statSync(sharedDir + 'audio/bgm/' + TRUE_BOSS_BGM[1].file).size, 1365889);
  assert.equal(statSync(sharedDir + 'audio/bgm/' + TRUE_BOSS_BGM[4].file).size, 1680768);
  // 設定画面・タイトル画面の「BGM の一覧」に、真ボスの曲の名前が出ない
  assert.equal(normalizeBgmTrack('true-boss'), 'auto');
});

test('真ボスの効果音のファイル: 実在し、200KB 未満の ogg。SFX_FILES・sw-core.js の先取りの一覧・ライセンスの記録がそろっている。ひびと砕ける音は BOSS_SFX にある', () => {
  const doc = licenses();
  const sw = readFileSync(sharedDir + 'sw-core.js', 'utf8');
  const files = { truecrack1: 'true-crack_ice-small-1.ogg', truecrack2: 'true-crack_ice-small-2.ogg', trueshatter1: 'true-shatter_ice-big-1.ogg', trueshatter2: 'true-shatter_ice-big-2.ogg', truerumble: 'true-rumble_earthquake-shake.ogg' };
  for (const [k, f] of Object.entries(files)) {
    assert.equal(SFX_FILES[k], f);
    const p = sharedDir + 'audio/sfx/' + f;
    assert.ok(existsSync(p), p);
    assert.ok(statSync(p).size < 200 * 1024, f);
    assert.match(f, /\.ogg$/);
    assert.ok(doc.includes(f), f + ' が audio-licenses.md に無い');
    assert.ok(sw.includes("'" + f + "'"), f + ' が sw-core.js の SFX に無い');
  }
  assert.deepEqual([BOSS_SFX.crack1.key, BOSS_SFX.crack2.key, BOSS_SFX.shatter1.key, BOSS_SFX.shatter2.key, BOSS_SFX.rumble.key], ['truecrack1', 'truecrack2', 'trueshatter1', 'trueshatter2', 'truerumble']);
  // ファイルが読めないときは、砕ける音だけ昔のプログラムの進化の音、地鳴りは低い警告音に戻る
  assert.equal(BOSS_SFX.shatter1.synth, 'evolve');
  assert.equal(BOSS_SFX.rumble.synth, 'skill');
  assert.ok(TRUE_SFX.evolve && TRUE_SFX.skill);
  for (const w of ['IgnasD', 'mieki256', 'ice-breakingshattering', 'earthquake-and-open-sesame', 'LedasLuzta5.ogg', 'shake.flac']) assert.ok(doc.includes(w), w);
});


test('進化のタメの効果音のファイル（外部の素材）: 6つとも実在し、200KB 未満の ogg。SFX_FILES・sw-core.js の先取りの一覧・ライセンスの記録がそろっている。ひみつではなく作者を載せている', () => {
  const doc = licenses();
  const sw = readFileSync(sharedDir + 'sw-core.js', 'utf8');
  const about = readFileSync(sharedDir + 'js/views/about.js', 'utf8');
  const files = { trueheartbeat: 'true-heartbeat_slow.ogg', trueheartbeatfast: 'true-heartbeat_fast.ogg', trueorb: 'true-orb_bell-ding.ogg', truecharge: 'true-charge_rocket-launch.ogg', trueimpact: 'true-impact_chunky-explosion.ogg', truehit: 'true-impact_transformation-hit.ogg' };
  for (const [k, f] of Object.entries(files)) {
    assert.equal(SFX_FILES[k], f);
    assert.ok(existsSync(sharedDir + 'audio/sfx/' + f), f);
    assert.ok(statSync(sharedDir + 'audio/sfx/' + f).size < 200 * 1024, f);
    assert.ok(doc.includes(f), f + ' が audio-licenses.md に無い');
    assert.ok(sw.includes("'" + f + "'"), f + ' が sw-core.js の SFX に無い');
  }
  for (const w of ['bart', 'PWL', 'qzlocx', 'Joth', 'Dizzy Crow', 'heartbeat-sounds', 'bell-dingschimes', 'weird-rocket-launch-sound', 'chunky-explosion', 'epic-transformation-124', '37.6秒〜39.8秒']) { assert.ok(doc.includes(w), w); if (/^[A-Za-z ]+$/.test(w) && w.length < 12) assert.ok(about.includes(w), w + ' が about.js に無い'); }
  // フック → 素材のキー
  assert.deepEqual(['heartbeat', 'heartbeatfast', 'orb', 'charge', 'impact', 'finalhit'].map((k) => BOSS_SFX[k].key), ['trueheartbeat', 'trueheartbeatfast', 'trueorb', 'truecharge', 'trueimpact', 'truehit']);
  // 鼓動は、ファイルが読めないときはプログラムの鼓動（前半・後半とも）。玉・決めの一撃は、無ければ無音（玉は呼ぶ側がプログラムの音を渡す）
  assert.equal(BOSS_SFX.heartbeat.synth, 'heartbeat');
  assert.equal(BOSS_SFX.heartbeatfast.synth, 'heartbeat');
  assert.equal(BOSS_SFX.orb.synth, null);
  assert.equal(BOSS_SFX.finalhit.synth, null);
  assert.ok(BOSS_SFX.charge.boost > 1 && BOSS_SFX.charge.boost <= 2);
});

test('ボスの回復の音（外部の素材）: ファイルが実在し、1.5秒ほどの ogg。SFX_FILES・sw-core.js・ライセンスの記録・作者の表示がそろい、フック heal がこのファイルを指す。読めないときはプログラムの heal', () => {
  const f = 'true-heal_magical-3.ogg';
  assert.equal(SFX_FILES.trueheal, f);
  assert.ok(existsSync(sharedDir + 'audio/sfx/' + f));
  assert.ok(statSync(sharedDir + 'audio/sfx/' + f).size < 200 * 1024);
  assert.equal(statSync(sharedDir + 'audio/sfx/' + f).size, 16749);
  assert.ok(readFileSync(sharedDir + 'sw-core.js', 'utf8').includes("'" + f + "'"));
  const doc = licenses();
  for (const w of [f, 'JaggedStone', 'magic-spell-sfx', 'None needed']) assert.ok(doc.includes(w), w);
  assert.ok(readFileSync(sharedDir + 'js/views/about.js', 'utf8').includes('JaggedStone'));
  assert.equal(BOSS_SFX.heal.key, 'trueheal');
  assert.equal(BOSS_SFX.heal.synth, 'heal');
  assert.ok(TRUE_SFX.heal, '読めないときの、プログラムの heal');
});
