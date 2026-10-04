// 問題・用語カードの「誤りを報告」の開き先を組み立てる。純粋な処理だけ。
// 報告の先は config.json の reportUrl。次の2つのどちらでも動く。
//   https://…（GitHub Issues の新規作成ページなど）… title と body を付けて開く
//   mailto:アドレス … subject と body を付けて、メールの作成画面を開く（スクリーンショットを添付できる）
// 先を変えたいときは reportUrl の1行を差し替えるだけにする。

/** 本文の冒頭として渡す長さ（文字数）。URL を長くしすぎない。 */
export const REPORT_HEAD_CHARS = 60;

/** 空白・改行を1つの空白にそろえ、先頭 n 文字だけ取る（長いときは末尾に省略記号）。サロゲートペアを割らない。 */
export function headOf(text, n = REPORT_HEAD_CHARS) {
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  const chars = Array.from(t);
  return chars.length > n ? chars.slice(0, n).join('') + '…' : t;
}

const ADDRESS = /^[^\s@,;?&:/]+@[^\s@,;?&:/]+\.[^\s@,;?&:/]+$/;

/**
 * 報告の先を読む。戻り値: { kind: 'https', href } | { kind: 'mailto', address, query } | null（使えない・未設定）
 * mailto は、宛先が1つのメールアドレスとして読めるものだけ。
 */
export function reportTarget(config) {
  const u = config && typeof config.reportUrl === 'string' ? config.reportUrl.trim() : '';
  if (!u) return null;
  if (/^mailto:/i.test(u)) {
    const rest = u.slice('mailto:'.length);
    const qi = rest.indexOf('?');
    let address = qi < 0 ? rest : rest.slice(0, qi);
    const query = qi < 0 ? '' : rest.slice(qi + 1);
    try { address = decodeURIComponent(address); } catch (e) { return null; }
    return ADDRESS.test(address) ? { kind: 'mailto', address, query } : null;
  }
  try {
    const url = new URL(u);
    return url.protocol === 'https:' ? { kind: 'https', href: url.href } : null;
  } catch (e) {
    return null;
  }
}

/** 報告の先として使えるか。 */
export function reportBase(config) {
  const t = reportTarget(config);
  return t ? (t.kind === 'https' ? t.href : 'mailto:' + t.address) : null;
}

/** ボタンの近くに出す短い案内。先が無ければ空。 */
export function reportHint(config) {
  const t = reportTarget(config);
  if (!t) return '';
  return t.kind === 'mailto'
    ? '押すとメールの作成画面が開きます。画面のスクリーンショットを添付できます。'
    : '押すと報告のページが開きます。画面のスクリーンショットを貼り付けられます。';
}

export const REPORT_SHOT_NOTE = '画面のスクリーンショットを添付していただけると助かります。';

/**
 * item … { kind: 'question' | 'card', id, text }
 * 戻り値: 開く URL。報告の先が決まっていなければ null（そのときはボタンを出さない）。
 */
export function buildReportUrl(config, item) {
  const target = reportTarget(config);
  if (!target || !item || !item.id) return null;
  const appName = (config && config.name) || '';
  const kindLabel = item.kind === 'card' ? '用語カード' : '問題';
  const title = '【誤りの報告】' + appName + ' ' + kindLabel + ' ' + item.id;
  const lines = [
    'アプリ: ' + appName + (config && config.id ? '（' + config.id + '）' : ''),
    kindLabel + 'ID: ' + item.id,
    '冒頭: ' + headOf(item.text),
    '',
    '誤りだと思う点（できれば根拠も）:',
    '',
    '',
    REPORT_SHOT_NOTE,
  ];
  // encodeURIComponent で自分で付ける（URLSearchParams は空白を + にするため使わない）。メールの改行は CRLF（%0D%0A）
  const enc = (s) => encodeURIComponent(s);
  if (target.kind === 'mailto') {
    const q = 'subject=' + enc(title) + '&body=' + enc(lines.join('\r\n'));
    return 'mailto:' + enc(target.address).replace(/%40/g, '@') + '?' + (target.query ? target.query + '&' : '') + q;
  }
  const url = new URL(target.href);
  const q = 'title=' + enc(title) + '&body=' + enc(lines.join('\n'));
  url.search = url.search ? url.search + '&' + q : '?' + q;
  return url.href;
}
