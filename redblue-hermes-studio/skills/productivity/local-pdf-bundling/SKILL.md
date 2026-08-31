---
name: local-pdf-bundling
description: 在本地把多张图片合成 PDF、合并多个 PDF、按分类生成总 PDF/Word，并处理单页 PDF 过小的情况。
version: 1.0.0
author: hermes
license: MIT
metadata:
  hermes:
    tags: [PDF, DOCX, Images, PyPDF2, Pillow, reportlab, python-docx, macOS]
---

# local-pdf-bundling

适用于用户给出本地文件夹或桌面文件，希望：
- 把一批图片合成一个 PDF
- 把多个 PDF 合并成一个总 PDF
- 把多类举证材料整理成一个 Word 版本
- 修复某个 PDF 页面看起来过小的问题

## 何时使用

当用户说类似下面的话时：
- “把这个文件夹里的照片放到一个 PDF 上”
- “把这两个 PDF 合到一起”
- “再给我一个 Word 版本”
- “这个 PDF 某一页有点小”

## 先做的检查

1. 用 `search_files` 定位目标文件或文件夹。
2. 用 `terminal`/Python 列出目录内容，确认：
   - 图片格式：`.png .jpg .jpeg .webp .bmp .tif .tiff`
   - PDF 文件
   - 是否有隐藏文件、zip、旧汇总文件需要排除
3. 如果用户说“新的照片”，不要假设路径不变，先重新扫描目录。

## 图片合成 PDF

优先用 Python + Pillow：

```python
from PIL import Image
from pathlib import Path
folder = Path('...')
files = sorted([p for p in folder.iterdir() if p.suffix.lower() in {'.png','.jpg','.jpeg','.webp','.bmp','.tif','.tiff'}])
images = []
for p in files:
    img = Image.open(p)
    if img.mode in ('RGBA', 'LA', 'P'):
        bg = Image.new('RGB', img.size, 'white')
        if img.mode == 'P':
            img = img.convert('RGBA')
        bg.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
        img = bg
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    images.append(img)
images[0].save('output.pdf', save_all=True, append_images=images[1:])
```

### 注意

- PNG 常带透明背景，必须转成白底 RGB，否则导出 PDF 容易异常。
- 结果页序默认使用文件名排序；如果用户在意顺序，要先排序再导出。
- 导出后一定核对是否生成成功、文件大小是否正常。

## 合并多个 PDF

优先用 `PyPDF2.PdfMerger`：

```python
from PyPDF2 import PdfMerger
merger = PdfMerger()
for p in ['a.pdf', 'b.pdf']:
    merger.append(p)
with open('merged.pdf', 'wb') as f:
    merger.write(f)
merger.close()
```

### 验证

用 `PdfReader` 检查：
- 每个源 PDF 页数
- 合并后总页数
- 输出文件大小

## 按分类整理成总 PDF + Word

当有多个文件夹（如“论文举证 / 专利举证 / 竞赛举证”）时：

### 总 PDF

推荐 `reportlab`：
- 每个分类先放一个标题页
- 每张图片单独一页
- 图片等比缩放到 A4 可用区域内
- 页顶可写入原文件名便于核对

核心做法：
- 页面大小：`A4`
- 留边：约 `36 pt`
- 缩放比例：`min(max_w/iw, max_h/ih)`

### Word 版本

推荐 `python-docx`：
- 文档首页写总标题
- 每个分类写一个二级标题
- 每张图片前加文件名
- 图片统一宽度（如 `6.0 inches`）
- 分类间或图片间用 `page_break()` 分隔

中文字体可设置东亚字体，如：

```python
style = doc.styles['Normal']
style.font.name = 'Arial'
style._element.rPr.rFonts.set(qn('w:eastAsia'), 'PingFang SC')
```

## 单页 PDF 看起来过小的处理

### 经验结论

如果用户说“2.pdf 有点小”，不要只看文件大小；先检查：
1. 页面尺寸是否远小于另一个 PDF
2. 是内容本身太小，还是白边太多

### 检查方式

1. 用 `PyPDF2.PdfReader` 查看每页 `mediabox`：
   - `1.pdf` 可能是大尺寸扫描页
   - `2.pdf` 可能只是 A4 页
2. 必要时把 PDF 首页导出成 PNG，再用视觉分析判断：
   - 是外层留白问题
   - 还是整页尺寸不一致问题

### 实际可复用方案

如果主要问题是“合并后观感太小”，最稳妥的是：
- 按较大 PDF 的页面尺寸新建一页
- 将较小 PDF 页面等比放大后居中贴到新页上
- 再参与最终合并

兼容 `PyPDF2 3.x` 的写法：

```python
from PyPDF2 import PdfReader, PdfWriter, Transformation
import copy
r_big = PdfReader('1.pdf')
r_small = PdfReader('2.pdf')
target = r_big.pages[0]
p = copy.copy(r_small.pages[0])
target_w = float(target.mediabox.width)
target_h = float(target.mediabox.height)
src_w = float(p.mediabox.width)
src_h = float(p.mediabox.height)
scale = min(target_w/src_w, target_h/src_h) * 0.96
new_w = src_w * scale
new_h = src_h * scale
tx = (target_w - new_w) / 2
ty = (target_h - new_h) / 2
p.add_transformation(Transformation().scale(scale, scale).translate(tx, ty))
writer = PdfWriter()
blank = writer.add_blank_page(width=target_w, height=target_h)
blank.merge_page(p)
with open('2_scaled.pdf', 'wb') as f:
    writer.write(f)
```

再把 `2_scaled.pdf` 与其他 PDF 合并。

## 踩坑记录

1. `mergeTransformedPage()` 在新版 `PyPDF2` 会触发弃用/报错。
   - 应改为：`page2.add_transformation(ctm); page.merge_page(page2)`
2. 自动裁白边不一定有效：
   - 某些证书页本身是整页浅底纹，简单阈值检测会把整页都当成内容
   - 这时“裁边”不如“按目标页尺寸放大”稳妥
3. 同名汇总文件可能出现在不同目录，合并前要重新定位，不要假设还在原路径。
4. 用户说“新的照片”时，优先重新列目录，而不是复用之前的文件列表。

## 最后核对

完成后必须汇报：
- 输出文件完整路径
- 是否成功生成
- 页数/图片数量
- 文件大小
- 若做了放大或重排，要说明处理方式
