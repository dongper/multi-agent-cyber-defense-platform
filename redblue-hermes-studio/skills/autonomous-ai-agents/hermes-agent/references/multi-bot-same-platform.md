# Running Multiple Bots on the Same Platform

Use Hermes Profiles to run multiple independent instances of the same messaging platform (e.g. two WeCom bots, two Telegram bots).

## Pattern

1. Create a cloned profile:
   ```bash
   hermes profile create <name> --clone
   ```
   This copies config.yaml, .env, SOUL.md, and skills from the default profile.

2. Edit the new profile's .env with the second bot's credentials:
   ```bash
   # Example for WeCom — replace BOT_ID and SECRET
   sed -i '' 's/WECOM_BOT_ID=.*/WECOM_BOT_ID=<new_bot_id>/' ~/.hermes/profiles/<name>/.env
   sed -i '' 's/WECOM_SECRET=.*/WECOM_SECRET=<new_secret>/' ~/.hermes/profiles/<name>/.env
   ```
   Adjust the env var names for other platforms (TELEGRAM_BOT_TOKEN, SLACK_BOT_TOKEN, etc.).

3. Start the new gateway:
   ```bash
   <name> gateway start
   ```
   A wrapper script is auto-created at `~/.local/bin/<name>`.

4. Verify both are running:
   ```bash
   hermes gateway status    # shows default + lists other profiles
   <name> gateway status    # shows the second profile
   ```

## Key Facts

- Each profile gets its own launchd service: `ai.hermes.gateway-<name>.plist`
- Each profile has isolated logs: `~/.hermes/profiles/<name>/logs/`
- Each profile has isolated sessions, memory, and skills
- Shared: the same underlying Hermes install and venv
- The wrapper `<name>` is a shortcut for `hermes --profile <name>`
- Both gateways run simultaneously as independent processes
- Allowed users (e.g. WECOM_ALLOWED_USERS) are per-profile — set them independently if needed

## Platform Env Vars Reference

| Platform | Key vars to change |
|----------|-------------------|
| WeCom | WECOM_BOT_ID, WECOM_SECRET, WECOM_ALLOWED_USERS |
| Telegram | TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_USERS |
| Slack | SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_ALLOWED_USERS |
| Weixin | WEIXIN_ACCOUNT_ID, WEIXIN_TOKEN |
| Discord | (via config.yaml platform section) |
