(function (app) {
    // Class-matrix dot diffusion：先依 class matrix 排處理順序，再把 RGB 誤差擴散給尚未處理的鄰居。
    app.pages.ditherEditor = app.pages.ditherEditor || {};

    var CLASS_MATRIX = [
        [34, 48, 40, 32, 29, 15, 23, 31],
        [42, 58, 56, 53, 21, 5, 7, 10],
        [50, 62, 61, 45, 13, 1, 2, 18],
        [38, 46, 54, 37, 25, 17, 9, 26],
        [28, 14, 22, 30, 35, 49, 41, 33],
        [20, 4, 6, 11, 43, 59, 57, 52],
        [12, 0, 3, 19, 51, 63, 60, 44],
        [24, 16, 8, 27, 39, 47, 55, 36]
    ];
    var CLASS_COORDS = new Array(64);

    for (var classY = 0; classY < 8; classY += 1) {
        for (var classX = 0; classX < 8; classX += 1) {
            CLASS_COORDS[CLASS_MATRIX[classY][classX]] = { x: classX, y: classY };
        }
    }

    function clampByte(value) {
        return value < 0 ? 0 : (value > 255 ? 255 : value);
    }

    function classAt(x, y) {
        return CLASS_MATRIX[y & 7][x & 7];
    }

    function collectRecipients(x, y, width, height, currentClass, recipients) {
        recipients.length = 0;
        for (var offsetY = -1; offsetY <= 1; offsetY += 1) {
            var ny = y + offsetY;
            if (ny < 0 || ny >= height) {
                continue;
            }
            for (var offsetX = -1; offsetX <= 1; offsetX += 1) {
                var nx = x + offsetX;
                if ((offsetX === 0 && offsetY === 0) || nx < 0 || nx >= width) {
                    continue;
                }
                if (classAt(nx, ny) > currentClass) {
                    recipients.push((ny * width + nx) * 4);
                }
            }
        }
        return recipients.length;
    }

    app.pages.ditherEditor.dotDiffusion = {
        apply: function apply(imageData, options) {
            var width = imageData.width;
            var height = imageData.height;
            var source = new Float32Array(imageData.data);
            var output = new Uint8ClampedArray(source.length);
            var paletteMapper = app.pages.ditherEditor.paletteMapping.createMapper(options);
            var recipients = [];

            for (var currentClass = 0; currentClass < CLASS_COORDS.length; currentClass += 1) {
                var coord = CLASS_COORDS[currentClass];
                for (var y = coord.y; y < height; y += 8) {
                    for (var x = coord.x; x < width; x += 8) {
                        var index = (y * width + x) * 4;
                        var oldR = source[index];
                        var oldG = source[index + 1];
                        var oldB = source[index + 2];
                        var nearest = paletteMapper.mapColor(oldR, oldG, oldB);
                        var errorR = oldR - nearest.r;
                        var errorG = oldG - nearest.g;
                        var errorB = oldB - nearest.b;
                        var count = collectRecipients(x, y, width, height, currentClass, recipients);

                        output[index] = nearest.r;
                        output[index + 1] = nearest.g;
                        output[index + 2] = nearest.b;
                        output[index + 3] = 255;

                        if (!count) {
                            continue;
                        }
                        var shareR = errorR / count;
                        var shareG = errorG / count;
                        var shareB = errorB / count;
                        for (var i = 0; i < count; i += 1) {
                            var recipientIndex = recipients[i];
                            source[recipientIndex] = clampByte(source[recipientIndex] + shareR);
                            source[recipientIndex + 1] = clampByte(source[recipientIndex + 1] + shareG);
                            source[recipientIndex + 2] = clampByte(source[recipientIndex + 2] + shareB);
                        }
                    }
                }
            }

            return new ImageData(output, width, height);
        }
    };

    app.pages.ditherEditor.ditherAlgorithmRegistry.registerProcessor({
        id: 'dot-diffusion',
        apply: function apply(imageData, options) {
            return app.pages.ditherEditor.dotDiffusion.apply(imageData, options);
        }
    });
})(window.DitherApp);
