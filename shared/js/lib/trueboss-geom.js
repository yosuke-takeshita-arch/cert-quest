// 真ボスの絵の上の位置（アプリごと）。DOM は触らない。数は絵（512×512）の幅・高さに対する割合（%。顔の中心だけ 0〜1）。
// 絵を差し替えたら、そのアプリの値だけを測り直す（g-kentei のシンギュラは実測済み。dx-biz・ai-passport は絵が届くまでの仮の値）。
//   face   … 形態（1〜3）ごとの顔の中心。顔の丸の切り抜きに使う
//   core   … 第1形態の胸の核（ひびの起点）
//   eye    … 第1形態の目（ひびが入ったあと強く光る）。cx・cy・rx・ry
//   cracks … ひびの形（SVG の path。核から広がる4本）
//   orbs   … 第2形態の頭のうしろの光の玉。第2→3の進化で1つずつ金色に灯る。数は絵の玉の数（G検定 13・DX 13・AIパスポート 5）
import { TRUE_FACE, TRUE_CORE, TRUE_EYE, TRUE_CRACKS, TRUE_ORBS } from './trueboss-data.js';

const round1 = (v) => Math.round(v * 10) / 10;

/** 輪に並べた玉（仮の位置）。左下から時計まわりに n 個。中心 (cx, cy)・横の半径 rx・縦の半径 ry・玉の半径 r。 */
export function ringOrbs(n, cx, cy, rx, ry, r) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = ((135 + (360 * i) / n) * Math.PI) / 180; // 画面の下向きが +y。135度＝左下
    out.push(Object.freeze({ x: round1(cx + rx * Math.cos(a)), y: round1(cy + ry * Math.sin(a)), r }));
  }
  return Object.freeze(out);
}

const G_KENTEI = Object.freeze({ face: TRUE_FACE, core: TRUE_CORE, eye: TRUE_EYE, cracks: TRUE_CRACKS, orbs: TRUE_ORBS });

export const TRUE_GEOM = Object.freeze({
  'g-kentei': G_KENTEI,
  // 仮（絵が届いたら測り直す）。顔・核・目・ひびは G検定と同じ位置、玉は頭のうしろの輪に並べただけ
  'dx-biz': Object.freeze({ ...G_KENTEI, orbs: ringOrbs(13, 49.8, 13.3, 8.5, 7.3, 1.5) }),
  'ai-passport': Object.freeze({ ...G_KENTEI, orbs: ringOrbs(5, 49.8, 12.5, 8.5, 7.3, 2) }),
});

/** アプリの id から位置の表を選ぶ。表が無いアプリは G検定の値。 */
export function trueGeom(appId) {
  return Object.prototype.hasOwnProperty.call(TRUE_GEOM, appId) ? TRUE_GEOM[appId] : TRUE_GEOM['g-kentei'];
}
