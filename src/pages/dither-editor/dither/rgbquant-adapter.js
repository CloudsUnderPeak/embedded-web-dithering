(function (app) {
    // Adapter around the vendored RgbQuant library.
    // Feature code should use this layer instead of depending on RgbQuant tuple/kernel details.
    app.pages.ditherEditor = app.pages.ditherEditor || {};

    var ORIGINAL_PALETTE_SIZE = 8;
    var RGBQUANT_OPTIONS = {
        method: 2,
        boxSize: [8, 8],
        boxPxls: 2,
        initColors: 4096,
        minHueCols: 2000,
        dithDelta: 0,
        reIndex: false,
        useCache: true,
        cacheFreq: 10
    };
    var KERNEL_BY_MATRIX_ID = {
        floydSteinberg: 'FloydSteinberg',
        atkinson: 'Atkinson',
        jarvis: 'Jarvis',
        stucki: 'Stucki'
    };

    function createRgbQuant(options) {
        if (!window.RgbQuant) {
            throw new Error('RgbQuant is not loaded.');
        }
        return new window.RgbQuant(Object.assign({}, RGBQUANT_OPTIONS, options || {}));
    }

    function colorToTuple(color) {
        return [
            Math.max(0, Math.min(255, Math.round(Number(color && color.r) || 0))),
            Math.max(0, Math.min(255, Math.round(Number(color && color.g) || 0))),
            Math.max(0, Math.min(255, Math.round(Number(color && color.b) || 0)))
        ];
    }

    function tupleToColor(tuple) {
        return {
            r: tuple[0],
            g: tuple[1],
            b: tuple[2]
        };
    }

    function cloneImageData(imageData) {
        return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    }

    function normalizeErrorStrengthPercent(value) {
        var percent = Number(value);
        if (!Number.isFinite(percent)) {
            return 100;
        }
        return Math.max(0, Math.min(150, percent));
    }

    function rgbQuantColorDistanceId(colorDistance) {
        var normalized = app.core.paletteUtils.normalizeColorDistanceId(colorDistance);
        if (normalized === 'manhattan-bt709') {
            return 'manhattan';
        }
        if (normalized === 'euclidean-bt709') {
            return 'euclidean';
        }
        return null;
    }

    function kernelName(matrixId) {
        return KERNEL_BY_MATRIX_ID[matrixId] || null;
    }

    function canApplyErrorDiffusion(options) {
        return Boolean(
            window.RgbQuant
            && options
            && options.palette
            && options.palette.length
            && kernelName(options.matrixId)
            && rgbQuantColorDistanceId(options.colorDistance)
        );
    }

    app.pages.ditherEditor.rgbQuantAdapter = {
        extractPalette: function extractPalette(imageData) {
            if (!imageData || !imageData.data || !imageData.width || !imageData.height) {
                return [];
            }
            var quantizer = createRgbQuant({
                colors: ORIGINAL_PALETTE_SIZE,
                palette: [],
                colorDist: 'euclidean'
            });
            quantizer.sample(imageData);
            return quantizer.palette(true).slice(0, ORIGINAL_PALETTE_SIZE).map(tupleToColor);
        },
        canApplyErrorDiffusion: canApplyErrorDiffusion,
        applyErrorDiffusion: function applyErrorDiffusion(imageData, options) {
            if (!canApplyErrorDiffusion(options)) {
                throw new Error('RgbQuant cannot apply the selected error diffusion settings.');
            }
            var palette = options.palette.map(colorToTuple);
            var quantizer = createRgbQuant({
                colors: palette.length,
                palette: palette,
                colorDist: rgbQuantColorDistanceId(options.colorDistance),
                dithKern: kernelName(options.matrixId),
                dithSerp: Boolean(options.serpentine),
                errorDiffusionStrength: normalizeErrorStrengthPercent(options.errorStrength)
            });
            var output = quantizer.reduce(cloneImageData(imageData));
            return new ImageData(new Uint8ClampedArray(output), imageData.width, imageData.height);
        }
    };
})(window.DitherApp);
