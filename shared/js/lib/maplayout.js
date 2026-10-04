// 冒険の地図の「道の形」と「章の印の位置」の計算。純粋な関数だけ（画面の部品は views/home.js の renderMap）。
// 下が最初の章、上へ進むほど後の章。座標は次の約束:
//   x … 地図の幅に対する割合（0〜1）。道と印は、幅に合わせて横に広がる
//   y … 地図の上端からの距離を rem で表したもの。文字の大きさの設定（html の font-size）に合わせて一緒に伸び縮みする
// 印どうしの縦の間隔は、印の大きさより必ず広い（tests/maplayout.test.js が確かめる）。
// 背景の絵の物の位置には合わせない。絵の縦の長さに合わせて均等に配るだけ（絵に道や印は描かない）。

/** 地図の表示。map＝冒険の地図、list＝これまでの一覧。初期は地図。 */
export const MAP_VIEWS = ['map', 'list'];
export const DEFAULT_MAP_VIEW = 'map';

/** 保存されていた値を、選べる表示に直す。古い記録（無い）・ありえない値は地図。 */
export function normalizeMapView(v) {
  return typeof v === 'string' && MAP_VIEWS.includes(v) ? v : DEFAULT_MAP_VIEW;
}

/** 章の印（丸）の直径（rem）。CSS の .map-dot と同じ値。 */
export const MAP_DOT = 4.5;
/** 章と章の縦の間隔（rem）。印の横に出す名札（名前・問題数・星・習熟）が2〜3行になっても重ならない広さ。 */
export const MAP_STEP = 9.5;
/** 道の左右の幅。印は、左の道筋（MAP_LANES[0]）と右の道筋（MAP_LANES[1]）を交互に通る。名札が印の内側（中央側）に出るので、中央を空けておく。 */
export const MAP_LANES = [0.28, 0.72];
/** 道筋からのゆらぎ（割合）。道を一直線に見せないための小さなずれ。 */
export const MAP_WOBBLE = 0.04;
/** 一番下の余白（最初の見出しの下）。 */
export const MAP_BOTTOM = 3;
/** 分野の見出しの札が、直前の印からどれだけ上に出るか（rem）。 */
export const MAP_LABEL_GAP = 7;
/** 分野の見出しの札から、その分野の最初の印まで（rem）。札の高さと、印の半径を足した広さ。 */
export const MAP_LABEL_TO_NODE = 7.5;
/** 一番上の余白（最後の印の上）。 */
export const MAP_TOP = 5;

const round = (n) => Math.round(n * 100) / 100;

/**
 * 印の位置を決める。
 * groups: 分野（大項目）ごとの章の数 [{ count }, ...]（下の分野から順）。章が0の分野は見出しも出さない。
 * 返すもの:
 *   height … 地図全体の高さ（rem）
 *   nodes  … [{ index, group, x, y, side }]（index は 0 始まりの通し番号。最初の章が一番下。side は名札を出す側 'right'|'left'）
 *   labels … [{ group, y }]（分野の見出しの札。中央に置く）
 *   path   … 道の SVG パス。x は 0〜100（幅の割合×100）、y は rem
 *   viewBox … SVG の viewBox（'0 0 100 height'）
 */
export function mapLayout(groups) {
  const list = Array.isArray(groups) ? groups : [];
  // 下から積む（d＝地図の下端からの距離）
  let d = MAP_BOTTOM;
  let index = 0;
  const rawNodes = [];
  const rawLabels = [];
  list.forEach((g, gi) => {
    const count = g && Number.isInteger(g.count) && g.count > 0 ? g.count : 0;
    if (!count) return;
    d += index === 0 ? 1 : MAP_LABEL_GAP; // 最初の見出しは地図の底の近く
    rawLabels.push({ group: gi, d });
    d += MAP_LABEL_TO_NODE;
    for (let k = 0; k < count; k++) {
      if (k > 0) d += MAP_STEP;
      const lane = MAP_LANES[index % 2];
      const x = round(lane + (index % 2 === 0 ? 1 : -1) * MAP_WOBBLE * Math.sin(index * 1.7));
      rawNodes.push({ index, group: gi, x, d, side: index % 2 === 0 ? 'right' : 'left' });
      index++;
    }
  });
  const top = rawNodes.length ? d + MAP_TOP : MAP_BOTTOM + MAP_TOP;
  const height = round(Math.max(top, MAP_BOTTOM + MAP_TOP));
  const nodes = rawNodes.map((n) => ({ index: n.index, group: n.group, x: n.x, y: round(height - n.d), side: n.side }));
  const labels = rawLabels.map((l) => ({ group: l.group, y: round(height - l.d) }));
  return { height, nodes, labels, path: roadPath(nodes, height), viewBox: '0 0 100 ' + height };
}

// 印の中心を、なめらかな曲線（Catmull-Rom を3次ベジェに直したもの）でつなぐ。前後に、中央の「道の入口と出口」を足す。
function roadPath(nodes, height) {
  if (!nodes.length) return '';
  const pts = [{ x: 50, y: height - 0.5 }, ...nodes.map((n) => ({ x: round(n.x * 100), y: n.y })), { x: 50, y: 0.5 }];
  let p = 'M ' + pts[0].x + ' ' + pts[0].y;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    p += ' C ' + round(c1.x) + ' ' + round(c1.y) + ', ' + round(c2.x) + ' ' + round(c2.y) + ', ' + p2.x + ' ' + p2.y;
  }
  return p;
}
