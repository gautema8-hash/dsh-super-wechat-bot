// super-wechat-bot / panel.mjs
// 本地面板：把配置、角色、草稿、状态做成一个网页。
// 只监听 127.0.0.1，不对外暴露；所有写入都会先过 validate.mjs。

import http from 'node:http';

const PAGE = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>super-wechat-bot 面板</title>
<style>
:root{--bg:#0f1115;--card:#171a21;--line:#262b36;--txt:#e6e9ef;--dim:#8b93a5;--ok:#3ecf8e;--warn:#f0b429;--err:#f05252;--accent:#4c8dff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.55 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
.wrap{max-width:940px;margin:0 auto;padding:22px 18px 60px}
h1{font-size:17px;margin:0 0 4px}h1 span{color:var(--dim);font-weight:400;font-size:12px;margin-left:8px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:14px}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
label{color:var(--dim);font-size:12px;display:block;margin-bottom:5px}
input,select,textarea{background:#0d1017;border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px 10px;font:inherit;width:100%}
input[type=number]{width:110px}
button{background:var(--accent);color:#fff;border:0;border-radius:8px;padding:8px 14px;font:inherit;cursor:pointer}
button.ghost{background:transparent;border:1px solid var(--line);color:var(--txt)}
button.danger{background:var(--err)}
button:disabled{opacity:.45;cursor:not-allowed}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;border:1px solid var(--line)}
.pill.auto{color:var(--ok);border-color:#1f5c43}.pill.draft{color:var(--warn);border-color:#5c4a1f}.pill.off{color:var(--dim)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.draft{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-top:10px}
.draft .ctx{color:var(--dim);font-size:12px;margin:4px 0}
.draft .tx{font-size:15px;margin:6px 0 10px;white-space:pre-wrap}
.log{font-family:ui-monospace,Consolas,monospace;font-size:12px;color:var(--dim);max-height:170px;overflow:auto;white-space:pre-wrap}
.err{color:var(--err);font-size:12px;margin-top:8px}
.ok{color:var(--ok);font-size:12px;margin-top:8px}
</style></head><body><div class="wrap">
<h1>super-wechat-bot<span>微信代聊面板</span></h1>
<div id="guide" style="display:none;margin-top:12px"></div>
<div class="row" style="margin-top:10px"><span id="mode" class="pill off">—</span><span class="pill" id="title">会话 —</span><span class="pill" id="rolePill">角色 —</span><span class="pill" id="stats">—</span></div>

<div class="card"><div class="grid">
<div><label>会话标题（必须和微信里完全一致）</label><input id="contact" placeholder="aaa"></div>
<div><label>角色预设</label><select id="role"></select></div>
<div><label>运行模式</label><select id="modeSel"><option value="draft">draft 只拟不发（默认）</option><option value="auto">auto 自动发送</option><option value="off">off 停止</option></select></div>
<div><label>每分钟最多发几条</label><input id="limit" type="number" min="0" max="20"></div>
<div><label>拟人延迟中位（毫秒）</label><input id="median" type="number" min="300" max="120000"></div>
<div><label>单条字数上限</label><input id="maxChars" type="number" min="8" max="120"></div>
</div>
<div class="row" style="margin-top:14px">
<button id="save">保存配置</button>
<button id="startDraft" class="ghost">以 draft 启动</button>
<button id="startAuto" class="ghost">以 auto 启动</button>
<button id="stop" class="danger">停止</button>
<span id="msg"></span>
</div></div>

<div class="card"><div class="row"><strong>待处理草稿</strong><span class="pill" id="draftCount">0</span></div><div id="drafts"></div></div>
<div class="card"><strong>最近事件</strong><div class="log" id="log"></div></div>
</div>
<script>
const $ = (s) => document.querySelector(s);
async function loadGuide() {
  const g = await api('/api/preflight');
  const box = $('#guide');
  if (g.ready) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.innerHTML = '<div class="card" style="border-color:#5c4a1f"><strong>还差 ' + g.steps.length + ' 步才能用</strong>' +
    g.steps.map((s, i) => '<div class="draft"><div class="ctx">第 ' + (i + 1) + ' 步 · ' + s.title + '</div><div class="tx">' + s.action + '</div></div>').join('') +
    '<div class="row" style="margin-top:10px">' + (g.wechat.running ? '' : '<button id="gLaunch">打开微信</button> ') +
    '<button class="ghost" id="gRetry">重新检测</button>' +
    (g.wechat.running ? '<span class="pill">当前会话：' + (g.wechat.title || '(未识别)') + '</span>' : '') + '</div></div>';
  const lb = $('#gLaunch'); if (lb) lb.onclick = async () => { const r = await api('/api/launch', {}); say(r.ok ? '已尝试打开微信' : ('打开失败：' + (r.error || '')), !r.ok); setTimeout(loadGuide, 1500); };
  const rb = $('#gRetry'); if (rb) rb.onclick = () => { loadGuide(); load(); };
}
let state = null;
const api = async (path, body) => {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  return r.json();
};
const say = (t, bad) => { const el = $('#msg'); el.className = bad ? 'err' : 'ok'; el.textContent = t; setTimeout(() => { el.textContent = ''; }, 4000); };
async function load() {
  const st = await api('/api/state');
  state = st;
  $('#mode').className = 'pill ' + st.mode; $('#mode').textContent = st.mode;
  $('#title').textContent = '会话 ' + (st.title || '(未识别)') + ' / 目标 ' + st.contact;
  $('#rolePill').textContent = '角色 ' + (st.roleLabel || st.role);
  $('#stats').textContent = '轮询 ' + st.stats.polls + ' · 已发 ' + st.stats.replies + ' · 草稿 ' + st.stats.drafts;
  if (document.activeElement.tagName !== 'INPUT') {
    $('#contact').value = st.contact || '';
    $('#modeSel').value = st.mode === 'off' ? 'off' : st.mode;
    $('#limit').value = st.config.maxRepliesPerMinute ?? 6;
    $('#median').value = st.config.delay?.medianMs ?? 7000;
    $('#maxChars').value = st.config.maxReplyChars ?? 40;
  }
  const sel = $('#role');
  if (sel.options.length === 0) {
    for (const r of st.roles) { const o = document.createElement('option'); o.value = r.key; o.textContent = r.label; sel.appendChild(o); }
  }
  sel.value = st.role;
  const ds = (st.drafts || []).filter((d) => d.status === 'pending');
  $('#draftCount').textContent = ds.length;
  $('#drafts').innerHTML = ds.map((d) => \`<div class="draft"><div class="ctx">\${d.kind || ''} \${d.level || ''} \${d.source || ''}</div><div class="ctx">对方：\${(d.context || []).join(' / ')}</div><div class="tx">\${d.text || '（不回）'}</div><button data-a="approve" data-id="\${d.id}">发送这条</button> <button class="ghost" data-a="reject" data-id="\${d.id}">丢弃</button></div>\`).join('') || '<div class="log">暂无</div>';
  $('#log').textContent = (st.events || []).slice(-14).map((e) => new Date(e.ts || Date.now()).toLocaleTimeString() + '  ' + (e.event || e.level) + '  ' + (e.msg || e.text || e.reason || '')).join('\\n');
  document.querySelectorAll('#drafts button').forEach((b) => b.onclick = async () => {
    const r = await api('/api/draft', { id: b.dataset.id, action: b.dataset.a });
    say(r.ok ? '已' + (b.dataset.a === 'approve' ? '发送' : '丢弃') : (r.error || '失败'), !r.ok); load();
  });
}
$('#save').onclick = async () => {
  const r = await api('/api/config', {
    contact: $('#contact').value.trim(),
    role: $('#role').value,
    maxRepliesPerMinute: Number($('#limit').value),
    maxChars: Number($('#maxChars').value),
    delay: { medianMs: Number($('#median').value) },
  });
  say(r.ok ? '已保存' : (r.errors || []).join('；') || '保存失败', !r.ok); load();
};
$('#startDraft').onclick = async () => { const r = await api('/api/start', { mode: 'draft' }); say(r.ok ? '已启动(draft)' : r.error, !r.ok); load(); };
$('#startAuto').onclick = async () => { const r = await api('/api/start', { mode: 'auto' }); say(r.ok ? '已启动(auto)' : r.error, !r.ok); load(); };
$('#stop').onclick = async () => { const r = await api('/api/stop', {}); say(r.ok ? '已停止' : r.error, !r.ok); load(); };
load(); loadGuide(); setInterval(load, 2000); setInterval(loadGuide, 6000);
</script></body></html>`;

function send(res, code, obj) {
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj);
  res.writeHead(code, {
    'content-type': typeof obj === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  });
  res.end(body);
}

function readBody(req, limit = 200000) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > limit) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}

/**
 * @param {{ port:number, getState:()=>any, setConfig:(patch:any)=>Promise<any>, start:(args:any)=>Promise<any>, stop:()=>Promise<any>, draftAction:(args:any)=>Promise<any> }} opts
 */
export function startPanel(opts) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'OPTIONS') return send(res, 204, { ok: true });
      if (url.pathname === '/' || url.pathname === '/index.html') return send(res, 200, PAGE);
      if (url.pathname === '/api/state' && req.method === 'GET') return send(res, 200, opts.getState());
      if (url.pathname === '/api/preflight') return send(res, 200, await opts.preflight());
      if (url.pathname === '/api/launch') return send(res, 200, await opts.launch());
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method not allowed' });
      const body = await readBody(req);
      if (url.pathname === '/api/config') return send(res, 200, await opts.setConfig(body));
      if (url.pathname === '/api/start') return send(res, 200, await opts.start(body));
      if (url.pathname === '/api/stop') return send(res, 200, await opts.stop());
      if (url.pathname === '/api/draft') return send(res, 200, await opts.draftAction(body));
      return send(res, 404, { ok: false, error: 'not found' });
    } catch (err) {
      return send(res, 500, { ok: false, error: String(err?.message || err) });
    }
  });
  server.listen(opts.port, '127.0.0.1');
  server.on('error', () => { /* 端口被占就静默放弃面板，不影响主循环 */ });
  return {
    close: () => { try { server.close(); } catch { /* ignore */ } },
    url: 'http://127.0.0.1:' + opts.port + '/',
  };
}
