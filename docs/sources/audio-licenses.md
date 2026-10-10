# 音素材のライセンス記録（BGM・効果音）

このリポジトリは公開されていて、音のファイルは誰でも取り出せる。だから使う素材は **CC0（パブリックドメイン相当。再配布・商用・改変が自由で、表示も不要）だけ**にする。素材を足すときは、配布ページを取得して CC0 と書かれていることを確かめ、この表に1行足す（足さないと `shared/tests/sound.test.js` が落ちる）。

確かめた日: **2026-10-04**（すべて、配布元のページを curl で取得して読んだ）。
CC0 の条文: <https://creativecommons.org/publicdomain/zero/1.0/>

## 効果音（`shared/audio/sfx/`）

配布元は Kenney（Kenney Vleugels, <https://kenney.nl>）と OpenGameArt（各行の配布ページ）。Kenney の素材は元のファイル名のまま置き、OpenGameArt の素材は用途が分かる名前に付け替えた（元のファイル名は各行に書いた）。

| ファイル | 使う場面 | 作者 | 配布ページ | ライセンス | 確かめた箇所 |
|---|---|---|---|---|---|
| `ok_gold-coin.ogg` | 正解（約1.0秒・14,221 バイト。元のファイル名 `coin_0.ogg`） | Aeva | https://opengameart.org/content/gold-coin-6 | CC0 | 2026-10-04 確認。配布ページの License(s) 欄が CC0（creativecommons.org/publicdomain/zero/1.0/ へのリンク）、CC-BY の記載なし。Author 欄は Aeva。先生が候補を聞き比べて選んだ。前の `confirmation_001.ogg`（Kenney Interface Sounds、下の A）は単音で物足りなかったため差し替え |
| `ng_lose-trumpet.ogg` | 不正解（約1.1秒・18,625 バイト。元のファイル名 `losetrumpet.ogg`） | 0new4y | https://opengameart.org/content/game-over-trumpet-sfx | CC0 | 2026-10-04 確認。配布ページの License(s) 欄が CC0（creativecommons.org/publicdomain/zero/1.0/ へのリンク）、CC-BY の記載なし。Author 欄は 0new4y。先生が候補を聞き比べて選んだ。前の `error_003.ogg`（Kenney。その前は bong_001）は単音で物足りなかったため差し替え |
| `level_8bit-fanfare.ogg` | レベルアップ（約3.1秒・42,558 バイト。元のファイル名 `life.ogg`） | Haley | https://opengameart.org/content/8bit-fanfare-jingle-the-lick | CC0 | 2026-10-05 確認。配布ページの License(s) 欄が CC0（creativecommons.org/publicdomain/zero/1.0/ へのリンク）、CC-BY の記載なし。先生が候補を聞き比べて選んだ。前の Kenney のジングルは単音で物足りなかったため差し替え。Author 欄は Haley |
| `badge_new-thing-get.ogg` | バッジ獲得（約5.3秒・173,459 バイト。元のファイル名 `newthingget.ogg`） | congusbongus | https://opengameart.org/content/new-thing-get | CC0 | 2026-10-04 確認。配布ページの License(s) 欄が CC0、creativecommons.org/publicdomain/zero/1.0/ へのリンクあり、CC-BY の記載なし。Author 欄は congusbongus。先生が候補を聞き比べて選んだ。前の `jingles_SAX07.ogg`（Kenney）は単音で物足りなかったため差し替え |
| `stars_sparkle.wav` | 星が増えた（約1.6秒・143,532 バイト。元は zip 内の `Cure5.wav`。ステレオをモノラルにした。周波数は元の 44.1kHz のまま） | Someoneman | https://opengameart.org/content/cure-magic | CC0 | 2026-10-05 確認。配布ページの License(s) 欄が CC0（creativecommons.org/publicdomain/zero/1.0/ へのリンク）、CC-BY の記載なし。先生が候補を聞き比べて選んだ。前の Kenney のジングルは単音で物足りなかったため差し替え。Author 欄は Someoneman |
| `goal_cure.wav` | 1日の目標（約1.2秒・102,952 バイト。元は zip 内の `Cure2.wav`。ステレオをモノラルにした） | Someoneman | https://opengameart.org/content/cure-magic | CC0 | 2026-10-05 確認。配布ページの License(s) 欄が CC0（creativecommons.org/publicdomain/zero/1.0/ へのリンク）、CC-BY の記載なし。先生が候補を聞き比べて選んだ。前の Kenney のジングルは単音で物足りなかったため差し替え。Author 欄は Someoneman |
| `start_16bit-success.ogg` | タイトル画面の「タップしてはじめる」（開始の音。約2.3秒・58,364 バイト。元のファイル名 `sfx_-_success.ogg`） | flush | https://opengameart.org/content/16bit-success-sound | CC0 | 2026-10-04 確認。配布ページの License(s) 欄が CC0、creativecommons.org/publicdomain/zero/1.0/ へのリンクあり、CC-BY の記載なし。Author 欄は flush。先生が候補8つを聞き比べて選んだ。前の `jingles_NES05.ogg`（Kenney）は約100Hzの低いベースが中心で、スマホでは弱く聞こえたため差し替え |
| `drop_001.ogg` | キャラクター（サニー・あい先生）の絵をタップしたとき（『ポンッ』。約0.11秒・5,859 バイト。元のファイル名のまま） | Kenney | https://kenney.nl/assets/interface-sounds | CC0 | 2026-10-06 に、2026-10-04 に取った zip（`kenney_interface-sounds.zip`、834,536 バイト）の中の `Audio/drop_001.ogg` を使用。同じ zip の `License.txt` が『License: (Creative Commons Zero, CC0)』（下の A）。先生が候補を聞き比べて選んだ |
| `boss-win_victory.mp3` | ボス戦でボスを倒したときのファンファーレ（約4.0秒・61,263 バイト。元のファイル名 `Victory_0.mp3`（ページ上の表示は `Victory.mp3`）。元は約4.9秒・65,152 バイト。後ろの無音（3.9秒以降の最大音量が約 -91dB）を、ffmpeg で再エンコードせず `-c copy -t 4.0` で切った） | celestialghost8 | https://opengameart.org/content/victory | CC0 | 2026-10-09 に配布ページを curl で取得して確認。投稿情報の欄に『Author: celestialghost8』『License(s): CC0』（リンクは creativecommons.org/publicdomain/zero/1.0/ の1つだけ）、CC-BY・OGA-BY・GPL の語はページに無い。Copyright/Attribution Notice 欄は無い。ページの mp3 のリンク（`https://opengameart.org/sites/default/files/Victory_0.mp3`、`length=65152`）から取り直し、手元の原本と cmp で一致することを確かめた。先生が候補を聞き比べて選んだ（2026-10-09）。前はプログラムで鳴らす音（`lib/bossmusic.js` の `fanfare`）。ファイルが読めないときはそちらに戻る |
| `boss-hit_snare.ogg` | ボス戦で正解してボスに当たったとき（約0.22秒・6,520 バイト。元は `snare.wav`（9,874 バイト）を ffmpeg で ogg（Vorbis）に変換。長さは変えていない） | Spring Spring | https://opengameart.org/content/8-bitlo-fi-snare-drum-sound | CC0 | 2026-10-09 に配布ページを curl で取得して確認。投稿情報の欄に『Author: Spring Spring』『License(s): CC0』（リンクは creativecommons.org/publicdomain/zero/1.0/ の1つだけ）、CC-BY・OGA-BY・GPL の語はページに無い。Copyright/Attribution Notice 欄は無い。ページの wav のリンク（`https://opengameart.org/sites/default/files/snare.wav`、`length=9874`）から取り直し、手元の原本と cmp で一致することを確かめた。先生が候補を聞き比べて選んだ（2026-10-09）。ファイルが読めないときはプログラムの音（`lib/bossmusic.js` の `hit`）に戻る |
| `boss-hurt_explosion02.ogg` | ボス戦で間違えて、ボスからダメージをもらったとき（『ドン』。約0.41秒・11,311 バイト。元は zip `Sound03ogg.zip`（45,661 バイト）の中の `explosion02.ogg`。変換も加工もせず元のまま） | crazyduckgames | https://opengameart.org/content/soundpack-03 | CC0 | 2026-10-09 に配布ページを curl で取得して確認。投稿情報の欄に『Author: crazyduckgames』『Tags: 8bit explosion explosions』『License(s): CC0』（リンクは creativecommons.org/publicdomain/zero/1.0/ の1つだけ）、CC-BY・OGA-BY・GPL の語はページに無い。Copyright/Attribution Notice 欄は無い。ページの zip のリンク（`https://opengameart.org/sites/default/files/Sound03ogg.zip`、`length=45661`）から取り直し、先に取ってあった zip と cmp で一致、中の `explosion02.ogg` を unzip して使った。先生が候補を聞き比べて選んだ（2026-10-09）。ボス戦で間違えたときは、ふつうの不正解の音（`ng_lose-trumpet.ogg`）の代わりにこの音を鳴らす（重ねない）。ファイルが読めないときはふつうの不正解の音に戻る |
| `boss-crit_cut.ogg` | ボス戦で会心の一撃が出たとき（約1.04秒・7,492 バイト。元は zip `sounds_5.zip`（150,635 バイト。ページ上の表示は `sounds.zip`）の中の `sounds/cut.ogg`。変換も加工も、後ろの切り詰めもせず元のまま。切り詰めても 21 バイトしか減らず、0.9 秒以降も最大 -39.5dB の余韻が残るため） | Baŝto | https://opengameart.org/content/nes-sounds | CC0 | 2026-10-10 に配布ページを curl で取得して確認。投稿情報の欄に『Author: Baŝto』『License(s): CC0』（リンクは creativecommons.org/publicdomain/zero/1.0/ の1つだけ）、CC-BY・OGA-BY・GPL・Attribution・credit の語はページに無い。Copyright/Attribution Notice 欄は無い。ページの zip のリンク（`https://opengameart.org/sites/default/files/sounds_5.zip`）から取り直し、サイズ 150,635 バイトが前に取ったものと同じこと、中の `sounds/cut.ogg` を unzip したものが手元の原本と cmp で一致することを確かめた。先生が候補8つを聞き比べて選んだ（2026-10-10）。会心の一撃のときは、ふつうの当たり（`boss-hit_snare.ogg`）の代わりにこの音を鳴らす（重ねない）。元の音が snare より約6dB 小さいので、再生の倍率を 1.9 倍にしている。ファイルが読めないときはプログラムの会心の音（`lib/bossmusic.js` の `crit`）に戻る |

- **A（Interface Sounds）**: 配布ページの `License` 欄が『Creative Commons CC0』、ページの説明（og:description）が『Download this package (100 assets) for free, CC0 licensed!』。ダウンロードした zip（`kenney_interface-sounds.zip`、834,536 バイト）の中の `License.txt` に『License: (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/』『This content is free to use in personal, educational and commercial projects.』『Support us by crediting Kenney or www.kenney.nl (this is not mandatory)』とある。
- **B（Music Jingles）**: 配布ページの `License` 欄が『Creative Commons CC0』、説明が『Download this package (85 assets) for free, CC0 licensed!』。zip（`kenney_music-jingles.zip`、1,239,525 バイト）の中の `License.txt` に『License (Creative Commons Zero, CC0)』『You may use these assets in personal and commercial projects.』『Credit (Kenney or www.kenney.nl) would be nice but is not mandatory.』とある。`jingles_NES05.ogg` を足した 2026-10-04 に、配布ページ <https://kenney.nl/assets/music-jingles> から zip（`kenney_music-jingles.zip`）を取り直し、サイズが 1,239,525 バイトで前と同じこと、中の `License.txt` が『License (Creative Commons Zero, CC0)』『You may use these assets in personal and commercial projects.』であること、`jingles_NES05.ogg` が zip の中のファイルと一致（cmp）することを確かめた。
- Kenney は表示が要らないと明記しているが、礼儀として出どころをここに残している。

## BGM（`shared/audio/bgm/`）

配布元は OpenGameArt.org。ファイル名は空白や記号を避けるため付け替えたものがある（元の名前は下の表）。曲は6曲。設定で、全曲を順番に流す「おまかせ」か、1曲を選んでくり返すかを選べる。

| ファイル | 元のファイル | 長さ・大きさ | 作者 | 配布ページ | ライセンス | 確かめた箇所 |
|---|---|---|---|---|---|---|
| `contemplation.mp3` | `Contemplation.mp3` | 約120秒・2,405,271 バイト | Joth | <https://opengameart.org/content/contemplation-0> | CC0 | 下の C |
| `jrpg-piano.mp3` | `JRPG Piano.mp3` | 約25秒・501,990 バイト | Joth | <https://opengameart.org/content/jrpg-piano> | CC0 | 下の C |
| `bluebonnet.mp3` | `bluebonnet_in_b_major_looped_0.mp3` | 約109秒・2,448,600 バイト | Kistol | <https://opengameart.org/content/bluebonnet> | CC0 | 下の D |
| `calm-loop.mp3` | `Relaxing_0.mp3` | 約19秒・314,222 バイト | wipics | <https://opengameart.org/content/calm-loop> | CC0 | 下の D |
| `happy-lullaby.mp3` | `song17.mp3` | 約40秒・442,152 バイト | cynicmusic | <https://opengameart.org/content/happy-lullaby-song17> | CC0 | 下の D |
| `chill-lofi.mp3` | `ChillLofiR_0.mp3`（ページ上の表示名は `ChillLofiR.mp3`） | 約123秒・2,717,205 バイト | omfgdude | <https://opengameart.org/content/chill-lofi-inspired> | CC0 | 下の D |

- **C**: 各ページの投稿情報の欄に『Author: Joth』『Art Type: Music』『License(s): CC0』とある（`CC-BY` や `Attribution` の語はページに無い）。タグは Contemplation が『loop Ambient ambience calm thoughtful melancholy sad background』、JRPG Piano が『loop RPG jrpg calm piano slow』。ファイルはそれぞれのページに付いているリンクから取った。投稿日は Contemplation が 2018-07-01、JRPG Piano が 2016-05-20。
- 流れる順（おまかせのとき）は、Contemplation 1回 → JRPG Piano 4回 → Bluebonnet 1回 → Calm Loop 5回 → Happy Lullaby 3回 → Chill Lofi 1回（どれも約100〜120秒）→ 最初に戻る（`shared/js/lib/sound.js` の `BGM_TRACKS`）。設定で1曲を選んだら、その曲だけをくり返す。
- 曲ごとに元の音の大きさが違うので、曲ごとに音量の補正（`trim`）を掛けている。実測の大きさ（RMS）・ピーク・補正は `shared/js/lib/sound.js` の `BGM_TRACKS` に書いてある。
- **D**（2026-10-04 に各ページを curl で取得して確かめた）: 各ページの投稿情報の欄に『License(s): CC0』があり、ライセンスのリンクは <https://creativecommons.org/publicdomain/zero/1.0/>（cc0 のアイコンつき）。`CC-BY` や `Attribution` を求める記載は無い。Bluebonnet は作者 Kistol・タグ『neoclassical Classical piano soft relaxing gentle … loopable looped』（「looped」版のファイルを使用）。Calm Loop は作者 wipics・タグ『relaxing loop chill Ambient calm synths percussion』・Copyright/Attribution Notice 欄が『Public Domain』。Happy Lullaby は作者 cynicmusic・タグ『lullaby happy calm relaxing Puzzle bells』。Chill Lofi Inspired は作者 omfgdude・タグ『chill lofi jazzy piano drums arrangement hip hop』・説明『You may use this however you like』。ファイルは mp3 版（ページ上の表示は `ChillLofiR.mp3`）を使用。

### タイトル曲（`shared/audio/bgm/` に置く。`BGM_TRACKS`（設定の曲の一覧・おまかせ）には入れない。`sound.js` の `TITLE_BGM`）

| ファイル | 元のファイル | 長さ・大きさ | 作者 | 配布ページ | ライセンス | 確かめた箇所 |
|---|---|---|---|---|---|---|
| `title_once-upon-a-time.mp3` | `once_upon_a_time_loop.mp3`（「Once Upon a Time (loop)」） | 約58秒・923,596 バイト（元は 256kbps・1,848,968 バイト。ffmpeg で 128kbps に変換した、先生が聞いた版） | TAD | <https://opengameart.org/content/once-upon-a-time-loop> | CC0 | 下の E |

- **E**（2026-10-06 に配布ページを curl で取得して確かめた）: 投稿情報の欄に『Author: TAD』『License(s): CC0』（リンクは <http://creativecommons.org/publicdomain/zero/1.0/>）があり、`CC-BY` や `Attribution` を求める記載は無い。ファイルはページの mp3 のリンク（`https://opengameart.org/sites/default/files/once_upon_a_time_loop.mp3`）から取り、手元の原本（1,848,968 バイト）と cmp で一致することを確かめた。タイトル画面だけで流す（BGM の設定に従う）。先生が7つの候補を聞き比べて F を選んだ（2026-10-06）。

### ボス戦の曲（`shared/audio/bgm/` に置く。`BGM_TRACKS`（設定の曲の一覧・おまかせ）には入れない。`sound.js` の `BOSS_BGM`）

| ファイル | 元のファイル | 長さ・大きさ | 作者 | 配布ページ | ライセンス | 確かめた箇所 |
|---|---|---|---|---|---|---|
| `boss_8-bit-danger-strong-boss.mp3` | `8-bit_danger_strong_boss_0.mp3`（「8-bit Danger!! Strong Boss」。ページ上のファイル名は `8-bit_danger_strong_boss.mp3`） | 約133.7秒・2,140,413 バイト（元は 320kbps・5,348,902 バイト。ffmpeg で 128kbps に変換した版。先生が聞いたのは元の 320kbps の原本で、曲は同じ） | HydroGene | <https://opengameart.org/content/8-bit-danger-strong-boss> | CC0 | 下の F |

- **F**（2026-10-09 に配布ページを curl で取得して確かめた）: 投稿情報の欄に『Author: HydroGene』『License(s): CC0』（リンクは <http://creativecommons.org/publicdomain/zero/1.0/>、ページ内のライセンスのリンクはこの1種類だけ）があり、`CC-BY` を求める記載は無い。Copyright/Attribution Notice 欄は『credits are NOT mandatory, but I'm curious to know what you will do with it, so don't hesitate to share :)』（表示は必須でない）。ファイルはページの mp3 のリンク（`https://opengameart.org/sites/default/files/8-bit_danger_strong_boss_0.mp3`、ページに `length=5348902`）から取り直し、手元の原本（5,348,902 バイト）と cmp で一致することを確かめた。先生が8曲を聞き比べて選んだ（2026-10-09）。章のボス戦の間だけ流す（問題中の BGM の設定に従う）。ファイルが取れない・鳴らせないときは、プログラムで鳴らす昔のゲーム機風の曲（`lib/bossmusic.js`。素材を使わない）に戻る。

## 確かめていないこと

- 音そのものは聞いていない（ライセンスとファイルの大きさ・長さを確かめただけ）。曲・効果音の「合っているか」は、実機で先生が聞いて決める。差し替えるときは `shared/js/lib/sound.js` の表と `shared/sw-core.js` の `SFX` と、この表を直す。
- OpenGameArt の投稿者が、他人の曲を CC0 として投稿している可能性は、ページの記載からは見分けられない（投稿者本人の申告を信じている）。
- ファイルの中のタグ（ID3）などに別のライセンス表記が無いかは見ていない。

## 検討して使わなかったもの

- Kenney の長いループ曲（`music-loops`）は、配布ページが 404（2026-10-04）で、取得できなかった。
- OpenGameArt の Lonely Night（作者 Centurion_of_war）は、ページに CC0 とあるが、ファイルが 3,665,368 バイトで1曲3MBを超えるので使わなかった。
- JRPG Pack 4 Calm（投稿者 SubspaceAudio、作者 Juhani Junkala。zip の `INFO.txt` に CC0 とある）は、ogg だけで mp3 が無く、古い iPhone の Safari で鳴らない恐れがあるのと、変換する道具が手元に無いので使わなかった。
