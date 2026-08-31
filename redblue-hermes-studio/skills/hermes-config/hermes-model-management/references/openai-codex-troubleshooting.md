# OpenAI Codex Provider Troubleshooting

## Architecture

The `openai-codex` provider uses ChatGPT OAuth (not standard OpenAI API keys).
- **Auth mode:** `chatgpt` (OAuth device code flow via `hermes auth add openai-codex`)
- **API endpoint:** `https://chatgpt.com/backend-api/codex`
- **Token storage:** `~/.codex/auth.json` (shared with Codex CLI) + `~/.hermes/auth.json` credential pool
- **Token refresh:** Automatic via `refresh_token` grant; handled by `hermes_cli/auth.py::refresh_codex_oauth_pure()`
- **Codex CLI:** Installed at `/opt/homebrew/bin/codex` (npm: `@openai/codex`)

## Auth.json Token Structure (`~/.codex/auth.json`)

```json
{
  "auth_mode": "chatgpt",
  "OPENAI_API_KEY": null,
  "tokens": {
    "id_token": "eyJhbG...",
    "access_token": "eyJhbG...",
    "refresh_token": "rt.1.A...",
    "account_id": "ce104e39-b3ab-4986-b832-dc481a1501b9"
  },
  "last_refresh": "2026-06-03T13:23:51.654958Z"
}
```

## Diagnostic Flow

```
1. hermes config show
   └─ Verify: Model = gpt-5.5, Provider = openai-codex

2. cat ~/.codex/auth.json
   └─ Check: last_refresh timestamp, tokens present
   └─ If > 7 days old → token likely expired, re-auth

3. cat ~/.codex/config.toml
   └─ Check: model setting matches expected

4. grep -i 'codex' ~/.hermes/logs/agent.log | tail -20
   └─ THE DEFINITIVE SOURCE — always check logs last
   └─ Look for: timeout, rejection, error codes, model switch events
```

## Error Codes and Resolutions

| Error Pattern | Cause | Fix |
|---|---|---|
| `silently rejecting '<model>'` (90s timeout) | ChatGPT backend blocking model | Switch model (gpt-5.4, gpt-5.3-codex) or wait |
| `codex_refresh_failed` + HTTP 401/403 | Refresh token expired | `hermes auth add openai-codex` |
| `codex_auth_missing_refresh_token` | No refresh token in pool | `hermes auth add openai-codex` |
| `refresh_token_reused` | Another client consumed token | Run `codex` in terminal, then `hermes auth add openai-codex` |
| `429` / `quota exhausted` | Rate limit | Wait for reset; creds still valid |
| `codex_refresh_invalid_json` | Unexpected response | Transient; retry |

## Key Code Paths (for debugging)

- `hermes_cli/auth.py::refresh_codex_oauth_pure()` — token refresh logic (line ~3427)
- `hermes_cli/auth.py::_codex_access_token_is_expiring()` — expiry check (line ~1892)
- `hermes_cli/auth.py::_import_codex_cli_tokens()` — import from codex CLI (line ~3576)
- `hermes_cli/auth.py::resolve_codex_runtime_credentials()` — main credential resolution (line ~3618)
- `hermes_cli/codex_models.py::DEFAULT_CODEX_MODELS` — curated model list

## Codex CLI Config (`~/.codex/config.toml`)

```toml
model = "gpt-5.5"
model_reasoning_effort = "xhigh"
```

Note: This config is for the standalone Codex CLI, not Hermes. Hermes reads its own `config.yaml`.
The Codex CLI model setting does NOT affect which model Hermes uses via the openai-codex provider.

## Available Models via Codex Backend

As of 2026-06, supported on ChatGPT Pro:
- `gpt-5.5` (intermittently blocked for some accounts)
- `gpt-5.4`
- `gpt-5.4-mini`
- `gpt-5.3-codex`
- `gpt-5.3-codex-spark` (research preview, Pro only)

NOT supported via Codex backend (HTTP 400):
- `gpt-5.2-codex`, `gpt-5.1-codex-max`, `gpt-5.1-codex-mini`
