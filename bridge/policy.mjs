// super-wechat-bot / policy.mjs
// Deterministic gates: canned replies, identity escalation, ack filtering.

export const DEFAULTS = {
  canned: [
    { re: '^(在吗|在不在|在么|人呢)$', reply: '在' },
    { re: '^(在吗[?？]?|在不在[?？]?)$', reply: '咋了' },
    { re: '^(吃了吗|吃了没|吃了么)$', reply: '刚吃完' },
    { re: '^(下班没|下班了吗)$', reply: '还没' },
    { re: '^(几点|几点了|现在几点)$', reply: '看下' },
    { re: '^(好的|好|嗯|ok|OK)$', reply: null },
  ],
  identity: {
    t0: '(是|不是).{0,4}(机器人|AI|ai|人工智能)|真人吗|本人吗|自动回复|自动发的|是不是你|跟变了个人|不像你|你是谁啊|你谁啊|怎么秒回|这么快回|谁在回|谁在用|被|账号被盗',
    t1: '(咋这么|怎么这么|今天怎么|不对劲|怪怪的|你没事吧)',
    t2: '(转账|借钱|借我|借点|还钱|打钱|转我|收款|红包|多少钱|合同|签个|签约|定金|付款|报销|工资|分期|首付|密码|验证码|身份证|地址|住哪|分手|喜欢|表白|生病|医院|明天.{0,6}(来|到|见)|几点.{0,4}见|等你.{0,4}吃饭|出来吃|一起吃饭|请你吃|见面|来我家|去你那)',
  },
  ackOnly: '^(嗯+|哦+|哦哦|好吧|好的吧|行吧|收到了|知道了|[\\u{1F300}-\\u{1FAFF}\\u2600-\\u27BF]+)$',
  escalateLine: '一会儿我亲自跟你说',
  deferLine: '这个我晚点跟你细说',
  busyLine: '我这会儿有点忙 晚点跟你说',
};

export function classifyIdentity(msg, cfg) {
  const id = cfg.identity || DEFAULTS.identity;
  if (new RegExp(id.t0, 'i').test(msg)) return 'T0';
  if (new RegExp(id.t1, 'i').test(msg)) return 'T1';
  if (new RegExp(id.t2, 'i').test(msg)) return 'T2';
  if (cfg.roleDefer) {
    try { if (new RegExp(cfg.roleDefer, 'i').test(msg)) return 'T2'; } catch { /* 坏正则忽略 */ }
  }
  return 'T3';
}

export function isAckOnly(msg, cfg) {
  const re = new RegExp(cfg.ackOnly || DEFAULTS.ackOnly, 'u');
  return re.test(msg.trim());
}

export function cannedReply(msg, cfg) {
  const list = Array.isArray(cfg.canned) ? cfg.canned : [];
  const t = msg.trim();
  for (const item of list) {
    try {
      if (new RegExp(item.re, 'i').test(t)) return item.reply;
    } catch { /* 坏正则跳过 */ }
  }
  return undefined;
}

export function sanitizeReply(text, maxChars = 40) {
  let s = String(text ?? '').trim();
  s = s.replace(/^[\s"'“”'‘’]+|[\s"'“”'‘’]+$/g, '');
  s = s.split(/\r?\n/)[0].trim();
  s = s.replace(/^(回复|答|输出)[:：]\s*/, '');
  s = s.replace(/[*_`#>]+/g, '');
  if (s.length > maxChars) {
    const cut = s.slice(0, maxChars);
    const m = cut.match(/^(.{4,}?)[，。,.!?！？~～]/);
    s = m ? m[1] : cut;
  }
  return s.trim();
}
