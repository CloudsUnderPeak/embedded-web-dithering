(function (app) {
    // 圖片載入入口：所有使用者圖片都必須先通過格式 gate，再轉成 origin-clean ImageData。
    // 只允許 PNG / JPEG / WebP，是為了讓後續 canvas 演算法流程穩定可預期。
    var DEMO_IMAGE_URL = 'assets/demo/demo-16x9.png';
    var DEMO_IMAGE_DATA_SCRIPT = 'assets/demo/demo-16x9-data.js';
    var ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp';
    var SUPPORTED_IMAGE_TYPES = {
        'image/png': true,
        'image/jpeg': true,
        'image/webp': true
    };
    var SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
    var UNSUPPORTED_FORMAT_MESSAGE = 'Only PNG, JPEG, and WebP images are supported.';

    // 以 HTMLImageElement 載入 URL，保留給 data URL 或 blob URL fallback 使用。
    function loadImageFromUrl(url) {
        return new Promise(function (resolve, reject) {
            var image = new Image();
            image.onload = function () {
                resolve(image);
            };
            image.onerror = function () {
                reject(new Error('Image could not be loaded.'));
            };
            image.src = url;
        });
    }

    // 檢查匯入檔案是否為允許的 PNG/JPEG/WebP。
    function isSupportedImageFile(file) {
        var type = String(file && file.type || '').toLowerCase();
        var name = String(file && file.name || '').toLowerCase();
        if (SUPPORTED_IMAGE_TYPES[type]) {
            return true;
        }
        return SUPPORTED_IMAGE_EXTENSIONS.some(function (extension) {
            return name.endsWith(extension);
        });
    }

    // 統一產生格式錯誤，讓 controller 顯示一致訊息。
    function rejectUnsupportedImage(file) {
        if (!isSupportedImageFile(file)) {
            throw new Error(UNSUPPORTED_FORMAT_MESSAGE);
        }
    }

    // 將 createImageBitmap 結果轉為 ImageData，並負責關閉 bitmap 資源。
    function imageBitmapToImageData(bitmap, maxLongEdge) {
        try {
            return app.core.canvasUtils.imageToImageData(bitmap, maxLongEdge);
        } finally {
            if (bitmap.close) {
                bitmap.close();
            }
        }
    }

    // createImageBitmap 不可用時，改用 blob URL + ImageElement fallback。
    function blobUrlToImageData(blob, maxLongEdge) {
        var url = URL.createObjectURL(blob);
        return loadImageFromUrl(url)
            .then(function (image) {
                return app.core.canvasUtils.imageToImageData(image, maxLongEdge);
            })
            .finally(function () {
                URL.revokeObjectURL(url);
            });
    }

    // 優先使用 createImageBitmap，因為它通常不會造成 file:// demo 的 canvas taint。
    function blobToImageData(blob, maxLongEdge) {
        if (window.createImageBitmap) {
            // createImageBitmap 先由瀏覽器解碼 Blob，通常比直接 <img src=objectURL> 更不容易遇到 file:// taint。
            return createImageBitmap(blob)
                .then(function (bitmap) {
                    return imageBitmapToImageData(bitmap, maxLongEdge);
                })
                .catch(function () {
                    return blobUrlToImageData(blob, maxLongEdge);
                });
        }
        return blobUrlToImageData(blob, maxLongEdge);
    }

    // 載入內嵌 demo data URL；先嘗試 fetch 成 blob，再 fallback 到 ImageElement。
    function loadDataUrlImage(dataUrl, maxLongEdge) {
        if (window.fetch) {
            // Demo 在 standalone file:// 下優先走 JS data asset，再轉 Blob/ImageBitmap，
            // 避免相對路徑圖片直接 drawImage 後污染 canvas。
            return fetch(dataUrl)
                .then(function (response) {
                    return response.blob();
                })
                .then(function (blob) {
                    return blobToImageData(blob, maxLongEdge);
                })
                .catch(function () {
                    return loadImageFromUrl(dataUrl)
                        .then(function (image) {
                            return app.core.canvasUtils.imageToImageData(image, maxLongEdge);
                        });
                });
        }
        return loadImageFromUrl(dataUrl)
            .then(function (image) {
                return app.core.canvasUtils.imageToImageData(image, maxLongEdge);
            });
    }

    // 從使用者選取或拖放的 File 載入 ImageData。
    function loadImageFromFile(file, maxLongEdge) {
        try {
            // dropzone 會繞過 <input accept>，所以 core loader 必須再次驗證格式。
            rejectUnsupportedImage(file);
        } catch (error) {
            return Promise.reject(error);
        }
        return blobToImageData(file, maxLongEdge);
    }

    function loadDemoImageFile(maxLongEdge) {
        // 若 data asset 未載入，才退回同源 demo 檔；開發伺服器情境可用，file:// 可能被擋。
        if (!window.fetch) {
            return Promise.reject(new Error('Demo image data asset is missing.'));
        }
        return fetch(DEMO_IMAGE_URL)
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Demo image could not be loaded.');
                }
                return response.blob();
            })
            .then(function (blob) {
                return blobToImageData(blob, maxLongEdge);
            });
    }

    // 載入專案內建 demo 圖；優先使用 data asset 避免 file:// 跨來源限制。
    function loadDemoImage(maxLongEdge) {
        var embeddedDemo = app.assets && app.assets.demoImages && app.assets.demoImages.demo16x9;
        if (embeddedDemo) {
            return loadDataUrlImage(embeddedDemo, maxLongEdge);
        }
        if (app.app && app.app.scriptLoader && app.app.scriptLoader.load) {
            return app.app.scriptLoader.load(DEMO_IMAGE_DATA_SCRIPT)
                .then(function () {
                    var loadedDemo = app.assets
                        && app.assets.demoImages
                        && app.assets.demoImages.demo16x9;
                    if (!loadedDemo) {
                        throw new Error('Demo image data asset is missing.');
                    }
                    return loadDataUrlImage(loadedDemo, maxLongEdge);
                })
                .catch(function () {
                    return loadDemoImageFile(maxLongEdge);
                });
        }
        return loadDemoImageFile(maxLongEdge);
    }

    // 建立白底空白 ImageData；目前 UI 不直接暴露 blank canvas 建立入口。
    function createBlankImage(width, height) {
        var canvas = app.core.canvasUtils.createCanvas(width, height);
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return {
            imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
            originalSize: { width: canvas.width, height: canvas.height },
            workingSize: { width: canvas.width, height: canvas.height },
            wasResized: false
        };
    }

    app.core.imageLoader = {
        acceptedImageTypes: ACCEPTED_IMAGE_TYPES,
        isSupportedImageFile: isSupportedImageFile,
        loadImageFromFile: loadImageFromFile,
        loadDemoImage: loadDemoImage,
        createBlankImage: createBlankImage
    };
})(window.DitherApp);
