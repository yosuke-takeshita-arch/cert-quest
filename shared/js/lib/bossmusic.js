// ボス戦の曲と効果音の「楽譜」。プログラムで鳴らす昔のゲーム機風の音（矩形波・三角波）なので、音のファイルもそのライセンスも要らない。
// ここは楽譜を音の並び（いつ・どれだけ・何Hz・どの波）にするだけ。ブラウザには触らない（鳴らすのは audio.js）。
// 曲もファンファーレも、このアプリのために作った短い旋律。特定のゲームの曲の旋律・和音進行を写していない。

/** 音名（'A4'・'C#5'・'Bb3'）→ 周波数（Hz）。A4=440。読めなければ null。 */
export function noteFreq(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(String(name));
  if (!m) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  const midi = (Number(m[3]) + 1) * 12 + base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * 小節の並びを音の並びにする。bars は小節ごとの文字列の配列で、1小節は空白で区切った8つの拍（8分音符）。
 *   'A4' … その音を鳴らす／'-' … 前の音を伸ばす／'.' … 休み
 * stepSec は8分音符1つの秒数。戻り値は { events: [{ t, dur, freq }], total }（total は全部の長さ。秒）。
 */
export function parseBars(bars, stepSec) {
  const events = [];
  let cur = null;
  let n = 0;
  for (const bar of bars) {
    for (const tok of String(bar).trim().split(/\s+/)) {
      if (tok === '-') {
        if (cur) cur.dur += stepSec;
      } else if (tok === '.') {
        cur = null;
      } else {
        cur = { t: n * stepSec, dur: stepSec, freq: noteFreq(tok) };
        events.push(cur);
      }
      n++;
    }
  }
  return { events, total: n * stepSec };
}

// ---- ボス戦の曲（短調・8小節をくり返す） ----
export const BOSS_THEME_BPM = 148;
export const BOSS_STEP_SEC = 60 / BOSS_THEME_BPM / 2; // 8分音符1つ

// 旋律（矩形波）。和音は Am → F → G → E → Am → F → Dm → E
export const THEME_LEAD = [
  'A4 - C5 - E5 - D5 C5',
  'C5 - A4 - F5 - E5 C5',
  'B4 - D5 - G5 - F5 D5',
  'G#4 - B4 - E5 - D5 B4',
  'A4 C5 E5 A5 - - G5 E5',
  'F5 - E5 C5 A4 - C5 -',
  'D5 - F5 - A5 - G5 F5',
  'E5 - D5 - B4 - G#4 .',
];
// 低音（三角波）。根音と5度を8分で刻む
export const THEME_BASS = [
  'A2 A2 E3 A2 A2 A2 E3 A2',
  'F2 F2 C3 F2 F2 F2 C3 F2',
  'G2 G2 D3 G2 G2 G2 D3 G2',
  'E2 E2 B2 E2 E2 E2 B2 E2',
  'A2 A2 E3 A2 A2 A2 E3 A2',
  'F2 F2 C3 F2 F2 F2 C3 F2',
  'D2 D2 A2 D2 D2 D2 A2 D2',
  'E2 E2 B2 E2 E2 E2 B2 E2',
];

/** 曲1周ぶん。voices: [{ wave, gain, events }]、loopSec: 1周の秒数。 */
export function bossTheme() {
  const lead = parseBars(THEME_LEAD, BOSS_STEP_SEC);
  const bass = parseBars(THEME_BASS, BOSS_STEP_SEC);
  return {
    loopSec: lead.total,
    voices: [
      { wave: 'square', gain: 0.55, events: lead.events },
      { wave: 'triangle', gain: 0.8, events: bass.events },
    ],
  };
}

// ---- 効果音（BGM ではなく効果音の設定に従う） ----
const seq = (wave, gain, notes, step, len = 0.9) => notes.reduce((acc, n, i) => {
  if (n) acc.push({ wave, gain, t: i * step, dur: step * len, freq: noteFreq(n) });
  return acc;
}, []);

/**
 * 効果音の名前 → 音の並び（[{ wave, gain, t, dur, freq, to? }]）。to があれば、その周波数まで滑らせる。
 *  fanfare … 勝利のファンファーレ（約2.4秒）／appear … ボスの登場（低い下り）／crit … 会心の一撃（上る短い音）／defeatBlink … 撃破の点滅の合図
 */
export const SYNTH_SFX = {
  fanfare: [
    ...seq('square', 0.6, ['G4', 'C5', 'E5', 'G5'], 0.11),
    { wave: 'square', gain: 0.6, t: 0.55, dur: 0.22, freq: noteFreq('E5') },
    { wave: 'square', gain: 0.6, t: 0.8, dur: 0.22, freq: noteFreq('G5') },
    { wave: 'square', gain: 0.6, t: 1.05, dur: 1.2, freq: noteFreq('C6') },
    { wave: 'square', gain: 0.4, t: 1.05, dur: 1.2, freq: noteFreq('E5') },
    { wave: 'triangle', gain: 0.9, t: 0, dur: 0.5, freq: noteFreq('C3') },
    { wave: 'triangle', gain: 0.9, t: 0.55, dur: 0.45, freq: noteFreq('G2') },
    { wave: 'triangle', gain: 0.9, t: 1.05, dur: 1.2, freq: noteFreq('C3') },
  ],
  appear: [
    { wave: 'square', gain: 0.5, t: 0, dur: 0.5, freq: noteFreq('E3'), to: noteFreq('A2') },
    { wave: 'triangle', gain: 0.9, t: 0, dur: 0.6, freq: noteFreq('A2'), to: noteFreq('A1') },
    { wave: 'square', gain: 0.35, t: 0.5, dur: 0.4, freq: noteFreq('A3'), to: noteFreq('A2') },
  ],
  crit: [
    ...seq('square', 0.55, ['C5', 'E5', 'G5', 'C6'], 0.05),
    { wave: 'square', gain: 0.5, t: 0.22, dur: 0.3, freq: noteFreq('C6'), to: noteFreq('C7') },
  ],
  hit: [
    { wave: 'square', gain: 0.55, t: 0, dur: 0.09, freq: noteFreq('A4'), to: noteFreq('A3') },
    { wave: 'square', gain: 0.45, t: 0.09, dur: 0.12, freq: noteFreq('E4'), to: noteFreq('E3') },
  ],
};

/** 効果音の長さ（秒）。 */
export function sfxLength(name) {
  const ev = SYNTH_SFX[name] || [];
  return ev.reduce((m, e) => Math.max(m, e.t + e.dur), 0);
}
