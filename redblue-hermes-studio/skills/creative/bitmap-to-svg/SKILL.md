---
name: bitmap-to-svg
description: Convert bitmap images (PNG/JPG) to clean SVG vector graphics using OpenCV contour tracing and Bezier curve fitting. Use when the user asks to vectorize, trace, convert-to-SVG, or make a raster image scalable/resolution-independent.
triggers:
  - "convert image/PNG/JPG to SVG"
  - "vectorize this logo/icon/image"
  - "make this scalable/resolution-independent"
  - "trace bitmap to vector"
  - "SVG version of this image"
---

# Bitmap-to-SVG Tracing

Convert raster images to clean, scalable SVG using OpenCV contour detection and smooth Bezier curve fitting.

## When to Use

- User provides a bitmap (PNG/JPG) and wants an SVG version
- Logo/icon/symbol needs to be vectorized for scaling or editing
- Hand-drawing from verbal description is unreliable — **always trace from the actual image**

## Pipeline

### Step 1: Color-Based Region Extraction

```python
import cv2
import numpy as np

img = cv2.imread('input.png', cv2.IMREAD_UNCHANGED)
b, g, r, a = img[:,:,0], img[:,:,1], img[:,:,2], img[:,:,3]

hsv = cv2.cvtColor(img[:,:,:3], cv2.COLOR_BGR2HSV)

# For red objects:
lower1, upper1 = np.array([0, 30, 30]), np.array([20, 255, 255])
lower2, upper2 = np.array([160, 30, 30]), np.array([180, 255, 255])
mask = cv2.bitwise_or(cv2.inRange(hsv, lower1, upper1),
                       cv2.inRange(hsv, lower2, upper2))

# Respect alpha channel if present
if img.shape[2] == 4:
    mask = cv2.bitwise_and(mask, (a > 200).astype(np.uint8) * 255)
```

**For other colors**, sample pixel values first (`img[y, x]`) and check HSV stats on the ROI to find the right H/S/V ranges.

### Step 2: Upscale + Clean

Low-res sources produce jagged vectors. Upscale 8-12x before tracing:

```python
scale = 12
big = cv2.resize(mask, (mask.shape[1]*scale, mask.shape[0]*scale),
                  interpolation=cv2.INTER_CUBIC)
_, binary = cv2.threshold(big, 127, 255, cv2.THRESH_BINARY)

# Morphological close to merge nearby fragments
kernel = np.ones((7, 7), np.uint8)
clean = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=4)

# Gaussian blur → re-threshold for smooth edges
smooth = cv2.GaussianBlur(clean, (9, 9), 0)
_, smooth = cv2.threshold(smooth, 127, 255, cv2.THRESH_BINARY)
```

### Step 3: Contour Tracing with Hierarchy

Use `RETR_TREE` to capture both outer shapes and internal holes (essential for symbols with cutouts/weaving patterns):

```python
contours, hierarchy = cv2.findContours(smooth, cv2.RETR_TREE,
                                        cv2.CHAIN_APPROX_SIMPLE)

# Filter by area (in upscaled coords, threshold ~500)
# hierarchy[0][i][3] == -1 means outer, else it's a child (hole)
```

### Step 4: Catmull-Rom → Cubic Bezier Conversion

Convert polygon points to smooth SVG curves (avoids jagged line segments):

```python
def contour_to_smooth_path(cnt, scale, x_offset, y_offset):
    pts = cnt.astype(np.float64) / scale
    pts[:, :, 0] += x_offset
    pts[:, :, 1] += y_offset
    
    # Simplify contour
    epsilon = 0.008 * cv2.arcLength(cnt.astype(np.float32), True) / scale
    approx = cv2.approxPolyDP(cnt.astype(np.float32), epsilon * scale, True)
    simple = approx.reshape(-1, 2).astype(np.float64) / scale
    simple[:, 0] += x_offset
    simple[:, 1] += y_offset
    
    n = len(simple)
    d = f"M {simple[0][0]:.1f},{simple[0][1]:.1f}"
    
    for i in range(n):
        p0 = simple[(i - 1) % n]
        p1 = simple[i]
        p2 = simple[(i + 1) % n]
        p3 = simple[(i + 2) % n]
        
        cp1x = p1[0] + (p2[0] - p0[0]) / 6
        cp1y = p1[1] + (p2[1] - p0[1]) / 6
        cp2x = p2[0] - (p3[0] - p1[0]) / 6
        cp2y = p2[1] - (p3[1] - p1[1]) / 6
        
        d += f" C {cp1x:.1f},{cp1y:.1f} {cp2x:.1f},{cp2y:.1f} {p2[0]:.1f},{p2[1]:.1f}"
    
    return d + " Z"
```

### Step 5: Assemble SVG

```python
# Outer contours: fill with object color
# Inner contours (parent != -1): fill with white (or use fill-rule="evenodd")
svg_paths = []
for i, cnt in enumerate(valid_contours):
    parent = hierarchy[0][i][3]
    fill = "#C8102E" if parent == -1 else "white"
    svg_paths.append(f'<path d="{path_d}" fill="{fill}"/>')
```

## Pitfalls

1. **Don't hand-draw from verbal descriptions** of complex symbols. Always trace from the actual image — verbal descriptions lose critical geometric detail.

2. **Low-res source = jagged vectors.** Upscale 8-12x with `INTER_CUBIC` before tracing. A 400px source needs at least 8x scaling for smooth curves.

3. **Morphological operations are critical.** Without `MORPH_CLOSE`, fragmented contours produce broken symbols. Tune kernel size and iterations to the source resolution.

4. **`RETR_TREE` not `RETR_EXTERNAL`** for symbols with internal cutouts (holes, weaving patterns, negative space). `RETR_EXTERNAL` only gives outer boundaries.

5. **Catmull-Rom, not raw line segments.** Line-to (`L`) commands produce visible polygon edges. Always fit cubic Bezier curves for professional results.

6. **Color detection: always sample first.** Don't assume RGB ranges. Use `img[y, x]` to check actual pixel values, then convert to HSV for robust detection. Red wraps around H=0/180 — need two ranges.

7. **`potrace` is better but often unavailable.** It's a dedicated bitmap-to-vector tracer. If available (`brew install potrace`), use it: `convert input.png output.pbm && potrace output.pbm -s -o output.svg`. Falls back to the OpenCV pipeline above.

8. **Text in logos** is better rendered as SVG `<text>` elements with web fonts than traced as outlines. Detect text regions separately (non-colored pixels in the text area) and use font-based rendering.

## Ready-to-Use Script

The complete pipeline is packaged as `scripts/trace_to_svg.py`:

```bash
python3 scripts/trace_to_svg.py input.png output.svg --color red
python3 scripts/trace_to_svg.py icon.png icon.svg --color black --scale 8 --threshold 50
```

Supports: red, blue, green, black, white. Tunes: `--threshold` (HSV sensitivity), `--scale` (upscale factor).

## Verification

- Open SVG in browser and compare side-by-side with original
- Check that internal holes (white regions) render correctly
- Verify text is legible and properly positioned
- Test scaling — smooth curves should remain smooth at any size
