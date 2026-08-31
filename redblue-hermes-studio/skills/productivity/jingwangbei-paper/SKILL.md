---
name: jingwangbei-paper
description: Prepare, check, revise, and package papers for the "京网杯" 2026 北京信息通信技术发展论坛 submission. Use when the user mentions 京网杯, 北京通信学会征文, 2026 信息通信技术发展论坛, 京网杯论文, 投稿材料检查, or asks to format/check/fill a 京网杯 paper, summary table, authorization letter, or non-confidentiality commitment.
---

# 京网杯论文 (Jingwangbei Paper)

## Trigger

User mentions 京网杯, 北京通信学会, 2026 信息通信技术发展论坛, or asks to prepare/check/revise a 京网杯 submission.

## Scope — READ FIRST

**This skill is ONLY for the 京网杯 competition.** It encodes a specific submission package (论文 + 附件2 信息汇总表 + 附件3 授权书 + 附件4 不涉密承诺书), the 京网杯 template structure (5 sections + 创新性章节 + 作者简介), 6000 字 length cap, and the 6 号宋体 reference format with 6.5pt font.

**Do NOT use this skill for other journals or competitions** (《邮电设计技术》、《通信学报》、IEEE 期刊、其他学会征文、其他研究院所的论文比赛等). The structure, length, reference style, and submission package are all wrong. Caught in session 2026-06-28: user explicitly said "这个 skill 尽量不要用" when writing a 邮电设计技术 journal paper.

For non-京网杯 papers:
- 期刊论文（邮电设计技术 / 通信学报 / IEEE 等）→ use `using-research-writing` → `paper-orchestration` → `writing-chapters`
- 其他学会征文（不是京网杯）→ same as above, plus check the specific competition's template
- The `references/requirements.md` file in this skill is 京网杯-specific and should NOT be applied to other papers.

The reusable parts (real-reference verification, word count rules, generate_docx.py patterns) are generic; copy the pattern but not the structure.

## Core Workflow

1. Locate the working folder at `~/Desktop/京网杯/` and identify:
   - The final editable paper file (`.docx`, NOT PDF);
   - The official notice, template, and attachment files;
   - Supporting images, charts, PPT materials, and earlier drafts.
2. Read `references/requirements.md` before making decisions about eligibility, format, file naming, or submission completeness.
3. **Collect all author info upfront** — ask for: name, gender, birth year/month, highest degree, unit, specialty, title/rank, honors, address, postal code, phone, email. Do NOT start writing until all authors' info is confirmed.
4. **Verify ALL references are real** — search each citation before including. Replace any unverifiable references with known-real papers. This is MANDATORY, not optional.
5. Write the paper content, then generate DOCX with proper formatting (see `scripts/generate_docx.py` or inline python-docx with eastAsia font fallback).
6. **Insert images inline** at the position they are referenced in text, not appended at the end.
7. Run `scripts/count_words.py` on the output to verify ≤6000 chars (Chinese + English/digits, excluding punctuation).
8. Report issues in this order: blocking submission issues, missing information, format/length risks, optional quality improvements.

## Standard Paper Structure

A complete 京网杯 paper should have these sections in order:

### Pre-body (non-numbered)
1. **论文标题** — centered, 小二号黑体; subtitle (if any) starts with dash, ≤20 chars
2. **作者列表** — centered, 五号楷体
3. **单位+地区+邮编** — centered, 五号宋体
4. **摘要** — 150~300 Chinese chars; covers purpose, method, results, conclusion
5. **关键词** — 3~5 terms; semicolon-separated; NO ending punctuation
6. **所属领域** — e.g. "人工智能、通信网络智能运维"

### Body (Arabic numbering, ≤3 levels)
| Section | Content |
|---|---|
| **1 引言** | Background, existing gaps, this paper's contribution |
| **2 需求分析与总体架构** | Business pain points, architecture design, architecture figure |
| **3 关键技术实现** | 3.1/3.2/3.3 for each core technology |
| **4 实验验证与应用成效** | Dataset, baselines, result tables, analysis |
| **5 创新性与应用价值** | Innovation summary, deployment path, prospects |
| **6 结论与展望** | Full summary, future directions |

### Post-body (non-numbered)
7. **参考文献** — numbered by order of first citation in text
8. **作者简介** — ≤150 chars; name, gender, birth year/month, highest degree, unit+specialty, title, honors, address, postal code, phone, email

## Pre-Writing Checklist

Before drafting, confirm with user:
- Author name, gender, birth year/month
- Job title (工程师/高级工程师)
- Unit full name (e.g. "中国联合网络通信有限公司北京市分公司")
- Phone number and email (for author bio)
- Whether sole author or co-authors
- Preferred topic/direction

## Support Scripts

- `scripts/generate_docx.py` — Generate 京网杯-formatted DOCX from JSON content. Handles all Chinese font sizes and eastAsia fallback automatically. **Requires `python-docx`** (`pip install python-docx`). **⚠️ LIMITATION: Does NOT split text on `\n\n` — renders multi-paragraph sections as one block.** For multi-paragraph support, write a custom variant that splits `text` on `\n\n` and creates separate paragraphs (see `gen_docx.py` pattern in 论文2/).
- `scripts/count_words.py` — Count Chinese chars + English/digits (excluding punctuation). **WARNING: This script counts English LETTERS, not words. Word/WPS counts English WORDS. The script will show ~1.5-2x higher than Word's count for technical papers. Use `len(re.findall(r'[a-zA-Z]+', text))` for English word count to approximate Word behavior.**

## Paper Checks (Priority Order)

- Editable format (`.docx`), NOT PDF;
- File name: `工作单位+论文题目+所属领域`;
- Paper states its field;
- Length ≤6000字 (Chinese characters + English/numbers, **excluding punctuation**), AND ≤A4 5 pages;
- **Word/WPS word count is authoritative** for final length decisions. Script counts are rough pre-checks only because DOCX extraction may count references, tables, punctuation, English, and numbers differently from Word/WPS;
- **Word counts Chinese characters + ENGLISH WORDS (not letters)** — "LLM" counts as 1 word, "MTTD" counts as 1 word. When targeting 6000字 with Word count, estimate as `chinese_chars + english_word_count`, NOT `chinese_chars + english_letter_count`. The letter-based count from `count_words.py` typically overcounts by 30-50% compared to Word. Always regenerate DOCX and verify with a Word-style count before declaring done;
- Use `python3` to count: strip all Chinese/English punctuation, count Chinese chars + alphanumeric chars;
- When user says "6000字左右", target ~6000 excluding punctuation;
- Title, authors, unit, abstract, keywords, body, references, and author bio are all present;
- Abstract 150-300 chars;
- Keywords 3-5 terms, semicolon-separated, no ending punctuation;
- Headings ≤3 levels, Arabic numbering, flush left;
- Level 1: `1` `2` (四号黑体); Level 2: `1.1` (小四号黑体); Level 3: `1.1.1` (五号黑体);
- Figures: caption below, centered, numbered 图1/图2;
- Tables: caption above, centered, numbered 表1/表2;
- Author bio ≤150 chars with required contact fields;
- NO placeholders: `待补充`, blank phone/email/address, example rows, template text.

## Attachment Checks

- **Attachment 2**: 论文征集信息汇总表 — 论文题目, 作者姓名, 工作单位, 所属领域, 联系电话, 邮箱;
- **Attachment 3**: 作者授权书（出版+上网）— paper title, signature name, ID number, address, phone, email, date;
- **Attachment 4**: 不涉密承诺书 — paper name, first author, unit stamp, responsible person signature, date.

If filling attachments, ask only for missing private info that cannot be inferred (phone, email, ID number, signature method, address, stamp date).

## Reference Format (from Template)

The 京网杯 template specifies these formats. **Do NOT use [R], [C], [J] type markers** — they are not part of the template.

| Source type | Format | Example |
|---|---|---|
| 专著/报告 | `[序号] 作者.题名.出版单位，出版年.` | `[1] IBM. Cost of a Data Breach Report 2024. IBM Security, 2024.` |
| 论文集/会议 | `[序号] 作者.题名.会议名，年: 起止页码.` | `[3] Carlini N, et al. Extracting training data from LLMs. USENIX Security, 2021: 2633-2650.` |
| 期刊 | `[序号] 作者.题名.刊物名，年，卷(期): 页码.` | `[7] Ji Z, et al. Survey of hallucination. ACM Computing Surveys, 2023, 55(12): 1-38.` |
| 电子文献 | `[序号] 作者.题名.出处/URL，日期.` | — |

Font: **六号宋体** (7.5pt) for references. English text uses Times New Roman (ascii/hAnsi) with 宋体 (eastAsia) fallback.

## In-Text Citation Format

Template requires: **"引用文献应在文章中的引用处右上角加注序号"** — i.e., `[N]` must be **superscript**.

To set superscript on a run via python-docx:
```python
from docx.oxml.ns import qn
from lxml import etree

rpr = run._element.find(qn('w:rPr'))
if rpr is None:
    rpr = etree.SubElement(run._element, qn('w:rPr'))
va = rpr.find(qn('w:vertAlign'))
if va is None:
    va = etree.SubElement(rpr, qn('w:vertAlign'))
va.set(qn('w:val'), 'superscript')
```

To split a run containing mixed text and `[N]` into separate runs (text + superscript citation + remaining text), use `re.split(r'(\[\d+\])', run.text)` and create new runs for each part. See `scripts/fix_citations.py` for a complete implementation.

## Editing References in Existing DOCX (No Generation Script)

When a paper has a pre-existing `.docx` but no `gen_docx.py` or JSON source, you can edit references directly in the DOCX using python-docx. This is a **four-phase** operation: (1) delete bad refs, (2) renumber remaining refs, (3) update ALL in-text citations, (4) add missing citations + remove deleted-paper mentions. Do them in this order.

```python
from fix_citations import build_mapping, delete_ref_paragraphs, renumber_references
from fix_citations import update_in_text_citations, set_superscript_citations
from fix_citations import add_citation_after_text, remove_sentences_containing
```

```python
from docx import Document
from docx.oxml.ns import qn
from lxml import etree
import re, copy, shutil

src = 'paper.docx'
bak = 'paper_backup.docx'
shutil.copy2(src, bak)  # ALWAYS backup first

doc = Document(src)

# --- Phase 0: Build mapping ---
delete_refs = {3, 8, 9, 10}  # old numbers to remove
mapping = {}  # old_num → new_num (None if deleted)
new_num = 1
for old in range(1, 16):
    if old in delete_refs:
        mapping[old] = None
    else:
        mapping[old] = new_num
        new_num += 1

# --- Phase 1: Delete bad reference paragraphs (back-to-front) ---
body = doc.element.body
delete_indices = []
ref_start = None
for i, para in enumerate(doc.paragraphs):
    if para.text.strip() == '参考文献':
        ref_start = i
    if ref_start and i > ref_start:
        m = re.match(r'^\[(\d+)\]', para.text.strip())
        if m and int(m.group(1)) in delete_refs:
            delete_indices.append(i)

for idx in sorted(delete_indices, reverse=True):
    body.remove(doc.paragraphs[idx]._element)

# --- Phase 2: Renumber reference list paragraphs ---
# (Use lxml to ensure all w:t nodes in a run are updated)
def renumber_ref(para_elem, old_m, new_n):
    for run in para_elem.findall('.//w:r', {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}):
        for t in run.findall('.//w:t', {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}):
            if t.text and re.match(r'^\[\d+\]', t.text):
                t.text = re.sub(r'^\[\d+\]', f'[{new_n}]', t.text, count=1)

for para in doc.paragraphs:
    m = re.match(r'^\[(\d+)\]', para.text.strip())
    if m:
        old = int(m.group(1))
        new = mapping.get(old)
        if new is not None:
            renumber_ref(para._element, old, new)

# --- Phase 3: Update in-text citations via lxml ---
nsmap = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
for para in doc.paragraphs:
    for t in para._element.findall('.//w:t', nsmap):
        if t.text and '[' in t.text:
            def repl(m):
                n = mapping.get(int(m.group(1)))
                return f'[{n}]' if n else ''
            t.text = re.sub(r'\[(\d+)\]', repl, t.text)

doc.save(src)
```

**⚠️ Pitfall: SEQUENTIAL REPLACEMENT COLLISION** — When renumbering in-text citations, you CANNOT do `text.replace('[4]', '[5]')` then `text.replace('[5]', '[6]')` in sequence. The first replacement creates a new `[5]` that the second replacement catches, turning both into `[6]`. **Always use a single-pass regex replacement** that reads the mapping dict, OR replace in descending order (highest old number first). The lxml approach above avoids this by building a replacement function that resolves each `[N]` in one pass via the mapping dict. Caught this bug in session 2026-06-07 — caused 5 references to be lost from a real paper.

**⚠️ Pitfall: ALWAYS BACKUP before modifying DOCX** — python-docx modifications are destructive and cannot be undone. If the first script has a bug (e.g., the sequential collision above), the file is permanently corrupted. Always `shutil.copy2(src, src + '.bak')` or copy to a separate filename first. Caught this in session 2026-06-07 — no backup existed and the original was lost.

**⚠️ Pitfall: `para.runs[0].text = new_text` may not update all runs** — DOCX paragraphs can have many runs (split by formatting, spell-check, etc.). Setting only `runs[0].text` leaves other runs unchanged, causing garbled output. Use the lxml approach above (`findall('.//w:t')`) to update ALL text nodes in the paragraph. If you need to replace the entire paragraph text, clear ALL runs first: `for r in runs: r.text = ''`, then set `runs[0].text`. But even this fails if some runs have no `w:t` element. The lxml approach is the most reliable.

**⚠️ Pitfall: Deleted reference paragraphs must be removed via XML, not just emptied** — `para.runs[0].text = ''` leaves an empty paragraph. Use `body.remove(para._element)` to fully remove the element. Remove back-to-front to avoid index shifting.

**⚠️ Pitfall: MD and DOCX may have DIFFERENT reference lists** — They are often independently maintained. Always check BOTH files. If they diverge, ask the user which is authoritative, or verify and fix both independently.

## Revision Guidance

- Keep technical contribution, experiments, conclusion, and application value;
- Compress repeated architecture/process descriptions first;
- Do NOT invent experimental data;
- Keep sensitive production details generalized or marked as desensitized;
- Retain citation numbering and update reference order if text is moved;
- When shortening to a target (e.g. "5500字左右"), calibrate against Word/WPS displayed count, not script counts.

## References Policy (CRITICAL)

> Full verification guide: `references/chinese-reference-verification.md`

- Target: **15篇左右** (user preference)
- Must be **近5年内** (2021-2026) unless citing a seminal/classic paper
- **NEVER fabricate references.** AI-generated author names, volume numbers, page ranges are often wrong. Every reference must be verified to exist.
- Verification approach (see `references/chinese-reference-verification.md` for full guide):
  1. **Use 360搜索 (so.com) first** — most reliable for Chinese academic searches, no captcha, handles exact-match quotes correctly
  2. Academic APIs (Semantic Scholar, CrossRef, OpenAlex) — good for English papers, nearly useless for Chinese-language papers
  3. CNKI/Baidu Scholar — authoritative but aggressive captcha from automated access
  4. **Do NOT trust Bing for Chinese exact-match** — it splits characters and returns garbage
  5. Confirm author names, journal/conference, year, volume, pages
  6. If cannot verify, replace with a known-real paper on the same topic
- **AI fake reference patterns**: Two common surnames + generic title matching paper's topic + prestigious journal + plausible volume/pages. If 3+ of these signals present, treat as suspicious. **Key insight**: AI fabricates application-domain references (应急通信, 割接迁移, 卫星通信) far more than foundational method references (ML/RL classics). When triaging, mark classic papers (GPT-3, Hinton, LightGBM, MapReduce, GFS) as REAL immediately; focus verification effort on the application-specific Chinese journal papers.
- **Fake arXiv ID pattern (Pitfall from session 2026-06-07)**: AI may cite a real-sounding paper title but attach a completely unrelated arXiv ID. Example: "PenHeal: A multi-agent LLM-based framework" was cited with arXiv:2409.16076, but that ID is actually a physics paper ("Condensate decay in a radiation dominated cosmology"). Always verify arXiv IDs by fetching the actual abstract: `curl -s "https://export.arxiv.org/api/query?id_list=2409.16076" | grep -i title`. The correct PenHeal paper is arXiv:2407.17788 by Huang & Zhu.
- **CrossRef API for English paper verification**: `https://api.crossref.org/works?query=<title keywords>&rows=3&select=title,author,container-title,volume,issue,page,DOI` — returns authoritative metadata. Check title, author family names, journal, volume/issue/pages. This is the single most reliable English paper verification tool.
- **When deleting references, also remove their text mentions** — If you delete reference [9] (Fang et al. zero-day), you must also remove or rewrite sentences like "Fang等人的研究证明多个LLM Agent组成的团队能够自主发现并利用零日漏洞". Leaving text that references a deleted paper without a citation is a reviewer red flag. After deleting references, grep the body for author names and paper titles from the deleted refs and clean up any remaining mentions. Use `remove_sentences_containing(doc, ['Fang', 'AutoGen', 'PenHear'])` from `fix_citations.py` to automate this. See `references/removing-deleted-mentions.md` for details.
- **After replacing references, add missing citations** — If a reference exists in the list but is never cited in the text (orphan ref), find the appropriate place in the text and add it. Common pattern: the text mentions a concept (e.g., "LoRA微调", "RAG知识图谱") without citing the corresponding paper. Use `add_citation_after_text(para, 'LoRA微调', 8)` from `fix_citations.py` to insert a superscript `[N]` after the matched text. See `references/adding-citations-to-text.md` for patterns and pitfalls. This splits the run and creates a properly formatted superscript citation. Always verify the insertion point is correct — the concept must actually relate to the paper being cited.
- **After replacing references, cross-check completeness** — Every reference in the list must be cited at least once in the text. Every `[N]` in the text must have a corresponding reference. Orphan references (in list but not cited) are a reviewer red flag. Use `re.findall(r'\[(\d+)\]', text)` across all sections to build the cross-check. Fix orphan refs by adding citations with `add_citation_after_text()`.
- **When replacing entire paragraph text, preserve run structure** — If you clear all runs and set `runs[0].text = new_text`, you lose all formatting (superscript, bold, font changes) from subsequent runs. Instead, use `add_citation_after_text()` to surgically insert citations without disturbing existing formatting. Only use the "clear all runs" approach when the paragraph has no special formatting.
- **When replacing entire paragraph text, preserve run structure** — If you clear all runs and set `runs[0].text = new_text`, you lose all formatting (superscript, bold, font changes) from subsequent runs. Use `add_citation_after_text()` to surgically insert citations without disturbing existing formatting.
- **Mix of Chinese and English references is acceptable**
- Acceptable older references: seminal/classic papers (e.g. Hinton's knowledge distillation 2015, LightGBM 2017) that are foundational to the field

## Figures & Images

- Architecture figures are expected (e.g. "如图1所示")
- The user's working folder often contains `.drawio` files with architecture diagrams
- To insert into DOCX: user must export drawio → PNG manually (draw.io desktop → File → Export as → PNG), then agent inserts via python-docx
- If no PNG available, leave placeholder "[图X 标题]" and ask user to export and provide
- Figure captions go BELOW the figure, centered, in 五号宋体: "图1 标题"
- Table captions go ABOVE the table, centered, in 五号宋体: "表1 标题"

## Pitfalls

- **Move fast, ask less** — The user expects you to START WRITING immediately, not cycle through clarification rounds. When they say "先不用写" (skip for now) about author info or other fields, comply instantly and begin drafting. You can fill placeholders later. Multiple rounds of "看完了么？" or "开始呀" are frustration signals — you're being too slow.
- **Read the source document fully before asking questions** — If the user points you to a file, read it completely first. Most answers are already in the material.
- **`generate_docx.py` handles multi-paragraph text** — The script splits `text` on `\\n\\n` and creates separate paragraphs with `first_line_indent` for each. You can safely put multiple paragraphs in a single section's `text` field joined by `\\n\\n`. — If a section's `text` field contains `\n\n` for multiple paragraphs, the script renders it as one giant paragraph. Use a custom gen script that splits on `\n\n` and creates separate paragraphs with `first_line_indent` for each. When merging same-titled sections (see below), you MUST use this multi-paragraph-aware approach.
- **Do NOT create multiple JSON sections with the same `title`** — The `generate_docx.py` script outputs a heading for EVERY section entry. If you have two sections both titled `1 引言`, the DOCX will have the heading printed twice. Instead: merge all paragraphs for the same section into ONE section entry with text joined by `\n\n`, then use the multi-paragraph-aware generation script.
- **References in gen_docx.py need numbering** — The default `gen_docx.py` outputs references without `[N]` numbers. When regenerating after reference replacement, ensure the loop adds `f"[{i}] {ref}"` not just `ref`. Use `enumerate(content["references"], 1)` and format as `f"[{i}] {ref}"`.
- **When replacing references, use single-pass regex or descending order** — Two approaches work: (1) **Single-pass regex** (preferred): build a `{old: new}` mapping dict, then `re.sub(r'\[(\d+)\]', lambda m: f"[{mapping[int(m.group(1))]}]", text)` resolves each citation in one pass with no collision risk. (2) **Descending order**: if doing manual string replacement, sort by old number descending so higher numbers are remapped first. Example: remap [15]→[13] before [12]→[11]. Updating [12] first could create a collision if [11] is also being remapped. See the full 3-phase script in "Editing References in Existing DOCX" section above.
- **`count_words.py` counts paragraph text only, NOT table cell content** — Table headers and cell values are in `doc.tables`, not `doc.paragraphs`, so they are excluded from the count. Table captions (which are regular paragraphs) ARE counted. This means tables add visual pages but not word count. Keep this in mind when targeting ≤6000 chars — you have more room than the script suggests if you have many tables.
- **Experiment section MUST read like a real academic paper, not a project report** — This is the #1 user complaint. The experiment section must NOT be a casual list of deployment results ("我们部署了X系统，处理了Y次"). It needs proper academic structure: (1) 实验环境 with hardware/software config — **write hardware as prose text, NOT as a separate table** (user said "5张表格太多了"); (2) 数据集与评测指标 clearly defined; (3) 对比实验 with quantitative comparison tables against baselines (before/after, or vs. other methods); (4) 消融分析 showing contribution of each component. Good metric dimensions: precision/recall/F1 for detection, alert noise reduction rate, response time (MTTR) reduction ratio. Tables must have headers, units, and clear methodology. The tone must be analytical, not promotional.
- **Maximum 3-4 tables in the paper** — User explicitly complained "5张表格太多了". Keep only the most important experimental comparison tables (typically: alert noise reduction, detection accuracy, ablation study). Hardware config goes in prose. Response efficiency can be merged into ablation analysis text.
- **Architecture figure is MANDATORY** — User said "同时你要放一个插图的". Every paper must include at least one architecture/system diagram. If the user hasn't provided a drawio export, create a placeholder PNG using PIL (colored rectangles for layers + arrows) and insert it. Prompt the user to replace with their real diagram later. The figure goes in Section 2.1 right after "如图1所示".
- **Source material alone is NOT enough — search the internet for real data** — When writing based on a project application or competition entry, DO NOT just rewrite the source material in academic format. You MUST search for: (1) industry statistics and benchmarks (e.g., IBM Cost of Data Breach, CrowdStrike reports, Ponemon SOC surveys) to contextualize the problem; (2) recent academic papers on the same topic for related work; (3) performance data from comparable systems for baseline comparison. Verified real references from web searches make the paper credible; references fabricated from source material alone are a rejection risk.
- **References MUST be verified real** — AI models hallucinate citation details (authors, volumes, page numbers). ALWAYS verify each reference via web search before including. If unverifiable, replace with a known-real paper on the same topic. A paper with fake references will be rejected or cause embarrassment. See `references/chinese-reference-verification.md` for the full verification workflow and known-good replacement sources.
- **Industry data for problem motivation** — See `references/security-industry-data.md` for verified statistics from IBM, CrowdStrike, Ponemon, Gartner, and Chinese sources. Use these to make the introduction and problem statement credible with real numbers, not vague claims.
- **Use `delegate_task` for batch reference verification** — For 15 references, delegate verification to a subagent with `toolsets: ['terminal']` and a structured goal listing each reference. The subagent can call CrossRef API (`curl -s "https://api.crossref.org/works?query=<title>&rows=3&select=title,author,container-title,DOI"`) for each one. This parallelizes the work and keeps the main context clean. Always demand the subagent return specific evidence (DOI, matched title/author) per reference, not just "verified REAL".
- **Subagent reference verification is unreliable** — When delegating reference checks to subagents, they may claim "verified REAL" without actually performing searches. Always demand specific evidence (URLs, quoted search results) in subagent output. Better: verify directly using 360搜索 (so.com).
- **PIL placeholder for architecture diagrams** — When the user hasn't provided a drawio export, create a placeholder PNG using PIL with colored rectangles for each layer and arrows between them. This satisfies the "must have a figure" requirement and gives the user a visual template to replace. Example: draw 3 rounded rectangles (场景层/中枢层/底座层) with labels, save as PNG, insert via generate_docx.py image path.
- **Merge same-title sections in JSON** — When drafting, it's natural to write multiple entries with the same section title (e.g., two entries both titled "1 引言"). Before generating DOCX, merge these into a single entry with paragraphs joined by `\n\n`. Otherwise the output has repeated headings like `1 引言` → `1 引言`.
  - 小二号 = 18pt (title)
  - 四号 = 14pt (level-1 headings)
  - 小四号 = 12pt (level-2 headings)
  - 五号 = 10.5pt (body text, level-3 headings, author name, abstract, keywords)
  - 六号 = 9pt (references, author bio content)
- **Font names require eastAsia fallback** — python-docx needs `run._element.rPr.rFonts.set(qn('w:eastAsia'), '黑体')` in addition to `run.font.name = '黑体'` for Chinese fonts to render correctly in Word/WPS.
- **Insert images inline in text body** — Place images at the exact position referenced in text (e.g., after "如图1所示" paragraph), not appended at the end. Use `run.add_picture(img_path, width=Cm(14))` centered.
- **Figure captions below figure, table captions above table** — Per template: 图名在图下居中, 表名在表上居中.
- **Collect ALL author info before writing** — Ask for: name, gender, birth year/month, highest degree, unit, specialty, title/rank, honors, address, postal code, phone, email. Missing fields cause back-and-forth.
- **Word count — CRITICAL: Word/WPS counts differently from Python scripts** — Word's "字数统计" counts **Chinese characters + English WORDS** (not individual letters/digits). For example, "MTTD" = 1 word, "FLOPS" = 1 word, "SQL" = 1 word. A Python script counting `re.findall(r'[a-zA-Z0-9]', text)` counts individual LETTERS, which inflates the count by 3-5x for technical papers. To approximate Word's count: `chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))` + `english_words = len(re.findall(r'[a-zA-Z]+', text))`. **Always verify the final DOCX with Word/WPS — script counts are rough pre-checks only.** When the user says "6000字", they mean Word's count (Chinese chars + English words), NOT Chinese chars + individual letters. A paper showing 6000 by the letter-counting method will typically show only ~4000 in Word, causing major rework.
- **Reference recency** — Prefer 2021-2026 papers. Classic pre-2021 papers acceptable only for foundational works (LightGBM, knowledge distillation original paper, etc.). Aim for 12+ of 15 refs within 5 years.
- **Multiple author order** — Confirm author ordering with user. First author is typically the primary contributor; corresponding author may differ.
- **File naming convention** — `工作单位+论文题目+所属领域.docx` (use `+` separator, not spaces or hyphens)
- **`read_file` tool caching prevents re-reading after edits** — The `read_file` tool returns "File unchanged since last read" on subsequent calls, even after external edits (e.g., via `terminal` with python). To verify edits, use `terminal` with `cat`, `grep`, or python instead of `read_file`. Alternatively, use `write_file` tool to write changes (it bypasses the cache).
- **When MD and DOCX both exist, verify both independently** — A common scenario: the MD was generated by the agent, the DOCX was edited manually by the user (or vice versa). Reference lists can diverge silently. Always grep both files for `[N]` patterns and cross-check.
- **python-docx may fail to open files with special characters in path**. Use `glob` to locate files, then pass the resolved path. If still failing, ask the user to check the file in Word/WPS directly;
- **Template DOCX may be corrupted or unreadable by python-docx**. The template is under `京网杯要求/`. If python-docx fails, use the actual submitted papers in `论文1/` or `论文2/` as structural references instead;