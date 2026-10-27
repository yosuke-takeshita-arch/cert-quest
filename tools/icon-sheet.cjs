// 2x2 に白い線で区切ったアイコンの絵を4つに切り分け、各アプリの icons/ 用の PNG を作る。
// 使い方: node cut.cjs <元の絵> <出力ディレクトリ>
// 出力: tile-1〜4.png（切り出した原寸）、<n>-192.png・<n>-512.png（角丸 rx=112/512 の外を透明）、<n>-maskable-512.png（四角いまま）
// 並び: 1 左上 2 右上 3 左下 4 右下
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const [src, outDir] = process.argv.slice(2);
(async () => {
  const data = 'data:image/png;base64,' + fs.readFileSync(src).toString('base64');
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await br.newPage();
  const r = await p.evaluate(async (data) => {
    const img = new Image(); img.src = data; await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, W, H).data;
    const white = (x, y) => { const i = (y * W + x) * 4; return px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235; };
    // 行・列ごとに白の割合を数え、9割以上が白なら区切り線とみなす
    const colW = []; for (let x = 0; x < W; x++) { let n = 0; for (let y = 0; y < H; y++) if (white(x, y)) n++; colW.push(n / H > 0.9); }
    const rowW = []; for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) if (white(x, y)) n++; rowW.push(n / W > 0.9); }
    const spans = (a) => { const s = []; let st = -1; a.forEach((v, i) => { if (!v && st < 0) st = i; if (v && st >= 0) { s.push([st, i]); st = -1; } }); if (st >= 0) s.push([st, a.length]); return s.filter(([a0, b0]) => b0 - a0 > 50); };
    const xs = spans(colW), ys = spans(rowW);
    const inset = 6;
    const tiles = [];
    for (const [y0, y1] of ys) for (const [x0, x1] of xs) {
      const x = x0 + inset, y = y0 + inset, w = x1 - x0 - inset * 2, h = y1 - y0 - inset * 2;
      const t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').drawImage(c, x, y, w, h, 0, 0, w, h);
      const out = { tile: t.toDataURL('image/png'), box: [x, y, w, h] };
      const make = (size, round) => {
        const k = document.createElement('canvas'); k.width = size; k.height = size;
        const kg = k.getContext('2d'); kg.imageSmoothingQuality = 'high';
        if (round) { const rr = size * 112 / 512; kg.beginPath(); kg.roundRect(0, 0, size, size, rr); kg.clip(); }
        kg.drawImage(t, 0, 0, size, size);
        return k.toDataURL('image/png');
      };
      // maskable: Android は真ん中の直径8割の円だけを見せることがある。絵を8割に縮めて真ん中に置き、
      // まわりは同じ絵を大きくぼかしたもので埋め、絵のふちを円形にぼかしてなじませる
      const makeMask = (size) => {
        const k = document.createElement('canvas'); k.width = size; k.height = size;
        const kg = k.getContext('2d'); kg.imageSmoothingQuality = 'high';
        kg.filter = 'blur(' + Math.round(size * 0.06) + 'px)';
        kg.drawImage(t, -size * 0.15, -size * 0.15, size * 1.3, size * 1.3);
        kg.filter = 'none';
        const f = size * 0.8;
        const fc = document.createElement('canvas'); fc.width = f; fc.height = f;
        const fg = fc.getContext('2d'); fg.imageSmoothingQuality = 'high'; fg.drawImage(t, 0, 0, f, f);
        const grad = fg.createRadialGradient(f / 2, f / 2, f * 0.42, f / 2, f / 2, f * 0.5);
        grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
        fg.globalCompositeOperation = 'destination-in'; fg.fillStyle = grad; fg.fillRect(0, 0, f, f);
        kg.drawImage(fc, (size - f) / 2, (size - f) / 2);
        return k.toDataURL('image/png');
      };
      out.i192 = make(192, true); out.i512 = make(512, true); out.m512 = makeMask(512);
      tiles.push(out);
    }
    return { W, H, xs, ys, tiles };
  }, data);
  fs.mkdirSync(outDir, { recursive: true });
  const save = (name, url) => fs.writeFileSync(path.join(outDir, name), Buffer.from(url.split(',')[1], 'base64'));
  r.tiles.forEach((t, i) => {
    const n = i + 1;
    save('tile-' + n + '.png', t.tile); save(n + '-192.png', t.i192); save(n + '-512.png', t.i512); save(n + '-maskable-512.png', t.m512);
  });
  await br.close();
  console.log('size', r.W + 'x' + r.H, 'cols', JSON.stringify(r.xs), 'rows', JSON.stringify(r.ys));
  r.tiles.forEach((t, i) => console.log('tile', i + 1, JSON.stringify(t.box)));
})();
