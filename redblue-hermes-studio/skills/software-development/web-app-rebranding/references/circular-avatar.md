# Circular brand avatar (brand-color disc + white figure)

Rebranding often includes the DEFAULT USER AVATAR, which some apps generate from a library (`@multiavatar/multiavatar` produces a geometric "face"). Replace it with a brand asset: a brand-color circle behind the logo figure recolored white.

## Find the generator
- Grep client source for the library name (`multiavatar`) — it appears in BOTH the avatar component's fallback branch AND a "random avatar" handler in account settings.
- Fallback branch: replace `<span v-html="generatedSvg">` with `<img src="/avatar-default.png" alt="">`; drop the `multiavatar(...)` computed and its import.
- Random handler: repoint its `dataUrl` at the public path string `/avatar-default.png` (a plain path works fine as the `<img>` src) and remove the library import.

## Produce the avatar image (ImageMagick)
1. Start from the ALREADY-CROPPED pure-figure PNG (see `macos-svg-to-icon.md`), not the raw combined SVG.
2. Recolor the figure white: `magick figure.png -fuzz 25% -fill white -opaque '#BRAND'`
3. Composite onto a brand-color disc, figure scaled to ~65% of the disc width, centered:
   ```
   magick -size 256x256 xc:none -fill '#d91920' -draw 'circle 128,128 128,4' \
     \( figure-white.png -resize 168x130 \) -gravity center -composite PNG32:avatar-default.png
   ```
4. Verify with the ASCII-matrix trick (alpha + color buckets: transparent / brand / white) to confirm the figure is centered and wordmark-free.

## Pitfalls
- `clip-path` in an SVG to crop the wordmark does NOT work through ImageMagick's internal MSVG renderer — the wordmark still renders as stray dots. Use the cropped PNG instead of an SVG clipPath.
- Already-stored avatars in user data don't change on deploy — the user must click the in-app "reset" control to get the new default. Mention this.
