# Alibaba Cloud Coding Plan API Details

Coding Plan is a flat-rate subscription for AI coding assistants, NOT a general-purpose API.

## OpenAI-Compatible Endpoint

- **Base URL**: `https://coding.dashscope.aliyuncs.com/v1`
- **Auth**: Coding Plan专属 API Key (from https://bailian.console.aliyun.com/cn-beijing/?tab=model#/efm/coding_plan)
- **Models available**: qwen3.5-plus, qwen3-coder, qwen3-coder-plus, glm-4.7, kimi-k2.5, minimax-m2.5 (varies by subscription tier)

## Anthropic-Compatible Endpoint

- **Base URL**: `https://coding.dashscope.aliyuncs.com/apps/anthropic`

## ⚠️ Usage Restrictions (IMPORTANT)

Official documentation states:

> 仅限在编程工具（如 Claude Code、OpenClaw 等）中使用，禁止以 API 调用的形式用于自动化脚本、自定义应用程序后端或任何非交互式批量调用场景。将套餐 API Key 用于允许范围之外的调用将被视为违规或滥用，可能会导致订阅被暂停或 API Key 被封禁。

Translation: Only for use in programming tools (Claude Code, OpenClaw, etc.). Prohibited for API calls in automation scripts, custom application backends, or any non-interactive batch calling scenarios. Violation may result in subscription suspension or API Key revocation.

## Alternative: Standard DashScope API

For general applications like Pixelle-Video, use the standard DashScope API:

- **Base URL**: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **Model**: `qwen-max`, `qwen-plus`, `qwen-turbo`, etc.
- **Billing**: Pay-per-token (very cheap for video generation: ~0.01-0.05 CNY per video)
- **Source**: https://bailian.console.aliyun.com/

## Verification Command

```bash
curl -s 'https://coding.dashscope.aliyuncs.com/v1/chat/completions' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_CODING_PLAN_KEY' \
  -d '{"model":"qwen3.5-plus","messages":[{"role":"user","content":"hello"}],"max_tokens":10}'
```
