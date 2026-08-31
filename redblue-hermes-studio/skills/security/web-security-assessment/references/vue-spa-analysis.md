# Vue.js / React SPA Security Analysis

## Overview

Single Page Applications (SPAs) built with Vue.js, React, or Angular often expose sensitive information in their JavaScript bundles. This reference covers how to extract and analyze this information during security assessments.

## Detection

```bash
# Check if the page is a SPA
curl -s https://TARGET/ | grep -oE '<div id="(app|root|__next)">'
# Vue: <div id="app">
# React: <div id="root">
# Next.js: <div id="__next">
```

## JS Bundle Discovery

```bash
# Step 1: Find all JS files from HTML source
curl -s https://TARGET/ | grep -oE 'src="[^"]*\.js"' | sort -u

# Step 2: Check for webpack chunk files
curl -s https://TARGET/ | grep -oE 'static/js/[^"]*\.js' | sort -u

# Step 3: Download and analyze each bundle
for js in $(curl -s https://TARGET/ | grep -oE 'src="[^"]*\.js"' | grep -oE '"[^"]*"' | tr -d '"'); do
  echo "=== $js ==="
  curl -s "https://TARGET${js}" | head -c 1000
done
```

## Configuration Extraction

### vue-h5-template Pattern

Many Chinese mobile H5 applications use the `vue-h5-template` framework. Configuration is typically found in the main `app.js` bundle:

```bash
# Extract configuration object
curl -s https://TARGET/static/js/app.*.js | grep -oE '\{[^{}]*(baseUrl|baseApi|APPID|APPSECRET)[^{}]*\}'
```

**Typical leaked configuration**:
```javascript
{
  title: "vue-h5-template",
  baseUrl: "https://api.example.com/",     // API base URL
  baseApi: "https://api.example.com/api",  // API endpoint
  APPID: "wx1234567890",                   // WeChat AppID
  APPSECRET: "abcdef123456",               // WeChat AppSecret (CRITICAL!)
  $cdn: "https://cdn.example.com"          // CDN domain
}
```

**Risk levels**:
- `baseUrl` / `baseApi`: Low (reveals API architecture)
- `APPID`: Low (public, but confirms WeChat integration)
- `APPSECRET`: **CRITICAL** (can be used to impersonate the WeChat app)
- `$cdn`: Low (reveals CDN infrastructure)

### WeChat/WeCom Integration Detection

```bash
# Search for WeChat-related configuration
curl -s https://TARGET/static/js/app.*.js | grep -oiE '(appid|appsecret|wechat|wecom|corpid|corpsecret)[^,;]{0,50}'
```

## Vue Router Extraction

```bash
# Extract Vue router paths
curl -s https://TARGET/static/js/app.*.js | grep -oE 'path:"[^"]*"' | sort -u

# Example output:
# path:"/"
# path:"/index"
# path:"/detial"    <-- note: often has typos!
# path:"/charts"
# path:"/ranks"
```

**Pitfall**: SPA routes return 200 for ALL paths (catch-all routing). To distinguish real API endpoints from SPA routes:
```bash
# Check if response is JSON (API) or HTML (SPA route)
curl -s https://TARGET/api/endpoint | head -1 | grep -q "^{" && echo "JSON API" || echo "SPA route"
```

## API Endpoint Discovery

```bash
# Search for API calls in JS bundles
curl -s https://TARGET/static/js/app.*.js | grep -oiE '(axios|fetch|request|get|post)[^,;]{0,100}' | head -20

# Search for URL patterns
curl -s https://TARGET/static/js/app.*.js | grep -oiE '"/[a-zA-Z]+/[a-zA-Z/]*"' | sort -u

# Search for all URLs
curl -s https://TARGET/static/js/app.*.js | grep -oiE 'https?://[a-zA-Z0-9._/-]+' | sort -u
```

## Vuex Store Analysis

```bash
# Extract Vuex store modules (reveals application state structure)
curl -s https://TARGET/static/js/app.*.js | grep -oE 'mutations:\{[^}]*\}' | head -5

# Look for sensitive state fields
curl -s https://TARGET/static/js/app.*.js | grep -oiE '(user|token|auth|admin|role|permission)[^,;]{0,50}'
```

## EncryUtil / Crypto Detection

```bash
# Check for custom encryption utilities
curl -s https://TARGET/static/js/app.*.js | grep -oiE '(EncryUtil|encrypt|decrypt|AES|RSA|MD5|SHA)[^,;]{0,50}'
```

If custom encryption is found, the implementation is usually in a separate chunk file. Download and analyze for weaknesses (ECB mode, hardcoded keys, etc.).

## Framework Fingerprinting

```bash
# Detect Vue.js version
curl -s https://TARGET/static/js/chunk-libs.*.js | grep -oE '"[0-9]+\.[0-9]+\.[0-9]+"' | head -5

# Detect UI framework
curl -s https://TARGET/static/js/chunk-vantUI.*.js 2>/dev/null && echo "Vant UI detected"
curl -s https://TARGET/static/js/chunk-elementUI.*.js 2>/dev/null && echo "Element UI detected"
curl -s https://TARGET/static/js/chunk-antd.*.js 2>/dev/null && echo "Ant Design detected"

# Detect chart libraries
curl -s https://TARGET/static/js/app.*.js | grep -oiE '(echarts|chart\.js|highcharts|d3)[^,;]{0,30}'
```

## Common Vulnerabilities

1. **Hardcoded secrets**: APPSECRET, API keys, tokens in JS bundles
2. **Test/placeholder URLs**: `https://www.xxx.com/` or `https://test.example.com/` not replaced
3. **Debug flags**: `debug: true`, `NODE_ENV: "development"`, `VUE_APP_DEBUG`
4. **Internal URLs**: `http://internal-server:8080/` or `http://10.x.x.x/`
5. **APM tokens**: TINGYUN/听云, Sentry DSN, analytics tracking IDs
6. **Missing authentication**: Some API endpoints may not require auth

## Assessment Workflow

1. Load the page in browser → check console for errors
2. Extract JS bundle URLs from HTML source
3. Download and grep for: baseUrl, API paths, secrets, tokens
4. Extract Vue router paths → enumerate all application routes
5. Test discovered API endpoints for authentication bypass
6. Check for information disclosure in error responses
7. Test for IDOR on data-fetching endpoints
