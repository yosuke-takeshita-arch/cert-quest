// 音（BGM・効果音）の設定と素材。ブラウザは使わない（実際に鳴るかは画面で確かめる）。
// 実行: cd shared && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_SFX_VOLUME, DEFAULT_BGM_VOLUME, BGM_GAIN_MAX, TARGET_BGM_RMS, BGM_AUTO, SFX_FILES, BGM_TRACKS, TITLE_BGM, BOSS_BGM,
  normalizeVolume, normalizeSoundSettings, normalizeBgmTrack, normalizeHomeTrack, bgmPlan, bgmTrackIndex, sfxGain, bgmGain, celebrateSfx, nextBgmPosition,
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
  assert.equal(s.bgmHome, false); // それ以外の場面の BGM も初期オフ
  assert.equal(s.bgmHomeTrack, 'title'); // 曲の初期はタイトル曲
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
    // 効果音は ogg・mp3 に加えて wav も使う（2026-10-05 先生が選んだ星・目標の音が wav だった。変換の道具が無いのでモノラルにして小さくした）
    assert.match(f, /\.(ogg|mp3|wav)$/);
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
  const listed = [...block.matchAll(/'([^']+\.(?:ogg|mp3|wav))'/g)].map((m) => m[1]).sort();
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
  assert.ok(read('views/sound-settings.js').includes("'bgmTrack'") && read('views/sound-settings.js').includes("'bgmHomeTrack'"));
  assert.ok(!read('views/more.js').includes("'set-bgmTrack'"));
  assert.ok(!read('views/title.js').includes("'set-bgmTrack'"));
  // タイトル画面は歯車でも音を使える状態にし、ホームに進むときは開始のジングルを鳴らす
  assert.match(read('views/title.js'), /unlockAudio\(/);
  assert.match(read('app.js'), /playSfx\([^)]*'start'\)/);
});

// 関数の本体（波括弧の対応で切り出す。文字数の窓は使わない）。無ければ例外
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

test('タイトル曲: BGM_TRACKS（設定の一覧・おまかせ）には入らない。ファイルが実在し、3MB以下で、ライセンスの記録にある', () => {
  assert.ok(!BGM_TRACKS.some((t) => t.id === TITLE_BGM.id || t.file === TITLE_BGM.file));
  assert.equal(normalizeBgmTrack(TITLE_BGM.id), 'auto'); // 設定の選択肢にならない
  const p = join(shared, 'audio', 'bgm', TITLE_BGM.file);
  assert.ok(existsSync(p));
  assert.match(TITLE_BGM.file, /\.(ogg|mp3)$/);
  assert.ok(statSync(p).size <= 3 * 1024 * 1024);
  const doc = readFileSync(join(root, 'docs', 'sources', 'audio-licenses.md'), 'utf8');
  assert.ok(doc.includes(TITLE_BGM.file) && doc.includes('TAD'));
  // おまかせの順番を何周しても、タイトル曲の番号は出てこない（表に無いので当然だが、順番の関数が表以外を返さないことも確かめる）
  let pos = { track: 0, plays: 0 };
  for (let i = 0; i < 200; i++) { pos = nextBgmPosition(pos.track, pos.plays + 1, BGM_TRACKS, 'auto'); assert.ok(BGM_TRACKS[pos.track]); }
  // sw-core.js はインストール時に取らない（BGM と同じ。オンの人だけ初めて流すときに取る）
  assert.ok(!readFileSync(join(shared, 'sw-core.js'), 'utf8').includes(TITLE_BGM.file));
});

test('タイトル曲の補正: 実測の大きさ×倍率が、ほかの BGM と同じ目盛り40の大きさ。目盛り100でも割れない', () => {
  const t = TITLE_BGM;
  assert.ok(t.trim > 0 && t.rms > 0 && t.peak > 0 && t.peak <= 1.2 && t.fadeSec > 0 && t.fadeSec <= 1);
  assert.ok(Math.abs(t.rms * bgmGain(40, t.trim) - TARGET_BGM_RMS) / TARGET_BGM_RMS < 0.03);
  assert.ok(t.peak * bgmGain(100, t.trim) < 1);
  assert.equal(bgmGain(0, t.trim), 0);
});

test('BGM の移行: 『それ以外』の項目が無い古い記録は、これまでの BGM を引き継ぐ（オンだった人は両方オン）', () => {
  const on = mergeState({ settings: { bgm: true, bgmTrack: 'bluebonnet', bgmVolume: 55 } }).settings;
  assert.deepEqual([on.bgm, on.bgmTrack, on.bgmHome, on.bgmHomeTrack, on.bgmVolume], [true, 'bluebonnet', true, 'title', 55]);
  const off = mergeState({ settings: { bgm: false, bgmTrack: 'calm-loop' } }).settings;
  assert.deepEqual([off.bgm, off.bgmTrack, off.bgmHome, off.bgmHomeTrack], [false, 'calm-loop', false, 'title']);
  // 何も無い・設定が無い・壊れた設定は、初期値（両方オフ）
  for (const st of [null, {}, { settings: null }, { settings: 'x' }, { settings: [] }]) {
    const d = mergeState(st).settings;
    assert.deepEqual([d.bgm, d.bgmHome, d.bgmTrack, d.bgmHomeTrack], [false, false, 'auto', 'title'], JSON.stringify(st));
  }
  // bgm が真偽値でない壊れた値（1・'true'）はオンと見なさない（normalizeSoundSettings と同じ）
  assert.equal(mergeState({ settings: { bgm: 1 } }).settings.bgmHome, false);
  assert.equal(mergeState({ settings: { bgm: 'true' } }).settings.bgmHome, false);
});

test('BGM の移行: 『それ以外』の項目がある記録（新しい記録・書き出しファイル）は、その値のまま。bgm に引きずられない', () => {
  const a = mergeState({ settings: { bgm: true, bgmHome: false, bgmHomeTrack: 'jrpg-piano' } }).settings;
  assert.deepEqual([a.bgm, a.bgmHome, a.bgmHomeTrack], [true, false, 'jrpg-piano']);
  const b = mergeState({ settings: { bgm: false, bgmHome: true, bgmHomeTrack: 'auto' } }).settings;
  assert.deepEqual([b.bgm, b.bgmHome, b.bgmHomeTrack], [false, true, 'auto']);
  // 2回通しても変わらない（読み込み直し・バックアップの往復）
  const again = mergeState(JSON.parse(JSON.stringify(mergeState({ settings: { bgm: true } })))).settings;
  assert.deepEqual([again.bgm, again.bgmHome], [true, true]);
  const off2 = mergeState(JSON.parse(JSON.stringify({ settings: b }))).settings;
  assert.deepEqual([off2.bgm, off2.bgmHome, off2.bgmHomeTrack], [false, true, 'auto']);
  // bgmHome が真偽値でない壊れた値は、bgm から作り直す
  assert.equal(mergeState({ settings: { bgm: true, bgmHome: 'yes' } }).settings.bgmHome, true);
});

test('それ以外の曲の選択: タイトル曲・おまかせ・BGM_TRACKS の id だけ。知らない値はタイトル曲', () => {
  assert.equal(normalizeHomeTrack('title'), 'title');
  assert.equal(normalizeHomeTrack(TITLE_BGM.id), 'title');
  assert.equal(normalizeHomeTrack('auto'), 'auto');
  for (const t of BGM_TRACKS) assert.equal(normalizeHomeTrack(t.id), t.id);
  for (const bad of [undefined, null, '', 'gone', 'Title', 'title ', 0, 1, NaN, true, {}, [], ['title']]) assert.equal(normalizeHomeTrack(bad), 'title', String(bad));
  assert.equal(mergeState({ settings: { bgmHomeTrack: 'gone' } }).settings.bgmHomeTrack, 'title');
  assert.equal(mergeState({ settings: { bgmHomeTrack: 'bluebonnet' } }).settings.bgmHomeTrack, 'bluebonnet');
  // 問題中の選択肢にタイトル曲は入らない（おまかせにも混ざらない）
  assert.equal(normalizeBgmTrack('title'), 'auto');
});

test('場面ごとに流すか: 問題中は bgm・bgmTrack、それ以外は bgmHome・bgmHomeTrack。切っている場面は無音。裏に回ったら全部止める', () => {
  const S = (o) => normalizeSoundSettings({ ...o });
  const both = S({ bgm: true, bgmHome: true, bgmTrack: 'calm-loop', bgmHomeTrack: 'title' });
  assert.deepEqual(bgmPlan(both, { inQuiz: true }), { scene: 'quiz', track: 'calm-loop' });
  assert.deepEqual(bgmPlan(both, { inQuiz: false }), { scene: 'other', track: 'title' });
  assert.deepEqual(bgmPlan(both), { scene: 'other', track: 'title' }); // 何も言わなければ、それ以外
  // 片方だけオン: オフの場面は無音
  const quizOnly = S({ bgm: true, bgmHome: false });
  assert.deepEqual(bgmPlan(quizOnly, { inQuiz: true }), { scene: 'quiz', track: 'auto' });
  assert.equal(bgmPlan(quizOnly, { inQuiz: false }), null);
  const homeOnly = S({ bgm: false, bgmHome: true, bgmHomeTrack: 'auto' });
  assert.equal(bgmPlan(homeOnly, { inQuiz: true }), null);
  assert.deepEqual(bgmPlan(homeOnly, { inQuiz: false }), { scene: 'other', track: 'auto' });
  // 両方オフ（初期）は、どこでも無音
  const none = defaultState().settings;
  for (const inQuiz of [true, false]) for (const preview of [true, false]) assert.equal(bgmPlan(none, { inQuiz, preview }), null);
  // 試し聴き（問題中の曲）: どの場面でも、問題中がオンのときだけ。問題中がオフなら、それ以外の曲に化けず無音
  assert.deepEqual(bgmPlan(both, { preview: true }), { scene: 'quiz', track: 'calm-loop' });
  assert.deepEqual(bgmPlan(quizOnly, { preview: true }), { scene: 'quiz', track: 'auto' });
  assert.equal(bgmPlan(homeOnly, { preview: true }), null);
  // 裏に回ったら、両方とも止める
  for (const inQuiz of [true, false]) assert.equal(bgmPlan(both, { inQuiz, hidden: true }), null);
  assert.equal(bgmPlan(null, { inQuiz: true }), null);
  assert.equal(bgmPlan(undefined), null);
  // 壊れた選択（保存データを通さない生の値）は、場面ごとの初期の曲に直す
  assert.equal(bgmPlan({ bgm: true, bgmTrack: 'gone' }, { inQuiz: true }).track, 'auto');
  assert.equal(bgmPlan({ bgmHome: true, bgmHomeTrack: 'gone' }).track, 'title');
});

test('場面の切り替え: タイトル→ホーム→問題→ホームで、流す曲が場面の設定どおりに替わる', () => {
  const s = normalizeSoundSettings({ bgm: true, bgmHome: true, bgmTrack: 'jrpg-piano', bgmHomeTrack: 'title' });
  const at = (inQuiz) => bgmPlan(s, { inQuiz });
  const seq = [false, false, true, false].map((q) => at(q).track); // タイトル・ホーム・問題・ホーム
  assert.deepEqual(seq, ['title', 'title', 'jrpg-piano', 'title']);
  // それ以外の曲を BGM_TRACKS の1曲にすると、タイトル画面からその曲（タイトル曲は鳴らない）
  s.bgmHomeTrack = 'bluebonnet';
  assert.deepEqual([false, true, false].map((q) => at(q).track), ['bluebonnet', 'jrpg-piano', 'bluebonnet']);
  // 両方おまかせなら、場面が変わっても同じ選択（鳴っている曲を切らずに続けられる）
  s.bgmTrack = 'auto';
  s.bgmHomeTrack = 'auto';
  assert.equal(at(true).track, at(false).track);
});

test('タイトル画面はタイトル曲で固定。出たあとは『それ以外』で選んだ曲。オフなら無音', () => {
  const S = (o) => normalizeSoundSettings({ ...o });
  for (const pick of ['bluebonnet', 'auto', 'title', 'chill-lofi']) {
    const s = S({ bgmHome: true, bgmHomeTrack: pick });
    assert.deepEqual(bgmPlan(s, { inTitle: true }), { scene: 'title', track: 'title' }, 'タイトル画面は選択にかかわらずタイトル曲: ' + pick);
    assert.equal(bgmPlan(s, { inTitle: false }).track, pick, 'タイトル画面を出たあとは選んだ曲: ' + pick);
  }
  // オフならタイトル画面も無音（問題中がオンでも、タイトル画面には効かない）
  assert.equal(bgmPlan(S({ bgm: true, bgmHome: false }), { inTitle: true }), null);
  assert.equal(bgmPlan(S({ bgmHome: false }), { inTitle: false }), null);
  // 問題を解いている間・問題中の試し聴きが最優先（タイトル画面の歯車での試し聴きは、その曲）
  const both = S({ bgm: true, bgmHome: true, bgmTrack: 'jrpg-piano', bgmHomeTrack: 'bluebonnet' });
  assert.deepEqual(bgmPlan(both, { inTitle: true, preview: true }), { scene: 'quiz', track: 'jrpg-piano' });
  assert.equal(bgmPlan(both, { inTitle: true, hidden: true }), null);
  // 流れ: タイトル(さわった後)→ホーム→問題→ホーム
  const at = (o) => bgmPlan(both, o).track;
  assert.deepEqual([at({ inTitle: true }), at({}), at({ inQuiz: true }), at({})], ['title', 'bluebonnet', 'jrpg-piano', 'bluebonnet']);
  // タイトル曲を選んでいれば、タイトル画面からホームへ進んでも同じ曲（切らずに続けられる）
  both.bgmHomeTrack = 'title';
  assert.equal(at({ inTitle: true }), at({}));
  // 既存の保存値（bgmHomeTrack）はそのまま読める
  assert.equal(normalizeSoundSettings({ bgmHome: true, bgmHomeTrack: 'bluebonnet' }).bgmHomeTrack, 'bluebonnet');
});

test('タイトル画面の判定の結線: audio.js の plan が inTitle を渡し、app.js が『はじめる』のあとに出たと伝える', () => {
  const au = readFileSync(join(shared, 'js', 'audio.js'), 'utf8');
  const app = readFileSync(join(shared, 'js', 'app.js'), 'utf8');
  assert.match(functionBody(au, 'plan'), /inTitle: B\.title/);
  assert.match(functionBody(au, 'setBgmTitle'), /B\.title = !!on/);
  assert.match(functionBody(au, 'setBgmTitle'), /syncBgm\(\)/);
  assert.match(app, /await title\.ready\([\s\S]*?\}\);\s*setBgmTitle\(false\)/);
});

test('BGM の鳴らし方: audio.js が場面の plan に従い、場面が変わるときは小さくして切り替え、app.js が結線している', () => {
  const au = readFileSync(join(shared, 'js', 'audio.js'), 'utf8');
  const app = readFileSync(join(shared, 'js', 'app.js'), 'utf8');
  // タイトル曲を流すのは、plan の曲がタイトル曲のとき。BGM_TRACKS の曲は、それ以外のとき。両方とも plan を通す（設定を直に見ない）
  assert.match(functionBody(au, 'plan'), /bgmPlan\(/);
  assert.match(functionBody(au, 'plan'), /inQuiz: B\.scene/);
  assert.match(functionBody(au, 'plan'), /preview: B\.preview/);
  assert.match(functionBody(au, 'plan'), /document\.hidden/);
  assert.match(functionBody(au, 'wantTitle'), /TITLE_BGM\.id/);
  assert.match(functionBody(au, 'wantBgm'), /!== TITLE_BGM\.id/);
  assert.ok(!/s\.bgm\b/.test(functionBody(au, 'wantTitle')) && !/s\.bgm\b/.test(functionBody(au, 'wantBgm')));
  // 切れ目なくくり返す（loop）／音量は BGM の音量と曲の補正
  assert.match(functionBody(au, 'startTitle'), /\.loop = true/);
  assert.match(functionBody(au, 'applyTitleVolume'), /bgmGain\([^)]*TITLE_BGM\.trim/);
  assert.match(functionBody(au, 'applyVolumes'), /applyTitleVolume\(\)/);
  // 場面が変わって流す曲が変わるときは、鳴っているほうを小さくして止める（タイトル曲も BGM_TRACKS の曲も）
  assert.match(functionBody(au, 'fadeOutTitle'), /linearRampToValueAtTime\(0,/);
  assert.match(functionBody(au, 'fadeOutBgm'), /linearRampToValueAtTime\(0,/);
  const sync = functionBody(au, 'syncBgm');
  assert.match(sync, /fadeOutTitle\(\)/);
  assert.match(sync, /fadeOutBgm\(\)/);
  assert.match(sync, /!wantT && T\.src/); // タイトル曲を流さない場面になったら止める
  assert.match(sync, /!wantB \|\|/); // BGM_TRACKS の曲を流さない場面になったら止める
  assert.match(sync, /selectedIndex\(\) !== B\.track/); // 同じ B でも、選んだ曲が違えば替える
  // 小さくしている間は、次を始めない（かさならない）。止まったら syncBgm でもう一度
  assert.match(functionBody(au, 'startBgm'), /B\.fading \|\| T\.fading/);
  assert.match(functionBody(au, 'startTitle'), /T\.fading \|\| B\.fading/);
  assert.match(functionBody(au, 'fadeOutTitle'), /syncBgm\(\)/);
  assert.match(functionBody(au, 'fadeOutBgm'), /syncBgm\(\)/);
  // タイトル曲の展開した音は、使う設定でなければ手放す
  assert.match(sync, /T\.buf = null/);
  // 『タップしてはじめる』では止めない（それ以外がオンなら、ホームでも続く）。タイトル専用の入り口は無い
  assert.ok(!/export function (setTitleBgm|endTitleBgm)/.test(au));
  assert.ok(!/setTitleBgm|endTitleBgm/.test(app));
  assert.match(app, /title\.ready\(\(\) => \{[^}]*playSfx\([^)]*'start'\)[^}]*\}\)/);
  // 起動時に、それ以外の曲を流す準備をする（さわる前は予約。さわったところから鳴る）
  assert.match(functionBody(au, 'initAudio'), /syncBgm\(\)/);
  // 問題を解く画面の出入りで場面を知らせる（画面を変えるたびに）
  assert.match(app, /setBgmScene\(full\)/);
});


test('キャラのタップ音: tap は drop_001.ogg。タップのたびに鳴らし、節目でお祝いの stars は鳴らさない', () => {
  assert.equal(SFX_FILES.tap, 'drop_001.ogg');
  const ui = readFileSync(join(shared, 'js', 'ui.js'), 'utf8').replace(/\r\n/g, '\n');
  const i = ui.indexOf('const r = recordTap(');
  const body = ui.slice(i, ui.indexOf('return wrap;', i));
  assert.match(body, /tapHost\.sfx\('tap'\)/);
  assert.ok(!/sfx\('stars'\)/.test(body));
  // 毎回鳴らす: 節目の判定（if (!r.line) return）より前に鳴らす
  assert.ok(body.indexOf("sfx('tap')") < body.indexOf('if (!r.line) return'));
  // 本体は playSfx（効果音の設定に従う）につながっている
  assert.match(readFileSync(join(shared, 'js', 'app.js'), 'utf8'), /sfx: \(name\) => playSfx\(app\.state\.settings, name\)/);
  assert.ok(!Object.values(SFX_FILES).some((f, _, a) => a.filter((x) => x === f).length > 1));
});

test('このアプリについて: タイトル曲の作者 TAD を載せる', () => {
  const about = readFileSync(join(shared, 'js', 'views', 'about.js'), 'utf8');
  assert.match(about, /TAD/);
});

test('タイトル曲: 画面のどこをさわっても音を使える状態にし、鳴らせないあいだは一言を出す', () => {
  const au = readFileSync(join(shared, 'js', 'audio.js'), 'utf8');
  const ti = readFileSync(join(shared, 'js', 'views', 'title.js'), 'utf8');
  const body = functionBody(au, 'initAudio');
  // document 全体で受ける（ボタンに限らない）。iOS 用に click も
  assert.match(body, /document\.addEventListener\(t, onGesture/);
  for (const ev of ['pointerdown', 'touchend', 'click']) assert.ok(body.includes("'" + ev + "'"), ev);
  // 効果音か BGM がオンのときだけ unlockAudio（両方オフなら何もしない）
  assert.match(body, /s\.sound \|\| s\.bgm[^)]*\)[^;]*unlockAudio\(s\)/);
  // 一言: 鳴らせない状態の判定は audio.js、表示は title.js。鳴り始めたら消す（毎回 toggle で出し入れ）
  assert.match(functionBody(au, 'titleAudioLocked'), /plan\(\)/);
  assert.match(functionBody(au, 'titleAudioLocked'), /state !== 'running'/);
  assert.match(ti, /画面をさわると音楽が流れます/);
  assert.match(ti, /toggle\('hidden', !titleAudioLocked\(\)\)/);
});

test('ボス戦の曲（ファイル）: BGM_TRACKS に入らず、ファイルが実在して3MB以下で、ライセンスの記録にある。sw-core.js はインストール時に取らない', () => {
  assert.ok(!BGM_TRACKS.some((t) => t.id === BOSS_BGM.id || t.file === BOSS_BGM.file));
  assert.equal(normalizeBgmTrack(BOSS_BGM.id), 'auto');
  const p = join(shared, 'audio', 'bgm', BOSS_BGM.file);
  assert.ok(existsSync(p));
  assert.match(BOSS_BGM.file, /\.(ogg|mp3)$/);
  assert.ok(statSync(p).size <= 3 * 1024 * 1024);
  const doc = readFileSync(join(root, 'docs', 'sources', 'audio-licenses.md'), 'utf8');
  assert.ok(doc.includes(BOSS_BGM.file) && doc.includes('HydroGene') && doc.includes('8-bit-danger-strong-boss'));
  assert.ok(!readFileSync(join(shared, 'sw-core.js'), 'utf8').includes(BOSS_BGM.file)); // 使ったときに取ってキャッシュに入れる（タイトル曲と同じ）
  // 場面の判定は今までどおり: ボス戦はいつもボス戦の曲、BGM がオフなら流さない
  assert.deepEqual(bgmPlan({ bgm: true, bgmHome: false }, { inBoss: true, inQuiz: true }), { scene: 'boss', track: 'boss' });
  assert.equal(bgmPlan({ bgm: false, bgmHome: true }, { inBoss: true }), null);
});

test('ボス戦の曲の補正: 実測の大きさ×倍率が、ほかの BGM と同じ目盛り40の大きさ。目盛り100でも割れない。プログラムの曲の補正は別', () => {
  const t = BOSS_BGM;
  assert.ok(t.trim > 0 && t.rms > 0 && t.peak > 0 && t.peak <= 1.2 && t.synthTrim > 0 && t.synthTrim < 1);
  assert.ok(Math.abs(t.rms * bgmGain(40, t.trim) - TARGET_BGM_RMS) / TARGET_BGM_RMS < 0.03);
  assert.ok(t.peak * bgmGain(100, t.trim) < 1);
  assert.equal(bgmGain(0, t.trim), 0);
});

test('ボス戦の曲の鳴らし方: ファイルをくり返し、取れなければプログラムの曲に戻る。止めるときは小さくしてから止める', () => {
  const au = readFileSync(join(shared, 'js', 'audio.js'), 'utf8');
  const file = functionBody(au, 'startBossFile');
  assert.match(file, /BGM_BASE|bossFileUrl\(\)/);
  assert.match(functionBody(au, 'bossFileUrl'), /BGM_BASE \+ BOSS_BGM\.file/);
  assert.match(file, /M\.el\.loop = true/);
  assert.match(file, /M\.elSource\.connect\(M\.gain\)/); // 音量は M.gain（BGM の音量と曲の補正）を通る
  assert.match(file, /M\.mode = 'file'/);
  assert.match(file, /catch \(e\)[\s\S]*return false/); // 取れない・鳴らせない → false
  const start = functionBody(au, 'startBossMusic');
  assert.match(start, /startBossFile\(token\)/);
  assert.match(start, /!ok[\s\S]*startBossSynth\(\)/); // 失敗したらプログラムの曲
  assert.match(start, /!s \|\| !s\.bgm/); // 問題中の BGM がオフなら流さない
  assert.match(functionBody(au, 'startBossSynth'), /M\.mode = 'synth'/);
  assert.match(functionBody(au, 'bossGainValue'), /synthTrim/);
  assert.match(functionBody(au, 'bossGainValue'), /bgmGain\(s \? s\.bgmVolume/);
  // 止める: 小さくしてから el を止める。止めたあとにファイルの曲が残らない
  const stop = functionBody(au, 'stopBossMusic');
  assert.match(stop, /linearRampToValueAtTime\(0,/);
  assert.match(stop, /M\.el\.pause\(\)/);
  assert.match(stop, /M\.token\+\+/);
  // 効果音（ファンファーレなど）は今までどおりプログラム
  assert.match(functionBody(au, 'playSynth'), /SYNTH_SFX\[name\]/);
  assert.match(functionBody(au, 'bgmStatus'), /mode: M\.mode/);
});
