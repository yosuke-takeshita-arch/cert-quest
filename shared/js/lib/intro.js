// 初めての「使い方の案内」: 何を、どの順で、誰が話すか。出すか出さないかの判定。純粋な関数と決まりだけ（画面の部品は views/intro.js）。
// 案内の文言はここ1か所にまとめる（あとで直しやすく）。話し手の名前は characters.js の CHARACTER_NAMES から引く。
// 保存するのは settings.introSeen（案内を見たか。true のとき、もう出さない）。

/** 案内の各ページ。art は shared/images/characters/ の絵の名前。1ページに1人まで（最後だけ柴犬のサニー）。 */
export const INTRO_SLIDES = [
  { art: 'sensei-hello', title: '地図から、ステージを選ぼう', text: 'はじめまして。地図からステージを選んで、問題を解いていきます。星を集めながら、先へ進もう。' },
  { art: 'sensei-point', title: 'まちがえても、だいじょうぶ', text: 'まちがえた問題は、「今日の復習」に戻ってきます。毎日、少しずつ解けば、ちゃんと覚えられるよ。' },
  { art: 'sensei-think', title: '解説と用語カードで、しっかり理解', text: '解いたあとは、解説と用語カードを見てみよう。図で説明している問題もあるよ。' },
  { art: 'shiba-cheer', title: '受験前は、模擬試験で力試し', text: '受験の前は、模擬試験で力試し。バッジや1日の目標で、楽しく続けよう。いっしょにがんばろう！' },
];

/** ボタンなどの言葉。 */
export const INTRO_TEXT = {
  next: '次へ',
  back: 'もどる',
  skip: 'とばす',
  start: 'はじめる',
  close: '閉じる',
  menu: '使い方',
};

/** 学習記録が空か（まだ1問も解いていない・バッジも星も試験の記録も無い）。state は defaultState の形。読めない値は「空でない」側に倒す。 */
export function recordIsEmpty(state) {
  if (!state || typeof state !== 'object') return false;
  const count = (o) => (o && typeof o === 'object' ? Object.keys(o).length : 0);
  const answered = state.totals && Number.isFinite(state.totals.answered) ? state.totals.answered : 0;
  const xp = Number.isFinite(state.xp) ? state.xp : 0;
  const exams = Array.isArray(state.exams) ? state.exams.length : 0;
  return answered === 0 && xp === 0 && count(state.qstats) === 0 && count(state.stages) === 0 && count(state.badges) === 0 && exams === 0;
}

/** 起動のとき、案内を出すか。まだ見ていなくて、学習記録が空のときだけ（すでに使っている人の邪魔をしない）。 */
export function needsIntro(state) {
  if (!state || typeof state !== 'object') return false;
  if (state.settings && state.settings.introSeen === true) return false;
  return recordIsEmpty(state);
}
