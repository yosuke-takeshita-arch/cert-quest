// SVG から PWA 用の PNG アイコンを作る（資格ごとの icons/ で使う。dx-biz でも同じ）。
// 使い方: node make-icons.mjs <アプリのicons/ディレクトリ>
//   <dir>/icon.svg → icon-192.png, icon-512.png   <dir>/icon-maskable.svg → icon-maskable-512.png
// Playwright が必要（このリポジトリには入れていない）。場所を PLAYWRIGHT_DIR で指定するか、
// 解決できる場所で実行する。例:
//   PLAYWRIGHT_DIR=C:/Users/.../reservation-system/node_modules/playwright node make-icons.mjs ../g-kentei/icons
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const dir = path.resolve(process.argv[2] || '.');
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_DIR || 'playwright');

const jobs = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
];
const browser = await pw.chromium.launch();
try {
  for (const [src, out, size] of jobs) {
    const from = path.join(dir, src);
    if (!fs.existsSync(from)) throw new Error('見つからない: ' + from);
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.goto(pathToFileURL(from).href);
    await page.screenshot({ path: path.join(dir, out), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    console.log('作成:', path.join(dir, out));
  }
} finally {
  await browser.close();
}
