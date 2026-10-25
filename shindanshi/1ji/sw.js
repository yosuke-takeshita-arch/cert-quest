// このアプリ(scope=shindanshi/1ji/)のサービスワーカー。仕組みは ../../shared/sw-core.js。
// 配布後に shared/ や このアプリを更新したら、version を上げる（古いキャッシュを捨てる合図）。
// dataDirs は科目ごとのデータの置き場（config.json の subjects の folder と同じ。全部先に取って、オフラインでも開けるようにする）。
// ボス・章のバッジの絵は科目ごとに images/<科目id>/ へ置く。置いたら appFiles に足す（いまは絵が無いので載せていない）。
self.CERT_QUEST = {
  appId: 'shindanshi-1ji',
  version: '47',
  sharedBase: '../../shared/',
  dataDirs: ['01_economics', '02_finance-accounting', '03_management-theory', '04_operations', '05_business-law', '06_information-systems', '07_sme-policy'],
  appFiles: ['./', './index.html', './main.js', './config.json', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'],
};
importScripts('../../shared/sw-core.js');
