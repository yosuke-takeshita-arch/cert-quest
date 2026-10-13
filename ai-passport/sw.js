// このアプリ(scope=ai-passport/)のサービスワーカー。仕組みは ../shared/sw-core.js。
// 配布後に shared/ や このアプリを更新したら、version を上げる（古いキャッシュを捨てる合図）。
self.CERT_QUEST = {
  appId: 'ai-passport',
  version: '1',
  // 地図・ボス・章のバッジの絵はまだ無い。置いたら appFiles に足す（地図は config.json の mapImage も）
  appFiles: ['./', './index.html', './main.js', './config.json', './manifest.webmanifest', './images/title.webp', './images/bosses/boss-1.webp', './images/bosses/boss-2.webp', './images/bosses/boss-3.webp', './images/bosses/boss-4.webp', './images/bosses/boss-5.webp', './images/bosses/boss-6.webp', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'],
};
importScripts('../shared/sw-core.js');
