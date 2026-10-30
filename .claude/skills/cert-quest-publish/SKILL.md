---
name: cert-quest-publish
description: cert-quest（G検定・DXビジネス検定・生成AIパスポートの学習アプリ）を GitHub Pages に公開する手順。先生が「公開して」と言ったとき、または前もって公開の許可をもらった作業が終わったときに使う。service worker の版上げ・検査・push・公開の完了待ち・公開先の確かめ・note 用の会話ログの作り直しまでを1つの流れにする。
---

# cert-quest を公開する

先生は公開の前に毎回「公開して」と言う。言われるまで公開しない。前もって「終わったら公開して」と言われた作業だけ、確かめたあと聞かずに公開してよい。

## 手順（この順で。飛ばさない）

1. **未コミットの変更が無いか見る**: `git status --porcelain`。担当の作業途中のファイルが混ざっていないか。混ざっていたら、その作業が終わるまで公開しない
2. **検査を回す**（全部通ること）
   - `npm --prefix shared test`（`# tests N` が、`shared/tests/*.test.js` を1つずつ回した件数の合計と一致すること。2026-10-09、一覧の空白抜けで2ファイルが黙って回らなかった）
   - `node tools/check-data.js g-kentei/data/concepts/*.json g-kentei/data/questions/*.json`
   - `node tools/check-data-dx.js dx-biz/data/concepts/*.json dx-biz/data/questions/*.json`
   - `node tools/check-data.js ai-passport/data/concepts/*.json ai-passport/data/questions/*.json`（2026-10-18 時点で問題786問・カードあり。毎回回す。組み合わせ問題の COMBO-MODE もここで見る）
   - `node tools/check-data.js sc/data/concepts/*.json sc/data/questions/*.json`（情報処理安全確保支援士。2026-10-30 時点で10章・問題820問・カード668枚。過去問題の出典 `pastExam` と、過去問題がオリジナルより多くないこと〔PAST 行〕もここで見る）
   - `node tools/check-answers-unchanged.cjs`（説明文を書き直したとき。引数を省くと g-kentei・dx-biz・ai-passport・sc を全部見る）
3. **service worker の版を上げる**: `g-kentei/sw.js` と `dx-biz/sw.js` の5行目 `version: 'NN'` を、両方とも同じ番号で1つ上げる（shared/ を変えたら両方。片方だけにしない）
   - `ai-passport/sw.js` の5行目 `version: 'N'` は、G検定・DX と別の番号（2026-10-13 に 1 から始めた）。shared/ か ai-passport/ を変えたら1つ上げる。G検定・DX の番号にそろえない
   - `sc/sw.js` の5行目 `version: 'N'` も独自の番号（2026-10-29 に 1 から始めた。2026-10-30 に版 1 のまま初めて公開。トップの index.html にはリンクを置いていない＝先生だけが使う）。shared/ か sc/ を変えたら1つ上げる
   - `shindanshi/1ji/sw.js` の7行目 `version: 'N'` も独自の番号（2026-10-13 に版 1 のまま初めて公開）。shared/ か shindanshi/1ji/ を変えたら1つ上げる
   - **上げたあと、もう一度 `npm --prefix shared test` を回す**（2026-10-14、版を上げる前にだけ回して公開し、版を '1' に固定したテストが落ちたまま出た）
   - shared/ を変えたら4つとも上げる（どのアプリを入れた人にも古い shared/ が出続けるため）
   - **人に見せる版の番号も上げる**（2026-10-22 先生決定。要件定義書 §3-2-b）: 各アプリの `config.json` の `"appVersion"`（3行目）。前の公開からのコミット（`git log <前の公開>..HEAD -- <アプリ> shared`）を見て、作り直し→1つ目／機能を足した→2つ目／直しだけ→3つ目を1つ上げ、右は0に戻す。アプリごとに別の番号。中身が変わっていないアプリは上げない（sw の版も上げないとき）。ストアに出す日に 1.0.0。コミットメッセージに「G検定 0.9.1」のように書く
4. **新しいファイルを先取りに載せたか**: 新しい JS は `shared/sw-core.js` の `SHARED`、効果音は `SFX`、ボスの絵は各アプリの `sw.js` の `appFiles`（`./images/bosses/boss-N.webp`）。BGM は初めて流したときに取る（載せない）
   - ai-passport は地図・ボス・章のバッジの絵がまだ無い（2026-10-13。タイトルは置いた）。置いたら `appFiles` に足し、地図は config.json の `mapImage` も足す（`shared/tests/appframe.test.js`・`maplayout.test.js` が、絵の有無と一覧・config の食い違いで落とす）
5. **コミットして push**: メッセージは「公開のため service worker の版を NN に上げる（何が入るか）」。`git push origin main`
6. **公開の完了を待つ**: `gh api repos/yosuke-takeshita-arch/cert-quest/pages/builds/latest --jq '.status+" "+.commit'` が `built <自分のコミット>` になるまで（10秒おきに。Monitor か until ループ）
7. **公開先を確かめる**（https://yosuke-takeshita-arch.github.io/cert-quest/ ）
   - 各アプリの `sw.js` の版が上げた番号か（`curl -s "<URL>/g-kentei/sw.js?x=$RANDOM" | grep "version: '"`。dx-biz・ai-passport も同じ）
   - 今回足した・変えたファイルが 200 で取れるか、中身に今回の変更の目印が入っているか
8. **note 用の会話ログを作り直す**（公開のたびに。元の会話の記録は古いものから消えることがあるので、作り直すことが保存になる）:
   `node ~/.claude/projects/C--Users-Panasonic-Documents-Projects-cert-quest/memory/conversation_log_build.cjs <memory>/conversation_log.md ~/.claude/projects/C--Users-Panasonic-Documents-Projects/86acdb26-1293-400c-b456-9d6b6bf1258e.jsonl ~/.claude/projects/C--Users-Panasonic-Documents-Projects-cert-quest/*.jsonl`
   ログはリポジトリに入れない
9. **先生に伝える**: 版の番号、確かめたこと、実機で見てほしいこと（音・動き・iPhone など、まだ誰も確かめていないこと）
   - **アプリを初めて公開したときは、入れ方を必ず書く**: Android Chrome のメニュー「ホーム画面に追加」からは入らない（全アプリが同じオリジンのため。開くと「アプリを開けませんでした」）。ホーム画面の「アプリとしてインストール」ボタンから入れる。メニューから入れて失敗したアイコンは長押しで消してから。2026-10-14（生成AIパスポート）と 2026-10-30（ガードの砦）の2回、書かずに渡して先生に失敗させた

## してはいけないこと
- private/（市販の資料・学会の資料）と会話ログを公開しない（`.gitignore` 済みか `git check-ignore` で確かめる）
- 版を上げずに shared/ の変更を公開しない（入っている人に古いファイルが出続ける）
