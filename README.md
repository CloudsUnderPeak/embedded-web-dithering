# Embedded Web Dithering

[繁體中文](README.zh-TW.md)

Embedded Web Dithering is a standalone browser-based image dithering editor for embedded display workflows. The project is designed to run locally from static files, without a backend, build step, CDN, or runtime network dependency.

Repository slug: `embedded-web-dithering`.
GitHub repository: `https://github.com/CloudsUnderPeak/embedded-web-dithering.git`.

## Current Scope

- Open the app directly from `index.html`.
- Load local images or project-bundled demo assets.
- Edit images through crop, resize, adjustment, palette, and dithering tools.
- Reorder supported image-processing effects.
- Export the processed result as PNG.
- Keep ESP32 / embedded-device integration as a future mode, not part of the current MVP.

## Supported Input Formats

The MVP accepts PNG, JPEG/JPG, and WebP images. Other formats, including SVG, GIF, AVIF, HEIC/HEIF, RAW, PSD, TIFF, and BMP, are intentionally rejected before entering the canvas and dithering pipeline.

## Project Docs

Use the spec index as the navigation entry before changing requirements or implementation:

- [docs/SPEC_INDEX.md](docs/SPEC_INDEX.md): navigation entry for the behavior and technical specs.
- [docs/SPEC_BEHAVIOR.md](docs/SPEC_BEHAVIOR.md): product behavior, user flows, UI behavior, milestones, and acceptance criteria.
- [docs/SPEC_TECHNICAL.md](docs/SPEC_TECHNICAL.md): architecture, module boundaries, state, pipeline, storage, and implementation constraints.

## Development Notes

This project intentionally avoids package installation and bundling. Use classic browser scripts and keep runtime assets inside the repository.
