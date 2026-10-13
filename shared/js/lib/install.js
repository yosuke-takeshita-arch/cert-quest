// ホームに出す「アプリとしてインストール」の案内をどう出すか。画面には触らない。
// github.io の同じオリジンに資格アプリが複数あるため、Android の Chrome のメニュー「ホーム画面に追加」は
// 2つ目以降を「すでにインストールされています」と断る（WebappRegistry.isAppInstalledForUrl がオリジン単位）。
// 入れられるのはページ側の案内（beforeinstallprompt）からだけ。ただしこれはページを少し使ったあとに届くので、
// 届く前に「ボタンはここに出る。メニューからは入らない」と知らせておく（2026-10-14、先生がメニューから入れようとして断られた）。

/**
 * @param {{ prompt: boolean, userAgent: string, standalone: boolean }} env
 *   prompt … beforeinstallprompt を受け取っているか。standalone … インストールしたアプリとして開いているか
 * @returns {'button'|'wait'|null} button … ボタンを出す。wait … 待ってもらう案内を出す。null … 何も出さない
 */
export function installHint({ prompt, userAgent, standalone }) {
  if (standalone) return null;
  if (prompt) return 'button';
  return /Android/i.test(userAgent || '') ? 'wait' : null;
}
