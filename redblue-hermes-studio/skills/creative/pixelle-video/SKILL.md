---
name: pixelle-video
description: Configure and run Pixelle-Video (AIDC-AI) — an AI automated short video generation platform. Covers LLM configuration (any OpenAI-compatible provider), ComfyUI/RunningHub setup, TTS, and template selection. Includes known pitfalls and verification steps.
tags: ["video-generation", "ai-video", "comfyui", "llm-config", "short-video", "pixelle", "streamlit"]
---

# Pixelle-Video Configuration & Setup

Pixelle-Video (github.com/AIDC-AI/Pixelle-Video) is an AI automated short video generation platform with a Streamlit Web UI. It uses an LLM for content/script generation, ComfyUI or RunningHub for image/video generation, and Edge TTS for voice synthesis.

## Prerequisites

- Repo cloned locally
- Python environment set up (`.venv` directory typically present)
- Project started (`streamlit run web/pages/1_🎬_Home.py` or similar)
- Web UI accessible at http://localhost:8501/

## LLM Configuration

### config.yaml (preferred)

Copy `config.example.yaml` to `config.yaml` in the project root. The LLM section:

```yaml
llm:
  api_key: "YOUR_API_KEY"
  base_url: "https://your-provider.com/v1"
  model: "your-model-name"
```

Pixelle-Video uses `openai.AsyncOpenAI` under the hood (`pixelle_video/services/llm_service.py`), so **any OpenAI SDK compatible provider works**.

### Popular provider presets

| Provider | base_url | model example |
|----------|----------|---------------|
| 通义千问 DashScope | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-max` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` |
| Ollama (local) | `http://localhost:11434/v1` | `llama3.2` |

### Web UI configuration

1. Open http://localhost:8501/
2. Expand "⚙️ 系统配置（必需）" section
3. Set 快速选择 to "Custom"
4. Fill in API Key, Base URL
5. In 自定义模型名称, enter the model name (e.g., `qwen3.5-plus`)
6. Click "💾 保存配置"

### Verification

**Do NOT rely on the Web UI's "🔌 测试" button alone** — it can produce false negatives for custom API endpoints. The test endpoint it probes may differ from the actual `/chat/completions` path used at runtime.

Instead, verify with curl:

```bash
curl -s 'https://your-base-url/v1/chat/completions' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{"model":"your-model","messages":[{"role":"user","content":"hello"}],"max_tokens":10}'
```

HTTP 200 with a valid response = working.

## ComfyUI Configuration

Two options: local ComfyUI or RunningHub cloud.

### Local ComfyUI
- Install and start ComfyUI (default: `http://127.0.0.1:8188`)
- Fill in the ComfyUI 服务器地址 field
- Click "测试连接" to verify

### RunningHub (cloud, no GPU needed)
- Register at runninghub.cn
- Get API Key
- Fill in RunningHub API 密钥
- Set 并发限制 (1 for regular members)
- Set 机器规格 (24G or 48G VRAM)

## TTS Configuration

Default: Edge TTS (local synthesis, no GPU needed, just needs network).
Options: 本地合成 (Edge TTS) or ComfyUI 合成.

## Template Configuration

Templates determine video aspect ratio:
- `1080x1920`: vertical/portrait (Douyin, Reels, Shorts)
- `1920x1080`: horizontal/landscape
- `1080x1080`: square

Template types:
- `static_*.html`: text-only, fastest, no ComfyUI needed
- `image_*.html`: requires AI-generated images
- `video_*.html`: requires AI-generated videos

Default: `1080x1920/image_default.html`

## Known Pitfalls

### Web UI test button false negatives
The "🔌 测试" button may fail for valid custom endpoints because it probes a different path than the actual LLM runtime call. Always verify with curl if the test fails but you believe the config is correct.

### Alibaba Coding Plan usage restriction
Coding Plan API Keys are officially restricted to AI programming tools only (Claude Code, OpenClaw, etc.). Using them with Pixelle-Video violates the terms of service and may result in account suspension. Use standard DashScope API Keys instead for production use.

### config.yaml hot reload
The LLM service reads config dynamically from config_manager for hot reload support. Changes to config.yaml take effect on the next LLM call without restarting the app.

### Docker users
If running in Docker, use `host.docker.internal:8188` (Mac/Windows) or host IP (Linux) for the ComfyUI URL.

## Alibaba Coding Plan

For details on Alibaba Cloud Coding Plan API endpoints, models, and usage restrictions, see `references/alibaba-coding-plan.md`.

## Directory Structure

- `config.example.yaml` — template config
- `config.yaml` — your actual config (never commit)
- `web/pages/1_🎬_Home.py` — main Streamlit page
- `pixelle_video/services/llm_service.py` — LLM service (OpenAI SDK)
- `workflows/selfhost/*.json` — local ComfyUI workflows
- `workflows/runninghub/*.json` — cloud RunningHub workflows
- `templates/` — video frame templates
