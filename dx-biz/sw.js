// このアプリ(scope=dx-biz/)のサービスワーカー。仕組みは ../shared/sw-core.js。
// 配布後に shared/ や このアプリを更新したら、version を上げる（古いキャッシュを捨てる合図）。
self.CERT_QUEST = {
  appId: 'dx-biz',
  version: '47',
  appFiles: ['./', './index.html', './main.js', './config.json', './manifest.webmanifest', './images/title.webp', './images/map.webp', './images/badges/major-CORE.webp', './images/badges/major-STRATEGY.webp', './images/badges/major-TECH.webp', './images/badges/major-IMPL.webp', './images/badges/major-SUPP.webp', './images/badges/major-01A.webp', './images/badges/major-02B.webp', './images/badges/major-03G.webp', './images/badges/major-04C.webp', './images/badges/major-05D.webp', './images/badges/major-06E.webp', './images/badges/major-07H.webp', './images/badges/major-08I.webp', './images/badges/major-09J.webp', './images/badges/major-10F.webp', './images/badges/major-11K.webp', './images/badges/major-12L.webp', './images/badges/major-13S.webp', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'],
};
importScripts('../shared/sw-core.js');
