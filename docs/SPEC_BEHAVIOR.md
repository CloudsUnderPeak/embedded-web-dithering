# Dither Image Editor PM 行為 Spec

```text
Version: 0.1.0
Status: Draft
Last Updated: 2026-06-16
Split From: SPEC_INDEX.md
```

本文件用 PM / 產品驗收角度描述使用者可見行為、範圍、畫面互動與成功標準。實作架構、檔案結構、命名、state、pipeline、儲存與演算法細節請看 [SPEC_TECHNICAL.md](SPEC_TECHNICAL.md)。文件入口與閱讀導引請先看 [SPEC_INDEX.md](SPEC_INDEX.md)。

## History

- 2026-05-16: 定調目前專案版本為 `0.1.0`。
- 2026-05-16: 定義 Dither Editor 的 Empty / Crop / Edit 使用者模式；首次進入無圖時只開放 Image Input，載入圖片或 demo 後重設設定並進入 Crop，Crop 確認或收合後才進入 Edit。
- 2026-05-16: 明確限制各模式右下角 preview toolbar：Empty 不顯示按鈕，Crop 只顯示 Zoom In、Zoom Out、OK，Edit 只顯示 Original、Result；所有 preview toolbar 按鈕尺寸必須一致。
- 2026-05-21: Empty 模式的圖片上傳入口移至畫布中央，提供拖放上傳區與 Browse File 按鈕；Image Input panel 不顯示 Choose Image 與 Drop Zone，畫布的 No image loaded placeholder 不可視。
- 2026-05-21: Image Input panel 的 New Image 改為開啟本機圖片選擇器，取代舊的 Choose Image row；目前 UI 不暴露空白 canvas 建立入口。
- 2026-06-07: Crop 面板改為 2x2 象限控制，右下旋轉與 Flip 圖示按鈕等寬平分；Flip 圖示按下後不顯示持續高亮。
- 2026-06-07: 左側工具面板新增模式化展開規則：初始只展開 Image Input，載圖後只展開 Crop，離開 Crop 後展開 Resize / Adjust / Palette / Dither；手動回到 Image Input 或 Crop 時其他面板收合。
- 2026-06-09: 左側工具面板改為以 feature group 管理 `source` / `prepare` / `edit` 流程；未宣告 `panelGroup` 的 feature 屬於 `none`，不顯示在工具面板項目中。
- 2026-06-09: Crop 預設比例改為 16:9，preview toolbar 的 crop zoom 使用 `+` / `-`；Resize 移除 Fit 選單並鎖定等比；Adjust 移除 Reset Default 並在 slider 左側顯示數值。
- 2026-06-09: Crop preview toolbar 的 `+` / `-` 改為 compact square buttons；Resize width / height 限制在合法輸出尺寸內。
- 2026-06-09: Resize width / height 改為同列顯示，並使用和 Crop zoom / rotation 一致的長按連續調整數字輸入樣式。
- 2026-06-13: Resize width / height 中間新增等比連動提示圖示，讓固定比例關係更明確。
- 2026-06-13: `prepare` 期間 edit tools 保持可選；從 `prepare` 點選單一 edit tool 時離開 Crop 並只展開該 edit panel。
- 2026-06-13: Crop frame 與 edit preview 改用同一個有內距的預覽框尺寸，避免 prepare 與 edit 切換時圖片位置跳動。
- 2026-06-13: 已載入圖片的 `source` 流程預留 preview toolbar 高度但不顯示任何按鈕，避免切換流程時圖片縮放。
- 2026-06-13: 從 `prepare` 進入 `edit` 時避免先顯示 source fallback 再切到 result，減少明顯圖片重載感。
- 2026-06-13: prepare crop frame 與 edit preview 使用同一個 preview stage content-box 對齊基準，避免 1px 級切換位移。
- 2026-06-13: `edit` 的 Original preview 改為顯示 prepare 後的原圖，而不是未經 prepare 的 source image。
- 2026-06-13: Palette 預設維持 Original；Dither 預設使用 Floyd-Steinberg error diffusion，並以目前 Palette 作為固定輸出色。
- 2026-06-13: Original palette 萃取改為保留明暗錨點與高飽和代表色，避免小面積線材、燈色被大量背景色洗掉。
- 2026-06-14: Dither 新增 Color Distance 選項，讓使用者調整 palette 最近色判斷方式；預設維持 RGB。
- 2026-06-14: Original palette 萃取改為 RgbQuant-style 流程，使用 8x8 區塊統計、hue retention 與 BT.709 euclidean 合併產生代表色。
- 2026-06-14: Color Distance 的 RgbQuant-style BT.709 距離改以 `Euclidean` 命名，並作為預設選項；`RGB` 保留為未加權 RGB 選項。
- 2026-06-14: Color Distance 依是否套用 BT.709 權重拆分為 Euclidean BT.709 / Euclidean RGB 與 Manhattan BT.709 / Manhattan RGB，預設為 Euclidean BT.709。
- 2026-06-14: Dither 新增 Error Strength，讓 error diffusion algorithm 可調整誤差擴散強度，預設維持 100%。
- 2026-06-14: Original palette 重新對齊 ditherit-v2 / RgbQuant `method: 2`，使用完整 2D histogram 而非額外候選上限。
- 2026-06-14: 專案改為直接使用 vendored RgbQuant 萃取 Original palette，並優先以 RgbQuant 執行支援的 Error Diffusion。
- 2026-06-14: Error Strength 對齊 dithering-studio-main 的控制語意，使用 0% 到 150%、每次 5% 的誤差擴散倍率。
- 2026-06-14: Dither 預設改回 None，Error Strength slider step 改為 1%。
- 2026-06-14: Error Strength slider step 改為 2%。
- 2026-06-14: Palette color picker 調色時不立即重跑 preview，避免原生調色盤被關閉而無法微調。
- 2026-06-14: Original Palette 新增 Colors 控制，可在 2 到 32 色間重新萃取，切到 Custom 或固定 preset 時隱藏。
- 2026-06-14: Palette 色票排列改為每列最多 8 個。
- 2026-06-14: Dither 預設改回 Floyd-Steinberg；Serpentine 改用 Toggle Switch，Crop 手機版維持 2x2 控制排列，slider 使用主題色。
- 2026-06-14: Crop 新增 transform fill color，使用 Black / White / Custom select 搭配 color picker，填補旋轉或移動後原圖未覆蓋的區域。
- 2026-06-14: Crop preview overlay 改以 canvas 內的 crop frame 對齊，避免手機或平板長條圖框選與正式 crop output 偏移。
- 2026-06-14: Edit effects order 改為固定順序，關閉工具列拖曳排序。
- 2026-06-14: Slider 與 Toggle Switch 改用較淡的 control accent 色。
- 2026-06-14: Edit preview 的 Original / Result 切換改用 Theme choice 風格。
- 2026-06-15: Crop Fill 新增 Auto preset，以低解析邊界取樣快速估算填色，並用小幅色差穩定化降低旋轉閃爍。
- 2026-06-15: Crop Fill 預設改為 Auto。
- 2026-06-15: 手機版 empty upload dropzone 保留左右餘裕，不貼齊 preview stage 邊界。
- 2026-06-15: Preview stage 透明區域背景改為柔和灰白細網格，並每 5x5 小格顯示一組主網格。
- 2026-06-15: Preview stage 網格色彩改為沿用既有灰階 theme tokens，不另外維護 preview 專用色系。
- 2026-06-15: 左側工具面板的 feature 圖示改用本地 SVG icon，取代 ASCII placeholder。
- 2026-06-16: Empty Upload、New Image、Load Demo、Crop 操作、Palette 加刪、Resize link 與 Export 改用本地 SVG icon；Browse File 與 Original / Result 維持純文字。
- 2026-06-16: 右上角 Menu 按鈕新增本地 SVG menu icon，文字仍保留。
- 2026-06-16: Resize link 改用 `link-01` SVG，工具面板展開/收合改用 chevron SVG，Light / Dark theme 選項新增 sun / moon SVG icon。
- 2026-06-16: Light / Dark theme 色彩重新收斂為較少的共享語意層級，減少過度細分色票並維持 theme 切換後的 UI 對比。
- 2026-06-16: Crop overlay 新增觸控螢幕雙指縮放，和滑鼠滾輪一樣調整圖片 zoom。
- 2026-06-16: Palette 新增色票按鈕改為圓形外框包住加號；Original Colors 數字控制在無單位文字時仍保留步進按鈕緩衝區，降低窄螢幕誤點。

## 產品目標

建立一個可離線使用的瀏覽器圖片編輯器。使用者能在本機打開頁面，輸入圖片、調整圖片、設定 Dither 流程、預覽結果，最後輸出處理完成的 PNG。

核心行為：

1. 使用者不需要後端服務。
2. 使用者不需要下載遠端資源，也不需要連接外部 API。
3. 使用者可以用瀏覽器原生能力完成上傳、編輯、預覽與輸出。
4. App 以固定順序套用會影響圖片結果的效果，避免 palette / dither 語意混亂。
5. MVP 只交付 Standalone Mode；ESP32 Device Mode 僅作為後續方向保留。

## 使用者範圍

MVP 必須支援：

- 匯入本機圖片。
- 從專案內建 demo 開始操作。
- 透過 New Image 重新選擇本機圖片。
- 裁切、縮放與基礎影像調整。
- 選擇或自訂 palette。
- 選擇 Dither 效果。
- 依固定效果順序預覽結果。
- 預覽處理前後的結果。
- 匯出 PNG。
- 保留基本工作狀態與設定。

MVP 不包含：

- 後端登入或帳號系統。
- 遠端圖片 URL 輸入。
- 雲端儲存。
- 圖層、annotation、文字工具。
- ESP32 上傳、連線設定或 token 管理。
- Preset Manager 的完整管理介面。

## 主要使用流程

1. 使用者打開 `index.html`。
2. App 顯示 Dither Editor 頁面。
3. 第一次進入且尚未載入圖片時，`source` group 的 Image Input 自動展開；只有來源輸入可操作，其餘工具與動作反灰停用。
4. 使用者匯入本機圖片、選擇 demo，或建立新圖片。
5. App 解碼圖片後自動進入 `prepare` group 並只展開 Crop；此時 Image Input、Crop 與 edit tools 可選。
6. 使用者按下右下角顯眼的 OK 或自行收合 Crop 時，App 進入 `edit` group 並展開 Resize、Adjust、Palette、Dither；若使用者改點單一 edit tool，則只展開該 edit panel。
7. `edit` group 會依 Crop 範圍與 Resize、Adjust、Palette、Dither 等設定更新 Result。
8. App 依固定 Effects order 更新圖片處理結果。
9. 使用者可在圖片呈現區右下角切換 Original / Result。
10. 使用者確認結果後匯出 PNG。
11. 使用者可切換到 Web Setting、Help 或 About，再返回編輯頁並保留目前工作狀態。

## User Stories

本節提供給測試 agent 作為操作導向的情境清單。每個 story 都應從使用者可見行為驗證，不以內部實作細節作為主要判斷。

### US-01 Open App Offline

As a user, I want to open `index.html` directly, so that I can use the editor without a backend or build step.

Acceptance:

- Given the project files are present locally, when the user opens `index.html`, then the Dither Editor page is shown.
- The app must not require `npm install`, `npm run build`, a dev server, CDN, or remote API.
- The header, menu button, editor area, and preview area are visible.

### US-02 Load Supported Local Image

As a user, I want to choose a local image file, so that I can edit it in the browser.

Acceptance:

- Given a supported `PNG`, `JPEG/JPG`, or `WebP` file, when the user selects it from Image Input, then the preview area shows the image.
- The editor enters the prepare flow after the image loads, with only Crop expanded and the OK button shown in the preview toolbar.
- While the prepare flow is active, Image Input, Crop, and edit tool rows can be selected.
- After the user presses OK or collapses Crop, the editor enters the edit flow, expands Resize / Adjust / Palette / Dither, and applies the configured pipeline to the cropped range.
- When the user selects one edit tool from the prepare flow, the editor enters the edit flow, collapses Crop, opens only the selected edit panel, and applies the configured pipeline.
- When the user manually expands Image Input or Crop after an image is loaded, all other tool panels collapse.
- The source image must not be uploaded to a server.

### US-03 Reject Unsupported Image Format

As a user, I want unsupported image formats to be rejected clearly, so that I know why the image cannot be edited.

Acceptance:

- Given an unsupported file such as `SVG`, `GIF`, `AVIF`, `HEIC/HEIF`, `RAW`, `PSD`, `TIFF`, or `BMP`, when the user selects it, then the app rejects it before the canvas / pipeline flow.
- The app shows a clear error message.
- The previous valid working image, if any, should not be silently replaced by the unsupported file.

### US-04 Start From Built-In Demo

As a user, I want to load a built-in demo, so that I can try the editor without preparing my own image.

Acceptance:

- Given the user clicks the demo action, then the app loads a project-bundled demo image.
- The demo must not come from a remote URL.
- After loading, the app enters the prepare flow; after OK or Crop collapse, Crop, Resize, Adjust, Palette, Dither, Effects Order, and Export can be tested against the demo.

### US-05 Choose New Image File

As a user, I want New Image to open the local image picker, so that I can replace the current workspace with another image.

Acceptance:

- Given the user opens Image Input and clicks New Image, then the browser file picker opens.
- After the user selects a supported image, the app loads it, resets algorithm settings to defaults, and enters the prepare flow.
- Image Input must not show a separate Choose Image row or a panel drop zone.

### US-06 Crop With Fixed Ratio

As a user, I want to crop with fixed aspect ratios, so that the output matches common display targets.

Acceptance:

- The user can choose one of the supported fixed ratios.
- The default crop ratio is 16:9.
- The crop overlay remains centered and represents the final output area.
- Dragging in the preview moves the image under the fixed crop frame, not the crop frame itself.
- Zoom, rotation, horizontal flip, and vertical flip affect the image transform without changing the selected crop ratio.
- The Crop panel uses a two-column layout: Ratio with Zoom, Rotate with Fill, and a full-width equal button row.
- The Crop panel keeps the same row structure in mobile layouts.
- Fill chooses the color for areas not covered by the source image after crop transform.
- Flip icon buttons should behave visually like the rotate buttons and must not show a persistent active highlight after being pressed.

### US-07 Resize Output

As a user, I want to set output width and height, so that the exported image matches my target display size.

Acceptance:

- The user can set output width and output height.
- Width and height stay locked to the same aspect ratio; changing either value updates the other immediately.
- Width and height are shown on the same row.
- Width and height show a linked-ratio indicator between the two controls.
- Width and height use the same repeated-step unit-number input style as Crop zoom and rotation.
- Width and height values are constrained to the supported output size range.
- Resize does not expose a Fit selector in the MVP.
- Preview and export use the resize settings consistently.
- The exported PNG dimensions match the configured output dimensions.

### US-08 Adjust Image

As a user, I want to adjust brightness, contrast, and saturation, so that I can tune the source before dithering.

Acceptance:

- The user can change brightness, contrast, and saturation.
- Brightness, contrast, and saturation default to `0`.
- Each slider shows its current numeric value on the left.
- Each slider can be dragged to its minimum and maximum ends.
- Preview updates should match the final pipeline result; if live feedback would be misleading, final-result consistency wins.

### US-09 Edit Palette

As a user, I want to choose and edit palette colors, so that dithering uses the colors I intend.

Acceptance:

- Palette starts from `Original`.
- The user can select a preset palette or switch to `Custom` by adding, deleting, or editing swatches.
- Deleting all custom swatches returns the palette state to `Original`.
- The currently effective palette is visible and is used by Dither as its target color set.
- When Dither is active, Palette supplies target colors and does not pre-quantize pixels before dithering.
- When Dither is `None`, a fixed or custom Palette may directly map pixels to the nearest palette colors.

### US-10 Apply Dither

As a user, I want to choose a Dither algorithm, so that the preview and export show the selected dithering result.

Acceptance:

- Dither starts from Floyd-Steinberg.
- Serpentine starts disabled.
- Color Distance starts from `Euclidean BT.709`.
- Error Strength starts from `100%` and applies to Error Diffusion algorithms.
- Error Strength is adjustable from `0%` to `150%` in `2%` steps.
- Choosing an algorithm updates the result preview.
- Choosing a Color Distance updates the result preview.
- Changing Error Strength updates the result preview when the selected algorithm uses Error Diffusion.
- Returning to `None` disables dither output changes while leaving Palette behavior available.
- Dither uses the current effective palette as fixed output colors.

### US-11 Fixed Effects Order

As a user, I want effects to run in a predictable order, so that Palette and Dither results are easier to understand.

Acceptance:

- Effects run in the fixed edit order: Adjust, Palette, Dither.
- Tool rows do not show drag handles.
- Fixed non-effect steps remain outside the edit effects order.
- Export is not part of the image effects order.

### US-12 Export PNG

As a user, I want to export the processed result as PNG, so that I can use it outside the editor.

Acceptance:

- Given a valid working image, when the user clicks Export, then the app produces a PNG.
- Export runs the formal pipeline instead of relying on a stale preview bitmap.
- If export fails, the app shows an understandable error state.

### US-13 Navigate Away And Return

As a user, I want to open Web Setting, Help, or About and return to Dither Editor, so that I do not lose my current editing session.

Acceptance:

- Menu navigation updates the current page.
- Browser back / forward switches pages consistently.
- Returning to Dither Editor restores the current working image, settings, effects order, and preview state for the current session.

### US-14 Use On Narrow Viewport

As a user on a small screen, I want the editor layout to remain usable, so that I can complete the main workflow on mobile-sized viewports.

Acceptance:

- Preview, tool dock, and open tool panels remain accessible.
- The Crop prepare step must not cause the preview stage or whole editor to grow beyond the viewport in a way that breaks operation.
- Text and controls must not overlap.
- The user can load an image, adjust settings, preview, and export from a narrow viewport.

## 頁面與導覽行為

App 由一個固定外殼承載多個頁面：

- `Dither Editor` 是預設主頁。
- `Web Setting` 用於一般網頁設定，例如主題。
- `Help` 用於使用說明。
- `About` 用於產品資訊。

導覽行為：

- 使用者第一次開啟頁面時，若 URL 沒有指定頁面，進入 Dither Editor。
- 使用者透過 Menu 切換頁面時，瀏覽器 URL 需要反映目前頁面。
- 使用者按瀏覽器上一頁或下一頁時，App 需要切換到對應頁面。
- 返回 Dither Editor 時，應恢復該 session 內的編輯狀態。

## 版面行為

Dither Editor 主畫面包含：

- 標題區：顯示產品名稱、狀態與 Menu。
- 編輯區：放置圖片輸入、效果順序、各工具設定與匯出入口。
- 圖片呈現區：顯示 preview canvas、crop overlay、zoom / pan 等互動結果。

響應式要求：

- 桌面與手機版都必須被 viewport 高度約束，不可讓 `prepare` 中的 Crop 流程或 preview canvas 把整個頁面撐高。
- 編輯區可以捲動，但圖片呈現區與標題區不應因控制項過多而被擠出主要視野。
- Tool Row 與 Tool Panel 的展開、收合、捲動都要保持穩定，不應因 scrollbar 或內容高度造成明顯跳動。
- 使用者在窄螢幕上仍應能完成匯入、裁切、調整、預覽與匯出。

## 編輯區行為

### Editor Flow Groups

Dither Editor 有三個使用者可見流程 group，另有一個不顯示在工具面板中的 feature 分類：

- `source`：來源輸入流程。沒有來源圖片時，Image Input 面板自動展開並保持可用；Crop、Resize、Adjust、Palette、Dither、Effects Order、Export 與 Original / Result 反灰或隱藏，不可設定；右下角 preview toolbar 不顯示任何按鈕。已有來源圖片時手動回到 `source`，其他 tool panel 必須收合，preview toolbar 不顯示按鈕但保留高度。
- `prepare`：正式編輯前準備流程。目前 Crop 是唯一的 `prepare` tool。Preview 顯示原圖與 crop transform，不套用 Resize、Adjust、Palette、Dither 或其他非 Crop 演算法。Image Input、Crop 與 edit tool rows 可選；右下角 preview toolbar 只顯示 `+`、`-`、OK 三個按鈕。
- `edit`：Crop 已確認或收合。App 以 Crop 範圍作為 pipeline 輸入，依目前演算法設定更新 Result；Original 顯示 prepare 後的原圖，不顯示未經 prepare 的 source image。從 Crop 進入 `edit` 時，Resize、Adjust、Palette、Dither 預設展開，右下角 preview toolbar 顯示 Original 與 Result。
- `none`：無工具面板流程歸屬。未宣告 `panelGroup` 的 feature 不顯示在左側工具面板，也不形成使用者可切換的流程。

流程轉換：

- 載入任何新圖片或 demo 後，App 必須重設演算法設定為 default，並進入 `prepare`；若沒有 enabled `prepare` tool，則直接進入 `edit`。
- 在 `prepare` 按下 OK 或自行收合 Crop 後，App 進入 `edit` 並開始計算正式 preview。
- 在 `prepare` 點選單一 edit tool 後，App 必須離開 `prepare`、收合 Crop、進入 `edit`，並只展開被點選的 edit panel。
- 在 `edit` 重新展開 Crop，視同回到 `prepare`，並收合其他面板；此時停止顯示演算法結果，回到原圖 crop transform preview。
- 在已載入圖片後手動展開 Image Input，Crop 與其他編輯面板必須收合；若原本在 `prepare`，視同離開 Crop 並回到正式 preview 流程。
- 不支援格式載入失敗時，不應清掉上一個有效工作區；若沒有上一張圖，維持 `source`。

### Image Input

使用者可以：

- 在無來源圖片時的畫布中央拖放圖片。
- 在無來源圖片時的畫布上傳區點擊 Browse File 按鈕選擇本機圖片。
- 透過 Image Input 選擇內建 demo。
- 透過 Image Input 的 New Image 重新選擇本機圖片。

限制：

- MVP 匯入格式只支援 `PNG`、`JPEG/JPG`、`WebP`。
- 不支援 `SVG`、`GIF`、`AVIF`、`HEIC/HEIF`、`RAW`、`PSD`、`TIFF`、`BMP` 等格式進入演算法流程。
- 不支援格式必須在進入 canvas / pipeline 前被拒絕，並顯示明確錯誤。
- demo 必須來自專案內 `assets/demo/*` 圖片資源，不可依賴遠端 URL，也不可在 runtime 由程式臨時產生假 demo。
- Image Input panel 在任何流程下都不應顯示獨立的 Choose Image row 或 panel Drop Zone；無來源圖片時的主要上傳入口必須集中在畫布中央。
- 不接受遠端圖片 URL 作為 MVP 輸入來源。

### Effects Order

使用者可以：

- 看到目前啟用的圖片處理效果。
- 展開單一效果的設定面板。
- 啟用或停用可選效果。
- 依固定順序套用 edit effects。

行為要求：

- 預覽與匯出結果都要依照固定順序重新計算。
- Effects Order 只在 `edit` 可操作；`source` 與 `prepare` 時必須反灰停用。
- 固定前置流程不應被使用者拖曳。
- Export 不應成為圖片效果順序的一部分。

### Crop

使用者可以：

- 從固定比例清單選擇裁切比例。
- 調整圖片 zoom。
- 旋轉原圖。
- 左右反轉原圖。
- 上下反轉原圖。
- 選擇 transform 後原圖未覆蓋區域的底色。
- 在 preview 區拖曳原圖位置。
- 在 crop overlay 上用滑鼠滾輪調整 zoom。
- 在 crop overlay 上用觸控螢幕雙指縮放調整 zoom。

限制：

- MVP 不提供 Free 自由比例。
- 預設固定比例為 16:9。
- Crop 面板不顯示 X、Y、Width、Height 或 Lock ratio。
- 使用者拖曳的是原圖位置，不是裁切框。
- Crop overlay 固定代表最後輸出的裁切範圍。
- 左右/上下反轉必須作用在原圖 transform，preview 與正式輸出需一致。
- 底色選項提供 Black、White、Custom；選 Black / White 時 color picker 顯示對應顏色，手動調整 color picker 時選項自動切成 Custom。
- 使用原生 color picker 微調底色時，調色盤必須維持開啟直到使用者完成選色。
- 底色只填補旋轉、平移、縮放或翻轉後原圖未覆蓋的 crop transform 區域，不是頁面背景；prepare 預覽時只顯示在 crop frame 內，frame 外仍可透出沿用既有灰階 theme tokens 的 5x5 分組網格背景與原圖脈絡。
- 若原圖已有 rotation，點擊左右/上下反轉時 rotation 需同步取反，並鏡射對應 pan 軸，讓反轉以目前畫面座標為準。
- 只要 Crop 展開，App 就是 `prepare` 流程，且其他 tool panel 必須收合；使用者可按 OK 或再次收合 Crop 進入 `edit`。

### Resize

使用者可以設定：

- output width。
- output height。

行為要求：

- Width 與 Height 固定等比連動。
- 使用者調整任一尺寸時，另一個尺寸必須立即依目前比例更新。
- Width 與 Height 必須顯示在同一列。
- Width 與 Height 中間必須顯示等比連動提示圖示。
- Width 與 Height 必須使用和 Crop zoom / rotation 一致的數字輸入樣式；按住上下箭頭時數值必須連續增減。
- Width 與 Height 必須限制在 `1..4096px` 的合法輸出尺寸內；等比換算時若另一邊會超過上限，使用者正在調整的那一邊也必須被壓回可維持比例的最大值。
- Resize 不顯示 Fit 選單。
- 輸出的圖片尺寸要符合設定。

### Adjust

使用者可以調整：

- brightness。
- contrast。
- saturation。

行為要求：

- 預設值必須是不改變圖片的 identity 狀態。
- 預設值必須為 `0`。
- 每個 slider 左側必須顯示目前數值。
- slider 必須可拉到最小與最大端點。
- 若 live feedback 和正式 pipeline 結果會跳變，應以正式結果一致性優先。
- Gamma 不作為主要控制項。

### Palette

使用者可以：

- 使用 Original palette。
- 選擇固定 preset palette。
- 建立 Custom palette。
- 新增、刪除或修改色票。

行為要求：

- Palette 預設為 Original。
- Original palette 必須使用專案內 vendored RgbQuant 的代表色萃取流程，而不是手寫明暗錨點 heuristic。
- Original palette 應以原始來源圖的區塊統計、hue retention 與 BT.709 euclidean 色距合併產生代表色。
- Original palette 的 Colors 預設為 8，可調範圍為 2 到 32；此控制位於 Preset 下方，且只在 Palette 為 Original 時顯示，並需保留上下調整按鈕前的緩衝區以降低窄螢幕誤點。
- Original 不主動改變圖片。
- 手動變更色票後，狀態切換為 Custom。
- 使用原生 color picker 微調色票時，調色盤必須維持開啟直到使用者完成選色。
- Palette 色票每列最多顯示 8 個，超過時換到下一列。
- 新增色票按鈕必須以圓形外框包住加號，讓新增動作和一般色票清楚區分。
- Custom 是目前工作區設定，不是固定 preset。
- 色票被刪到空時，回到 Original。
- Palette 當前有效色票必須同步給 Dither 使用。
- Dither 啟用時，Palette 不先量化像素；Dither 以目前有效色票產生固定色點陣結果。
- Dither 為 None 時，固定 preset 或 Custom Palette 可直接把像素映射到最近色。
- 最近色映射使用 Dither 面板目前選擇的 Color Distance；預設為 Euclidean BT.709。

### Dither

使用者可以：

- 選擇不套用 Dither。
- 選擇支援的 Dither algorithm。
- 調整 Error Diffusion 的 Error Strength。
- 配合目前有效 palette 產生處理結果。

行為要求：

- Dither 預設為 Floyd-Steinberg。
- Serpentine 預設為關閉。
- Serpentine 使用 Toggle Switch 呈現。
- Color Distance 預設為 Euclidean BT.709，使用者可切換支援的距離公式。
- Error Strength 預設為 100%，只影響 Error Diffusion algorithms；100% 代表標準擴散強度。
- 選擇非 Error Diffusion algorithm 時，Error Strength 控制仍可見但不可調整。
- None 不改變圖片。
- Dither 使用目前有效 Palette 作為固定輸出色。
- Palette 與 Dither 仍要留在固定 edit effects order 中。

### Export

使用者可以匯出目前 pipeline 結果為 PNG。

行為要求：

- 匯出必須使用完整輸出尺寸重新計算。
- Export 只在 `edit` 可操作；`source` 與 `prepare` 時必須反灰停用。
- 匯出失敗時要給出可理解的錯誤狀態。
- Export 不應被當成效果順序的一部分拖曳。

## 圖片呈現區行為

圖片呈現區負責：

- 顯示目前圖片。
- 顯示處理後結果。
- 在 `edit` 支援 Original / Result 切換；Original 必須顯示 prepare 後、edit effects 前的原圖。
- 支援 zoom / pan。
- 在 `prepare` 顯示 crop overlay。
- 讓使用者拖曳原圖位置並看到即時位置變化。
- 在 `source` 右下角 preview toolbar 不顯示任何按鈕；已有來源圖片時仍需預留 toolbar 高度，避免切換到 `prepare` 或 `edit` 後圖片重新縮放。
- 在 `prepare` 右下角 preview toolbar 只能顯示 `+`、`-`、OK 三個按鈕。
- 在 `edit` 右下角 preview toolbar 只能顯示 Original、Result 兩個按鈕。
- `edit` 的 Original / Result 切換必須採用 Theme choice 風格且尺寸一致；`prepare` 的 `+` / `-` buttons 必須是 compact square buttons，OK button 可維持較寬的 primary action 尺寸。

Crop preview 要求：

- crop overlay 代表輸出裁切範圍，必須和 preview canvas 內的 crop frame 對齊。
- prepare 的 crop frame 與 edit 的 preview image 在相同比例下必須維持同一個中央位置與顯示尺寸，且不可貼齊 preview stage 邊界。
- prepare 的 crop canvas 可以延伸到 crop frame 外並覆蓋 preview stage，讓 zoom / pan 時看得到原圖周邊脈絡；這個延伸不可改變 crop frame 本身的尺寸或位置。
- prepare 的 crop preview 即使 canvas 為了顯示周邊脈絡而延伸，也必須讓 overlay 對準 canvas 內的 crop frame，確保 OK 後的正式 crop output 與畫面框選一致。
- 從 prepare 進入 edit 且 result 尚未完成時，畫面應保留上一個可見 preview，不應短暫跳回 source fallback。
- prepare 與 edit 的 preview 對齊必須使用同一個 preview stage content-box，不可讓 border-box 差異造成微小位移。
- 旋轉、zoom、pan 都應作用在原圖 transform。
- 左右/上下反轉也應作用在原圖 transform，並且 preview 與正式輸出結果一致。
- 若使用者已旋轉原圖，點擊左右/上下反轉後，畫面應以目前可見座標鏡射，不應突然變成以未旋轉原圖座標鏡射。
- Fill 設為 Auto 時，ratio、zoom、rotation、pan、flip 調整後都應重新估算填色，且 preview 與 OK 後的正式 crop output 應一致。
- canvas 尺寸變化不應抵消使用者看到的 zoom / pan 效果。
- 桌面與手機版都不可因 `prepare` 中的 Crop 流程造成 preview stage 或整個 editor 高度被撐開。

## 預覽與狀態行為

使用者調整 slider、select、color 或 effects order 時，App 應更新 preview，但可以短暫 debounce，避免每一次輸入都完整重算。
slider 控制的填色與 thumb、Toggle Switch 的啟用狀態必須使用較淡的 control accent 主題色，不使用瀏覽器預設藍色。

主要狀態：

- `empty`：尚未有工作圖片。
- `loading-image`：圖片載入中。
- `ready`：可操作。
- `processing-preview`：預覽計算中。
- `preview-ready`：預覽已更新。
- `exporting`：匯出中。
- `exported`：匯出完成。
- `error`：發生錯誤。

頁面切換狀態：

- app start。
- mount page。
- unmount page。
- mount next page。

## 設定與保存行為

MVP 應保存：

- pipeline effects order。
- operation enabled 狀態。
- crop / resize / adjust / palette / dither / export settings。
- 使用者選擇的 demo preset 或目前工作圖片狀態。
- 頁面切換後返回 Dither Editor 所需的 session 狀態。

MVP 不要求：

- 完整 undo / redo history。
- 每一次 preview 的歷史版本。

## UI 文字與語言

MVP UI 文字先以英文為主，並集中管理。使用者可見文字應保持一致，例如：

- Dither Editor。
- Web Setting。
- Help。
- About。
- New Image。
- Export。
- Original。
- Custom。
- None。

產品行為重點：

- 按鈕、狀態、錯誤訊息、選單與設定 label 應有清楚文字。
- Tool icon 若不易理解，應提供 title 或 aria-label。
- UI 文字不應分散硬寫在各處，避免後續維護困難。

## 驗收與測試重點

MVP 驗收重點：

- 任意寬高圖片都能進入 Dither 流程。
- 改變 effects order 時，輸出會重新計算。
- disabled operation 不會被執行。
- crop 固定比例、拖曳原圖、滾輪 zoom、rotation、左右/上下反轉不會破壞裁切結果。
- resize 輸出尺寸符合設定。
- 透明像素會以白色背景合成。
- 超過最大尺寸的圖片會先縮小再進入編輯流程。
- 設定與工作圖片可保存並重新載入。
- schemaVersion 不符時會 fallback 或 migration，不會造成 runtime crash。
- export PNG 可以產生 Blob。

## 里程碑

### Milestone 1: Static App Shell

完成無後端、無外部依賴的主頁骨架。

驗收：

- 使用者可直接開啟 `index.html`。
- 看到 app shell、header、page host。
- Dither Editor 頁面可載入。
- Menu 可切換 Web Setting、Help、About。

### Milestone 2: Image Input and Viewport

完成圖片輸入與基本 preview。

驗收：

- 使用者可匯入本機圖片。
- 可選內建 demo。
- New Image 會開啟本機圖片選擇器。
- preview canvas 能顯示圖片。
- 不依賴遠端 URL。

### Milestone 3: Pipeline System

完成固定效果堆疊。

驗收：

- 可看到 effects stack。
- 可啟用、停用 operation。
- effects order 依固定順序執行。
- pipeline error 會停止流程並顯示錯誤。

### Milestone 4: Crop and Resize

完成裁切與縮放。

驗收：

- Crop 固定比例清單可用。
- crop overlay 行為穩定。
- zoom / rotation / pan / flip 不破壞輸出。
- resize 輸出尺寸符合設定。

### Milestone 5: Dither Engine

完成 Dither 與 palette 處理。

驗收：

- 支援 error diffusion。
- 支援 ordered dither。
- 支援 pattern dither。
- 支援 palette。
- 輸出結果可預覽。

### Milestone 6: Export

完成 PNG 匯出。

驗收：

- 使用者可匯出 PNG。
- 匯出使用正式 pipeline。
- 匯出失敗會顯示錯誤。

### Milestone 7: UI Replacement Readiness

確保功能邏輯和 UI 外觀能分離。

驗收：

- Dither editor 功能集中在自己的頁面模組。
- core 不依賴 DOM。
- app shell 不直接持有 canvas 細節。
- UI 文字集中管理。

## 建議不做的事

MVP 應避免：

- 加入遠端 runtime 依賴。
- 加入後端。
- 加入 build step。
- 把所有邏輯塞進單一 `main.js`。
- 實作 ESP32 API 或 Upload to Device。
- 把 canvas controller 和 UI 緊耦合。
- 把 DOM control value 當成唯一狀態來源。
- 在 MVP 就導入大型第三方圖片編輯器。

## 起始任務清單

1. 建立 `index.html`、styles 與 app shell。
2. 建立 namespace 與 classic script 載入順序。
3. 建立集中 UI 文字檔。
4. 建立 Dither Editor 設定檔與 registry。
5. 建立 app shell、page router 與 page registry。
6. 建立 Web Setting、Help、About 頁面。
7. 建立 Dither Editor feature manifest、feature registry 與 feature entries。
8. 建立 editor state 與 controller。
9. 建立 storage、image loader、viewport renderer、pipeline runner。
10. 實作 crop、resize、adjust、palette、dither 與 export。
11. 建立本機測試頁與基本測試案例。

## 成功標準

本專案在 MVP 階段成功時，應符合：

- 使用者可離線打開頁面並完成主要圖片流程。
- 使用者可切換 Web Setting 並保留設定。
- 使用者可匯入圖片、調整效果、拖曳順序、預覽並匯出 PNG。
- UI 能被未來替換，而不重寫核心圖片處理邏輯。
- 新增 Dither algorithm、palette preset 或 effect feature 時，不需要大範圍改動現有流程。
- ESP32 Device Mode 有保留方向，但不影響 Standalone MVP。

## Reviewer Checklist

Reviewer 應確認：

- MVP 沒有遠端 runtime 依賴、build step 或後端需求。
- 使用者可直接打開 `index.html`。
- 頁面切換、上一頁、下一頁行為符合預期。
- Crop、Resize、Adjust、Palette、Dither、Export 行為符合本 spec。
- Effects order 改變後會重新產生結果。
- Crop overlay 在桌面與手機版都穩定。
- Pipeline 失敗時會停止並呈現錯誤。
- 設定與 session 狀態保存符合預期。
- UI 文字集中管理。
- ESP32 Device Mode 沒有混入 MVP 主要流程。
