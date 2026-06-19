(function (app) {
    // Ordered dithering 使用固定 Bayer matrix 產生規律網點，速度穩定且結果可預期。
    app.pages.ditherEditor = app.pages.ditherEditor || {};

    function matrixSize(matrix) {
        return matrix.size || matrix.length;
    }

    function matrixLevels(matrix, size) {
        return matrix.levels || size * size;
    }

    function matrixCell(matrix, x, y, size) {
        if (typeof matrix.cell === 'function') {
            return matrix.cell(x, y);
        }
        return matrix[y % size][x % size];
    }

    function thresholdMap(matrix, size, levels) {
        if (matrix.thresholdMap) {
            return matrix.thresholdMap;
        }
        var map = new Float32Array(size * size);
        for (var y = 0; y < size; y += 1) {
            for (var x = 0; x < size; x += 1) {
                map[y * size + x] = (matrixCell(matrix, x, y, size) + 0.5) / levels;
            }
        }
        matrix.thresholdMap = map;
        return map;
    }

    app.pages.ditherEditor.orderedDither = {
        // 執行 ordered dithering，options.matrixId 決定 threshold matrix。
        apply: function apply(imageData, options, algorithm) {
            var width = imageData.width;
            var height = imageData.height;
            var matrices = app.pages.ditherEditor.ditherMatrices;
            var matrix = matrices[options.matrixId] || matrices.bayer4;
            var size = matrixSize(matrix);
            var levels = matrixLevels(matrix, size);
            var thresholds = thresholdMap(matrix, size, levels);
            var thresholdScale = algorithm && algorithm.thresholdScale || 70;
            var source = imageData.data;
            var output = new Uint8ClampedArray(source.length);
            var paletteMapper = app.pages.ditherEditor.paletteMapping.createMapper(options);
            if (!paletteMapper.length) {
                return imageData;
            }

            for (var y = 0; y < height; y += 1) {
                var thresholdRow = (y % size) * size;
                for (var x = 0; x < width; x += 1) {
                    var index = (y * width + x) * 4;
                    var threshold = thresholds[thresholdRow + (x % size)];
                    var nearest = paletteMapper.mapThresholdColor(
                        source[index],
                        source[index + 1],
                        source[index + 2],
                        threshold,
                        thresholdScale
                    );
                    output[index] = nearest.r;
                    output[index + 1] = nearest.g;
                    output[index + 2] = nearest.b;
                    output[index + 3] = 255;
                }
            }

            return new ImageData(output, width, height);
        }
    };

    app.pages.ditherEditor.ditherAlgorithmRegistry.registerProcessor({
        id: 'ordered',
        apply: function apply(imageData, options, algorithm) {
            return app.pages.ditherEditor.orderedDither.apply(imageData, options, algorithm);
        }
    });
})(window.DitherApp);
