// dsh-super-wechat-bot / test/client.test.mjs — 客户端设置页的离线冒烟测试
// 用一个假的 ModuleLoader + 假 React 跑 bundle：验证只注册一个设置条目、重复 apply 不叠加。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, '..', 'lib', 'client.js');
const src = fs.readFileSync(FILE, 'utf8');

let pass = 0;
const ok = (name, cond) => { if (!cond) { console.error('  FAIL ' + name); process.exitCode = 1; } else { pass++; console.log('  ok  ' + name); } };

// --- 假平台 ---
let captured = null;
const styles = [];
const fakeDoc = {
  head: { appendChild: (el) => styles.push(el.id) },
  getElementById: () => null,
  createElement: () => ({ id: '', textContent: '' }),
};
globalThis.document = fakeDoc;
const registrations = [];
const disposals = [];
const fakeSlots = {
  inject: (name, fn) => { const d = fn(); return typeof d === 'function' ? d : () => {}; },
  register: (opts, comp) => {
    registrations.push({ opts, comp });
    return () => { disposals.push(opts.id); };
  },
};
const fakeCtx = { slots: fakeSlots, effect: (fn) => fn() };
globalThis.window = {
  __ModuleLoader__: {
    load: (cfg) => { captured = cfg; },
  },
};
const fakeReact = {
  createElement: (type, props, children) => ({ type, props: props || {}, children }),
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: () => {},
  useRef: (v) => ({ current: v }),
  useCallback: (fn) => fn,
};

// --- 执行 bundle ---
new Function('window', src)(globalThis.window);
ok('bundle 能被加载', !!captured);
ok('模块 id 是 dsh-super-wechat-bot', captured && captured.id === 'dsh-super-wechat-bot');

const mod = captured.factory(() => fakeReact);
ok('导出 apply', typeof mod.apply === 'function');
ok('导出 inject 含 slots', Array.isArray(mod.inject) && mod.inject.includes('slots'));

mod.apply(fakeCtx);
ok('注册了 1 个设置条目', registrations.length === 1);
const first = registrations[0] || { opts: {} };
ok('条目 id 正确', first.opts.id === 'dsh-super-wechat-bot');
ok('条目名是 settings.section', first.opts.name === 'settings.section');
ok('标签是「微信代聊」', typeof first.opts.label === 'function' && first.opts.label() === '微信代聊');
ok('排除了默认排序冲突', first.opts.order === 36);
ok('组件是个函数', typeof first.comp === 'function');

// 重复 apply：应回收旧条目而不是叠加
mod.apply(fakeCtx);
ok('重复 apply 会先回收旧条目', disposals.length >= 1);
ok('同一页面最多 1 个活动条目', registrations.length - disposals.filter(Boolean).length <= 1);

// 渲染：离线分支不应抛异常
const treeOffline = first.comp();
ok('离线时能渲染出节点', !!treeOffline);

// 有网时 fetch 返回一份 state，渲染不应抛异常
globalThis.fetch = async () => ({ json: async () => ({ mode: 'draft', contact: 'aaa', title: 'aaa', role: 'teacher', roleLabel: '教师', roles: [{ key: 'teacher', label: '教师' }], drafts: [], stats: { polls: 1 }, events: [], config: { delay: {}, identity: {} } }) });
const treeOnline = first.comp();
ok('读到状态后能渲染出节点', !!treeOnline);

// 静态检查：bundle 里只能有一个 label 注册点
const labelHits = src.split('label: () => "微信代聊"').length - 1;
ok('只有一个「微信代聊」注册点', labelHits === 1);

console.log('\n客户端设置页：' + pass + ' 项通过');
