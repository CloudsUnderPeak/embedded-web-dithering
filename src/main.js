(function (app) {
    // App 啟動點：等待所有 page entry 完成註冊後，再交給 app shell mount。
    // 這裡不載入任何頁面內部邏輯，避免 main.js 成為第二份頁面 manifest。
    // 啟動整個 SPA：等待所有頁面 entry 完成註冊後，再建立 AppShell。
    function start() {
        app.app
            .whenPageEntriesReady()
            .then(function () {
                var shell = new app.app.AppShell();
                shell.start();
            })
            .catch(function (error) {
                var status = document.getElementById('app-status');
                if (status) {
                    status.textContent = error.message;
                }
                throw error;
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})(window.DitherApp);
