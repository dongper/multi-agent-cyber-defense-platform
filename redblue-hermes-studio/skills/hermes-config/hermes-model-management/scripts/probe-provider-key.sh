#!/usr/bin/env bash
# probe-provider-key.sh — one-shot 401 diagnosis for Hermes providers.
#
# Usage:
#   ./probe-provider-key.sh XIAOMI          # probe Xiaomi mimo
#   ./probe-provider-key.sh ALIBABA         # probe Alibaba/DashScope
#   ./probe-provider-key.sh DEEPSEEK
#   ./probe-provider-key.sh <PREFIX>        # any *_API_KEY / *_BASE_URL pair in ~/.hermes/.env
#
# Behavior:
#   1. Loads ~/.hermes/.env into the shell (tolerating stray non-KEY=VAL noise).
#   2. Extracts ${PREFIX}_API_KEY and ${PREFIX}_BASE_URL.
#   3. Hits ${BASE_URL}/models with the key and prints a verdict.
#
# Exit codes:
#   0 — key valid (HTTP 200)
#   1 — key rejected (HTTP 401/403)
#   2 — network / config error (missing var, DNS, timeout)

set -u

PREFIX="${1:-}"
if [[ -z "$PREFIX" ]]; then
  echo "usage: $0 <PROVIDER_PREFIX>   e.g. XIAOMI, ALIBABA, DEEPSEEK" >&2
  exit 2
fi

ENV_FILE="${HOME}/.hermes/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE not found" >&2
  exit 2
fi

# Load .env silently, tolerating non-shell-safe lines.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE" 2>/dev/null || true
set +a

KEY_VAR="${PREFIX}_API_KEY"
URL_VAR="${PREFIX}_BASE_URL"
KEY="${!KEY_VAR:-}"
BASE_URL="${!URL_VAR:-}"

if [[ -z "$KEY" ]]; then
  echo "error: \$${KEY_VAR} not set in $ENV_FILE" >&2
  exit 2
fi
if [[ -z "$BASE_URL" ]]; then
  echo "error: \$${URL_VAR} not set in $ENV_FILE" >&2
  exit 2
fi

# Trim trailing slash from BASE_URL.
BASE_URL="${BASE_URL%/}"

echo "Provider prefix : ${PREFIX}"
echo "Base URL        : ${BASE_URL}"
echo "Key head/tail   : ${KEY:0:8}...${KEY: -4} (len=${#KEY})"
echo "Probe endpoint  : ${BASE_URL}/models"
echo

TMP_BODY="$(mktemp)"
trap 'rm -f "$TMP_BODY"' EXIT

HTTP_CODE=$(curl -sS -m 15 -o "$TMP_BODY" -w "%{http_code}" \
  "${BASE_URL}/models" \
  -H "Authorization: Bearer *** || echo "000")

echo "HTTP status     : ${HTTP_CODE}"
echo "--- body (first 500 bytes) ---"
head -c 500 "$TMP_BODY"
echo
echo "------------------------------"

case "$HTTP_CODE" in
  200)
    echo "VERDICT: key is valid at provider."
    echo "  If the app still errors, the problem is: stale process (restart),"
    echo "  wrong provider selected, or a proxy/gateway layer in between."
    exit 0
    ;;
  401)
    echo "VERDICT: key REJECTED by provider (invalid / expired / revoked)."
    echo "  User must issue a new key at the provider dashboard."
    echo "  Common cause: key expired, or key came from wrong platform"
    echo "  (e.g. OpenRouter tp-* key used against Xiaomi mimo endpoint)."
    exit 1
    ;;
  403)
    echo "VERDICT: key valid but request FORBIDDEN (IP/region/scope)."
    echo "  Check region variant of BASE_URL (e.g. token-plan-sgp.* vs api.*)."
    exit 1
    ;;
  429)
    echo "VERDICT: key valid but RATE-LIMITED / quota exhausted."
    exit 0
    ;;
  000)
    echo "VERDICT: network error — DNS failure, timeout, or wrong BASE_URL."
    echo "  Verify ${URL_VAR} points at the correct provider endpoint."
    exit 2
    ;;
  *)
    echo "VERDICT: unexpected status ${HTTP_CODE}. Inspect body above."
    exit 2
    ;;
esac
