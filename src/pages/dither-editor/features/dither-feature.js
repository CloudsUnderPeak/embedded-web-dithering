(function (app) {
    // Dither feature 只負責選擇演算法並把目前 palette 傳給對應處理器。
    // palette 的建立與同步在 palette-feature.js；這裡不重複管理色票狀態。
    var ui = app.pages.ditherEditor.panelUtils;
    var constants = app.pages.ditherEditor.constants;

    function colorDistanceOptions() {
        return app.pages.ditherEditor.config.colorDistanceMetrics.map(function (metric) {
            return { value: metric.id, label: ui.t(metric.labelKey) };
        });
    }

    function paletteMappingOptions() {
        return app.pages.ditherEditor.config.paletteMappingModes.map(function (mode) {
            return { value: mode.id, label: ui.t(mode.labelKey) };
        });
    }

    function algorithmById(id) {
        return app.pages.ditherEditor.ditherAlgorithmRegistry.get(id);
    }

    function strengthLabelKey(id) {
        var registry = app.pages.ditherEditor.ditherAlgorithmRegistry;
        if (registry.supportsDotDensity(id)) {
            return 'labelDotDensity';
        }
        return registry.supportsThresholdStrength(id) ? 'labelDitherStrength' : 'labelErrorStrength';
    }

    function supportsStrength(id) {
        var registry = app.pages.ditherEditor.ditherAlgorithmRegistry;
        return registry.supportsErrorStrength(id)
            || registry.supportsThresholdStrength(id)
            || registry.supportsDotDensity(id);
    }

    function normalizeErrorStrength(value) {
        var number = Number(value);
        if (!Number.isFinite(number)) {
            return constants.DEFAULT_DITHER_ERROR_STRENGTH;
        }
        return Math.max(
            constants.MIN_DITHER_ERROR_STRENGTH,
            Math.min(constants.MAX_DITHER_ERROR_STRENGTH, number)
        );
    }

    function errorStrengthInput(value, onChange, disabled, options) {
        var normalized = normalizeErrorStrength(value);
        var valueLabel = app.utils.dom.el('span', {
            className: 'dither-range-value',
            text: normalized + '%'
        });
        var input = ui.rangeInput(
            normalized,
            constants.MIN_DITHER_ERROR_STRENGTH,
            constants.MAX_DITHER_ERROR_STRENGTH,
            constants.DITHER_ERROR_STRENGTH_STEP,
            function (nextValue) {
                var next = normalizeErrorStrength(nextValue);
                valueLabel.textContent = next + '%';
                onChange(next);
            },
            options
        );
        var wrapper = app.utils.dom.el('div', {
            className: 'dither-range-control',
            children: [valueLabel, input]
        });
        wrapper.setDisabled = function (nextDisabled) {
            input.disabled = Boolean(nextDisabled);
            wrapper.classList.toggle('is-disabled', Boolean(nextDisabled));
        };
        wrapper.setDisabled(disabled);
        return wrapper;
    }

    app.pages.ditherEditor.featureRegistry.register({
        id: 'dither',
        icon: '..',
        iconPath: 'assets/icons/editor/dither.svg',
        labelKey: 'panelDither',
        panelGroup: 'edit',
        pipelineStage: 'effectsOrder',
        pipelineOrder: 30,
        // 預設以 Floyd-Steinberg error diffusion 處理；palette 由 palette feature 同步。
        defaultSettings: function defaultSettings() {
            return {
                algorithm: constants.DEFAULT_DITHER_ALGORITHM_ID,
                paletteMapping: constants.DEFAULT_PALETTE_MAPPING_ID,
                serpentine: false,
                colorDistance: constants.DEFAULT_COLOR_DISTANCE_ID,
                errorStrength: constants.DEFAULT_DITHER_ERROR_STRENGTH,
                palette: null
            };
        },
        // 建立演算法、color distance、serpentine 與 error strength 控制。
        buildPanel: function buildPanel(context) {
            var state = context.state;
            var controller = context.controller;
            state.settings.dither.colorDistance = app.core.paletteUtils.normalizeColorDistanceId(
                state.settings.dither.colorDistance
            );
            state.settings.dither.paletteMapping = app.pages.ditherEditor.paletteMapping.normalizeId(
                state.settings.dither.paletteMapping
            );
            state.settings.dither.errorStrength = normalizeErrorStrength(state.settings.dither.errorStrength);
            var options = [{ value: 'none', label: ui.t('optionNone') }].concat(
                app.pages.ditherEditor.ditherAlgorithmRegistry.list().map(function (algorithm) {
                    return { value: algorithm.id, label: ui.t(algorithm.labelKey) };
                })
            );
            var previewHold = {
                onInteractionStart: function () {
                    controller.beginPreviewHold('dither');
                },
                onInteractionEnd: function () {
                    controller.endPreviewHold();
                }
            };
            var errorStrengthControl = errorStrengthInput(
                state.settings.dither.errorStrength,
                function (value) {
                    controller.updateSetting('dither', 'errorStrength', value);
                },
                !supportsStrength(state.settings.dither.algorithm),
                previewHold
            );
            var strengthRow = ui.row(
                ui.t(strengthLabelKey(state.settings.dither.algorithm)),
                errorStrengthControl
            );
            var strengthLabel = strengthRow.querySelector('label');
            function updateStrengthControl(algorithmId) {
                strengthLabel.textContent = ui.t(strengthLabelKey(algorithmId));
                errorStrengthControl.setDisabled(!supportsStrength(algorithmId));
            }
            var rows = [
                ui.row('Algorithm', ui.selectInput(state.settings.dither.algorithm, options, function (value) {
                    updateStrengthControl(value);
                    controller.updateSetting('dither', 'algorithm', value);
                })),
                ui.row(ui.t('labelPaletteMapping'), ui.selectInput(
                    state.settings.dither.paletteMapping,
                    paletteMappingOptions(),
                    function (value) {
                        controller.updateSetting('dither', 'paletteMapping', value);
                    }
                )),
                ui.row(ui.t('labelColorDistance'), ui.selectInput(
                    state.settings.dither.colorDistance,
                    colorDistanceOptions(),
                    function (value) {
                        controller.updateSetting('dither', 'colorDistance', value);
                    }
                )),
                ui.row('Serpentine', ui.toggleSwitchInput(state.settings.dither.serpentine, function (value) {
                    controller.updateSetting('dither', 'serpentine', value);
                })),
                strengthRow
            ];
            return ui.section('panelDither', rows, 'dither');
        },
        operation: {
            pipeline: {
                draggable: false
            },
            // 依演算法 registry 找到對應 processor；Dither feature 不硬寫 processor 清單。
            run: function run(imageData, settings) {
                // none 代表 pipeline 保留此工具但不套用任何 dithering。
                if (settings.algorithm === 'none') {
                    return imageData;
                }
                var registry = app.pages.ditherEditor.ditherAlgorithmRegistry;
                var algorithm = algorithmById(settings.algorithm) || registry.first();
                var palette = settings.palette || [];
                if (!palette.length) {
                    return imageData;
                }
                var strength = normalizeErrorStrength(settings.errorStrength);
                var options = {
                    matrixId: algorithm.matrixId,
                    palette: palette,
                    paletteMapping: app.pages.ditherEditor.paletteMapping.normalizeId(settings.paletteMapping),
                    colorDistance: app.core.paletteUtils.normalizeColorDistanceId(settings.colorDistance),
                    serpentine: Boolean(settings.serpentine && algorithm.supportsSerpentine),
                    errorStrength: strength
                };
                if (algorithm.supportsThresholdStrength) {
                    options.thresholdScale = (algorithm.thresholdScale || 70) * strength / 100;
                    options.thresholdStrength = strength / 100;
                }
                if (algorithm.supportsDotDensity) {
                    options.dotDensity = strength / 100;
                }
                return registry.run(imageData, algorithm, options);
            }
        }
    });
})(window.DitherApp);
