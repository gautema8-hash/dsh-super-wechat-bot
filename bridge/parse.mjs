// super-wechat-bot / parse.mjs
// OCR lines -> chat messages (direction + merged bubbles).

const TIME_RE = /^(\d{1,2}[:：]\d{2}|\d{1,2}月\d{1,2}日|星期[一二三四五六日天]|(上午|下午|凌晨|晚上)?\s*\d{1,2}[:：]\d{2})$/;
// 微信自己的绿色气泡 #95EC69：绿通道显著高于红/蓝
function isGreen(hex) {
  if (typeof hex !== 'string' || hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return false;
  return g - r > 25 && g > 170 && b < 190;
}

function isLight(hex) {
  if (typeof hex !== 'string' || hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return false;
  return r > 200 && g > 200 && b > 195 && Math.abs(r - b) < 40;
}

const SYSTEM_RE = /(条新消息|以下是新消息|撤回了一条消息|加入了群聊|拍了拍|以上是打招呼的内容|对方正在输入)/;

function norm(t) {
  return String(t ?? '').replace(/\s+/g, '');
}

/**
 * @param {{lines: Array<{x:number,y:number,w:number,h:number,t:string}>}} poll
 * @param {{width:number,height:number}} crop
 */
export function parseMessages(poll, crop) {
  const W = crop?.w || 818;
  const lines = (poll?.lines || [])
    .map((l) => ({ ...l, t: norm(l.t) }))
    .filter((l) => l.t.length > 0)
    .filter((l) => !TIME_RE.test(l.t) && !SYSTEM_RE.test(l.t))
    .map((l) => {
      const right = l.x + l.w;
      let dir = null;
      if (isGreen(l.bg)) dir = 'out';
      else if (isLight(l.bg)) dir = 'in';   // 微信对方气泡是白/浅灰
      // 底色读不出来时宁可不认这一行，也不按位置猜（猜错会自己回自己）
      return { ...l, right, dir };
    })
    .filter((l) => l.dir)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const msgs = [];
  let cur = null;
  for (const l of lines) {
    const gap = cur ? l.y - (cur.y + cur.h) : 0;
    if (cur && cur.dir === l.dir && gap <= Math.max(18, l.h * 1.2)) {
      cur.text += l.t;
      cur.h = Math.max(cur.y + cur.h, l.y + l.h) - cur.y;
      continue;
    }
    cur = { dir: l.dir, text: l.t, x: l.x, y: l.y, w: l.w, h: l.h };
    msgs.push(cur);
  }
  return msgs.map((m, i) => ({ ...m, i, key: m.dir + ':' + m.text }));
}

/** 只保留对方发的，去掉与上一轮重复的前缀 */
export function sliceNewIncoming(all, lastKey) {
  const incoming = all.filter((m) => m.dir === 'in');
  if (!lastKey) return [];
  let idx = -1;
  for (let i = incoming.length - 1; i >= 0; i--) {
    if (incoming[i].key === lastKey) { idx = i; break; }
  }
  if (idx >= 0) return incoming.slice(idx + 1);
  // 找不到锚点（滚动/清屏）：保守地只取最后一条，避免整屏重放
  return incoming.length ? [incoming[incoming.length - 1]] : [];
}

export function lastIncomingKey(all) {
  const incoming = all.filter((m) => m.dir === 'in');
  return incoming.length ? incoming[incoming.length - 1].key : '';
}
