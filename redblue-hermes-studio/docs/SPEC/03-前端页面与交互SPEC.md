# 03-前端页面与交互 SPEC

## 1. 前端技术约定

同 Hermes Studio：Vue 3 Composition API（`<script setup lang="ts">`）、Pinia、Naive UI、Vue Flow、i18n 全 locale。红蓝工作台不新增 UI 库。

## 2. 安全运营工作台（`/security-operations`）

入口组件 `packages/client/src/views/hermes/CyberDefenseView.vue`，品牌名「红蓝协同智能安全运营平台」，5 个 Tab：

| Tab | 组件 / 逻辑 | 说明 |
| --- | --- | --- |
| 态势总览 | overview | 实时问答、授权任务、技能调用与智能体运行状态 |
| 任务中心 | `CyberTaskWorkspace.vue` | 创建授权任务、CTF Skills 编排、可追溯问答 |
| 智能体编排 | `CyberAgentStudio.vue` | 11 智能体拖拽、连线、编辑配置 |
| 攻击链分析 | chain | 基于当前任务真实消息 / 工具调用生成 |
| 事件报告 | report | 汇总任务、会话、结果与证据引用，导出 JSON |

## 3. 关键组件

| 组件 | 职责 | 关键点 |
| --- | --- | --- |
| `CyberTaskWorkspace.vue` | 任务工作台 | `canRun` 依赖任务正文含 `AUTHORIZED_SECURITY_TEST`；未授权时禁用执行 |
| `CyberAgentStudio.vue` | 编排画布 | 拖拽、连线、编辑配置；标题「红蓝队智能体编排」 |
| `cyber-studio.ts` | 智能体数据 | 11 智能体 + 12 条连线（edges）定义 |

## 4. 数据装配（`CyberDefenseView.vue`）

| 数据 | 来源 |
| --- | --- |
| 会话详情 | `fetchSession` |
| 会话摘要 | `fetchConversationSummaries`（humanOnly, limit 1000） |
| 技能 / 统计 | `fetchSkills` / `fetchSkillUsageStats` |
| 任务 / 看板 | `listBoards` / `listTasks` / `getTask`（Kanban） |
| 工作流 | `listWorkflows` / `createWorkflow` |
| 专属问答 | `runCyberDefenseChat`（`api/hermes/cyber-defense`） |

## 5. 交互规则

1. **授权拦截是硬约束**：任务正文不含 `AUTHORIZED_SECURITY_TEST` 时，执行按钮禁用并提示。
2. **证据优先展示**：攻击链 / 报告必须区分「真实消息 / 工具记录」与「推断」，空白任务显示空态（`NEmpty`）而非推断内容。
3. **空态 / 错误态 / 降级态**：态势总览、攻击链、报告均需空态文案。
4. **i18n 全覆盖**：红蓝文案集中 `i18n/cyber-defense.ts`，产品名「红蓝协同智能安全运营平台」进 locale。
5. **报告导出**：`incident-report.json` 可下载（文件名带任务 id）。

## 6. 与底座页面关系

安全运营工作台是新增页，其余底座页面（聊天、工作流、模型、设置、设备、语音等）与 Hermes Studio 一致，见根项目 `docs/SPEC/03`。
