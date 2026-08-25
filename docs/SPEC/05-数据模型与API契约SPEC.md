# 05-数据模型与API契约 SPEC

> 本文是字段与接口的**唯一契约来源**。冲突时优先级：`05` 契约 > `04` 后端实现 > `03` 前端展示 > `06` 智能体细节。精确字段定义以 `docs/openapi.json` 为准。

## 1. 核心数据实体

| 实体 | 来源 store | 说明 |
| --- | --- | --- |
| User | `users-store` | 本地用户与认证信息 |
| Session | `sessions-db` / `session-store` | 会话（含来源、类别、工作区） |
| Conversation | `conversations-db` | 会话内的消息对话 |
| Message | `message-content` | 消息内容（文本 / 工具调用 / 附件） |
| SocialMessage | `social-message-store` | 平台渠道消息 |
| Workflow | `workflow-store` | 工作流定义（节点 / 边） |
| WorkflowRun | `workflow-run-store` | 工作流执行记录 |
| WorkflowSchedule | `workflow-schedule-store` | 定时执行计划 |
| Device | `devices-store` | 通用设备 |
| McuDevice | `mcu-devices-store` | ESP32-C3 硬件设备（配对 / 状态 / 固件） |
| AppConnection | `app-connections-store` | 外部应用 / 渠道连接 |
| Usage | `usage-store` | 用量与统计 |
| 配置 | `tts-settings-store` · `stt-settings-store` · `user-theme-store` · `group-agent-preset-store` | 各类用户 / 系统配置 |
| 审计 / 变更 | `provider-audit-store` · `workspace-run-changes-store` | 审计与工作区变更记录 |
| ChatWebhook | `chat-webhook-store` | 聊天 Webhook 订阅 |

## 2. API 契约约定

1. 前缀统一 `/api/...`，本地路由先于代理兜底路由注册。
2. 所有响应使用统一 envelope（含 `data` / `error` / `status`），错误语义一致。
3. 长连接（聊天 / 群聊 / 工作流）走 Socket.IO 命名空间：`/chat-run` 为聊天主通道。
4. 刷新类接口本期为同步 API，前端不要求轮询（异步任务另走任务查询）。
5. 凭证 / Token / Key 只在后端；前端任何接口不得返回明文密钥。

## 3. 关键路由契约（速查）

| 域 | 路由 | 方法 |
| --- | --- | --- |
| 健康 | `/api/health` | GET |
| 认证 | `/api/auth/*`、`/api/hermes/{anthropic,codex,copilot,minimax,nous,xai}-auth` | POST |
| 会话 | `/api/hermes/sessions`、`/api/hermes/conversations` | GET/POST/PUT/DELETE |
| 聊天 | `/api/hermes/chat-run`（+ Socket.IO `/chat-run`） | POST |
| 群聊 | `/api/hermes/group-chat/*` | GET/POST |
| 模型 / 配置 | `/api/hermes/{models,providers,profiles,config,runtime-versions}` | GET/POST/PUT |
| 工作流 | `/api/hermes/workflows`、`/api/hermes/jobs`、`/api/hermes/kanban` | GET/POST/PUT/DELETE |
| 文件 / 媒体 | `/api/hermes/{files,download,media}`、`/api/upload` | GET/POST |
| 语音 / 终端 | `/api/hermes/{tts,stt}`、`/api/hermes/terminal` | POST |
| 设备 | `/api/devices`、`/api/mcu-devices`、`/api/hermes/mcu-firmware` | GET/POST/PUT |
| 系统 | `/api/theme`、`/api/update`、`/api/hermes/logs`、`/api/hermes/performance-monitor` | GET/POST |

## 4. 冻结原则

Day0 冻结后，以下内容默认不变，除非五人共同确认：

| 项 | 冻结规则 |
| --- | --- |
| API path | 不删除、不改名，只能新增兼容接口 |
| JSON key | 不删除、不改名，只能新增可选字段 |
| enum | 不改变已有取值语义 |
| Socket.IO 事件 | 事件名与命名空间不变 |
| MCU 协议 | 上行（ADPCM 语音）与下行（TTS / 命令）字段不变 |
| 凭证 | 只在后端，前端不接触 |

## 5. MCU 设备契约（要点）

- 上行：语音（ADPCM 编码）→ `stt` 转写；下行：`tts` 音频 → 设备播放。
- 配对：`device-pairing-code` 生成短码，设备与 Web 端配对绑定。
- 固件：`mcu-firmware` 下发 + OTA；版本与硬件修订（v1 / v2）分离。
