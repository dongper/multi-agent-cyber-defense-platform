---
name: ctf-hub
description: >
  CTF综合技能中心 - 整合所有CTF子技能的统一入口。
  包含：Web安全、二进制漏洞利用(Pwn)、逆向工程(Reverse)、密码学(Crypto)、
  数字取证(Forensics)、杂项(Misc)、OSINT、恶意软件分析、AI/ML安全等。
  使用 /ctf 或说"CTF题目"/"CTF挑战"触发。
user_invocable: true
---

# 🏴 CTF Hub — 综合夺旗技能中心

## 使用方法

当遇到CTF题目时，按以下流程操作：

### 0. 强制规则：先看 skill 再动手
用户明确要求：**遇到 CTF 题目必须先加载相关 skill 再开始答题**，不要直接上手试。
1. 先 `skill_view('ctf-hub')` 加载本技能
2. 根据题目类型判断加载对应子技能（ctf-web / ctf-pwn / ctf-misc 等）
3. 然后再开始分析

### 1. 题目类型判断

**快速入口**：如果不想手动判断类型，直接加载 `solve-challenge` skill，它会自动分析题目并路由到正确的分类 skill。

| 判断依据 | 类型 | 对应技能 |
|---------|------|---------|
| URL / IP:Port，登录页、表单、API | **WEB** | `ctf-web` (参考 pwn.md) |
| ELF/PE二进制，"nc"连接，有libc | **PWN** | `ctf-pwn` |
| 压缩包、图片、流量包、音频 | **MISC/FORENSICS** | `ctf-misc` / `ctf-forensics` |
| 可执行文件，无"nc"连接 | **REVERSE** | `ctf-reverse` |
| 密码学、数学问题 | **CRYPTO** | `ctf-crypto` |
| JWT认证、token伪造 | **WEB(JWT)** | `ctf-web` → `references/jwt-attacks.md` |
| 社工、信息收集 | **OSINT** | `ctf-osint` |
| 恶意样本、流量分析 | **MALWARE** | `ctf-malware` |
| AI模型攻击、对抗样本 | **AI/ML** | `ctf-ai-ml` |

### 2. 常用工具速查

```bash
# 二进制分析
checksec --file=binary
file binary && readelf -h binary
strings binary | grep -i flag

# 逆向工具
ghidra          # GUI逆向
radare2 binary  # 命令行逆向
gdb ./binary    # 调试

# Web测试
curl -v URL
nmap -sV -sC target
sqlmap -u "URL" --dbs

# 密码学
python3 -c "import gmpy2; print(gmpy2.iroot(x, n))"
sage              # 数学计算

# 取证/杂项
binwalk -e file   # 文件提取
steghide extract -sf image.jpg
foremost file     # 文件恢复
volatility -f mem.dump imageinfo

# Pwn工具
from pwn import *
p = remote('host', port)
# 或
p = process('./binary')

# OSINT
whois domain.com
nslookup domain
dig domain ANY
```

### 3. 工作流程

0. **检查附件/培训材料** → PDF、文档、图片中往往直接给出解题思路甚至答案，优先于盲目测试
1. **下载/连接题目** → 获取题目文件或建立连接
2. **初步分析** → `file`, `strings`, `checksec`, `binwalk`
3. **确定类型** → 根据特征选择对应子技能
4. **深入分析** → 使用专业工具和技术
5. **构造EXP** → 编写exploit脚本
6. **获取Flag** → 执行并提交

### 4. 实战参考文档

| 文档 | 路径 | 内容 |
|-----|------|------|
| web-lfi-checklist | references/web-lfi-checklist.md | LFI 攻击清单：日志投毒、协议过滤绕过、Flag 位置速查 |
| ctf-writeup-compilation | references/ctf-writeup-compilation.md | CTF WP 编译工作流：从 session 历史提取解题记录，生成格式化 Word 文档 |

### 5. 子技能详情

每个子技能目录下都有详细的参考文档：

| 技能 | 路径 | 内容 |
|-----|------|------|
| ctf-pwn | ~/.hermes/skills/ctf-pwn/ | 栈溢出、格式化字符串、堆利用、ROP、内核漏洞 |
| ctf-reverse | ~/.hermes/skills/ctf-reverse/ | 反编译、动态调试、混淆分析、VM分析 |
| ctf-crypto | ~/.hermes/skills/ctf-crypto/ | RSA、AES、ECC、格密码、数论攻击 |
| ctf-forensics | ~/.hermes/skills/ctf-forensics/ | 内存取证、流量分析、隐写术、磁盘分析 |
| ctf-misc | ~/.hermes/skills/ctf-misc/ | 编解码、沙箱逃逸、Python jail、Z3约束求解 |
| ctf-osint | ~/.hermes/skills/ctf-osint/ | 社工、信息收集、地理定位 |
| ctf-malware | ~/.hermes/skills/ctf-malware/ | 恶意软件分析、C2流量、YARA规则 |
| ctf-ai-ml | ~/.hermes/skills/ctf-ai-ml/ | 对抗样本、模型提取、Prompt注入 |
| solve-challenge | ~/.hermes/skills/solve-challenge/ | 🆕 自动解题编排器 — 分析题目并路由到对应分类 skill |
| ctf-writeup | ~/.hermes/skills/ctf-writeup/ | 🆕 生成标准化解题报告（比赛提交/交接用） |

### 6. Skills 上游同步

CTF 子技能上游仓库：[ljagiello/ctf-skills](https://github.com/ljagiello/ctf-skills)（2.6k⭐）

同步方法：
```bash
cd /tmp && git clone --depth 1 https://github.com/ljagiello/ctf-skills.git
# 更新已有 skills
for skill in ctf-ai-ml ctf-crypto ctf-forensics ctf-malware ctf-misc ctf-osint ctf-pwn ctf-reverse; do
  rm -rf ~/.hermes/skills/$skill/*
  cp -r /tmp/ctf-skills/$skill/* ~/.hermes/skills/$skill/
done
# 更新 ctf-web（不同路径）
rm -rf ~/.hermes/skills/security/ctf-web/*
cp -r /tmp/ctf-skills/ctf-web/* ~/.hermes/skills/security/ctf-web/
# 添加新 skills（如有）
for skill in solve-challenge ctf-writeup; do
  mkdir -p ~/.hermes/skills/$skill
  cp -r /tmp/ctf-skills/$skill/* ~/.hermes/skills/$skill/
done
rm -rf /tmp/ctf-skills
```

⚠️ 注意：`ctf-hub`、`ctf-offline-solver`、`ctf-solver-claude` 是本地自定义 skill，不来自上游仓库，同步时不要覆盖。

### 7. 快速提示

- **Flag格式**: 通常为 `flag{...}`, `CTF{...}`, `HGAME{...}` 等
- **编码检测**: `base64`, `hex`, `rot13`, `morse`, `brainfuck`
- **文件识别**: `file`, `binwalk`, `xxd`, `hexdump`
- **网络调试**: `nc`, `wireshark`, `tcpdump`, `curl`
- **自动化**: 优先用Python + pwntools编写exploit

---

## 注意事项

1. **合法授权**: 仅用于合法的CTF比赛和授权的安全测试
2. **迭代调试**: 每一步验证输出，失败时调整策略
3. **深度优先**: 先穷举所有可能向量，再缩小范围
4. **工具优先**: 优先使用现有工具，避免重复造轮子
