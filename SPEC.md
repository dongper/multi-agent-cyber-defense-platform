# SPEC — 联通智能体（Unicom Intelligent Agent）

> 本文件是项目的规格概要（spec-driven 开发入口）。详细需求见 `docs/开发需求文档.md`，分模块规格见 `docs/SPEC/00–07`。

## 1. 项目概述

联通智能体是基于 Hermes Studio（`hermes-web-ui`）定制的多智能体 AI 平台。它在 Hermes Agent 之上提供桌面应用、本地运行时与 Web 控制台，并额外扩展了 **Ekko 智能体运行时** 与 **ESP32-C3 智能语音硬件**，将「Agent 对话、可视化工作流、模型管理、网页浏览、Coding Agent、语音交互、硬件接入」收敛到一个界面。

一句话定位：一个可自托管、多端分发（桌面 / npm / Docker）、可接入智能硬件的多智能体 AI 平台。

## 2. 目标

- **多智能体协同**：Hermes Agent、Ekko Agent、Coding Agents（Codex / Claude Code / OpenCode）在同一平台内编排协作。
- **全链路可控**：对话、工作流、定时任务、Kanban、平台渠道（Telegram / 飞书 / 微信等）围绕同一套 Profile 配置运行。
- **本地优先 + 可自托管**：本地运行时 + 自建 SQLite 会话库，敏感凭证不上云。
- **智能硬件接入**：ESP32-C3 语音设备完成 Wi-Fi 配网、语音交互、远程中继与 OTA 升级。

## 3. 架构总览

```text
浏览器 / 桌面端（Vue 3 前端）
        │ REST + Socket.IO
Koa 后端（routes → controllers → services → SQLite）
        │
        ├── Hermes Agent 运行时（Python，bridge 集成）
        ├── Ekko Agent 运行时（记忆 / 模型 / 工具 / 技能）
        ├── Coding Agents（Codex / Claude Code / OpenCode 代理）
        ├── 平台渠道（社交消息 / 群聊 / 定时任务 / 工作流）
        └── 设备接入（ESP32-C3 语音硬件，配网 / 中继 / OTA）
```

请求流：浏览器加载 Vite 构建产物 → 客户端 API 封装 → 后端路由 → 控制器校验 → 服务承担副作用（文件 / SQLite / Profile / 子进程 / 凭证）。长连接（聊天、群聊）走 Socket.IO 命名空间。

## 4. 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3（`<script setup lang="ts">`）、Pinia、Vue Router、Naive UI、Vue Flow、i18n、Vite |
| 后端 | Koa、`@koa/router`、Socket.IO、SQLite（better-sqlite3）、tsoa（OpenAPI 生成） |
| 桌面 | Electron + 内置 Python / Hermes runtime |
| 智能体 | Hermes Agent（Python）、Ekko Agent（TS 运行时 + `agent-browser`）、Coding Agents |
| 硬件 | ESP32-C3（PlatformIO）、ES8311 音频、I2C OLED、I2S、双 OTA |
| 质量 | Vitest、Playwright、TypeScript 6、ESLint（经 harness） |

## 5. 模块（包）清单与职责

| 包 | 职责 | 关键子结构 |
| --- | --- | --- |
| `packages/client` | Vue 前端 UI、路由、Pinia、API 封装、i18n | `views/`、`components/`、`stores/`、`api/`、`i18n/locales/` |
| `packages/server` | HTTP API、认证、Socket.IO、SQLite、Hermes/设备集成 | `routes/`、`controllers/`、`services/`、`db/`、`middleware/` |
| `packages/desktop` | Electron 外壳、本地 Web UI、更新器、运行时打包 | `scripts/runtime-config.mjs` 固定上游 Hermes 版本 |
| `packages/ekko-agent` | Ekko 智能体运行时 | `memory/`、`model/providers/`、`runtime/`、`tools/`、`skills/` |
| `packages/esp32-c3` | 智能语音硬件固件 | `v1/`（Wi-Fi 配网）、`v2/`（音频调优） |
| `packages/skills` | 技能包 | 图像 / 视频生成等 6 个技能 |

## 6. 多智能体角色

| 智能体 | 角色 |
| --- | --- |
| Hermes Agent | 核心对话 / 工具调用 Agent，经 bridge 集成，负责工作区、记忆、技能、插件 |
| Ekko Agent | 自托管浏览器 / 设备 Agent，自带记忆、多模型 provider、approval / browser / clarify / code-exec 工具 |
| Coding Agents | Codex / Claude Code / OpenCode 编码代理，经代理路由接入 |
| 群聊智能体 | 群聊房间中的多智能体协作与提及路由 |

## 7. 核心接口速览

| 域 | 路由（前缀示例） |
| --- | --- |
| 认证 | `/api/auth/*`、`/api/hermes/*-auth`（anthropic / codex / copilot / minimax / nous / xai） |
| 聊天 | `/api/hermes/chat-run`（Socket.IO `/chat-run`）、`sessions`、`group-chat` |
| 模型 / 配置 | `models`、`providers`、`profiles`、`config`、`runtime-versions` |
| 工作流 / 任务 | `workflows`、`jobs`、`kanban`、`cron-history` |
| 文件 / 媒体 | `files`、`download`、`upload`、`media` |
| 语音 / 终端 | `tts`、`stt`、`terminal` |
| 设备 / 硬件 | `devices`、`mcu-devices`、`mcu-firmware` |
| 系统 | `health`、`theme`、`update`、`logs`、`performance-monitor` |

完整契约以 `docs/SPEC/05-数据模型与API契约SPEC.md` 与 `docs/openapi.json` 为准。

## 8. 开发约定

- 路由保持轻量，业务逻辑进 controllers / services；本地路由先于代理兜底路由注册。
- Web UI 状态与 Hermes Agent 状态分离（`HERMES_WEB_UI_HOME` / Profile 目录）。
- 优先 `execFile` / `spawn` 参数数组，避免 shell 字符串拼接。
- 前端用户可见文案写入所有 locale 文件；组件样式默认 scoped。

## 9. 常用命令

```bash
npm install
npm run dev          # Vite client + Koa server 联调
npm run test         # Vitest 单测
npm run test:e2e     # Playwright 浏览器测试
npm run build        # 类型检查 + 产物构建
npm run build:desktop:win   # Windows 桌面打包（mac/linux 同理）
npm run mcu:v2:flash:clean   # ESP32-C3 v2 固件擦写烧录
```
