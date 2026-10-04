# 音素材のライセンス記録（BGM・効果音）

このリポジトリは公開されていて、音のファイルは誰でも取り出せる。だから使う素材は **CC0（パブリックドメイン相当。再配布・商用・改変が自由で、表示も不要）だけ**にする。素材を足すときは、配布ページを取得して CC0 と書かれていることを確かめ、この表に1行足す（足さないと `shared/tests/sound.test.js` が落ちる）。

確かめた日: **2026-10-04**（すべて、配布元のページを curl で取得して読んだ）。
CC0 の条文: <https://creativecommons.org/publicdomain/zero/1.0/>

## 効果音（`shared/audio/sfx/`）

配布元はどちらも Kenney（Kenney Vleugels, <https://kenney.nl>）。元のファイル名のまま置いている。

| ファイル | 使う場面 | 作者 | 配布ページ | ライセンス | 確かめた箇所 |
|---|---|---|---|---|---|
| `confirmation_001.ogg` | 正解 | Kenney | <https://kenney.nl/assets/interface-sounds>（Interface Sounds 1.0） | CC0 | 下の A |
| `bong_001.ogg` | 不正解 | Kenney | 同上 | CC0 | 下の A |
| `jingles_STEEL07.ogg` | レベルアップ | Kenney | <https://kenney.nl/assets/music-jingles>（Music Jingles） | CC0 | 下の B |
| `jingles_SAX07.ogg` | バッジ獲得 | Kenney | 同上 | CC0 | 下の B |
| `jingles_PIZZI07.ogg` | 星が増えた | Kenney | 同上 | CC0 | 下の B |
| `jingles_NES00.ogg` | 1日の目標 | Kenney | 同上 | CC0 | 下の B |

- **A（Interface Sounds）**: 配布ページの `License` 欄が『Creative Commons CC0』、ページの説明（og:description）が『Download this package (100 assets) for free, CC0 licensed!』。ダウンロードした zip（`kenney_interface-sounds.zip`、834,536 バイト）の中の `License.txt` に『License: (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/』『This content is free to use in personal, educational and commercial projects.』『Support us by crediting Kenney or www.kenney.nl (this is not mandatory)』とある。
- **B（Music Jingles）**: 配布ページの `License` 欄が『Creative Commons CC0』、説明が『Download this package (85 assets) for free, CC0 licensed!』。zip（`kenney_music-jingles.zip`、1,239,525 バイト）の中の `License.txt` に『License (Creative Commons Zero, CC0)』『You may use these assets in personal and commercial projects.』『Credit (Kenney or www.kenney.nl) would be nice but is not mandatory.』とある。
- Kenney は表示が要らないと明記しているが、礼儀として出どころをここに残している。

## BGM（`shared/audio/bgm/`）

配布元は OpenGameArt.org。どちらも作者は Joth。ファイル名は空白を避けるため付け替えた（元の名前は下の表）。

| ファイル | 元のファイル | 長さ・大きさ | 作者 | 配布ページ | ライセンス | 確かめた箇所 |
|---|---|---|---|---|---|---|
| `contemplation.mp3` | `Contemplation.mp3` | 約120秒・2,405,271 バイト | Joth | <https://opengameart.org/content/contemplation-0> | CC0 | 下の C |
| `jrpg-piano.mp3` | `JRPG Piano.mp3` | 約25秒・501,990 バイト | Joth | <https://opengameart.org/content/jrpg-piano> | CC0 | 下の C |

- **C**: 各ページの投稿情報の欄に『Author: Joth』『Art Type: Music』『License(s): CC0』とある（`CC-BY` や `Attribution` の語はページに無い）。タグは Contemplation が『loop Ambient ambience calm thoughtful melancholy sad background』、JRPG Piano が『loop RPG jrpg calm piano slow』。ファイルはそれぞれのページに付いているリンクから取った。投稿日は Contemplation が 2018-07-01、JRPG Piano が 2016-05-20。
- 流れる順は、Contemplation を1回 → JRPG Piano を4回（約100秒）→ 最初に戻る（`shared/js/lib/sound.js` の `BGM_TRACKS`）。

## 確かめていないこと

- 音そのものは聞いていない（ライセンスとファイルの大きさ・長さを確かめただけ）。曲・効果音の「合っているか」は、実機で先生が聞いて決める。差し替えるときは `shared/js/lib/sound.js` の表と `shared/sw-core.js` の `SFX` と、この表を直す。
- OpenGameArt の投稿者が、他人の曲を CC0 として投稿している可能性は、ページの記載からは見分けられない（投稿者本人の申告を信じている）。
- ファイルの中のタグ（ID3）などに別のライセンス表記が無いかは見ていない。

## 検討して使わなかったもの

- Kenney の長いループ曲（`music-loops`）は、配布ページが 404（2026-10-04）で、取得できなかった。
- OpenGameArt の Bluebonnet・Calm Loop・Lonely Night・JRPG Pack 4 Calm も、ページに CC0 とあるのを確かめたが、使っていない（聞き比べていない。長さ・大きさと、ページの説明にある calm（静か）・ambient（環境音）から、上の2曲を選んだ）。
