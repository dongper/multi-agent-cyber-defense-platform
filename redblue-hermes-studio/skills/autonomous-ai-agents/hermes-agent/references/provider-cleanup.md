# Removing an Expired / Unwanted Provider

When a provider key expires or the user no longer wants a provider, clean up
**all three** locations — leaving stale entries causes confusing model lists.

## Three locations to check

| Location | What it holds | How to clean |
|----------|--------------|--------------|
| `~/.hermes/.env` | API keys (`DASHSCOPE_API_KEY`, etc.) and base URLs | `sed -i '' '/PATTERN/d' ~/.hermes/.env` |
| `~/.hermes/auth.json` → `credential_pool` | Managed credential entries (added via `hermes auth add`) | Python json edit — remove the matching keys |
| `~/.hermes/config.yaml` → `model`, `providers`, `openrouter`, etc. | Provider-specific config blocks, model overrides | `hermes config set` or manual edit |

## Step-by-step

```bash
# 1. Find all references
grep -rn -i "PROVIDER_NAME" ~/.hermes/.env ~/.hermes/auth.json ~/.hermes/config.yaml

# 2. Remove env vars from .env
sed -i '' '/^DASHSCOPE_API_KEY=/d; /^DASHSCOPE_BASE_URL=/d' ~/.hermes/.env

# 3. Remove credential pool entries from auth.json
python3 -c "
import json
with open('$HOME/.hermes/auth.json', 'r') as f:
    data = json.load(f)
cp = data.get('credential_pool', {})
removed = [k for k in list(cp.keys()) if 'PROVIDER_NAME' in k]
for k in removed:
    del cp[k]
with open('$HOME/.hermes/auth.json', 'w') as f:
    json.dump(data, f, indent=2)
print(f'Removed: {removed}')
"

# 4. Verify clean
grep -i "PROVIDER_NAME" ~/.hermes/.env ~/.hermes/auth.json ~/.hermes/config.yaml
```

## Pitfall: `auth.json` structure

Credential pools are nested under `credential_pool`, **not** at the top level.
Top-level keys are: `version`, `providers`, `active_provider`, `updated_at`,
`credential_pool`. Always drill into `credential_pool` when searching/removing.

## Pitfall: Model list still shows "removed" models

After removing a provider's API key, the model picker may still list models
from that provider (e.g., Qwen models after removing Alibaba keys). This is
**normal** when:

- The models are available through an **aggregator** like OpenRouter
- The provider platform itself lists sibling models (e.g., Xiaomi MiMo API
  listing Qwen models)

These models are not directly configured — they appear through the aggregator
or platform's model discovery. No action needed unless the user wants to
remove the aggregator too.

## CLI alternative

`hermes auth remove <provider> <index>` removes individual credential pool
entries. `hermes auth list` shows all pools. For bulk removal of an entire
provider, the Python script above is more reliable.
