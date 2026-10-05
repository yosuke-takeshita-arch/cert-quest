// privacy.html と terms.html（リポジトリ直下。Google Play のストア掲載用に、単独で開ける URL）を、
// shared/js/lib/legal.js の文面から作る。文面を直したら、これを実行して作り直す（古いままだとテストが落ちる）。
//   実行: node tools/build-legal.mjs
// JavaScript が動かなくても読める、静的な HTML にする（ストアの審査や検索の巡回が JavaScript を動かすとは限らないため）。
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DOCS, DOC_TITLE, PAGE_FILE, OPERATOR, splitContact, updatedLine, otherDoc } from '../shared/js/lib/legal.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (text) => splitContact(text).map((p) => (p.mail ? '<a href="mailto:' + esc(p.mail) + '">' + esc(p.mail) + '</a>' : esc(p.text))).join('');

/** kind = 'privacy' | 'terms'。ページ全体の HTML（改行は LF、末尾に改行1つ）。 */
export function buildLegalPage(kind) {
  const d = DOCS[kind];
  const o = otherDoc(kind);
  const out = [];
  out.push('<!doctype html>');
  out.push('<html lang="ja">');
  out.push('<head>');
  out.push('<meta charset="utf-8">');
  out.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  out.push('<title>' + esc(d.title) + ' | ' + esc(OPERATOR.split('（')[0]) + '</title>');
  out.push('<link rel="stylesheet" href="shared/css/app.css">');
  out.push('<script>document.documentElement.dataset.theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";</script>');
  out.push('</head>');
  out.push('<body>');
  out.push('<div class="shell">');
  out.push('<main id="main" class="main view legal" data-legal="' + kind + '">');
  out.push('<nav class="legal-page-nav" aria-label="ほかのページ"><a href="index.html">アプリの一覧</a><a href="' + PAGE_FILE[o] + '">' + esc(DOC_TITLE[o]) + '</a></nav>');
  out.push('<h1>' + esc(d.title) + '</h1>');
  out.push('<p class="small muted legal-updated">' + esc(updatedLine()) + '</p>');
  out.push('<div class="card legal-lead">');
  d.lead.forEach((t) => out.push('<p>' + inline(t) + '</p>'));
  out.push('</div>');
  for (const s of d.sections) {
    out.push('<div class="card legal-section" data-legal-section="' + esc(s.id) + '">');
    out.push('<h2>' + esc(s.title) + '</h2>');
    for (const b of s.blocks) {
      if (typeof b === 'string') out.push('<p>' + inline(b) + '</p>');
      else if (b.ul) {
        out.push('<ul class="legal-list">');
        b.ul.forEach((t) => out.push('<li>' + inline(t) + '</li>'));
        out.push('</ul>');
      } else if (b.links) {
        b.links.forEach((l) => out.push('<p class="small"><a class="ext" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.text) + '</a></p>'));
      }
    }
    out.push('</div>');
  }
  out.push('</main>');
  out.push('</div>');
  out.push('</body>');
  out.push('</html>');
  return out.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const kind of Object.keys(PAGE_FILE)) {
    const html = buildLegalPage(kind);
    writeFileSync(join(root, PAGE_FILE[kind]), html, 'utf8');
    console.log(PAGE_FILE[kind] + ': ' + Buffer.byteLength(html) + ' bytes');
  }
}
