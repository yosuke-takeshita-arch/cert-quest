// 資格アプリごとの manifest の id が重ならないことを確かめる。
// id は start_url の「オリジン」を基準に解決される（W3C Web Application Manifest「process the id member」）。
// "./" と書くと全アプリが https://<ユーザー>.github.io/ になり、2つ目以降は「既にあります」でインストールできない（2026-10-03 に発生）。
// 実行: cd shared && node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// 公開先（GitHub Pages）での各アプリの manifest の URL
const BASE = 'https://yosuke-takeshita-arch.github.io/cert-quest/';

// 仕様の手順どおりに id を解決する
function resolveId(json, manifestUrl) {
  const start = new URL(json.start_url ?? '.', manifestUrl);
  if (typeof json.id !== 'string' || json.id === '') return start.href;
  const id = new URL(json.id, start.origin);
  if (id.origin !== start.origin) return start.href;
  id.hash = '';
  return id.href;
}

test('各アプリの manifest の id は、アプリ自身のディレクトリを指し、互いに重ならない', () => {
  // 直下のアプリ（g-kentei/・dx-biz/）と、1段深いアプリ（shindanshi/1ji/ など。<資格>/<試験>/）
  const direct = readdirSync(root).filter((d) => existsSync(join(root, d, 'manifest.webmanifest')));
  const nested = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !['node_modules', 'private', 'docs', 'shared', 'tools'].includes(e.name) && !e.name.startsWith('.'))
    .flatMap((e) => readdirSync(join(root, e.name), { withFileTypes: true }).filter((s) => s.isDirectory()).map((s) => `${e.name}/${s.name}`))
    .filter((d) => existsSync(join(root, d, 'manifest.webmanifest')));
  const apps = [...direct, ...nested];
  assert.ok(apps.length >= 2, `manifest を持つアプリが ${apps.length} 個しか見つからない`);
  assert.ok(nested.includes('shindanshi/1ji'), '深い場所のアプリ（shindanshi/1ji）を見つけられていない');
  const seen = new Map();
  for (const app of apps) {
    const json = JSON.parse(readFileSync(join(root, app, 'manifest.webmanifest'), 'utf8'));
    const id = resolveId(json, `${BASE}${app}/manifest.webmanifest`);
    assert.ok(!seen.has(id), `${app} と ${seen.get(id)} の id が同じ（${id}）`);
    seen.set(id, app);
    // G検定は既にインストールされた端末があるため、id を変えない（変えると別アプリ扱いになる）
    if (app !== 'g-kentei') assert.ok(id.startsWith(`${BASE}${app}/`), `${app} の id がアプリのディレクトリを指していない（${id}）`);
  }
});

test('解決の手順そのもの: "./" はオリジン直下になる（仕様の例と同じ）', () => {
  assert.equal(resolveId({ id: './', start_url: './index.html' }, `${BASE}x/manifest.webmanifest`), 'https://yosuke-takeshita-arch.github.io/');
});

// ホームのインストール案内（lib/install.js）。2026-10-14、案内が無く、先生が Chrome のメニューから入れようとして断られた。
import { installHint } from '../js/lib/install.js';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

test('インストール案内: 知らせが来ていればボタン、Android で来ていなければ待つ案内、入れたアプリで開いていれば何も出さない', () => {
  assert.equal(installHint({ prompt: true, userAgent: ANDROID, standalone: false }), 'button');
  assert.equal(installHint({ prompt: true, userAgent: PC, standalone: false }), 'button');
  assert.equal(installHint({ prompt: false, userAgent: ANDROID, standalone: false }), 'wait');
  assert.equal(installHint({ prompt: false, userAgent: IPHONE, standalone: false }), null);
  assert.equal(installHint({ prompt: false, userAgent: PC, standalone: false }), null);
  assert.equal(installHint({ prompt: true, userAgent: ANDROID, standalone: true }), null);
  assert.equal(installHint({ prompt: false, userAgent: ANDROID, standalone: true }), null);
  assert.equal(installHint({ prompt: false, userAgent: '', standalone: false }), null);
});

test('インストール案内: home.js が installHint を使い、sw-core.js が install.js を先取りしている', () => {
  const home = readFileSync(join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'js', 'views', 'home.js'), 'utf8');
  assert.match(home, /installHint\(/);
  assert.match(home, /data-install-wait/);
  const sw = readFileSync(join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'sw-core.js'), 'utf8');
  assert.ok(sw.includes("'../shared/js/lib/install.js'"), 'sw-core.js の SHARED に install.js が無い（オフラインで開けない）');
});
