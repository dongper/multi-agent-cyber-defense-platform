# Removing Text Mentions of Deleted References

When you delete references from the bibliography, you MUST also remove or rewrite any text that mentions those papers. Leaving "Fang等人的研究证明..." without a `[N]` citation is a reviewer red flag.

## Pattern: Identify and remove sentences

After deleting references, search the body text for:
- Author names (Fang, Elabd, PenHear, AutoGen)
- Paper-specific terms (零日漏洞, multi-agent penetration testing)
- System/framework names from deleted papers

## How it works

`remove_sentences_containing(doc, keywords)` from `fix_citations.py`:

1. Iterates through body paragraphs (stops at 参考文献)
2. Splits each paragraph into sentences on `。！？`
3. Drops sentences containing any keyword
4. Reassembles the paragraph

## Example: Cleaning up after deleting 4 references

```python
from fix_citations import remove_sentences_containing

# After deleting refs [8] AutoGen, [9] Fang zero-day, [10] PenHeal
keywords = ['AutoGen', 'Fang', 'PenHeal', 'PenHear', '零日漏洞']
modified = remove_sentences_containing(doc, keywords)
print(f"Cleaned {modified} paragraphs")
```

## Pitfalls

- **Partial matches can be too aggressive** — If you delete a paper by "Wei" and search for "Wei", you might remove sentences about other "Wei" papers that you kept. Use more specific keywords (full name, paper title, or unique terms).
- **Don't remove sentences that are still valid** — If a sentence mentions a deleted paper's FINDING (not the paper itself), and the finding is independently verifiable, you can keep the sentence and just remove the citation. Example: "Ponemon Institute研究表明..." can stay if the data is real, even if you deleted the specific Ponemon report reference.
- **Check that remaining text still flows** — Removing a sentence from the middle of a paragraph can leave a logical gap. Read the paragraph after modification to ensure coherence.
