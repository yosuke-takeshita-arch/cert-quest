// このアプリ(scope=dx-biz/)のサービスワーカー。仕組みは ../shared/sw-core.js。
// 配布後に shared/ や このアプリを更新したら、version を上げる（古いキャッシュを捨てる合図）。
self.CERT_QUEST = {
  appId: 'dx-biz',
  version: '41',
  appFiles: ['./', './index.html', './main.js', './config.json', './manifest.webmanifest', './images/title.webp', './images/map.webp', './images/badges/major-B.webp', './images/badges/major-M.webp', './images/badges/major-C.webp', './images/badges/major-CH01.webp', './images/badges/major-CH02.webp', './images/badges/major-CH03.webp', './images/badges/major-CH04.webp', './images/badges/major-CH05.webp', './images/badges/major-CH06.webp', './images/badges/major-CH07.webp', './images/badges/major-CH08.webp', './images/badges/major-CH09.webp', './images/badges/major-CH10.webp', './images/badges/major-CH11.webp', './images/badges/major-CH12.webp', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'],
};
importScripts('../shared/sw-core.js');
