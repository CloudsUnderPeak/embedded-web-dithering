(function (app) {
    // Pattern dithering 是簡化的圖案化效果，用固定點陣改變灰階再映射到 palette。
    // 它不是嚴格的物理或印刷模型，主要提供快速、風格化的預覽。
    app.pages.ditherEditor = app.pages.ditherEditor || {};
    app.pages.ditherEditor.patternDither = {
        // 執行簡化 pattern dithering，輸出仍會映射到 palette。
        apply: function apply(imageData, options) {
            var width = imageData.width;
            var height = imageData.height;
            var source = imageData.data;
            var output = new Uint8ClampedArray(source.length);
            var palette = options.palette;
            var nearestColor = app.core.paletteUtils.createNearestColorFinder(palette, options.colorDistance);

            for (var y = 0; y < height; y += 1) {
                for (var x = 0; x < width; x += 1) {
                    var index = (y * width + x) * 4;
                    var luma = app.core.colorUtils.luminance(
                        source[index],
                        source[index + 1],
                        source[index + 2]
                    );
                    // dot 決定此像素是否位在圖案點上，藉此產生人工網點感。
                    var dot = (x % 3 === 1 && y % 3 === 1) || (x + y) % 7 === 0;
                    var adjusted = luma + (dot ? 34 : -18);
                    var nearest = nearestColor({ r: adjusted, g: adjusted, b: adjusted });
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
