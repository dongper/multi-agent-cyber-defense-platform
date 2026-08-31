---
name: local-short-video-rendering
description: Render a short vertical video locally from a script/storyboard when full AI video generation tools are unavailable. Uses PIL for frame rendering, macOS `say` for Chinese narration, and ffmpeg for muxing.
version: 1.0.0
---

# Local Short Video Rendering

Use this when the user wants a finished short video file on disk, especially a 9:16 social video, and the environment does NOT have dedicated video-gen tooling (e.g. Manim/moviepy missing) but does have Python, PIL, ffmpeg, and optionally macOS `say`.

## When to use
- User asks for a finished MP4, not just a script
- Need a fast local fallback pipeline
- Environment has `ffmpeg` and `python3`
- `manim`, `moviepy`, or hosted TTS/video APIs are unavailable or failing

## Proven fallback stack
- Python + PIL: generate frames as PNGs
- macOS `say`: generate Chinese narration (`Tingting` voice worked)
- ffmpeg: encode frames to H.264 and mux AAC audio
- vision spot-check: inspect extracted frames for layout/readability issues

## Important findings
- Built-in TTS tool may fail with: `No audio was received`; on macOS, fall back to `say`
- `say -v Tingting` works for zh_CN narration
- Speaking rate around `-r 190` produced about a 30-second narration from a ~100+ Chinese-character script in this session
- PIL was available even when `moviepy` and `manim` were missing
- Subtitle boxes can overlap lower on-screen text; verify by extracting sample frames near the ending and visually checking them

## Workflow

1. Inspect environment
   - Check Desktop path exists
   - Check `ffmpeg`, `python3`
   - Check Python modules like `PIL`
   - Check whether `manim`/`moviepy` are missing before choosing fallback

2. Prepare narration
   - Save narration text to a file
   - Generate AIFF with macOS `say`
   - Convert to MP3 with ffmpeg
   - Measure duration with ffprobe

Example:
```bash
say -v Tingting -r 190 -f narration.txt -o narration.aiff
ffmpeg -y -i narration.aiff -acodec libmp3lame -q:a 2 narration.mp3
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 narration.mp3
```

3. Render frames with PIL
   - Use 1080x1920 for vertical video
   - Define scenes by `(start, end, title, subtitle)`
   - Draw simple reusable elements: office background, people, arrows, folders, symbolic "锅"
   - Render all frames to `frames/frame_%04d.png`

4. Encode final MP4
```bash
ffmpeg -y -framerate 30 -i frames/frame_%04d.png -i narration.mp3 \
  -vf "format=yuv420p,fade=t=in:st=0:d=0.5,fade=t=out:st=29.2:d=0.8" \
  -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 192k -shortest final.mp4
```

5. Verify output
   - Use `ffprobe` for duration/size
   - Extract key frames (e.g. 1s, 5s, 12s, 28s)
   - Use vision review to catch overlap/cropping problems
   - If end-card text overlaps subtitle box, move it upward and/or reduce font size, then re-render

## Design pattern that worked well
For satire/office commentary videos:
- Dark blue/gray office palette
- 9:16 layout
- Repeated motifs: file folders, meeting rooms, arrows, central "锅"
- Large punchline text in accent colors (yellow/red)
- Bottom subtitle box with high contrast white text
- Keep one visual idea per scene

## Recommended file layout
```text
~/Desktop/<project>_build/
  narration.txt
  narration.aiff
  narration.mp3
  make_video.py
  frames/
  checks/
  final.mp4
```

## Pitfalls
- PIL `draw.text()` needs keyword arguments for `font=`/`fill=` to avoid argument errors
- Chinese system fonts vary by machine; test candidates such as:
  - `/System/Library/Fonts/Hiragino Sans GB.ttc`
  - `/System/Library/Fonts/STHeiti Light.ttc`
  - `/Library/Fonts/Arial Unicode.ttf`
- Final lower-third subtitle box may obscure mid-lower slogans; always inspect an extracted late frame
- Don’t assume dedicated animation libraries are installed

## Output expectations
This pipeline produces a usable stylized short video quickly, but not a photoreal AI-generated cinematic short. Best for:
- animated commentary
- infographic satire
- storyboard-style social videos
- rapid prototype content the user can further refine in CapCut/Jianying
