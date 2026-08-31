---
name: openclaw
description: Manage OpenClaw CLI — skills install/search, config fixes, plugin management. OpenClaw is a separate AI agent platform (like Hermes) with its own skills ecosystem (ClawHub).
tags: [openclaw, skills, clawhub, ai-agent, security-skills]
triggers:
  - user mentions openclaw or ClawHub
  - user asks to install/search OpenClaw skills
  - openclaw CLI commands or config issues
---

# OpenClaw CLI Management

OpenClaw is a separate AI agent platform installed on this machine. It has its own skills system, plugins, gateway, and config — completely independent from Hermes.

## Key Paths

| Item | Path |
|------|------|
| Config | `~/.openclaw/openclaw.json` |
| Workspace skills | `~/.openclaw/workspace/skills/` |
| Extensions | `~/.openclaw/extensions/` |
| Disabled extensions | `~/.openclaw/extensions-disabled/` |
| Global npm plugins | `~/.openclaw/npm/node_modules/` |
| Logs | `/tmp/openclaw/` and `~/.openclaw/logs/` |

## Skills Management

```bash
# Search ClawHub for skills by keyword
openclaw skills search "keyword"

# Install a skill (exact name from search results)
openclaw skills install <skill-name>

# List all installed/available skills with status
openclaw skills list

# Check which skills are ready vs missing requirements
openclaw skills check

# Show detailed info about a specific skill
openclaw skills info <skill-name>

# Update installed ClawHub skills
openclaw skills update
```

**Skill statuses:**
- `✓ ready` — usable now
- `△ needs setup` — missing a binary, env var, or config

## Config Troubleshooting

### thinkingFormat validation error

**Symptom:** `models.providers.bailian.models.N.compat.thinkingFormat: Invalid input`

**Allowed values:** `"openai"`, `"openrouter"`, `"deepseek"`, `"zai"`

**Fix:** Edit `~/.openclaw/openclaw.json`, change `"qwen"` to `"openai"` for all affected models:

```python
import json
with open('/Users/zhangrunmin/.openclaw/openclaw.json', 'r') as f:
    config = json.load(f)
for m in config.get('models',{}).get('providers',{}).get('bailian',{}).get('models',[]):
    if m.get('compat',{}).get('thinkingFormat') == 'qwen':
        m['compat']['thinkingFormat'] = 'openai'
with open('/Users/zhangrunmin/.openclaw/openclaw.json', 'w') as f:
    json.dump(config, f, indent=2)
```

### General config repair

```bash
openclaw doctor --fix
```

Note: `doctor --fix` auto-disables skills with missing requirements and refreshes plugin registry, but does NOT fix schema validation errors in model configs.

## Gateway

```bash
openclaw gateway start/stop/restart/status
openclaw gateway install --force   # reinstall launchd service
```

## Pitfalls

1. **Hermes ≠ OpenClaw** — They are separate systems with separate skills, configs, and gateways. Don't confuse `~/.hermes/skills/` (Hermes) with `~/.openclaw/workspace/skills/` (OpenClaw).
2. **Skills search names ≠ install names** — `skills search` returns display names; use the exact skill identifier for `skills install`.
3. **Config validation blocks all commands** — If `openclaw.json` has schema errors, even `skills list` fails. Fix config first.
4. **Batch install pattern** — Use a loop for multiple installs:
   ```bash
   for skill in skill1 skill2 skill3; do
     openclaw skills install "$skill" 2>&1 | tail -1
   done
   ```
5. **Plugin warnings are non-fatal** — TypeScript compilation warnings for gewe-openclaw/weixin plugins don't block skill operations.
