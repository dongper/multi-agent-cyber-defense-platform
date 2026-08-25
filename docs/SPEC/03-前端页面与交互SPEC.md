# 03-前端页面与交互 SPEC

## 1. 前端技术约定

- Vue 3 Composition API，统一 `<script setup lang="ts">`。
- 状态用 Pinia setup store（`packages/client/src/stores`）。
- API 调用统一走 `packages/client/src/api/client.ts`，禁止散落 axios 直调。
- 用户可见文案写入全部 locale 文件（`i18n/locales/`，含 zh / zh-TW / en / ja / ko / ar / de / es / fr / pt / ru）。
- 组件样式默认 scoped（SCSS），除非刻意全局。
- UI 组件沿用 Naive UI，不新增 UI 库。

## 2. 页面清单（`packages/client/src/views`）

### 2.1 认证与入口
| 页面 | 组件 | 说明 |
| --- | --- | --- |
| 登录 | `LoginView.vue` | 本地认证入口，logo 为「联通智能体」 |

### 2.2 核心交互
| 页面 | 组件 | 说明 |
| --- | --- | --- |
| 聊天 | `ChatView.vue` | 流式对话、工具调用轨迹、文件预览、多会话 |
| 群聊 | `GroupChatView.vue` / `SharedGroupChatView.vue` / `GroupChatLinkView.vue` | 多智能体协作房间 |
| 全局智能体 | `GlobalAgentView.vue` | 全局 Agent 配置 |

### 2.3 编排与任务
| 页面 | 组件 | 说明 |
| --- | --- | --- |
| 工作流 | `WorkflowView.vue` | Vue Flow 节点化编排 |
| 任务 | `JobsView.vue` | 定时任务 / Cron |
| Kanban | `KanbanView.vue` | 看板任务 |
| 渠道 | `ChannelsView.vue` | 平台渠道绑定 |

### 2.4 模型与配置
| 页面 | 组件 | 说明 |
| --- | --- | --- |
| 模型 | `ModelsView.vue` | 模型 / Provider 管理 |
| Profile | `ProfilesView.vue` | 多配置文件管理 |
| 设置 | `SettingsView.vue` | 运行时 / 全局设置 |
| 主题 | `ThemeView.vue` | 主题自定义 |

### 2.5 工具与工作区
| 页面 | 组件 | 说明 |
| --- | --- | --- |
| 文件 | `FilesView.vue` | 文件浏览器 |
| 终端 | `TerminalView.vue` | Web 终端（xterm.js） |
| 桌面浏览器 | `DesktopBrowserView.vue` | 内置 Agent 浏览器 |
| Coding Agents | `CodingAgentsView.vue` | Codex / Claude Code / OpenCode |
| MCP | `McpManagerView.vue` | MCP Server 管理 |

### 2.6 智能体资产
| 页面 | 组件 | 说明 |
| --- | --- | --- |
| 技能 | `SkillsView.vue` / `SkillsUsageView.vue` | 技能与使用统计 |
| 记忆 | `MemoryView.vue` | 记忆管理 |
| 插件 | `PluginsView.vue` | 插件管理 |
| 宠物 | `DesktopPetView.vue` / `PetdexView.vue` | 桌面宠物与图鉴 |

### 2.7 设备与语音
| 页面 | 组件 | 说明 |
| --- | --- | --- |
| 设备 | `DevicesView.vue` | ESP32-C3 设备发现 / 配对 / 状态 |

### 2.8 可观测与历史
| 页面 | 组件 | 说明 |
| --- | --- | --- |
| 历史 | `HistoryView.vue` | 会话历史 |
| 学习轨迹 | `JourneyView.vue` | Agent 学习轨迹 |
| 用量 | `UsageView.vue` | 用量分析 |
| 性能 | `PerformanceView.vue` | 性能监控 |
| 日志 | `LogsView.vue` | 日志 |
| 版本 | `VersionPreviewView.vue` | 运行时版本预览 |

## 3. 关键交互规则

1. **流式渲染**：聊天经 Socket.IO `/chat-run` 实时更新，工具调用轨迹可展开（参数 / 结果）。
2. **错误态 / 空态 / 降级态**：所有异步视图必须有三态；设备离线、模型不可用、凭证缺失要有明确提示。
3. **凭证不落地前端**：任何页面不得展示或请求 Token / Key 原文。
4. **i18n 全覆盖**：新增可见文案必须同步所有 locale，否则 harness 检查不通过。
5. **响应式**：控制台需适配桌面与移动端（移动端有独立交互）。
