# 05-数据模型与API契约 SPEC

> 红蓝模块的字段与接口契约。冲突优先级：`05` > `04` > `03` > `06`。

## 1. 核心数据实体

### 1.1 红蓝智能体（`cyber-studio.ts`）

```ts
interface CyberAgent {
  id: string            // 唯一标识（如 red-commander）
  name: string          // 智能体名
  group: 'red' | 'blue' // 阵营
  icon: string          // 画布图标
  role: string          // 角色定位
  description: string   // 职责描述
  systemPrompt: string  // 系统提示（硬约束）
  skills: string[]      // CTF 技能（ctf-*）
  steps: string[]       // 工作步骤
  position: { x: number; y: number }  // 画布坐标
}
interface CyberAgentEdge { id: string; source: string; target: string }
```

### 1.2 授权任务（复用 Kanban）

| 字段 | 约束 |
| --- | --- |
| 任务正文 `body` | **必须包含 `AUTHORIZED_SECURITY_TEST`**，否则不发起执行 |
| 看板 | 红蓝队任务板（红队验证 / 蓝队研判处置） |

### 1.3 攻击链 / 事件报告（客户端实时生成）

| 实体 | 数据来源 | 约束 |
| --- | --- | --- |
| 攻击链 | 当前任务真实消息、工具调用、执行记录 | 无证据不补链；未知环节显式标注 |
| 事件报告 | 任务、会话、智能体结果、证据引用 | 汇总后导出 `{taskId}-incident-report.json` |

## 2. API 契约

| 接口 | 说明 |
| --- | --- |
| `runCyberDefenseChat` | 红蓝任务内安全问答（`api/hermes/cyber-defense`） |
| `listBoards / listTasks / getTask` | 授权任务（Kanban） |
| `fetchSession / fetchConversationSummaries` | 会话与摘要 |
| `fetchSkills / fetchSkillUsageStats` | CTF 技能与使用统计 |
| `listWorkflows / createWorkflow` | 智能体编排同步到工作流 |

## 3. 冻结原则

| 项 | 冻结规则 |
| --- | --- |
| 授权标记 | `AUTHORIZED_SECURITY_TEST` 语义不变 |
| 智能体 schema | `id / group / skills / systemPrompt` 结构不变，只增不改 |
| 编排连线 | edges 的 `source / target` 语义不变 |
| 攻击链 / 报告字段 | 字段名不变，只增可选字段 |
| 端口 | 前端 8659 / 后端 8657 不变 |
| 凭证 | Token / Key 不下前端 |

## 4. 智能体→工作流映射

编排画布的 11 节点 + 12 连线同步到工作流（`createWorkflow`），节点对应智能体，连线对应 `CyberAgentEdge`。同步后可在底座工作流画布继续编辑。
