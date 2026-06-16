(function (app) {
    // Export feature 是 action，不是可拖曳的 pipeline tool。
    // 它使用目前 preview/result ImageData 直接輸出 PNG，不在面板中折疊。
    var ui = app.pages.ditherEditor.panelUtils;

    app.pages.ditherEditor.featureRegistry.register({
        id: 'export',
        labelKey: 'actionExport',
        pipelineStage: 'fixedAfter',
        pipelineOrder: 10,
        actionOrder: 10,
        dock: false,
        panelGroup: 'none',
        // 目前固定 PNG；保留 settings 結構方便未來新增格式。
        defaultSettings: function defaultSettings() {
            return { format: 'png' };
        },
        // 建立外露的 Export PNG 按鈕，不放進可折疊 Tool Row。
        buildAction: function buildAction(context) {
            var exportButton = app.utils.dom.el('button', {
                className: 'primary-button export-button button-with-icon',
                attrs: { type: 'button' },
                children: [
                    ui.svgIcon('assets/icons/editor/export-download.svg'),
                    app.utils.dom.el('span', { text: ui.t('actionExport') })
                ]
            });
            exportButton.addEventListener('click', function () {
                context.controller.exportPng();
            });
            return app.utils.dom.el('div', {
                className: 'export-action',
                children: [exportButton]
            });
        }
    });
})(window.DitherApp);
