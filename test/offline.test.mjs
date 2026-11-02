// dsh-super-wechat-bot / test/offline.test.mjs — 不依赖微信、不联网的纯逻辑自测
import assert from 'node:assert';
import { parseMessages, sliceNewIncoming, lastIncomingKey } from '../bridge/parse.mjs';
import { classifyIdentity, isAckOnly, cannedReply, sanitizeReply, DEFAULTS } from '../bridge/policy.mjs';

let pass = 0;
const ok = (name, fn) => { fn(); pass++; console.log('  ok  ' + name); };

// 造一屏 OCR 结果：绿气泡=自己，左侧=对方，中间时间戳要滤掉
const crop = { w: 818, h: 847 };
const lines = [
  { x: 353, y: 484, w: 46, h: 20, t: '0 ： 08', bg: '1F1716' },
  { x: 162, y: 589, w: 69, h: 29, t: '几 点 ？', bg: 'EEEEF0' },
  { x: 375, y: 694, w: 59, h: 20, t: '22 ： 55', bg: 'FAFAFA' },
  { x: 430, y: 784, w: 213, h: 28, t: 'xuyangtogether', bg: '9DF29F' },
  { x: 602, y: 63, w: 138, h: 26, t: '父 1 条 新 消 息', bg: 'FAFAFA' },
  { x: 150, y: 60, w: 60, h: 24, t: 'aa a', bg: 'EEEEF0' },
];

ok('时间戳/系统条/输入框提示被过滤', () => {
  const msgs = parseMessages({ lines }, crop);
  const texts = msgs.map((m) => m.text);
  assert.ok(!texts.some((t) => /条新消息/.test(t)), 'pill 未过滤');
  assert.ok(!texts.includes('22：55'), '时间戳未过滤');
});

ok('绿色气泡判为自己发的', () => {
  const msgs = parseMessages({ lines }, crop);
  const out = msgs.filter((m) => m.dir === 'out');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].text, 'xuyangtogether');
});

ok('左侧白气泡判为对方发的', () => {
  const msgs = parseMessages({ lines }, crop);
  const inc = msgs.filter((m) => m.dir === 'in').map((m) => m.text);
  assert.ok(inc.includes('几点？'), '没识别出对方消息');
});

ok('同一气泡的多行会合并', () => {
  const multi = [
    { x: 150, y: 100, w: 200, h: 24, t: '第一行', bg: 'EEEEF0' },
    { x: 150, y: 126, w: 180, h: 24, t: '第二行', bg: 'EEEEF0' },
  ];
  const msgs = parseMessages({ lines: multi }, crop);
  assert.strictEqual(msgs.length, 1);
  assert.strictEqual(msgs[0].text, '第一行第二行');
});

ok('增量切片只返回锚点之后的新消息', () => {
  const msgs = parseMessages({ lines }, crop);
  const anchor = 'in:几点？';
  const fresh = sliceNewIncoming(msgs, anchor);
  assert.strictEqual(fresh.length, 0);
  assert.strictEqual(lastIncomingKey(msgs), anchor);
});

ok('身份质疑 T0 命中', () => {
  for (const t of ['你是不是机器人', '你跟变了个人一样', '你是谁啊', '怎么秒回']) {
    assert.strictEqual(classifyIdentity(t, DEFAULTS), 'T0', t);
  }
});

ok('钱/承诺类 T2 命中', () => {
  for (const t of ['借我五百', '明天几点见', '把地址发我']) {
    assert.strictEqual(classifyIdentity(t, DEFAULTS), 'T2', t);
  }
});

ok('普通闲聊是 T3', () => {
  assert.strictEqual(classifyIdentity('今天好热啊', DEFAULTS), 'T3');
});

ok('收尾语识别为无需回复', () => {
  for (const t of ['嗯', '哦哦', '好吧', '😂']) assert.ok(isAckOnly(t, DEFAULTS), t);
  assert.ok(!isAckOnly('明天几点见', DEFAULTS));
});

ok('预置短语直接命中', () => {
  assert.strictEqual(cannedReply('在吗', DEFAULTS), '在');
  assert.strictEqual(cannedReply('吃了吗', DEFAULTS), '刚吃完');
  assert.strictEqual(cannedReply('嗯', DEFAULTS), null);
});

ok('回复清洗：去引号/去换行/限长', () => {
  assert.strictEqual(sanitizeReply('"在呢"'), '在呢');
  assert.strictEqual(sanitizeReply('好\n第二行'), '好');
  const long = sanitizeReply('我今天下午一直在弄那个东西，弄到很晚才弄好，你等我一下', 40);
  assert.ok(long.length <= 40, '超长未截断: ' + long.length);
});

console.log('\n' + pass + ' 项通过');
