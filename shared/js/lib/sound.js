// 音の設定の正規化と、どの音を鳴らすかの表。ブラウザには触らない（audio.js が鳴らす）。
// 素材はすべて CC0。出どころは docs/sources/audio-licenses.md。
export const DEFAULT_SFX_VOLUME = 70;
export const DEFAULT_BGM_VOLUME = 40;

/** 音量（0〜100）を整数に直す。数字でない・範囲外は初期値／端に寄せる。 */
export function normalizeVolume(v, fallback) {
  if (typeof v === 'string' && v.trim() !== '') v = Number(v);
  const n = v;
  if (typeof n !== 'number') return fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * settings の音の項目を、正しい形に直して返す（settings 自体を書き換える）。
 *  sound … 効果音のオン／オフ（これまでの項目をそのまま引き継ぐ。古い記録でオンの人はオンのまま）
 *  sfxVolume / bgmVolume … 0〜100
 *  bgm … 問題を解いているあいだの BGM のオン／オフ（初期オフ）。bgmTrack … その曲
 *  bgmHome … それ以外（タイトル・ホーム・地図など）の BGM のオン／オフ（初期オフ）。bgmHomeTrack … その曲（初期はタイトル曲）
 *  bgmVolume … BGM の音量（2つの場面で共通）
 * 古い記録（bgmHome が無い）の移行は mergeState がやる（bgm がオンだった人は bgmHome もオン。ここでは見分けられない）。
 */
export function normalizeSoundSettings(settings) {
  const s = settings;
  s.sound = s.sound === true;
  s.bgm = s.bgm === true;
  s.bgmHome = s.bgmHome === true;
  s.sfxVolume = normalizeVolume(s.sfxVolume, DEFAULT_SFX_VOLUME);
  s.bgmVolume = normalizeVolume(s.bgmVolume, DEFAULT_BGM_VOLUME);
  s.bgmTrack = normalizeBgmTrack(s.bgmTrack);
  s.bgmHomeTrack = normalizeHomeTrack(s.bgmHomeTrack);
  return s;
}

/** それ以外の場面の曲の選択。'title'＝タイトル曲（初期）、'auto'＝おまかせ（BGM_TRACKS を順番に）、それ以外は BGM_TRACKS の id。知らない値は 'title'。 */
export function normalizeHomeTrack(v, tracks = BGM_TRACKS) {
  if (v === TITLE_BGM.id || v === BGM_AUTO) return v;
  return typeof v === 'string' && tracks.some((t) => t.id === v) ? v : TITLE_BGM.id;
}

/**
 * いま流すべき BGM（流さないなら null）。場面は、問題を解いている（inQuiz）か問題中の曲を試し聴き中（preview）なら問題中、それ以外はそれ以外。
 * その場面のオン／オフが切れている・アプリが裏に回っている（hidden）なら null。
 * 返すもの: { scene: 'quiz' | 'other', track: 'auto' | 'title' | BGM_TRACKS の id }
 */
export function bgmPlan(s, { inQuiz = false, preview = false, hidden = false } = {}) {
  if (!s || hidden) return null;
  if (inQuiz || preview) return s.bgm ? { scene: 'quiz', track: normalizeBgmTrack(s.bgmTrack) } : null;
  return s.bgmHome ? { scene: 'other', track: normalizeHomeTrack(s.bgmHomeTrack) } : null;
}

/** BGM の曲の選択。'auto'＝おまかせ（全曲を順番に）、それ以外は BGM_TRACKS の id。知らない値（古い記録・消えた曲）は 'auto'。 */
export const BGM_AUTO = 'auto';
export function normalizeBgmTrack(v, tracks = BGM_TRACKS) {
  return typeof v === 'string' && tracks.some((t) => t.id === v) ? v : BGM_AUTO;
}
/** 選択（'auto' か id）→ 曲の番号。おまかせ・知らない値は -1。 */
export function bgmTrackIndex(v, tracks = BGM_TRACKS) {
  return tracks.findIndex((t) => t.id === v);
}

// 効果音の目盛りは耳に合わせて2乗にする（半分の目盛りで半分の大きさには聞こえないため）。
export function sfxGain(volume) {
  const v = normalizeVolume(volume, DEFAULT_SFX_VOLUME) / 100;
  return v * v;
}
// BGM の素材は元の音がとても小さい（効果音は RMS 0.14〜0.27）。以前は 2乗×0.7 で、初期の 40 だと 0.11 倍になり、
// 実機ではほぼ聞こえなかった。そこで目盛りに比例させ、最大で BGM_GAIN_MAX 倍まで持ち上げる（40 で約1.04倍、100 で 2.6 倍）。
// さらに、素材ごとに元の音の大きさが違う（RMS が 0.036〜0.256）ので、曲ごとの補正 trim を掛けて、
// 同じ目盛りでどの曲も同じ大きさ（目盛り40で出力の RMS が約 TARGET_BGM_RMS）になるようにしている。
// trim ＝ TARGET_BGM_RMS ÷ (その曲の rms × bgmGain(40))。
// rms・peak は実測（2026-10-04。ブラウザで decodeAudioData し、全チャンネルの二乗平均の平方根と最大の絶対値）。
// 目盛り100でも peak × trim × BGM_GAIN_MAX が 1 未満（割れない）になる値にする（Bluebonnet はピークが高いので、これが目標の上限を決めた）。
// 素材を替えたら、rms・peak を測り直して trim を出し直す。
export const BGM_GAIN_MAX = 2.6;
export const TARGET_BGM_RMS = 0.042;
export function bgmGain(volume, trim = 1) {
  const v = normalizeVolume(volume, DEFAULT_BGM_VOLUME) / 100;
  return v * BGM_GAIN_MAX * trim;
}

// 効果音。キー → ファイル（shared/audio/sfx/ の中）。
//  ok=正解 ng=不正解 level=レベルアップ badge=バッジ stars=星 goal=1日の目標 start=タイトル画面の「タップしてはじめる」 tap=キャラクターの絵をタップ
export const SFX_FILES = {
  ok: 'ok_gold-coin.ogg', // 2026-10-04 先生が聞き比べて選んだ（OpenGameArt「Gold Coin」Aeva、CC0）。前の confirmation_001（Kenney）は単音で物足りなかった
  ng: 'ng_lose-trumpet.ogg', // 2026-10-04 先生が聞き比べて選んだ（OpenGameArt「Game Over Trumpet SFX」0new4y、CC0）。前の error_003（Kenney）は単音で物足りなかった
  level: 'level_8bit-fanfare.ogg', // 2026-10-05 先生が聞き比べて選んだ。前の Kenney のジングルは単音で物足りなかった（OpenGameArt「8bit fanfare jingle "The Lick"」Haley、CC0）
  badge: 'badge_new-thing-get.ogg', // 2026-10-04 先生が聞き比べて選んだ（OpenGameArt「New Thing Get」congusbongus、CC0）。前の jingles_SAX07 は単音で物足りなかった
  stars: 'stars_sparkle.wav', // 2026-10-05 先生が聞き比べて選んだ。前の Kenney のジングルは単音で物足りなかった（OpenGameArt「Cure Magic」の Cure5、Someoneman、CC0。モノラルにした）
  goal: 'goal_cure.wav', // 2026-10-05 先生が聞き比べて選んだ。前の Kenney のジングルは単音で物足りなかった（OpenGameArt「Cure Magic」の Cure2、Someoneman、CC0。モノラルにした）
  tap: 'drop_001.ogg', // 2026-10-06 先生が聞き比べて選んだ。キャラクターの絵をタップするたびに鳴る『ポンッ』（Kenney Interface Sounds の drop_001、CC0。元のファイル名のまま）
  start: 'start_16bit-success.ogg', // 2026-10-04 先生が聞き比べて選んだ（OpenGameArt「16bit Success sound」flush、CC0）。前の jingles_NES05 は低いベースが中心でスマホでは弱かった
};

// BGM（shared/audio/bgm/ の中）。おまかせのときは順に流し、repeat 回くり返したら次へ（1回で約100秒）。最後まで行ったら最初に戻る。
//  id … 設定に保存する名前（変えない。曲を消したら、その id を指す記録は『おまかせ』に戻る）
//  name・mood … 設定画面に出す名前と雰囲気
//  trim・rms・peak … 上の音量の補正と、その実測
export const BGM_TRACKS = [
  { id: 'contemplation', file: 'contemplation.mp3', name: '静かな思索', mood: 'ゆったりしたアンビエント', repeat: 1, trim: 1.13, rms: 0.0356, peak: 0.26 },
  { id: 'jrpg-piano', file: 'jrpg-piano.mp3', name: 'ピアノの小品', mood: 'やさしく静かなピアノ', repeat: 4, trim: 0.77, rms: 0.0524, peak: 0.3281 },
  { id: 'bluebonnet', file: 'bluebonnet.mp3', name: 'ブルーボネット', mood: 'おだやかなクラシック調のピアノ', repeat: 1, trim: 0.55, rms: 0.074, peak: 0.672 },
  { id: 'calm-loop', file: 'calm-loop.mp3', name: 'ゆるいシンセ', mood: 'ゆったりしたシンセと軽い打楽器', repeat: 5, trim: 0.158, rms: 0.2558, peak: 1.0735 },
  { id: 'happy-lullaby', file: 'happy-lullaby.mp3', name: '子守歌のベル', mood: '鈴の音のやわらかい子守歌', repeat: 3, trim: 0.216, rms: 0.1869, peak: 1.0005 },
  { id: 'chill-lofi', file: 'chill-lofi.mp3', name: 'ローファイ・チル', mood: 'ローファイ風のジャズっぽいピアノ', repeat: 1, trim: 0.321, rms: 0.1259, peak: 1.0009 },
];

// タイトル画面だけで流す曲（2026-10-06 先生が聞き比べて選んだ。OpenGameArt「Once Upon a Time (loop)」TAD、CC0）。
// 設定の曲の一覧（BGM_TRACKS）・おまかせの順番には入れない。BGM の設定（オン／オフ・音量）に従う。
// trim・rms・peak は BGM_TRACKS と同じ測り方（2026-10-06。ブラウザで decodeAudioData し、全チャンネルの二乗平均の平方根と最大の絶対値）。
// trim ＝ TARGET_BGM_RMS ÷ (rms × bgmGain(40))。目盛り100でも peak × trim × BGM_GAIN_MAX が 1 未満（0.955）。
export const TITLE_BGM = { id: 'title', file: 'title_once-upon-a-time.mp3', name: 'Once Upon a Time', trim: 0.4, rms: 0.101, peak: 0.9182, fadeSec: 0.6 };

/** お祝いの種類 → 効果音のキー。 */
export function celebrateSfx(kind) {
  return kind === 'level' ? 'level' : kind === 'badge' ? 'badge' : kind === 'stars' ? 'stars' : 'goal';
}

/**
 * 次に流す曲。track は今の曲の番号、plays は今の曲を何回流し終えたか。
 * selected が曲の id なら、その曲をくり返す（おまかせ・知らない値なら、全曲を順番に）。
 */
export function nextBgmPosition(track, plays, tracks = BGM_TRACKS, selected = BGM_AUTO) {
  const sel = bgmTrackIndex(selected, tracks);
  if (sel >= 0) return { track: sel, plays: 0 };
  const cur = tracks[track] ? track : 0;
  if (plays < tracks[cur].repeat) return { track: cur, plays };
  return { track: (cur + 1) % tracks.length, plays: 0 };
}
