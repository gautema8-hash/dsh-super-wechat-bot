# Changelog

## 0.1.0

首个可安装版本。

- DSH 插件宿主半边：`wechat_status` / `wechat_start` / `wechat_stop` / `wechat_scan` /
  `wechat_drafts` / `wechat_approve` / `wechat_reject` / `wechat_send` / `wechat_config` 九个工具
- 独立桥进程：PrintWindow 截图 + Windows OCR 读微信，不占 DSH agent 轮次
- 拟人节奏：对数正态延迟、连发合并、被催切快档、每分钟限流
- 安全：会话标题校验、身份分级 T0–T3、升级即停手、全量审计
- 本地设置面板（127.0.0.1:47821）+ DSH 设置页里的客户端页签
