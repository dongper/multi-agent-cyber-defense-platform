# SVG → PNG / favicon / avatar generation on macOS (no rsvg-convert)

Everything below was validated on macOS (Apple Silicon) using ImageMagick (`magick`/`convert`)
and the system QuickLook renderer `qlmanage`. `rsvg-convert` is often NOT installed.

## Downloading brand logos

- worldvectorlogo CDN: `https://cdn.worldvectorlogo.com/logos/<slug>.svg` (e.g. `china-unicom.svg`) — square icon mark.
- logo.wine: `https://www.logo.wine/a/logo/<Name>/<Name>-Logo.wine.svg` — full horizontal lockup (graphic + wordmark).
- **Color sanity-check**: some vector mirrors carry the WRONG brand color. worldvectorlogo's
  `china-unicom.svg` was deep blue `#373b92`; logo.wine had the correct red `#d91920`.
  Always `grep -oE 'fill="#[0-9a-fA-F]{3,6}"' file.svg | sort | uniq -c` before using a download.

## Rendering SVG → PNG

- Without `rsvg-convert`, ImageMagick falls back to its internal MSVG renderer, which:
  - produces semi-transparent / banded fills on complex paths, and
  - does NOT honor `clip-path` (SVG clip paths are silently ignored — do not rely on them to crop).
- Best quality on macOS: `qlmanage -t -s <size> -o <dir> <file>.svg` — renders via QuickLook at high
  quality BUT forces a WHITE background. Then strip it:
  `magick out.png -fuzz 12% -transparent white PNG32:out-transparent.png`.

## Cropping a "graphic + wordmark" combined logo into a square icon

Some vector marks pack the icon AND a wordmark into the same path(s) (knot + text). For a square
app icon you must drop the text:

1. Render large (1024), strip background to transparent.
2. Find the icon-vs-text split by alpha ROW BLOCKS:
   `magick img.png -alpha extract -resize 1x1024! txt:-`, parse per-row mean alpha, then find the
   LARGEST contiguous non-transparent row block (that's the icon); the smaller block below is the wordmark.
3. Crop the icon bbox: `magick img.png -crop WxH+X+Y +repage`.
4. Center into a square canvas: `magick cropped.png -resize NxN -gravity center -background none -extent SxS`.

## favicon.ico (multi-size)

`magick logo.png -define icon:auto-resize=64,48,32,16 favicon.ico`

## Circular avatar (solid disc + white glyph)

```
magick -size 256x256 xc:none \
  -fill '#d91920' -draw 'circle 128,128 128,4' \
  \( glyph-white.png -resize 168x130 \) -gravity center -composite \
  PNG32:avatar.png
```
To turn a colored glyph white: `magick glyph.png -fuzz 25% -fill white -opaque '#d91920'`.
Watch for leftover anti-aliased pink edges at the white/glyph boundary — raise fuzz, or better,
re-render from an SVG whose `fill` is already `#ffffff` (no recolor step).

## ASCII shape verification (you cannot view images)

Classify each pixel (transparent / white / target-color / other) from ImageMagick `txt:-` output and
print a 30-40 col grid. This is the reliable way to confirm a logo is the right shape and has no
stray text/wordmark residue before shipping.

```python
import subprocess, re
out = subprocess.run(['magick','img.png','-resize','40x40!','-depth','8','txt:-'],
                     capture_output=True, text=True).stdout
grid = [[' ' for _ in range(40)] for _ in range(40)]
for line in out.splitlines():
    if ':' not in line or line.startswith('#'): continue
    coord, rest = line.split(':', 1)
    x, y = map(int, coord.split(','))
    m = re.search(r'\((\d+),(\d+),(\d+),?(\d+)?\)', rest)
    if not m: continue
    r,g,b = int(m.group(1)), int(m.group(2)), int(m.group(3))
    a = int(m.group(4)) if m.group(4) else 255
    if a < 30: grid[y][x] = '.'
    elif r>200 and g>200 and b>200: grid[y][x] = '#'   # white glyph
    elif r>150 and g<90 and b<90: grid[y][x] = 'R'     # red
    else: grid[y][x] = '+'
for row in grid: print(''.join(row))
```
