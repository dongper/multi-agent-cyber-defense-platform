---
name: chinese-corporate-documents
description: Create professional Chinese corporate documents — PPTX template filling (述职PPT, annual reports, card-based layouts) and talent application outlines (集团人才申报, strategic alignment, evidence organization). Covers python-pptx/python-docx workflows, content ownership rules, and Chinese file path handling.
version: 1.0.0
platforms: [macos, linux]
---

# Chinese Corporate Document Creation

Create professional Chinese corporate documents using python-pptx and python-docx. Covers two major workflows: PPTX template filling and talent application Word outlines.

## Shared Rules (apply to both workflows)

### Content Ownership — CRITICAL
Only include the CURRENT USER's own achievements, patents, papers, certificates, and competition results. Do NOT include content that belongs to colleagues, even if it appears in the template or reference materials. The user explicitly stated: "别人的成绩，不要写到我这" and "截图啥的 不是我的也不要". Always verify evidence files belong to the user before including them.

### Chinese File Path Handling
`search_files` may return incorrect paths with phantom spaces for Chinese directory names (e.g., `B 级面试年审` when actual path is `B级面试年审`). ALWAYS verify paths with terminal `ls` or `find` before using them. When `Presentation(path)` or `Document(path)` fails with "Package not found", immediately check the real filesystem path — do NOT trust `search_files` output for Chinese paths.

Chinese file paths with spaces break shell `ls` — use `search_files` to find paths, then use Python directly (not shell commands).

---

## Workflow A: PPTX Template Filling

Fill existing PowerPoint (.pptx) templates with new content while preserving the original design, master slides, and background elements. Common use: personal review/述职PPT, annual reports, achievement summaries.

### Step 1: Locate the template
Use `search_files` to find the .pptx file. Verify the path with `ls` if it contains Chinese characters.

### Step 2: Read the template structure
```python
from pptx import Presentation
prs = Presentation(path)
for i, slide in enumerate(prs.slides):
    texts = []
    for shape in slide.shapes:
        if shape.has_text_frame:
            for p in shape.text_frame.paragraphs:
                if p.text.strip():
                    texts.append(p.text.strip())
    print(f'Slide {i+1}: {texts}')
```
Identify the target slide index and which shapes contain editable content vs. background/design elements.

### Step 3: Clear and refill content
1. Keep the title shape (section header like "个人成长")
2. Remove or clear other text shapes
3. Remove images/screenshots that don't belong to the user
4. Build new content in remaining text shape(s), or create new structured textboxes/shapes

### Step 4: Card-based layout (preferred for achievement slides)
Use three-column card layouts with colored rounded rectangles:

```python
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

slide_width = Inches(13.333)
content_top = Inches(1.6)
card_width = Inches(3.5)
card_height = Inches(4.5)
gap = Inches(0.6)
start_left = (slide_width - (3 * card_width + 2 * gap)) / 2

for i, section in enumerate(sections):
    left = start_left + i * (card_width + gap)
    card = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        left, content_top, card_width, card_height
    )
    card.line.color.rgb = section["color"]
    card.line.width = Pt(1.5)
    card.fill.solid()
    card.fill.fore_color.rgb = section["bg_color"]
    
    tf = card.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.3)
    tf.margin_top = Inches(0.3)
    
    p = tf.paragraphs[0]
    p.text = f"{section['icon']} {section['title']}"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = section["color"]
    p.space_after = Pt(10)
    
    for item in section["items"]:
        p = tf.add_paragraph()
        p.text = f"• {item}"
        p.font.size = Pt(13)
        p.space_before = Pt(4)
```

### Step 5: Save as new file
```python
output_path = path.replace('.pptx', '-修改版.pptx')
prs.save(output_path)
```

### PPTX Content Guidelines
**Categorize into 3-4 sections:**
- 专业资质认证 (PMP, CPDA, CDSP, etc.)
- 知识产权成果 (patents, papers, software copyrights)
- 竞赛与创新荣誉 (competitions, awards)
- 培训/学习经历 (training, certifications in progress)

**Formatting principles:**
- Bold category headers, regular body text
- Icon emoji or short label for visual distinction
- Keep items concise — one line each where possible
- Group related items with clear hierarchy
- Use corporate-appropriate colors (navy, green, deep red) with light background tints
- Produce clean, professional layouts. Do not dump raw text — structure visually with clear sections, indentation, and color coding.

---

## Workflow C: Document Comparison & Analysis Reports

When the user sends two or more PPTX files and asks for comparison/analysis, the deliverable MUST be a Word (.docx) document — not markdown, not text. The user repeatedly requests "我要word" for analysis outputs.

### Step 1: Extract content from all PPTX files
```python
from pptx import Presentation
import json

def extract_ppt(path):
    prs = Presentation(path)
    slides = []
    for i, slide in enumerate(prs.slides):
        texts = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                for p in shape.text_frame.paragraphs:
                    t = p.text.strip()
                    if t:
                        texts.append(t)
        slides.append({'slide_num': i+1, 'texts': texts})
    return slides

slides1 = extract_ppt(path1)
slides2 = extract_ppt(path2)
with open('/tmp/doc1.json', 'w') as f:
    json.dump(slides1, f, ensure_ascii=False, indent=2)
with open('/tmp/doc2.json', 'w') as f:
    json.dump(slides2, f, ensure_ascii=False, indent=2)
```

### Step 2: Analyze and compare
Identify key comparison dimensions:
- Business volume/metrics changes (user counts, session counts, growth rates)
- Architecture/topology differences
- Risk/impact assessment differences
- Section coverage (what each document includes/excludes)
- Technical evolution (naming changes, capacity upgrades)

### Step 3: Generate Word report
Write the script to a file (never heredoc — Chinese content causes SyntaxError):

```python
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml

doc = Document()

# Set Chinese font
style = doc.styles['Normal']
font = style.font
font.name = '微软雅黑'
style.element.rPr.rFonts.set(qn('w:eastAsia'), '微软雅黑')
font.size = Pt(11)

# Helper: table cell shading
def set_cell_shading(cell, color):
    shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color}"/>')
    cell._tc.get_or_add_tcPr().append(shading)

# Helper: format table with borders
def format_table(table):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl = table._tbl
    tblPr = tbl.tblPr if tbl.tblPr is not None else parse_xml(f'<w:tblPr {nsdecls("w")}/>')
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        '  <w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/>'
        '  <w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>'
        '  <w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/>'
        '  <w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>'
        '  <w:insideH w:val="single" w:sz="4" w:space="0" w:color="999999"/>'
        '  <w:insideV w:val="single" w:sz="4" w:space="0" w:color="999999"/>'
        '</w:tblBorders>'
    )
    tblPr.append(borders)
    for row in table.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                p.paragraph_format.space_before = Pt(2)
                p.paragraph_format.space_after = Pt(2)
                for run in p.runs:
                    run.font.size = Pt(10)
                    run.font.name = '微软雅黑'
                    run._element.rPr.rFonts.set(qn('w:eastAsia'), '微软雅黑')

# Helper: style header row
def add_header_row(row, color="4472C4"):
    for cell in row.cells:
        set_cell_shading(cell, color)
        for p in cell.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in p.runs:
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.bold = True
```

### Report structure (recommended)
1. **文档概述** — Background, document list table
2. **业务量对比** — Multi-column tables with metrics, changes, trend analysis
3. **内容结构对比** — Coverage checklist (✅/❌) for each section
4. **信令冲击/风险评估对比** — Side-by-side impact values, bottleneck identification
5. **技术演进分析** — Architecture changes, capacity upgrades
6. **综合评估与建议** — Quality comparison, risk warnings, improvement suggestions
7. **结论** — Executive summary
8. **附录** — Data summary tables, topology change details

### Key principles
- **Be comprehensive** — The user requested "分析全面一些". Include all dimensions, not just the obvious ones.
- **Use multi-column tables** — 4-5 columns comparing Doc A, Doc B, Change, Interpretation.
- **Include trend analysis** — Don't just list numbers; add "趋势解读" column explaining what changes mean.
- **Add risk assessment** — Categorize risks as 🔴高/🟡中/🟢低 with specific data backing.
- **Provide actionable recommendations** — End with concrete improvement suggestions.

### Pitfalls
- **Always write script to file first** — `write_file` → `python3 /path/to/script.py`. Never use heredoc with Chinese content.
- **Table column count must match data** — If headers have 5 columns, each data row must have exactly 5 cells. Mismatch causes `IndexError: tuple index out of range`.
- **Save to Desktop** — Output path: `/Users/zhangrunmin/Desktop/<分析主题>.docx`.
- **Send via MEDIA:** — Use `MEDIA:/absolute/path/to/file.docx` to deliver the file natively.

---

## Workflow B: Talent Application Outlines

Create structured Word outline documents for corporate talent level applications (e.g., 集团 B 级人才申报). The key is aligning personal achievements with company/group strategic goals.

### Step 1: Gather evidence
Scan the user's evidence folders for:
- **Patents**: Count, list titles, note authorship position (主要作者/一作)
- **Papers**: Count, publication venues (国际会议/JCR期刊), authorship (一作/共一/主要作者)
- **Competitions/Awards**: Group by level (集团级/省级/行业级), list top honors
- **Certifications**: PMP, CDGA, CDSP, 软考, 天宫认证, etc.
- **Projects**: Key projects the user led or contributed to

### Step 2: Read strategic context
Look for company strategy documents in the user's workspace:
- "十五五"规划 documents
- "A计划" or similar strategic initiative materials
- 智慧运营工作方案 documents
Extract key strategic themes (AI+, 数智强企, 数据治理, 降本增效) as alignment hooks.

### Step 3: Create the outline
Use python-docx to create a structured Word document:

```python
from docx import Document
from docx.shared import Pt
from docx.oxml.ns import qn

doc = Document()
style = doc.styles['Normal']
style.font.name = 'Microsoft YaHei'
style.font.size = Pt(11)
style.element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')

doc.add_heading('集团 X 级人才申报材料提纲', 0)
doc.add_paragraph('申报人：XXX').alignment = 1
doc.add_paragraph('申报单位：XXX').alignment = 1
```

### Step 4: Standard outline sections

**一、个人综述与战略对标**
- Core positioning (AI专家/数据治理骨干/etc.)
- Strategic alignment statement (tied to 集团规划)

**二、核心业绩贡献（对标集团战略落地）**
- Group each achievement under a strategic theme (e.g., "AI+行动计划", "数据要素价值挖掘", "业务场景赋能")
- For each: what was done, how it aligns with group strategy, measurable impact

**三、科研创新与知识产权**
- Patents (count, authorship position, representative titles)
- Papers (count, venues, authorship breakdown)
- Software copyrights

**四、行业影响力与竞赛荣誉**
- Grouped by level: 集团级 → 省级/行业级
- Only the user's own awards

**五、人才梯队建设与赋能**
- Team mentoring, knowledge sharing, technical leadership

**六、下一步工作规划**
- Future goals aligned with group strategy

### Step 5: Save and deliver
```python
output_path = '/path/to/B 级人才申报提纲 - 姓名.docx'
doc.save(output_path)
```

### Talent Application Guidelines
- **Strategic alignment is key** — Group-level talent applications require showing how personal work supports corporate strategy. Don't just list achievements — connect each to a strategic theme.
- **Authorship matters** — Clearly distinguish 一作/共一/主要作者 for papers and patents. Group evaluators care about contribution level.

---

## Pitfalls

### Shared Pitfalls
- **`search_files` returns INCORRECT paths for Chinese directories** → It may add phantom spaces. ALWAYS verify with terminal `ls` or `find` before using paths.
- **Content ownership** → Only include the user's own achievements. Strip any colleague's work from evidence.
- **Overwriting templates** → Always save as a new file (`-修改版.pptx` or `-提纲.docx`), never overwrite the original.
- **Chinese quotes in heredoc cause Python SyntaxError** → When generating python-docx scripts containing Chinese quotation marks ("" or ''), do NOT use `python3 << 'EOF'` heredoc — the shell passes the Chinese quotes literally, and Python interprets them as string delimiters, causing SyntaxError. Instead: (1) write the script to a file using `write_file`, (2) execute it with `python3 /path/to/script.py`. This is especially common in Chinese corporate documents (申报书, 商业分析) that use Chinese punctuation extensively.

### PPTX-Specific
- **Deleting shapes breaks slide background** → Only delete shapes identified as content (text shapes, images). Master slide backgrounds are not in `slide.shapes`.
- **Text overflow in cards** → Set `tf.word_wrap = True` and generous card height. Reduce font size or increase card height if content still overflows.
- **PPTX template modification pattern** → When filling an existing PPT template: open with `Presentation(path)`, find target slide by index, locate the text-containing shape, clear existing paragraphs, then build new content with `tf.add_paragraph()`. Save as a new file (never overwrite).

### Word-Specific
- **Template docx may lack Heading styles** → Use bold paragraphs, never `add_heading()` if the template doesn't have styles defined.
- **rPr element missing crash** → Use `get_or_add_rPr()` before creating rFonts element when setting Chinese fonts.