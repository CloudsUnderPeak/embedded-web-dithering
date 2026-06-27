#!/usr/bin/env python3
import base64
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "demo" / "demo-16x9.png"
OUTPUT = ROOT / "assets" / "demo" / "demo-16x9-data.js"


def main():
    data = base64.b64encode(SOURCE.read_bytes()).decode("ascii")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        "(function (app) {\n"
        "    // Generated from assets/demo/demo-16x9.png by tools/generate-demo-data/run.py.\n"
        "    // Server/GitHub Pages loads the PNG directly and does not need this file.\n"
        "    // Direct file:// opening needs this fallback to avoid canvas taint.\n"
        "    // When replacing the demo PNG, run: python3 tools/generate-demo-data/run.py\n"
        "    app.assets = app.assets || {};\n"
        "    app.assets.demoImages = app.assets.demoImages || {};\n"
        "    app.assets.demoImages.demo16x9 = 'data:image/png;base64,"
        + data
        + "';\n"
        "})(window.DitherApp);\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT.relative_to(ROOT)} from {SOURCE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
