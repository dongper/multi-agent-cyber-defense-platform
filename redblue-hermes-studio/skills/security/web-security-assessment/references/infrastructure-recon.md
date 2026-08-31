# Infrastructure Reconnaissance Techniques

## DNS Information Leakage

### Internal IP Discovery via Subdomain Resolution

Some subdomains resolve to internal IPs (RFC 1918), revealing network architecture:

```bash
# Enumerate subdomains and check for internal IPs
for sub in portal sso cloud m app h5 wap mini cdn static api admin dev staging; do
  result=$(dig +short "${sub}.DOMAIN" 2>/dev/null | head -1)
  [ -n "$result" ] && echo "${sub}.DOMAIN -> $result"
done

# Flag internal IPs
# 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
```

**What to look for**:
- `192.168.x.x` — typical internal network
- `10.x.x.x` — large enterprise internal network
- `172.16-31.x.x` — Docker/cloud internal networks

### DNS Server Enumeration

```bash
# Get NS records
dig DOMAIN NS +short

# Get MX records (reveals mail infrastructure)
dig DOMAIN MX +short

# Get SOA record (reveals primary DNS admin contact)
dig DOMAIN SOA +short
```

**Common findings**:
- NS servers on internal IPs (e.g., `ns1.internal.corp.com -> 10.x.x.x`)
- MX records revealing mail provider (e.g., `mxbiz1.qq.com` = QQ enterprise mail)
- SOA email revealing admin contact

### Zone Transfer Testing

```bash
# Test each NS server for zone transfer
for ns in $(dig DOMAIN NS +short); do
  echo "=== $ns ==="
  dig @$ns DOMAIN AXFR +short 2>&1 | head -20
done
```

**Note**: Zone transfers are rarely allowed on production DNS, but always test — a successful AXFR dumps the entire zone file.

## Certificate Transparency Log Enumeration

```bash
# Query crt.sh for all certificates issued for the domain
curl -s "https://crt.sh/?q=%.DOMAIN&output=json" 2>&1 | grep -oE '"name":"[^"]*"' | sort -u
```

**Alternative services**:
- `https://censys.io/certificates?q=DOMAIN`
- `https://crt.sh/?q=%.DOMAIN` (web interface)

## SSL Certificate SAN Analysis

```bash
# Extract all SAN domains from a certificate
echo | openssl s_client -connect DOMAIN:443 -servername DOMAIN 2>/dev/null | \
  openssl x509 -noout -text 2>&1 | grep -A2 "Subject Alternative Name"

# Resolve each SAN domain to map infrastructure
for san in $(echo | openssl s_client -connect DOMAIN:443 -servername DOMAIN 2>/dev/null | \
  openssl x509 -noout -text 2>&1 | grep -oP 'DNS:[^\s,]+' | sed 's/DNS://'); do
  ip=$(dig +short "$san" 2>/dev/null | head -1)
  [ -n "$ip" ] && echo "$san -> $ip"
done
```

**What to look for in SANs**:
- Wildcard entries (`*.domain.com`) — all subdomains covered
- Unrelated domains — shared certificate infrastructure
- Test/staging domains (`qatest.vendor.com`)
- Internal service domains (`sso.cloud.domain.com`)
- Different business units sharing the same certificate

## Port Scanning Patterns

### Firewalled Hosts

When `ping` succeeds but nmap reports "Host seems down", the target blocks ICMP:
```bash
nmap -Pn -sT --top-ports 100 -T4 TARGET_IP
```

### Chinese SOE Common Ports

```bash
# Typical open ports on Chinese enterprise web servers
nmap -Pn -sT -p 80,443,8080,8443,9090,9200,5601,3306,6379,27017,22,21,25,53 TARGET_IP
```

**Common patterns**:
- Only 443 open (hardened web server behind WAF)
- 80 + 443 (HTTP redirects to HTTPS)
- 8080/8443 (Tomcat/Spring Boot directly exposed — higher risk)
- 3306/6379/27017 (database ports exposed — critical if open)

## Subdomain Enumeration Strategy

### Phase 1: Passive (no direct connection)
- crt.sh certificate transparency logs
- DNS brute force with common subdomain wordlists

### Phase 2: Active (direct DNS queries)
```bash
# Extended wordlist for Chinese enterprise environments
for sub in www api uac admin test dev staging beta app mobile web portal sso login \
  monitor analytics grafana prometheus jenkins gitlab ci cd docker k8s \
  wap mini h5 club act es redis mysql mongo gateway gw node \
  cloud cdn static img images assets media files upload download \
  mail smtp imap pop3 ftp dns ntp \
  pre prod production release \
  ops devops cicd pipeline; do
  result=$(dig +short "${sub}.DOMAIN" 2>/dev/null | head -1)
  [ -n "$result" ] && echo "${sub}.DOMAIN -> $result"
done
```

**PITFALL**: CNAME to `*.yundunwaf*.com` or `*.eo.dnse0.cn` means the subdomain exists behind a WAF. Don't skip it — the WAF-protected admin panel is still an attack surface.
