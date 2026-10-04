// 学習記録の引き継ぎ（書き出し・読み込み）の画面部品（ブラウザ専用）。形の検証は lib/backup.js。
// Android の Chrome で動くよう、書き出しは Blob のダウンロード、読み込みは input type=file を使う。
import { h, toast } from '../ui.js';
import { serializeBackup, backupFileName, parseBackup, backupSummary, BACKUP_REASONS, BACKUP_MAX_BYTES } from '../lib/backup.js';

function readText(file) {
  if (file.text) return file.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export function buildBackupCard(app) {
  const msg = h('p', { class: 'small', id: 'backup-msg', role: 'status', 'aria-live': 'polite' });
  const say = (text, bad) => {
    msg.textContent = text;
    msg.className = 'small' + (bad ? ' ng-text' : '');
  };

  const exportBtn = h('button', { class: 'btn', type: 'button', id: 'backup-export' }, '記録を書き出す');
  exportBtn.addEventListener('click', () => {
    try {
      const now = new Date();
      const text = serializeBackup(app.config.id, app.state, now);
      const name = backupFileName(app.config.id, now);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: name, class: 'hidden' });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      say('書き出しました（' + name + '）。ファイルは、端末のダウンロードの場所に保存されます。', false);
      toast('記録を書き出しました');
    } catch (e) {
      say('書き出せませんでした。もう一度お試しください。', true);
    }
  });

  const file = h('input', { type: 'file', id: 'backup-file', class: 'hidden', accept: '.json,application/json', 'aria-label': '学習記録のファイル' });
  const importBtn = h('button', { class: 'btn', type: 'button', id: 'backup-import' }, '記録を読み込む');
  importBtn.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    file.value = ''; // 同じファイルをもう一度選べるように
    if (!f) return;
    if (f.size > BACKUP_MAX_BYTES) { say(BACKUP_REASONS.tooBig, true); return; }
    let text;
    try {
      text = await readText(f);
    } catch (e) {
      say(BACKUP_REASONS.broken, true);
      return;
    }
    const r = parseBackup(text, app.config.id);
    if (!r.ok) { say(BACKUP_REASONS[r.reason] || BACKUP_REASONS.broken, true); return; }
    const sum = backupSummary(r.state);
    const when = r.exportedAt ? r.exportedAt.slice(0, 10) : '日付不明';
    const ok = confirm('いまの記録は消えます。ファイルの記録（' + when + ' 書き出し・答えた問題 ' + sum.answered + ' 問・XP ' + sum.xp + '）に置き換えます。元に戻せません。よろしいですか？');
    if (!ok) { say('読み込みをやめました。いまの記録はそのままです。', false); return; }
    say('', false);
    app.replaceState(r.state);
  });

  return h('div', { class: 'card', 'data-card': 'backup' },
    h('h2', { text: '学習記録の引き継ぎ' }),
    h('p', { class: 'small muted', text: '学習記録はこの端末のブラウザの中にだけあるので、機種変更やブラウザのデータ消去で消えます。ファイルに書き出しておくと、あとで戻せます。ファイルには、学習記録と設定だけが入ります。' }),
    h('div', { class: 'btn-row' }, exportBtn, importBtn),
    file,
    msg);
}
