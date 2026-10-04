// 画面部品の小さな道具。データ由来の文字は必ず textContent で入れる（innerHTML は使わない）。
import { playSfx } from './audio.js';
import { celebrateSfx } from './lib/sound.js';
import { characterImageUrl, celebrationMascot } from './lib/characters.js';

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

const ICONS = {
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  map: 'M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z',
  review: 'M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  cards: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
  more: 'M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  flame: 'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  gear: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
};

/** バッジの絵の置き場（共通＝shared/images/badges/、章の制覇＝このアプリの images/badges/）。 */
export function badgeBases() {
  return { sharedBase: new URL('../images/badges/', import.meta.url).href, appBase: new URL('./images/badges/', location.href).href };
}

/**
 * バッジの絵（円形）。名前は隣に文字で出ているので、alt は空・読み上げ対象外にする（二重に読ませない）。
 * 読み込めなかったとき（章の絵がまだ無い等）は、fallback（記号の名前）の記号に差し替える。fallback が null なら何も出さない。
 */
export function badgeImg(url, cls, fallback) {
  const img = h('img', { class: 'badge-img ' + (cls || ''), src: url, alt: '', 'aria-hidden': 'true', decoding: 'async' });
  img.addEventListener('error', () => {
    if (fallback) img.replaceWith(icon(fallback));
    else img.remove();
  });
  return img;
}

/** キャラクターの絵の置き場（shared/images/characters/）。 */
export function characterBase() {
  return new URL('../images/characters/', import.meta.url).href;
}

/** キャラクターの絵。飾りなので alt は空・読み上げ対象外（意味のある言葉は文字で出す）。知らない名前は null。読み込めなかったら消える。 */
export function characterImg(name, cls) {
  const url = characterImageUrl(name, characterBase());
  if (!url) return null;
  const img = h('img', { class: 'char-img ' + (cls || ''), src: url, alt: '', 'aria-hidden': 'true', 'data-char': name, width: '96', height: '96', decoding: 'async' });
  img.addEventListener('error', () => img.remove());
  return img;
}

/** 絵と一言の並び（吹き出し）。絵が無い名前なら何も出さない。text が無ければ絵だけ。 */
export function mascotLine(art, text, cls) {
  const img = characterImg(art, 'mascot-img');
  if (!img) return null;
  return h('div', { class: 'mascot-line ' + (cls || '') }, img, text ? h('p', { class: 'mascot-say', text }) : null);
}

export function icon(name, cls) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon' + (cls ? ' ' + cls : ''));
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', ICONS[name] || '');
  p.setAttribute('fill', 'currentColor');
  svg.appendChild(p);
  return svg;
}

export function stars(n, max = 3) {
  const w = h('span', { class: 'stars', role: 'img', 'aria-label': '星' + n + '／' + max });
  for (let i = 0; i < max; i++) w.appendChild(icon('star', i < n ? 'on' : 'off'));
  return w;
}

// ---- 通知（トースト） ----
let toastBox = null;
export function toast(message, kind = '') {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastBox);
  }
  const t = h('div', { class: 'toast ' + kind, text: message });
  toastBox.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ---- 演出 ----
export function burst(anchor) {
  if (!anchor || !anchor.getBoundingClientRect) return;
  const r = anchor.getBoundingClientRect();
  const box = h('div', { class: 'burst', 'aria-hidden': 'true' });
  box.style.left = r.left + r.width / 2 + 'px';
  box.style.top = r.top + r.height / 2 + 'px';
  for (let i = 0; i < 14; i++) {
    const a = (Math.PI * 2 * i) / 14;
    const d = 60 + (i % 3) * 22;
    const s = h('span', { class: 'confetti c' + (i % 5) });
    s.style.setProperty('--dx', Math.round(Math.cos(a) * d) + 'px');
    s.style.setProperty('--dy', Math.round(Math.sin(a) * d) + 'px');
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 900);
}

export function vibrate(settings, pattern) {
  try {
    if (settings && settings.vibrate && navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) { /* 非対応端末は何もしない */ }
}

// 効果音。kind: 'ok'（正解）／'ng'（不正解）／'up'（レベルアップ）。鳴らす本体は audio.js。
export function beep(settings, kind) {
  playSfx(settings, kind === 'up' ? 'level' : kind);
}

// ---- お祝いの画面（画面いっぱい。複数あるときは1つずつ順に） ----
// events: { kind:'level', level } | { kind:'badge', name, desc, image? } | { kind:'stars', stars, title } | { kind:'goal', goal }
// opts: { settings, next, startable, onStart }
//   next … 次の目標（title / remainText / ratio）。最後のお祝いの下にだけ出す。
//   onStart(next) … 「これを始める」を押したとき。startable が false なら、ボタンは「ホームに戻る」になる。
export function celebrate(events, opts = {}) {
  if (!events || !events.length) return;
  const { settings, next, onStart } = opts;
  const startable = opts.startable !== false;
  const prevFocus = document.activeElement;
  const back = h('div', { class: 'celebrate-back' });
  let idx = 0;
  let confetti = null;

  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey);
    if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key !== 'Tab') return;
    const f = Array.from(back.querySelectorAll('button')).filter((b) => !b.disabled);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  function makeConfetti() {
    const box = h('div', { class: 'celebrate-confetti', 'aria-hidden': 'true' });
    for (let k = 0; k < 64; k++) {
      const s = h('span', { class: 'confetti c' + (k % 5) });
      s.style.left = Math.round(Math.random() * 100) + '%';
      s.style.setProperty('--delay', (Math.random() * 0.9).toFixed(2) + 's');
      s.style.setProperty('--dur', (1.8 + Math.random() * 1.6).toFixed(2) + 's');
      s.style.setProperty('--sway', Math.round(Math.random() * 120 - 60) + 'px');
      box.appendChild(s);
    }
    return box;
  }

  function describe(ev) {
    if (ev.kind === 'level') return { head: 'レベルアップ！', title: 'Lv ' + ev.level, sub: 'レベル ' + ev.level + ' になりました', emblem: h('div', { class: 'celebrate-emblem lv' }, h('span', { class: 'lv-label', text: 'Lv' }), h('strong', { text: String(ev.level) })) };
    if (ev.kind === 'badge') return { head: 'バッジ獲得！', title: ev.name, sub: ev.desc || '', emblem: ev.image ? h('div', { class: 'celebrate-emblem badge art' }, badgeImg(ev.image, 'celebrate-badge-img', 'star')) : h('div', { class: 'celebrate-emblem badge' }, icon('star')) };
    if (ev.kind === 'stars') return { head: '星が増えました！', title: ev.title, sub: '星 ' + ev.stars + ' つ', emblem: h('div', { class: 'celebrate-emblem stars' }, stars(ev.stars)) };
    return { head: '今日の目標を達成！', title: ev.goal + '問 達成', sub: '今日の目標の ' + ev.goal + '問に答えました', emblem: h('div', { class: 'celebrate-emblem goal' }, icon('check')) };
  }

  function show() {
    clear(back);
    const ev = events[idx];
    const d = describe(ev);
    const isLast = idx === events.length - 1;
    confetti = makeConfetti();
    back.appendChild(confetti);
    const closeBtn = h('button', { class: 'btn ghost icon-only celebrate-close', type: 'button', 'aria-label': '閉じる', onClick: close }, icon('close'));
    const panel = h('div', { class: 'celebrate', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'celebrate-title' },
      closeBtn,
      h('p', { class: 'celebrate-head', text: d.head }),
      h('div', { class: 'celebrate-stage' }, d.emblem, characterImg(celebrationMascot(ev.kind), 'celebrate-mascot')),
      h('h2', { id: 'celebrate-title', class: 'celebrate-title', text: d.title }),
      d.sub ? h('p', { class: 'celebrate-sub', text: d.sub }) : null,
      events.length > 1 ? h('p', { class: 'small muted', text: (idx + 1) + ' / ' + events.length }) : null);
    let main;
    if (!isLast) {
      main = h('button', { class: 'btn primary big', type: 'button', onClick: () => { idx++; show(); } }, 'つぎへ');
      panel.appendChild(main);
    } else {
      if (next) {
        panel.appendChild(h('div', { class: 'celebrate-next' },
          h('p', { class: 'celebrate-next-text' }, h('strong', { text: '次はこれ：' }), next.remainText + 'で『' + next.title + '』'),
          h('div', { class: 'progress', 'aria-hidden': 'true' }, h('div', { class: 'progress-fill', style: { width: Math.round(next.ratio * 100) + '%' } }))));
        main = h('button', { class: 'btn primary big', type: 'button', onClick: () => { close(); if (onStart) onStart(next); } }, startable ? 'これを始める' : 'ホームに戻る');
        panel.appendChild(main);
        panel.appendChild(h('button', { class: 'btn big', type: 'button', onClick: close }, 'とじる'));
      } else {
        main = h('button', { class: 'btn primary big', type: 'button', onClick: close }, 'とじる');
        panel.appendChild(main);
      }
    }
    back.appendChild(panel);
    playSfx(settings, celebrateSfx(ev.kind));
    vibrate(settings, [80, 40, 80, 40, 160]);
    main.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  show();
  return close;
}

// ---- 下から出るシート（用語カードを問題の途中で開く用） ----
export function openSheet(build) {
  const prevFocus = document.activeElement;
  const body = h('div', { class: 'sheet-body' });
  const closeBtn = h('button', { class: 'btn ghost sheet-close', type: 'button', 'aria-label': '閉じる' }, icon('close'), '閉じる');
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': '用語カード' }, closeBtn, body);
  const back = h('div', { class: 'sheet-back' }, sheet);
  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey);
    if (prevFocus && prevFocus.focus) prevFocus.focus();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  closeBtn.addEventListener('click', close);
  back.addEventListener('click', (e) => {
    if (e.target === back) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  build(body, close);
  closeBtn.focus();
  return close;
}

export function externalLink(url, text) {
  return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: 'ext', text });
}
