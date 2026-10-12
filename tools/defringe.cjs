// 緑のキーで抜いたあと、ふちに残る水色（青い光＋緑のまざり）を抑える。透明の画素から R 画素以内で、緑が赤より D 以上強い画素の緑を赤まで下げる。
// node tools/defringe.cjs <入力 webp> <出力 webp> [R=4] [D=30]
const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const [src, out, R = '4', D = '30'] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage();
  const res = await p.evaluate(async ({ data, R, D }) => {
    const img = new Image(); img.src = data; await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const id = g.getImageData(0, 0, W, H); const d = id.data;
    const near = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] < 250) {
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W) near[yy * W + xx] = 1; }
    }
    let n = 0;
    for (let k = 0; k < W * H; k++) { if (!near[k]) continue; const i = k * 4; if (d[i + 3] && d[i + 1] > d[i] + D) { d[i + 1] = d[i]; n++; } }
    g.putImageData(id, 0, 0);
    return { n, url: c.toDataURL('image/webp', 0.9) };
  }, { data: 'data:image/webp;base64,' + fs.readFileSync(src).toString('base64'), R: Number(R), D: Number(D) });
  fs.writeFileSync(out, Buffer.from(res.url.split(',')[1], 'base64'));
  console.log('直した画素', res.n, '大きさ', fs.statSync(out).size);
  await b.close();
})();
