(function (app) {
    // IndexedDB 儲存目前工作區 metadata / settings。
    // 目前不保存 preview ImageData；preview 可由 source + pipeline 重新計算。
    // 開啟 IndexedDB，第一次使用時建立 workspace store。
    function openDb() {
        var keys = app.core.storageKeys;
        return new Promise(function (resolve, reject) {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB is not available.'));
                return;
            }
            var request = indexedDB.open(keys.dbName, keys.dbVersion);
            request.onupgradeneeded = function () {
                var db = request.result;
                // 所有 document 都放在同一個 object store，current document 用固定 key。
                if (!db.objectStoreNames.contains(keys.documentStore)) {
                    db.createObjectStore(keys.documentStore, { keyPath: 'id' });
                }
            };
            request.onerror = function () {
                reject(request.error);
            };
            request.onsuccess = function () {
                resolve(request.result);
            };
        });
    }

    // 包裝 transaction 生命週期，callback 只需要關心 objectStore 操作。
    function withStore(mode, callback) {
        return openDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(app.core.storageKeys.documentStore, mode);
                var store = tx.objectStore(app.core.storageKeys.documentStore);
                var result = callback(store);
                tx.oncomplete = function () {
                    // 每次 transaction 結束都關閉 db，避免頁面切換後留下不必要連線。
                    db.close();
                    resolve(result);
                };
                tx.onerror = function () {
                    db.close();
                    reject(tx.error);
                };
            });
        });
    }

    app.core.documentStore = {
        // 讀取目前 workspace；沒有資料時回傳 null。
        loadCurrent: function loadCurrent() {
            var keys = app.core.storageKeys;
            return withStore('readonly', function (store) {
                return new Promise(function (resolve, reject) {
                    var request = store.get(keys.currentDocumentId);
                    request.onerror = function () {
                        reject(request.error);
                    };
                    request.onsuccess = function () {
                        var value = request.result;
                        if (!value || value.schemaVersion !== keys.schemaVersion) {
                            resolve(null);
                            return;
                        }
                        resolve(value);
                    };
                });
            });
        },
        // 儲存目前 workspace metadata/settings，不儲存大型原始圖片檔。
        saveCurrent: function saveCurrent(value) {
            var keys = app.core.storageKeys;
            var nextValue = Object.assign(
                { id: keys.currentDocumentId, schemaVersion: keys.schemaVersion },
                value
            );
            return withStore('readwrite', function (store) {
                store.put(nextValue);
            });
        }
    };
})(window.DitherApp);
