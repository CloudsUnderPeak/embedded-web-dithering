(function (app) {
    // ViewportRenderer 只管理預覽 canvas 的繪製。
    // 它不負責 pipeline、面板或儲存，讓預覽重繪可以獨立最佳化。
    // ViewportRenderer 只負責把 ImageData 或 crop transform 畫到 canvas。
    // 它不知道 tool panel、pipeline 或 storage，避免 canvas 呈現層和業務狀態耦合。
    // 建立 renderer 並保存上一次繪製的 ImageData/transform，用於跳過重複渲染。
    function ViewportRenderer(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.lastImageData = undefined;
        this.lastFilter = '';
        this.lastTransformKey = '';
    }

    ViewportRenderer.prototype.render = function render(imageData) {
        // 一般預覽直接把 ImageData 畫到 canvas；同一份資料重複要求時會跳過重繪。
        if (!imageData) {
            if (this.lastImageData === null) {
                return;
            }
            this.lastImageData = null;
            this.lastTransformKey = '';
            this.canvas.width = 800;
            this.canvas.height = 480;
            this.ctx.fillStyle = '#f7f9fa';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#6b7c88';
            this.ctx.font = '18px system-ui';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('No image loaded', this.canvas.width / 2, this.canvas.height / 2);
            return;
        }
        if (this.lastImageData === imageData && this.lastTransformKey === '') {
            // 同一張 ImageData 且沒有 transform 時可跳過重畫，降低 slider 操作時的無效 render。
            return;
        }
        this.lastImageData = imageData;
        this.lastTransformKey = '';
        this.canvas.width = imageData.width;
        this.canvas.height = imageData.height;
        this.ctx.putImageData(imageData, 0, 0);
    };

    ViewportRenderer.prototype.renderTransformed = function renderTransformed(imageData, settings, layout) {
        // Crop 模式下 canvas 顯示的是「原圖被移動、縮放、旋轉後」的預覽。
        // 裁切框由 page.js 的 overlay 負責，所以這裡只處理影像本身的 transform。
        layout = layout || app.pages.ditherEditor.crop.previewLayout(imageData, settings);
        // transformKey 包含所有會影響 crop preview 的設定；漏掉 flip/rotation 會造成 UI 不更新。
        var transformKey = [
            settings.aspectRatioId,
            settings.panX,
            settings.panY,
            settings.zoom,
            settings.rotation,
            settings.flipX,
            settings.flipY,
            layout.width,
            layout.height
        ].join('|');
        if (this.lastImageData === imageData && this.lastTransformKey === transformKey) {
            return;
        }
        this.lastImageData = imageData;
        this.lastTransformKey = transformKey;
        this.canvas.width = layout.width;
        this.canvas.height = layout.height;

        // putImageData 不能直接參與 rotate/scale，先轉成暫存 canvas 再 drawImage。
        var source = app.core.canvasUtils.createCanvas(imageData.width, imageData.height);
        source.getContext('2d').putImageData(imageData, 0, 0);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(
            layout.width / 2 + Number(settings.panX || 0),
            layout.height / 2 + Number(settings.panY || 0)
        );
        // Transform 順序需與正式 crop operation 一致：中心 -> pan -> rotation -> signed scale -> draw source。
        this.ctx.rotate(Number(settings.rotation || 0) * Math.PI / 180);
        this.ctx.scale(
            settings.flipX ? -Number(settings.zoom || 1) : Number(settings.zoom || 1),
            settings.flipY ? -Number(settings.zoom || 1) : Number(settings.zoom || 1)
        );
        this.ctx.drawImage(source, -imageData.width / 2, -imageData.height / 2);
        this.ctx.restore();
    };

    ViewportRenderer.prototype.setFilter = function setFilter(filter) {
        // Adjust 拖曳中的即時預覽使用 CSS filter；正式結果仍由 pipeline 產出 ImageData。
        filter = filter || '';
        if (this.lastFilter === filter) {
            return;
        }
        this.lastFilter = filter;
        this.canvas.style.filter = filter;
    };

    app.pages.ditherEditor = app.pages.ditherEditor || {};
    app.pages.ditherEditor.ViewportRenderer = ViewportRenderer;
})(window.DitherApp);
