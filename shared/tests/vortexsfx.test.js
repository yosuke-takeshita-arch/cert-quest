// ボス戦に入る『ドットの渦』が始まるときの効果音（2026-10-26 先生が聞き比べて選んだ）。実際に鳴るかは実機で確かめる。ここでは配線と条件を見る。
// 実行: cd shared && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SFX_FILES } from '../js/lib/sound.js';
import { createTransitioner } from '../js/lib/transition.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(shared, '..');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const app = read(join(shared, 'js', 'app.js'));
const audio = read(join(shared, 'js', 'audio.js'));

function fake({ reduce = false } = {}) {
  const doc = {
    body: { appendChild(el) { el.parentNode = this; }, removeChild(el) { el.parentNode = null; } },
    createElement(tag) {
      const el = { tag, className: '', children: [], setAttribute() {}, appendChild(c) { this.children.push(c); }, parentNode: null };
      if (tag === 'canvas') el.getContext = () => ({ clearRect() {}, fillRect() {}, set fillStyle(v) {} });
      return el;
    },
  };
  const timers = new Map();
  let seq = 0;
  const win = {
    innerWidth: 412,
    innerHeight: 800,
    performance: { now: () => 0 },
    requestAnimationFrame() { return 1; },
    matchMedia: (q) => ({ matches: reduce && q.includes('prefers-reduced-motion') }),
    setTimeout(fn, ms) { const id = ++seq; timers.set(id, { ms, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  return { doc, win };
}

test('渦の音: SFX_FILES に載り、ファイルが実在して小さく、sw-core.js の SFX と audio-licenses.md にも載っている', () => {
  assert.equal(SFX_FILES.vortex, 'vortex_retro-fall.ogg');
  const p = join(shared, 'audio', 'sfx', SFX_FILES.vortex);
  assert.ok(existsSync(p));
  assert.ok(statSync(p).size < 40 * 1024);
  assert.ok(read(join(shared, 'sw-core.js')).includes("'vortex_retro-fall.ogg'"));
  const doc = read(join(root, 'docs', 'sources', 'audio-licenses.md'));
  const row = doc.split('\n').find((l) => l.includes('`vortex_retro-fall.ogg`'));
  assert.ok(row && /CC0/.test(row) && /Aureolus_Omicron/.test(row));
  assert.ok(!Object.entries(SFX_FILES).some(([k, v]) => k !== 'vortex' && v === SFX_FILES.vortex));
});

test('渦の音: 渦（vortex）が始まるときに onStart が呼ばれる。ほかの演出でも呼ばれるが、鳴らすのは vortex のときだけ（app.js）', () => {
  const f = fake();
  const started = [];
  const t = createTransitioner(f.doc, f.win, { onStart: (k) => started.push(k) });
  t.go('vortex', () => {});
  assert.deepEqual(started, ['vortex']);
  t.clear();
  t.go('wipe', () => {});
  assert.deepEqual(started, ['vortex', 'wipe']);
  assert.match(app, /createTransitioner\(document, window, \{\s*\/\/[^\n]*\n\s*onStart: \(kind\) => \{ if \(kind === 'vortex'\) playSfx\(app\.state\.settings, 'vortex', \(\) => \{\}\)/);
  assert.equal(app.split("'vortex'").length - 1, 2); // 判定と鳴らす名前の2か所だけ
});

test('渦の音: 動きを減らす設定で渦が出ないときは onStart も呼ばない（音だけ鳴らさない）。onStart が例外を投げても場面は替わる', () => {
  const f = fake({ reduce: true });
  const started = [];
  let swapped = 0;
  createTransitioner(f.doc, f.win, { onStart: (k) => started.push(k) }).go('vortex', () => { swapped++; });
  assert.deepEqual(started, []);
  assert.equal(swapped, 1);
  const g = fake();
  const t = createTransitioner(g.doc, g.win, { onStart: () => { throw new Error('x'); } });
  t.go('vortex', () => { swapped++; });
  assert.equal(t.covering, true); // 例外でも覆いは出て、場面は替わる
});

test('渦の音: opts なしでも従来どおり動く', () => {
  const f = fake();
  const t = createTransitioner(f.doc, f.win);
  t.go('vortex', () => {});
  assert.equal(t.covering, true);
});

test('渦の音: 効果音の設定（sound）がオフなら鳴らさない／音量 0 でも鳴らさない（playSfx の入口）', () => {
  const i = audio.indexOf('export function playSfx(');
  const head = audio.slice(i, audio.indexOf('resumeCtx();', i));
  assert.match(head, /!settings\.sound/);
  assert.match(head, /gain <= 0\) return/);
});
