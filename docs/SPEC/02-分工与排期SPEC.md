# 02-分工与排期 SPEC

## 1. 拆分原则：按依赖边界，不按功能模块

五人同时开发，最怕 A 等 B 接口、C 等 B 数据、D 等 B 的设备通道。因此本期按 **依赖边界** 拆分，核心原则：`05-数据模型与API契约SPEC.md` Day0 冻结，B 先给稳定 response shape，A/C/D 不等真实数据全部接完。

```text
A（前端）  <->  B（后端/存储）      REST + Socket.IO
B（后端）  <->  C（智能体运行时）   service 函数
B（后端）  <->  D（硬件）           MCU 上行/下行协议 + 固件
C（智能体）<->  Hermes Agent        bridge
E（桌面）  <->  全部                打包 / 运行时 / CI
```

边界定死：A 只调 `/api/*`；B 只做路由 / 存储 / 编排并调用 C、D 的 service；C 只接收请求并返回分析 / 工具结果；D 只负责固件与设备侧协议；E 只负责桌面打包、运行时版本与发布。

## 2. 五人 Owner

| 负责人 | 真正 Owner | 不负责 |
| --- | --- | --- |
| A 前端负责人 | 页面、交互、错误态、i18n、API client | 后端逻辑、智能体算法、固件 |
| B 后端 / API / 存储负责人 | Koa 路由、控制器、服务、SQLite、认证、编排 | Prompt、页面展示、固件 |
| C 智能体运行时负责人 | Ekko Agent、Hermes 集成、群聊 / Coding Agents、模型 provider | 路由、页面、硬件 |
| D 硬件 / 设备负责人 | ESP32-C3 固件、设备发现 / 配对 / 中继 / OTA、MCU 协议 | 前端、智能体算法 |
| E 桌面端 / 发布负责人 | Electron、运行时打包、自动更新、CI/CD、技能包 | 业务路由、智能体逻辑 |

一句话：B 负责「数据能来能存」，C 负责「数据能分析能执行」，A 负责「用户看得懂能操作」，D 负责「设备能连能说」，E 负责「产物能装能升级」。

## 3. 固定目录边界

| 人员 | 只改这些目录 | 说明 |
| --- | --- | --- |
| A | `packages/client/src` | 页面、组件、Pinia、i18n、API client、types |
| B | `packages/server/src/{routes,controllers,services,db,middleware}`（不含设备/智能体专属） | 路由注册、SQLite、认证由 B 负责 |
| C | `packages/ekko-agent/src`、`packages/server/src/services/{hermes,ekko-agent,global-agent,coding-agents}` | 新能力通过 service 函数暴露给 B |
| D | `packages/esp32-c3`、`packages/server/src/services/{device-pairing-code,lan-*,mcu-*}`、`routes/{devices,mcu-*}` | 设备侧协议与固件 |
| E | `packages/desktop`、`packages/skills`、`.github/workflows`、`scripts/` | 打包 / 发布 / 技能包 |

A 不直接碰密钥；C 不直接读 SQLite；D 不写前端；B 不写 Prompt；E 不改业务路由。

## 4. Day0（8/24 一）：冻结契约

如果只有一次短会，只冻结这些：

1. API 路由不改名。
2. JSON key 不改名。
3. 会话 / 消息 / 工作流 / 设备 / 用量核心 schema 冻结（见 `05`）。
4. Socket.IO 事件名与命名空间冻结。
5. MCU 上行（ADPCM 语音）与下行（TTS / 命令）协议冻结。
6. 凭证只在后端；前端不接触 Token / Key。
7. Hermes / Ekko / Coding Agent 三者的调用边界冻结。

Day0 最重要产物：

| 产物 | 负责人 | 验收 |
| --- | --- | --- |
| API response shape | B | 至少给出 system / sessions / workflow 的固定 shape |
| 前端 types | A | 按 05 输出 `packages/client/src/types` 草案 |
| Ekko service 签名 | C | `packages/ekko-agent/src/index.ts` 暴露接口初稿 |
| MCU 协议文档 | D | 上行 / 下行字段、配对码、OTA 清单 |
| 运行时版本 pin | E | `packages/desktop/scripts/runtime-config.mjs` 固定 ref + commit |

## 5. Day1–2（8/25–26 二·三）：最小链路

目标：打通「前端 → 后端 → Agent → 返回」与「设备配网 → 语音」两条最小链路。

### A Day1–2
1. Vue 路由与全局布局；2. 聊天页 skeleton；3. API client 封装；4. 前端 types 对齐 05；5. 系统状态条。
**验收**：页面可打开，能调 `/api/health`、能发起一次会话。

### B Day1–2
1. Koa app 与路由注册；2. SQLite 初始化；3. `/api/health`、`/api/auth/*`；4. 会话 / 消息最小 API；5. Socket.IO `/chat-run` 骨架；6. 稳定 response shape。
**验收**：`npm run dev` 可启动；会话可创建并落库；`/chat-run` 能握手。

### C Day1–2
1. Ekko service 初版；2. 模型 provider 最小接入（OpenAI-compatible）；3. 工具注册骨架（approval / clarify）；4. 与 B 的 service 契约。
**验收**：B 用假请求调 C，能返回结构化结果。

### D Day1–2
1. v1 配网固件可烧录；2. 设备发现 + 配对码服务；3. MCU 上行通道打通；4. 协议文档交付。
**验收**：设备能配网、能被服务端发现、能上行一条语音。

### E Day1–2
1. 桌面 dev 启动脚本；2. 运行时 prepare 流程跑通；3. CI build 流水线绿。
**验收**：`npm run desktop:dev` 能起桌面壳。

## 6. Day3–5（8/27–29 四·五·六）：核心能力

- A：聊天完整交互（流式渲染、工具轨迹、文件预览）、工作流画布、模型 / 设置页。
- B：工作流 / 定时任务 / Kanban / 平台渠道 API、用量统计、认证完善。
- C：Ekko 记忆、多模型 provider、browser / code-exec 工具、群聊智能体。
- D：v2 音频调优、TTS 下行、OTA、远程中继。
- E：自动更新、桌面打包脚本、技能包接入。

## 7. Day6–7（8/30–31 日·一）：联调集成

- A：错误态 / 空态 / 降级态、跨页面一致性。
- B：契约一致性、脱敏、异常兜底。
- C：Prompt 稳定性、工具超时、模型切换。
- D：断连重连、音量 / 增益、固件稳定性。
- E：三平台打包冒烟、更新器验证。
- 每日晚上跑 Demo 路径连续 2 次。

## 8. Day8（9/1 二）：演示·验收·提交

1. 5 分钟 Demo 路径连跑 2 次。
2. 对照 `07` 验收清单逐项打勾。
3. 录制 / 截图归档。
4. 提交比赛材料。

## 9. 每天同步方式

每天两个短会，不做泛泛进展会。

### 上午 15 分钟
1. 今天主链路阻塞是什么？2. API shape / 协议有没有变化？3. Demo 路径走到哪一步？4. 有没有字段要加成 optional？

### 晚上 30 分钟
只验收：本地能否启动？页面能否打开？会话能否流式对话？工作流能否执行？设备能否语音交互？重启后数据是否仍在？

## 10. 最小成功版本

时间炸了只保：启动 + 流式聊天 + 会话持久化 + 工具轨迹 + 模型配置（凭证安全）+ TTS/STT（或录制演示）。
