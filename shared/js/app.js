// 起動・ルーティング。資格固有のことは config.json と data/ からだけ読む。
import { h, clear, icon, toast } from './ui.js';
import { loadData } from './lib/data.js';
import { createStorage } from './lib/storage.js';
import { defaultState, recordAnswer } from './lib/progress.js';
import { badgeDefs, awardBadges } from './lib/badges.js';
import { dateKey } from './lib/srs.js';
import { STAR_THRESHOLDS } from './lib/scoring.js';
import { renderHome, renderMap, renderStage, renderReview } from './views/home.js';
import { renderCardList, renderCard } from './views/cards.js';
import { renderPlay } from './views/play.js';
import { renderExam } from './views/exam.js';
import { renderMore, renderBadges, renderSettings } from './views/more.js';

const NAV = [
  { id: 'home', label: 'ホーム', icon: 'home', hash: '#/home' },
  { id: 'map', label: '地図', icon: 'map', hash: '#/map' },
  { id: 'review', label: '復習', icon: 'review', hash: '#/review' },
  { id: 'cards', label: 'カード', icon: 'cards', hash: '#/cards' },
  { id: 'more', label: 'もっと', icon: 'more', hash: '#/more' },
];

function applyTheme(config) {
  const t = config.theme || {};
  const l = t.light || {};
  const d = t.dark || {};
  const css = [];
  const vars = (o) => Object.entries({ '--accent': o.accent, '--on-accent': o.onAccent, '--accent-soft': o.accentSoft }).filter(([, v]) => v).map(([k, v]) => k + ':' + v + ';').join('');
  if (vars(l)) css.push(':root{' + vars(l) + '}');
  if (vars(d)) css.push('@media (prefers-color-scheme: dark){:root{' + vars(d) + '}}');
  if (css.length) document.head.appendChild(h('style', { id: 'theme' }, css.join('\n')));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && l.accent) meta.setAttribute('content', l.accent);
}

function showFatal(root, message, detail) {
  clear(root);
  root.appendChild(h('div', { class: 'view' }, h('div', { class: 'card empty' }, h('h1', { text: '開けませんでした' }), h('p', { text: message }), detail ? h('p', { class: 'small muted', text: detail }) : null, h('button', { class: 'btn primary', type: 'button', onClick: () => location.reload() }, '再読み込み'))));
}

export async function start() {
  const root = document.getElementById('app');
  root.textContent = '読み込み中…';
  const params = new URLSearchParams(location.search);
  const sample = params.get('sample') === '1';

  let config;
  try {
    const res = await fetch('./config.json');
    if (!res.ok) throw new Error('config.json ' + res.status);
    config = await res.json();
  } catch (e) {
    return showFatal(root, '設定ファイル(config.json)を読めませんでした。', String(e.message || e));
  }
  applyTheme(config);
  document.title = config.name || document.title;

  const dataBase = new URL(sample ? './data/_sample/' : './data/', location.href).href;
  let data;
  try {
    data = await loadData({ dataBase });
  } catch (e) {
    return showFatal(root, 'データの読み込みで予期しない問題が起きました。', String(e.message || e));
  }

  const storage = createStorage('certquest:' + (config.id || 'app') + (sample ? ':sample' : '') + ':v1');
  const defs = badgeDefs(data.tree);
  const app = {
    config,
    data,
    sample,
    storage,
    state: storage.load(),
    rng: Math.random,
    session: null,
    starThresholds: (config.stage && config.stage.stars) || STAR_THRESHOLDS,
    go(hash) {
      if (location.hash === hash) render();
      else location.hash = hash;
    },
    commit() {
      const got = awardBadges(app.state, defs, dateKey(new Date()));
      storage.save(app.state);
      got.forEach((b) => toast('バッジ獲得: ' + b.name, 'badge'));
    },
    recordAnswer(q, opts) {
      const r = recordAnswer(app.state, q, { ...opts, now: new Date() });
      app.commit();
      return r;
    },
    resetAll() {
      storage.clear();
      app.state = defaultState();
      app.session = null;
      toast('学習記録を消しました');
      app.go('#/home');
    },
  };
  // 動作確認用に外から触れるようにする（テストが状態を調べる）
  window.__app = app;

  const shell = h('div', { class: 'shell' });
  const main = h('main', { id: 'main', class: 'main', tabindex: '-1' });
  const nav = h('nav', { class: 'bottom-nav', 'aria-label': 'メインメニュー' });
  const navBtns = NAV.map((n) => {
    const a = h('a', { class: 'nav-item', href: n.hash, 'data-nav': n.id }, icon(n.icon), h('span', { text: n.label }));
    nav.appendChild(a);
    return a;
  });
  shell.appendChild(main);
  shell.appendChild(nav);
  clear(root);
  root.appendChild(shell);

  const ROUTES = [
    ['home', 'home', () => renderHome(app)],
    ['map', 'map', () => renderMap(app)],
    ['stage', 'map', (k) => renderStage(app, k)],
    ['cards', 'cards', () => renderCardList(app)],
    ['card', 'cards', (k) => renderCard(app, k)],
    ['review', 'review', () => renderReview(app)],
    ['more', 'more', () => renderMore(app)],
    ['badges', 'more', () => renderBadges(app)],
    ['settings', 'more', () => renderSettings(app)],
    ['exam', 'more', () => renderExam(app), true],
    ['play', 'home', () => renderPlay(app), true],
  ];

  let cleanup = null;
  function render() {
    if (cleanup) {
      try { cleanup(); } catch (e) { /* 後始末の失敗で画面遷移を止めない */ }
      cleanup = null;
    }
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const name = parts[0] || 'home';
    const arg = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('/')) : '';
    const route = ROUTES.find((r) => r[0] === name) || ROUTES[0];
    if (name !== 'play' && name !== 'exam') app.session = null;
    clear(main);
    try {
      const res = route[2](arg);
      const el = res && res.el ? res.el : res;
      cleanup = res && res.cleanup ? res.cleanup : null;
      main.appendChild(el);
    } catch (e) {
      console.error(e);
      main.appendChild(h('div', { class: 'view' }, h('div', { class: 'card empty' }, h('p', { text: 'この画面を表示できませんでした。' }), h('button', { class: 'btn', type: 'button', onClick: () => app.go('#/home') }, 'ホームへ'))));
    }
    const full = route[3] === true;
    nav.classList.toggle('hidden', full);
    document.body.classList.toggle('no-nav', full);
    navBtns.forEach((a) => {
      if (a.dataset.nav === route[1] && !full) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', render);
  if (!location.hash) history.replaceState(null, '', location.pathname + location.search + '#/home');
  render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('service worker', e));
  }
}
