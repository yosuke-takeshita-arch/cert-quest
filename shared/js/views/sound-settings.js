// 音の設定のカード（効果音のオン／オフと音量・BGM は「問題中」と「それ以外」の2つの場面ごとのオン／オフと曲・BGM の音量・試しに聴く）。ブラウザ専用。
// 設定画面（more.js）と、タイトル画面の歯車のポップアップ（title.js）の両方から使う。同じ作りを2つ書かない。
import { h } from '../ui.js';
import { normalizeVolume, normalizeBgmTrack, normalizeHomeTrack, BGM_AUTO, BGM_TRACKS, TITLE_BGM } from '../lib/sound.js';
import { playSfx, preloadSfx, syncBgm, applyVolumes, setBgmPreview } from '../audio.js';

/**
 * settings … 設定の入れ物（変えるとそのまま書き換わる）
 * commit()  … 変えたあとの保存（設定画面は app.commit、タイトル画面は storage.save）
 * heading   … カードの見出し「音」を出すか（ポップアップは自前の見出しがあるので false）
 * 返すもの: { el, dispose }。dispose() … 画面を出る・ポップアップを閉じるとき。試し聴きの BGM を止める
 */
export function buildSoundCard(settings, commit, { heading = true } = {}) {
  const s = settings;
  const toggle = (label, hint, key, onChange) => {
    const id = 'set-' + key;
    const input = h('input', { type: 'checkbox', id, class: 'switch' });
    input.checked = !!s[key];
    input.addEventListener('change', () => {
      s[key] = input.checked;
      commit();
      if (onChange) onChange(input.checked);
    });
    return h('label', { class: 'row-btn', for: id }, h('span', { class: 'row-main' }, h('strong', { text: label }), h('span', { class: 'small muted', text: hint })), input);
  };
  // 音量のスライダー（0〜100）。対応するオン／オフがすべて切れている間は動かせない。動かすとその場で反映する
  const gated = []; // { input, on: () => 動かせるか }
  const slider = (label, key, enabled, onInput) => {
    const id = 'set-' + key;
    const val = h('span', { class: 'small muted', id: id + '-val', text: 'いま ' + s[key] });
    const input = h('input', { type: 'range', id, class: 'slider', min: '0', max: '100', step: '5' });
    input.value = String(s[key]);
    input.addEventListener('input', () => {
      s[key] = normalizeVolume(input.value, s[key]);
      val.textContent = 'いま ' + s[key];
      onInput();
    });
    input.addEventListener('change', () => commit());
    gated.push({ input, on: enabled });
    return h('label', { class: 'row-btn', for: id }, h('span', { class: 'row-main' }, h('strong', { text: label }), val), input);
  };
  const syncGated = () => gated.forEach((x) => { x.input.disabled = !x.on(); });
  let lastTry = 0;
  const tryOk = () => {
    const now = Date.now();
    if (now - lastTry < 250) return;
    lastTry = now;
    playSfx(s, 'ok');
  };
  // BGM の曲の選択（場面ごと）。選んだらすぐ保存し、鳴っていればその曲に切り替える。切っている場面の選択は動かせない
  const trackRow = (label, hint, key, options, normalize, enabled) => {
    const id = 'set-' + key;
    const sel = h('select', { id, class: 'select select-full' }, options.map((o) => h('option', { value: o.value, text: o.text })));
    s[key] = normalize(s[key]);
    sel.value = s[key];
    sel.addEventListener('change', () => {
      s[key] = normalize(sel.value);
      commit();
      syncBgm();
    });
    gated.push({ input: sel, on: enabled });
    return h('label', { class: 'row-btn row-stack', for: id }, h('span', { class: 'row-main' }, h('strong', { text: label }), h('span', { class: 'small muted', text: hint })), sel);
  };
  const trackOptions = BGM_TRACKS.map((t) => ({ value: t.id, text: t.name + '（' + t.mood + '）' }));
  const quizOn = () => !!s.bgm;
  const homeOn = () => !!s.bgmHome;
  const previewBtn = h('button', { class: 'btn', id: 'bgm-preview', type: 'button' }, '問題中の BGM を試しに聴く');
  let previewing = false;
  const setPreview = (on) => {
    previewing = on && !!s.bgm;
    setBgmPreview(previewing);
    previewBtn.textContent = previewing ? '試聴をとめる' : '問題中の BGM を試しに聴く';
    previewBtn.disabled = !s.bgm;
  };
  previewBtn.addEventListener('click', () => setPreview(!previewing));
  const el = h('div', { class: 'card sound-card' }, heading ? h('h2', { text: '音' }) : null,
    toggle('効果音', '正解・不正解・お祝い・はじめるときに鳴らします（初期はオフ）', 'sound', (on) => {
      if (on) { preloadSfx(); tryOk(); }
    }),
    slider('効果音の音量', 'sfxVolume', () => !!s.sound, tryOk),
    toggle('BGM（問題を解いているとき）', '問題を解いているあいだ、静かな曲を流します（初期はオフ）', 'bgm', () => {
      syncBgm();
      syncGated();
      setPreview(false);
    }),
    trackRow('問題中の曲', 'おまかせは全曲を順番に流します。曲を選ぶと、その曲をくり返します', 'bgmTrack',
      [{ value: BGM_AUTO, text: 'おまかせ（全曲を順番に）' }, ...trackOptions], normalizeBgmTrack, quizOn),
    toggle('BGM（それ以外）', 'タイトル・ホーム・地図・カードなど、問題を解いていないときに流します。オンにすると、この画面でもすぐ流れます（初期はオフ）', 'bgmHome', () => {
      syncBgm();
      syncGated();
    }),
    trackRow('それ以外の曲', '選ぶと、その曲に切り替わります（この画面でも聞こえます）', 'bgmHomeTrack',
      [{ value: TITLE_BGM.id, text: TITLE_BGM.name + '（タイトル曲）' }, { value: BGM_AUTO, text: 'おまかせ（全曲を順番に）' }, ...trackOptions], normalizeHomeTrack, homeOn),
    slider('BGM の音量（どちらの場面も共通）', 'bgmVolume', () => quizOn() || homeOn(), () => applyVolumes()),
    h('div', { class: 'row-btn plain' }, h('span', { class: 'row-main' }, h('span', { class: 'small muted', text: '問題中の BGM をオンにしてから、ここで曲と音の大きさを確かめられます' })), previewBtn));
  syncGated();
  setPreview(false);
  return { el, dispose: () => setBgmPreview(false) };
}
