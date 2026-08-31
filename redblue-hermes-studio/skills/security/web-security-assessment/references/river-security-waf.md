# 瑞数 WAF (River Security) — Fingerprint & Bypass Notes

## Fingerprint

瑞数信息 (River Security) is one of the most common WAFs on Chinese SOEs (telcos, banks, government). It is **hard to detect** because it hides its markers aggressively.

### Definitive Markers

| Signal | Value | Confidence |
|--------|-------|------------|
| HTTP status on blocked requests | **412 Precondition Failed** OR **403 Forbidden** (nginx-layer blocking) | High |
| Server header | `******` (masked with asterisks) | High |
| Response body contains | `$_ts` JavaScript challenge object | High |
| JS challenge file | `/KRuycjiwAeTp/<random>.js` (path segment varies) | High |
| Cookie name | Random-looking alphanumeric (e.g. `AQqfncsKBEKSO=...`) | Medium |
| Cookie flags | `Secure; HttpOnly; Path=/; expires=...` (10-year expiry) | Medium |
| Meta tag | `<meta id="EVPCSHfgI0hy" content="..." r='m'>` | Medium |

### Detection Command

```bash
curl -sI https://TARGET/ 2>&1 | head -10
# Look for: HTTP/1.1 412 + Server: ****** + Set-Cookie with random name

curl -s https://TARGET/ 2>&1 | grep -c '$_ts'
# Returns > 0 = River Security confirmed
```

### Behavioral Characteristics

1. **First visit**: Returns 412 with JS challenge page. Browser must execute JS to solve challenge and set cookie.
2. **Subsequent visits**: With valid cookie, returns actual content (200).
3. **Cookie expiry**: Typically set to expire ~10 years in the future.
4. **JS obfuscation**: Heavy — variables like `_$bx`, `_$_M`, `_$eN`, array-based control flow.
5. **No obvious WAF brand**: Unlike SafeDog or Alibaba WAF, River Security never names itself in responses.

### What Gets Blocked (412)

- Direct curl/wget requests without valid session cookie
- Automated scanners that don't execute JS
- API calls without first solving the JS challenge

### What Passes Through

- Requests with a valid `$_ts` cookie (set after JS challenge)
- Requests from browsers (JS auto-executes)
- Some PUT/DELETE methods may return 403 instead of 412

### Double-Layer Blocking Pattern

When 瑞数WAF is deployed behind Nginx, sensitive endpoints (e.g. Spring Boot Actuator) may be blocked at **two layers**:
- **Nginx layer**: Returns `403 Forbidden` with `Server: nginx` in body. The 瑞数 JS challenge is still injected into the 403 page.
- **WAF layer**: Returns `412 Precondition Failed` for requests without valid cookie.

### Observed 403 vs 400 Behavior (2026-06, wxzc.bjunicom.com.cn)

When both nginx and 瑞数 block actuator endpoints, different tools see different responses:

| Tool | Response | Explanation |
|------|----------|-------------|
| curl (no cookie) | 403 Forbidden + 瑞数 JS challenge | nginx block, WAF injects challenge |
| curl (with valid cookie) | 403 Forbidden + 瑞数 JS challenge | nginx still blocks, WAF re-challenges |
| Browser (valid session) | 400 Bad Request, empty body | WAF allows through, nginx rejects at app layer |

The 400 from browser (not 403) suggests the request passes the WAF but is rejected by the upstream application server — possibly because the actuator endpoint expects a different content type or authentication.

### Exhaustive Bypass Attempt Log (wxzc.bjunicom.com.cn, 2026-06)

All of the following were attempted and **FAILED** against a 瑞数 + nginx deployment:

| Method | Technique | Result |
|--------|-----------|--------|
| URL encoding | `/%61%63%74%75%61%74%6F%72/env` | 403 |
| Path traversal | `/pub/prod/signal/../../../../../actuator/env` | 403 |
| Semicolon | `/actuator;/env` | 403 |
| Dot suffix | `/actuator./env` | 403 |
| HTTP methods | GET, POST, PUT, OPTIONS, HEAD | All 403 |
| Prefixed paths | `/manage/actuator`, `/admin/actuator`, `/api/actuator`, `/service/actuator`, `/app/actuator`, `/pub/actuator`, `/signal/actuator`, `/prod/actuator` | All 403 |
| X-Forwarded-For | `192.168.10.1` | 403 |
| X-Real-IP | `192.168.10.1` | 403 |
| Googlebot UA | `Googlebot/2.1` | 403 |
| Full browser UA + headers | Chrome + Accept-Language + Accept-Encoding | 403 |
| Direct IP access | `https://202.96.18.81/actuator/env` | 403 |
| Cookie replay (curl) | Valid browser cookie in curl | 403 |
| Browser fetch() | In-page JavaScript fetch | 400 (empty body) |
| Browser XHR | Synchronous XMLHttpRequest | 400 (empty body) |

**Conclusion**: When 瑞数 WAF + nginx both block sensitive endpoints, NO bypass technique works from external testing. The only viable paths are:
1. Internal network access (bypass nginx rules)
2. Finding alternative endpoints not covered by nginx rules
3. Application-level vulnerabilities on non-blocked paths

### Bypass Approaches (Authorized Testing Only)

1. **Browser-based**: Use a real browser (or headless browser like Puppeteer/Playwright) to solve the JS challenge first, then extract cookies for subsequent requests.
2. **Cookie replay**: Visit the page in a browser, copy the `$_ts` cookie, use it in curl:
   ```bash
   # Get cookie from browser DevTools, then:
   curl -s -b "AQqfncsKBEKSO=<value>" https://TARGET/path
   ```
3. **Note**: The cookie value changes per visit (randomized). The JS challenge is non-trivial to solve programmatically without a JS runtime.

### Common Deployment Contexts

- China Unicom (北京联通, 山东联通, etc.)
- China Mobile
- China Merchants Bank
- Various government portals
- Often deployed alongside Nginx as reverse proxy

### Related Infrastructure

When River Security is detected, look for:
- Backend port 10001 (common River Security SSL port)
- SSL certificates from DigiCert/GeoTrust covering multiple internal domains
- Nginx as the upstream server (hidden behind `******`)
- Shared SSL certificates with wildcard SAN (e.g., `*.bjunicom.com.cn`) that may reveal associated domains

## Assessment Tips

- River Security blocks most automated scanning — **manual testing or browser-automated testing is required**
- Focus on the content served **behind** the WAF (use browser dev tools)
- The JS challenge page itself may leak information (framework versions, internal paths)
- Check if different HTTP methods bypass the WAF (PUT/DELETE sometimes get 403 instead of 412)
- River Security does NOT protect against application-level vulnerabilities (IDOR, business logic flaws, etc.) — it only blocks known attack patterns at the transport layer

### Browser-Based WAF Challenge Solving

When you need to solve the 瑞数 JS challenge to access behind-WAF content:

1. Navigate to the target in the browser (browser executes JS challenge automatically)
2. After page loads, extract the session cookie via `document.cookie`
3. Use the cookie for subsequent requests (cookie is valid for ~10 years)
4. Note: cookie value changes per visit — it's randomized

**Limitation**: Even with a valid browser session, nginx-layer blocks (403) persist for sensitive paths like `/actuator/*`. The browser may receive `400 Bad Request` with empty body instead.

### Spring Boot Actuator Behind 瑞数 WAF

Common pattern on Chinese SOE deployments:
- Actuator endpoints (`/actuator/env`, `/actuator/health`, etc.) exist but are blocked
- Nginx returns 403 with 瑞数 JS challenge injected
- All standard bypass attempts fail: URL encoding, path traversal, semicolon, dot, HTTP method changes, header spoofing
- **Conclusion**: When both nginx and 瑞数 block actuator, the endpoints are effectively inaccessible without internal network access

### DNS Information Leakage via Subdomains

When testing Chinese SOE domains, subdomains may resolve to internal IPs:
```bash
for sub in portal sso cloud m app h5 wap mini; do
  result=$(dig +short "${sub}.DOMAIN" 2>/dev/null | head -1)
  [ -n "$result" ] && echo "${sub}.DOMAIN -> $result"
done
# Example: portal.bjunicom.com.cn -> 192.168.10.37 (internal IP!)
```

This reveals internal network architecture and can be used for targeted attacks if combined with SSRF or VPN access.
