/**
 * dsh-super-wechat-bot — DSH plugin host half.
 *
 * 把「微信代聊」做成一个独立常驻进程（bridge/daemon.mjs），DSH 只负责:
 *   - 管理这个进程（拉起 / 停止 / 转发指令）
 *   - 暴露 wechat_* 工具给模型
 *   - 读写 ~/.dsh/dsh-super-wechat-bot/config.json
 *
 * 真正的 检测→决策→发送 循环全部在 daemon 里跑，不占 agent 轮次。
 *
 * @module dsh-super-wechat-bot
 */
import { createRequire } from 'node:module';
import { existsSync, promises as fsp } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(HERE, '..');
const DAEMON = path.join(PLUGIN_ROOT, 'bridge', 'daemon.mjs');
const SWB_HOME = process.env.SWB_HOME || path.join(os.homedir(), '.dsh', 'dsh-super-wechat-bot');
const CONFIG_FILE = path.join(SWB_HOME, 'config.json');

const DEFAULT_CONFIG = {
  enabled: false,
  mode: 'draft',
  contact: 'aaa',
  processName: 'Weixin',
  pollMs: 900,
  coalesceMs: 1600,
  maxReplyChars: 40,
  maxRepliesPerMinute: 6,
  stopAfterEscalations: 2,
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
  autoStart: false,
};

// ---------------------------------------------------------------- defineTool resolution
async function loadDefineTool() {
  const candidates = [
    import.meta.url,
    process.argv[1] ? pathToFileURL(process.argv[1]).href : null,
    path.join(SWB_HOME, 'package.json'),
    path.join(os.homedir(), '.dsh', 'profiles', 'web', 'package.json'),
    process.env.DSH_ROOT ? path.join(process.env.DSH_ROOT, 'package.json') : null,
  ].filter(Boolean);
  try {
    const mod = await import('@deepseek-ai/dsh-tools');
    if (typeof mod?.defineTool === 'function') return mod.defineTool;
  } catch { /* fall through */ }
  for (const c of candidates) {
    try {
      const req = createRequire(c.startsWith('file:') ? new URL(c) : c);
      const resolved = req.resolve('@deepseek-ai/dsh-tools');
      const mod = await import(pathToFileURL(resolved).href);
      if (typeof mod?.defineTool === 'function') return mod.defineTool;
    } catch { /* next */ }
  }
  return null;
}

// ---------------------------------------------------------------- config file
async function loadConfigFile() {
  try {
    const raw = JSON.parse(await fsp.readFile(CONFIG_FILE, 'utf8'));
    return { ...DEFAULT_CONFIG, ...raw };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

async function saveConfigFile(patch) {
  const cur = await loadConfigFile();
  const next = { ...cur, ...patch };
  await fsp.mkdir(SWB_HOME, { recursive: true });
  await fsp.writeFile(CONFIG_FILE, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

// ---------------------------------------------------------------- daemon client
class Bridge {
  constructor(logger) {
    this.logger = logger;
    this.proc = null;
    this.buf = '';
    this.seq = 0;
    this.pending = new Map();
    this.events = [];
    this.starting = null;
  }

  get alive() {
    return !!this.proc && !this.proc.killed && this.proc.exitCode === null;
  }

  async ensure() {
    if (this.alive) return;
    if (this.starting) return this.starting;
    this.starting = this._spawn().finally(() => { this.starting = null; });
    return this.starting;
  }

  async _spawn() {
    if (!existsSync(DAEMON)) throw new Error('daemon missing: ' + DAEMON);
    this.proc = spawn(process.execPath, [DAEMON], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, SWB_HOME, ELECTRON_RUN_AS_NODE: '1' },
    });
    this.proc.stdout.setEncoding('utf8');
    this.proc.stderr.setEncoding('utf8');
    this.proc.stdout.on('data', (d) => this._onData(d));
    this.proc.stderr.on('data', (d) => this._log('warn', 'daemon stderr: ' + String(d).slice(0, 200)));
    this.proc.on('exit', (code) => {
      this._log('warn', 'daemon exited: ' + code);
      for (const [, w] of this.pending) w.reject(new Error('daemon exited (' + code + ')'));
      this.pending.clear();
      this.proc = null;
    });
    await this.request('ping', {}, 15000);
  }

  _onData(chunk) {
    this.buf += chunk;
    let i;
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, i).trim();
      this.buf = this.buf.slice(i + 1);
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      if (obj.type === 'reply') {
        const w = this.pending.get(obj.id);
        if (w) {
          this.pending.delete(obj.id);
          if (obj.ok) w.resolve(obj);
          else w.reject(new Error(obj.error || 'daemon error'));
        }
      } else if (obj.type === 'event' || obj.type === 'log') {
        this.events.push(obj);
        if (this.events.length > 200) this.events.shift();
      }
    }
  }

  request(cmd, args = {}, timeoutMs = 30000) {
    return this.ensure().then(() => new Promise((resolve, reject) => {
      const id = ++this.seq;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('daemon timeout: ' + cmd)); }, timeoutMs);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      try {
        this.proc.stdin.write(JSON.stringify({ id, cmd, ...args }) + '\n');
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    }));
  }

  _log(level, msg) {
    try { this.logger?.(level, msg); } catch { /* ignore */ }
  }

  dispose() {
    try { this.proc?.kill(); } catch { /* ignore */ }
    this.proc = null;
  }
}

// ---------------------------------------------------------------- plugin
export const name = 'dsh-super-wechat-bot';
export const inject = ['tools'];

export function apply(ctx, pluginConfig = {}) {
  const log = (level, msg) => {
    try {
      if (level === 'error') ctx.logger.error('[dsh-super-wechat-bot] ' + msg);
      else if (level === 'warn') ctx.logger.warn('[dsh-super-wechat-bot] ' + msg);
      else ctx.logger.info('[dsh-super-wechat-bot] ' + msg);
    } catch { /* logger 不可用时静默 */ }
  };

  const bridge = new Bridge(log);
  let defineTool = null;
  const registered = new Set();

  const register = (tool) => {
    if (!tool || registered.has(tool.name)) return;
    try {
      ctx.effect(() => ctx.tools.register(tool), 'dsh-super-wechat-bot.tool.' + tool.name);
      registered.add(tool.name);
    } catch (err) {
      log('warn', 'tool ' + tool.name + ' 注册失败: ' + String(err?.message || err));
    }
  };

  const TEXT = {
    schema: { type: 'string' },
    render: (_args, value) => [{ type: 'text', text: String(value) }],
  };

  const fmt = (v) => JSON.stringify(v, null, 2);

  const TOOLS = [
    {
      name: 'wechat_status',
      description: '微信代聊机器人（dsh-super-wechat-bot）的实时状态：运行模式(off/draft/auto)、当前会话标题、最近草稿、最近事件、性能与错误。排查或确认它是否在跑时先调这个。',
      parameters: {},
      output: TEXT,
      isConcurrencySafe: () => true,
      execute: async () => {
        try {
          const r = await bridge.request('status');
          const events = bridge.events.slice(-6);
          return fmt({ ...r, recentEvents: events });
        } catch (err) {
          return '机器人未启动：' + String(err?.message || err) + '\n用 wechat_start 启动（默认 draft 草稿模式）。';
        }
      },
    },
    {
      name: 'wechat_start',
      description: '启动微信代聊机器人。mode="draft" 只生成草稿等主人点头（默认，最安全）；mode="auto" 直接按拟人节奏发送。必须先确认微信当前会话就是目标联系人。',
      parameters: {
        mode: { type: 'string', description: 'draft｜auto。默认 draft。' },
        contact: { type: 'string', description: '目标联系人昵称，必须和微信会话标题一致。' },
        apiKey: { type: 'string', description: '可选：DeepSeek API Key；不传则复用配置文件里的。' },
        model: { type: 'string', description: '可选：模型名，默认 deepseek-flash。' },
      },
      output: TEXT,
      isConcurrencySafe: () => false,
      execute: async (args) => {
        const cfg = await loadConfigFile();
        const contact = String(args?.contact || cfg.contact || '');
        if (!contact) return '缺少 contact：请给出微信会话标题里的联系人昵称。';
        const mode = String(args?.mode || 'draft');
        const apiKey = String(args?.apiKey || cfg.apiKey || await readDshApiKey() || '');
        const model = String(args?.model || cfg.model || 'deepseek-flash');
        await saveConfigFile({ contact, mode, enabled: true, apiKey, model });
        try {
          const r = await bridge.request('config', { set: { contact, mode, apiKey, model } });
          const started = await bridge.request('start', { mode, contact, apiKey, model });
          log('info', 'started mode=' + mode + ' contact=' + contact);
          return fmt({ ...started, configEcho: r.config });
        } catch (err) {
          return '启动失败：' + String(err?.message || err);
        }
      },
    },
    {
      name: 'wechat_stop',
      description: '停止微信代聊机器人（关闭桥进程，不再读屏也不再发消息）。',
      parameters: {},
      output: TEXT,
      isConcurrencySafe: () => false,
      execute: async () => {
        try { await bridge.request('stop', {}, 12000); } catch { /* 可能没在跑 */ }
        bridge.dispose();
        await saveConfigFile({ enabled: false });
        return '已停止：不再读屏、不再发送。';
      },
    },
    {
      name: 'wechat_scan',
      description: '一次性抓取当前微信会话的画面并解析出最近的消息列表（不发任何消息）。用来确认联系人、判断对方在等什么。',
      parameters: {},
      output: TEXT,
      isConcurrencySafe: () => true,
      execute: async () => {
        try {
          const r = await bridge.request('scan', {}, 30000);
          return fmt({ title: r.title, msgs: r.msgs, ms: r.ms?.pollMs, crop: r.crop });
        } catch (err) {
          return '抓取失败：' + String(err?.message || err);
        }
      },
    },
    {
      name: 'wechat_send',
      description: '立刻以主人语气给当前会话发一条消息（强制发送，跳过拟人延迟与草稿）。发送前会校验会话标题，标题不匹配会拒绝。',
      parameters: {
        text: { type: 'string', description: '要发送的正文，1-2 句、不超过 40 字。', required: true },
      },
      output: TEXT,
      isConcurrencySafe: () => false,
      execute: async (args) => {
        const text = String(args?.text || '').trim();
        if (!text) return '缺少 text。';
        try {
          const r = await bridge.request('send', { text }, 30000);
          return '已发送：' + r.text;
        } catch (err) {
          return '发送失败：' + String(err?.message || err);
        }
      },
    },
    {
      name: 'wechat_drafts',
      description: '列出机器人攒下来的草稿/升级待办（draft 模式下它只生成不发送）。status 可过滤 pending/sent/rejected/skipped。',
      parameters: {
        status: { type: 'string', description: '可选过滤：pending｜sent｜rejected｜skipped' },
      },
      output: TEXT,
      isConcurrencySafe: () => true,
      execute: async (args) => {
        try {
          const r = await bridge.request('drafts', { status: args?.status });
          if (!r.drafts?.length) return '（没有匹配的草稿）';
          return r.drafts.map((d) => '#' + d.id + ' [' + d.status + '] ' + (d.kind || '') + (d.level ? ' ' + d.level : '') + '\n  对方：' + (Array.isArray(d.context) ? d.context.join(' / ') : d.context || '') + '\n  拟回：' + (d.text || '（不回）') + (d.source ? '\n  来源：' + d.source : '')).join('\n\n');
        } catch (err) {
          return '取草稿失败：' + String(err?.message || err);
        }
      },
    },
    {
      name: 'wechat_approve',
      description: '批准并发送一条指定草稿（草稿 id 来自 wechat_drafts）。审批类草稿适合走这条：先看草稿，再决定发不发。',
      parameters: {
        id: { type: 'string', description: '草稿 id', required: true },
      },
      output: TEXT,
      isConcurrencySafe: () => false,
      execute: async (args) => {
        const id = String(args?.id || '');
        if (!id) return '缺少 id。';
        try {
          const r = await bridge.request('approve', { id }, 30000);
          return '已发送草稿：' + r.text;
        } catch (err) {
          return '发送失败：' + String(err?.message || err);
        }
      },
    },
    {
      name: 'wechat_reject',
      description: '丢弃一条草稿，不发送。',
      parameters: {
        id: { type: 'string', description: '草稿 id', required: true },
      },
      output: TEXT,
      isConcurrencySafe: () => true,
      execute: async (args) => {
        const id = String(args?.id || '');
        if (!id) return '缺少 id。';
        try {
          await bridge.request('reject', { id });
          return '已丢弃草稿 ' + id;
        } catch (err) {
          return '操作失败：' + String(err?.message || err);
        }
      },
    },
    {
      name: 'wechat_config',
      description: '读写微信代聊机器人的配置（拟人节奏、话术、身份分级正则、模型等）。不带 set 时返回当前配置。',
      parameters: {
        set: { type: 'string', description: '可选：要合并的配置 JSON 字符串，例如 {"delay":{"medianMs":6000},"mode":"draft"}' },
      },
      output: TEXT,
      isConcurrencySafe: () => true,
      execute: async (args) => {
        let patch = null;
        if (args?.set) {
          try { patch = JSON.parse(String(args.set)); } catch (err) { return 'set 不是合法 JSON：' + String(err?.message || err); }
        }
        if (patch && typeof patch === 'object') {
          await saveConfigFile(patch);
          try { await bridge.request('config', { set: patch }); } catch { /* 未启动时只落盘 */ }
        }
        const cfg = await loadConfigFile();
        const shown = { ...cfg, apiKey: cfg.apiKey ? '***' : '' };
        return fmt(shown);
      },
    },
  ];

  (async () => {
    defineTool = await loadDefineTool();
    if (!defineTool) {
      log('error', '无法加载 @deepseek-ai/dsh-tools，工具未注册');
      return;
    }
    for (const spec of TOOLS) {
      try {
        register(defineTool(spec));
      } catch (err) {
        log('warn', '定义工具 ' + spec.name + ' 失败: ' + String(err?.message || err));
      }
    }
    if (pluginConfig?.autoStart) {
      loadConfigFile().then((cfg) => {
        if (cfg.enabled && cfg.autoStart) {
          bridge.request('start', { mode: cfg.mode, contact: cfg.contact, apiKey: cfg.apiKey, model: cfg.model })
            .then(() => log('info', 'auto-started'))
            .catch((e) => log('warn', 'auto-start failed: ' + String(e?.message || e)));
        }
      }).catch(() => {});
    }
    log('info', '已加载，home=' + SWB_HOME);
  })();

  ctx.on?.('dispose', () => bridge.dispose());
}

async function readDshApiKey() {
  try {
    const raw = await fsp.readFile(path.join(os.homedir(), '.dsh', '.credentials.yaml'), 'utf8');
    const m = raw.match(/^\s*DEEPSEEK_API_KEY:\s*(\S+)\s*$/m);
    return m ? m[1].replace(/^['"]|['"]$/g, '') : '';
  } catch {
    return '';
  }
}
