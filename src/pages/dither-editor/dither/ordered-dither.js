(function (app) {
    // Ordered dithering 使用固定 Bayer matrix 產生規律網點，速度穩定且結果可預期。
    app.pages.ditherEditor = app.pages.ditherEditor || {};
    app.pages.ditherEditor.orderedDither = {
        // 執行 Bayer ordered dithering，固定使用 bayer4 matrix。
        apply: function apply(imageData, options) {
            var width = imageData.width;
            var height = imageData.height;
            var matrix = app.pages.ditherEditor.ditherMatrices.bayer4;
            var size = matrix.length;
            var source = imageData.data;
            var output = new Uint8ClampedArray(source.length);
            var palette = options.palette;
            var nearestColor = app.core.paletteUtils.createNearestColorFinder(palette, options.colorDistance);

            for (var y = 0; y < height; y += 1) {
                for (var x = 0; x < width; x += 1) {
                    var index = (y * width + x) * 4;
                    // threshold 會把像素亮度推高或拉低，再交給 palette 找最近色。
                    var threshold = (matrix[y % size][x % size] + 0.5) / (size * size) - 0.5;
                    var amount = threshold * 70;
                    var color = {
                        r: source[index] + amount,
                        g: source[index + 1] + amount,
                        b: source[index + 2] + amount
                    };
                    var nearest = nearestColor(color);
                    output[index] = nearest.r;
                    output[index + 1] = nearest.g;
                    output[index + 2] = nearest.b;
                    output[index + 3] = 255;
                }
            }

            return new ImageData(output, width, height);
        }
    };
})(window.DitherApp);
