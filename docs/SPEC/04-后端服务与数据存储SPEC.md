# 04-后端服务与数据存储 SPEC

## 1. 后端结构（`packages/server/src`）

| 层 | 职责 |
| --- | --- |
| `routes/` | 注册 HTTP 与 WebSocket 入口；本地路由先于代理兜底路由注册 |
| `controllers/` | 请求级处理，校验入参 |
| `services/` | 可复用 IO、领域行为、外部进程调用、集成逻辑 |
| `db/` | SQLite schema 与 store |
| `middleware/` | 请求中间件（如用户认证） |
| `shared/` | 跨服务常量与工具 |

## 2. 路由清单

### 2.1 顶层路由
`api-docs` · `app-connections` · `app-relay` · `auth` · `claude-code-proxy` · `codex-proxy` · `coding-agents` · `devices` · `health` · `index` · `mcu-devices` · `social-messages` · `theme` · `update` · `upload`

### 2.2 Hermes 子路由（`routes/hermes/`）
`anthropic-auth` · `app-upload` · `chat-run` · `chat-webhooks` · `codex-auth` · `config` · `copilot-auth` · `cron-history` · `download` · `files` · `group-chat` · `jobs` · `journey` · `kanban` · `kanban-events` · `logs` · `mcp` · `mcu-firmware` · `media` · `memory` · `minimax-auth` · `models` · `nous-auth` · `performance-monitor` · `petdex` · `pets` · `plugins` · `profiles` · `providers` · `runtime-versions` · `sessions` · `skill-bundles` · `skills` · `stt` · `terminal` · `tts` · `weixin` · `workflows` · `write-gate` · `xai-auth`

## 3. 服务清单（`services/`）

- **认证 / 安全**：`auth` · `login-limiter` · `credentials` · `app-entitlement` · `model-execution-identity`
- **智能体**：`hermes/`（run-chat 等）· `ekko-agent/` · `global-agent/` · `coding-agents/`
- **工作流**：`workflow-manager` · `workflow-socket` · `workflow-schedule-service` · `workflow-portability` · `workflow-skill-resolver` · `workflow-import-capabilities`
- **设备 / 硬件**：`device-pairing-code` · `lan-discovery` · `lan-http-client` · `lan-peer-socket` · `lan-peer-tools`
- **运行时**：`runtime-environment` · `runtime-version-manager` · `shutdown` · `windows-command`
- **数据 / 系统**：`usage-recorder` · `user-theme` · `system-info` · `safe-file-store` · `logger` · `config-helpers` · `app-config` · `social-messages/` · `app-relay/`

## 4. 数据存储（`db/hermes/`）

| 域 | store |
| --- | --- |
| 用户 / 会话 | `users-store` · `sessions-db` · `conversations-db` · `session-store` · `session-category-store` · `message-content` |
| 社交 | `social-message-store` |
| 工作流 | `workflow-store` · `workflow-run-store` · `workflow-schedule-store` |
| 设备 | `devices-store` · `mcu-devices-store` |
| 用量 / 审计 | `usage-store` · `provider-audit-store` · `workspace-run-changes-store` |
| 配置 | `tts-settings-store` · `stt-settings-store` · `user-theme-store` · `group-agent-preset-store` · `app-connections-store` · `chat-webhook-store` |
| 其他 | `compression-snapshot` · `schemas` · `init` |

约定：Web UI 状态落在 `HERMES_WEB_UI_HOME`（默认 `~/.hermes-web-ui`），与 Hermes Agent 的 Profile 状态分离；上传目录默认派生自 Web UI home（可用 `UPLOAD_DIR` 覆盖）。

## 5. 认证与安全

- 认证集中到 `services/auth.ts`；登录限流走 `login-limiter`。
- 模型凭证 / Token / AI Key 仅存后端，日志脱敏。
- 写入门禁（`write-gate`）控制文件写操作；`safe-file-store` 负责受控文件存储。
- CLI 调用优先 `execFile` / `spawn` 参数数组，避免 shell 拼接。

## 6. 设备 / 硬件通道

- 设备发现：`lan-discovery`（局域网发现）+ 配对码（`device-pairing-code`）。
- 上行：MCU 语音（ADPCM）→ `stt` 转写 → Agent。
- 下行：`tts` 合成 → 设备播放；固件经 `mcu-firmware` 下发 OTA。
- 路由：`devices` · `mcu-devices` · `mcu-firmware`；store：`devices-store` · `mcu-devices-store`。
