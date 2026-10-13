// 緑のキーで抜いたあと、ふちに残る水色（青い光＋緑のまざり）を抑える。透明の画素から R 画素以内で、緑が赤より D 以上強い画素の緑を赤まで下げる。
// node tools/defringe.cjs <入力 webp> <出力 webp> [R=4] [D=30] [green|magenta]
// magenta（2026-10-13、生成AIパスポート boss-4 の足元の光る跡）: マゼンタで抜いたあと、光のふちに残るピンク（赤みのふち）から、
// キーで抜いたあとは、赤が緑より D 以上強く、青が緑と同じくらい以上の半透明の画素（サーモン色）として残る。
// これを金色の光の色（緑＝赤の0.8倍、青＝赤の0.35倍）に置き換える。金・黄の光のふち用。青・白・肌色のふちは条件に当たらない（赤が緑より強くない）。
const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const [src, out, R = '4', D = '30', MODE = 'green'] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage();
  const res = await p.evaluate(async ({ data, R, D, MODE }) => {
    const img = new Image(); img.src = data; await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const id = g.getImageData(0, 0, W, H); const d = id.data;
    const near = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] < 250) {
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W) near[yy * W + xx] = 1; }
    }
    let n = 0;
    for (let k = 0; k < W * H; k++) { if (!near[k]) continue; const i = k * 4; if (!d[i + 3]) continue;
      if (MODE === 'magenta') { if (d[i] > d[i + 1] + D && d[i + 2] >= d[i + 1] - 10) { d[i + 1] = Math.round(d[i] * 0.8); d[i + 2] = Math.round(d[i] * 0.35); n++; } }
      else if (d[i + 1] > d[i] + D) { d[i + 1] = d[i]; n++; } }
    g.putImageData(id, 0, 0);
    return { n, url: c.toDataURL('image/webp', 0.9) };
  }, { data: 'data:image/webp;base64,' + fs.readFileSync(src).toString('base64'), R: Number(R), D: Number(D), MODE });
  fs.writeFileSync(out, Buffer.from(res.url.split(',')[1], 'base64'));
  console.log('直した画素', res.n, '大きさ', fs.statSync(out).size);
  await b.close();
})();
