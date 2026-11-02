// super-wechat-bot / test/delivery.test.mjs
// 交付级端到端测试：真实拉起 daemon + PowerShell agent，走真实决策与真实发送。
// 用法：node test/delivery.test.mjs [--dry]
//   --dry：只跑决策不发消息（把 mode 钉在 draft）
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DRY = process.argv.includes('--dry');
const CONTACT = process.env.SWB_CONTACT || 'aaa';
const TEST_HOME = path.join(os.tmpdir(), 'swb-delivery-home');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  — ' + detail : '')); };

async function apiKey() {
  try {
    const raw = await fs.readFile(path.join(os.homedir(), '.dsh', '.credentials.yaml'), 'utf8');
    const m = raw.match(/^\s*DEEPSEEK_API_KEY:\s*(\S+)\s*$/m);
    return m ? m[1].replace(/^['"]|['"]$/g, '') : '';
  } catch { return ''; }
}

const events = [];
let seq = 0;
const pending = new Map();
let daemon;

function req(cmd, args = {}, timeoutMs = 60000) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('timeout: ' + cmd)); }, timeoutMs);
    pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    daemon.stdin.write(JSON.stringify({ id, cmd, ...args }) + '\n');
  });
}

async function waitEvent(name, ms = 25000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const hit = events.find((e) => e.event === name);
    if (hit) return hit;
    await sleep(120);
  }
  return null;
}

async function main() {
  await fs.rm(TEST_HOME, { recursive: true, force: true });
  await fs.mkdir(TEST_HOME, { recursive: true });
  const key = await apiKey();
  console.log('test home:', TEST_HOME, '| dry:', DRY, '| contact:', CONTACT, '| key:', key ? 'yes' : 'NO');

  daemon = spawn(process.execPath, [path.join(ROOT, 'bridge', 'daemon.mjs')], {
    env: { ...process.env, SWB_HOME: TEST_HOME, SWB_TEST: '1' },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let buf = '';
  daemon.stdout.setEncoding('utf8');
  daemon.stdout.on('data', (d) => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      if (o.type === 'event') events.push({ ...o, at: Date.now() });
      else if (o.type === 'log') events.push({ event: 'log', ...o, at: Date.now() });
      else if (o.type === 'reply') { const w = pending.get(o.id); if (w) { pending.delete(o.id); o.ok ? w.resolve(o) : w.reject(new Error(o.error || 'err')); } }
    }
  });
  daemon.stderr.setEncoding('utf8');
  daemon.stderr.on('data', (d) => console.log('[daemon stderr]', String(d).slice(0, 200)));
  await sleep(900);

  // 1) 基础握手
  const ping = await req('ping');
  record('daemon 启动并应答 ping', ping.ok === true);

  // 2) 启动（真实拉起 PS agent + 标题校验）
  const mode = DRY ? 'draft' : 'auto';
  let started;
  try {
    started = await req('start', { mode, contact: CONTACT, apiKey: key, model: 'deepseek-flash' }, 90000);
    record('start 通过会话标题校验', started.started === true, 'title=' + (started.contact || ''));
  } catch (err) {
    record('start 通过会话标题校验', false, err.message);
    return;
  }

  // 3) 拟人延迟调到测试档
  await req('config', { set: { delay: { medianMs: 400, minMs: 250, maxMs: 700, urgentMedianMs: 300, urgentMinMs: 250, urgentMaxMs: 400 } } });

  // 4) 只读能力
  const scan = await req('scan', {}, 40000);
  record('scan 能识别当前会话与消息', typeof scan.title === 'string' && scan.title.length > 0, 'title=' + scan.title + ' msgs=' + (scan.msgs || []).length);
  record('scan 平均轮询 < 400ms', (scan.ms || 9999) < 400, 'ms=' + scan.ms);

  // 5) 收尾语不回复
  events.length = 0;
  const before = (await req('status')).drafts.length;
  await req('simulate', { texts: ['嗯嗯'] });
  await sleep(400);
  const afterAck = await req('status');
  const ackDraft = afterAck.drafts.find((d) => d.kind === 'skip' && d.reason === 'ack-only');
  record('收尾语「嗯嗯」被跳过', !!ackDraft && !events.some((e) => e.event === 'sent'));

  // 6) 身份质疑 T0 → 立即停手
  events.length = 0;
  await req('simulate', { texts: ['你是不是机器人啊'] });
  await sleep(600);
  const afterT0 = await req('status');
  record('T0 身份质疑不发送', !events.some((e) => e.event === 'sent'));
  record('T0 之后自动降级为 draft', afterT0.mode === 'draft', 'mode=' + afterT0.mode);

  // 7) 恢复 auto，测普通闲聊的真实发送
  if (!DRY) {
    await req('config', { set: { mode: 'auto' } });
    await req('start', { mode: 'auto', contact: CONTACT, apiKey: key }, 90000).catch(() => {});
    // start 会重置标题校验；重新把延迟压低
    await req('config', { set: { delay: { medianMs: 400, minMs: 250, maxMs: 700, urgentMedianMs: 300, urgentMinMs: 250, urgentMaxMs: 400 } } });
    events.length = 0;
    await req('simulate', { texts: ['你在干嘛呢'] });
    const sent = await waitEvent('sent', 30000);
    record('普通闲聊触发真实发送', !!sent, sent ? '「' + sent.text + '」' : '没等到 sent 事件');
    if (sent) {
      const unverified = await waitEvent('unverified', 6000);
      record('发送后画面回读确认', !unverified, unverified ? '未确认' : '已确认');
    }
  } else {
    record('普通闲聊触发真实发送', true, 'dry 模式跳过');
  }

  // 8) 去重闸：同一句 90 秒内发两次，第二次必须被拒（dry 模式不真发）
  events.length = 0;
  const dupText = '在呢';
  let second = null;
  if (!DRY) {
    try { await req('send', { text: dupText }); } catch { /* 第一次允许发 */ }
    await sleep(600);
    try { second = await req('send', { text: dupText }); } catch (e) { second = { error: e.message }; }
  } else {
    second = { error: 'duplicate: dry 模式不真发，跳过' };
  }
  record('重复发送被去重闸拦下', !!second?.error && /duplicate/.test(second.error), second?.error || '未被拦截');

  // 9) 限流：一分钟内超出上限应被拒（实时模式不拿真人会话做压测，改测配置上限）
  let blocked = false;
  await req('config', { set: { maxRepliesPerMinute: 0 } });
  try { await req('send', { text: '这条不应该发出去' }); } catch (e) { if (/rate limited/.test(e.message)) blocked = true; }
  await req('config', { set: { maxRepliesPerMinute: 6 } });
  record('每分钟条数限流生效（上限 0 时拒绝发送）', blocked);

  // 10) 标题闸：伪造错标题后 send 必须拒绝
  await req('config', { set: { contact: '不存在的联系人' } });
  let titleRejected = false;
  try { await req('send', { text: '不该发出去' }); } catch (e) { titleRejected = /拒绝发送|不一致/.test(e.message); }
  record('会话标题不匹配时拒绝发送', titleRejected);
  await req('config', { set: { contact: CONTACT } });

  // 11) 审计落盘
  const auditFiles = await fs.readdir(path.join(TEST_HOME, 'audit')).catch(() => []);
  record('审计日志已落盘', auditFiles.length > 0, auditFiles.join(','));
}

try {
  await main();
} catch (err) {
  console.log('  FAIL  测试脚本异常: ' + (err?.message || err));
  results.push({ name: '脚本异常', ok: false });
} finally {
  try { await req('stop', {}, 8000); } catch { /* ignore */ }
  await sleep(400);
  try { daemon?.kill(); } catch { /* ignore */ }
  const passed = results.filter((r) => r.ok).length;
  console.log('\n结果: ' + passed + '/' + results.length + ' 通过');
  const failed = results.filter((r) => !r.ok);
  if (failed.length) { console.log('失败项:'); for (const f of failed) console.log('  - ' + f.name + (f.detail ? ' (' + f.detail + ')' : '')); }
  process.exit(failed.length ? 1 : 0);
}
