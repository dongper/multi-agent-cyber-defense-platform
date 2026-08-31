---
name: obsidian
description: Read, search, create, and edit notes in the Obsidian vault.
platforms: [linux, macos, windows]
---

# Obsidian Vault

Use this skill for filesystem-first Obsidian vault work: reading notes, listing notes, searching note files, creating notes, appending content, and adding wikilinks.

## Vault path

Use a known or resolved vault path before calling file tools.

The documented vault-path convention is the `OBSIDIAN_VAULT_PATH` environment variable, for example from `~/.hermes/.env`. If it is unset, use `~/Documents/Obsidian Vault`.

File tools do not expand shell variables. Do not pass paths containing `$OBSIDIAN_VAULT_PATH` to `read_file`, `write_file`, `patch`, or `search_files`; resolve the vault path first and pass a concrete absolute path. Vault paths may contain spaces, which is another reason to prefer file tools over shell commands.

If the vault path is unknown, `terminal` is acceptable for resolving `OBSIDIAN_VAULT_PATH` or checking whether the fallback path exists. Once the path is known, switch back to file tools.

## Read a note

Use `read_file` with the resolved absolute path to the note. Prefer this over `cat` because it provides line numbers and pagination.

## List notes

Use `search_files` with `target: "files"` and the resolved vault path. Prefer this over `find` or `ls`.

- To list all markdown notes, use `pattern: "*.md"` under the vault path.
- To list a subfolder, search under that subfolder's absolute path.

## Search

Use `search_files` for both filename and content searches. Prefer this over `grep`, `find`, or `ls`.

- For filenames, use `search_files` with `target: "files"` and a filename `pattern`.
- For note contents, use `search_files` with `target: "content"`, the content regex as `pattern`, and `file_glob: "*.md"` when you want to restrict matches to markdown notes.

## Create a note

Use `write_file` with the resolved absolute path and the full markdown content. Prefer this over shell heredocs or `echo` because it avoids shell quoting issues and returns structured results.

## Append to a note

Prefer a native file-tool workflow when it is not awkward:

- Read the target note with `read_file`.
- Use `patch` for an anchored append when there is stable context, such as adding a section after an existing heading or appending before a known trailing block.
- Use `write_file` when rewriting the whole note is clearer than constructing a fragile patch.

For an anchored append with `patch`, replace the anchor with the anchor plus the new content.

For a simple append with no stable context, `terminal` is acceptable if it is the clearest safe option.

## Targeted edits

Use `patch` for focused note changes when the current content gives you stable context. Prefer this over shell text rewriting.

## Wikilinks

Obsidian links notes with `[[Note Name]]` syntax. When creating notes, use these to link related content.

## Install a plugin from GitHub

When the user asks to install an Obsidian community plugin from a GitHub repo:

1. **Find the vault** — scan `~/Documents/`, `~/Desktop/`, and `~/` (max depth 5) for a directory containing `.obsidian/`. If `OBSIDIAN_VAULT_PATH` is set, use that.
2. **Get the plugin ID** — the plugin ID is in `manifest.json` at the repo root (field `id`). The install target is `<vault>/.obsidian/plugins/<plugin-id>/`.
3. **Try release assets first** — most repos publish pre-built `main.js`, `manifest.json`, and `styles.css` as GitHub release assets. Download them directly:
   ```
   curl -sL -o main.js "https://github.com/<owner>/<repo>/releases/download/<tag>/main.js"
   curl -sL -o manifest.json "https://github.com/<owner>/<repo>/releases/download/<tag>/manifest.json"
   curl -sL -o styles.css "https://github.com/<owner>/<repo>/releases/download/<tag>/styles.css"
   ```
   Get the latest tag from `https://api.github.com/repos/<owner>/<repo>/releases/latest`.
4. **Only build from source as fallback** — if release assets aren't available, clone the repo and run `npm install && npm run build`. Pitfall: the repo may require a newer Node version than what's installed (e.g., Node 24 vs installed Node 22). In that case, esbuild or other native deps may fail. Fall back to release assets.
5. **Clean up** — Obsidian only needs `main.js`, `manifest.json`, and `styles.css`. Remove `node_modules/`, source files, `.git/`, and other build artifacts.
6. **Tell the user to enable it** — the user must manually enable the plugin in Obsidian: Settings → Community Plugins → toggle on.

### Pitfalls

- **Node version mismatch**: Many newer plugins require Node 24+. If building from source fails with `ERR_MODULE_NOT_FOUND` for esbuild or similar, skip straight to downloading release assets.
- **`gh` CLI not authenticated**: Don't rely on `gh release download` — use `curl` to download release assets directly from GitHub.
- **Download timeouts**: GitHub release downloads can be slow. Use `--connect-timeout 10 --max-time 60` with curl.
- **Vault path with spaces**: Always quote the vault path in shell commands. Prefer file tools (`write_file`) over shell heredocs when possible.

## Plugin Configuration (Claudian & Custom Models)

The Claudian plugin (`realclaudian`) wraps coding agent **CLIs** — not raw LLM APIs:
- **Claude** → `claude` CLI (Anthropic SDK)
- **Codex** → `codex` CLI (OpenAI)
- **Opencode** → `opencode` CLI
- **Pi** → `pi` CLI

Claudian does NOT directly call LLM APIs. It launches CLI subprocesses. To use a custom model, configure the CLI's environment, not just the plugin.

### Configuring OpenAI-Compatible APIs (MiMo, MiniMax, Qwen, etc.)

Any API that speaks OpenAI protocol can be used through the **Codex provider**:

1. Edit Claudian's `data.json` at `<vault>/.obsidian/plugins/claudian/data.json`:
```json
{
  "providerConfigs": {
    "codex": {
      "enabled": true,
      "safeMode": "workspace-write",
      "cliPath": "/opt/homebrew/bin/codex",
      "customModels": "your-model-name",
      "environmentVariables": "OPENAI_API_KEY=your-key\nOPENAI_BASE_URL=https://your-endpoint/v1\nOPENAI_MODEL=your-model-name"
    }
  },
  "settingsProvider": "codex",
  "savedProviderModel": { "codex": "your-model-name" }
}
```
2. Restart Obsidian and open a NEW conversation.

### Configuring Claude-Compatible APIs

For Anthropic protocol providers, configure `.claude/settings.json`:
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.example.com/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "your-api-key",
    "ANTHROPIC_MODEL": "your-model-name"
  }
}
```

### Claudian Pitfalls

1. **Model picker shows wrong model in settings UI**: The actual model used at runtime is determined by environment variables (`OPENAI_MODEL` or `ANTHROPIC_MODEL`). Open a new conversation tab to verify.
2. **Don't overwrite existing `.claude/settings.json`**: Users may already have other providers configured. Always read first.
3. **Environment variables are scoped to Claudian**: Setting env vars in `data.json` only affects the Codex subprocess launched by Claudian, NOT terminal `codex` usage.
4. **`customModels` format**: One model ID per line (newline-separated string).
5. **Plugin config vs CLI config**: `data.json` is the plugin's config. `~/.codex/config.toml` is Codex CLI's global config. Don't modify the CLI config to avoid affecting normal terminal usage.
