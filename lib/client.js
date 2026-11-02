// dsh-super-wechat-bot / lib/client.js
// DSH 客户端半边：设置 → 微信代聊。一个条目、一套完整参数面板。
window.__ModuleLoader__.load({
  id: "dsh-super-wechat-bot",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    const React = require("react");
    const h = React.createElement;
    const { useState, useEffect, useRef, useCallback, useMemo } = React;

    const API = "http://127.0.0.1:47821";
    const NS = "dsh-super-wechat-bot";
    const CSS_TEXT = ":root{--swb-r:12px;--swb-gap:12px}\n.swb-root{display:flex;flex-direction:column;gap:14px;max-width:920px;font-size:13px;color:inherit}\n.swb-top{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}\n.swb-live{display:inline-flex;align-items:center;gap:7px;font-weight:600;font-size:13px;padding:5px 12px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.32))}\n.swb-live.s-auto{color:#30a46c;border-color:rgba(48,164,108,.45);background:rgba(48,164,108,.08)}\n.swb-live.s-draft{color:#f0b429;border-color:rgba(240,180,41,.45);background:rgba(240,180,41,.08)}\n.swb-live.s-off{opacity:.66}\n.swb-dot{width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px rgba(255,255,255,.06)}\n.swb-session{display:flex;flex-direction:column;gap:2px;font-size:12px;opacity:.72;line-height:1.55}\n.swb-spacer{flex:1}\n.swb-btns{display:flex;gap:8px;flex-wrap:wrap}\n.swb-btn{cursor:pointer;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.34));background:var(--dsw-specific-tip,transparent);color:inherit;border-radius:9px;height:32px;padding:0 13px;font-size:13px;line-height:1;transition:background .12s,border-color .12s,opacity .12s;white-space:nowrap}\n.swb-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14))}\n.swb-btn:active{transform:translateY(.5px)}\n.swb-btn:focus-visible{outline:2px solid #4c8dff;outline-offset:2px}\n.swb-btn[disabled]{opacity:.42;cursor:not-allowed}\n.swb-btn.primary{background:#4c8dff;border-color:transparent;color:#fff}\n.swb-btn.primary:hover{filter:brightness(1.07)}\n.swb-btn.danger{color:#e5484d;border-color:rgba(229,72,77,.42)}\n.swb-btn.sm{height:27px;padding:0 10px;font-size:12px;border-radius:8px}\n.swb-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:10px}\n.swb-m{border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.18));border-radius:var(--swb-r);padding:9px 12px;display:flex;flex-direction:column;gap:3px;background:var(--dsw-alias-bg-elevated,rgba(255,255,255,.015))}\n.swb-m b{font-size:17px;font-weight:600;line-height:1.15;font-variant-numeric:tabular-nums}\n.swb-m span{font-size:11px;opacity:.58}\n.swb-tabs{display:flex;gap:2px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.2));flex-wrap:wrap}\n.swb-tab{border:0;background:none;color:inherit;font:inherit;font-size:13px;padding:9px 13px;cursor:pointer;opacity:.62;border-bottom:2px solid transparent;margin-bottom:-1px}\n.swb-tab:hover{opacity:.9}\n.swb-tab.on{opacity:1;border-bottom-color:#4c8dff;font-weight:600}\n.swb-tab:focus-visible{outline:2px solid #4c8dff;outline-offset:-2px;border-radius:6px}\n.swb-pane{display:flex;flex-direction:column;gap:14px;padding:2px 0}\n.swb-group{border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.18));border-radius:var(--swb-r);padding:14px}\n.swb-ghead{display:flex;align-items:baseline;gap:8px;margin-bottom:12px}\n.swb-ghead b{font-size:13px;font-weight:600}\n.swb-ghead span{font-size:11.5px;opacity:.55}\n.swb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(214px,1fr));gap:12px}\n.swb-field{display:flex;flex-direction:column;gap:5px;min-width:0}\n.swb-field>label{font-size:11px;color:var(--dsw-alias-label-tertiary,rgba(128,128,128,.95));letter-spacing:.01em}\n.swb-hint{font-size:11px;opacity:.5;line-height:1.45}\n.swb-root input,.swb-root select,.swb-root textarea{border-radius:9px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.3));background:var(--dsw-alias-bg-elevated,rgba(255,255,255,.02));color:inherit;padding:7px 10px;font:inherit;font-size:13px;width:100%;box-sizing:border-box;transition:border-color .12s,box-shadow .12s}\n.swb-root input:hover,.swb-root select:hover,.swb-root textarea:hover{border-color:rgba(128,128,128,.5)}\n.swb-root input:focus,.swb-root select:focus,.swb-root textarea:focus{outline:none;border-color:#4c8dff;box-shadow:0 0 0 3px rgba(76,141,255,.16)}\n.swb-root input[type=number]{font-variant-numeric:tabular-nums}\n.swb-root textarea{min-height:96px;font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.6;resize:vertical}\n.swb-banner{border-radius:var(--swb-r);padding:10px 13px;font-size:12.5px;line-height:1.65;border:1px solid}\n.swb-banner.warn{color:#f0b429;border-color:rgba(240,180,41,.35);background:rgba(240,180,41,.07)}\n.swb-banner.err{color:#e5484d;border-color:rgba(229,72,77,.35);background:rgba(229,72,77,.07)}\n.swb-banner.ok{color:#30a46c;border-color:rgba(48,164,108,.35);background:rgba(48,164,108,.07)}\n.swb-banner.info{opacity:.85;border-color:var(--dsw-alias-border-l1,rgba(128,128,128,.25))}\n.swb-savebar{position:sticky;bottom:0;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 2px;margin-top:2px;background:linear-gradient(to top,var(--dsw-alias-bg-base,transparent) 72%,transparent)}\n.swb-dirty{font-size:12px;color:#f0b429;display:inline-flex;align-items:center;gap:6px}\n.swb-dirty::before{content:\"\";width:6px;height:6px;border-radius:50%;background:currentColor}\n.swb-rowcard{display:flex;align-items:center;gap:10px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.18));border-radius:var(--swb-r);padding:10px 13px}\n.swb-muted{font-size:12px;opacity:.6;line-height:1.6}\n.swb-empty{border:1px dashed var(--dsw-alias-border-l1,rgba(128,128,128,.28));border-radius:var(--swb-r);padding:22px;text-align:center;font-size:12px;opacity:.55}\n.swb-log{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;opacity:.7;max-height:210px;overflow:auto;white-space:pre-wrap;line-height:1.75;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.16));border-radius:10px;padding:10px}\n.swb-draft{border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.18));border-radius:var(--swb-r);padding:11px 13px;display:flex;flex-direction:column;gap:7px}\n.swb-draft .t{font-size:14px;line-height:1.6;white-space:pre-wrap}\n.swb-canned{display:grid;grid-template-columns:minmax(120px,1fr) minmax(140px,1.4fr) auto;gap:8px;align-items:center}\n.swb-confirm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1px solid rgba(240,180,41,.4);background:rgba(240,180,41,.07);border-radius:10px;padding:8px 12px;font-size:12.5px}\n.swb-skel{height:12px;border-radius:6px;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14));animation:swbPulse 1.4s ease-in-out infinite}\n@keyframes swbPulse{0%,100%{opacity:.45}50%{opacity:.85}}";
    const SECTION_ID = "dsh-super-wechat-bot";
    const GUARD_KEY = "__SWB_SETTINGS_SECTION__";

    function useCss() {
      useEffect(() => {
        let el = document.getElementById("swb-client-css");
        if (!el) {
          el = document.createElement("style");
          el.id = "swb-client-css";
          document.head.appendChild(el);
        }
        el.textContent = CSS_TEXT;
      }, []);
    }

    async function call(path, body) {
      const res = await fetch(API + path, body === undefined ? { cache: "no-store" } : {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }

    const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);

    function hydrate(s) {
      const c = s.config || {};
      const d = c.delay || {};
      const id = c.identity || {};
      return {
        contact: s.contact || c.contact || "",
        role: c.role || "friend",
        processName: c.processName || "Weixin",
        autoStart: !!c.autoStart,
        fastMode: !!c.fastMode,
        pollMs: num(c.pollMs, 900),
        coalesceMs: num(c.coalesceMs, 1600),
        maxRepliesPerMinute: num(c.maxRepliesPerMinute, 6),
        maxReplyChars: num(c.maxReplyChars, 40),
        stopAfterEscalations: num(c.stopAfterEscalations, 2),
        skipAckProbability: num(c.skipAckProbability, 0.85),
        delayMedian: num(d.medianMs, 7000),
        delayMin: num(d.minMs, 2500),
        delayMax: num(d.maxMs, 35000),
        delayUrgentMedian: num(d.urgentMedianMs, 1300),
        escalateLine: c.escalateLine || "",
        deferLine: c.deferLine || "",
        busyLine: c.busyLine || "",
        urgentRe: c.urgentRe || "",
        ackOnly: c.ackOnly || "",
        roleDefer: c.roleDefer || "",
        t0: id.t0 || "",
        t1: id.t1 || "",
        t2: id.t2 || "",
        model: c.model || "deepseek-flash",
        baseUrl: c.baseUrl || "https://api.deepseek.com",
        apiKey: "",
        canned: Array.isArray(c.canned) ? c.canned.map((x) => ({ re: x.re, reply: x.reply === null ? "" : x.reply })) : [],
        rolesText: JSON.stringify(c.customRoles || [], null, 1),
      };
    }

    const TABS = [
      { key: "basic", label: "基础" },
      { key: "behavior", label: "行为" },
      { key: "scripts", label: "话术" },
      { key: "safety", label: "安全" },
      { key: "advanced", label: "高级" },
      { key: "runtime", label: "运行" },
    ];

    function Btn(props) {
      return h("button", {
        type: "button",
        className: "swb-btn" + (props.variant ? " " + props.variant : "") + (props.small ? " sm" : ""),
        onClick: props.onClick, disabled: props.disabled, title: props.title,
      }, props.children);
    }

    function Field(props) {
      const id = "swb-" + props.name;
      const control = props.options
        ? h("select", { id, value: props.value, onChange: (e) => props.onChange(e.target.value), "aria-label": props.label },
            props.options.map((o) => h("option", { key: String(o.value), value: o.value }, o.label)))
        : h("input", {
            id, type: props.type || "text", value: props.value, placeholder: props.placeholder || "",
            step: props.step, onChange: (e) => props.onChange(e.target.value), "aria-label": props.label,
          });
      return h("div", { className: "swb-field" }, [
        h("label", { key: "l", htmlFor: id }, props.label),
        h("span", { key: "c" }, control),
        props.hint ? h("span", { key: "h", className: "swb-hint" }, props.hint) : null,
      ]);
    }

    function Group(props) {
      return h("div", { className: "swb-group" }, [
        h("div", { key: "hd", className: "swb-ghead" }, [h("b", { key: "t" }, props.title), props.sub ? h("span", { key: "s" }, props.sub) : null]),
        h("div", { key: "bd", className: "swb-grid" }, props.children),
      ]);
    }

    function Metric(props) {
      return h("div", { className: "swb-m" }, [h("b", { key: "v" }, String(props.value)), h("span", { key: "l" }, props.label)]);
    }

    function Skeleton() {
      return h("div", { className: "swb-root" }, [1, 2, 3, 4].map((i) => h("div", { key: i, className: "swb-skel", style: { width: (86 - i * 9) + "%" } })));
    }

    function Panel() {
      useCss();
      const [st, setSt] = useState(null);
      const [form, setForm] = useState(null);
      const [msg, setMsg] = useState(null);
      const [errs, setErrs] = useState([]);
      const [saving, setSaving] = useState(false);
      const [pf, setPf] = useState(null);
      const [dirty, setDirty] = useState(false);
      const [tab, setTab] = useState("basic");
      const [confirmAuto, setConfirmAuto] = useState(false);
      const touched = useRef(false);

      const say = (text, kind) => { setMsg({ text, kind: kind || "ok" }); setTimeout(() => setMsg(null), 5500); };

      const load = useCallback(async (force) => {
        try {
          const s = await call("/api/state");
          setSt(s);
          if (force || !touched.current) { setForm(hydrate(s)); touched.current = false; setDirty(false); }
        } catch (e) { setSt({ offline: true }); }
      }, []);
      useEffect(() => { load(); const t = setInterval(() => load(), 3000); return () => clearInterval(t); }, [load]);

      const set = (k) => (v) => { touched.current = true; setDirty(true); setForm((f) => Object.assign({}, f, { [k]: v })); };

      const save = async () => {
        if (!form) return;
        let customRoles;
        try { customRoles = JSON.parse(form.rolesText || "[]"); } catch (e) { setErrs(["自定义角色 JSON 解析失败：" + e.message]); return; }
        const body = {
          contact: String(form.contact || "").trim(), role: form.role, processName: form.processName,
          autoStart: !!form.autoStart, fastMode: !!form.fastMode,
          pollMs: Number(form.pollMs), coalesceMs: Number(form.coalesceMs),
          maxRepliesPerMinute: Number(form.maxRepliesPerMinute), maxReplyChars: Number(form.maxReplyChars),
          stopAfterEscalations: Number(form.stopAfterEscalations), skipAckProbability: Number(form.skipAckProbability),
          escalateLine: form.escalateLine, deferLine: form.deferLine, busyLine: form.busyLine,
          urgentRe: form.urgentRe, ackOnly: form.ackOnly, roleDefer: form.roleDefer,
          identity: { t0: form.t0, t1: form.t1, t2: form.t2 },
          delay: { medianMs: Number(form.delayMedian), minMs: Number(form.delayMin), maxMs: Number(form.delayMax), urgentMedianMs: Number(form.delayUrgentMedian) },
          model: form.model, baseUrl: form.baseUrl,
          canned: (form.canned || []).map((r) => ({ re: r.re, reply: String(r.reply || "").length ? r.reply : null })),
          customRoles: customRoles,
        };
        if (String(form.apiKey || "").trim()) body.apiKey = String(form.apiKey).trim();
        setSaving(true); setErrs([]);
        try {
          const r = await call("/api/config", body);
          if (r.ok) {
            touched.current = false; setDirty(false);
            const w = r.warnings || [];
            say(w.length ? "已保存（" + w.join("；") + "）" : "已保存", w.length ? "warn" : "ok");
            load(true);
          } else { setErrs(r.errors || ["保存失败"]); }
        } catch (e) { setErrs(["保存失败：" + e.message]); }
        setSaving(false);
      };

      const start = async (mode) => {
        setConfirmAuto(false);
        try {
          const r = await call("/api/start", { mode });
          say(r.ok ? "已启动（" + mode + "）" : (r.error || "启动失败"), r.ok ? "ok" : "err");
        } catch (e) { say("启动失败：" + e.message, "err"); }
        load();
      };
      const stop = async () => {
        try { const r = await call("/api/stop", {}); say(r.ok ? "已停止" : "停止失败", r.ok ? "ok" : "err"); } catch (e) { say("停止失败：" + e.message, "err"); }
        load();
      };
      const preflight = async () => { try { setPf(await call("/api/preflight")); } catch (e) { say("体检失败：" + e.message, "err"); } };
      const act = async (id, action) => {
        try {
          const r = await call("/api/draft", { id: id, action: action });
          say(r.ok ? (action === "approve" ? "已发送" : "已丢弃") : (r.error || "失败"), r.ok ? "ok" : "err");
        } catch (e) { say("操作失败：" + e.message, "err"); }
        load();
      };

      if (!st) return Skeleton();
      if (st.offline) {
        return h("div", { className: "swb-root" }, [
          h("div", { key: "b", className: "swb-banner warn" }, "连不上本地桥进程 127.0.0.1:47821。插件可能没在运行，或 DSH 刚启动还没把它拉起来。"),
          h("div", { key: "a" }, h(Btn, { onClick: () => load() }, "重试连接")),
        ]);
      }
      if (!form) return Skeleton();

      const drafts = (st.drafts || []).filter((d) => d.status === "pending");
      const mode = st.mode || "off";
      const modeCls = mode === "auto" ? "s-auto" : mode === "draft" ? "s-draft" : "s-off";
      const modeText = mode === "auto" ? "自动发送中" : mode === "draft" ? "草稿模式" : "已停止";
      const want = String(form.contact || "").trim();
      const cur = st.title || "";
      const mismatch = want && cur && want !== cur;
      const stats = st.stats || {};

      const paneBasic = h("div", { className: "swb-pane" }, [
        h(Group, { key: "g1", title: "会话", sub: "机器人只在标题匹配时工作" }, [
          h(Field, { key: "c", name: "contact", label: "目标会话（与微信标题完全一致）", value: form.contact, onChange: set("contact"), placeholder: "例如 aaa" }),
          h(Field, { key: "p", name: "processName", label: "微信进程名", value: form.processName, onChange: set("processName"), hint: "默认 Weixin" }),
          h(Field, {
            key: "a", name: "autoStart", label: "DSH 启动时自动拉起机器人", value: form.autoStart ? "1" : "0",
            onChange: (v) => set("autoStart")(v === "1"), options: [{ value: "0", label: "否" }, { value: "1", label: "是" }],
            hint: "只拉起桥进程，不会自动发消息",
          }),
        ]),
        h(Group, { key: "g2", title: "角色", sub: "决定语气与话术禁区" }, [
          h(Field, { key: "r", name: "role", label: "角色预设", value: form.role, onChange: set("role"), options: (st.roles || []).map((r) => ({ value: r.key, label: r.label })) }),
        ]),
      ]);

      const paneBehavior = h("div", { className: "swb-pane" }, [
        h(Group, { key: "g1", title: "节奏", sub: "越小越快，也越像机器" }, [
          h(Field, { key: "pm", name: "pollMs", label: "轮询间隔 (ms)", type: "number", value: form.pollMs, onChange: set("pollMs") }),
          h(Field, { key: "cm", name: "coalesceMs", label: "连发合并窗口 (ms)", type: "number", value: form.coalesceMs, onChange: set("coalesceMs") }),
          h(Field, { key: "fm", name: "fastMode", label: "快档（被催时更密）", value: form.fastMode ? "1" : "0", onChange: (v) => set("fastMode")(v === "1"), options: [{ value: "0", label: "关" }, { value: "1", label: "开" }] }),
        ]),
        h(Group, { key: "g2", title: "拟人延迟", sub: "对数正态抖动，单位毫秒" }, [
          h(Field, { key: "dm", name: "delayMedian", label: "中位数", type: "number", value: form.delayMedian, onChange: set("delayMedian") }),
          h(Field, { key: "dmn", name: "delayMin", label: "下限", type: "number", value: form.delayMin, onChange: set("delayMin") }),
          h(Field, { key: "dmx", name: "delayMax", label: "上限", type: "number", value: form.delayMax, onChange: set("delayMax") }),
          h(Field, { key: "du", name: "delayUrgentMedian", label: "被催时中位数", type: "number", value: form.delayUrgentMedian, onChange: set("delayUrgentMedian") }),
        ]),
        h(Group, { key: "g3", title: "发送限额", sub: "硬约束，任何调用都绕不过" }, [
          h(Field, { key: "lm", name: "limit", label: "每分钟最多发（0 = 全停）", type: "number", value: form.maxRepliesPerMinute, onChange: set("maxRepliesPerMinute") }),
          h(Field, { key: "mc", name: "maxChars", label: "单条字数上限", type: "number", value: form.maxReplyChars, onChange: set("maxReplyChars") }),
          h(Field, { key: "se", name: "stopAfter", label: "连续升级几次停手", type: "number", value: form.stopAfterEscalations, onChange: set("stopAfterEscalations") }),
          h(Field, { key: "sk", name: "skipAck", label: "收尾语不回复概率 (0~1)", type: "number", step: "0.05", value: form.skipAckProbability, onChange: set("skipAckProbability") }),
        ]),
      ]);

      const paneScripts = h("div", { className: "swb-pane" }, [
        h(Group, { key: "g1", title: "固定回话" }, [
          h(Field, { key: "es", name: "escalate", label: "身份被质疑时", value: form.escalateLine, onChange: set("escalateLine") }),
          h(Field, { key: "df", name: "defer", label: "拿不准时", value: form.deferLine, onChange: set("deferLine") }),
          h(Field, { key: "bs", name: "busy", label: "正忙时", value: form.busyLine, onChange: set("busyLine") }),
        ]),
        h("div", { key: "g2", className: "swb-group" }, [
          h("div", { key: "hd", className: "swb-ghead" }, [h("b", { key: "t" }, "预置短语"), h("span", { key: "s" }, (form.canned || []).length + " 条 · 逐字命中优先")]),
          h("div", { key: "list", style: { display: "flex", flexDirection: "column", gap: 8 } },
            (form.canned || []).length === 0
              ? h("div", { key: "e", className: "swb-empty" }, "还没有预置短语，加一条试试")
              : (form.canned || []).map((row, i) => h("div", { key: "c" + i, className: "swb-canned" }, [
                  h("input", { key: "re", value: row.re, placeholder: "正则，如在吗|在么", "aria-label": "匹配规则", onChange: (e) => { const v = e.target.value; setForm((f) => { const a = f.canned.slice(); a[i] = Object.assign({}, a[i], { re: v }); return Object.assign({}, f, { canned: a }); }); setDirty(true); touched.current = true; } }),
                  h("input", { key: "rp", value: row.reply, placeholder: "回复；留空 = 不回", "aria-label": "回复内容", onChange: (e) => { const v = e.target.value; setForm((f) => { const a = f.canned.slice(); a[i] = Object.assign({}, a[i], { reply: v }); return Object.assign({}, f, { canned: a }); }); setDirty(true); touched.current = true; } }),
                  h(Btn, { key: "del", small: true, variant: "danger", onClick: () => { setForm((f) => Object.assign({}, f, { canned: f.canned.filter((_, j) => j !== i) })); setDirty(true); touched.current = true; } }, "删除"),
                ]))),
          h("div", { key: "add", style: { marginTop: 10 } }, h(Btn, { small: true, onClick: () => { setForm((f) => Object.assign({}, f, { canned: (f.canned || []).concat([{ re: "", reply: "" }]) })); setDirty(true); touched.current = true; } }, "+ 添加一条")),
        ]),
      ]);

      const paneSafety = h("div", { className: "swb-pane" }, [
        h(Group, { key: "g1", title: "身份分级", sub: "命中即转人工或停手" }, [
          h(Field, { key: "t0", name: "t0", label: "T0 身份质疑", value: form.t0, onChange: set("t0"), hint: "如 是不是机器人" }),
          h(Field, { key: "t1", name: "t1", label: "T1 不对劲", value: form.t1, onChange: set("t1") }),
          h(Field, { key: "t2", name: "t2", label: "T2 钱 / 承诺 / 见面", value: form.t2, onChange: set("t2") }),
        ]),
        h(Group, { key: "g2", title: "其它规则" }, [
          h(Field, { key: "u", name: "urgent", label: "被催", value: form.urgentRe, onChange: set("urgentRe") }),
          h(Field, { key: "a", name: "ack", label: "纯收尾语", value: form.ackOnly, onChange: set("ackOnly") }),
          h(Field, { key: "rd", name: "roleDefer", label: "角色禁区（转人工）", value: form.roleDefer, onChange: set("roleDefer") }),
        ]),
      ]);

      const paneAdvanced = h("div", { className: "swb-pane" }, [
        h(Group, { key: "g1", title: "模型", sub: "生成回复用的" }, [
          h(Field, { key: "mo", name: "model", label: "模型", value: form.model, onChange: set("model") }),
          h(Field, { key: "bu", name: "baseUrl", label: "Base URL", value: form.baseUrl, onChange: set("baseUrl") }),
          h(Field, { key: "ak", name: "apiKey", label: "API Key", type: "password", value: form.apiKey, onChange: set("apiKey"), placeholder: "已配置 · 留空不修改", hint: "只在本地配置文件里" }),
        ]),
        h("div", { key: "g2", className: "swb-group" }, [
          h("div", { key: "hd", className: "swb-ghead" }, [h("b", { key: "t" }, "自定义角色"), h("span", { key: "s" }, "JSON 数组")]),
          h("div", { key: "h", className: "swb-hint", style: { marginBottom: 8 } }, "每项 { key, label, persona, defer?, deferLine?, maxChars?, canned?[] }"),
          h("textarea", { key: "rt", value: form.rolesText, "aria-label": "自定义角色 JSON", onChange: (e) => set("rolesText")(e.target.value) }),
        ]),
      ]);

      const paneRuntime = h("div", { className: "swb-pane" }, [
        h("div", { key: "d", className: "swb-group" }, [
          h("div", { key: "hd", className: "swb-ghead" }, [h("b", { key: "t" }, "待处理草稿"), h("span", { key: "s" }, drafts.length + " 条")]),
          drafts.length === 0
            ? h("div", { key: "e", className: "swb-empty" }, "暂无草稿。有新消息进来时会出现在这里。")
            : h("div", { key: "l", style: { display: "flex", flexDirection: "column", gap: 10 } }, drafts.map((d) => h("div", { key: d.id, className: "swb-draft" }, [
                h("div", { key: "m", className: "swb-muted" }, [d.kind || "", d.level || "", d.source || ""].filter(Boolean).join(" · ") || "草稿"),
                h("div", { key: "c", className: "swb-muted" }, "对方：" + (d.context || []).join(" / ")),
                h("div", { key: "t", className: "t" }, d.text || "（不回）"),
                h("div", { key: "b", style: { display: "flex", gap: 8 } }, [
                  h(Btn, { key: "a", variant: "primary", small: true, disabled: !d.text, onClick: () => act(d.id, "approve") }, "发送"),
                  h(Btn, { key: "r", small: true, onClick: () => act(d.id, "reject") }, "丢弃"),
                ]),
              ]))),
        ]),
        h("div", { key: "e", className: "swb-group" }, [
          h("div", { key: "hd", className: "swb-ghead" }, [h("b", { key: "t" }, "最近事件")]),
          h("div", { key: "log", className: "swb-log" }, (st.events || []).slice(-14).map((e, i) =>
            h("div", { key: i }, new Date(e.ts || Date.now()).toLocaleTimeString() + "  " + (e.event || e.level) + "  " + (e.msg || e.text || e.reason || "")))),
        ]),
      ]);

      const panes = { basic: paneBasic, behavior: paneBehavior, scripts: paneScripts, safety: paneSafety, advanced: paneAdvanced, runtime: paneRuntime };

      return h("div", { className: "swb-root" }, [
        h("div", { key: "top", className: "swb-top" }, [
          h("span", { key: "l", className: "swb-live " + modeCls }, [h("span", { key: "d", className: "swb-dot" }), modeText]),
          h("div", { key: "s", className: "swb-session" }, [
            h("span", { key: "a" }, "微信会话：" + (cur || "未识别") + (mismatch ? "（≠ 目标）" : "")),
            h("span", { key: "b" }, "目标会话：" + (want || "未设置") + " · 角色：" + (st.roleLabel || st.role || "-")),
          ]),
          h("div", { key: "x", className: "swb-spacer" }),
          h("div", { key: "b", className: "swb-btns" }, [
            h(Btn, { key: "d", variant: "primary", onClick: () => start("draft") }, "draft 启动"),
            h(Btn, { key: "a", onClick: () => setConfirmAuto(true) }, "auto 启动"),
            h(Btn, { key: "s", variant: "danger", onClick: stop }, "停止"),
            h(Btn, { key: "p", onClick: preflight }, "环境体检"),
          ]),
        ]),

        confirmAuto ? h("div", { key: "cf", className: "swb-confirm" }, [
          h("span", { key: "t" }, "auto 模式会直接替你发微信。确认目标会话是「" + (want || "未设置") + "」？"),
          h(Btn, { key: "ok", small: true, variant: "primary", onClick: () => start("auto") }, "确认自动发送"),
          h(Btn, { key: "no", small: true, onClick: () => setConfirmAuto(false) }, "取消"),
        ]) : null,

        h("div", { key: "m", className: "swb-metrics" }, [
          h(Metric, { key: "p", label: "轮询", value: stats.polls || 0 }),
          h(Metric, { key: "c", label: "检测到变化", value: stats.changed || 0 }),
          h(Metric, { key: "r", label: "已回复", value: stats.replies || 0 }),
          h(Metric, { key: "d", label: "待批草稿", value: drafts.length }),
          h(Metric, { key: "e", label: "错误", value: stats.errors || 0 }),
        ]),

        mismatch ? h("div", { key: "mm", className: "swb-banner warn" }, "当前微信会话是「" + cur + "」，和目标「" + want + "」不一致 —— 启动会被拒绝。先在微信里切到目标会话。") : null,
        pf ? h("div", { key: "pf", className: "swb-banner " + ((pf.steps || []).length ? "warn" : "ok") }, [
          h("div", { key: "h" }, "微信：" + (pf.wechat && pf.wechat.running ? "运行中" : "未运行") + " · " + (pf.wechat && pf.wechat.loggedIn ? "已登录" : "未登录") + " · 当前会话 " + ((pf.wechat && pf.wechat.title) || "未识别")),
          (pf.steps || []).length === 0 ? h("div", { key: "ok" }, "一切就绪，可以启动") : (pf.steps || []).map((s, i) => h("div", { key: i }, "· " + s.title + " — " + s.action)),
        ]) : null,
        st.lastError ? h("div", { key: "err", className: "swb-banner err" }, "最近错误：" + st.lastError) : null,

        h("div", { key: "tabs", className: "swb-tabs", role: "tablist" }, TABS.map((t) => h("button", {
          key: t.key, type: "button", role: "tab", "aria-selected": tab === t.key,
          className: "swb-tab" + (tab === t.key ? " on" : ""), onClick: () => setTab(t.key),
        }, t.label + (t.key === "runtime" && drafts.length ? " (" + drafts.length + ")" : "")))),

        h("div", { key: "pane", role: "tabpanel" }, panes[tab]),

        errs.length ? h("div", { key: "errs", className: "swb-banner err" }, [
          h("b", { key: "t" }, "保存被拒绝："),
          ...errs.map((e, i) => h("div", { key: i }, "· " + e)),
        ]) : null,

        h("div", { key: "save", className: "swb-savebar" }, [
          h(Btn, { key: "s", variant: "primary", onClick: save, disabled: saving }, saving ? "保存中…" : "保存修改"),
          h(Btn, { key: "r", onClick: () => load(true), disabled: saving }, "放弃修改"),
          dirty ? h("span", { key: "d", className: "swb-dirty" }, "有未保存的修改") : null,
          msg ? h("span", { key: "m", className: "swb-banner " + (msg.kind === "err" ? "err" : msg.kind === "warn" ? "warn" : "ok"), style: { padding: "6px 11px" } }, msg.text) : null,
        ]),
      ].filter(Boolean));
    }

    function apply(ctx) {
      try {
        ctx.effect(() => {
          // 页面级幂等：即使模块被第二次装载，也先回收上一份注册。
          const prev = typeof window !== "undefined" ? window[GUARD_KEY] : null;
          if (typeof prev === "function") { try { prev(); } catch (e) { /* noop */ } }
          const dispose = ctx.slots.inject("settings.section", () => ctx.slots.register({
            name: "settings.section",
            id: SECTION_ID,
            order: 36,
            label: () => "微信代聊",
          }, Panel));
          if (typeof window !== "undefined") window[GUARD_KEY] = dispose;
          return () => {
            try { dispose && dispose(); } catch (e) { /* noop */ }
            if (typeof window !== "undefined" && window[GUARD_KEY] === dispose) window[GUARD_KEY] = null;
          };
        }, SECTION_ID + ": settings.section");
      } catch (err) {
        try { console.warn("[dsh-super-wechat-bot] client degraded: " + String((err && err.message) || err)); } catch (e) { /* noop */ }
      }
    }

    exports.apply = apply;
    exports.inject = ["slots"];
    exports.NS = NS;
    return module.exports;
  },
});
