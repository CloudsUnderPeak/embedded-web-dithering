(function (app) {
    // 純前端 hash router：同步 Menu 切頁、初始 URL、瀏覽器上一頁/下一頁。
    // Router 只處理 page id，不保存任何 Dither editor 的圖片或 pipeline state。
    // PageRouter 持有頁面容器與 app context，負責 mount/unmount 目前頁。
    function PageRouter(host, context) {
        this.host = host;
        this.context = context;
        this.currentPage = null;
        this.defaultPageId = 'dither-editor';
        this.onPopState = this.handlePopState.bind(this);
    }

    function pageTitle(page) {
        return page.titleKey ? app.i18n.t(page.titleKey) : page.title;
    }

    // 啟動時監聽瀏覽器返回/前進，並從 URL hash 還原頁面。
    PageRouter.prototype.start = function start(defaultPageId) {
        this.defaultPageId = defaultPageId || this.defaultPageId;
        window.addEventListener('popstate', this.onPopState);
        this.navigate(this.pageIdFromLocation(), { replace: true });
    };

    // 切換頁面：先 unmount 舊頁，再 mount 新頁，最後同步 history。
    PageRouter.prototype.navigate = function navigate(pageId, options) {
        options = options || {};
        var page = app.app.pageRegistry.get(pageId);
        if (!page) {
            throw new Error('Unknown page: ' + pageId);
        }
        if (this.currentPage && this.currentPage.id === page.id) {
            if (!options.fromHistory) {
                this.writeHistory(page.id, options.replace);
            }
            return;
        }
        if (this.currentPage && this.currentPage.unmount) {
            this.currentPage.unmount();
        }
        // page-host 每次切頁都清空；需要保留業務狀態的頁面必須自己在 unmount cache。
        app.utils.dom.clear(this.host);
        this.currentPage = page;
        app.app.state.activePageId = page.id;
        this.context.setTitle(pageTitle(page));
        page.mount(this.host, this.context);
        if (!options.fromHistory) {
            this.writeHistory(page.id, options.replace);
        }
    };

    // 瀏覽器返回/前進時不新增 history，只依當前 URL 切頁。
    PageRouter.prototype.handlePopState = function handlePopState(event) {
        var pageId = event.state && event.state.pageId ? event.state.pageId : this.pageIdFromLocation();
        if (!app.app.pageRegistry.get(pageId)) {
            pageId = this.defaultPageId;
        }
        this.navigate(pageId, { fromHistory: true });
    };

    // 從 URL hash 讀取 page id；無 hash 時由 start 傳入 default。
    PageRouter.prototype.pageIdFromLocation = function pageIdFromLocation() {
        var pageId = window.location.hash.replace(/^#\/?/, '') || this.defaultPageId;
        if (!app.app.pageRegistry.get(pageId)) {
            return this.defaultPageId;
        }
        return pageId;
    };

    // 將 SPA 頁面狀態寫入 history，讓瀏覽器返回可回到前一頁。
    PageRouter.prototype.writeHistory = function writeHistory(pageId, replace) {
        var hash = '#/' + pageId;
        if (window.location.hash === hash && !replace) {
            return;
        }
        var state = { pageId: pageId };
        if (replace) {
            window.history.replaceState(state, '', hash);
            return;
        }
        window.history.pushState(state, '', hash);
    };

    PageRouter.prototype.refreshCurrentPage = function refreshCurrentPage() {
        if (!this.currentPage) {
            return;
        }
        var page = this.currentPage;
        if (page.unmount) {
            page.unmount();
        }
        app.utils.dom.clear(this.host);
        this.context.setTitle(pageTitle(page));
        page.mount(this.host, this.context);
    };

    app.app.PageRouter = PageRouter;
})(window.DitherApp);
