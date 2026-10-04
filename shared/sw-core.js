// サービスワーカーの本体（各アプリの sw.js から importScripts で読まれる）。
// 各アプリの sw.js は scope=自分のディレクトリ。ここで ../shared/ のファイルもキャッシュするので、
// scope の外にある shared/ もオフラインで使える（キャッシュは scope と無関係に何でも入れられる）。
//
// 方針
//  - アプリ本体（HTML/JS/CSS/config/アイコン）: ネット優先。4秒で返らなければキャッシュ。→ 更新が1回で反映され、新旧が混ざらない
//  - data/（問題・カード）: キャッシュ優先＋裏で更新。オフラインでも即開く。更新は次に開いたとき見える
//  - audio/（効果音・BGM）: 効果音は小さいのでインストール時に取る。BGM は大きいので、最初に流したときに取ってキャッシュに入れ、以後はキャッシュ優先（オフラインでも鳴る）
//  - 404 などの失敗応答はキャッシュしない（まだ無いデータを「無い」と覚えない）
/* global self, caches, fetch, URL, Response */
const CFG = self.CERT_QUEST;
const CACHE = 'certquest-' + CFG.appId + '-v' + CFG.version;

// shared/ の中身（sw.js から見た相対パス）。ファイルを足したらここにも足す。
const SHARED = [
  '../shared/css/app.css',
  '../shared/js/app.js',
  '../shared/js/ui.js',
  '../shared/js/audio.js',
  '../shared/js/lib/sound.js',
  '../shared/js/lib/srs.js',
  '../shared/js/lib/scoring.js',
  '../shared/js/lib/quiz.js',
  '../shared/js/lib/data.js',
  '../shared/js/lib/progress.js',
  '../shared/js/lib/badges.js',
  '../shared/js/lib/daily.js',
  '../shared/js/lib/goals.js',
  '../shared/js/lib/storage.js',
  '../shared/js/views/home.js',
  '../shared/js/views/cards.js',
  '../shared/js/views/play.js',
  '../shared/js/views/exam.js',
  '../shared/js/views/explain.js',
  '../shared/js/views/more.js',
  '../shared/js/views/title.js',
  '../shared/js/lib/loadprogress.js',
];

// 効果音（小さいのでインストール時に取る）。BGM は含めない（最初に流したときに取る）。shared/audio/sfx/ を足したらここにも足す。
const SFX = [
  'confirmation_001.ogg',
  'bong_001.ogg',
  'jingles_STEEL07.ogg',
  'jingles_SAX07.ogg',
  'jingles_PIZZI07.ogg',
  'jingles_NES00.ogg',
].map((f) => '../shared/audio/sfx/' + f);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // 本体が1つでも取れなければインストール失敗にする（中途半端なオフラインにしない）
      await cache.addAll([...CFG.appFiles, ...SHARED, ...SFX].map((u) => new Request(u, { cache: 'reload' })));
      // データは有る分だけ。無い(404)ものは飛ばす
      try {
        const idxRes = await fetch('./data/index.json', { cache: 'reload' });
        if (idxRes.ok) {
          const idx = await idxRes.clone().json();
          await cache.put(new URL('./data/index.json', self.location).href, idxRes);
          const files = [idx.syllabus, ...(idx.questions || []), ...(idx.concepts || [])].filter((f) => typeof f === 'string');
          await Promise.all(
            files.map(async (f) => {
              try {
                const u = new URL('./data/' + f, self.location).href;
                const r = await fetch(u, { cache: 'reload' });
                if (r.ok) await cache.put(u, r);
              } catch (e) { /* 取れないものは飛ばす */ }
            })
          );
        }
      } catch (e) { /* データ無しでも本体は使える */ }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const prefix = 'certquest-' + CFG.appId + '-';
      for (const k of await caches.keys()) if (k.startsWith(prefix) && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })()
  );
});

async function networkFirst(request, timeoutMs) {
  const cache = await caches.open(CACHE);
  const ignoreSearch = request.mode === 'navigate';
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
    ]);
    if (res && res.ok && !ignoreSearch) cache.put(request, res.clone());
    else if (res && res.ok && ignoreSearch) cache.put(new URL('./index.html', self.location).href, res.clone());
    return res;
  } catch (e) {
    const hit = (await cache.match(request, { ignoreSearch })) || (ignoreSearch && (await cache.match(new URL('./index.html', self.location).href)));
    if (hit) return hit;
    return new Response('オフラインで、まだ保存されていません。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function cacheFirstRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) return hit;
  const res = await refresh;
  return res || new Response('', { status: 404 });
}

// 音のファイル: キャッシュ優先。無ければネットから取って（時間切れなし）キャッシュに入れる。失敗した応答は入れない
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res && res.ok && res.status === 200) cache.put(request, res.clone());
    return res;
  } catch (e) {
    return new Response('', { status: 503 });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/\/data\//.test(url.pathname)) event.respondWith(cacheFirstRevalidate(req));
  else if (/\/shared\/audio\//.test(url.pathname)) event.respondWith(cacheFirst(req));
  else event.respondWith(networkFirst(req, 4000));
});
