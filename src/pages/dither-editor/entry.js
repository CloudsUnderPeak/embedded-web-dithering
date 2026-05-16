(function (app) {
    // Dither Editor page entry 統一管理本頁需要的 script 載入順序。
    // index.html 只載入這個入口，避免把頁面內部檔案全部攤平在 HTML。
    app.pages.ditherEditor = app.pages.ditherEditor || {};

    app.app.registerPageEntry(
        app.app.scriptLoader
            .loadMany([
                'src/pages/dither-editor/config/app-mode.js',
                'src/pages/dither-editor/config/palette-presets.js',
                'src/pages/dither-editor/config/dither-algorithms.js',
                'src/pages/dither-editor/config/pipeline-presets.js',
                'src/pages/dither-editor/config/display-profiles.js',
                'src/pages/dither-editor/dither/dither-matrices.js',
                'src/pages/dither-editor/dither/error-diffusion.js',
                'src/pages/dither-editor/dither/ordered-dither.js',
                'src/pages/dither-editor/dither/pattern-dither.js',
                'src/pages/dither-editor/gpu/adjust-processor.js',
                'src/pages/dither-editor/operations/operation-registry.js',
                'src/pages/dither-editor/feature-manifest.js',
                'src/pages/dither-editor/feature-registry.js',
                'src/pages/dither-editor/panel-utils.js'
            ])
            .then(function () {
                // Feature scripts 由 manifest/registry 決定，維持 plug-and-play 的載入邊界。
                return app.app.scriptLoader.loadMany(app.pages.ditherEditor.featureRegistry.featureScripts());
            })
            .then(function () {
                app.pages.ditherEditor.featureRegistry.assertRegistered();
            })
            .then(function () {
                return app.app.scriptLoader.loadMany([
                    'src/pages/dither-editor/operations/pipeline-runner.js',
                    'src/pages/dither-editor/constants.js',
                    'src/pages/dither-editor/editor-mode-state-machine.js',
                    'src/pages/dither-editor/state.js',
                    'src/pages/dither-editor/viewport/viewport-renderer.js',
                    'src/pages/dither-editor/controller.js',
                    'src/pages/dither-editor/page.js'
                ]);
            })
            .then(function () {
                app.app.pageRegistry.register(app.pages.ditherEditorPage);
            })
    );
})(window.DitherApp);
