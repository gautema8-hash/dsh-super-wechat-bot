# Changelog

## 0.2.0

- 设置页 UI 重构（交付级）：状态头 + 指标条 + 六分页（基础/行为/话术/安全/高级/运行）
- 危险操作二次确认：auto 启动先弹出确认条，避免误触发自动发送
- 保存校验失败时列出全部错误；保存成功/警告/失败三态横幅
- 客户端注册改成页面级幂等（window 级 disposer），重复装载不会再叠加条目
- 无障碍：tablist/tab 角色、aria-label、键盘焦点环

## 0.1.2

- 设置页合并为唯一一个「微信代聊」条目：apply 幂等，重复挂载会先回收旧注册，不再叠加
- UI 重做：状态卡（模式/会话/角色/未保存提示）+ 指标条 + 折叠分组 + 底部保存栏
- 新增客户端冒烟测试 test/client.test.mjs（15 项），覆盖注册唯一性与离线/在线渲染

## 0.1.1

- 设置页重做：DSH 设置 → 微信代聊 里可配置全部参数（会话/角色/进程、节奏与延迟、
  限额与安全、话术、识别正则、预置短语、模型与密钥、自定义角色），保存前先过校验
- 面板配置接口新增 fastMode / autoStart / processName / baseUrl / skipAckProbability /
  draftRetention / pollMsFast / coalesceMsFast / fastDelayMs / roleDefer 字段
- 顶部实时显示微信当前会话，和目标的会话名不一致时直接标红

## 0.1.0

首个可安装版本。

- DSH 插件宿主半边：`wechat_status` / `wechat_start` / `wechat_stop` / `wechat_scan` /
  `wechat_drafts` / `wechat_approve` / `wechat_reject` / `wechat_send` / `wechat_config` 九个工具
- 独立桥进程：PrintWindow 截图 + Windows OCR 读微信，不占 DSH agent 轮次
- 拟人节奏：对数正态延迟、连发合并、被催切快档、每分钟限流
- 安全：会话标题校验、身份分级 T0–T3、升级即停手、全量审计
- 本地设置面板（127.0.0.1:47821）+ DSH 设置页里的客户端页签
