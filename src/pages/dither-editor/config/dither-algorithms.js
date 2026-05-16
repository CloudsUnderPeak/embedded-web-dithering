(function (app) {
    // Dither algorithm config 將 UI 選項對應到實作模式與 matrix。
    // 新增演算法時優先在這裡掛 metadata，再由 dither-feature 分派到對應 processor。
    app.pages.ditherEditor = app.pages.ditherEditor || {};
    app.pages.ditherEditor.config = app.pages.ditherEditor.config || {};
    app.pages.ditherEditor.config.ditherAlgorithms = [
        {
            id: 'floyd-steinberg',
            labelKey: 'algorithmFloydSteinberg',
            mode: 'error-diffusion',
            matrixId: 'floydSteinberg'
        },
        {
            id: 'atkinson',
            labelKey: 'algorithmAtkinson',
            mode: 'error-diffusion',
            matrixId: 'atkinson'
        },
        {
            id: 'jarvis',
            labelKey: 'algorithmJarvis',
            mode: 'error-diffusion',
            matrixId: 'jarvis'
        },
        {
            id: 'stucki',
            labelKey: 'algorithmStucki',
            mode: 'error-diffusion',
            matrixId: 'stucki'
        },
        {
            id: 'bayer-4',
            labelKey: 'algorithmBayer4',
            mode: 'ordered',
            matrixId: 'bayer4'
        },
        {
            id: 'pattern-dots',
            labelKey: 'algorithmPatternDots',
            mode: 'pattern',
            matrixId: 'dots'
        }
    ];
})(window.DitherApp);
