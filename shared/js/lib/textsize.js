// 文字の大きさの設定。保存するのは settings.textSize（small / normal / large / xlarge）。
// 画面では <html data-text="..."> に付け、shared/css/app.css が html の font-size を切り替える
// （文字の大きさは rem で書いてあるので、アプリ全体の文字が一緒に変わる）。
// 倍率の数字は、CSS の html[data-text] の規則と同じ値（tests/textsize.test.js が突き合わせる）。

/** 選べる大きさ。左から小さい順。 */
export const TEXT_SIZES = ['small', 'normal', 'large', 'xlarge'];

/** 初期の大きさ（これまでの大きさ＝本文16px）。 */
export const DEFAULT_TEXT_SIZE = 'normal';

/** 倍率（本文16pxに対する）。 */
export const TEXT_SCALE = { small: 0.9, normal: 1, large: 1.15, xlarge: 1.3 };

/** 設定画面に出す名前。 */
export const TEXT_SIZE_LABEL = { small: '小さめ', normal: 'ふつう', large: '大きめ', xlarge: 'とても大きい' };

/** 保存されていた値を、選べる大きさに直す。古い記録（無い）・ありえない値・文字以外は「ふつう」。 */
export function normalizeTextSize(v) {
  return typeof v === 'string' && TEXT_SIZES.includes(v) ? v : DEFAULT_TEXT_SIZE;
}
