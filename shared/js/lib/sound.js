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

// 音量の目盛りは耳に合わせて2乗にする（半分の目盛りで半分の大きさには聞こえないため）。
// BGM は学習の邪魔にならないよう、同じ目盛りでも効果音より小さめに出す。
export const BGM_HEADROOM = 0.7;
export function sfxGain(volume) {
  const v = normalizeVolume(volume, DEFAULT_SFX_VOLUME) / 100;
  return v * v;
}
export function bgmGain(volume) {
  const v = normalizeVolume(volume, DEFAULT_BGM_VOLUME) / 100;
  return v * v * BGM_HEADROOM;
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
