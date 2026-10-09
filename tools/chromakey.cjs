// ボスの絵の背景（べた塗りのマゼンタ #FF00FF か、緑 #00FF00）を透過にして、指定の大きさの webp にする。
// 使い方: node chromakey.cjs <元の PNG> <出力 .webp> <一辺の画素数> [magenta|green]
// playwright-core と Chrome を使う（Chrome の canvas で処理する）。playwright-core が require できる場所で動かすこと。
// 2026-10-09、先生の提案「背景の色を、絶対に使わない色で指定して塗りつぶして生成してもらえればいい」。
// 市松模様の描き込みを当て推量で抜く tools/unchecker.cjs の代わり。
//
// やること:
//  1. 背景の色との近さ（キーの色の成分の強さ − ほかの成分）で、背景らしさを 0〜1 で出す
//  2. 背景らしさが高い画素は透過、境目は半透明にする（アンチエイリアスの縁）
//  3. 縁に残ったキーの色のかぶり（マゼンタなら赤と青が緑より強い）を抑える（デスピル）
const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  const [src, out, size, keyName = 'magenta'] = process.argv.slice(2);
  if (!src || !out || !size) throw new Error('使い方: node chromakey.cjs <元の PNG> <出力 .webp> <一辺の画素数> [magenta|green]');
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage();
  const mime = src.endsWith('.webp') ? 'image/webp' : 'image/png';
  const data = 'data:' + mime + ';base64,' + fs.readFileSync(src).toString('base64');
  const res = await p.evaluate(async ({ data, size, keyName }) => {
    const img = new Image(); img.src = data; await img.decode();
    const W = img.width, H = img.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const id = g.getImageData(0, 0, W, H); const d = id.data;
    let cleared = 0, partial = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], bb = d[i + 2];
      // キーの強さ: マゼンタは「赤と青の弱いほう − 緑」、緑は「緑 − 赤と青の強いほう」
      const k = keyName === 'green' ? gg - Math.max(r, bb) : Math.min(r, bb) - gg;
      const lo = 60, hi = 150; // この幅で 不透明 → 透過 になめらかに変わる
      let a = k <= lo ? 1 : k >= hi ? 0 : 1 - (k - lo) / (hi - lo);
      if (a < 1) {
        if (a === 0) cleared++; else partial++;
        // デスピル: キーの色のかぶりを抑える
        if (keyName === 'green') d[i + 1] = Math.min(gg, Math.max(r, bb));
        else { const m = Math.max(gg, Math.min(r, bb) - (Math.min(r, bb) - gg) * (1 - a)); d[i] = Math.min(r, m + (r - Math.min(r, bb))); d[i + 2] = Math.min(bb, m + (bb - Math.min(r, bb))); }
      }
      d[i + 3] = Math.round(d[i + 3] * a);
    }
    g.putImageData(id, 0, 0);
    const o = document.createElement('canvas'); o.width = o.height = size;
    const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(c, 0, 0, size, size);
    return { url: o.toDataURL('image/webp', 0.86), cleared: cleared / (W * H), partial: partial / (W * H) };
  }, { data, size: Number(size), keyName });
  fs.writeFileSync(out, Buffer.from(res.url.split(',')[1], 'base64'));
  console.log('透過', res.cleared.toFixed(3), '半透明の縁', res.partial.toFixed(4));
  await b.close();
})();
