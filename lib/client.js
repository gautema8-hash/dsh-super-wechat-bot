// super-wechat-bot / lib/client.js
// DSH 客户端半边：在「设置」里挂一个微信代聊页签。
// 直接读 bridge daemon 的本地面板 API（127.0.0.1，已开 CORS）。
window.__ModuleLoader__.load({
  id: "super-wechat-bot",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    const React = require("react");
    const h = React.createElement;
    const { useState, useEffect, useRef, useCallback } = React;

    const API = "http://127.0.0.1:47821";
    const NS = "super-wechat-bot";

    const css = `
.swb-wrap{display:flex;flex-direction:column;gap:14px;padding:4px 2px;max-width:720px}
.swb-row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
.swb-field{display:flex;flex-direction:column;gap:5px;flex:1;min-width:150px}
.swb-field > span{font-size:12px;color:var(--dsw-alias-label-tertiary,rgba(128,128,128,.9))}
.swb-wrap input,.swb-wrap select{height:30px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.35));background:transparent;color:inherit;padding:0 9px;font:inherit;width:100%}
.swb-btn{cursor:pointer;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.35));background:var(--dsw-specific-tip,transparent);color:inherit;border-radius:8px;height:30px;padding:0 12px;font-size:13px}
.swb-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.15))}
.swb-btn:disabled{opacity:.45;cursor:default}
.swb-btn.primary{background:var(--dsw-alias-brand-primary,#4c8dff);border-color:transparent;color:#fff}
.swb-btn.danger{color:var(--dsw-alias-state-error-primary,#e5484d);border-color:rgba(229,72,77,.45)}
.swb-pill{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.35));opacity:.9}
.swb-pill.auto{color:var(--dsw-alias-state-success-primary,#30a46c)}
.swb-pill.draft{color:var(--dsw-alias-state-warning-primary,#f0b429)}
.swb-card{border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.25));border-radius:10px;padding:12px}
.swb-draft{border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.25));border-radius:10px;padding:10px 12px;margin-top:8px}
.swb-dim{font-size:12px;opacity:.65;margin:3px 0}
.swb-tx{margin:6px 0 10px;font-size:14px;white-space:pre-wrap}
.swb-log{font-family:ui-monospace,Consolas,monospace;font-size:12px;opacity:.7;max-height:150px;overflow:auto;white-space:pre-wrap}
.swb-msg{font-size:12px;margin-left:8px}
.swb-err{color:var(--dsw-alias-state-error-primary,#e5484d)}
.swb-ok{color:var(--dsw-alias-state-success-primary,#30a46c)}
`;

    function useCss() {
      useEffect(() => {
        const id = "swb-client-css";
        if (document.getElementById(id)) return;
        const el = document.createElement("style");
        el.id = id; el.textContent = css;
        document.head.appendChild(el);
      }, []);
    }

    async function call(path, body) {
      const res = await fetch(API + path, body === undefined ? { cache: "no-store" } : {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      return res.json();
    }

    function Panel() {
      useCss();
      const [st, setSt] = useState(null);
      const [msg, setMsg] = useState(null);
      const [form, setForm] = useState({ contact: "", role: "friend", limit: 6, median: 7000, maxChars: 40 });
      const touched = useRef(false);

      const say = (text, bad) => { setMsg({ text, bad }); setTimeout(() => setMsg(null), 4000); };
      const load = useCallback(async () => {
        try {
          const s = await call("/api/state");
          setSt(s);
          if (!touched.current) {
            setForm({
              contact: s.contact || "",
              role: s.role || "friend",
              limit: s.config?.maxRepliesPerMinute ?? 6,
              median: s.config?.delay?.medianMs ?? 7000,
              maxChars: s.config?.maxReplyChars ?? 40,
            });
          }
        } catch {
          setSt({ offline: true });
        }
      }, []);
      useEffect(() => { load(); const t = setInterval(load, 2000); return () => clearInterval(t); }, [load]);

      const set = (k) => (e) => { touched.current = true; setForm((f) => ({ ...f, [k]: e.target.value })); };

      const save = async () => {
        const r = await call("/api/config", {
          contact: form.contact.trim(),
          role: form.role,
          maxRepliesPerMinute: Number(form.limit),
          maxChars: Number(form.maxChars),
          delay: { medianMs: Number(form.median) },
        });
        if (r.ok) { say("已保存"); touched.current = false; load(); }
        else say((r.errors || []).join("；") || "保存失败", true);
      };
      const start = async (mode) => {
        const r = await call("/api/start", { mode });
        say(r.ok ? "已启动（" + mode + "）" : (r.error || "启动失败"), !r.ok); load();
      };
      const stop = async () => { const r = await call("/api/stop", {}); say(r.ok ? "已停止" : "停止失败", !r.ok); load(); };
      const act = async (id, action) => {
        const r = await call("/api/draft", { id, action });
        say(r.ok ? (action === "approve" ? "已发送" : "已丢弃") : (r.error || "失败"), !r.ok); load();
      };

      if (!st) return h("div", { className: "swb-wrap" }, h("div", { className: "swb-dim" }, "读取中…"));
      if (st.offline) return h("div", { className: "swb-wrap" }, h("div", { className: "swb-dim" }, "连不上本地桥进程。先在对话里调用一次 wechat_status 把它拉起来。"));

      const drafts = (st.drafts || []).filter((d) => d.status === "pending");
      const mode = st.mode || "off";

      return h("div", { className: "swb-wrap" }, [
        h("div", { key: "status", className: "swb-row" }, [
          h("span", { key: "m", className: "swb-pill " + mode }, mode),
          h("span", { key: "t", className: "swb-pill" }, "会话 " + (st.title || "(未识别)") + " / 目标 " + (st.contact || "-")),
          h("span", { key: "r", className: "swb-pill" }, "角色 " + (st.roleLabel || st.role)),
          h("span", { key: "s", className: "swb-pill" }, "轮询 " + (st.stats?.polls ?? 0) + " · 已发 " + (st.stats?.replies ?? 0)),
        ]),
        h("div", { key: "form", className: "swb-card" }, [
          h("div", { key: "r1", className: "swb-row" }, [
            h("label", { key: "c", className: "swb-field" }, [
              h("span", { key: "l" }, "会话标题（和微信里完全一致）"),
              h("input", { key: "i", value: form.contact, onChange: set("contact"), placeholder: "例如 aaa" }),
            ]),
            h("label", { key: "ro", className: "swb-field" }, [
              h("span", { key: "l" }, "角色预设"),
              h("select", { key: "i", value: form.role, onChange: set("role") },
                (st.roles || []).map((r) => h("option", { key: r.key, value: r.key }, r.label))),
            ]),
          ]),
          h("div", { key: "r2", className: "swb-row", style: { marginTop: 10 } }, [
            h("label", { key: "l", className: "swb-field" }, [h("span", { key: "s" }, "每分钟最多发"), h("input", { key: "i", type: "number", value: form.limit, onChange: set("limit") })]),
            h("label", { key: "m", className: "swb-field" }, [h("span", { key: "s" }, "拟人延迟中位(ms)"), h("input", { key: "i", type: "number", value: form.median, onChange: set("median") })]),
            h("label", { key: "x", className: "swb-field" }, [h("span", { key: "s" }, "单条字数上限"), h("input", { key: "i", type: "number", value: form.maxChars, onChange: set("maxChars") })]),
          ]),
          h("div", { key: "r3", className: "swb-row", style: { marginTop: 12 } }, [
            h("button", { key: "s", className: "swb-btn primary", onClick: save }, "保存配置"),
            h("button", { key: "d", className: "swb-btn", onClick: () => start("draft") }, "draft 启动"),
            h("button", { key: "a", className: "swb-btn", onClick: () => start("auto") }, "auto 启动"),
            h("button", { key: "x", className: "swb-btn danger", onClick: stop }, "停止"),
            msg && h("span", { key: "msg", className: "swb-msg " + (msg.bad ? "swb-err" : "swb-ok") }, msg.text),
          ]),
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
          id: "super-wechat-bot",
          order: 36,
          label: () => "微信代聊",
        }, Panel)), "super-wechat-bot: settings.section");
      } catch (err) {
        try { console.warn("[super-wechat-bot] client degraded: " + String((err && err.message) || err)); } catch (e) { /* noop */ }
      }
    }

    exports.apply = apply;
    exports.inject = ["slots"];
    exports.NS = NS;
    return module.exports;
  },
});
