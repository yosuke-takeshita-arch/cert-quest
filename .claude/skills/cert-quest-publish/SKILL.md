---
name: cert-quest-publish
description: cert-quest（G検定・DXビジネス検定の学習アプリ）を GitHub Pages に公開する手順。先生が「公開して」と言ったとき、または前もって公開の許可をもらった作業が終わったときに使う。service worker の版上げ・検査・push・公開の完了待ち・公開先の確かめ・note 用の会話ログの作り直しまでを1つの流れにする。
---

# cert-quest を公開する

先生は公開の前に毎回「公開して」と言う。言われるまで公開しない。前もって「終わったら公開して」と言われた作業だけ、確かめたあと聞かずに公開してよい。

## 手順（この順で。飛ばさない）

1. **未コミットの変更が無いか見る**: `git status --porcelain`。担当の作業途中のファイルが混ざっていないか。混ざっていたら、その作業が終わるまで公開しない
2. **検査を回す**（全部通ること）
   - `npm --prefix shared test`（`# tests N` が、`shared/tests/*.test.js` を1つずつ回した件数の合計と一致すること。2026-10-09、一覧の空白抜けで2ファイルが黙って回らなかった）
   - `node tools/check-data.js g-kentei/data/concepts/*.json g-kentei/data/questions/*.json`
   - `node tools/check-data-dx.js dx-biz/data/concepts/*.json dx-biz/data/questions/*.json`
   - `node tools/check-answers-unchanged.cjs`（説明文を書き直したとき）
3. **service worker の版を上げる**: `g-kentei/sw.js` と `dx-biz/sw.js` の5行目 `version: 'NN'` を、両方とも同じ番号で1つ上げる（shared/ を変えたら両方。片方だけにしない）
4. **新しいファイルを先取りに載せたか**: 新しい JS は `shared/sw-core.js` の `SHARED`、効果音は `SFX`、ボスの絵は各アプリの `sw.js` の `appFiles`（`./images/bosses/boss-N.webp`）。BGM は初めて流したときに取る（載せない）
5. **コミットして push**: メッセージは「公開のため service worker の版を NN に上げる（何が入るか）」。`git push origin main`
6. **公開の完了を待つ**: `gh api repos/yosuke-takeshita-arch/cert-quest/pages/builds/latest --jq '.status+" "+.commit'` が `built <自分のコミット>` になるまで（10秒おきに。Monitor か until ループ）
7. **公開先を確かめる**（https://yosuke-takeshita-arch.github.io/cert-quest/ ）
   - 両アプリの `sw.js` の版が上げた番号か（`curl -s "<URL>/g-kentei/sw.js?x=$RANDOM" | grep "version: '"`）
   - 今回足した・変えたファイルが 200 で取れるか、中身に今回の変更の目印が入っているか
8. **note 用の会話ログを作り直す**（公開のたびに。元の会話の記録は古いものから消えることがあるので、作り直すことが保存になる）:
   `node ~/.claude/projects/C--Users-Panasonic-Documents-Projects-cert-quest/memory/conversation_log_build.cjs <memory>/conversation_log.md ~/.claude/projects/C--Users-Panasonic-Documents-Projects/86acdb26-1293-400c-b456-9d6b6bf1258e.jsonl ~/.claude/projects/C--Users-Panasonic-Documents-Projects-cert-quest/*.jsonl`
   ログはリポジトリに入れない
9. **先生に伝える**: 版の番号、確かめたこと、実機で見てほしいこと（音・動き・iPhone など、まだ誰も確かめていないこと）

## してはいけないこと
- private/（市販の資料・学会の資料）と会話ログを公開しない（`.gitignore` 済みか `git check-ignore` で確かめる）
- 版を上げずに shared/ の変更を公開しない（入っている人に古いファイルが出続ける）
