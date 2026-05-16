(function (app) {
    // AppShell 擁有 header、status、menu 與 page-host。
    // 它只呼叫 page module 的 mount/unmount，不碰任何頁面內部實作。
    // 將 app state 的狀態物件轉成 header 右側的狀態圓點。
    function renderStatus(node, status) {
        var label = status || app.i18n.en.statusReady;
        var state = statusState(label);
        node.className = 'app-status is-' + state;
        node.textContent = '';
        node.title = label;
        node.setAttribute('aria-label', label);
    }

    // 把錯誤/忙碌/就緒等狀態壓成 CSS class 需要的單一狀態名稱。
    function statusState(status) {
        var value = String(status || '').toLowerCase();
        if (value.indexOf('error') !== -1) {
            return 'error';
        }
        if (
            value.indexOf('processing') !== -1 ||
            value.indexOf('loading') !== -1 ||
            value.indexOf('exporting') !== -1 ||
            value.indexOf('uploading') !== -1
        ) {
            return 'busy';
        }
        if (value.indexOf('empty') !== -1 || value.indexOf('begin') !== -1) {
            return 'idle';
        }
        return 'ready';
    }

    // AppShell 持有 header、page-host、router、menu 的 DOM 參照。
    function AppShell() {
        this.host = document.getElementById('page-host');
        this.titleNode = document.querySelector('.app-title');
        this.statusNode = document.getElementById('app-status');
        this.menuButton = document.getElementById('app-menu-button');
        this.router = new app.app.PageRouter(this.host, {
            statusNode: this.statusNode,
            setTitle: this.setTitle.bind(this),
            setStatus: this.setStatus.bind(this)
        });
        this.menu = new app.app.AppMenu(this.menuButton, this.router.navigate.bind(this.router));
    }

    // 頁面切換時更新中央標題。
    AppShell.prototype.setTitle = function setTitle(title) {
        this.titleNode.textContent = title || app.i18n.en.appTitle;
    };

    // 讓頁面或 controller 可以更新全站狀態顯示。
    AppShell.prototype.setStatus = function setStatus(status) {
        renderStatus(this.statusNode, status);
    };

    // 建立選單與 router，並啟動預設頁面。
    AppShell.prototype.start = function start() {
        this.router.start('dither-editor');
    };

    app.app.AppShell = AppShell;
    app.app.renderStatus = renderStatus;
})(window.DitherApp);
