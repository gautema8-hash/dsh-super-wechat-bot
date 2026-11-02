// dsh-super-wechat-bot / lib/client.js
// DSH 客户端半边：设置 → 微信代聊，完整参数面板。
// 直接读 bridge daemon 的本地面板 API（127.0.0.1，已开 CORS）。
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
    const CSS_TEXT = ".swb-wrap{display:flex;flex-direction:column;gap:12px;padding:4px 2px;max-width:820px}\\n.swb-row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}\\n.swb-field{display:flex;flex-direction:column;gap:5px;flex:1;min-width:150px}\\n.swb-field>span{font-size:12px;color:var(--dsw-alias-label-tertiary,rgba(128,128,128,.9))}\\n.swb-wrap input,.swb-wrap select,.swb-wrap textarea{border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.35));background:transparent;color:inherit;padding:6px 9px;font:inherit;width:100%;box-sizing:border-box}\\n.swb-wrap input,.swb-wrap select{height:32px}\\n.swb-wrap textarea{min-height:64px;font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.5}\\n.swb-btn{cursor:pointer;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.35));background:var(--dsw-specific-tip,transparent);color:inherit;border-radius:8px;height:32px;padding:0 12px;font-size:13px}\\n.swb-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.15))}\\n.swb-btn:disabled{opacity:.45;cursor:default}\\n.swb-btn.primary{background:var(--dsw-alias-brand-primary,#4c8dff);border-color:transparent;color:#fff}\\n.swb-btn.danger{color:var(--dsw-alias-state-error-primary,#e5484d);border-color:rgba(229,72,77,.45)}\\n.swb-btn.sm{height:26px;padding:0 8px;font-size:12px}\\n.swb-pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.35));opacity:.92}\\n.swb-pill.auto{color:var(--dsw-alias-state-success-primary,#30a46c)}\\n.swb-pill.draft{color:var(--dsw-alias-state-warning-primary,#f0b429)}\\n.swb-card{border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.25));border-radius:10px;padding:10px 12px}\\n.swb-sechead{display:flex;align-items:center;gap:8px;cursor:pointer;background:none;border:0;color:inherit;font:inherit;padding:0;width:100%;text-align:left}\\n.swb-secbody{display:flex;flex-direction:column;gap:10px;margin-top:10px}\\n.swb-draft{border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.25));border-radius:10px;padding:10px 12px;margin-top:8px}\\n.swb-dim{font-size:12px;opacity:.65;margin:3px 0}\\n.swb-tx{margin:6px 0 10px;font-size:14px;white-space:pre-wrap}\\n.swb-log{font-family:ui-monospace,Consolas,monospace;font-size:12px;opacity:.7;max-height:170px;overflow:auto;white-space:pre-wrap}\\n.swb-msg{font-size:12px;margin-left:8px}\\n.swb-err{color:var(--dsw-alias-state-error-primary,#e5484d)}\\n.swb-ok{color:var(--dsw-alias-state-success-primary,#30a46c)}\\n.swb-warn{color:var(--dsw-alias-state-warning-primary,#f0b429)}\\n.swb-canned{display:flex;gap:8px;align-items:center}\\n.swb-canned>input:first-child{flex:2}.swb-canned>input:nth-child(2){flex:3}";

    function useCss() {
      useEffect(() => {
        const id = "swb-client-css";
        const old = document.getElementById(id);
        if (old) old.remove();
        const el = document.createElement("style");
        el.id = id; el.textContent = CSS_TEXT;
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
        h("button", { key: "hd", type: "button", className: "swb-sechead", onClick: () => setOpen(!open) }, [
          h("strong", { key: "t" }, (open ? "▾ " : "▸ ") + props.title),
          props.sub ? h("span", { key: "s", className: "swb-dim" }, props.sub) : null,
        ]),
        open ? h("div", { key: "bd", className: "swb-secbody" }, props.children) : null,
      ]);
    }

    function F(props) {
      return h("label", { className: "swb-field" }, [
        h("span", { key: "l" }, props.label),
        h("input", {
          key: "i", type: props.type || "text", value: props.value,
          placeholder: props.placeholder || "", step: props.step,
          onChange: (e) => props.onChange(e.target.value),
        }),
      ]);
    }

    function Panel() {
      useCss();
      const [st, setSt] = useState(null);
      const [form, setForm] = useState(null);
      const [msg, setMsg] = useState(null);
      const [saving, setSaving] = useState(false);
      const [pf, setPf] = useState(null);
      const touched = useRef(false);

      const say = (text, kind) => { setMsg({ text, kind: kind || "ok" }); setTimeout(() => setMsg(null), 5000); };

      const load = useCallback(async (force) => {
        try {
          const s = await call("/api/state");
          setSt(s);
          if (force || !touched.current) { setForm(hydrate(s)); touched.current = false; }
        } catch (e) {
          setSt({ offline: true });
        }
      }, []);
      useEffect(() => { load(); const t = setInterval(() => load(), 2500); return () => clearInterval(t); }, [load]);

      const set = (k) => (v) => { touched.current = true; setForm((f) => Object.assign({}, f, { [k]: v })); };

      const save = async () => {
        if (!form) return;
        let canned;
        try {
          canned = (form.canned || []).map((row) => ({ re: row.re, reply: String(row.reply || "").length ? row.reply : null }));
        } catch (e) { say("预置短语格式不对", "err"); return; }
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
          canned: canned,
          customRoles: customRoles,
        };
        if (String(form.apiKey || "").trim()) body.apiKey = String(form.apiKey).trim();
        setSaving(true);
        try {
          const r = await call("/api/config", body);
          if (r.ok) {
            touched.current = false;
            say((r.warnings && r.warnings.length) ? "已保存（" + r.warnings.join("；") + "）" : "已保存", r.warnings && r.warnings.length ? "warn" : "ok");
            load(true);
          } else {
            say((r.errors || []).join("；") || "保存失败", "err");
          }
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
          h("div", { key: "a", className: "swb-dim" }, "连不上本地桥进程（127.0.0.1:47821）。插件没在运行，或 DSH 刚重启还没拉起它。"),
          h("div", { key: "b" }, h("button", { className: "swb-btn", onClick: () => load() }, "重试连接")),
        ]);
      }
      if (!form) return h("div", { className: "swb-wrap" }, h("div", { className: "swb-dim" }, "读取中…"));

      const drafts = (st.drafts || []).filter((d) => d.status === "pending");
      const mode = st.mode || "off";
      const want = String(form.contact || "").trim();
      const cur = st.title || "";
      const mismatch = want && cur && want !== cur;
      const msgCls = msg ? ("swb-msg " + (msg.kind === "err" ? "swb-err" : msg.kind === "warn" ? "swb-warn" : "swb-ok")) : "";

      return h("div", { className: "swb-wrap" }, [
        h("div", { key: "status", className: "swb-row" }, [
          h("span", { key: "m", className: "swb-pill " + mode }, mode),
          h("span", { key: "t", className: "swb-pill" }, "微信会话 " + (cur || "(未识别)")),
          mismatch ? h("span", { key: "x", className: "swb-pill swb-warn" }, "≠ 目标 " + want) : null,
          h("span", { key: "r", className: "swb-pill" }, "角色 " + (st.roleLabel || st.role)),
          h("span", { key: "s", className: "swb-pill" }, "轮询 " + (st.stats && st.stats.polls || 0) + " · 已发 " + (st.stats && st.stats.replies || 0) + " · 草稿 " + drafts.length),
        ]),
        h("div", { key: "acts", className: "swb-row" }, [
          h("button", { key: "d", className: "swb-btn primary", onClick: () => start("draft") }, "draft 启动"),
          h("button", { key: "a", className: "swb-btn", onClick: () => start("auto") }, "auto 启动"),
          h("button", { key: "s", className: "swb-btn danger", onClick: stop }, "停止"),
          h("button", { key: "p", className: "swb-btn", onClick: preflight }, "环境体检"),
          h("button", { key: "v", className: "swb-btn", onClick: save, disabled: saving }, saving ? "保存中…" : "保存修改"),
          msg ? h("span", { key: "msg", className: msgCls }, msg.text) : null,
        ]),
        pf ? h("div", { key: "pf", className: "swb-card" }, [
          h("div", { key: "h", className: "swb-dim" }, "微信：" + (pf.wechat && pf.wechat.running ? "已运行" : "未运行") + (pf.wechat && pf.wechat.loggedIn ? " · 已登录" : " · 未登录") + " · 当前会话 " + (pf.wechat && pf.wechat.title || "(未识别)")) ,
          (pf.steps || []).length === 0
            ? h("div", { key: "ok", className: "swb-ok" }, "一切就绪")
            : (pf.steps || []).map((s, i) => h("div", { key: i, className: "swb-dim" }, "· " + s.title + " — " + s.action)),
        ]) : null,

        h(Section, { key: "s1", title: "会话与角色", initial: true }, [
          h("div", { key: "r1", className: "swb-row" }, [
            h(F, { key: "c", label: "会话标题（和微信里完全一致）", value: form.contact, onChange: set("contact"), placeholder: "例如 aaa" }),
            h("label", { key: "ro", className: "swb-field" }, [
              h("span", { key: "l" }, "角色预设"),
              h("select", { key: "i", value: form.role, onChange: (e) => set("role")(e.target.value) },
                (st.roles || []).map((r) => h("option", { key: r.key, value: r.key }, r.label))),
            ]),
          ]),
          h("div", { key: "r2", className: "swb-row" }, [
            h(F, { key: "p", label: "微信进程名", value: form.processName, onChange: set("processName") }),
            h("label", { key: "au", className: "swb-field" }, [
              h("span", { key: "l" }, "DSH 启动时自动拉起机器人"),
              h("select", { key: "i", value: form.autoStart ? "1" : "0", onChange: (e) => set("autoStart")(e.target.value === "1") },
                [h("option", { key: "0", value: "0" }, "否"), h("option", { key: "1", value: "1" }, "是")]),
            ]),
          ]),
        ]),

        h(Section, { key: "s2", title: "节奏与拟人", sub: "越小越快，也越容易被看出来" }, [
          h("div", { key: "r0", className: "swb-row" }, [
            h(F, { key: "pm", label: "轮询间隔 ms", type: "number", value: form.pollMs, onChange: set("pollMs") }),
            h(F, { key: "cm", label: "连发合并窗口 ms", type: "number", value: form.coalesceMs, onChange: set("coalesceMs") }),
            h("label", { key: "fm", className: "swb-field" }, [
              h("span", { key: "l" }, "快档（被催时更密）"),
              h("select", { key: "i", value: form.fastMode ? "1" : "0", onChange: (e) => set("fastMode")(e.target.value === "1") },
                [h("option", { key: "0", value: "0" }, "关"), h("option", { key: "1", value: "1" }, "开")]),
            ]),
          ]),
          h("div", { key: "r1", className: "swb-row" }, [
            h(F, { key: "dm", label: "延迟中位数 ms", type: "number", value: form.delayMedian, onChange: set("delayMedian") }),
            h(F, { key: "dmn", label: "延迟下限 ms", type: "number", value: form.delayMin, onChange: set("delayMin") }),
            h(F, { key: "dmx", label: "延迟上限 ms", type: "number", value: form.delayMax, onChange: set("delayMax") }),
            h(F, { key: "du", label: "被催时中位 ms", type: "number", value: form.delayUrgentMedian, onChange: set("delayUrgentMedian") }),
          ]),
        ]),

        h(Section, { key: "s3", title: "限额与安全" }, [
          h("div", { key: "r1", className: "swb-row" }, [
            h(F, { key: "lm", label: "每分钟最多发（0=全停）", type: "number", value: form.maxRepliesPerMinute, onChange: set("maxRepliesPerMinute") }),
            h(F, { key: "mc", label: "单条字数上限", type: "number", value: form.maxReplyChars, onChange: set("maxReplyChars") }),
            h(F, { key: "se", label: "连续升级几次停手", type: "number", value: form.stopAfterEscalations, onChange: set("stopAfterEscalations") }),
            h(F, { key: "sk", label: "收尾语不回复概率 0~1", type: "number", step: "0.05", value: form.skipAckProbability, onChange: set("skipAckProbability") }),
          ]),
        ]),

        h(Section, { key: "s4", title: "话术" }, [
          h("div", { key: "r1", className: "swb-row" }, [
            h(F, { key: "es", label: "身份被质疑时回", value: form.escalateLine, onChange: set("escalateLine") }),
            h(F, { key: "df", label: "拿不准时回", value: form.deferLine, onChange: set("deferLine") }),
            h(F, { key: "bs", label: "忙时回", value: form.busyLine, onChange: set("busyLine") }),
          ]),
        ]),

        h(Section, { key: "s5", title: "识别规则（正则）" }, [
          h("div", { key: "r1", className: "swb-row" }, [
            h(F, { key: "u", label: "被催", value: form.urgentRe, onChange: set("urgentRe") }),
            h(F, { key: "a", label: "纯收尾语", value: form.ackOnly, onChange: set("ackOnly") }),
            h(F, { key: "rd", label: "角色禁区（转人工）", value: form.roleDefer, onChange: set("roleDefer") }),
          ]),
          h("div", { key: "r2", className: "swb-row" }, [
            h(F, { key: "t0", label: "T0 身份质疑", value: form.t0, onChange: set("t0") }),
            h(F, { key: "t1", label: "T1 不对劲", value: form.t1, onChange: set("t1") }),
          ]),
          h("div", { key: "r3", className: "swb-row" }, [
            h(F, { key: "t2", label: "T2 钱/承诺/见面", value: form.t2, onChange: set("t2") }),
          ]),
        ]),

        h(Section, { key: "s6", title: "预置短语", sub: (form.canned || []).length + " 条" }, [
          (form.canned || []).map((row, i) => h("div", { key: "c" + i, className: "swb-canned" }, [
            h("input", { key: "re", value: row.re, placeholder: "正则，如在吗|在么", onChange: (e) => { const v = e.target.value; setForm((f) => { const arr = f.canned.slice(); arr[i] = Object.assign({}, arr[i], { re: v }); return Object.assign({}, f, { canned: arr }); }); } }),
            h("input", { key: "rp", value: row.reply, placeholder: "回复，留空=不回", onChange: (e) => { const v = e.target.value; setForm((f) => { const arr = f.canned.slice(); arr[i] = Object.assign({}, arr[i], { reply: v }); return Object.assign({}, f, { canned: arr }); }); } }),
            h("button", { key: "del", className: "swb-btn sm danger", type: "button", onClick: () => setForm((f) => Object.assign({}, f, { canned: f.canned.filter((_, j) => j !== i) })) }, "删"),
          ])),
          h("div", { key: "add" }, h("button", { className: "swb-btn sm", type: "button", onClick: () => setForm((f) => Object.assign({}, f, { canned: (f.canned || []).concat([{ re: "", reply: "" }]) })) }, "+ 加一条")),
        ]),

        h(Section, { key: "s7", title: "模型与密钥" }, [
          h("div", { key: "r1", className: "swb-row" }, [
            h(F, { key: "mo", label: "模型", value: form.model, onChange: set("model") }),
            h(F, { key: "bu", label: "Base URL", value: form.baseUrl, onChange: set("baseUrl") }),
            h(F, { key: "ak", label: "API Key（留空=不修改）", type: "password", value: form.apiKey, onChange: set("apiKey"), placeholder: "已配置时保持空白" }),
          ]),
        ]),

        h(Section, { key: "s8", title: "自定义角色", sub: "JSON 数组，高级" }, [
          h("textarea", { key: "rt", value: form.rolesText, onChange: (e) => set("rolesText")(e.target.value) }),
        ]),

        h("div", { key: "drafts", className: "swb-card" }, [
          h("div", { key: "t", className: "swb-row" }, [h("strong", { key: "b" }, "待处理草稿"), h("span", { key: "c", className: "swb-pill" }, String(drafts.length))]),
          drafts.length === 0
            ? h("div", { key: "e", className: "swb-dim", style: { marginTop: 8 } }, "暂无")
            : drafts.map((d) => h("div", { key: d.id, className: "swb-draft" }, [
                h("div", { key: "h", className: "swb-dim" }, [d.kind || "", d.level || "", d.source || ""].filter(Boolean).join(" · ")),
                h("div", { key: "c", className: "swb-dim" }, "对方：" + (d.context || []).join(" / ")),
                h("div", { key: "x", className: "swb-tx" }, d.text || "（不回）"),
                h("div", { key: "b" }, [
                  h("button", { key: "a", className: "swb-btn primary", onClick: () => act(d.id, "approve"), disabled: !d.text }, "发送这条"),
                  " ",
                  h("button", { key: "r", className: "swb-btn", onClick: () => act(d.id, "reject") }, "丢弃"),
                ]),
              ])),
        ]),

        h("div", { key: "log", className: "swb-card" }, [
          h("strong", { key: "t" }, "最近事件"),
          h("div", { key: "l", className: "swb-log" },
            (st.events || []).slice(-12).map((e, i) => h("div", { key: i },
              new Date(e.ts || Date.now()).toLocaleTimeString() + "  " + (e.event || e.level) + "  " + (e.msg || e.text || e.reason || "")))),
        ]),
        st.lastError ? h("div", { key: "err", className: "swb-msg swb-err" }, "最近错误：" + st.lastError) : null,
      ].filter(Boolean));
    }

    function apply(ctx) {
      try {
        ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
          name: "settings.section",
          id: "dsh-super-wechat-bot",
          order: 36,
          label: () => "微信代聊",
        }, Panel)), "dsh-super-wechat-bot: settings.section");
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
