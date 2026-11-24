// アプリの名前の組み立て。純粋な関数だけ。
// 2026-10-14 先生の決定: 試験名は登録商標のことがある（G検定 登録6202165・生成AIパスポート 登録6768938）ため、名前やロゴに大きく使わない。
// シリーズ名（config.series＝CertQuest）＋アプリごとの名前（config.name）を名前にし、試験名は副題（config.subtitle＝「〜対策」）として小さく添える。

/** 一続きの名前（タブの題名・ホーム画面に入れたときの名前・誤りの報告）。例: CertQuest ディープの塔（G検定対策） */
export function appTitle(config) {
  const c = config || {};
  const name = c.name || '';
  const head = c.series ? c.series + ' ' + name : name;
  return c.subtitle ? head + '（' + c.subtitle + '）' : head;
}
