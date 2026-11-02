import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';

const ROOT = path.resolve(import.meta.dirname, '..');
const HOME = path.join(os.tmpdir(), 'swb-teacher-home');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await fs.rm(HOME, { recursive: true, force: true });
await fs.mkdir(HOME, { recursive: true });

const key = (async () => {
  try {
    const raw = await fs.readFile(path.join(os.homedir(), '.dsh', '.credentials.yaml'), 'utf8');
    const m = raw.match(/^\s*DEEPSEEK_API_KEY:\s*(\S+)\s*$/m);
    return m ? m[1].replace(/^['"]|['"]$/g, '') : '';
  } catch { return ''; }
})();

const d = spawn(process.execPath, [path.join(ROOT, 'bridge', 'daemon.mjs')], {
  env: { ...process.env, SWB_HOME: HOME, SWB_TEST: '1' },
  stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
});
let buf = '', seq = 0; const pend = new Map();
d.stdout.setEncoding('utf8');
d.stdout.on('data', (c) => {
  buf += c; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue; let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.type === 'reply') { const w = pend.get(o.id); if (w) { pend.delete(o.id); o.ok ? w.res(o) : w.rej(new Error(o.error)); } }
  }
});
d.stderr.setEncoding('utf8');
d.stderr.on('data', (c) => console.log('[stderr]', String(c).slice(0, 160)));
function req(cmd, args = {}, ms = 60000) {
  const id = ++seq;
  return new Promise((res, rej) => {
    const t = setTimeout(() => { pend.delete(id); rej(new Error('timeout ' + cmd)); }, ms);
    pend.set(id, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } });
    d.stdin.write(JSON.stringify({ id, cmd, ...args }) + '\n');
  });
}
await sleep(900);
const apiKey = await key;

console.log('== 1. 教师身份 + draft 启动 ==');
await req('config', { set: { role: 'teacher', delay: { medianMs: 400, minMs: 250, maxMs: 700 } } });
const st = await req('start', { mode: 'draft', contact: 'aaa', apiKey, role: 'teacher' }, 120000);
console.log('   启动:', st.started ? 'ok' : 'fail', '| 角色:', st.contact ? 'teacher' : '?');

console.log('== 2. 对方连发三句 ==');
for (const text of ['老师好', '作业是什么', '这次能评优吗']) {
  const r = await req('simulate', { texts: [text] });
  const last = r.drafts[0] || {};
  console.log('   收「' + text + '」→ ' + (last.kind || '?') + (last.level ? '/' + last.level : '') + ' 拟回：' + JSON.stringify(last.text || ''));
  await sleep(300);
}

console.log('== 3. 草稿箱 ==');
const all = await req('drafts', {});
for (const dr of all.drafts.filter((x) => x.status === 'pending')) {
  console.log('   #' + dr.id + ' [' + dr.kind + (dr.level ? '/' + dr.level : '') + '] 对方：' + (dr.context || []).join(' / ') + '  →  ' + JSON.stringify(dr.text || '（不回）'));
}

console.log('== 4. 批准「老师好」那条，验证真实发送 ==');
const target = all.drafts.find((x) => x.status === 'pending' && x.text && x.text.length <= 6);
if (target) {
  try { const r = await req('approve', { id: target.id }, 60000); console.log('   已发送:', JSON.stringify(r.text)); }
  catch (e) { console.log('   发送失败:', e.message); }
} else {
  console.log('   没找到合适的草稿');
}
await sleep(800);
const after = await req('status');
console.log('   统计:', JSON.stringify(after.stats));
await req('stop', {}, 8000).catch(() => {});
await sleep(300);
d.kill();
