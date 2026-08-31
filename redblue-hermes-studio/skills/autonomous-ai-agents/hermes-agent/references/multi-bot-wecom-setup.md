# Running Multiple WeCom Bots via Profiles

When you need multiple WeCom bots (e.g., different enterprises, different access policies), use Hermes Profiles to run fully independent gateway instances.

## Steps

```bash
# 1. Create a new profile (clones config, .env, skills from default)
hermes profile create wecom2 --clone

# 2. Edit the new profile's .env with the new bot's credentials
#    ~/.hermes/profiles/wecom2/.env
WECOM_BOT_ID=<new_bot_id>
WECOM_SECRET=<new_secret>
WECOM_ALLOWED_USERS=<user_ids or empty for open>

# 3. CRITICAL: Disable Weixin platform in the cloned profile
#    Cloned profiles inherit the Weixin (微信) config from default,
#    which uses the SAME bot token — causes "token already in use" conflict.
wecom2 config set gateway.platforms.weixin.enabled false

# 4. (Optional) Open access to all users
#    Edit .env: set GATEWAY_ALLOW_ALL_USERS=true

# 5. Start the gateway
wecom2 gateway start
```

## Pitfalls

### Weixin Platform Conflict on Clone
Cloned profiles inherit ALL platform configs including Weixin (微信).
Since both profiles share the same WEIXIN_TOKEN, the second gateway fails with:
```
[Weixin] Weixin bot token already in use (PID <pid>)
```
**Fix:** `wecom2 config set gateway.platforms.weixin.enabled false`

### WeCom Error 853000: Invalid Bot ID or Secret
```
Failed to connect: invalid bot_id or secret (errcode=853000)
```
Means the WECOM_BOT_ID or WECOM_SECRET is wrong. Double-check against the
enterprise's WeCom admin console (应用管理 → 自建应用 → 凭证).

### Different Enterprises, Different Credentials
Each WeCom bot belongs to one enterprise. Bot IDs and Secrets are NOT
interchangeable across enterprises. Keep credentials isolated per profile.

## Management Commands

```bash
# Status
hermes gateway status        # shows all profiles
wecom2 gateway status        # just wecom2

# Restart
wecom2 gateway restart

# Logs
tail -f ~/.hermes/profiles/wecom2/logs/gateway.log
tail -f ~/.hermes/profiles/wecom2/logs/gateway.error.log
```
