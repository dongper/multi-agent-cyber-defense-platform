# macOS: logo SVG → square PNG + favicon.ico

## Sources (official brand logos)
- logo.wine: `https://www.logo.wine/a/logo/<Brand>/<Brand>-Logo.wine.svg` — usually carries the correct official color.
- worldvectorlogo CDN: `https://cdn.worldvectorlogo.com/logos/<slug>.svg` — convenient, but VERIFY the color. Example: China Unicom returned blue-purple `#373b92` there, while the official brand red is `#d91920` (from logo.wine). Recolor a wrong-color vector rather than shipping the wrong brand color.
- Download with a browser UA: `curl -sL -A "Mozilla/5.0 ..." -o x.svg <url>`.

## Rendering SVG → PNG on macOS
- `rsvg-convert` (`brew install librsvg`) is the cleanest: transparent background, high quality.
- **If `rsvg-convert` is missing**, ImageMagick's internal MSVG renderer produces SEMI-TRANSPARENT garbage for complex paths — do not trust `magick svg→png` alone.
- Fast no-install fallback: `qlmanage -t -s <px> -o . file.svg` renders high quality but forces a WHITE background. Then strip it:
  ```
  magick out.png -fuzz 12% -transparent white PNG32:transparent.png
  ```
  The `fuzz 12%` also clears anti-aliased near-white edges; the red/graphic fringes survive.

## Combined mark (graphic + wordmark) → pure icon
Many "square logo" vectors actually bundle the icon mark with the wordmark text stacked below. To get a clean square icon:
1. Render + make transparent.
2. Detect the largest CONTIGUOUS row-block of non-transparent pixels (that is the mark); smaller blocks below are the wordmark. Do this by resizing the alpha channel to `1xH` and scanning row means.
3. Find the column range within that block (resize alpha to `Wx1` over the cropped rows).
4. Crop, then scale-to-fit and center into a square canvas with ~6% padding:
   ```
   magick cropped.png -resize WxH -gravity center -background none -extent NxN PNG32:square.png
   ```
5. Emit `logo.png` (400×400), `logo-original.png` (1254×1254 or source-res), and:
   ```
   magick logo.png -define icon:auto-resize=64,48,32,16 favicon.ico
   ```

## Verify the icon shape without eyes
Downscale the alpha channel to ~36×36 and print a `#`/`+`/`.` ASCII matrix — confirms the mark is centered, symmetric, and wordmark-free.
