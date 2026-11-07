// 「新しい問題が届きました」の帯を出すかの判定。決まりは docs/01_要件定義/要件定義書.md の 3-2-c。
// 開いたとき service worker が動いていた（controller があった）うえで、controllerchange が起きたら出す。
// 初めて入れたとき（開いた時点で controller が無く、claim で controllerchange が起きる）は出さない（データはネットから取っていて新しい）。

/** 帯の文言。 */
export const UPDATE_NOTICE_TEXT = '新しい問題が届きました';
export const UPDATE_NOTICE_BUTTON = '開き直す';
export const UPDATE_NOTICE_LATER = 'あとで';

/**
 * 判定器を作る。hadController は、開いた時点で controller があったか。
 * onChange() を controllerchange のたびに呼ぶと、帯を出すべき最初の1回だけ true を返す（2回目以降は false＝帯は1つだけ）。
 */
export function createUpdateWatcher(hadController) {
  let shown = false;
  return {
    onChange() {
      if (!hadController || shown) return false;
      shown = true;
      return true;
    },
  };
}
