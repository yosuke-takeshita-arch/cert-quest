---
name: boss-art-intake
description: 先生が ChatGPT で作った章のボスの絵（PNG）を受け取って、cert-quest に置くまでの手順。背景の抜き（キー色のべた塗り・描き込まれた市松模様）、512px の webp、顔の位置、bosses.json、service worker の先取り、見た目の確かめ、コミット。ボスの絵の画像が貼られたとき、または「ボスの絵を作った」と言われたときに使う。
---

# ボスの絵を受け取って置く

正本: 要件定義書 §3-7（章のボス戦）、`docs/sources/art-prompts.md`（プロンプト・置き場・背景の色）、`docs/sources/boss-characters.md`（見た目の設定）。

## 準備（道具）
`tools/chromakey.cjs`・`tools/unchecker.cjs` は playwright-core と Chrome を使う。作業場所（scratchpad）で `npm i playwright-core ffmpeg-static` し、`NODE_PATH=<作業場所>/node_modules node tools/chromakey.cjs ...` のように動かす（または道具を作業場所に写して動かす）。Chrome は `C:/Program Files/Google/Chrome/Application/chrome.exe`。

## 手順
1. **どのボスか決める**: 番号は地図の章の並び（`<アプリ>/data/bosses.json` の `no`）。G検定と DX で番号が別。絵を見て、`boss-characters.md` の見た目と合っているか（テーマの色・持ち物）を見る
2. **背景を調べる**: 画像の透過の割合と、真っ黒の割合を数える（canvas で alpha を数える）
   - **キー色のべた塗り**（4体目から。ふつうマゼンタ #FF00FF、タタミメ・ウツシミ・サブスクリュウ・デタコは緑 #00FF00）→ `chromakey.cjs <元.png> boss-N.webp 512 magenta|green`
   - **透過になっている** → そのまま 512px の webp にする
   - **透過に見えるが透過の割合が0（市松模様の描き込み）** → `unchecker.cjs <元.png> boss-N.webp 512`（外周からつながる白・薄灰色と、閉じた市松の塊を消す）
3. **目で見る**（必ず）: 黒・白・赤の背景に乗せた画像を撮って見る。背景の取り残し（腕と体のすき間など）、体が欠けていないか（キー色が体に入っていると体も消える）、縁の色かぶり
4. **顔の位置**: 章の画面・地図の小さな丸は、絵の顔を切り抜く（既定は x 0.5・y 0.23）。顔が真ん中・上から2割ほどに無ければ、`bosses.json` のそのボスに `"face": { "x": 0.42, "y": 0.29 }` を足す。丸（直径88px・幅250%に拡大）に切り抜いた画像を撮って、顔が真ん中に来るか確かめる
5. **置く**: `<アプリ>/images/bosses/boss-N.webp`。`<アプリ>/sw.js` の `appFiles` に `'./images/bosses/boss-N.webp'` を足す
6. **検査**: `bosses.json` を JSON として読めるか、`npm --prefix shared test`
7. **コミット**: 「G検定 boss-N（名前）の絵を置く」。背景をどう抜いたか・大きさ・顔の位置を書く
8. **先生に伝える**: 設定どおりに描けているところ、直したところ（背景・顔の位置）、次のボスのプロンプト（`art-prompts.md` から写す。1体ずつ、そのまま貼れる完成した文で）。公開はまとめてか今かを聞く（→ cert-quest-publish）

## 気をつけること
- 先生の ChatGPT には生成回数の制限がある。作り直しを頼むのは本当に要るときだけ
- 画像は1MB を超えて届く。必ず 512px の webp（50〜90KB）にしてから置く
