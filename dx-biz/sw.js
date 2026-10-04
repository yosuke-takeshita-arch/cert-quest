// このアプリ(scope=dx-biz/)のサービスワーカー。仕組みは ../shared/sw-core.js。
// 配布後に shared/ や このアプリを更新したら、version を上げる（古いキャッシュを捨てる合図）。
self.CERT_QUEST = {
  appId: 'dx-biz',
  version: '14',
  appFiles: ['./', './index.html', './main.js', './config.json', './manifest.webmanifest', './images/title.webp', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'],
};
importScripts('../shared/sw-core.js');
