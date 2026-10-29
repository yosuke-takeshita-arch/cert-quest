// このアプリ(scope=sc/)のサービスワーカー。仕組みは ../shared/sw-core.js。
// 配布後に shared/ や このアプリを更新したら、version を上げる（古いキャッシュを捨てる合図）。
self.CERT_QUEST = {
  appId: 'sc',
  version: '1',
  // タイトル・地図・ボス・章のバッジの絵はまだ無い。置いたら appFiles に足す（config.json の titleImage / mapImage も）
  appFiles: ['./', './index.html', './main.js', './config.json', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'],
};
importScripts('../shared/sw-core.js');
