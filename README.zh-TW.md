# Embedded Web Dithering

[English](README.md)

Embedded Web Dithering 是一個面向嵌入式顯示器工作流的獨立瀏覽器圖片 dithering 編輯器。專案設計目標是從靜態檔案直接在本機執行，不需要後端、build step、CDN，或 runtime 網路依賴。

Repository slug：`embedded-web-dithering`。
GitHub repository：`https://github.com/CloudsUnderPeak/embedded-web-dithering.git`。

## 目前範圍

- 直接從 `index.html` 開啟 app。
- 載入本機圖片或專案內建 demo assets。
- 透過 crop、resize、adjustment、palette、dithering 工具編輯圖片。
- 重新排序支援的圖片處理 effects。
- 將處理後結果匯出為 PNG。
- ESP32 / embedded-device integration 保留為未來模式，不列入目前 MVP。

## 支援匯入格式

MVP 接受 PNG、JPEG/JPG 與 WebP 圖片。其他格式包含 SVG、GIF、AVIF、HEIC/HEIF、RAW、PSD、TIFF、BMP，都會在進入 canvas 與 dithering pipeline 前被拒絕。

## 專案文件

修改需求或實作前，把 spec index 當成文件導引入口：

- [docs/SPEC_INDEX.md](docs/SPEC_INDEX.md)：Behavior 與 Technical spec 的導引入口。
- [docs/SPEC_BEHAVIOR.md](docs/SPEC_BEHAVIOR.md)：產品行為、使用者流程、UI 行為、里程碑與驗收標準。
- [docs/SPEC_TECHNICAL.md](docs/SPEC_TECHNICAL.md)：架構、模組邊界、state、pipeline、storage 與實作限制。

## 開發備註

這個專案刻意避免 package install 和 bundling。請使用 classic browser scripts，並把 runtime assets 保留在 repository 內。
