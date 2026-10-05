// 「プライバシーポリシー」と「利用規約」の画面。文面は ../lib/legal.js（単独ページ privacy.html・terms.html と同じ正本）。
import { h, externalLink } from '../ui.js';
import { DOCS, DOC_TITLE, PAGE_FILE, CONTACT, SITE_BASE, splitContact, updatedLine, otherDoc } from '../lib/legal.js';

/** 文字列を、連絡先のメールアドレスだけリンクにして、子要素の配列にする。 */
function inline(text) {
  return splitContact(text).map((p) => (p.mail ? h('a', { href: 'mailto:' + p.mail, text: p.mail }) : p.text));
}

function renderDoc(app, kind) {
  const d = DOCS[kind];
  const root = h('section', { class: 'view legal', 'data-legal': kind });
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/about') }, '← このアプリについて'));
  root.appendChild(h('h1', { text: d.title }));
  root.appendChild(h('p', { class: 'small muted legal-updated', text: updatedLine() }));
  const lead = h('div', { class: 'card legal-lead' });
  d.lead.forEach((t) => lead.appendChild(h('p', {}, ...inline(t))));
  root.appendChild(lead);
  for (const s of d.sections) {
    const card = h('div', { class: 'card legal-section', 'data-legal-section': s.id }, h('h2', { text: s.title }));
    for (const b of s.blocks) {
      if (typeof b === 'string') card.appendChild(h('p', {}, ...inline(b)));
      else if (b.ul) card.appendChild(h('ul', { class: 'legal-list' }, b.ul.map((t) => h('li', {}, ...inline(t)))));
      else if (b.links) b.links.forEach((l) => card.appendChild(h('p', { class: 'small' }, externalLink(l.url, l.text))));
    }
    root.appendChild(card);
  }
  const o = otherDoc(kind);
  root.appendChild(h('div', { class: 'card' },
    h('button', { class: 'row-btn', type: 'button', 'data-legal-go': o, onClick: () => app.go('#/' + o) }, h('strong', { text: DOC_TITLE[o] })),
    h('p', { class: 'small muted', text: '単独のページでも読めます：' }),
    h('p', { class: 'small' }, externalLink(SITE_BASE + PAGE_FILE[kind], SITE_BASE + PAGE_FILE[kind]))));
  return root;
}

export function renderPrivacy(app) {
  return renderDoc(app, 'privacy');
}

export function renderTerms(app) {
  return renderDoc(app, 'terms');
}

/** 「このアプリについて」に置く、2つの文書へのボタン。 */
export function legalMenuCard(app) {
  return h('div', { class: 'card', 'data-about': 'legal' },
    h('h2', { text: '規約など' }),
    h('div', { class: 'legal-menu' },
      h('button', { class: 'row-btn', type: 'button', 'data-legal-go': 'privacy', onClick: () => app.go('#/privacy') }, h('strong', { text: DOC_TITLE.privacy })),
      h('button', { class: 'row-btn', type: 'button', 'data-legal-go': 'terms', onClick: () => app.go('#/terms') }, h('strong', { text: DOC_TITLE.terms }))),
    h('p', { class: 'small muted' }, 'お問い合わせ：', ...inline(CONTACT)));
}
