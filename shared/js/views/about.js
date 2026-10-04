// 「このアプリについて」: 非公式であること・合格の保証をしないこと・問題の誤り・公式の情報・音の素材。
// 団体名などは資格ごとに違うので config.json の about から読む（examName / organizer / organizerUrl）。
import { h, externalLink } from '../ui.js';
import { reportButton } from './report.js';

/** 音の素材の作者（docs/sources/audio-licenses.md と同じ。CC0 で表示の義務は無いが、作者名を出す）。 */
export const AUDIO_CREDITS = [
  { what: '効果音（正解・不正解・ジングルなど）', who: 'Kenney（kenney.nl）、flush（OpenGameArt）' },
  { what: 'BGM', who: 'Joth、Kistol、wipics、cynicmusic、omfgdude（いずれも OpenGameArt）' },
];

export function renderAbout(app) {
  const c = app.config;
  const a = c.about || {};
  const exam = a.examName || c.shortName || c.name || '試験';
  const org = a.organizer || '試験の実施団体';
  const root = h('section', { class: 'view about' });
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/more') }, '← もっと'));
  root.appendChild(h('h1', { text: 'このアプリについて' }));

  // 提供者（屋号 Aisunia）とロゴ。ロゴは赤い文字なので、暗い配色でも読めるよう白い台に載せる
  root.appendChild(h('div', { class: 'card about-provider', 'data-about': 'provider' },
    h('span', { class: 'logo-plate' }, h('img', { class: 'provider-logo', src: new URL('../../images/aisunia-logo.webp', import.meta.url).href, alt: 'Aisunia', width: '160', height: '62', decoding: 'async' })),
    h('p', { class: 'provider-name', text: '提供：Aisunia' })));

  root.appendChild(h('div', { class: 'card', 'data-about': 'unofficial' },
    h('h2', { text: '非公式のアプリです' }),
    h('p', { text: 'このアプリは、' + exam + 'の非公式の学習アプリです。' + org + 'とは関係がありません。' }),
    h('p', { class: 'small muted', text: '試験の名称は、各実施団体のものです。' })));

  root.appendChild(h('div', { class: 'card', 'data-about': 'guarantee' },
    h('h2', { text: '合格は保証しません' }),
    h('p', { text: 'このアプリで学んでも、合格を保証するものではありません。' })));

  const err = h('div', { class: 'card', 'data-about': 'errors' },
    h('h2', { text: '問題・解説について' }),
    h('p', { text: '問題と解説は、このアプリのためにオリジナルで作ったものです。誤りが含まれている可能性があります。' }),
    h('p', { text: '誤りを見つけたら、問題の解説や用語カードの「誤りを報告」から知らせてください。' }));
  const hasReport = !!(c.reportUrl && reportButton(app, { kind: 'question', id: 'x', text: '' }));
  if (!hasReport) err.appendChild(h('p', { class: 'small muted', text: '（報告の窓口は準備中です）' }));
  root.appendChild(err);

  const links = h('div', { class: 'card', 'data-about': 'official' }, h('h2', { text: '公式の情報は、公式サイトで' }),
    h('p', { text: '試験の日程・申し込み・出題範囲・料金は変わることがあります。受ける前に、必ず公式サイトで確かめてください。' }));
  const list = c.officialLinks && c.officialLinks.length ? c.officialLinks : c.officialUrl ? [{ title: '公式の試験情報', url: c.officialUrl }] : [];
  list.forEach((l) => links.appendChild(h('p', {}, externalLink(l.url, l.title))));
  if (a.organizerUrl) links.appendChild(h('p', {}, externalLink(a.organizerUrl, org + ' のサイト')));
  root.appendChild(links);

  const credits = h('div', { class: 'card', 'data-about': 'credits' }, h('h2', { text: '音の素材' }),
    h('p', { class: 'small', text: 'このアプリの音は、次の方々が公開している素材（CC0＝自由に使える）を使っています。表示の義務はありませんが、お礼として作者名を載せます。' }));
  const ul = h('ul', { class: 'credit-list' });
  AUDIO_CREDITS.forEach((x) => ul.appendChild(h('li', {}, h('strong', { text: x.what }), h('span', { class: 'small', text: '：' + x.who }))));
  credits.appendChild(ul);
  root.appendChild(credits);
  return root;
}
