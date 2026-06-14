(function (app) {
    // Palette feature 管理色票 UI、原圖代表色萃取，以及 Dither 關閉時的 palette quantization。
    // Dither 啟用時，preset/custom 色票只作為 Dither 的固定目標色集合。
    var ui = app.pages.ditherEditor.panelUtils;
    var ORIGINAL_PRESET_ID = 'original';
    var CUSTOM_PRESET_ID = 'custom';

    // 將色彩通道限制成 0-255 整數。
    function clampByte(value) {
        return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
    }

    // 複製單一 RGB 色彩並正規化通道。
    function copyColor(color) {
        return {
            r: clampByte(color && color.r),
            g: clampByte(color && color.g),
            b: clampByte(color && color.b)
        };
    }

    // 深拷貝 palette，避免 UI 編輯時直接改到 preset 常數。
    function copyPalette(palette) {
        return (palette || []).map(copyColor);
    }

    // 舊資料中的 none 或空值都視為 Original。
    function normalizePresetId(id) {
        return id === 'none' || !id ? ORIGINAL_PRESET_ID : id;
    }

    // 從靜態 palette preset 清單中找設定。
    function findPreset(id) {
        return app.pages.ditherEditor.config.palettePresets.find(function (entry) {
            return entry.id === id;
        });
    }

    // 將 RGB 轉成 color input 需要的 hex 字串。
    function colorToHex(color) {
        color = copyColor(color);
        return '#' + [color.r, color.g, color.b].map(function (value) {
            return ('0' + value.toString(16)).slice(-2);
        }).join('');
    }

    // 將 color input 的 hex 字串轉回 RGB。
    function hexToColor(value) {
        var match = /^#?([0-9a-f]{6})$/i.exec(value || '');
        var hex = match ? match[1] : '000000';
        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16)
        };
    }

    function extractOriginalPalette(imageData) {
        // Original palette 直接使用 vendored RgbQuant，避免手寫 reducer 與 ditherit-v2 漂移。
        return app.pages.ditherEditor.rgbQuantAdapter.extractPalette(imageData);
    }

    // Original palette samples the loaded source image, not crop/resize/adjust output.
    // 重新從來源圖片萃取 Original 色票。
    function refreshOriginalPalette(state, imageData) {
        state.settings.palette.originalPalette = extractOriginalPalette(imageData || state.sourceImageData);
    }

    // 面板打開時若尚未萃取色票，就補萃取一次。
    function ensureOriginalPalette(state) {
        if (!state.settings.palette.originalPalette || !state.settings.palette.originalPalette.length) {
            refreshOriginalPalette(state, state.sourceImageData);
        }
    }

    // Palette 變更後同步給 Dither feature，讓 dithering 使用同一組色票。
    function syncDitherPalette(state) {
        var palette = currentPalette(state.settings.palette);
        if (state.settings.dither) {
            state.settings.dither.palette = palette && palette.length ? copyPalette(palette) : null;
        }
    }

    // 依目前 preset/custom/original 設定取出實際要顯示或套用的 palette。
    function currentPalette(settings) {
        var presetId = normalizePresetId(settings.presetId);
        if (presetId === ORIGINAL_PRESET_ID) {
            return copyPalette(settings.originalPalette);
        }
        if (presetId === CUSTOM_PRESET_ID && settings.palette && settings.palette.length) {
            return copyPalette(settings.palette);
        }
        if (settings.palette && settings.palette.length) {
            return copyPalette(settings.palette);
        }
        var preset = findPreset(presetId);
        return preset ? copyPalette(preset.colors) : [];
    }

    function ditherIsActive(context) {
        var state = context && context.state;
        var dither = state && state.settings && state.settings.dither;
        var enabled = state && state.pipeline && state.pipeline.enabled;
        return Boolean(dither && dither.algorithm && dither.algorithm !== 'none'
            && (!enabled || enabled.dither !== false));
    }

    // Dither 啟用時由 Dither 依目前 palette 落色；Palette 不先量化，避免抖動前誤差被吃掉。
    function shouldApplyPalette(settings, context) {
        return normalizePresetId(settings.presetId) !== ORIGINAL_PRESET_ID && !ditherIsActive(context);
    }

    function setCustomPalette(context, palette, options) {
        // 使用者新增、刪除或改色後立刻切到 custom palette，並同步給 Dither 使用。
        var colors = copyPalette(palette);
        context.state.settings.palette.palette = colors.length ? colors : null;
        context.state.settings.palette.presetId = colors.length ? CUSTOM_PRESET_ID : ORIGINAL_PRESET_ID;
        syncDitherPalette(context.state);
        context.presetInput.value = context.state.settings.palette.presetId;
        if (!options || options.render !== false) {
            context.renderSwatches();
        }
        context.controller.schedulePreview();
    }

    function buildPaletteEditor(context) {
        // 色票本身就是可編輯控制：點圓點改色，hover/focus 才顯示刪除按鈕。
        var swatches = app.utils.dom.el('div', { className: 'palette-swatches' });

        // 重新渲染色票列，通常在新增/刪除/切 preset 後使用。
        context.renderSwatches = function renderSwatches() {
            var colors = currentPalette(context.state.settings.palette);
            app.utils.dom.clear(swatches);
            colors.forEach(function (color, index) {
                var colorInput = app.utils.dom.el('input', {
                    className: 'palette-color-input',
                    attrs: {
                        type: 'color',
                        value: colorToHex(color),
                        'aria-label': 'Palette color ' + (index + 1)
                    }
                });
                var removeButton = app.utils.dom.el('button', {
                    className: 'palette-remove-button',
                    text: 'x',
                    attrs: {
                        type: 'button',
                        'aria-label': 'Remove palette color ' + (index + 1)
                    }
                });
                colorInput.addEventListener('input', function () {
                    colors[index] = hexToColor(colorInput.value);
                    setCustomPalette(context, colors, { render: false });
                });
                removeButton.addEventListener('click', function () {
                    colors.splice(index, 1);
                    setCustomPalette(context, colors);
                });
                swatches.appendChild(app.utils.dom.el('span', {
                    className: 'palette-swatch',
                    children: [colorInput, removeButton]
                }));
            });
            var addButton = app.utils.dom.el('button', {
                className: 'palette-add-button',
                text: '+',
                attrs: { type: 'button', 'aria-label': 'Add palette color' }
            });
            addButton.addEventListener('click', function () {
                setCustomPalette(context, colors.concat([{ r: 0, g: 0, b: 0 }]));
            });
            swatches.appendChild(addButton);
        };

        context.renderSwatches();
        return app.utils.dom.el('div', {
            className: 'palette-editor',
            children: [
                app.utils.dom.el('div', { className: 'palette-editor-label', text: 'Palette' }),
                swatches
            ]
        });
    }

    app.pages.ditherEditor.featureRegistry.register({
        id: 'palette',
        icon: '#',
        labelKey: 'panelPalette',
        panelGroup: 'edit',
        pipelineStage: 'effectsOrder',
        pipelineOrder: 20,
        // 預設顯示 Original 代表色，不先套用固定色盤。
        defaultSettings: function defaultSettings() {
            return { presetId: ORIGINAL_PRESET_ID, palette: null, originalPalette: null };
        },
        // 新圖片載入後重新萃取 Original 色票，並同步給 dither。
        onImageLoaded: function onImageLoaded(context) {
            var settings = context.state.settings.palette;
            refreshOriginalPalette(context.state, context.result.imageData);
            if (normalizePresetId(settings.presetId) === ORIGINAL_PRESET_ID) {
                settings.presetId = ORIGINAL_PRESET_ID;
                settings.palette = null;
            }
            syncDitherPalette(context.state);
        },
        // 只處理 presetId 變更；色票直接編輯由 setCustomPalette 管理。
        onSettingChanged: function onSettingChanged(context) {
            if (context.id !== 'palette' || context.key !== 'presetId') {
                return;
            }
            var presetId = normalizePresetId(context.value);
            context.state.settings.palette.presetId = presetId;
            if (presetId === ORIGINAL_PRESET_ID) {
                ensureOriginalPalette(context.state);
                context.state.settings.palette.palette = null;
                syncDitherPalette(context.state);
                return;
            }
            if (presetId === CUSTOM_PRESET_ID) {
                var existingPalette = context.state.settings.palette.palette;
                context.state.settings.palette.palette = existingPalette && existingPalette.length
                    ? currentPalette(context.state.settings.palette)
                    : copyPalette(context.state.settings.palette.originalPalette);
                syncDitherPalette(context.state);
                return;
            }
            var preset = findPreset(presetId) || app.pages.ditherEditor.config.palettePresets[0];
            context.state.settings.palette.palette = copyPalette(preset.colors);
            syncDitherPalette(context.state);
        },
        // 建立 palette 色票編輯器與 preset 下拉選單。
        buildPanel: function buildPanel(context) {
            var state = context.state;
            var controller = context.controller;
            state.settings.palette.presetId = normalizePresetId(state.settings.palette.presetId);
            ensureOriginalPalette(state);
            syncDitherPalette(state);
            var options = [
                { value: ORIGINAL_PRESET_ID, label: ui.t('paletteOriginal') },
                { value: CUSTOM_PRESET_ID, label: ui.t('paletteCustom') }
            ].concat(
                app.pages.ditherEditor.config.palettePresets.map(function (preset) {
                    return { value: preset.id, label: ui.t(preset.labelKey) };
                })
            );
            var paletteContext = {
                state: state,
                controller: controller,
                presetInput: null,
                renderSwatches: null
            };
            var presetInput = ui.selectInput(state.settings.palette.presetId, options, function (value) {
                controller.updateSetting('palette', 'presetId', value);
                paletteContext.renderSwatches();
            });
            paletteContext.presetInput = presetInput;
            return ui.section('panelPalette', [
                buildPaletteEditor(paletteContext),
                ui.row('Preset', presetInput)
            ], 'palette');
        },
        operation: {
            pipeline: {
                draggable: true
            },
            // Dither 關閉時，Palette operation 會把每個像素替換成 palette 中的最近色。
            run: function run(imageData, settings, context) {
                var palette = currentPalette(settings);
                if (!shouldApplyPalette(settings, context) || !palette.length) {
                    return imageData;
                }
                var data = new Uint8ClampedArray(imageData.data);
                var ditherSettings = context && context.state && context.state.settings.dither;
                var colorDistance = app.core.paletteUtils.normalizeColorDistanceId(
                    ditherSettings && ditherSettings.colorDistance
                );
                var nearestColor = app.core.paletteUtils.createNearestColorFinder(palette, colorDistance);
                for (var i = 0; i < data.length; i += 4) {
                    var nearest = nearestColor({ r: data[i], g: data[i + 1], b: data[i + 2] });
                    data[i] = nearest.r;
                    data[i + 1] = nearest.g;
                    data[i + 2] = nearest.b;
                    data[i + 3] = 255;
                }
                return new ImageData(data, imageData.width, imageData.height);
            }
        }
    });
})(window.DitherApp);
