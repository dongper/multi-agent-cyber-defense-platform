---
name: patent-drafting-cn
description: Draft, expand, and search Chinese patents (CNIPA). Includes workflow for expanding brief patent ideas into full documents, and prior art search to assess novelty and find differentiation opportunities.
---

## When to Use
- User has a brief patent idea/outline and wants it expanded into a full CNIPA-style patent document
- User wants to search for existing patents to assess novelty of a concept
- User needs to identify differentiated claim angles for a crowded patent space

## Workflow

### Phase 1: Patent Prior Art Search
When user wants to check if a patent idea is novel:

1. Use delegate_task with web toolset to search existing patents
2. Search keywords should include both Chinese and English terms
3. Required output format for each result:
   - 专利号 (Patent Number)
   - 专利名称 (Patent Title)
   - 专利摘要 (Patent Abstract)
   - 申请人 (Applicant)
   - 公开年份 (Publication Year)

4. Search strategy:
   - Use CNIPA, Google Patents, and general web search
   - Include algorithm/method terms + application domain
   - Search both exact phrase matches and related concepts

5. After search, assess:
   - Coverage level (高度覆盖 / 中度覆盖 / 低覆盖)
   - Identify gaps and differentiation opportunities

### Phase 2: Patent Document Expansion
When expanding a brief patent idea into a full document:

1. Identify differentiation points from prior art search (or ask user for specific innovations)
2. Structure the document according to CNIPA format:
   - 一、说明书摘要 (Abstract - 200-300 chars)
   - 二、摘要附图 (Abstract Figure reference)
   - 三、权利要求书 (Claims - 独立权利要求 + 从属权利要求)
   - 四、说明书 (Description)
     - 技术领域
     - 背景技术 (reference existing patents as prior art)
     - 发明内容
     - 有益效果 (numbered list)
     - 附图说明
     - 具体实施方式 (multiple 实施例)

3. Claims structure:
   - Claim 1: 独立权利要求 (broadest scope, all essential features)
   - Claims 2-N: 从属权利要求 (narrower, specific implementations)
   - Include both 方法 and 系统 claims when applicable
   - Each dependent claim should reference a parent claim

4. File generation:
   - Write content as .txt first
   - Convert to .docx using python3 with python-docx locally
   - Save in user's project folder

### Key Differentiation Strategies (for crowded spaces)
When prior art search shows high coverage, focus claims on:
- Closed-loop feedback mechanisms (闭环反馈)
- Real-time/streaming vs batch processing (实时/流式 vs 批处理)
- Uncertainty quantification and confidence scoring (不确定性量化)
- Cross-domain adaptation and transfer learning (跨域迁移)
- Automated what-if simulation / counterfactual analysis (反事实仿真)
- Compliance auditing and traceability (合规审计溯源)
- Lightweight edge deployment (轻量化边缘部署)

### File Operations
- Extract docx content: `textutil -convert txt -stdout "path/to/file.docx"`
- Generate docx: Write .txt content, then use local python3 with python-docx to convert
- Save output in the user's project directory

## Writing 研究内容 Sections (项目申报/课题研究)

When user asks to write 研究内容 (research content) for project proposals,课题申报, or technology research plans:

### Style Rules (CRITICAL — user repeatedly corrected for verbosity)
- **Start concise, offer to expand.** Default to 2-4 points, each 3-4 sentences. Never dump a wall of text on first pass.
- **Use numbered points** (一、二、三…), each with a bold title + short paragraph.
- **No formula dumps or architecture diagrams** in 研究内容 — save those for the full document if user asks.
- **If user says "简单点"**: cut to 2 sentences per point. "再简单点": cut to 1-2 sentences.
- **If user says "详细点"**: expand to 4-5 sentences per point with specific techniques/metrics mentioned.
- **Iterate on length** — the user will tell you if it's too long or too short. Don't preemptively over-write.

### Typical Structure
Each 研究内容 point follows: **问题/目标 → 方法/路径 → 预期成果** in compressed form.

### Example (good — concise, 2 points):
> **一、评估用例体系设计。** 面向客服应答、业务咨询等典型服务场景，设计分层评估用例，覆盖单轮问答与多轮对话两种交互模式，每个用例包含输入query、期望行为、约束条件和评判标准。
>
> **二、评测数据集构建。** 从生产环境采样真实服务对话脱敏后作为种子数据，利用LLM合成增强生成多难度梯度的评估用例，构建覆盖正例、负例和兜底例的均衡数据集。

See `references/research-content-examples.md` for more examples at different verbosity levels.

## Pitfalls
- python-docx may not be available in sandbox environments; install locally first or use textutil approach
- User's docx files may contain formatting that python-docx can't parse; textutil is more reliable for extraction
- Patent claims must be carefully worded - too broad risks rejection, too narrow limits protection scope
- Always reference prior art in 背景技术 section to establish novelty
- When prior art is dense, focus on specific algorithmic improvements or novel combinations rather than general concepts

## 技术交底书 (Technical Disclosure Document) Workflow

When drafting 技术交底书 (invention disclosure) rather than formal CNIPA applications:

### Template Structure
Use python-docx to read and fill existing .docx templates. Required fields:
提案名称、申报单位、技术联系人、技术背景、现有技术缺点、发明目的、技术方案详细阐述、关键点/保护点、替代方案、落地可能性、检索报告。

### python-docx Font Handling Pitfalls
**Font crash fix**: When setting rFonts on docx runs, the run MUST have an rPr element first:
```python
def set_cell_text(cell, text):
    cell.text = ""
    para = cell.paragraphs[0]
    run = para.add_run(text)
    run.font.size = Pt(10)
    run.font.name = '宋体'
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.makeelement(qn('w:rFonts'), {
        qn('w:ascii'): '宋体', qn('w:hAnsi'): '宋体', qn('w:eastAsia'): '宋体'
    })
    rPr.append(rFonts)
```
**Never use `doc.add_heading()`** — Chinese .docx templates often lack Heading styles and will crash. Use bold paragraphs instead.

### Technical Specification Depth
The 技术方案详细阐述 must be deep enough that "所属技术领域的技术人员不必花费创造性劳动即可实施":
1. **数据结构定义** — Define all core data structures
2. **Each step (S1, S2, ...)** needs sub-steps (S101, S102, ...) with 3-5 sub-steps per major step
3. **Each sub-step** must include: procedural description, key formulas (minimal), I/O specification, thresholds with defaults, edge case handling
4. **实施例** — Full walkthrough with real numbers, sample statistics, strategy comparison tables
5. **User preference**: "说明清楚怎么做就可以，不需要这么多公式" — write clear procedural descriptions, reserve full formulas for core inventive steps only

Typical length: **15,000-25,000 characters** for a substantive invention.

### Figure Generation
Create SVGs as raw XML strings, convert to PNG with cairosvg (`pip3 install cairosvg`), insert into docx. Required figures: 整体流程图, 核心模块流程图, 决策流程图, 系统架构图.

### Innovation Angle Design (for crowded spaces)
Proven patterns:
1. **Cross-domain theory migration**: mature theory from one field → another (e.g., rate-distortion theory → data quality repair)
2. **Quantitative decision framework**: replace heuristics with mathematical optimization
3. **Closed-loop feedback**: add self-adjustment mechanism
4. **Unified metric**: replace multiple incomparable metrics with a single measure

**Avoid**: pure algorithms without technical context, "AI/智能/自动" as core feature, LLM applications without specific fusion logic.

### Review Checklist
- [ ] 技术背景 describes 4+ limitations of existing technology
- [ ] 现有技术缺点 and 发明目的 are 1-to-1 matched
- [ ] 技术方案 has data structures + 4 major steps + sub-steps + formulas + thresholds
- [ ] 实施例 has complete numerical walkthrough (calculated, not described)
- [ ] 关键点/保护点 has 3-4 items, each distinct from prior art
- [ ] 替代方案 has 3-4 alternatives
- [ ] 检索报告 has 3+ keywords, 3+ patent references, comparison analysis
- [ ] All 4 figures present with descriptions
- [ ] 落地可能性 has phased plan with timeline

### Additional Pitfalls
- **Template docx may lack Heading styles** → Use bold paragraphs, never `add_heading()`
- **rPr element missing crash** → Use `get_or_add_rPr()` before creating rFonts element
- **Heredoc shell scripts can hang** → Write scripts to /tmp/ and run separately
- **cairosvg can timeout on first run** → Install via pip first, then run in background mode
- **Technical spec too shallow** → #1 reason for rejection. Each step MUST have sub-steps with algorithms, thresholds, and edge cases
- **Chinese file paths with spaces break shell `ls`** → Use `search_files` tool to find .docx paths, then use python-docx directly
- **CONTENT OWNERSHIP** → Only include achievements, evidence, screenshots that belong to the user. Never attribute another person's work to the user.