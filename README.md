# dsh-super-wechat-bot

[![GitHub release](https://img.shields.io/github/v/release/gautema8-hash/dsh-super-wechat-bot)](https://github.com/gautema8-hash/dsh-super-wechat-bot/releases)
[![license](https://img.shields.io/github/license/gautema8-hash/dsh-super-wechat-bot)](LICENSE)
[![CI](https://github.com/gautema8-hash/dsh-super-wechat-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/gautema8-hash/dsh-super-wechat-bot/actions/workflows/ci.yml)

微信代聊机器人 · DSH 插件。用主人本人的口吻替你回微信，**检测→决策→发送整条回路跑在独立进程里**，不占 DSH 的 agent 轮次。

- 延迟：预置短语 **1–1.5s** 直达，模型生成 **2.5–4s**（实测 flash 首包 1.5s 左右）
- 读消息：PrintWindow 截图 + Windows OCR（微信是 Qt 自绘，UIA 树是空的）
- 判方向：只认气泡底色（绿色 #95EC69 = 自己发的；白/浅灰 = 对方），底色读不出来就丢弃该行，绝不按位置猜
- 拟人：延迟对数正态抖动、连发合并、85% 不回收尾语、被催时切 1–2s 快档
- 安全：会话标题校验、身份分级 T0–T3、升级即停手、每分钟限流、全量审计

## 环境要求

- Windows 10 / 11
- 微信桌面版 4.x（进程名 `Weixin`）
- DSH `>= 0.2.1-rc.5 < 0.3.0-0`、Node.js >= 20

## 安装

在 DSH 里直接装发行包（推荐）：

```sh
dsh plugin --profile web add https://github.com/gautema8-hash/dsh-super-wechat-bot/releases/latest/download/dsh-super-wechat-bot.tgz
```

或者走 GitHub 源码：

```sh
dsh plugin --profile web add github:gautema8-hash/dsh-super-wechat-bot
```

装完重启 DSH，`wechat_*` 工具即出现在会话里。插件市场收录后也可以直接在**设置 → 插件 → 市场**里搜索安装。

### 从源码开发

```powershell
# 装到 profile 并挂上 loader 条目
Copy-Item -Recurse -Force .\* "$env:USERPROFILE\.dsh\profiles\web\node_modules\dsh-super-wechat-bot\"
```

然后在 `$env:USERPROFILE\.dsh\profiles\web\cordis.patch.yml` 末尾加：

```yaml
- insert:
    - id: dsh-super-wechat-bot
      name: 'dsh-super-wechat-bot'
```

改代码后重复一次拷贝命令即可（profile 的 `patchReload: live` 会热加载）。
跑测试：`npm test`。

## 设置页（DSH 内）

装好后打开 **设置 → 微信代聊**（只有一个条目）。顶部是实时状态（模式圆点 / 微信会话 vs 目标 / 角色）和主操作，下面是六个分页：基础、行为、话术、安全、高级、运行。
下面按折叠块分组：

| 分组 | 能调什么 |
|---|---|
| 会话与角色 | 目标会话名、角色预设、微信进程名、DSH 启动时是否自动拉起 |
| 节奏与拟人 | 轮询间隔、连发合并窗口、快档开关、延迟中位数/上下限/被催中位数 |
| 限额与安全 | 每分钟上限、单条字数、连续升级停手阈值、收尾语不回复概率 |
| 话术 | 身份被质疑 / 拿不准 / 忙时 三句固定回复 |
| 识别规则 | 被催、纯收尾语、角色禁区、T0/T1/T2 身份分级正则 |
| 预置短语 | 正则 → 回复 的列表，可增删 |
| 模型与密钥 | 模型名、Base URL、API Key（留空表示不修改） |
| 自定义角色 | JSON 数组，可给不同人设写 persona |

保存时会先过 `bridge/validate.mjs`：坏正则、越界数值、空会话名都会被拦下，不会写进运行时。
会话名和微信当前标题对不上时，状态条会直接标红提示。

另有独立本地面板 `http://127.0.0.1:47821/`（只监听 127.0.0.1），功能与设置页一致，可在浏览器直接打开。

## 用法

1. **先在微信里打开目标会话**（机器人只在标题匹配时工作，防止发错人）
2. 调 `wechat_start`，`contact` 填会话标题里的昵称，`mode` 选 `draft`（默认）或 `auto`
3. `wechat_drafts` 看它拟了什么，`wechat_approve` 发，`wechat_reject` 丢弃
4. `wechat_stop` 随时停手

| 工具 | 作用 |
|---|---|
| `wechat_status` | 模式/标题/统计/最近事件 |
| `wechat_start` | 启动（draft 草稿 / auto 自动发） |
| `wechat_stop` | 停手 |
| `wechat_scan` | 只读抓一屏，看对方在等什么 |
| `wechat_drafts` | 列出草稿与升级待办 |
| `wechat_approve` / `wechat_reject` | 批准发送 / 丢弃 |
| `wechat_send` | 强制发一条（会校验标题） |
| `wechat_config` | 读写配置（拟人节奏、话术、正则） |

## 配置

文件：`~/.dsh/dsh-super-wechat-bot/config.json`（没有会自动建）。

| 键 | 默认 | 说明 |
|---|---|---|
| `contact` | aaa | 目标会话标题 |
| `processName` | Weixin | 微信进程名 |
| `pollMs` | 900 | 轮询间隔（截图 diff 只要 60ms，OCR 只在变化时跑） |
| `coalesceMs` | 1600 | 连发合并静默窗口 |
| `delay.medianMs` | 7000 | 拟人延迟中位数，对数正态抖动 |
| `delay.urgentMedianMs` | 1300 | 被催（快点/在吗/急）时的中位数 |
| `skipAckProbability` | 0.85 | 收尾语概率（当前实现：整串都是收尾语才不回，有任何真问题必答） |
| `maxReplyChars` | 40 | 回复字数上限 |
| `maxRepliesPerMinute` | 6 | 每分钟上限，**不可被任何调用绕过**（设 0 即全停发） |
| `stopAfterEscalations` | 2 | 连续升级几次就停手 |
| `apiKey` | 空 | 留空则复用 `~/.dsh/.credentials.yaml` 里的 DEEPSEEK_API_KEY |
| `model` | deepseek-flash | 生成模型 |
| `persona` | 内置 | 系统提示词 |

## 身份分级（写死，别乱改）

| 级别 | 触发 | 动作 |
|---|---|---|
| T0 | 是不是机器人/跟变了个人/你是谁啊/怎么秒回 | 回固定话术 → **立即停手** |
| T1 | 咋这么怪/不对劲 | 回「这会在忙」→ 转人工 |
| T2 | 钱/借/合同/地址/验证码/吃饭约见 | 回「这个我晚点跟你细说」→ 转人工 |
| T3 | 普通闲聊 | 自动回 |

同一会话累计 2 次升级 → 整个会话强制打成 draft 不再自动发。


## 可视化面板（推荐入口）

插件启动后会自带一个本地面板（只监听 127.0.0.1）：

    http://127.0.0.1:47821/

面板上能做的事：填会话名、选角色、切 draft/auto、调延迟与字数、看实时状态、逐条批准/丢弃草稿。
所有写入都会先过 `bridge/validate.mjs`：非法 mode、坏正则、越界数值、空会话名、未知角色一律拒绝或收敛，
坏配置不会进运行时，所以"配错就发错消息"这条路径被堵住了。

## 角色预设

| 角色 | 适用于 | 它自带的话术禁区 |
|---|---|---|
| `friend` | 朋友（默认） | 转账/借钱/红包/密码/验证码 |
| `teacher` | 教师 → 学生、家长 | 成绩/排名/评优/推荐/补习/费用 |
| `engineer` | 建筑工程师 → 甲方、施工方、监理 | 工期/造价/验收/签字/盖章/索赔/返工 |
| `sales` | 销售 → 客户 | 报价/折扣/定金/合同/发票/交期/库存 |
| `freelancer` | 自由职业 → 客户 | 报价/交付/截止/延期/违约金 |
| `parent` | 家长 → 老师、家长群 | 成绩/排名/评优/补习/费用 |

角色决定三件事：**人设提示词**（你是谁、跟谁说话、什么语气）、**预置快捷回复**、**额外禁区**。
命中角色禁区的问题一律回「这个我确认下再回你」，不会替你承诺工期、价格、成绩这类东西。

## 交付级测试

```powershell
node test/offline.test.mjs     # 纯逻辑 11 项，不碰微信不联网
node test/delivery.test.mjs --dry   # 真实拉起 daemon+PS 代理，但一条消息都不发（12 项）
node test/delivery.test.mjs    # 端到端真实发送（13 项，会给目标会话发 1-2 条消息）
node test/panel.test.mjs      # 面板 API + 配置校验（10 项，不碰微信）
```

dry 模式验证：握手、标题闸、OCR 解析、收尾语跳过、T0 停手、去重闸、限流闸、标题不匹配拒发、审计落盘。
真实模式额外交付验证：实际发出、输入框回读确认中文不乱码。

## 已知限制

- **图片/视频/语音解析不了**，只能看到文字气泡；对方发视频时机器人当没看见。
- OCR 依赖 Windows 中文语言包（`zh-Hans-CN`）。
- 发送要借前台 200–400ms（微信输入框不吃后台按键），正在打字时可能被打断。
- 微信窗口别最小化到托盘：最小化时会尝试恢复，恢复不了就跳过这一轮。
- 微信改版会挪布局，几何比例在 `bridge/psagent.ps1` 的 `$script:Cfg` 里，可现场调。

## 自测

```powershell
node test/offline.test.mjs   # 解析/策略/清洗，11 项，不碰微信不联网
node test/llm.test.mjs       # 真实调一次 DeepSeek，验证 key 与话术
```

## 结构

```
lib/index.js        DSH 插件本体：9 个 wechat_* 工具 + 管理桥进程
bridge/daemon.mjs   常驻桥进程：轮询/合并/决策/限流/审计/控制协议
bridge/psagent.ps1  常驻 PowerShell：PrintWindow 截图、WinRT OCR、键鼠输入
bridge/parse.mjs    OCR 行 → 消息（方向、合并、增量切片）
bridge/policy.mjs   预置短语、身份分级、收尾语、回复清洗
bridge/llm.mjs      DeepSeek 调用 + 提示词拼装
test/*.mjs          离线自测
audit/*.jsonl       逐条审计：读到什么、发了什么、为什么
```
