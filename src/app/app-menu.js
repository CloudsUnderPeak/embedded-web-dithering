(function (app) {
    // 右上角 Menu 的 DOM 與互動。
    // Menu 只回報使用者選擇的 page id，實際切頁由 router / shell 處理。
    // AppMenu 接收觸發按鈕與頁面切換 callback，自己建立下拉選單 DOM。
    function AppMenu(button, onSelect) {
        this.button = button;
        this.onSelect = onSelect;
        this.node = app.utils.dom.el('div', {
            className: 'app-menu',
            attrs: { hidden: 'hidden' }
        });
        document.body.appendChild(this.node);
        this.render();
        this.bind();
    }

    // 依目前 pageRegistry 內容重新渲染選單項目。
    AppMenu.prototype.render = function render() {
        var self = this;
        app.utils.dom.clear(this.node);
        [
            { id: 'dither-editor', label: app.i18n.en.menuDitherEditor },
            { id: 'web-setting', label: app.i18n.en.menuWebSetting },
            { id: 'help', label: app.i18n.en.menuHelp },
            { id: 'about', label: app.i18n.en.menuAbout }
        ].forEach(function (item) {
            var button = app.utils.dom.el('button', { text: item.label, attrs: { type: 'button' } });
            button.addEventListener('click', function () {
                self.hide();
                self.onSelect(item.id);
            });
            self.node.appendChild(button);
        });
    };

    // 綁定按鈕開關與外部點擊關閉，避免選單停留在畫面上。
    AppMenu.prototype.bind = function bind() {
        var self = this;
        this.button.addEventListener('click', function () {
            self.toggle();
        });
        document.addEventListener('click', function (event) {
            if (event.target === self.button || self.node.contains(event.target)) {
                return;
            }
            self.hide();
        });
    };

    // 切換選單顯示狀態；render 會在每次打開前更新選項。
    AppMenu.prototype.toggle = function toggle() {
        if (this.node.hidden) {
            this.node.hidden = false;
        } else {
            this.hide();
        }
    };

    // 關閉選單並同步 aria-expanded。
    AppMenu.prototype.hide = function hide() {
        this.node.hidden = true;
    };

    app.app.AppMenu = AppMenu;
})(window.DitherApp);
