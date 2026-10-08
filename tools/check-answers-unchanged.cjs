#!/usr/bin/env node
// 説明文の書き直しのあとに使う: HEAD と作業ツリーの問題を比べ、ID・正解の位置・選択肢の数・選択肢の文が変わっていないかを確かめる
// 使い方: node tools/check-answers-unchanged.cjs [g-kentei|dx-biz ...]（省略すると両方）
// 見ていないもの: 説明文（explanation・whyWrong など）の中身。そこは変わってよい前提で、件数だけ数える
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const apps = process.argv.slice(2).length ? process.argv.slice(2) : ['g-kentei', 'dx-biz'];
let bad = 0;
for (const app of apps) {
  const dir = path.join(app, 'data', 'questions');
  let changed = 0;
  for (const f of fs.readdirSync(dir)) {
    const rel = dir.replace(/\\/g, '/') + '/' + f;
    let old;
    try { old = JSON.parse(execSync('git show HEAD:' + rel, { encoding: 'utf8', maxBuffer: 1 << 26 })); } catch (e) { continue; } // 新しいファイル
    const cur = new Map(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).map((q) => [q.id, q]));
    for (const o of old) {
      const n = cur.get(o.id);
      if (!n) { console.log('NG 消えた問題', o.id); bad++; continue; }
      if (JSON.stringify(o) !== JSON.stringify(n)) changed++;
      if (o.answer !== n.answer) { console.log('NG 正解の位置が変わった', o.id); bad++; }
      if (JSON.stringify(o.choices) !== JSON.stringify(n.choices)) { console.log('NG 選択肢が変わった', o.id); bad++; }
    }
  }
  console.log(app + ': 中身が変わった問題 ' + changed + '件');
}
console.log(bad ? '結果: NG ' + bad + '件' : '結果: OK');
process.exit(bad ? 1 : 0);
