# 06-多智能体角色与 Prompt SPEC

## 1. 多智能体角色

| 智能体 | 角色 | 职责边界 |
| --- | --- | --- |
| Hermes Agent | 核心对话 / 工具调用 Agent（Python 运行时） | 工作区、记忆、技能、插件、凭证 |
| Ekko Agent | 自托管浏览器 / 设备 Agent（TS 运行时） | 网页浏览、编码执行、审批澄清、自有记忆 |
| Coding Agents | Codex / Claude Code / OpenCode 编码代理 | 编码任务，经代理路由接入 |
| 群聊智能体 | 群聊房间中的多智能体协作 | 提及路由、房间级工作区 |

## 2. Ekko Agent 架构（`packages/ekko-agent`）

```
ekko-agent/
├── config.ts            运行时配置
├── database.ts          本地持久化
├── memory/              记忆：context / extraction / retrieval / schema / service / store / tools
├── model/               模型：registry + providers（anthropic / gemini / openai-compatible /
│                        openai-responses / prompt-completion / custom-runtime）+ tokens
├── runtime/             运行时：events / runtime / system-prompt / types
├── tools/               工具：approval / browser / clarify / code-exec
└── skills/              技能：review + 类型定义
```

### 2.1 记忆模块

- `extraction` 从对话提取记忆要点；`retrieval` 按相关性召回；`store` / `service` 负责持久化与查询。
- 记忆有 schema 约束，避免无结构写入。

### 2.2 模型模块

- 多 provider 注册表；支持 Anthropic / Gemini / OpenAI-compatible / OpenAI Responses / 自定义运行时。
- `authorized-providers` 控制可用 provider；`tokens` 做用量 / 上下文统计。

### 2.3 工具模块

| 工具 | 作用 |
| --- | --- |
| `browser` | 驱动浏览器（`agent-browser`）浏览与操作网页 |
| `code-exec` | 执行代码 |
| `clarify` | 需要澄清时向用户提问 |
| `approval` | 危险 / 敏感操作审批 |

## 3. Prompt 约定（通用硬性规则）

1. 只用输入上下文，不编造不存在的数据。
2. 缺失信息写 `unknown`。
3. 重要结论必须带证据 / 来源。
4. 输出合法 JSON（结构化场景）。
5. 不输出 `data_status`（该字段由后端设置）。

Ekko Agent 系统提示（`runtime/system-prompt.ts`）遵循上述规则，并约束工具调用边界与记忆写入。

## 4. 群聊多智能体约定

- 结构化提及协议路由到对应智能体。
- Agent 回复排除自身 participant ID，避免自我提及。
- 服务端自我提及拒绝作为防御边界。

## 5. Coding Agents 约定

- 经 `claude-code-proxy` / `codex-proxy` / `coding-agents` 路由接入。
- 支持 API 模式与工具事件；推理上下文与模型切换受控。
