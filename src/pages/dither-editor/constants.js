(function (app) {
    // Dither Editor 共用常數集中在這裡，避免 controller、loader、state 各自硬寫數值。
    app.pages.ditherEditor = app.pages.ditherEditor || {};
    app.pages.ditherEditor.constants = {
        MAX_INPUT_LONG_EDGE: 1600,
        MAX_RESIZE_OUTPUT_SIZE: 4096,
        PREVIEW_DEBOUNCE_MS: 80,
        DEFAULT_NEW_IMAGE_SIZE: {
            width: 800,
            height: 480
        }
    };
})(window.DitherApp);
