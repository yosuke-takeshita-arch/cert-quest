// テストが「全部のアプリ」を見るときの一覧と、sw.js の版の下限の確かめ方（テストのファイルではない。npm test の一覧には載せない）。
// 2026-10-13、生成AIパスポート（ai-passport/）を足したとき、8つのテストが ['g-kentei', 'dx-biz'] を決め打ちしていて、
// 新しいアプリを見ていなかった。ここで一度だけ探し、各テストはこれを使う。
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// 地図1つのアプリ: リポジトリ直下のディレクトリで、manifest.webmanifest と config.json があり、config.json に subjects が無いもの。
// 科目のあるアプリ（shindanshi/1ji/ など。1段深い）はここに入らない（データの置き場が data/ ではないため。subjects.test.js が見る）。
export const APPS = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(root, e.name, 'manifest.webmanifest')) && existsSync(join(root, e.name, 'config.json')))
  .map((e) => e.name)
  .filter((a) => !Array.isArray(JSON.parse(readFileSync(join(root, a, 'config.json'), 'utf8')).subjects))
  .sort();

// 一覧が空になったり、知っているアプリが抜けたりしたら、各テストが黙って何も見なくなる。ここで止める
for (const a of ['g-kentei', 'dx-biz', 'ai-passport', 'sc']) {
  if (!APPS.includes(a)) throw new Error('tests/apps.js: ' + a + ' がアプリの一覧に無い（' + APPS.join(', ') + '）');
}

// まだ問題・用語カードが1つも入っていないアプリ（枠だけ。2026-10-29 に情報処理安全確保支援士の sc を足した）。
// 「本物のデータが1件以上ある」ことを求めるテストは、これを除く。問題・カードを入れたら、ここから外す。
export const APPS_WITHOUT_CONTENT = ['sc'];

// 機能を配ったときに「版を N 以上に上げた」ことを確かめるテストは、その時点で公開していたアプリにだけ効かせる。
// 後から作ったアプリ（ai-passport は版 1 から）は、最初の版で全部の機能が入っているので、下限を持たない。
export const PUBLISHED_BEFORE_2026_10_13 = ['g-kentei', 'dx-biz'];

export function swVersion(app) {
  const m = /version:\s*'(\d+)'/.exec(readFileSync(join(root, app, 'sw.js'), 'utf8'));
  return m ? Number(m[1]) : NaN;
}

/** その機能を配ったときの版の下限。後から作ったアプリは 1（版が数字で書いてあることだけ求める） */
export function minVersion(app, n) {
  return PUBLISHED_BEFORE_2026_10_13.includes(app) ? n : 1;
}
