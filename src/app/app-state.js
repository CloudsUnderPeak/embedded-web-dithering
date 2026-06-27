(function (app) {
    // App shell 層級狀態。
    // 只保存全域 UI 偏好，不保存 Dither Editor 的圖片、canvas 或 pipeline。
    // 將外部傳入或儲存的 theme 正規化，避免未知值污染 DOM data-theme。
    function normalizeTheme(theme) {
        return theme === 'dark' ? 'dark' : 'light';
    }

    // 持久化 theme 偏好；失敗時不阻斷 UI，因為主功能仍可使用。
    function saveTheme(theme) {
        app.core.settingsStore.save({ theme: theme });
    }

    // 套用 theme 到 state 與 body attribute，必要時同步寫入 localStorage。
    function applyTheme(theme, options) {
        var nextTheme = normalizeTheme(theme);
        app.app.state.theme = nextTheme;
        document.body.setAttribute('data-theme', nextTheme);
        if (!options || options.save !== false) {
            saveTheme(nextTheme);
        }
    }

    var storedSettings = app.core.settingsStore.load() || {};

    app.app.state = {
        activePageId: null,
        theme: normalizeTheme(storedSettings.theme)
    };

    app.app.setTheme = applyTheme;
    app.app.themeOptions = [
        { id: 'light', labelKey: 'themeLight' },
        { id: 'dark', labelKey: 'themeDark' }
    ];

    applyTheme(app.app.state.theme, { save: false });
})(window.DitherApp);
