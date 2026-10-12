// sw-core.js の sharedBase（shared/ への道筋を sw.js の場所に合わせる）の検証。
// sw-core.js を偽の self の中で実行し、install で cache.addAll に渡る URL を集める。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../sw-core.js', import.meta.url), 'utf8');

async function installUrls(cfg) {
  const handlers = {};
  const added = [];
  const self = {
    CERT_QUEST: { appId: 't', version: '1', appFiles: ['./', './index.html'], ...cfg },
    location: { href: 'https://example.test/x/sw.js' },
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  const cacheObj = { addAll: async (reqs) => { added.push(...reqs.map((r) => r.url)); }, put: async () => {} };
  const ctx = {
    self,
    caches: { open: async () => cacheObj, keys: async () => [], delete: async () => true },
    fetch: async () => ({ ok: false, status: 404 }),
    URL,
    Request: class { constructor(u) { this.url = u; } },
    Response,
    Promise, console,
  };
  vm.runInNewContext(src, ctx);
  let p;
  handlers.install({ waitUntil: (x) => { p = x; } });
  await p;
  return added.filter((u) => u.includes('shared/'));
}

test('sharedBase を書かないと、今まで通り ../shared/ のまま（G検定・DX と同じ URL）', async () => {
  const urls = await installUrls({});
  assert.ok(urls.length > 80, 'shared の URL が少なすぎる: ' + urls.length);
  for (const u of urls) assert.ok(u.startsWith('../shared/'), u);
  assert.ok(urls.includes('../shared/css/app.css'));
  assert.ok(urls.includes('../shared/audio/sfx/ok_gold-coin.ogg'));
});

test('sharedBase を ../../shared/ にすると、SHARED も SFX も全部その下になる（../shared/ は1つも残らない）', async () => {
  const base = await installUrls({});
  const deep = await installUrls({ sharedBase: '../../shared/' });
  assert.equal(deep.length, base.length);
  for (const u of deep) assert.ok(u.startsWith('../../shared/') && !u.startsWith('../../../'), u);
  assert.deepEqual(deep, base.map((u) => '../../' + u.slice('../'.length)));
  assert.ok(deep.includes('../../shared/css/app.css'));
  assert.ok(deep.includes('../../shared/audio/sfx/ok_gold-coin.ogg'));
});
