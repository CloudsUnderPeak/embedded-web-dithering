(function (app) {
    // 所有 storage key 集中在這裡，避免 localStorage / IndexedDB key 散落各處。
    app.core.storageKeys = {
        settings: 'dither-app:settings:v1',
        dbName: 'DitherAppDB',
        dbVersion: 1,
        documentStore: 'documents',
        currentDocumentId: 'current',
        schemaVersion: 1
    };
})(window.DitherApp);
