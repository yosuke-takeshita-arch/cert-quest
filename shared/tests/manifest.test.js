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
  const apps = readdirSync(root).filter((d) => existsSync(join(root, d, 'manifest.webmanifest')));
  assert.ok(apps.length >= 2, `manifest を持つアプリが ${apps.length} 個しか見つからない`);
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
