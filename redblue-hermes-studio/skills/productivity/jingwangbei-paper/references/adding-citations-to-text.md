# Adding Citations to Existing Text

When a reference is in the list but never cited in the body, you need to find the right place and insert a superscript `[N]`. This is different from renumbering — it's surgical insertion.

## Pattern: Insert citation after a concept mention

Common cases where text mentions a concept without citing the paper:

| Text contains | Missing citation | Insert after |
|---|---|---|
| "LoRA微调" | [8] LoRA (ICLR 2022) | `LoRA微调` |
| "RAG的可信知识图谱" | [10] RAG (NeurIPS 2020) | `RAG` |
| "攻击事件链" | [9] CoT (NeurIPS 2022) | `攻击事件链` |
| "QLoRA" | [11] QLoRA (NeurIPS 2023) | `QLoRA` |

## How it works

`add_citation_after_text(para, search_text, citation_num)` from `fix_citations.py`:

1. Finds the run containing `search_text`
2. Splits it at `search_text + len(search_text)`
3. Creates a new superscript run with `[N]`
4. Creates a trailing run with the remaining text

This preserves all existing formatting (superscripts, bold, fonts) in the paragraph.

## Example: Adding 3 missing citations

```python
from fix_citations import add_citation_after_text

# Para 23: "LoRA微调" → "LoRA微调[8]"
add_citation_after_text(doc.paragraphs[23], 'LoRA微调', 8)

# Para 21: "RAG" → "RAG[10]"  
add_citation_after_text(doc.paragraphs[21], 'RAG', 10)

# Para 28: "攻击事件链" → "攻击事件链[9]"
add_citation_after_text(doc.paragraphs[28], '攻击事件链', 9)
```

## Pitfalls

- **search_text must be unique enough** — If "RAG" appears multiple times in the paragraph, the function matches the first occurrence. Use longer search strings for disambiguation (e.g., "RAG的可信" instead of "RAG").
- **Don't insert citations in the middle of a sentence** — The citation should go at the end of the concept phrase, not mid-clause. "基于安全领域语料进行LoRA微调" → insert after "LoRA微调", not after "LoRA".
- **Verify the citation makes sense at that location** — [8] LoRA should cite the actual LoRA paper, not just any paper that mentions LoRA. Check that the concept and the paper are semantically related.
