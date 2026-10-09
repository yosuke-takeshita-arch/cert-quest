// このアプリ(scope=g-kentei/)のサービスワーカー。仕組みは ../shared/sw-core.js。
// 配布後に shared/ や このアプリを更新したら、version を上げる（古いキャッシュを捨てる合図）。
self.CERT_QUEST = {
  appId: 'g-kentei',
  version: '64',
  appFiles: ['./', './index.html', './main.js', './config.json', './manifest.webmanifest', './images/title.webp', './images/map.webp', './images/bosses/boss-1.webp', './images/bosses/boss-2.webp', './images/badges/major-T.webp', './images/badges/major-L.webp', './images/badges/major-T-CH01.webp', './images/badges/major-T-CH02.webp', './images/badges/major-T-CH03.webp', './images/badges/major-T-CH04.webp', './images/badges/major-T-CH05.webp', './images/badges/major-T-CH06.webp', './images/badges/major-T-CH07.webp', './images/badges/major-T-CH08.webp', './images/badges/major-L-CH01.webp', './images/badges/major-L-CH02.webp', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'],
};
importScripts('../shared/sw-core.js');
