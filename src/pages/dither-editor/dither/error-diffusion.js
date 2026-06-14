(function (app) {
    // Error diffusion dithering 會把每個像素量化後的誤差擴散到鄰近未處理像素。
    // 這類演算法較慢，但能產生比單純 threshold 更自然的階調。
    app.pages.ditherEditor = app.pages.ditherEditor || {};

    function normalizeErrorStrength(value) {
        var percent = Number(value);
        if (!Number.isFinite(percent)) {
            return 1;
        }
        return Math.max(0, Math.min(150, percent)) / 100;
    }

    app.pages.ditherEditor.errorDiffusion = {
        // 執行 error diffusion，options.matrixId 決定誤差擴散權重。
        apply: function apply(imageData, options) {
            var adapter = app.pages.ditherEditor.rgbQuantAdapter;
            if (adapter && adapter.canApplyErrorDiffusion(options)) {
                return adapter.applyErrorDiffusion(imageData, options);
            }

            var width = imageData.width;
            var height = imageData.height;
            var data = new Float32Array(imageData.data);
            var output = new Uint8ClampedArray(imageData.data.length);
            var palette = options.palette;
            var matrices = app.pages.ditherEditor.ditherMatrices;
            var matrix = matrices[options.matrixId] || matrices.floydSteinberg;
            var nearestColor = app.core.paletteUtils.createNearestColorFinder(palette, options.colorDistance);
            var errorStrength = normalizeErrorStrength(options.errorStrength);

            for (var y = 0; y < height; y += 1) {
                // Serpentine 會讓奇數列反向掃描，減少誤差擴散造成的單方向條紋。
                var reverse = options.serpentine && y % 2 === 1;
                var start = reverse ? width - 1 : 0;
                var end = reverse ? -1 : width;
                var step = reverse ? -1 : 1;

                for (var x = start; x !== end; x += step) {
                    var index = (y * width + x) * 4;
                    var oldColor = { r: data[index], g: data[index + 1], b: data[index + 2] };
                    var newColor = nearestColor(oldColor);
                    output[index] = newColor.r;
                    output[index + 1] = newColor.g;
                    output[index + 2] = newColor.b;
                    output[index + 3] = 255;

                    var error = {
                        r: oldColor.r - newColor.r,
                        g: oldColor.g - newColor.g,
                        b: oldColor.b - newColor.b
                    };

                    matrix.forEach(function (entry) {
                        var nx = x + (reverse ? -entry.x : entry.x);
                        var ny = y + entry.y;
                        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                            return;
                        }
                        var target = (ny * width + nx) * 4;
                        data[target] += error.r * entry.factor * errorStrength;
                        data[target + 1] += error.g * entry.factor * errorStrength;
                        data[target + 2] += error.b * entry.factor * errorStrength;
                    });
                }
            }

            return new ImageData(output, width, height);
        }
    };
})(window.DitherApp);
