# CTF WriteUp Compilation Workflow

When the user asks to compile CTF writeups (WP) from past sessions into a document:

## Step 1: Discover CTF Sessions

Use `session_search` with `query="CTF"` and `sort="newest"` to find recent CTF-related sessions. Each result includes:
- `session_id` — for follow-up scrolling
- `match_message_id` — the FTS5 hit anchor
- `snippet` — highlighted excerpt
- `bookend_start/end` — first/last messages for context

## Step 2: Scroll Into Each Session

For each discovered session, call `session_search` with `session_id` + `around_message_id` (use `match_message_id` from discovery) and `window=10` to get the actual conversation content. Look for:
- Challenge name, IP, port
- Vulnerability type and analysis
- Exploit/payload used
- **Flag value** (the critical output)
- Key techniques and bypass methods

Scroll forward (`around_message_id` = last message id in window) if the solve happened after the initial window.

## Step 3: Generate Word Document

Use `python-docx` to create a formatted `.docx`:

```python
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn

doc = Document()

# Set default font (Chinese support)
style = doc.styles['Normal']
font = style.font
font.name = '宋体'
font.size = Pt(11)
style.element.rPr.rFonts.set(qn('w:eastAsia'), '宋体')

# Title
title = doc.add_heading('CTF解题WriteUp汇总', level=0)
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
```

### Per-Challenge Structure
Each WP should follow this structure:
1. **Heading** — `#N. 题目名（类型）`
2. **题目信息** — type, address/port, challenge name, attachments
3. **解题过程** — numbered steps with code blocks
4. **Flag** — bold red text
5. **解题脚本** — key exploit/decode code
6. **解题总结** — technique summary

### Formatting Helpers
```python
def add_flag(doc, flag):
    p = doc.add_paragraph()
    run = p.add_run(flag)
    run.bold = True
    run.font.color.rgb = RGBColor(0xFF, 0x00, 0x00)

def add_code(doc, code):
    p = doc.add_paragraph(code)
    for run in p.runs:
        run.font.name = 'Courier New'
        run.font.size = Pt(9)
```

Use `doc.add_page_break()` between challenges.

### Status Indicators
Add a summary table at the top or use inline markers:
- ✅ Flag captured
- ⚠️ Server down / incomplete

## Pitfalls

- **Session search limit**: Default `limit=3` may miss sessions. For "all CTF today" requests, use `limit=10`.
- **Scroll window**: `window=5` may miss the flag. Use `window=10-15` for CTF sessions.
- **Forward scrolling**: If the flag isn't in the initial window, scroll forward by passing the last message's id as `around_message_id`.
- **python-docx in execute_code**: The sandbox may not have python-docx. Write the script to a file and run via `terminal()` instead.
- **Chinese fonts**: Always set `w:eastAsia` to 宋体 for proper Chinese rendering in Word.
- **Code blocks in Word**: python-docx has no native code block style. Use Courier New 9pt as a workaround.

## Output Location

Default: `~/Desktop/CTF_WriteUp_YYYYMMDD.docx`
