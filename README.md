# 联通智能体（Unicom Intelligent Agent）

> 基于 Hermes Studio（`hermes-web-ui`）定制的多智能体 AI 平台，面向 Hermes Agent 提供桌面应用、本地运行时与 Web 控制台，并扩展了 Ekko 智能体运行时与 ESP32-C3 智能语音硬件。

## 定位

在一个界面内完成：Agent 对话、可视化工作流、模型与 Profile 管理、网页浏览、Coding Agent、语音交互、本地运行环境与智能硬件接入。

## 文档导航

| 文档 | 说明 |
| --- | --- |
| [`SPEC.md`](./SPEC.md) | 项目规格概要（spec-driven 开发入口） |
| [`docs/开发需求文档.md`](./docs/开发需求文档.md) | 完整开发需求（背景 / 角色 / 功能 / 非功能 / 验收） |
| [`docs/SPEC/`](./docs/SPEC/) | 详细规格套件（00–07，含分工排期、数据模型与 API 契约、验收标准） |
| [`README.frontend.zh.md`](./README.frontend.zh.md) | 前端功能完整说明 |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | 架构与包边界 |
| [`DEVELOPMENT.md`](./DEVELOPMENT.md) | 开发命令与编码规范 |

## 技术栈

Vue 3 · TypeScript · Vite · Koa · Socket.IO · SQLite · Electron · Python（Hermes runtime）· PlatformIO（ESP32-C3）

## 目录结构

```
packages/
├── client/       Vue 3 前端（视图、组件、Pinia、i18n、API 封装）
├── server/       Koa 后端（路由、控制器、服务、SQLite 存储）
├── desktop/      Electron 桌面应用与 Hermes/Python 运行时打包
├── ekko-agent/   Ekko 智能体运行时（记忆、模型、工具、技能）
├── esp32-c3/     ESP32-C3 智能语音硬件固件（v1 Wi-Fi 配置 / v2 音频）
└── skills/       技能包（图像 / 视频生成等）
```

## 许可证

BSL-1.1（同上游 Hermes Studio）
