// 画面部品の小さな道具。データ由来の文字は必ず textContent で入れる（innerHTML は使わない）。

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
};

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

let audio = null;
export function beep(settings, kind) {
  if (!settings || !settings.sound) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio = audio || new AC();
    const notes = kind === 'ok' ? [660, 880] : kind === 'up' ? [523, 659, 784, 1047] : [220];
    notes.forEach((f, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      g.gain.setValueAtTime(0.0001, audio.currentTime + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.15, audio.currentTime + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + i * 0.09 + 0.16);
      o.connect(g);
      g.connect(audio.destination);
      o.start(audio.currentTime + i * 0.09);
      o.stop(audio.currentTime + i * 0.09 + 0.18);
    });
  } catch (e) { /* 音が出せなくても学習は続ける */ }
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
