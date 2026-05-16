(function (app) {
    // Image Input feature 是所有影像來源的入口：本機檔案、拖放、demo、新空白圖。
    // 圖片格式與跨來源安全檢查集中在 core.imageLoader，避免 UI 分散重複邏輯。
    // Image Input feature：唯一負責 upload/drop/demo/new image 入口的 tool。
    // 真正的解碼與格式驗證在 core.imageLoader，避免 UI 繞過規則。
    var ui = app.pages.ditherEditor.panelUtils;

    app.pages.ditherEditor.featureRegistry.register({
        id: 'input',
        icon: '+',
        labelKey: 'panelImageInput',
        dockOrder: 10,
        // 建立圖片輸入面板，所有輸入來源最後都交給 controller。
        buildPanel: function buildPanel(context) {
            var controller = context.controller;
            var file = app.utils.dom.el('input', {
                attrs: { type: 'file', accept: app.core.imageLoader.acceptedImageTypes, id: 'image-file-input' }
            });
            file.addEventListener('change', function () {
                if (file.files[0]) {
                    controller.loadFile(file.files[0]);
                }
            });

            var dropzone = app.utils.dom.el('div', {
                className: 'dropzone',
                text: ui.t('dropImage')
            });
            dropzone.addEventListener('dragover', function (event) {
                event.preventDefault();
                dropzone.classList.add('is-over');
            });
            dropzone.addEventListener('dragleave', function () {
                dropzone.classList.remove('is-over');
            });
            dropzone.addEventListener('drop', function (event) {
                event.preventDefault();
                dropzone.classList.remove('is-over');
                var dropped = event.dataTransfer.files[0];
                if (dropped) {
                    // 拖放不會套用 <input accept>，所以仍交給 controller/loadImageFromFile 做二次檢查。
                    controller.loadFile(dropped);
                }
            });

            var newButton = app.utils.dom.el('button', {
                className: 'secondary-button',
                text: ui.t('actionNewImage'),
                attrs: { type: 'button' }
            });
            newButton.addEventListener('click', function () {
                controller.newImage();
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
                ui.row(ui.t('actionChooseFile'), file),
                dropzone,
                app.utils.dom.el('div', {
                    className: 'button-row',
                    children: [newButton, demoButton]
                })
            ], 'input');
        }
    });
})(window.DitherApp);
