#!/usr/bin/env python3
"""
Count Chinese chars + English/digits (excluding punctuation) for 京网杯 word limit check.
Usage: python count_words.py <file.md or file.docx>
"""
import sys, re, os

def count_text(text):
    # Remove all whitespace and newlines
    text = re.sub(r'\s+', '', text)
    # Chinese characters
    cn = len(re.findall(r'[\u4e00-\u9fff]', text))
    # English letters and digits
    en = len(re.findall(r'[a-zA-Z0-9]', text))
    return cn, en, cn + en

def read_docx(path):
    from docx import Document
    doc = Document(path)
    return "\n".join(p.text for p in doc.paragraphs)

def read_md(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python count_words.py <file>")
        sys.exit(1)

    path = sys.argv[1]
    if path.endswith('.docx'):
        text = read_docx(path)
    else:
        text = read_md(path)

    cn, en, total = count_text(text)
    limit = 6000
    status = "✅ OK" if total <= limit else f"⚠️ 超出 {total - limit} 字"

    print(f"中文字符: {cn}")
    print(f"英文/数字: {en}")
    print(f"合计（不含标点）: {total}")
    print(f"限制: {limit}")
    print(f"状态: {status}")
