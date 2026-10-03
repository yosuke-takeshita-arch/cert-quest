# G検定 追加の記録（担当A：01・02・05・06章）

作成: 2026-10-03。`book-gap_g.md` の「追加対象（案B、2026-10-03 先生決定）」の 01・02・05・06章の表を作業リストにした。アプリには出さない。

## 確かめ方

- 原文は `curl`（User-Agent 付き）で取得し、PDF は `pdftotext -enc UTF-8`（日本語の CMap が無くて化けた J-STAGE・人工知能学会の PDF だけ pdfminer.six）、HTML はタグを除き文字コードを判定してから全文検索した。WebFetch の要約は根拠にしていない
- `verified` は、答え（不適切を選ぶ問題では正しい側の選択肢も）とカードに足した説明の根拠を、原文で見つけたものだけ
- 市販本の文は使っていない（手元にあるのは索引の用語名だけ）。説明・問題はすべて書き下ろし
- 取得したファイルは作業用の一時フォルダに置き、リポジトリには入れていない

## 01 人工知能とは

| 対象 | 何をしたか | 確かめた出典と該当箇所 | status |
|---|---|---|---|
| C-01-012 強いAIと弱いAI | why に「汎用型AIと特化型AI」（課題の幅の区別）を足し、confusions に強い／弱いとの違いを足した。sources に AI100 Overview を足した | AI100 2016 Report Overview（none suggest there is currently a "general purpose" AI / AI systems are specialized to accomplish particular tasks）。SEP The Chinese Room Argument（Strong AI の定義） | verified |
| C-01-018 シンギュラリティ | why に 2045年問題・収穫加速の法則・ムーアの法則を足した。sources に3件 | 総務省 研究会 第1回 資料4「シンギュラリティ（特異点）について」（カーツワイルの引用：特異点は2045年、2030年代初めはまだ特異点ではない）。Kurzweil (2001) The Law of Accelerating Returns（technological change is exponential、double exponential、Moore's Law は fifth paradigm）。Moore (1965) Electronics 38(8)（complexity for minimum component costs has increased at a rate of roughly a factor of two per year） | verified |
| C-01-015 フレーム問題 | why に「爆弾とロボット」（R1・R1D1・R2D1）の例え話を足した。sources に Dennett を足した | Dennett (1984) Cognitive Wheels（Tufts Digital Library の PDF。冒頭の R1 / R1D1 / R2D1 の話） | verified |
| G-01-023（新） | 課題の幅で分ける区別＝特化型と汎用型。誤答は強い／弱い・4段階・ルールベースと機械学習 | 上の AI100、SEP | verified |
| G-01-024（新） | 空欄補充：収穫加速の法則・2045年。誤答はムーアの法則・2030 | 上の総務省資料4、Kurzweil 2001、Moore 1965 | verified |
| G-01-025（新） | 爆弾ロボットの例え話が示す問題＝フレーム問題 | Dennett (1984) | verified |

- 足す先は表のとおり（変えていない）
- 正解の位置：前 A5/B6/C6/D5 → 後 A6/B7/C6/D6

## 02 人工知能をめぐる動向

| 対象 | 何をしたか | 確かめた出典と該当箇所 | status |
|---|---|---|---|
| C-02-041 軽量オントロジーと重量オントロジー（新） | T-04 に新規。links：C-02-019・C-02-018・C-02-021 | 古崎・來村・溝口ほか (2007) 人工知能学会全国大会 1D3-3（情報論的な利用効率を重視＝ライトウェイト、哲学的な考察に基づき対象世界を適切に捉えることを重視＝ヘビーウェイト、ヘビーウェイトを構築するコストを問題視する立場）。古崎・林・笹島・溝口 (2008) 同 3G2-2（広く浅い知識では効率重視でライトウェイトが好まれる、Semantic Web 分野では公理などクラス定義の記述量で区別、is-a 階層のみのものをライトウェイトと呼ぶ場合） | verified |
| C-02-019 オントロジー | links に C-02-041 を足した | ― | （変えていない） |
| C-02-021 セマンティックWeb | why に Linked Data の4原則・LOD・5つ星を足した。confusions に C-07-015（オープンデータセット）との違い、links に C-02-041、sources に W3C を足した | Berners-Lee "Linked Data" Design Issues（4つのルール、Linked Open Data の定義、5 star の表） | verified |
| C-02-016 イライザ | why にパターンマッチングの仕組み（キーワード→分解の型→組み立て規則、キーワードが無いときの決まり文句）を足した。例文は日本語で書き下ろした | Weizenbaum (1966)（decomposition rules triggered by key words、reassembly rules、content-free remark） | verified |
| C-02-039 アルファ碁 | why に AlphaGo Zero と AlphaZero を足した。confusions に3つの違いを足した | Silver et al. (2017) Nature 550 の要旨（without human data, guidance or domain knowledge beyond game rules、手と勝者を予測、100–0）。arXiv:1712.01815 の要旨（AlphaZero、chess and shogi as well as Go） | verified |
| G-02-041（新） | 軽量と重量の違い | 上の JSAI 2007・2008 | verified |
| G-02-042（新） | LOD の説明 | W3C Linked Data | verified |
| G-02-043（新） | 空欄補充：ELIZA の手がかり＝キーワード | Weizenbaum (1966) | verified |
| G-02-044（新） | AlphaGo Zero の説明。誤答に AlphaGo・AlphaZero・探索なし | Silver et al. 2017（Nature）・arXiv:1712.01815・Silver et al. 2016 | verified |

- 足す先は表のとおり。表の当て「溝口理一郎の J-STAGE 解説論文」は、人工知能学会誌 14巻6号（1999）「オントロジー研究の基礎と応用」を開いたが軽量・重量の語が無かったので、同じ研究室（溝口が共著）の人工知能学会全国大会の論文2本に替えた
- AlphaZero の Science 2018 版は開いていない（arXiv の 2017 版で確かめた）
- 正解の位置：前 A10/B10/C10/D10 → 後 A11/B11/C11/D11

## 05 ディープラーニングの要素技術

| 対象 | 何をしたか | 確かめた出典と該当箇所 | status |
|---|---|---|---|
| C-05-004 畳み込み操作 | 表では「問題を足す」だけだが、why に「畳み込み演算」の語と、ライブラリは反転しない相互相関を畳み込みと呼んでいることを足した。links に C-05-049、sources に Goodfellow 9章を足した | Goodfellow et al. 第9章（many neural network libraries implement ... cross-correlation ... but call it convolution、式 9.6） | verified |
| C-05-012 バッチ正規化 | why に「共変量シフト」のもとの意味（学習システムへの入力分布の変化）と、各層へ当てはめたのが内部共変量シフトであることを足した | Ioffe & Szegedy (2015) 1章（When the input distribution to a learning system changes, it is said to experience covariate shift … extended … to a sub-network or a layer） | verified |
| C-05-027 LSTM | why に入力重み衝突・出力重み衝突と、入力ゲート＝書き込み・出力ゲート＝読み出しを足した | Hochreiter & Schmidhuber (1997) 3章（Input weight conflict / Output weight conflict、"write operations" / "read operations"）、4章（Why gate units?） | verified |
| C-05-028 GRU | why にリセットゲートと更新ゲートの役割を足した | Cho et al. (2014) 2.3節と図2（reset gate close to 0 → ignore the previous hidden state、update gate selects whether the hidden state is to be updated） | verified |
| C-05-034 Self-Attention | why に Masked Self-Attention（後ろの位置を −∞ で隠す、自己回帰）を足し、confusions に Source-Target Attention との違いを足した | Vaswani et al. (2017) 3.1節（prevent positions from attending to subsequent positions）、3.2.3節（masking out (setting to −∞)、auto-regressive property） | verified |
| C-05-035 Transformer | why にデコーダのマスクを1文足し、links に C-05-050 を足した | 同上 | verified |
| C-05-031 Seq2Seq | links に C-05-050 を足した | ― | （変えていない） |
| C-05-049 アップサンプリング（逆畳み込み・逆プーリング）（新） | T-18 に新規。links：C-05-016・C-05-004・C-05-009・C-06-020・C-06-021・C-05-050 | Zeiler & Fergus (2013) 2.1節（Unpooling：最大値の位置を switch variables に記録）。Long et al. FCN 3.3節（Upsampling is backwards strided convolution、deconvolution のフィルタは学習できる）。SegNet 要旨（pooling indices を使ったアップサンプリング、学習が要らない）。PyTorch ConvTranspose2d（not an actual deconvolution … does not compute a true inverse of convolution） | verified |
| C-05-050 エンコーダ・デコーダ構造（新） | T-23 に新規。links：C-05-031・C-05-035・C-05-032・C-05-039・C-06-021・C-05-049 | Cho et al. (2014) 要旨（One RNN encodes … fixed-length vector … the other decodes）。Sutskever et al. (2014)。Vaswani et al. (2017) 3章（encoder-decoder structure、auto-regressive）。SegNet 要旨（encoder network と decoder network） | verified |
| G-05-054（新） | 3×3 入力と 2×2 フィルタの畳み込みの計算（右上＝5） | Goodfellow 式 9.6（相互相関の積和）と PyTorch Conv2d。値は式から自分で計算した | verified |
| G-05-055（新） | 内部共変量シフトの説明 | Ioffe & Szegedy (2015) 要旨・1章 | verified |
| G-05-056（新） | 空欄補充：書き込み＝入力ゲート、読み出し＝出力ゲート。誤答に忘却・更新・リセット | Hochreiter & Schmidhuber (1997)、Cho et al. (2014) | verified |
| G-05-057（新） | アップサンプリングで不適切なもの＝「逆畳み込みは真の逆演算」 | PyTorch ConvTranspose2d、Zeiler & Fergus、FCN、SegNet | verified |
| G-05-058（新） | エンコーダ・デコーダ構造の説明 | Cho et al. (2014)、Vaswani et al. (2017) | verified |
| G-05-059（新） | 空欄補充：デコーダの Self-Attention は「後ろ」を隠す | Vaswani et al. (2017) | verified |

- 足す先は表のとおり。ただし C-05-004 は問題だけでなく why にも1文足した（索引の語「畳み込み演算」をカードに出すため）
- エンコーダ・デコーダ構造は、既存の C-05-031 Seq2Seq と重なるが、表のとおり新規カードにした。Seq2Seq は RNN による系列変換の具体例、新カードは RNN に限らない構造（Transformer・SegNet・オートエンコーダとの関係）として書き分け、両者を links と confusions でつないだ
- 正解の位置：前 A13/B13/C14/D13 → 後 A15/B14/C15/D15

## 06 ディープラーニングの応用例

### カード（新規4枚・説明を足した既存カード）

| 対象 | 何をしたか | 確かめた出典と該当箇所 | status |
|---|---|---|---|
| C-06-094 形態素解析と分かち書き・ストップワード（新） | T-27 に新規。links：C-06-026・C-06-027・C-06-095。「最小の意味単位」は verify-log で外した言い方なので使っていない | MeCab 公式（-O wakati の出力）、Juman++ 公式、scikit-learn Feature extraction 8.2.3.4（Stop words … presumed to be uninformative … Sometimes, however, similar words are useful）、SLP3 第2章（日本語は空白で語を区切らない） | verified |
| C-06-095 文の解析の段階（構文・意味・照応・談話構造）（新） | T-27 に新規。links：C-06-026・C-06-094 | KNP 公式（JUMAN の形態素列を入力に、係り受け・格・照応関係を出力）、SLP3 第20章（依存構造）・第22章（意味役割の付与）・第24章（anaphora）・第25章（coherence relations、REASON）、JST CREST 平成29年度報告（「知識に基づく文脈解析」、文をまたぐ省略解析と共参照解析）。※「形態素→構文→意味→文脈」を段階として定義した一次情報は見つからなかったので、カードでは段階の順を断定せず「扱う範囲を広げていく」と書き、文脈解析は「文をまたいで考える解析は文脈解析とも呼ばれる」にとどめた | verified |
| C-06-096 プロンプトエンジニアリング（新） | T-27 に新規。links：C-06-035・C-06-074・C-06-070・C-06-057 | Brown et al. 2020（without any gradient updates or fine-tuning、in-context learning）、Wei et al. 2022 要旨（chain-of-thought exemplars、arithmetic, commonsense, symbolic reasoning）、Anthropic Platform Docs（Setting a role in the system prompt focuses Claude's behavior and tone） | verified |
| C-06-097 模倣学習（新） | T-29 に新規。links：C-03-036（既存）・C-06-059・C-06-058・C-06-057 | Ross, Gordon & Bagnell 2011（DAgger）1章（expert demonstrations … used to learn a controller、train a classifier or regressor to predict an expert's behavior、compounding of errors）。Levine et al. 2020（behavioral cloning） | verified |
| C-06-001 画像認識タスクの種類 | why に同定（identification）と分類（classification）の区別を足した（表は「問題を足す」だけ） | 柳井 2007 本文 PDF 1章 | verified |
| C-06-025 姿勢推定と OpenPose | why にトップダウン型とボトムアップ型を足した（表は「問題を足す」だけ） | Cao et al. 2018（top-down approaches … suffer from early commitment、runtime proportional to the number of people） | verified |
| C-06-015 Fast/Faster R-CNN | why に Region Proposal・RoI・Selective Search・RoI プーリング・RPN を足した | Fast R-CNN 2.1節（RoI pooling layer、H×W 例 7×7）、Faster R-CNN 1章（Selective Search … 2 seconds per image、proposals 10 milliseconds） | verified |
| C-06-024 Mask R-CNN | why に RoI プーリングの量子化と RoIAlign を足した | Mask R-CNN 要旨・3章（RoIPool performs coarse spatial quantization、RoIAlign、bilinear interpolation、No quantization） | verified |
| C-06-004 GoogLeNet | why に補助分類器を足した | Szegedy et al. 2014 5章（auxiliary classifiers connected to intermediate layers、weighted by 0.3、discarded at inference） | verified |
| C-06-026 自然言語処理のタスク | links に C-06-094・C-06-095 を足した | ― | （変えていない） |
| C-06-027 ワンホット・BoW ほか | why に局所表現とベクトル空間モデルを足した。sources に2件 | Goodfellow 第15章（every two distinct one-hot vectors are the same distance）、Turney & Pantel 2010 要旨（term–document, word–context, pair–pattern matrices） | verified |
| C-06-028 分散表現 | why にカウントベースと推論ベースを足した。sources に2件 | Baroni et al. 2014 要旨・1章（context-predicting models … resounding victory against their count-based counterparts） | verified |
| C-06-029 word2vec | why に中心語・周辺語と Paragraph Vector（Doc2Vec）を足した | Mikolov et al. 2013 図1、Le & Mikolov 2014 要旨、gensim models.doc2vec（Doc2vec … from Quoc Le and Tomas Mikolov） | verified |
| C-06-037 機械翻訳の変遷 | why にニューラル機械翻訳と GNMT を足した | Wu et al. 2016 要旨（8 encoder and 8 decoder layers、residual、attention、wordpieces、low-precision arithmetic） | verified |
| C-06-035 LLM | links に C-06-096 を足した | ― | （変えていない） |
| C-06-039 A-D変換とPCM | why にナイキスト周波数を足した | SLP3 第15章（every cycle needs two samples、Nyquist frequency、10,000 Hz / 20,000 Hz） | verified |
| C-06-043 HMM による音声認識 | why に音響モデルと DNN-HMM を足した | Hinton et al. 2012 要旨（HMM と GMM、posterior probabilities over HMM states、outperform GMMs）、SLP3 第16章（hybrid HMM/MLP） | verified |
| C-06-045 WaveNet | why に波形接続型・パラメトリック型と Dilated Causal Convolution を足した。links に C-05-010 | WaveNet 2章・2.1節・3.4節（causal convolutions、dilated convolution、unit selection concatenative / statistical parametric）、SLP3 第17章（concatenative synthesis の歴史） | verified |
| C-06-047 DQN | why に経験再生とターゲットネットワークを足した | Mnih et al. 2015 Nature（Google DeepMind 公開 PDF：experience replay、target network … every C updates） | verified |
| C-06-056 OpenAI Five と AlphaStar | why に独立学習・協調的な学習・集中学習・CTDE を足した | Tan 1993 要旨（independent agents、sharing sensation / episodes / policies）、MADDPG 1章・3章（non-stationary、centralized training with decentralized execution） | verified |
| C-06-059 オフライン強化学習 | why にオンライン強化学習との対比を足し、confusions と links（C-06-097）を足した | Levine et al. 2020 1章・2章（online interaction、static dataset of transitions (s, a, s', r)） | verified |
| C-06-057 RLHF | why に3段階（SFT・報酬モデル・PPO）を足し、links に C-06-097 | Ouyang et al. 2022 図2・3.1節（reward model (RM) … predict which output our labelers would prefer） | verified |
| C-06-058 sim2real | links に C-06-097 を足した | ― | （変えていない） |
| C-06-067 拡散モデル | why に順過程・逆過程と分類器ガイダンスを足した | Ho et al. 2020 2章（forward process … fixed、reverse process … learned）、Dhariwal & Nichol 2021 要旨（classifier guidance … trading off diversity for fidelity） | verified |
| C-06-072 自己教師あり学習 | why に対照学習（SimCLR）の仕組みを足した | Chen et al. 2020 2.1節（2(N−1) augmented examples as negative examples、cosine similarity、larger batch sizes） | verified |
| C-06-078 Image Captioning と VQA | why に NIC（CNN エンコーダ＋LSTM デコーダ）を足し、links に C-05-050 | Vinyals et al. 2014（We call this model the Neural Image Caption, or NIC、inspiration … machine translation、LSTM） | verified |
| C-06-076 CLIP | why に画像エンコーダとテキストエンコーダ、ゼロショット分類の仕組みを足し、links に C-06-072 | Radford et al. 2021 2.3〜2.4節（image encoder and text encoder、ResNet-50 / ViT、Transformer、from scratch without ImageNet weights）、3.1.2節（names of all the classes） | verified |
| C-06-083 説明可能AI | why に局所的な説明と大域的な説明を足した | Doshi-Velez & Kim 2017（Global vs. Local）、LIME 要旨（locally around the prediction） | verified |
| C-06-085 Grad-CAM | why に Guided Grad-CAM を足した | Selvaraju et al.（fuse Guided Backpropagation and Grad-CAM via element-wise multiplication） | verified |
| C-06-090 蒸留 | why に教師モデル・生徒モデルとソフトターゲットを足した。sources に FitNets | Hinton et al. 2015（cumbersome model / small model、soft targets、2 と 3 の例）。原論文には teacher / student の語が無いことを確かめ、その語は Romero et al. 2014 FitNets（student network … teacher network）で確かめた | verified |
| C-06-089 エッジAI | why にエッジコンピューティングを足し、confusions にフォグコンピューティングとの違いを足した | NIST SP 500-325 Annex A（Edge computing is the network layer encompassing the end devices … Fog computing is hierarchical … storage, control） | verified |

### 問題（新29問）

| ID | 中身 | 出典 | status |
|---|---|---|---|
| G-06-070 | 一般物体認識の説明（誤答：同定・固定環境・セグメンテーション） | 柳井 2007 | verified |
| G-06-071 | トップダウン型とボトムアップ型 | Cao et al. 2018 | verified |
| G-06-072 | R-CNN 系で不適切＝Selective Search が学習で速い | Faster R-CNN・Fast R-CNN・Mask R-CNN | verified |
| G-06-073 | GoogLeNet の補助分類器 | Szegedy et al. 2014 | verified |
| G-06-074 | 分かち書き（誤答：ストップワード・係り受け・照応） | MeCab、scikit-learn | verified |
| G-06-075 | 空欄補充：照応解析 | KNP、SLP3 第24章 | verified |
| G-06-076 | 分散表現の説明 | Mikolov 2013、Goodfellow 第15章 | verified |
| G-06-077 | カウントベースと推論ベース | Baroni 2014、Turney & Pantel 2010 | verified |
| G-06-078 | word2vec と Doc2Vec | Mikolov 2013、Le & Mikolov 2014、gensim | verified |
| G-06-079 | GNMT で不適切＝Attention も RNN も使わない | Wu et al. 2016 | verified |
| G-06-080 | Chain-of-Thought（誤答：標準の Few-shot・ファインチューニング・システムプロンプト） | Wei et al. 2022 | verified |
| G-06-081 | 16,000 Hz で記録できる上限＝8,000 Hz（計算） | SLP3 第15章（式ではなく「1周期に2標本、上限は半分」の記述から計算） | verified |
| G-06-082 | 英語とヒンディー語の有気音（音素と異音） | MIT OCW 24.900 Phonology Summary | verified |
| G-06-083 | DNN-HMM の説明 | Hinton et al. 2012、SLP3 第16章 | verified |
| G-06-084 | 空欄補充：Causal と Dilated | WaveNet | verified |
| G-06-085 | DQN の2つの工夫＝経験再生とターゲットネットワーク | Mnih et al. 2015 | verified |
| G-06-086 | CTDE | MADDPG、Tan 1993 | verified |
| G-06-087 | オンラインとオフライン | Levine et al. 2020 | verified |
| G-06-088 | 空欄補充：報酬モデル | Ouyang et al. 2022 | verified |
| G-06-089 | 模倣学習の説明 | Ross et al. 2011 | verified |
| G-06-090 | 文章生成AI：GPT-3 の生成記事は人の記事と見分けにくい | Brown et al. 2020 | verified |
| G-06-091 | 拡散モデルの順過程・逆過程・ガイダンス | Ho et al. 2020、Dhariwal & Nichol 2021 | verified |
| G-06-092 | 対照学習の説明 | Chen et al. 2020 | verified |
| G-06-093 | NIC の構成 | Vinyals et al. 2014 | verified |
| G-06-094 | CLIP の学習 | Radford et al. 2021 | verified |
| G-06-095 | 局所的な説明の例 | Doshi-Velez & Kim 2017、LIME | verified |
| G-06-096 | 空欄補充：Guided Backpropagation | Selvaraju et al. | verified |
| G-06-097 | 知識の蒸留 | Hinton et al. 2015、FitNets | verified |
| G-06-098 | エッジコンピューティング（誤答にフォグ） | NIST SP 500-325 | verified |

- 足す先を変えたもの：なし。ただし C-06-001・C-06-025 は表では「問題を足す」だけだが、問題の根拠をカードでも読めるよう why に1〜2文足した
- 表の当てを替えたもの：エッジコンピューティングは「総務省『情報通信白書』」を探したが該当の解説ページを見つけられず、NIST SP 500-325 に替えた。DQN は Nature 本文を Google DeepMind 公開の PDF で読んだ。蒸留の「教師・生徒」の語は Hinton 2015 に無かったので FitNets を足した。Hussein et al. 2017（模倣学習のサーベイ）は開いておらず、DAgger の論文で確かめた。Tan 1993 は MIT Media Lab の講義資料置き場の PDF で読んだ
- 見直し：選択肢の長さと極端な語を機械で数え、G-06-080・086・096（正解だけ長い・短い）と G-06-095・098（誤答に「すべて」）を直した
- 正解の位置：前 A18/B16/C18/D17 → 後 A24/B25/C25/D24

## 数（自分で数えた結果）

| 章 | カード新規 | 説明を足したカード | links だけ足したカード | 問題 新規 | 問題 前→後 | カード 前→後 |
|---|---|---|---|---|---|---|
| 01 | 0 | 3 | 0 | 3 | 22→25 | 20→20 |
| 02 | 1 | 3 | 1 | 4 | 40→44 | 40→41 |
| 05 | 2 | 6 | 1 | 6 | 53→59 | 48→50 |
| 06 | 4 | 24 | 3 | 29 | 69→98 | 93→97 |
| 計 | 7 | 36 | 5 | 42 | 184→226 | 201→208 |

- 新しく足した問題・カードはすべて verified（unverified 0件）
- 「除いたもの」の表の語は作っていない

## あとでつなぐ links の候補（担当B・C の新しいカードが要るもの）

| 担当Aのカード | つなぎたい相手（他担当の新カード、表の名前） | 関係の案 |
|---|---|---|
| C-05-050 エンコーダ・デコーダ構造 | 04章 End-to-End 学習 | 関連（入力から出力まで1つのモデルで学習） |
| C-06-037 機械翻訳の変遷（NMT） | 04章 End-to-End 学習 | 具体例 |
| C-06-043 HMM による音声認識（DNN-HMM） | 04章 End-to-End 学習 | 対比（HMM を残すハイブリッド） |
| C-05-012 バッチ正規化 | 04章 重みの初期値（Xavier・He） | 関連（初期値への敏感さを和らげる） |
| C-05-012 バッチ正規化 | 07章 特徴量の正規化と標準化（スケーリング） | 対比（層の中の正規化／入力の前処理） |
| C-06-047 DQN | 03章 TD学習（時間的差分学習） | 部分（Q学習の目標値） |
| C-06-047 DQN | 03章 ベルマン方程式と動的計画法 | 背景 |
| C-06-097 模倣学習 | 03章 モデルフリーとモデルベース | 対比 |
| C-06-096 プロンプトエンジニアリング | 10章 プロンプトインジェクション | 対比（悪用の側） |
| C-06-096 プロンプトエンジニアリング | 10章 ハルシネーション | 関連 |
| C-06-089 エッジAI | 07章 クラウドのサービス形態（SaaS・PaaS・IaaS）とオンプレミス | 対比 |
| C-06-094 形態素解析とストップワード | 07章 データクレンジングと欠損値 | 関連（前処理） |
