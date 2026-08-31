---
name: document-structuring
description: "Reorganize scattered/visual documents (images, PDFs, mixed files) into structured Word documents with TOC, tables, and embedded images. Covers vision-based content analysis and python-docx generation."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Word, DOCX, python-docx, document-organization, vision-analysis, medical-reports]
    related_skills: [ocr-and-documents, powerpoint, chinese-corporate-documents]
---

# Document Structuring

Take scattered visual/image-heavy documents and reorganize them into a clean, structured Word document with TOC, data tables, and embedded images.

**When to use**: User has a folder of images/PDFs that represent reports, test results, receipts, or any sequential/chronological documents and wants them organized into a single structured DOCX.

**When NOT to use**: Pure text extraction from PDFs → use `ocr-and-documents`. Creating presentations → use `powerpoint`.

## Workflow

### Step 1: Inventory the source material

```python
from docx import Document
from docx.oxml.ns import qn

doc = Document('input.docx')

# List paragraphs with styles
for i, para in enumerate(doc.paragraphs):
    if para.text.strip():
        print(f'[{i}] style={para.style.name} | {para.text[:80]}')

# Count and locate images
rels = doc.part.rels
for rel_id, rel in rels.items():
    if 'image' in rel.reltype:
        print(f'{rel_id}: {rel.target_ref}')

# Map images to paragraphs
for i, para in enumerate(doc.paragraphs):
    drawings = para._element.findall('.//' + qn('w:drawing'))
    for d in drawings:
        blips = d.findall('.//' + qn('a:blip'))
        for blip in blips:
            embed = blip.get(qn('r:embed'))
            if embed and embed in rels:
                print(f'Para [{i}] -> {rels[embed].target_ref}')
```

### Step 2: Extract images to disk

```python
import os
os.makedirs('extracted_images', exist_ok=True)
for rel_id, rel in rels.items():
    if 'image' in rel.reltype:
        fname = rel.target_ref.split('/')[-1]
        with open(f'extracted_images/{fname}', 'wb') as f:
            f.write(rel.target_part.blob)
```

### Step 3: Analyze each image with vision

Use `vision_analyze` on each extracted image. Be specific in your question:
```
vision_analyze(
    image_url='extracted_images/image1.png',
    question='这是一张什么报告/检查？请告诉我类型、日期、关键结果/数据。'
)
```

Process images in batches of 5 (parallel vision calls) to stay efficient.

### Step 4: Build structured Word document

See `references/python-docx-patterns.md` for complete code patterns.

Key structure:
1. **Title page** — document title, metadata, date
2. **TOC** — auto-generated field (requires Word "Update Field" on open)
3. **Timeline/overview table** — chronological summary
4. **Detailed sections** — one section per report/check with data tables
5. **Summary/analysis section** — cross-cutting findings
6. **Appendix** — original images embedded with captions

### Step 5: Incremental save pattern (CRITICAL for large docs)

**PITFALL**: A single large `write_file` call will timeout when generating documents with many images. Always use `execute_code` with incremental `doc.save()` calls after each section.

```python
# In execute_code — build section by section
doc = Document()
# ... add title ...
doc.save('output.docx')

# Next execute_code call
doc = Document('output.docx')
# ... add TOC + section 1 ...
doc.save('output.docx')

# Repeat for each section
```

Each `execute_code` block should add 1-2 sections and save. This avoids stream timeouts.

## Pitfalls

1. **WD_TABLE_ALIGNMENT import**: Must explicitly import `from docx.enum.table import WD_TABLE_ALIGNMENT`. Just `from docx.enum.text import WD_ALIGN_PARAGRAPH` is not enough.

2. **TOC field requires XML manipulation**: python-docx has no native TOC API. You must construct `w:fldChar` elements manually. See reference file for working code.

3. **Chinese fonts**: Always set both `font.name` and `rFonts` with `qn('w:eastAsia')` for Chinese text rendering.

4. **Image sizing**: Use `Pt(480)` width for A4-width images, `Pt(360)` for half-width. Never omit width — images will render at native resolution (often too large).

5. **Table font size**: Must set font size on each cell's runs individually; setting on the table object does not cascade.

6. **vision_analyze batching**: Process max 5 images per message turn. More than that risks context overflow.

7. **File size with embedded images**: A 10-image document can easily reach 5-10MB. Warn the user if file size matters.
