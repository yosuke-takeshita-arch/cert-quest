// 描き込まれた市松模様（白・薄い灰色）を、画像の外周からつながっている部分だけ透過にして、指定の大きさの webp にする。
const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const [src, out, size] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage();
  const data = 'data:image/png;base64,' + fs.readFileSync(src).toString('base64');
  const res = await p.evaluate(async ({ data, size }) => {
    const img = new Image(); img.src = data; await img.decode();
    const W = img.width, H = img.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const id = g.getImageData(0, 0, W, H); const d = id.data;
    const bg = (i) => { const r = d[i], gg = d[i + 1], bb = d[i + 2]; const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb); return mn > 200 && mx - mn < 18; };
    const seen = new Uint8Array(W * H); const st = [];
    for (let x = 0; x < W; x++) { st.push(x, (H - 1) * W + x); }
    for (let y = 0; y < H; y++) { st.push(y * W, y * W + W - 1); }
    let n = 0;
    while (st.length) { const k = st.pop(); if (seen[k]) continue; seen[k] = 1; if (!bg(k * 4)) continue; d[k * 4 + 3] = 0; n++;
      const x = k % W, y = (k - x) / W;
      if (x > 0) st.push(k - 1); if (x < W - 1) st.push(k + 1); if (y > 0) st.push(k - W); if (y < H - 1) st.push(k + W); }
    // 2回目: 外周につながっていない、閉じたます目の残り（腕と葉の間など）。白と薄い灰色の2色がまざった、ほぼ無彩色の大きな塊だけを消す
    // （ひげ・紙の札のような、色の付いた明るい部分は残す。2026-10-09 boss-3 で残った）
    const seen2 = new Uint8Array(W * H);
    for (let s = 0; s < W * H; s++) {
      if (seen2[s] || d[s * 4 + 3] === 0 || !bg(s * 4)) continue;
      const comp = []; const st2 = [s]; seen2[s] = 1;
      while (st2.length) { const k = st2.pop(); comp.push(k); const x = k % W, y = (k - x) / W;
        for (const nk of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1]) {
          if (nk < 0 || seen2[nk] || d[nk * 4 + 3] === 0 || !bg(nk * 4)) continue; seen2[nk] = 1; st2.push(nk); } }
      if (comp.length < 300) continue;
      let gray = 0, lo = 0, hi = 0;
      for (const k of comp) { const r = d[k*4], gg = d[k*4+1], bb = d[k*4+2]; if (Math.max(r, gg, bb) - Math.min(r, gg, bb) < 8) gray++; const v = (r + gg + bb) / 3; if (v < 246) lo++; else if (v > 250) hi++; }
      if (gray / comp.length > 0.9 && lo / comp.length > 0.15 && hi / comp.length > 0.15) { for (const k of comp) d[k * 4 + 3] = 0; n += comp.length; }
    }
    // 縁の白いにじみ: 透過に接する明るい無彩色の画素を半透明にする
    const d2 = new Uint8ClampedArray(d);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const k = y * W + x; if (d[k * 4 + 3] === 0) continue;
      const near = d[(k - 1) * 4 + 3] === 0 || d[(k + 1) * 4 + 3] === 0 || d[(k - W) * 4 + 3] === 0 || d[(k + W) * 4 + 3] === 0;
      if (near) { const r = d[k*4], gg = d[k*4+1], bb = d[k*4+2]; const mn = Math.min(r, gg, bb); if (mn > 170) d2[k * 4 + 3] = 90; } }
    id.data.set(d2); g.putImageData(id, 0, 0);
    const o = document.createElement('canvas'); o.width = o.height = size; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(c, 0, 0, size, size);
    return { url: o.toDataURL('image/webp', 0.86), ratio: n / (W * H) };
  }, { data, size: Number(size) });
  fs.writeFileSync(out, Buffer.from(res.url.split(',')[1], 'base64'));
  console.log('transparent ratio', res.ratio.toFixed(3));
  await b.close();
})();
