#!/bin/bash
# Quick sensitive path enumeration
# Usage: ./path-scan.sh <domain> [base_url]
# Example: ./path-scan.sh zglt.iguopin.com https://zglt.iguopin.com

DOMAIN=${1:?Usage: path-scan.sh <domain> [base_url]}
BASE_URL=${2:-"https://$DOMAIN"}

PATHS=(
  /admin
  /api
  /wp-admin
  /wp-login.php
  /.env
  /.git/config
  /.git/HEAD
  /.svn/entries
  /backup
  /test
  /debug
  /console
  /phpmyadmin
  /server-status
  /server-info
  /actuator
  /actuator/health
  /swagger-ui.html
  /api-docs
  /graphql
  /robots.txt
  /sitemap.xml
  /.well-known/security.txt
)

echo "=== Path Enumeration: $BASE_URL ==="
echo ""

for path in "${PATHS[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${BASE_URL}${path}" 2>/dev/null)
  
  # Color code: 200=green, 301/302=yellow, 403=red, other=dim
  case $code in
    200)   color="\033[32m" ;;  # green
    301|302) color="\033[33m" ;;  # yellow
    403)   color="\033[31m" ;;  # red
    *)     color="\033[90m" ;;  # dim
  esac
  
  printf "${color}%-30s -> %s\033[0m\n" "$path" "$code"
done

echo ""
echo "Note: SPA apps return 200 for all paths. Verify with:"
echo "  curl -s ${BASE_URL}/.env | head -5"
