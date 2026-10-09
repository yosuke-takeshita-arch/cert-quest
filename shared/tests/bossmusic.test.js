// ボス戦の曲・効果音の楽譜（lib/bossmusic.js）と、BGM の設定への従い方（lib/sound.js の bgmPlan の boss 場面）の検証。ブラウザ無しで node から叩く。
// 実際の音（耳で聞いた聞こえ方）は確かめられない。ここで確かめるのは、楽譜が読めること・長さが合うこと・設定に従うこと。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteFreq, parseBars, bossTheme, SYNTH_SFX, sfxLength, THEME_LEAD, THEME_BASS, BOSS_STEP_SEC, BOSS_THEME_BPM } from '../js/lib/bossmusic.js';
import { bgmPlan, BOSS_BGM, BGM_TRACKS, normalizeBgmTrack } from '../js/lib/sound.js';

test('音名 → 周波数: A4=440、1オクターブ上で2倍、半音は 2 の 12 乗根。読めない名前は null', () => {
  assert.equal(noteFreq('A4'), 440);
  assert.ok(Math.abs(noteFreq('A5') - 880) < 1e-9);
  assert.ok(Math.abs(noteFreq('C4') - 261.6256) < 0.001);
  assert.ok(Math.abs(noteFreq('A#4') - noteFreq('Bb4')) < 1e-9);
  assert.ok(Math.abs(noteFreq('A#4') / 440 - Math.pow(2, 1 / 12)) < 1e-9);
  for (const bad of ['H4', 'A', '4', '', 'A#', 'a4', null, undefined]) assert.equal(noteFreq(bad), null, String(bad));
});

test('小節の読み方: 音名＝鳴らす、- ＝前の音を伸ばす、. ＝休み。全体の長さは 8分音符の数×1つの長さ', () => {
  const { events, total } = parseBars(['A4 - C5 . E5 - - -'], 0.5);
  assert.equal(total, 4);
  assert.deepEqual(events.map((e) => [e.t, e.dur]), [[0, 1], [1, 0.5], [2, 2]]);
  assert.equal(events[0].freq, 440);
  // 休みのあとの - は、何も伸ばさない
  assert.deepEqual(parseBars(['A4 . - -'], 1).events.map((e) => e.dur), [1]);
  assert.deepEqual(parseBars([], 1), { events: [], total: 0 });
});

test('曲の楽譜: 旋律・低音とも8小節で、1小節は8拍。全部の音名が読める。旋律と低音の長さが同じ', () => {
  assert.equal(THEME_LEAD.length, 8);
  assert.equal(THEME_BASS.length, 8);
  for (const bar of [...THEME_LEAD, ...THEME_BASS]) assert.equal(bar.trim().split(/\s+/).length, 8, bar);
  const theme = bossTheme();
  assert.equal(theme.voices.length, 2);
  for (const v of theme.voices) {
    assert.ok(v.events.length > 8);
    for (const e of v.events) assert.ok(e.freq > 30 && e.freq < 4000 && e.dur > 0, JSON.stringify(e));
  }
  const end = (v) => Math.max(...v.events.map((e) => e.t + e.dur));
  assert.ok(end(theme.voices[0]) <= theme.loopSec + 1e-9);
  assert.ok(end(theme.voices[1]) <= theme.loopSec + 1e-9);
  assert.ok(Math.abs(theme.loopSec - 64 * BOSS_STEP_SEC) < 1e-9);
  assert.ok(Math.abs(BOSS_STEP_SEC - 60 / BOSS_THEME_BPM / 2) < 1e-12);
  assert.ok(theme.loopSec > 10 && theme.loopSec < 16, '1周は約13秒: ' + theme.loopSec);
  assert.deepEqual(theme.voices.map((v) => v.wave), ['square', 'triangle']); // 昔のゲーム機風（矩形波・三角波）
});

test('効果音: 勝利のファンファーレは2〜3秒、ほかは1秒以内。全部の音が正の周波数・長さ', () => {
  assert.deepEqual(Object.keys(SYNTH_SFX).sort(), ['appear', 'crit', 'fanfare', 'hit']);
  const fan = sfxLength('fanfare');
  assert.ok(fan >= 2 && fan <= 3, 'ファンファーレ ' + fan);
  for (const k of ['appear', 'crit', 'hit']) assert.ok(sfxLength(k) > 0 && sfxLength(k) <= 1, k + ' ' + sfxLength(k));
  for (const [k, ev] of Object.entries(SYNTH_SFX)) {
    for (const e of ev) {
      assert.ok(e.freq > 20 && e.freq < 4000 && e.dur > 0 && e.t >= 0 && e.gain > 0 && e.gain <= 1, k + JSON.stringify(e));
      if (e.to != null) assert.ok(e.to > 20 && e.to < 8000, k);
      assert.ok(['square', 'triangle'].includes(e.wave), k);
    }
  }
  assert.equal(sfxLength('nothing'), 0);
});

test('BGM の設定に従う: ボス戦の間は、BGM（問題中）がオンならボス戦の曲、オフなら何も鳴らさない。ほかの曲は鳴らさない', () => {
  const on = { bgm: true, bgmHome: true, bgmTrack: 'calm-loop', bgmHomeTrack: 'title' };
  assert.deepEqual(bgmPlan(on, { inBoss: true, inQuiz: true }), { scene: 'boss', track: 'boss' });
  assert.deepEqual(bgmPlan(on, { inBoss: true }), { scene: 'boss', track: 'boss' }); // 場面の判定より優先
  assert.equal(bgmPlan({ ...on, bgm: false }, { inBoss: true, inQuiz: true }), null); // BGM がオフ（それ以外がオンでも）なら鳴らさない
  assert.equal(bgmPlan({ ...on, bgm: false, bgmHome: false }, { inBoss: true }), null);
  assert.equal(bgmPlan(on, { inBoss: true, hidden: true }), null); // 裏に回ったら止める
  assert.equal(bgmPlan(null, { inBoss: true }), null);
  // ボス戦でなければ、これまでどおり
  assert.deepEqual(bgmPlan(on, { inQuiz: true }), { scene: 'quiz', track: 'calm-loop' });
  assert.equal(bgmPlan({ ...on, bgm: false }, { inQuiz: true }), null);
});

test('ボス戦の曲は設定の曲の一覧に入らない（選べる曲にも、おまかせの順番にも出ない）。id は設定に保存できない値', () => {
  assert.equal(BOSS_BGM.id, 'boss');
  assert.equal(BGM_TRACKS.some((t) => t.id === BOSS_BGM.id), false);
  assert.equal(normalizeBgmTrack('boss'), 'auto');
  assert.ok(BOSS_BGM.trim > 0 && BOSS_BGM.trim < 1);
});
