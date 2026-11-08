// 真ボスの絵の上の位置（アプリごと）。DOM は触らない。数は絵（512×512）の幅・高さに対する割合（%。顔の中心だけ 0〜1）。
// DX・AIパスポートは、絵が届くまで config.json の trueBoss を false にしてある（記号の絵のまま公開しないため）。絵が届いて下の値を測り直したら、門番が true にする（要件定義書 §3-9『作る順』）。
// 絵を差し替えたら、そのアプリの値だけを測り直す（g-kentei のシンギュラは実測済み。dx-biz・ai-passport は絵が届くまでの仮の値）。
//   face   … 形態（1〜3）ごとの顔の中心。顔の丸の切り抜きに使う
//   core   … 第1形態の胸の核（ひびの起点）
//   eye    … 第1形態の目（ひびが入ったあと強く光る）。cx・cy・rx・ry
//   cracks … ひびの形（SVG の path。核から広がる4本。1本の文字列の中の1つ目の M〜が主線（太い）、2つ目以降の M〜が枝（細い）。本数は進化の時刻・音と1本ずつ対応するので4本のまま）
//   orbs   … 第2形態の頭のうしろの光の玉。第2→3の進化で1つずつ金色に灯る。数は絵の玉の数（G検定 13・DX 13・AIパスポート 5・ガードの砦 7）
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

// G検定のひび: 始まりは TRUE_CRACKS（胸の4本。先生『ピッタリ』）のまま、そこから体の端まで伸ばす。鎧の板の継ぎ目・歯車の前・盾や本の上は避け、体（青い鎧の面）を通す。右腕は盾に隠れているので、右肩の上まで。
const G_CRACKS = Object.freeze([
  'M49.7 37.5 L46 43 L48 48 L42 54 L44 60 L39 66 L41 70 Q43 73 42 77 L40 81 Q38 85 35.5 88 L33 91 L30 93.5 M48 48 L45 46 L43 48 ~M42 54 L38.5 55 L36.5 58 M41 70 L45 71 L47 73',
  'M49.7 37.5 L54 43 L52 49 L58 55 L56 61 L61 67 L59 70.5 L59.5 74 Q58.5 77 59.5 80.5 L62 84 Q64 87.5 66.5 90 L69 92.5 L72 95 M52 49 L55 47 L57 49 ~M58 55 L62 54 L64 56 M59.5 74 L63 75 ~M62 84 L67 83.5',
  'M49.7 37.5 L44 34 L40 37 L37 40.5 M14.5 48 Q11.5 52 11 58 L11.5 60 M44 34 L45 30 L44.5 27 L43.5 23 Q41.5 18.5 43 14 Q43.5 11.5 46 9.5 M40 37 L41 32 L40 28 ~M12 53 L10 51.5',
  'M49.7 37.5 L55 34 L59 37 L61.5 35.5 L61 31.5 L62 28 M55 34 L54.5 30 L55.5 27 L57 23 Q59 18.5 57.5 14 Q56.5 11.5 54 9.5 ~M59 37 L62 41 L65 46',
]);
// 割れ目の見た目（2026-11-08 先生『こんな感じのひび』）。mesh＝表面の細かい網目をおおう楕円と細かさ／tone＝色／noMesh＝網目を載せない持ち物・飾り（多角形 'x,y x,y …'、楕円 'e:cx,cy,rx,ry'）／shards＝欠けて落ちる破片 [x, y, 大きさ]
const G_LOOK = Object.freeze({
  mesh: Object.freeze({ cx: 50, cy: 52, rx: 47, ry: 46, cell: 0.075, seed: 37 }),
  tone: Object.freeze({ dark: '#0a0c16', rim: '#f6e7b4', glow: '#bfeaff', mesh: '#0a0c16', meshLight: '#f6e7b4', shard: '#202b48', rimW: 0.6, glowW: 0.34, glowO: 0.65 }),
  noMesh: Object.freeze(['21,40 31,38 38,45 35,56 28,66 22,64', '12,53 25,53 25,67 12,67', '65,40 70,36 78,32 90,38 97,55 95,72 86,79 76,76 66,66 64,52', '20,24 33,22 36,30 34,38 24,40 19,32', '61,25 72,20 82,25 84,34 76,40 62,37', '26,66 36,65 39,72 37,80 28,80 25,73', '61,66 72,65 75,72 73,80 63,80 60,73', 'e:49.9,19.7,4.4,2.8', 'e:36.9,20.2,3,3', 'e:37.2,15,3,3', 'e:39.6,10.4,3,3', 'e:44.2,7.6,3,3', 'e:49.6,6.4,3,3', 'e:55.1,7.6,3,3', 'e:59.6,10.5,3,3', 'e:62.1,15,3,3', 'e:62.3,20.2,3,3']),
  shards: Object.freeze([[17, 97, 1.7], [33, 99, 1.1], [66, 99, 1.2], [84, 97, 1.8]]),
});
const G_KENTEI = Object.freeze({ face: TRUE_FACE, core: TRUE_CORE, eye: TRUE_EYE, cracks: G_CRACKS, orbs: TRUE_ORBS, ...G_LOOK });

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
      // 2026-11-08 先生『絵の立体感にも合わせて』: 光は左上から。箱の縁・継ぎ目で向きを折り、丸い腕の板では面の丸みに沿って曲げ、輪郭に近づくほど間隔を詰める。
      // 描き方: 1本の文字列 = 主線（1つ目の M〜。太い）＋枝（2つ目以降の M〜。細い）＋『奥の枝』（~M〜。さらに細く薄い＝体の裏へ回る側・影の側）。曲線は Q（2次ベジェ）。
      //   1 本目＝左脚・左足（胸の箱の縁→下の箱の左の斜面→脚の板→足の指の溝）／2 本目＝右脚・右足（影側）／3 本目＝左肩・左の腕の輪（枝で頭の左の壁）／4 本目＝右肩・右の腕の輪（枝で頭の右の壁）
      'M49.8 34.5 L47 37.5 L45 40.5 L42 43 L43.5 46.5 L41 50 L38.5 53 L37 56 Q36 60 37.5 64 L40 66.5 Q42 70 40 73.5 L37.5 77 L35 80 L33.5 84 L30 85.5 L29.5 89 L31 92.5 L32 96 M41 50 L36.5 49 Q35 51 34.5 53.5 M40 66.5 L45 67.5 L47 69 ~M37 56 L34.5 57.5 L33 60 ~M35 80 L29 78 L26 80.5 M30 85.5 L25 86.5 L22 90',
      'M49.8 34.5 L52.5 37.5 L55 40.5 L58 43 L57 46.5 L59.5 50 Q61 52 60 54.5 L57 57 L58.5 60 L56 63.5 Q59 66 57.5 69 L55 72 L57 76 L60 80 L62.5 84 L65 85.5 L66.5 89 L64.5 92 L66 96 ~M59.5 50 L62 49 L64 51 M56 63.5 L51 64.5 L49 66.5 ~M57.5 69 L61 70 L63 73 M60 80 L66 79 L70 81.5 ~M65 85.5 L70 86 L73 89',
      'M49.8 34.5 L45 33.5 L41 31 L36.5 30.5 L32 29 L28 31.5 L24.5 35 L22.5 38.5 Q18 40 14 42.5 Q10 46 9.5 51 Q9 56 10 61 L10.5 63 M41 31 L42 28 L42.5 25 L40.5 22 L41.5 18.5 L40 14 L41 10 L42.5 7 L45 6.5 M28 31.5 L26 27 L28 24.5 ~M14 42.5 L13.5 46 L14 49.5 M22.5 38.5 L25 40 L27 41.5 ~M9.5 51 L12.5 54 L13.5 58',
      'M49.8 34.5 L54 33 L58 31.5 L62 31 L66.5 30.5 L70 28.5 L74 27 L77.5 29.5 L80 33 L80.5 36 M62 31 L61 27.5 L61.5 24.5 L60 22 L60.5 18 L59.5 14 L60 10 L58.5 7 L55.5 6.5 ~M70 28.5 L72 31 L74 34 M66.5 30.5 L65 36 L66.5 41 L65 47 L66.5 53',
    ]),
    // 割れ目の見た目: 網目をおおう楕円・色・網目を載せない持ち物（本・スタンプ・拳・背中の紙の束）・落ちる破片
    mesh: Object.freeze({ cx: 50, cy: 50, rx: 46, ry: 49, cell: 0.075, seed: 11 }),
    tone: Object.freeze({ dark: '#0b0a12', rim: '#d6dfec', glow: '#7fe8ff', mesh: '#0e0d16', meshLight: '#e8eef7', shard: '#4b5467' }),
    noMesh: Object.freeze(['67,34 87,33 92,37 92,60 75,64 68,62', '72,56 86,53 92,60 90,70 76,70', '15,44 26,43 29,50 32,58 30,66 20,67 15,58', '16,18 32,11 37,15 36,30 20,32', 'e:44.8,15.9,2.7,2.9', 'e:53,15.9,2.7,2.9']),
    shards: Object.freeze([[20, 96, 1.6], [34, 98, 1.1], [66, 98.5, 1.3], [79, 96, 1.8], [51, 99, 0.9]]),
    orbs: Object.freeze([
      { x: 44.6, y: 20.9, r: 1.3 }, { x: 41.5, y: 19.6, r: 1.5 }, { x: 39.3, y: 16.2, r: 1.5 }, { x: 38.9, y: 12.0, r: 1.5 }, { x: 40.4, y: 7.8, r: 1.5 },
      { x: 44.4, y: 4.5, r: 1.5 }, { x: 49.9, y: 3.3, r: 1.5 }, { x: 55.3, y: 4.5, r: 1.5 }, { x: 59.4, y: 7.7, r: 1.5 }, { x: 61.0, y: 12.0, r: 1.5 },
      { x: 60.5, y: 16.1, r: 1.5 }, { x: 58.5, y: 19.7, r: 1.5 }, { x: 55.3, y: 20.9, r: 1.3 },
    ].map((o) => Object.freeze(o))),
  }),
  // AIパスポート（アマツクリ）。絵（true-1〜3.webp、512px）から測った値（2026-10-24）。
  //   顔: 第1形態は丸い窓の中、第2・第3形態は丸い頭の中心。核: 第1形態の胸の丸い窓の中の星の中心。目: 三日月が2つ（楕円2つをグループにまとめて光らせる）
  //   ひび: 星の核から石の繭の体の上へ（下へ2本・肩へ2本。顔の窓には入れない）。玉: 第2形態の頭の上の5個。輪ではなく半円の弧（左下から時計まわり）
  'ai-passport': Object.freeze({
    face: Object.freeze({ 1: Object.freeze({ x: 0.5, y: 0.27 }), 2: Object.freeze({ x: 0.5, y: 0.19 }), 3: Object.freeze({ x: 0.5, y: 0.19 }) }),
    core: Object.freeze({ x: 50, y: 51.5 }),
    eye: Object.freeze([Object.freeze({ x: 41.9, y: 28.4, rx: 3.6, ry: 4.2 }), Object.freeze({ x: 57.9, y: 28.4, rx: 3.6, ry: 4.2 })]),
    cracks: Object.freeze([
      // 2026-11-08 先生『絵の立体感にも合わせて』: 光は左上から（左上が明るく、右下が影）。卵形の胴の球面に沿って、ヒビを外へふくらむ弧（Q）で回り込ませ、輪郭に近づくほど間隔を詰める。腕・脚は筒なので、輪の向き（金の縁のカーブ）に合わせて斜めに横切る。顔の窓の中には入れない。
      // 描き方: 1本の文字列 = 主線（1つ目の M〜。太い）＋枝（2つ目以降の M〜。細い）＋『奥の枝』（~M〜。さらに細く薄い＝体の裏へ回る側・影の側）。曲線は Q（2次ベジェ）。
      //   1 本目＝左脚・左のブーツ／2 本目＝右脚・右のブーツ（影側）／3 本目＝左腕の先の袖口（枝で左の胴の上へ）／4 本目＝右腕の先の袖口（枝で右の胴の上へ）
      'M50 51.5 L44.5 57 Q42 61 41.5 68 Q41 73 38.5 77 L37 79 Q36 83 35 86 L34 88 L34 92 M41.5 68 Q37 69 32.5 67.5 ~M38.5 77 L34 76 L31.5 78 ~M44.5 57 L41 56 L39 58',
      'M50 51.5 L55.5 58 Q59.5 63 60 69 Q60.5 74 60.5 77 L62 80 Q64 83 65.5 86 L66.5 88.5 L68 91 ~M60 69 Q64 70 67.5 69 ~M65.5 86 L69 85 L71 86.5',
      'M50 51.5 L44 49.5 Q38 47.5 33 47 L28 47 Q22 50 18.5 54 L16.5 58 Q14 61 14.5 63.5 M33 47 L31 42 Q29.5 39 28 36 ~M22 50 L19.5 45.5 L18 42 ~M18.5 54 L21 56 L23.5 58 M28 47 L26 51 L26.5 55',
      'M50 51.5 Q56 49 62 47.5 Q68 46.5 73 48 L76 49.5 Q80.5 52 83 56.5 Q85.5 60 86 64 M62 47.5 L64 42 Q66 38 68 34 ~M83 56.5 L80 59 L78 62 ~M73 48 L74 52 L73.5 56 ~M76 49.5 L78 46 L80 44.5',
    ]),
    // 割れ目の見た目: 顔の窓と胸の星の窓には網目を載せない
    mesh: Object.freeze({ cx: 50, cy: 48, rx: 42, ry: 44, cell: 0.075, seed: 23 }),
    tone: Object.freeze({ dark: '#12121c', rim: '#f3f1ff', glow: '#ffe08a', mesh: '#14141f', meshLight: '#f3f1ff', shard: '#7d8499' }),
    noMesh: Object.freeze(['e:49,27,19,15.5', 'e:50,50.5,10.5,10.5']),
    shards: Object.freeze([[26, 96, 1.6], [40, 97, 1.1], [62, 97, 1.2], [75, 96, 1.7]]),
    orbs: Object.freeze([
      { x: 37.4, y: 21.0, r: 2.6 }, { x: 39.1, y: 11.2, r: 2.6 }, { x: 50.0, y: 6.4, r: 2.6 }, { x: 60.7, y: 11.2, r: 2.6 }, { x: 62.6, y: 21.0, r: 2.6 },
    ].map((o) => Object.freeze(o))),
  }),
  // ガードの砦（ヒソミカゲ）。絵（true-1〜3.webp、512px）から測った値（2026-11-02）。
  //   顔: 第1形態は兜の中心、第2形態は影の頭巾の中心、第3形態は冠の下の顔の中心。核: 第1形態の胸当ての鍵穴の形の核。目: 兜の面頬のすきまの青緑の目が2つ（楕円2つをまとめて光らせる）
  //   ひび: 核から鎧の体の上へ（下へ2本・肩へ2本。兜の中には入れない）。玉: 第2形態の頭のうしろの7個。半円の弧（左下から時計まわり）
  'sc': Object.freeze({
    face: Object.freeze({ 1: Object.freeze({ x: 0.5, y: 0.17 }), 2: Object.freeze({ x: 0.5, y: 0.17 }), 3: Object.freeze({ x: 0.5, y: 0.2 }) }),
    core: Object.freeze({ x: 50.1, y: 32.2 }),
    eye: Object.freeze([Object.freeze({ x: 47.3, y: 19.0, rx: 1.3, ry: 1.0 }), Object.freeze({ x: 52.5, y: 19.0, rx: 1.3, ry: 1.0 })]),
    cracks: Object.freeze([
      'M50.1 32.2 L46 38 L48 43 L43 48 L45 53 L40 58',
      'M50.1 32.2 L54 38 L52 44 L57 49 L55 54 L60 59',
      'M50.1 32.2 L45 30 L41 32 L35 29 L30 33',
      'M50.1 32.2 L55 30 L59 32 L65 29 L70 33',
    ]),
    // 2026-11-08 先生決定 A: ヒソミカゲは鎧を割らず、すきまから影が染み出す（第1→2の型 seep。要件定義書 §3-9）。cracks は使われないが、型を crack に戻せるよう残す。
    //   煙の出る場所（true-1.webp を測った値。1か所ずつ増える）: 面頬のすきま・胸の鍵穴・右肩当ての下のすきま・左ひざの継ぎ目。dx＝煙が上へ立ちのぼりながら横へ流れる量（省略は0。面頬の煙は、光る目をふさがないよう右へ流す）
    evo1: 'seep',
    seeps: Object.freeze([{ x: 51.5, y: 22.2, dx: 9 }, { x: 50.1, y: 32.2 }, { x: 61.5, y: 32.4 }, { x: 42.2, y: 78.3 }].map((p) => Object.freeze(p))),
    orbs: Object.freeze([
      { x: 35.5, y: 17.5, r: 1.7 }, { x: 37.0, y: 11.8, r: 1.7 }, { x: 42.0, y: 7.2, r: 1.7 }, { x: 49.8, y: 5.4, r: 1.7 },
      { x: 57.6, y: 7.2, r: 1.7 }, { x: 62.5, y: 11.8, r: 1.7 }, { x: 64.1, y: 17.5, r: 1.7 },
    ].map((o) => Object.freeze(o))),
  }),
});

/** 第1→2の進化の型。'seep'（染み出す）は表に evo1: 'seep' と seeps（煙の場所が1つ以上）があるアプリだけ。それ以外は 'crack'（割れる）。 */
export function evo1Type(geom) {
  return geom && geom.evo1 === 'seep' && Array.isArray(geom.seeps) && geom.seeps.length > 0 ? 'seep' : 'crack';
}

/** アプリの id から位置の表を選ぶ。表が無いアプリは G検定の値。 */
export function trueGeom(appId) {
  return Object.prototype.hasOwnProperty.call(TRUE_GEOM, appId) ? TRUE_GEOM[appId] : TRUE_GEOM['g-kentei'];
}

// ---- ひびの形づくり（2026-11-08 先生『こんな感じのひび』。割れ目＝先細りの幅のある隙間／表面の細かい網目）。DOM は触らない。決まった乱数なので、毎回同じ形になる ----
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r2 = (v) => Math.round(v * 100) / 100;

/** ひび1本分の path（M・L・Q。先頭の ~ は外す）を、折れ線の点の列にする。 */
export function samplePath(d) {
  const out = [];
  for (const m of String(d).replace(/^~/, '').matchAll(/([MLQ])\s*(-?[\d.]+)\s+(-?[\d.]+)(?:\s+(-?[\d.]+)\s+(-?[\d.]+))?/g)) {
    if (m[1] === 'Q' && out.length) {
      const p0 = out[out.length - 1]; const c = [Number(m[2]), Number(m[3])]; const p1 = [Number(m[4]), Number(m[5])];
      for (let i = 1; i <= 6; i++) { const t = i / 6; out.push([(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]]); }
    } else out.push([Number(m[2]), Number(m[3])]);
  }
  return out;
}

function resample(pts, maxSeg) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]; const b = pts[i]; const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxSeg));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/**
 * ひび1本（主線か枝）を、先細りの『幅のある隙間』にする。d … 中心線の path。w0 … 根もとの幅（絵の%）。seed … 縁のでこぼこの種。
 * 戻り値: gap（隙間の多角形の path）・rim（光が当たる側＝右下の縁の折れ線の path）・center（中心線の折れ線の path。中の弱い光に使う）。
 * 幅は根もと（核）から先へ向かって細くなり、先端はほぼ0。縁は左右とも不揃い。
 */
export function crackShape(d, w0, seed) {
  const pts = resample(samplePath(d), 1.3);
  const n = pts.length;
  const rnd = mulberry(seed);
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = cum[n - 1] || 1;
  const L = []; const R = []; let side = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0]; const ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl; const ny = tx / tl;
    side += nx + ny;
    const t = cum[i] / len;
    const base = w0 * (1 - 0.9 * Math.pow(t, 0.75));
    const wl = (base * (0.3 + 0.55 * rnd())) / 1; const wr = (base * (0.3 + 0.55 * rnd())) / 1;
    L.push([pts[i][0] + nx * wl, pts[i][1] + ny * wl]); R.push([pts[i][0] - nx * wr, pts[i][1] - ny * wr]);
  }
  const f = (p) => r2(p[0]) + ' ' + r2(p[1]);
  const gap = 'M' + L.map(f).join(' L') + ' L' + R.slice().reverse().map(f).join(' L') + 'Z';
  const lit = side >= 0 ? L : R; // 右下を向く側の縁
  return { gap, rim: 'M' + lit.map(f).join(' L'), center: 'M' + pts.map(f).join(' L') };
}

function distToPoly(px, py, poly) {
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const ax = poly[i - 1][0]; const ay = poly[i - 1][1]; const dx = poly[i][0] - ax; const dy = poly[i][1] - ay;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

/**
 * 表面の細かい網目（不揃いな多角形のかけら）。蜂の巣の格子を、球の表面のように写す（端へ行くほど間隔がつまる）。
 * m … { cx, cy, rx, ry（体をおおう楕円。絵の%）, cell（かけらの大きさ。0〜1の座標）, seed }。cracks … 割れ目4本の path（各本の中の ~ や M は枝）。
 * 戻り値: 4つの段（割れ目1〜4本目が入る時刻に出る）ごとの path の d。各辺は、いちばん近い割れ目の番号の段に入る（割れ目のまわりから広がる）。
 */
export function crackMesh(m, cracks) {
  const rnd = mulberry(m.seed);
  const polys = cracks.map((d) => String(d).split(/\s+(?=~?M)/).map((q) => resample(samplePath(q), 3)));
  const s = m.cell; const h = (Math.sqrt(3) / 2) * s;
  const verts = new Map(); const edges = [];
  const key = (x, y) => Math.round(x * 50) + ',' + Math.round(y * 50);
  const vert = (x, y) => { const k = key(x, y); if (!verts.has(k)) verts.set(k, [x + (rnd() - 0.5) * s * 0.55, y + (rnd() - 0.5) * s * 0.55]); return verts.get(k); };
  const N = Math.ceil(1.3 / s) + 1;
  for (let row = -N; row <= N; row++) {
    for (let col = -N; col <= N; col++) {
      const cx = col * 2 * h + (Math.abs(row) % 2 ? h : 0);
      const cy = row * 1.5 * s;
      const cs = [];
      for (let k = 0; k < 6; k++) { const a = (Math.PI / 180) * (60 * k - 30); cs.push(vert(cx + s * Math.cos(a), cy + s * Math.sin(a))); }
      for (let k = 0; k < 6; k++) edges.push([cs[k], cs[(k + 1) % 6]]);
    }
  }
  const stages = [[], [], [], []]; const seen = new Set();
  for (const [a, b] of edges) {
    const id = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? a.join() + '|' + b.join() : b.join() + '|' + a.join();
    if (seen.has(id)) continue; seen.add(id);
    if (Math.abs(a[0]) > 1 || Math.abs(a[1]) > 1 || Math.abs(b[0]) > 1 || Math.abs(b[1]) > 1) continue;
    if (rnd() < 0.1) continue; // ところどころ途切れる
    const P = (v) => [m.cx + m.rx * Math.sin((v[0] * Math.PI) / 2), m.cy + m.ry * Math.sin((v[1] * Math.PI) / 2)];
    const pa = P(a); const pb = P(b);
    const mx = (pa[0] + pb[0]) / 2 + (rnd() - 0.5) * 0.9; const my = (pa[1] + pb[1]) / 2 + (rnd() - 0.5) * 0.9;
    let best = 0; let bd = Infinity;
    polys.forEach((parts, k) => { for (const p of parts) { const dd = distToPoly(mx, my, p); if (dd < bd) { bd = dd; best = k; } } });
    stages[best].push('M' + r2(pa[0]) + ' ' + r2(pa[1]) + ' L' + r2(mx) + ' ' + r2(my) + ' L' + r2(pb[0]) + ' ' + r2(pb[1]));
  }
  return stages.map((list) => list.join(' '));
}

/** 欠けて落ちる小さな破片。shards … [[x, y, 大きさ], ...]。戻り値は多角形の path の配列。 */
export function shardShapes(shards) {
  return shards.map((sh, i) => {
    const rnd = mulberry(100 + i); const pts = [];
    for (let k = 0; k < 5; k++) { const a = (Math.PI * 2 * k) / 5 + rnd() * 0.6; const rr = sh[2] * (0.55 + 0.7 * rnd()); pts.push(r2(sh[0] + rr * Math.cos(a)) + ' ' + r2(sh[1] + rr * 0.7 * Math.sin(a))); }
    return 'M' + pts.join(' L') + 'Z';
  });
}
