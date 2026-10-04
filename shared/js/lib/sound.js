// 音の設定の正規化と、どの音を鳴らすかの表。ブラウザには触らない（audio.js が鳴らす）。
// 素材はすべて CC0。出どころは docs/sources/audio-licenses.md。
export const DEFAULT_SFX_VOLUME = 70;
export const DEFAULT_BGM_VOLUME = 40;

/** 音量（0〜100）を整数に直す。数字でない・範囲外は初期値／端に寄せる。 */
export function normalizeVolume(v, fallback) {
  if (typeof v === 'string' && v.trim() !== '') v = Number(v);
  const n = v;
  if (typeof n !== 'number') return fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * settings の音の項目を、正しい形に直して返す（settings 自体を書き換える）。
 *  sound … 効果音のオン／オフ（これまでの項目をそのまま引き継ぐ。古い記録でオンの人はオンのまま）
 *  sfxVolume / bgmVolume … 0〜100
 *  bgm … BGM のオン／オフ（初期オフ）
 */
export function normalizeSoundSettings(settings) {
  const s = settings;
  s.sound = s.sound === true;
  s.bgm = s.bgm === true;
  s.sfxVolume = normalizeVolume(s.sfxVolume, DEFAULT_SFX_VOLUME);
  s.bgmVolume = normalizeVolume(s.bgmVolume, DEFAULT_BGM_VOLUME);
  return s;
}

// 効果音の目盛りは耳に合わせて2乗にする（半分の目盛りで半分の大きさには聞こえないため）。
export function sfxGain(volume) {
  const v = normalizeVolume(volume, DEFAULT_SFX_VOLUME) / 100;
  return v * v;
}
// BGM の素材は元の音がとても小さい（実測 2026-10-04: contemplation は RMS 0.038・ピーク 0.26、jrpg-piano は RMS 0.048・ピーク 0.28。
// 効果音は RMS 0.14〜0.27）。以前は 2乗×0.7 で、初期の 40 だと 0.11 倍になり、実機ではほぼ聞こえなかった。
// そこで目盛りに比例させ、最大で BGM_GAIN_MAX 倍まで持ち上げる。40 で約1倍（効果音の初期より 10dB ほど小さい）、
// 100 で 2.6 倍（ピークは 0.28×2.6＝0.72 で割れない）。素材を替えたら、ピーク×BGM_GAIN_MAX が 1 未満かを測り直す。
export const BGM_GAIN_MAX = 2.6;
export function bgmGain(volume) {
  const v = normalizeVolume(volume, DEFAULT_BGM_VOLUME) / 100;
  return v * BGM_GAIN_MAX;
}

// 効果音。キー → ファイル（shared/audio/sfx/ の中）。
//  ok=正解 ng=不正解 level=レベルアップ badge=バッジ stars=星 goal=1日の目標
export const SFX_FILES = {
  ok: 'confirmation_001.ogg',
  ng: 'bong_001.ogg',
  level: 'jingles_STEEL07.ogg',
  badge: 'jingles_SAX07.ogg',
  stars: 'jingles_PIZZI07.ogg',
  goal: 'jingles_NES00.ogg',
};

// BGM。順に流し、repeat 回くり返したら次へ。最後まで行ったら最初に戻る（shared/audio/bgm/ の中）。
export const BGM_TRACKS = [
  { file: 'contemplation.mp3', repeat: 1 },
  { file: 'jrpg-piano.mp3', repeat: 4 },
];

/** お祝いの種類 → 効果音のキー。 */
export function celebrateSfx(kind) {
  return kind === 'level' ? 'level' : kind === 'badge' ? 'badge' : kind === 'stars' ? 'stars' : 'goal';
}

/** 次に流す曲。track は今の曲の番号、plays は今の曲を何回流し終えたか。 */
export function nextBgmPosition(track, plays, tracks = BGM_TRACKS) {
  const cur = tracks[track] ? track : 0;
  if (plays < tracks[cur].repeat) return { track: cur, plays };
  return { track: (cur + 1) % tracks.length, plays: 0 };
}
