// 音を鳴らす側（ブラウザ専用）。設定の正規化や音量の計算は lib/sound.js。
// - 効果音: 小さいので WebAudio で鳴らす。ファイルが取れない・読めないときは、昔の「ピッ」に切り替える
// - BGM: 大きいので、最初に流すときに取ってきてキャッシュに入る（sw-core.js が /audio/ をキャッシュ優先で返す）
//   音量は iOS でも効くよう WebAudio の GainNode でかける
// - スマホは画面を一度さわるまで音を出せない。BGM は、さわったあとから流す
import { SFX_FILES, BOSS_SFX, BGM_TRACKS, BGM_AUTO, TITLE_BGM, BOSS_BGM, sfxGain, bgmGain, nextBgmPosition, bgmTrackIndex, bgmPlan } from './lib/sound.js';
import { bossTheme, SYNTH_SFX } from './lib/bossmusic.js';

const SFX_BASE = new URL('../audio/sfx/', import.meta.url).href;
const BGM_BASE = new URL('../audio/bgm/', import.meta.url).href;

let getSettings = () => null;
let ctx = null;
const sfxBytes = new Map(); // キー → Promise<ArrayBuffer|null>
const sfxBuffers = new Map(); // キー → AudioBuffer（ファイルが読めなかったら null）

function audioCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch (e) { ctx = null; }
  return ctx;
}

function resumeCtx() {
  const c = audioCtx();
  if (c && c.state === 'suspended') return c.resume().catch(() => {});
  return Promise.resolve();
}

// ---- 効果音 ----
function fetchSfxBytes(name) {
  if (!sfxBytes.has(name)) {
    sfxBytes.set(name, fetch(SFX_BASE + SFX_FILES[name])
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null));
  }
  return sfxBytes.get(name);
}

/** 効果音のファイルを先に取っておく（鳴らすときの遅れを無くす）。 */
export function preloadSfx() {
  Object.keys(SFX_FILES).forEach((k) => { fetchSfxBytes(k); });
}

async function sfxBuffer(name, c) {
  if (sfxBuffers.has(name)) return sfxBuffers.get(name);
  let buf = null;
  try {
    const bytes = await fetchSfxBytes(name);
    if (bytes) buf = await c.decodeAudioData(bytes.slice(0));
  } catch (e) { buf = null; }
  sfxBuffers.set(name, buf);
  return buf;
}

// ファイルが使えないときの代わりの音（昔の beep と同じ）
function synthBeep(c, name, gain) {
  const notes = name === 'ok' ? [660, 880] : name === 'ng' ? [220] : name === 'tap' ? [440] : [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    const t = c.currentTime + i * 0.09;
    o.frequency.value = f;
    o.type = 'sine';
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.15 * gain), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + 0.18);
  });
}

/** 効果音を1回鳴らす。settings.sound が false なら何もしない。name は SFX_FILES のキー。onMissing … ファイルが取れない・読めないときに、昔の「ピッ」の代わりに呼ぶ関数。 */
export function playSfx(settings, name, onMissing) {
  if (!settings || !settings.sound || !SFX_FILES[name]) return;
  const c = audioCtx();
  if (!c) return;
  const gain = sfxGain(settings.sfxVolume);
  if (gain <= 0) return;
  resumeCtx();
  sfxBuffer(name, c).then((buf) => {
    try {
      if (!buf) return onMissing ? onMissing() : synthBeep(c, name, gain);
      const src = c.createBufferSource();
      const g = c.createGain();
      src.buffer = buf;
      g.gain.value = gain;
      src.connect(g);
      g.connect(c.destination);
      src.start();
    } catch (e) { /* 音が出せなくても学習は続ける */ }
  });
}

// ---- BGM ----
// BGM は2つの場面に分ける（設定は bgm・bgmTrack＝問題中、bgmHome・bgmHomeTrack＝それ以外）。どちらを流すかは bgmPlan（lib/sound.js）が決める。
// 曲の鳴らし方は2通り: B＝BGM_TRACKS の曲（<audio>）、T＝タイトル曲（AudioBuffer の loop）。plan の track が 'title' なら T、それ以外は B。
// 場面が変わって流す曲が変わるときは、鳴っているほうを短く小さくして止めてから、新しいほうを流す（小さくしている間は新しいほうを始めない）。
const FADE_SEC = TITLE_BGM.fadeSec;

const B = {
  scene: false, // 問題を解いている画面にいるか
  title: true, // タイトル画面にいるか（起動時は true。『タップしてはじめる』で出たら setBgmTitle(false)）
  preview: false, // 設定画面の「試しに聴く」（問題中の曲）
  boss: false, // 章のボス戦の間か（ほかの BGM の代わりに、ボス戦の曲だけを流す）
  el: null,
  gainNode: null,
  track: 0,
  plays: 0,
  loadedTrack: -1,
  urls: new Map(), // 曲の番号 → blob の URL
  starting: false,
  waitingGesture: false,
  fading: false,
};

function plan() {
  return bgmPlan(getSettings(), { inQuiz: B.scene, preview: B.preview, inTitle: B.title, hidden: document.hidden, inBoss: B.boss });
}

// 設定が選んでいる曲（BGM_TRACKS の番号。おまかせ・タイトル曲・流さないときは -1）
function selectedIndex() {
  const p = plan();
  return p ? bgmTrackIndex(p.track) : -1;
}

// B（BGM_TRACKS の曲）を流したいか
function wantBgm() {
  const p = plan();
  return !!p && p.track !== TITLE_BGM.id && p.track !== BOSS_BGM.id;
}

async function trackUrl(i) {
  if (B.urls.has(i)) return B.urls.get(i);
  const res = await fetch(BGM_BASE + BGM_TRACKS[i].file);
  if (!res.ok) throw new Error('bgm ' + res.status);
  const url = URL.createObjectURL(await res.blob());
  B.urls.set(i, url);
  return url;
}

function ensureEl() {
  if (B.el) return B.el;
  const el = new Audio();
  el.preload = 'auto';
  B.el = el;
  const c = audioCtx();
  if (c) {
    try {
      const src = c.createMediaElementSource(el);
      B.gainNode = c.createGain();
      src.connect(B.gainNode);
      B.gainNode.connect(c.destination);
    } catch (e) { B.gainNode = null; }
  }
  el.addEventListener('ended', () => {
    const p = plan();
    const next = nextBgmPosition(B.track, B.plays + 1, BGM_TRACKS, p ? p.track : BGM_AUTO);
    B.track = next.track;
    B.plays = next.plays;
    if (next.track === B.loadedTrack) {
      el.currentTime = 0;
      if (wantBgm()) el.play().catch(() => {});
    } else {
      B.loadedTrack = -1;
      startBgm();
    }
  });
  return el;
}

function applyBgmVolume() {
  if (B.fading) return; // 小さくしている最中は触らない
  const s = getSettings();
  const g = bgmGain(s ? s.bgmVolume : undefined, (BGM_TRACKS[B.track] || BGM_TRACKS[0]).trim); // 曲ごとの音の大きさの補正つき
  if (B.gainNode) B.gainNode.gain.value = g;
  else if (B.el) B.el.volume = Math.min(1, g);
}

// 設定で1曲が選ばれていて、いま流す曲と違うなら、その曲に替える（おまかせのときは、いまの順番のまま）。替えたら true
function followSelectedTrack() {
  const idx = selectedIndex();
  if (idx < 0 || idx === B.track) return false;
  B.track = idx;
  B.plays = 0;
  return true;
}

async function startBgm() {
  if (B.starting || B.fading || T.fading || !wantBgm()) return;
  B.starting = true;
  try {
    const el = ensureEl();
    for (;;) {
      followSelectedTrack();
      const want = B.track;
      if (B.loadedTrack === want) break;
      const url = await trackUrl(want);
      if (!wantBgm()) return; // 取っている間に切られた
      if (B.track !== want || followSelectedTrack()) continue; // 取っている間に曲を選び直された
      el.src = url;
      B.loadedTrack = want;
    }
    applyBgmVolume();
    resumeCtx(); // 待たない（さわる前は、さわるまで終わらないことがある）
    await el.play();
    const c = audioCtx();
    if (c && c.state !== 'running') {
      await Promise.race([c.resume().catch(() => {}), new Promise((r) => setTimeout(r, 400))]);
      if (c.state !== 'running') throw new Error('locked'); // 鳴っているように見えて、実際は無音
    }
    B.waitingGesture = false;
  } catch (e) {
    // まだ画面をさわっていない（自動再生の制限）。さわったあとにもう一度。取得に失敗したときも、さわったときに再挑戦する
    if (B.el && !B.el.paused) B.el.pause();
    B.waitingGesture = true;
  } finally {
    B.starting = false;
  }
}

function stopBgm() {
  if (B.el && !B.el.paused) B.el.pause();
}

// 鳴っている BGM_TRACKS の曲を短く小さくして止める。止まったら syncBgm をもう一度呼ぶ（次に流すものがあれば、そこで始まる）
function fadeOutBgm() {
  const el = B.el;
  if (!el || el.paused || B.fading) return;
  const c = audioCtx();
  if (!B.gainNode || !c) { el.pause(); return; }
  B.fading = true;
  const t = c.currentTime;
  try {
    const g = B.gainNode.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + FADE_SEC);
  } catch (e) { /* 小さくできなくても、止まりはする */ }
  setTimeout(() => {
    B.fading = false;
    if (!el.paused) el.pause();
    syncBgm();
  }, FADE_SEC * 1000 + 80);
}

// ---- タイトル曲 ----
// 『それ以外』の曲がタイトル曲のときだけ流す1曲（曲の一覧 BGM_TRACKS とは別の仕組み）。
// 切れ目なくくり返すため、<audio> ではなく、読み込んで展開した音（AudioBuffer）を loop で流す。
// 音を出せない状態（画面をさわる前）でも start() は予約として受け付けられ、さわって resume されたところから鳴り始める。
const T = {
  buf: null, // 展開した音（Promise<AudioBuffer|null>）
  src: null, // 鳴らしている音の源
  gainNode: null,
  loading: false,
  fading: false,
};

function wantTitle() {
  const p = plan();
  return !!p && p.track === TITLE_BGM.id;
}

function titleBuffer(c) {
  if (!T.buf) {
    T.buf = fetch(BGM_BASE + TITLE_BGM.file)
      .then((r) => { if (!r.ok) throw new Error('title bgm ' + r.status); return r.arrayBuffer(); })
      .then((bytes) => c.decodeAudioData(bytes))
      .catch(() => null); // 取れない・読めないときは、鳴らさないだけ
  }
  return T.buf;
}

function applyTitleVolume() {
  const s = getSettings();
  if (T.gainNode && !T.fading) T.gainNode.gain.value = bgmGain(s ? s.bgmVolume : undefined, TITLE_BGM.trim);
}

function dropTitleSource() {
  if (T.src) { try { T.src.stop(); } catch (e) { /* もう止まっている */ } try { T.src.disconnect(); } catch (e) { /* 同上 */ } }
  if (T.gainNode) { try { T.gainNode.disconnect(); } catch (e) { /* 同上 */ } }
  T.src = null;
  T.gainNode = null;
}

async function startTitle() {
  if (T.src || T.loading || T.fading || B.fading || !wantTitle()) return;
  const c = audioCtx();
  if (!c) return;
  T.loading = true;
  try {
    const buf = await titleBuffer(c);
    if (!buf || T.src || !wantTitle()) return; // 取れなかった／取っている間に切られた
    const src = c.createBufferSource();
    const g = c.createGain();
    src.buffer = buf;
    src.loop = true;
    src.connect(g);
    g.connect(c.destination);
    T.src = src;
    T.gainNode = g;
    T.fading = false;
    applyTitleVolume();
    src.start(0);
    resumeCtx(); // さわる前なら、さわるまで待つ（さわった瞬間に鳴り始める）
  } catch (e) {
    dropTitleSource(); // 音が出せなくても学習は続ける
  } finally {
    T.loading = false;
  }
}

// タイトル曲を短く小さくして止める。止まったら syncBgm をもう一度呼ぶ
function fadeOutTitle() {
  const c = audioCtx();
  const src = T.src;
  const g = T.gainNode;
  if (!src || !g || !c) { dropTitleSource(); return; }
  if (T.fading) return;
  T.fading = true;
  const t = c.currentTime;
  try {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + FADE_SEC);
  } catch (e) { /* 小さくできなくても、止まりはする */ }
  setTimeout(() => {
    if (T.src === src) dropTitleSource();
    T.fading = false;
    syncBgm();
  }, FADE_SEC * 1000 + 100);
}

// ---- ボス戦の曲と効果音 ----
// 曲は BGM の設定（オン／オフ・音量）、効果音（ファンファーレなど）は効果音の設定に従う。
// 曲は2通り。mode 'file' … BOSS_BGM.file（OpenGameArt の曲）を <audio> でくり返す。mode 'synth' … ファイルが取れない・鳴らせないときの代わり。
// プログラムで鳴らす昔のゲーム機風の曲（楽譜は lib/bossmusic.js）: 8小節を1周として、少し先まで予約していく（M.loopAt が次の周の始まり）。
// どちらも止めるときは小さくして止める（予約済みの音は聞こえないまま終わる）。効果音（ファンファーレ・登場・会心・ヒット）は今までどおりプログラム。
const M = {
  armed: false, // 曲を鳴らしてよい合図（ボスが現れたとき startBossTheme が立て、倒した・負けたとき stopBossTheme が下ろす）
  running: false,
  mode: null, // null（ファイルを取っている最中）| 'file' | 'synth'
  token: 0, // 曲を始めるたびに増やす。取っている間に止められた・始め直されたかの目印
  gain: null,
  timer: null,
  loopAt: 0,
  theme: null,
  el: null, // ファイルの曲の <audio>（1つを使い回す）
  elSource: null, // el をつなぐ音の源（createMediaElementSource は1つの el に1回しか作れない）
  url: null, // 取ったファイルの blob の URL
};

function bossGainValue() {
  const s = getSettings();
  return bgmGain(s ? s.bgmVolume : undefined, M.mode === 'synth' ? BOSS_BGM.synthTrim : BOSS_BGM.trim);
}

function applyBossVolume() {
  if (M.gain && M.running) M.gain.gain.value = bossGainValue();
}

// 音の並びを、時刻 t0 から先へ予約する。dest はつなぎ先。wave・gain・freq・to（滑らせる先）を使う
function scheduleEvents(c, dest, events, t0, extraGain = 1) {
  events.forEach((e) => {
    if (!e.freq) return;
    try {
      const o = c.createOscillator();
      const g = c.createGain();
      const t = t0 + e.t;
      const end = t + Math.max(0.03, e.dur);
      o.type = e.wave;
      o.frequency.setValueAtTime(e.freq, t);
      if (e.to) o.frequency.linearRampToValueAtTime(e.to, end);
      const peak = Math.max(0.0002, (e.gain || 0.5) * extraGain);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.008);
      g.gain.setValueAtTime(peak, Math.max(t + 0.008, end - 0.025));
      g.gain.linearRampToValueAtTime(0.0001, end);
      o.connect(g);
      g.connect(dest);
      o.start(t);
      o.stop(end + 0.02);
    } catch (err) { /* 1音が鳴らせなくても続ける */ }
  });
}

function scheduleThemeAhead() {
  const c = ctx;
  if (!c || !M.running || !M.gain) return;
  if (!M.theme) M.theme = bossTheme();
  while (M.loopAt < c.currentTime + 2) {
    M.theme.voices.forEach((v) => scheduleEvents(c, M.gain, v.events.map((e) => ({ ...e, wave: v.wave, gain: v.gain })), M.loopAt));
    M.loopAt += M.theme.loopSec;
  }
}

// プログラムで鳴らす曲を始める（ファイルの曲が使えないときの代わり）
function startBossSynth() {
  const c = audioCtx();
  if (!c || !M.running || !M.gain) return;
  M.mode = 'synth';
  applyBossVolume();
  M.loopAt = c.currentTime + 0.08;
  scheduleThemeAhead();
  M.timer = setInterval(scheduleThemeAhead, 300);
}

async function bossFileUrl() {
  if (M.url) return M.url;
  const res = await fetch(BGM_BASE + BOSS_BGM.file);
  if (!res.ok) throw new Error('boss bgm ' + res.status);
  M.url = URL.createObjectURL(await res.blob());
  return M.url;
}

// ファイルの曲を鳴らす。鳴らせたら true、取れない・鳴らせないなら false（呼んだ側がプログラムの曲に替える）
async function startBossFile(token) {
  const c = audioCtx();
  try {
    const url = await bossFileUrl();
    if (token !== M.token || !M.running) return true; // 取っている間に止められた・始め直された（何もしない）
    if (!M.el) {
      M.el = new Audio();
      M.el.preload = 'auto';
      M.el.loop = true; // 約134秒の曲をくり返す
    }
    if (!M.elSource) M.elSource = c.createMediaElementSource(M.el);
    try { M.elSource.disconnect(); } catch (e) { /* まだどこにもつながっていない */ }
    M.elSource.connect(M.gain);
    if (M.el.src !== url) M.el.src = url;
    M.el.currentTime = 0;
    M.mode = 'file';
    applyBossVolume();
    await M.el.play();
    if (token !== M.token || !M.running) { M.el.pause(); return true; }
    return true;
  } catch (e) {
    if (M.el && !M.el.paused) M.el.pause();
    return false;
  }
}

function startBossMusic() {
  const c = audioCtx();
  if (!c || M.running) return;
  const s = getSettings();
  if (!s || !s.bgm) return;
  resumeCtx();
  try {
    M.gain = c.createGain();
    M.gain.gain.value = bgmGain(s.bgmVolume, BOSS_BGM.trim);
    M.gain.connect(c.destination);
  } catch (e) { M.gain = null; return; }
  M.running = true;
  M.mode = null;
  const token = ++M.token;
  // ファイルを取っている間は、まだ鳴らさない（取れなければプログラムの曲）
  startBossFile(token).then((ok) => { if (!ok && token === M.token && M.running) startBossSynth(); });
}

// 曲を小さくして止める（immediate なら、すぐ）。止まったら syncBgm をもう一度呼ぶ（次に流すものがあれば、そこで始まる）
function stopBossMusic(immediate) {
  if (!M.running) return;
  const g = M.gain;
  const c = ctx;
  M.running = false;
  M.mode = null;
  M.token++;
  clearInterval(M.timer);
  M.timer = null;
  M.gain = null;
  if (!g || !c) { if (M.el && !M.el.paused) M.el.pause(); }
  if (g && c) {
    try {
      if (immediate) g.gain.value = 0;
      else {
        const t = c.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + 0.3);
      }
    } catch (e) { /* 小さくできなくても、あとで切る */ }
    setTimeout(() => {
      try { g.disconnect(); } catch (e) { /* もう外れている */ }
      if (!M.running && M.el && !M.el.paused) M.el.pause(); // 小さくし終わってから止める（その間に始め直されていたら止めない）
      syncBgm();
    }, immediate ? 0 : 380);
  }
}

/** ボス戦の画面に入った・出た。入っている間は、ほかの BGM は鳴らさない（BGM がオンのときだけ。曲そのものは startBossTheme で始まる）。 */
export function setBgmBoss(on) {
  B.boss = !!on;
  if (!on) M.armed = false;
  syncBgm();
}

/** ボスが現れた。ボス戦の曲を鳴らす（BGM がオフなら何もしない）。 */
export function startBossTheme() {
  M.armed = true;
  syncBgm();
}

/** ボスを倒した・負けた。ボス戦の曲を止める（ほかの BGM は、ボス戦の画面を出るまで戻らない）。 */
export function stopBossTheme() {
  M.armed = false;
  if (M.running) stopBossMusic(false);
}

/** プログラムで鳴らす効果音（SYNTH_SFX のキー）。効果音がオンのときだけ、効果音の音量で。 */
export function playSynth(settings, name) {
  if (!settings || !settings.sound || !SYNTH_SFX[name]) return;
  const c = audioCtx();
  if (!c) return;
  const gain = sfxGain(settings.sfxVolume);
  if (gain <= 0) return;
  resumeCtx();
  try {
    const g = c.createGain();
    g.gain.value = 0.25 * gain;
    g.connect(c.destination);
    scheduleEvents(c, g, SYNTH_SFX[name], c.currentTime + 0.02);
  } catch (e) { /* 音が出せなくても学習は続ける */ }
}

/** ボス戦の効果音（BOSS_SFX の種類: hit＝ボスに当たった・win＝倒した・hurt＝ダメージをもらった）。効果音の設定に従う。ファイルが無い種類は何も鳴らさず、ファイルが読めなかったときはプログラムの音に戻る。 */
export function playBossSfx(settings, kind) {
  const e = BOSS_SFX[kind];
  if (!e || !SFX_FILES[e.key]) return;
  playSfx(settings, e.key, e.synth ? () => playSynth(settings, e.synth) : undefined);
}

/** 『それ以外』がオンで、タイトル曲かどうかにかかわらず、まだ画面をさわっていなくて鳴らせない状態か（「さわると流れます」の一言を出す判定）。 */
export function titleAudioLocked() {
  const p = plan();
  return !!p && p.scene !== 'quiz' && p.scene !== 'boss' && !!ctx && ctx.state !== 'running';
}

/** 動作確認用: いまのタイトル曲の状態。 */
export function titleBgmStatus() {
  return { playing: !!T.src, fading: T.fading, volume: T.gainNode ? T.gainNode.gain.value : null };
}

/**
 * 設定・場面・画面の表裏が変わったら呼ぶ。流すべきものを流し、そうでなければ止める。
 * 流す曲が変わるとき（場面が変わった・曲を選び直した）は、鳴っているほうを小さくして止めてから、新しいほうを流す。
 */
export function syncBgm() {
  const p = plan();
  const hidden = document.hidden;
  const wantT = !!p && p.track === TITLE_BGM.id;
  const wantBoss = !!p && p.track === BOSS_BGM.id;
  const wantB = !!p && !wantT && !wantBoss;
  // 止める側（アプリが裏に回ったときは、すぐ止める）
  if (!wantBoss && M.running) stopBossMusic(hidden);
  if (!wantT && T.src && !T.fading) { if (hidden) dropTitleSource(); else fadeOutTitle(); }
  if (B.el && !B.el.paused && !B.fading && (!wantB || (selectedIndex() >= 0 && selectedIndex() !== B.track))) {
    if (hidden) stopBgm(); else fadeOutBgm();
  }
  // 流す側
  if (wantBoss && M.armed && !M.running && !B.fading && !T.fading) startBossMusic();
  if (wantBoss && M.running) applyBossVolume();
  if (wantT) {
    if (T.src) applyTitleVolume();
    else startTitle();
  }
  if (wantB) {
    applyBgmVolume();
    if (!B.el || B.el.paused) startBgm();
  }
  // 展開した音（約10MB）は、タイトル曲を使う設定でなければ手放す
  const s = getSettings();
  if (!T.src && !T.loading && !(s && s.bgmHome && (B.title || s.bgmHomeTrack === TITLE_BGM.id))) T.buf = null;
}

/** タイトル画面にいるかどうかを伝える（出たら false。タイトル画面はタイトル曲で固定、出たあとは『それ以外』の曲）。 */
export function setBgmTitle(on) {
  B.title = !!on;
  syncBgm();
}

/** 問題を解いている画面にいるかどうかを伝える。 */
export function setBgmScene(on) {
  B.scene = !!on;
  syncBgm();
}

/** 設定画面の「試しに聴く」（問題中の曲）。場面と関係なく、問題中の BGM がオンのときだけ鳴る。 */
export function setBgmPreview(on) {
  B.preview = !!on;
  syncBgm();
}

/** 音量を変えたとき（BGM は鳴っている最中にそのまま変わる）。 */
export function applyVolumes() {
  applyBgmVolume();
  applyTitleVolume();
  applyBossVolume();
}

/** 起動時に1回。getSettings は「いまの設定」を返す関数（学習記録を消すと設定の入れ物が替わるため）。 */
export function initAudio(settingsGetter) {
  getSettings = settingsGetter;
  const s = getSettings();
  if (s && s.sound) preloadSfx();
  document.addEventListener('visibilitychange', syncBgm);
  const onGesture = () => {
    // 画面のどこをさわっても（ボタン以外の背景も）、効果音か BGM がオンなら音を使える状態にする。
    // ブラウザは、さわるまで音を出させない。タイトル画面の曲は、さわった瞬間から鳴り始める（iOS の Safari は click でも許す）
    const s = getSettings();
    if (s && (s.sound || s.bgm || s.bgmHome) && ctx && ctx.state !== 'running') unlockAudio(s);
    else resumeCtx();
    if (B.waitingGesture || (wantBgm() && (!B.el || B.el.paused))) startBgm();
  };
  ['pointerdown', 'keydown', 'touchend', 'click'].forEach((t) => document.addEventListener(t, onGesture, { passive: true }));
  syncBgm(); // 『それ以外』がオンなら、タイトル画面の前から流す準備（さわる前は予約。さわったところから鳴る）
}

/**
 * 「最初の操作」（タイトル画面のボタン）の押した瞬間に呼ぶ。効果音か BGM がオンの人だけ、音を使える状態にする。
 * AudioContext を作って動かし、無音の1サンプルを鳴らしておく（iOS の Safari は、これで以後の音が許される）。
 * BGM そのものはここでは流さない（場面に入ったとき・設定が変わったときに syncBgm が流す）。
 * ボタンの押した処理の中で、同期的に呼ぶこと。
 */
export function unlockAudio(settings) {
  if (!settings || !(settings.sound || settings.bgm || settings.bgmHome)) return;
  const c = audioCtx();
  if (!c) return;
  resumeCtx();
  try {
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  } catch (e) { /* 無音が鳴らせなくても、resume できていれば足りる */ }
}

/** 動作確認用: いまの BGM の状態。playingId … いま鳴っている曲の id（タイトル曲は 'title'。鳴っていなければ null）。 */
export function bgmStatus() {
  const bPlaying = !!(B.el && !B.el.paused);
  return {
    scene: B.scene,
    plan: plan(),
    playing: bPlaying,
    playingId: T.src ? TITLE_BGM.id : bPlaying ? (BGM_TRACKS[B.track] || BGM_TRACKS[0]).id : null,
    track: B.track,
    plays: B.plays,
    volume: B.gainNode ? B.gainNode.gain.value : B.el ? B.el.volume : null,
    waitingGesture: B.waitingGesture,
    fading: B.fading || T.fading,
    boss: {
      on: B.boss, armed: M.armed, playing: M.running, volume: M.gain ? M.gain.gain.value : null,
      mode: M.mode, // 'file'＝ファイルの曲／'synth'＝プログラムの曲／null＝鳴らしていない（ファイルを取っている最中を含む）
      file: M.el ? { src: M.el.src, paused: M.el.paused, loop: M.el.loop, currentTime: M.el.currentTime, volume: M.el.volume } : null,
    },
  };
}
