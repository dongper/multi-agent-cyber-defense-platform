# 投稿前机械性审查（Pre-Submission Mechanical Audit）

`peer-review/SKILL.md` 关注学术内容审查（论证严谨性、统计有效性、逻辑一致性）。本参考文档关注**机械性/文件级审查**——即"生成的 docx 是否真的包含 md 声明的所有内容"、"引用编号是否对得上"、"图片是否真的嵌入"这类问题。

用户催促"这个论文是否可以提交了" / "还能投么" / "docx 打开图没了" 时，运行这份 checklist；这类审查独立于内容审查，且经常发现只在"生成产物"层面才暴露的问题。

## 何时运行

- 用户询问"能不能提交" / "是不是可以发了" / "生成 docx 后能直接投么"
- 完成 markdown → docx 转换后
- 修改章节后需要重新生成投稿版
- 参考文献编号/正文引用曾经调整过

## 审查流程（15 分钟）

### 1. 重新生成 docx（不要相信旧的）

关键原则：**不要相信 output/ 目录里的旧 docx**。总是从 chapters/ 重新生成。

```bash
cd <paper_dir>
python3 scripts/07_regenerate.py    # 或等价合并脚本
ls -la output/*.docx                 # 确认时间戳是刚刚
```

若无生成脚本，最小 python-docx 模板见下方"生成脚本模板"。

### 2. 图片占位符审查（最高频陷阱）

md 里写 `[此处插入图 1]` 只是**文本**——转成 docx 后仍然是文本，图片不会自动嵌入。必须显式扫描：

```python
from docx import Document
doc = Document('output/paper.docx')

remaining = []
image_count = 0
for i, p in enumerate(doc.paragraphs):
    if '[此处插入图' in p.text or '[FIGURE' in p.text:
        remaining.append((i, p.text[:60]))
    for run in p.runs:
        if run._element.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}inline'):
            image_count += 1

print(f'占位符残留: {len(remaining)}')  # 必须 == 0
print(f'嵌入图片段: {image_count}')       # 必须匹配预期图数
```

**残留 > 0 就是硬伤**——投稿后审稿人会看到 `[此处插入图 1]` 字符串。

修复：写一个 08_insert_figures.py，遍历段落找占位符，用 `paragraph.add_run().add_picture(path, width=Inches(6))` 替换。

### 3. 引用编号 vs 参考文献列表一致性

三个独立事实必须对齐：
1. 正文中的 `[N]` 引用
2. `refs/references.md`（或 bib）里的编号 [N]
3. 生成的 docx 里的"参考文献"章节

**审查命令**：

```bash
# 抽取正文所有 [N] 引用
grep -oE '\[[0-9]+\]' chapters/*.md | sort -u

# 抽取 refs 定义的编号
grep -oE '^\[[0-9]+\]' refs/references.md | sort -u

# 对比：正文引用了但 refs 没有 = 悬空引用
# refs 定义了但正文没引 = 死引用（要么删 refs，要么在正文补引用点）
```

**GB/T 7714 惯例**：参考文献按**正文首次出现顺序**编号，不是字母序。若手工重排 refs，正文所有 `[N]` 都要一起改。

### 4. 参考文献真的被合并进产物了？

Markdown 用独立文件管理 refs 很常见，转 docx 时容易漏合并。

```bash
grep -c "^\[1\]" output/paper.docx  # docx 里搜文本会失败，需用 python-docx
python3 -c "
from docx import Document
doc = Document('output/paper.docx')
text = '\n'.join(p.text for p in doc.paragraphs)
print('参考文献' in text, '[1]' in text, '[15]' in text)
"
```

若 False——`07_regenerate.py` 里缺 refs 合并逻辑，补上：

```python
# 在合并 chapters 后追加
with open('refs/references.md') as f:
    refs = f.read()
document.add_heading('参考文献', level=1)
for line in refs.split('\n'):
    if line.strip():
        document.add_paragraph(line)
```

### 5. 字数（"含标点 vs 不含标点"陷阱）

- 期刊要求"5000-8000 字"通常指**不含标点、不含摘要、不含参考文献**的正文
- Word 的字数统计（"字符数（不计空格）"）**含标点**，会显示大得多
- 用统一脚本 `06_integrate.py`（或等价）统计
- 报告两个数字：`章节纯正文 X 字 / md 全文 Y 字符`

中文字数 = `sum(1 for c in text if '\u4e00' <= c <= '\u9fff')`
英文词数 = 用正则 `\b[A-Za-z]+\b`（LLM/DoS 算 1 词）

### 6. Docx 内容 vs md 内容 diff

有时 md 里改了但 docx 是旧的（脚本用了 cache、复制了旧文件、path 写错）。快速抽查：

```python
from docx import Document
doc = Document('output/paper.docx')
docx_text = '\n'.join(p.text for p in doc.paragraphs)
# 随机抽 3 处最近改动的段落，grep 在 docx_text 中是否出现
```

### 7. 期刊特定的手工尾工

以下项在自动化脚本里**通常不会自动做**，投稿前必须手动补：

- [ ] **作者信息**（姓名、单位、邮箱、通讯地址）在 docx 首页
- [ ] **图注（Figure Caption）** 在每张图下方（自动插图脚本只嵌图，不加"图 1 XXX 对比"）
- [ ] **表注（Table Caption）** 在每张表上方
- [ ] **中图分类号、文献标识码**（中文期刊要求）
- [ ] **英文摘要 + 英文关键词**（部分期刊要求）
- [ ] **基金项目**脚注（如有）

## 输出格式：checklist 报告

用户问"能不能提交"时，输出应该是**分级的 checklist**，不是长文段：

```markdown
## ✅ 已就绪

| 项 | 状态 |
|------|------|
| 正文字数 | 7999 字（区间 5000-8000）✓ |
| 参考文献 | 15 条 ✓ |
| 图片嵌入 docx | 4 张 ✓ |
| 引用编号一致 | ✓ |

## ⚠️ 投递前必须做的 N 件事

### 1. DOI 逐条核验（10 分钟）
[具体行动]

### 2. [其他]
```

避免："看起来还不错"、"应该可以了"、"内容质量很好"这类模糊表述。

## Red Flags——发现即停

- **旧的 output/paper.docx 时间戳早于 chapters/ 最近修改**——必然是过期产物
- **占位符残留 > 0**——严格阻塞投稿
- **正文引用 [N] 在 refs 中找不到**——严格阻塞
- **refs 有编号在正文中未出现**——软风险，可保留（编号跳号）或删除
- **用户在催"能不能投"但脚本没跑过一次**——不许"我看内容 OK"就答"可以"，先跑脚本

## 生成脚本模板

见 `templates/regenerate_docx.py.tmpl`（合并 chapters + refs → docx，含图片占位符位置）。

## 相关技能

- **peer-review**（本 skill 主文档）——内容层面审查
- **verification**——通用"没验证不许声称"原则；本文档是其在投稿场景的实例化
- **research-writing/skills/paper-orchestration**——大型任务分阶段
