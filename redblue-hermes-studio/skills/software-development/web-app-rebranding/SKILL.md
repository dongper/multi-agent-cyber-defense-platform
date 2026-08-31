---
name: web-app-rebranding
description: Rebrand an existing web app (logo, brand name, theme color).
---

# Web App Rebranding

Rebrand an existing web app (Vue/React/whatever) with a new logo, product name, and theme color, then deliver it running locally (dev server or build) for the user to actually look at — not just a description of changes.

## Workflow

1. **Confirm scope up front, in ONE batched clarify call** (not a chain): deliverable form (local dev server / source-only / desktop package), logo source (download official / user provides file / text placeholder), and the new brand name. Users asking to "make it a frontend + change the logo" usually mean "local-running customized copy".
2. **Discover all brand touchpoints in parallel** before editing:
   - Logo image files and their string references (`logo.png`, `favicon.ico`, `icon.icns/.ico/.png`).
   - Old product name in `<title>`, PWA `manifest`, i18n locale files, and hardcoded UI text.
   - Theme color definitions (Naive UI: `GlobalThemeOverrides` in a `theme.ts`; `primaryColor` + `Button.colorPrimary` + Menu/Input active colors).
3. **Generate icon assets** from the logo source — see `references/macos-svg-to-icon.md`.
4. **Replace the brand name**:
   - Global-replace old name → new name in the primary locale(s) the user actually uses.
   - For other locales, change only the login/title key (a foreign brand name embedded mid-sentence in, say, German breaks grammar; in a title position it reads fine).
   - PRESERVE underlying framework/technical names (e.g. "Hermes Agent", "Hermes profile", "Hermes Runtime") — only the PRODUCT name changes.
5. **Change theme color(s)**: light + dark `primaryColor/Hover/Pressed/Suppl` and button colors. Use a brighter tint of the brand color for dark mode.
6. **Verify + deliver** (below).

## Pitfalls

- **Node engine mismatch**: apps often pin `"node": ">=X"`. If the machine is one major version behind, `npm install --ignore-engines` usually works — the pin is often conservative. Flag it to the user rather than installing a new Node.
- **`npm install` may auto-run a `prepare`/`postinstall` build.** Let it run — a green build is free verification that your brand/theme edits didn't break TypeScript.
- **Copy big monorepos with `rsync -a --exclude .git`.** Keep `node_modules` in the copy (~1GB) so the desktop copy runs without re-install.
- **Port conflict** when moving the running server from a scratch dir (/tmp) to the final location: kill the old dev server first, then start the new one on the same port you already validated.

## Verification

- `curl` the dev server: `<title>` shows the new name; `logo.png` / `favicon.ico` return 200; backend health returns 401 (auth gate) rather than connection-refused = backend alive.
- Do NOT force a browser screenshot if the browser tool needs a remote-debugging popup approval — curl + code review + green build is sufficient evidence the branding landed.

## References

- `references/macos-svg-to-icon.md` — SVG/PNG logo → square PNG + multi-size favicon.ico on macOS (qlmanage + ImageMagick; combined-mark cropping; color verification).
- `references/hermes-studio-rebrand.md` — exact file touchpoints for Hermes Studio (Vue 3 + Naive UI + vue-i18n monorepo), reusable for similar Vue apps.
