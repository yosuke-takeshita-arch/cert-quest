// 呪われた地図（要件定義書 §3-9『呪われた地図』）。真ボスが現れてから一度も倒していない間、冒険の地図の絵に重ねる効果。新しい絵は使わない。
// 見た目は CSS（css/app.css の .map-curse）。ここは重ねる要素を作るだけ。操作は邪魔しない（pointer-events: none）。DOM 以外は触らない。
import { h } from '../ui.js';

export const CURSE_PARTICLES = 10; // 漂う暗い粒の数（少なめ。位置・速さは CSS の nth-child）
export const CURSE_LIFT_MS = 2800; // 呪いが晴れる演出の長さ（要件定義書: 2〜3秒）

/** 地図の絵に重ねる層。もや・霧2枚・粒・稲光・四隅の暗がり。 */
export function curseLayer() {
  const kids = [
    h('div', { class: 'map-curse-haze' }),
    h('div', { class: 'map-curse-fog f1' }),
    h('div', { class: 'map-curse-fog f2' }),
    ...Array.from({ length: CURSE_PARTICLES }, () => h('span', { class: 'map-curse-dot' })),
    h('div', { class: 'map-curse-bolt' }),
    h('div', { class: 'map-curse-vignette' }),
  ];
  return h('div', { class: 'map-curse', 'aria-hidden': 'true', 'data-map-curse': '1' }, ...kids);
}

/**
 * 呪いが晴れる演出。板（board）の cursed を外して lifting を付けると、地図の絵の明るさ・色が元に戻り、層が薄れる（CSS の transition）。
 * 終わったら層を外す。timers は setTimeout を渡せる（テスト用）。
 */
export function liftCurse(board, layer, wait = (fn, ms) => setTimeout(fn, ms)) {
  wait(() => {
    if (!board.isConnected) return;
    board.classList.remove('cursed');
    board.classList.add('lifting');
    layer.classList.add('lifting');
  }, 450);
  wait(() => {
    layer.remove();
    board.classList.remove('lifting');
  }, 450 + CURSE_LIFT_MS);
}
