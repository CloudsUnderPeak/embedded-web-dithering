# Dither Image Editor 技術 Spec

```text
Version: 0.1.0
Status: Draft
Last Updated: 2026-06-07
Split From: SPEC_INDEX.md
```

本文件收斂實作與架構規格，給工程實作、review、測試設計使用。產品目標、使用者行為、畫面行為與驗收節奏請看 [SPEC_BEHAVIOR.md](SPEC_BEHAVIOR.md)。文件入口與閱讀導引請先看 [SPEC_INDEX.md](SPEC_INDEX.md)。

## History

- 2026-05-16: 定調目前專案版本為 `0.1.0`；此版本號與 storage / document `schemaVersion` 分開管理。
- 2026-05-16: 新增 `editor-mode-state-machine.js` 與 editor `mode` 狀態，集中管理 `empty`、`crop`、`edit` 轉換；重新載入圖片或 demo 時 controller 必須重建 default editor state，避免沿用上一張圖的演算法設定。
- 2026-05-16: 明確規範 Crop mode 不執行正式 preview pipeline，非允許工具與 action 必須由 controller guard；preview toolbar 必須由 mode 決定顯示列，未啟用列要真正 hidden，且各模式 toolbar 按鈕尺寸一致。
- 2026-05-21: Empty 模式的 upload/drop affordance 由 `page.js` 掛在 preview stage 中央，支援 hidden file input 的 Browse File 與 drop event；Image Input panel 不應顯示 Choose/Drop controls，empty canvas placeholder 必須隱藏。
- 2026-05-21: Image Input panel 的 `New Image` 改由 hidden file input 觸發本機圖片選擇，取代舊 `Choose Image` row；目前 UI 不暴露 blank canvas 建立入口。
- 2026-06-07: Crop 面板新增左轉 90 / 右轉 90 圖示按鈕，Flip 改為圖示按鈕；旋轉按鈕只更新 `rotation`，Flip 仍使用同一次 settings update 同步鏡射 rotation / pan，且不套用持續 active 視覺狀態。

## Plug-and-Play 架構要求

Dither Editor 的 feature 必須是 plug-and-play 架構。這裡的 plug-and-play 不是只把檔案拆開，而是讓每個 feature 擁有明確邊界與單一入口：

- 新增 feature 時，預設只新增一個 feature entry，並在 `feature-manifest.js` 啟用。
- 停用 feature 時，預設只把 `feature-manifest.js` 裡的該 feature 設為 `enabled: false`。
- 移除 feature 時，預設只移除 manifest entry 與該 feature entry；其他共用檔不應殘留該 feature 的硬編碼 id、panel builder、image-loaded hook、settings default 或 pipeline order。
- `entry.js` 只負責載入 registry 與 manifest 解析後的 feature scripts，不可直接列出某個 feature 的內部檔案。
- `page.js` 只根據 registry 產生工具列、action、panel，不可保存另一份 feature 清單。
- `controller.js` 只 dispatch lifecycle hook，不可為 `crop`、`resize`、`palette` 等單一 feature 補特殊流程。
- `state.js` 只由 enabled features 建立 settings 與 pipeline，不可手寫 feature id 清單。
- `pipeline-presets.js` 可以覆蓋順序或 enabled 狀態，但不可成為第二份 feature manifest。

驗收標準：

- 把 `Crop` 設成 `enabled: false` 後，工具列、settings、pipeline 都不應再出現 `crop`。
- 新增一個 draggable effect feature 後，不修改 `page.js` 或 `controller.js` 也應能顯示、設定、拖曳與參與 preview。
- 刪除某個已從 manifest 移除的 feature entry 後，專案內不應再有必須同步刪除的硬引用。

## 技術原則

新專案採用純瀏覽器架構：

```text
HTML + CSS + classic JavaScript scripts + Canvas API
```

運行限制：

- 不使用後端。
- 不使用 React、Vue、TypeScript 或其他前端框架。
- 不使用 CDN。
- 不在 runtime 下載外部資源。
- demo 圖片、圖示、字型、樣式都必須保留在專案內；demo 不可由 runtime 程式臨時產生。
- 使用者必須能直接雙擊 `index.html` 使用，不可要求另外執行 `python -m http.server` 或其他本機指令。
- 開發時可用 VS Code Live Server 預覽，但正式使用方式不能依賴 Live Server。
- 完全不使用 build step；不可要求 npm install、npm run build 或 bundler。
- MVP 以 Standalone Mode 為主；下一版可加入 ESP32 Device Mode。

因為要支援直接雙擊 `index.html`，不要使用 JavaScript ES Modules 的 `import` / `export`。多檔案仍然可以拆分，但要用 classic `<script>` 依序載入，並透過單一 namespace 暴露模組。

建議 namespace：

```js
window.DitherApp = window.DitherApp || {};
window.DitherApp.core = window.DitherApp.core || {};
window.DitherApp.ui = window.DitherApp.ui || {};
window.DitherApp.pages = window.DitherApp.pages || {};
```

允許使用的瀏覽器 API：

- `FileReader`
- `Blob`
- `URL.createObjectURL`
- `createImageBitmap`
- `fetch`，只能用於讀取專案內同源 demo assets，不可用於第三方 API 或遠端圖片
- `HTMLCanvasElement`
- `CanvasRenderingContext2D`
- `ImageData`
- `DragEvent`
- `PointerEvent`
- `localStorage`
- `IndexedDB`
- `Web Worker`，第二階段後再加入

## 頁面切換架構

為了未來更換主頁風格或切換成其他頁面，頁面 shell 與功能頁要分離。

建議概念：

```text
app-shell
  header
    title
    status
    menu-button
  page-host
    dither-editor-page
      dither-editor-panel
      dither-preview-panel
    web-setting-page
    help-page
    about-page
```

`app-shell` 只處理：

- 標題區。
- 右上選單。
- 頁面切換。
- browser history / back / forward 對應頁面切換。
- 全域主題。
- page mount / unmount。

`dither-editor-page` 才處理：

- 圖片狀態。
- 編輯區。
- 圖片呈現區。
- Dither pipeline。

頁面必須透過一致介面被外層呼叫：

```js
(function (app) {
    app.pages = app.pages || {};

    app.pages.ditherEditorPage = {
        id: 'dither-editor',
        title: 'Dither Image Editor',
        mount(container, appContext) {},
        unmount() {},
    };
})(window.DitherApp);
```

這樣未來要換主頁風格時，只要重寫 shell 或 CSS，不必改 Dither 頁面內部、演算法與圖片處理模組。

### Browser History 與 SPA Router

此專案是純前端 SPA，Menu 切頁不能只改記憶體狀態，否則瀏覽器上一頁/下一頁無法回到前一個頁面。

Router 必須負責同步 browser history：

- app start 時，router 讀取目前 URL hash，例如 `#/dither-editor`、`#/web-setting`、`#/help`、`#/about`。
- 如果 URL 沒有 hash，預設進入 `#/dither-editor`。
- 如果 hash 對應不到已註冊頁面，回退到 `#/dither-editor`。
- 使用 Menu 切頁時，router 必須透過 `history.pushState()` 寫入新頁面狀態。
- 初次進入或需要校正 URL 時，router 應使用 `history.replaceState()`，避免多塞一筆無意義 history。
- 使用者按瀏覽器上一頁/下一頁時，router 必須監聽 `popstate`，並依目前 history state 或 hash 重新 mount 對應頁面。
- `popstate` 觸發的頁面切換不可再次 `pushState()`，避免 history 堆疊重複。

建議 URL 格式：

```text
#/dither-editor
#/web-setting
#/help
#/about
```

Router 只保存目前 page id 和 browser history 狀態，不保存 Dither Editor 的圖片、settings、pipeline 或 canvas 內容。Dither Editor 切頁後回來的工作區保留，仍由 `pages/dither-editor/page.js` 的 page-specific cache 負責。

### 跨頁共用原則

新增頁面時，必須共用外層能力，而不是把功能改寫到同一個 canvas 或同一個頁面 controller 裡。

依賴方向固定如下：

```text
main -> app -> pages -> ui
              pages -> core
              pages -> utils
```

禁止反向依賴：

```text
core -> pages
core -> app
ui -> pages
ui -> pages/dither-editor/dither
app -> pages/dither-editor internals
```

也就是說：

- `app` 可以載入頁面模組，但不能知道某頁內部有幾個 canvas、幾個 panel、幾個 operation。
- `pages/*` 可以使用 `core` 和 `ui` 組出自己的功能。
- `core` 只提供資料處理能力，不知道任何頁面存在。
- `ui` 只提供可重用互動元件，不知道 Dither、Web Setting、Help、About 或其他頁面的業務語意。
- 每個頁面自己擁有自己的 DOM 容器與 canvas lifecycle。
- `index.html` 只載入 app shell、共用基礎檔與每個 page 的 `entry.js`。頁面內部 script 載入順序由該 page 自己的 `entry.js` 管理。

### Page Entry 命名規則

每個頁面資料夾的入口檔一律命名為 `entry.js`，頁面主體一律命名為 `page.js`。

```text
src/pages/{page-id}/
  entry.js
  page.js
  state.js
  controller.js
  constants.js
```

規則：

- `entry.js` 負責載入該頁自己的 config、algorithms、feature manifest、feature registry、enabled feature scripts、viewport、controller、state 與 `page.js`；feature scripts 必須從 `feature-manifest.js` 經由 `feature-registry.js` 解析產生，不直接逐一硬寫 operation 或 panel 檔。
- `entry.js` 最後負責讓頁面模組可被 app registry 註冊。
- `page.js` 只負責該頁的 mount / unmount 與頁面 DOM 組合。
- `index.html` 不可直接列出某頁內部的 operation、algorithm、panel、viewport 檔案。
- 新增頁面時，第一時間只需要找 `src/pages/{page-id}/entry.js`。
- 若 IDE 開啟多個 `entry.js`，以完整路徑區分頁面；不要為了 IDE tab 名稱破壞命名規則。

## 建議專案結構

這是 target blueprint，不代表目前 repository 已經實作所有列出的檔案。缺少的 future path 不應只為了符合本章節而建立；只有在實作對應功能時才新增。

```text
embedded-web-dithering/
  index.html
  assets/
    demo/                 # built-in demo image assets
    icons/
    styles/
      base.css
      layout.css
      components.css
      themes.css
  src/
    namespace.js
    main.js
    i18n/
      en.js
    app/
      app-shell.js
      app-menu.js
      app-state.js
      page-router.js
      page-registry.js
    pages/
      dither-editor/
        entry.js
        page.js
        state.js
        editor-mode-state-machine.js
        feature-manifest.js
        feature-registry.js
        actions.js
        events.js
        controller.js
        constants.js
        config/
          palette-presets.js
          dither-algorithms.js
          pipeline-presets.js
          display-profiles.js
        features/
          input-feature.js
          crop-feature.js
          resize-feature.js
          adjust-feature.js
          palette-feature.js
          dither-feature.js
          export-feature.js
        operations/
          operation-registry.js
          pipeline-runner.js
        dither/
          dither-matrices.js
          error-diffusion.js
          ordered-dither.js
          pattern-dither.js
        panel-utils.js
        viewport/
          viewport-controller.js
          viewport-renderer.js
          overlay-renderer.js
          pointer-mapper.js
      web-setting/
        entry.js
        page.js
      help/
        entry.js
        page.js
      about/
        entry.js
        page.js
      device-settings/
        entry.js
        page.js
        device-status-panel.js
        network-panel.js
    core/
      storage/
        storage-keys.js
        settings-store.js
        document-store.js
      image/
        image-loader.js
        image-document.js
        image-exporter.js
      canvas/
        canvas-utils.js
        image-data-utils.js
      color/
        color-utils.js
        palette-utils.js
      encoders/
        png-encoder.js
        device-output-encoder.js
    device/
      device-api.js
      device-session.js
      device-status.js
      network-settings.js
      display-profile.js
      display-upload.js
      device-errors.js
    ui/
      button.js
      dropdown-menu.js
      dropzone.js
      slider.js
      select.js
      color-swatch.js
      sortable-list.js
      tooltip.js
      toggle.js
    utils/
      dom.js
      events.js
      math.js
      naming.js
```

## 命名與 Coding Style

命名必須統一，避免同一專案內混用大小寫風格。

### 檔案命名

全部使用 kebab-case：

```text
editor-state.js
dither-feature.js
palette-presets.js
viewport-renderer.js
```

不要混用：

```text
EditorState.js
editorState.js
dither_operation.js
```

### 函式與變數命名

使用 camelCase：

```js
function applyDither(input) {}
const activeOperationId = 'crop';
let previewImageData = null;
```

### Class 命名

使用 PascalCase：

```js
class EditorController {}
class ViewportRenderer {}
```

### 常數命名

全域不可變常數使用 SCREAMING_SNAKE_CASE：

```js
const MAX_IMAGE_SIZE = 4096;
const DEFAULT_PIPELINE_ORDER = ['crop', 'resize', 'adjust', 'palette', 'dither'];
```

模組內一般設定可用 camelCase：

```js
const defaultDitherOptions = {
  mode: 'none',
  algorithm: 'none',
};
```

### CSS 命名

使用 kebab-case class name，並以區域作前綴：

```css
.app-header {}
.page-host {}
.dither-editor-page {}
.dither-editor-panel {}
.dither-preview-panel {}
.pipeline-list {}
```

### Theme CSS

全站 light / dark theme 必須透過 `assets/styles/themes.css` 的 CSS variables 管理。

規則：
- `themes.css` 定義 `:root` / `body[data-theme="light"]` / `body[data-theme="dark"]` 的顏色 token。
- `base.css` 只處理全域元素、字體、body 背景與基本表單繼承。
- `layout.css` 只處理 app shell、page layout、preview stage、scrollbar gutter 等結構。
- `components.css` 只處理 panel、button、tool row、dropzone、menu、setting choice 等可重用元件。
- component 不應直接硬寫大面積 `#ffffff`、`#172026`、固定 rgba 邊框或陰影；應使用 `--color-*` token。
- 切換黑暗模式只改 `body[data-theme]`，不應重建 Dither Editor page，也不應重新跑 pipeline。
- theme 只影響 UI chrome，不改 canvas 內的影像處理結果。

### 程式風格

採用目前專案 `.prettierrc` 的方向：

- 4 spaces indentation。
- single quote。
- semicolon。
- `printWidth` 100。
- function 小而明確。
- 不在演算法模組中讀取 DOM。
- 不在 UI 模組中直接改 `ImageData`。
- 不使用 `import` / `export`，避免雙擊 `index.html` 時被瀏覽器 module/CORS 限制擋住。
- 每個檔案只掛載到 `window.DitherApp` namespace 下，不建立其他全域變數。
- 生成程式時必須寫好必要註解，說明非直覺的狀態流、DOM 掛載契約、canvas lifecycle、pipeline 順序與演算法取捨。
- 註解應該解釋「為什麼」或「這段如何與架構契約互動」，不要重複描述語法本身。
- 若某個 `id`、class、`data-*` 屬性會被 JavaScript 查找或被 CSS responsive layout 依賴，應在建立處或鄰近處加註解標明用途。

### Script 載入順序

因為專案堅持無 build step 且要支援直接雙擊 `index.html`，`index.html` 必須用 classic scripts 依序載入共用基礎檔與 page entries。單一頁面內部需要的 scripts 不應攤平在 `index.html`，必須交給該頁的 `entry.js` 管理。

示意：

```html
<script src="src/namespace.js"></script>
<script src="src/i18n/en.js"></script>
<script src="src/utils/dom.js"></script>
<script src="src/core/canvas/canvas-utils.js"></script>
<script src="src/ui/sortable-list.js"></script>
<script src="src/app/page-registry.js"></script>
<script src="src/pages/dither-editor/entry.js"></script>
<script src="src/pages/web-setting/entry.js"></script>
<script src="src/pages/help/entry.js"></script>
<script src="src/pages/about/entry.js"></script>
<script src="src/app/app-shell.js"></script>
<script src="src/main.js"></script>
```

`entry.js` 可以透過動態插入 classic `<script>` 的方式依序載入該頁檔案。不得使用 ES Modules `import` / `export`，也不得用會被 `file://` CORS 擋住的 template/script `fetch()` 作為唯一載入方式。

每個檔案使用 IIFE 或清楚的 namespace assignment：

```js
(function (app) {
    app.core = app.core || {};

    app.core.applyDither = function applyDither(imageData, options) {
        return imageData;
    };
})(window.DitherApp);
```

## Editor State

專案必須有單一 editor state。DOM 是 state 的呈現，不是主要資料來源。

資料形狀：

```js
const editorState = {
    schemaVersion: 1,
    status: 'empty',
    mode: 'empty',
    sourceImage: null,
    sourceImageData: null,
    previewImageData: null,
    outputImageData: null,
    activeTool: 'input',
    openToolPanels: {
        input: true,
    },
    viewMode: 'result',
    viewport: {
        zoom: 1,
        panX: 0,
        panY: 0,
    },
    pipeline: {
        fixedBefore: buildPipelineFromEnabledFeatures('fixedBefore'),
        effectsOrder: buildPipelineFromEnabledFeatures('effectsOrder'),
        fixedAfter: buildPipelineFromEnabledFeatures('fixedAfter'),
        enabled: buildPipelineEnabledMapFromEnabledFeatures(),
    },
    settings: buildDefaultSettingsFromEnabledFeatures(),
};
```

`pipeline` 與 `settings` 不可在 `state.js` 手動列出 `crop`、`resize`、`adjust` 等 feature id。它們必須由 `feature-registry.js` 依照 enabled features 建立：

- feature 停用後，不產生該 feature 的 settings key、pipeline order 或工具列項目。
- feature 新增後，只要 manifest 啟用且 feature contract 合法，就自動建立 default settings。
- Tool Panel 開啟狀態必須以 feature id 儲存在 state，例如 `openToolPanels[featureId] = true`；不可只用單一 `activeTool` 表示所有面板開合。
- Dither Editor 頁面在 app menu 切到 `Web Setting`、`About`、`Help` 或其他頁面再切回來時，必須保留 editor state、圖片與目前 preview。此保留屬於頁面模組層級的 in-memory state cache，不是 IndexedDB 持久化。
- `page.js` 在 `unmount()` 時應保存目前 `controller.state`；下次 `mount()` 時應把保存的 state 以 `initialState` 傳回 controller。第一次進入 Dither Editor 且沒有 cached state 時，必須停在 `empty`，不可自動建立 `New Image`。
- 若切頁時狀態停在 `loading-image`、`processing-preview` 或 `exporting` 這類 transient status，回到 Dither Editor 時應正規化或重新排 preview，避免畫面卡在不可完成的中間狀態。
- 載入舊文件時，已不存在的 feature settings 不可讓頁面 crash；應由 migration 忽略、保留到 unknown 區，或交給對應 feature 處理。

### Editor Mode State Machine

`mode` 是使用者流程狀態，`status` 是 transient 執行狀態。模式轉換必須集中在 `editor-mode-state-machine.js` 與 controller 方法中，不應散落在 feature panel event handler。

模式：

- `empty`：`sourceImageData` 為 `null`。只有 `input` tool 可操作，其他 tool、Export 與 Original / Result 必須停用或隱藏；右下角 preview toolbar 不可顯示任何按鈕。Preview stage 必須顯示中央 upload dropzone，支援 drop 與 Browse File；empty canvas 與 No image loaded placeholder 必須不可視；Image Input panel 不應重複顯示 Choose/Drop controls。
- `crop`：有來源圖且 Crop 展開。只有 `input` 與 `crop` tool 可操作；Preview 顯示 `sourceImageData` 加上 Crop transform，不跑完整 pipeline，也不套用 Resize、Adjust、Palette、Dither；右下角 preview toolbar 只能顯示 Zoom In、Zoom Out、OK。
- `edit`：有來源圖且 Crop 收合。Preview / Export 使用正式 pipeline，右下角 preview toolbar 只能顯示 Original、Result。

轉換規則：

- 成功載入本機圖片或 demo 時，controller 必須重建 default editor state、清掉上一張圖的 settings/pipeline order/live preview 暫態，再寫入新 `sourceImageData` 並進入 `crop`。
- 重新載圖成功後，Resize、Adjust、Palette、Dither 等演算法 settings 必須回到 enabled feature default；不可沿用上一張圖的值。
- 展開 Crop 必須進入 `crop`；收合 Crop 或按 OK 必須進入 `edit` 並排程正式 preview。
- `crop` 中的 Crop setting 變更只能重畫 crop preview，不可排程完整 pipeline。離開 `crop` 後才依目前 settings 跑正式 preview。
- `empty` 或 `crop` 中的非允許 tool/action event 必須被 controller guard 掉，即使 DOM disabled 被繞過也不可改 settings、reorder effects 或 export。
- `page.js` 必須只根據 `mode` 決定 preview toolbar 內容：`empty` 隱藏整個 toolbar，`crop` 只顯示 Crop 控制列，`edit` 只顯示 Original / Result 切換列。
- 非目前模式的 preview toolbar row 必須使用 `hidden` 真正移出 layout，不可只做 disabled 或透明處理。
- Preview toolbar 內 button 必須共用固定尺寸設定，避免 mode 切換或 primary / secondary 樣式造成按鈕大小不同。

`schemaVersion` 必須同步用於 `settings-store.js` 與 `document-store.js`。讀取儲存資料時：

- schemaVersion 相同：正常載入。
- schemaVersion 較舊：執行 migration。
- schemaVersion 不存在或 migration 失敗：回退到 default editor state，並提示使用者建立新工作區。
- schemaVersion 較新：不嘗試讀取，提示使用者此資料來自較新版工具。

## Preset 與演算法擴充

Preset 與演算法不做成使用者可見的 `Preset Manager` 頁面。它們是 Dither Editor 的開發者擴充點，透過 `src/pages/dither-editor/config/*` 和 registry 管理。

目標：

- 新增 palette preset 時，不需要改 UI panel 邏輯。
- 新增 dither algorithm 時，不需要改 dither panel 的選項生成邏輯。
- 新增 effect feature 時，只新增對應 `features/*-feature.js` 並在 `feature-manifest.js` 啟用，再讓 effects stack 自動可用。
- 預設 pipeline preset 由 config 管理，方便未來加入 e-paper、GameBoy、monochrome 等工作流。

### Config 檔案

```text
src/pages/dither-editor/config/
  palette-presets.js
  dither-algorithms.js
  pipeline-presets.js
```

`palette-presets.js`：

```js
(function (app) {
    app.pages.ditherEditor = app.pages.ditherEditor || {};
    app.pages.ditherEditor.config = app.pages.ditherEditor.config || {};

    app.pages.ditherEditor.config.palettePresets = [
        {
            id: 'monochrome',
            labelKey: 'paletteMonochrome',
            colors: [
                { r: 0, g: 0, b: 0 },
                { r: 255, g: 255, b: 255 },
            ],
        },
    ];
})(window.DitherApp);
```

Palette feature 必須把 preset 與使用者自訂色票分清楚：

- 固定 preset 只來自 `palette-presets.js`。
- MVP 內建 fixed presets 至少包含 `monochrome`、`game-boy`、`warm-ink`、`e6-color-epaper`；`e6-color-epaper` 使用黑、白、紅、黃、藍、綠六色色票。
- `Original` 是 Palette 的預設選項，色票從載入時的原始 `sourceImageData` 萃取，不考慮 crop、resize、adjust 或其他 pipeline step。
- `Original` 只負責顯示原始圖片代表色並同步給 `Dither`，palette operation 不主動改變圖片。
- `Custom` 只代表目前 settings 中的色票陣列，不應被加入 `palette-presets.js`。
- 選擇固定 preset 時，feature 應複製 preset colors 到目前 settings，避免使用者後續編輯污染 config。
- `Palette` 不提供 `Quantize` 開關；選擇固定 preset 或 `Custom` 後，palette operation 直接把像素映射到目前色票中最接近的顏色。
- 使用者新增、刪除或編輯色票後，feature 應把 `presetId` 設為 `custom`，立即排程 preview，並讓 `Dither` 使用同一份有效 palette。
- 色票陣列為空時，feature 應回到 `presetId: 'original'`；`Original` 不主動改圖，固定 preset 或 `Custom` 則直接把像素映射到目前色票。

`dither-algorithms.js`：

```js
(function (app) {
    app.pages.ditherEditor = app.pages.ditherEditor || {};
    app.pages.ditherEditor.config = app.pages.ditherEditor.config || {};

    app.pages.ditherEditor.config.ditherAlgorithms = [
        {
            id: 'floyd-steinberg',
            labelKey: 'algorithmFloydSteinberg',
            mode: 'error-diffusion',
            matrixId: 'floydSteinberg',
        },
    ];
})(window.DitherApp);
```

`pipeline-presets.js`：

```js
(function (app) {
    app.pages.ditherEditor = app.pages.ditherEditor || {};
    app.pages.ditherEditor.config = app.pages.ditherEditor.config || {};

    app.pages.ditherEditor.config.pipelinePresets = [
        {
            id: 'default',
            labelKey: 'pipelineDefault',
        },
    ];
})(window.DitherApp);
```

`pipeline-presets.js` 可以覆蓋某個 preset 的順序或停用狀態，例如 `enabled: { palette: false }`，但不應為了預設順序或預設啟用狀態重複列出所有 feature id。預設 `fixedBefore`、`effectsOrder`、`fixedAfter` 順序應由 enabled features 的 `pipelineStage` 與 `pipelineOrder` 產生。

### Registry 規則

- plug-and-play 是此區塊的主要目標；registry 必須讓 feature 的載入、註冊、初始化、停用、清理和遷移都有固定路徑。
- `pages/dither-editor/operations/operation-registry.js` 負責保存 feature 註冊進來的 operation implementation；單一 operation 不應再拆成獨立 `*-operation.js` 檔。
- `pages/dither-editor/feature-manifest.js` 負責宣告 Dither Editor 頁 enabled feature manifest，例如 `Image Input`、`Crop`、`Resize`、`Adjust`、`Palette`、`Dither`、`Export` 對應的 feature script path、`enabled`、`dependsOn` 與 `loadOrder`。
- `pages/dither-editor/feature-registry.js` 負責驗證 feature contract、解析 manifest dependency/load order、註冊 feature、產生工具列、state settings、pipeline order 與 lifecycle dispatch。
- 每個 `pages/dither-editor/features/*-feature.js` 必須是該 feature 的工具列定義、operation、panel builder、預設 settings、feature hook、工具圖示、labelKey、pipeline stage、pipeline order 與是否顯示在 dock 的單一來源；`page.js` 不可另寫一份固定工具清單或固定 panel builder map，`entry.js` 不可直接手寫每個 feature script。
- `Image Input`、`Export` 這類 UI action 不放進 pipeline operations，但仍必須以 feature script 管理，並由 `feature-manifest.js` 控制是否載入。
- 要停用某個 feature，例如 `Crop`，預設做法是只在 `feature-manifest.js` 將該 feature 設為 `enabled: false`；停用後該工具不應出現在工具列、state settings、pipeline order，也不應載入對應 feature script。
- `pages/dither-editor/operations/operation-registry.js` 的 operation metadata 負責定義該 operation 是否屬於可拖曳 pipeline effect，例如 `pipeline: { draggable: true }`。
- `pages/dither-editor/config/dither-algorithms.js` 負責定義 dither panel 可選演算法。
- `pages/dither-editor/config/palette-presets.js` 負責定義 palette panel 可選固定調色盤。
- `Palette` 的 `Custom` 色票不寫入 `palette-presets.js`；它由 `palette-feature.js` 的 settings 管理，隨目前工作區保存。
- UI panel 只能讀 registry/config 產生選項，不可把演算法名稱硬寫在 HTML。
- UI 產生工具列時，必須透過 operation registry 判斷哪些項目可拖曳排序；未註冊為 draggable pipeline effect 的項目不可被拖曳。
- 新增演算法時，必須同時新增 labelKey 到 `src/i18n/en.js`。

### Feature Manifest Schema

`feature-manifest.js` 只描述 feature 是否載入與載入順序，不放 UI、operation 或 default settings：

```js
{
    id: 'adjust',
    enabled: true,
    path: 'src/pages/dither-editor/features/adjust-feature.js',
    dependsOn: [],
    loadOrder: 40,
}
```

規則：

- `id` 與 `path` 必填。
- `enabled: false` 時，該 feature script 不載入。
- manifest 是 plug-and-play 的唯一開關；除非是 migration 或 preset override，不應在其他檔案用 feature id 判斷功能是否存在。
- `dependsOn` 只用於真正不能獨立運作的 feature；例如 `resize` 不應因為順序在 `crop` 後面就依賴 `crop`。
- dependency 必須先載入；dependency missing 或 circular dependency 必須中止該頁載入並顯示錯誤。
- `loadOrder` 只處理沒有 dependency 關係時的穩定排序。
- 同一個 feature id 不可重複出現在 manifest。
- feature script 載入後必須以相同 `id` 呼叫 `featureRegistry.register(feature)`；載入完成後 registry 必須檢查 enabled manifest 是否全數註冊成功。

### Feature Contract

每個 feature script 必須註冊一個 feature object。外部只依賴這個 object，不直接依賴 feature 內部檔案：

```js
app.pages.ditherEditor.featureRegistry.register({
    id: 'adjust',
    icon: '~~',
    labelKey: 'toolAdjust',
    dock: true,
    dockOrder: 40,
    pipelineStage: 'effectsOrder',
    pipelineOrder: 10,

    defaultSettings: function defaultSettings(context) {
        return {};
    },

    buildPanel: function buildPanel(context) {
        return document.createElement('div');
    },

    operation: {
        pipeline: { draggable: true },
        run: function run(imageData, settings, context) {
            return imageData;
        },
    },

    onMount: function onMount(context) {},
    onUnmount: function onUnmount(context) {},
    dispose: function dispose(context) {},
    onImageLoaded: function onImageLoaded(context) {},
    onSettingChanged: function onSettingChanged(context) {},
    onBeforePreview: function onBeforePreview(context) {},
    onAfterPreview: function onAfterPreview(context) {},
    onBeforeExport: function onBeforeExport(context) {},
    onAfterExport: function onAfterExport(context) {},
    migrateSettings: function migrateSettings(oldSettings, fromVersion, toVersion) {
        return oldSettings;
    },
});
```

規則：

- feature id 必須唯一。
- 顯示在 dock 的 feature 必須提供 `icon` 與 `labelKey`。
- 有 `pipelineStage` 且屬於圖片處理步驟的 feature 必須提供 `operation.run()`。
- `Image Input`、`Export` 可以是 action feature，不一定要提供 image operation。
- feature 的 UI、operation、default settings、hooks 和 pipeline metadata 必須從同一個 feature contract 暴露，避免移除功能時到多個共用檔同步刪除。
- 單一 feature 可以在自己的資料夾內分檔，例如 `features/palette/feature.js`、`panel.js`、`operation.js`；但外部只載入 manifest 指定的 feature entry。

### Feature Lifecycle

feature lifecycle 必須固定，避免每個 feature 自行在 `page.js` 或 `controller.js` 補特殊 case：

```text
register
  -> onMount
  -> onImageLoaded
  -> onSettingChanged
  -> onBeforePreview
  -> onAfterPreview
  -> onBeforeExport
  -> onAfterExport
  -> onUnmount
  -> dispose
```

`dispose` 用於清理 event listener、object URL、timer、worker、temporary canvas、cached ImageData 等資源。

### Feature State Builder

`state.js` 不可手寫每個 feature 的 default settings。必須由 enabled features 建立：

```js
featureRegistry.all().forEach(function (feature) {
    if (feature.defaultSettings) {
        settings[feature.id] = feature.defaultSettings(context);
    }
});
```

pipeline 順序也必須由 enabled features 的 `pipelineStage` 與 `pipelineOrder` 建立；`pipeline-presets.js` 只能覆蓋順序或啟用狀態，不可成為第二份 feature 清單。

### Feature Migration

儲存文件載入時，migration 可以分兩層：

- 全域 migration 負責 `schemaVersion` 與 state shape。
- feature migration 負責該 feature 自己的 settings。

如果舊資料包含已停用或不存在的 feature settings，預設不應套用到 UI，也不應讓 preview/export crash。需要保留資料時，可以放進 unknown settings 區，等該 feature 重新啟用後再由 `migrateSettings()` 處理。

## ESP32 Device Mode 預留

本版 MVP 先完成可獨立使用的 Standalone Mode。下一版預留 ESP32 Device Mode，讓同一份靜態網站可以被 ESP32 提供給使用者，並在瀏覽器端完成圖片處理後上傳到裝置。

### App Mode

使用 config 控制運行模式：

```js
const APP_MODE = 'auto'; // 'auto' | 'standalone' | 'device'
```

規則：

- `standalone`：不呼叫 ESP32 API，只提供編輯、保存與 PNG download。
- `device`：要求 ESP32 API 可用，API 不通時顯示 device disconnected。
- `auto`：先嘗試 device info API，成功則進入 Device Mode，失敗則回到 Standalone Mode。
- GitHub Pages demo 預設使用 `standalone` 或 `auto`。
- ESP32 內建網站未來可使用 `device` 或 `auto`。

### Device Mode 目標

Device Mode 中：

- 靜態網站由 ESP32 提供。
- 圖片處理仍全部在瀏覽器端完成。
- ESP32 不負責 crop、resize、palette、dither 等運算。
- ESP32 負責提供 device API、session token、network settings、接收上傳 payload，並直接刷新顯示器。
- Upload to Device 是下一版功能，不列入 MVP。

### Web Setting Page

`Web Setting` 是 app shell 層級頁面，不屬於 Dither Editor feature。它負責全站 UI 偏好，例如 light / dark theme。

```text
pages/web-setting/
  entry.js
  page.js
```

規則：
- Web Setting 頁面只修改 app shell state 和持久化 settings，不保存 Dither Editor 的 canvas、圖片、pipeline 或 feature settings。
- theme 選項必須由 `app-state.js` 統一提供，例如 `light`、`dark`。
- 切換 theme 時，必須立刻更新 `body[data-theme]`，讓 `assets/styles/themes.css` 內的 CSS variables 套用到全站。
- theme 必須透過 `settings-store.js` 寫入 localStorage；重新整理或下次重新打開瀏覽器頁面後仍保留。
- 未來若加入後端登入或 session，再另外導入 cookie；現階段 Web Setting 不使用 cookie。
- 新增 Web Setting 頁面不應要求修改 Dither Editor 的 controller、page 或 feature registry。

### Device Settings Page

未來可新增可見頁面：

```text
pages/device-settings/
  entry.js
  page.js
  device-status-panel.js
  network-panel.js
```

用途：

- 顯示 ESP32 連線狀態。
- 顯示 device id、firmware version、api version。
- 顯示 display profile。
- 設定 AP mode。
- 設定連線到指定 Wi-Fi。
- 測試 Wi-Fi 連線。
- 顯示目前 IP。
- 顯示 session/token 狀態。

### Device API 預留

下一版可採用以下 API 草稿：

```text
GET  /api/device/info
GET  /api/device/status
GET  /api/network/status
POST /api/network/ap
POST /api/network/wifi
GET  /api/display/profile
POST /api/display/image
```

`POST /api/display/image` 上傳成功後，ESP32 直接刷新顯示器。

### Session Token 預留

Device Mode 必須避免網頁連到非原本的 ESP32 裝置。

下一版 token 規則：

- ESP32 提供自動 session token。
- 前端以 memory 或 sessionStorage 保存 token，不長期放 localStorage。
- 每個 device API request 帶 `X-Device-Token`。
- device info/status 必須回傳 `deviceId`。
- 若後續 API 回傳的 `deviceId` 和目前 session 不一致，停止 Upload to Device 並提示使用者。

### Display Profile 預留

顯示器必須透過 display profile registry 擴充，不可在 crop、resize、upload 邏輯中硬寫某一個尺寸。Profile 對使用者與程式都以像素尺寸為主，不使用 7.3 吋、13.3 吋這類實體尺寸作為主要識別。

```js
(function (app) {
    app.pages.ditherEditor = app.pages.ditherEditor || {};
    app.pages.ditherEditor.config = app.pages.ditherEditor.config || {};

    app.pages.ditherEditor.config.displayProfiles = [
        {
            id: 'epaper-color-800x480',
            labelKey: 'displayEpaperColor800x480',
            width: 800,
            height: 480,
            aspectRatio: 800 / 480,
            colorMode: 'color',
            refreshMode: 'direct',
            outputFormat: 'device-native',
        },
        {
            id: 'epaper-color-custom',
            labelKey: 'displayEpaperColorCustom',
            width: null,
            height: null,
            aspectRatio: null,
            colorMode: 'color',
            refreshMode: 'direct',
            outputFormat: 'device-native',
            note: 'Set exact pixel size before enabling this profile.',
        },
    ];
})(window.DitherApp);
```

Device Mode 啟用 device display target 時：

- display profile 必須由 ESP32 `/api/display/profile` 回傳，或由 `src/pages/dither-editor/config/display-profiles.js` 中選定。
- crop aspect ratio 鎖定為目前 display profile 的 `aspectRatio`。
- resize output size 鎖定為目前 display profile 的 `width` / `height`。
- export / upload 使用 display profile。
- Upload to Device 按鈕才可用。
- 如果 display profile 的像素尺寸尚未確認，禁止 Upload to Device，並要求完成 profile 設定。

### Upload Busy UI 預留

Upload to Device 與 display refresh 期間必須顯示 blocking overlay：

```text
Uploading to device...
Refreshing display...
```

行為：

- 顯示 spinner。
- 禁止編輯。
- 禁止切換頁面。
- 禁止重複上傳。
- 成功後解除 blocking。
- 失敗後解除 blocking 並顯示錯誤。
- MVP 下一版可以先不做 cancel。

### Device Output Encoding 預留

目前不寫死上傳 payload 格式，因為需依 e-paper driver 決定。

保留 encoder 位置：

```text
src/core/encoders/
  png-encoder.js
  device-output-encoder.js
```

Display profile 以 `outputFormat` 指定 encoder。未來可能支援：

- `png`
- `rgb565`
- `rgb888`
- `indexed-palette`
- `device-native`

瀏覽器端應輸出 display-ready payload，ESP32 端盡量只接收並寫入顯示器。

## 圖片處理流程與可拖曳效果堆疊

圖片處理流程順序會影響結果，但不是每個步驟都應該出現在同一個拖曳列表中。為了避免使用者看到「可拖曳列表中間卻卡固定步驟」的混亂體驗，流程切成三段：

```text
fixed before: Crop -> Resize
draggable effects: Adjust / Palette / Dither / future effect features
fixed after: Export
```

規則：

- `crop` 和 `resize` 固定在效果演算法之前。
- `export` 固定在最後，不出現在拖曳列表。
- 使用者只能拖曳 `draggable effects` 中的項目。
- 會因順序影響圖片呈現的演算法，盡量集中放在 `draggable effects`。
- 未來新增 pixelation、threshold、blur、sharpen 等效果時，優先加入 `draggable effects`。

例如：

```text
Crop -> Resize -> Adjust -> Palette -> Dither -> Export
```

和：

```text
Crop -> Resize -> Dither -> Palette -> Adjust -> Export
```

可能產生不同輸出。

### Effects Stack UI

編輯區不建立獨立可見的 `pipeline-panel`。屬於 `draggable effects` 的工具列項目本身就是效果堆疊，使用者直接拖曳這些工具列項目改變順序。

```text
[~~] [⋮⋮] Adjust    enabled
[# ] [⋮⋮] Palette   enabled
[..] [⋮⋮] Dither    enabled
```

`Crop`、`Resize` 各自留在自己的固定工具列項目，不可拖曳。`Export` 不在 accordion 工具列內，而是固定外露動作。`Adjust`、`Palette`、`Dither` 是否可拖曳不由 UI 寫死，而是由 operation registry metadata 決定。

工具列順序、operation、panel builder、feature hook 與可見性必須由 feature script 產生，並由 `feature-manifest.js` 控制是否載入。若未來要移除 `Crop`，主要應只從 `feature-manifest.js` 停用或移除該 feature；`entry.js`、`pipeline-presets.js`、`page.js`、`controller.js` 不應還有另一份 `crop` 載入、順序、工具列、panel builder 或 image-loaded hook 定義需要同步刪除。

每個項目需要：

- 功能圖示。
- 可拖曳項目才顯示 drag handle，位置在功能圖示後、文字前。
- 拖曳 handle 必須限制在 Tool Row；Tool Panel 本身和面板內表單控制不可拖曳。
- 滑鼠移到 drag handle 時才顯示 `grab` cursor；Tool Row 其他區域平常維持一般按鈕游標。
- drag handle 可立即啟動拖曳；Tool Row 其他區域必須長按一小段時間後才啟動拖曳，避免一般點選展開 Tool Panel 時誤拖。
- effects stack 拖曳不使用瀏覽器原生 HTML5 drag preview；避免出現不受控的殘影與游標變化。
- effects stack 拖曳應使用 Pointer Events 實作，拖曳期間以 `grabbing` cursor 固定手感。
- 拖曳項目移到其他 Tool Row 上方時，DOM 可以立即重排形成視覺排序；此階段不可每次 hover 都觸發完整 page render 或重新跑 pipeline。
- pipeline order state 應在拖曳結束後才更新一次，避免排序過程中連續觸發 preview。
- enabled / disabled toggle。
- 點選後顯示該步驟的參數面板。
- 多個 Tool Panel 可以同時展開。
- 顯示是否有錯誤設定。

### Effects Drag Feel

effects stack 的拖曳手感屬於 UI tuning，不應散落在 feature 或 controller。可調參數應集中在 `src/ui/sortable-list.js` 與 `assets/styles/components.css`。

建議可調項：

```js
var DRAG_THRESHOLD = 5;
holdDelay: 260;
entry.node.style.transition = 'transform 105ms ease-out';
```

```css
body.is-sorting,
body.is-sorting * {
    cursor: grabbing !important;
}

.tool-accordion-item.is-dragging .tool-button {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
}
```

調整原則：

- `DRAG_THRESHOLD` 控制按下後要移動多少像素才開始排序；數值越小越靈敏，越大越不容易誤拖。
- `holdDelay` 控制從 Tool Row 非 drag handle 區域長按多久才進入拖曳；數值越小越容易誤拖，越大越接近純點擊展開。
- `transform ... ms ...` 控制其他 Tool Row 讓位的動畫速度；過短會生硬，過長會有過度滑動感。
- animation cleanup timeout 必須略大於 transition duration，例如 transition `105ms` 時 cleanup 可約 `120ms`。
- `.is-dragging` 只用來提示目前被拖曳的 Tool Row，不應製造另一個可見殘影。
- `body.is-sorting` 必須鎖定 cursor，避免滑過 icon、label、button 或其他元素時游標樣式跳動。
- `.tool-drag-handle` 是唯一平常顯示 `grab` 的區域；整個 `.tool-button` 不應預設顯示手握取游標。

### Pipeline 限制

Pipeline 需要明確規則。

MVP 規則：

- `crop` 固定在 `fixedBefore` 第一段。
- `resize` 固定在 `fixedBefore`，並在 `crop` 之後。
- `adjust`、`palette`、`dither` 屬於 `effectsOrder`，可拖曳改變順序。
- `export` 不在 pipeline list 中，它永遠使用目前 pipeline 結果。
- 如果某效果順序可能造成品質問題，只提醒使用者，不強制阻擋。
- 如果某 operation 需要前置資料不存在，該 operation 應回傳明確錯誤並在 UI 顯示。

### Operation 介面

每個圖片處理 feature 必須透過 feature object 註冊 operation；外部不直接載入獨立 `*-operation.js`：

```js
const cropFeature = {
    id: 'crop',
    labelKey: 'toolCrop',
    pipelineStage: 'fixedBefore',
    pipelineOrder: 10,
    defaultSettings: function defaultSettings(context) {
        return {};
    },
    createLivePreviewBase: function createLivePreviewBase(context) {
        return null;
    },
    livePreviewFilter: function livePreviewFilter(context) {
        return '';
    },
    operation: {
        pipeline: { draggable: false },
        run: function run(imageData, settings, context) {
            return imageData;
        },
    },
};
```

`createLivePreviewBase()` 與 `livePreviewFilter()` 是可選契約，只能用於拖曳期間的輕量回饋。Feature 必須自行判斷 live preview 是否會誤導使用者；如果正式 pipeline 會因後續 `Palette`、`Dither` 或其他 effect 產生不同結果，應回傳 `null` 或空字串，讓 UI 放棄假的即時預覽。

### Crop Transform

Crop feature 的 transform settings 必須由 `crop-feature.js` 自己定義與 normalize，不能在 `page.js` 或 `controller.js` 寫死。MVP crop settings 至少包含：

```js
{
    aspectRatioId: '5-3',
    panX: 0,
    panY: 0,
    zoom: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
}
```

Preview renderer 與正式 crop operation 必須套用同一套 transform 規則：

1. 將輸出中心移到 crop frame 中心，並加上 `panX` / `panY`。
2. 套用 `rotation`。
3. 套用 signed scale：`flipX` 時 X scale 為 `-zoom`，否則為 `zoom`；`flipY` 時 Y scale 為 `-zoom`，否則為 `zoom`。
4. 從原圖中心繪製來源圖片。

`viewport-renderer.js` 的 transform cache key 必須包含 `flipX` 與 `flipY`，否則切換反轉狀態可能不會重繪。

Crop 面板的左轉 90 / 右轉 90 button 必須只更新 `rotation`，以目前 rotation 為基準加減 90 度，並將結果維持在 `-180..180` 範圍。

Crop 面板的 horizontal flip / vertical flip icon button 必須用同一次 settings update 完成狀態切換：

- `Flip Horizontal`：切換 `flipX`、將 `rotation` 取反、將 `panX` 取反。
- `Flip Vertical`：切換 `flipY`、將 `rotation` 取反、將 `panY` 取反。

這個規則讓反轉以目前畫面座標為準；若只切換 `flipX` / `flipY` 而不處理 rotation，已旋轉圖片會呈現和使用者預期不同的鏡射方向。

Flip icon button 可以用 `aria-pressed` 表示狀態，但視覺上必須和左轉 90 / 右轉 90 button 一樣，不套用持續 active color / background。

Pipeline 執行器只根據 fixed before、可拖曳 effects order 與 fixed after 逐步套用：

```js
function runPipeline(sourceImageData, state) {
    let currentImageData = sourceImageData;
    const order = [
        ...state.pipeline.fixedBefore,
        ...state.pipeline.effectsOrder,
        ...state.pipeline.fixedAfter,
    ];

    for (const operationId of order) {
        if (operationId === 'export') continue;
        if (!state.pipeline.enabled[operationId]) continue;
        const operation = operationRegistry.get(operationId);
        if (!operation) {
            throw new Error('Missing operation: ' + operationId);
        }
        currentImageData = operation.run(currentImageData, state.settings[operationId] || {}, state);
    }

    return currentImageData;
}
```

錯誤策略：

- operation 設定無效時，應在 `run()` 內 throw 明確錯誤並停止 pipeline。
- 不略過失敗 operation，避免輸出結果不可預期。
- preview 時由 controller catch error，更新 `state.status = 'error'` 與 `state.error`。
- export 時若 pipeline throw error，禁止輸出並要求使用者修正設定。

## 核心模組邊界

### app

負責主頁外殼，不處理圖片演算法。

包含：

- 初始化。
- header。
- 右上選單。
- 頁面切換。
- theme 切換。
- 提供 `page-host` 讓功能頁掛載。
- 提供共用 `appContext`，例如 theme、目前頁面、全域訊息。

`app` 不可直接操作功能頁內部 DOM，也不可保存某個頁面的 canvas reference。頁面切換時，只能呼叫 page module 的 `mount()` / `unmount()`。

`app-state.js` 只保存 app shell 層級狀態，不保存任何 page-specific state。
theme 屬於 app shell 層級狀態，必須由 `app-state.js` 正規化、套用到 `body[data-theme]`，並透過 `settings-store.js` 持久化到 localStorage。

職責：

```js
const appState = {
    currentPageId: 'dither-editor',
    theme: 'light',
    language: 'en',
    globalStatus: '',
    appMode: 'standalone',
    deviceStatus: 'unavailable',
};
```

允許：

- 目前頁面 id。
- theme。
- language。
- header/status message。
- app mode。
- coarse device status。

禁止：

- 保存圖片資料。
- 保存 editor state。
- 保存 canvas reference。
- 保存 pipeline settings。
- 保存 device token。

### pages

負責不同頁面的組合。

MVP 至少：

- `pages/dither-editor/entry.js`
- `pages/dither-editor/page.js`
- `pages/web-setting/entry.js`
- `pages/web-setting/page.js`

預留：

- `pages/help/entry.js`
- `pages/help/page.js`
- `pages/about/entry.js`
- `pages/about/page.js`

每個頁面資料夾都要自成一組，不把頁面專屬 controller、state、panel 散在外層。

### dither-editor page

負責 Dither Image Editor 這一頁的狀態與協調。

包含：

- `entry.js`。
- `page.js`。
- `state.js`。
- `actions.js`。
- `controller.js`。
- `features/*-feature.js`。
- `viewport/*`。
- pipeline 重新運算。

此頁面可以使用 `core` 與 `ui`，但 `core` 不可反向依賴此頁面。

### core

負責純資料處理，不讀 DOM。

包含：

- image loading。
- image exporting。
- canvas helper。
- dither algorithm。
- palette。
- operation pipeline。

`core` 可回傳 `ImageData`、`Blob`、plain object、array、number、string，但不可回傳或保存 DOM element、canvas element、page controller、UI component。

`core/canvas` 只能放通用 canvas helper，例如：

- 建立暫存 canvas。
- 從 image 取得 `ImageData`。
- 將 `ImageData` 轉成 `Blob`。
- 尺寸換算。

`core/canvas` 不可放全域 preview canvas，也不可保存單一 app-wide canvas instance。

### ui

負責可重用 UI 元件，不知道圖片處理細節。

包含：

- dropzone。
- slider。
- select。
- color swatch。
- sortable list。
- menu。
- tooltip。

`ui` 元件只能透過 options、callback、custom event 對外溝通。它們不可依賴 `pages/*`，也不可依賴 `pages/dither-editor/dither/*`。例如 `sortable-list.js` 只負責排序 UI，不知道排序的是 pipeline、menu item 或 preset list。

### Canvas Ownership

不要建立全域共用 canvas 讓所有頁面共用。每個需要 canvas 的頁面，都在自己的 page module 裡建立與銷毀 canvas。

正確：

```text
pages/dither-editor/viewport/viewport-renderer.js
  owns dither preview canvas rendering

pages/other-page/viewport/other-viewport-renderer.js
  owns its own canvas if needed

core/canvas/canvas-utils.js
  provides helper functions only
```

錯誤：

```text
app/app-shell.js
  owns one global canvas used by every page

core/canvas/canvas-utils.js
  stores shared previewCanvas variable

ui/canvas-view.js
  directly runs dither algorithm
```

頁面切換時，舊頁面的 canvas event listener、object URL、worker、timer 都必須在 `unmount()` 清掉。

## 圖片處理流程

完整流程：

```text
local file
  -> decode image
  -> normalize transparency with white background
  -> downscale if image exceeds input limit
  -> draw to hidden canvas
  -> source ImageData
  -> run fixed before operations
  -> run enabled effects by user-defined effects order
  -> preview ImageData
  -> render preview canvas
  -> export PNG Blob
```

Preview 和 Export 可以共用 pipeline，但執行設定要分開：

```text
preview: 使用完整 working image，可以 debounce，但不以降低解析度作為主要使用者可見結果
export: 使用完整輸出尺寸，永遠重新跑正式 pipeline
```

Preview 策略：

```js
const PREVIEW_DEBOUNCE_MS = 80;
const PREVIEW_SLOW_THRESHOLD_MS = 500;
```

規則：

- `crop` mode 不執行正式 preview pipeline；page 只用 `viewport-renderer.renderTransformed()` 顯示來源圖與 Crop transform。按 OK 或收合 Crop 進入 `edit` 後，才從 `sourceImageData` 跑正式 pipeline。
- 使用者調整 slider、select、color、effects order 時，不立即每次重算，先 debounce `PREVIEW_DEBOUNCE_MS`。
- 正式 preview 使用 working image 的完整尺寸，不使用降低解析度的 `ImageData` 當成使用者可見的最終預覽，避免拖曳中與放開後出現不可信的跳變。
- export 永遠從工作圖和完整 pipeline 重新計算，不使用暫存 preview 結果。
- slider 拖曳期間以手感優先，不在每個 `input` event 跑完整 pipeline；可用 `requestAnimationFrame` 更新輕量 live feedback。
- live feedback 只能在「拖曳中看到的結果」與「放開後正式 pipeline 結果」足夠一致時啟用；不一致時寧可不顯示假的即時效果。
- `Adjust` 的 live feedback 僅允許 brightness、contrast、saturation，且只在 `Adjust` 是唯一啟用的 draggable effect 時使用。若 `Palette`、`Dither` 或其他 effect 會參與結果，拖曳中不套假的後處理濾鏡，放開後再更新正式 preview。
- live feedback 應使用 feature 提供的 `createLivePreviewBase()` 與 `livePreviewFilter()`，由 page 只更新 canvas filter，不重跑整頁 render。
- WebGL/GPU 可用於 operation 內部加速，但若需要同步 `readPixels()` 回到 `ImageData`，不可作為拖曳中即時 preview 的主要路徑。
- 若 1600px 以內工作圖的正式 preview 經常超過 `PREVIEW_SLOW_THRESHOLD_MS`，第二階段優先導入 Web Worker 或真正的 WebGL preview canvas。
- UI 不硬性承諾每次 300ms 內完成，但必須避免使用者連續調整時主畫面長時間卡住。

### Image Input Format Gate

所有進入演算法 pipeline 的使用者圖片都必須先被解碼成 origin-clean RGBA `ImageData`。MVP 只支援：

- `image/png`
- `image/jpeg`
- `image/webp`

檔案選擇器必須使用：

```html
accept="image/png,image/jpeg,image/webp"
```

拖放不能只依賴 `<input accept>`；`loadImageFromFile()` 必須再次檢查 `file.type` 與副檔名，只允許 `.png`、`.jpg`、`.jpeg`、`.webp`。不支援格式必須在 `drawImage()` / `getImageData()` 前被拒絕。

禁止讓 `SVG`、遠端圖片 URL 或可引用外部資源的圖片進入 canvas 後再呼叫 `getImageData()`，因為它們可能造成 canvas taint。若 `getImageData()` 仍遇到 `SecurityError`，必須轉成使用者可理解的錯誤訊息，不能讓瀏覽器原始例外直接漏到 UI。

內建 demo 應保留來源圖片於 `assets/demo/*`，並提供由該圖片產生的 JS data asset，例如 `assets/demo/demo-16x9-data.js`。Standalone `file://` 模式必須優先從 JS data asset 載入 demo，再轉成 `Blob -> createImageBitmap -> ImageData`；不可在 `file://` 下直接把相對路徑圖片畫進 canvas 後呼叫 `getImageData()`，否則瀏覽器可能因 origin 規則造成 canvas taint。

## 圖片尺寸與效能策略

MVP 建議最大輸入尺寸：

```js
const MAX_INPUT_LONG_EDGE = 1600;
```

規則：

- 使用者丟入圖片後，先檢查寬高。
- 如果圖片長邊超過 `MAX_INPUT_LONG_EDGE`，依比例縮小到長邊 1600px。
- 編輯器後續使用縮小後的圖片作為工作圖。
- UI 需提示使用者圖片已被縮小，顯示原始尺寸與工作尺寸。
- MVP 不要求 Web Worker；大型圖片先靠輸入縮小策略控制效能。
- Web Worker 可留到第二階段，當 error diffusion、palette color mapping 或正式 preview 更新開始造成 UI 卡頓時再加入。
- GPU/WebGL 可用於 brightness、contrast、saturation 這類可平行化 operation；error diffusion 類演算法因相鄰像素依賴，不列為第一優先 GPU 化目標。

這個限制能讓純 JS、無 build step、可雙擊執行的版本維持可接受速度，也避免使用者丟入手機高解析照片後讓瀏覽器長時間無回應。

## Dither 規格

MVP 支援：

- Error Diffusion。
- Ordered Dither。
- Pattern Dither。

Error Diffusion algorithms：

- Floyd-Steinberg。
- Atkinson。
- Jarvis-Judice-Ninke。
- Stucki。

Dither function 不可讀 DOM，不可硬編碼寬高：

```js
function applyDither(imageData, options) {
    const width = imageData.width;
    const height = imageData.height;
    const pixels = new Uint8ClampedArray(imageData.data);

    // process pixels

    return new ImageData(pixels, width, height);
}
```

設定範例：

```js
const ditherSettings = {
    mode: 'error-diffusion',
    algorithm: 'floyd-steinberg',
    serpentine: false,
    palette: [
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 255, b: 255 },
    ],
};
```

## 透明背景策略

MVP 不處理透明輸出的完整問題。所有透明背景先以白色合成。

固定常數：

```js
const DEFAULT_TRANSPARENT_BACKGROUND = {
    r: 255,
    g: 255,
    b: 255,
    a: 255,
};
```

規則：

- 圖片 decode 後，若像素 alpha 小於 255，先與 `DEFAULT_TRANSPARENT_BACKGROUND` 合成。
- pipeline 後續處理不需要保留透明度。
- PNG export 輸出不保留透明背景。
- 未來若要支援透明輸出，必須新增明確設定，不在 MVP 隱含處理。

## 儲存策略

使用者設定與圖片工作區都要保存。

這一節處理「重新整理頁面或關閉瀏覽器後仍要還原」的持久化；Menu 切頁後回到 Dither Editor 的短期保留，應由 Dither Editor page module 的 in-memory state cache 處理，不應依賴每次切頁都讀寫 IndexedDB。

儲存方式：

- `localStorage`：保存 Web Setting、theme、language、defaultPipeline 這類輕量設定，讓下次重新打開瀏覽器頁面時仍遵照設定。
- `IndexedDB`：保存圖片工作區與較大的資料。
- `cookie`：現階段不使用。未來若加入後端登入、session 或伺服器需要讀取的狀態，再另行導入。

現階段決策：
- Web Setting 與 app shell preference 只使用 `localStorage`，不使用 cookie。
- 圖片、workspace、canvas 相關大型資料只使用 `IndexedDB`，不塞進 `localStorage`。
- cookie 不作為設定 fallback，避免同一份設定有兩個來源造成維護混亂。
- 未來加入後端登入時，cookie 只處理登入/session/server-readable state，不接管目前的 local app settings。

### localStorage schema

```js
const SETTINGS_STORAGE_KEY = 'dither-app:settings:v1';

const settingsValue = {
    schemaVersion: 1,
    language: 'en',
    theme: 'light',
    lastDocumentId: 'current',
    lastDemoPreset: null,
    defaultPipeline: {
        effectsOrder: ['adjust', 'palette', 'dither'],
        enabled: {},
    },
    defaultSettings: {},
};
```

### IndexedDB schema

```js
const DB_NAME = 'DitherAppDB';
const DB_VERSION = 1;

const DOCUMENT_STORE = 'documents';
```

Object store:

```text
documents
  keyPath: id
```

Current document key:

```js
const CURRENT_DOCUMENT_ID = 'current';
```

Document value:

```js
const documentValue = {
    id: 'current',
    schemaVersion: 1,
    name: 'Untitled',
    createdAt: 0,
    updatedAt: 0,
    sourceBlob: null,
    sourceMimeType: 'image/png',
    originalSize: {
        width: 0,
        height: 0,
    },
    workingSize: {
        width: 800,
        height: 480,
    },
    pipeline: {
        fixedBefore: ['crop', 'resize'],
        effectsOrder: ['adjust', 'palette', 'dither'],
        fixedAfter: ['export'],
        enabled: {},
    },
    settings: {},
};
```

儲存規則：

- 使用者圖片以 `Blob` 保存，不保存 base64。
- 不保存 preview `ImageData`。
- 不保存每一步 operation 的中間結果。
- `sourceBlob` 保存縮小後的工作圖來源，不保存原始超大圖。
- document load 時必須檢查 `schemaVersion`。
- IndexedDB 開啟失敗或 quota exceeded 時，功能仍可繼續編輯，但要提示使用者目前無法保存工作區。

需要保存：

- pipeline effects order。
- operation enabled 狀態。
- crop / resize / adjust / palette / dither / export settings；crop settings 需包含 `flipX` / `flipY`，讓頁面切換、重新整理或工作區載入後能維持翻轉狀態。
- 最近使用的 demo preset。
- 使用者目前的工作圖片。
- 最近一次輸出相關設定。

不需要保存：

- undo / redo history，MVP 可不保存。
- 每次 preview 的中間結果。

New Image 規則：

- 編輯區提供 `New Image`。
- `New Image` 必須觸發隱藏的 file input，讓使用者選擇本機圖片。
- `Image Input` panel 不可顯示獨立的 `Choose Image` row 或 panel drop zone。
- 成功選擇圖片後，必須走與一般 upload 相同的 `controller.loadFile()` 流程，重建 default editor state 並進入 `crop`。
- 目前版本不在 UI 暴露空白 canvas 建立入口。

## 離線資源策略

所有 runtime 資源都必須存在專案內。

```text
assets/
  demo/      # built-in demo image assets
  icons/     # optional until custom icons are added
  styles/
```

禁止：

- 遠端 demo image URL。
- CDN script。
- CDN CSS。
- Google Fonts。
- runtime fetch 第三方 API。

允許：

- 讀取本機使用者上傳圖片。
- 讀取專案內 `assets/demo/*`。
- 使用瀏覽器內建字型。
