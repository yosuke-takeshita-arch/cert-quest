// 音（BGM・効果音）の設定と素材。ブラウザは使わない（実際に鳴るかは画面で確かめる）。
// 実行: cd shared && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_SFX_VOLUME, DEFAULT_BGM_VOLUME, BGM_GAIN_MAX, TARGET_BGM_RMS, BGM_AUTO, SFX_FILES, BGM_TRACKS,
  normalizeVolume, normalizeSoundSettings, normalizeBgmTrack, bgmTrackIndex, sfxGain, bgmGain, celebrateSfx, nextBgmPosition,
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

test('音の初期値: 効果音オフ・BGM オフ・音量は効果音70／BGM40・曲はおまかせ', () => {
  const s = defaultState().settings;
  assert.equal(s.sound, false);
  assert.equal(s.bgm, false);
  assert.equal(s.sfxVolume, 70);
  assert.equal(s.bgmVolume, 40);
  assert.equal(s.bgmTrack, 'auto');
  assert.equal(BGM_AUTO, 'auto');
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
  // どの曲も、目盛り100で（ピーク × 倍率）が 1 未満＝割れない。ピークは素材を実測した値
  for (const t of BGM_TRACKS) assert.ok(t.peak * bgmGain(100, t.trim) < 1, t.id + ' が目盛り100で割れる');
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

test('BGM の曲ごとの補正: 実測の大きさ×倍率が、どの曲も目盛り40でそろう。最大の目盛りでも割れない', () => {
  assert.ok(BGM_TRACKS.length >= 5 && BGM_TRACKS.length <= 6);
  for (const t of BGM_TRACKS) {
    assert.ok(t.trim > 0 && t.rms > 0 && t.peak > 0 && t.peak <= 1.2, t.id);
    const out40 = t.rms * bgmGain(40, t.trim); // 目盛り40での出力の大きさ（RMS）
    assert.ok(Math.abs(out40 - TARGET_BGM_RMS) / TARGET_BGM_RMS < 0.03, t.id + ' の出力 ' + out40);
    assert.ok(t.peak * bgmGain(100, t.trim) < 1, t.id);
    assert.equal(bgmGain(0, t.trim), 0);
  }
  const outs = BGM_TRACKS.map((t) => t.rms * bgmGain(40, t.trim));
  assert.ok(Math.max(...outs) / Math.min(...outs) < 1.07); // 曲どうしの差は 0.6dB 未満
  assert.equal(bgmGain(40), bgmGain(40, 1)); // 補正を渡さなければ 1 倍
  // 補正は音量の目盛りに比例（0 は無音）
  for (const t of BGM_TRACKS) assert.ok(Math.abs(bgmGain(80, t.trim) - 2 * bgmGain(40, t.trim)) < 1e-9);
});

test('曲の id: 重複しない。名前と雰囲気がある。ファイル名と対応する', () => {
  const ids = BGM_TRACKS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(BGM_TRACKS.map((t) => t.file)).size, ids.length);
  for (const t of BGM_TRACKS) {
    assert.match(t.id, /^[a-z0-9-]+$/);
    assert.notEqual(t.id, BGM_AUTO);
    assert.ok(t.name.length >= 2 && t.mood.length >= 2, t.id);
  }
});

test('BGM の曲の選択の正規化: 知っている id は残り、古い記録・消えた曲・ありえない値はおまかせに戻る', () => {
  for (const t of BGM_TRACKS) assert.equal(normalizeBgmTrack(t.id), t.id);
  assert.equal(normalizeBgmTrack('auto'), 'auto');
  for (const bad of [undefined, null, '', 'deleted-track', 'Contemplation', 'contemplation ', 0, 1, 2, -1, NaN, true, {}, [], ['contemplation']]) assert.equal(normalizeBgmTrack(bad), 'auto', String(bad));
  // 曲の表を渡したときは、その表にある id だけ
  assert.equal(normalizeBgmTrack('a', [{ id: 'a' }]), 'a');
  assert.equal(normalizeBgmTrack('jrpg-piano', [{ id: 'a' }]), 'auto');
  assert.equal(bgmTrackIndex('auto'), -1);
  assert.equal(bgmTrackIndex('nope'), -1);
  assert.equal(bgmTrackIndex(BGM_TRACKS[2].id), 2);
});

test('保存データ: BGM の曲の選択。古い記録（項目なし）はおまかせ。正しい id は残り、不正な値は直る', () => {
  assert.equal(mergeState({ settings: { bgm: true } }).settings.bgmTrack, 'auto');
  assert.equal(mergeState(null).settings.bgmTrack, 'auto');
  assert.equal(mergeState({ settings: { bgmTrack: 'bluebonnet' } }).settings.bgmTrack, 'bluebonnet');
  assert.equal(mergeState({ settings: { bgmTrack: 'gone' } }).settings.bgmTrack, 'auto');
  assert.equal(mergeState({ settings: { bgmTrack: 3 } }).settings.bgmTrack, 'auto');
  assert.equal(normalizeSoundSettings({ bgmTrack: 'calm-loop' }).bgmTrack, 'calm-loop');
  assert.equal(normalizeSoundSettings({}).bgmTrack, 'auto');
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
  assert.ok(BGM_TRACKS.length >= 5 && BGM_TRACKS.length <= 6);
});

test('BGM の順番: おまかせは本物の曲の表でも全曲を順に回って、最初に戻る', () => {
  const n = BGM_TRACKS.length;
  let pos = { track: 0, plays: 0 };
  const seen = [];
  for (let i = 0; i < 1000 && seen.length < n + 1; i++) {
    const nxt = nextBgmPosition(pos.track, pos.plays + 1, BGM_TRACKS, 'auto');
    if (nxt.track !== pos.track) seen.push(nxt.track);
    pos = nxt;
  }
  assert.deepEqual(seen, [...Array(n).keys()].map((i) => (i + 1) % n).concat([1]).slice(0, n + 1));
  // 1周は約100秒前後（1曲が長すぎる・短すぎる並びにならない）
  for (const t of BGM_TRACKS) assert.ok(t.repeat >= 1 && t.repeat <= 8);
  // 知らない選択は、おまかせと同じ
  assert.deepEqual(nextBgmPosition(0, 1, BGM_TRACKS, 'gone'), nextBgmPosition(0, 1, BGM_TRACKS, 'auto'));
  assert.deepEqual(nextBgmPosition(0, 1, BGM_TRACKS), nextBgmPosition(0, 1, BGM_TRACKS, 'auto'));
});

test('BGM の順番: 1曲を選んだら、その曲を何回流し終えてもその曲に戻る（他の曲へ進まない）', () => {
  BGM_TRACKS.forEach((tr, i) => {
    for (let plays = 0; plays <= 20; plays++) {
      assert.deepEqual(nextBgmPosition(i, plays, BGM_TRACKS, tr.id), { track: i, plays: 0 }, tr.id + ' ' + plays);
    }
    // 別の曲を流している途中で選ばれたときも、選んだ曲に向かう
    assert.deepEqual(nextBgmPosition((i + 1) % BGM_TRACKS.length, 99, BGM_TRACKS, tr.id), { track: i, plays: 0 });
  });
});

test('音のファイル: 実在する。BGM は1曲3MB以下。ogg／mp3 だけ。ライセンスの記録に全部載っている', () => {
  const doc = readFileSync(join(root, 'docs', 'sources', 'audio-licenses.md'), 'utf8');
  for (const f of Object.values(SFX_FILES)) {
    const p = join(shared, 'audio', 'sfx', f);
    assert.ok(existsSync(p), p);
    assert.match(f, /\.(ogg|mp3)$/);
    // 効果音はインストール時に全部取るので、小さく保つ。バッジの音（約5秒・約170KB）を先生が選んだので上限を 200KB にした（2026-10-04）
    assert.ok(statSync(p).size < 200 * 1024, f + ' は効果音にしては大きい');
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

test('各アプリの sw.js の version は 9 以上（新しい音のファイルを配るため）', () => {
  for (const app of ['g-kentei', 'dx-biz']) {
    const sw = readFileSync(join(root, app, 'sw.js'), 'utf8');
    const v = Number(/version: '(\d+)'/.exec(sw)[1]);
    assert.ok(v >= 9, app + ' の version が ' + v);
  }
});

test('開始のジングル: 「タップしてはじめる」用の音が、ほかの効果音と別のファイルで決まっている', () => {
  assert.ok(SFX_FILES.start);
  const others = Object.entries(SFX_FILES).filter(([k]) => k !== 'start').map(([, v]) => v);
  assert.ok(!others.includes(SFX_FILES.start), '開始のジングルが、ほかの効果音と同じファイル');
  assert.match(SFX_FILES.start, /\.ogg$/); // 素材とライセンスの一致は、audio-licenses.md と照らす別のテストが見る
});

test('効果音の一覧: sw-core.js のインストール時に取る一覧に、SFX_FILES の全ファイルが入っている', () => {
  const sw = readFileSync(join(shared, 'sw-core.js'), 'utf8');
  for (const f of Object.values(SFX_FILES)) assert.ok(sw.includes("'" + f + "'"), f + ' が sw-core.js の SFX に無い');
  assert.ok(sw.includes("'../shared/js/views/sound-settings.js'"), 'sound-settings.js が sw-core.js の SHARED に無い');
});

test('音のカード: 設定画面とタイトル画面のポップアップが、同じ部品（sound-settings.js）を使う。同じ作りを2つ書かない', () => {
  const read = (p) => readFileSync(join(shared, 'js', p), 'utf8');
  assert.ok(existsSync(join(shared, 'js', 'views', 'sound-settings.js')));
  assert.match(read('views/sound-settings.js'), /export function buildSoundCard\(/);
  assert.match(read('views/more.js'), /buildSoundCard\(/);
  assert.match(read('views/title.js'), /buildSoundCard\(/);
  // 作りの本体（曲の選択など）は部品の中だけにある
  assert.ok(read('views/sound-settings.js').includes("'set-bgmTrack'"));
  assert.ok(!read('views/more.js').includes("'set-bgmTrack'"));
  assert.ok(!read('views/title.js').includes("'set-bgmTrack'"));
  // タイトル画面は歯車でも音を使える状態にし、ホームに進むときは開始のジングルを鳴らす
  assert.match(read('views/title.js'), /unlockAudio\(/);
  assert.match(read('app.js'), /playSfx\([^)]*'start'\)/);
});
