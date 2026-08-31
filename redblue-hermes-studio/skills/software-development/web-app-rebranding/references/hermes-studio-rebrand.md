# Hermes Studio rebrand touchpoints

Vue 3 + TypeScript + Vite + Naive UI + Pinia + vue-i18n monorepo (`hermes-web-ui` npm package, BSL-1.1). Package layout: `packages/client` (Vue UI), `packages/server` (Koa BFF), `packages/desktop` (Electron), `packages/ekko-agent`, `packages/esp32-c3` (MCU firmware), `packages/skills`.

## Logo files
- `packages/client/public/logo.png` (400×400 — login page, mobile menu hamburger, boot-fallback)
- `packages/client/public/logo-original.png` (1254×1254, source/backup)
- `packages/client/public/favicon.ico` (multi-size)
- `packages/desktop/build/icon.png` / `icon.icns` / `icon.ico` (Electron app icon)

## Brand name
- `packages/client/index.html` — `<title>` + `apple-mobile-web-app-title`; also `theme-color` meta and the boot-fallback `<img>` uses `/logo.png`.
- `packages/client/public/manifest.webmanifest` — `name`, `short_name`, `description`, `theme_color`.
- `packages/client/src/i18n/locales/*.ts` — `login.title` in EVERY locale; full product-name occurrences in `zh.ts` / `zh-TW.ts` (global-replace); for other locales only the `title:` key. PRESERVE "Hermes Agent", "Hermes profile", "Hermes Runtime" — those are framework terms, not the product name.
- `packages/client/src/views/LoginView.vue` — logo `alt`; title renders via `t("login.title")`.

## Theme color (Naive UI overrides)
- `packages/client/src/styles/theme.ts`:
  - `lightThemeOverrides.common.primaryColor` / `primaryColorHover` / `primaryColorPressed` / `primaryColorSuppl`
  - `lightThemeOverrides.Button.colorPrimary` / `colorHoverPrimary` / `colorPressedPrimary`
  - same keys under `darkThemeOverrides` (use a brighter tint; dark default is near-white `#e0e0e0`, button text flips to white on a colored button)
  - `getThemeOverrides()` merges per-user `ThemeCustomization` on top — defaults only need the base blocks changed.

## Run
- Project pins `"node": ">=23"`. Works on Node 22 with `npm install --ignore-engines`.
- `npm install` triggers `prepare` → `npm run build` (openapi gen + `vue-tsc -b` + `vite build` + server tsc). A green build = brand/theme edits type-checked.
- `npm run dev` → frontend `:8649` (Vite), BFF `:8647` (nodemon + ts-node). BFF health returns 401 until authed (normal).
- Default login: `admin` / `123456` (see `zh.ts` `login.defaultCredentialsHint`).
