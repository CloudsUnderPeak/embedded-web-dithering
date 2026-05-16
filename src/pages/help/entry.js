(function (app) {
    // Help 頁入口只暴露 pageRegistry 註冊結果，不讓 index.html 知道內部頁面檔名。
    app.app.registerPageEntry(
        app.app.scriptLoader.loadMany(['src/pages/help/page.js']).then(function () {
            app.app.pageRegistry.register(app.pages.helpPage);
        })
    );
})(window.DitherApp);
