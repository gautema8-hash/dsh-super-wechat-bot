// dsh-super-wechat-bot / validate.mjs
// 配置校验：面板/工具写进来的每一个值都先过这里。
// 目的只有一个——配置写错也不能让它发错消息。

export const LIMITS = {
  pollMs: [200, 5000],
  coalesceMs: [0, 8000],
  maxRepliesPerMinute: [0, 20],
  maxReplyChars: [8, 120],
  stopAfterEscalations: [1, 10],
  delayMedianMs: [300, 120000],
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));

function checkRegex(pattern, field, errors) {
  if (typeof pattern !== 'string' || !pattern) { errors.push(field + ': 必须是非空字符串'); return; }
  try { new RegExp(pattern, 'i'); } catch (e) { errors.push(field + ': 正则不合法 (' + e.message + ')'); }
}

/**
 * 校验并归一化配置补丁。返回 { ok, patch, errors, warnings }
 * 非法项直接剔除，永远不把坏配置写进运行时。
 */
export function validatePatch(input) {
  const errors = [];
  const warnings = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, patch: {}, errors: ['配置必须是对象'], warnings };
  }
  const out = {};

  if ('mode' in input) {
    if (!['off', 'draft', 'auto'].includes(input.mode)) errors.push('mode 只能是 off / draft / auto');
    else out.mode = input.mode;
  }
  if ('contact' in input) {
    const c = String(input.contact || '').trim();
    if (!c) errors.push('contact 不能为空');
    else if (c.length > 40) errors.push('contact 太长（>40 字）');
    else out.contact = c;
  }
  if ('customRoles' in input) {
    if (!Array.isArray(input.customRoles)) errors.push('customRoles 必须是数组');
    else {
      const list = [];
      input.customRoles.slice(0, 20).forEach((r, i) => {
        if (!r || typeof r !== 'object') { errors.push('customRoles[' + i + '] 不是对象'); return; }
        if (!r.key || !/^[a-zA-Z0-9_-]{2,32}$/.test(String(r.key))) { errors.push('customRoles[' + i + '].key 只能字母数字下划线横线（2-32）'); return; }
        if (!r.label || typeof r.label !== 'string') { errors.push('customRoles[' + i + '].label 必填'); return; }
        if (!r.persona || typeof r.persona !== 'string') { errors.push('customRoles[' + i + '].persona 必填'); return; }
        if (r.defer != null) { try { new RegExp(String(r.defer)); } catch (e) { errors.push('customRoles[' + i + '].defer 正则不合法'); return; } }
        const canned = Array.isArray(r.canned) ? r.canned.slice(0, 20).map((c, j) => {
          if (!c || typeof c.re !== 'string') { errors.push('customRoles[' + i + '].canned[' + j + '] 缺 re'); return null; }
          try { new RegExp(c.re); } catch (e) { errors.push('customRoles[' + i + '].canned[' + j + '].re 正则不合法'); return null; }
          return { re: String(c.re), reply: c.reply === null ? null : String(c.reply || '').slice(0, 60) };
        }).filter(Boolean) : [];
        list.push({ key: String(r.key), label: String(r.label).slice(0, 40), persona: String(r.persona).slice(0, 2000), defer: r.defer ? String(r.defer) : '', deferLine: String(r.deferLine || '这个我确认下再回你').slice(0, 60), maxChars: Number(r.maxChars) > 0 ? Math.min(120, Math.max(8, Math.round(Number(r.maxChars)))) : 45, canned });
      });
      out.customRoles = list;
    }
  }
  if ('role' in input) {
    const r = String(input.role || '').trim();
    if (!r) errors.push('role 不能为空');
    else out.role = r;
  }
  if ('maxChars' in input) {
    const n = Number(input.maxChars);
    if (!isNum(n)) errors.push('maxChars 必须是数字');
    else out.maxReplyChars = clamp(Math.round(n), LIMITS.maxReplyChars);
  }
  for (const key of Object.keys(LIMITS)) {
    if (!(key in input)) continue;
    const n = Number(input[key]);
    if (!isNum(n)) { errors.push(key + ' 必须是数字'); continue; }
    const [lo, hi] = LIMITS[key];
    const clamped = clamp(n, [lo, hi]);
    if (clamped !== n) warnings.push(key + ' 超出范围，已收敛到 ' + clamped);
    out[key] = Math.round(clamped);
  }
  for (const key of ['escalateLine', 'deferLine', 'busyLine']) {
    if (!(key in input)) continue;
    const s = String(input[key] || '').trim();
    if (!s) { errors.push(key + ' 不能为空'); continue; }
    if (s.length > 60) { errors.push(key + ' 太长（>60 字）'); continue; }
    out[key] = s;
  }
  if ('apiKey' in input) {
    const k = String(input.apiKey || '').trim();
    if (k && !/^sk-[A-Za-z0-9_-]{10,}$/.test(k)) warnings.push('apiKey 形如 sk-...，当前值可能不是有效 key');
    out.apiKey = k;
  }
  if ('model' in input) {
    const m = String(input.model || '').trim();
    if (!/^[A-Za-z0-9._-]+$/.test(m)) errors.push('model 名称不合法');
    else out.model = m;
  }
  if ('identity' in input && input.identity && typeof input.identity === 'object') {
    const id = {};
    for (const k of ['t0', 't1', 't2']) {
      if (input.identity[k] == null) continue;
      checkRegex(input.identity[k], 'identity.' + k, errors);
      id[k] = String(input.identity[k]);
    }
    out.identity = id;
  }
  if ('urgentRe' in input) {
    checkRegex(input.urgentRe, 'urgentRe', errors);
    if (typeof input.urgentRe === 'string') out.urgentRe = input.urgentRe;
  }
  if ('ackOnly' in input) {
    checkRegex(input.ackOnly, 'ackOnly', errors);
    if (typeof input.ackOnly === 'string') out.ackOnly = input.ackOnly;
  }
  if ('canned' in input) {
    if (!Array.isArray(input.canned)) errors.push('canned 必须是数组');
    else {
      const list = [];
      input.canned.slice(0, 50).forEach((item, i) => {
        if (!item || typeof item !== 'object') { errors.push('canned[' + i + '] 不是对象'); return; }
        try { new RegExp(item.re, 'i'); } catch (e) { errors.push('canned[' + i + '].re 正则不合法'); return; }
        if (item.reply !== null && typeof item.reply !== 'string') { errors.push('canned[' + i + '].reply 必须是字符串或 null'); return; }
        list.push({ re: String(item.re), reply: item.reply === null ? null : String(item.reply).slice(0, 60) });
      });
      out.canned = list;
    }
  }
  // --- 面板新增字段：节奏/限额/进程/模型/角色分隔 ---
  for (const key of ['fastMode', 'autoStart']) {
    if (key in input) out[key] = !!input[key];
  }
  for (const [key, [lo, hi]] of Object.entries({
    pollMsFast: [50, 5000],
    coalesceMsFast: [0, 8000],
    fastDelayMs: [0, 5000],
    draftRetention: [1, 200],
  })) {
    if (!(key in input)) continue;
    const n = Number(input[key]);
    if (!Number.isFinite(n)) { errors.push(key + ' 必须是数字'); continue; }
    const clamped = clamp(Math.round(n), [lo, hi]);
    if (clamped !== Math.round(n)) warnings.push(key + ' 超出范围，已收敛到 ' + clamped);
    out[key] = clamped;
  }
  if ('skipAckProbability' in input) {
    const n = Number(input.skipAckProbability);
    if (!Number.isFinite(n) || n < 0 || n > 1) errors.push('skipAckProbability 必须在 0~1 之间');
    else out.skipAckProbability = n;
  }
  if ('processName' in input) {
    const s = String(input.processName || '').trim();
    if (!/^[A-Za-z0-9_.-]{1,40}$/.test(s)) errors.push('processName 只能是进程名（如 Weixin）');
    else out.processName = s;
  }
  if ('baseUrl' in input) {
    const s = String(input.baseUrl || '').trim().replace(/\/+$/, '');
    if (!/^https?:\/\/[^\s]+$/.test(s)) errors.push('baseUrl 必须是 http(s) 地址');
    else out.baseUrl = s;
  }
  if ('roleDefer' in input) {
    checkRegex(input.roleDefer, 'roleDefer', errors);
    if (typeof input.roleDefer === 'string') out.roleDefer = input.roleDefer;
  }

  if ('delay' in input && input.delay && typeof input.delay === 'object') {
    const d = {};
    for (const [k, v] of Object.entries(input.delay)) {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 300000) { warnings.push('delay.' + k + ' 非法，已忽略'); continue; }
      d[k] = Math.round(n);
    }
    out.delay = d;
  }
  return { ok: errors.length === 0, patch: out, errors, warnings };
}
