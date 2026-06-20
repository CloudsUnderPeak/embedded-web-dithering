# Embedded Web Dithering

[English](README.md)

Embedded Web Dithering 是一個可直接在瀏覽器使用的圖片 dithering 工具，適合用來準備電子紙、嵌入式螢幕等受限顯示器要顯示的圖片。你可以載入圖片、裁切畫面、調整尺寸與色調、設定顏色與 dithering 效果，最後匯出 PNG。

## 線上體驗

網頁版本：[https://cloudsunderpeak.github.io/embedded-web-dithering/](https://cloudsunderpeak.github.io/embedded-web-dithering/)

也可以下載專案後，直接從本機開啟 `index.html` 使用。

## 替換 Demo 圖

替換 `assets/demo/demo-16x9.png` 即可更換內建 demo 圖。Server/GitHub Pages 會直接讀取 PNG，不需要轉換。只有直接用 `file://` 開啟 `index.html` 且要使用 Load Demo 時，才需要在替換 PNG 後重新產生 `assets/demo/demo-16x9-data.js`：

```bash
python3 tools/generate-demo-data.py
```

## 為什麼做這個專案

很多電子紙或嵌入式螢幕只能顯示有限的顏色，圖片如果直接放上去，常常會失去細節或看起來不自然。這個專案希望把常用的圖片準備步驟整理在同一個頁面裡，讓你不用打開大型繪圖軟體，也能快速把圖片調整成比較適合裝置顯示的樣子。

## 特色

- 直接從 `index.html` 開啟使用。
- 載入本機圖片，或使用專案內建 demo 試玩。
- 使用固定比例裁切、等比縮放、亮度 / 對比 / 飽和度調整。
- 選擇或微調圖片使用的顏色。
- 套用 dithering，預覽圖片在有限顏色下的呈現效果。
- 將處理後結果匯出為 PNG。

## 支援匯入格式

目前支援上傳 PNG、JPEG/JPG 與 WebP 格式的圖片。
