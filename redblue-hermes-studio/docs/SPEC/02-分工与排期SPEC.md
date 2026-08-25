# 02-分工与排期 SPEC

## 1. 拆分原则：按依赖边界，不按功能模块

红蓝平台复用 Hermes 底座，新增的是「安全运营工作台」这一层。拆分重点在：谁定义智能体、谁接数据、谁画界面、谁做分析、谁打包，避免互相等待。

```text
A（前端/交互）  <->  B（后端/底座）    REST + Socket.IO（复用 Hermes API）
B（后端/底座）  <->  C（智能体定义）   systemPrompt / skills / 编排数据
C（智能体）     <->  D（分析引擎）     智能体结果 → 攻击链 / 报告
D（分析引擎）   <->  A                 分析结果 → 界面展示
E（桌面/发布）  <->  全部              环境 / 端口 / 打包 / CI
```

## 2. 五人 Owner

| 负责人 | 真正 Owner | 不负责 |
| --- | --- | --- |
| A 前端 / 交互负责人 | 5 Tab UI、cyber-defense 组件、i18n、错误态 | 智能体逻辑、后端、分析算法 |
| B 后端 / 底座负责人 | cyber-defense API、Kanban / Sessions / Skills / Workflows 数据接口 | 页面、智能体定义、分析 |
| C 智能体设计负责人 | 11 智能体定义（systemPrompt / skills / steps）、CTF 技能映射、编排同步 | 路由、页面、硬件 |
| D 分析引擎负责人 | 攻击链分析、事件报告、证据关联（真实会话 / 工具记录） | 路由、页面骨架、智能体定义 |
| E 桌面 / 发布负责人 | `dev:redblue` 环境、端口隔离、打包、CI/CD | 业务路由、智能体逻辑 |

一句话：B 负责「数据能来能存」，C 负责「智能体能想能做」，D 负责「结论有据可查」，A 负责「用户看得懂能操作」，E 负责「环境能起能发」。

## 3. 固定目录边界

| 人员 | 只改这些目录 |
| --- | --- |
| A | `packages/client/src/views/hermes/CyberDefenseView.vue`、`components/hermes/cyber-defense/{CyberTaskWorkspace,CyberAgentStudio}.vue`、`i18n/cyber-defense.ts` |
| B | `packages/client/src/api/hermes/cyber-defense`、`packages/server/src/routes`（底座数据接口） |
| C | `packages/client/src/components/hermes/cyber-defense/cyber-studio.ts`、CTF skills 映射 |
| D | `CyberDefenseView.vue` 中的攻击链 / 报告逻辑、`CyberTaskWorkspace.vue` 的证据装配 |
| E | `package.json`（dev:redblue 脚本）、`packages/desktop`、`.github/workflows` |

A/C/D 均只碰前端；B 只碰底座接口；C 不写路由；D 不定义智能体；E 不改业务。

## 4. Day0（8/24 一）：冻结契约

1. 授权标记字段 `AUTHORIZED_SECURITY_TEST` 语义冻结。
2. 11 智能体的 `id / group / skills / systemPrompt` 结构冻结（见 `06`）。
3. 红蓝编排连线（edges）与工作流同步映射冻结。
4. 攻击链 / 报告的字段结构冻结（见 `05`）。
5. 端口约定冻结（前端 8659 / 后端 8657）。

Day0 产物：

| 产物 | 负责人 | 验收 |
| --- | --- | --- |
| 智能体 schema | C | `cyber-studio.ts` 类型初稿 |
| 攻击链 / 报告 schema | D | 字段与证据引用结构 |
| 前端 5 Tab 骨架 | A | `/security-operations` 路由可进 |
| cyber-defense API 契约 | B | `runCyberDefenseChat` 请求 / 响应 shape |
| dev:redblue 环境 | E | 双端口联调可启动 |

## 5. Day1–2（8/25–26 二·三）：最小链路

- A：5 Tab 骨架 + 任务中心（创建任务 + 授权拦截）。
- B：cyber-defense API 打通；Kanban / Sessions / Skills 数据接出。
- C：11 智能体定义落地；编排数据可加载。
- D：攻击链最小版（基于真实消息列表，不推断）。
- E：`dev:redblue` 稳定、前端 8659 / 后端 8657 联调。
**验收**：能创建授权任务、任务内问答、编排画布显示 11 智能体。

## 6. Day3–5（8/27–29 四·五·六）：核心能力

- A：态势总览实时指标、智能体编排拖拽连线、错误态 / 空态。
- B：技能使用统计、编排同步工作流、会话数据聚合。
- C：systemPrompt 调优、CTF 技能映射完整、红蓝链路串联。
- D：攻击链证据关联、事件报告汇总与 JSON 导出。
- E：桌面打包冒烟、CI 绿。

## 7. Day6–7（8/30–31 日·一）：联调集成

- A：跨 Tab 一致性与空态兜底。
- B：契约一致性、授权校验边界。
- C：智能体结论可复核（事实 / 假设 / 待确认）。
- D：攻击链无证据不补链、报告证据引用完整。
- E：三平台打包 + 更新器验证。
- 每晚跑 Demo 路径连续 2 次。

## 8. Day8（9/1 二）：演示·验收·提交

1. 5 分钟 Demo 路径连跑 2 次。
2. 对照 `07` 逐项打勾。
3. 录制 / 截图归档。
4. 提交比赛材料。

## 9. 每天同步方式

上午 15 分钟问：主链路阻塞？API / schema 有无变化？授权边界是否被绕过？要不要加 optional 字段？
晚上 30 分钟只验收：能启动？能建授权任务？编排能连？攻击链有据？报告能导出？

## 10. 最小成功版本

时间炸了只保：授权任务 + 授权拦截 + 红蓝主链路智能体 + 攻击链（真实数据）+ 报告导出。
