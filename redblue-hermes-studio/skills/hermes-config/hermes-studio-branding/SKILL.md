---
name: hermes-studio-branding
description: "Rebrand Hermes Studio web UI: logo, name, theme, avatars."
---

# Hermes Studio Branding / Re-skin

Use when the user wants to re-skin the Hermes Studio frontend with a new brand:
swap the logo, change the product name shown in titles/login, recolor the theme,
and replace the default user/agent avatar icons (e.g. the "联通智能体" Unicom rebrand).

## The "which icon did they mean?" pitfall (learned the hard way)

When a user says "那个 logo / 小人 (the little-person icon) should also be 联通的 / mine", DO NOT
guess the first avatar you find. Enumerate EVERY icon/avatar source before editing:

1. **User default avatar** — `multiavatar` generated geometric "person" (ProfileAvatar.vue fallback + AccountSettings.vue random button).
2. **Hermes agent avatar** — `packages/client/public/coding-agents/hermes.png` (the humanoid Hermes-god logo — this is what "官方小人 / official little person" usually means).
3. Other coding-agent avatars — `ekko-agent.png` / `codex-openai.png` / `claude-code.svg` / `pi.svg`.
4. Generic feather "person" line icons (`M20 21v-2a4 4 0 0 0-4-4H8...`) in AppSidebar.vue, ProfilesPanel.vue, MemoryView.vue — functional user/member icons, usually NOT what the user means.

Confirm WHICH one (ask where on screen, or state your assumption) before editing.
This session I first changed multiavatar; the user replied "没修改成功" — they actually meant hermes.png.

## File map (Hermes Studio repo)

- **Logo images**: `packages/client/public/logo.png` (400×400), `logo-original.png` (1254×1254),
  `favicon.ico` (multi-size), `packages/desktop/build/icon.png` (desktop app icon).
  Referenced from index.html, LoginView.vue, App.vue, AppConnectionsPanel.vue, GroupChat*.vue.
- **Brand name strings**:
  - `packages/client/index.html` — `<title>` and `apple-mobile-web-app-title`.
  - `packages/client/public/manifest.webmanifest` — name / short_name / description / theme_color.
  - `packages/client/src/i18n/locales/zh.ts` + `zh-TW.ts` — full replace "Hermes Studio" → new name.
  - other locales (en/de/fr/ja/ko/es/pt/ru/ar) — replace ONLY the `login.title` value; leave explanatory prose alone (grammar).
  - KEEP technical terms "Hermes Agent", "Hermes profile", "Hermes Runtime" — those are the framework, not the product name.
- **Theme colors**: `packages/client/src/styles/theme.ts` — `lightThemeOverrides.common.primaryColor` (+Hover/Pressed/Suppl),
  `Button.colorPrimary/Hover/Pressed`, and the matching `darkThemeOverrides` block.
- **User avatar fallback**: `packages/client/src/components/hermes/profiles/ProfileAvatar.vue`
  and `packages/client/src/components/hermes/settings/AccountSettings.vue` (handleRandomAvatar).
- **Agent avatar**: `packages/client/public/coding-agents/hermes.png` (referenced from chat-agent-avatar.ts,
  group-agent-avatar.ts, stores/hermes/chat.ts, GroupMessageList.vue, DisplaySettings.vue, GlobalPendingActions.vue).

## Workflow

1. Inspect the repo; run `npm install --ignore-engines` (project requires Node >=23; Node 22 works with the flag).
   NOTE: install auto-runs `prepare` → `npm run build`, which also type-checks your edits — free validation.
2. Replace logo images (see references/image-generation-macos.md for SVG→PNG / favicon on macOS).
3. Replace brand name (title, manifest, i18n) — full replace in zh locales, login.title only elsewhere.
4. Recolor theme.ts (light + dark blocks).
5. Replace the default user avatar AND the agent avatar hermes.png.
6. Verify WITHOUT a browser (browser remote-debugging needs a Chrome auth popup that blocks automation):
   - `curl -s http://localhost:8649/ | grep -oE '<title>[^<]*</title>'`
   - `curl -s -o /dev/null -w '%{http_code} (%{size_download})' http://localhost:8649/logo.png`
   - `curl -s http://localhost:8649/src/components/hermes/profiles/ProfileAvatar.vue` → grep for the new asset to confirm the RUNNING vite server compiles the new code (not just your local file on disk).
   - `sqlite3 ~/.hermes-web-ui/hermes-web-ui.db "SELECT id,username,avatar FROM users;"` to inspect stored user-avatar state (empty = falls through to fallback).
7. Tell the user to hard-refresh (Cmd+Shift+R) — static assets and the SPA bundle are browser-cached; this is the #1 cause of "it didn't change".

## Pitfalls

- Backend avatar validation: a stored `image` avatar MUST be `data:image/...` base64
  (`controllers/auth.ts` rejects any `dataUrl` not starting with `data:image/`). A bare path like
  `/avatar-default.png` is fine for the ProfileAvatar fallback `<img src>`, but NOT for a stored image avatar.
- Dev servers: `npm run dev` runs frontend :8649 + BFF :8647. Check readiness with
  `lsof -iTCP -sTCP:LISTEN -P | grep -E '8649|8647'`; the BFF boots a few seconds after vite.
- HMR success in logs ≠ user sees it: confirm via curl, then instruct a hard refresh.

## Support files

- `references/image-generation-macos.md` — SVG→PNG, favicon, circular-avatar compositing, white-bg removal, ASCII shape verification (all with ImageMagick/qlmanage, no rsvg-convert).
