(function (app) {
    // Dither algorithm config 只註冊演算法 metadata；執行邏輯由 processor registry 提供。
    app.pages.ditherEditor = app.pages.ditherEditor || {};
    app.pages.ditherEditor.config = app.pages.ditherEditor.config || {};
    var registry = app.pages.ditherEditor.ditherAlgorithmRegistry;

    registry.register({
        id: 'floyd-steinberg',
        labelKey: 'algorithmFloydSteinberg',
        processorId: 'error-diffusion',
        matrixId: 'floydSteinberg',
        supportsSerpentine: true,
        supportsErrorStrength: true
    });
    registry.register({
        id: 'atkinson',
        labelKey: 'algorithmAtkinson',
        processorId: 'error-diffusion',
        matrixId: 'atkinson',
        supportsErrorStrength: true
    });
    registry.register({
        id: 'jarvis',
        labelKey: 'algorithmJarvis',
        processorId: 'error-diffusion',
        matrixId: 'jarvis',
        supportsSerpentine: true,
        supportsErrorStrength: true
    });
    registry.register({
        id: 'stucki',
        labelKey: 'algorithmStucki',
        processorId: 'error-diffusion',
        matrixId: 'stucki',
        supportsSerpentine: true,
        supportsErrorStrength: true
    });
    registry.register({
        id: 'bayer-4',
        labelKey: 'algorithmBayer4',
        processorId: 'ordered',
        matrixId: 'bayer4'
    });
    registry.register({
        id: 'pattern-dots',
        labelKey: 'algorithmPatternDots',
        processorId: 'pattern',
        matrixId: 'dots'
    });

    Object.defineProperty(app.pages.ditherEditor.config, 'ditherAlgorithms', {
        configurable: true,
        get: function getDitherAlgorithms() {
            return registry.list();
        }
    });
})(window.DitherApp);
