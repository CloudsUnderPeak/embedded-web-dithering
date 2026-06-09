(function (app) {
    // Image Input feature 是所有影像來源的入口：本機檔案、拖放與 demo。
    // 圖片格式與跨來源安全檢查集中在 core.imageLoader，避免 UI 分散重複邏輯。
    // Image Input feature：負責重新選圖與 demo 入口；Empty 畫布 dropzone 由 page.js 擁有。
    // 真正的解碼與格式驗證在 core.imageLoader，避免 UI 繞過規則。
    var ui = app.pages.ditherEditor.panelUtils;

    app.pages.ditherEditor.featureRegistry.register({
        id: 'input',
        icon: '+',
        labelKey: 'panelImageInput',
        dockOrder: 10,
        panelGroup: 'source',
        // 建立圖片輸入面板，所有輸入來源最後都交給 controller。
        buildPanel: function buildPanel(context) {
            var controller = context.controller;
            var file = app.utils.dom.el('input', {
                className: 'image-input-file',
                attrs: {
                    type: 'file',
                    accept: app.core.imageLoader.acceptedImageTypes,
                    id: 'image-file-input',
                    tabindex: '-1'
                }
            });
            file.addEventListener('change', function () {
                var selected = file.files[0];
                file.value = '';
                if (selected) {
                    controller.loadFile(selected);
                }
            });

            var newButton = app.utils.dom.el('button', {
                className: 'secondary-button',
                text: ui.t('actionNewImage'),
                attrs: { type: 'button' }
            });
            newButton.addEventListener('click', function () {
                file.click();
            });

            var demoButton = app.utils.dom.el('button', {
                className: 'secondary-button',
                text: ui.t('actionLoadDemo'),
                attrs: { type: 'button' }
            });
            demoButton.addEventListener('click', function () {
                controller.loadDemo();
            });

            return ui.section('panelImageInput', [
                file,
                app.utils.dom.el('div', {
                    className: 'button-row image-input-actions',
                    children: [newButton, demoButton]
                })
            ], 'input');
        }
    });
})(window.DitherApp);
