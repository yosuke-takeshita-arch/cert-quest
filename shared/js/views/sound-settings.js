// 音の設定のカード（効果音・BGM のオン／オフと音量・BGM の曲・試しに聴く）。ブラウザ専用。
// 設定画面（more.js）と、タイトル画面の歯車のポップアップ（title.js）の両方から使う。同じ作りを2つ書かない。
import { h } from '../ui.js';
import { normalizeVolume, normalizeBgmTrack, BGM_AUTO, BGM_TRACKS } from '../lib/sound.js';
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
  // 音量のスライダー（0〜100）。切っている間は動かせない。動かすとその場で反映する
  const sliders = [];
  const slider = (label, key, onInput) => {
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
    sliders.push({ input, key: key === 'sfxVolume' ? 'sound' : 'bgm' });
    return h('label', { class: 'row-btn', for: id }, h('span', { class: 'row-main' }, h('strong', { text: label }), val), input);
  };
  const syncSliders = () => sliders.forEach((x) => { x.input.disabled = !s[x.key]; });
  let lastTry = 0;
  const tryOk = () => {
    const now = Date.now();
    if (now - lastTry < 250) return;
    lastTry = now;
    playSfx(s, 'ok');
  };
  // BGM の曲の選択。おまかせ（全曲を順番に）か1曲（その曲をくり返す）。選んだらすぐ保存し、試聴中ならその曲に切り替える
  const trackSel = h('select', { id: 'set-bgmTrack', class: 'select select-full' }, [
    h('option', { value: BGM_AUTO, text: 'おまかせ（全曲を順番に）' }),
    ...BGM_TRACKS.map((t) => h('option', { value: t.id, text: t.name + '（' + t.mood + '）' })),
  ]);
  s.bgmTrack = normalizeBgmTrack(s.bgmTrack);
  trackSel.value = s.bgmTrack;
  trackSel.addEventListener('change', () => {
    s.bgmTrack = normalizeBgmTrack(trackSel.value);
    commit();
    syncBgm();
  });
  sliders.push({ input: trackSel, key: 'bgm' });
  const previewBtn = h('button', { class: 'btn', id: 'bgm-preview', type: 'button' }, 'BGM を試しに聴く');
  let previewing = false;
  const setPreview = (on) => {
    previewing = on && !!s.bgm;
    setBgmPreview(previewing);
    previewBtn.textContent = previewing ? '試聴をとめる' : 'BGM を試しに聴く';
    previewBtn.disabled = !s.bgm;
  };
  previewBtn.addEventListener('click', () => setPreview(!previewing));
  const el = h('div', { class: 'card sound-card' }, heading ? h('h2', { text: '音' }) : null,
    toggle('効果音', '正解・不正解・お祝い・はじめるときに鳴らします（初期はオフ）', 'sound', (on) => {
      if (on) { preloadSfx(); tryOk(); }
      syncSliders();
    }),
    slider('効果音の音量', 'sfxVolume', tryOk),
    toggle('BGM', '問題を解いているあいだ、静かな曲を流します（初期はオフ。ホームでは流れません）', 'bgm', () => {
      syncBgm();
      syncSliders();
      setPreview(false);
    }),
    slider('BGM の音量', 'bgmVolume', () => applyVolumes()),
    h('label', { class: 'row-btn row-stack', for: 'set-bgmTrack' }, h('span', { class: 'row-main' }, h('strong', { text: 'BGM の曲' }), h('span', { class: 'small muted', text: 'おまかせは全曲を順番に流します。曲を選ぶと、その曲をくり返します' })), trackSel),
    h('div', { class: 'row-btn plain' }, h('span', { class: 'row-main' }, h('span', { class: 'small muted', text: 'BGM をオンにしてから、ここで音の大きさを確かめられます' })), previewBtn));
  syncSliders();
  setPreview(false);
  return { el, dispose: () => setBgmPreview(false) };
}
