// 「もっと」: バッジ・設定・公式リンク・データの状態。
import { h, externalLink, icon, badgeBases, badgeImg } from '../ui.js';
import { badgeDefs, badgeProgress, badgeArtName, badgeImageUrl } from '../lib/badges.js';
import { DAILY_GOAL_CHOICES, normalizeDailyGoal } from '../lib/daily.js';
import { THEMES } from '../lib/progress.js';
import { TEXT_SIZES, TEXT_SIZE_LABEL, normalizeTextSize } from '../lib/textsize.js';
import { dateKey } from '../lib/srs.js';
import { buildSoundCard } from './sound-settings.js';
import { buildExamDateCard } from './examdate.js';
import { buildBackupCard } from './backup.js';
import { openIntro } from './intro.js';
import { INTRO_TEXT } from '../lib/intro.js';

export function renderMore(app) {
  const root = h('section', { class: 'view more' }, h('h1', { text: 'もっと' }));
  const nav = h('div', { class: 'card menu' },
    h('button', { class: 'row-btn', type: 'button', onClick: () => app.go('#/exam') }, h('strong', { text: '模擬試験' })),
    h('button', { class: 'row-btn', type: 'button', 'data-menu': 'weak', onClick: () => app.go('#/weak') }, h('strong', { text: '苦手の分析' })),
    h('button', { class: 'row-btn', type: 'button', onClick: () => app.go('#/badges') }, h('strong', { text: 'バッジ' }), h('span', { class: 'small muted', text: Object.keys(app.state.badges).length + ' 個' })),
    h('button', { class: 'row-btn', type: 'button', onClick: () => app.go('#/settings') }, h('strong', { text: '設定' })),
    h('button', { class: 'row-btn', type: 'button', 'data-menu': 'howto', onClick: () => openIntro() }, h('strong', { text: INTRO_TEXT.menu })),
    h('button', { class: 'row-btn', type: 'button', onClick: () => app.go('#/about') }, h('strong', { text: 'このアプリについて' })));
  root.appendChild(nav);
  const links = h('div', { class: 'card' }, h('h2', { text: '公式の情報（外部サイト）' }));
  const list = app.config.officialLinks && app.config.officialLinks.length ? app.config.officialLinks : app.config.officialUrl ? [{ title: '公式の例題・試験情報', url: app.config.officialUrl }] : [];
  list.forEach((l) => links.appendChild(h('p', {}, externalLink(l.url, l.title))));
  links.appendChild(h('p', { class: 'small muted', text: 'このアプリの問題はすべてオリジナルです。公式の例題は上のリンクから見てください。' }));
  root.appendChild(links);
  return root;
}

export function renderBadges(app) {
  const root = h('section', { class: 'view badges' });
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/more') }, '← もっと'));
  root.appendChild(h('h1', { text: 'バッジ' }));
  const defs = badgeDefs(app.data.tree, app.config);
  const got = defs.filter((d) => app.state.badges[d.id]).length;
  root.appendChild(h('p', { class: 'small muted', text: got + ' / ' + defs.length + ' 個' }));
  const grid = h('div', { class: 'badge-grid' });
  const today = dateKey(new Date());
  const bases = badgeBases();
  for (const d of defs) {
    const date = app.state.badges[d.id];
    const p = date ? null : badgeProgress(d, app.state, today);
    grid.appendChild(h('div', { class: 'badge' + (date ? ' got' : '') },
      badgeIcon(d, date, bases),
      h('strong', { text: d.name }),
      h('span', { class: 'small', text: d.desc }),
      h('span', { class: 'small muted', text: date ? date + ' 取得' : '未取得' }),
      p && p.max ? h('div', { class: 'badge-prog' },
        h('div', { class: 'progress', role: 'progressbar', 'aria-label': d.name + ' の進み具合', 'aria-valuemin': '0', 'aria-valuemax': String(p.max), 'aria-valuenow': String(p.cur) }, h('div', { class: 'progress-fill', style: { width: Math.round(p.ratio * 100) + '%' } })),
        h('span', { class: 'small', text: 'いま ' + p.cur + '/' + p.max + ' ' + p.unit })) : null));
  }
  root.appendChild(grid);
  return root;
}

// バッジ一覧の絵。絵があれば円形の絵（取っていなければ灰色で薄く＝CSS）、無ければ（読み込めなくても）これまでの記号。
function badgeIcon(d, got, bases) {
  const symbol = got ? 'star' : 'close';
  const url = badgeImageUrl(badgeArtName(d), bases);
  return h('span', { class: 'badge-ic' + (url ? ' art' : '') }, url ? badgeImg(url, 'badge-grid-img', symbol) : icon(symbol));
}

export function renderSettings(app) {
  const root = h('section', { class: 'view settings' });
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/more') }, '← もっと'));
  root.appendChild(h('h1', { text: '設定' }));
  const s = app.state.settings;
  const toggle = (label, hint, key, onChange) => {
    const id = 'set-' + key;
    const input = h('input', { type: 'checkbox', id, class: 'switch' });
    input.checked = !!s[key];
    input.addEventListener('change', () => {
      s[key] = input.checked;
      app.commit();
      if (onChange) onChange(input.checked);
    });
    return h('label', { class: 'row-btn', for: id }, h('span', { class: 'row-main' }, h('strong', { text: label }), h('span', { class: 'small muted', text: hint })), input);
  };
  root.appendChild(buildExamDateCard(app));
  // 音のカード（効果音・BGM のオン／オフと音量・曲・試しに聴く）は、タイトル画面の歯車のポップアップと同じ部品
  const sound = buildSoundCard(s, () => app.commit());
  root.appendChild(sound.el);
  const vib = 'vibrate' in navigator;
  root.appendChild(h('div', { class: 'card' }, h('h2', { text: '振動' }),
    vib ? toggle('振動', '正解・不正解で短く震えます', 'vibrate') : h('p', { class: 'small muted', text: 'この端末は振動に対応していません。' })));
  const THEME_LABEL = { light: '明るい', dark: '暗い', auto: 'スマホに合わせる' };
  const themeSel = h('select', { id: 'set-theme', class: 'select' }, THEMES.map((t) => h('option', { value: t, text: THEME_LABEL[t] })));
  themeSel.value = s.theme;
  themeSel.addEventListener('change', () => {
    s.theme = themeSel.value;
    app.commit();
    app.applyScheme();
  });
  root.appendChild(h('div', { class: 'card' }, h('h2', { text: '画面の明るさ' }),
    h('label', { class: 'row-btn', for: 'set-theme' }, h('span', { class: 'row-main' }, h('strong', { text: '配色' }), h('span', { class: 'small muted', text: '初期は「明るい」。「スマホに合わせる」はスマホのダークモードの設定に従います' })), themeSel)));
  const sizeSel = h('select', { id: 'set-textSize', class: 'select select-full' }, TEXT_SIZES.map((t) => h('option', { value: t, text: TEXT_SIZE_LABEL[t] })));
  sizeSel.value = normalizeTextSize(s.textSize);
  sizeSel.addEventListener('change', () => {
    s.textSize = normalizeTextSize(sizeSel.value);
    app.commit();
    app.applyTextSize();
  });
  root.appendChild(h('div', { class: 'card' }, h('h2', { text: '文字の大きさ' }),
    h('label', { class: 'row-btn row-stack', for: 'set-textSize' }, h('span', { class: 'row-main' }, h('strong', { text: '文字の大きさ' }), h('span', { class: 'small muted', text: '初期は「ふつう」。選ぶとすぐ、アプリ全体の文字が変わります' })), sizeSel),
    h('p', { class: 'text-sample', 'data-sample': 'text', text: 'この大きさで表示します。長い問題文も、この大きさで読めます。' })));
  const goalNow = normalizeDailyGoal(s.dailyGoal);
  const goalChoices = DAILY_GOAL_CHOICES.includes(goalNow) ? DAILY_GOAL_CHOICES : [...DAILY_GOAL_CHOICES, goalNow].sort((a, b) => a - b);
  const sel = h('select', { id: 'set-dailyGoal', class: 'select' }, goalChoices.map((n) => h('option', { value: String(n), text: n + '問' })));
  sel.value = String(goalNow);
  sel.addEventListener('change', () => {
    s.dailyGoal = normalizeDailyGoal(sel.value);
    app.commit();
    app.flushCelebrations();
  });
  root.appendChild(h('div', { class: 'card' }, h('h2', { text: '1日の目標' }),
    h('label', { class: 'row-btn', for: 'set-dailyGoal' }, h('span', { class: 'row-main' }, h('strong', { text: '1日に答える問題数' }), h('span', { class: 'small muted', text: '初期は10問（ステージ1回ぶん）。ホームに今日の進み具合が出ます' })), sel)));
  const reset = h('button', { class: 'btn danger', type: 'button', onClick: () => {
    if (confirm('学習記録（XP・復習・星・バッジ）をすべて消します。元に戻せません。よろしいですか？')) app.resetAll();
  } }, '学習記録をすべて消す');
  root.appendChild(h('div', { class: 'card' }, h('h2', { text: '学習記録' }),
    h('p', { class: 'small muted', text: 'この端末のブラウザの中だけに保存されています。サーバーには送っていません。' + (app.storage.persistent ? '' : '（いまは保存できない状態です）') }), reset));
  root.appendChild(buildBackupCard(app));
  const d = app.data;
  const info = h('div', { class: 'card' }, h('h2', { text: 'データの状態' }),
    h('p', { class: 'small', text: '問題 ' + d.questions.length + '問 / 用語カード ' + d.concepts.length + '枚 / ステージ ' + d.tree.stages.length }));
  if (d.missing.length) info.appendChild(h('p', { class: 'small muted', text: 'まだ無いファイル: ' + d.missing.length + '個（準備中）' }));
  if (d.problems.length) {
    info.appendChild(h('p', { class: 'small warn-text', text: '読み飛ばしたデータ: ' + d.problems.length + '件' }));
    const det = h('details', {}, h('summary', { text: '内訳' }));
    d.problems.slice(0, 30).forEach((p) => det.appendChild(h('p', { class: 'small muted', text: p.file + ': ' + p.reason })));
    info.appendChild(det);
  }
  info.appendChild(h('p', { class: 'small muted', text: 'アプリ: ' + (app.config.name || '') + (app.sample ? '（サンプルデータ表示中）' : '') }));
  root.appendChild(info);
  return { el: root, cleanup: sound.dispose }; // 画面を出るとき、試聴のBGMを止める
}
