// 真ボスの絵の上の位置（アプリごと）。DOM は触らない。数は絵（512×512）の幅・高さに対する割合（%。顔の中心だけ 0〜1）。
// DX・AIパスポートは、絵が届くまで config.json の trueBoss を false にしてある（記号の絵のまま公開しないため）。絵が届いて下の値を測り直したら、門番が true にする（要件定義書 §3-9『作る順』）。
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
  // DX（ヘンカクジン）。絵（true-1〜3.webp、512px）から測った値（2026-10-24）。
  //   顔: 形態ごとの頭の中心（第1形態は箱の頭の画面の中、第2形態は箱の頭、第3形態は暗い顔の中心）
  //   核: 第1形態の胸の六角形の核（水色の六角形の中心）。目: 四角い目が2つ（楕円2つをまとめて光らせる）
  //   ひび: 核から体の上へ（下へ2本・肩へ2本）。玉: 第2形態の頭のうしろの光の輪の玉13個（左下から時計まわり。いちばん下の2個は肩のうしろに半分隠れているので、見えている部分の位置）
  'dx-biz': Object.freeze({
    face: Object.freeze({ 1: Object.freeze({ x: 0.495, y: 0.145 }), 2: Object.freeze({ x: 0.5, y: 0.142 }), 3: Object.freeze({ x: 0.5, y: 0.185 }) }),
    core: Object.freeze({ x: 49.8, y: 34.5 }),
    eye: Object.freeze([Object.freeze({ x: 44.8, y: 15.9, rx: 2.1, ry: 2.3 }), Object.freeze({ x: 53.0, y: 15.9, rx: 2.1, ry: 2.3 })]),
    cracks: Object.freeze([
      'M49.8 34.5 L46 40 L48 45 L42 50 L44 55 L39 60',
      'M49.8 34.5 L54 40 L52 46 L58 51 L56 56 L61 61',
      'M49.8 34.5 L44 31 L40 33 L34 30 L28 34',
      'M49.8 34.5 L55.5 31 L59 33 L65 30 L71 34',
    ]),
    orbs: Object.freeze([
      { x: 44.6, y: 20.9, r: 1.3 }, { x: 41.5, y: 19.6, r: 1.5 }, { x: 39.3, y: 16.2, r: 1.5 }, { x: 38.9, y: 12.0, r: 1.5 }, { x: 40.4, y: 7.8, r: 1.5 },
      { x: 44.4, y: 4.5, r: 1.5 }, { x: 49.9, y: 3.3, r: 1.5 }, { x: 55.3, y: 4.5, r: 1.5 }, { x: 59.4, y: 7.7, r: 1.5 }, { x: 61.0, y: 12.0, r: 1.5 },
      { x: 60.5, y: 16.1, r: 1.5 }, { x: 58.5, y: 19.7, r: 1.5 }, { x: 55.3, y: 20.9, r: 1.3 },
    ].map((o) => Object.freeze(o))),
  }),
  'ai-passport': Object.freeze({ ...G_KENTEI, orbs: ringOrbs(5, 49.8, 12.5, 8.5, 7.3, 2) }),
});

/** アプリの id から位置の表を選ぶ。表が無いアプリは G検定の値。 */
export function trueGeom(appId) {
  return Object.prototype.hasOwnProperty.call(TRUE_GEOM, appId) ? TRUE_GEOM[appId] : TRUE_GEOM['g-kentei'];
}
