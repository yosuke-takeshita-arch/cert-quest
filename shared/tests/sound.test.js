// 音（BGM・効果音）の設定と素材。ブラウザは使わない（実際に鳴るかは画面で確かめる）。
// 実行: cd shared && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_SFX_VOLUME, DEFAULT_BGM_VOLUME, BGM_GAIN_MAX, SFX_FILES, BGM_TRACKS,
  normalizeVolume, normalizeSoundSettings, sfxGain, bgmGain, celebrateSfx, nextBgmPosition,
} from '../js/lib/sound.js';
import { defaultState, mergeState } from '../js/lib/progress.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(shared, '..');

test('音量: 0〜100 の整数に丸める。範囲外は端に寄せ、数でないものは初期値', () => {
  const f = 55;
  assert.equal(normalizeVolume(0, f), 0);
  assert.equal(normalizeVolume(100, f), 100);
  assert.equal(normalizeVolume(-1, f), 0);
  assert.equal(normalizeVolume(101, f), 100);
  assert.equal(normalizeVolume(1, f), 1);
  assert.equal(normalizeVolume(99, f), 99);
  assert.equal(normalizeVolume(40.6, f), 41);
  assert.equal(normalizeVolume('70', f), 70);
  assert.equal(normalizeVolume(-500, f), 0);
  assert.equal(normalizeVolume(1e9, f), 100);
  for (const bad of [NaN, Infinity, -Infinity, 'abc', '', null, undefined, true, false, {}, []]) assert.equal(normalizeVolume(bad, f), f, String(bad));
});

test('音の初期値: 効果音オフ・BGM オフ・音量は効果音70／BGM40', () => {
  const s = defaultState().settings;
  assert.equal(s.sound, false);
  assert.equal(s.bgm, false);
  assert.equal(s.sfxVolume, 70);
  assert.equal(s.bgmVolume, 40);
  assert.equal(DEFAULT_SFX_VOLUME, 70);
  assert.equal(DEFAULT_BGM_VOLUME, 40);
});

test('保存データ: 古い記録（sound だけ）は、効果音のオン／オフとして引き継ぐ。ほかは初期値で埋まる', () => {
  const on = mergeState({ settings: { sound: true, vibrate: false } }).settings;
  assert.equal(on.sound, true);
  assert.equal(on.vibrate, false);
  assert.equal(on.bgm, false);
  assert.equal(on.sfxVolume, 70);
  assert.equal(on.bgmVolume, 40);
  const off = mergeState({ settings: { sound: false } }).settings;
  assert.equal(off.sound, false);
  assert.equal(mergeState(null).settings.sound, false);
  assert.equal(mergeState({}).settings.bgm, false);
});

test('保存データ: 音の項目の不正な値は直る。正しい値は残る', () => {
  const m = mergeState({ settings: { sound: true, bgm: true, sfxVolume: 0, bgmVolume: 100 } }).settings;
  assert.deepEqual([m.sound, m.bgm, m.sfxVolume, m.bgmVolume], [true, true, 0, 100]);
  const bad = mergeState({ settings: { sound: 'yes', bgm: 1, sfxVolume: 250, bgmVolume: 'x' } }).settings;
  assert.deepEqual([bad.sound, bad.bgm, bad.sfxVolume, bad.bgmVolume], [false, false, 100, 40]);
  assert.equal(mergeState({ settings: { sfxVolume: -3 } }).settings.sfxVolume, 0);
  const s = normalizeSoundSettings({ sound: true });
  assert.equal(s.sfxVolume, 70);
});

test('音量の計算: 0 は無音、100 で最大、増えるほど大きい。BGM は素材が小さいので持ち上げる', () => {
  assert.equal(sfxGain(0), 0);
  assert.equal(sfxGain(100), 1);
  assert.equal(bgmGain(0), 0);
  assert.equal(bgmGain(100), BGM_GAIN_MAX);
  // 素材のピークは実測 0.28（jrpg-piano）。最大でも割れない（1 未満）こと
  assert.ok(0.28 * BGM_GAIN_MAX < 1);
  // 初期の 40 で、素材をほぼそのままの大きさ（0.9〜1.2倍）で出す。以前の 0.11 倍では実機で聞こえなかった
  assert.ok(bgmGain(DEFAULT_BGM_VOLUME) >= 0.9 && bgmGain(DEFAULT_BGM_VOLUME) <= 1.2);
  let prev = -1;
  for (let v = 0; v <= 100; v += 5) {
    assert.ok(sfxGain(v) > prev || v === 0);
    prev = sfxGain(v);
  }
  assert.equal(sfxGain('x'), sfxGain(DEFAULT_SFX_VOLUME));
  // 倍率どうしではなく、実際に出る大きさで比べる（素材の RMS の実測: BGM は最大 0.048、効果音は最小 0.14）。
  // 初期設定どうしでは、BGM のほうが効果音より小さく聞こえること
  assert.ok(0.048 * bgmGain(DEFAULT_BGM_VOLUME) < 0.14 * sfxGain(DEFAULT_SFX_VOLUME));
});

test('お祝いの種類ごとに効果音が決まっていて、ファイルが実在する', () => {
  for (const kind of ['level', 'badge', 'stars', 'goal']) {
    const key = celebrateSfx(kind);
    assert.ok(SFX_FILES[key], kind);
  }
  assert.notEqual(celebrateSfx('level'), celebrateSfx('badge'));
  assert.notEqual(celebrateSfx('stars'), celebrateSfx('goal'));
  for (const key of ['ok', 'ng']) assert.ok(SFX_FILES[key], key);
});

test('BGM の順番: 回数くり返したら次の曲へ、最後は最初に戻る', () => {
  const t = [{ file: 'a', repeat: 1 }, { file: 'b', repeat: 3 }];
  assert.deepEqual(nextBgmPosition(0, 1, t), { track: 1, plays: 0 });
  assert.deepEqual(nextBgmPosition(1, 1, t), { track: 1, plays: 1 });
  assert.deepEqual(nextBgmPosition(1, 2, t), { track: 1, plays: 2 });
  assert.deepEqual(nextBgmPosition(1, 3, t), { track: 0, plays: 0 });
  assert.deepEqual(nextBgmPosition(9, 1, t), { track: 1, plays: 0 });
  assert.ok(BGM_TRACKS.length >= 1 && BGM_TRACKS.length <= 2);
});

test('音のファイル: 実在する。BGM は1曲3MB以下。ogg／mp3 だけ。ライセンスの記録に全部載っている', () => {
  const doc = readFileSync(join(root, 'docs', 'sources', 'audio-licenses.md'), 'utf8');
  for (const f of Object.values(SFX_FILES)) {
    const p = join(shared, 'audio', 'sfx', f);
    assert.ok(existsSync(p), p);
    assert.match(f, /\.(ogg|mp3)$/);
    assert.ok(statSync(p).size < 100 * 1024, f + ' は効果音にしては大きい');
    assert.ok(doc.includes(f), f + ' が audio-licenses.md に無い');
  }
  for (const t of BGM_TRACKS) {
    const p = join(shared, 'audio', 'bgm', t.file);
    assert.ok(existsSync(p), p);
    assert.match(t.file, /\.(ogg|mp3)$/);
    assert.ok(statSync(p).size <= 3 * 1024 * 1024, t.file + ' が3MBを超えている');
    assert.ok(doc.includes(t.file), t.file + ' が audio-licenses.md に無い');
    assert.ok(t.repeat >= 1);
  }
});

test('オフライン用の一覧（sw-core.js）: 効果音は全部入っている。BGM は先に取らない。audio.js と sound.js も入っている', () => {
  const sw = readFileSync(join(shared, 'sw-core.js'), 'utf8');
  const block = sw.slice(sw.indexOf('const SFX = ['), sw.indexOf("].map((f) => '../shared/audio/sfx/'"));
  const listed = [...block.matchAll(/'([^']+\.(?:ogg|mp3))'/g)].map((m) => m[1]).sort();
  assert.deepEqual(listed, Object.values(SFX_FILES).sort());
  for (const t of BGM_TRACKS) assert.ok(!sw.includes(t.file), t.file + ' をインストール時に取っている');
  assert.ok(sw.includes("'../shared/js/audio.js'"));
  assert.ok(sw.includes("'../shared/js/lib/sound.js'"));
  assert.ok(sw.includes(String.raw`/\/shared\/audio\//`)); // 音のファイルはキャッシュ優先で返す
});

test('各アプリの sw.js の version は 6 以上（新しい音のファイルを配るため）', () => {
  for (const app of ['g-kentei', 'dx-biz']) {
    const sw = readFileSync(join(root, app, 'sw.js'), 'utf8');
    const v = Number(/version: '(\d+)'/.exec(sw)[1]);
    assert.ok(v >= 6, app + ' の version が ' + v);
  }
});
