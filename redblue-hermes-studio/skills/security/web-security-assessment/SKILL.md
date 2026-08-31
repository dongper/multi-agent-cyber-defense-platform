---
name: web-security-assessment
description: "Basic web security assessment using CLI tools — HTTP headers, SSL, WAF detection, path enumeration, JS analysis, port checks. Use when the user asks to scan, audit, check, or assess a website/domain for vulnerabilities or security issues (NOT CTF challenges)."
triggers:
  - "scan this website for vulnerabilities"
  - "check the security of"
  - "do a security assessment"
  - "audit this domain"
  - "any vulnerabilities on"
  - "看看有什么漏洞"
  - "安全检查"
  - "安全评估"
  - "渗透测试"
  - "安全审计"
---

# Web Security Assessment (CLI-Based)

Quick, structured security reconnaissance using command-line tools. This is **basic assessment**, not a replacement for professional scanners (Nuclei, Nessus, Burp Suite).

## Prerequisites

- curl, openssl, dig (usually pre-installed on macOS/Linux)
- Optional: nmap for deeper port scanning
- Optional: python3 + openpyxl for bulk IP scanning from Excel files

## Reference Files

- `references/river-security-waf.md` — 瑞数WAF fingerprint, bypass analysis, double-layer blocking patterns
- `references/penetration-testing-techniques.md` — Active attack techniques (JSONP, clickjacking, SSRF, etc.)
- `references/chinese-corporate-patterns.md` — Common Chinese SOE infrastructure patterns
- `references/infrastructure-recon.md` — DNS leakage, SSL SAN analysis, subdomain enumeration, port scanning patterns

## Bulk IP Scanning Workflow

When given an Excel file with IP addresses (common for quarterly exposure assessments):

```bash
# Step 1: Install openpyxl if needed
pip3 install openpyxl -q

# Step 2: Extract IPs from Excel
python3 -c "
import openpyxl
wb = openpyxl.load_workbook('input.xlsx')
for sheet in wb.sheetnames:
    ws = wb[sheet]
    for row in ws.iter_rows(values_only=True):
        # Find column with IP addresses (usually '公网IP' or '资产公网IP')
        for cell in row:
            if cell and '.' in str(cell) and any(c.isdigit() for c in str(cell)):
                print(cell)
" | sort -u > targets.txt

# Step 3: Quick port scan on all targets
while read ip; do
  result=$(nmap -Pn -sT --top-ports 20 -T4 "$ip" 2>/dev/null | grep "open")
  [ -n "$result" ] && echo "=== $ip ===" && echo "$result"
done < targets.txt

# Step 4: HTTP header check on open ports
while read ip; do
  for port in 80 443 8080 8443 9002; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "https://${ip}:${port}/" 2>/dev/null)
    [ "$code" != "000" ] && echo "$code https://${ip}:${port}/"
  done
done < targets.txt
```

**PITFALL**: Excel files may have multiple sheets. The '清单' (inventory) sheet usually contains the detailed asset info (域名, 端口, URL, 负责人). The first sheet often has summary/grouping data.

## Workflow — Progressive Disclosure

**User preference**: After the initial batch of parallel checks (Steps 1-5), PAUSE and present findings before diving deeper. The user wants to review what's been found so far and decide which issues to investigate further. Do NOT dump all 9 steps at once — show results, summarize, then ask "shall I continue digging into X?"

## Workflow (Execute in Order)

### Step 1: HTTP Headers & Server Fingerprint

```bash
curl -sI https://TARGET_URL 2>&1
```

Look for:
- Server type (nginx, Apache, IIS, openresty)
- X-Powered-By (PHP, Express, ASP.NET — info leak)
- Missing security headers

### Step 2: SSL/TLS Certificate Check

```bash
# Full certificate info including SAN (Subject Alternative Name)
echo | openssl s_client -connect DOMAIN:443 -servername DOMAIN 2>/dev/null | openssl x509 -noout -text 2>&1 | grep -A2 "Subject Alternative Name"
```

The SAN field reveals all domains covered by the certificate — often exposing related infrastructure, test environments, and internal domains. Common findings:
- `*.domain.com` wildcard covering all subdomains
- Shared certificates with unrelated domains (vendor/CDN infrastructure)
- Test/staging domains (e.g., `qatest.vendor.com`)
- Internal service domains (e.g., `sso.cloud.domain.com`)

### Step 3: Security Response Headers

```bash
curl -s -D- -o /dev/null https://TARGET_URL 2>&1 | grep -i -E "(strict-transport|x-frame|x-content-type|x-xss|content-security|referrer-policy|permissions-policy|server:|x-powered)"
```

Missing headers to flag:
- `Strict-Transport-Security` (HSTS)
- `X-Frame-Options` (clickjacking)
- `X-Content-Type-Options` (MIME sniffing)
- `Content-Security-Policy` (XSS)
- `Referrer-Policy`
- `Permissions-Policy`

### Step 4: robots.txt & Information Disclosure

```bash
curl -s https://DOMAIN/robots.txt 2>&1 | head -20
```

Check if sensitive paths are disallowed or if it reveals hidden directories.

### Step 5: Sensitive Path Enumeration

Automated script available: `scripts/path-scan.sh` (run with `bash scripts/path-scan.sh <domain>`)

```bash
for path in /admin /api /wp-admin /.env /.git/config /backup /test /debug /console /phpmyadmin /server-status /.svn/entries \
  /actuator /actuator/env /actuator/health /actuator/beans /actuator/mappings /actuator/heapdump \
  /v2/api-docs /v3/api-docs /swagger-resources /swagger-ui.html /doc.html /api-docs; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://DOMAIN${path}" 2>/dev/null)
  echo "$path -> $code"
done
```

**PITFALL: 403 ≠ 404**. A 403 Forbidden means the endpoint **EXISTS** but is blocked (by WAF, nginx, or ACL). A 404 means it doesn't exist. When you see `/actuator` or `/v2/api-docs` returning 403, the backend has these endpoints enabled — the WAF/nginx is just blocking external access. This is still a finding because:
- WAF rules can change or be bypassed
- Internal users may access without WAF
- The endpoint confirms the backend framework (Spring Boot, etc.)

**PITFALL**: SPA/React apps return 200 for ALL paths (serving index.html). Check response body to distinguish real hits from SPA catch-all:
```bash
curl -s https://DOMAIN/.env | head -5
# If it returns HTML with <div id="root">, it's SPA routing, not a real .env file
```

### Step 6: WAF Detection
## Step 6: WAF Detection

If path enumeration hits a "firewall" or "blocked" page, you have a WAF. Check response body for:
- 瑞数 (River Security): **412 status** + `Server: ******` + `$_ts` JS challenge in body → see `references/river-security-waf.md` for full fingerprint & bypass
- SafeDog (安全狗): look for `safedog.cn` in response
- Cloudflare: `cf-ray` header
- AWS WAF: `x-amzn-requestid`
- ModSecurity: `mod_security` in error pages

**PITFALL**: 瑞数 WAF returns 412 OR 403 depending on deployment. When nginx is layered in front, sensitive endpoints (e.g., `/actuator/*`) return `403 Forbidden` from nginx even after the WAF challenge is solved. Browser-based access to such endpoints may yield `400 Bad Request` with empty body. Cookie replay bypasses do NOT work against nginx-layer blocks. See `references/river-security-waf.md` for full fingerprint and bypass analysis.

### Step 1.5: TLS Version & Cipher Check

Test which TLS versions the server supports:

```bash
for ver in tls1 tls1_1 tls1_2 tls1_3; do
  echo "--- $ver ---"
  echo | openssl s_client -connect DOMAIN:443 -servername DOMAIN -$ver 2>&1 | grep -E "(Protocol|Cipher)" | head -2
done
```

- TLS 1.0/1.1 support = Medium risk (deprecated, POODLE/BEAST)
- Only TLS 1.2+ = Good
- Check cipher suite: `ECDHE-RSA-AES256-GCM-SHA384` is strong; `RC4`, `DES`, `NULL` = Critical

### Step 2.5: HTTP → HTTPS Redirect Check

```bash
curl -sIL --max-redirs 5 http://DOMAIN 2>&1 | grep -E "(HTTP/|location:|Location:)"
```

Check if HTTP redirects to HTTPS (301/302 → https://). If it stays on http://, flag as High risk.

### Step 3.5: Cookie Security Analysis

```bash
curl -s -D- -o /dev/null https://DOMAIN 2>&1 | grep -i "set-cookie"
```

Check each cookie for:
- `Secure` flag (missing = cookie sent over HTTP)
- `HttpOnly` flag (missing = readable by JS)
- `SameSite` attribute (missing = CSRF risk in old browsers)
- `Path` scope (path=/ is overly broad)

### Step 6.5: CORS Configuration Test

```bash
curl -s -I -H "Origin: https://evil.com" https://DOMAIN/page 2>&1 | grep -i "access-control"
```

- `Access-Control-Allow-Origin: *` = High risk (especially with cookies)
- `Access-Control-Allow-Origin: https://evil.com` with `Allow-Credentials: true` = Critical
- `*` wildcard + `Set-Cookie` on same responses = dangerous combo

### 7. JavaScript/Bundle Analysis

For SPA sites, grab the main JS bundle. See `references/vue-spa-analysis.md` for full Vue.js/React SPA analysis workflow including vue-h5-template config extraction, Vuex store analysis, and API endpoint discovery.

```bash
# Find JS URL from HTML source
curl -s https://DOMAIN/ | grep -o 'src="/static/js/[^"]*"'
# Then fetch and grep
curl -s https://DOMAIN/static/js/main.HASH.js | grep -i -E "(api|key|secret|token|password|admin|internal)" | head -20
```

Look for:
- Internal API endpoints (especially `/emallsupport/`, `/mgw/`, `/api/internal/`)
- Hardcoded tokens/keys (APM tokens like TINGYUN/听云, Sentry DSN, analytics keys)
- Internal hostnames/domains (e.g., `http://mgw/`, `http://internal-gateway/`)
- Test/staging environment URLs (e.g., `ecstest*.domain.com`, `staging.*`, `pre.*`)
- Debug flags (`debug: true`, `NODE_ENV`, `VUE_APP_DEBUG`)
- API base URLs that reveal internal architecture (`baseURL`, `BaseURL`, `baseUrl`)
- **Configuration objects**: Search for entire config blocks that may leak multiple secrets at once

**Additional patterns to grep for**:
```bash
# Extract ALL URLs from JS bundles
curl -s https://DOMAIN/js/app.HASH.js 2>&1 | grep -oiE '(https?://[a-zA-Z0-9._/-]+)' | sort -u

# Check DLL/vendor bundles for framework versions
curl -s https://DOMAIN/library/library_*.dll.js 2>&1 | grep -oE '"[0-9]+\\.[0-9]+\\.[0-9]+"' | head -10

# Search for obfuscated APM/monitoring configs (common in Chinese sites)
# Look for: setApp, TINGYUN, token, beacon, key, id patterns in minified code
curl -s https://DOMAIN/login-page 2>&1 | grep -oE '(token|key|beacon|setApp|TINGYUN|sentry|dsn)[^,;]*' | head -20

# Follow redirects to find internal ports
curl -sI https://DOMAIN/path 2>&1 | grep -i "location:"
# If location contains :PORT (e.g., :9080, :8080), the internal port is leaked
```

#### Vue.js / Webpack SPA-Specific Analysis

For Vue/React/Webpack SPAs, extract deeper intelligence:

```bash
# Extract Vue router paths (reveals app structure)
curl -s https://DOMAIN/static/js/app.HASH.js 2>&1 | grep -oE 'path:"[^"]*"' | sort -u

# Extract configuration objects (baseUrl, API URLs, APPID, APPSECRET)
curl -s https://DOMAIN/static/js/app.HASH.js 2>&1 | grep -oE '\{[^{}]*(baseUrl|baseApi|APPID|APPSECRET|cdn)[^{}]*\}'

# Extract axios/fetch configuration
curl -s https://DOMAIN/static/js/app.HASH.js 2>&1 | grep -oiE '(baseUrl|baseApi|APPID|APPSECRET|cdn)[^,;]{0,100}'

# List all webpack chunk files (reveals module structure)
curl -s https://DOMAIN/static/js/app.HASH.js 2>&1 | grep -oE 'chunk-[a-z0-9]+":"[a-z0-9]+"' | sort -u

# Check each chunk for API endpoints
for chunk in $(curl -s https://DOMAIN/static/js/app.HASH.js 2>&1 | grep -oE 'chunk-[a-z0-9]+' | sort -u); do
  echo "=== $chunk ==="
  curl -s "https://DOMAIN/static/js/${chunk}.*.js" 2>&1 | grep -oiE '(https?://[a-zA-Z0-9._/-]+|/api/[a-zA-Z0-9/._-]+)' | sort -u | head -5
done
```

**PITFALL**: Vue.js SPA routes (e.g., `/index`, `/charts`, `/ranks`) return 404 when accessed directly on the server — they are client-side routes served by the SPA's `index.html`. Don't waste time enumerating them as server paths. Instead, use browser navigation (`#/route`) to trigger XHR requests and discover actual API endpoints.
curl -s https://DOMAIN/js/app.HASH.js 2>&1 | grep -oiE '(path|route|router)[^,;]{0,50}' | head -20

# Follow redirects to find internal ports
curl -sI https://DOMAIN/path 2>&1 | grep -i "location:"
# If location contains :PORT (e.g., :9080, :8080), the internal port is leaked
```

### Step 8: DNS & Infrastructure

```bash
# IP resolution
dig DOMAIN +short

# Subdomain hints (may timeout on restrictive DNS)
dig DOMAIN ANY +short

# DNS zone transfer test (AXFR) — if successful, dumps ALL DNS records
# First find NS servers
dig DOMAIN NS +short
# Then test AXFR against each NS
dig @ns1.DOMAIN DOMAIN AXFR +short
```

**PITFALL**: DNS zone transfers (AXFR) are often blocked but worth testing — if successful, they dump the complete DNS zone including internal hostnames, mail servers, and service records.

### Step 9: Port Check (Basic)

**PITFALL**: If `ping` succeeds but nmap reports "Host seems down", the target blocks ICMP-based host discovery. Use `-Pn` to skip host discovery:
```bash
nmap -Pn -sT --top-ports 1000 -T4 TARGET_IP
```
For heavily firewalled targets, start with `--top-ports 100` (fast), then expand to `--top-ports 1000` if few results. Full port scans (`-p-`) can timeout on filtered targets — avoid unless needed.

```bash
# Quick check of common ports via HTTP
IP=$(dig DOMAIN +short)
for port in 80 443 8080 8443 3306 6379 22 27017; do
  result=$(curl -s --connect-timeout 3 "http://$IP:$port" -o /dev/null -w "%{http_code}" 2>/dev/null)
  echo "Port $port -> HTTP $result"
done
```

Exposed database ports (3306/MySQL, 6379/Redis, 27017/MongoDB) or SSH (22) are high-risk findings.

## Risk Classification

| Finding | Risk Level |
|---------|------------|
| SSL cert expiring < 30 days | Critical |
| Exposed database ports | Critical |
| .env / .git accessible | Critical |
| Actuator/env accessible (leaks env vars, DB creds) | Critical |
| Swagger/OpenAPI accessible (leaks full API spec) | High |
| JSONP callback injection (arbitrary function name) | High |
| No HTTP→HTTPS redirect | High |
| No HSTS header | High |
| CORS wildcard (`*`) + Cookies | High |
| Cookie missing Secure flag | High |
| Actuator endpoints returning 403 (exist but blocked) | Medium |
| Swagger/OpenAPI returning 403 (exist but blocked) | Medium |
| Open redirect on login page | Medium |
| Clickjacking (no X-Frame-Options or CSP) | Medium |
| Spring Boot default error page (framework leak) | Medium |
| Login page without rate limiting | Medium |
| Internal IP address in JavaScript | Medium |
| Test/staging environment URLs in JS | Medium |
| Unauthenticated API endpoints (customer center, etc.) | Medium |
| Missing HSTS | Medium |
| Missing CSP | Medium |
| Missing X-Frame-Options | Medium |
| APM/monitoring tokens in JS | Medium |
| Deprecated X-Frame-Options syntax (ALLOW-FROM) | Medium |
| Server version disclosure | Low |
| Internal API paths in JS | Low-Medium |
| Outdated jQuery/framework version | Low |
| robots.txt revealing hidden paths | Low |
| Internal ports leaked via redirects | Low |
| Government accessibility plugin appid | Low |
| WAF present | Positive |
| Only 80/443 open | Positive |

## Report Generation

When the user asks for a Word/DOCX report, generate it with python-docx. Structure:
1. 评估概述 (Assessment Overview)
2. 目标信息 (Target Info table)
3. 风险总览 (Risk Summary table: count by severity)
4. 严重/高危/中危/低危 sections (each finding with risk badge, evidence, impact analysis)
5. 修复建议汇总 (Remediation table: #, issue, risk, fix, priority P0-P3)
6. 附录：评估工具与方法 (Appendix: tools used)

**PITFALL**: `execute_code` sandbox does NOT have python-docx. Use `terminal` + script file instead:
```bash
pip3 install python-docx -q  # install first
# Template available: templates/security-report-template.py — copy and customize
python3 /tmp/gen_report.py
```

Report structure (Chinese 5-section format):
1. 评估概述 → 2. 目标信息 → 3. 风险总览 → 4-7. 分级详述 → 8. 修复建议汇总 → 附录

## Step 10: Active Penetration Testing

When authorized for active testing, go beyond reconnaissance. See `references/penetration-testing-techniques.md` for full attack-by-attack recipes (JSONP injection, Clickjacking PoC, Open Redirect, Login security, SSRF, WebSocket, WAF rule mapping, framework fingerprinting).

### 10a. JSONP Callback Injection

```bash
# Test if API endpoints accept arbitrary callback names
curl -s "https://DOMAIN/api/endpoint?callback=alert"
# If response is: alert({...data...})  →  VULNERABLE
# If response is: {...data...}          →  Not JSONP
```

**PITFALL**: WAFs block `<script>` and `document.location` in callback but allow plain function names. Test with benign names first (`callback=test123`), then escalate.

### 10b. Clickjacking PoC

```bash
# Verify no frame protection
curl -sI https://DOMAIN/page | grep -iE "(x-frame|frame-ancestors)"
# If empty → generate PoC HTML with transparent iframe
```

### 10c. Open Redirect Testing

```bash
# Test redirectURL parameter on login pages
for payload in "https://evil.com" "//evil.com" "javascript:alert(1)" "data:text/html,<script>alert(1)</script>"; do
  curl -sI "https://DOMAIN/login?redirectURL=$payload" | head -5
done
# Check if payload is reflected in page body or triggers redirect
```

### 10d. Login Page Security

```bash
# Rate limiting test
for i in $(seq 1 5); do
  curl -s -o /dev/null -w "%{http_code}" "https://DOMAIN/login"
done
# CSRF token check
curl -s "https://DOMAIN/login" | grep -oiE '(csrf|_token|authenticity|nonce)'
# Autocomplete on password fields
curl -s "https://DOMAIN/login" | grep -oiE 'autocomplete="[^"]*"'
```

### 10e. Subdomain Enumeration

```bash
# Extended wordlist — covers devops, security, business terms
for sub in www api uac admin test dev staging beta app mobile web portal sso login \
  monitor analytics grafana prometheus jenkins gitlab ci cd docker k8s \
  wap mini h5 club act es redis mysql mongo gateway gw node; do
  result=$(dig +short "${sub}.DOMAIN" | head -1)
  [ -n "$result" ] && echo "${sub}.DOMAIN -> $result"
done
```

**PITFALL**: CNAME to `*.yundunwaf*.com` or `*.eo.dnse0.cn` means the subdomain exists behind a WAF. Don't skip it — the WAF-protected admin panel is still an attack surface.

### 10f. Spring Boot / Java Framework Detection

```bash
# Access non-existent API to trigger default error page
curl -s "https://DOMAIN/nonexistent-path-12345"
# Look for: {"timestamp":...,"status":404,"error":"Not Found","path":"..."}
# This confirms Spring Boot and leaks framework info
```

### 10g. WAF Bypass Analysis

After detecting a WAF, map its rules:
```bash
# Test what gets blocked vs what passes
for payload in "<script>" "javascript:" "document.location" "callback=test" \
  "callback=<script>" ".json" ".yml" ".env"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://DOMAIN/test?x=$payload")
  echo "$payload -> $code"
done
# 405 = WAF blocked, 200/301/302 = passed through, 404 = not found
```

## Important Caveats

1. **This is reconnaissance, not penetration testing.** Real vuln scanning requires tools like Nuclei, Nuclei, Burp Suite, or OWASP ZAP.
2. **Always confirm authorization** before scanning. Unauthorized scanning may violate laws/company policy.
3. **SPA catch-all**: Modern React/Vue apps return 200 for every path. Always verify response body content.
4. **Rate limiting**: Some WAFs will block rapid requests. Add delays if scanning multiple paths.
5. **Redirect chain leaks**: When paths redirect (301/302), the `Location` header may expose internal ports, hostnames, or protocols. Always follow and log the full redirect chain.
6. **Obfuscated JS ≠ secure**: Login pages often use JS obfuscation (e.g., `_0x452f` variable names) to "hide" APM tokens and config. These are trivially reversible — always grep the raw JS for patterns like `token`, `key`, `beacon`, `setApp`.
7. **CORS + Cookie combo**: A site with `Access-Control-Allow-Origin: *` AND `Set-Cookie` on the same response is a high-risk pattern even if `*` doesn't directly leak cookies to credentialed cross-origin requests — it signals a permissive security posture.
8. **瑞数 WAF false sense of security**: When 瑞数 WAF is detected (412 + `******` server), don't assume the site is fully protected. The WAF doesn't add security headers (HSTS, X-Frame-Options, CSP) — these are still missing and exploitable. Also check SSL certificates for information leakage — WAFs don't protect metadata.
9. **Chinese corporate site patterns**: See `references/chinese-corporate-patterns.md` for common infrastructure (APISIX, TencentEdgeOne, OpenResty, 听云 APM, etc.).
10. **瑞数 WAF deep dive**: See `references/river-security-waf.md` for full fingerprint, bypass analysis, and assessment approach.

## Recommended Professional Tools

- **Nuclei**: Template-based vuln scanner, huge template library
- **OWASP ZAP**: Free web app security scanner
- **Nikto**: Web server scanner
- **SQLMap**: SQL injection testing
- **Nessus/Tenable**: Commercial vulnerability scanner
