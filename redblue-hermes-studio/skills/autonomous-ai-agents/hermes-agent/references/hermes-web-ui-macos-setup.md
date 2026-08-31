# Hermes Web UI — macOS Installation Walkthrough

## Prerequisites

- Node.js + npm (for npm install path): `node --version && npm --version`
- Hermes Agent CLI installed: `hermes --version`

## Option A: npm Install (Web Dashboard)

```bash
# If in China, switch to mirror first
npm config set registry https://registry.npmmirror.com

npm install -g hermes-web-ui
hermes-web-ui start
# → http://localhost:8648 (token auto-generated in logs)
```

Token is printed on startup and stored in `~/.hermes-web-ui/server.log`.
Logs: `~/.hermes-web-ui/server.log`

## Option B: Desktop App (Recommended)

### Download

```bash
# Check architecture
uname -m  # arm64 or x86_64

# Get latest release URL via GitHub API
curl -s https://api.github.com/repos/EKKOLearnAI/hermes-web-ui/releases/latest | \
  grep -E '"tag_name"|"browser_download_url".*\.dmg"'

# Download arm64 version (Apple Silicon)
cd ~/Desktop
curl -L -O https://github.com/EKKOLearnAI/hermes-web-ui/releases/download/v0.6.9/Hermes.Studio-0.6.9-arm64.dmg
```

If `curl` to GitHub is slow/fails, try with proxy or VPN.

### Install

```bash
hdiutil attach ~/Desktop/Hermes.Studio-0.6.9-arm64.dmg
# Mounts to /Volumes/Hermes Studio 0.6.9-arm64 1/

cp -R "/Volumes/Hermes Studio 0.6.9-arm64 1/Hermes Studio.app" /Applications/

hdiutil detach "/Volumes/Hermes Studio 0.6.9-arm64 1"
```

### First Launch

```bash
open -a "Hermes Studio"
```

On first launch, the app prompts to download a runtime:
- **Download from Cloudflare** — faster (CDN)
- **Download from GitHub** — more stable

Choose Cloudflare for speed. The runtime includes the Python environment and dependencies needed for the embedded Hermes Agent.

### Data Location

- App state: `~/Library/Application Support/hermes-studio/`
- Hermes data: `~/.hermes/` (shared with CLI — profiles, sessions, skills, gateway)

## Management

```bash
# npm version
hermes-web-ui status
hermes-web-ui stop
hermes-web-ui restart
hermes-web-ui update

# Desktop version
open -a "Hermes Studio"
# Quit via Cmd+Q or menu
```

## Cleanup

```bash
# Remove downloaded .dmg
rm ~/Desktop/Hermes.Studio-*.dmg

# Reset npm registry (if changed)
npm config set registry https://registry.npmjs.org
```
