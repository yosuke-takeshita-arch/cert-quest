# 解説に図を入れる計画（G検定・DXビジネス検定）

- 作成日：2026-10-04
- 状態：**計画のみ**。図（SVG）・コード・データ（`*/data/`）はまだ何も作っていない、変えていない
- 出発点（先生の声）：文字だけだと分かりづらいものが多い。図があると分かりやすいものは図も入れたい

## 1. 前提（決めてあること）

- 図は SVG（線と文字で描く図）で、こちらで描く。仕組みの図・グラフ・表・流れ図・位置関係の図など、正確さが要るもの向け
- 図は用語カード（concepts）と問題の解説の両方から使う。1枚の図を複数のカード・問題で使い回す
- 図の中身もオリジナルで描く。教科書・論文の図をなぞらない
- 図に書く数値・関係は、そのカードの `sources` の一次情報と食い違わないこと

## 2. 選び方

全カード（G検定 443枚、DX 230枚）と全問題（G検定 549問、DX 307問）の題・1行説明・問題文・紐づくカードを読み、次のどれかに当たり、かつ図にすると理解が大きく変わるものを選んだ。

- 仕組み・構造（CNN の畳み込み、Transformer、データ活用基盤 など）
- 形を見れば分かるもの（活性化関数、過学習の曲線、ROC 曲線、ロングテール など）
- 手順・流れ（勾配降下、k-means の繰り返し、エスクロー など）
- 対比（SVM のハード／ソフトマージン、O2O／オムニチャネル／OMO など）
- 表にすると早いもの（混同行列、クラウドの管理範囲、ロックインの7つの型 など）
- 計算の途中が見えると分かるもの（ハノイの塔、ベイズの定理の面積図、畳み込みのパラメータ数 など）

選ばなかったもの（文字で十分なもの）：

- 定義だけで足りるもの（AI 効果、ハルシネーション、ペルソナの定義だけを問う問題 など）
- 歴史の出来事・人名・年（ダートマス会議、DENDRAL、MYCIN、ELIZA、ワトソン、東ロボくん、AlphaStar など）。AI ブームの年表も「歴史の出来事」として外した（→ §5 迷ったもの）
- 思考実験・哲学的な論点（中国語の部屋、フレーム問題、シンボルグラウンディング問題、トロッコ問題）
- 法律の条文・ガイドラインの記述（G検定 09章・10章の大半、DX 01章の各レポートの主張の大半）。例外として、範囲の入れ子・段階の構造が見えると取り違えが減るもの（個人情報の範囲、EU AI 法の4区分、知的財産権の木）だけを選んだ
- 個別企業の事実（DX 09〜12章のメルカリ・Notion・Vitality・IKEA などの個社の説明）。各章に共通する「型」の図と、ZARA 型の循環の図だけを選んだ
- マーケティング・消費の用語で、例を読めば足りるもの（ナッジ、ゲーミフィケーション、インフルエンサー、ハッシュタグ、キュレーション、ショート動画、ライブコマース、フィンテック などの造語、SDGs、カーボンニュートラル）

## 3. 数え方と、この計画の読み方

- 件数はすべて、作業用の検査スクリプトでデータ（`g-kentei/data/`・`dx-biz/data/`）を読んで数えたもの。検査は、図に挙げたカード ID・問題 ID がデータに実在すること、各問題が図のカードのどれかを `concepts` に持つこと、図 ID の重複が無いことを確かめた（わざと存在しない問題 ID を1つ入れ、落ちることを1回確かめた）
- 優先度：**A**＝試験でよく問われ、文字だけでは特に分かりにくい／**B**＝図があると明らかに分かりやすい／**C**＝あると助かるが文字でも足りる
- 「使う問題」は、その図を解説に添えると答えの理由が分かりやすくなる問題。「使うカード」は、その図をカードに添えるもの。1枚のカード・1問が複数の図に出てくることがある
- 「根拠にする一次情報」は、使うカードの `sources` をそのまま並べたもの。図を描く人は、描く数値・関係をここで確かめる
- 図の中の例の数値（混同行列の件数、ベイズの面積図の割合、距離の2点 など）は**自作の例**で、問題の数値と同じにならないようにしてある（問題の答えを図が先に見せないため）。描くときも問題の数値をそのまま使わない

## 4. 件数のまとめ

| 資格 | A | B | C | 図の数 | 図を使うカード | 図を使う問題 |
|---|---|---|---|---|---|---|
| G検定 | 44 | 63 | 20 | 127 | 324 / 443 | 380 / 549 |
| DXビジネス検定 | 14 | 37 | 9 | 60 | 151 / 230 | 202 / 307 |

章ごとの件数と優先度 A の一覧は、各資格の節の先頭にある。

## 5. 迷ったもの・決めていないこと

1. **図をどこに持たせるか（データの形）**：要件定義書 §7 の問題・カードのデータの形には、図を指す項目が無い。カードと問題から図を参照するには項目を足す必要がある（例：`figures: ["fig-g-cnn-conv"]`）。データの形を変えることになるので、この計画では決めていない
2. **資格をまたぐ図の共用**：AI・機械学習・ディープラーニングの包含関係（fig-g-ai-ml-dl と fig-dx-ai-ml-dl）、相関と疑似相関（fig-g-spurious-correlation と fig-dx-correlation）、クラウドの形態（fig-g-cloud-models と fig-dx-cloud-models）は、ほぼ同じ図になる。1枚を両方の資格で使うか、資格ごとに置くかは 1. と合わせて決める。この計画では資格ごとに別の ID で数えた
3. **G検定の優先度 A が 44件と多い**：基準どおりに付けると、03〜05章（機械学習・ディープラーニングの仕組み）にほとんどが集まった。最初に描く範囲を絞るなら、A のうち使う問題数が多いもの（混同行列 6問、活性化関数 7問、正規化 6問、データ拡張 6問、畳み込みの計算 6問、仮説検定 7問 など）から始めるのがよい
4. **出典に数値が無いかもしれない図**：正規分布の「±1σ に約68%・±2σ に約95%」と中心極限定理の σ/√n（fig-g-normal-distribution）、標本化周波数の半分まで記録できること（fig-g-pcm）、CNN のモデル比較表の年・層数（fig-g-cnn-models）は、カードの1行説明・説明文に書かれていない。描く前に出典で確かめ、無ければ出典を足すか数値を描かない（各図の「描く前に確かめること」に書いた）
5. **法律の図（G検定 09章）**：個人情報の範囲の入れ子（fig-g-personal-data-scope）と知的財産権の木（fig-g-ip-map）は、構造が見えると取り違えが減る一方、義務の書き分けを誤ると誤りを図で固めてしまう。優先度を B・C にとどめ、条番号を図に入れず、e-Gov の原文で確かめてから描く前提にした
6. **AI ブームの年表**：3つのブーム（探索・推論／知識／機械学習）の年表は問題も多いが、§2 の「歴史の出来事は選ばない」に当たるので外した。必要なら C で足す
7. **LSTM のゲート**：原論文（1997）は入力ゲートと出力ゲートだけで、忘却ゲートは後から加わった（C-05-027 の記述）。図で3つのゲートを同列に描くと G-05-056 の論点と食い違うので、忘却ゲートを「のちに追加」と区別して描く指定にした
8. **status が verified でないカード**：DX の5つの図が、verified でないカード6枚（DC-05-005、DC-06-008、DC-06-014、DC-07-014、DC-07-019、DC-07-021）を使う（各図の「注意」に ID を書いた）。G検定の図には無い。図を描く前に、そのカードの確認を先に済ませるのがよい

## G検定

### G検定：章ごとの件数

「図の数」は、その章を主な置き場所とする図の数。「図を使うカード／問題」は、その章のカード・問題のうち、どれか1枚以上の図に名前が挙がったものの数（ほかの章の図から使われるものも数える）。

| 章 | A | B | C | 図の数 | 図を使うカード | 図を使う問題 |
|---|---|---|---|---|---|---|
| 01 人工知能とは | 0 | 1 | 0 | 1 | 6 / 20 | 4 / 25 |
| 02 人工知能をめぐる動向 | 2 | 3 | 1 | 6 | 16 / 41 | 17 / 44 |
| 03 機械学習の概要 | 12 | 10 | 2 | 24 | 62 / 64 | 63 / 65 |
| 04 ディープラーニングの概要 | 8 | 7 | 2 | 17 | 44 / 47 | 45 / 50 |
| 05 ディープラーニングの要素技術 | 12 | 6 | 0 | 18 | 49 / 50 | 58 / 59 |
| 06 ディープラーニングの応用例 | 5 | 21 | 6 | 32 | 85 / 98 | 90 / 98 |
| 07 AI の社会実装に向けて | 1 | 7 | 2 | 10 | 15 / 27 | 27 / 44 |
| 08 AI に必要な数理・統計知識 | 4 | 5 | 4 | 13 | 27 / 27 | 53 / 53 |
| 09 AIに関する法律と契約 | 0 | 1 | 1 | 2 | 12 / 33 | 11 / 57 |
| 10 AI倫理・AIガバナンス | 0 | 2 | 2 | 4 | 8 / 36 | 12 / 54 |
| **計** | **44** | **63** | **20** | **127** | **324 / 443** | **380 / 549** |

### G検定：優先度 A の一覧

| 図 ID | 題 | 章 | 使うカード数 | 使う問題数 |
|---|---|---|---|---|
| fig-g-search-bfs-dfs | 幅優先探索と深さ優先探索の訪問順 | 02 | 4 | 3 |
| fig-g-minimax-alphabeta | Mini-Max法とαβ法の枝刈り | 02 | 3 | 2 |
| fig-g-svm-margin | SVM のマージン最大化（ハードマージンとソフトマージン） | 03 | 2 | 2 |
| fig-g-kernel-trick | カーネルトリック（高次元に写すと直線で分けられる） | 03 | 2 | 1 |
| fig-g-bagging-boosting | バギングとブースティング（並列と逐次） | 03 | 6 | 6 |
| fig-g-kmeans | k-means 法の繰り返し（割り当て→中心の更新） | 03 | 2 | 1 |
| fig-g-pca | 主成分分析（ばらつきの大きい方向に軸をとる） | 03 | 5 | 3 |
| fig-g-rl-loop | 強化学習の枠組み（エージェントと環境・割引累積報酬） | 03 | 4 | 5 |
| fig-g-q-sarsa-td | TD 学習の更新と、Q学習（方策オフ）とSARSA（方策オン）の違い | 03 | 4 | 4 |
| fig-g-overfitting | 過学習（訓練誤差と検証誤差の曲線）と早期終了 | 03 | 3 | 2 |
| fig-g-bias-variance | バイアスとバリアンスのトレードオフ | 03 | 2 | 1 |
| fig-g-validation | ホールドアウト検証と k-分割交差検証 | 03 | 3 | 3 |
| fig-g-confusion-matrix | 混同行列と正解率・適合率・再現率・F値 | 03 | 3 | 6 |
| fig-g-roc-auc | ROC 曲線と AUC | 03 | 2 | 3 |
| fig-g-perceptron-xor | 単純パーセプトロンの限界（XOR は直線で分けられない） | 04 | 3 | 2 |
| fig-g-activation | 活性化関数のグラフと微分（シグモイド・tanh・ReLU・Leaky ReLU） | 04 | 6 | 7 |
| fig-g-l1-l2 | L1 正則化と L2 正則化（なぜ L1 は重みを0にするか） | 04 | 4 | 5 |
| fig-g-backprop | 誤差逆伝播法と連鎖律（計算グラフ） | 04 | 3 | 4 |
| fig-g-vanishing-gradient | 勾配消失・勾配爆発と勾配クリッピング | 04 | 3 | 5 |
| fig-g-gradient-descent | 勾配降下法と学習率の大きさ | 04 | 3 | 4 |
| fig-g-local-min-saddle | 局所最適解・大域最適解・鞍点 | 04 | 3 | 3 |
| fig-g-optimizers | 最適化手法の系譜とモーメンタムの効果 | 04 | 7 | 5 |
| fig-g-conv-op | 畳み込みの計算・ストライド・パディングと出力サイズ | 05 | 5 | 6 |
| fig-g-conv-params | 畳み込み層のパラメータ数（全結合層との比較） | 05 | 3 | 2 |
| fig-g-pooling | 最大値・平均値プーリング、GAP と位置ずれへの不変性 | 05 | 3 | 4 |
| fig-g-normalization | 正規化の種類と平均・分散をとる範囲（バッチ・レイヤー・インスタンス・グループ） | 05 | 4 | 6 |
| fig-g-skip-connection | スキップ結合と残差学習（ResNet）、DenseNet との違い | 05 | 5 | 6 |
| fig-g-rnn-unroll | RNN の回帰結合と時間方向の展開（BPTT・教師強制） | 05 | 4 | 4 |
| fig-g-lstm-gru | LSTM のセルとゲート、GRU との比較 | 05 | 4 | 5 |
| fig-g-seq2seq-attention | Seq2Seq（固定長ベクトル）と Attention | 05 | 5 | 5 |
| fig-g-transformer | Transformer の構成 | 05 | 5 | 4 |
| fig-g-qkv | Attention の計算（クエリ・キー・バリュー）とデコーダのマスク | 05 | 3 | 4 |
| fig-g-autoencoder-vae | オートエンコーダと VAE（潜在表現を点で持つか分布で持つか） | 05 | 4 | 5 |
| fig-g-data-augmentation | 画像のデータ拡張の種類（Flip・Crop・Cutout・Random Erasing・Mixup・CutMix） | 05 | 5 | 6 |
| fig-g-vision-tasks | 画像認識タスクの違い（分類・検出・セグメンテーション3種・姿勢推定） | 06 | 3 | 4 |
| fig-g-object-detection | 物体検出の2段階型と1段階型 | 06 | 6 | 4 |
| fig-g-word2vec | word2vec の CBOW とスキップグラム | 06 | 3 | 3 |
| fig-g-bert-gpt | BERT（双方向・エンコーダ）と GPT（左から右・デコーダ） | 06 | 4 | 3 |
| fig-g-pcm | A-D 変換（標本化・量子化・符号化）と標本化周波数 | 06 | 1 | 2 |
| fig-g-cloud-models | オンプレミス・IaaS・PaaS・SaaS の管理範囲 | 07 | 2 | 3 |
| fig-g-bayes-area | 条件付き確率とベイズの定理の面積図 | 08 | 4 | 6 |
| fig-g-correlation | 散布図と相関係数（強さ・向き・非線形の落とし穴） | 08 | 3 | 6 |
| fig-g-distances | 距離と類似度（ユークリッド・マンハッタン・チェビシェフ・コサイン） | 08 | 1 | 5 |
| fig-g-hypothesis-test | 仮説検定（棄却域・p値・第一種と第二種の過誤） | 08 | 3 | 7 |

### G検定：図ごとの計画（A → B → C、同じ優先度の中は章の順）

#### fig-g-search-bfs-dfs　幅優先探索と深さ優先探索の訪問順

- 優先度：**A**　／　主な章：02 人工知能をめぐる動向
- 何を描くか：同じ探索木（根A、子B・C、孫D・E・F・G の2段の二分木）を左右に2つ並べる。左＝幅優先：節点に訪問順の番号 1〜7 を A,B,C,D,E,F,G の順で振り、同じ深さを横になめる破線矢印。下に「キュー（先入れ先出し）」の箱に B,C が入り D,E が後ろに並ぶ様子。右＝深さ優先：A,B,D,E,C,F,G の順に番号、行き止まりで戻る矢印（D→B→E）。下に「スタック／再帰」。下段に1行の対比表（メモリ：幅優先は多い／深さ優先は少ない、最短経路：幅優先は見つかる）。
- 文字より分かる理由：訪問の順番は文章で追うと混乱するが、番号付きの木なら一目で違いが分かる。
- 使うカード（4）：C-02-002（探索木）、C-02-003（幅優先探索）、C-02-004（深さ優先探索）、C-02-006（ブルートフォース）
- 使う問題（3）：G-02-002、G-02-003、G-02-010
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省 令和6年版 情報通信白書 第1〜3次AIブームと冬の時代](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r06/html/nd131110.html)（C-02-002）
  - [NIST Dictionary of Algorithms and Data Structures: breadth-first search](https://xlinux.nist.gov/dads/HTML/breadthfirst.html)（C-02-003）
  - [NIST Dictionary of Algorithms and Data Structures: depth-first search](https://xlinux.nist.gov/dads/HTML/depthfirst.html)（C-02-004）
  - [NIST Dictionary of Algorithms and Data Structures: brute force](https://xlinux.nist.gov/dads/HTML/bruteforce.html)（C-02-006）

#### fig-g-minimax-alphabeta　Mini-Max法とαβ法の枝刈り

- 優先度：**A**　／　主な章：02 人工知能をめぐる動向
- 何を描くか：3段のゲーム木（根＝自分の手番 MAX、2段目＝相手の手番 MIN が3つ、葉が各3つで計9）。葉に評価値（自作の例：5,9,4 / 3,7,8 / 6,2,10。教科書の図の値は使わない）。MIN 節点に下からの最小値（4 / 3 / 2）、根に最大値 4 を書き、選ばれた経路を太線。αβ法の版を右に並べ、2つ目の MIN 節点で最初の葉 3 を見た時点で「この MIN は 3 以下に決まり、根はすでに 4 を確保 → 残り 7,8 は見ない」と枝に×印。3つ目の MIN 節点も葉 6, 2 と見た時点で 2 ＜ 4 となり残り 10 を刈る。どちらのカット（αカット／βカット）に当たるかは C-02-008 の出典の定義に合わせて吹き出しに書く。凡例：MAX は▲、MIN は▼。
- 文字より分かる理由：「どの枝を見なくてよいか」は、数値を書き込んだ木で順に追わないと理解しにくい。
- 使うカード（3）：C-02-007（Mini-Max法）、C-02-008（αβ法）、C-02-006（ブルートフォース）
- 使う問題（2）：G-02-005、G-02-006
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [NIST Dictionary of Algorithms and Data Structures: minimax](https://xlinux.nist.gov/dads/HTML/minimax.html)（C-02-007）
  - [JDLA G検定シラバス 2024（第1.4版）](https://www.jdla.org/certificate/general/)（C-02-008）
  - [MIT OpenCourseWare 6.034 Artificial Intelligence (Fall 2010) Mega-Recitation 3: Games, Minimax, Alpha-Beta（講義記録）](https://ocw.mit.edu/courses/6-034-artificial-intelligence-fall-2010/e83131e9d1eddde294b6a86bb6580c55_hM2EAvMkhtk.pdf)（C-02-008）
  - [松尾豊「人工知能の未来 －ディープラーニングの先にあるもの－」（経済産業研究所 BBLセミナー資料、2015年6月3日）](https://www.rieti.go.jp/jp/events/bbl/15060301.pdf)（C-02-008）
  - [NIST Dictionary of Algorithms and Data Structures: brute force](https://xlinux.nist.gov/dads/HTML/bruteforce.html)（C-02-006）

#### fig-g-svm-margin　SVM のマージン最大化（ハードマージンとソフトマージン）

- 優先度：**A**　／　主な章：03 機械学習の概要
- 何を描くか：左：2クラスの点（○と×）を分ける直線（超平面）と、その両側に平行な破線2本。破線上の点を塗りつぶして「サポートベクター」、破線間の幅に両矢印で「マージン（最大化する）」。比較として、マージンの狭い別の境界線を薄い色で。右：ソフトマージン版。破線の内側や反対側にはみ出した点にスラック変数 ξ の短い矢印。注記「C が大きい＝はみ出しに厳しい（マージン狭く、過学習ぎみ）／C が小さい＝はみ出しを許す（マージン広い）」。
- 文字より分かる理由：マージン・サポートベクター・はみ出しの関係は位置関係そのものなので、図でないと伝わりにくい。
- 使うカード（2）：C-03-011（サポートベクターマシン (SVM)）、C-03-012（マージン最大化）
- 使う問題（2）：G-03-005、G-03-051
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Support Vector Machines](https://scikit-learn.org/stable/modules/svm.html)（C-03-011、C-03-012）
  - [Cortes & Vapnik (1995) Support-Vector Networks. Machine Learning 20, 273-297](https://link.springer.com/article/10.1007/BF00994018)（C-03-011、C-03-012）

#### fig-g-kernel-trick　カーネルトリック（高次元に写すと直線で分けられる）

- 優先度：**A**　／　主な章：03 機械学習の概要
- 何を描くか：左：1次元の数直線上に、中央に×、両端に○が並ぶ（直線1本では分けられない）。右：各点 x を (x, x²) に写した2次元の図。○は放物線の上の方、×は下の方に来て、水平な直線で分けられる。中央の矢印に「写像 φ」。下に注記：カーネルトリックは φ を実際に計算せず、内積 φ(x)·φ(x′) をカーネル関数で直接求める。
- 文字より分かる理由：「次元を上げると分けられる」が、1次元→2次元の具体例で目に見える。
- 使うカード（2）：C-03-013（カーネル・カーネルトリック）、C-03-011（サポートベクターマシン (SVM)）
- 使う問題（1）：G-03-006
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Support Vector Machines](https://scikit-learn.org/stable/modules/svm.html)（C-03-013、C-03-011）
  - [Cortes & Vapnik (1995) Support-Vector Networks. Machine Learning 20, 273-297](https://link.springer.com/article/10.1007/BF00994018)（C-03-011）

#### fig-g-bagging-boosting　バギングとブースティング（並列と逐次）

- 優先度：**A**　／　主な章：03 機械学習の概要
- 何を描くか：上段＝バギング：元データ → ブートストラップ（復元抽出、同じ点が重複する様子を色付きの玉で）で3つのデータ → 3つのモデルを横並び（並列）→ 多数決／平均。ランダムフォレストは「各分割で特徴量もランダムに一部だけ」と注記。下段＝ブースティング：モデル1 → 間違えた点を大きく描く（重みを上げる）→ モデル2 → … と縦につながる（逐次）→ 重み付きで合成。勾配ブースティングは「前の誤差（負の勾配）を次の木が予測して足す」と注記。
- 文字より分かる理由：並列か逐次か、何を次に渡すかが、2段の流れ図で対比できる。
- 使うカード（6）：C-03-015（アンサンブル学習）、C-03-016（ランダムフォレスト）、C-03-017（バギング）、C-03-018（ブースティング）、C-03-019（勾配ブースティング）、C-03-020（ブートストラップサンプリング）
- 使う問題（6）：G-03-008、G-03-009、G-03-010、G-03-011、G-03-013、G-03-053
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Ensembles](https://scikit-learn.org/stable/modules/ensemble.html)（C-03-015、C-03-016、C-03-017、C-03-018、C-03-019、C-03-020）
  - [Breiman (2001) Random Forests. Machine Learning](https://link.springer.com/article/10.1023/A:1010933404324)（C-03-016）

#### fig-g-kmeans　k-means 法の繰り返し（割り当て→中心の更新）

- 優先度：**A**　／　主な章：03 機械学習の概要
- 何を描くか：k＝3 の4コマ。①点をばらまき、初期中心を3つの★で置く。②各点を最も近い★の色に塗る（境界線を薄く）。③各色の点の平均の位置へ★を移動（移動前の★を点線で残し矢印）。④割り当て直し、変化がなくなったら終了。下に注記「k は事前に決める／初期値で結果が変わる／非階層型」。
- 文字より分かる理由：「割り当て」と「中心の更新」の2手順の繰り返しは、コマ送りで見るのが最も早い。
- 使うカード（2）：C-03-023（k-means法）、C-03-022（クラスタリング）
- 使う問題（1）：G-03-014
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Clustering（K-means）](https://scikit-learn.org/stable/modules/clustering.html)（C-03-023、C-03-022）

#### fig-g-pca　主成分分析（ばらつきの大きい方向に軸をとる）

- 優先度：**A**　／　主な章：03 機械学習の概要
- 何を描くか：斜めに細長く広がった2次元の散布図。最も長く伸びた方向に太い矢印「第1主成分」、それに直交する短い矢印「第2主成分」。右に、第1主成分の軸に点を射影して1次元に並べた図（次元削減）。注記「軸どうしは直交」「第1主成分が説明する分散が最大」。t-SNE は非線形で可視化向け、MDS は距離を保つ配置、と1行ずつ対比。
- 文字より分かる理由：「ばらつきを最もよく説明する軸」は、楕円状の点群に矢印を描くと一目で分かる。
- 使うカード（5）：C-03-026（主成分分析 (PCA)）、C-03-027（次元削減）、C-03-029（t-SNE）、C-03-030（多次元尺度構成法 (MDS)）、C-03-028（特異値分解 (SVD)）
- 使う問題（3）：G-03-017、G-03-018、G-03-019
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Decomposing signals in components（PCA）](https://scikit-learn.org/stable/modules/decomposition.html)（C-03-026、C-03-027、C-03-028）
  - [van der Maaten & Hinton (2008) Visualizing Data using t-SNE. JMLR](https://www.jmlr.org/papers/v9/vandermaaten08a.html)（C-03-029）
  - [scikit-learn User Guide: Manifold learning](https://scikit-learn.org/stable/modules/manifold.html)（C-03-029、C-03-030）

#### fig-g-rl-loop　強化学習の枠組み（エージェントと環境・割引累積報酬）

- 優先度：**A**　／　主な章：03 機械学習の概要
- 何を描くか：左：エージェントの箱と環境の箱。エージェント→環境に「行動 aₜ」、環境→エージェントに「状態 sₜ₊₁」「報酬 rₜ₊₁」。マルコフ性の注記「次の状態は今の状態と行動だけで決まる」。右：時間軸に報酬 r₁, r₂, r₃… を並べ、その下に γ⁰, γ¹, γ² を掛けた棒（γ＝0.9 の例で 1, 0.9, 0.81…と短くなる）。「γ が1に近い＝遠い将来も重視、0に近い＝目先重視」。
- 文字より分かる理由：やり取りの循環と、割引で将来の報酬が小さく数えられる様子が同時に見える。
- 使うカード（4）：C-03-036（強化学習）、C-03-037（マルコフ決定過程）、C-03-038（割引率）、C-01-004（エージェント）
- 使う問題（5）：G-03-025、G-03-026、G-03-027、G-03-034、G-01-006
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Sutton & Barto (2018) Reinforcement Learning: An Introduction, 2nd ed.](http://incompleteideas.net/book/RLbook2020.pdf)（C-03-036、C-03-037、C-03-038、C-01-004）
  - [JDLA G検定シラバス 2024（第1.4版）](https://www.jdla.org/certificate/general/)（C-01-004）
  - [総務省・経済産業省「AI事業者ガイドライン（第1.2版）本編」（令和8年3月31日）](https://www.meti.go.jp/shingikai/mono_info_service/ai_shakai_jisso/pdf/20260331_1.pdf)（C-01-004）

#### fig-g-q-sarsa-td　TD 学習の更新と、Q学習（方策オフ）とSARSA（方策オン）の違い

- 優先度：**A**　／　主な章：03 機械学習の概要
- 何を描くか：上段：TD(0) の更新を数直線で。今の見積もり V(s)、目標 r＋γV(s′)、その差（TD誤差）に学習率 α を掛けた分だけ V(s) を目標側へ動かす矢印。下段：状態 s′ から伸びる3本の行動の枝（Q値 例 2・5・3）。Q学習は「最大の 5 を使う」（実際に選ぶ行動と無関係）、SARSA は「実際に選んだ行動（ε-greedy で選ばれた 3 の枝）を使う」と、使う枝を色分け。
- 文字より分かる理由：更新に「次のどのQ値を使うか」の1点の違いが、同じ枝の図で色分けすると明確になる。
- 使うカード（4）：C-03-040（Q学習）、C-03-041（SARSA）、C-03-063（TD学習（時間的差分学習））、C-03-039（状態価値関数・行動価値関数）
- 使う問題（4）：G-03-028、G-03-060、G-03-061、G-03-032
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Sutton & Barto (2018) Reinforcement Learning: An Introduction, 2nd ed.（6.5 Q-learning: Off-policy TD Control）](http://incompleteideas.net/book/RLbook2020.pdf)（C-03-040、C-03-041、C-03-063、C-03-039）

#### fig-g-overfitting　過学習（訓練誤差と検証誤差の曲線）と早期終了

- 優先度：**A**　／　主な章：03 機械学習の概要
- 何を描くか：横軸＝学習の進み（エポック）、縦軸＝誤差。訓練誤差は下がり続ける曲線、検証誤差はいったん下がって途中から上がる曲線。検証誤差の最小点に縦の破線「ここで止める＝早期終了」。左側に「未学習」、右側に「過学習（訓練誤差は小さいが汎化誤差が大きい）」の帯。横に小さく、点に対して直線（未学習）／ちょうどよい曲線／全点を通るくねくね曲線（過学習）の3つの当てはめの絵。
- 文字より分かる理由：2本の曲線の開き方で「どこからが過学習か」と「どこで止めるか」が見える。
- 使うカード（3）：C-03-048（汎化性能）、C-03-049（過学習）、C-04-040（早期終了）
- 使う問題（2）：G-03-043、G-04-037
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Google for Developers: ML Crash Course - Overfitting](https://developers.google.com/machine-learning/crash-course/overfitting/overfitting)（C-03-048、C-03-049）
  - [scikit-learn User Guide: Cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html)（C-03-049）
  - [Google for Developers: Machine Learning Glossary（early stopping）](https://developers.google.com/machine-learning/glossary)（C-04-040）

#### fig-g-bias-variance　バイアスとバリアンスのトレードオフ

- 優先度：**A**　／　主な章：03 機械学習の概要
- 何を描くか：左：横軸＝モデルの複雑さ、縦軸＝誤差。バイアス（二乗）は右下がり、バリアンスは右上がり、合計（汎化誤差）は U 字。最小点に印。右：的当ての4枚（低バイアス低バリアンス／高バイアス低バリアンス／低バイアス高バリアンス／高高）で、中心からのずれ＝バイアス、散らばり＝バリアンス。
- 文字より分かる理由：2つの誤差の増減が逆向きで、合計が U 字になる関係はグラフでないと掴みにくい。
- 使うカード（2）：C-03-064（バイアスとバリアンス）、C-03-049（過学習）
- 使う問題（1）：G-03-063
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 5 Machine Learning Basics（著者公開版）](https://www.deeplearningbook.org/contents/ml.html)（C-03-064）
  - [Google for Developers: ML Crash Course - Overfitting](https://developers.google.com/machine-learning/crash-course/overfitting/overfitting)（C-03-049）
  - [scikit-learn User Guide: Cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html)（C-03-049）

#### fig-g-validation　ホールドアウト検証と k-分割交差検証

- 優先度：**A**　／　主な章：03 機械学習の概要
- 何を描くか：上：データ全体の帯を「訓練／検証／テスト」に1回だけ切る（ホールドアウト）。下：同じ帯を5等分し、5行にわたって評価用の1区画の位置を1つずつずらす（k＝5）。右端に各回のスコアと「平均」。注記「テストデータはモデル選びに使わない」。
- 文字より分かる理由：どの区画が何回評価に使われるかが、ずらした帯で一目で分かる。
- 使うカード（3）：C-03-050（ホールドアウト検証）、C-03-051（交差検証・k-分割交差検証）、C-03-048（汎化性能）
- 使う問題（3）：G-03-044、G-03-045、G-03-065
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html)（C-03-050、C-03-051）
  - [Google for Developers: ML Crash Course - Dividing the original dataset](https://developers.google.com/machine-learning/crash-course/overfitting/dividing-datasets)（C-03-050）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 5 Machine Learning Basics（著者公開版）](https://www.deeplearningbook.org/contents/ml.html)（C-03-050）
  - [Google for Developers: ML Crash Course - Overfitting](https://developers.google.com/machine-learning/crash-course/overfitting/overfitting)（C-03-048）

#### fig-g-confusion-matrix　混同行列と正解率・適合率・再現率・F値

- 優先度：**A**　／　主な章：03 機械学習の概要
- 何を描くか：2×2の表（行＝実際 陽性／陰性、列＝予測 陽性／陰性）。セルに TP・FN・FP・TN と例の件数（TP 30、FN 10、FP 20、TN 140、計200）。表の右に4つの式を、使うセルを同じ色で塗った小さな表と並べる：正解率＝(TP+TN)/全体、適合率＝TP/(TP+FP)（予測陽性の列）、再現率＝TP/(TP+FN)（実際陽性の行）、F値＝2PR/(P+R)。例の数値での計算結果（正解率 0.85、適合率 0.60、再現率 0.75、F値 約0.67）も書く。FP＝誤検知、FN＝見逃し。
- 文字より分かる理由：どの指標が「列」でどれが「行」かは、色分けした表で見るのが最も早い。
- 使うカード（3）：C-03-052（混同行列）、C-03-053（真陽性・真陰性・偽陽性・偽陰性）、C-03-054（正解率・適合率・再現率・F値）
- 使う問題（6）：G-03-035、G-03-036、G-03-037、G-03-038、G-03-048、G-03-064
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Metrics and scoring（Confusion matrix）](https://scikit-learn.org/stable/modules/model_evaluation.html)（C-03-052、C-03-053、C-03-054）
  - [Google for Developers: ML Crash Course - Accuracy, precision, recall](https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall)（C-03-054）

#### fig-g-roc-auc　ROC 曲線と AUC

- 優先度：**A**　／　主な章：03 機械学習の概要
- 何を描くか：横軸＝偽陽性率（FP/(FP+TN)）、縦軸＝真陽性率（再現率）。左上へふくらんだ曲線、対角線（ランダム、AUC＝0.5）、左上の角を通る線（完全、AUC＝1）。曲線の下を薄く塗って「AUC」。曲線上の数点に「しきい値を下げる → 右上へ動く」の矢印。
- 文字より分かる理由：軸の取り方と、面積で良さを測ることは、曲線を見れば一度で覚えられる。
- 使うカード（2）：C-03-055（ROC曲線・AUC）、C-03-053（真陽性・真陰性・偽陽性・偽陰性）
- 使う問題（3）：G-03-039、G-03-040、G-03-064
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Google for Developers: ML Crash Course - ROC and AUC](https://developers.google.com/machine-learning/crash-course/classification/roc-and-auc)（C-03-055）
  - [scikit-learn User Guide: Metrics and scoring](https://scikit-learn.org/stable/modules/model_evaluation.html)（C-03-055、C-03-053）

#### fig-g-perceptron-xor　単純パーセプトロンの限界（XOR は直線で分けられない）

- 優先度：**A**　／　主な章：04 ディープラーニングの概要
- 何を描くか：3つの小さな座標図（x₁, x₂ ∈ {0,1} の4点）。AND と OR は直線1本で ●と○を分けられる。XOR は対角に同じ色が来て直線1本では分けられない（×印）。右に、隠れ層を1つ持つ多層パーセプトロンの図（入力2・隠れ2・出力1）と、XOR の4点を2本の直線で切り分けた図。
- 文字より分かる理由：「線形分離可能かどうか」は、4点の座標図を見れば説明不要で分かる。
- 使うカード（3）：C-04-001（単純パーセプトロン）、C-04-002（多層パーセプトロン）、C-04-003（入力層・隠れ層・出力層）
- 使う問題（2）：G-04-001、G-04-002
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Neural network models (supervised)](https://scikit-learn.org/stable/modules/neural_networks_supervised.html)（C-04-001、C-04-002、C-04-003）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 1 Introduction（著者公開版）](https://www.deeplearningbook.org/contents/intro.html)（C-04-001）
  - [Jordan (1986) Serial Order: A Parallel Distributed Processing Approach. ICS Report 8604, UC San Diego](https://cseweb.ucsd.edu/~gary/PAPER-SUGGESTIONS/Jordan-TR-8604-OCRed.pdf)（C-04-001）
  - [Rumelhart, Hinton & Williams (1986) Learning representations by back-propagating errors. Nature](https://www.nature.com/articles/323533a0)（C-04-003）

#### fig-g-activation　活性化関数のグラフと微分（シグモイド・tanh・ReLU・Leaky ReLU）

- 優先度：**A**　／　主な章：04 ディープラーニングの概要
- 何を描くか：4つのグラフを横に並べ、同じ横軸（−5〜5）。各グラフに関数（実線）とその微分（破線）を重ねる。シグモイド：値域 0〜1、微分の最大は x＝0 で 0.25。tanh：値域 −1〜1、原点対称、微分の最大 1。ReLU：x≤0 で 0、x>0 で x、微分は 0 か 1。Leaky ReLU：負側に小さな傾き（例 0.01）。各グラフの下に「主な使い道・弱点」（シグモイド：深い層で勾配消失、ReLU：負側で勾配 0）。
- 文字より分かる理由：値域・形・微分の大きさは、グラフを並べると文字の数倍早く比べられる。
- 使うカード（6）：C-04-005（活性化関数）、C-04-006（シグモイド関数）、C-04-007（tanh関数）、C-04-008（ReLU関数）、C-04-009（Leaky ReLU関数）、C-04-047（重みの初期値（Xavierの初期値・Heの初期値））
- 使う問題（7）：G-04-005、G-04-006、G-04-007、G-04-008、G-04-010、G-04-022、G-04-045
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Google for Developers: Machine Learning Glossary（activation function）](https://developers.google.com/machine-learning/glossary)（C-04-005、C-04-008）
  - [PyTorch Documentation: torch.nn.Sigmoid](https://docs.pytorch.org/docs/stable/generated/torch.nn.Sigmoid.html)（C-04-006）
  - [Glorot & Bengio (2010) Understanding the difficulty of training deep feedforward neural networks. AISTATS](https://proceedings.mlr.press/v9/glorot10a.html)（C-04-006）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 3 Probability and Information Theory（著者公開版）](https://www.deeplearningbook.org/contents/prob.html)（C-04-006）
  - [Hochreiter (1998) The Vanishing Gradient Problem During Learning Recurrent Neural Nets and Problem Solutions. IJUFKS 6(2)（著者所属機関の公開版）](https://www.bioinf.jku.at/publications/older/2304.pdf)（C-04-006）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 6 Deep Feedforward Networks（著者公開版）](https://www.deeplearningbook.org/contents/mlp.html)（C-04-006、C-04-007）
  - [PyTorch Documentation: torch.nn.Tanh](https://docs.pytorch.org/docs/stable/generated/torch.nn.Tanh.html)（C-04-007）
  - [Glorot, Bordes & Bengio (2011) Deep Sparse Rectifier Neural Networks. AISTATS](https://proceedings.mlr.press/v15/glorot11a.html)（C-04-007、C-04-008）
  - [PyTorch Documentation: torch.nn.ReLU](https://docs.pytorch.org/docs/stable/generated/torch.nn.ReLU.html)（C-04-008）
  - [PyTorch Documentation: torch.nn.LeakyReLU](https://docs.pytorch.org/docs/stable/generated/torch.nn.LeakyReLU.html)（C-04-009）
  - [Maas, Hannun & Ng (2013) Rectifier Nonlinearities Improve Neural Network Acoustic Models](https://ai.stanford.edu/~amaas/papers/relu_hybrid_icml2013_final.pdf)（C-04-009）
  - [Glorot & Bengio (2010) Understanding the difficulty of training deep feedforward neural networks. AISTATS](https://proceedings.mlr.press/v9/glorot10a/glorot10a.pdf)（C-04-047）
  - [He et al. (2015) Delving Deep into Rectifiers: Surpassing Human-Level Performance on ImageNet Classification. ICCV（arXiv:1502.01852）](https://arxiv.org/abs/1502.01852)（C-04-047）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 8 Optimization for Training Deep Models（著者公開版）](https://www.deeplearningbook.org/contents/optimization.html)（C-04-047）

#### fig-g-l1-l2　L1 正則化と L2 正則化（なぜ L1 は重みを0にするか）

- 優先度：**A**　／　主な章：04 ディープラーニングの概要
- 何を描くか：2つの重み w₁, w₂ の平面。誤差関数の等高線（楕円）を同じ位置に描いた図を2つ並べる。左：L1 の制約はひし形（|w₁|＋|w₂|≤t）。楕円がひし形の角（軸上、w₁＝0）で接する → 重みがちょうど0。右：L2 の制約は円（w₁²＋w₂²≤t）。楕円が円の軸上でない点で接する → 小さくなるが0になりにくい。下に Elastic Net＝両方の組み合わせ、と1行。
- 文字より分かる理由：「L1 はスパース、L2 は滑らか」の理由が、角で接するかどうかで一目で分かる。
- 使うカード（4）：C-04-017（正則化）、C-04-018（L0正則化）、C-04-019（L1正則化とラッソ回帰）、C-04-020（L2正則化とリッジ回帰）
- 使う問題（5）：G-04-016、G-04-017、G-04-019、G-04-047、G-03-055
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Google for Developers: Machine Learning Glossary（L1 / L2 regularization）](https://developers.google.com/machine-learning/glossary)（C-04-017、C-04-018、C-04-019、C-04-020）
  - [scikit-learn User Guide: Linear Models（Lasso）](https://scikit-learn.org/stable/modules/linear_model.html)（C-04-019、C-04-020）

#### fig-g-backprop　誤差逆伝播法と連鎖律（計算グラフ）

- 優先度：**A**　／　主な章：04 ディープラーニングの概要
- 何を描くか：計算グラフ x → [×w] → u → [f] → y → [誤差 L]。上側に左→右の順伝播の矢印と値、下側に右→左の逆伝播の矢印と局所的な微分 ∂L/∂y、∂y/∂u、∂u/∂w。最後に ∂L/∂w ＝ ∂L/∂y × ∂y/∂u × ∂u/∂w と、掛け合わされる3項を色で対応させる。
- 文字より分かる理由：「出力側から微分を掛けながら戻る」動きが、計算グラフの下向き矢印で見える。
- 使うカード（3）：C-04-022（誤差逆伝播法）、C-04-023（連鎖律）、C-04-026（信用割当問題）
- 使う問題（4）：G-04-020、G-04-021、G-04-024、G-04-048
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Rumelhart, Hinton & Williams (1986) Learning representations by back-propagating errors. Nature](https://www.nature.com/articles/323533a0)（C-04-022）
  - [Google for Developers: Machine Learning Glossary（backpropagation）](https://developers.google.com/machine-learning/glossary)（C-04-022）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 6 Deep Feedforward Networks（著者公開版）](https://www.deeplearningbook.org/contents/mlp.html)（C-04-022、C-04-026）
  - [PyTorch Tutorials: A Gentle Introduction to torch.autograd](https://docs.pytorch.org/tutorials/beginner/blitz/autograd_tutorial.html)（C-04-023）
  - [JDLA G検定シラバス 2024（第1.4版）](https://www.jdla.org/certificate/general/)（C-04-026）
  - [Sutton & Barto (2018) Reinforcement Learning: An Introduction, 2nd ed.（著者公開版）](http://incompleteideas.net/book/RLbook2020.pdf)（C-04-026）

#### fig-g-vanishing-gradient　勾配消失・勾配爆発と勾配クリッピング

- 優先度：**A**　／　主な章：04 ディープラーニングの概要
- 何を描くか：左：層を5つ横に並べ、出力側から入力側へ戻る勾配の大きさを棒で。各層でシグモイドの微分（最大 0.25）が掛かると、0.25, 0.0625, 0.0156… と急に縮む。同じ並びで、1より大きい値が掛かると棒が急に伸びる（爆発）。右：2次元の勾配ベクトルが長すぎるとき、向きを保ったまましきい値の長さ（円）まで縮める図（ノルムによるクリッピング）。
- 文字より分かる理由：掛け算の積み重ねで縮む・伸びる様子と、クリッピングで向きを保つことが図で分かる。
- 使うカード（3）：C-04-024（勾配消失問題）、C-04-025（勾配爆発問題）、C-04-006（シグモイド関数）
- 使う問題（5）：G-04-006、G-04-022、G-04-023、G-04-025、G-04-050
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Google for Developers: Machine Learning Glossary（vanishing gradient problem）](https://developers.google.com/machine-learning/glossary)（C-04-024、C-04-025）
  - [Glorot & Bengio (2010) Understanding the difficulty of training deep feedforward neural networks. AISTATS](https://proceedings.mlr.press/v9/glorot10a.html)（C-04-024、C-04-006）
  - [Pascanu, Mikolov & Bengio (2013) On the difficulty of training Recurrent Neural Networks (arXiv:1211.5063)](https://arxiv.org/abs/1211.5063)（C-04-025）
  - [PyTorch Documentation: torch.nn.Sigmoid](https://docs.pytorch.org/docs/stable/generated/torch.nn.Sigmoid.html)（C-04-006）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 3 Probability and Information Theory（著者公開版）](https://www.deeplearningbook.org/contents/prob.html)（C-04-006）
  - [Hochreiter (1998) The Vanishing Gradient Problem During Learning Recurrent Neural Nets and Problem Solutions. IJUFKS 6(2)（著者所属機関の公開版）](https://www.bioinf.jku.at/publications/older/2304.pdf)（C-04-006）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 6 Deep Feedforward Networks（著者公開版）](https://www.deeplearningbook.org/contents/mlp.html)（C-04-006）

#### fig-g-gradient-descent　勾配降下法と学習率の大きさ

- 優先度：**A**　／　主な章：04 ディープラーニングの概要
- 何を描くか：U 字の誤差曲線を3つ並べる。左＝学習率が小さすぎ：小さな歩幅でなかなか谷底に着かない。中＝適切：数歩で谷底へ。右＝大きすぎ：谷の両側を行ったり来たりして外へ飛び出す（発散）。各点に接線（傾き）と「傾きの逆向きへ、学習率×傾き だけ進む」の矢印。
- 文字より分かる理由：学習率の大小で何が起きるかは、歩幅の違う3枚を並べると直感的に分かる。
- 使うカード（3）：C-04-027（勾配降下法）、C-04-028（学習率）、C-08-022（微分と最適化）
- 使う問題（4）：G-04-026、G-04-027、G-04-049、G-08-024
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Google for Developers: Machine Learning Glossary（gradient descent）](https://developers.google.com/machine-learning/glossary)（C-04-027、C-04-028）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 4 Numerical Computation（著者公開版）](https://www.deeplearningbook.org/contents/numerical.html)（C-04-027、C-08-022）
  - [MIT OCW 18.01SC Single Variable Calculus (Fall 2010) Session 18: The Power Rule](https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/cc53f4a12df600e1e43b4f02b9badac7_MIT18_01SCF10_Ses18d.pdf)（C-08-022）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 6 Deep Feedforward Networks（著者公開版）](https://www.deeplearningbook.org/contents/mlp.html)（C-08-022）

#### fig-g-local-min-saddle　局所最適解・大域最適解・鞍点

- 優先度：**A**　／　主な章：04 ディープラーニングの概要
- 何を描くか：左：凸凹のある1次元の誤差曲線に「局所最適解（小さな谷）」「大域最適解（最も深い谷）」。ボールが小さな谷にはまる絵と、モーメンタムで勢いがあれば越えられる矢印。右：鞍点の等高線（あるいは馬の鞍の斜め図）。x 方向には谷、y 方向には山で、中心の勾配が0。
- 文字より分かる理由：谷と鞍の形は、言葉より図の方が圧倒的に早く伝わる。
- 使うカード（3）：C-04-029（局所最適解・大域最適解）、C-04-030（鞍点）、C-04-034（モーメンタム）
- 使う問題（3）：G-04-030、G-04-031、G-04-032
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Google for Developers: Machine Learning Glossary（convex function）](https://developers.google.com/machine-learning/glossary)（C-04-029、C-04-034）
  - [Dauphin et al. (2014) Identifying and attacking the saddle point problem in high-dimensional non-convex optimization (arXiv:1406.2572)](https://arxiv.org/abs/1406.2572)（C-04-030）
  - [PyTorch Documentation: torch.optim.SGD（momentum）](https://docs.pytorch.org/docs/stable/generated/torch.optim.SGD.html)（C-04-034）

#### fig-g-optimizers　最適化手法の系譜とモーメンタムの効果

- 優先度：**A**　／　主な章：04 ディープラーニングの概要
- 何を描くか：左：細長い楕円の等高線上で、SGD のジグザグの軌跡と、モーメンタムの滑らかな軌跡を比較。右：系譜図。SGD → モーメンタム、SGD → AdaGrad（勾配の二乗を累積して割る）→ RMSprop（指数移動平均で古い勾配を薄める）・AdaDelta（学習率の手動設定が不要）。モーメンタム＋RMSprop → Adam（1次・2次モーメント）→ AdaBound（Adam の学習率に上下限）、AMSGrad → AMSBound。各箱に1行の特徴。
- 文字より分かる理由：似た名前の手法の「何を何に足したか」が、系譜の矢印で一度に整理できる。
- 使うカード（7）：C-04-034（モーメンタム）、C-04-035（AdaGrad）、C-04-036（RMSprop）、C-04-037（AdaDelta）、C-04-038（Adam）、C-04-039（AdaBound・AMSBound）、C-04-032（確率的勾配降下法 (SGD)）
- 使う問題（5）：G-04-032、G-04-033、G-04-034、G-04-035、G-04-036
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Google for Developers: Machine Learning Glossary（Momentum）](https://developers.google.com/machine-learning/glossary)（C-04-034、C-04-035、C-04-032）
  - [PyTorch Documentation: torch.optim.SGD（momentum）](https://docs.pytorch.org/docs/stable/generated/torch.optim.SGD.html)（C-04-034、C-04-032）
  - [Duchi, Hazan & Singer (2011) Adaptive Subgradient Methods for Online Learning and Stochastic Optimization. JMLR](https://jmlr.org/papers/v12/duchi11a.html)（C-04-035）
  - [PyTorch Documentation: torch.optim.RMSprop](https://docs.pytorch.org/docs/stable/generated/torch.optim.RMSprop.html)（C-04-036）
  - [Zeiler (2012) ADADELTA: An Adaptive Learning Rate Method (arXiv:1212.5701)](https://arxiv.org/abs/1212.5701)（C-04-037）
  - [Kingma & Ba (2014) Adam: A Method for Stochastic Optimization (arXiv:1412.6980)](https://arxiv.org/abs/1412.6980)（C-04-038）
  - [Luo et al. (2019) Adaptive Gradient Methods with Dynamic Bound of Learning Rate (arXiv:1902.09843)](https://arxiv.org/abs/1902.09843)（C-04-039）

#### fig-g-conv-op　畳み込みの計算・ストライド・パディングと出力サイズ

- 優先度：**A**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：上段：5×5 の入力の格子（数値入り）に 3×3 のフィルタを重ね、重なった9マスの積の和を出力 3×3 の1マスに書く。1マスだけ計算の途中（積を9つ並べて足す）を示す。中段：ストライド2で窓が2マスずつ飛ぶ様子（出力 2×2）。下段：周囲を0で1マス埋めたパディング（出力が入力と同じ 5×5）。右に式：出力 ＝（入力＋2×パディング−フィルタ）÷ストライド＋1、と各段の数値の当てはめ。
- 文字より分かる理由：窓をずらして積和をとる動きと、出力サイズが決まる理由は、格子の図でしか直感的に分からない。
- 使うカード（5）：C-05-004（畳み込み操作）、C-05-005（フィルタ・カーネル）、C-05-006（ストライド）、C-05-007（パディング）、C-05-009（特徴マップ）
- 使う問題（6）：G-05-003、G-05-004、G-05-005、G-05-007、G-05-012、G-05-054
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [PyTorch Documentation: torch.nn.Conv2d](https://docs.pytorch.org/docs/stable/generated/torch.nn.Conv2d.html)（C-05-004、C-05-005、C-05-006、C-05-007、C-05-009）
  - [Goodfellow, Bengio & Courville (2016) Deep Learning, Chapter 9 Convolutional Networks](https://www.deeplearningbook.org/contents/convnets.html)（C-05-004、C-05-009）

#### fig-g-conv-params　畳み込み層のパラメータ数（全結合層との比較）

- 優先度：**A**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：左：入力の直方体（縦×横×入力チャネル8）、フィルタの小さな直方体（3×3×8）が出力チャネル数（16）だけ並ぶ。フィルタ1個の重み 3×3×8＝72 ＋ バイアス1、それが16個で (72＋1)×16＝1,168。右：同じ入出力を全結合でつないだ場合のパラメータ数（画像の大きさに比例して巨大になる）と比較し、「畳み込みは画像の大きさに依存しない（重みの共有）」。
- 文字より分かる理由：式のどの項がフィルタのどの寸法かが、立体の図で対応づけられる。
- 使うカード（3）：C-05-008（畳み込み層のパラメータ数）、C-05-002（重みと線形関数（全結合層のパラメータ数））、C-05-003（畳み込みニューラルネットワーク (CNN)）
- 使う問題（2）：G-05-006、G-05-008
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [PyTorch Documentation: torch.nn.Conv2d](https://docs.pytorch.org/docs/stable/generated/torch.nn.Conv2d.html)（C-05-008）
  - [PyTorch Documentation: torch.nn.Linear](https://docs.pytorch.org/docs/stable/generated/torch.nn.Linear.html)（C-05-002）
  - [Goodfellow, Bengio & Courville (2016) Deep Learning, Chapter 9 Convolutional Networks](https://www.deeplearningbook.org/contents/convnets.html)（C-05-003）

#### fig-g-pooling　最大値・平均値プーリング、GAP と位置ずれへの不変性

- 優先度：**A**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：4×4 の特徴マップ（数値入り）を 2×2 の窓・ストライド2で区切る。右に最大値プーリングの結果 2×2 と平均値プーリングの結果 2×2。下段：特徴マップ1枚全体の平均＝GAP で1つの数になり、チャネル数ぶんのベクトルになる図。さらに、入力の模様が1マスずれても最大値プーリングの出力が変わらない例（不変性）。「プーリングには学習するパラメータが無い」と注記。
- 文字より分かる理由：窓ごとの集約と出力の大きさ、不変性の意味が、数値の格子で具体的に分かる。
- 使うカード（3）：C-05-016（最大値プーリング・平均値プーリング）、C-05-017（グローバルアベレージプーリング (GAP)）、C-05-018（不変性の獲得）
- 使う問題（4）：G-05-018、G-05-019、G-05-020、G-05-021
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [PyTorch Documentation: torch.nn.MaxPool2d](https://docs.pytorch.org/docs/stable/generated/torch.nn.MaxPool2d.html)（C-05-016）
  - [PyTorch Documentation: torch.nn.AvgPool2d](https://docs.pytorch.org/docs/stable/generated/torch.nn.AvgPool2d.html)（C-05-016）
  - [Lin, Chen & Yan (2013) Network In Network (arXiv:1312.4400)](https://arxiv.org/abs/1312.4400)（C-05-017）
  - [PyTorch Documentation: torch.nn.AdaptiveAvgPool2d](https://docs.pytorch.org/docs/stable/generated/torch.nn.AdaptiveAvgPool2d.html)（C-05-017）
  - [Goodfellow, Bengio & Courville (2016) Deep Learning, Chapter 9 Convolutional Networks](https://www.deeplearningbook.org/contents/convnets.html)（C-05-018）

#### fig-g-normalization　正規化の種類と平均・分散をとる範囲（バッチ・レイヤー・インスタンス・グループ）

- 優先度：**A**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：4つの同じ立方体（軸＝バッチ N、チャネル C、空間 H×W）を並べ、統計をとる範囲を塗る。バッチ正規化：1つのチャネルを全バッチ・全空間で。レイヤー正規化：1つのデータの全チャネル・全空間。インスタンス正規化：1つのデータの1チャネル。グループ正規化：1つのデータのチャネルのひとまとまり。各図の下に主な使い道（BN＝CNN、ただし小バッチに弱い／LN＝RNN・Transformer／IN＝画風変換／GN＝小バッチの検出・セグメンテーション）。
- 文字より分かる理由：「どこで平均をとるか」の違いは、塗り分けた立方体を並べるのが唯一の分かりやすい説明。
- 使うカード（4）：C-05-012（バッチ正規化）、C-05-013（グループ正規化）、C-05-014（レイヤー正規化）、C-05-015（インスタンス正規化）
- 使う問題（6）：G-05-013、G-05-014、G-05-015、G-05-016、G-05-017、G-05-055
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Ioffe & Szegedy (2015) Batch Normalization (arXiv:1502.03167)](https://arxiv.org/abs/1502.03167)（C-05-012）
  - [Wu & He (2018) Group Normalization (arXiv:1803.08494)](https://arxiv.org/abs/1803.08494)（C-05-012、C-05-013）
  - [PyTorch Documentation: torch.nn.GroupNorm](https://docs.pytorch.org/docs/stable/generated/torch.nn.GroupNorm.html)（C-05-013）
  - [Ba, Kiros & Hinton (2016) Layer Normalization (arXiv:1607.06450)](https://arxiv.org/abs/1607.06450)（C-05-014）
  - [Ulyanov, Vedaldi & Lempitsky (2016) Instance Normalization: The Missing Ingredient for Fast Stylization (arXiv:1607.08022)](https://arxiv.org/abs/1607.08022)（C-05-015）

#### fig-g-skip-connection　スキップ結合と残差学習（ResNet）、DenseNet との違い

- 優先度：**A**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：左：残差ブロック。x が2つの層（重み層→ReLU→重み層）を通って F(x) になり、迂回路で x がそのまま運ばれて足し合わされ F(x)＋x → ReLU。「層は差分（残差）F(x) だけを学べばよい」。右：DenseNet のブロック。各層がそれより前のすべての層の出力を受け取る（足すのではなく連結）矢印を描き、4層で接続 4×5/2＝10本。Wide ResNet は「層を減らして幅を広げる」と注記。
- 文字より分かる理由：迂回路で「足す」か、全部を「つなぐ」かの違いが、矢印の形で見分けられる。
- 使うカード（5）：C-05-019（スキップ結合）、C-05-020（ResNet）、C-06-005（ResNet）、C-06-006（Wide ResNet）、C-06-007（DenseNet）
- 使う問題（6）：G-05-022、G-05-023、G-05-024、G-06-001、G-06-006、G-06-014
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [He et al. (2015) Deep Residual Learning for Image Recognition (arXiv:1512.03385)](https://arxiv.org/abs/1512.03385)（C-05-019、C-05-020、C-06-005）
  - [Zagoruyko & Komodakis (2016) Wide Residual Networks (arXiv:1605.07146)](https://arxiv.org/abs/1605.07146)（C-06-006）
  - [Huang et al. (2016) Densely Connected Convolutional Networks (arXiv:1608.06993)](https://arxiv.org/abs/1608.06993)（C-06-007）

#### fig-g-rnn-unroll　RNN の回帰結合と時間方向の展開（BPTT・教師強制）

- 優先度：**A**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：左：入力 x→隠れ層 h→出力 y、h から自分自身への輪の矢印。右：同じものを時刻 t−1, t, t+1 に展開し、h が横につながる。下側に右→左の赤い矢印で「誤差を時刻をさかのぼって伝える（BPTT）」。別枠で教師強制：学習時は次の入力に正解を、推論時は自分の予測を入れる、の2本の比較。
- 文字より分かる理由：輪の矢印がどう時間方向の鎖になり、誤差がどう戻るかは、展開図でないと分からない。
- 使うカード（4）：C-05-021（リカレントニューラルネットワーク (RNN)）、C-05-022（時系列データ）、C-05-025（BPTT）、C-05-026（教師強制）
- 使う問題（4）：G-05-025、G-05-026、G-05-027、G-05-031
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Goodfellow, Bengio & Courville (2016) Deep Learning, Chapter 10 Sequence Modeling: Recurrent and Recursive Nets](https://www.deeplearningbook.org/contents/rnn.html)（C-05-021、C-05-022、C-05-025、C-05-026）

#### fig-g-lstm-gru　LSTM のセルとゲート、GRU との比較

- 優先度：**A**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：左：LSTM ブロック。中央を横切る太い線＝セル（CEC：誤差を一定に流す）。入力ゲート（書き込み）、出力ゲート（読み出し）、忘却ゲート（のちに追加、と注記）を、シグモイドの記号 σ と掛け算 ⊗ で描く。右：GRU。セルは無く、隠れ状態に対してリセットゲートと更新ゲートの2つ。下に比較表（ゲート数 3 と 2、セルの有無、パラメータ数）。
- 文字より分かる理由：ゲートが情報の流れのどこを開け閉めするかは、配線図でないと伝わらない。
- 使うカード（4）：C-05-027（LSTM）、C-05-028（GRU）、C-05-029（ゲート機構）、C-06-038（CEC（Constant Error Carousel））
- 使う問題（5）：G-05-028、G-05-029、G-05-033、G-05-056、G-06-022
- 描く前に確かめること：原論文（1997）の LSTM は入力ゲートと出力ゲートのみ。忘却ゲートは後の追加であることを図でも区別する（C-05-027 の記述どおり）。
- 2026-10-06 描き直し：先生から「どれがゲートでどれが重みか分からない」と指摘。冒頭に図の見方（σ＝ゲート、×＝掛け算、W＝重みの組、オレンジ＝CEC）を置き、LSTM に W1〜W4、GRU に W1〜W3 を付けた。表は ゲート／候補／重みの組／セル の4行（重みの組＝ゲート＋候補、PyTorch の weight_ih の数え方）。

#### 2026-10-06 以降に足した図（計画外。先生の指摘から作った）

- fig-g-cec：CEC が LSTM の中のどこか（セルの線だけ色付き）、1997年の重み1の自己ループ、誤差が ×0.5 で消える／×1 で残る比較、2000年の忘却ゲートで 1→f。使う所：C-05-027、C-05-029、C-06-038、G-05-028、G-05-056、G-06-022。根拠：Hochreiter & Schmidhuber (1997)、Gers et al. (2000) 要旨、PyTorch torch.nn.LSTM。
- fig-g-neocognitron-lenet：ネオコグニトロンと LeNet を 学習のしかた・層の名前・年・人 で左右に比べる。使う所：C-02-035、C-02-036、G-02-034、G-02-035。根拠：Fukushima (1980) 要旨、LeCun et al. (1989)・(1998)。
- fig-g-sample-mean：母集団→36個取り出して平均→くり返す→平均の分布は 12÷√36＝2 に細くなる。使う所：C-08-008、G-08-053。根拠：MIT OCW 18.05 Class 6。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Hochreiter & Schmidhuber (1997) Long Short-Term Memory. Neural Computation](https://www.bioinf.jku.at/publications/older/2604.pdf)（C-05-027、C-06-038）
  - [PyTorch Documentation: torch.nn.LSTM](https://docs.pytorch.org/docs/stable/generated/torch.nn.LSTM.html)（C-05-027、C-05-029）
  - [PyTorch Documentation: torch.nn.GRU](https://docs.pytorch.org/docs/stable/generated/torch.nn.GRU.html)（C-05-028、C-05-029）
  - [Cho et al. (2014) Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation (arXiv:1406.1078)](https://arxiv.org/abs/1406.1078)（C-05-028）

#### fig-g-seq2seq-attention　Seq2Seq（固定長ベクトル）と Attention

- 優先度：**A**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：上：エンコーダの RNN が入力文の単語を順に読み、最後の状態1本（固定長ベクトル）だけをデコーダに渡す。ボトルネックに「長い文だと情報が入りきらない」。下：Attention 付き。デコーダの各時刻から、エンコーダの全時刻の状態へ太さの違う線（重み）が伸び、その重み付き和を使う。重みの例を棒で（例：訳語「cat」を出すとき「猫」に 0.8）。Source-Target Attention では Q＝デコーダ、K・V＝エンコーダ、と注記。
- 文字より分かる理由：「1本に詰める」か「毎回全体を見直す」かの違いが、線の数と太さで見える。
- 使うカード（5）：C-05-031（Seq2Seq）、C-05-032（Attention）、C-05-033（Source-Target Attention）、C-06-032（Seq2Seq（系列変換モデル））、C-05-050（エンコーダ・デコーダ構造（Encoder-Decoder））
- 使う問題（5）：G-05-034、G-05-035、G-05-038、G-05-058、G-06-018
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Sutskever, Vinyals & Le (2014) Sequence to Sequence Learning with Neural Networks (arXiv:1409.3215)](https://arxiv.org/abs/1409.3215)（C-05-031、C-06-032、C-05-050）
  - [Cho et al. (2014) Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation (arXiv:1406.1078)](https://arxiv.org/abs/1406.1078)（C-05-031、C-05-050）
  - [Bahdanau, Cho & Bengio (2014) Neural Machine Translation by Jointly Learning to Align and Translate (arXiv:1409.0473)](https://arxiv.org/abs/1409.0473)（C-05-032）
  - [Vaswani et al. (2017) Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762)（C-05-033、C-05-050）
  - [Badrinarayanan et al. (2015) SegNet (arXiv:1511.00561)](https://arxiv.org/abs/1511.00561)（C-05-050）

#### fig-g-transformer　Transformer の構成

- 優先度：**A**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：左にエンコーダ（Self-Attention → フィードフォワード、各段に残差接続と正規化）を N 段、右にデコーダ（Masked Self-Attention → Source-Target Attention → フィードフォワード）を N 段。入力の下に「単語の埋め込み ＋ 位置エンコーディング（sin・cos）」。エンコーダの出力がデコーダの Source-Target Attention に入る矢印。Multi-Head は「複数のヘッドで並列に計算して連結」と吹き出し。「RNN も畳み込みも無い → 並列に計算できる」。
- 文字より分かる理由：3種類の Attention がどこにあるかと、位置エンコーディングが入る場所が、構成図で一度に分かる。
- 使うカード（5）：C-05-035（Transformer）、C-05-034（Self-Attention）、C-05-037（Multi-Head Attention）、C-05-038（位置エンコーディング）、C-05-033（Source-Target Attention）
- 使う問題（4）：G-05-036、G-05-037、G-05-039、G-05-040
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Vaswani et al. (2017) Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762)（C-05-035、C-05-034、C-05-037、C-05-038、C-05-033）
  - [PyTorch Documentation: torch.nn.MultiheadAttention](https://docs.pytorch.org/docs/stable/generated/torch.nn.MultiheadAttention.html)（C-05-037）

#### fig-g-qkv　Attention の計算（クエリ・キー・バリュー）とデコーダのマスク

- 優先度：**A**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：左：3単語の文。各単語からクエリ q、キー k、バリュー v。単語1の q と各 k の内積（類似度）→ ソフトマックスで重み（例 0.7, 0.2, 0.1）→ 各 v に重みを掛けて足し、新しい表現。検索のたとえ（q＝検索語、k＝見出し、v＝本文）を小さく。右：4×4 の Attention スコア行列。デコーダの Self-Attention では対角より右上（未来の位置）を −∞（灰色）にしてソフトマックス後に 0 になる三角のマスク。
- 文字より分かる理由：Q・K・V の役割と、マスクが「未来を見ない」ことが、行列の図で具体的に分かる。
- 使うカード（3）：C-05-036（クエリ・キー・バリュー）、C-05-034（Self-Attention）、C-05-033（Source-Target Attention）
- 使う問題（4）：G-05-041、G-05-059、G-05-038、G-05-039
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Vaswani et al. (2017) Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762)（C-05-036、C-05-034、C-05-033）

#### fig-g-autoencoder-vae　オートエンコーダと VAE（潜在表現を点で持つか分布で持つか）

- 優先度：**A**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：上：オートエンコーダ。入力 → エンコーダ（だんだん細くなる台形）→ 潜在表現（細い部分）→ デコーダ（太くなる台形）→ 出力≒入力。「入力と出力を同じにする＝ラベル不要」。中：VAE。エンコーダの出力が平均 μ と分散 σ の2つ → そこからサンプリング → デコーダ。潜在空間の2次元図に、点（AE）と ぼかした円（VAE）の対比。下：VQ-VAE はコードブックから最も近い離散ベクトルを選ぶ、と1行。積層 AE の事前学習は「1層ずつ AE として学習して積む」と注記。
- 文字より分かる理由：「点」か「分布」かの違いが、潜在空間の図で見えると VAE が生成に使える理由が分かる。
- 使うカード（4）：C-05-039（オートエンコーダ）、C-05-040（積層オートエンコーダと事前学習）、C-05-041（変分オートエンコーダ (VAE)）、C-05-042（VQ-VAE・info VAE・β-VAE）
- 使う問題（5）：G-05-042、G-05-043、G-05-044、G-05-045、G-05-046
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Goodfellow, Bengio & Courville (2016) Deep Learning, Chapter 14 Autoencoders](https://www.deeplearningbook.org/contents/autoencoders.html)（C-05-039）
  - [Angiulli, Fassetti & Ferragina (2023) Reconstruction Error-based Anomaly Detection with Few Outlying Examples (arXiv:2305.10464)](https://arxiv.org/abs/2305.10464)（C-05-039）
  - [Bengio et al. (2006) Greedy Layer-Wise Training of Deep Networks. NeurIPS](https://papers.nips.cc/paper_files/paper/2006/hash/5da713a690c067105aeb2fae32403405-Abstract.html)（C-05-040）
  - [Vincent et al. (2010) Stacked Denoising Autoencoders. JMLR](https://www.jmlr.org/papers/v11/vincent10a.html)（C-05-040）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 15 Representation Learning（著者公開版）](https://www.deeplearningbook.org/contents/representation.html)（C-05-040）
  - [Kingma & Welling (2013) Auto-Encoding Variational Bayes (arXiv:1312.6114)](https://arxiv.org/abs/1312.6114)（C-05-041）
  - [van den Oord, Vinyals & Kavukcuoglu (2017) Neural Discrete Representation Learning (arXiv:1711.00937)](https://arxiv.org/abs/1711.00937)（C-05-042）
  - [Zhao, Song & Ermon (2017) InfoVAE: Information Maximizing Variational Autoencoders (arXiv:1706.02262)](https://arxiv.org/abs/1706.02262)（C-05-042）
  - [Higgins et al. (2017) beta-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework. ICLR](https://openreview.net/forum?id=Sy2fzU9gl)（C-05-042）
  - [Burgess, Higgins et al. (2018) Understanding disentangling in β-VAE (arXiv:1804.03599)](https://arxiv.org/abs/1804.03599)（C-05-042）

#### fig-g-data-augmentation　画像のデータ拡張の種類（Flip・Crop・Cutout・Random Erasing・Mixup・CutMix）

- 優先度：**A**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：元画像（単純な図形の「犬」と「猫」のアイコン）から、左右反転、回転、切り抜き、明るさ変更、Cutout（正方形を0で隠す）、Random Erasing（ランダムな大きさ・縦横比の長方形をランダムな値で塗る）、Mixup（2枚を半透明で重ね、ラベルも「犬0.6・猫0.4」）、CutMix（犬の画像に猫の一部を貼り、ラベルを面積比で混ぜる）を、ラベルつきのタイルで並べる。RandAugment は「N 個の変換を強さ M で」と注記。手書き数字のように向きで意味が変わるデータには反転・大きな回転が不適切、と1行（具体例は G-05-053 の解説と食い違わないように書く）。
- 文字より分かる理由：似た名前の手法の違いは、実際に加工した見た目を並べるのが最も早い。
- 使うカード（5）：C-05-043（データ拡張）、C-05-044（画像の基本的なデータ拡張（Random Flip・Rotate・Crop・Brightness・Contrast））、C-05-045（Cutout・Random Erasing）、C-05-046（Mixup・CutMix）、C-05-047（RandAugment）
- 使う問題（6）：G-05-047、G-05-048、G-05-049、G-05-050、G-05-052、G-05-053
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Goodfellow, Bengio & Courville (2016) Deep Learning, Chapter 7 Regularization（7.4 Dataset Augmentation）](https://www.deeplearningbook.org/contents/regularization.html)（C-05-043）
  - [PyTorch Documentation: torchvision Transforms](https://docs.pytorch.org/vision/stable/transforms.html)（C-05-043、C-05-044）
  - [DeVries & Taylor (2017) Improved Regularization of Convolutional Neural Networks with Cutout (arXiv:1708.04552)](https://arxiv.org/abs/1708.04552)（C-05-045）
  - [Zhong et al. (2017) Random Erasing Data Augmentation (arXiv:1708.04896)](https://arxiv.org/abs/1708.04896)（C-05-045）
  - [Zhang et al. (2017) mixup: Beyond Empirical Risk Minimization (arXiv:1710.09412)](https://arxiv.org/abs/1710.09412)（C-05-046）
  - [Yun et al. (2019) CutMix: Regularization Strategy to Train Strong Classifiers with Localizable Features (arXiv:1905.04899)](https://arxiv.org/abs/1905.04899)（C-05-046）
  - [Cubuk et al. (2019) RandAugment: Practical automated data augmentation with a reduced search space (arXiv:1909.13719)](https://arxiv.org/abs/1909.13719)（C-05-047）

#### fig-g-vision-tasks　画像認識タスクの違い（分類・検出・セグメンテーション3種・姿勢推定）

- 優先度：**A**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：同じ1枚の模式的な街の絵（人2人・車1台・道路・空）を6回並べる。①物体識別：画像全体に「人」のラベル。②物体検出：人と車を矩形で囲みクラス名。③セマンティック：全画素をクラス色で塗る（人2人は同じ色）。④インスタンス：人1・人2・車を別々の色（背景は塗らない）。⑤パノプティック：人1・人2を別色にしつつ、道路・空も塗る。⑥姿勢推定：人の関節点と骨格線（OpenPose はキーポイントと人物の対応付け、と注記）。
- 文字より分かる理由：同じ絵で出力の違いを並べると、セグメンテーション3種の区別が一目で分かる。
- 使うカード（3）：C-06-001（画像認識タスクの種類（物体識別・物体検出・セグメンテーション・姿勢推定））、C-06-019（セグメンテーションの3種類（セマンティック／インスタンス／パノプティック））、C-06-025（姿勢推定とOpenPose）
- 使う問題（4）：G-06-009、G-06-070、G-06-071、G-06-013
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [JDLA G検定シラバス（シラバス2024・2026年5月11日 第1.4版）](https://www.jdla.org/certificate/general/)（C-06-001）
  - [Lin et al. (2014) Microsoft COCO: Common Objects in Context (arXiv:1405.0312)](https://arxiv.org/abs/1405.0312)（C-06-001）
  - [柳井啓司（2007）一般物体認識の現状と今後（情報処理学会論文誌 コンピュータビジョンとイメージメディア 48(SIG16)）](https://ipsj.ixsq.nii.ac.jp/records/17938)（C-06-001）
  - [Cao et al. (2018) OpenPose: Realtime Multi-Person 2D Pose Estimation using Part Affinity Fields (arXiv:1812.08008)](https://arxiv.org/abs/1812.08008)（C-06-001、C-06-025）
  - [Kirillov et al. (2018) Panoptic Segmentation (arXiv:1801.00868)](https://arxiv.org/abs/1801.00868)（C-06-019）

#### fig-g-object-detection　物体検出の2段階型と1段階型

- 優先度：**A**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：上段＝2段階型（R-CNN 系）：画像 → 候補領域の提案（R-CNN は選択的探索、Faster R-CNN は RPN）→ 各候補を分類・枠の補正。Mask R-CNN は「さらにマスクの分岐を並列に追加」と注記。下段＝1段階型：YOLO は画像を格子に区切り、各マスから枠とクラス確率を一度に出す。SSD は解像度の違う複数の特徴マップに大きさ・縦横比の違うデフォルトボックスを置く。FPN は特徴マップのピラミッド（トップダウン＋横の接続）を小さな図で。右に「速さ：1段階型が有利」。
- 文字より分かる理由：「候補を出してから分類」か「一度に出す」かが、2段の流れ図で対比できる。
- 使うカード（6）：C-06-014（物体検出（2段階型と1段階型））、C-06-015（Fast R-CNN / Faster R-CNN）、C-06-016（YOLO（You Only Look Once））、C-06-017（SSD（Single Shot MultiBox Detector））、C-06-018（FPN（Feature Pyramid Network））、C-06-024（Mask R-CNN）
- 使う問題（4）：G-06-007、G-06-008、G-06-072、G-06-010
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Ren et al. (2015) Faster R-CNN (arXiv:1506.01497)](https://arxiv.org/abs/1506.01497)（C-06-014、C-06-015）
  - [Redmon et al. (2015) You Only Look Once (arXiv:1506.02640)](https://arxiv.org/abs/1506.02640)（C-06-014、C-06-016）
  - [Liu et al. (2015) SSD: Single Shot MultiBox Detector (arXiv:1512.02325)](https://arxiv.org/abs/1512.02325)（C-06-014、C-06-017）
  - [Girshick (2015) Fast R-CNN (arXiv:1504.08083)](https://arxiv.org/abs/1504.08083)（C-06-015）
  - [Lin et al. (2016) Feature Pyramid Networks for Object Detection (arXiv:1612.03144)](https://arxiv.org/abs/1612.03144)（C-06-018）
  - [He et al. (2017) Mask R-CNN (arXiv:1703.06870)](https://arxiv.org/abs/1703.06870)（C-06-024）

#### fig-g-word2vec　word2vec の CBOW とスキップグラム

- 優先度：**A**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：例文の5単語（窓の幅2）。左＝CBOW：周りの4単語 → 中心の1単語を予測（矢印が中心へ集まる）。右＝スキップグラム：中心の1単語 → 周りの4単語を予測（矢印が外へ広がる）。fastText は「単語を文字 n-gram に分けてベクトルの和」と注記。
- 文字より分かる理由：予測の向き（周り→中心か、中心→周りか）が矢印の向きで覚えられる。
- 使うカード（3）：C-06-029（word2vec（CBOW・スキップグラム））、C-06-030（fastText）、C-06-028（分散表現（単語埋め込み））
- 使う問題（3）：G-06-015、G-06-016、G-06-078
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Mikolov et al. (2013) Efficient Estimation of Word Representations in Vector Space (arXiv:1301.3781)](https://arxiv.org/abs/1301.3781)（C-06-029、C-06-028）
  - [Le & Mikolov (2014) Distributed Representations of Sentences and Documents (arXiv:1405.4053)](https://arxiv.org/abs/1405.4053)（C-06-029）
  - [Gensim Documentation: models.doc2vec – Doc2vec paragraph embeddings](https://radimrehurek.com/gensim/models/doc2vec.html)（C-06-029）
  - [Bojanowski et al. (2016) Enriching Word Vectors with Subword Information (arXiv:1607.04606)](https://arxiv.org/abs/1607.04606)（C-06-030）
  - [Baroni, Dinu & Kruszewski (2014) Don't count, predict! A systematic comparison of context-counting vs. context-predicting semantic vectors (ACL)](https://aclanthology.org/P14-1023.pdf)（C-06-028）
  - [Turney & Pantel (2010) From Frequency to Meaning: Vector Space Models of Semantics. JAIR (arXiv:1003.1141)](https://arxiv.org/abs/1003.1141)（C-06-028）

#### fig-g-bert-gpt　BERT（双方向・エンコーダ）と GPT（左から右・デコーダ）

- 優先度：**A**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：左：BERT。文「私は［MASK］を食べた」の各位置が左右すべての位置を見る矢印。事前学習は Masked Language Model と Next Sentence Prediction。右：GPT。各位置が自分より左だけを見る矢印（三角形の範囲）で、次の単語を予測。下に「事前学習 → ファインチューニング（出力層を足す）」と「Few-shot（重みを更新せず例を示す）」の違いを1行ずつ。
- 文字より分かる理由：「見える範囲」の違いが、矢印の向きの範囲で一目で分かる。
- 使うカード（4）：C-06-033（BERT）、C-06-035（大規模言語モデル（LLM）・PaLM）、C-06-072（自己教師あり学習）、C-06-074（Few-shot・One-shot・Zero-shot）
- 使う問題（3）：G-06-017、G-06-021、G-06-016
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Devlin et al. (2018) BERT (arXiv:1810.04805)](https://arxiv.org/abs/1810.04805)（C-06-033、C-06-072）
  - [Brown et al. (2020) Language Models are Few-Shot Learners (arXiv:2005.14165)](https://arxiv.org/abs/2005.14165)（C-06-035、C-06-074）
  - [Chowdhery et al. (2022) PaLM (arXiv:2204.02311)](https://arxiv.org/abs/2204.02311)（C-06-035）
  - [Chen et al. (2020) SimCLR (arXiv:2002.05709)](https://arxiv.org/abs/2002.05709)（C-06-072）

#### fig-g-pcm　A-D 変換（標本化・量子化・符号化）と標本化周波数

- 優先度：**A**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：3段の図。①連続した音の波形に、一定間隔の縦線と点（標本化）。②点を最も近い段（例 8段）に丸める（量子化）、丸めた差を小さく示す。③各段の値を3ビットの2進数に（符号化）。下に「標本化周波数の半分までの周波数しか記録できない（例：8,000 Hz なら 4,000 Hz まで）」と、粗すぎる標本化で波形が別の低い波に見える例。
- 文字より分かる理由：3つの手順の順番と、それぞれが何を離散にするか（時間か値か）が図で見分けられる。
- 使うカード（1）：C-06-039（A-D変換とPCM（パルス符号変調））
- 使う問題（2）：G-06-028、G-06-081
- 描く前に確かめること：「半分まで」の根拠（標本化定理）が C-06-039 の出典にあるか確かめる。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [JDLA G検定シラバス（シラバス2024・2026年5月11日 第1.4版）](https://www.jdla.org/certificate/general/)（C-06-039）
  - [文部科学省 高等学校情報科「情報Ⅰ」教員研修用教材 第2章 コミュニケーションと情報デザイン](https://www.mext.go.jp/content/20200928-mxt_jogai01-100013300_001.pdf)（C-06-039）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Chapter 15: Phonetics and Speech Feature Extraction](https://web.stanford.edu/~jurafsky/slp3/15.pdf)（C-06-039）

#### fig-g-cloud-models　オンプレミス・IaaS・PaaS・SaaS の管理範囲

- 優先度：**A**　／　主な章：07 AI の社会実装に向けて
- 何を描くか：4列×層の表（下から：設備・ハードウェア／ネットワーク・ストレージ／OS／ミドルウェア・開発環境／アプリケーション／データ）。各列で、利用者が管理する層を濃い色、事業者が提供する層を薄い色に塗る（オンプレは全部利用者、IaaS は OS から上が利用者、PaaS はアプリとデータが利用者、SaaS は設定程度）。下に「提供範囲が広いほど手間は減るが、変えられる部分も減る」。
- 文字より分かる理由：どこまで任せられるかは、塗り分けた表を見るのが最も早い。
- 使うカード（2）：C-07-020（クラウドのサービス形態（IaaS・PaaS・SaaS）とオンプレミス）、C-07-011（Web API とクラウド）
- 使う問題（3）：G-07-020、G-07-034、G-07-019
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [デジタル庁 デジタル社会推進標準ガイドライン DS-310「政府情報システムにおけるクラウドサービスの適切な利用に係る基本方針」（2025年5月27日）](https://www.digital.go.jp/assets/contents/node/basic_page/field_ref_resources/e2a06143-ed29-4f1d-9c31-0f06fca67afc/a612d406/20250619_resources_standard_guidelines_guideline_08.pdf)（C-07-020）
  - [NIST SP 800-145 The NIST Definition of Cloud Computing (2011)](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf)（C-07-020、C-07-011）
  - [AWS「API とは」](https://aws.amazon.com/jp/what-is/api/)（C-07-011）
  - [IPA「DX白書2023」](https://www.ipa.go.jp/publish/wp-dx/dx-2023.html)（C-07-011）

#### fig-g-bayes-area　条件付き確率とベイズの定理の面積図

- 優先度：**A**　／　主な章：08 AI に必要な数理・統計知識
- 何を描くか：1つの正方形を全体（例 10,000人）とし、縦に「病気 2%」「病気でない 98%」で細長く切る。それぞれを横に「陽性／陰性」で切る（病気の中の陽性 80%、病気でない中の陽性 10%）。陽性の2つの長方形（160人と980人）を太線で囲み、「陽性のうち病気 ＝ 160 ÷（160＋980）≒ 14%」。下に式 P(A|B)＝P(B|A)P(A)/P(B) を、各項が図のどの長方形かを色で対応させて書く。右に同時確率・周辺確率の2×2表（合計の行・列つき）を並べる。
- 文字より分かる理由：「事前確率が小さいと陽性でも確率は低い」が、面積の比として直感的に分かる。
- 使うカード（4）：C-08-007（条件付き確率）、C-08-026（ベイズの定理（事前確率・事後確率））、C-08-025（同時確率と周辺確率）、C-03-060（ナイーブベイズ）
- 使う問題（6）：G-08-009、G-08-028、G-08-045、G-08-046、G-08-047、G-03-050
- 描く前に確かめること：例の数値は問題（G-08-028・G-08-046）と別の自作の値にしてある。問題の数値をそのまま図にしない。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [MIT OCW 18.05 (Orloff & Bloom, Spring 2022) Class 3 Reading: Conditional Probability, Independence, Bayes’ Theorem](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/resources/mit18_05_s22_class03-prep_pdf/)（C-08-007）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 3 Probability and Information Theory（著者公開版）](https://www.deeplearningbook.org/contents/prob.html)（C-08-026、C-08-025）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 5 Machine Learning Basics（著者公開版）](https://www.deeplearningbook.org/contents/ml.html)（C-08-026）
  - [scikit-learn User Guide: Naive Bayes](https://scikit-learn.org/stable/modules/naive_bayes.html)（C-03-060）

#### fig-g-correlation　散布図と相関係数（強さ・向き・非線形の落とし穴）

- 優先度：**A**　／　主な章：08 AI に必要な数理・統計知識
- 何を描くか：5枚の散布図を並べる：r≒1（右上がりの直線状）、r≒0.7、r≒0（ばらばら）、r≒−0.7（右下がり）、そして Y＝X²（X は −3〜3 で左右対称）の放物線で r≒0 だが関係は強い（相互情報量は大きい）。下に「相関係数は直線的な関係だけを測る」「単位を変えても相関係数は変わらない、共分散は変わる」。
- 文字より分かる理由：相関係数の値と散布図の形の対応は、見て覚えるのが最も確実。
- 使うカード（3）：C-08-011（共分散）、C-08-012（相関係数）、C-08-021（相互情報量）
- 使う問題（6）：G-08-010、G-08-012、G-08-034、G-08-036、G-08-049、G-08-021
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [NIST/SEMATECH e-Handbook 6.5.4.1 Mean Vector and Covariance Matrix](https://www.itl.nist.gov/div898/handbook/pmc/section5/pmc541.htm)（C-08-011）
  - [NIST/SEMATECH e-Handbook 6.5.4.2 The Multivariate Normal Distribution](https://www.itl.nist.gov/div898/handbook/pmc/section5/pmc542.htm)（C-08-012）
  - [NIST/SEMATECH e-Handbook 1.3.3.26.2 Scatter Plot: Strong Linear (positive correlation) Relationship](https://www.itl.nist.gov/div898/handbook/eda/section3/eda33q2.htm)（C-08-012）
  - [NIST/SEMATECH e-Handbook 1.3.3.26.3 Scatter Plot: Strong Linear (negative correlation) Relationship](https://www.itl.nist.gov/div898/handbook/eda/section3/eda33q3.htm)（C-08-012）
  - [NIST/SEMATECH e-Handbook 1.3.3.26.1 Scatter Plot: No Relationship](https://www.itl.nist.gov/div898/handbook/eda/section3/eda33q1.htm)（C-08-012）
  - [scikit-learn API sklearn.feature_selection.mutual_info_classif](https://scikit-learn.org/stable/modules/generated/sklearn.feature_selection.mutual_info_classif.html)（C-08-021）
  - [scikit-learn User Guide 1.13 Feature selection（univariate feature selection）](https://scikit-learn.org/stable/modules/feature_selection.html)（C-08-021）

#### fig-g-distances　距離と類似度（ユークリッド・マンハッタン・チェビシェフ・コサイン）

- 優先度：**A**　／　主な章：08 AI に必要な数理・統計知識
- 何を描くか：方眼の上に2点 (1,1) と (5,4)。ユークリッド距離＝斜めの直線（√(4²＋3²)＝5）、マンハッタン距離＝方眼に沿った階段（4＋3＝7）、チェビシェフ距離＝差の大きい方（4）を色分けして描く。右：原点からの2本のベクトルの間の角 θ と「コサイン類似度＝cos θ、長さは無関係（同じ向きで長さ2倍でも1）」。
- 文字より分かる理由：各距離が何を測っているかは、方眼の上に3本の経路を描くと一目で分かる。
- 使うカード（1）：C-08-019（ユークリッド距離とコサイン類似度）
- 使う問題（5）：G-08-018、G-08-019、G-08-020、G-08-035、G-08-050
- 描く前に確かめること：例の2点は問題（G-08-018・G-08-050）と別の自作の値にしてある。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn API sklearn.metrics.pairwise.euclidean_distances](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.pairwise.euclidean_distances.html)（C-08-019）
  - [scikit-learn User Guide 8.8 Pairwise metrics, Affinities and Kernels（Cosine similarity）](https://scikit-learn.org/stable/modules/metrics.html)（C-08-019）
  - [SciPy API scipy.spatial.distance.cityblock](https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.distance.cityblock.html)（C-08-019）
  - [SciPy API scipy.spatial.distance.chebyshev](https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.distance.chebyshev.html)（C-08-019）

#### fig-g-hypothesis-test　仮説検定（棄却域・p値・第一種と第二種の過誤）

- 優先度：**A**　／　主な章：08 AI に必要な数理・統計知識
- 何を描くか：上：帰無仮説の下での検定統計量の分布（釣り鐘）。右端（両側なら両端）を塗って「棄却域（面積＝有意水準 α）」、観測値の縦線と、その外側の面積を斜線で「p値」。p値 ≤ α なら棄却。下：帰無仮説の分布と対立仮説の分布を横にずらして重ね、しきい値の右の帰無側の面積＝α（第一種の過誤）、左の対立側の面積＝β（第二種の過誤）、対立側の右の面積＝1−β（検出力）。右に2×2の表（真実×判断）で4つの区分。
- 文字より分かる理由：α・β・p値・検出力がどの面積かは、重ねた分布の図でないと区別しにくい。
- 使うカード（3）：C-08-017（帰無仮説と対立仮説（仮説検定））、C-08-023（第一種の過誤と第二種の過誤）、C-08-024（検定統計量・棄却域・有意水準・p値）
- 使う問題（7）：G-08-015、G-08-016、G-08-030、G-08-041、G-08-042、G-08-043、G-08-044
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [NIST/SEMATECH e-Handbook 7.1.3.1 Critical values and p values](https://www.itl.nist.gov/div898/handbook/prc/section1/prc131.htm)（C-08-017、C-08-024）
  - [NIST/SEMATECH e-Handbook 1.3.5 Quantitative Techniques（Hypothesis Tests）](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35.htm)（C-08-023、C-08-024）
  - [NIST/SEMATECH e-Handbook 7.1.3 What are statistical tests?](https://www.itl.nist.gov/div898/handbook/prc/section1/prc13.htm)（C-08-023）
  - [NIST/SEMATECH e-Handbook 7.2.2 Are the data consistent with the assumed process mean?](https://www.itl.nist.gov/div898/handbook/prc/section2/prc22.htm)（C-08-024）
  - [NIST/SEMATECH e-Handbook 1.3.6.7.1 Cumulative Distribution Function of the Standard Normal Distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3671.htm)（C-08-024）

#### fig-g-ai-ml-dl　AI・機械学習・ディープラーニングの包含関係

- 優先度：**B**　／　主な章：01 人工知能とは
- 何を描くか：入れ子の3つの楕円。外から「人工知能（AI）」「機械学習」「ディープラーニング」。各楕円の横に1行の説明（AI＝知的なプログラム全般、機械学習＝データから規則を学ぶ、DL＝特徴量までデータから学ぶ）。右に小さく「従来の機械学習：特徴量を人が設計 → 学習」「DL：生データ → 特徴量も学習」の2本の流れを並べ、違いが「特徴量を誰が作るか」であることを矢印の色で示す。4段階の分類（制御・古典的AI・機械学習・深層学習）は入れ子と1対1に対応しないので描かない。
- 文字より分かる理由：「DLは機械学習の一部」「違いは特徴量の設計者」の2点が、入れ子と2本の流れで一度に見える。
- 使うカード（4）：C-01-001（人工知能（AI））、C-01-005（機械学習）、C-01-006（ディープラーニング）、C-02-028（ルールベースと機械学習の違い）
- 使う問題（3）：G-01-005、G-02-029、G-02-040
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省 平成28年版 情報通信白書 人工知能（AI）とは](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h28/html/nc142110.html)（C-01-001）
  - [総務省 平成28年版 情報通信白書 人工知能（AI）研究の歴史](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h28/html/nc142120.html)（C-01-005、C-01-006、C-02-028）
  - [総務省 平成28年版 情報通信白書 代表的な研究テーマ](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h28/html/nc142130.html)（C-01-006、C-02-028）
  - [Google for Developers: Rules of Machine Learning（Rule #1・Rule #3）](https://developers.google.com/machine-learning/guides/rules-of-ml)（C-02-028）
  - [総務省・経済産業省「AI事業者ガイドライン（第1.2版）別添（付属資料）」（令和8年3月31日）](https://www.meti.go.jp/shingikai/mono_info_service/ai_shakai_jisso/pdf/20260331_3.pdf)（C-02-028）

#### fig-g-hanoi　ハノイの塔の手順と最少手数 2ⁿ−1

- 優先度：**B**　／　主な章：02 人工知能をめぐる動向
- 何を描くか：円盤3枚の場合の7手を、3本の柱の小さな絵を8コマ（初期状態＋7手）並べて示す。各コマに手番号と「どの円盤をどこへ」。下に表：n＝1,2,3,4 に対し手数 1,3,7,15（n＝5 以上は問題で計算させるので表に入れない）。右に「n枚 ＝（n−1枚を退避）＋（最大の1枚を移す）＋（n−1枚を戻す）」の分解図を3つの矢印で描き、手数 T(n)＝2T(n−1)＋1 → 2ⁿ−1 につながることを示す。
- 文字より分かる理由：再帰の分解（上のn−1枚を2回動かす）が絵で見えると、2ⁿ−1 を暗記でなく導ける。
- 使うカード（1）：C-02-005（ハノイの塔）
- 使う問題（1）：G-02-004
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [NIST Dictionary of Algorithms and Data Structures: towers of Hanoi](https://xlinux.nist.gov/dads/HTML/towersOfHanoi.html)（C-02-005）

#### fig-g-alphago　AlphaGo の構成（方策ネットワーク・価値ネットワーク・モンテカルロ木探索）

- 優先度：**B**　／　主な章：02 人工知能をめぐる動向
- 何を描くか：中央にモンテカルロ木探索の木（選択→展開→評価→更新の4段の輪）。左から「方策ネットワーク：次の一手の候補を絞る」、右から「価値ネットワーク：局面の勝率を見積もる」の2つの箱が木に矢印で入る。下に「プレイアウト（終局までランダムに打つ）の勝率」も評価に使う枝。別枠に AlphaGo Zero：人の棋譜なし・自己対戦のみ・1つのネットワーク（カードに書かれた範囲だけ描く）。
- 文字より分かる理由：3つの部品がどこで何をしているかが、文章より配置で掴める。
- 使うカード（2）：C-02-009（モンテカルロ法）、C-02-039（アルファ碁（AlphaGo））
- 使う問題（3）：G-02-007、G-02-036、G-02-044
- 描く前に確かめること：AlphaGo Zero の部品構成は C-02-039 の出典で確かめてから描く。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [NIST Dictionary of Algorithms and Data Structures: Monte Carlo algorithm](https://xlinux.nist.gov/dads/HTML/monteCarlo.html)（C-02-009）
  - [Silver et al. (2016) Mastering the game of Go with deep neural networks and tree search. Nature](https://www.nature.com/articles/nature16961)（C-02-009、C-02-039）
  - [Google DeepMind: AlphaGo](https://deepmind.google/research/breakthroughs/alphago/)（C-02-039）
  - [総務省 平成28年版 情報通信白書 人工知能（AI）とは](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h28/html/nc142110.html)（C-02-039）
  - [Silver et al. (2017) Mastering the game of Go without human knowledge. Nature 550](https://www.nature.com/articles/nature24270)（C-02-039）
  - [Silver et al. (2017) Mastering Chess and Shogi by Self-Play with a General Reinforcement Learning Algorithm (arXiv:1712.01815)](https://arxiv.org/abs/1712.01815)（C-02-039）

#### fig-g-semantic-net　意味ネットワークと is-a／has-a／part-of

- 優先度：**B**　／　主な章：02 人工知能をめぐる動向
- 何を描くか：節点（動物・鳥・カナリア・翼・羽）を矢印で結んだグラフ。カナリア→鳥→動物に「is-a」、鳥→翼に「has-a」または「part-of（翼 part-of 鳥）」の向きの違うラベル。is-a の矢印に沿って「動物は呼吸する」が下位へ受け継がれる（継承）ことを点線で示す。下に3つの関係の向きを1行ずつ（A is-a B＝AはBの一種、推移律が成り立つ）。
- 文字より分かる理由：関係の向きと継承は、矢印の図にすると取り違えにくい。
- 使うカード（3）：C-02-017（意味ネットワーク）、C-02-018（is-aの関係・has-aの関係・part-ofの関係）、C-02-019（オントロジー）
- 使う問題（3）：G-02-015、G-02-016、G-02-017
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [JDLA G検定シラバス 2024（第1.4版）](https://www.jdla.org/certificate/general/)（C-02-017、C-02-018）
  - [Sowa, Semantic Networks（Encyclopedia of Artificial Intelligence 掲載稿の著者改訂版）](http://www.jfsowa.com/pubs/semnet.htm)（C-02-017、C-02-018）
  - [松尾豊「人工知能の未来 －ディープラーニングの先にあるもの－」（経済産業研究所 BBLセミナー資料、2015年6月3日）](https://www.rieti.go.jp/jp/events/bbl/15060301.pdf)（C-02-017、C-02-018）
  - [W3C OWL 2 Web Ontology Language Document Overview (Second Edition)](https://www.w3.org/TR/owl2-overview/)（C-02-019）

#### fig-g-ml-three-types　教師あり・教師なし・強化学習の違い

- 優先度：**B**　／　主な章：03 機械学習の概要
- 何を描くか：3列の図。教師あり：散布図の点に色（ラベル）が付き、境界線を学ぶ。教師なし：同じ点が灰色のまま、まとまり（クラスタ）を丸で囲む。強化学習：エージェント→行動→環境→報酬・状態→エージェントの輪。各列の下に「学ぶ材料」（特徴量＋正解／特徴量だけ／行動と報酬）。
- 文字より分かる理由：材料の違い（ラベルの有無・報酬）が、同じ点群の色の有無で一目で分かる。
- 使うカード（5）：C-03-001（教師あり学習）、C-03-021（教師なし学習）、C-03-036（強化学習）、C-03-002（回帰問題）、C-03-003（分類問題）
- 使う問題（4）：G-03-001、G-03-024、G-03-025、G-03-003
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Cross-validation（教師あり学習の評価の前提）](https://scikit-learn.org/stable/modules/cross_validation.html)（C-03-001）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 5 Machine Learning Basics（著者公開版）](https://www.deeplearningbook.org/contents/ml.html)（C-03-001、C-03-021、C-03-002、C-03-003）
  - [scikit-learn User Guide: Clustering](https://scikit-learn.org/stable/modules/clustering.html)（C-03-021）
  - [Sutton & Barto (2018) Reinforcement Learning: An Introduction, 2nd ed.](http://incompleteideas.net/book/RLbook2020.pdf)（C-03-036）
  - [scikit-learn User Guide: Linear Models](https://scikit-learn.org/stable/modules/linear_model.html)（C-03-002）
  - [scikit-learn User Guide: Metrics and scoring](https://scikit-learn.org/stable/modules/model_evaluation.html)（C-03-002、C-03-003）
  - [scikit-learn User Guide: Multiclass and multioutput algorithms](https://scikit-learn.org/stable/modules/multiclass.html)（C-03-003）

#### fig-g-least-squares　最小二乗法（残差の二乗和を最小にする直線）と外れ値の影響

- 優先度：**B**　／　主な章：03 機械学習の概要
- 何を描くか：左：散布図に回帰直線、各点から直線へ縦の線分（残差）を引き、その長さを1辺とする小さな正方形を描いて「この面積の合計が最小」。右：同じ点に外れ値を1つ足し、直線が大きく傾く様子を元の直線（破線）と並べる。単回帰 y＝ax＋b、重回帰は説明変数が複数（平面になる）を小さな注記で。
- 文字より分かる理由：「二乗」が正方形の面積として見え、外れ値に引っ張られる理由も同じ図で分かる。
- 使うカード（5）：C-03-005（線形回帰）、C-03-006（単回帰分析）、C-03-007（重回帰分析）、C-08-015（最小二乗法）、C-08-002（外れ値）
- 使う問題（4）：G-03-002、G-03-054、G-08-013、G-08-031
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Linear Models](https://scikit-learn.org/stable/modules/linear_model.html)（C-03-005、C-03-006、C-03-007）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 5 Machine Learning Basics（著者公開版）](https://www.deeplearningbook.org/contents/ml.html)（C-03-005、C-03-007）
  - [NIST/SEMATECH e-Handbook 4.4.3.1 Least Squares](https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd431.htm)（C-08-015）
  - [NIST/SEMATECH e-Handbook 1.3.5.17 Detection of Outliers](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm)（C-08-002）
  - [NIST/SEMATECH e-Handbook 4.1.4.1 Linear Least Squares Regression](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm)（C-08-002）
  - [総務省統計局 なるほど統計学園「統計用語辞典（は行）」](https://www.stat.go.jp/naruhodo/13_yougo/ha-gyo.html)（C-08-002）

#### fig-g-logistic-regression　ロジスティック回帰（重み付き和→シグモイド→確率→分類）

- 優先度：**B**　／　主な章：03 機械学習の概要
- 何を描くか：左から右への流れ：入力 x₁,x₂ → 重み付き和 z＝w₁x₁＋w₂x₂＋b → シグモイド曲線（横軸 z、縦軸 0〜1、z＝0 で 0.5）→ 確率 p → しきい値 0.5 で「陽性／陰性」。シグモイドの図に p＝0.5 の水平線と z＝0 の垂直線。下に「名前は回帰、使い道は分類」。
- 文字より分かる理由：「回帰なのに分類」の理由が、確率に変換してから切る流れで納得できる。
- 使うカード（3）：C-03-008（ロジスティック回帰）、C-04-006（シグモイド関数）、C-03-003（分類問題）
- 使う問題（2）：G-03-004、G-03-003
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Linear Models（Logistic regression）](https://scikit-learn.org/stable/modules/linear_model.html)（C-03-008）
  - [PyTorch Documentation: torch.nn.Sigmoid](https://docs.pytorch.org/docs/stable/generated/torch.nn.Sigmoid.html)（C-04-006）
  - [Glorot & Bengio (2010) Understanding the difficulty of training deep feedforward neural networks. AISTATS](https://proceedings.mlr.press/v9/glorot10a.html)（C-04-006）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 3 Probability and Information Theory（著者公開版）](https://www.deeplearningbook.org/contents/prob.html)（C-04-006）
  - [Hochreiter (1998) The Vanishing Gradient Problem During Learning Recurrent Neural Nets and Problem Solutions. IJUFKS 6(2)（著者所属機関の公開版）](https://www.bioinf.jku.at/publications/older/2304.pdf)（C-04-006）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 6 Deep Feedforward Networks（著者公開版）](https://www.deeplearningbook.org/contents/mlp.html)（C-04-006）
  - [scikit-learn User Guide: Multiclass and multioutput algorithms](https://scikit-learn.org/stable/modules/multiclass.html)（C-03-003）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 5 Machine Learning Basics（著者公開版）](https://www.deeplearningbook.org/contents/ml.html)（C-03-003）
  - [scikit-learn User Guide: Metrics and scoring](https://scikit-learn.org/stable/modules/model_evaluation.html)（C-03-003）

#### fig-g-decision-tree　決定木の分割とジニ不純度

- 優先度：**B**　／　主な章：03 機械学習の概要
- 何を描くか：左：2段の決定木（「年齢≥30？」→「年収≥500？」）で、葉にクラスの件数。右：同じデータを2次元平面に置き、軸に平行な線で領域を区切った図（決定木の境界は軸に平行な階段状）。下に計算例：ノードにA 7件・B 3件 → pA＝0.7, pB＝0.3 → ジニ＝0.7×0.3＋0.3×0.7＝0.42。純粋なノード（A 10件）ならジニ 0、半々（5件・5件）なら 0.5。
- 文字より分かる理由：木の分岐と平面の区切りが対応していることと、不純度の計算の途中が見える。
- 使うカード（1）：C-03-014（決定木）
- 使う問題（2）：G-03-007、G-03-052
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Decision Trees](https://scikit-learn.org/stable/modules/tree.html)（C-03-014）

#### fig-g-dendrogram　階層的クラスタリングとデンドログラム

- 優先度：**B**　／　主な章：03 機械学習の概要
- 何を描くか：左：平面上の5点 A〜E。右：その結合順を表すデンドログラム（縦軸＝結合したときの距離）。近い A–B、D–E が低い位置で結合し、最後に全体がつながる。水平な切断線を1本引き、「ここで切ると3クラスタ」。注記「ウォード法：結合したときのクラスタ内のばらつきの増え方が最小の組を結合」。
- 文字より分かる理由：結合の順番と距離が木の高さとして見え、切る位置でクラスタ数が決まることが分かる。
- 使うカード（3）：C-03-024（ウォード法）、C-03-025（デンドログラム (樹形図)）、C-03-022（クラスタリング）
- 使う問題（2）：G-03-015、G-03-016
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Clustering（Hierarchical clustering）](https://scikit-learn.org/stable/modules/clustering.html)（C-03-024、C-03-025、C-03-022）

#### fig-g-recommender　協調フィルタリングとコンテンツベースフィルタリング

- 優先度：**B**　／　主な章：03 機械学習の概要
- 何を描くか：左：利用者×商品の評価表（行＝利用者4人、列＝商品5つ、空欄あり）。似た行の2人を同じ色で囲み、片方だけが買った商品を他方に推薦する矢印。新しい利用者の行が全部空欄で「コールドスタート」。アイテムベースは「列どうしの類似度」と注記。右：商品の特徴表（ジャンル・作者）と利用者の好みを照合して推薦。「他の利用者のデータは使わない」。
- 文字より分かる理由：「人どうしの似方」か「商品の特徴」か、どちらの表を使うかで違いが一目で分かる。
- 使うカード（3）：C-03-033（協調フィルタリング）、C-03-034（コンテンツベースフィルタリング）、C-03-035（コールドスタート問題）
- 使う問題（4）：G-03-021、G-03-022、G-03-023、G-03-057
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Google for Developers: Recommendation Systems - Collaborative filtering](https://developers.google.com/machine-learning/recommendation/collaborative/basics)（C-03-033）
  - [Google for Developers: Recommendation Systems - Collaborative filtering summary](https://developers.google.com/machine-learning/recommendation/collaborative/summary)（C-03-033、C-03-035）
  - [Linden, Smith & York (2003) Amazon.com Recommendations: Item-to-Item Collaborative Filtering. IEEE Internet Computing 7(1)](https://ieeexplore.ieee.org/document/1167344)（C-03-033、C-03-035）
  - [Amazon Science: The history of Amazon's recommendation algorithm](https://www.amazon.science/the-history-of-amazons-recommendation-algorithm)（C-03-033）
  - [Google for Developers: Recommendation Systems - Content-based filtering](https://developers.google.com/machine-learning/recommendation/content-based/basics)（C-03-034）

#### fig-g-explore-exploit　探索と活用（ε-greedy と UCB）

- 優先度：**B**　／　主な章：03 機械学習の概要
- 何を描くか：スロットマシン4台の棒グラフ（推定価値）。ε-greedy：確率 1−ε で最も高い棒を選ぶ、確率 ε でどれかをランダム、を円グラフ風に。UCB：各棒の上に「試行回数が少ないほど長い上乗せ（不確かさ）」を薄い色で継ぎ足し、合計が最大の台を選ぶ。試行回数の少ない台が選ばれる例を示す。
- 文字より分かる理由：UCB の「上乗せ」が棒の継ぎ足しとして見え、ε-greedy との選び方の違いが分かる。
- 使うカード（3）：C-03-042（バンディットアルゴリズム）、C-03-043（ε-greedy方策）、C-03-044（UCB方策）
- 使う問題（3）：G-03-029、G-03-030、G-03-031
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Sutton & Barto (2018) Reinforcement Learning: An Introduction, 2nd ed.（Ch.2 Multi-armed Bandits）](http://incompleteideas.net/book/RLbook2020.pdf)（C-03-042、C-03-043、C-03-044）

#### fig-g-rl-taxonomy　強化学習の手法の分類（価値ベース・方策ベース・Actor-Critic、モデルベース／フリー）

- 優先度：**B**　／　主な章：03 機械学習の概要
- 何を描くか：2軸の地図。横軸「価値関数を学ぶ ← → 方策を直接学ぶ」に、Q学習・SARSA（価値ベース）、Actor-Critic（中間）、REINFORCE・方策勾配法（方策ベース）を置く。縦に「モデルベース（環境のモデルで先読み・動的計画法）／モデルフリー（試行錯誤のみ）」の帯。ベルマン方程式は価値ベースの土台として下に。
- 文字より分かる理由：似た名前の手法の位置関係が、地図にすると一度に整理できる。
- 使うカード（7）：C-03-045（方策勾配法）、C-03-046（REINFORCE）、C-03-047（Actor-Critic）、C-03-061（モデルフリーとモデルベース）、C-03-062（ベルマン方程式と動的計画法）、C-03-039（状態価値関数・行動価値関数）、C-03-040（Q学習）
- 使う問題（4）：G-03-033、G-03-058、G-03-059、G-03-062
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Sutton & Barto (2018) Reinforcement Learning: An Introduction, 2nd ed.（Ch.13 Policy Gradient Methods）](http://incompleteideas.net/book/RLbook2020.pdf)（C-03-045、C-03-046、C-03-047、C-03-061、C-03-062、C-03-039、C-03-040）

#### fig-g-regression-metrics　回帰の評価指標（MAE・MSE・RMSE）の違い

- 優先度：**B**　／　主な章：03 機械学習の概要
- 何を描くか：予測と実測の差 +2, −1, +3 の3本の縦棒。MAE：絶対値 2,1,3 を並べて平均 2。MSE：二乗 4,1,9 の正方形を並べて平均 約4.67、大きな誤差ほど正方形が急に大きくなる。RMSE＝√4.67 ≒ 2.16（元の単位に戻る）。
- 文字より分かる理由：二乗で大きな誤差が強調される様子が、正方形の大きさで見える。
- 使うカード（2）：C-03-056（平均二乗誤差 (MSE)・二乗平均平方根誤差 (RMSE)・平均絶対値誤差 (MAE)）、C-04-013（平均二乗誤差関数）
- 使う問題（2）：G-03-041、G-03-042
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Metrics and scoring（Regression metrics）](https://scikit-learn.org/stable/modules/model_evaluation.html)（C-03-056）
  - [PyTorch Documentation: torch.nn.MSELoss](https://docs.pytorch.org/docs/stable/generated/torch.nn.MSELoss.html)（C-04-013）

#### fig-g-knn　k 近傍法（k で答えが変わる）

- 優先度：**B**　／　主な章：03 機械学習の概要
- 何を描くか：平面にクラスA（○）とB（△）の点、中央に新しい点（☆）。☆を中心に k＝1 の円（最も近い1点が B → B）、k＝3 の円（A 2点・B 1点 → A）、k＝5 の円を重ねる。
- 文字より分かる理由：k を変えると多数決の結果が変わることが、同心円で一目で分かる。
- 使うカード（2）：C-03-059（k近傍法 (k-NN)）、C-08-019（ユークリッド距離とコサイン類似度）
- 使う問題（1）：G-03-049
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Nearest Neighbors](https://scikit-learn.org/stable/modules/neighbors.html)（C-03-059）
  - [scikit-learn API sklearn.metrics.pairwise.euclidean_distances](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.pairwise.euclidean_distances.html)（C-08-019）
  - [scikit-learn User Guide 8.8 Pairwise metrics, Affinities and Kernels（Cosine similarity）](https://scikit-learn.org/stable/modules/metrics.html)（C-08-019）
  - [SciPy API scipy.spatial.distance.cityblock](https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.distance.cityblock.html)（C-08-019）
  - [SciPy API scipy.spatial.distance.chebyshev](https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.distance.chebyshev.html)（C-08-019）

#### fig-g-neuron-mlp　ニューロンの計算と全結合層のパラメータ数

- 優先度：**B**　／　主な章：04 ディープラーニングの概要
- 何を描くか：左：1つのニューロン。入力 x₁〜x₃ に重み w₁〜w₃ の矢印、和の記号 Σ にバイアス b、活性化関数 f を通って出力。右：全結合層（入力4・出力3）の全矢印を描き、「重み 4×3＝12 ＋ バイアス 3 ＝ 15」。式 (入力数＋1)×出力数。下に「順伝播：入力→出力」の矢印。
- 文字より分かる理由：パラメータ数の式の「＋1」がバイアスであることが、矢印を数えれば分かる。
- 使うカード（4）：C-04-003（入力層・隠れ層・出力層）、C-05-001（全結合層）、C-05-002（重みと線形関数（全結合層のパラメータ数））、C-04-005（活性化関数）
- 使う問題（2）：G-05-001、G-05-002
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Rumelhart, Hinton & Williams (1986) Learning representations by back-propagating errors. Nature](https://www.nature.com/articles/323533a0)（C-04-003）
  - [scikit-learn User Guide: Neural network models (supervised)](https://scikit-learn.org/stable/modules/neural_networks_supervised.html)（C-04-003）
  - [PyTorch Documentation: torch.nn.Linear](https://docs.pytorch.org/docs/stable/generated/torch.nn.Linear.html)（C-05-001、C-05-002）
  - [Google for Developers: Machine Learning Glossary（activation function）](https://developers.google.com/machine-learning/glossary)（C-04-005）

#### fig-g-softmax　ソフトマックス関数（出力を合計1の確率にする）

- 優先度：**B**　／　主な章：04 ディープラーニングの概要
- 何を描くか：3クラス（犬・猫・鳥）の出力値（自作の例 3.0, 1.0, 0.0）の棒 → eˣ の棒（20.09, 2.72, 1.00）→ 合計 23.80 で割った棒（0.844, 0.114, 0.042、合計 1.000）。3段の棒グラフを矢印でつなぐ。
- 文字より分かる理由：「大小関係を保ったまま合計1にする」計算の途中が、3段の棒で見える。
- 使うカード（2）：C-04-010（ソフトマックス関数）、C-03-004（多クラス分類）
- 使う問題（2）：G-04-009、G-04-010
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [PyTorch Documentation: torch.nn.Softmax](https://docs.pytorch.org/docs/stable/generated/torch.nn.Softmax.html)（C-04-010）
  - [scikit-learn User Guide: Multiclass and multioutput algorithms](https://scikit-learn.org/stable/modules/multiclass.html)（C-03-004）

#### fig-g-loss-functions　誤差関数（交差エントロピー・二乗誤差）と KL 情報量

- 優先度：**B**　／　主な章：04 ディープラーニングの概要
- 何を描くか：左：横軸＝正解クラスの予測確率 p（0〜1）、縦軸＝交差エントロピー −log p。p→1 で 0、p→0 で急に大きくなる曲線。中：回帰の二乗誤差の放物線。右：2つの分布 P・Q の棒グラフを重ね、KL(P‖Q) と KL(Q‖P) が違う値になる（非対称）ことを注記。タスクと誤差関数の対応表（分類＝交差エントロピー、回帰＝二乗誤差）。
- 文字より分かる理由：正解の確率が高いほど誤差が小さくなる形が、曲線で直感的に分かる。
- 使うカード（4）：C-04-011（誤差関数）、C-04-012（交差エントロピー）、C-04-013（平均二乗誤差関数）、C-04-014（カルバック・ライブラー情報量 (KL)）
- 使う問題（3）：G-04-011、G-04-012、G-04-015
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Google for Developers: Machine Learning Glossary（backpropagation / loss）](https://developers.google.com/machine-learning/glossary)（C-04-011、C-04-012）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 6 Deep Feedforward Networks（著者公開版）](https://www.deeplearningbook.org/contents/mlp.html)（C-04-011）
  - [PyTorch Documentation: torch.nn.CrossEntropyLoss](https://docs.pytorch.org/docs/stable/generated/torch.nn.CrossEntropyLoss.html)（C-04-012）
  - [PyTorch Documentation: torch.nn.MSELoss](https://docs.pytorch.org/docs/stable/generated/torch.nn.MSELoss.html)（C-04-013）
  - [PyTorch Documentation: torch.nn.KLDivLoss](https://docs.pytorch.org/docs/stable/generated/torch.nn.KLDivLoss.html)（C-04-014）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 3 Probability and Information Theory（著者公開版）](https://www.deeplearningbook.org/contents/prob.html)（C-04-014）
  - [Burgess, Higgins et al. (2018) Understanding disentangling in β-VAE (arXiv:1804.03599)](https://arxiv.org/abs/1804.03599)（C-04-014）

#### fig-g-dropout　ドロップアウト（学習時と推論時）

- 優先度：**B**　／　主な章：04 ディープラーニングの概要
- 何を描くか：同じ全結合ネットワーク（入力4・隠れ5・隠れ5・出力2）を2つ並べる。左＝学習時：隠れ層のユニットのいくつかに×印、そのユニットの矢印を消す（毎回ランダムに変わる、と注記）。右＝推論時：全ユニットを使う。
- 文字より分かる理由：学習時だけユニットを消すことが、2枚の比較で誤解なく伝わる。
- 使うカード（2）：C-04-021（ドロップアウト）、C-04-017（正則化）
- 使う問題（1）：G-04-018
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Srivastava et al. (2014) Dropout: A Simple Way to Prevent Neural Networks from Overfitting. JMLR](https://jmlr.org/papers/v15/srivastava14a.html)（C-04-021）
  - [PyTorch Documentation: torch.nn.Dropout](https://docs.pytorch.org/docs/stable/generated/torch.nn.Dropout.html)（C-04-021）
  - [Google for Developers: Machine Learning Glossary（L1 / L2 regularization）](https://developers.google.com/machine-learning/glossary)（C-04-017）

#### fig-g-batch-epoch　バッチ・ミニバッチ・オンライン学習とエポック・イテレーション

- 優先度：**B**　／　主な章：04 ディープラーニングの概要
- 何を描くか：訓練データ 1,000 件を帯で表す。バッチ：帯全体で1回更新。ミニバッチ：50 件ずつ20個に区切り、区切りごとに更新（1エポック＝20イテレーション、3エポックで60回）。オンライン：1件ごとに更新。3行の帯の右に「1エポックあたりの更新回数」。
- 文字より分かる理由：エポックとイテレーションの関係が、区切った帯を数えれば分かる。
- 使うカード（3）：C-04-031（バッチ学習・ミニバッチ学習・オンライン学習）、C-04-032（確率的勾配降下法 (SGD)）、C-04-033（エポック・イテレーション）
- 使う問題（3）：G-04-028、G-04-029、G-04-042
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Google for Developers: Machine Learning Glossary（batch size / mini-batch）](https://developers.google.com/machine-learning/glossary)（C-04-031、C-04-032、C-04-033）
  - [PyTorch Documentation: torch.optim.SGD](https://docs.pytorch.org/docs/stable/generated/torch.optim.SGD.html)（C-04-032）

#### fig-g-double-descent　二重降下現象

- 優先度：**B**　／　主な章：04 ディープラーニングの概要
- 何を描くか：横軸＝モデルの大きさ（または学習の長さ）、縦軸＝テスト誤差。下がる→上がる（従来の U 字の右側）→ 補間のしきい値付近でピーク → 再び下がる曲線。左半分に「従来の見方（バイアス・バリアンス）」、右半分に「さらに大きくすると再び良くなる」。
- 文字より分かる理由：「いったん悪くなってまた良くなる」形は、曲線を見れば一度で覚えられる。
- 使うカード（2）：C-04-041（二重降下現象）、C-03-064（バイアスとバリアンス）
- 使う問題（1）：G-04-038
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Nakkiran et al. (2019) Deep Double Descent: Where Bigger Models and More Data Hurt (arXiv:1912.02292)](https://arxiv.org/abs/1912.02292)（C-04-041）
  - [Goodfellow, Bengio & Courville "Deep Learning" Chapter 5 Machine Learning Basics（著者公開版）](https://www.deeplearningbook.org/contents/ml.html)（C-03-064）

#### fig-g-grid-random-search　グリッドサーチとランダムサーチ

- 優先度：**B**　／　主な章：04 ディープラーニングの概要
- 何を描くか：2つのハイパーパラメータの正方形を2つ並べる。左：3×3の格子に9点。右：同じ9点をランダムに配置。それぞれの上辺に、重要なパラメータ軸への射影を描くと、格子では3通りの値しか試せず、ランダムでは9通り試せる。
- 文字より分かる理由：同じ試行回数でも、重要な軸で試せる値の数が違うことが射影で見える。
- 使うカード（2）：C-04-044（グリッドサーチ・ランダムサーチ）、C-04-043（ハイパーパラメータ）
- 使う問題（2）：G-04-041、G-04-040
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Tuning the hyper-parameters of an estimator](https://scikit-learn.org/stable/modules/grid_search.html)（C-04-044）
  - [Bergstra & Bengio (2012) Random Search for Hyper-Parameter Optimization. JMLR](https://www.jmlr.org/papers/v13/bergstra12a.html)（C-04-044）
  - [Google for Developers: Machine Learning Glossary（hyperparameter）](https://developers.google.com/machine-learning/glossary)（C-04-043）

#### fig-g-cnn-arch　CNN の全体構成（畳み込み→プーリング→全結合）

- 優先度：**B**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：入力画像 → 畳み込み → プーリング → 畳み込み → プーリング → 全結合 → 出力、を厚みの変わる直方体の列で描く（空間は小さく、チャネルは多くなる）。下に、浅い層＝エッジ、中＝形の部品、深い層＝物体、の模式的な特徴の絵。ネオコグニトロン（S細胞・C細胞）と LeNet（畳み込みとサブサンプリング）が同じ流れの先祖である、と年表風の注記。
- 文字より分かる理由：層が進むにつれて「小さく・深く」なる形と、特徴の階層が一度に見える。
- 使うカード（3）：C-05-003（畳み込みニューラルネットワーク (CNN)）、C-02-035（ネオコグニトロン）、C-02-036（LeNet）
- 使う問題（3）：G-02-034、G-02-035、G-05-008
- 描く前に確かめること：ネオコグニトロンの S細胞・C細胞の語はカードに無い。出典で確かめるか、描かない。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Goodfellow, Bengio & Courville (2016) Deep Learning, Chapter 9 Convolutional Networks](https://www.deeplearningbook.org/contents/convnets.html)（C-05-003）
  - [Fukushima (1980) Neocognitron. Biological Cybernetics](https://link.springer.com/article/10.1007/BF00344251)（C-02-035）
  - [LeCun et al. (1998) Gradient-Based Learning Applied to Document Recognition](http://yann.lecun.com/exdb/publis/pdf/lecun-98.pdf)（C-02-036）

#### fig-g-dilated-conv　Dilated（Atrous）Convolution と WaveNet の因果的な畳み込み

- 優先度：**B**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：左：入力格子の上に、通常の 3×3 フィルタ（隣接9マス）と、間隔2の dilated 3×3（1マスおきの9マス、見る範囲 5×5）を色違いで重ねる。パラメータ数は同じ9。右：1次元の時系列で、dilation 1・2・4・8 の層を積み重ね、出力1点が過去の16サンプルを見ている木（未来は見ない＝因果的）。
- 文字より分かる理由：「隙間をあけて広く見る」ことと、層を重ねると見る範囲が倍々に広がることが図で分かる。
- 使うカード（2）：C-05-010（Dilated Convolution・Atrous Convolution）、C-06-045（WaveNet）
- 使う問題（4）：G-05-009、G-05-010、G-06-084、G-06-027
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Yu & Koltun (2015) Multi-Scale Context Aggregation by Dilated Convolutions (arXiv:1511.07122)](https://arxiv.org/abs/1511.07122)（C-05-010）
  - [Chen et al. (2016) DeepLab: Semantic Image Segmentation with Deep Convolutional Nets, Atrous Convolution, and Fully Connected CRFs (arXiv:1606.00915)](https://arxiv.org/abs/1606.00915)（C-05-010）
  - [PyTorch Documentation: torch.nn.Conv2d（dilation）](https://docs.pytorch.org/docs/stable/generated/torch.nn.Conv2d.html)（C-05-010）
  - [van den Oord et al. (2016) WaveNet (arXiv:1609.03499)](https://arxiv.org/abs/1609.03499)（C-06-045）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Chapter 17: Text-to-Speech](https://web.stanford.edu/~jurafsky/slp3/17.pdf)（C-06-045）

#### fig-g-depthwise-separable　Depthwise Separable Convolution（2段に分けて計算を減らす）

- 優先度：**B**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：上：通常の畳み込み（3×3×C のフィルタを出力チャネル数 M 個）。下：①Depthwise：チャネルごとに 3×3 を1枚ずつ（C 枚）、②Pointwise：1×1×C を M 個。パラメータ数の比較を例の数値で（C＝32、M＝64：通常 3×3×32×64＝18,432、分離 3×3×32＋32×64＝2,336、バイアス除く）。MobileNet がこれを使うと注記。
- 文字より分かる理由：どの方向（空間・チャネル）を分けて計算しているかが立体図で分かり、削減量も見える。
- 使うカード（2）：C-05-011（Depthwise Separable Convolution）、C-06-009（MobileNet）
- 使う問題（2）：G-05-011、G-06-004
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Howard et al. (2017) MobileNets: Efficient Convolutional Neural Networks for Mobile Vision Applications (arXiv:1704.04861)](https://arxiv.org/abs/1704.04861)（C-05-011、C-06-009）
  - [PyTorch Documentation: torch.nn.Conv2d（groups）](https://docs.pytorch.org/docs/stable/generated/torch.nn.Conv2d.html)（C-05-011）

#### fig-g-elman-jordan　エルマンネットワークとジョルダンネットワーク

- 優先度：**B**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：2つの3層ネットワークを並べる。エルマン：隠れ層の出力を文脈ユニットへコピーし、次の時刻に隠れ層へ戻す。ジョルダン：出力層の出力を状態ユニットへ戻し、次の時刻の入力に加える。戻る矢印の出発点（隠れ層か出力層か）を色で強調。
- 文字より分かる理由：どこから戻すかの1点の違いが、矢印の出発点で一目で分かる。
- 使うカード（2）：C-05-023（エルマンネットワーク）、C-05-024（ジョルダンネットワーク）
- 使う問題（1）：G-05-030
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [JDLA G検定シラバス 2024（第1.4版）](https://www.jdla.org/certificate/general/)（C-05-023、C-05-024）
  - [Elman (1990) Finding Structure in Time. Cognitive Science 14（コロラド大学の講義資料に掲載された原論文）](https://home.cs.colorado.edu/~mozer/Teaching/syllabi/3702/readings/Elman1990.pdf)（C-05-023）
  - [Jordan (1986) Serial Order: A Parallel Distributed Processing Approach. ICS Report 8604, UC San Diego](https://cseweb.ucsd.edu/~gary/PAPER-SUGGESTIONS/Jordan-TR-8604-OCRed.pdf)（C-05-024）

#### fig-g-bidirectional-rnn　双方向 RNN

- 優先度：**B**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：入力 x₁〜x₄ の上に、左→右の RNN の行と、右→左の RNN の行を2段で描き、各時刻の出力に両方の矢印が入る。「品詞の判定に前後両方の文脈を使う」例。
- 文字より分かる理由：各時刻が過去と未来の両方を見ていることが、2段の矢印で分かる。
- 使うカード（1）：C-05-030（双方向 RNN (Bidirectional RNN)）
- 使う問題（1）：G-05-032
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Goodfellow, Bengio & Courville (2016) Deep Learning, Chapter 10（10.3 Bidirectional RNNs）](https://www.deeplearningbook.org/contents/rnn.html)（C-05-030）

#### fig-g-upsampling　アップサンプリング（逆プーリングと逆畳み込み）

- 優先度：**B**　／　主な章：05 ディープラーニングの要素技術
- 何を描くか：左：最大値プーリングで最大値の位置を記録 → 逆プーリングでその位置に値を戻し、他は0。右：2×2 の入力を、ストライド2の転置畳み込みで 4×4 に広げる（各入力値がフィルタ倍されて出力に重なる）。
- 文字より分かる理由：小さな特徴マップを大きく戻す2つの方法の違いが、格子で見える。
- 使うカード（2）：C-05-049（アップサンプリング（逆畳み込み・逆プーリング））、C-06-021（SegNet）
- 使う問題（1）：G-05-057
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Zeiler & Fergus (2013) Visualizing and Understanding Convolutional Networks (arXiv:1311.2901)](https://arxiv.org/abs/1311.2901)（C-05-049）
  - [Long, Shelhamer & Darrell (2014) Fully Convolutional Networks for Semantic Segmentation (arXiv:1411.4038)](https://arxiv.org/abs/1411.4038)（C-05-049）
  - [Badrinarayanan et al. (2015) SegNet (arXiv:1511.00561)](https://arxiv.org/abs/1511.00561)（C-05-049、C-06-021）
  - [PyTorch Documentation: torch.nn.ConvTranspose2d](https://docs.pytorch.org/docs/stable/generated/torch.nn.ConvTranspose2d.html)（C-05-049）

#### fig-g-cnn-models　代表的な画像分類モデルの比較表

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：表：モデル名／発表年／深さ／ひと言の工夫（AlexNet：ReLU・GPU・ドロップアウト、VGG：3×3だけを重ねる、GoogLeNet：Inception モジュール・補助分類器、ResNet：スキップ結合で152層、Wide ResNet：浅く広く、DenseNet：前の全層と連結、SENet：チャネルの重み付け、MobileNet：深さ方向分離畳み込み、EfficientNet：深さ・幅・解像度の複合スケーリング、ViT：パッチ＋Transformer）。各行に構造の小さなアイコン。年と層数は各カードの出典で確かめてから書く。
- 文字より分かる理由：混同しやすいモデルの「工夫の1点」が、表にすると縦に比べられる。
- 使うカード（10）：C-06-002（AlexNet）、C-06-003（VGG）、C-06-004（GoogLeNet（Inception））、C-06-005（ResNet）、C-06-006（Wide ResNet）、C-06-007（DenseNet）、C-06-008（SENet（Squeeze-and-Excitation））、C-06-009（MobileNet）、C-06-012（EfficientNet）、C-06-013（Vision Transformer（ViT））
- 使う問題（4）：G-06-002、G-06-004、G-06-003、G-06-073
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Krizhevsky et al. (2012) ImageNet Classification with Deep Convolutional Neural Networks (NeurIPS)](https://papers.nips.cc/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html)（C-06-002）
  - [Simonyan & Zisserman (2014) Very Deep Convolutional Networks for Large-Scale Image Recognition (arXiv:1409.1556)](https://arxiv.org/abs/1409.1556)（C-06-003）
  - [Szegedy et al. (2014) Going Deeper with Convolutions (arXiv:1409.4842)](https://arxiv.org/abs/1409.4842)（C-06-004）
  - [He et al. (2015) Deep Residual Learning for Image Recognition (arXiv:1512.03385)](https://arxiv.org/abs/1512.03385)（C-06-005）
  - [Zagoruyko & Komodakis (2016) Wide Residual Networks (arXiv:1605.07146)](https://arxiv.org/abs/1605.07146)（C-06-006）
  - [Huang et al. (2016) Densely Connected Convolutional Networks (arXiv:1608.06993)](https://arxiv.org/abs/1608.06993)（C-06-007）
  - [Hu et al. (2017) Squeeze-and-Excitation Networks (arXiv:1709.01507)](https://arxiv.org/abs/1709.01507)（C-06-008）
  - [Howard et al. (2017) MobileNets (arXiv:1704.04861)](https://arxiv.org/abs/1704.04861)（C-06-009）
  - [Tan & Le (2019) EfficientNet (arXiv:1905.11946)](https://arxiv.org/abs/1905.11946)（C-06-012）
  - [Dosovitskiy et al. (2020) An Image is Worth 16x16 Words (Vision Transformer) (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929)（C-06-013）

#### fig-g-efficientnet　EfficientNet の複合スケーリング

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：基準のネットワークを長方形の積み重ねで描き、①幅だけ広げる、②深さだけ増やす、③入力解像度だけ上げる、④3つを1つの係数で同時に少しずつ上げる（複合スケーリング）、の4つを並べる。
- 文字より分かる理由：3方向のどれを伸ばすかが、図形の変形で一目で分かる。
- 使うカード（2）：C-06-012（EfficientNet）、C-06-006（Wide ResNet）
- 使う問題（1）：G-06-003
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Tan & Le (2019) EfficientNet (arXiv:1905.11946)](https://arxiv.org/abs/1905.11946)（C-06-012）
  - [Zagoruyko & Komodakis (2016) Wide Residual Networks (arXiv:1605.07146)](https://arxiv.org/abs/1605.07146)（C-06-006）

#### fig-g-vit　Vision Transformer（画像をパッチの列にする）

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：画像を 4×4 のパッチに切り、パッチを1列に並べる → 各パッチを線形変換で埋め込み ＋ 位置埋め込み → 先頭にクラス用のトークン → Transformer エンコーダ → クラス用トークンの出力で分類。
- 文字より分かる理由：「画像を単語の列のように扱う」の意味が、切って並べる絵で分かる。
- 使うカード（2）：C-06-013（Vision Transformer（ViT））、C-05-035（Transformer）
- 使う問題（1）：G-06-005
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Dosovitskiy et al. (2020) An Image is Worth 16x16 Words (Vision Transformer) (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929)（C-06-013）
  - [Vaswani et al. (2017) Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762)（C-05-035）

#### fig-g-segmentation-nets　セグメンテーションのモデル（FCN・SegNet・U-Net）

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：3つのエンコーダ・デコーダ図を並べる。FCN：全結合層を使わず畳み込みだけで、最後にアップサンプリング。SegNet：エンコーダの最大値プーリングの位置（インデックス）をデコーダに渡して逆プーリング。U-Net：U 字型で、縮小側の特徴マップを拡大側へコピーして連結（スキップ接続の横線）。PSPNet（ピラミッドプーリング）・DeepLab（Atrous 畳み込み）は1行の注記。
- 文字より分かる理由：「何をデコーダへ渡すか」の違いが、横向きの矢印の有無と中身で見分けられる。
- 使うカード（4）：C-06-020（FCN（Fully Convolutional Network））、C-06-021（SegNet）、C-06-022（U-Net）、C-06-023（PSPNet と DeepLab）
- 使う問題（2）：G-06-011、G-06-012
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Long et al. (2014) Fully Convolutional Networks for Semantic Segmentation (arXiv:1411.4038)](https://arxiv.org/abs/1411.4038)（C-06-020）
  - [Badrinarayanan et al. (2015) SegNet (arXiv:1511.00561)](https://arxiv.org/abs/1511.00561)（C-06-021）
  - [Ronneberger et al. (2015) U-Net (arXiv:1505.04597)](https://arxiv.org/abs/1505.04597)（C-06-022）
  - [Zhao et al. (2016) Pyramid Scene Parsing Network (arXiv:1612.01105)](https://arxiv.org/abs/1612.01105)（C-06-023）
  - [Chen et al. (2016) DeepLab (arXiv:1606.00915)](https://arxiv.org/abs/1606.00915)（C-06-023）

#### fig-g-text-vectors　単語・文書の表し方（ワンホット・BoW・TF-IDF・分散表現）

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：語彙5語の例で、ワンホット（1つだけ1の長いベクトル）、BoW（文書ごとの出現回数）、TF-IDF（どの文書にも出る語は小さく、その文書に特有の語は大きく）を同じ表の形で並べる。右に分散表現：2次元に縮めた図で、意味の近い単語（犬・猫）が近く、遠い単語（車）が離れて配置される。
- 文字より分かる理由：疎な表現と密な表現の違いが、表と散布図の並びで一目で分かる。
- 使うカード（2）：C-06-027（ワンホットベクトル・BoW・TF-IDF・n-gram）、C-06-028（分散表現（単語埋め込み））
- 使う問題（3）：G-06-023、G-06-076、G-06-077
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [JDLA G検定シラバス（シラバス2024・2026年5月11日 第1.4版）](https://www.jdla.org/certificate/general/)（C-06-027）
  - [scikit-learn User Guide: Feature extraction（Text feature extraction）](https://scikit-learn.org/stable/modules/feature_extraction.html)（C-06-027）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Chapter 3: N-gram Language Models](https://web.stanford.edu/~jurafsky/slp3/3.pdf)（C-06-027）
  - [Goodfellow, Bengio & Courville (2016) Deep Learning, Chapter 15 Representation Learning](https://www.deeplearningbook.org/contents/representation.html)（C-06-027）
  - [Turney & Pantel (2010) From Frequency to Meaning: Vector Space Models of Semantics. JAIR (arXiv:1003.1141)](https://arxiv.org/abs/1003.1141)（C-06-027、C-06-028）
  - [Mikolov et al. (2013) Efficient Estimation of Word Representations in Vector Space (arXiv:1301.3781)](https://arxiv.org/abs/1301.3781)（C-06-028）
  - [Baroni, Dinu & Kruszewski (2014) Don't count, predict! A systematic comparison of context-counting vs. context-predicting semantic vectors (ACL)](https://aclanthology.org/P14-1023.pdf)（C-06-028）

#### fig-g-scaling-law　スケーリング則（損失はべき乗則で下がる）

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：両対数グラフ（横軸＝計算量・データ量・パラメータ数、縦軸＝損失）で、右下がりの直線。普通の目盛りでは曲線に見えることを小さな図で添える。
- 文字より分かる理由：べき乗則は「両対数で直線」と図で覚えるのが最も確実。
- 使うカード（2）：C-06-036（スケーリング則）、C-06-035（大規模言語モデル（LLM）・PaLM）
- 使う問題（1）：G-06-020
- 描く前に確かめること：傾きの数値は書かない（出典の値を確かめていないため）。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Kaplan et al. (2020) Scaling Laws for Neural Language Models (arXiv:2001.08361)](https://arxiv.org/abs/2001.08361)（C-06-036）
  - [Brown et al. (2020) Language Models are Few-Shot Learners (arXiv:2005.14165)](https://arxiv.org/abs/2005.14165)（C-06-035）
  - [Chowdhery et al. (2022) PaLM (arXiv:2204.02311)](https://arxiv.org/abs/2204.02311)（C-06-035）

#### fig-g-nlp-pipeline　文の解析の段階（形態素解析→構文解析→意味解析→文脈解析）

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：1つの例文（自作）を上から順に処理する段の図。形態素解析：分かち書きと品詞。構文解析：係り受けの矢印。意味解析：「誰が・何を」の関係。照応解析：代名詞から指す語への矢印。談話構造解析：文と文のつながり。ストップワード除去は形態素解析の後の前処理として注記。
- 文字より分かる理由：各段で何を付け加えるかが、同じ文に重ねていくと分かる。
- 使うカード（3）：C-06-094（形態素解析と分かち書き・ストップワード）、C-06-095（文の解析の段階（構文解析・意味解析・照応解析・談話構造解析））、C-06-026（自然言語処理の代表的なタスク）
- 使う問題（3）：G-06-024、G-06-074、G-06-075
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [MeCab: Yet Another Part-of-Speech and Morphological Analyzer（公式サイト）](https://taku910.github.io/mecab/)（C-06-094）
  - [京都大学 言語メディア研究室「日本語形態素解析システム Juman++」](https://nlp.ist.i.kyoto-u.ac.jp/?JUMAN%2B%2B)（C-06-094、C-06-026）
  - [scikit-learn User Guide: Feature extraction（Text feature extraction / Using stop words）](https://scikit-learn.org/stable/modules/feature_extraction.html)（C-06-094）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Chapter 2: Words and Tokens](https://web.stanford.edu/~jurafsky/slp3/2.pdf)（C-06-094、C-06-026）
  - [京都大学 言語メディア研究室「日本語構文・格・照応解析システム KNP」](https://nlp.ist.i.kyoto-u.ac.jp/?KNP)（C-06-095、C-06-026）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Chapter 20: Dependency Parsing](https://web.stanford.edu/~jurafsky/slp3/20.pdf)（C-06-095）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Chapter 22: Semantic Role Labeling and Argument Structure](https://web.stanford.edu/~jurafsky/slp3/22.pdf)（C-06-095）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Chapter 24: Coreference Resolution and Entity Linking](https://web.stanford.edu/~jurafsky/slp3/24.pdf)（C-06-095）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Chapter 25: Discourse Coherence](https://web.stanford.edu/~jurafsky/slp3/25.pdf)（C-06-095）
  - [JST CREST 平成29年度 研究実施報告書「知識に基づく構造的言語処理の確立と知識インフラの構築」（黒橋グループ：知識に基づく文脈解析の実現）](https://www.jst.go.jp/kisoken/crest/evaluation/nenpou/h29/JST_1111081_13416455_2017_PYR.pdf)（C-06-095）
  - [JDLA G検定シラバス（シラバス2024・2026年5月11日 第1.4版）](https://www.jdla.org/certificate/general/)（C-06-026）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Appendix B: Naive Bayes Classification（sentiment analysis）](https://web.stanford.edu/~jurafsky/slp3/B.pdf)（C-06-026）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Chapter 13: Machine Translation](https://web.stanford.edu/~jurafsky/slp3/13.pdf)（C-06-026）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Chapter 11: Information Retrieval and RAG](https://web.stanford.edu/~jurafsky/slp3/11.pdf)（C-06-026）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Chapter 7: Transformers and Pretraining](https://web.stanford.edu/~jurafsky/slp3/7.pdf)（C-06-026）

#### fig-g-speech-features　音声の特徴量（スペクトル・スペクトル包絡・フォルマント・MFCC）

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：左から右への流れ：音声波形 → FFT → 周波数スペクトル（細かいギザギザ）→ 大まかな山と谷の線＝スペクトル包絡、山の位置に F1・F2（フォルマント）→ メル尺度のフィルタ群（低い周波数ほど細かい三角形）→ MFCC（数個の係数の棒）。
- 文字より分かる理由：各処理が何を取り出しているかが、同じ音を順に変換する流れで分かる。
- 使うカード（3）：C-06-040（高速フーリエ変換（FFT）・スペクトル包絡・フォルマント）、C-06-041（メル尺度とMFCC（メル周波数ケプストラム係数））、C-06-042（音素と音韻）
- 使う問題（3）：G-06-029、G-06-030、G-06-082
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [JDLA G検定シラバス（シラバス2024・2026年5月11日 第1.4版）](https://www.jdla.org/certificate/general/)（C-06-040、C-06-041、C-06-042）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Chapter 15: Phonetics and Speech Feature Extraction](https://web.stanford.edu/~jurafsky/slp3/15.pdf)（C-06-040、C-06-041、C-06-042）
  - [MIT OpenCourseWare 24.900 Introduction to Linguistics (Fall 2012) Phonology Summary](https://ocw.mit.edu/courses/24-900-introduction-to-linguistics-fall-2012/f305bb4cff88d8643ef77a3c2ab6b92a_MIT24_900F12_Phonologysum.pdf)（C-06-042）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Chapter 16: Automatic Speech Recognition](https://web.stanford.edu/~jurafsky/slp3/16.pdf)（C-06-042）

#### fig-g-hmm-ctc　HMM による音声認識と CTC

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：上：HMM。隠れた状態（音素）が左から右へ遷移する輪と矢印（遷移確率）、各状態から観測（音声の特徴量）が出る下向き矢印（出力確率）。DNN-HMM は「出力確率の部分を DNN で」と注記。下：CTC。各時刻の出力列（例：c c _ a a _ t）から、同じ文字の連続をまとめ、空白（_）を消して「cat」になる手順。「時刻とラベルの対応を事前に区切らなくてよい」。
- 文字より分かる理由：隠れ状態と観測の関係、CTC の「まとめて消す」手順は、図でないと追えない。
- 使うカード（2）：C-06-043（隠れマルコフモデル（HMM）による音声認識）、C-06-044（CTC（Connectionist Temporal Classification））
- 使う問題（3）：G-06-026、G-06-032、G-06-083
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [JDLA G検定シラバス（シラバス2024・2026年5月11日 第1.4版）](https://www.jdla.org/certificate/general/)（C-06-043）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Chapter 16: Automatic Speech Recognition](https://web.stanford.edu/~jurafsky/slp3/16.pdf)（C-06-043）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Appendix A: Hidden Markov Models](https://web.stanford.edu/~jurafsky/slp3/A.pdf)（C-06-043）
  - [Hinton et al. (2012) Deep Neural Networks for Acoustic Modeling in Speech Recognition. IEEE Signal Processing Magazine（著者公開版）](https://www.cs.toronto.edu/~hinton/absps/DNN-2012-proof.pdf)（C-06-043）
  - [Graves et al. (2006) Connectionist Temporal Classification (ICML 2006)](https://www.cs.toronto.edu/~graves/icml_2006.pdf)（C-06-044）

#### fig-g-dqn-family　DQN とその拡張（経験再生・ターゲットネットワーク・ダブル・デュエリング）

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：左：DQN。ゲーム画面 → 畳み込みネットワーク → 行動ごとの Q 値。経験再生（過去の経験を貯めてランダムに取り出す）とターゲットネットワーク（目標値の計算用に古い重みを固定）の2つの箱。右上：ダブル DQN（行動の選択と評価を別のネットワークで行い、過大評価を抑える）。右下：デュエリング（状態価値 V とアドバンテージ A の2本の流れを最後に合成して Q）。Rainbow は6つの拡張の組み合わせ、と注記。
- 文字より分かる理由：各拡張がネットワークのどこを変えたかが、部品図で対比できる。
- 使うカード（5）：C-06-047（DQN（Deep Q-Network））、C-06-048（ダブルDQN）、C-06-049（デュエリングネットワーク）、C-06-051（Rainbow）、C-06-050（ノイジーネットワーク（NoisyNet））
- 使う問題（5）：G-06-033、G-06-034、G-06-035、G-06-085、G-06-043
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Mnih et al. (2013) Playing Atari with Deep Reinforcement Learning (arXiv:1312.5602)](https://arxiv.org/abs/1312.5602)（C-06-047）
  - [Mnih et al. (2015) Human-level control through deep reinforcement learning. Nature 518（Google DeepMind 公開の本文PDF）](https://storage.googleapis.com/deepmind-media/dqn/DQNNaturePaper.pdf)（C-06-047）
  - [van Hasselt et al. (2015) Deep Reinforcement Learning with Double Q-learning (arXiv:1509.06461)](https://arxiv.org/abs/1509.06461)（C-06-048）
  - [Wang et al. (2015) Dueling Network Architectures (arXiv:1511.06581)](https://arxiv.org/abs/1511.06581)（C-06-049）
  - [Hessel et al. (2017) Rainbow (arXiv:1710.02298)](https://arxiv.org/abs/1710.02298)（C-06-051）
  - [Fortunato et al. (2017) Noisy Networks for Exploration (arXiv:1706.10295)](https://arxiv.org/abs/1706.10295)（C-06-050）

#### fig-g-rlhf　RLHF の3段階（InstructGPT）

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：左から3つの箱。①教師ありファインチューニング（人が書いた手本で SFT）。②報酬モデルの学習（同じ入力への複数の出力を人が順位付け → どれが好まれるかを予測するモデル）。③PPO による強化学習（報酬モデルの点数を報酬にして言語モデルを調整）。②→③に報酬の矢印。
- 文字より分かる理由：3段階の順番と、人の評価がどこで使われるかが、流れ図で分かる。
- 使うカード（2）：C-06-057（RLHF（人間のフィードバックによる強化学習））、C-06-055（PPO（Proximal Policy Optimization））
- 使う問題（3）：G-06-039、G-06-088、G-06-038
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Ouyang et al. (2022) Training language models to follow instructions with human feedback (arXiv:2203.02155)](https://arxiv.org/abs/2203.02155)（C-06-057）
  - [Christiano et al. (2017) Deep reinforcement learning from human preferences (arXiv:1706.03741)](https://arxiv.org/abs/1706.03741)（C-06-057）
  - [Schulman et al. (2017) Proximal Policy Optimization Algorithms (arXiv:1707.06347)](https://arxiv.org/abs/1707.06347)（C-06-055）

#### fig-g-gan　GAN（生成器と識別器）

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：ノイズ z → 生成器 → 偽の画像 → 識別器 ← 本物の画像。識別器の出力「本物らしさ」。生成器は識別器をだますように、識別器は見分けるように学ぶ、の2本の矢印（敵対）。DCGAN は「両方を畳み込みネットワークに」と注記。
- 文字より分かる理由：2つのネットワークが互いに競う配置が、図で一度に分かる。
- 使うカード（2）：C-06-063（敵対的生成ネットワーク（GAN））、C-06-064（DCGAN）
- 使う問題（2）：G-06-044、G-06-048
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Goodfellow et al. (2014) Generative Adversarial Networks (arXiv:1406.2661)](https://arxiv.org/abs/1406.2661)（C-06-063）
  - [Radford et al. (2015) DCGAN (arXiv:1511.06434)](https://arxiv.org/abs/1511.06434)（C-06-064）

#### fig-g-pix2pix-cyclegan　Pix2Pix（対の画像）と CycleGAN（対なし・循環の一貫性）

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：左：Pix2Pix。線画と写真の対を並べ、条件付き GAN で対応を学ぶ。右：CycleGAN。夏 X → G → 冬 Y′ → F → 夏 X″ の輪で、X″ が X に戻るよう学ぶ（循環の一貫性）。夏と冬の写真は対になっていない、と注記。
- 文字より分かる理由：「対が要るか」の違いが、左右の図の矢印の形で見分けられる。
- 使うカード（2）：C-06-065（Pix2Pix）、C-06-066（CycleGAN）
- 使う問題（1）：G-06-045
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Isola et al. (2016) Image-to-Image Translation with Conditional Adversarial Networks (arXiv:1611.07004)](https://arxiv.org/abs/1611.07004)（C-06-065）
  - [Zhu et al. (2017) CycleGAN (arXiv:1703.10593)](https://arxiv.org/abs/1703.10593)（C-06-065、C-06-066）

#### fig-g-diffusion　拡散モデル（ノイズを足す順過程と取り除く逆過程）

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：左から右へ、画像 x₀ → x₁ → … → x_T（純粋なノイズ）の5コマ。上に右向きの矢印「順過程：ガウスノイズを少しずつ足す（学習しない）」、下に左向きの矢印「逆過程：ノイズを少しずつ取り除く（ニューラルネットで学習）」。生成はノイズから逆過程をたどる。
- 文字より分かる理由：2つの向きの過程のどちらを学習するかが、矢印の上下で区別できる。
- 使うカード（2）：C-06-067（拡散モデル（Diffusion Model））、C-06-063（敵対的生成ネットワーク（GAN））
- 使う問題（2）：G-06-046、G-06-091
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Ho et al. (2020) Denoising Diffusion Probabilistic Models (arXiv:2006.11239)](https://arxiv.org/abs/2006.11239)（C-06-067）
  - [Dhariwal & Nichol (2021) Diffusion Models Beat GANs on Image Synthesis (arXiv:2105.05233)](https://arxiv.org/abs/2105.05233)（C-06-067）
  - [Goodfellow et al. (2014) Generative Adversarial Networks (arXiv:1406.2661)](https://arxiv.org/abs/1406.2661)（C-06-063）

#### fig-g-transfer-learning　転移学習・ファインチューニングと破滅的忘却

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：左：大量データで事前学習したネットワーク（特徴抽出部＋出力層）。中：転移学習＝特徴抽出部を固定（鍵の印）し、新しい出力層だけ学習。右：ファインチューニング＝新しいデータで全体（または一部）の重みも更新。下段：タスクAを学んだ後にタスクBだけを学ぶと、タスクAの精度が落ちる棒グラフ（破滅的忘却）。
- 文字より分かる理由：どの部分を固定し、どこを学び直すかが、鍵の印と色で一目で分かる。
- 使うカード（3）：C-06-070（転移学習とファインチューニング）、C-06-071（事前学習・事前学習済みモデル）、C-06-075（破滅的忘却）
- 使う問題（3）：G-06-049、G-06-053、G-06-051
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Devlin et al. (2018) BERT (arXiv:1810.04805)](https://arxiv.org/abs/1810.04805)（C-06-070、C-06-071）
  - [Kirkpatrick et al. (2016) Overcoming catastrophic forgetting in neural networks (arXiv:1612.00796)](https://arxiv.org/abs/1612.00796)（C-06-075）

#### fig-g-self-supervised　教師あり・半教師あり・自己教師あり（マスクと対照学習）

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：3列。教師あり：全データにラベル。半教師あり：少量のラベル付き＋大量のラベルなし。自己教師あり：データ自体から正解を作る。自己教師ありの中を2つに分け、①文の一部を隠して当てる（マスク）、②同じ画像に違う拡張をした2枚を近づけ、別の画像とは遠ざける（対照学習、SimCLR）を矢印で。
- 文字より分かる理由：「正解をどこから得るか」の違いが、3列の対比で整理できる。
- 使うカード（2）：C-06-072（自己教師あり学習）、C-06-073（半教師あり学習）
- 使う問題（3）：G-06-051、G-06-052、G-06-092
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Chen et al. (2020) SimCLR (arXiv:2002.05709)](https://arxiv.org/abs/2002.05709)（C-06-072）
  - [Devlin et al. (2018) BERT (arXiv:1810.04805)](https://arxiv.org/abs/1810.04805)（C-06-072）
  - [JDLA G検定シラバス（シラバス2024・2026年5月11日 第1.4版）](https://www.jdla.org/certificate/general/)（C-06-073）
  - [scikit-learn User Guide: Semi-supervised learning](https://scikit-learn.org/stable/modules/semi_supervised.html)（C-06-073）

#### fig-g-few-zero-shot　Zero-shot・One-shot・Few-shot とファインチューニング

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：4行の入力例（プロンプトの箱）。Zero-shot：タスクの説明だけ。One-shot：説明＋例1つ。Few-shot：説明＋例数個。ファインチューニング：例で重みを更新（歯車の印）。前の3つは「重みを更新しない」と横に括る。
- 文字より分かる理由：例の数と重みの更新の有無が、表の形で混同なく比べられる。
- 使うカード（3）：C-06-074（Few-shot・One-shot・Zero-shot）、C-06-081（Zero-shot（ゼロショット））、C-06-096（プロンプトエンジニアリング（Chain-of-Thought・システムプロンプト））
- 使う問題（3）：G-06-050、G-06-055、G-06-080
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Brown et al. (2020) Language Models are Few-Shot Learners (arXiv:2005.14165)](https://arxiv.org/abs/2005.14165)（C-06-074、C-06-081、C-06-096）
  - [Radford et al. (2021) Learning Transferable Visual Models From Natural Language Supervision (CLIP) (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020)（C-06-081）
  - [Wei et al. (2022) Chain-of-Thought Prompting Elicits Reasoning in Large Language Models (arXiv:2201.11903)](https://arxiv.org/abs/2201.11903)（C-06-096）
  - [Anthropic Claude Platform Docs: Prompting best practices（Give Claude a role / system prompt）](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)（C-06-096）

#### fig-g-clip　CLIP の学習とゼロショット分類

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：左：画像エンコーダと文章エンコーダ。N 枚の画像と N 個の説明文の類似度の N×N の表で、対角（正しい組）を高く、他を低くするよう学ぶ。右：ゼロショット分類。「犬の写真」「猫の写真」などのクラス名の文と画像の類似度を比べ、最も高い文をクラスとする。
- 文字より分かる理由：対角を当てる学習と、文でクラスを指定する使い方が、表の図で分かる。
- 使うカード（2）：C-06-076（CLIP）、C-06-081（Zero-shot（ゼロショット））
- 使う問題（3）：G-06-054、G-06-055、G-06-094
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Radford et al. (2021) Learning Transferable Visual Models From Natural Language Supervision (CLIP) (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020)（C-06-076、C-06-081）
  - [Brown et al. (2020) Language Models are Few-Shot Learners (arXiv:2005.14165)](https://arxiv.org/abs/2005.14165)（C-06-081）

#### fig-g-cam-gradcam　CAM と Grad-CAM（判断の根拠のヒートマップ）

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：左：CAM。最後の畳み込みの特徴マップ k 枚 → GAP → クラスごとの重み w → 特徴マップを w で重み付けして足す → ヒートマップ。「GAP を使う構造が必要」。右：Grad-CAM。対象クラスの勾配を最後の畳み込み層まで逆に流し、その平均を重みにする → どんな CNN でも使える。画像にヒートマップを重ねた例。Guided Grad-CAM は細かい可視化と掛け合わせる、と1行。
- 文字より分かる理由：重みを「学習した重み」から取るか「勾配」から取るかの違いが、流れ図で対比できる。
- 使うカード（3）：C-06-084（CAM（Class Activation Mapping））、C-06-085（Grad-CAM）、C-05-017（グローバルアベレージプーリング (GAP)）
- 使う問題（2）：G-06-060、G-06-096
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Zhou et al. (2015) Learning Deep Features for Discriminative Localization (CAM) (arXiv:1512.04150)](https://arxiv.org/abs/1512.04150)（C-06-084）
  - [Selvaraju et al. (2016) Grad-CAM (arXiv:1610.02391)](https://arxiv.org/abs/1610.02391)（C-06-085）
  - [Lin, Chen & Yan (2013) Network In Network (arXiv:1312.4400)](https://arxiv.org/abs/1312.4400)（C-05-017）
  - [PyTorch Documentation: torch.nn.AdaptiveAvgPool2d](https://docs.pytorch.org/docs/stable/generated/torch.nn.AdaptiveAvgPool2d.html)（C-05-017）

#### fig-g-lime-shap　LIME・SHAP・Permutation Importance

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：左：LIME。複雑な境界の近くの1点のまわりに、少しずつ変えた点をばらまき、その範囲だけで直線（解釈しやすいモデル）を当てはめる。中：SHAP。基準の予測値から、各特徴量の寄与を足し引きして最終の予測値に至る横棒（滝のような図）。右：Permutation Importance。1つの特徴量の列だけを並べ替え、精度の下がり幅を棒で。
- 文字より分かる理由：「局所の近似」「寄与の配分」「並べ替えで測る」の違いが、3枚で一目で分かる。
- 使うカード（4）：C-06-086（LIME）、C-06-087（SHAP）、C-06-088（Permutation Importance）、C-06-083（説明可能AI（XAI）とモデルの解釈性）
- 使う問題（5）：G-06-061、G-06-062、G-06-063、G-06-064、G-06-095
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Ribeiro et al. (2016) "Why Should I Trust You?" (LIME) (arXiv:1602.04938)](https://arxiv.org/abs/1602.04938)（C-06-086、C-06-083）
  - [Lundberg & Lee (2017) A Unified Approach to Interpreting Model Predictions (SHAP) (arXiv:1705.07874)](https://arxiv.org/abs/1705.07874)（C-06-087、C-06-083）
  - [Fisher et al. (2018) All Models are Wrong, but Many are Useful (arXiv:1801.01489)](https://arxiv.org/abs/1801.01489)（C-06-088）
  - [scikit-learn User Guide: Permutation feature importance](https://scikit-learn.org/stable/modules/permutation_importance.html)（C-06-088）
  - [Doshi-Velez & Kim (2017) Towards A Rigorous Science of Interpretable Machine Learning (arXiv:1702.08608)](https://arxiv.org/abs/1702.08608)（C-06-083）

#### fig-g-model-compression　モデルの軽量化（蒸留・プルーニング・量子化）

- 優先度：**B**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：3枚。蒸留：大きな教師モデルの出力（各クラスの確率の棒＝ソフトターゲット）を、小さな生徒モデルがまねる。プルーニング：ネットワークの重要度の低い接続を消す。量子化：32ビットの浮動小数点の数を8ビットの整数の目盛りに丸める。宝くじ仮説は「最初のネットワークの中に、単独で学習しても同じ精度に達する小さな部分がある」と注記。
- 文字より分かる理由：3つの手法が「何を小さくするか」の違いが、並べると分かる。
- 使うカード（5）：C-06-090（蒸留（知識蒸留））、C-06-091（プルーニング（枝刈り）とモデル圧縮）、C-06-092（量子化）、C-06-093（宝くじ仮説）、C-06-089（エッジAIとモデル軽量化の必要性）
- 使う問題（6）：G-06-065、G-06-066、G-06-067、G-06-068、G-06-097、G-06-069
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Hinton et al. (2015) Distilling the Knowledge in a Neural Network (arXiv:1503.02531)](https://arxiv.org/abs/1503.02531)（C-06-090）
  - [Romero et al. (2014) FitNets: Hints for Thin Deep Nets (arXiv:1412.6550)](https://arxiv.org/abs/1412.6550)（C-06-090）
  - [Han et al. (2015) Deep Compression (arXiv:1510.00149)](https://arxiv.org/abs/1510.00149)（C-06-091）
  - [Jacob et al. (2017) Quantization and Training of Neural Networks for Efficient Integer-Arithmetic-Only Inference (arXiv:1712.05877)](https://arxiv.org/abs/1712.05877)（C-06-092、C-06-089）
  - [Frankle & Carbin (2018) The Lottery Ticket Hypothesis (arXiv:1803.03635)](https://arxiv.org/abs/1803.03635)（C-06-093）
  - [Howard et al. (2017) MobileNets (arXiv:1704.04861)](https://arxiv.org/abs/1704.04861)（C-06-089）
  - [IPA「DX白書2023」](https://www.ipa.go.jp/publish/wp-dx/dx-2023.html)（C-06-089）
  - [NIST SP 500-325 (2018) Fog Computing Conceptual Model（Annex A: Fog Computing vs. Edge Computing）](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.500-325.pdf)（C-06-089）

#### fig-g-crisp-dm　CRISP-DM と CRISP-ML の工程

- 優先度：**B**　／　主な章：07 AI の社会実装に向けて
- 何を描くか：左：CRISP-DM の6フェーズ（ビジネス理解→データ理解→データ準備→モデリング→評価→展開）を円形に並べ、ビジネス理解⇄データ理解、データ準備⇄モデリング、評価→ビジネス理解 の戻り矢印。中央に「データ」。右：CRISP-ML の工程（ビジネス理解とデータ理解を1つに、最後に監視・保守を追加）を同じ形で並べ、違う箇所を色で強調。
- 文字より分かる理由：順番と戻り矢印、2つのモデルの差分が、並べた図で一度に分かる。
- 使うカード（2）：C-07-002（CRISP-DM）、C-07-003（CRISP-ML（CRISP-ML(Q)））
- 使う問題（2）：G-07-001、G-07-002
- 描く前に確かめること：戻り矢印の位置は CRISP-DM の原典の図と照合し、なぞらずに自分で配置する。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Studer et al. (2020) Towards CRISP-ML(Q) (arXiv:2003.05155)](https://arxiv.org/abs/2003.05155)（C-07-002、C-07-003）

#### fig-g-dev-process　ウォーターフォール・アジャイル・探索的段階型（AI 開発の進め方と契約）

- 優先度：**B**　／　主な章：07 AI の社会実装に向けて
- 何を描くか：3行。ウォーターフォール：要件定義→設計→実装→テストの階段。アジャイル：短い期間の「計画→開発→テスト→リリース」の輪を何周も。探索的段階型：アセスメント→PoC→開発→追加学習の4段、各段の間に「次に進むか判断」の門。段ごとに想定される契約の型（準委任／請負）の注記を、契約ガイドラインの記述と確かめて添える。
- 文字より分かる理由：3つの進め方の形（階段・輪・門のある段）が並ぶと、違いを形で覚えられる。
- 使うカード（4）：C-07-005（ウォーターフォールとアジャイル）、C-07-004（PoC（Proof of Concept：概念実証））、C-09-024（探索的段階型の開発方式（AI・データの利用に関する契約ガイドライン））、C-09-026（請負契約と準委任契約）
- 使う問題（9）：G-07-009、G-07-017、G-07-018、G-07-035、G-09-035、G-09-036、G-09-037、G-07-003、G-07-004
- 描く前に確かめること：段ごとの契約の型は、契約ガイドラインの原文で確かめてから書く。確かめられなければ契約の型は描かない。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [経済産業省「AI・データの利用に関する契約ガイドライン 1.1版」（令和元年12月）](https://www.meti.go.jp/policy/mono_info_service/connected_industries/sharing_and_utilization/20200619001.pdf)（C-07-005、C-07-004、C-09-024、C-09-026）
  - [Ken Schwaber & Jeff Sutherland「スクラムガイド」2020年11月版（日本語訳）](https://scrumguides.org/docs/scrumguide/v2020/2020-Scrum-Guide-Japanese.pdf)（C-07-005）

#### fig-g-mlops　MLOps のサイクルとモデルの劣化（ドリフト）

- 優先度：**B**　／　主な章：07 AI の社会実装に向けて
- 何を描くか：輪：データ収集 → 学習 → 評価 → デプロイ → 監視 → （劣化を検知）→ 再学習。監視の箇所に「入力の分布が変わる」「入力と正解の関係が変わる」の2種類の変化を小さなグラフで（分布のずれ／同じ入力でラベルが変わる）。CI/CD に加えて継続的な学習（CT）、と注記。
- 文字より分かる理由：作って終わりでなく回り続けることと、劣化の2つの型が、輪と小さなグラフで分かる。
- 使うカード（2）：C-07-007（MLOps）、C-07-008（モデルのヘルスモニタリングとライフサイクル管理）
- 使う問題（6）：G-07-005、G-07-006、G-07-021、G-07-036、G-07-037、G-07-022
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Google Cloud「MLOps: 機械学習における継続的デリバリーと自動化のパイプライン」](https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning?hl=ja)（C-07-007）
  - [Sculley et al. (2015) Hidden Technical Debt in Machine Learning Systems (NeurIPS)](https://papers.nips.cc/paper/2015/hash/86df7dcfd896fcaf2674f757a2463eba-Abstract.html)（C-07-007、C-07-008）
  - [Studer et al. (2020) Towards CRISP-ML(Q) (arXiv:2003.05155)](https://arxiv.org/abs/2003.05155)（C-07-008）
  - [Google Cloud「モデル モニタリングの概要」（Vertex AI）](https://cloud.google.com/vertex-ai/docs/model-monitoring/overview?hl=ja)（C-07-008）
  - [Gama et al. (2014) A Survey on Concept Drift Adaptation (ACM Computing Surveys 46(4)、著者公開版)](https://www.win.tue.nl/~mpechen/publications/pubs/Gama_ACMCS_AdaptationCD_accepted.pdf)（C-07-008）

#### fig-g-feature-scaling　特徴量の変換（正規化・標準化・対数変換）

- 優先度：**B**　／　主な章：07 AI の社会実装に向けて
- 何を描くか：同じデータのヒストグラムを4つ。元データ、正規化（0〜1に収める）、標準化（平均0・分散1、形は変わらない）、右に長く裾を引く分布に対数変換をかけると山が中央寄りになる例。
- 文字より分かる理由：変換で分布の位置・幅・形のどれが変わるかが、ヒストグラムで比べられる。
- 使うカード（2）：C-07-021（特徴量エンジニアリング（対数変換など））、C-07-022（特徴量のスケーリング（正規化と標準化））
- 使う問題（2）：G-07-038、G-07-039
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Google for Developers「Machine Learning Glossary」](https://developers.google.com/machine-learning/glossary)（C-07-021）
  - [Google for Developers Machine Learning Crash Course「Numerical data: Normalization」](https://developers.google.com/machine-learning/crash-course/numerical-data/normalization)（C-07-021、C-07-022）
  - [Goodfellow, Bengio & Courville (2016) Deep Learning 第1章 Introduction](https://www.deeplearningbook.org/contents/intro.html)（C-07-021）
  - [scikit-learn User Guide「Preprocessing data」](https://scikit-learn.org/stable/modules/preprocessing.html)（C-07-022）

#### fig-g-categorical-encoding　ラベルエンコーディングと One-Hot エンコーディング

- 優先度：**B**　／　主な章：07 AI の社会実装に向けて
- 何を描くか：「赤・青・緑」の列を、左は 0・1・2 の1列（大小関係が無いのに順序があるように見える、と注意）、右は3列の 0/1（One-Hot）に変換した表。
- 文字より分かる理由：列が1本か3本かと、順序の意味の有無が、表の対比で分かる。
- 使うカード（1）：C-07-023（カテゴリカルデータのエンコーディング（ラベルエンコーディングとOne-Hot））
- 使う問題（1）：G-07-040
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide「Preprocessing data」](https://scikit-learn.org/stable/modules/preprocessing.html)（C-07-023）
  - [Google for Developers Machine Learning Crash Course「Categorical data: Vocabulary and one-hot encoding」](https://developers.google.com/machine-learning/crash-course/categorical-data/one-hot-encoding)（C-07-023）
  - [scikit-learn API Reference「LabelEncoder」](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.LabelEncoder.html)（C-07-023）

#### fig-g-imbalanced　不均衡データの対処（ダウンサンプリング・オーバーサンプリング・SMOTE）

- 優先度：**B**　／　主な章：07 AI の社会実装に向けて
- 何を描くか：多数クラス（灰色の点が多数）と少数クラス（赤い点が少し）の散布図。ダウンサンプリング：灰色を減らす。オーバーサンプリング：赤を複製。SMOTE：赤い点どうしを結ぶ線分の上に新しい点を作る。
- 文字より分かる理由：SMOTE が「近い点の間に作る」ことが、線分上の点で一目で分かる。
- 使うカード（1）：C-07-027（不均衡データの対処（ダウンサンプリング・オーバーサンプリング・SMOTE））
- 使う問題（1）：G-07-044
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Chawla et al. (2002) SMOTE: Synthetic Minority Over-sampling Technique (JAIR 16, arXiv:1106.1813)](https://arxiv.org/abs/1106.1813)（C-07-027）
  - [Google for Developers Machine Learning Crash Course「Datasets: Class-imbalanced datasets」](https://developers.google.com/machine-learning/crash-course/overfitting/imbalanced-datasets)（C-07-027）
  - [Google for Developers「Machine Learning Glossary」](https://developers.google.com/machine-learning/glossary)（C-07-027）

#### fig-g-data-leakage　データリーケージ（評価データの情報が学習に混ざる）

- 優先度：**B**　／　主な章：07 AI の社会実装に向けて
- 何を描くか：左：患者ごとに色分けした画像を1枚ずつランダムに分けると、同じ患者の画像が学習用と評価用の両方に入る（同じ色が両側に）→ 評価が高く出すぎる。右：患者単位で分けると色が片側にだけ入る。下に「予測の時点で使えない情報（未来の情報・正解そのもの）を特徴量に入れる」例を1行。
- 文字より分かる理由：「同じ人が両側にいる」状態が色で見え、なぜ評価が甘くなるかが分かる。
- 使うカード（1）：C-07-016（データリーケージ）
- 使う問題（3）：G-07-013、G-07-014、G-07-030
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide 12. Common pitfalls and recommended practices（Data leakage）](https://scikit-learn.org/stable/common_pitfalls.html)（C-07-016）
  - [scikit-learn User Guide 3.1 Cross-validation（grouped data・time series）](https://scikit-learn.org/stable/modules/cross_validation.html)（C-07-016）

#### fig-g-central-tendency　平均・中央値・最頻値と外れ値（ヒストグラム）

- 優先度：**B**　／　主な章：08 AI に必要な数理・統計知識
- 何を描くか：左：左右対称な山のヒストグラムで3つが一致。右：右に裾の長い分布（年収のような）で、最頻値＜中央値＜平均の順に縦線。下：数直線上の10個の点に外れ値を1つ足すと、平均の印が大きく動き、中央値の印はほとんど動かない。トリム平均は両端を切って平均、と注記。
- 文字より分かる理由：3つの代表値の位置関係と外れ値への強さが、縦線の位置で一目で分かる。
- 使うカード（3）：C-08-001（平均・中央値・最頻値）、C-08-002（外れ値）、C-08-004（度数分布（ヒストグラム））
- 使う問題（6）：G-08-001、G-08-002、G-08-032、G-08-051、G-08-039、G-08-023
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [NIST/SEMATECH e-Handbook of Statistical Methods 1.3.5.1 Measures of Location](https://www.itl.nist.gov/div898/handbook/eda/section3/eda351.htm)（C-08-001）
  - [SciPy API scipy.stats.trim_mean](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.trim_mean.html)（C-08-001）
  - [NIST/SEMATECH e-Handbook 1.3.5.17 Detection of Outliers](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm)（C-08-002）
  - [NIST/SEMATECH e-Handbook 4.1.4.1 Linear Least Squares Regression](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm)（C-08-002）
  - [総務省統計局 なるほど統計学園「統計用語辞典（は行）」](https://www.stat.go.jp/naruhodo/13_yougo/ha-gyo.html)（C-08-002）
  - [総務省統計局 なるほど統計学園「統計用語辞典（た行）」](https://www.stat.go.jp/naruhodo/13_yougo/ta-gyo.html)（C-08-004）
  - [総務省統計局 なるほど統計学園「ヒストグラム」](https://www.stat.go.jp/naruhodo/4_graph/shokyu/histogram.html)（C-08-004）
  - [NIST/SEMATECH e-Handbook 1.3.3.14 Histogram](https://www.itl.nist.gov/div898/handbook/eda/section3/eda33e.htm)（C-08-004）

#### fig-g-normal-distribution　正規分布と確率密度（確率は面積）

- 優先度：**B**　／　主な章：08 AI に必要な数理・統計知識
- 何を描くか：釣り鐘型の曲線。中心に平均（＝中央値＝最頻値）、±1σ・±2σ の目盛り。±1σ の区間を塗る。別の小さな図で、一般の確率密度関数 f(x) の a〜b の区間を塗り「確率＝この面積（積分）、1点の確率は0」。中心極限定理は「標本平均の分布は正規分布に近づき、ばらつきは σ/√n」と注記。
- 文字より分かる理由：「確率は面積」と「平均と標準偏差で形が決まる」が、曲線と塗りで分かる。
- 使うカード（3）：C-08-008（正規分布）、C-08-005（確率変数・確率分布・確率密度）、C-08-003（分散と標準偏差）
- 使う問題（5）：G-08-008、G-08-025、G-08-053、G-08-022、G-08-040
- 描く前に確かめること：±1σ に約68%・±2σ に約95% の数値、σ/√n の式は、C-08-008 の出典に書かれているかを確かめてから入れる。無ければ出典を足すか、数値を書かない。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [NIST/SEMATECH e-Handbook 1.3.6.6.1 Normal Distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3661.htm)（C-08-008）
  - [MIT OCW 18.05 (Orloff & Bloom, Spring 2022) Class 4a Reading: Discrete Random Variables](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/resources/mit18_05_s22_class04-prep-a_pdf/)（C-08-005）
  - [MIT OCW 18.05 (Orloff & Bloom, Spring 2022) Class 5b Reading: Continuous Random Variables](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/resources/mit18_05_s22_class05-prep-b_pdf/)（C-08-005）
  - [NIST/SEMATECH e-Handbook 1.3.5.6 Measures of Scale](https://www.itl.nist.gov/div898/handbook/eda/section3/eda356.htm)（C-08-003）

#### fig-g-spurious-correlation　疑似相関と偏相関（第3の変数）

- 優先度：**B**　／　主な章：08 AI に必要な数理・統計知識
- 何を描くか：因果の矢印図：気温 → アイスの売上、気温 → 水難事故。アイスの売上 ⇢ 水難事故 は点線で「相関はあるが因果ではない」。右に、学年（年齢）ごとに色分けした散布図で、全体では右上がりだが、各学年の中では右下がり（偏相関が負）の例。
- 文字より分かる理由：「第3の変数が両方を動かす」構造が、矢印図と色分けの散布図で見える。
- 使うカード（2）：C-08-014（疑似相関）、C-08-013（偏相関係数）
- 使う問題（2）：G-08-011、G-08-033
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [岡本安晴（日本女子大学）「偏相関係数と擬似相関」](https://mcn-www.jwu.ac.jp/~yokamoto/ccc/stat/p23cor/)（C-08-014、C-08-013）

#### fig-g-mahalanobis　マハラノビス距離（分布の広がりと相関を考える距離）

- 優先度：**B**　／　主な章：08 AI に必要な数理・統計知識
- 何を描くか：右上がりの細長い楕円状の点群（温度と振動）と、その等高線の楕円。中心からユークリッド距離が同じ2点（円の上）のうち、楕円の長軸方向の点はマハラノビス距離が小さく（正常）、短軸方向の点は大きい（異常）。
- 文字より分かる理由：同じ直線距離でも「異常さ」が違うことが、楕円の等高線で直感的に分かる。
- 使うカード（2）：C-08-020（マハラノビス距離）、C-08-019（ユークリッド距離とコサイン類似度）
- 使う問題（2）：G-08-037、G-08-020
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn Example: Robust covariance estimation and Mahalanobis distances relevance](https://scikit-learn.org/stable/auto_examples/covariance/plot_mahalanobis_distances.html)（C-08-020）
  - [scikit-learn API sklearn.metrics.pairwise.euclidean_distances](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.pairwise.euclidean_distances.html)（C-08-019）
  - [scikit-learn User Guide 8.8 Pairwise metrics, Affinities and Kernels（Cosine similarity）](https://scikit-learn.org/stable/modules/metrics.html)（C-08-019）
  - [SciPy API scipy.spatial.distance.cityblock](https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.distance.cityblock.html)（C-08-019）
  - [SciPy API scipy.spatial.distance.chebyshev](https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.distance.chebyshev.html)（C-08-019）

#### fig-g-mle　最尤推定（尤度が最大になるパラメータ）

- 優先度：**B**　／　主な章：08 AI に必要な数理・統計知識
- 何を描くか：横軸＝表の出る確率 p（0〜1）、縦軸＝尤度。20回中14回表のデータでの尤度曲線が p＝0.7 で山になる。山の頂上に縦線。最小二乗法との対比を1行（誤差が正規分布なら一致する、はカードの記述を確かめてから）。
- 文字より分かる理由：「データが最も起こりやすくなる p を選ぶ」が、山の頂上として見える。
- 使うカード（2）：C-08-016（最尤法（最尤推定））、C-08-015（最小二乗法）
- 使う問題（2）：G-08-014、G-08-029
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [NIST/SEMATECH e-Handbook 1.3.6.5.2 Maximum Likelihood](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3652.htm)（C-08-016）
  - [NIST/SEMATECH e-Handbook 4.4.3.1 Least Squares](https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd431.htm)（C-08-015）

#### fig-g-personal-data-scope　個人情報・個人データ・保有個人データの範囲と、仮名加工情報・匿名加工情報

- 優先度：**B**　／　主な章：09 AIに関する法律と契約
- 何を描くか：左：3重の入れ子。外＝個人情報、中＝個人データ（データベース等を構成するもの）、内＝保有個人データ（開示・訂正などの権限を持つもの）。それぞれに課される主な義務を1語ずつ（例：利用目的の特定／第三者提供の制限／開示請求への対応）。右：仮名加工情報と匿名加工情報の比較表（他の情報と照合すれば識別できるか、復元できるか、第三者提供の可否）。
- 文字より分かる理由：どの義務がどの範囲にかかるかは、入れ子の図で見ると取り違えにくい。
- 使うカード（5）：C-09-001（個人情報）、C-09-004（個人データと保有個人データ）、C-09-007（仮名加工情報）、C-09-008（匿名加工情報）、C-09-006（第三者提供と委託）
- 使う問題（6）：G-09-003、G-09-009、G-09-005、G-09-006、G-09-007、G-09-001
- 描く前に確かめること：義務の書き分けと比較表の中身は、e-Gov の条文とカードの出典で確かめてから書く。条番号は図に入れない。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [個人情報の保護に関する法律（e-Gov法令検索・令和8年10月1日施行版）](https://laws.e-gov.go.jp/law/415AC0000000057)（C-09-001、C-09-004、C-09-007、C-09-008、C-09-006）
  - [経済産業省「AIの利用・開発に関する契約チェックリスト」（令和7年2月）](https://www.meti.go.jp/policy/mono_info_service/connected_industries/sharing_and_utilization/20250218003-ar.pdf)（C-09-006）
  - [個人情報保護委員会「個人情報の保護に関する法律についてのガイドライン（通則編）」3-4-4 委託先の監督・3-6-2 オプトアウト・3-6-3 第三者に該当しない場合](https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/)（C-09-006）

#### fig-g-eu-ai-act　EU の AI 法のリスク4区分

- 優先度：**B**　／　主な章：10 AI倫理・AIガバナンス
- 何を描くか：4段のピラミッド。上から「許容できないリスク（禁止）」「高リスク（市場に出す前の厳しい義務）」「透明性のリスク（表示の義務）」「最小限またはリスクなし」。各段に例を1つ（社会的スコアリング／採用・与信／チャットボット／一般的な用途）。
- 文字より分かる理由：段が上がるほど規制が重くなる構造が、ピラミッドで一目で分かる。
- 使うカード（2）：C-10-005（EUのAI法（AI Act））、C-10-004（リスクベースアプローチ）
- 使う問題（3）：G-10-004、G-10-041、G-10-003
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [European Commission "AI Act" (Shaping Europe's digital future)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)（C-10-005、C-10-004）
  - [European Commission, Commission Guidelines on prohibited artificial intelligence practices established by Regulation (EU) 2024/1689 (AI Act), C(2025) 5052 final](https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-prohibited-artificial-intelligence-ai-practices-defined-ai-act)（C-10-005）
  - [European Commission, Guidelines on the scope of the obligations for providers of general-purpose AI models under the AI Act, C(2025) 7719 final](https://digital-strategy.ec.europa.eu/en/library/guidelines-scope-obligations-providers-general-purpose-ai-models-under-ai-act)（C-10-005）
  - [総務省・経済産業省「AI事業者ガイドライン（第1.2版）本編」（令和8年3月31日）](https://www.meti.go.jp/shingikai/mono_info_service/ai_shakai_jisso/pdf/20260331_1.pdf)（C-10-004）

#### fig-g-ai-attacks　AI への攻撃の種類（学習時と推論時）

- 優先度：**B**　／　主な章：10 AI倫理・AIガバナンス
- 何を描くか：左から右へ「データ収集 → 学習 → 公開されたモデル（API）」の流れ。学習時の攻撃：データ汚染（ポイズニング）、バックドア（小さな模様と書き換えたラベル）。推論時の攻撃：敵対的サンプル（画像＋人には見えないノイズ ＝ 誤分類、の足し算の図）、モデル窃取（大量の問い合わせで複製）、メンバーシップ推論（特定のデータが学習に使われたかを推定）。
- 文字より分かる理由：どの攻撃が流れのどこを狙うかが、時系列の図に置くと整理できる。
- 使うカード（3）：C-10-014（Adversarial Attack（敵対的攻撃・Adversarial Examples））、C-10-015（データ汚染とモデル汚染（ポイズニング））、C-10-016（モデル窃取とデータ窃取）
- 使う問題（6）：G-10-016、G-10-017、G-10-018、G-10-019、G-10-046、G-10-047
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Goodfellow et al. (2014) Explaining and Harnessing Adversarial Examples (arXiv:1412.6572)](https://arxiv.org/abs/1412.6572)（C-10-014）
  - [Szegedy et al. (2013) Intriguing properties of neural networks (arXiv:1312.6199)](https://arxiv.org/abs/1312.6199)（C-10-014）
  - [総務省・経済産業省「AI事業者ガイドライン（第1.2版）別添（付属資料）」（令和8年3月31日）](https://www.meti.go.jp/shingikai/mono_info_service/ai_shakai_jisso/pdf/20260331_3.pdf)（C-10-014、C-10-015、C-10-016）
  - [NIST AI 100-2e2025 Adversarial Machine Learning: A Taxonomy and Terminology of Attacks and Mitigations (2025)](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-2e2025.pdf)（C-10-014、C-10-015、C-10-016）
  - [Biggio et al. (2012) Poisoning Attacks against Support Vector Machines (arXiv:1206.6389)](https://arxiv.org/abs/1206.6389)（C-10-015）
  - [Tramer et al. (2016) Stealing Machine Learning Models via Prediction APIs (arXiv:1609.02943)](https://arxiv.org/abs/1609.02943)（C-10-016）

#### fig-g-curse-of-dim　次元の呪い（同じ点数でも空間がすかすかになる）

- 優先度：**C**　／　主な章：02 人工知能をめぐる動向
- 何を描くか：同じ10個の点を、1次元（線分を10区間）、2次元（10×10の格子）、3次元（10×10×10の立方体）に置いた3つの図。区間・マスのうち点が入っている割合を 10/10、10/100、10/1000 と下に書き、次元が増えるとデータが埋めるべきマスが指数的に増えることを示す。
- 文字より分かる理由：「すかすかになる」の意味が、同じ点数の格子を並べると直感的に分かる。
- 使うカード（1）：C-02-030（次元の呪い）
- 使う問題（1）：G-02-026
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [scikit-learn User Guide: Nearest Neighbors](https://scikit-learn.org/stable/modules/neighbors.html)（C-02-030）

#### fig-g-topic-model　トピックモデル（LDA）の考え方

- 優先度：**C**　／　主な章：03 機械学習の概要
- 何を描くか：左に文書3つ、中央にトピック3つ（政治・スポーツ・経済）、右に単語群。文書→トピックの矢印の太さで「文書は各トピックの混合（例 60%/30%/10%）」、トピック→単語の矢印で「トピックは単語の確率分布」。数値は架空の例と明記。
- 文字より分かる理由：2段階の確率（文書→トピック→単語）の構造が、矢印の太さで見える。
- 使うカード（2）：C-03-031（トピックモデル）、C-03-032（潜在的ディリクレ配分法 (LDA)）
- 使う問題（2）：G-03-020、G-03-056
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Blei, Ng & Jordan (2003) Latent Dirichlet Allocation. JMLR](https://www.jmlr.org/papers/v3/blei03a.html)（C-03-031、C-03-032）
  - [scikit-learn User Guide: Decomposing signals in components（Truncated SVD and latent semantic analysis）](https://scikit-learn.org/stable/modules/decomposition.html)（C-03-031、C-03-032）

#### fig-g-time-series-ar　自己回帰モデル（AR）とベクトル自己回帰（VAR）

- 優先度：**C**　／　主な章：03 機械学習の概要
- 何を描くか：上：1本の時系列の折れ線。yₜ に yₜ₋₁, yₜ₋₂ から矢印（ラグ）。下：2本の時系列（金利・為替）で、互いの過去の値からも矢印が交差して入る（VAR）。
- 文字より分かる理由：「自分の過去」か「互いの過去」かが、矢印の交差の有無で見分けられる。
- 使うカード（2）：C-03-009（自己回帰モデル (ARモデル)）、C-03-010（ベクトル自己回帰モデル (VARモデル)）
- 使う問題（1）：G-03-012
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [statsmodels: AutoReg (Autoregressive AR-X(p) model)](https://www.statsmodels.org/stable/generated/statsmodels.tsa.ar_model.AutoReg.html)（C-03-009）
  - [statsmodels: Vector Autoregressions (tsa.vector_ar)](https://www.statsmodels.org/stable/vector_ar.html)（C-03-010）

#### fig-g-metric-learning　Contrastive Loss と Triplet Loss

- 優先度：**C**　／　主な章：04 ディープラーニングの概要
- 何を描くか：左：埋め込み空間で、似たペアを近づける矢印、似ていないペアをマージン以上に遠ざける矢印。右：アンカー・ポジティブ・ネガティブの3点。アンカー–ポジティブ距離 ＋ マージン ＜ アンカー–ネガティブ距離 になるよう動かす。
- 文字より分かる理由：「2つ組」と「3つ組」の違いが、点の数と矢印の向きで分かる。
- 使うカード（2）：C-04-015（Contrastive Loss）、C-04-016（Triplet Loss）
- 使う問題（2）：G-04-013、G-04-014
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Hadsell, Chopra & LeCun (2006) Dimensionality Reduction by Learning an Invariant Mapping. CVPR](http://yann.lecun.com/exdb/publis/pdf/hadsell-chopra-lecun-06.pdf)（C-04-015）
  - [Schroff, Kalenichenko & Philbin (2015) FaceNet: A Unified Embedding for Face Recognition and Clustering (arXiv:1503.03832)](https://arxiv.org/abs/1503.03832)（C-04-016）
  - [PyTorch Documentation: torch.nn.TripletMarginLoss](https://docs.pytorch.org/docs/stable/generated/torch.nn.TripletMarginLoss.html)（C-04-016）

#### fig-g-end-to-end　End-to-End 学習と工程ごとの処理

- 優先度：**C**　／　主な章：04 ディープラーニングの概要
- 何を描くか：上：カメラ画像 → 車線検出 → 経路計画 → 制御 → ハンドル角（工程ごとに人が設計）。下：カメラ画像 → 1つのニューラルネットワーク → ハンドル角。
- 文字より分かる理由：途中の工程があるか無いかが、2本の流れの比較で分かる。
- 使うカード（1）：C-04-045（End-to-End学習）
- 使う問題（1）：G-04-043
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Bojarski et al. (2016) End to End Learning for Self-Driving Cars. arXiv:1604.07316（NVIDIA）](https://arxiv.org/abs/1604.07316)（C-04-045）

#### fig-g-inception　Inception モジュール（GoogLeNet）

- 優先度：**C**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：前の層から4本の並列の枝（1×1 畳み込み、1×1→3×3、1×1→5×5、3×3 最大値プーリング→1×1）が出て、最後に連結。1×1 畳み込みでチャネル数を減らして計算量を抑える、と注記。補助分類器の位置は別枠。
- 文字より分かる理由：「並列に束ねる」構造は、文字より図の方が誤解がない。
- 使うカード（1）：C-06-004（GoogLeNet（Inception））
- 使う問題（1）：G-06-073
- 描く前に確かめること：枝の構成は GoogLeNet 論文で確かめてから描く。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Szegedy et al. (2014) Going Deeper with Convolutions (arXiv:1409.4842)](https://arxiv.org/abs/1409.4842)（C-06-004）

#### fig-g-mt-history　機械翻訳の方式の変遷（ルールベース→統計的→ニューラル）

- 優先度：**C**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：3列の比較。ルールベース：人が書いた辞書と文法規則で変換。統計的：対訳コーパスから訳語・語順の確率を学び、最もありそうな訳を選ぶ。ニューラル：エンコーダ・デコーダで文全体を変換。各列の下に「知識の出どころ」（人／データの統計／データからの表現学習）。
- 文字より分かる理由：知識の出どころの違いが、3列を並べると対比で分かる。
- 使うカード（4）：C-06-037（機械翻訳の変遷（ルールベース→統計的→ニューラル））、C-01-019（ルールベース機械翻訳）、C-01-020（統計的機械翻訳）、C-06-098（対訳コーパス（パラレルコーパス））
- 使う問題（4）：G-06-025、G-01-017、G-01-018、G-06-079
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [JDLA G検定シラバス（シラバス2024・2026年5月11日 第1.4版）](https://www.jdla.org/certificate/general/)（C-06-037、C-01-019）
  - [Jurafsky & Martin, Speech and Language Processing (3rd ed. draft) Chapter 13: Machine Translation](https://web.stanford.edu/~jurafsky/slp3/13.pdf)（C-06-037、C-01-019、C-06-098）
  - [Brown et al. (1990) A Statistical Approach to Machine Translation. Computational Linguistics](https://aclanthology.org/J90-2002.pdf)（C-06-037、C-01-020）
  - [Sutskever, Vinyals & Le (2014) Sequence to Sequence Learning with Neural Networks (arXiv:1409.3215)](https://arxiv.org/abs/1409.3215)（C-06-037）
  - [Wu et al. (2016) Google's Neural Machine Translation System (arXiv:1609.08144)](https://arxiv.org/abs/1609.08144)（C-06-037）
  - [松尾豊「人工知能の未来 －ディープラーニングの先にあるもの－」（経済産業研究所 BBLセミナー資料、2015年6月3日）](https://www.rieti.go.jp/jp/events/bbl/15060301.pdf)（C-01-019）

#### fig-g-distributed-rl　分散型の深層強化学習（A3C と Ape-X）

- 優先度：**C**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：左：A3C。複数のワーカー（環境＋ネットワークの複製）が非同期に共有パラメータを更新。右：Ape-X。多数のアクターが経験を共有のリプレイメモリへ、1つのラーナーが優先度の高い経験を取り出して学習し、重みをアクターへ配る。
- 文字より分かる理由：誰が経験を集め誰が学ぶかの分担が、矢印の向きで分かる。
- 使うカード（2）：C-06-052（A3C と Ape-X（分散・並列の深層強化学習））、C-06-053（Ape-X）
- 使う問題（1）：G-06-036
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Mnih et al. (2016) Asynchronous Methods for Deep Reinforcement Learning (arXiv:1602.01783)](https://arxiv.org/abs/1602.01783)（C-06-052）
  - [Horgan et al. (2018) Distributed Prioritized Experience Replay (arXiv:1803.00933)](https://arxiv.org/abs/1803.00933)（C-06-052、C-06-053）

#### fig-g-rl-data-sources　オンライン強化学習・オフライン強化学習・模倣学習

- 優先度：**C**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：3列。オンライン：エージェントが環境と行き来しながら学ぶ輪。オフライン：過去に集めたデータの箱だけから学ぶ（環境への矢印が無い）。模倣学習：専門家の手本（状態と行動の組）から方策を学ぶ。sim2real は「シミュレータで学び実機へ移す、見た目をランダムに変える」と別枠。
- 文字より分かる理由：環境とやり取りするかどうかが、矢印の有無で一目で分かる。
- 使うカード（3）：C-06-059（オフライン強化学習）、C-06-097（模倣学習（Imitation Learning））、C-06-058（sim2real とドメインランダマイゼーション）
- 使う問題（4）：G-06-042、G-06-087、G-06-089、G-06-040
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Levine et al. (2020) Offline Reinforcement Learning: Tutorial, Review, and Perspectives (arXiv:2005.01643)](https://arxiv.org/abs/2005.01643)（C-06-059、C-06-097）
  - [Ross, Gordon & Bagnell (2011) A Reduction of Imitation Learning and Structured Prediction to No-Regret Online Learning (AISTATS) (arXiv:1011.0686)](https://arxiv.org/abs/1011.0686)（C-06-097）
  - [Tobin et al. (2017) Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World (arXiv:1703.06907)](https://arxiv.org/abs/1703.06907)（C-06-058）

#### fig-g-nerf　NeRF（位置と視線方向から密度と色を出す）

- 優先度：**C**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：カメラから場面へ伸びる光線と、その上の標本点。各点の (x, y, z, θ, φ) → 全結合ネットワーク → 密度と色。光線上の色を積み上げて画素の色にする。
- 文字より分かる理由：5次元の入力の意味が、カメラと光線の図で分かる。
- 使うカード（1）：C-06-068（NeRF（Neural Radiance Fields））
- 使う問題（1）：G-06-047
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Mildenhall et al. (2020) NeRF (arXiv:2003.08934)](https://arxiv.org/abs/2003.08934)（C-06-068）

#### fig-g-multimodal-tasks　画像と言語のタスク（キャプション・VQA・Text-to-Image）

- 優先度：**C**　／　主な章：06 ディープラーニングの応用例
- 何を描くか：3つの入出力の箱。Image Captioning：画像 → 文。VQA：画像＋質問文 → 答えの文。Text-to-Image：文 → 画像。入力と出力の向きを矢印で。
- 文字より分かる理由：入力と出力が何かの違いが、箱の並びで一目で分かる。
- 使うカード（3）：C-06-077（DALL-E と Text-To-Image）、C-06-078（Image Captioning と Visual Question Answering（VQA））、C-06-079（Flamingo）
- 使う問題（4）：G-06-056、G-06-059、G-06-093、G-06-058
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Ramesh et al. (2021) Zero-Shot Text-to-Image Generation (DALL-E) (arXiv:2102.12092)](https://arxiv.org/abs/2102.12092)（C-06-077）
  - [Vinyals et al. (2014) Show and Tell: A Neural Image Caption Generator (arXiv:1411.4555)](https://arxiv.org/abs/1411.4555)（C-06-078）
  - [Antol et al. (2015) VQA: Visual Question Answering (arXiv:1505.00468)](https://arxiv.org/abs/1505.00468)（C-06-078）
  - [Alayrac et al. (2022) Flamingo (arXiv:2204.14198)](https://arxiv.org/abs/2204.14198)（C-06-079）

#### fig-g-docker　Docker のイメージとコンテナ

- 優先度：**C**　／　主な章：07 AI の社会実装に向けて
- 何を描くか：1つのイメージ（設計図）から、同じコンテナを3つ起動する矢印。開発者の PC と本番サーバの両方で同じコンテナが動く図。
- 文字より分かる理由：イメージとコンテナの関係（設計図と実体）が、1対多の矢印で分かる。
- 使うカード（1）：C-07-010（Docker（コンテナ））
- 使う問題（2）：G-07-008、G-07-025
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Docker Docs "What is Docker?"](https://docs.docker.com/get-started/docker-overview/)（C-07-010）

#### fig-g-society50　Society 5.0（サイバー空間とフィジカル空間の融合）

- 優先度：**C**　／　主な章：07 AI の社会実装に向けて
- 何を描くか：下にフィジカル空間（人・車・工場）、上にサイバー空間（クラウド・AI）。フィジカル→サイバーに「センサーのデータ」、サイバー→フィジカルに「AI が解析した結果のフィードバック」の輪。左に狩猟→農耕→工業→情報→5.0 の5段。
- 文字より分かる理由：2つの空間を行き来する輪が、言葉より図で伝わる。
- 使うカード（1）：C-07-019（Society 5.0（サイバー空間とフィジカル空間））
- 使う問題（1）：G-07-033
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [内閣府「Society 5.0」](https://www8.cao.go.jp/cstp/society5_0/)（C-07-019）
  - [内閣府「第5期科学技術基本計画の概要」](https://www8.cao.go.jp/cstp/kihonkeikaku/5gaiyo.pdf)（C-07-019）

#### fig-g-variance　分散と標準偏差（偏差の二乗の平均）

- 優先度：**C**　／　主な章：08 AI に必要な数理・統計知識
- 何を描くか：数直線上に8個のデータと平均の縦線。各点から平均への偏差を矢印、その長さを1辺とする正方形を描き「正方形の面積の平均＝分散、その平方根＝標準偏差」。データを2倍して5足すと、分散は4倍になり、足した5は分散を変えない（位置が動くだけ）、の小さな図。
- 文字より分かる理由：「二乗の平均」が正方形の面積として見え、変換で分散がどう変わるかも分かる。
- 使うカード（1）：C-08-003（分散と標準偏差）
- 使う問題（2）：G-08-003、G-08-027
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [NIST/SEMATECH e-Handbook 1.3.5.6 Measures of Scale](https://www.itl.nist.gov/div898/handbook/eda/section3/eda356.htm)（C-08-003）

#### fig-g-discrete-distributions　ベルヌーイ分布・二項分布・ポアソン分布

- 優先度：**C**　／　主な章：08 AI に必要な数理・統計知識
- 何を描くか：3つの棒グラフ。ベルヌーイ（0と1の2本）、二項分布（n＝8, p＝0.5 の山、平均 np＝4、分散 np(1−p)＝2）、ポアソン分布（λ＝3 の山、平均も分散も λ）。各図の下に平均・分散の式。
- 文字より分かる理由：分布の形と平均・分散の式が、棒グラフと並べると結びつく。
- 使うカード（3）：C-08-009（ベルヌーイ分布と二項分布）、C-08-010（ポアソン分布）、C-08-006（期待値）
- 使う問題（5）：G-08-005、G-08-006、G-08-007、G-08-026、G-08-004
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [NIST/SEMATECH e-Handbook 1.3.6.6.18 Binomial Distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda366i.htm)（C-08-009、C-08-006）
  - [NIST/SEMATECH e-Handbook 1.3.6.6.19 Poisson Distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda366j.htm)（C-08-010、C-08-006）
  - [MIT OCW 18.05 (Orloff & Bloom, Spring 2022) Class 4b Reading: Expected Value of Discrete Random Variables](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/resources/mit18_05_s22_class04-prep-b_pdf/)（C-08-006）

#### fig-g-moving-average　移動平均（短期の変動をならす）

- 優先度：**C**　／　主な章：08 AI に必要な数理・統計知識
- 何を描くか：ぎざぎざの時系列の折れ線と、3点の単純移動平均の滑らかな線。最後の点で「直近3点（20,22,27）の平均＝23」の括り。
- 文字より分かる理由：窓をずらして平均するとならされる様子が、2本の線で分かる。
- 使うカード（1）：C-08-018（移動平均）
- 使う問題（3）：G-08-017、G-08-038、G-08-052
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [NIST/SEMATECH e-Handbook 6.4.2.1 Single Moving Average](https://www.itl.nist.gov/div898/handbook/pmc/section4/pmc421.htm)（C-08-018）
  - [NIST/SEMATECH e-Handbook 6.4.4.2 Stationarity](https://www.itl.nist.gov/div898/handbook/pmc/section4/pmc442.htm)（C-08-018）

#### fig-g-sampling　無作為抽出と層化抽出

- 優先度：**C**　／　主な章：08 AI に必要な数理・統計知識
- 何を描くか：地域ごとに色分けした母集団の点。左：全体からくじ引きで選ぶ（偶然、ある地域に偏ることがある）。右：地域ごとに同じ割合で選ぶ（層化抽出）。
- 文字より分かる理由：層ごとに選ぶ意味が、色分けの図で一目で分かる。
- 使うカード（1）：C-08-027（標本抽出（無作為抽出・層化抽出））
- 使う問題（1）：G-08-048
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省統計局「労働力調査 標本設計の解説」（平成30年4月）](https://www.stat.go.jp/data/roudou/hyohon/pdf/18hyohon.pdf)（C-08-027）
  - [scikit-learn User Guide: Cross-validation（Stratified k-fold）](https://scikit-learn.org/stable/modules/cross_validation.html)（C-08-027）

#### fig-g-ip-map　知的財産権の全体像

- 優先度：**C**　／　主な章：09 AIに関する法律と契約
- 何を描くか：木構造：知的財産権 → 産業財産権（特許権・実用新案権・意匠権・商標権）／著作権／その他（営業秘密・限定提供データは不正競争防止法で保護）。各葉に「登録が要るか」「保護期間の目安」を1語（カードの出典で確かめた値のみ）。
- 文字より分かる理由：どの権利がどの法律のどこに属するかが、木の位置で整理できる。
- 使うカード（5）：C-09-019（知的財産権の全体像）、C-09-017（特許権の発生・存続期間と出願公開）、C-09-011（著作権の発生と保護期間・職務著作）、C-09-020（営業秘密（3要件））、C-09-021（限定提供データ）
- 使う問題（2）：G-09-025、G-09-027
- 描く前に確かめること：保護期間などの数値は e-Gov で確かめたものだけ書く。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [特許庁「産業財産権について」](https://www.jpo.go.jp/system/patent/gaiyo/seidogaiyo/chizai01.html)（C-09-019）
  - [特許庁「知的財産権について」](https://www.jpo.go.jp/system/patent/gaiyo/seidogaiyo/chizai02.html)（C-09-019）
  - [不正競争防止法（e-Gov法令検索・令和8年5月21日施行版）](https://laws.e-gov.go.jp/law/405AC0000000047)（C-09-019、C-09-020、C-09-021）
  - [経済産業省「AI・データの利用に関する契約ガイドライン 1.1版」（令和元年12月）](https://www.meti.go.jp/policy/mono_info_service/connected_industries/sharing_and_utilization/20200619001.pdf)（C-09-019）
  - [特許法（e-Gov法令検索・令和8年6月24日施行版）](https://laws.e-gov.go.jp/law/334AC0000000121)（C-09-017）
  - [著作権法（e-Gov法令検索・令和8年6月24日施行版）](https://laws.e-gov.go.jp/law/345AC0000000048)（C-09-011）
  - [経済産業省「限定提供データに関する指針」（平成31年1月23日、最終改訂 令和6年2月）](https://www.meti.go.jp/policy/economy/chizai/chiteki/guideline/h31pd.pdf)（C-09-021）

#### fig-g-filter-bubble　フィルターバブルとエコーチェンバー

- 優先度：**C**　／　主な章：10 AI倫理・AIガバナンス
- 何を描くか：左：フィルターバブル。利用者を囲む泡の中に、アルゴリズムが選んだ好みの情報だけが入る（入口にアルゴリズムの歯車）。右：エコーチェンバー。似た意見の人どうしの輪の中で同じ意見が反響して強まる。原因の違い（アルゴリズムか、人のつながりか）を下に。
- 文字より分かる理由：似た2つの現象の原因の違いが、歯車の有無で見分けられる。
- 使うカード（1）：C-10-022（フィルターバブルとエコーチェンバー）
- 使う問題（2）：G-10-025、G-10-026
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省・経済産業省「AI事業者ガイドライン（第1.2版）本編」（令和8年3月31日）](https://www.meti.go.jp/shingikai/mono_info_service/ai_shakai_jisso/pdf/20260331_1.pdf)（C-10-022）
  - [総務省・経済産業省「AI事業者ガイドライン（第1.2版）別添（付属資料）」（令和8年3月31日）](https://www.meti.go.jp/shingikai/mono_info_service/ai_shakai_jisso/pdf/20260331_3.pdf)（C-10-022）

#### fig-g-proxy-variable　センシティブ属性を消しても残る偏り（代理変数）

- 優先度：**C**　／　主な章：10 AI倫理・AIガバナンス
- 何を描くか：特徴量の列のうち「性別」の列に×をつけて削除。しかし「部活動」「購買履歴」などの列が性別と強く結びつく（点線の矢印）ため、予測に偏りが残る、という表と矢印の図。
- 文字より分かる理由：「消したのに残る」理由が、列どうしのつながりの矢印で見える。
- 使うカード（2）：C-10-012（センシティブ属性と代理変数）、C-10-010（アルゴリズムバイアス）
- 使う問題（1）：G-10-011
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省・経済産業省「AI事業者ガイドライン（第1.2版）本編」（令和8年3月31日）](https://www.meti.go.jp/shingikai/mono_info_service/ai_shakai_jisso/pdf/20260331_1.pdf)（C-10-012、C-10-010）
  - [総務省・経済産業省「AI事業者ガイドライン（第1.2版）別添（付属資料）」（令和8年3月31日）](https://www.meti.go.jp/shingikai/mono_info_service/ai_shakai_jisso/pdf/20260331_3.pdf)（C-10-010）


## DXビジネス検定

### DXビジネス検定：章ごとの件数

「図の数」は、その章を主な置き場所とする図の数。「図を使うカード／問題」は、その章のカード・問題のうち、どれか1枚以上の図に名前が挙がったものの数（ほかの章の図から使われるものも数える）。

| 章 | A | B | C | 図の数 | 図を使うカード | 図を使う問題 |
|---|---|---|---|---|---|---|
| 01 DXの基本 | 1 | 4 | 1 | 6 | 17 / 28 | 28 / 38 |
| 02 デジタル技術 | 2 | 11 | 0 | 13 | 22 / 37 | 25 / 39 |
| 03 データと分析 | 2 | 5 | 2 | 9 | 22 / 25 | 26 / 31 |
| 04 マーケティング | 1 | 4 | 1 | 6 | 12 / 25 | 13 / 31 |
| 05 消費者の状況とビジネス環境 | 3 | 2 | 3 | 8 | 19 / 32 | 22 / 34 |
| 06 戦略モデル | 4 | 1 | 1 | 6 | 18 / 25 | 22 / 29 |
| 07 オペレーションモデル | 1 | 5 | 0 | 6 | 20 / 22 | 26 / 30 |
| 08 収益モデル | 0 | 3 | 1 | 4 | 13 / 13 | 18 / 24 |
| 09 事例：デジタル集客・マッチング・マーケットプレイス | 0 | 1 | 0 | 1 | 3 / 6 | 7 / 13 |
| 10 事例：デジタル商材 | 0 | 0 | 0 | 0 | 1 / 6 | 2 / 13 |
| 11 事例：リアルビジネス＋デジタル融合 | 0 | 0 | 0 | 0 | 1 / 5 | 5 / 12 |
| 12 事例：リアルビジネス | 0 | 1 | 0 | 1 | 3 / 6 | 8 / 13 |
| **計** | **14** | **37** | **9** | **60** | **151 / 230** | **202 / 307** |

### DXビジネス検定：優先度 A の一覧

| 図 ID | 題 | 章 | 使うカード数 | 使う問題数 |
|---|---|---|---|---|
| fig-dx-3stages | デジタイゼーション→デジタライゼーション→デジタルトランスフォーメーション | 01 | 2 | 4 |
| fig-dx-agent-mcp-a2a | AI エージェントと MCP・A2A のつなぎ方 | 02 | 4 | 4 |
| fig-dx-mfa | 多要素認証と二段階認証（認証の3要素） | 02 | 2 | 2 |
| fig-dx-scale | スケールアップとスケールアウト | 03 | 2 | 4 |
| fig-dx-data-pipeline | データ活用基盤の流れ（データソース→ETL→データレイク／DWH→データマート→BI） | 03 | 6 | 8 |
| fig-dx-o2o-omo-omni | O2O・オムニチャネル・OMO の違い | 04 | 3 | 5 |
| fig-dx-network-effect | ネットワーク外部性とクリティカルマス | 05 | 4 | 8 |
| fig-dx-economies | 規模・範囲・密度・速度の経済 | 05 | 6 | 6 |
| fig-dx-modular-layer | 垂直統合とレイヤー化・モジュール化 | 05 | 4 | 5 |
| fig-dx-platform-types | 媒介型プラットフォームと基盤型プラットフォーム | 06 | 3 | 6 |
| fig-dx-value-chain-roles | 事業の構え方（垂直統合・レイヤーマスター・オーケストレーター・イネーブラー） | 06 | 4 | 2 |
| fig-dx-long-tail | ロングテール | 06 | 2 | 3 |
| fig-dx-c2c-escrow | 個人間取引のエスクロー（代金を預かる仕組み） | 06 | 3 | 6 |
| fig-dx-make-sell-models | つくり方と売り方のモデル（ファブレス・OEM・SPA・直販・受注生産） | 07 | 5 | 9 |

### DXビジネス検定：図ごとの計画（A → B → C、同じ優先度の中は章の順）

#### fig-dx-3stages　デジタイゼーション→デジタライゼーション→デジタルトランスフォーメーション

- 優先度：**A**　／　主な章：01 DXの基本
- 何を描くか：3段の階段。1段目「デジタイゼーション：アナログ・物理データのデジタル化（紙の伝票を電子化）」、2段目「デジタライゼーション：個別の業務・プロセスのデジタル化（配車を自動化）」、3段目「デジタルトランスフォーメーション：全社の業務と、顧客起点の事業・ビジネスモデルの変革（配車プラットフォームという新事業）」。各段の横に「変わる範囲」（データ／1つの業務／会社と事業）を幅の違う帯で。注記：IPA の DX 白書2023 は前の2段では成果が出ているが3段目は不十分としている。
- 文字より分かる理由：3つの似た言葉が「変わる範囲」の広さで並ぶと、例を当てはめやすくなる。
- 使うカード（2）：DC-01-002（デジタイゼーション／デジタライゼーション／デジタルトランスフォーメーション）、DC-01-001（DXの定義（DX推進ガイドライン））
- 使う問題（4）：D-01-002、D-01-021、D-01-022、D-01-001
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [経済産業省「DXレポート2（中間取りまとめ）」（2020年12月28日）図5-8](https://www.meti.go.jp/press/2020/12/20201228004/20201228004-2.pdf)（DC-01-002）
  - [IPA「DX白書2023」（2023年）](https://www.ipa.go.jp/publish/wp-dx/gmcbt8000000botk-att/000108041.pdf)（DC-01-002）
  - [経済産業省「DX推進ガイドライン Ver.1.0」（2018年12月）](https://www.meti.go.jp/press/2018/12/20181212004/20181212004-1.pdf)（DC-01-001）
  - [経済産業省「デジタルガバナンス・コード3.0」（2020年11月策定・2024年9月19日改訂）](https://www.meti.go.jp/policy/it_policy/investment/dgc/dgc3.0.pdf)（DC-01-001）

#### fig-dx-agent-mcp-a2a　AI エージェントと MCP・A2A のつなぎ方

- 優先度：**A**　／　主な章：02 デジタル技術
- 何を描くか：中央に AI エージェント（目標 → タスクに分ける → 実行）。下向きに MCP の線で、ファイル・データベース・検索ツール・ワークフローにつながる（「AI と道具をつなぐ」、USB-C のたとえ）。横向きに A2A の線で、別の会社の AI エージェント（経費・在庫）とつながる（「AI と AI をつなぐ」）。各規格の公開年・公開元（MCP：2024年11月 Anthropic、A2A：2025年4月 Google）。
- 文字より分かる理由：MCP と A2A の違いが、線の向き（道具へ／他のエージェントへ）で一目で分かる。
- 使うカード（4）：DC-02-018（生成AIエージェント（AIエージェント））、DC-02-020（MCP（Model Context Protocol））、DC-05-030（A2A（Agent2Agent Protocol））、DC-02-019（RAG（Retrieval-Augmented Generation：検索拡張生成））
- 使う問題（4）：D-02-011、D-02-012、D-02-033、D-05-013
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「令和7年版 情報通信白書」AI研究開発における最近の動向](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r07/html/nd112120.html)（DC-02-018）
  - [Model Context Protocol 公式ドキュメント「What is the Model Context Protocol (MCP)?」](https://modelcontextprotocol.io/docs/getting-started/intro)（DC-02-020）
  - [Anthropic「Introducing the Model Context Protocol」（2024年11月）](https://www.anthropic.com/news/model-context-protocol)（DC-02-020）
  - [Google Developers Blog「Announcing the Agent2Agent Protocol (A2A)」（2025年4月）](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)（DC-05-030）
  - [A2A Protocol 公式サイト](https://a2a-protocol.org/latest/)（DC-05-030）
  - [Lewis ほか「Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks」（arXiv:2005.11401, 2020）](https://arxiv.org/abs/2005.11401)（DC-02-019）

#### fig-dx-mfa　多要素認証と二段階認証（認証の3要素）

- 優先度：**A**　／　主な章：02 デジタル技術
- 何を描くか：3つの円：知識情報（パスワード・秘密の質問）、所持情報（スマホ・IC カード）、生体情報（指紋・顔）。例の組み合わせを線で結び、判定を付ける：パスワード＋スマホの確認コード＝2要素（多要素）、パスワード＋秘密の質問＝同じ円の中なので多要素ではない（二段階だが一要素）。
- 文字より分かる理由：「段階の数」と「要素の種類」の違いが、円をまたぐかどうかで一目で分かる。
- 使うカード（2）：DC-02-033（多要素認証）、DC-02-032（ゼロトラスト）
- 使う問題（2）：D-02-017、D-02-038
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「国民のためのサイバーセキュリティサイト」用語集（た行）](https://www.soumu.go.jp/main_sosiki/cybersecurity/kokumin/glossary/ja_04/)（DC-02-033）
  - [総務省「国民のためのサイバーセキュリティサイト」社員・職員全般の情報セキュリティ対策](https://www.soumu.go.jp/main_sosiki/cybersecurity/kokumin/security/business/staff/06/)（DC-02-033）
  - [デジタル庁「ゼロトラストアーキテクチャ適用方針」（2022年6月30日）](https://www.digital.go.jp/assets/contents/node/basic_page/field_ref_resources/e2a06143-ed29-4f1d-9c31-0f06fca67afc/5efa5c3b/20220630_resources_standard_guidelines_guidelines_04.pdf)（DC-02-032）

#### fig-dx-scale　スケールアップとスケールアウト

- 優先度：**A**　／　主な章：03 データと分析
- 何を描くか：左：1台のサーバーを大きなサーバーに取り替える（CPU・メモリを増やす）＝スケールアップ、逆がスケールダウン。右：同じサーバーを3台に増やし、ロードバランサーで処理を分け合う＝スケールアウト、減らすのがスケールイン。下に「スケールアウトは障害に強い／DB が詰まっていれば Web サーバーを増やしても改善しない」。
- 文字より分かる理由：「大きくする」か「数を増やす」かが、絵で一目で区別できる。
- 使うカード（2）：DC-03-005（スケールアップ（ダウン）とスケールアウト（イン））、DC-03-006（並列分散処理）
- 使う問題（4）：D-03-005、D-03-020、D-03-022、D-03-006
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Microsoft Learn「スケールアウトのための設計」（Azure Architecture Center）](https://learn.microsoft.com/ja-jp/azure/architecture/guide/design-principles/scale-out)（DC-03-005）
  - [Microsoft Learn「スケーリングとパーティション分割のための設計に関する推奨事項」（Azure Well-Architected）](https://learn.microsoft.com/ja-jp/azure/well-architected/performance-efficiency/scale-partition)（DC-03-005）
  - [AWS「NoSQL とは」](https://aws.amazon.com/jp/nosql/)（DC-03-005）
  - [総務省 情報通信審議会ICT基本戦略ボード「ビッグデータの活用の在り方について」（2012年5月17日）](https://www.soumu.go.jp/main_content/000160628.pdf)（DC-03-006）

#### fig-dx-data-pipeline　データ活用基盤の流れ（データソース→ETL→データレイク／DWH→データマート→BI）

- 優先度：**A**　／　主な章：03 データと分析
- 何を描くか：左から右への流れ図。データソース（POS・会員アプリ・EC・センサー）→ データレイク（加工せず元の形式のまま、画像・音声も）→ ETL（抽出・変換・格納、途中でデータクレンジング）→ データウェアハウス（整理・統合して時系列で蓄積）→ データマート（部門・主題ごとの小さな置き場）→ BI ツール（可視化・意思決定）。各箱に1行の説明と、「元のまま」「整理済み」「部門用」の色分け。
- 文字より分かる理由：似た名前の置き場の順番と役割の違いが、1本の流れに並べると混同しなくなる。
- 使うカード（6）：DC-03-009（データレイク）、DC-03-010（データウェアハウス（DWH））、DC-03-011（データマート）、DC-03-013（ETLツール）、DC-03-014（データクレンジング）、DC-03-016（BI（Business Intelligence））
- 使う問題（8）：D-03-001、D-03-002、D-03-003、D-03-023、D-03-025、D-03-008、D-03-029、D-03-024
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [IPA「DX白書2023」第5部 データ利活用技術](https://www.ipa.go.jp/publish/wp-dx/gmcbt8000000botk-att/000108041.pdf)（DC-03-009、DC-03-010、DC-03-013、DC-03-014、DC-03-016）
  - [AWS「データマートとは?」](https://aws.amazon.com/jp/what-is/data-mart/)（DC-03-011）
  - [AWS「データクレンジングとは」](https://aws.amazon.com/jp/what-is/data-cleansing/)（DC-03-014）

#### fig-dx-o2o-omo-omni　O2O・オムニチャネル・OMO の違い

- 優先度：**A**　／　主な章：04 マーケティング
- 何を描くか：3つの図を並べる。O2O：オンラインとオフラインの2つの島を別々に描き、ネットから店へ人を送る矢印（クーポン・店舗受け取り）。オムニチャネル：顧客を中心に、店舗・EC・アプリ・SNS・コールセンターが輪になり、在庫・会員情報・ポイントを1つにつなぐ。OMO：オンラインとオフラインの境目が溶けて1本の顧客体験の道（店内でネットのサービスを使う）。
- 文字より分かる理由：「行き来させる／すべてつなぐ／溶け合う」の違いが、島と輪と1本の道の形で分かる。
- 使うカード（3）：DC-04-007（O2O（Online to Offline））、DC-04-008（OMO（Online Merges with Offline））、DC-04-009（オムニチャネル）
- 使う問題（5）：D-04-001、D-04-002、D-04-020、D-11-006、D-12-010
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「情報通信白書 for Kids」ネットショッピングのO2O・OMOって何？](https://www.soumu.go.jp/hakusho-kids/use/economy/economy_01.html)（DC-04-007、DC-04-008）
  - [総務省「平成25年版 情報通信白書」新たなICTトレンドによって変わる事業活動](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h25/html/nc111320.html)（DC-04-007、DC-04-009）

#### fig-dx-network-effect　ネットワーク外部性とクリティカルマス

- 優先度：**A**　／　主な章：05 消費者の状況とビジネス環境
- 何を描くか：左：循環の図。利用者が増える → サービスの価値が上がる → さらに利用者が増える。両面市場版として、出品者が増える ⇄ 購入者が増える の2つの輪が互いを押す。右：横軸＝時間、縦軸＝利用者数の S 字曲線。立ち上がりの手前に「クリティカルマス（自然に広がり始める分岐点）」の水平線。その手前で無料化・紹介キャンペーンなどで押し上げる矢印。
- 文字より分かる理由：自己強化の輪と、分岐点を越えるまでが難しいことが、輪と S 字の組で分かる。
- 使うカード（4）：DC-05-006（ネットワーク外部性（効果））、DC-05-007（クリティカルマス）、DC-06-005（媒介型プラットフォーム）、DC-06-008（ネットワークビジネス）
- 使う問題（8）：D-05-001、D-05-002、D-05-004、D-05-015、D-09-003、D-09-013、D-06-004、D-06-014
- 注意：次のカードは status が verified でない → DC-06-008
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「令和元年版 情報通信白書」デジタル経済におけるデジタル・プラットフォーマーの位置付け](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r01/html/nd113110.html)（DC-05-006）
  - [総務省「平成29年版 情報通信白書」オンラインプラットフォームの意義](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h29/html/nc113110.html)（DC-05-006、DC-06-005）
  - [総務省「平成23年版 情報通信白書」コラム ネットワーク型サービスの背後にある考え方](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h23/html/nc232c00.html)（DC-05-007）
  - [DXビジネス検定 公式ページ シラバス（2026年2月改訂）](https://www.nextet.net/netkentei/dx-biz/)（DC-06-008）
  - [大阪府「「化粧品を買って会員になり、友人を誘って商品を販売するだけで簡単にお金がもうかる」といわれたが大丈夫か。」](https://www.pref.osaka.lg.jp/faq/o070120/faq_002094.html)（DC-06-008）

#### fig-dx-economies　規模・範囲・密度・速度の経済

- 優先度：**A**　／　主な章：05 消費者の状況とビジネス環境
- 何を描くか：4コマ。規模の経済：横軸＝生産量、縦軸＝1単位あたりのコストの右下がり曲線（デジタルでは追加の1単位の費用がほぼ0）。範囲の経済：共通の資源（設備・顧客基盤・データ）の箱から複数の事業へ枝が出る。密度の経済：地図上で店舗・配送先が狭い範囲に集まり、移動距離が短い（ドミナント戦略の例）。速度の経済：時間軸で、開発・生産・販売を速く回すと在庫と機会損失が減る。
- 文字より分かる理由：4つの「〇〇の経済」が、何が増えると何が下がるかをそれぞれの絵で対比できる。
- 使うカード（6）：DC-05-002（規模の経済）、DC-05-003（範囲の経済）、DC-05-004（密度の経済）、DC-05-005（速度の経済）、DC-05-015（デジタル化）、DC-05-023（ドミナント戦略）
- 使う問題（6）：D-05-003、D-05-017、D-05-018、D-05-024、D-07-018、D-05-031
- 注意：次のカードは status が verified でない → DC-05-005
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「令和7年版 情報通信白書」プラットフォーム事業者の成長とその背景](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r07/html/nd113110.html)（DC-05-002）
  - [総務省「令和元年版 情報通信白書」デジタル経済におけるデジタル・プラットフォーマーの位置付け](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r01/html/nd113110.html)（DC-05-003、DC-05-015）
  - [経済産業研究所（RIETI）「サービス業の生産性と密度の経済性－事業所データによる対個人サービス業の分析－」](https://www.rieti.go.jp/jp/publications/nts/08j008.html)（DC-05-004）
  - [DXビジネス検定 公式ページ シラバス（2026年2月改訂）](https://www.nextet.net/netkentei/dx-biz/)（DC-05-005）
  - [総務省「令和元年版 情報通信白書」1つ目のキーワード：デジタルデータ](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r01/html/nd121110.html)（DC-05-015）
  - [総務省「令和元年版 情報通信白書」2つ目のキーワード：限界費用](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r01/html/nd121120.html)（DC-05-015）
  - [公正取引委員会「コンビニエンスストア本部と加盟店との取引等に関する実態調査報告書（概要）」（令和2年9月）](https://www.jftc.go.jp/houdou/pressrelease/2020/sep/kitori0902/200902_04-2.pdf)（DC-05-023）

#### fig-dx-modular-layer　垂直統合とレイヤー化・モジュール化

- 優先度：**A**　／　主な章：05 消費者の状況とビジネス環境
- 何を描くか：左：垂直統合。端末・通信・プラットフォーム・コンテンツの4層を1社が縦に全部持つ（従来型の携帯インターネット）。右：レイヤー化。同じ4層が横に切れ、各層で別の会社が競う（利用者が層ごとに選ぶ）。下：モジュール化。部品のつなぎ方を規格にすると、部品を組み合わせるだけで完成品ができる（パソコンの例）。
- 文字より分かる理由：縦に持つか横に分かれるかが、同じ4層の塗り分けで一目で分かる。
- 使うカード（4）：DC-06-001（垂直統合）、DC-05-018（レイヤー化）、DC-05-016（モジュール化）、DC-05-017（オープンソース）
- 使う問題（5）：D-05-007、D-05-025、D-05-026、D-06-013、D-05-027
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「平成24年版 情報通信白書」ICT産業の構造とエコシステムの変化](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h24/html/nc122210.html)（DC-06-001、DC-05-018）
  - [総務省「平成29年版 情報通信白書」オンラインプラットフォームの意義](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h29/html/nc113110.html)（DC-06-001）
  - [総務省「令和2年版 情報通信白書」5G時代に向けての各レイヤーの動向](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r02/html/nd114220.html)（DC-05-018）
  - [総務省「平成27年版 情報通信白書」第1部第3節 ICT産業の構造変化](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h27/pdf/n1300000.pdf)（DC-05-016）
  - [IPA DX SQUARE「オープンソースとは？ 今さら聞けないDX関連用語をわかりやすく解説」](https://dx.ipa.go.jp/open-source)（DC-05-017）
  - [総務省「令和元年版 情報通信白書」1つ目のキーワード：デジタルデータ](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r01/html/nd121110.html)（DC-05-017）

#### fig-dx-platform-types　媒介型プラットフォームと基盤型プラットフォーム

- 優先度：**A**　／　主な章：06 戦略モデル
- 何を描くか：左：媒介型。売り手のグループと買い手のグループの間に仲介の場があり、両側の矢印が場を通る（両面市場）。右：基盤型。下に土台（OS・クラウド・ゲーム機）、その上に他の企業のアプリ・サービスの箱が多数載る。エコシステムは「基盤を中心に企業・開発者・利用者が依存し合う」と周りの輪で。
- 文字より分かる理由：「間に立つ」か「下で支える」かの違いが、配置の上下・左右で一目で分かる。
- 使うカード（3）：DC-06-005（媒介型プラットフォーム）、DC-06-006（基盤型プラットフォーム）、DC-06-007（エコシステム）
- 使う問題（6）：D-06-004、D-06-005、D-06-013、D-06-014、D-06-015、D-09-010
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「平成29年版 情報通信白書」オンラインプラットフォームの意義](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h29/html/nc113110.html)（DC-06-005、DC-06-006）
  - [経済産業省「通商白書2016」第Ⅰ部第3章第2節 プラットフォーム化と産業構造の変化](https://www.meti.go.jp/report/tsuhaku2016/2016honbun/i1320000.html)（DC-06-007）

#### fig-dx-value-chain-roles　事業の構え方（垂直統合・レイヤーマスター・オーケストレーター・イネーブラー）

- 優先度：**A**　／　主な章：06 戦略モデル
- 何を描くか：横にバリューチェーン（調達→開発→生産→販売→サービス）の帯を4行並べる。垂直統合：1社が全段を塗る。レイヤーマスター：1つの段だけを濃く塗り、そこから全体へ影響の矢印。オーケストレーター：顧客との接点（販売・サービス）を握り、他段は外部の会社に任せて束ねる。イネーブラー：顧客から見えない裏方の1段を、他社に提供する。
- 文字より分かる理由：4つの構え方が「どの段を自社で持つか」の塗り分けで比べられる。
- 使うカード（4）：DC-06-001（垂直統合）、DC-06-002（レイヤーマスター）、DC-06-003（オーケストレーター）、DC-06-004（イネーブラー）
- 使う問題（2）：D-06-006、D-07-012
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「平成24年版 情報通信白書」ICT産業の構造とエコシステムの変化](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h24/html/nc122210.html)（DC-06-001）
  - [総務省「平成29年版 情報通信白書」オンラインプラットフォームの意義](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h29/html/nc113110.html)（DC-06-001）
  - [Boston Consulting Group「The Deconstruction of Value Chains」（BCG Perspectives, 1998年）](https://www.bcg.com/publications/1998/alliances-joint-ventures-business-unit-strategy-deconstruction-of-value-chains)（DC-06-002、DC-06-003）
  - [DXビジネス検定 公式ページ シラバス（2026年2月改訂）](https://www.nextet.net/netkentei/dx-biz/)（DC-06-002）
  - [金融庁「諸外国における保険会社のグループガバナンス等の調査 最終報告書 公開版」（令和3年3月31日）海外企業の事業展開戦略の最新動向 エコシステム](https://www.fsa.go.jp/common/about/research/20210517/report.pdf)（DC-06-003、DC-06-004）

#### fig-dx-long-tail　ロングテール

- 優先度：**A**　／　主な章：06 戦略モデル
- 何を描くか：横軸＝商品の売れ筋順位、縦軸＝販売数。左端の高い部分（ヘッド）と、右へ長く低く伸びる部分（テール）。実店舗の棚の限界の縦線（ここより右は置けない）と、ネット店舗ならテールまで扱え、テールの面積の合計が大きくなることを塗りで示す。
- 文字より分かる理由：「1つは少なくても合計が大きい」が、曲線の下の面積で直感的に分かる。
- 使うカード（2）：DC-06-013（ロングテール）、DC-06-014（スーパーニッチ）
- 使う問題（3）：D-06-007、D-06-008、D-06-020
- 注意：次のカードは status が verified でない → DC-06-014
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「平成18年版 情報通信白書」コンテンツとロングテール現象](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h18/html/i1911000.html)（DC-06-013）
  - [DXビジネス検定 公式ページ シラバス（2026年2月改訂）](https://www.nextet.net/netkentei/dx-biz/)（DC-06-014）

#### fig-dx-c2c-escrow　個人間取引のエスクロー（代金を預かる仕組み）

- 優先度：**A**　／　主な章：06 戦略モデル
- 何を描くか：買い手・運営会社・売り手の3者。①買い手が代金を運営会社に払う（預かる）→ ②売り手が発送 → ③買い手が受け取りと評価 → ④運営会社が売り手に代金を払う（手数料を引く）。番号つきの矢印。注記「評価を先に求める・発送前に評価させるのは手順が逆」。
- 文字より分かる理由：お金と物の動く順番が、番号つきの矢印で追える。
- 使うカード（3）：DC-06-012（個人間取引（C2C））、DC-09-002（メルカリ（フリマアプリ））、DC-09-005（TimeTicket（タイムチケット））
- 使う問題（6）：D-06-012、D-06-017、D-06-018、D-09-004、D-09-005、D-09-010
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「平成29年版 情報通信白書」シェアリング・エコノミー（C to Cサービス）](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h29/html/nc112220.html)（DC-06-012）
  - [国民生活センター「相談急増！フリマサービスでのトラブルにご注意」（2018年2月22日）](https://www.kokusen.go.jp/pdf/n-20180222_1.pdf)（DC-06-012）
  - [総務省「上手にネットと付き合おう！」テーマ4 フリマなどネットを介した取引によるトラブル](https://www.soumu.go.jp/use_the_internet_wisely/trouble/case/fleamarket.html)（DC-06-012）
  - [株式会社メルカリ 公式サイト「私たちについて」](https://about.mercari.com/about/about-us/)（DC-09-002）
  - [タイムチケット 公式サイト](https://www.timeticket.jp/)（DC-09-005）

#### fig-dx-make-sell-models　つくり方と売り方のモデル（ファブレス・OEM・SPA・直販・受注生産）

- 優先度：**A**　／　主な章：07 オペレーションモデル
- 何を描くか：横に「企画・設計 → 製造 → 物流 → 販売」の4段の帯。行ごとに、その会社が自分で持つ段を濃く塗る。ファブレス：企画・設計と販売（製造は外部へ委託）。OEM：製造だけ（相手先のブランドで作る）。SPA：企画から販売まで全部（自社ブランド専門店）。直販：製造から中間業者を飛ばして顧客へ直接。受注生産（MTO）：注文 → 生産の順（見込み生産との違いを時間軸の小さな図で）。
- 文字より分かる理由：どの段を自社で持つかが、同じ帯の塗り分けで比べられる。
- 使うカード（5）：DC-07-001（ファブレス経営）、DC-07-002（メイクトゥオーダー（MTO））、DC-07-003（直販（ダイレクトセル））、DC-07-004（OEM）、DC-07-007（SPA（製造小売））
- 使う問題（9）：D-07-001、D-07-002、D-07-012、D-07-013、D-07-015、D-12-002、D-12-006、D-12-012、D-07-030
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [経済産業省「2019年版ものづくり白書」第1部第2章第3節](https://www.meti.go.jp/report/whitepaper/mono/2019/honbun_pdf/pdf/honbun_01_02_03.pdf)（DC-07-001）
  - [DXビジネス検定 公式ページ シラバス（2026年2月改訂）](https://www.nextet.net/netkentei/dx-biz/)（DC-07-001、DC-07-004、DC-07-007）
  - [熊澤光正「トヨタ生産方式における生産管理の基礎」四日市大学論集 第30巻第2号（2018年）](https://www.jstage.jst.go.jp/article/jyu/30/2/30_69/_pdf)（DC-07-002）
  - [日本政策金融公庫総合研究所「中小企業の売る力を強化するDtoC」（日本公庫総研レポート No.2022-2、2022年3月）](https://www.jfc.go.jp/n/findings/pdf/soukenrepo_22_03_07.pdf)（DC-07-003）
  - [経済産業省「消費生活用製品安全法におけるOEM生産品・PB品の取扱いに関するガイドライン」（平成20年7月）](https://www.meti.go.jp/product_safety/producer/shouan/07_shouan_guideline_3.pdf)（DC-07-004）
  - [ジェトロ 貿易・投資相談Q&A「OEM生産とODM生産の違い」](https://www.jetro.go.jp/world/qa/04A-011247.html)（DC-07-004）
  - [日本繊維産業連盟「我が国繊維産業の現状」（産業構造審議会 繊維産業小委員会 資料7、令和3年11月22日）](https://www.meti.go.jp/shingikai/sankoshin/seizo_sangyo/textile_industry/pdf/001_07_00.pdf)（DC-07-007）

#### fig-dx-defense-offense-it　守りの IT（SoR）と攻めの IT（SoE）、ラン・ザ・ビジネスとバリューアップ

- 優先度：**B**　／　主な章：01 DXの基本
- 何を描くか：左右2列の対比。左「守り：社内の業務効率化・コスト削減・基盤の維持＝SoR」、右「攻め：顧客とつながり新しいビジネスを生む＝SoE」。下に IT 予算の帯グラフ「ラン・ザ・ビジネス 約8：バリューアップ 約2」（情報通信白書 令和元年版の紹介する調査）。
- 文字より分かる理由：2つの分類と予算の偏りが、対比の列と帯グラフで一度に分かる。
- 使うカード（3）：DC-01-004（攻めのIT経営（DX銘柄／攻めのIT経営銘柄））、DC-01-005（守りのIT投資）、DC-01-021（バリューアップ（サービスの創造・革新））
- 使う問題（5）：D-01-004、D-01-017、D-01-023、D-01-024、D-01-026
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [経済産業省「DX銘柄／攻めのIT経営銘柄」ページ（2026年版の掲載）](https://www.meti.go.jp/policy/it_policy/investment/keiei_meigara/dx_meigara.html)（DC-01-004）
  - [経済産業省「デジタルガバナンス・コード3.0」（2024年9月19日改訂）](https://www.meti.go.jp/policy/it_policy/investment/dgc/dgc3.0.pdf)（DC-01-004）
  - [総務省「令和元年版 情報通信白書」ICT投資の状況](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r01/html/nd112210.html)（DC-01-005、DC-01-021）
  - [経済産業省「DXレポート2.2（概要）」（2022年7月）](https://www.meti.go.jp/policy/it_policy/dx/002_05_00.pdf)（DC-01-021）

#### fig-dx-coop-compete　協調領域と競争領域（共通プラットフォーム）

- 優先度：**B**　／　主な章：01 DXの基本
- 何を描くか：複数の会社（A社・B社・C社）の縦の柱。下の部分（協調領域：業界共通の業務・システム）を横につないだ1枚の共通プラットフォームにし、上の部分（競争領域：自社の強み）は各社ばらばらの色。協調領域で浮いた投資が競争領域へ移る矢印。
- 文字より分かる理由：「どこを共有し、どこで競うか」が、柱の上下で一目で分かる。
- 使うカード（1）：DC-01-014（共通プラットフォーム推進（協調領域と競争領域））
- 使う問題（3）：D-01-010、D-11-010、D-01-030
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [経済産業省「DXレポート2（中間取りまとめ）」（2020年12月28日）4.3・5](https://www.meti.go.jp/press/2020/12/20201228004/20201228004-2.pdf)（DC-01-014）
  - [経済産業省「DX推進ガイドライン Ver.1.0」（2018年12月）](https://www.meti.go.jp/press/2018/12/20181212004/20181212004-1.pdf)（DC-01-014）

#### fig-dx-dgc　デジタルガバナンス・コード3.0（3つの視点・5つの柱）

- 優先度：**B**　／　主な章：01 DXの基本
- 何を描くか：上に横長の帯で3つの視点（①経営ビジョンとDX戦略の連動 ②As is－To be ギャップの定量把握・見直し ③企業文化への定着）。その下に5本の柱（1 経営ビジョン・ビジネスモデルの策定、2 DX戦略の策定、3 DX戦略の推進〔組織づくり／デジタル人材の育成・確保／ITシステム・サイバーセキュリティ〕、4 成果指標の設定・DX戦略の見直し、5 ステークホルダーとの対話）。土台に「基本的事項＝DX認定の基準、望ましい方向性＝DX銘柄・DXセレクションの評価基準」。
- 文字より分かる理由：視点と柱の2層構造と、柱3の中の3項目が、建物の図で位置として覚えられる。
- 使うカード（6）：DC-01-023（デジタルガバナンス・コード3.0（3つの視点・5つの柱））、DC-01-025（経営ビジョンとDX戦略の連動（デジタルガバナンス・コード3.0））、DC-01-026（ステークホルダーとの対話（デジタルガバナンス・コード3.0））、DC-02-037（デジタルガバナンス・コード（ITシステム・サイバーセキュリティの柱））、DC-01-006（DX推進のための経営のあり方、仕組み）、DC-01-007（全社的なITシステムの構築体制と全社的ITガバナンス）
- 使う問題（8）：D-01-016、D-01-020、D-01-027、D-01-028、D-01-037、D-01-038、D-01-005、D-01-025
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [経済産業省「デジタルガバナンス・コード3.0」（2020年11月9日策定・2024年9月19日改訂）](https://www.meti.go.jp/policy/it_policy/investment/dgc/dgc3.0.pdf)（DC-01-023、DC-01-025、DC-01-026、DC-02-037）
  - [経済産業省「DX推進ガイドライン Ver.1.0」（2018年12月）](https://www.meti.go.jp/press/2018/12/20181212004/20181212004-1.pdf)（DC-01-006、DC-01-007）

#### fig-dx-dss　デジタルスキル標準（DX リテラシー標準と DX 推進スキル標準）

- 優先度：**B**　／　主な章：01 DXの基本
- 何を描くか：左右2つの箱。左：DX リテラシー標準（全てのビジネスパーソン）＝Why（背景）・What（データ・技術）・How（利活用）・マインド・スタンスの4つの区画、2023年8月の生成AI補記を付箋で。右：DX 推進スキル標準（推進する専門人材）＝類型（ビジネスアーキテクト・デザイナー・データサイエンティスト・ソフトウェアエンジニア・サイバーセキュリティ …）→ ロール、と共通スキルリスト。類型どうしは上下でなく横の矢印でつながる。
- 文字より分かる理由：「全員向け」と「専門人材向け」の2つの標準の中身が、並んだ箱で区別できる。
- 使うカード（4）：DC-01-019（DSS-L（DXリテラシー標準／デジタルスキル標準））、DC-01-020（DSS-P（DX推進スキル標準））、DC-01-028（生成AI補記（生成AI利用において求められるマインド・スタンス））、DC-01-018（DX人材の確保）
- 使う問題（6）：D-01-013、D-01-032、D-01-033、D-01-014、D-01-035、D-01-034
- 描く前に確かめること：類型の数と名前は版で変わる（ver.2.0 で6類型とカードにある）。描く前に出典の版を確かめ、図に版を書く。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [IPA「デジタルスキル標準 ver.2.0」（2026年4月）](https://www.ipa.go.jp/jinzai/skill-standard/dss/rcu1hd000000j76k-att/dss_ver2.0.pdf)（DC-01-019、DC-01-020、DC-01-028）
  - [IPA「DX推進スキル標準（DSS-P）概要」ページ](https://www.ipa.go.jp/jinzai/skill-standard/dss/about_dss-p.html)（DC-01-020）
  - [経済産業省「DXレポート2（中間取りまとめ）」（2020年12月28日）](https://www.meti.go.jp/press/2020/12/20201228004/20201228004-2.pdf)（DC-01-018）
  - [経済産業省「デジタルガバナンス・コード3.0」（2024年9月19日改訂）](https://www.meti.go.jp/policy/it_policy/investment/dgc/dgc3.0.pdf)（DC-01-018）

#### fig-dx-network-compare　5G と LPWA の特長の違い

- 優先度：**B**　／　主な章：02 デジタル技術
- 何を描くか：3つの軸（通信速度・消費電力の少なさ・届く距離）のレーダー図または3本の棒の比較。5G：超高速・大容量、超低遅延、多数同時接続の3つの特長を吹き出しで。LPWA：速度は数kbps〜数百kbpsと遅いが、電池で数年〜数十年、数km〜数十km。用途の例（5G＝高精細映像・遠隔操作、LPWA＝水道設備の見守り）。
- 文字より分かる理由：「速さ」か「電池と距離」かの違いが、軸の比較で一目で分かる。
- 使うカード（2）：DC-02-001（5G（第5世代移動通信システム））、DC-02-002（LPWA（Low Power Wide Area））
- 使う問題（2）：D-02-001、D-02-002
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「令和2年版 情報通信白書」5G時代に向けての各レイヤーの動向](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r02/html/nd114220.html)（DC-02-001）
  - [総務省「平成29年版 情報通信白書」第3章第3節（LPWA）](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h29/pdf/n3300000.pdf)（DC-02-002）

#### fig-dx-edge-cloud-iot　IoT・エッジコンピューティング・クラウドの位置関係

- 優先度：**B**　／　主な章：02 デジタル技術
- 何を描くか：3層の図。下＝モノ（センサー・カメラ・RFタグ・GPS）、中＝エッジ（利用者や機器の近くのサーバー）、上＝クラウド（遠くのデータセンター）。下から上へデータの矢印、エッジの横に「遅延が小さい・通信量を減らせる」。M2M は「モノどうしが人を介さずにやり取り」と横の矢印で。
- 文字より分かる理由：どこで処理するかの位置関係が、層の図で直感的に分かる。
- 使うカード（3）：DC-02-003（エッジコンピューティング）、DC-02-004（IoTとM2M）、DC-02-005（RFIDとGPS）
- 使う問題（4）：D-02-002、D-02-003、D-02-022、D-02-023
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「令和7年版 情報通信白書」エッジコンピューティング](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r07/html/nd218300.html)（DC-02-003）
  - [総務省「令和2年版 情報通信白書」5G時代に向けての各レイヤーの動向](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r02/html/nd114220.html)（DC-02-003）
  - [総務省「平成27年版 情報通信白書」ユビキタスからIoTへ](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h27/html/nc254110.html)（DC-02-004）
  - [総務省 北陸総合通信局「RFIDについて」](https://www.soumu.go.jp/soutsu/hokuriku/denpa/about_rfid.html)（DC-02-005）
  - [内閣府 みちびき（準天頂衛星システム）「なぜ準天頂衛星システムが必要なのか」](https://qzss.go.jp/overview/services/sv02_why.html)（DC-02-005）
  - [総務省「平成25年版 情報通信白書」ビッグデータの概念](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h25/html/nc113110.html)（DC-02-005）

#### fig-dx-cloud-models　オンプレミスとクラウド（ハイブリッド・マルチクラウド）

- 優先度：**B**　／　主な章：02 デジタル技術
- 何を描くか：左：オンプレミス（自社のデータセンター）とパブリッククラウドを線でつないだ「ハイブリッドクラウド」。右：複数のパブリッククラウドを組み合わせた「マルチクラウド」。下に「オンプレ：自社で持つ／クラウド：必要な時に必要な分だけ」の1行。
- 文字より分かる理由：似た2つの組み合わせ方が、何と何をつなぐかで一目で区別できる。
- 使うカード（1）：DC-02-009（サーバーのクラウド化とオンプレミス）
- 使う問題（2）：D-02-006、D-02-025
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [IPA「DX白書2023」第5部 クラウド](https://www.ipa.go.jp/publish/wp-dx/gmcbt8000000botk-att/000108041.pdf)（DC-02-009）

#### fig-dx-microservices　モノリシックな構成とマイクロサービス

- 優先度：**B**　／　主な章：02 デジタル技術
- 何を描くか：左：1つの大きな箱の中に機能がすべて詰まり、1か所の変更が全体に及ぶ。右：小さな独立した箱（会員・決済・在庫…）が API の線でつながり、1つだけを入れ替えられる。
- 文字より分かる理由：「分けて API でつなぐ」意味が、箱の分かれ方で分かる。
- 使うカード（2）：DC-02-008（マイクロサービスとAPI）、DC-02-006（通信プロトコル）
- 使う問題（3）：D-02-005、D-02-026、D-02-021
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [IPA「DX白書2023」第5部 マイクロサービスアーキテクチャー/API](https://www.ipa.go.jp/publish/wp-dx/gmcbt8000000botk-att/000108041.pdf)（DC-02-008）
  - [総務省「国民のためのサイバーセキュリティサイト」用語集（は行）](https://www.soumu.go.jp/main_sosiki/cybersecurity/kokumin/glossary/ja_06/)（DC-02-006）

#### fig-dx-agile　ウォーターフォールとアジャイル（スクラム）

- 優先度：**B**　／　主な章：02 デジタル技術
- 何を描くか：上：要件定義→設計→実装→テスト→リリースの階段（最後まで動くものが無い）。下：短い期間の輪（計画→開発→確認）を何周も回し、周ごとに動く小さな製品が増える。
- 文字より分かる理由：一度に作るか、小さく繰り返すかが、階段と輪の形で対比できる。
- 使うカード（1）：DC-02-007（アジャイル開発）
- 使う問題（1）：D-02-004
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [IPA「DX白書2023」第5部（ITシステム開発手法・技術）](https://www.ipa.go.jp/publish/wp-dx/gmcbt8000000botk-att/000108041.pdf)（DC-02-007）
  - [経済産業省「DXレポート2（中間取りまとめ）」（2020年12月28日）](https://www.meti.go.jp/press/2020/12/20201228004/20201228004-2.pdf)（DC-02-007）

#### fig-dx-ai-ml-dl　AI・機械学習・ディープラーニングの関係

- 優先度：**B**　／　主な章：02 デジタル技術
- 何を描くか：入れ子の3つの楕円（外から AI、機械学習、ディープラーニング）。各楕円に1行の説明。G検定の fig-g-ai-ml-dl と同じ形でよい（共用できるならする）。
- 文字より分かる理由：包含関係は入れ子の図が最も誤解がない。
- 使うカード（2）：DC-02-011（AI（人工知能））、DC-02-012（機械学習とディープラーニング）
- 使う問題（2）：D-02-007、D-02-028
- 描く前に確かめること：資格をまたいで1枚を共用できるかは、データの形（§7）次第。共用できなければ別に描く。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「平成28年版 情報通信白書」人工知能（AI）とは](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h28/html/nc142110.html)（DC-02-011）
  - [総務省「令和元年版 情報通信白書」AIに関する基本的な仕組み](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r01/html/nd113210.html)（DC-02-012）
  - [総務省「平成28年版 情報通信白書」ICTの進化](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h28/html/nc111210.html)（DC-02-012）

#### fig-dx-rag　RAG（検索拡張生成）の流れ

- 優先度：**B**　／　主な章：02 デジタル技術
- 何を描くか：利用者の質問 → ①社内文書・データベースを検索 → ②見つかった文書の一部を質問と一緒に生成 AI へ → ③根拠を参照した回答。検索を使わない場合（学習した知識だけで答える）を点線の別経路で比較。
- 文字より分かる理由：「答える前に調べる」順番が、番号つきの流れで分かる。
- 使うカード（2）：DC-02-019（RAG（Retrieval-Augmented Generation：検索拡張生成））、DC-02-017（生成AI）
- 使う問題（1）：D-02-010
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Lewis ほか「Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks」（arXiv:2005.11401, 2020）](https://arxiv.org/abs/2005.11401)（DC-02-019）
  - [総務省「令和7年版 情報通信白書」AI技術](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r07/html/nd227300.html)（DC-02-017）
  - [IPA「デジタルスキル標準 ver.2.0」（2026年4月）](https://www.ipa.go.jp/jinzai/skill-standard/dss/rcu1hd000000j76k-att/dss_ver2.0.pdf)（DC-02-017）

#### fig-dx-blockchain　ブロックチェーン（ブロックの鎖と分散した台帳）

- 優先度：**B**　／　主な章：02 デジタル技術
- 何を描くか：左：取引の記録を入れたブロックが、前のブロックの要約値（ハッシュ）を持って鎖状につながる。1つを書き換えると後ろのブロックとの整合が崩れる（×印）。右：同じ台帳を参加者全員が持ち合う P2P の網。
- 文字より分かる理由：「改ざんしにくい」理由が、鎖のつながりと台帳の複製で見える。
- 使うカード（1）：DC-02-024（ブロックチェーン）
- 使う問題（1）：D-02-015
- 描く前に確かめること：ハッシュの語がカードの出典にあるかを確かめる。無ければ「前のブロックの情報」と書く。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「令和4年版 情報通信白書」仮想空間市場など](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r04/html/nd236a00.html)（DC-02-024）

#### fig-dx-vr-ar-mr　VR・AR・MR の違い

- 優先度：**B**　／　主な章：02 デジタル技術
- 何を描くか：横一本の帯の左端「現実」、右端「仮想」。AR：現実の風景に CG を重ねる（現実寄り）、MR：仮想の物体を現実の空間に置いて手で操作する（中間）、VR：全部が CG の仮想空間（仮想寄り）。各位置に小さな絵。
- 文字より分かる理由：3つの技術が現実と仮想のどちら寄りかが、帯の上の位置で区別できる。
- 使うカード（2）：DC-02-025（VR（仮想現実）・AR（拡張現実）・MR（複合現実））、DC-03-023（デジタルツイン）
- 使う問題（1）：D-02-034
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「令和元年版 情報通信白書」レイヤー別にみる市場動向（AR/VR）](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r01/html/nd112130.html)（DC-02-025）
  - [総務省「社会課題の解決に向けた没入型技術導入の手引き2026」（令和8年7月）](https://www.soumu.go.jp/main_content/001080024.pdf)（DC-02-025）
  - [IPA「DX白書2023」第5部 データ利活用技術](https://www.ipa.go.jp/publish/wp-dx/gmcbt8000000botk-att/000108041.pdf)（DC-03-023）

#### fig-dx-zero-trust　境界型セキュリティとゼロトラスト

- 優先度：**B**　／　主な章：02 デジタル技術
- 何を描くか：左：城壁で囲んだ社内ネットワーク（内側は信用、門番は入口だけ）。右：社内・社外・クラウドの区別なく、アクセスのたびに本人・端末・権限を確かめる関所が各システムの前にある。注記「境界型を否定するものではない」（デジタル庁）。
- 文字より分かる理由：「入口だけ確かめる」か「毎回確かめる」かが、関所の位置で分かる。
- 使うカード（1）：DC-02-032（ゼロトラスト）
- 使う問題（3）：D-02-017、D-02-039、D-02-037
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [デジタル庁「ゼロトラストアーキテクチャ適用方針」（2022年6月30日）](https://www.digital.go.jp/assets/contents/node/basic_page/field_ref_resources/e2a06143-ed29-4f1d-9c31-0f06fca67afc/5efa5c3b/20220630_resources_standard_guidelines_guidelines_04.pdf)（DC-02-032）

#### fig-dx-cia　情報セキュリティの3要素（機密性・完全性・可用性）と ISMS

- 優先度：**B**　／　主な章：02 デジタル技術
- 何を描くか：三角形の頂点に3要素。機密性＝許可されていない人に見せない、完全性＝正確で欠けがない、可用性＝認められた人が必要なときに使える。それぞれに侵害の例（漏えい／改ざん／システム停止）。中央に ISMS の計画→運用→点検→改善の輪。
- 文字より分かる理由：3つの要素の違いが、侵害の例と対にすると覚えやすい。
- 使うカード（2）：DC-02-035（ISMS（情報セキュリティマネジメントシステム））、DC-02-036（サイバーリスクマネジメント）
- 使う問題（2）：D-02-018、D-02-019
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [JIPDEC（ISMS-AC）「ISMS適合性評価制度の概要」パンフレット](https://isms.jp/doc/ismspanf.pdf)（DC-02-035）
  - [IPA「サイバーセキュリティ経営ガイドラインVer3.0実践のためのプラクティス集 第4版」](https://www.ipa.go.jp/security/economics/hjuojm00000044dc-att/cms_practice_v4_1.pdf)（DC-02-036）
  - [経済産業省「デジタルガバナンス・コード3.0」（2024年9月19日改訂）](https://www.meti.go.jp/policy/it_policy/investment/dgc/dgc3.0.pdf)（DC-02-036）

#### fig-dx-join　データの結合（JOIN）

- 優先度：**B**　／　主な章：03 データと分析
- 何を描くか：左に「購買履歴」の表（顧客ID・商品・金額）、右に「顧客台帳」の表（顧客ID・氏名・年代）。顧客ID の列を線で結び、横につないだ1つの表を下に描く。グルーピング（項目で分けて合計）との違いを小さな図で添える。
- 文字より分かる理由：「共通の列で横につなぐ」操作が、表の図で誤解なく分かる。
- 使うカード（2）：DC-03-008（データの結合（JOIN））、DC-03-007（RDB・SQL・NoSQL）
- 使う問題（3）：D-03-007、D-03-031、D-03-021
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [PostgreSQL 16 文書「2.6. テーブル間を結合」](https://www.postgresql.jp/document/16/html/tutorial-join.html)（DC-03-008）
  - [総務省 情報通信審議会ICT基本戦略ボード「ビッグデータの活用の在り方について」（2012年5月17日）](https://www.soumu.go.jp/main_content/000160628.pdf)（DC-03-007）

#### fig-dx-correlation　相関と疑似相関

- 優先度：**B**　／　主な章：03 データと分析
- 何を描くか：左：散布図3枚（正の相関・相関なし・負の相関）。右：因果の矢印図。気温 → アイスの売上、気温 → 熱中症の搬送数、アイスの売上 ⇢ 搬送数 は点線で「相関はあるが因果ではない」。
- 文字より分かる理由：「相関がある＝原因」ではないことが、第3の変数の矢印で見える。
- 使うカード（2）：DC-03-018（相関分析と疑似相関）、DC-03-015（データ可視化）
- 使う問題（3）：D-03-010、D-03-011、D-03-027
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省統計局 統計データ利活用センター「Data StaRt」キーワード編](https://www.stat.go.jp/dstart/point/keyword/)（DC-03-018、DC-03-015）
  - [総務省統計局「なるほど統計学園」複数の変数の関係性を見る](https://www.stat.go.jp/naruhodo/10_tokucho/hukusu.html)（DC-03-018）
  - [総務省統計局「事例から学ぶビジネスパーソン向け統計データ利活用セミナー」受講者からの質問事項及び講師の回答](https://www.stat.go.jp/rikatsuyou/pdf/2025_qa.pdf)（DC-03-018）
  - [総務省統計局「なるほど統計学園」散布図](https://www.stat.go.jp/naruhodo/9_graph/jyokyu/sanpu.html)（DC-03-015）

#### fig-dx-analysis-methods　分析手法の違い（回帰・バスケット分析・クラスタリング・グルーピング）

- 優先度：**B**　／　主な章：03 データと分析
- 何を描くか：4コマ。回帰分析：散布図に直線、説明変数→目的変数の矢印。バスケット分析：レシート3枚から「パスタとパスタソースが一緒に買われる」の組み合わせを数える。クラスタリング：ラベルの無い点が自動でまとまる。グルーピング：人が決めた項目（店舗・年代）で表を区切って合計。
- 文字より分かる理由：名前の似た手法の違いが、同じ大きさのコマで並べると対比できる。
- 使うカード（4）：DC-03-022（回帰分析）、DC-03-019（バスケット分析）、DC-03-020（データのクラスタリングとグルーピング）、DC-03-012（データマイニング）
- 使う問題（6）：D-03-012、D-03-013、D-03-014、D-03-030、D-03-028、D-03-031
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省統計局 統計データ利活用センター「Data StaRt」キーワード（回帰分析）](https://www.stat.go.jp/dstart/point/keyword/)（DC-03-022）
  - [Microsoft Learn「Microsoft アソシエーション アルゴリズム」](https://learn.microsoft.com/ja-jp/analysis-services/data-mining/microsoft-association-algorithm?view=asallproducts-allversions)（DC-03-019）
  - [Microsoft Learn「Microsoft クラスタリング アルゴリズム」](https://learn.microsoft.com/ja-jp/analysis-services/data-mining/microsoft-clustering-algorithm?view=asallproducts-allversions)（DC-03-020）
  - [AWS「データマイニングとは何ですか?」](https://aws.amazon.com/jp/what-is/data-mining/)（DC-03-020、DC-03-012）
  - [PostgreSQL 16 文書「2.7. 集約関数」](https://www.postgresql.jp/document/16/html/tutorial-agg.html)（DC-03-020）
  - [総務省 情報通信審議会ICT基本戦略ボード「ビッグデータの活用の在り方について」（2012年5月17日）](https://www.soumu.go.jp/main_content/000160628.pdf)（DC-03-012）

#### fig-dx-ppdac　PPDAC サイクル

- 優先度：**B**　／　主な章：03 データと分析
- 何を描くか：5つの箱を円に並べる：Problem（問題）→ Plan（計画）→ Data（データ）→ Analysis（分析）→ Conclusion（結論）→ 次の Problem へ。Problem に「データを集める前に何を解くかを決める」。
- 文字より分かる理由：順番と、最初が「問題」であることが、輪で覚えられる。
- 使うカード（2）：DC-03-024（PPDACサイクル）、DC-03-001（データサイエンス）
- 使う問題（1）：D-03-016
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省統計局 統計データ利活用センター「Data StaRt」キーワード編](https://www.stat.go.jp/dstart/point/keyword/)（DC-03-024、DC-03-001）
  - [総務省統計局「Data StaRt」EBPM活用塾 ゼミナール編（1）A（analysis、分析）](https://www.stat.go.jp/dstart/point/seminar1/05.html)（DC-03-024）
  - [AWS「データサイエンスとは?」](https://aws.amazon.com/jp/what-is/data-science/)（DC-03-001）
  - [IPA「デジタルスキル標準 ver.2.0」](https://www.ipa.go.jp/jinzai/skill-standard/dss/rcu1hd000000j76k-att/dss_ver2.0.pdf)（DC-03-001）

#### fig-dx-digital-twin　デジタルツインとシミュレーション

- 優先度：**B**　／　主な章：03 データと分析
- 何を描くか：左に物理空間の工場（設備・ライン）、右にサイバー空間の双子。物理→サイバーに「IoT センサーのデータ」、サイバーの中で「条件を変えて試す（シミュレーション）」、サイバー→物理に「よい案だけを実行」。
- 文字より分かる理由：物理とサイバーを行き来する流れが、双子の図で一目で分かる。
- 使うカード（2）：DC-03-023（デジタルツイン）、DC-03-021（データ分析の自動化とシミュレーション）
- 使う問題（1）：D-03-026
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [IPA「DX白書2023」第5部 データ利活用技術](https://www.ipa.go.jp/publish/wp-dx/gmcbt8000000botk-att/000108041.pdf)（DC-03-023、DC-03-021）
  - [AWS「ビジネスインテリジェンス (BI) とは何ですか?」](https://aws.amazon.com/jp/what-is/business-intelligence/)（DC-03-021）

#### fig-dx-customer-journey　ペルソナとカスタマージャーニー

- 優先度：**B**　／　主な章：04 マーケティング
- 何を描くか：左にペルソナのカード（名前・年齢・状況・したいこと）。右に横長の表：段階（知る→興味→比較→購入→利用→推奨）× 行（接点・行動・気持ち）。気持ちの行は上下する線（不満の谷を強調）。現状のジャーニーマップと、あるべき姿のジャーニーマップの2種類がある、と注記。
- 文字より分かる理由：段階・接点・気持ちの3つを同時に見る表の形そのものが理解の助けになる。
- 使うカード（2）：DC-04-003（ペルソナ）、DC-04-004（カスタマージャーニー）
- 使う問題（3）：D-04-003、D-04-014、D-04-015
- 描く前に確かめること：2種類のジャーニーマップの呼び名は e-Gov のサービスデザインの出典の語に合わせる。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [e-Govポータル「サービスデザイン」](https://www.e-gov.go.jp/about-site/e-gov/servicedesign.html)（DC-04-003、DC-04-004）
  - [観光庁「観光地域づくり法人（DMO）による観光地域マーケティングガイドブック」](https://www.mlit.go.jp/kankocho/content/001580600.pdf)（DC-04-004）

#### fig-dx-segment-one2one　マス・セグメント・ワントゥワン・パーソナライゼーション

- 優先度：**B**　／　主な章：04 マーケティング
- 何を描くか：人の点を同じ配置で3つ描く。マス：全員に同じ矢印。セグメント：年齢・地域などで3つの群に囲み、群ごとに違う矢印。ワントゥワン：一人ひとりに違う矢印。
- 文字より分かる理由：「誰にまとめて届けるか」の粒度の違いが、囲み方で一目で分かる。
- 使うカード（3）：DC-04-002（セグメントマーケティング）、DC-04-025（ワントゥワンマーケティング）、DC-06-021（パーソナライゼーション）
- 使う問題（3）：D-04-005、D-04-018、D-06-028
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [観光庁「観光地域づくり法人（DMO）による観光地域マーケティングガイドブック」](https://www.mlit.go.jp/kankocho/content/001580600.pdf)（DC-04-002、DC-04-025）
  - [AWS ドキュメント「Amazon Personalize とは」](https://docs.aws.amazon.com/ja_jp/personalize/latest/dg/what-is-personalize.html)（DC-06-021）

#### fig-dx-lead　リードジェネレーションとリードナーチャリング

- 優先度：**B**　／　主な章：04 マーケティング
- 何を描くか：じょうご（ファネル）の図。上：展示会・資料ダウンロードで見込み客の連絡先を集める（ジェネレーション）。中：事例・使い方のメールで関心を育てる（ナーチャリング）。下：関心の高い人を営業へ渡す。
- 文字より分かる理由：2つの言葉が、じょうごのどの段の仕事かで区別できる。
- 使うカード（1）：DC-04-013（リードジェネレーションとリードナーチャリング）
- 使う問題（1）：D-04-006
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [セールスフォース・ジャパン「リードジェネレーションとは？意味や役割、代表的な9つの手法を解説」](https://www.salesforce.com/jp/marketing/lead-generation-guide/)（DC-04-013）

#### fig-dx-ab-test　A/B テスト

- 優先度：**B**　／　主な章：04 マーケティング
- 何を描くか：訪問者の列をランダムに2つに分け、ボタンの色だけが違う A 案と B 案を見せる。それぞれの購入率の棒を比べ、高い方を採用。「1か所だけ変える」「ランダムに振り分ける」の2つの条件を吹き出しで。
- 文字より分かる理由：比べ方の条件（1か所だけ・ランダム）が、図の形で守られていることが分かる。
- 使うカード（2）：DC-04-023（ABテスト）、DC-04-024（アクセス解析）
- 使う問題（2）：D-04-011、D-04-030
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [アナリティクス ヘルプ「[GA4] A/B テスト」](https://support.google.com/analytics/answer/13468470?hl=ja)（DC-04-023）
  - [Adobe Experience League「A/B テストの概要」（Adobe Target）](https://experienceleague.adobe.com/ja/docs/target/using/activities/abtest/test-ab)（DC-04-023）
  - [アナリティクス ヘルプ「Google アナリティクスの仕組み」](https://support.google.com/analytics/answer/12159447?hl=ja)（DC-04-024）

#### fig-dx-lean-startup　リーンスタートアップ（MVP を作って学ぶ）

- 優先度：**B**　／　主な章：05 消費者の状況とビジネス環境
- 何を描くか：輪：作る（必要最小限の製品＝MVP）→ 測る（顧客の反応）→ 学ぶ → 作り直す／方向転換。比較として「最初から完璧に作り込む」長い一本道を薄く。
- 文字より分かる理由：小さく作って学ぶ繰り返しが、輪と一本道の対比で分かる。
- 使うカード（2）：DC-05-021（リーンスタートアップ）、DC-02-007（アジャイル開発）
- 使う問題（2）：D-05-009、D-05-030
- 描く前に確かめること：「作る→測る→学ぶ」の語がカードの出典にあるかを確かめる。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [中小企業基盤整備機構「2022 日本のスタートアップエコシステム研究報告書」](https://www.smrj.go.jp/research_case/knowledge/fbrion0000002pv0-att/a1666247139726-2.pdf)（DC-05-021）
  - [内閣官房 IT総合戦略室「アジャイル開発実践ガイドブック」（2021年3月、デジタル庁 標準ガイドライン群）](https://www.digital.go.jp/assets/contents/node/basic_page/field_ref_resources/e2a06143-ed29-4f1d-9c31-0f06fca67afc/150a60b4/20220422_resources_standard_guidelines_guidebook_01.pdf)（DC-05-021）
  - [IPA「DX白書2023」第5部（ITシステム開発手法・技術）](https://www.ipa.go.jp/publish/wp-dx/gmcbt8000000botk-att/000108041.pdf)（DC-02-007）
  - [経済産業省「DXレポート2（中間取りまとめ）」（2020年12月28日）](https://www.meti.go.jp/press/2020/12/20201228004/20201228004-2.pdf)（DC-02-007）

#### fig-dx-design-thinking　デザイン思考の5つのステージ

- 優先度：**B**　／　主な章：05 消費者の状況とビジネス環境
- 何を描くか：5つの箱（共感→問題定義→創造→プロトタイプ→テスト）を横に並べ、テストから前の段へ戻る矢印を複数。各箱に1行。
- 文字より分かる理由：順番と「行き来しながら進む」ことが、戻り矢印で分かる。
- 使うカード（2）：DC-05-024（デザイン思考）、DC-04-003（ペルソナ）
- 使う問題（2）：D-05-010、D-05-029
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [IPA「DX白書2021」第4部 DXを支える手法と技術](https://www.ipa.go.jp/publish/wp-dx/qv6pgp0000000txx-att/000093702.pdf)（DC-05-024）
  - [e-Govポータル「サービスデザイン」](https://www.e-gov.go.jp/about-site/e-gov/servicedesign.html)（DC-04-003）

#### fig-dx-servitization　モノのサービス化（売り切りから稼働保証へ）

- 優先度：**B**　／　主な章：06 戦略モデル
- 何を描くか：左：売り切り。メーカー → 機械 → 顧客、お金は1回。右：稼働保証。メーカーが IoT で稼働を遠隔監視し、故障の前に部品を交換、「止まらずに動いた時間」に応じて継続的にお金が入る。アズアサービスは「所有させず、必要な分を使わせる」と注記。
- 文字より分かる理由：お金の入り方（1回か継続か）と、データの流れが、2枚の対比で分かる。
- 使うカード（3）：DC-06-019（サービス化）、DC-06-020（アズアサービス）、DC-06-022（稼働保証モデル）
- 使う問題（5）：D-06-009、D-06-010、D-06-025、D-06-026、D-06-027
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [経済産業省「2020年版ものづくり白書」第1部第1章第2節 不確実性の高まる世界の現状と競争力強化](https://www.meti.go.jp/report/whitepaper/mono/2020/honbun_html/honbun/101021_2.html)（DC-06-019、DC-06-022）
  - [IPA「DX白書2023」](https://www.ipa.go.jp/publish/wp-dx/gmcbt8000000botk-att/000108041.pdf)（DC-06-020）
  - [国土交通省「日本版MaaSの推進」](https://www.mlit.go.jp/sogoseisaku/japanmaas/promotion/)（DC-06-020）
  - [経済産業省 製造産業局「我が国航空機産業の今後の方向性について」（2024年3月27日）](https://www.meti.go.jp/shingikai/sankoshin/seizo_sangyo/kokuki_uchu/pdf/2023_001_02_00.pdf)（DC-06-022）

#### fig-dx-franchise-voluntary　フランチャイズとボランタリーチェーン

- 優先度：**B**　／　主な章：07 オペレーションモデル
- 何を描くか：左：フランチャイズ。本部が上、加盟店が下。本部→加盟店に「商標の使用・指導・援助」、加盟店→本部に「対価」。右：ボランタリーチェーン。独立した店どうしが横に並び、共同の組織（仕入れ・販促）を真ん中に作る。各店は自分の店名を保つ。
- 文字より分かる理由：縦の関係か横の関係かが、図の向きで一目で分かる。
- 使うカード（2）：DC-07-009（フランチャイズ）、DC-07-016（ボランタリーチェーン）
- 使う問題（3）：D-07-004、D-07-017、D-07-018
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [公正取引委員会「フランチャイズ・システムに関する独占禁止法上の考え方」](https://www.jftc.go.jp/dk/guideline/unyoukijun/franchise.html)（DC-07-009）
  - [公正取引委員会「食品分野におけるプライベート・ブランド商品の取引に関する実態調査報告書」（平成26年6月20日）](https://www.jftc.go.jp/houdou/pressrelease/h26/jun/140620.html)（DC-07-016）
  - [DXビジネス検定 公式ページ シラバス（2026年2月改訂）](https://www.nextet.net/netkentei/dx-biz/)（DC-07-016）

#### fig-dx-affiliate　アフィリエイトのお金の流れ

- 優先度：**B**　／　主な章：07 オペレーションモデル
- 何を描くか：広告主・アフィリエイター（ブログ）・閲覧者の3者。閲覧者がブログのリンクから購入 → 広告主が成果に応じて報酬をアフィリエイターへ。注記「広告であることを表示する（ステルスマーケティング規制）」。成果報酬型の一例として。
- 文字より分かる理由：誰が誰にいつ払うかが、3者の矢印で分かる。
- 使うカード（2）：DC-07-008（アフィリエイト）、DC-08-005（成果報酬）
- 使う問題（4）：D-07-005、D-07-019、D-07-020、D-08-018
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [消費者庁「インターネット消費者取引に係る広告表示に関する景品表示法上の問題点及び留意事項」](https://www.caa.go.jp/policies/policy/representation/fair_labeling/guideline/assets/representation_cms216_220629_07.pdf)（DC-07-008、DC-08-005）

#### fig-dx-upsell-crosssell　アップセルとクロスセル

- 優先度：**B**　／　主な章：07 オペレーションモデル
- 何を描くか：中央に検討中の商品（ノートパソコン）。上向きの矢印で上位機種（アップセル：より高いものへ）。横向きの矢印でマウス・保護ケース（クロスセル：関連品を一緒に）。
- 文字より分かる理由：「上へ」か「横へ」かの矢印の向きで、2つを取り違えなくなる。
- 使うカード（1）：DC-07-012（アップセルとクロスセル）
- 使う問題（3）：D-07-006、D-07-022、D-07-023
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [観光庁「観光地域づくり法人（DMO）による観光地域マーケティングガイドブック」](https://www.mlit.go.jp/kankocho/content/001580600.pdf)（DC-07-012）

#### fig-dx-customer-lifecycle　顧客ライフサイクルマネジメント

- 優先度：**B**　／　主な章：07 オペレーションモデル
- 何を描くか：横に段階（知る→初回購入→継続利用→追加購入→離反または推奨）。各段階の下に働きかけの例（広告／初回特典／使い方の案内／アップセル・クロスセル／引き止め・紹介）。
- 文字より分かる理由：段階ごとに働きかけを変える考え方が、段と例の対応で分かる。
- 使うカード（2）：DC-07-010（顧客ライフサイクルマネジメント）、DC-07-011（顧客データ活用）
- 使う問題（3）：D-07-007、D-07-024、D-07-021
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [観光庁「観光地域づくり法人（DMO）による観光地域マーケティングガイドブック」](https://www.mlit.go.jp/kankocho/content/001580600.pdf)（DC-07-010、DC-07-011）
  - [セールスフォース・ジャパン「LTV（Life Time Value：顧客生涯価値）とは」](https://www.salesforce.com/jp/marketing/what-is-life-time-value/)（DC-07-010）
  - [e-Gov法令検索「個人情報の保護に関する法律」第17条・第21条](https://laws.e-gov.go.jp/law/415AC0000000057)（DC-07-011）
  - [DXビジネス検定 公式ページ シラバス（2026年2月改訂）](https://www.nextet.net/netkentei/dx-biz/)（DC-07-011）

#### fig-dx-lockin　ロックインの7つの型

- 優先度：**B**　／　主な章：07 オペレーションモデル
- 何を描くか：中央に「スイッチング・コスト（乗り換えにかかるコスト）」、周りに7つの型を円形に配置：インティマシー（親密な関係）、コンビニエンス（便利さ・登録済みの情報）、ラーニング（覚えた使い方）、メンバーシップ（会員特典）、コミュニティ（利用者どうしのつながり）、シリーズ（同じシリーズの連携）、ブランド（信頼と愛着）。各型に例を1つ。
- 文字より分かる理由：7つの型が「何が乗り換えを重くするか」の違いとして一枚に並び、例と結びつく。
- 使うカード（9）：DC-07-013（ロックイン（7つの型））、DC-07-014（インティマシーロックイン）、DC-07-015（コンビニエンスロックイン）、DC-07-017（ラーニングロックイン）、DC-07-018（メンバーシップロックイン）、DC-07-019（コミュニティロックイン）、DC-07-020（シリーズロックイン）、DC-07-021（ブランドロックイン）、DC-07-022（スイッチング・コスト）
- 使う問題（8）：D-07-008、D-07-009、D-07-010、D-07-025、D-07-026、D-07-027、D-07-028、D-07-029
- 注意：次のカードは status が verified でない → DC-07-014、DC-07-019、DC-07-021
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「平成18年版 情報通信白書」コラム ソフトウェアのネットワーク効果とロックイン効果](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h18/html/i1454000.html)（DC-07-013、DC-07-022）
  - [公正取引委員会 競争政策研究センター共同研究「ネットワーク外部性とスイッチングコストの経済分析」（2005年11月）](https://www.jftc.go.jp/cprc/reports/index_files/cr-0605.pdf)（DC-07-013、DC-07-015、DC-07-017、DC-07-018、DC-07-020、DC-07-022）
  - [総務省「令和7年版 情報通信白書」プラットフォーム事業者の成長とその背景](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r07/html/nd113110.html)（DC-07-013）
  - [DXビジネス検定 公式ページ シラバス（2026年2月改訂）](https://www.nextet.net/netkentei/dx-biz/)（DC-07-013、DC-07-014、DC-07-015、DC-07-017、DC-07-018、DC-07-019、DC-07-020、DC-07-021）
  - [公正取引委員会 競争政策研究センター「データと競争政策に関する検討会 報告書」（平成29年6月6日）](https://www.jftc.go.jp/cprc/conference/index_files/170606data01.pdf)（DC-07-022）

#### fig-dx-revenue-models　収益モデルの比較（誰が・何に・いつ払うか）

- 優先度：**B**　／　主な章：08 収益モデル
- 何を描くか：表：行＝サブスクリプション、フリーミアム、アドオン、広告モデル、成果報酬、レベニューシェア、ライセンシング、投げ銭、部分所有。列＝払う人／払う対象／払うタイミング。各行に小さなお金の矢印のアイコン。
- 文字より分かる理由：多数の収益モデルの違いが、同じ列で比べると一目で分かる。
- 使うカード（9）：DC-08-001（サブスクリプション）、DC-08-002（フリーミアム）、DC-08-003（アドオン）、DC-08-004（部分所有モデル）、DC-08-005（成果報酬）、DC-08-006（レベニューシェア）、DC-08-007（ライセンシング）、DC-08-009（広告モデル）、DC-08-011（投げ銭モデル）
- 使う問題（10）：D-08-001、D-08-003、D-08-004、D-08-005、D-08-009、D-08-010、D-08-014、D-08-015、D-08-008、D-08-012
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「平成28年版 情報通信白書」コンテンツ配信サービス市場](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h28/html/nc122220.html)（DC-08-001）
  - [消費者庁「インターネット消費者取引に係る広告表示に関する景品表示法上の問題点及び留意事項」](https://www.caa.go.jp/policies/policy/representation/fair_labeling/guideline/assets/representation_cms216_220629_07.pdf)（DC-08-002、DC-08-005）
  - [総務省「令和元年版 情報通信白書」デジタル経済におけるデジタル・プラットフォーマーの位置付け](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r01/html/nd113110.html)（DC-08-002、DC-08-009）
  - [国土交通省「平成28年度 政策レビュー結果（評価書）LCCの事業展開の促進」（平成29年3月）](https://www.mlit.go.jp/common/001179271.pdf)（DC-08-003）
  - [タイムシェア型住宅供給研究会（国土交通省）「タイムシェア型住宅供給研究会 報告書」（平成20年8月）](https://www.mlit.go.jp/common/000022776.pdf)（DC-08-004）
  - [経済産業省 平成28年度取引条件改善事業（情報サービス・ソフトウェア産業における下請取引等に関する実態調査）調査報告書（平成29年3月）](https://www.meti.go.jp/meti_lib/report/H28FY/000804.pdf)（DC-08-006）
  - [ジェトロ 貿易・投資相談Q&A「OEM契約とライセンス契約の違い：日本」](https://www.jetro.go.jp/world/qa/04A-010822.html)（DC-08-007）
  - [総務省「平成29年版 情報通信白書」オンラインプラットフォームの意義](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h29/html/nc113110.html)（DC-08-009）
  - [消費者庁「令和4年版 消費者白書」COLUMN ライブ配信サービス(投げ銭等)に関する消費の動向](https://www.caa.go.jp/policies/policy/consumer_research/white_paper/2022/white_paper_column_03.html)（DC-08-011）
  - [消費者庁 インターネット消費者取引連絡会「クリエイターエコノミー関連サービスの動向整理」（2022年12月23日）](https://www.caa.go.jp/policies/policy/consumer_policy/caution/internet/assets/internet_committee_230123_09.pdf)（DC-08-011）

#### fig-dx-ad-model　広告モデルとリスティング広告

- 優先度：**B**　／　主な章：08 収益モデル
- 何を描くか：3者の図：利用者（無料でサービスを使う）・サービス運営者・広告主（運営者にお金を払う）。利用者の注目が広告主へ届く矢印。リスティング広告は検索キーワードに連動して検索結果と一緒に表示され、クリックされたときに費用がかかる、と検索画面の模式図で。
- 文字より分かる理由：「使う人と払う人が違う」構造が、3者の矢印で分かる。
- 使うカード（2）：DC-08-009（広告モデル）、DC-08-010（リスティング広告）
- 使う問題（5）：D-08-006、D-08-007、D-08-020、D-08-021、D-09-012
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「令和元年版 情報通信白書」デジタル経済におけるデジタル・プラットフォーマーの位置付け](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r01/html/nd113110.html)（DC-08-009）
  - [総務省「平成29年版 情報通信白書」オンラインプラットフォームの意義](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h29/html/nc113110.html)（DC-08-009）
  - [公正取引委員会「デジタル広告分野の取引実態に関する最終報告書（概要）」（令和3年2月）](https://www.jftc.go.jp/houdou/pressrelease/2021/feb/digital/210217_gaiyou2.pdf)（DC-08-010）

#### fig-dx-churn-ltv　解約率と顧客生涯価値（LTV）

- 優先度：**B**　／　主な章：08 収益モデル
- 何を描くか：左：毎月の顧客数が、解約率5%と2%でどう減るかの2本の線。右：LTV を「顧客あたりの平均売上 ÷ 解約率」で求める例（出典の式で）。注記「解約しにくくして LTV を上げるのは問題がある（違約金・店頭でしか解約できない等）」。
- 文字より分かる理由：解約率の小さな差が大きな差になることが、2本の線で見える。
- 使うカード（3）：DC-08-015（解約率と顧客生涯価値（サブスクの指標））、DC-08-012（カスタマーロイヤルティ）、DC-08-001（サブスクリプション）
- 使う問題（3）：D-08-003、D-08-023、D-08-022
- 描く前に確かめること：LTV の式はカード（DC-08-015）の出典の記述どおりに書く。
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [セールスフォース・ジャパン「LTV（Life Time Value：顧客生涯価値）とは」](https://www.salesforce.com/jp/marketing/what-is-life-time-value/)（DC-08-015）
  - [セールスフォース・ジャパン「LTVの向上に貢献する、ロイヤルカスタマーの育て方」](https://www.salesforce.com/jp/crm/nurturing-the-loyal-customer/)（DC-08-012）
  - [観光庁「観光地域づくり法人（DMO）による観光地域マーケティングガイドブック」第6章 CRM（顧客関係管理）の方法](https://www.mlit.go.jp/kankocho/content/001580600.pdf)（DC-08-012）
  - [総務省「平成28年版 情報通信白書」コンテンツ配信サービス市場](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h28/html/nc122220.html)（DC-08-001）

#### fig-dx-case-types　DX 事例の4つの型（マッチング・デジタル商材・リアル＋デジタル・リアル）

- 優先度：**B**　／　主な章：09 事例：デジタル集客・マッチング・マーケットプレイス
- 何を描くか：2×2 または4列の比較。各型に「価値の源泉」「デジタルの役割」「代表例」を書く。マッチング：参加者が持ち寄るリソース、取引コストを下げる（メルカリ・ココナラ）。デジタル商材：商品そのものがデジタル、使われ続ける前提で改善（Notion・スタディサプリ）。リアル＋デジタル：既存の顧客基盤・設備にデジタルを重ねる（Vitality・Kubota Diagnostics）。リアル：デジタルを前面に出さず在庫・企画の速度を上げる（ZARA・成城石井）。
- 文字より分かる理由：4つの章の違いが1枚に並び、事例をどの型に入れるかが判断しやすくなる。
- 使うカード（4）：DC-09-001（マッチング・マーケットプレイス型DXの共通構造）、DC-10-001（デジタル商材型DXの共通構造）、DC-11-001（リアル＋デジタル融合型DXの共通構造）、DC-12-001（リアルビジネス型DXの共通構造）
- 使う問題（8）：D-09-001、D-09-013、D-10-001、D-10-007、D-11-001、D-11-007、D-11-012、D-12-001
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [DXビジネス検定 公式ページ シラバス 09（2026年2月改訂）](https://www.nextet.net/netkentei/dx-biz/)（DC-09-001、DC-10-001、DC-11-001、DC-12-001）

#### fig-dx-zara-cycle　店頭の売れ行きを素早く次の商品に生かす循環（SPA と速度の経済）

- 優先度：**B**　／　主な章：12 事例：リアルビジネス
- 何を描くか：輪：店頭（売れ行き・顧客の声）→ 本部へ毎日集める → 企画 → 短期間で生産 → 少量ずつ店へ補充 → 店頭。輪の内側に RFID で在庫を把握する印。「輪を速く回すほど在庫と売れ残りが減る」。
- 文字より分かる理由：情報と商品が回る順番と速さの意味が、輪の図で分かる。
- 使うカード（4）：DC-12-004（ZARA）、DC-12-005（H&M）、DC-07-007（SPA（製造小売））、DC-05-005（速度の経済）
- 使う問題（4）：D-12-002、D-12-004、D-12-005、D-12-007
- 注意：次のカードは status が verified でない → DC-05-005
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [Inditex Annual Report 2023「Strategy（Business model and strategy）」](https://static.inditex.com/annual_report_2023/en/Strategy.pdf)（DC-12-004）
  - [Inditex「FY2025 Results（2025年2月1日〜2026年1月31日）」](https://www.inditex.com/itxcomweb/api/media/1da2c9d1-dbca-49fb-9563-982a8a27fae6/INDITEXFullYear2025.pdf)（DC-12-004）
  - [Inditex 公式サイト「Brands」](https://www.inditex.com/itxcomweb/kr/en/brands)（DC-12-004）
  - [H&M Group 公式サイト「About us」](https://hmgroup.com/about-us/)（DC-12-005）
  - [H&M Group 公式サイト「Supply chain」](https://hmgroup.com/sustainability/leading-the-change/supply-chain/)（DC-12-005）
  - [H&M Group「Annual and Sustainability Report 2025」](https://hmgroup.com/wp-content/uploads/2026/03/HM-Group-Annual-and-sustainability-report-2025.pdf)（DC-12-005）
  - [日本繊維産業連盟「我が国繊維産業の現状」（産業構造審議会 繊維産業小委員会 資料7、令和3年11月22日）](https://www.meti.go.jp/shingikai/sankoshin/seizo_sangyo/textile_industry/pdf/001_07_00.pdf)（DC-07-007）
  - [DXビジネス検定 公式ページ シラバス（2026年2月改訂）](https://www.nextet.net/netkentei/dx-biz/)（DC-07-007、DC-05-005）

#### fig-dx-silo　事業部門ごとの個別最適（サイロ）と全社最適のシステム

- 優先度：**C**　／　主な章：01 DXの基本
- 何を描くか：左：事業部門A・B・Cがそれぞれ別のシステムを持ち、データの線がつながらない（部門の間に壁）。年月とともに継ぎ足しで複雑化・ブラックボックス化する様子を、絡まった線で。右：部門のシステムが共通の連携基盤（全体設計＝アーキテクチャ）につながり、データが全社で行き来する。下に「2025年の崖」は左の状態が続いた場合の警告である、と1行（金額などの数値はカードの出典で確かめたものだけ書く）。
- 文字より分かる理由：「個別最適」と「全社最適」の違いが、線がつながるかどうかで一目で分かる。
- 使うカード（3）：DC-01-007（全社的なITシステムの構築体制と全社的ITガバナンス）、DC-01-027（2025年の崖（DXレポート））、DC-01-015（デジタルアーキテクチャ推進）
- 使う問題（4）：D-01-007、D-01-019、D-01-028、D-01-029
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [経済産業省「DX推進ガイドライン Ver.1.0」（2018年12月）](https://www.meti.go.jp/press/2018/12/20181212004/20181212004-1.pdf)（DC-01-007）
  - [経済産業省「DXレポート～ITシステム「2025年の崖」の克服とDXの本格的な展開～」（2018年9月7日）](https://www.meti.go.jp/shingikai/mono_info_service/digital_transformation/pdf/20180907_03.pdf)（DC-01-027）
  - [経済産業省「DXレポート2（中間取りまとめ）」（2020年12月28日）5](https://www.meti.go.jp/press/2020/12/20201228004/20201228004-2.pdf)（DC-01-015）

#### fig-dx-rdb-nosql　RDB と NoSQL のデータの持ち方

- 優先度：**C**　／　主な章：03 データと分析
- 何を描くか：左：行と列の表（RDB、SQL で操作）。右：キーと値の組、文書（入れ子のデータ）の形（NoSQL）。並列分散処理は「大きな処理を分けて複数台で同時に」と別枠。
- 文字より分かる理由：データの形の違いが、表と入れ子の図で比べられる。
- 使うカード（2）：DC-03-007（RDB・SQL・NoSQL）、DC-03-006（並列分散処理）
- 使う問題（2）：D-03-006、D-03-022
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省 情報通信審議会ICT基本戦略ボード「ビッグデータの活用の在り方について」（2012年5月17日）](https://www.soumu.go.jp/main_content/000160628.pdf)（DC-03-007、DC-03-006）

#### fig-dx-info-bank　情報銀行とデータマーケットプレイス

- 優先度：**C**　／　主な章：03 データと分析
- 何を描くか：左：個人 → 情報銀行（本人の同意に沿って管理）→ 第三者の事業者、便益が個人へ戻る矢印。右：データを売りたい事業者と買いたい事業者を仲介する市場。
- 文字より分かる理由：誰のデータを誰が仲介するかが、矢印の向きで区別できる。
- 使うカード（2）：DC-03-025（情報銀行・データマーケットプレイス）、DC-03-003（データビジネス）
- 使う問題（1）：D-03-017
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「平成29年版 情報通信白書」新たなデータ利活用・流通モデルの進展](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h29/html/nc121310.html)（DC-03-025、DC-03-003）
  - [総務省「令和2年版 情報通信白書」匿名加工情報のさらなる活用](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r02/html/nd133430.html)（DC-03-025、DC-03-003）
  - [経済産業省「デジタルガバナンス・コード3.0」（2024年9月19日）](https://www.meti.go.jp/policy/it_policy/investment/dgc/dgc3.0.pdf)（DC-03-003）

#### fig-dx-web-ads　ランディングページとリターゲティング広告

- 優先度：**C**　／　主な章：04 マーケティング
- 何を描くか：広告をクリック → ランディングページ（最初に着くページ）。カートに入れて離脱 → 別のニュースサイトで自社の広告が再び表示 → 戻って購入、の輪。
- 文字より分かる理由：利用者の動きの順番が、輪の図で分かる。
- 使うカード（2）：DC-04-014（ランディングページ）、DC-04-015（リターゲティング広告）
- 使う問題（2）：D-04-007、D-04-023
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [公正取引委員会「デジタル広告の取引実態に関する中間報告書」（令和2年4月）](https://www.jftc.go.jp/houdou/pressrelease/2020/apr/digital/200428betten.pdf)（DC-04-014、DC-04-015）
  - [Google 広告 ヘルプ「データ セグメントについて」](https://support.google.com/google-ads/answer/2453998?hl=ja)（DC-04-015）

#### fig-dx-consumption-types　モノ消費・コト消費・トキ消費・イミ消費

- 優先度：**C**　／　主な章：05 消費者の状況とビジネス環境
- 何を描くか：4列の表：何にお金を払うか（所有／体験／その時その場の共有体験／社会や自分への意味）と例。
- 文字より分かる理由：似た造語の違いが、表の1行で比べられる。
- 使うカード（3）：DC-05-008（コト消費（体験型消費））、DC-05-009（トキ消費）、DC-05-010（イミ商材）
- 使う問題（2）：D-05-005、D-05-019
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [消費者庁「令和4年版 消費者白書」第1部第2章第2節（1）若者の消費行動](https://www.caa.go.jp/policies/policy/consumer_research/white_paper/2022/white_paper_132.html)（DC-05-008、DC-05-009）
  - [消費者庁「令和7年版消費者白書について」（消費者志向経営に関する連絡会資料、2025年9月）](https://www.caa.go.jp/policies/policy/consumer_partnerships/meeting_materials/assets/consumer_partnerships_cms201_0917_1.pdf)（DC-05-010）

#### fig-dx-sixth-industry　六次産業化

- 優先度：**C**　／　主な章：05 消費者の状況とビジネス環境
- 何を描くか：1次（生産）・2次（加工）・3次（流通・販売）の3つの箱を、農林漁業者が1人で横断する矢印。みかん→ジュース→EC・直売所の例。
- 文字より分かる理由：「1つの事業者が3つの段階をまたぐ」ことが、横断の矢印で分かる。
- 使うカード（1）：DC-05-020（六次産業化）
- 使う問題（1）：D-05-008
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [農林水産省「農山漁村での『6次産業化』とは、どのようなことですか。」](https://www.maff.go.jp/j/heya/sodan/1202/a04.html)（DC-05-020）

#### fig-dx-bop　BOP モデルとリバースイノベーション

- 優先度：**C**　／　主な章：05 消費者の状況とビジネス環境
- 何を描くか：所得のピラミッド。底辺（BOP）を「援助の対象ではなく顧客・パートナー」として矢印。さらに、新興国向けに作った安く簡素な製品が先進国へ逆に流れる矢印（リバースイノベーション）。
- 文字より分かる理由：どの層に向け、どちらへ流れるかが、ピラミッドの矢印で分かる。
- 使うカード（2）：DC-05-019（BOPモデル）、DC-06-015（リバースイノベーション）
- 使う問題（2）：D-05-028、D-06-021
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [JICAバングラデシュ事務所「次世代のBOPビジネスがやってくる!」](https://www.jica.go.jp/bangladesh/bangland/reports/report21.html)（DC-05-019）
  - [JICA「協力準備調査（BOPビジネス連携促進）募集要項」（2013年3月）](https://www.jica.go.jp/Resource/announce/notice/bop/ku57pq00001iepav-att/20130315_01_ins01.pdf)（DC-05-019）
  - [国土交通政策研究所紀要 第79号（2021年）「新興国・都市におけるリープフロッグに関する調査研究」](https://www.mlit.go.jp/pri/kikanshi/pdf/2021/79_1.pdf)（DC-06-015）

#### fig-dx-crowd　クラウドソーシングとクラウドファンディング（3つの型）

- 優先度：**C**　／　主な章：06 戦略モデル
- 何を描くか：左：クラウドソーシング。依頼者から不特定多数の人へ仕事が流れる。右：クラウドファンディング。多数の人から少額ずつお金が集まり、リターンの形で寄付型（なし）・購入型（金銭以外）・投資型（金銭）に分かれる。
- 文字より分かる理由：「仕事を出す」か「お金を集める」か、リターンの違いが図で整理できる。
- 使うカード（2）：DC-06-010（クラウドソーシング）、DC-06-011（クラウドファンディング）
- 使う問題（3）：D-06-002、D-06-003、D-06-019
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [総務省「平成27年版 情報通信白書」クラウドソーシング](https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/h27/html/nc243120.html)（DC-06-010）
  - [金融庁 金融審議会「新規・成長企業へのリスクマネーの供給のあり方等に関するワーキング・グループ」事務局説明資料（2013年6月26日）](https://www.fsa.go.jp/singi/singi_kinyu/risk_money/siryou/20130626/03.pdf)（DC-06-011）

#### fig-dx-windowing　ウィンドウイング

- 優先度：**C**　／　主な章：08 収益モデル
- 何を描くか：時間軸に、映画館 → 配信 → パッケージ → 放送の順に期間の帯を並べる。
- 文字より分かる理由：流通経路を時間差で並べる考え方が、帯の並びで分かる。
- 使うカード（1）：DC-08-008（ウィンドウイング）
- 使う問題（1）：D-08-017
- 根拠にする一次情報（カードの sources から。括弧内はその出典を持つカード）：
  - [経済産業省 エンタメ・クリエイティブ産業政策研究会「業界の現状及びアクションプラン（案）について【映画・映像】」（2025年1月30日）](https://www.meti.go.jp/shingikai/mono_info_service/entertainment_creative/pdf/004_04_02.pdf)（DC-08-008）
  - [公正取引委員会「映画の制作現場におけるクリエイターの取引環境に係る実態調査報告書」（令和7年12月）](https://www.jftc.go.jp/file/houdou/pressrelease/2025/dec/251224_eigaanime2.pdf)（DC-08-008）

