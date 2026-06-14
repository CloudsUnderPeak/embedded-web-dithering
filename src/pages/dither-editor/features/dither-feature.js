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

    function algorithmById(id) {
        var algorithms = app.pages.ditherEditor.config.ditherAlgorithms;
        return algorithms.find(function (algorithm) {
            return algorithm.id === id;
        }) || null;
    }

    function isErrorDiffusionAlgorithm(id) {
        var algorithm = algorithmById(id);
        return Boolean(algorithm && algorithm.mode === 'error-diffusion');
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
        labelKey: 'panelDither',
        panelGroup: 'edit',
        pipelineStage: 'effectsOrder',
        pipelineOrder: 30,
        // 預設以 Floyd-Steinberg error diffusion 處理；palette 由 palette feature 同步。
        defaultSettings: function defaultSettings() {
            return {
                algorithm: constants.DEFAULT_DITHER_ALGORITHM_ID,
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
            state.settings.dither.errorStrength = normalizeErrorStrength(state.settings.dither.errorStrength);
            var options = [{ value: 'none', label: ui.t('optionNone') }].concat(
                app.pages.ditherEditor.config.ditherAlgorithms.map(function (algorithm) {
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
                !isErrorDiffusionAlgorithm(state.settings.dither.algorithm),
                previewHold
            );
            var rows = [
                ui.row('Algorithm', ui.selectInput(state.settings.dither.algorithm, options, function (value) {
                    errorStrengthControl.setDisabled(!isErrorDiffusionAlgorithm(value));
                    controller.updateSetting('dither', 'algorithm', value);
                })),
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
                ui.row(ui.t('labelErrorStrength'), errorStrengthControl)
            ];
            return ui.section('panelDither', rows, 'dither');
        },
        operation: {
            pipeline: {
                draggable: false
            },
            // 依演算法設定分派到 ordered、pattern 或 error diffusion processor。
            run: function run(imageData, settings) {
                // none 代表 pipeline 保留此工具但不套用任何 dithering。
                if (settings.algorithm === 'none') {
                    return imageData;
                }
                var config = app.pages.ditherEditor.config;
                var algorithm = algorithmById(settings.algorithm) || config.ditherAlgorithms[0];
                var palette = settings.palette || [];
                if (!palette.length) {
                    return imageData;
                }
                var options = {
                    matrixId: algorithm.matrixId,
                    palette: palette,
                    colorDistance: app.core.paletteUtils.normalizeColorDistanceId(settings.colorDistance),
                    serpentine: Boolean(settings.serpentine),
                    errorStrength: normalizeErrorStrength(settings.errorStrength)
                };
                if (algorithm.mode === 'ordered') {
                    return app.pages.ditherEditor.orderedDither.apply(imageData, options);
                }
                if (algorithm.mode === 'pattern') {
                    return app.pages.ditherEditor.patternDither.apply(imageData, options);
                }
                return app.pages.ditherEditor.errorDiffusion.apply(imageData, options);
            }
        }
    });
})(window.DitherApp);
