# shared/ — 資格学習アプリの共通エンジン

素の HTML/CSS/JS（ES modules）。ビルド・npm 依存なし。資格固有のことは書かない。
資格ごとのアプリ（`g-kentei/`、後で `dx-biz/`）は、このエンジンを `../shared/` から読む。

## 構成

- `js/app.js` 起動・ルーティング（`#/home` `#/map` `#/stage/..` `#/cards` `#/card/..` `#/review` `#/exam` `#/more` ほか）
- `js/lib/` ブラウザ非依存のロジック（srs=復習間隔 / scoring=XP・レベル・星 / quiz=シャッフル・出題 / data=読み込み・参照解決 / progress / badges / storage）
- `js/views/` 画面。`css/app.css` 共通スタイル（配色は config の theme が上書き）
- `sw-core.js` サービスワーカー本体。アイコンの PNG は リポジトリ直下の `tools/icon-sheet.cjs` で作る（下の 4.）
- `tests/core.test.js` node だけで動くテスト

## 2つ目のアプリ（dx-biz/）の作り方

1. `g-kentei/` を `dx-biz/` にコピーする（`data/` の中身は除く）。
2. `config.json` を書き換える: `id`（localStorage のキーに使う。資格ごとに必ず別）、`name`、`shortName`、`examDate`、`exam`（問題数・分）、`officialUrl`/`officialLinks`、`theme`（light/dark の accent・onAccent）。
3. `manifest.webmanifest` の `name`/`short_name`/`theme_color`、`index.html` の `<title>`/`theme-color`、`sw.js` の `appId` を書き換える。
4. アイコンは ChatGPT で、全アプリぶんを2x2に白い線で区切った1枚の絵として作る（2026-10-28 先生決定。プロンプトは docs/sources/art-prompts.md「アプリのアイコン」、元の絵は private/icons-src.png）。切り分けて `icons/icon-192.png`・`icon-512.png`（角丸の外は透明）・`icon-maskable-512.png`（絵を8割に縮め、まわりをぼかした同じ絵で埋める）を作る:
   `NODE_PATH=<playwright-core のある node_modules> node tools/icon-sheet.cjs private/icons-src.png <出力先>`（並びは 1 左上 G検定・2 右上 DX・3 左下 生成AIパスポート・4 右下 診断士）
5. `dx-biz/data/` に `index.json` `syllabus.json` `questions/` `concepts/` を置く（形は要件定義書 §7）。動作確認用は `data/_sample/`。
6. `shared/` に手を入れなくても動く。直す必要が出たら両アプリで確かめる。

## 注意

- `shared/` のファイルを増減したら `sw-core.js` の `SHARED` 一覧も直す。
- 公開後に shared/ やアプリ本体を更新したら、各アプリ `sw.js` の `version` を上げる（古いキャッシュを捨てる合図）。
- `?sample=1` は `data/_sample/` を読み、学習記録も別キー（`certquest:<id>:sample:v1`）に保存する。本番の記録を汚さない。
- `index.json` に載っているが存在しないファイル（404）は飛ばして動く。

## テスト

`cd shared && node --test tests/core.test.js`
