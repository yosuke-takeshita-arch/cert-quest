// このアプリ(scope=sc/)のサービスワーカー。仕組みは ../shared/sw-core.js。
// 配布後に shared/ や このアプリを更新したら、version を上げる（古いキャッシュを捨てる合図）。
self.CERT_QUEST = {
  appId: 'sc',
  version: '8',
  // 章のバッジの絵はまだ無い。地図は章ごとの10枚（config.json の mapImages と同じ並び）
  appFiles: ['./', './index.html', './main.js', './config.json', './manifest.webmanifest', './images/title.webp', './images/logo.webp', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './images/bosses/boss-1.webp', './images/bosses/boss-2.webp', './images/bosses/boss-3.webp', './images/bosses/boss-4.webp', './images/bosses/boss-5.webp', './images/bosses/boss-6.webp', './images/bosses/boss-7.webp', './images/bosses/boss-8.webp', './images/bosses/boss-9.webp', './images/bosses/boss-10.webp', './images/bosses/true-1.webp', './images/map-1.webp', './images/map-2.webp', './images/map-3.webp', './images/map-4.webp', './images/map-5.webp', './images/map-6.webp', './images/map-7.webp', './images/map-8.webp', './images/map-9.webp', './images/map-10.webp'],
};
importScripts('../shared/sw-core.js');
