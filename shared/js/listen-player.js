// 聞き流しの再生係。speechSynthesis に1文ずつ渡し、前へ／次へ／一時停止／停止、ロック画面の操作（Media Session）、
// 再生中に画面を消さない（Screen Wake Lock）を受け持つ。ブラウザの部品は引数で受け取る（テスト・動作確認で差し替えられる）。
import { segmentsFor, pickJaVoice, normalizeListenRate } from './lib/listen.js';

/**
 * synth      … speechSynthesis
 * Utterance  … SpeechSynthesisUtterance
 * getSettings() … いまの settings（速さ・考える間・画面を消さない）
 * onChange(s) … 状態が変わるたび。s = { status, idx, total, title, chapter, phase, error, voice }
 *   status … 'idle' 止まっている／'playing' 読んでいる／'paused' 一時停止／'done' 最後まで読んだ
 *   phase  … 'speaking' 声を出している／'thinking' 問題の考える間／''
 * nav … navigator（Media Session・Wake Lock の入口）
 */
export function createListenPlayer({ synth, Utterance, getSettings, onChange = () => {}, nav = navigator, doc = document, appName = '' }) {
  let kind = 'card';
  let entries = [];
  let idx = 0;
  let segs = null; // いまの1件の読み上げ区切り
  let segIdx = 0;
  let status = 'idle';
  let phase = '';
  let error = '';
  let token = 0; // 古い読み上げの終わりの通知を無視するための印（止めたり進めたりするたび増える）
  let timer = null;
  let cur = null; // 読み上げ中の utterance（捨てられないよう持っておく）
  let voice = null;
  let lock = null;

  const settings = () => getSettings() || {};

  function refreshVoice() {
    try { voice = pickJaVoice(synth.getVoices()); } catch (e) { voice = null; }
  }
  refreshVoice();
  const onVoices = () => { refreshVoice(); emit(); };
  if (synth && synth.addEventListener) synth.addEventListener('voiceschanged', onVoices);

  function snapshot() {
    const e = entries[idx];
    let voiceCount = 0;
    try { voiceCount = synth.getVoices().length; } catch (er) { voiceCount = 0; }
    return { status, idx, total: entries.length, title: e ? e.title : '', chapter: e ? e.chapter : '', phase, error, voice, voiceCount };
  }

  function emit() {
    const s = snapshot();
    updateMediaSession(s);
    try { onChange(s); } catch (e) { /* 画面側の失敗で再生を止めない */ }
  }

  // ---- Media Session（ロック画面・通知の操作。speechSynthesis で出るかは端末しだい。出なくても害は無い） ----
  const handlers = {
    play: () => play(),
    pause: () => pause(),
    stop: () => stop(),
    previoustrack: () => prev(),
    nexttrack: () => next(),
  };
  function setHandlers(on) {
    const ms = nav && nav.mediaSession;
    if (!ms) return;
    for (const [k, fn] of Object.entries(handlers)) {
      try { ms.setActionHandler(k, on ? fn : null); } catch (e) { /* この操作に対応していない端末 */ }
    }
  }
  setHandlers(true);
  function updateMediaSession(s) {
    const ms = nav && nav.mediaSession;
    if (!ms) return;
    try {
      if (typeof MediaMetadata === 'function') {
        ms.metadata = s.status === 'idle' && !s.title ? null : new MediaMetadata({ title: s.title || '聞き流し', artist: appName, album: '聞き流し ' + (s.total ? (s.idx + 1) + ' / ' + s.total : '') });
      }
      ms.playbackState = s.status === 'playing' ? 'playing' : s.status === 'paused' ? 'paused' : 'none';
    } catch (e) { /* 効かなくても読み上げには関係ない */ }
  }

  // ---- 画面を消さない（Screen Wake Lock） ----
  async function acquireLock() {
    if (!settings().listenKeepAwake || !nav || !nav.wakeLock || status !== 'playing' || lock) return;
    try {
      const l = await nav.wakeLock.request('screen');
      if (status !== 'playing' || !settings().listenKeepAwake) { l.release(); return; }
      lock = l;
      l.addEventListener('release', () => { if (lock === l) lock = null; });
    } catch (e) { /* 省電力のときなどは許されない。そのまま続ける */ }
  }
  function releaseLock() {
    if (lock) { try { lock.release(); } catch (e) { /* 既に外れている */ } lock = null; }
  }
  const onVisible = () => { if (doc.visibilityState === 'visible') acquireLock(); };
  if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', onVisible);

  // ---- 読み上げ ----
  function cancelSpeech() {
    token++;
    clearTimeout(timer);
    timer = null;
    cur = null;
    try { if (synth.speaking || synth.pending) synth.cancel(); } catch (e) { /* 取り消せなくても進める */ }
  }

  function loadItem() {
    const e = entries[idx];
    segs = e ? segmentsFor(kind, e, settings().listenPause) : [];
    segIdx = 0;
  }

  function finish() {
    cancelSpeech();
    status = 'done';
    phase = '';
    releaseLock();
    emit();
  }

  function runSegment() {
    cancelSpeech();
    const tok = token;
    if (status !== 'playing') return;
    if (!segs) loadItem();
    if (segIdx >= segs.length) {
      if (idx + 1 >= entries.length) return finish();
      idx++;
      loadItem();
      emit();
      return runSegment();
    }
    const seg = segs[segIdx];
    const advance = () => { if (tok !== token) return; segIdx++; runSegment(); };
    if (seg.pause) {
      phase = 'thinking';
      emit();
      timer = setTimeout(advance, seg.pause * 1000);
      return;
    }
    phase = 'speaking';
    const u = new Utterance(seg.text);
    u.lang = voice ? voice.lang : 'ja-JP';
    if (voice) { try { u.voice = voice; } catch (e) { /* 声の指定が通らなくても、lang で日本語を選ばせる */ } }
    u.rate = normalizeListenRate(settings().listenRate);
    u.onend = advance;
    u.onerror = (ev) => {
      if (tok !== token) return;
      const why = ev && ev.error;
      if (why === 'interrupted' || why === 'canceled') return; // 自分で止めたとき
      cancelSpeech();
      status = 'paused';
      phase = '';
      error = '読み上げが止まりました（' + (why || '原因不明') + '）。もう一度、再生を押してください。';
      releaseLock();
      emit();
    };
    cur = u;
    error = '';
    emit();
    try { synth.speak(u); } catch (e) {
      status = 'paused';
      error = '読み上げを始められませんでした。';
      emit();
    }
  }

  function load(newKind, newEntries) {
    cancelSpeech();
    kind = newKind;
    entries = newEntries.slice();
    idx = 0;
    segs = null;
    segIdx = 0;
    status = 'idle';
    phase = '';
    error = '';
    releaseLock();
    emit();
  }

  function play() {
    if (!entries.length) return;
    if (status === 'playing') return;
    if (status === 'done') { idx = 0; segs = null; segIdx = 0; }
    status = 'playing';
    error = '';
    runSegment();
    acquireLock();
  }

  function pause() {
    if (status !== 'playing') return;
    cancelSpeech();
    status = 'paused'; // 再開は、いま読んでいる文のはじめから（端末の pause/resume は不安定なので使わない）
    phase = '';
    releaseLock();
    emit();
  }

  function stop() {
    cancelSpeech();
    status = 'idle';
    phase = '';
    idx = 0;
    segs = null;
    segIdx = 0;
    releaseLock();
    emit();
  }

  function go(to) {
    if (!entries.length) return;
    const n = Math.min(entries.length - 1, Math.max(0, to));
    const was = status;
    cancelSpeech();
    idx = n;
    segs = null;
    segIdx = 0;
    if (was === 'done') status = 'paused';
    phase = '';
    if (status === 'playing') runSegment();
    else emit();
  }
  const next = () => {
    if (status === 'playing' && idx + 1 >= entries.length) return finish();
    go(idx + 1);
  };
  const prev = () => go(idx - 1);

  function dispose() {
    cancelSpeech();
    status = 'idle';
    releaseLock();
    setHandlers(false);
    try { if (nav && nav.mediaSession) { nav.mediaSession.metadata = null; nav.mediaSession.playbackState = 'none'; } } catch (e) { /* 何もしない */ }
    if (synth && synth.removeEventListener) synth.removeEventListener('voiceschanged', onVoices);
    if (doc && doc.removeEventListener) doc.removeEventListener('visibilitychange', onVisible);
  }

  return {
    load, play, pause, stop, next, prev, dispose,
    toggle: () => (status === 'playing' ? pause() : play()),
    /** 「画面を消さない」を変えたとき。再生中なら、すぐ取る／外す */
    refreshAwake: () => { if (settings().listenKeepAwake) acquireLock(); else releaseLock(); },
    state: snapshot,
  };
}
