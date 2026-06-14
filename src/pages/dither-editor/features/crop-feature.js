(function (app) {
    // Crop feature 採用「固定比例裁切框 + 移動/縮放/旋轉原圖」的互動模型。
    // 面板只暴露比例、zoom、rotation、flip；實際 x/y/width/height 由比例和來源尺寸推導。
    // Crop feature 同時提供固定比例設定、crop preview 幾何與正式裁切 operation。
    // 外部只透過 app.pages.ditherEditor.crop 的小 API 使用幾何計算，不在 page.js 重寫 crop 規則。
    var ui = app.pages.ditherEditor.panelUtils;
    var DEFAULT_ASPECT_RATIO_ID = '16-9';
    var BACKGROUND_PRESET_AUTO = 'auto';
    var BACKGROUND_PRESET_BLACK = 'black';
    var BACKGROUND_PRESET_WHITE = 'white';
    var BACKGROUND_PRESET_CUSTOM = 'custom';
    var DEFAULT_BACKGROUND_PRESET = BACKGROUND_PRESET_AUTO;
    var DEFAULT_BACKGROUND_COLOR = '#ffffff';
    var AUTO_BACKGROUND_SAMPLE_LONG_EDGE = 240;
    var AUTO_BACKGROUND_ALPHA_THRESHOLD = 24;
    var AUTO_BACKGROUND_STABLE_DISTANCE = 12;
    var AUTO_BACKGROUND_TRIM_RATIO = 0.15;
    var MIN_ZOOM = 1;
    var MAX_ZOOM = 8;
    var panelRefs = null;
    var autoBackgroundCache = {
        imageData: null,
        sourceCanvas: null,
        key: '',
        color: DEFAULT_BACKGROUND_COLOR
    };

    var ASPECT_RATIOS = [
        { id: '1-1', label: '1 : 1', width: 1, height: 1 },
        { id: '4-3', label: '4 : 3', width: 4, height: 3 },
        { id: '3-4', label: '3 : 4', width: 3, height: 4 },
        { id: '5-3', label: '5 : 3', width: 5, height: 3 },
        { id: '3-5', label: '3 : 5', width: 3, height: 5 },
        { id: '16-9', label: '16 : 9', width: 16, height: 9 },
        { id: '9-16', label: '9 : 16', width: 9, height: 16 }
    ];

    var BACKGROUND_PRESETS = [
        { id: BACKGROUND_PRESET_AUTO, label: 'Auto', color: DEFAULT_BACKGROUND_COLOR },
        { id: BACKGROUND_PRESET_BLACK, label: 'Black', color: '#000000' },
        { id: BACKGROUND_PRESET_WHITE, label: 'White', color: '#ffffff' },
        { id: BACKGROUND_PRESET_CUSTOM, label: 'Custom', color: DEFAULT_BACKGROUND_COLOR }
    ];

    // 依 id 取得固定比例設定；找不到時回到預設 16:9。
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

    function backgroundPresetFor(id) {
        return BACKGROUND_PRESETS.find(function (preset) {
            return preset.id === id;
        }) || BACKGROUND_PRESETS.find(function (preset) {
            return preset.id === DEFAULT_BACKGROUND_PRESET;
        });
    }

    function normalizeHexColor(value) {
        var text = String(value || '').trim();
        if (/^#[0-9a-f]{6}$/i.test(text)) {
            return text.toLowerCase();
        }
        return DEFAULT_BACKGROUND_COLOR;
    }

    function colorToHex(r, g, b) {
        return '#' + [r, g, b].map(function (value) {
            return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
        }).join('');
    }

    function hexToColor(hex) {
        var normalized = normalizeHexColor(hex).replace('#', '');
        return {
            r: parseInt(normalized.slice(0, 2), 16),
            g: parseInt(normalized.slice(2, 4), 16),
            b: parseInt(normalized.slice(4, 6), 16)
        };
    }

    function colorDistance(a, b) {
        var red = a.r - b.r;
        var green = a.g - b.g;
        var blue = a.b - b.b;
        return Math.sqrt(red * red + green * green + blue * blue);
    }

    function stabilizeAutoBackgroundColor(rawColor, settings) {
        var previousColor = normalizeHexColor(settings && settings.autoBackgroundColor);
        var from = hexToColor(previousColor);
        var to = hexToColor(rawColor);
        var distance = colorDistance(from, to);
        if (distance <= AUTO_BACKGROUND_STABLE_DISTANCE) {
            return previousColor;
        }
        return rawColor;
    }

    function trimmedAverage(values) {
        if (!values.length) {
            return 255;
        }
        values.sort(function (a, b) {
            return a - b;
        });
        var trim = Math.floor(values.length * AUTO_BACKGROUND_TRIM_RATIO);
        var start = Math.min(trim, values.length - 1);
        var end = Math.max(start + 1, values.length - trim);
        var sum = 0;
        for (var i = start; i < end; i += 1) {
            sum += values[i];
        }
        return sum / (end - start);
    }

    function samplesToColor(samples, fallback) {
        if (!samples.length) {
            return fallback;
        }
        var red = [];
        var green = [];
        var blue = [];
        samples.forEach(function (sample) {
            red.push(sample.r);
            green.push(sample.g);
            blue.push(sample.b);
        });
        return colorToHex(
            trimmedAverage(red),
            trimmedAverage(green),
            trimmedAverage(blue)
        );
    }

    function isAutoOpaque(data, offset) {
        return data[offset + 3] > AUTO_BACKGROUND_ALPHA_THRESHOLD;
    }

    function addAutoSample(samples, data, offset) {
        if (!isAutoOpaque(data, offset)) {
            return;
        }
        samples.push({
            r: data[offset],
            g: data[offset + 1],
            b: data[offset + 2]
        });
    }

    function autoBackgroundKey(imageData, settings, width, height) {
        return [
            imageData.width,
            imageData.height,
            width,
            height,
            settings.aspectRatioId,
            Number(settings.panX || 0).toFixed(2),
            Number(settings.panY || 0).toFixed(2),
            Number(settings.zoom || 1).toFixed(2),
            Number(settings.rotation || 0).toFixed(2),
            settings.flipX ? 1 : 0,
            settings.flipY ? 1 : 0
        ].join('|');
    }

    function sourceCanvasForAuto(imageData) {
        if (autoBackgroundCache.imageData === imageData && autoBackgroundCache.sourceCanvas) {
            return autoBackgroundCache.sourceCanvas;
        }
        var canvas = app.core.canvasUtils.createCanvas(imageData.width, imageData.height);
        canvas.getContext('2d').putImageData(imageData, 0, 0);
        autoBackgroundCache.imageData = imageData;
        autoBackgroundCache.sourceCanvas = canvas;
        autoBackgroundCache.key = '';
        return canvas;
    }

    function collectAutoBoundarySamples(data, width, height) {
        var samples = [];
        for (var y = 1; y < height - 1; y += 1) {
            for (var x = 1; x < width - 1; x += 1) {
                var offset = (y * width + x) * 4;
                if (!isAutoOpaque(data, offset)) {
                    continue;
                }
                var top = offset - width * 4;
                var right = offset + 4;
                var bottom = offset + width * 4;
                var left = offset - 4;
                if (
                    isAutoOpaque(data, top) &&
                    isAutoOpaque(data, right) &&
                    isAutoOpaque(data, bottom) &&
                    isAutoOpaque(data, left)
                ) {
                    continue;
                }
                addAutoSample(samples, data, offset);
            }
        }
        return samples;
    }

    function collectAutoFallbackSamples(data, width, height) {
        var samples = [];
        function addPixel(x, y) {
            var offset = (y * width + x) * 4;
            addAutoSample(samples, data, offset);
        }
        for (var x = 0; x < width; x += 1) {
            addPixel(x, 0);
            addPixel(x, height - 1);
        }
        for (var y = 1; y < height - 1; y += 1) {
            addPixel(0, y);
            addPixel(width - 1, y);
        }
        return samples;
    }

    function autoBackgroundColor(imageData, settings) {
        if (!imageData) {
            return normalizeHexColor(settings && (settings.autoBackgroundColor || settings.backgroundColor));
        }
        var frame = frameForBounds(imageData, settings.aspectRatioId);
        var width = Math.max(1, Math.round(frame.width));
        var height = Math.max(1, Math.round(frame.height));
        var key = autoBackgroundKey(imageData, settings, width, height);
        if (autoBackgroundCache.imageData === imageData && autoBackgroundCache.key === key) {
            return autoBackgroundCache.color;
        }

        var scale = Math.min(1, AUTO_BACKGROUND_SAMPLE_LONG_EDGE / Math.max(width, height));
        var sampleWidth = Math.max(1, Math.round(width * scale));
        var sampleHeight = Math.max(1, Math.round(height * scale));
        var sampleCanvas = app.core.canvasUtils.createCanvas(sampleWidth, sampleHeight);
        var sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
        var sourceCanvas = sourceCanvasForAuto(imageData);
        sampleCtx.clearRect(0, 0, sampleWidth, sampleHeight);
        sampleCtx.save();
        sampleCtx.translate(
            sampleWidth / 2 + Number(settings.panX || 0) * scale,
            sampleHeight / 2 + Number(settings.panY || 0) * scale
        );
        sampleCtx.rotate(Number(settings.rotation || 0) * Math.PI / 180);
        sampleCtx.scale(
            (settings.flipX ? -1 : 1) * Number(settings.zoom || 1) * scale,
            (settings.flipY ? -1 : 1) * Number(settings.zoom || 1) * scale
        );
        sampleCtx.drawImage(sourceCanvas, -imageData.width / 2, -imageData.height / 2);
        sampleCtx.restore();

        var sampleData = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;
        var fallback = normalizeHexColor(settings && (settings.autoBackgroundColor || settings.backgroundColor));
        var rawColor = samplesToColor(
            collectAutoBoundarySamples(sampleData, sampleWidth, sampleHeight),
            null
        ) || samplesToColor(
            collectAutoFallbackSamples(sampleData, sampleWidth, sampleHeight),
            fallback
        );
        var color = stabilizeAutoBackgroundColor(rawColor, settings);
        autoBackgroundCache.key = key;
        autoBackgroundCache.color = color;
        if (settings) {
            settings.autoBackgroundColor = color;
        }
        return color;
    }

    function cropBackgroundColor(settings, imageData) {
        var preset = backgroundPresetFor(settings && settings.backgroundPreset);
        if (preset.id === BACKGROUND_PRESET_AUTO) {
            return autoBackgroundColor(imageData, settings);
        }
        if (preset.id !== BACKGROUND_PRESET_CUSTOM) {
            return preset.color;
        }
        return normalizeHexColor(settings && settings.backgroundColor);
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

    function cropBackgroundControl(select, colorInput) {
        return app.utils.dom.el('div', {
            className: 'crop-background-control',
            children: [select, colorInput]
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
            flipY: Boolean(settings.flipY),
            backgroundPreset: backgroundPresetFor(settings.backgroundPreset).id,
            backgroundColor: normalizeHexColor(settings.backgroundColor),
            autoBackgroundColor: normalizeHexColor(settings.autoBackgroundColor || settings.backgroundColor)
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
        panelRefs.backgroundPreset.value = crop.backgroundPreset;
        panelRefs.backgroundColor.value = cropBackgroundColor(crop, state.sourceImageData);
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
        var backgroundColor = cropBackgroundColor(settings, imageData);

        ctx.putImageData(imageData, 0, 0);
        targetCtx.fillStyle = backgroundColor;
        targetCtx.fillRect(0, 0, width, height);
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
        backgroundColor: cropBackgroundColor,
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
                        flipY: false,
                        backgroundPreset: DEFAULT_BACKGROUND_PRESET,
                        backgroundColor: DEFAULT_BACKGROUND_COLOR,
                        autoBackgroundColor: DEFAULT_BACKGROUND_COLOR
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
                flipY: false,
                backgroundPreset: DEFAULT_BACKGROUND_PRESET,
                backgroundColor: DEFAULT_BACKGROUND_COLOR,
                autoBackgroundColor: DEFAULT_BACKGROUND_COLOR
            };
            applyNormalizedCrop(context.state);
        },
        // 任一 crop 設定變更後都重新正規化，確保 pan/zoom 不超界。
        onSettingChanged: function onSettingChanged(context) {
            if (context.id !== 'crop') {
                return;
            }
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
            var backgroundColorInput = app.utils.dom.el('input', {
                className: 'crop-background-color',
                attrs: { type: 'color', value: cropBackgroundColor(crop, state.sourceImageData), 'aria-label': 'Crop fill color' }
            });
            var backgroundPresetInput = ui.selectInput(
                crop.backgroundPreset,
                BACKGROUND_PRESETS.map(function (preset) {
                    return { value: preset.id, label: preset.label };
                }),
                function (value) {
                    var preset = backgroundPresetFor(value);
                    var current = controller.state.settings.crop;
                    var next = Object.assign({}, current, { backgroundPreset: preset.id });
                    var color = preset.id === BACKGROUND_PRESET_CUSTOM
                        ? normalizeHexColor(
                            current.backgroundPreset === BACKGROUND_PRESET_AUTO
                                ? current.autoBackgroundColor
                                : current.backgroundColor
                        )
                        : cropBackgroundColor(next, controller.state.sourceImageData);
                    backgroundColorInput.value = color;
                    controller.updateSettings('crop', {
                        backgroundPreset: preset.id,
                        backgroundColor: color,
                        autoBackgroundColor: preset.id === BACKGROUND_PRESET_AUTO
                            ? color
                            : normalizeHexColor(current.autoBackgroundColor)
                    });
                }
            );
            backgroundColorInput.addEventListener('input', function () {
                backgroundPresetInput.value = BACKGROUND_PRESET_CUSTOM;
                state.settings.crop.backgroundPreset = BACKGROUND_PRESET_CUSTOM;
                state.settings.crop.backgroundColor = normalizeHexColor(backgroundColorInput.value);
            });
            backgroundColorInput.addEventListener('change', function () {
                controller.updateSettings('crop', {
                    backgroundPreset: BACKGROUND_PRESET_CUSTOM,
                    backgroundColor: normalizeHexColor(backgroundColorInput.value)
                });
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
                backgroundPreset: backgroundPresetInput,
                backgroundColor: backgroundColorInput,
                flipX: flipXButton,
                flipY: flipYButton
            };

            return ui.section('panelCrop', [
                app.utils.dom.el('div', {
                    className: 'crop-quadrant-grid',
                    children: [
                        cropField('Ratio', aspectRatioInput),
                        cropField('Zoom', zoomInput),
                        cropField('Rotate', rotationInput),
                        cropField('Fill', cropBackgroundControl(backgroundPresetInput, backgroundColorInput)),
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
