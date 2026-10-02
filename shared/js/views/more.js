// 「もっと」: バッジ・設定・公式リンク・データの状態。
import { h, externalLink, icon } from '../ui.js';
import { badgeDefs } from '../lib/badges.js';

export function renderMore(app) {
  const root = h('section', { class: 'view more' }, h('h1', { text: 'もっと' }));
  const nav = h('div', { class: 'card menu' },
    h('button', { class: 'row-btn', type: 'button', onClick: () => app.go('#/exam') }, h('strong', { text: '模擬試験' })),
    h('button', { class: 'row-btn', type: 'button', onClick: () => app.go('#/badges') }, h('strong', { text: 'バッジ' }), h('span', { class: 'small muted', text: Object.keys(app.state.badges).length + ' 個' })),
    h('button', { class: 'row-btn', type: 'button', onClick: () => app.go('#/settings') }, h('strong', { text: '設定' })));
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
  for (const d of defs) {
    const date = app.state.badges[d.id];
    grid.appendChild(h('div', { class: 'badge' + (date ? ' got' : '') },
      h('span', { class: 'badge-ic' }, icon(date ? 'star' : 'close')),
      h('strong', { text: d.name }),
      h('span', { class: 'small', text: d.desc }),
      h('span', { class: 'small muted', text: date ? date + ' 取得' : '未取得' })));
  }
  root.appendChild(grid);
  return root;
}

export function renderSettings(app) {
  const root = h('section', { class: 'view settings' });
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/more') }, '← もっと'));
  root.appendChild(h('h1', { text: '設定' }));
  const s = app.state.settings;
  const toggle = (label, hint, key) => {
    const id = 'set-' + key;
    const input = h('input', { type: 'checkbox', id, class: 'switch' });
    input.checked = !!s[key];
    input.addEventListener('change', () => {
      s[key] = input.checked;
      app.commit();
    });
    return h('label', { class: 'row-btn', for: id }, h('span', { class: 'row-main' }, h('strong', { text: label }), h('span', { class: 'small muted', text: hint })), input);
  };
  const vib = 'vibrate' in navigator;
  root.appendChild(h('div', { class: 'card' },
    toggle('効果音', '正解・レベルアップで鳴らします（初期はオフ）', 'sound'),
    vib ? toggle('振動', '正解・不正解で短く震えます', 'vibrate') : h('p', { class: 'small muted', text: 'この端末は振動に対応していません。' })));
  const reset = h('button', { class: 'btn danger', type: 'button', onClick: () => {
    if (confirm('学習記録（XP・復習・星・バッジ）をすべて消します。元に戻せません。よろしいですか？')) app.resetAll();
  } }, '学習記録をすべて消す');
  root.appendChild(h('div', { class: 'card' }, h('h2', { text: '学習記録' }),
    h('p', { class: 'small muted', text: 'この端末のブラウザの中だけに保存されています。サーバーには送っていません。' + (app.storage.persistent ? '' : '（いまは保存できない状態です）') }), reset));
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
  return root;
}
