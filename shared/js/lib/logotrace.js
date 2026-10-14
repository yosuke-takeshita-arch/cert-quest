// タイトルのロゴの「決めた部分だけ」を光の粒がたどる演出の、形と時間割り。純粋な関数だけ。
// 2026-10-15 先生「ディープの塔、羽、剣の周囲だけ光が回り、剣のところで最後強めに光って終わってほしい」。
// どこを通るかは絵ごとに違うので config.json の titleLogoTrace に書く（views/title.js が読む）:
//   { "parts": [ [[x, y], …], … ],  … 通る線。絵の画素（ロゴ画像の実寸）の座標。この順に1本ずつたどる
//     "flash": [x, y] }             … 最後の線をたどり終えたところで、ここを強く光らせる
// 書いていないアプリは、これまでどおり絵の外まわりを一周する（lib/outline.js）。

/** config.titleLogoTrace が使える形か。線は2点以上、座標は 0 以上の数 */
export function validTrace(t) {
  const pt = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0);
  return !!t && Array.isArray(t.parts) && t.parts.length > 0
    && t.parts.every((line) => Array.isArray(line) && line.length >= 2 && line.every(pt))
    && (t.flash === undefined || pt(t.flash));
}

/** 点の列を k 倍して、開いた SVG の path（d 属性）にする */
export function partPath(points, k = 1) {
  const f = (v) => Math.round(v * k * 10) / 10;
  return 'M' + points.map(([x, y]) => f(x) + ' ' + f(y)).join('L');
}

/** 折れ線の長さ */
export function lineLength(points) {
  let s = 0;
  for (let i = 1; i < points.length; i++) s += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return s;
}

/**
 * 時間割り（秒）。lead 秒待ってから、粒の頭は同じ速さ（speed＝長さ/秒）で、線を1本ずつ順にたどる。線と線のあいだは gap 秒あける。
 * 最後の線の終わりで光らせ（flashAt）、flash 秒光ってから rest 秒休んで、また始めに戻る（cycle）。
 * 返す parts[i] = { start, end } … 頭が線の始めを出る時刻と、終わりに着く時刻
 */
export function traceSchedule(lengths, { speed, lead = 0, gap = 0, flash = 0, rest = 0 }) {
  const parts = [];
  let t = lead;
  lengths.forEach((len, i) => {
    if (i) t += gap;
    parts.push({ start: t, end: t + len / speed });
    t += len / speed;
  });
  return { parts, flashAt: t, cycle: t + flash + rest };
}
