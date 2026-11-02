// dsh-super-wechat-bot / lib/client.js
// DSH 客户端半边：设置 → 微信代聊。完整参数面板，唯一一个设置条目。
window.__ModuleLoader__.load({
  id: "dsh-super-wechat-bot",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    const React = require("react");
    const h = React.createElement;
    const { useState, useEffect, useRef, useCallback } = React;

    const API = "http://127.0.0.1:47821";
    const NS = "dsh-super-wechat-bot";
    const CSS_TEXT = ".swb-wrap{display:flex;flex-direction:column;gap:14px;padding:2px 2px 8px;max-width:880px;font-size:13px}\n.swb-hero{border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.25));border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:12px;background:var(--dsw-alias-bg-elevated,transparent)}\n.swb-heroTop{display:flex;align-items:center;gap:10px;flex-wrap:wrap}\n.swb-mode{display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:13px;padding:3px 11px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.35))}\n.swb-mode.auto{color:var(--dsw-alias-state-success-primary,#30a46c);border-color:rgba(48,164,108,.45)}\n.swb-mode.draft{color:var(--dsw-alias-state-warning-primary,#f0b429);border-color:rgba(240,180,41,.45)}\n.swb-mode.off{opacity:.65}\n.swb-dot{width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block}\n.swb-ghost{font-size:12px;opacity:.6}\n.swb-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px}\n.swb-metric{border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.2));border-radius:10px;padding:7px 10px;display:flex;flex-direction:column;gap:2px}\n.swb-metric b{font-size:15px;font-weight:600;line-height:1.2}\n.swb-metric span{font-size:11px;opacity:.6}\n.swb-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}\n.swb-btn{cursor:pointer;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.35));background:var(--dsw-specific-tip,transparent);color:inherit;border-radius:9px;height:32px;padding:0 13px;font-size:13px;transition:background .12s}\n.swb-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14))}\n.swb-btn:disabled{opacity:.42;cursor:default}\n.swb-btn.primary{background:var(--dsw-alias-brand-primary,#4c8dff);border-color:transparent;color:#fff}\n.swb-btn.primary:hover{filter:brightness(1.06)}\n.swb-btn.danger{color:var(--dsw-alias-state-error-primary,#e5484d);border-color:rgba(229,72,77,.4)}\n.swb-btn.sm{height:27px;padding:0 9px;font-size:12px;border-radius:8px}\n.swb-card{border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.22));border-radius:12px;padding:0;overflow:hidden}\n.swb-head{display:flex;align-items:center;gap:9px;width:100%;box-sizing:border-box;background:none;border:0;color:inherit;font:inherit;padding:11px 14px;cursor:pointer;text-align:left}\n.swb-head:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.08))}\n.swb-head i{font-style:normal;font-size:11px;opacity:.55;width:10px}\n.swb-head b{font-size:13px;font-weight:600}\n.swb-head u{text-decoration:none;font-size:11px;opacity:.55;margin-left:auto;font-weight:400}\n.swb-body{padding:0 14px 14px;display:flex;flex-direction:column;gap:12px}\n.swb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}\n.swb-field{display:flex;flex-direction:column;gap:5px;min-width:0}\n.swb-field>span{font-size:11px;letter-spacing:.02em;color:var(--dsw-alias-label-tertiary,rgba(128,128,128,.95))}\n.swb-wrap input,.swb-wrap select,.swb-wrap textarea{border-radius:9px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.32));background:transparent;color:inherit;padding:6px 9px;font:inherit;width:100%;box-sizing:border-box;transition:border-color .12s,box-shadow .12s}\n.swb-wrap input:focus,.swb-wrap select:focus,.swb-wrap textarea:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#4c8dff);box-shadow:0 0 0 3px rgba(76,141,255,.16)}\n.swb-wrap input,.swb-wrap select{height:32px}\n.swb-wrap textarea{min-height:78px;font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.55;resize:vertical}\n.swb-wrap input[type=number]{font-variant-numeric:tabular-nums}\n.swb-hint{font-size:11px;opacity:.55;margin-top:-2px}\n.swb-banner{border-radius:10px;padding:9px 12px;font-size:12px;line-height:1.6;border:1px solid}\n.swb-banner.warn{color:var(--dsw-alias-state-warning-primary,#f0b429);border-color:rgba(240,180,41,.35);background:rgba(240,180,41,.06)}\n.swb-banner.err{color:var(--dsw-alias-state-error-primary,#e5484d);border-color:rgba(229,72,77,.35);background:rgba(229,72,77,.06)}\n.swb-banner.ok{color:var(--dsw-alias-state-success-primary,#30a46c);border-color:rgba(48,164,108,.35);background:rgba(48,164,108,.06)}\n.swb-canned{display:grid;grid-template-columns:1fr 1.2fr auto;gap:8px;align-items:center}\n.swb-draft{border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.22));border-radius:10px;padding:10px 12px;margin-top:8px}\n.swb-tx{margin:6px 0 10px;font-size:14px;white-space:pre-wrap}\n.swb-dim{font-size:12px;opacity:.62;margin:2px 0}\n.swb-log{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;opacity:.68;max-height:160px;overflow:auto;white-space:pre-wrap;line-height:1.7}\n.swb-savebar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}\n.swb-dirty{font-size:12px;color:var(--dsw-alias-state-warning-primary,#f0b429)}";
    const SECTION_ID = "dsh-super-wechat-bot";

    // 幂等：同一个页面里无论 apply 被调用几次，只保留一个设置条目。
    let sectionDisposer = null;

    function useCss() {
      useEffect(() => {
        const old = document.getElementById("swb-client-css");
        if (old) old.remove();
        const el = document.createElement("style");
        el.id = "swb-client-css";
        el.textContent = CSS_TEXT;
        document.head.appendChild(el);
      }, []);
    }

    async function call(path, body) {
      const res = await fetch(API + path, body === undefined ? { cache: "no-store" } : {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      return res.json();
    }

    const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);

    function hydrate(s) {
      const c = s.config || {};
      const d = c.delay || {};
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
        t0: (c.identity || {}).t0 || "",
        t1: (c.identity || {}).t1 || "",
        t2: (c.identity || {}).t2 || "",
        model: c.model || "deepseek-flash",
        baseUrl: c.baseUrl || "https://api.deepseek.com",
        apiKey: "",
        canned: Array.isArray(c.canned) ? c.canned.map((x) => ({ re: x.re, reply: x.reply === null ? "" : x.reply })) : [],
        rolesText: JSON.stringify(c.customRoles || [], null, 1),
      };
    }

    function Section(props) {
      const [open, setOpen] = useState(!!props.initial);
      return h("div", { className: "swb-card" }, [
        h("button", { key: "hd", type: "button", className: "swb-head", onClick: () => setOpen(!open) }, [
          h("i", { key: "c" }, open ? "▾" : "▸"),
          h("b", { key: "t" }, props.title),
          props.meta ? h("u", { key: "m" }, props.meta) : null,
        ]),
        open ? h("div", { key: "bd", className: "swb-body" }, props.children) : null,
      ]);
    }

    function Field(props) {
      const input = props.options
        ? h("select", { value: props.value, onChange: (e) => props.onChange(e.target.value) },
            props.options.map((o) => h("option", { key: String(o.value), value: o.value }, o.label)))
        : h("input", {
            type: props.type || "text", value: props.value, placeholder: props.placeholder || "",
            step: props.step, onChange: (e) => props.onChange(e.target.value),
          });
      return h("label", { className: "swb-field" }, [
        h("span", { key: "l" }, props.label),
        h("span", { key: "i" }, input),
        props.hint ? h("span", { key: "h", className: "swb-hint" }, props.hint) : null,
      ]);
    }

    function Metric(props) {
      return h("div", { className: "swb-metric" }, [
        h("b", { key: "v" }, String(props.value)),
        h("span", { key: "l" }, props.label),
      ]);
    }

    function Panel() {
      useCss();
      const [st, setSt] = useState(null);
      const [form, setForm] = useState(null);
      const [msg, setMsg] = useState(null);
      const [saving, setSaving] = useState(false);
      const [pf, setPf] = useState(null);
      const [dirty, setDirty] = useState(false);
      const touched = useRef(false);

      const say = (text, kind) => { setMsg({ text, kind: kind || "ok" }); setTimeout(() => setMsg(null), 5000); };

      const load = useCallback(async (force) => {
        try {
          const s = await call("/api/state");
          setSt(s);
          if (force || !touched.current) {
            setForm(hydrate(s));
            touched.current = false;
            setDirty(false);
          }
        } catch (e) {
          setSt({ offline: true });
        }
      }, []);
      useEffect(() => { load(); const t = setInterval(() => load(), 2500); return () => clearInterval(t); }, [load]);

      const set = (k) => (v) => {
        touched.current = true;
        setDirty(true);
        setForm((f) => Object.assign({}, f, { [k]: v }));
      };

      const save = async () => {
        if (!form) return;
        let customRoles;
        try { customRoles = JSON.parse(form.rolesText || "[]"); } catch (e) { say("自定义角色 JSON 解析失败：" + e.message, "err"); return; }
        const body = {
          contact: String(form.contact || "").trim(),
          role: form.role,
          processName: form.processName,
          autoStart: !!form.autoStart,
          fastMode: !!form.fastMode,
          pollMs: Number(form.pollMs),
          coalesceMs: Number(form.coalesceMs),
          maxRepliesPerMinute: Number(form.maxRepliesPerMinute),
          maxReplyChars: Number(form.maxReplyChars),
          stopAfterEscalations: Number(form.stopAfterEscalations),
          skipAckProbability: Number(form.skipAckProbability),
          escalateLine: form.escalateLine,
          deferLine: form.deferLine,
          busyLine: form.busyLine,
          urgentRe: form.urgentRe,
          ackOnly: form.ackOnly,
          roleDefer: form.roleDefer,
          identity: { t0: form.t0, t1: form.t1, t2: form.t2 },
          delay: {
            medianMs: Number(form.delayMedian),
            minMs: Number(form.delayMin),
            maxMs: Number(form.delayMax),
            urgentMedianMs: Number(form.delayUrgentMedian),
          },
          model: form.model,
          baseUrl: form.baseUrl,
          canned: (form.canned || []).map((row) => ({ re: row.re, reply: String(row.reply || "").length ? row.reply : null })),
          customRoles: customRoles,
        };
        if (String(form.apiKey || "").trim()) body.apiKey = String(form.apiKey).trim();
        setSaving(true);
        try {
          const r = await call("/api/config", body);
          if (r.ok) {
            touched.current = false;
            setDirty(false);
            const w = r.warnings || [];
            say(w.length ? "已保存（" + w.join("；") + "）" : "已保存", w.length ? "warn" : "ok");
            load(true);
          } else say((r.errors || []).join("；") || "保存失败", "err");
        } catch (e) { say("保存失败：" + e.message, "err"); }
        setSaving(false);
      };

      const start = async (mode) => {
        const r = await call("/api/start", { mode });
        say(r.ok ? "已启动（" + mode + "）" : (r.error || "启动失败"), r.ok ? "ok" : "err");
        load();
      };
      const stop = async () => { const r = await call("/api/stop", {}); say(r.ok ? "已停止" : "停止失败", r.ok ? "ok" : "err"); load(); };
      const preflight = async () => { try { setPf(await call("/api/preflight")); } catch (e) { say("体检失败：" + e.message, "err"); } };
      const act = async (id, action) => {
        const r = await call("/api/draft", { id: id, action: action });
        say(r.ok ? (action === "approve" ? "已发送" : "已丢弃") : (r.error || "失败"), r.ok ? "ok" : "err");
        load();
      };

      if (!st) return h("div", { className: "swb-wrap" }, h("div", { className: "swb-dim" }, "读取中…"));
      if (st.offline) {
        return h("div", { className: "swb-wrap" }, [
          h("div", { key: "a", className: "swb-banner warn" }, "连不上本地桥进程（127.0.0.1:47821）。插件可能没在运行，或 DSH 刚重启还没把它拉起来。"),
          h("div", { key: "b" }, h("button", { className: "swb-btn" }, "重试连接")),
        ]);
      }
      if (!form) return h("div", { className: "swb-wrap" }, h("div", { className: "swb-dim" }, "读取中…"));

      const drafts = (st.drafts || []).filter((d) => d.status === "pending");
      const mode = st.mode || "off";
      const modeText = mode === "auto" ? "自动发送" : mode === "draft" ? "草稿模式" : "已停止";
      const want = String(form.contact || "").trim();
      const cur = st.title || "";
      const mismatch = want && cur && want !== cur;
      const stats = st.stats || {};
      const msgKind = msg ? msg.kind : "ok";

      return h("div", { className: "swb-wrap" }, [
        h("div", { key: "hero", className: "swb-hero" }, [
          h("div", { key: "top", className: "swb-heroTop" }, [
            h("span", { key: "m", className: "swb-mode " + mode }, [h("span", { key: "d", className: "swb-dot" }), modeText]),
            h("span", { key: "c", className: "swb-ghost" }, "微信会话：" + (cur || "未识别") + " · 目标：" + (want || "未设置")),
            h("span", { key: "r", className: "swb-ghost" }, "角色：" + (st.roleLabel || st.role || "-")),
            dirty ? h("span", { key: "dy", className: "swb-dirty" }, "有未保存修改") : null,
          ]),
          mismatch ? h("div", { key: "mm", className: "swb-banner warn" }, "当前微信会话是「" + cur + "」，和目标「" + want + "」不一致。启动会被拒绝，先在微信里切过去。") : null,
          h("div", { key: "metrics", className: "swb-metrics" }, [
            h(Metric, { key: "p", label: "轮询", value: stats.polls || 0 }),
            h(Metric, { key: "c", label: "检测到变化", value: stats.changed || 0 }),
            h(Metric, { key: "r", label: "已回复", value: stats.replies || 0 }),
            h(Metric, { key: "d", label: "待批草稿", value: drafts.length }),
            h(Metric, { key: "e", label: "错误", value: stats.errors || 0 }),
          ]),
          h("div", { key: "acts", className: "swb-acts" }, [
            h("button", { key: "d", className: "swb-btn primary", onClick: () => start("draft") }, "draft 启动"),
            h("button", { key: "a", className: "swb-btn", onClick: () => start("auto") }, "auto 启动"),
            h("button", { key: "s", className: "swb-btn danger", onClick: stop }, "停止"),
            h("button", { key: "p", className: "swb-btn", onClick: preflight }, "环境体检"),
            msg ? h("span", { key: "msg", className: "swb-banner " + (msgKind === "err" ? "err" : msgKind === "warn" ? "warn" : "ok"), style: { padding: "5px 10px" } }, msg.text) : null,
          ]),
          pf ? h("div", { key: "pf", className: "swb-banner " + ((pf.steps || []).length ? "warn" : "ok") }, [
            h("div", { key: "h" }, "微信：" + (pf.wechat && pf.wechat.running ? "运行中" : "未运行") + " · " + (pf.wechat && pf.wechat.loggedIn ? "已登录" : "未登录") + " · 当前会话 " + ((pf.wechat && pf.wechat.title) || "未识别")),
            (pf.steps || []).length === 0
              ? h("div", { key: "ok" }, "一切就绪")
              : (pf.steps || []).map((s, i) => h("div", { key: i }, "· " + s.title + " — " + s.action)),
          ]) : null,
        ]),

        h(Section, { key: "s1", title: "会话与角色", initial: true, meta: want || "未设置" }, [
          h("div", { key: "g1", className: "swb-grid" }, [
            h(Field, { key: "c", label: "目标会话（与微信标题完全一致）", value: form.contact, onChange: set("contact"), placeholder: "例如 张三" }),
            h(Field, { key: "r", label: "角色预设", value: form.role, onChange: set("role"), options: (st.roles || []).map((r) => ({ value: r.key, label: r.label })) }),
            h(Field, { key: "p", label: "微信进程名", value: form.processName, onChange: set("processName"), hint: "默认 Weixin" }),
            h(Field, {
              key: "a", label: "DSH 启动时自动拉起", value: form.autoStart ? "1" : "0",
              onChange: (v) => set("autoStart")(v === "1"),
              options: [{ value: "0", label: "否" }, { value: "1", label: "是" }],
            }),
          ]),
        ]),

        h(Section, { key: "s2", title: "节奏与拟人", meta: form.delayMedian + "ms 中位" }, [
          h("div", { key: "g1", className: "swb-grid" }, [
            h(Field, { key: "pm", label: "轮询间隔 (ms)", type: "number", value: form.pollMs, onChange: set("pollMs") }),
            h(Field, { key: "cm", label: "连发合并窗口 (ms)", type: "number", value: form.coalesceMs, onChange: set("coalesceMs") }),
            h(Field, {
              key: "fm", label: "快档（被催时更密）", value: form.fastMode ? "1" : "0",
              onChange: (v) => set("fastMode")(v === "1"),
              options: [{ value: "0", label: "关" }, { value: "1", label: "开" }],
            }),
          ]),
          h("div", { key: "g2", className: "swb-grid" }, [
            h(Field, { key: "dm", label: "延迟中位数 (ms)", type: "number", value: form.delayMedian, onChange: set("delayMedian") }),
            h(Field, { key: "dmn", label: "延迟下限 (ms)", type: "number", value: form.delayMin, onChange: set("delayMin") }),
            h(Field, { key: "dmx", label: "延迟上限 (ms)", type: "number", value: form.delayMax, onChange: set("delayMax") }),
            h(Field, { key: "du", label: "被催时中位 (ms)", type: "number", value: form.delayUrgentMedian, onChange: set("delayUrgentMedian") }),
          ]),
        ]),

        h(Section, { key: "s3", title: "限额与安全", meta: form.maxRepliesPerMinute + " 条/分" }, [
          h("div", { key: "g", className: "swb-grid" }, [
            h(Field, { key: "lm", label: "每分钟最多发（0=全停）", type: "number", value: form.maxRepliesPerMinute, onChange: set("maxRepliesPerMinute") }),
            h(Field, { key: "mc", label: "单条字数上限", type: "number", value: form.maxReplyChars, onChange: set("maxReplyChars") }),
            h(Field, { key: "se", label: "连续升级几次停手", type: "number", value: form.stopAfterEscalations, onChange: set("stopAfterEscalations") }),
            h(Field, { key: "sk", label: "收尾语不回复概率 (0~1)", type: "number", step: "0.05", value: form.skipAckProbability, onChange: set("skipAckProbability") }),
          ]),
        ]),

        h(Section, { key: "s4", title: "话术" }, [
          h("div", { key: "g", className: "swb-grid" }, [
            h(Field, { key: "es", label: "身份被质疑时回", value: form.escalateLine, onChange: set("escalateLine") }),
            h(Field, { key: "df", label: "拿不准时回", value: form.deferLine, onChange: set("deferLine") }),
            h(Field, { key: "bs", label: "忙时回", value: form.busyLine, onChange: set("busyLine") }),
          ]),
        ]),

        h(Section, { key: "s5", title: "识别规则（正则）", meta: "T0-T2" }, [
          h("div", { key: "g1", className: "swb-grid" }, [
            h(Field, { key: "u", label: "被催", value: form.urgentRe, onChange: set("urgentRe") }),
            h(Field, { key: "a", label: "纯收尾语", value: form.ackOnly, onChange: set("ackOnly") }),
            h(Field, { key: "rd", label: "角色禁区（转人工）", value: form.roleDefer, onChange: set("roleDefer") }),
          ]),
          h("div", { key: "g2", className: "swb-grid" }, [
            h(Field, { key: "t0", label: "T0 身份质疑", value: form.t0, onChange: set("t0") }),
            h(Field, { key: "t1", label: "T1 不对劲", value: form.t1, onChange: set("t1") }),
            h(Field, { key: "t2", label: "T2 钱/承诺/见面", value: form.t2, onChange: set("t2") }),
          ]),
        ]),

        h(Section, { key: "s6", title: "预置短语", meta: (form.canned || []).length + " 条" }, [
          (form.canned || []).map((row, i) => h("div", { key: "c" + i, className: "swb-canned" }, [
            h("input", { key: "re", value: row.re, placeholder: "正则，如在吗|在么", onChange: (e) => { const v = e.target.value; setForm((f) => { const a = f.canned.slice(); a[i] = Object.assign({}, a[i], { re: v }); return Object.assign({}, f, { canned: a }); }); setDirty(true); } }),
            h("input", { key: "rp", value: row.reply, placeholder: "回复；留空=不回", onChange: (e) => { const v = e.target.value; setForm((f) => { const a = f.canned.slice(); a[i] = Object.assign({}, a[i], { reply: v }); return Object.assign({}, f, { canned: a }); }); setDirty(true); } }),
            h("button", { key: "del", className: "swb-btn sm danger", type: "button", onClick: () => { setForm((f) => Object.assign({}, f, { canned: f.canned.filter((_, j) => j !== i) })); setDirty(true); } }, "删除"),
          ])),
          h("div", { key: "add" }, h("button", { className: "swb-btn sm", type: "button", onClick: () => { setForm((f) => Object.assign({}, f, { canned: (f.canned || []).concat([{ re: "", reply: "" }]) })); setDirty(true); } }, "+ 加一条")),
        ]),

        h(Section, { key: "s7", title: "模型与密钥", meta: form.model }, [
          h("div", { key: "g", className: "swb-grid" }, [
            h(Field, { key: "mo", label: "模型", value: form.model, onChange: set("model") }),
            h(Field, { key: "bu", label: "Base URL", value: form.baseUrl, onChange: set("baseUrl") }),
            h(Field, { key: "ak", label: "API Key（留空=不修改）", type: "password", value: form.apiKey, onChange: set("apiKey"), placeholder: "已配置时保持空白" }),
          ]),
        ]),

        h(Section, { key: "s8", title: "自定义角色", meta: "JSON" }, [
          h("div", { key: "h", className: "swb-hint" }, "数组，每项 { key, label, persona, defer?, deferLine?, maxChars?, canned?[] }"),
          h("textarea", { key: "rt", value: form.rolesText, onChange: (e) => set("rolesText")(e.target.value) }),
        ]),

        h("div", { key: "save", className: "swb-savebar" }, [
          h("button", { key: "s", className: "swb-btn primary", onClick: save, disabled: saving }, saving ? "保存中…" : "保存修改"),
          h("button", { key: "r", className: "swb-btn", onClick: () => load(true) }, "放弃修改"),
          msg ? h("span", { key: "m", className: "swb-banner " + (msgKind === "err" ? "err" : msgKind === "warn" ? "warn" : "ok"), style: { padding: "5px 10px" } }, msg.text) : null,
        ]),

        h("div", { key: "drafts", className: "swb-card" }, [
          h("div", { key: "t", className: "swb-head", style: { cursor: "default" } }, [h("b", { key: "b" }, "待处理草稿"), h("u", { key: "c" }, drafts.length + " 条")]),
          h("div", { key: "b", className: "swb-body" }, drafts.length === 0
            ? h("div", { key: "e", className: "swb-dim" }, "暂无")
            : drafts.map((d) => h("div", { key: d.id, className: "swb-draft" }, [
                h("div", { key: "h", className: "swb-dim" }, [d.kind || "", d.level || "", d.source || ""].filter(Boolean).join(" · ")),
                h("div", { key: "c", className: "swb-dim" }, "对方：" + (d.context || []).join(" / ")),
                h("div", { key: "x", className: "swb-tx" }, d.text || "（不回）"),
                h("div", { key: "b" }, [
                  h("button", { key: "a", className: "swb-btn primary sm", onClick: () => act(d.id, "approve"), disabled: !d.text }, "发送"),
                  " ",
                  h("button", { key: "r", className: "swb-btn sm", onClick: () => act(d.id, "reject") }, "丢弃"),
                ]),
              ]))),
        ]),

        h("div", { key: "log", className: "swb-card" }, [
          h("div", { key: "t", className: "swb-head", style: { cursor: "default" } }, [h("b", { key: "b" }, "最近事件")]),
          h("div", { key: "b", className: "swb-body" }, h("div", { className: "swb-log" },
            (st.events || []).slice(-12).map((e, i) => h("div", { key: i },
              new Date(e.ts || Date.now()).toLocaleTimeString() + "  " + (e.event || e.level) + "  " + (e.msg || e.text || e.reason || ""))))),
        ]),

        st.lastError ? h("div", { key: "err", className: "swb-banner err" }, "最近错误：" + st.lastError) : null,
      ].filter(Boolean));
    }

    function apply(ctx) {
      try {
        ctx.effect(() => {
          // 重新挂载前先回收上一份，保证页面上永远只有一个「微信代聊」。
          if (sectionDisposer) { try { sectionDisposer(); } catch (e) { /* noop */ } sectionDisposer = null; }
          const dispose = ctx.slots.inject("settings.section", () => ctx.slots.register({
            name: "settings.section",
            id: SECTION_ID,
            order: 36,
            label: () => "微信代聊",
          }, Panel));
          sectionDisposer = dispose;
          return () => {
            try { dispose && dispose(); } catch (e) { /* noop */ }
            if (sectionDisposer === dispose) sectionDisposer = null;
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
