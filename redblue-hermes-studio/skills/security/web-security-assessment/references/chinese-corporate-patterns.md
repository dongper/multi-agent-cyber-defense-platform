# Chinese Corporate Website Infrastructure Patterns

Common infrastructure found on Chinese enterprise websites (telcos, banks, state-owned enterprises). Useful for recognizing components during security assessments.

## API Gateways / Web Servers

| Software | Server Header | Notes |
|----------|--------------|-------|
| **APISIX** | `Server: APISIX` | Apache APISIX, popular API gateway in China. Used by China Unicom (10010.com). Look for admin API on port 9080. |
| **OpenResty** | `Server: openresty` | Nginx + Lua. Extremely common. Used by China Unicom auth (uac.10010.com). |
| **TencentEdgeOne** | `Server: TencentEdgeOne` | Tencent CDN/WAF. Returns non-standard HTTP status codes (e.g., 567). DNS CNAME to `*.eo.dnse0.cn`. |
| **SafeDog (安全狗)** | Response body contains `safedog.cn` | Chinese WAF product. Common on smaller sites. |
| **Wangzhan Baba (网站卫士)** | `Server: wangzhanbaba` | 360 CDN/WAF. |
| **ChinaCache** | Various | CDN provider, look for `X-CC` headers. |
| **Alibaba Cloud WAF** | `eagleid` header | Alibaba CDN, common on Aliyun-hosted sites. |

## WAF Products

| WAF Product | Detection Method | Notes |
|-------------|-----------------|-------|
| **Alibaba Cloud WAF** | `Server: Tengine` + 405 status + `errors.aliyun.com` in body | Blocks sensitive file extensions (.json, .yml, .env), XSS payloads, JS protocol. Returns Chinese "很抱歉，由于您访问的URL有可能对网站造成安全威胁" message. Trace ID in page body. |
| **Yundun WAF (云盾)** | DNS CNAME to `*.yundunwaf*.com` | Used by admin.10010.com, mini.10010.com. Protects specific subdomains. |
| **TencentEdgeOne** | `Server: TencentEdgeOne` + DNS CNAME to `*.eo.dnse0.cn` | Returns non-standard status codes (567). CDN + WAF combo. |
| **SafeDog (安全狗)** | Response body contains `safedog.cn` | Chinese WAF product. Common on smaller sites. |
| **瑞数 (River Security)** | HTTP 412 + `Server: ******` + `$_ts` JS challenge | Very common on Chinese SOEs (telcos, banks). Hard to detect — no obvious markers. See `references/river-security-waf.md` for full fingerprint. |
| **Cloudflare** | `cf-ray` header, `server: cloudflare` | |

**WAF bypass notes**:
- Alibaba Cloud WAF blocks `<script>`, `javascript:`, `data:` URIs, sensitive file extensions
- BUT allows: plain alphanumeric JSONP callback names, path enumeration, framework error pages
- TencentEdgeOne is primarily CDN — its WAF rules are less aggressive
- Yundun protects specific subdomains (admin, mini) but not the main site
- **瑞数 WAF**: Header-based bypasses (X-Forwarded-For, custom UA) do NOT work. The WAF validates browser JS execution via `$_ts` challenge. Switch to browser-based testing or cookie replay.

## Spring Boot / Java Framework Detection

Chinese enterprise sites (especially telcos, banks) heavily use Java backends. Trigger a 404 to detect:
```json
{"timestamp":1782310616420,"status":404,"error":"Not Found","message":"No message available","path":"/api/endpoint"}
```
This pattern confirms Spring Boot and leaks the framework type + path structure.

**Key endpoints to check** (all may return 403 if WAF/nginx blocks them):
- `/actuator/env` — Environment variables (CRITICAL if accessible)
- `/actuator/health` — Health check (often unauthenticated)
- `/actuator/beans` — Spring beans (leaks architecture)
- `/actuator/mappings` — All URL mappings (leaks API structure)
- `/actuator/heapdump` — Heap dump (may contain secrets in memory)
- `/v2/api-docs`, `/v3/api-docs` — OpenAPI/Swagger spec
- `/swagger-resources` — Swagger resource listing

**403 vs 404 distinction**: A 403 means the endpoint EXISTS but is blocked. A 404 means it doesn't exist. When actuator/swagger endpoints return 403, the backend has these enabled — document as a finding because WAF rules can change.

## Government Accessibility Plugin (无障碍插件)

Many Chinese government and SOE websites load `gov.govwza.cn/dist/aria.js` — an accessibility plugin (读屏软件) required by Chinese accessibility regulations. The `appid` parameter is exposed in the script tag but is low-risk (it's a public-facing configuration, not a secret).

## CDN / DNS Patterns

| CDN | DNS CNAME Pattern | Notes |
|-----|-------------------|-------|
| Tencent EdgeOne | `*.eo.dnse0.cn` | China Unicom uses this |
| Alibaba CDN | `*.kunlun.com` or `*.alikunlun.com` | |
| ChinaCache | `*.chinacache.net` | |
| Baidu CDN | `*.bdydns.com` or `*.jomodns.com` | |
| Wangsu (网宿) | `*.wscdns.com` or `*.wsglb0.com` | |

## Monitoring / APM

| Product | JS Pattern | Notes |
|---------|-----------|-------|
| **听云 (TINGYUN)** | `window.TINGYUN`, `setApp({token:...})` | Very common APM. Token/key/ID often hardcoded in obfuscated JS. Look for `beacon` URL. |
| **Fundebug** | `fundebug.com` | Error monitoring, API key in JS. |
| **Sentry** | `sentry.io`, `dsn:` | Error tracking, DSN in JS. |
| **GrowingIO** | `gio(...)` | Analytics, often has project ID in JS. |
| **神策 (Sensors Analytics)** | `sa.track(...)`, `sensorsdata.cn` | Analytics platform. |
| **诸葛 (Zhuge)** | `zhugeio.com` | Analytics. |
| **百度统计** | `hm.baidu.com` | Baidu analytics, site ID in JS. |

## Login / Auth Patterns

- **uac.10010.com** style: Separate auth subdomain (`uac.`, `passport.`, `sso.`, `login.`)
- **Portal JSP**: `/portal/mallLogin.jsp` pattern (Java-based, often OpenResty frontend)
- **redirectURL parameter**: Check for open redirect vuln: `?redirectURL=https://evil.com`
- **X-Frame-Options: ALLOW-FROM**: Deprecated syntax still used by many Chinese sites. Browsers ignore it — only CSP `frame-ancestors` works.

## Common Path Patterns (Chinese sites)

| Path | Purpose | Notes |
|------|---------|-------|
| `/e3/`, `/e4/`, `/e5/` | Legacy service portals | Common on Unicom sites, versioned |
| `/wt_service_web/` | Web terminal service | China Unicom specific |
| `/emallsupport/` | E-commerce support backend | China Unicom |
| `/mgw/` | Internal API gateway | Short hostname pattern |
| `/bin/` | Legacy binary/CGI paths | Often in robots.txt |
| `/act/` | Activity/campaign pages | Common redirect target |
| `/pub/signal/` | 北分信息采集小程序 API | wxzc.bjunicom.com.cn specific |

## TLS / Certificate Patterns

- **DigiCert OV**: Most large Chinese enterprises use DigiCert or CFCA (中金金融认证) for SSL
- **通配符证书**: `*.domain.com` covering all subdomains is standard
- **Certificate expiry**: Often manually renewed — check expiration dates!
- **TLS 1.0/1.1**: Older sites may still support deprecated protocols
- **SAN (Subject Alternative Name)**: Always extract and analyze — reveals related domains, test environments, and vendor infrastructure

## Vue.js H5 Template Fingerprint

Many Chinese mobile H5 sites use the `vue-h5-template` boilerplate with:
- vantUI component library
- webpack bundling with chunk splitting
- Configuration object pattern: `{title, baseUrl, baseApi, APPID, APPSECRET, $cdn}`
- Routes: `/`, `/index`, `/detial`, `/charts`, `/homeNext`, `/ranks`

**JS extraction pattern**:
```bash
# Extract config object
curl -s https://DOMAIN/js/app.HASH.js | grep -oE '\{[^{}]*(baseUrl|baseApi|APPID|APPSECRET)[^{}]*\}'
# Extract routes
curl -s https://DOMAIN/js/app.HASH.js | grep -oiE '(path|route)[^,;]{0,50}'
```

---

## China Unicom Beijing (北京联通) Digital Department Infrastructure

Specific patterns from 2026 Q2 exposure assessment. All assets belong to 数字化部 (Digital Department).

### Domain → IP Mapping

| Domain | IP | Port | System | WAF |
|--------|-----|------|--------|-----|
| wxzc.bjunicom.com.cn | 202.96.18.81 | 443 | 北分信息采集小程序 | River Security |
| itdiy.bjunicom.com.cn | 202.96.18.81 | 443 | IT随心定 | River Security |
| kzt.bjunicom.com.cn | 202.96.18.48 | 443 | 智慧门户(新版) | River Security |
| moa.bjunicom.com.cn | 202.96.18.111 | 8443/11502 | MOA系统 | River Security |
| jingkai.bjunicom.com.cn | 123.112.72.222 | 9002 | 反诈工作台 | 已防护 |
| ygbiz.bjunicom.com.cn | 202.96.18.43 | 80/443 | 员工自助BI | 已防护 |
| bjzqfwdt.bjunicom.com.cn | 123.112.72.180 | 50101 | 北京政企智慧运营 | 未防护 |

### Internal IP Leaks

| Domain | Internal IP | Source |
|--------|------------|--------|
| portal.bjunicom.com.cn | 192.168.10.37 | DNS A record |
| dns.bjunicom.com.cn | 202.96.18.1 | DNS server |

### DNS Infrastructure

- **NS**: ns1.bjunicom.com.cn, ns2.bjunicom.com.cn, ns.btaic.bta.net.cn
- **MX**: mxbiz1.qq.com (10), mxbiz2.qq.com (20) — QQ企业邮箱
- **Zone transfer**: Blocked (timeout)

### SSL Certificate Info

- **CN**: www.uuspeed.net (上海迪安科技)
- **Issuer**: DigiCert GeoTrust G2 TLS CN RSA4096 SHA256 2022 CA1
- **SAN includes**: *.bjunicom.com.cn, *.uuspeed.net, uuspeed.net, hcm.kpi365.com, nms001.vpnplus.cn, www.kata100.net, qatest.uuspeed.net, contacts.aolc.cn, m.uuspeed.com, sdwan.vpnplus.cn, www.okr365.com, www.kpi365.com, portal.uuspeed.net, bjzqorder.chinaunicom.cn, cloud.uuspeed.net, bj.mail.chinaunicom.cn, www.aolc.cn, sso.cloud.bjunicom.com.cn, bj-portal.chinaunicom.cn, mail.aolc.cn, xcx.tomatoxfive.com, mdm.aolc.cn, ka.aolc.cn, engibot.totalrice.com

### API Pattern: /pub/signal/*

The 北分信息采集小程序 exposes 28+ API endpoints under `/pub/signal/` — all accessible without authentication:
The frontend is a Vue.js H5 template (vue-h5-template) with vantUI, webpack-bundled, with hardcoded placeholder config:
```javascript
{title:"vue-h5-template",baseUrl:"https://www.xxx.com/",baseApi:"https://www.xxx.com/api",APPID:"xxx",APPSECRET:"xxx",$cdn:"https://imgs.solui.cn"}
```

```
/pub/signal/wxLogin          # 微信登录
/pub/signal/qyLogin          # 企业微信登录 ← leaks internal IP + error codes
/pub/signal/approve          # 审批
/pub/signal/report           # 上报
/pub/signal/detail           # 详情
/pub/signal/search           # 搜索
/pub/signal/feedback         # 反馈
/pub/signal/evaluate         # 评价
/pub/signal/urge             # 催办
/pub/signal/getAllRankingList # 排行榜
/pub/signal/getRankingLists  # 排行榜列表
```

All return HTTP 200 but with `{"code":9999,"message":"系统内部异常","data":null}` when no valid WeChat session. The qyLogin endpoint is the most dangerous — it leaks the server IP in error responses.

### Backend Technology

- **Framework**: Vue.js SPA (webpack-bundled)
- **Backend**: Spring Boot (evidenced by `/actuator` returning 403)
- **WAF**: River Security (瑞数) on most assets
- **SSL**: DigiCert GeoTrust G2, certificate covers `*.bjunicom.com.cn` and `*.uuspeed.net`
- **Vendors**: 自研 (self-built), 志远升科, 北京东方国信科技, 深圳天源迪科

### Security Assessment Notes

- River Security WAF blocks automated scanning — use browser or cookie replay
- The `/pub/s6/` and `/pub/s15/` paths return 302 redirects (其他小程序)
- `/pub/ifm/repair/order/external` returns 404 (removed or relocated)
- MOA系统 on port 11502 exposes JSP pages directly
- 反诈工作台 (jingkai.bjunicom.com.cn:9002) has extensive API surface under `/delicacyApp/`

---

## Key Findings from China Unicom (10010.com) Assessment

Specific patterns observed:
- Main site: APISIX gateway → Vue 2.7.14 SPA → 听云 APM
- Auth: OpenResty → JSP login page with obfuscated JS containing APM tokens
- CDN: TencentEdgeOne with `eo.dnse0.cn` DNS
- Backend port 9080 leaked via 301 redirects from `/test` and `/e4/index`
- Internal gateway `http://mgw/` referenced in frontend JS
- Test environment `ecstest2018.10010.com` in production JS bundles
- CORS `*` on all responses, cookies missing `Secure` and `SameSite`
- No HSTS, no HTTP→HTTPS redirect, missing all standard security headers
