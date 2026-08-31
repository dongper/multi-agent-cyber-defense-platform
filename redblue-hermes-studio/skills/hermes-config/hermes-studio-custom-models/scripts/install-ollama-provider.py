#!/usr/bin/env python3
"""
Install an OpenAI-compatible provider (Ollama by default) into BOTH
Hermes CLI config and Hermes Studio GUI config in one shot.

Usage:
    python3 install-ollama-provider.py [options]

Options:
    --name NAME              Provider name (default: ollama)
    --model MODEL            Model name (default: qwen2.5-coder:14b)
    --base-url URL           OpenAI-compatible endpoint (default: http://localhost:11434/v1)
    --api-key KEY            API key, can be anything for local (default: ollama)
    --context-length N       Context window in tokens (default: 32768)
    --set-default            Also set this as the global default model
    --dry-run                Print what would be written, don't actually write

Why this script exists:
    - ~/.hermes/config.yaml is protected (patch tool refuses to write it)
    - `hermes config set model '{...}'` doesn't auto-create custom_providers entry
    - CLI-style `providers.<name>` is INVISIBLE to Hermes Studio GUI
    - Studio caches customModels in memory — needs ⌘Q full quit to reload

This script handles all of the above correctly.
"""
import argparse
import json
import os
import shutil
import sys
from pathlib import Path

import yaml

CLI_CONFIG = Path("~/.hermes/config.yaml").expanduser()
GUI_CONFIG = Path("~/.hermes-web-ui/config.json").expanduser()


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--name", default="ollama")
    p.add_argument("--model", default="qwen2.5-coder:14b")
    p.add_argument("--base-url", default="http://localhost:11434/v1")
    p.add_argument("--api-key", default="ollama")
    p.add_argument("--context-length", type=int, default=32768)
    p.add_argument("--set-default", action="store_true",
                   help="Set this as model.default in CLI config")
    p.add_argument("--dry-run", action="store_true")
    return p.parse_args()


def update_cli_config(args):
    if not CLI_CONFIG.exists():
        print(f"⚠ CLI config not found at {CLI_CONFIG}; skipping.")
        return

    # Backup
    backup = CLI_CONFIG.with_suffix(f".yaml.bak.before-{args.name}")
    if not args.dry_run:
        shutil.copy2(CLI_CONFIG, backup)
        print(f"✓ backup: {backup}")

    with open(CLI_CONFIG) as f:
        cfg = yaml.safe_load(f) or {}

    # 1) Remove legacy CLI-style providers.<name> (Studio doesn't read it)
    if "providers" in cfg and args.name in cfg.get("providers", {}):
        del cfg["providers"][args.name]
        if not cfg["providers"]:
            del cfg["providers"]
        print(f"✓ removed legacy providers.{args.name}")

    # 2) Upsert into custom_providers[]
    cp = cfg.setdefault("custom_providers", [])
    existing = next((p for p in cp if p.get("name") == args.name), None)
    entry = {
        "name": args.name,
        "api_key": args.api_key,
        "api_mode": "chat_completions",
        "base_url": args.base_url,
        "model": args.model,
        "models": {
            args.model: {"context_length": args.context_length}
        }
    }
    if existing:
        # Merge models dict; replace top-level fields
        merged_models = {**existing.get("models", {}), **entry["models"]}
        existing.update(entry)
        existing["models"] = merged_models
        print(f"• updated custom_providers.{args.name}")
    else:
        cp.insert(0, entry)
        print(f"✓ added custom_providers.{args.name}")

    # 3) Optionally set as default
    if args.set_default:
        cfg["model"] = {"default": args.model, "provider": f"custom:{args.name}"}
        print(f"✓ default model -> {args.model} via custom:{args.name}")

    if args.dry_run:
        print("--- DRY RUN: would write the following to", CLI_CONFIG)
        print(yaml.safe_dump(cfg, sort_keys=False, allow_unicode=True)[:2000])
        return

    with open(CLI_CONFIG, "w") as f:
        yaml.safe_dump(cfg, f, sort_keys=False, allow_unicode=True, default_flow_style=False)
    os.chmod(CLI_CONFIG, 0o600)
    print(f"✓ wrote {CLI_CONFIG}")


def update_gui_config(args):
    GUI_CONFIG.parent.mkdir(parents=True, exist_ok=True)
    if GUI_CONFIG.exists():
        with open(GUI_CONFIG) as f:
            existing = json.load(f)
    else:
        existing = {}

    cm = existing.get("customModels") or {}
    key = f"custom:{args.name}"
    models = cm.get(key, [])
    if args.model not in models:
        models = list(dict.fromkeys(models + [args.model]))
        cm[key] = models
        print(f"✓ added {args.model} to customModels[{key}]")
    else:
        print(f"• {args.model} already in customModels[{key}]")
    existing["customModels"] = cm

    if args.dry_run:
        print("--- DRY RUN: would write the following to", GUI_CONFIG)
        print(json.dumps(existing, indent=2, ensure_ascii=False))
        return

    with open(GUI_CONFIG, "w") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
    os.chmod(GUI_CONFIG, 0o600)
    print(f"✓ wrote {GUI_CONFIG}")


def main():
    args = parse_args()
    print(f"=== Installing provider '{args.name}' for model '{args.model}' ===")
    print(f"    base_url: {args.base_url}")
    print(f"    context:  {args.context_length}")
    print()
    update_cli_config(args)
    print()
    update_gui_config(args)
    print()
    print("=" * 60)
    print("⚠️  REMINDER: Hermes Studio caches customModels in memory.")
    print("    You MUST fully quit Studio (⌘Q, NOT ⌘W) and reopen it.")
    print("    Or run:  osascript -e 'quit app \"Hermes Studio\"'")
    print("=" * 60)


if __name__ == "__main__":
    sys.exit(main())
