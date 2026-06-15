(function (app) {
    // CropPointerMapper 將 crop overlay 的 pointer/wheel 操作轉成 crop pan/zoom 設定。
    // 它只做座標換算與事件生命週期，不負責重繪或 pipeline。
    function CropPointerMapper(options) {
        options = options || {};
        this.cropOverlay = options.cropOverlay;
        this.canvas = options.canvas;
        this.controller = options.controller;
        this.prepareMode = options.prepareMode;
        this.drag = null;

        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerEnd = this.handlePointerEnd.bind(this);
        this.handleWheel = this.handleWheel.bind(this);

        this.bind();
    }

    CropPointerMapper.prototype.bind = function bind() {
        if (!this.cropOverlay) {
            return;
        }
        this.cropOverlay.addEventListener('pointerdown', this.handlePointerDown);
        this.cropOverlay.addEventListener('pointermove', this.handlePointerMove);
        this.cropOverlay.addEventListener('pointerup', this.handlePointerEnd);
        this.cropOverlay.addEventListener('pointercancel', this.handlePointerEnd);
        this.cropOverlay.addEventListener('wheel', this.handleWheel, { passive: false });
    };

    CropPointerMapper.prototype.destroy = function destroy() {
        if (!this.cropOverlay) {
            return;
        }
        this.cropOverlay.removeEventListener('pointerdown', this.handlePointerDown);
        this.cropOverlay.removeEventListener('pointermove', this.handlePointerMove);
        this.cropOverlay.removeEventListener('pointerup', this.handlePointerEnd);
        this.cropOverlay.removeEventListener('pointercancel', this.handlePointerEnd);
        this.cropOverlay.removeEventListener('wheel', this.handleWheel);
        this.drag = null;
    };

    CropPointerMapper.prototype.isPrepareMode = function isPrepareMode() {
        return Boolean(
            this.controller
            && this.controller.state
            && this.controller.state.sourceImageData
            && this.controller.state.mode === this.prepareMode
        );
    };

    CropPointerMapper.prototype.canvasScale = function canvasScale() {
        var rect = this.canvas.getBoundingClientRect();
        return {
            x: this.canvas.width / rect.width,
            y: this.canvas.height / rect.height
        };
    };

    CropPointerMapper.prototype.handlePointerDown = function handlePointerDown(event) {
        if (!this.isPrepareMode()) {
            return;
        }
        event.preventDefault();
        // 拖曳 overlay 時移動的是原圖 pan，不是裁切框本身。
        this.drag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            crop: Object.assign({}, this.controller.state.settings.crop),
            scale: this.canvasScale()
        };
        this.cropOverlay.setPointerCapture(event.pointerId);
    };

    CropPointerMapper.prototype.handlePointerMove = function handlePointerMove(event) {
        if (!this.drag || event.pointerId !== this.drag.pointerId) {
            return;
        }
        event.preventDefault();
        this.controller.updateSettings('crop', {
            panX: Number(this.drag.crop.panX || 0) + (event.clientX - this.drag.startX) * this.drag.scale.x,
            panY: Number(this.drag.crop.panY || 0) + (event.clientY - this.drag.startY) * this.drag.scale.y
        });
    };

    CropPointerMapper.prototype.handlePointerEnd = function handlePointerEnd(event) {
        if (!this.drag || event.pointerId !== this.drag.pointerId) {
            return;
        }
        if (
            this.cropOverlay.releasePointerCapture
            && (!this.cropOverlay.hasPointerCapture || this.cropOverlay.hasPointerCapture(event.pointerId))
        ) {
            this.cropOverlay.releasePointerCapture(event.pointerId);
        }
        this.drag = null;
    };

    CropPointerMapper.prototype.handleWheel = function handleWheel(event) {
        if (!this.isPrepareMode()) {
            return;
        }
        event.preventDefault();
        this.controller.updateSetting(
            'crop',
            'zoom',
            (this.controller.state.settings.crop.zoom || 1) + (event.deltaY < 0 ? 0.02 : -0.02)
        );
    };

    app.pages.ditherEditor = app.pages.ditherEditor || {};
    app.pages.ditherEditor.CropPointerMapper = CropPointerMapper;
})(window.DitherApp);
