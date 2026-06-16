# Embedded Web Dithering

[繁體中文](README.zh-TW.md)

Embedded Web Dithering is an image dithering tool you can use directly in the browser. It is made for preparing images for e-paper and other limited-color displays: load an image, crop it, adjust size and tone, choose colors and dithering, then export the result as PNG.

## Try It Online

Live app: `https://cloudsunderpeak.github.io/embedded-web-dithering/`

You can also download the project and open `index.html` locally.

## Why This Project

Many e-paper and embedded displays can only show a small set of colors. If you place a normal image on them directly, details can disappear or colors can look wrong. This project brings the common preparation steps into one simple page, so you can tune an image for device display without opening a large graphics app.

## Highlights

- Open the app directly from `index.html`.
- Load local images or try the bundled demo.
- Crop to fixed ratios, resize proportionally, and adjust brightness, contrast, and saturation.
- Choose or fine-tune the colors used by the image.
- Apply dithering and preview how the image looks with limited colors.
- Export the processed result as PNG.

## Supported Input Formats

You can upload PNG, JPEG/JPG, and WebP images.
