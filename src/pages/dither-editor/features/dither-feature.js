(function (app) {
    // Dither feature 只負責選擇演算法並把目前 palette 傳給對應處理器。
    // palette 的建立與同步在 palette-feature.js；這裡不重複管理色票狀態。
    var ui = app.pages.ditherEditor.panelUtils;

    app.pages.ditherEditor.featureRegistry.register({
        id: 'dither',
        icon: '..',
        labelKey: 'panelDither',
        panelGroup: 'edit',
        pipelineStage: 'effectsOrder',
        pipelineOrder: 30,
        // 預設不套用 dithering；palette 由 palette feature 同步。
        defaultSettings: function defaultSettings(context) {
            return {
                algorithm: 'none',
                serpentine: true,
                palette: null
            };
        },
        // 建立演算法選擇與 serpentine 開關。
        buildPanel: function buildPanel(context) {
            var state = context.state;
            var controller = context.controller;
            var options = [{ value: 'none', label: ui.t('optionNone') }].concat(
                app.pages.ditherEditor.config.ditherAlgorithms.map(function (algorithm) {
                    return { value: algorithm.id, label: ui.t(algorithm.labelKey) };
                })
            );
            return ui.section('panelDither', [
                ui.row('Algorithm', ui.selectInput(state.settings.dither.algorithm, options, function (value) {
                    controller.updateSetting('dither', 'algorithm', value);
                })),
                ui.row('Serpentine', ui.checkboxInput(state.settings.dither.serpentine, function (value) {
                    controller.updateSetting('dither', 'serpentine', value);
                }))
            ], 'dither');
        },
        operation: {
            pipeline: {
                draggable: true
            },
            // 依演算法設定分派到 ordered、pattern 或 error diffusion processor。
            run: function run(imageData, settings) {
                // none 是預設值，代表 pipeline 保留此工具但不套用任何 dithering。
                if (settings.algorithm === 'none') {
                    return imageData;
                }
                var config = app.pages.ditherEditor.config;
                var algorithm = config.ditherAlgorithms.find(function (entry) {
                    return entry.id === settings.algorithm;
                }) || config.ditherAlgorithms[0];
                var options = {
                    matrixId: algorithm.matrixId,
                    palette: settings.palette || config.palettePresets[0].colors,
                    serpentine: Boolean(settings.serpentine)
                };
                if (algorithm.mode === 'ordered') {
                    return app.pages.ditherEditor.orderedDither.apply(imageData, options);
                }
                if (algorithm.mode === 'pattern') {
                    return app.pages.ditherEditor.patternDither.apply(imageData, options);
                }
                return app.pages.ditherEditor.errorDiffusion.apply(imageData, options);
            }
        }
    });
})(window.DitherApp);
