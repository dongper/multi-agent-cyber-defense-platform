# Local Inference Backend Cheatsheets

Concrete configs for the common OpenAI-compatible local servers, plus pitfalls and probe recipes verified against a real install.

## Ollama (verified 2026-06)

### Install + status

```bash
brew install ollama                 # macOS
# Server runs as a launchctl service from /Applications/Ollama.app
pgrep -fl ollama
ollama list
```

### config.yaml block (Hermes Studio auto-writes this)

```yaml
providers:
  ollama:
    api_key: ollama
    base_url: http://localhost:11434/v1
    models:
    - qwen2.5-coder:14b
```

### Endpoints

| Path | Purpose |
|---|---|
| `http://localhost:11434/v1/chat/completions` | OpenAI-compatible (use for Hermes) |
| `http://localhost:11434/api/tags` | Ollama native — model list + capabilities + ctx |
| `http://localhost:11434/api/generate` | Ollama native completion |

### Probe recipe (use background=true in Hermes)

```bash
curl -s -o /tmp/probe.json -w 'HTTP=%{http_code} TIME=%{time_total}s\n' \
  http://localhost:11434/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen2.5-coder:14b","messages":[{"role":"user","content":"hi"}],"stream":false,"max_tokens":20}'
```

Expected on Apple Silicon M-series, 14B Q4_K_M, cold: ~10-15s. Warm: ~1-3s for short replies.

### Capability inspection

```bash
curl -s http://localhost:11434/api/tags | python3 -m json.tool
```

Look for:
- `capabilities` — must include `"tools"` for agent use
- `details.context_length` — typical: 32K for most models, larger for Qwen3 / Gemma2
- `details.quantization_level` — Q4_K_M is the standard speed/quality compromise

### Best models per machine (rough guide)

| Hardware | Recommended | Size |
|---|---|---|
| Apple M5 16GB | `qwen2.5-coder:14b` Q4_K_M | 9 GB |
| Apple M4 Pro 24GB | `qwen2.5-coder:32b` Q4 / `qwen3:30b` | 18-20 GB |
| Apple M-series 8GB | `qwen2.5-coder:7b` Q4 / `qwen3:4b` | 4-5 GB |
| NVIDIA 24GB+ | `qwen2.5-coder:32b` Q4 / `deepseek-coder-v2:16b` | 18-20 GB |

For CTF / quick on-site work where speed matters more than depth, pull the smaller variant too — 7B answers in 1-2s on M-series.

## LM Studio

Default port `1234`. Same OpenAI-compatible shape:

```yaml
providers:
  lmstudio:
    api_key: lm-studio
    base_url: http://localhost:1234/v1
    models:
    - <whatever-the-loaded-model-id-is>
```

Pitfall: LM Studio requires a model to be **loaded** in the GUI before `/v1/models` returns anything. Probe `/v1/models` first to see what's available, don't trust config.

## vLLM / llama.cpp server

User-defined port, commonly `:8000`. Same shape; `api_key` may matter if launched with `--api-key`. Example for vLLM:

```bash
# Launch
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-Coder-14B-Instruct \
  --port 8000

# Hermes block
providers:
  vllm-local:
    api_key: dummy
    base_url: http://localhost:8000/v1
    models:
    - Qwen/Qwen2.5-Coder-14B-Instruct
```

Pitfall: vLLM expects the **full HF model ID** as the `model` field, not a friendly name.

## Common pitfalls across all local backends

### Cold-start blocking the agent

First request to any local model can take 5-30s as weights page into VRAM/unified memory. The Hermes `terminal` tool's foreground mode can flag this as a stuck command. **Always use** `terminal(background=true, notify_on_complete=true)` for the first probe, then `process(action='wait')`. Three foreground retries will trip the same-tool-failure guardrail.

### Hermes' nested-key config quirk

`model` in config.yaml is a dict. Setting `model.default` and `model.provider` separately via `hermes config set` does NOT reliably persist both — sometimes the second write clobbers the first into a string. Always pass the whole dict as JSON:

```bash
hermes config set model '{"default": "qwen2.5-coder:14b", "provider": "ollama"}'
```

### Active session doesn't pick up the change

The currently-running `hermes` chat has the model baked into its system prompt. After switching, the user must start a fresh `hermes` invocation. Say this out loud or they'll think your config edit was a no-op.

### Switching back to cloud

Save the old config block before changing, or just keep a one-liner handy:

```bash
# Common: switch back to MiniMax-M3 via custom proxy (this user's prior default)
hermes config set model '{"default": "MiniMax-M3", "provider": "custom:cehwa_glm"}'

# Or back to xiaomi:
hermes config set model '{"default": "mimo-v2.5-pro", "provider": "xiaomi"}'
```

### Tool-use reliability is lower

Even tool-capable local models (Qwen2.5-Coder 14B has `"tools"` in capabilities) make more tool-calling mistakes than cloud frontier models. Expect occasional malformed JSON args and wrong tool selection. For complex multi-step work (real coding, kanban orchestration, deep research) stay on cloud; for quick scripted help, local is fine.
