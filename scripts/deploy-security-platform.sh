#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

if ! command -v docker >/dev/null 2>&1; then
  echo "未检测到 Docker。请先安装 Docker Desktop 或 Docker Engine。"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "未检测到 Docker Compose v2。请先完成安装。"
  exit 1
fi

echo "正在构建并启动多智能体网络威胁一体化防护平台……"
docker compose up -d --build
echo "部署完成：http://127.0.0.1:${PORT:-6060}"
echo "查看日志：docker compose logs -f cyber-defense-platform"
