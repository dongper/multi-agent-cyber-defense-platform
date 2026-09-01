#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js。请先安装 Node.js 22.12 或更高版本（推荐 24）。"
  exit 1
fi

if ! node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)"; then
  echo "当前 Node.js 版本为 $(node --version)，项目要求 22.12 或更高版本（推荐 24）。"
  exit 1
fi

if [ ! -x "$project_dir/node_modules/.bin/vite" ]; then
  echo "首次运行：正在安装项目依赖……"
  npm ci --ignore-scripts
  npm rebuild node-pty sharp
fi

echo "正在启动多智能体网络威胁一体化防护平台……"
echo "访问地址：http://127.0.0.1:8659/#/security-operations"
exec npm run dev:security
