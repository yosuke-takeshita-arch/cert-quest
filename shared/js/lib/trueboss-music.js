// 真ボスの曲と効果音の「楽譜」。作りは bossmusic.js と同じ（矩形波・三角波。音のファイルもライセンスも要らない）。
// ここは楽譜を音の並びにするだけ。ブラウザには触らない（鳴らすのは audio.js）。
// この曲は、このアプリのために作った短い旋律。特定のゲームの曲の旋律・和音進行を写していない。
import { parseBars, noteFreq } from './bossmusic.js';

// ---- 第1・第2形態の曲（ニ短調・8小節をくり返す。章のボスの曲より少し速く、重い） ----
export const TRUE_THEME_BPM = 156;
export const TRUE_STEP_SEC = 60 / TRUE_THEME_BPM / 2; // 8分音符1つ

// 旋律（矩形波）。和音は Dm → Bb → C → A → Dm → Bb → Gm → A
export const TRUE_LEAD = [
  'D5 - F5 - A5 - G5 F5',
  'F5 - D5 - Bb5 - A5 F5',
  'E5 - G5 - C6 - Bb5 G5',
  'C#5 - E5 - A5 - G5 E5',
  'D5 F5 A5 D6 - - C6 A5',
  'Bb5 - A5 F5 D5 - F5 -',
  'G5 - Bb5 - D6 - C6 Bb5',
  'A5 - G5 - E5 - C#5 .',
];
// 低音（三角波）。根音と5度を8分で刻む
export const TRUE_BASS = [
  'D2 D2 A2 D2 D2 D2 A2 D2',
  'Bb1 Bb1 F2 Bb1 Bb1 Bb1 F2 Bb1',
  'C2 C2 G2 C2 C2 C2 G2 C2',
  'A1 A1 E2 A1 A1 A1 E2 A1',
  'D2 D2 A2 D2 D2 D2 A2 D2',
  'Bb1 Bb1 F2 Bb1 Bb1 Bb1 F2 Bb1',
  'G1 G1 D2 G1 G1 G1 D2 G1',
  'A1 A1 E2 A1 A1 A1 E2 A1',
];

// ---- 第3形態の曲（同じ和音で、さらに速く、細かい動きと伴奏の分散和音を足す） ----
export const TRUE_FINAL_BPM = 176;
export const TRUE_FINAL_STEP_SEC = 60 / TRUE_FINAL_BPM / 2;

export const TRUE_FINAL_LEAD = [
  'D5 F5 A5 D6 A5 F5 A5 D6',
  'Bb4 D5 F5 Bb5 F5 D5 F5 Bb5',
  'C5 E5 G5 C6 G5 E5 G5 C6',
  'A4 C#5 E5 A5 E5 C#5 E5 A5',
  'D6 - C6 A5 F5 A5 D6 -',
  'Bb5 - A5 F5 D5 F5 Bb5 -',
  'G5 - Bb5 D6 G6 - F6 D6',
  'A5 C#6 E6 A6 - - E6 .',
];
export const TRUE_FINAL_ARP = [
  'D4 F4 A4 F4 D4 F4 A4 F4',
  'Bb3 D4 F4 D4 Bb3 D4 F4 D4',
  'C4 E4 G4 E4 C4 E4 G4 E4',
  'A3 C#4 E4 C#4 A3 C#4 E4 C#4',
  'D4 F4 A4 F4 D4 F4 A4 F4',
  'Bb3 D4 F4 D4 Bb3 D4 F4 D4',
  'G3 Bb3 D4 Bb3 G3 Bb3 D4 Bb3',
  'A3 C#4 E4 C#4 A3 C#4 E4 C#4',
];

/**
 * 真ボスの曲1周ぶん（bossTheme() と同じ形）。voices: [{ wave, gain, events }]、loopSec: 1周の秒数。
 * form が 3 のときだけ、第3形態の曲（速く、声が3つ）。ほかは第1・第2形態の曲。
 */
export function trueBossTheme(form = 1) {
  if (form === 3) {
    const lead = parseBars(TRUE_FINAL_LEAD, TRUE_FINAL_STEP_SEC);
    const arp = parseBars(TRUE_FINAL_ARP, TRUE_FINAL_STEP_SEC);
    const bass = parseBars(TRUE_BASS, TRUE_FINAL_STEP_SEC);
    return {
      loopSec: lead.total,
      voices: [
        { wave: 'square', gain: 0.5, events: lead.events },
        { wave: 'square', gain: 0.2, events: arp.events },
        { wave: 'triangle', gain: 0.8, events: bass.events },
      ],
    };
  }
  const lead = parseBars(TRUE_LEAD, TRUE_STEP_SEC);
  const bass = parseBars(TRUE_BASS, TRUE_STEP_SEC);
  return {
    loopSec: lead.total,
    voices: [
      { wave: 'square', gain: 0.55, events: lead.events },
      { wave: 'triangle', gain: 0.8, events: bass.events },
    ],
  };
}

// ---- 効果音（効果音の設定に従う。SYNTH_SFX と同じ形：[{ wave, gain, t, dur, freq, to? }]） ----
const seq = (wave, gain, notes, step, len = 0.9) => notes.reduce((acc, n, i) => {
  if (n) acc.push({ wave, gain, t: i * step, dur: step * len, freq: noteFreq(n) });
  return acc;
}, []);

/**
 * evolve … 進化（低い唸りから、音が駆け上がる。約1.6秒）／skill … 技を使ってきた（低く不穏な2音）／
 * heal … 回復（やわらかく上る）／ending … エンディング（ゆっくり上って長く伸ばす。約5秒）
 */
// 進化のタメ用のプログラムの音（外部の素材が入るまでの代わり。素材が入ったら、これは「ファイルが読めないとき」の代わりになる）:
//  heartbeat … 低い鼓動（どん・どん）／ charge … 力をためる（上りつづける）／ impact … 大きな衝撃／ orb0〜orb12 … 光の玉が灯る（1つごとに音が高くなる）
const ORB_NOTES = ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6', 'A6', 'B6', 'D7', 'E7', 'F#7'];
const ORB_SFX = Object.fromEntries(ORB_NOTES.map((n, i) => ['orb' + i, [
  { wave: 'square', gain: 0.35, t: 0, dur: 0.32, freq: noteFreq(n) },
  { wave: 'triangle', gain: 0.6, t: 0, dur: 0.32, freq: noteFreq(n) / 2 },
]]));

export const TRUE_SFX = {
  ...ORB_SFX,
  heartbeat: [
    { wave: 'triangle', gain: 0.95, t: 0, dur: 0.14, freq: noteFreq('D2'), to: noteFreq('A1') },
    { wave: 'triangle', gain: 0.8, t: 0.17, dur: 0.16, freq: noteFreq('D2'), to: noteFreq('A1') },
  ],
  charge: [
    { wave: 'square', gain: 0.3, t: 0, dur: 3.0, freq: noteFreq('D3'), to: noteFreq('D6') },
    { wave: 'triangle', gain: 0.8, t: 0, dur: 3.0, freq: noteFreq('D2'), to: noteFreq('D4') },
  ],
  impact: [
    { wave: 'triangle', gain: 1, t: 0, dur: 0.9, freq: noteFreq('D2'), to: noteFreq('D1') },
    { wave: 'square', gain: 0.5, t: 0, dur: 0.4, freq: noteFreq('A5'), to: noteFreq('A2') },
    { wave: 'square', gain: 0.35, t: 0.05, dur: 1.2, freq: noteFreq('D5'), to: noteFreq('D4') },
  ],
  evolve: [
    { wave: 'triangle', gain: 0.9, t: 0, dur: 0.9, freq: noteFreq('D2'), to: noteFreq('D3') },
    { wave: 'square', gain: 0.4, t: 0.1, dur: 0.8, freq: noteFreq('A2'), to: noteFreq('A3') },
    ...seq('square', 0.5, ['D4', 'F4', 'A4', 'D5', 'F5', 'A5'], 0.09).map((e) => ({ ...e, t: e.t + 0.9 })),
    { wave: 'square', gain: 0.5, t: 1.44, dur: 0.3, freq: noteFreq('D6') },
  ],
  skill: [
    { wave: 'square', gain: 0.5, t: 0, dur: 0.22, freq: noteFreq('D3'), to: noteFreq('Bb2') },
    { wave: 'square', gain: 0.5, t: 0.26, dur: 0.4, freq: noteFreq('A2'), to: noteFreq('E2') },
    { wave: 'triangle', gain: 0.9, t: 0, dur: 0.66, freq: noteFreq('D2'), to: noteFreq('A1') },
  ],
  heal: [
    ...seq('square', 0.4, ['A4', 'C#5', 'E5', 'A5'], 0.07),
    { wave: 'triangle', gain: 0.7, t: 0, dur: 0.4, freq: noteFreq('A3') },
  ],
  ending: [
    ...seq('square', 0.5, ['D5', 'F5', 'A5', 'D6'], 0.22),
    { wave: 'square', gain: 0.5, t: 0.9, dur: 0.5, freq: noteFreq('Bb5') },
    { wave: 'square', gain: 0.5, t: 1.45, dur: 0.5, freq: noteFreq('A5') },
    { wave: 'square', gain: 0.5, t: 2.0, dur: 0.5, freq: noteFreq('G5') },
    { wave: 'square', gain: 0.5, t: 2.55, dur: 2.4, freq: noteFreq('D6') },
    { wave: 'square', gain: 0.35, t: 2.55, dur: 2.4, freq: noteFreq('F6') },
    { wave: 'square', gain: 0.3, t: 2.55, dur: 2.4, freq: noteFreq('A5') },
    { wave: 'triangle', gain: 0.9, t: 0, dur: 0.9, freq: noteFreq('D3') },
    { wave: 'triangle', gain: 0.9, t: 0.9, dur: 1.65, freq: noteFreq('G2') },
    { wave: 'triangle', gain: 0.9, t: 2.55, dur: 2.4, freq: noteFreq('D3') },
  ],
};
