#!/usr/bin/env python3
"""
Bitmap-to-SVG tracer using OpenCV contour detection and Catmull-Rom Bezier curves.

Usage:
    python3 trace_to_svg.py <input_image> <output_svg> [--color red|blue|green|black|white] [--threshold 30] [--scale 12]

Example:
    python3 trace_to_svg.py logo.png logo.svg --color red
    python3 trace_to_svg.py icon.png icon.svg --color black --scale 8
"""

import cv2
import numpy as np
import re
import sys
import argparse


def detect_color_mask(img_bgr, img_a, color_name, sat_threshold=30, val_threshold=30):
    """Create a binary mask for the specified color."""
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    
    if color_name == "red":
        lower1 = np.array([0, sat_threshold, val_threshold])
        upper1 = np.array([20, 255, 255])
        lower2 = np.array([160, sat_threshold, val_threshold])
        upper2 = np.array([180, 255, 255])
        mask = cv2.bitwise_or(cv2.inRange(hsv, lower1, upper1),
                               cv2.inRange(hsv, lower2, upper2))
    elif color_name == "blue":
        lower = np.array([100, sat_threshold, val_threshold])
        upper = np.array([130, 255, 255])
        mask = cv2.inRange(hsv, lower, upper)
    elif color_name == "green":
        lower = np.array([35, sat_threshold, val_threshold])
        upper = np.array([85, 255, 255])
        mask = cv2.inRange(hsv, lower, upper)
    elif color_name == "black":
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        mask = (gray < 60).astype(np.uint8) * 255
    elif color_name == "white":
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        mask = (gray > 200).astype(np.uint8) * 255
    else:
        raise ValueError(f"Unknown color: {color_name}")
    
    # Respect alpha channel
    if img_a is not None:
        mask = cv2.bitwise_and(mask, (img_a > 200).astype(np.uint8) * 255)
    
    return mask


def contour_to_smooth_svg_path(cnt, scale, x_offset, y_offset):
    """Convert contour to SVG path with smooth cubic Bezier curves (Catmull-Rom)."""
    # Scale back to original coords
    cnt_orig = cnt.astype(np.float64) / scale
    cnt_orig[:, :, 0] += x_offset
    cnt_orig[:, :, 1] += y_offset
    
    # Simplify
    epsilon = 0.008 * cv2.arcLength(cnt.astype(np.float32), True) / scale
    approx = cv2.approxPolyDP(cnt.astype(np.float32), epsilon * scale, True)
    simple = approx.reshape(-1, 2).astype(np.float64) / scale
    simple[:, 0] += x_offset
    simple[:, 1] += y_offset
    
    n = len(simple)
    if n < 3:
        return None
    
    d = f"M {simple[0][0]:.1f},{simple[0][1]:.1f}"
    
    for i in range(n):
        p0 = simple[(i - 1) % n]
        p1 = simple[i]
        p2 = simple[(i + 1) % n]
        p3 = simple[(i + 2) % n]
        
        # Catmull-Rom to cubic Bezier control points
        cp1x = p1[0] + (p2[0] - p0[0]) / 6
        cp1y = p1[1] + (p2[1] - p0[1]) / 6
        cp2x = p2[0] - (p3[0] - p1[0]) / 6
        cp2y = p2[1] - (p3[1] - p1[1]) / 6
        
        d += f" C {cp1x:.1f},{cp1y:.1f} {cp2x:.1f},{cp2y:.1f} {p2[0]:.1f},{p2[1]:.1f}"
    
    return d + " Z"


def trace_to_svg(input_path, output_path, color="red", sat_threshold=30, val_threshold=30, 
                 upscale=12, min_area=500, morph_kernel=7, morph_iter=4, blur_size=9):
    """Main tracing pipeline."""
    # Load image
    img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise FileNotFoundError(f"Cannot load image: {input_path}")
    
    b, g, r = img[:,:,0], img[:,:,1], img[:,:,2]
    a = img[:,:,3] if img.shape[2] == 4 else None
    
    # Color detection
    mask = detect_color_mask(img[:,:,:3], a, color, sat_threshold, val_threshold)
    
    # Upscale for smooth tracing
    big = cv2.resize(mask, (mask.shape[1]*upscale, mask.shape[0]*upscale), 
                      interpolation=cv2.INTER_CUBIC)
    _, binary = cv2.threshold(big, 127, 255, cv2.THRESH_BINARY)
    
    # Morphological close to merge fragments
    kernel = np.ones((morph_kernel, morph_kernel), np.uint8)
    clean = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=morph_iter)
    
    # Gaussian blur for smooth edges
    smooth = cv2.GaussianBlur(clean, (blur_size, blur_size), 0)
    _, smooth = cv2.threshold(smooth, 127, 255, cv2.THRESH_BINARY)
    
    # Find contours with hierarchy
    contours, hierarchy = cv2.findContours(smooth, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    # Build SVG paths
    svg_paths = []
    for i, cnt in enumerate(contours):
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue
        
        parent = hierarchy[0][i][3]
        path_d = contour_to_smooth_svg_path(cnt, upscale, 0, 0)
        if path_d is None:
            continue
        
        fill = "#000000" if parent == -1 else "white"
        svg_paths.append((path_d, fill, cv2.contourArea(cnt.astype(np.float64) / upscale), parent))
    
    if not svg_paths:
        print("Warning: No contours found. Try adjusting --threshold or --color.")
        return
    
    # Calculate bounding box
    all_x, all_y = [], []
    for pd, _, _, _ in svg_paths:
        for m in re.finditer(r'([\d.]+),([\d.]+)', pd):
            all_x.append(float(m.group(1)))
            all_y.append(float(m.group(2)))
    
    min_x, max_x = min(all_x) - 2, max(all_x) + 2
    min_y, max_y = min(all_y) - 2, max(all_y) + 2
    w, h = max_x - min_x, max_y - min_y
    
    # Scale to reasonable size
    target_h = max(h, 100)
    scale_factor = target_h / h
    
    # Build SVG
    paths_svg = '\n    '.join(f'<path d="{pd}" fill="{f}"/>' for pd, f, _, _ in svg_paths)
    
    color_map = {"red": "#C8102E", "blue": "#0066CC", "green": "#008800", "black": "#000000", "white": "#FFFFFF"}
    fill_color = color_map.get(color, "#000000")
    # Replace default black fill with the detected color
    paths_svg = paths_svg.replace('fill="#000000"', f'fill="{fill_color}"')
    
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     viewBox="0 0 {w * scale_factor:.0f} {target_h:.0f}" 
     width="{w * scale_factor:.0f}" height="{target_h:.0f}">
  <g transform="translate({-min_x * scale_factor:.1f}, {-min_y * scale_factor:.1f}) scale({scale_factor:.4f})">
    {paths_svg}
  </g>
</svg>'''
    
    with open(output_path, 'w') as f:
        f.write(svg)
    
    print(f"Traced {len(svg_paths)} paths ({sum(1 for _,_,_,p in svg_paths if p==-1)} outer, "
          f"{sum(1 for _,_,_,p in svg_paths if p!=-1)} holes)")
    print(f"Output: {output_path} ({w*scale_factor:.0f}x{target_h:.0f})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bitmap to SVG tracer")
    parser.add_argument("input", help="Input image path")
    parser.add_argument("output", help="Output SVG path")
    parser.add_argument("--color", default="red", choices=["red", "blue", "green", "black", "white"],
                        help="Color to trace (default: red)")
    parser.add_argument("--threshold", type=int, default=30, help="HSV saturation threshold (default: 30)")
    parser.add_argument("--scale", type=int, default=12, help="Upscale factor (default: 12)")
    args = parser.parse_args()
    
    trace_to_svg(args.input, args.output, color=args.color, 
                 sat_threshold=args.threshold, upscale=args.scale)
