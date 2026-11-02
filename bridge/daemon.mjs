// super-wechat-bot / daemon.mjs
// Standalone bridge process. Owns one persistent PowerShell agent and runs the
// whole detect -> decide -> send loop outside the DSH agent turn.
// Control protocol: one JSON line per stdin line, answers tagged {type:"reply",id}.

import { spawn } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseMessages, sliceNewIncoming, lastIncomingKey } from './parse.mjs';
import { classifyIdentity, isAckOnly, cannedReply, sanitizeReply, DEFAULTS } from './policy.mjs';
import { chat, buildMessages } from './llm.mjs';
import { ROLES, getRole, rolePersona, ROLE_KEYS } from './roles.mjs';
import { validatePatch } from './validate.mjs';
import { startPanel } from './panel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();
const SWB_HOME = process.env.SWB_HOME || path.join(HOME, '.dsh', 'super-wechat-bot');
const CONFIG_FILE = path.join(SWB_HOME, 'config.json');
const AUDIT_DIR = path.join(SWB_HOME, 'audit');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DEFAULT_CONFIG = {
  enabled: false,
  mode: 'draft',
  contact: '',
  role: 'friend',
  panelPort: 47821,
  processName: 'Weixin',
  pollMs: 900,
  coalesceMs: 1600,
  // 快档：优先速度而不是“看起来像人”。opens 后轮询更密、合并更短、几乎不延迟。
  fastMode: false,
  pollMsFast: 220,
  coalesceMsFast: 320,
  fastDelayMs: 120,
  maxRepliesPerMinute: 6,
  maxReplyChars: 40,
  stopAfterEscalations: 2,
  draftRetention: 50,
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
  persona: [
    '你在替「主人」用他本人的口吻回微信，不是客服不是助手。',
    '规则：永远不提 AI/模型/机器人/助手/自动回复；不用客服腔；不自我介绍不总结不列点不用 markdown；',
    '一次只回 1-2 句，最多 3 句，总长不超过 40 字；标点要懒，少用句号感叹号，表情偶尔一个；',
    '不确定就拖；涉及钱、合同、承诺、感情、隐私、工作决定，一律回「这个我晚点跟你细说」；',
    '不主动开话题、不连续追问；只输出要发送的文字本身。',
  ].join(''),
  delay: { medianMs: 7000, minMs: 2500, maxMs: 35000, urgentMedianMs: 1300, urgentMinMs: 500, urgentMaxMs: 2600 },
  urgentRe: '快点|快回|赶紧|急|在吗|怎么不回|秒回|3s|不等你了',
  skipAckProbability: 0.85,
  ...DEFAULTS,
};

async function loadConfig() {
  try {
    const raw = JSON.parse(await fsp.readFile(CONFIG_FILE, 'utf8'));
    return deepMerge(DEFAULT_CONFIG, raw);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function deepMerge(base, patch) {
  if (patch === null || patch === undefined) return base;
  if (Array.isArray(patch)) return patch;
  if (typeof patch !== 'object') return patch;
  const out = { ...(typeof base === 'object' && !Array.isArray(base) ? base : {}) };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(out[k] ?? {}, v) : v;
  }
  return out;
}

// ---------------------------------------------------------------- role
/** 把角色预设灌进运行时配置（persona/话术/字数/额外禁区） */
function applyRole() {
  const role = getRole(cfg.role);
  cfg.persona = rolePersona(cfg.role, cfg.maxReplyChars || role.maxChars);
  cfg.canned = role.canned;
  cfg.deferLine = role.deferLine;
  cfg.roleDefer = role.defer;
  if (!cfg.maxReplyChars) cfg.maxReplyChars = role.maxChars;
  state.role = cfg.role;
}

// ---------------------------------------------------------------- PowerShell agent
class Agent {
  constructor(processName) {
    this.processName = processName;
    this.proc = null;
    this.buf = '';
    this.seq = 0;
    this.pending = new Map();
    this.alive = false;
  }

  async start() {
    const script = path.join(HERE, 'psagent.ps1');
    if (!existsSync(script)) throw new Error('psagent.ps1 not found: ' + script);
    this.proc = spawn('powershell.exe', ['-NoProfile', '-Sta', '-ExecutionPolicy', 'Bypass', '-File', script, '-ProcessName', this.processName], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc.stdout.setEncoding('utf8');
    this.proc.stderr.setEncoding('utf8');
    this.proc.stdout.on('data', (d) => this._onData(d));
    this.proc.stderr.on('data', (d) => log({ level: 'warn', msg: 'psagent stderr: ' + String(d).slice(0, 200) }));
    this.proc.on('error', (err) => {
      this.alive = false;
      for (const [, r] of this.pending) r.reject(new Error('psagent spawn error: ' + (err?.message || err)));
      this.pending.clear();
    });
    this.proc.on('exit', (code) => {
      this.alive = false;
      for (const [, r] of this.pending) r.reject(new Error('psagent exited (' + code + ')'));
      this.pending.clear();
      log({ level: 'warn', msg: 'psagent exited: ' + code });
    });
    this.alive = true;
    await this.request('ping', {}, 15000);
  }

  _onData(chunk) {
    this.buf += chunk;
    let idx;
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      const waiter = this.pending.get(obj.id);
      if (waiter) {
        this.pending.delete(obj.id);
        if (obj.ok) waiter.resolve(obj);
        else waiter.reject(new Error(obj.error || 'psagent error'));
      }
    }
  }

  request(cmd, extra = {}, timeoutMs = 20000) {
    if (!this.proc || !this.alive) return Promise.reject(new Error('psagent not running'));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('psagent timeout: ' + cmd)); }, timeoutMs);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      try { this.proc.stdin.write(JSON.stringify({ id, cmd, ...extra }) + '\n'); } catch (err) { clearTimeout(timer); reject(err); }
    });
  }

  async restart() {
    try { this.proc?.kill(); } catch { /* ignore */ }
    this.pending.clear();
    this.buf = '';
    await sleep(300);
    await this.start();
  }

  stop() {
    try { this.proc?.kill(); } catch { /* ignore */ }
    this.alive = false;
  }
}

// ---------------------------------------------------------------- logging / audit
const OUT_EVENTS = [];
let OUT = (obj) => {
  if (obj && (obj.type === 'event' || obj.type === 'log')) {
    OUT_EVENTS.push(obj);
    if (OUT_EVENTS.length > 100) OUT_EVENTS.shift();
  }
  process.stdout.write(JSON.stringify(obj) + '\n');
};

function log(entry) {
  const line = { type: 'log', ts: Date.now(), ...entry };
  OUT(line);
}

async function audit(entry) {
  try {
    await fsp.mkdir(AUDIT_DIR, { recursive: true });
    const name = new Date().toISOString().slice(0, 10) + '.jsonl';
    await fsp.appendFile(path.join(AUDIT_DIR, name), JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', 'utf8');
  } catch { /* audit must never break the loop */ }
}

// ---------------------------------------------------------------- state
const state = {
  mode: 'off',
  contact: '',
  running: false,
  anchor: '',
  initialized: false,
  history: [],
  drafts: [],
  escalations: 0,
  lastError: null,
  lastPoll: null,
  stats: { polls: 0, changed: 0, replies: 0, drafts: 0, escalations: 0, skips: 0, errors: 0, avgPollMs: 0, lastReplyMs: 0, avgReplyMs: 0 },
  recentSends: [],
  pausedReason: null,
  lastTitle: '',
  lastOcrMs: 0,
  lastHandledKey: '',
  frameHash: '',
  role: 'friend',
};

let cfg = { ...DEFAULT_CONFIG };
let agent = null;
let loopRunning = false;

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function addDraft(draft) {
  const d = { id: newId(), ts: Date.now(), status: 'pending', ...draft };
  state.drafts.unshift(d);
  if (state.drafts.length > (cfg.draftRetention || 50)) state.drafts.length = cfg.draftRetention || 50;
  state.stats.drafts += 1;
  OUT({ type: 'event', event: 'draft', draft: d });
  audit({ kind: 'draft', ...d }).catch(() => {});
  return d;
}

// ---------------------------------------------------------------- send
// 发送串行化：loop 与 approve/send 工具可能同时触发，不能让两次粘贴交错。
let sendLock = Promise.resolve();
function withSendLock(fn) {
  const run = sendLock.then(fn, fn);
  sendLock = run.then(() => {}, () => {});
  return run;
}

async function sendText(text, opts = {}) {
  if (!agent?.alive) throw new Error('agent not running');
  const raw = String(text || '').trim();
  if (!raw) throw new Error('empty text');
  const now = Date.now();
  state.recentSends = state.recentSends.filter((t) => now - t.ts < 60000);
  // 限流不可绕过（包括工具直发）：模型手滑连发也挡得住
  const limitPerMin = Number.isFinite(Number(cfg.maxRepliesPerMinute)) ? Number(cfg.maxRepliesPerMinute) : 6;
  if (state.recentSends.length >= limitPerMin) {
    throw new Error('rate limited: ' + state.recentSends.length + ' messages in the last minute');
  }
  // 去重闸：同一句话 90 秒内绝不重复发（防重试/重入造成刷屏）
  const dup = state.recentSends.find((t) => t.text === raw && now - t.ts < 90000);
  if (dup) throw new Error('duplicate suppressed: 这句话 90 秒内已经发过');
  const res = await withSendLock(() => agent.request('send', { text: raw, clear: opts.clear === true, expect: state.contact, fast: !!cfg.fastMode }, 30000));
  if (res?.error || res?.sent === false) {
    state.stats.errors += 1;
    const reason = res?.error === 'title-mismatch'
      ? '会话标题不匹配（现在标题是 "' + (res.title || '?') + '"，期望 "' + state.contact + '"），已放弃发送'
      : res?.error === 'cannot-focus'
        ? '抢不到微信前台焦点（系统拒绝），已放弃发送'
        : res?.error === 'focus-lost'
          ? '按回车前焦点被抢走，已清空输入框并放弃发送'
          : '粘贴没有进入微信输入框，未发送';
    state.lastError = reason;
    audit({ kind: 'send-failed', text: raw, error: res?.error, reason }).catch(() => {});
    throw new Error(reason);
  }
  state.recentSends.push({ ts: now, text: raw });
  state.stats.replies += 1;
  audit({ kind: 'sent', text: raw, mode: state.mode, contact: state.contact }).catch(() => {});
  if (state.replyStartedAt) {
    const ms = Date.now() - state.replyStartedAt;
    state.stats.lastReplyMs = ms;
    state.stats.avgReplyMs = state.stats.replies <= 1 ? ms : Math.round((state.stats.avgReplyMs * (state.stats.replies - 1) + ms) / state.stats.replies);
    state.replyStartedAt = 0;
  }
  OUT({ type: 'event', event: 'sent', text: raw, ts: now, pasted: !!res?.pasted, remaining: res?.remaining ?? '', latencyMs: state.stats.lastReplyMs });
  return res || { sent: true };
}

async function pollOnce() {
  try {
    return await pollOnceInner();
  } catch (err) {
    if (!agent?.alive) {
      OUT({ type: 'event', event: 'warn', msg: 'psagent 失联，重启中' });
      await agent.restart();
      return await pollOnceInner();
    }
    throw err;
  }
}

async function pollOnceInner() {
  const t0 = Date.now();
  const res = await agent.request('poll', {}, 25000);
  const ms = Date.now() - t0;
  // 自己按 hash 判变化：PS 的 changed 只是它自己的缓存状态，
  // 任何一次 poll（scan / 确认 / 启动探测）都可能把它吃掉。
  const changed = typeof res.hash === 'string' && res.hash !== state.frameHash;
  if (changed) state.frameHash = res.hash;
  res.changed = changed;
  state.stats.polls += 1;
  state.stats.avgPollMs = Math.round((state.stats.avgPollMs * (state.stats.polls - 1) + ms) / state.stats.polls);
  state.lastPoll = { ts: Date.now(), ms, changed: !!res.changed, capMs: res.capMs, ocrMs: res.ocrMs, borrowed: !!res.borrowed };
  if (res.changed) state.stats.changed += 1;
  state.lastOcrMs = res.ocrMs || 0;
  state.lastTitle = res.title || '';
  return res;
}

// 严格匹配：宁可发不出去，也不要把私聊话术发进名字含联系人的群。
// 只容忍 OCR 常见的 1-2 字误差，且必须同前缀；群名后缀 (N) 一律视为不同会话。
function titleMatches(title, contact) {
  const norm = (s) => String(s || '').replace(/[\s\u3000]/g, '').toLowerCase();
  const a = norm(title);
  const b = norm(contact);
  if (!a || !b) return false;
  if (a === b) return true;
  if (/[(（]\s*\d+\s*[)）]$/.test(a)) return false;      // 群聊 "(5)"
  const prefixMatch = a.startsWith(b) || b.startsWith(a);
  const diff = Math.abs(a.length - b.length);
  return prefixMatch && diff <= 2;
}

function delayFor(urgent) {
  const d = cfg.delay || DEFAULT_CONFIG.delay;
  const median = urgent ? (d.urgentMedianMs ?? 1300) : (d.medianMs ?? 7000);
  const min = urgent ? (d.urgentMinMs ?? 500) : (d.minMs ?? 2500);
  const max = urgent ? (d.urgentMaxMs ?? 2600) : (d.maxMs ?? 35000);
  const gauss = (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;
  const ms = Math.round(median * Math.exp(gauss * 0.58));
  return Math.max(min, Math.min(max, ms));
}

// ---------------------------------------------------------------- decide
async function decideAndAct(pending) {
  const last = pending[pending.length - 1];
  const joined = pending.map((p) => p.text).join(' ');
  const level = classifyIdentity(joined, cfg);
  const urgent = new RegExp(cfg.urgentRe || '快点', 'i').test(joined);

  if (level === 'T0' || level === 'T1' || level === 'T2') {
    const line = level === 'T0' ? (cfg.escalateLine || DEFAULTS.escalateLine) : level === 'T1' ? (cfg.busyLine || DEFAULTS.busyLine) : (cfg.deferLine || DEFAULTS.deferLine);
    state.escalations += 1;
    state.stats.escalations += 1;
    const draft = addDraft({ kind: 'escalation', level, context: pending.map((p) => p.text), text: line, needsOwner: true });
    OUT({ type: 'event', event: 'escalate', level, context: pending.map((p) => p.text), draftId: draft.id });
    if (level === 'T0') {
      state.pausedReason = 'identity-question';
      state.mode = 'draft';
      OUT({ type: 'event', event: 'stopped', reason: 'identity-question', draftId: draft.id });
      return;
    }
    if (state.escalations >= (cfg.stopAfterEscalations || 2)) {
      state.mode = 'draft';
      state.pausedReason = 'too-many-escalations';
      OUT({ type: 'event', event: 'stopped', reason: 'too-many-escalations' });
      return;
    }
    if (state.mode === 'auto' && level !== 'T0') await maybeSend(line, { urgent: true });
    return;
  }

  // T3: 闲聊。只有「整串都是收尾语」才不回；只要有一句真问题就必须答。
  if (pending.every((m) => isAckOnly(m.text, cfg))) {
    state.stats.skips += 1;
    addDraft({ kind: 'skip', reason: 'ack-only', context: pending.map((p) => p.text), text: '' });
    OUT({ type: 'event', event: 'skip', reason: 'ack-only' });
    return;
  }

  const canned = cannedReply(last.text, cfg);
  if (canned === null) {
    state.stats.skips += 1;
    addDraft({ kind: 'skip', reason: 'canned-null', context: [last.text], text: '' });
    return;
  }

  let text = canned;
  let source = 'canned';
  if (!text) {
    if (!cfg.apiKey) {
      addDraft({ kind: 'needs-key', context: pending.map((p) => p.text), text: '', needsOwner: false });
      state.lastError = 'no apiKey configured';
      return;
    }
    const t0 = Date.now();
    try {
      const raw = await chat({
        apiKey: cfg.apiKey,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        messages: buildMessages({ persona: cfg.persona, contact: state.contact, history: state.history, pending }),
      });
      const genMs = Date.now() - t0;
      if (/^\s*SKIP\s*$/i.test(raw)) {
        state.stats.skips += 1;
        addDraft({ kind: 'skip', reason: 'llm-skip', context: pending.map((p) => p.text), text: '' });
        return;
      }
      text = sanitizeReply(raw, cfg.maxReplyChars || 40);
      source = 'llm:' + genMs + 'ms';
    } catch (err) {
      state.stats.errors += 1;
      state.lastError = String(err?.message || err);
      addDraft({ kind: 'error', reason: state.lastError, context: pending.map((p) => p.text), text: '' });
      return;
    }
  }
  if (!text) return;

  const draft = addDraft({ kind: 'reply', context: pending.map((p) => p.text), text, source, urgent });
  if (state.mode === 'auto') await maybeSend(text, { urgent, draftId: draft.id });
}

async function maybeSend(text, { urgent = false, draftId = null } = {}) {
  const delay = cfg.fastMode ? Math.max(0, Number(cfg.fastDelayMs ?? 120)) : delayFor(urgent);
  OUT({ type: 'event', event: 'thinking', text, delayMs: delay, draftId });
  await sleep(delay);
  const fresh = state.lastPoll && Date.now() - state.lastPoll.ts < 1500;
  const check = cfg.fastMode && fresh ? { title: state.lastTitle } : await pollOnce();
  if (!titleMatches(check.title, state.contact)) {
    state.lastError = 'title mismatch before send: ' + check.title;
    OUT({ type: 'event', event: 'blocked', reason: 'title-mismatch', title: check.title });
    return false;
  }
  const busy = cfg.fastMode ? null : await inputBusy();
  if (busy) {
    OUT({ type: 'event', event: 'blocked', reason: 'input-busy', detail: busy });
    state.lastError = '输入框里有别人正在打的字，放弃本次发送';
    return false;
  }
  try {
    // 唯一一次真实发送：清空只在明确要求时做，避免吃掉主人正在打的字
    const res = await sendText(text, { clear: false });
    if (draftId) {
      const d = state.drafts.find((x) => x.id === draftId);
      if (d) { d.status = 'sent'; d.sentAt = Date.now(); }
    }
    // 校验只做确认，绝不重发：重复发比漏发更像事故。
    // 输入框粘贴后有字、回车后被清空 —— 这是最硬的“确实发出去了”证据。
    const byInput = isRealInput(res?.pasted) && !isRealInput(res?.remaining);
    const confirmed = byInput || (await confirmSent(text));
    if (!confirmed) {
      const d = draftId ? state.drafts.find((x) => x.id === draftId) : null;
      if (d) d.status = 'unverified';
      OUT({ type: 'event', event: 'unverified', text, msg: '发出去了但 OCR 没在画面上确认到，请人工看一眼' });
      audit({ kind: 'unverified', text }).catch(() => {});
    }
    return true;
  } catch (err) {
    state.stats.errors += 1;
    state.lastError = String(err?.message || err);
    OUT({ type: 'event', event: 'error', msg: state.lastError });
    return false;
  }
}

/** 输入框里有没有待发的字（含占位提示词则视为空） */
const PLACEHOLDERS = /(长按|语音|发消息|按住说话)/;
const isRealInput = (t) => { const s = String(t || '').replace(/\s+/g, ''); return s.length > 0 && !PLACEHOLDERS.test(s); };
async function inputBusy() {
  try {
    if (!agent?.alive) return null;
    const r = await agent.request('input', {}, 12000);
    const t = String(r.text || '').replace(/\s+/g, '');
    if (!isRealInput(t)) return null;
    return t.slice(0, 40);
  } catch {
    return null; // 读不到输入框就当空闲，不阻断正常发送
  }
}

/** 多次确认自己那条是否真的出现在画面上；不重发，只确认 */
async function confirmSent(text) {
  const norm = String(text).replace(/\s+/g, '');
  const head = norm.slice(0, 6);
  const waits = cfg.fastMode ? [150, 400, 800] : [350, 800, 1500];
  for (const ms of waits) {
    await sleep(ms);
    try {
      const poll = await pollOnce();
      const msgs = parseMessages(poll, poll.crop);
      const hit = msgs.some((m) => m.dir === 'out' && m.text.replace(/\s+/g, '').includes(head));
      if (hit) return true;
    } catch { /* 单次确认失败不影响判定 */ }
  }
  return false;
}

// ---------------------------------------------------------------- loop
async function tick() {
  const poll = await pollOnce();
  if (!poll.changed) return;
  const msgs = parseMessages(poll, poll.crop);
  if (!msgs.length) return;
  state.history = msgs.slice(-30);

  if (!state.initialized) {
    state.anchor = lastIncomingKey(msgs);
    state.initialized = true;
    OUT({ type: 'event', event: 'armed', anchor: state.anchor, title: poll.title });
    return;
  }
  if (!titleMatches(poll.title, state.contact)) {
    OUT({ type: 'event', event: 'blocked', reason: 'title-mismatch', title: poll.title });
    return;
  }

  const fresh = sliceNewIncoming(msgs, state.anchor);
  if (!fresh.length) return;
  // 从“看到对方这句”开始计时，到真正发出去为止
  state.replyStartedAt = Date.now();

  // 连发合并：静默一小段时间，把对方这一串话一起读进来
  const anchorBefore = state.anchor;
  if (cfg.fastMode) {
    // 快档不做第二次整轮抓取：省掉一次 ~150ms 的 poll 和 OCR
    const listFast = fresh;
    const lastKeyFast = listFast[listFast.length - 1]?.key ?? '';
    state.anchor = lastKeyFast || fresh[fresh.length - 1].key;
    if (lastKeyFast && lastKeyFast === state.lastHandledKey) return;
    state.lastHandledKey = lastKeyFast;
    state.replyStartedAt = state.replyStartedAt || Date.now();
    await decideAndAct(listFast);
    return;
  }
  await sleep(cfg.coalesceMs ?? 1600);
  const poll2 = await pollOnce();
  const msgs2 = parseMessages(poll2, poll2.crop);
  if (msgs2.length) state.history = msgs2.slice(-30);
  const pending = sliceNewIncoming(msgs2.length ? msgs2 : msgs, anchorBefore);
  const list = pending.length ? pending : fresh;
  const lastKey = list[list.length - 1]?.key ?? '';
  state.anchor = lastKey || fresh[fresh.length - 1].key;
  // 锚点丢失（滚动/清屏）时可能重复拿到同一句，这里兜住
  if (lastKey && lastKey === state.lastHandledKey) {
    OUT({ type: 'event', event: 'skip', reason: 'already-handled', key: lastKey });
    return;
  }
  state.lastHandledKey = lastKey;
  await decideAndAct(list);
}

async function loop() {
  if (loopRunning) return;
  loopRunning = true;
  state.running = true;
  try {
    while (state.running) {
      if (state.mode === 'off') { await sleep(500); continue; }
      try {
        await tick();
      } catch (err) {
        state.stats.errors += 1;
        state.lastError = String(err?.message || err);
        OUT({ type: 'event', event: 'error', msg: state.lastError });
        await sleep(1500);
      }
      await sleep(Math.max(120, cfg.fastMode ? (cfg.pollMsFast ?? 280) : (cfg.pollMs ?? 900)));
    }
  } finally {
    loopRunning = false;
  }
}

// ---------------------------------------------------------------- control
const handlers = {
  async ping() { return { pong: true, pid: process.pid, home: SWB_HOME }; },
  async status() {
    return {
      mode: state.mode,
      running: state.running,
      contact: state.contact,
      initialized: state.initialized,
      title: state.lastTitle,
      drafts: state.drafts.slice(0, 10),
      stats: state.stats,
      lastPoll: state.lastPoll,
      lastError: state.lastError,
      pausedReason: state.pausedReason,
      escalations: state.escalations,
      config: publicConfig(),
    };
  },
  async start(args = {}) {
    cfg = deepMerge(cfg, {
      mode: args.mode || cfg.mode || 'draft',
      contact: args.contact || cfg.contact,
      apiKey: args.apiKey || cfg.apiKey,
      model: args.model || cfg.model,
      baseUrl: args.baseUrl || cfg.baseUrl,
      role: args.role || cfg.role || 'friend',
    });
    if (!cfg.contact) throw new Error('contact 不能为空：先在面板里填上和微信标题一致的会话名');
    applyRole();
    if (agent) agent.stop();
    agent = new Agent(cfg.processName || 'Weixin');
    await agent.start();
    await agent.request('config', { cfg: geometry(cfg) });
    // 启动即校验会话标题：对不上绝不开始，避免发错人。
    const probe = await pollOnce();
    if (!titleMatches(probe.title, cfg.contact)) {
      agent.stop();
      agent = null;
      throw new Error('当前微信会话是 "' + (probe.title || '(未识别)') + '"，与目标 "' + cfg.contact + '" 不一致。请先在微信里打开目标会话再启动。');
    }
    state.mode = cfg.mode === 'off' ? 'draft' : cfg.mode;
    state.contact = cfg.contact;
    state.initialized = false;
    state.anchor = '';
    state.pausedReason = null;
    loop().catch(() => {});
    return { started: true, mode: state.mode, contact: state.contact };
  },
  async stop() {
    state.running = false;
    state.mode = 'off';
    agent?.stop();
    return { stopped: true };
  },
  async scan() {
    if (!agent?.alive) {
      agent = new Agent(cfg.processName || 'Weixin');
      await agent.start();
      await agent.request('config', { cfg: geometry(cfg) });
    }
    const poll = await pollOnce();
    const msgs = parseMessages(poll, poll.crop);
    return { title: poll.title, changed: poll.changed, msgs, crop: poll.crop, ms: state.lastPoll?.ms };
  },
  async send(args = {}) {
    if (!args.text) throw new Error('text required');
    if (!agent?.alive) throw new Error('not started');
    const p = await pollOnce();
    if (!titleMatches(p.title, state.contact)) throw new Error('拒绝发送：当前会话是 "' + (p.title || '(未识别)') + '"，不是 "' + state.contact + '"');
    const busy = await inputBusy();
    if (busy) throw new Error('输入框里有正在打的字（' + busy + '），先处理掉再发');
    await sendText(String(args.text), { clear: false, force: true });
    return { sent: true, text: args.text };
  },
  async drafts(args = {}) {
    const list = state.drafts.filter((d) => !args.status || d.status === args.status);
    return { drafts: list };
  },
  async approve(args = {}) {
    const d = state.drafts.find((x) => x.id === args.id);
    if (!d) throw new Error('draft not found: ' + args.id);
    if (!d.text) throw new Error('draft has no text');
    // CAS：只有 pending 能被批准一次，重复批准直接拒绝（防重复发送）
    if (d.status !== 'pending') throw new Error('draft ' + d.id + ' 当前状态是 ' + d.status + '，不能再次发送');
    d.status = 'sending';
    try {
      const probe = await pollOnce();
      if (!titleMatches(probe.title, state.contact)) {
        d.status = 'pending';
        throw new Error('当前会话是 "' + (probe.title || '(未识别)') + '"，不是 "' + state.contact + '"，已放弃发送');
      }
      const busy = await inputBusy();
      if (busy) { d.status = 'pending'; throw new Error('输入框里有正在打的字（' + busy + '），先处理掉再发'); }
      await sendText(d.text, { clear: false, force: true });
      d.status = 'sent';
      d.sentAt = Date.now();
      return { sent: true, text: d.text };
    } catch (err) {
      if (d.status === 'sending') d.status = 'pending';
      throw err;
    }
  },
  async reject(args = {}) {
    const d = state.drafts.find((x) => x.id === args.id);
    if (!d) throw new Error('draft not found: ' + args.id);
    d.status = 'rejected';
    d.rejectedAt = Date.now();
    return { rejected: true, draftId: d.id };
  },
  async config(args = {}) {
    let errors = [];
    let warnings = [];
    if (args.set && typeof args.set === 'object') {
      const v = validatePatch(args.set);
      if (v.patch.role && !ROLE_KEYS.includes(v.patch.role)) v.errors.push('未知角色: ' + v.patch.role);
      errors = v.errors; warnings = v.warnings;
      if (v.errors.length) return { ok: false, errors, warnings, config: publicConfig() };
      cfg = deepMerge(cfg, v.patch);
      if (typeof v.patch.role === 'string') applyRole();
      if (typeof v.patch.contact === 'string' && v.patch.contact) {
        state.contact = v.patch.contact;
        state.initialized = false;
        state.anchor = '';
        state.lastHandledKey = '';
      }
      if (typeof v.patch.mode === 'string') state.mode = v.patch.mode === 'off' ? 'off' : v.patch.mode;
      if (agent?.alive) await agent.request('config', { cfg: geometry(cfg) }).catch(() => {});
    }
    return { ok: true, errors, warnings, config: publicConfig(), role: cfg.role };
  },
  async log(args = {}) {
    return { drafts: state.drafts.slice(0, args.n || 20), stats: state.stats, lastError: state.lastError };
  },
  /**
   * 仅测试模式（SWB_TEST=1）：把一段"对方说的话"直接灌进决策链，
   * 走的是和真实轮询完全相同的 decideAndAct，因此能覆盖到真实发送。
   */
  async simulate(args = {}) {
    if (process.env.SWB_TEST !== '1') throw new Error('simulate 仅在 SWB_TEST=1 时可用');
    const texts = Array.isArray(args.texts) ? args.texts : [String(args.text || '')];
    if (!texts.length || !texts[0]) throw new Error('texts required');
    const pending = texts.map((t, i) => ({ dir: 'in', text: String(t), key: 'sim:' + i + ':' + t, i }));
    state.history = pending.slice();
    state.replyStartedAt = Date.now();
    await decideAndAct(pending);
    return { drafts: state.drafts.slice(0, 3), mode: state.mode, lastError: state.lastError };
  },
};

function publicConfig() {
  const { apiKey, ...rest } = cfg;
  return { ...rest, apiKey: apiKey ? '***' : '' };
}

function geometry(c) {
  return {
    chatLeftRatio: c.chatLeftRatio, msgTopRatio: c.msgTopRatio, msgWidthRatio: c.msgWidthRatio, msgHeightRatio: c.msgHeightRatio,
    inputX: c.inputX, inputY: c.inputY, searchX: c.searchX, searchY: c.searchY,
    titleX: c.titleX, titleY: c.titleY, titleW: c.titleW, titleH: c.titleH, ocrScale: c.ocrScale,
  };
}

function reply(id, ok, payload) {
  OUT({ type: 'reply', id, ok, ...payload });
}

function panelState() {
  return {
    mode: state.mode,
    contact: state.contact,
    title: state.lastTitle,
    role: cfg.role,
    roleLabel: getRole(cfg.role).label,
    roles: ROLE_KEYS.map((k) => ({ key: k, label: ROLES[k].label })),
    drafts: state.drafts.slice(0, 20),
    stats: state.stats,
    lastError: state.lastError,
    events: OUT_EVENTS.slice(-20),
    config: publicConfig(),
  };
}

async function boot() {
  await acquireLock();
  cfg = await loadConfig();
  state.contact = cfg.contact || '';
  state.mode = 'off';
  log({ level: 'info', msg: 'daemon up', home: SWB_HOME, model: cfg.model });
  applyRole();
  state.contact = cfg.contact || '';
  const panel = startPanel({
    port: Number(cfg.panelPort) || 47821,
    getState: panelState,
    setConfig: (patch) => handlers.config({ set: patch }),
    start: (args) => handlers.start(args),
    stop: () => handlers.stop(),
    draftAction: async ({ id, action }) => (action === 'approve' ? handlers.approve({ id }) : handlers.reject({ id })),
  });
  log({ level: 'info', msg: 'panel at ' + panel.url });
  if (cfg.autoStart) {
    handlers.start({ mode: cfg.mode, contact: cfg.contact }).catch((e) => log({ level: 'error', msg: 'autostart failed: ' + e.message }));
  }
}

let rl = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  rl += chunk;
  let idx;
  while ((idx = rl.indexOf('\n')) >= 0) {
    const line = rl.slice(0, idx).trim();
    rl = rl.slice(idx + 1);
    if (!line) continue;
    let req;
    try { req = JSON.parse(line); } catch { continue; }
    const fn = handlers[req.cmd];
    if (!fn) { reply(req.id, false, { error: 'unknown cmd: ' + req.cmd }); continue; }
    const guarded = Promise.race([
      Promise.resolve().then(() => fn(req)),
      new Promise((_, rej) => setTimeout(() => rej(new Error('handler timeout: ' + req.cmd)), 25000)),
    ]);
    guarded
      .then((res) => reply(req.id, true, res || {}))
      .catch((err) => reply(req.id, false, { error: String(err?.message || err) }));
  }
});

const LOCK_FILE = path.join(SWB_HOME, 'daemon.pid');
const PID = process.pid;

async function acquireLock() {
  try {
    await fsp.mkdir(SWB_HOME, { recursive: true });
    const prev = Number((await fsp.readFile(LOCK_FILE, 'utf8').catch(() => '')).trim());
    if (prev && prev !== PID) {
      let alive = false;
      try { process.kill(prev, 0); alive = true; } catch { alive = false; }
      if (alive) throw new Error('another super-wechat-bot daemon is already running (pid ' + prev + ')');
    }
  } catch (err) {
    if (/already running/.test(String(err?.message))) throw err;
  }
  await fsp.writeFile(LOCK_FILE, String(PID), 'utf8').catch(() => {});
}

async function releaseLock() {
  try {
    const cur = (await fsp.readFile(LOCK_FILE, 'utf8').catch(() => '')).trim();
    if (cur === String(PID)) await fsp.unlink(LOCK_FILE).catch(() => {});
  } catch { /* ignore */ }
}

function shutdown(code = 0) {
  try { agent?.stop(); } catch { /* ignore */ }
  releaseLock().finally(() => process.exit(code));
}

// 宿主死了就自杀：绝不留一个还在替人发消息的孤儿进程
process.stdin.on('end', () => shutdown(0));
process.stdin.on('close', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));
// 未捕获异常：停手退出，绝不在半更新状态下继续发消息
process.on('uncaughtException', (e) => {
  try { state.mode = 'off'; state.running = false; } catch { /* ignore */ }
  log({ level: 'error', msg: 'uncaught (stopping): ' + (e?.message || e) });
  audit({ kind: 'crash', error: String(e?.message || e) }).catch(() => {});
  shutdown(1);
});
process.on('unhandledRejection', (e) => log({ level: 'error', msg: 'unhandled: ' + (e?.message || e) }));

await boot();
