// sw-core.js の sharedBase（shared/ への道筋を sw.js の場所に合わせる）の検証。
// 下のほうに、BGM のキャッシュ（版が上がっても残す）と activate（消すもの・残すもの）の検証もある（2026-11-10）。
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
    Promise, console, setTimeout, clearTimeout, // 本物の service worker にもある（受け取りの進み具合を間を空けて知らせるのに使う）
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

// ---- BGM は、版が上がっても残る別のキャッシュに入れる（2026-11-10。前は公開のたびに 13曲・約20MB を取り直していた） ----
// キャッシュの偽物（名前 → URL → 応答）を作り、sw-core.js の fetch・activate を動かして、どのキャッシュに何が入るか・何が消えるかを見る。

const ORIGIN = 'https://example.test';
const BGM_URL = ORIGIN + '/shared/audio/bgm/a.mp3';
const BGM_URL2 = ORIGIN + '/shared/audio/bgm/b.mp3';
const SFX_URL = ORIGIN + '/shared/audio/sfx/ok.ogg';
const tick = () => new Promise((r) => setTimeout(r, 5)); // cacheFirst はキャッシュへの書き込みを待たずに返すので、少し待つ

/** initial: { キャッシュの名前: { URL: 目印 } }。source: sw-core.js の文字列（BGM_VERSION を変えて試すときに渡す）。putFails: BGM のキャッシュへの書き込みを失敗させる */
function boot({ appId = 't', version = '1', initial = {}, source = src, putFails = false } = {}) {
  const handlers = {};
  const stores = new Map();
  for (const [name, entries] of Object.entries(initial)) stores.set(name, new Map(Object.entries(entries)));
  const urlOf = (r) => (typeof r === 'string' ? r : r.url);
  const cacheApi = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      match: async (r) => m.get(urlOf(r)),
      put: async (r, res) => { if (putFails && !name.startsWith('certquest-')) throw new Error('quota'); m.set(urlOf(r), res); },
      addAll: async (reqs) => { for (const r of reqs) m.set(urlOf(r), 'core'); },
      keys: async () => [...m.keys()].map((url) => ({ url })),
      delete: async (r) => m.delete(urlOf(r)),
    };
  };
  const fetched = [];
  let claimed = 0;
  const self = {
    CERT_QUEST: { appId, version, appFiles: ['./', './index.html'] },
    location: { href: ORIGIN + '/x/sw.js', origin: ORIGIN },
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: () => {},
    clients: { claim: () => { claimed++; }, matchAll: async () => [] },
  };
  const ctx = {
    self,
    caches: { open: async (n) => cacheApi(n), keys: async () => [...stores.keys()], delete: async (n) => stores.delete(n) },
    fetch: async (req, init) => {
      fetched.push({ url: req.url, init: init ? { ...init } : null }); // 写しを取る（vm の中で作られた入れ物は、外の入れ物と「同じ形」と見なされないため）
      const range = req.headers.get('range');
      const res = { ok: true, status: range ? 206 : 200, mark: 'net' };
      res.clone = () => res;
      return res;
    },
    URL,
    Request: class { constructor(u) { this.url = u; } },
    Response,
    Promise, console, setTimeout, clearTimeout,
  };
  vm.runInNewContext(source, ctx);
  const get = async (url, { range = null } = {}) => {
    let p = null;
    const headers = new Headers(range ? { range } : {});
    handlers.fetch({ request: { method: 'GET', url, headers, mode: 'cors' }, respondWith: (x) => { p = x; } });
    const res = await p;
    await tick();
    return res;
  };
  const activate = async () => {
    let p = null;
    handlers.activate({ waitUntil: (x) => { p = x; } });
    await p;
  };
  const names = () => [...stores.keys()].sort();
  const has = (name, url) => stores.has(name) && stores.get(name).has(url);
  return { stores, fetched, get, activate, names, has, claimed: () => claimed };
}

/** BGM のキャッシュの名前を、動きから調べる（BGM を1曲取らせて、増えたキャッシュの名前を見る） */
async function bgmCacheName(opts) {
  const sw = boot(opts);
  await sw.get(BGM_URL);
  const hit = sw.names().filter((n) => sw.has(n, BGM_URL));
  assert.equal(hit.length, 1, 'BGM が入ったキャッシュは1つ: ' + hit.join(', '));
  return hit[0];
}

test('BGM は別のキャッシュに入る（版ごとのキャッシュには入らない）。効果音は今まで通り版ごとのキャッシュ', async () => {
  const sw = boot({ appId: 't', version: '7' });
  const res = await sw.get(BGM_URL);
  assert.equal(res.mark, 'net');
  const name = await bgmCacheName({});
  assert.ok(sw.has(name, BGM_URL), 'BGM のキャッシュに入っている');
  assert.ok(!sw.has('certquest-t-v7', BGM_URL), '版ごとのキャッシュには入れない');
  await sw.get(SFX_URL);
  assert.ok(sw.has('certquest-t-v7', SFX_URL), '効果音は版ごとのキャッシュ');
  assert.ok(!sw.has(name, SFX_URL), '効果音は BGM のキャッシュに入れない');
});

test('BGM のキャッシュの名前は、どのアプリでも同じで、版の数字を含まず、certquest- で始まらない（activate の「certquest-<アプリのID>-」に当たらない）', async () => {
  const a = await bgmCacheName({ appId: 'g-kentei', version: '176' });
  const b = await bgmCacheName({ appId: 'shindanshi-1ji', version: '66' });
  const c = await bgmCacheName({ appId: 'g-kentei', version: '177' });
  assert.equal(a, b, '5つのアプリで1つを共有する');
  assert.equal(a, c, '版が上がっても同じ名前');
  assert.ok(!a.startsWith('certquest-'), a);
});

test('BGM は2回目からネットに行かない。取るときは、ブラウザが覚えた古い応答を使わず、サーバーに確かめる', async () => {
  const sw = boot({});
  await sw.get(BGM_URL);
  assert.deepEqual(sw.fetched, [{ url: BGM_URL, init: { cache: 'no-cache' } }]);
  const again = await sw.get(BGM_URL);
  assert.equal(again.mark, 'net');
  assert.equal(sw.fetched.length, 1, '2回目はキャッシュから');
  await sw.get(SFX_URL);
  assert.deepEqual(sw.fetched[1], { url: SFX_URL, init: null }, '効果音の取り方は変えない');
});

test('一部分だけの求め（Range）の扱いは前のまま: キャッシュに無ければネットの応答（206）をそのまま返して入れない。あれば丸ごとを返す', async () => {
  const sw = boot({});
  const part = await sw.get(BGM_URL, { range: 'bytes=0-99' });
  assert.equal(part.status, 206);
  assert.deepEqual(sw.fetched, [{ url: BGM_URL, init: null }], 'Range のときは、求めをそのまま送る');
  assert.ok(!sw.names().some((n) => sw.has(n, BGM_URL)), '206 はどのキャッシュにも入れない');
  await sw.get(BGM_URL);
  const hit = await sw.get(BGM_URL, { range: 'bytes=0-99' });
  assert.equal(hit.status, 200, 'キャッシュにあれば丸ごと');
  assert.equal(sw.fetched.length, 2);
});

test('activate: このアプリの古い版のキャッシュだけを消す。BGM のキャッシュと、ほかのアプリのキャッシュは消さない', async () => {
  const name = await bgmCacheName({});
  const sw = boot({
    appId: 't', version: '2',
    initial: {
      'certquest-t-v1': { [ORIGIN + '/x/index.html']: 'old' },
      'certquest-t-v2': { [ORIGIN + '/x/index.html']: 'now' },
      'certquest-t2-v9': { [ORIGIN + '/y/index.html']: 'other' }, // ID が「t」で始まる別のアプリ
      'certquest-other-v5': { [ORIGIN + '/z/index.html']: 'other' },
      [name]: { [BGM_URL]: 'kept' },
      'よそのキャッシュ': { x: 'y' },
    },
  });
  await sw.activate();
  assert.deepEqual(sw.names(), ['certquest-other-v5', 'certquest-t-v2', 'certquest-t2-v9', name, 'よそのキャッシュ'].sort());
  assert.equal(sw.stores.get(name).get(BGM_URL), 'kept');
  assert.equal(sw.claimed(), 1);
});

test('activate: アプリのIDが bgm でも、BGM のキャッシュは消えない（名前の作りで当たらない）', async () => {
  const name = await bgmCacheName({});
  const sw = boot({ appId: 'bgm', version: '2', initial: { 'certquest-bgm-v1': { a: 'old' }, [name]: { [BGM_URL]: 'kept' } } });
  await sw.activate();
  assert.deepEqual(sw.names(), [name]);
});

test('切り替え: 古い版のキャッシュに入っている BGM は、消す前に BGM のキャッシュへ移す。もうある曲は上書きしない。BGM でないものは移さない', async () => {
  const name = await bgmCacheName({});
  const sw = boot({
    appId: 't', version: '2',
    initial: {
      'certquest-t-v1': { [BGM_URL]: { status: 200, mark: 'old-a' }, [BGM_URL2]: { status: 200, mark: 'old-b' }, [SFX_URL]: { status: 200, mark: 'sfx' }, [ORIGIN + '/x/index.html']: { status: 200, mark: 'html' } },
      [name]: { [BGM_URL]: { status: 200, mark: 'have-a' } },
    },
  });
  await sw.activate();
  assert.deepEqual(sw.names(), [name], '古い版のキャッシュは消える');
  const bgm = sw.stores.get(name);
  assert.deepEqual([...bgm.keys()].sort(), [BGM_URL, BGM_URL2]);
  assert.equal(bgm.get(BGM_URL).mark, 'have-a', 'もうある曲はそのまま');
  assert.equal(bgm.get(BGM_URL2).mark, 'old-b', '無かった曲は移る');
  const after = await sw.get(BGM_URL2);
  assert.equal(after.mark, 'old-b');
  assert.equal(sw.fetched.length, 0, '移した曲は取り直さない');
});

test('切り替え: 移すのに失敗しても、古い版のキャッシュは消し、先へ進む', async () => {
  const sw = boot({ appId: 't', version: '2', putFails: true, initial: { 'certquest-t-v1': { [BGM_URL]: { status: 200 } } } });
  await sw.activate();
  assert.ok(!sw.names().includes('certquest-t-v1'));
  assert.equal(sw.claimed(), 1);
});

test('BGM の番号を上げると: 番号の小さい BGM のキャッシュは消える（大きい番号は消さない）。古い版のキャッシュの BGM は移さない（差し替える前の曲を持ちこまない）', async () => {
  assert.ok(src.includes('const BGM_VERSION = 1;'), 'いまの番号は 1（上げたら、このテストの 1・2・3 の読み替えと、下の「番号が 1 の間だけ移す」を見直す）');
  const v1 = await bgmCacheName({});
  const src2 = src.replace('const BGM_VERSION = 1;', 'const BGM_VERSION = 2;');
  const v2 = await bgmCacheName({ source: src2 });
  assert.notEqual(v1, v2);
  const v3 = v2.slice(0, -1) + '3';
  const sw = boot({
    appId: 't', version: '2', source: src2,
    initial: {
      'certquest-t-v1': { [BGM_URL2]: { status: 200, mark: 'stale' } },
      [v1]: { [BGM_URL]: 'v1' },
      [v2]: { [BGM_URL]: 'v2' },
      [v3]: { [BGM_URL]: 'v3' },
    },
  });
  await sw.activate();
  assert.deepEqual(sw.names(), [v2, v3].sort());
  assert.ok(!sw.has(v2, BGM_URL2), '古い曲は移さない');
  // 番号が 1 のままのアプリ（まだ新しい版を受け取っていない）は、番号の大きいキャッシュを消さない
  const older = boot({ appId: 'u', version: '5', initial: { [v1]: { [BGM_URL]: 'v1' }, [v2]: { [BGM_URL]: 'v2' } } });
  await older.activate();
  assert.deepEqual(older.names(), [v1, v2].sort());
});

test('本物の5つのアプリの sw.js のIDで、BGM のキャッシュの名前が「certquest-<ID>-」に当たらない', async () => {
  const name = await bgmCacheName({});
  const ids = [];
  for (const dir of ['g-kentei', 'dx-biz', 'ai-passport', 'sc', 'shindanshi/1ji']) {
    const m = /appId:\s*'([^']+)'/.exec(readFileSync(new URL('../../' + dir + '/sw.js', import.meta.url), 'utf8'));
    assert.ok(m, dir + '/sw.js に appId が無い');
    ids.push(m[1]);
  }
  assert.equal(new Set(ids).size, 5, ids.join(', '));
  for (const id of ids) assert.ok(!name.startsWith('certquest-' + id + '-'), id);
});
