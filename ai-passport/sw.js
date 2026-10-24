// このアプリ(scope=ai-passport/)のサービスワーカー。仕組みは ../shared/sw-core.js。
// 配布後に shared/ や このアプリを更新したら、version を上げる（古いキャッシュを捨てる合図）。
self.CERT_QUEST = {
  appId: 'ai-passport',
  version: '50',
  // ボスの絵は9〜32、章のバッジの絵はまだ無い。置いたら appFiles に足す
  appFiles: ['./', './index.html', './main.js', './config.json', './manifest.webmanifest', './images/title.webp', './images/bosses/true-1.webp', './images/bosses/true-2.webp', './images/bosses/true-3.webp', './images/badges/true-boss.webp', './images/logo.webp', './images/map.webp', './images/map-1.webp', './images/map-2.webp', './images/map-3.webp', './images/map-4a.webp', './images/map-4b.webp', './images/map-5.webp','./images/bosses/boss-1.webp', './images/bosses/boss-2.webp', './images/bosses/boss-3.webp', './images/bosses/boss-4.webp', './images/bosses/boss-5.webp', './images/bosses/boss-6.webp', './images/bosses/boss-7.webp', './images/bosses/boss-8.webp', './images/bosses/boss-9.webp', './images/bosses/boss-10.webp', './images/bosses/boss-11.webp', './images/bosses/boss-12.webp', './images/bosses/boss-13.webp', './images/bosses/boss-14.webp', './images/bosses/boss-15.webp', './images/bosses/boss-16.webp', './images/bosses/boss-17.webp', './images/bosses/boss-18.webp', './images/bosses/boss-19.webp', './images/bosses/boss-20.webp', './images/bosses/boss-21.webp', './images/bosses/boss-22.webp', './images/bosses/boss-23.webp', './images/bosses/boss-24.webp', './images/bosses/boss-25.webp', './images/bosses/boss-26.webp', './images/bosses/boss-27.webp', './images/bosses/boss-28.webp', './images/bosses/boss-29.webp', './images/bosses/boss-30.webp', './images/bosses/boss-31.webp', './images/bosses/boss-32.webp', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'],
};
importScripts('../shared/sw-core.js');
