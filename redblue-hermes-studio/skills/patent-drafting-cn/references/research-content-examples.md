# 研究内容 Examples at Different Verbosity Levels

## Topic: 服务类AI场景评估用例及评测数据集构建

### Level 1: Detailed (user said "内容太多了")
Too long — 2 long paragraphs with tables and technical jargon. User rejected.

### Level 2: Moderate (user said "简单点 不要太复杂")
> **一、评估用例体系设计。** 面向客服应答、业务咨询、投诉处理等典型服务场景，设计分层分类的评估用例：按交互模式分为单轮问答、多轮对话两类；按难度分为基础查询、复杂推理、异常兜底三级，每个用例包含输入query、期望行为、关键约束和评判标准，覆盖服务全链路。
>
> **二、评测数据集构建。** 采用"真实数据脱敏+LLM合成增强"的混合策略：从生产环境采样真实服务对话脱敏后作为种子数据，利用进化策略生成多难度梯度的合成用例，构建包含正例、负例和兜底例的均衡数据集，通过知识覆盖矩阵确保各业务域覆盖完整。

### Level 3: Simple (user said "再简单点") ← SWEET SPOT for first draft
> **一、评估用例体系设计。** 面向客服应答、业务咨询、投诉处理等典型服务场景，设计分层评估用例，覆盖单轮问答与多轮对话两种交互模式，每个用例包含输入query、期望行为、约束条件和评判标准。
>
> **二、评测数据集构建。** 从生产环境采样真实服务对话脱敏后作为种子数据，利用LLM合成增强生成多难度梯度的评估用例，构建覆盖正例、负例和兜底例的均衡数据集。

---

## Topic: 可信评估方案与指标体系设计

### Accepted version (4 points, moderate detail):
> **一、多层次指标体系构建。** 将LLM应用拆解为检索、推理、生成三个环节分别定义评估维度：检索环节评估上下文相关性和召回率，推理环节评估逻辑一致性和多步推理准确率，生成环节评估事实忠实度、回答相关性和幻觉率，同时纳入安全维度（Prompt注入成功率、隐私泄露率），形成覆盖准确性-一致性-安全性的完整指标树。
>
> **二、基于DAG的结构化评估方法。** 采用Deep Acyclic Graph范式将评估标准分解为有向无环图中的子节点，每个叶节点对应可独立计算的子指标，通过加权聚合得到最终可信评分；结合LLM-as-a-Judge技术实现语义层面的自动化评分，并引入多评委贝叶斯校准机制降低单一评估模型的系统性偏差。
>
> **三、三层评估闭环机制。** 设计离线、在线、对抗三层评估体系：离线层基于Golden Dataset做回归测试防止质量退化；在线层通过生产流量采样实现实时监控，采用自适应采样策略平衡成本与覆盖度；对抗层通过自动化Red-Testing覆盖越狱、注入、隐私泄露等安全威胁。
>
> **四、可解释归因与持续优化。** 基于评估历史的趋势分析与异常聚类自动识别质量下降并定位根因，将评估指标接入CI/CD流水线作为质量门禁，生成可解释诊断报告指出扣分环节与改进方向，构建"发现问题→定位根因→指导优化"的持续改进闭环。

---

## Pattern Summary

| User signal | Action |
|-------------|--------|
| "写详细点" | 4-5 sentences per point, include specific techniques/metrics |
| "简单点" / default | 2-3 sentences per point |
| "再简单点" | 1-2 sentences per point, bare essentials |
| "换一个说法" | Same length, rephrase with different framing |
| "不要文档，直接写" | Inline text, no file generation |
| "分N点" | Exactly N points, no more no less |
