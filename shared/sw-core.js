// サービスワーカーの本体（各アプリの sw.js から importScripts で読まれる）。
// 各アプリの sw.js は scope=自分のディレクトリ。ここで ../shared/ のファイルもキャッシュするので、
// scope の外にある shared/ もオフラインで使える（キャッシュは scope と無関係に何でも入れられる）。
//
// 方針
//  - アプリ本体（HTML/JS/CSS/config/アイコン）: ネット優先。4秒で返らなければキャッシュ。→ 更新が1回で反映され、新旧が混ざらない
//  - data/（問題・カード・図）: キャッシュ優先＋裏で更新。オフラインでも即開く。更新は次に開いたとき見える。図（data/figures/*.svg）は、問題・カードの figures が指すものをインストール時に取る
//  - audio/（効果音・BGM）: 効果音は小さいのでインストール時に取る。BGM は大きいので、最初に流したときに取ってキャッシュに入れ、以後はキャッシュ優先（オフラインでも鳴る）
//  - 404 などの失敗応答はキャッシュしない（まだ無いデータを「無い」と覚えない）
/* global self, caches, fetch, URL, Response */
const CFG = self.CERT_QUEST;
const CACHE = 'certquest-' + CFG.appId + '-v' + CFG.version;
const FIGURE_ID = /^fig-[a-z0-9]+(?:-[a-z0-9]+)*$/; // shared/js/lib/figures.js の FIGURE_ID_RE と同じ

// shared/ の中身（sw.js から見た相対パス）。ファイルを足したらここにも足す。
const SHARED = [
  '../shared/css/app.css',
  '../shared/images/aisunia-logo.webp',
  '../shared/images/badges/first-answer.webp',
  '../shared/images/badges/correct-10.webp',
  '../shared/images/badges/correct-100.webp',
  '../shared/images/badges/streak-3.webp',
  '../shared/images/badges/streak-7.webp',
  '../shared/images/badges/streak-30.webp',
  '../shared/images/badges/level-5.webp',
  '../shared/images/badges/level-10.webp',
  '../shared/images/badges/challenge-8.webp',
  '../shared/images/badges/exam-first.webp',
  '../shared/images/badges/exam-70.webp',
  '../shared/images/badges/exam-90.webp',
  '../shared/images/badges/dochi-perfect.webp',
  '../shared/images/characters/shiba-hello.webp',
  '../shared/images/characters/shiba-banzai.webp',
  '../shared/images/characters/shiba-clap.webp',
  '../shared/images/characters/shiba-cheer.webp',
  '../shared/images/characters/shiba-think.webp',
  '../shared/images/characters/shiba-sleepy.webp',
  '../shared/images/characters/sensei-hello.webp',
  '../shared/images/characters/sensei-point.webp',
  '../shared/images/characters/sensei-ok.webp',
  '../shared/images/characters/sensei-comfort.webp',
  '../shared/images/characters/sensei-think.webp',
  '../shared/images/characters/sensei-clap.webp',
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
  '../shared/js/lib/characters.js',
  '../shared/js/lib/goals.js',
  '../shared/js/lib/storage.js',
  '../shared/js/views/home.js',
  '../shared/js/views/cards.js',
  '../shared/js/views/play.js',
  '../shared/js/views/exam.js',
  '../shared/js/views/explain.js',
  '../shared/js/views/more.js',
  '../shared/js/views/sound-settings.js',
  '../shared/js/views/title.js',
  '../shared/js/views/examdate.js',
  '../shared/js/views/about.js',
  '../shared/js/views/characters.js',
  '../shared/js/views/backup.js',
  '../shared/js/views/report.js',
  '../shared/js/views/figure.js',
  '../shared/js/lib/figures.js',
  '../shared/js/lib/loadprogress.js',
  '../shared/js/lib/examdate.js',
  '../shared/js/lib/intro.js',
  '../shared/js/lib/textsize.js',
  '../shared/js/lib/maplayout.js',
  '../shared/js/lib/weakness.js',
  '../shared/js/views/weak.js',
  '../shared/js/views/later.js',
  '../shared/js/lib/later.js',
  '../shared/js/views/dochi.js',
  '../shared/js/lib/dochi.js',
  '../shared/js/views/forecast.js',
  '../shared/js/lib/forecast.js',
  '../shared/js/lib/boss.js',
  '../shared/js/lib/bossrun.js',
  '../shared/js/lib/bossdata.js',
  '../shared/js/lib/bossmusic.js',
  '../shared/js/views/boss.js',
  '../shared/js/views/intro.js',
  '../shared/js/lib/backup.js',
  '../shared/js/lib/report.js',
];

// 効果音（小さいのでインストール時に取る）。BGM は含めない（最初に流したときに取る）。shared/audio/sfx/ を足したらここにも足す。
const SFX = [
  'ok_gold-coin.ogg',
  'ng_lose-trumpet.ogg',
  'level_8bit-fanfare.ogg',
  'badge_new-thing-get.ogg',
  'stars_sparkle.wav',
  'goal_cure.wav',
  'start_16bit-success.ogg',
  'drop_001.ogg',
  'boss-hit_snare.ogg',
  'boss-win_victory.mp3',
  'boss-hurt_explosion02.ogg',
  'boss-crit_cut.ogg',
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
          const figureIds = new Set(); // 問題・カードの figures が指す図（data/figures/<id>.svg）。オフラインでも出すため、ここで取る
          await Promise.all(
            files.map(async (f) => {
              try {
                const u = new URL('./data/' + f, self.location).href;
                const r = await fetch(u, { cache: 'reload' });
                if (!r.ok) return;
                try {
                  const arr = await r.clone().json();
                  if (Array.isArray(arr)) for (const o of arr) if (o && Array.isArray(o.figures)) for (const id of o.figures) if (typeof id === 'string' && FIGURE_ID.test(id)) figureIds.add(id);
                } catch (e) { /* JSON でないもの（シラバス）は図を持たない */ }
                await cache.put(u, r);
              } catch (e) { /* 取れないものは飛ばす */ }
            })
          );
          // 章のボスの名前・せりふ（data/bosses.json。index.json の bosses で名前を変えてもよい）。無い(404)ときは飛ばす（ボスは汎用の名前とせりふで動く）
          try {
            const bu = new URL('./data/' + (typeof idx.bosses === 'string' && idx.bosses ? idx.bosses : 'bosses.json'), self.location).href;
            const br = await fetch(bu, { cache: 'reload' });
            if (br.ok) await cache.put(bu, br);
          } catch (e) { /* 取れないときは、開いたときに取れれば、そのときキャッシュに入る */ }
          await Promise.all(
            [...figureIds].map(async (id) => {
              try {
                const u = new URL('./data/figures/' + id + '.svg', self.location).href;
                const r = await fetch(u, { cache: 'reload' });
                if (r.ok) await cache.put(u, r);
              } catch (e) { /* 取れない図は飛ばす（開いたときに取れれば、そのときキャッシュに入る） */ }
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
