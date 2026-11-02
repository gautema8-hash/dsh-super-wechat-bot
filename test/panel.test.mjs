import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';

const ROOT = path.resolve(import.meta.dirname, '..');
const HOME = path.join(os.tmpdir(), 'swb-panel-test');
const PORT = 47899;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await fs.rm(HOME, { recursive: true, force: true });
await fs.mkdir(HOME, { recursive: true });
await fs.writeFile(path.join(HOME, 'config.json'), JSON.stringify({ panelPort: PORT, contact: 'swb-self-test' }));

const d = spawn(process.execPath, [path.join(ROOT, 'bridge', 'daemon.mjs')], { env: { ...process.env, SWB_HOME: HOME }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
await sleep(1200);
const api = async (p, body) => {
  const r = await fetch('http://127.0.0.1:' + PORT + p, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  return r.json();
};
let pass = 0, fail = 0;
const ok = (n, c, d2) => { console.log((c ? '  PASS  ' : '  FAIL  ') + n + (d2 ? ' — ' + d2 : '')); c ? pass++ : fail++; };

const html = await (await fetch('http://127.0.0.1:' + PORT + '/')).text();
ok('面板页面能打开', html.includes('super-wechat-bot') && html.includes('角色预设'));

const st = await api('/api/state');
ok('状态接口返回角色列表', Array.isArray(st.roles) && st.roles.length >= 5, 'roles=' + (st.roles || []).length);
ok('状态里带草稿与统计', !!st.stats && Array.isArray(st.drafts));

const bad = await api('/api/config', { mode: 'yolo' });
ok('非法 mode 被拒绝', bad.ok === false && (bad.errors || []).length > 0, (bad.errors || [])[0]);

const badRe = await api('/api/config', { urgentRe: '[' });
ok('坏正则在写库前就被拦下', badRe.ok === false, (badRe.errors || [])[0]);

const clamp = await api('/api/config', { maxRepliesPerMinute: 999 });
ok('超范围数值被收敛', clamp.ok === true && clamp.config.maxRepliesPerMinute <= 20, 'limit=' + clamp.config.maxRepliesPerMinute);

const role = await api('/api/config', { role: 'teacher' });
ok('切换角色生效', role.ok === true && role.config.role === 'teacher');
const st2 = await api('/api/state');
ok('面板显示新角色标签', st2.roleLabel.includes('教师'), st2.roleLabel);

const unknownRole = await api('/api/config', { role: '不存在的角色' });
ok('未知角色被拒绝并给出可选列表', unknownRole.ok === false, (unknownRole.errors || [])[0] || '');

const noContact = await api('/api/config', { contact: '' });
ok('空会话名被拒绝', noContact.ok === false, (noContact.errors || [])[0]);

d.kill();
await sleep(300);
console.log('\n结果: ' + pass + '/' + (pass + fail) + ' 通过');
process.exit(fail ? 1 : 0);
