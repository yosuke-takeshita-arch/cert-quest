# 音素材のライセンス記録（BGM・効果音）

このリポジトリは公開されていて、音のファイルは誰でも取り出せる。だから使う素材は **CC0（パブリックドメイン相当。再配布・商用・改変が自由で、表示も不要）だけ**にする。素材を足すときは、配布ページを取得して CC0 と書かれていることを確かめ、この表に1行足す（足さないと `shared/tests/sound.test.js` が落ちる）。

確かめた日: **2026-10-04**（すべて、配布元のページを curl で取得して読んだ）。
CC0 の条文: <https://creativecommons.org/publicdomain/zero/1.0/>

## 効果音（`shared/audio/sfx/`）

配布元はどちらも Kenney（Kenney Vleugels, <https://kenney.nl>）。元のファイル名のまま置いている。

| ファイル | 使う場面 | 作者 | 配布ページ | ライセンス | 確かめた箇所 |
|---|---|---|---|---|---|
| `confirmation_001.ogg` | 正解 | Kenney | <https://kenney.nl/assets/interface-sounds>（Interface Sounds 1.0） | CC0 | 下の A |
| `error_003.ogg` | 不正解 | Kenney | 同上 | CC0 | 下の A。2026-10-04 に `bong_001.ogg` から差し替え（bong は約100Hz・0.12秒でスマホのスピーカーでは聞こえなかった。error_003 は約1kHz・0.53秒）。zip を取り直し、License.txt の CC0 とファイルが zip 内のものであることを確認 |
| `jingles_STEEL07.ogg` | レベルアップ | Kenney | <https://kenney.nl/assets/music-jingles>（Music Jingles） | CC0 | 下の B |
| `badge_new-thing-get.ogg` | バッジ獲得（約5.3秒・173,459 バイト。元のファイル名 `newthingget.ogg`） | congusbongus | https://opengameart.org/content/new-thing-get | CC0 | 2026-10-04 確認。配布ページの License(s) 欄が CC0、creativecommons.org/publicdomain/zero/1.0/ へのリンクあり、CC-BY の記載なし。Author 欄は congusbongus。先生が候補を聞き比べて選んだ。前の `jingles_SAX07.ogg`（Kenney）は単音で物足りなかったため差し替え |
| `jingles_PIZZI07.ogg` | 星が増えた | Kenney | 同上 | CC0 | 下の B |
| `jingles_NES00.ogg` | 1日の目標 | Kenney | 同上 | CC0 | 下の B |
| `start_16bit-success.ogg` | タイトル画面の「タップしてはじめる」（開始の音。約2.3秒・58,364 バイト。元のファイル名 `sfx_-_success.ogg`） | flush | https://opengameart.org/content/16bit-success-sound | CC0 | 2026-10-04 確認。配布ページの License(s) 欄が CC0、creativecommons.org/publicdomain/zero/1.0/ へのリンクあり、CC-BY の記載なし。Author 欄は flush。先生が候補8つを聞き比べて選んだ。前の `jingles_NES05.ogg`（Kenney）は約100Hzの低いベースが中心で、スマホでは弱く聞こえたため差し替え |

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

## 確かめていないこと

- 音そのものは聞いていない（ライセンスとファイルの大きさ・長さを確かめただけ）。曲・効果音の「合っているか」は、実機で先生が聞いて決める。差し替えるときは `shared/js/lib/sound.js` の表と `shared/sw-core.js` の `SFX` と、この表を直す。
- OpenGameArt の投稿者が、他人の曲を CC0 として投稿している可能性は、ページの記載からは見分けられない（投稿者本人の申告を信じている）。
- ファイルの中のタグ（ID3）などに別のライセンス表記が無いかは見ていない。

## 検討して使わなかったもの

- Kenney の長いループ曲（`music-loops`）は、配布ページが 404（2026-10-04）で、取得できなかった。
- OpenGameArt の Lonely Night（作者 Centurion_of_war）は、ページに CC0 とあるが、ファイルが 3,665,368 バイトで1曲3MBを超えるので使わなかった。
- JRPG Pack 4 Calm（投稿者 SubspaceAudio、作者 Juhani Junkala。zip の `INFO.txt` に CC0 とある）は、ogg だけで mp3 が無く、古い iPhone の Safari で鳴らない恐れがあるのと、変換する道具が手元に無いので使わなかった。
