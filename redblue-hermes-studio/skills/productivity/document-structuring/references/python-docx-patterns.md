# python-docx Patterns Reference

## TOC Field (XML manipulation)

```python
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

p = doc.add_paragraph()
run = p.add_run()
begin = OxmlElement('w:fldChar')
begin.set(qn('w:fldCharType'), 'begin')
run._r.append(begin)

run2 = p.add_run()
instr = OxmlElement('w:instrText')
instr.set(qn('xml:space'), 'preserve')
instr.text = ' TOC \\o "1-2" \\h \\z \\u '
run2._r.append(instr)

run3 = p.add_run()
sep = OxmlElement('w:fldChar')
sep.set(qn('w:fldCharType'), 'separate')
run3._r.append(sep)

run4 = p.add_run('（请在Word中右键→"更新域"生成目录）')
run4.font.color.rgb = RGBColor(0x99,0x99,0x99)

run5 = p.add_run()
end = OxmlElement('w:fldChar')
end.set(qn('w:fldCharType'), 'end')
run5._r.append(end)
```

## Chinese Font Setup

```python
style = doc.styles['Normal']
font = style.font
font.name = '微软雅黑'
font.size = Pt(11)
style.element.rPr.rFonts.set(qn('w:eastAsia'), '微软雅黑')

# Repeat for each Heading style used
for i in range(1, 4):
    hs = doc.styles[f'Heading {i}']
    hs.font.name = '微软雅黑'
    hs.font.bold = True
    hs.element.rPr.rFonts.set(qn('w:eastAsia'), '微软雅黑')
```

## Styled Data Tables

```python
from docx.enum.table import WD_TABLE_ALIGNMENT  # MUST import separately

t = doc.add_table(rows=N, cols=M, style='Light Grid Accent 1')
# Bold headers
for i, h in enumerate(headers):
    t.rows[0].cells[i].text = h
    for p in t.rows[0].cells[i].paragraphs:
        for r in p.runs:
            r.font.bold = True
            r.font.size = Pt(10)
# Data rows — set font per cell
for ri, row_data in enumerate(data):
    for ci, val in enumerate(row_data):
        t.rows[ri+1].cells[ci].text = val
        for p in t.rows[ri+1].cells[ci].paragraphs:
            for r in p.runs:
                r.font.size = Pt(9)
```

**PITFALL**: `table.alignment = WD_TABLE_ALIGNMENT.CENTER` requires the enum import above.

## Embedding Images

```python
from docx.shared import Pt

p = doc.add_paragraph()
p.alignment = 1  # CENTER (WD_ALIGN_PARAGRAPH.CENTER)
run = p.add_run()
run.add_picture('path/to/image.png', width=Pt(480))  # A4 full width
```

Sizes: `Pt(480)` = full width, `Pt(360)` = ~75%, `Pt(240)` = half width.

## Heading + Bold + Colored Text

```python
h = doc.add_heading('标题', level=1)

p = doc.add_paragraph()
r = p.add_run('结论文字')
r.font.bold = True
r.font.color.rgb = RGBColor(0xcc, 0x00, 0x00)  # Red for alerts
```

## Incremental Save Pattern

Build large docs section by section in separate `execute_code` calls:

```python
# Call 1: title + setup
doc = Document()
# ... setup styles, title ...
doc.save('output.docx')

# Call 2: TOC + section 1
doc = Document('output.docx')
# ... add TOC, section 1 ...
doc.save('output.docx')

# Call 3: section 2-3
doc = Document('output.docx')
# ... add more sections ...
doc.save('output.docx')
```

Each call keeps tool args under 8K tokens to avoid stream timeouts.
