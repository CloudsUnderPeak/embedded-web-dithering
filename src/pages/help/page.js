(function (app) {
    // Help 是簡單靜態頁面；日後若擴充互動說明，仍只需修改此頁模組。
    app.pages.helpPage = {
        id: 'help',
        title: 'Help',
        // 將 Help 內容掛進 page-host。
        mount: function mount(container) {
            container.appendChild(
                app.utils.dom.el('section', {
                    className: 'simple-page',
                    children: [
                        app.utils.dom.el('h1', { text: app.i18n.en.helpTitle }),
                        app.utils.dom.el('p', { text: app.i18n.en.placeholderHelp })
                    ]
                })
            );
        },
        // 靜態頁目前沒有 listener 或 timer 需要清理。
        unmount: function unmount() {}
    };
})(window.DitherApp);
