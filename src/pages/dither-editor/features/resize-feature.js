(function (app) {
    // Resize feature 是固定前置處理，會在 effects pipeline 前調整工作尺寸。
    // 目前只支援 stretch，之後若新增 contain/cover 應從此 feature 內擴充。
    var ui = app.pages.ditherEditor.panelUtils;

    app.pages.ditherEditor.featureRegistry.register({
        id: 'resize',
        icon: '<>',
        labelKey: 'panelResize',
        pipelineStage: 'fixedBefore',
        pipelineOrder: 20,
        // 預設輸出尺寸跟 display profile 一致。
        defaultSettings: function defaultSettings(context) {
            return { width: context.display.width, height: context.display.height, fitMode: 'stretch' };
        },
        // 新圖片載入後，resize 預設跟工作尺寸同步。
        onImageLoaded: function onImageLoaded(context) {
            context.state.settings.resize.width = context.result.workingSize.width;
            context.state.settings.resize.height = context.result.workingSize.height;
        },
        // 建立 resize 寬高控制；fitMode 目前保留為 stretch。
        buildPanel: function buildPanel(context) {
            var state = context.state;
            var controller = context.controller;
            return ui.section('panelResize', [
                ui.row('Width', ui.numberInput(state.settings.resize.width, 1, 9999, 1, function (value) {
                    controller.updateSetting('resize', 'width', value);
                })),
                ui.row('Height', ui.numberInput(state.settings.resize.height, 1, 9999, 1, function (value) {
                    controller.updateSetting('resize', 'height', value);
                })),
                ui.row(
                    'Fit',
                    ui.selectInput(state.settings.resize.fitMode, [{ value: 'stretch', label: 'Stretch' }], function (
                        value
                    ) {
                        controller.updateSetting('resize', 'fitMode', value);
                    })
                )
            ], 'resize');
        },
        operation: {
            // Resize operation 在尺寸不同時才重採樣。
            run: function run(imageData, settings) {
                // 尺寸沒有變更時直接回傳原 ImageData，避免多一次 canvas resize。
                var width = Math.max(1, Math.round(settings.width || imageData.width));
                var height = Math.max(1, Math.round(settings.height || imageData.height));
                if (width === imageData.width && height === imageData.height) {
                    return imageData;
                }
                return app.core.canvasUtils.resizeImageData(imageData, width, height);
            }
        }
    });
})(window.DitherApp);
