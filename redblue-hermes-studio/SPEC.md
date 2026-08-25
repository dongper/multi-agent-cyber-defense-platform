# SPEC — 红蓝协同智能安全运营平台（Red-Blue Collaborative Security Operations Platform）

> 本文件是 `redblue-hermes-studio` 项目的规格概要（spec-driven 开发入口）。详细需求见 `docs/开发需求文档.md`，分模块规格见 `docs/SPEC/00–07`。

## 1. 项目概述

红蓝协同智能安全运营平台是基于 Hermes Studio（`hermes-web-ui`）定制的**红蓝对抗安全运营**平台。它在 Hermes Agent 多智能体底座之上，新增「红队攻击验证 + 蓝队研判处置」的安全运营工作台，通过 11 个红蓝智能体的编排协作，完成授权安全任务、攻击链分析与事件报告。

一句话定位：一个内建**授权边界**的、红蓝协同的多智能体安全运营平台，复用 Hermes 的会话 / 看板 / 技能 / 工作流能力，面向 CTF 与授权安全测试场景。

## 2. 目标

- **红蓝协同**：红队负责攻击验证与证据校验，蓝队负责研判、溯源与处置建议，形成闭环。
- **证据优先**：攻击链分析与事件报告只基于真实会话、工具调用与执行记录，无证据不推测补链。
- **授权可控**：红队执行只面向带 `AUTHORIZED_SECURITY_TEST` 标记的授权任务，否则不发起执行。
- **复用底座**：任务走 Kanban、问答走会话、技能走 CTF Skills、编排同步到工作流画布。

## 3. 架构总览

```text
/security-operations（CyberDefenseView，Vue）
   ├── 态势总览 ──┐
   ├── 任务中心 ──┼── 复用 Hermes API：kanban / sessions / skills / workflows / conversations
   ├── 智能体编排 ─┤      + 专属 API：api/hermes/cyber-defense（runCyberDefenseChat）
   ├── 攻击链分析 ─┘
   └── 事件报告
        │
Koa 后端（Hermes Studio 底座：路由 / 控制器 / 服务 / SQLite）
        │
Hermes Agent 运行时（多智能体 + CTF Skills）
```

红蓝编排链路（`cyber-studio.ts`）：

```text
红队：任务指挥官 → {Web 风险验证 / 二进制分析 / 密码分析} → 证据校验
                              │
蓝队：事件指挥官 → 告警研判 → 日志关联 → {恶意样本分析 / 攻击路径还原} → 处置建议
```

## 4. 技术栈

同 Hermes Studio：Vue 3 · TypeScript · Vite · Koa · Socket.IO · SQLite · Electron · Python（Hermes runtime）。红蓝工作台基于 Naive UI + Vue Flow，无新增 UI 库。

## 5. 模块清单

| 模块 | 位置 | 职责 |
| --- | --- | --- |
| 安全运营视图 | `packages/client/src/views/hermes/CyberDefenseView.vue` | 5 个 Tab 的入口与数据装配 |
| 任务工作台 | `components/hermes/cyber-defense/CyberTaskWorkspace.vue` | 授权任务、问答、技能编排 |
| 智能体编排画布 | `components/hermes/cyber-defense/CyberAgentStudio.vue` | 11 智能体拖拽连线 |
| 智能体定义 | `components/hermes/cyber-defense/cyber-studio.ts` | 红蓝智能体 + 连线（edges） |
| 专属 API | `api/hermes/cyber-defense` | `runCyberDefenseChat` |
| 国际化 | `i18n/cyber-defense.ts` + `locales/zh.ts` | 红蓝文案与「红蓝协同智能安全运营平台」改名 |

## 6. 十一智能体

| 阵营 | 智能体 | 职责 |
| --- | --- | --- |
| 红 | 红队任务指挥官 | 授权校验、任务拆解与调度 |
| 红 | Web 风险验证 Agent | Web / API 风险验证 |
| 红 | 二进制分析 Agent | Pwn 与逆向分析 |
| 红 | 密码分析 Agent | 密码机制与数学分析 |
| 红 | 红队证据校验 Agent | 证据完整性与结论复核 |
| 蓝 | 蓝队事件指挥官 | 事件分级与研判调度 |
| 蓝 | 告警研判 Agent | 真实性、影响与优先级判断 |
| 蓝 | 日志关联 Agent | 多源日志与时间线关联 |
| 蓝 | 恶意样本分析 Agent | 样本行为与流量分析 |
| 蓝 | 攻击路径还原 Agent | 基于证据构建最小可信链路 |
| 蓝 | 处置建议 Agent | 控制、修复与监测建议 |

CTF 技能：`ctf-web / ctf-pwn / ctf-reverse / ctf-crypto / ctf-forensics / ctf-osint / ctf-malware / ctf-hub / ctf-misc / ctf-writeup`。

## 7. 安全边界

1. 红队执行只面向明确授权的安全测试任务；任务正文必须包含 `AUTHORIZED_SECURITY_TEST`，否则界面不发起执行。
2. 攻击链分析只基于当前任务的真实消息、工具调用与执行记录，未知环节显式标注、不推测补链。
3. 处置建议默认不执行生产变更，涉及生产变更须人工审批。
4. 各智能体 systemPrompt 均强制「区分事实 / 假设 / 待确认」。

## 8. 启动与命令

```bash
npm run dev:redblue                 # 前端 8659 + 后端 8657 联调
# 访问 http://127.0.0.1:8659/#/security-operations
npm run test                        # Vitest
npm run build                       # 类型检查 + 构建
```
