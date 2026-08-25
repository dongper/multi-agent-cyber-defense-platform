# 04-后端服务与数据存储 SPEC

## 1. 定位

红蓝平台**复用 Hermes Studio 底座后端**，不新增安全扫描引擎。新增点只有一个专属问答通道，其余全部复用已有路由 / 服务 / 存储。

## 2. 新增 API

| 接口 | 位置 | 说明 |
| --- | --- | --- |
| `runCyberDefenseChat` | `packages/client/src/api/hermes/cyber-defense` | 红蓝任务内的安全问答（走 Hermes chat 链路） |

## 3. 复用的底座 API

| 能力 | 路由 / API | 用途 |
| --- | --- | --- |
| 看板任务 | `api/hermes/kanban`（listBoards / listTasks / getTask） | 授权任务管理（红蓝队任务板） |
| 会话 | `api/hermes/sessions`（fetchSession）、`conversations` | 问答会话与详情 |
| 技能 | `api/hermes/skills`（fetchSkills / fetchSkillUsageStats） | CTF 技能与使用统计 |
| 工作流 | `api/hermes/workflows`（listWorkflows / createWorkflow） | 智能体编排同步到工作流画布 |
| 聊天 | Socket.IO `/chat-run` / `chat-run` | 流式问答 |

## 4. 数据存储

红蓝模块不新增 SQLite store，数据落点：

| 数据 | 落点 |
| --- | --- |
| 授权任务 | Hermes Kanban 任务（正文含 `AUTHORIZED_SECURITY_TEST`） |
| 问答会话 | Hermes 会话库（sessions / conversations） |
| 技能统计 | 技能使用统计 store |
| 智能体编排 | 客户端 `cyber-studio.ts` + 同步到工作流（workflow store） |
| 攻击链 / 报告 | 客户端由真实会话数据实时生成（可导出 JSON，不落库） |

## 5. 环境与端口

| 项 | 值 |
| --- | --- |
| 前端 | `8659`（`dev:redblue:client`，`HERMES_WEB_UI_FRONTEND_PORT=8659`） |
| 后端 | `8657`（`dev:redblue:server`，`PORT=8657`） |
| 启动 | `npm run dev:redblue` |
| 入口 | `http://127.0.0.1:8659/#/security-operations` |

环境变量：`HERMES_WEB_UI_DISABLE_GATEWAY_AUTOSTART=1`、`HERMES_WEB_UI_STOP_GATEWAYS_ON_SHUTDOWN=0`（网关不自动拉起 / 关闭时不停网关，避免干扰底座）。

## 6. 安全约束（后端侧配合）

- 红队执行授权由**前端 + 任务正文标记**共同保证；后端沿用 Hermes 既有认证与凭证安全（Token / Key 不下前端、日志脱敏）。
- 处置建议默认不触发生产变更，需人工审批。
