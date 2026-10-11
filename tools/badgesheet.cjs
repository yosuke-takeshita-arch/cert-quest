// 1枚の絵に並んだ複数のバッジを、緑（#00FF00）の背景を抜いて1枚ずつの webp に切り分ける。
// 使い方: node tools/badgesheet.cjs <元の PNG> <出力先のフォルダ> <一辺の画素数> <名前1> <名前2> ...
// 名前は、絵の上の段の左から右、次の段の左から右の順に並べる。見つかったメダルの数と名前の数が違えば止まる。
// playwright-core と Chrome が要る（tools/chromakey.cjs と同じ）。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const [src, outDir, size, ...names] = process.argv.slice(2);
  if (!src || !outDir || !size || names.length === 0) throw new Error('使い方: node badgesheet.cjs <元の PNG> <出力先> <一辺の画素数> <名前1> <名前2> ...');
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage();
  const mime = /\.jpe?g$/i.test(src) ? 'image/jpeg' : 'image/png';
  const data = 'data:' + mime + ';base64,' + fs.readFileSync(src).toString('base64');
  const res = await p.evaluate(async ({ data, size }) => {
    const img = new Image(); img.src = data; await img.decode();
    const W = img.width, H = img.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const id = g.getImageData(0, 0, W, H); const d = id.data;
    // 緑のキー（chromakey.cjs と同じ式）
    for (let i = 0; i < d.length; i += 4) {
      const k = d[i + 1] - Math.max(d[i], d[i + 2]);
      const a = k <= 60 ? 1 : k >= 150 ? 0 : 1 - (k - 60) / 90;
      if (a < 1) d[i + 1] = Math.min(d[i + 1], Math.max(d[i], d[i + 2]));
      d[i + 3] = Math.round(d[i + 3] * a);
    }
    g.putImageData(id, 0, 0);
    // 不透明な画素のつながり（4近傍）を数える
    const lab = new Int32Array(W * H); const boxes = []; const stack = [];
    for (let s = 0; s < W * H; s++) {
      if (lab[s] || d[s * 4 + 3] < 128) continue;
      const n = boxes.length + 1; let x0 = W, y0 = H, x1 = 0, y1 = 0, area = 0;
      lab[s] = n; stack.push(s);
      while (stack.length) {
        const q = stack.pop(); const x = q % W, y = (q / W) | 0; area++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const r of [q - 1, q + 1, q - W, q + W]) {
          if (r < 0 || r >= W * H) continue;
          if ((r === q - 1 && x === 0) || (r === q + 1 && x === W - 1)) continue;
          if (!lab[r] && d[r * 4 + 3] >= 128) { lab[r] = n; stack.push(r); }
        }
      }
      boxes.push({ x0, y0, x1, y1, area });
    }
    // 小さな粒（キーの取り残し・離れた光の線）は捨て、メダルだけ残す
    const big = boxes.filter((bx) => bx.area > W * H * 0.01);
    // 段に分ける（中心の y が近いものを同じ段）→ 段の中で x 順
    big.forEach((bx) => { bx.cx = (bx.x0 + bx.x1) / 2; bx.cy = (bx.y0 + bx.y1) / 2; bx.h = bx.y1 - bx.y0; });
    big.sort((a, b2) => a.cy - b2.cy);
    const rows = [];
    for (const bx of big) { const r = rows.find((row) => Math.abs(row[0].cy - bx.cy) < row[0].h / 2); if (r) r.push(bx); else rows.push([bx]); }
    const order = rows.flatMap((row) => row.sort((a, b2) => a.cx - b2.cx));
    return {
      W, H,
      items: order.map((bx) => {
        const pad = Math.round(Math.max(bx.x1 - bx.x0, bx.y1 - bx.y0) * 0.02);
        const x0 = Math.max(0, bx.x0 - pad), y0 = Math.max(0, bx.y0 - pad);
        const w = Math.min(W, bx.x1 + pad + 1) - x0, h = Math.min(H, bx.y1 + pad + 1) - y0, s = Math.max(w, h);
        const o = document.createElement('canvas'); o.width = o.height = size;
        const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
        const k = size / s;
        og.drawImage(c, x0, y0, w, h, (size - w * k) / 2, (size - h * k) / 2, w * k, h * k);
        return { box: [bx.x0, bx.y0, bx.x1 - bx.x0 + 1, bx.y1 - bx.y0 + 1], url: o.toDataURL('image/webp', 0.9) };
      }),
    };
  }, { data, size: Number(size) });
  await b.close();
  if (res.items.length !== names.length) {
    console.error('メダルが ' + res.items.length + ' 個見つかった（名前は ' + names.length + ' 個）。切り分けを止めた');
    res.items.forEach((it, i) => console.error(i + 1, it.box.join(',')));
    process.exit(1);
  }
  res.items.forEach((it, i) => {
    const out = path.join(outDir, names[i] + '.webp');
    fs.writeFileSync(out, Buffer.from(it.url.split(',')[1], 'base64'));
    console.log(names[i], '←', it.box.join(','));
  });
})();
