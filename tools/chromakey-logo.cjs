// タイトルの文字の絵（ロゴ）の背景（べた塗りの緑 #00FF00 かマゼンタ #FF00FF）を透過にし、ロゴのまわりの余白を切って、横幅を指定した webp にする。
// 使い方: node chromakey-logo.cjs <元の PNG> <出力 .webp> <横幅の画素数> [green|magenta]
// tools/chromakey.cjs（ボス用。正方形に縮める）の横長版。背景の抜き方は同じ式。
// playwright-core と Chrome を使う。playwright-core が require できる場所で動かすこと。
// 2026-10-14 作成（G検定のロゴ「ディープの塔」。横3:2で余白が大きく、正方形に縮めると絵がゆがむため）。
const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  const [src, out, width, keyName = 'green'] = process.argv.slice(2);
  if (!src || !out || !width) throw new Error('使い方: node chromakey-logo.cjs <元の PNG> <出力 .webp> <横幅の画素数> [green|magenta]');
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage();
  const mime = src.endsWith('.webp') ? 'image/webp' : 'image/png';
  const data = 'data:' + mime + ';base64,' + fs.readFileSync(src).toString('base64');
  const res = await p.evaluate(async ({ data, width, keyName }) => {
    const img = new Image(); img.src = data; await img.decode();
    const W = img.width, H = img.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const id = g.getImageData(0, 0, W, H); const d = id.data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], bb = d[i + 2];
      const k = keyName === 'green' ? gg - Math.max(r, bb) : Math.min(r, bb) - gg;
      const lo = 60, hi = 150;
      const a = k <= lo ? 1 : k >= hi ? 0 : 1 - (k - lo) / (hi - lo);
      if (a < 1) {
        if (keyName === 'green') d[i + 1] = Math.min(gg, Math.max(r, bb));
        else { const m = Math.max(gg, Math.min(r, bb) - (Math.min(r, bb) - gg) * (1 - a)); d[i] = Math.min(r, m + (r - Math.min(r, bb))); d[i + 2] = Math.min(bb, m + (bb - Math.min(r, bb))); }
      }
      d[i + 3] = Math.round(d[i + 3] * a);
      if (d[i + 3] > 16) { const px = (i / 4) % W, py = Math.floor(i / 4 / W); if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
    }
    g.putImageData(id, 0, 0);
    // ロゴのまわりに、ロゴの幅の2%の余白を残して切る
    const pad = Math.round((x1 - x0) * 0.02);
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const ow = Math.min(width, cw), oh = Math.round(ch * ow / cw);
    const o = document.createElement('canvas'); o.width = ow; o.height = oh;
    const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(c, x0, y0, cw, ch, 0, 0, ow, oh);
    return { url: o.toDataURL('image/webp', 0.9), box: [x0, y0, cw, ch], out: [ow, oh] };
  }, { data, width: Number(width), keyName });
  fs.writeFileSync(out, Buffer.from(res.url.split(',')[1], 'base64'));
  console.log('切り出し', res.box.join(','), '出力', res.out.join('x'));
  await b.close();
})();
