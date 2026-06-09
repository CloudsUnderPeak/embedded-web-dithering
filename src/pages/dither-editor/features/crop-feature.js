(function (app) {
    // Crop feature 採用「固定比例裁切框 + 移動/縮放/旋轉原圖」的互動模型。
    // 面板只暴露比例、zoom、rotation、flip；實際 x/y/width/height 由比例和來源尺寸推導。
    // Crop feature 同時提供固定比例設定、crop preview 幾何與正式裁切 operation。
    // 外部只透過 app.pages.ditherEditor.crop 的小 API 使用幾何計算，不在 page.js 重寫 crop 規則。
    var ui = app.pages.ditherEditor.panelUtils;
    var DEFAULT_ASPECT_RATIO_ID = '5-3';
    var MIN_ZOOM = 1;
    var MAX_ZOOM = 8;
    var panelRefs = null;

    var ASPECT_RATIOS = [
        { id: '1-1', label: '1 : 1', width: 1, height: 1 },
        { id: '4-3', label: '4 : 3', width: 4, height: 3 },
        { id: '3-4', label: '3 : 4', width: 3, height: 4 },
        { id: '5-3', label: '5 : 3', width: 5, height: 3 },
        { id: '3-5', label: '3 : 5', width: 3, height: 5 },
        { id: '16-9', label: '16 : 9', width: 16, height: 9 },
        { id: '9-16', label: '9 : 16', width: 9, height: 16 }
    ];

    // 依 id 取得固定比例設定；找不到時回到預設 5:3。
    function ratioFor(id) {
        return ASPECT_RATIOS.find(function (ratio) {
            return ratio.id === id;
        }) || ASPECT_RATIOS.find(function (ratio) {
            return ratio.id === DEFAULT_ASPECT_RATIO_ID;
        });
    }

    // 將數值限制在指定範圍。
    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, Number(value) || 0));
    }

    // 水平/垂直翻轉後，旋轉角度需要反向，讓視覺方向符合鏡像後的結果。
    function mirroredRotation(rotation) {
        return clamp(-Number(rotation || 0), -180, 180);
    }

    function cropLabel(text) {
        return app.utils.dom.el('label', { text: text });
    }

    function cropField(label, input) {
        return app.utils.dom.el('div', {
            className: 'crop-field',
            children: [cropLabel(label), input]
        });
    }

    function cropIconButton(icon, label) {
        return app.utils.dom.el('button', {
            className: 'icon-button crop-icon-button',
            text: icon,
            attrs: { type: 'button', 'aria-label': label, title: label }
        });
    }

    function steppedRotation(rotation, delta) {
        var next = Number(rotation || 0) + delta;
        while (next > 180) {
            next -= 360;
        }
        while (next < -180) {
            next += 360;
        }
        return next;
    }

    // 取得目前可用的影像尺寸；尚未載入圖時使用工作尺寸。
    function imageBounds(state) {
        var image = state.sourceImageData;
        return {
            width: image ? image.width : state.workingSize.width,
            height: image ? image.height : state.workingSize.height
        };
    }

    function frameForBounds(bounds, ratioId) {
        // 裁切框永遠以來源影像 bounds 內可容納的最大固定比例計算，並置中。
        var ratio = ratioFor(ratioId);
        var ratioValue = ratio.width / ratio.height;
        var width = bounds.width;
        var height = width / ratioValue;
        if (height > bounds.height) {
            height = bounds.height;
            width = height * ratioValue;
        }
        return {
            x: (bounds.width - width) / 2,
            y: (bounds.height - height) / 2,
            width: width,
            height: height,
            ratio: ratio
        };
    }

    // 根據 zoom 後的原圖尺寸計算 pan 可移動範圍。
    function maxPan(bounds, frame, zoom) {
        return {
            x: Math.max(0, (bounds.width * zoom - frame.width) / 2),
            y: Math.max(0, (bounds.height * zoom - frame.height) / 2)
        };
    }

    // 計算旋轉後原圖外接矩形，用來確保 preview canvas 足夠容納可視區。
    function transformedBounds(bounds, settings) {
        var angle = Number(settings.rotation || 0) * Math.PI / 180;
        // sin/cos 必須取絕對值；超過 90 度時 cos 會變負，否則外接範圍會被錯算成變小。
        var sin = Math.abs(Math.sin(angle));
        var cos = Math.abs(Math.cos(angle));
        return {
            width: bounds.width * cos + bounds.height * sin,
            height: bounds.width * sin + bounds.height * cos
        };
    }

    function previewLayout(bounds, settings) {
        // 預覽 canvas 需要能容納旋轉後的完整影像外框，也要保證裁切框尺寸不被旋轉擠壓。
        var frame = frameForBounds(bounds, settings.aspectRatioId);
        var transformed = transformedBounds(bounds, settings);
        var width = Math.max(frame.width, transformed.width);
        var height = Math.max(frame.height, transformed.height);
        width = Math.ceil(width);
        height = Math.ceil(height);

        return {
            width: width,
            height: height,
            frame: {
                x: (width - frame.width) / 2,
                y: (height - frame.height) / 2,
                width: frame.width,
                height: frame.height,
                ratio: frame.ratio
            }
        };
    }

    // 根據目前來源尺寸與設定推導出真正會被使用的 crop 狀態。
    function normalizedCrop(state) {
        var settings = state.settings.crop;
        var bounds = imageBounds(state);
        var frame = frameForBounds(bounds, settings.aspectRatioId);
        var zoom = clamp(settings.zoom || 1, MIN_ZOOM, MAX_ZOOM);
        var panLimit = maxPan(bounds, frame, zoom);

        return {
            // x/y/width/height 保留給舊 settings/pipeline 相容；面板不再直接顯示這些欄位。
            x: Math.round(frame.x),
            y: Math.round(frame.y),
            width: Math.round(frame.width),
            height: Math.round(frame.height),
            panX: Number(clamp(settings.panX, -panLimit.x, panLimit.x).toFixed(2)),
            panY: Number(clamp(settings.panY, -panLimit.y, panLimit.y).toFixed(2)),
            aspectRatioId: frame.ratio.id,
            zoom: Number(zoom.toFixed(2)),
            rotation: clamp(settings.rotation || 0, -180, 180),
            flipX: Boolean(settings.flipX),
            flipY: Boolean(settings.flipY)
        };
    }

    // 將推導後的 crop 狀態寫回 state.settings.crop。
    function applyNormalizedCrop(state) {
        Object.assign(state.settings.crop, normalizedCrop(state));
    }

    // render 後同步面板控制元件，避免 normalize 後 UI 顯示舊值。
    function updatePanel(state) {
        if (!panelRefs) {
            return;
        }
        var crop = state.settings.crop;
        panelRefs.aspectRatio.value = crop.aspectRatioId;
        panelRefs.zoom.setValue(Math.round((crop.zoom || 1) * 100));
        panelRefs.rotation.setValue(crop.rotation);
        panelRefs.flipX.setAttribute('aria-pressed', crop.flipX ? 'true' : 'false');
        panelRefs.flipY.setAttribute('aria-pressed', crop.flipY ? 'true' : 'false');
    }

    function cropToImageData(imageData, settings) {
        // 正式輸出時，只建立裁切框大小的 target canvas，然後用同一組 transform 把原圖畫進去。
        // 這樣 preview 與 export 共用「原圖移動」的概念，不會變成移動裁切框。
        var frame = frameForBounds(imageData, settings.aspectRatioId);
        var width = Math.max(1, Math.round(frame.width));
        var height = Math.max(1, Math.round(frame.height));
        var canvas = app.core.canvasUtils.createCanvas(imageData.width, imageData.height);
        var ctx = canvas.getContext('2d');
        var target = app.core.canvasUtils.createCanvas(width, height);
        var targetCtx = target.getContext('2d', { willReadFrequently: true });
        var rotation = Number(settings.rotation || 0);
        var zoom = clamp(settings.zoom || 1, MIN_ZOOM, MAX_ZOOM);

        ctx.putImageData(imageData, 0, 0);
        targetCtx.translate(width / 2 + Number(settings.panX || 0), height / 2 + Number(settings.panY || 0));
        targetCtx.rotate(rotation * Math.PI / 180);
        // signed scale 同時處理 zoom 與 flip，需與 viewport-renderer 的 preview transform 保持一致。
        targetCtx.scale(settings.flipX ? -zoom : zoom, settings.flipY ? -zoom : zoom);
        targetCtx.drawImage(canvas, -imageData.width / 2, -imageData.height / 2);
        return targetCtx.getImageData(0, 0, width, height);
    }

    app.pages.ditherEditor.crop = {
        ratios: ASPECT_RATIOS.slice(),
        frameForBounds: frameForBounds,
        previewLayout: previewLayout,
        normalize: applyNormalizedCrop
    };

    app.pages.ditherEditor.featureRegistry.register({
        id: 'crop',
        icon: '[]',
        labelKey: 'panelCrop',
        pipelineStage: 'fixedBefore',
        pipelineOrder: 10,
        panelGroup: 'prepare',
        // 建立 crop 預設設定，尺寸依目前 display profile。
        defaultSettings: function defaultSettings(context) {
            var state = {
                workingSize: { width: context.display.width, height: context.display.height },
                sourceImageData: null,
                settings: {
                    crop: {
                        x: 0,
                        y: 0,
                        width: context.display.width,
                        height: context.display.height,
                        panX: 0,
                        panY: 0,
                        aspectRatioId: DEFAULT_ASPECT_RATIO_ID,
                        zoom: 1,
                        rotation: 0,
                        flipX: false,
                        flipY: false
                    }
                }
            };
            applyNormalizedCrop(state);
            return state.settings.crop;
        },
        // 新圖片載入時重設 crop transform，避免上一張圖的 pan/zoom 影響新圖。
        onImageLoaded: function onImageLoaded(context) {
            context.state.settings.crop = {
                x: 0,
                y: 0,
                width: context.result.workingSize.width,
                height: context.result.workingSize.height,
                panX: 0,
                panY: 0,
                aspectRatioId: DEFAULT_ASPECT_RATIO_ID,
                zoom: 1,
                rotation: 0,
                flipX: false,
                flipY: false
            };
            applyNormalizedCrop(context.state);
        },
        // 任一 crop 設定變更後都重新正規化，確保 pan/zoom 不超界。
        onSettingChanged: function onSettingChanged(context) {
            applyNormalizedCrop(context.state);
        },
        // 每次渲染後同步 panel refs。
        onRender: function onRender(context) {
            updatePanel(context.state);
        },
        // 建立 crop 控制面板：比例、zoom、rotation、flip。
        buildPanel: function buildPanel(context) {
            var state = context.state;
            var controller = context.controller;
            applyNormalizedCrop(state);
            var crop = state.settings.crop;
            var aspectRatioInput = ui.selectInput(
                crop.aspectRatioId,
                ASPECT_RATIOS.map(function (ratio) {
                    return { value: ratio.id, label: ratio.label };
                }),
                function (value) {
                    controller.updateSetting('crop', 'aspectRatioId', value);
                }
            );
            var zoomInput = ui.unitNumberInput(Math.round((crop.zoom || 1) * 100), MIN_ZOOM * 100, MAX_ZOOM * 100, 1, '%', function (value) {
                controller.updateSetting('crop', 'zoom', value / 100);
            });
            var rotationInput = ui.unitNumberInput(crop.rotation, -180, 180, 1, 'deg', function (value) {
                controller.updateSetting('crop', 'rotation', value);
            });
            var rotateLeftButton = cropIconButton('↺', 'Rotate left 90 degrees');
            var rotateRightButton = cropIconButton('↻', 'Rotate right 90 degrees');
            var flipXButton = cropIconButton('⇄', 'Flip horizontal');
            var flipYButton = cropIconButton('⇅', 'Flip vertical');
            flipXButton.setAttribute('aria-pressed', crop.flipX ? 'true' : 'false');
            flipYButton.setAttribute('aria-pressed', crop.flipY ? 'true' : 'false');
            rotateLeftButton.addEventListener('click', function () {
                var current = controller.state.settings.crop;
                controller.updateSetting('crop', 'rotation', steppedRotation(current.rotation, -90));
            });
            rotateRightButton.addEventListener('click', function () {
                var current = controller.state.settings.crop;
                controller.updateSetting('crop', 'rotation', steppedRotation(current.rotation, 90));
            });
            flipXButton.addEventListener('click', function () {
                var current = controller.state.settings.crop;
                // 已旋轉圖片反轉時同步鏡射 rotation/pan，讓按鈕語意以目前畫面座標為準。
                controller.updateSettings('crop', {
                    flipX: !current.flipX,
                    rotation: mirroredRotation(current.rotation),
                    panX: -Number(current.panX || 0)
                });
            });
            flipYButton.addEventListener('click', function () {
                var current = controller.state.settings.crop;
                controller.updateSettings('crop', {
                    flipY: !current.flipY,
                    rotation: mirroredRotation(current.rotation),
                    panY: -Number(current.panY || 0)
                });
            });

            panelRefs = {
                aspectRatio: aspectRatioInput,
                zoom: zoomInput,
                rotation: rotationInput,
                flipX: flipXButton,
                flipY: flipYButton
            };

            return ui.section('panelCrop', [
                app.utils.dom.el('div', {
                    className: 'crop-quadrant-grid',
                    children: [
                        cropField('Ratio', aspectRatioInput),
                        cropField('Zoom', zoomInput),
                        cropField('Rotation', rotationInput),
                        app.utils.dom.el('div', {
                            className: 'crop-icon-button-row',
                            children: [rotateLeftButton, rotateRightButton, flipXButton, flipYButton]
                        })
                    ]
                })
            ], 'crop');
        },
        operation: {
            // Pipeline 中的 crop operation，輸出固定比例裁切後的 ImageData。
            run: function run(imageData, settings) {
                if (
                    Number(settings.rotation || 0) === 0 &&
                    Number(settings.panX || 0) === 0 &&
                    Number(settings.panY || 0) === 0 &&
                    Number(settings.zoom || 1) === 1 &&
                    !settings.flipX &&
                    !settings.flipY &&
                    settings.width === imageData.width &&
                    settings.height === imageData.height
                ) {
                    return imageData;
                }
                return cropToImageData(imageData, settings);
            }
        }
    });
})(window.DitherApp);
