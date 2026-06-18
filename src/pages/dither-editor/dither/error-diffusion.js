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

    function normalizedPalette(palette) {
        var source = palette || [];
        var red = new Array(source.length);
        var green = new Array(source.length);
        var blue = new Array(source.length);
        for (var i = 0; i < source.length; i += 1) {
            red[i] = Math.max(0, Math.min(255, Math.round(Number(source[i] && source[i].r) || 0)));
            green[i] = Math.max(0, Math.min(255, Math.round(Number(source[i] && source[i].g) || 0)));
            blue[i] = Math.max(0, Math.min(255, Math.round(Number(source[i] && source[i].b) || 0)));
        }
        return {
            source: source,
            red: red,
            green: green,
            blue: blue,
            length: source.length
        };
    }

    function ciede2000IndexFinder(palette, colorDistanceId) {
        var nearestColor = app.core.paletteUtils.createNearestColorFinder(palette.source, colorDistanceId);
        return function nearestIndex(r, g, b) {
            var color = nearestColor({ r: r, g: g, b: b });
            for (var i = 0; i < palette.length; i += 1) {
                if (palette.source[i] === color) {
                    return i;
                }
            }
            return 0;
        };
    }

    function createNearestIndexFinder(palette, colorDistanceId) {
        var mode = app.core.paletteUtils.normalizeColorDistanceId(colorDistanceId);
        if (mode === 'ciede2000') {
            return ciede2000IndexFinder(palette, mode);
        }
        if (mode === 'manhattan-rgb') {
            return function nearestIndex(r, g, b) {
                var bestIndex = 0;
                var bestDistance = Infinity;
                for (var i = 0; i < palette.length; i += 1) {
                    var distance = Math.abs(r - palette.red[i])
                        + Math.abs(g - palette.green[i])
                        + Math.abs(b - palette.blue[i]);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestIndex = i;
                    }
                }
                return bestIndex;
            };
        }
        if (mode === 'manhattan-bt709') {
            return function nearestIndex(r, g, b) {
                var bestIndex = 0;
                var bestDistance = Infinity;
                for (var i = 0; i < palette.length; i += 1) {
                    var distance = 0.2126 * Math.abs(r - palette.red[i])
                        + 0.7152 * Math.abs(g - palette.green[i])
                        + 0.0722 * Math.abs(b - palette.blue[i]);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestIndex = i;
                    }
                }
                return bestIndex;
            };
        }
        if (mode === 'euclidean-rgb') {
            return function nearestIndex(r, g, b) {
                var bestIndex = 0;
                var bestDistance = Infinity;
                for (var i = 0; i < palette.length; i += 1) {
                    var dr = r - palette.red[i];
                    var dg = g - palette.green[i];
                    var db = b - palette.blue[i];
                    var distance = dr * dr + dg * dg + db * db;
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestIndex = i;
                    }
                }
                return bestIndex;
            };
        }
        return function nearestIndex(r, g, b) {
            var bestIndex = 0;
            var bestDistance = Infinity;
            for (var i = 0; i < palette.length; i += 1) {
                var dr = r - palette.red[i];
                var dg = g - palette.green[i];
                var db = b - palette.blue[i];
                var distance = 0.2126 * dr * dr + 0.7152 * dg * dg + 0.0722 * db * db;
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestIndex = i;
                }
            }
            return bestIndex;
        };
    }

    function applyFloydSteinberg(imageData, palette, nearestIndex, serpentine, strength) {
        var width = imageData.width;
        var height = imageData.height;
        var data = new Float32Array(imageData.data);
        var output = new Uint8ClampedArray(imageData.data.length);
        var factor7 = (7 / 16) * strength;
        var factor3 = (3 / 16) * strength;
        var factor5 = (5 / 16) * strength;
        var factor1 = (1 / 16) * strength;
        var rowStride = width * 4;

        for (var y = 0; y < height; y += 1) {
            var reverse = serpentine && y % 2 === 1;
            var rowOffset = y * rowStride;

            if (!reverse) {
                for (var x = 0; x < width; x += 1) {
                    var index = rowOffset + x * 4;
                    var r = data[index];
                    var g = data[index + 1];
                    var b = data[index + 2];
                    var paletteIndex = nearestIndex(r, g, b);
                    var nr = palette.red[paletteIndex];
                    var ng = palette.green[paletteIndex];
                    var nb = palette.blue[paletteIndex];
                    var er = r - nr;
                    var eg = g - ng;
                    var eb = b - nb;

                    output[index] = nr;
                    output[index + 1] = ng;
                    output[index + 2] = nb;
                    output[index + 3] = 255;

                    if (x + 1 < width) {
                        diffuse(data, index + 4, er, eg, eb, factor7);
                    }
                    if (y + 1 < height) {
                        var nextRow = index + rowStride;
                        if (x > 0) {
                            diffuse(data, nextRow - 4, er, eg, eb, factor3);
                        }
                        diffuse(data, nextRow, er, eg, eb, factor5);
                        if (x + 1 < width) {
                            diffuse(data, nextRow + 4, er, eg, eb, factor1);
                        }
                    }
                }
            } else {
                for (var rx = width - 1; rx >= 0; rx -= 1) {
                    var reverseIndex = rowOffset + rx * 4;
                    var rr = data[reverseIndex];
                    var rg = data[reverseIndex + 1];
                    var rb = data[reverseIndex + 2];
                    var reversePaletteIndex = nearestIndex(rr, rg, rb);
                    var rnr = palette.red[reversePaletteIndex];
                    var rng = palette.green[reversePaletteIndex];
                    var rnb = palette.blue[reversePaletteIndex];
                    var rer = rr - rnr;
                    var reg = rg - rng;
                    var reb = rb - rnb;

                    output[reverseIndex] = rnr;
                    output[reverseIndex + 1] = rng;
                    output[reverseIndex + 2] = rnb;
                    output[reverseIndex + 3] = 255;

                    if (rx > 0) {
                        diffuse(data, reverseIndex - 4, rer, reg, reb, factor7);
                    }
                    if (y + 1 < height) {
                        var reverseNextRow = reverseIndex + rowStride;
                        if (rx + 1 < width) {
                            diffuse(data, reverseNextRow + 4, rer, reg, reb, factor3);
                        }
                        diffuse(data, reverseNextRow, rer, reg, reb, factor5);
                        if (rx > 0) {
                            diffuse(data, reverseNextRow - 4, rer, reg, reb, factor1);
                        }
                    }
                }
            }
        }

        return new ImageData(output, width, height);
    }

    function diffuse(data, index, er, eg, eb, factor) {
        data[index] = clampByte(data[index] + er * factor);
        data[index + 1] = clampByte(data[index + 1] + eg * factor);
        data[index + 2] = clampByte(data[index + 2] + eb * factor);
    }

    function clampByte(value) {
        return value < 0 ? 0 : (value > 255 ? 255 : value);
    }

    function luminanceAt(data, index) {
        return 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
    }

    function computeMeanMap(data, width, height, radius) {
        var stride = width + 1;
        var integral = new Float32Array(stride * (height + 1));

        for (var y = 0; y < height; y += 1) {
            var rowSum = 0;
            for (var x = 0; x < width; x += 1) {
                var pixel = y * width + x;
                rowSum += luminanceAt(data, pixel * 4);
                integral[(y + 1) * stride + (x + 1)] = integral[y * stride + (x + 1)] + rowSum;
            }
        }

        var output = new Float32Array(width * height);
        for (var row = 0; row < height; row += 1) {
            var top = Math.max(0, row - radius);
            var bottom = Math.min(height - 1, row + radius);
            for (var col = 0; col < width; col += 1) {
                var left = Math.max(0, col - radius);
                var right = Math.min(width - 1, col + radius);
                var a = integral[top * stride + left];
                var b = integral[top * stride + (right + 1)];
                var c = integral[(bottom + 1) * stride + left];
                var d = integral[(bottom + 1) * stride + (right + 1)];
                var area = (right - left + 1) * (bottom - top + 1);
                output[row * width + col] = (d - b - c + a) / area;
            }
        }
        return output;
    }

    function applyAdaptiveFloydSteinberg(imageData, options, radius) {
        var width = imageData.width;
        var height = imageData.height;
        var palette = normalizedPalette(options.palette);
        if (!palette.length) {
            return imageData;
        }

        var source = imageData.data;
        var meanMap = computeMeanMap(source, width, height, radius);
        var data = new Float32Array(source);
        var output = new Uint8ClampedArray(source.length);
        var nearestIndex = createNearestIndexFinder(palette, options.colorDistance);
        var strength = normalizeErrorStrength(options.errorStrength);
        var factor7 = (7 / 16) * strength;
        var factor3 = (3 / 16) * strength;
        var factor5 = (5 / 16) * strength;
        var factor1 = (1 / 16) * strength;
        var rowStride = width * 4;
        var adaptiveBiasScale = 0.35;

        for (var y = 0; y < height; y += 1) {
            var reverse = options.serpentine && y % 2 === 1;
            var rowOffset = y * rowStride;
            var start = reverse ? width - 1 : 0;
            var end = reverse ? -1 : width;
            var step = reverse ? -1 : 1;

            for (var x = start; x !== end; x += step) {
                var index = rowOffset + x * 4;
                var r = data[index];
                var g = data[index + 1];
                var b = data[index + 2];
                var localMean = meanMap[y * width + x];
                var bias = (128 - localMean) * adaptiveBiasScale;
                var paletteIndex = nearestIndex(
                    clampByte(r + bias),
                    clampByte(g + bias),
                    clampByte(b + bias)
                );
                var nr = palette.red[paletteIndex];
                var ng = palette.green[paletteIndex];
                var nb = palette.blue[paletteIndex];
                var er = r - nr;
                var eg = g - ng;
                var eb = b - nb;

                output[index] = nr;
                output[index + 1] = ng;
                output[index + 2] = nb;
                output[index + 3] = 255;

                if (!reverse) {
                    if (x + 1 < width) {
                        diffuse(data, index + 4, er, eg, eb, factor7);
                    }
                    if (y + 1 < height) {
                        var nextRow = index + rowStride;
                        if (x > 0) {
                            diffuse(data, nextRow - 4, er, eg, eb, factor3);
                        }
                        diffuse(data, nextRow, er, eg, eb, factor5);
                        if (x + 1 < width) {
                            diffuse(data, nextRow + 4, er, eg, eb, factor1);
                        }
                    }
                } else {
                    if (x > 0) {
                        diffuse(data, index - 4, er, eg, eb, factor7);
                    }
                    if (y + 1 < height) {
                        var reverseNextRow = index + rowStride;
                        if (x + 1 < width) {
                            diffuse(data, reverseNextRow + 4, er, eg, eb, factor3);
                        }
                        diffuse(data, reverseNextRow, er, eg, eb, factor5);
                        if (x > 0) {
                            diffuse(data, reverseNextRow - 4, er, eg, eb, factor1);
                        }
                    }
                }
            }
        }

        return new ImageData(output, width, height);
    }

    function applyMatrix(imageData, options, matrix, palette, nearestIndex, strength) {
        var width = imageData.width;
        var height = imageData.height;
        var data = new Float32Array(imageData.data);
        var output = new Uint8ClampedArray(imageData.data.length);
        var matrixLength = matrix.length;
        var offsetX = new Array(matrixLength);
        var offsetY = new Array(matrixLength);
        var factors = new Array(matrixLength);

        for (var i = 0; i < matrixLength; i += 1) {
            offsetX[i] = matrix[i].x;
            offsetY[i] = matrix[i].y;
            factors[i] = matrix[i].factor * strength;
        }

        for (var y = 0; y < height; y += 1) {
            var reverse = options.serpentine && y % 2 === 1;
            var start = reverse ? width - 1 : 0;
            var end = reverse ? -1 : width;
            var step = reverse ? -1 : 1;

            for (var x = start; x !== end; x += step) {
                var index = (y * width + x) * 4;
                var r = data[index];
                var g = data[index + 1];
                var b = data[index + 2];
                var paletteIndex = nearestIndex(r, g, b);
                var nr = palette.red[paletteIndex];
                var ng = palette.green[paletteIndex];
                var nb = palette.blue[paletteIndex];
                var er = r - nr;
                var eg = g - ng;
                var eb = b - nb;

                output[index] = nr;
                output[index + 1] = ng;
                output[index + 2] = nb;
                output[index + 3] = 255;

                for (var entryIndex = 0; entryIndex < matrixLength; entryIndex += 1) {
                    var nx = x + (reverse ? -offsetX[entryIndex] : offsetX[entryIndex]);
                    var ny = y + offsetY[entryIndex];
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                        continue;
                    }
                    diffuse(data, (ny * width + nx) * 4, er, eg, eb, factors[entryIndex]);
                }
            }
        }

        return new ImageData(output, width, height);
    }

    app.pages.ditherEditor.errorDiffusion = {
        // 執行 error diffusion，options.matrixId 決定誤差擴散權重。
        apply: function apply(imageData, options) {
            var palette = normalizedPalette(options.palette);
            if (!palette.length) {
                return imageData;
            }
            var matrices = app.pages.ditherEditor.ditherMatrices;
            var matrix = matrices[options.matrixId] || matrices.floydSteinberg;
            var nearestIndex = createNearestIndexFinder(palette, options.colorDistance);
            var errorStrength = normalizeErrorStrength(options.errorStrength);
            if (matrix === matrices.floydSteinberg) {
                return applyFloydSteinberg(
                    imageData,
                    palette,
                    nearestIndex,
                    Boolean(options.serpentine),
                    errorStrength
                );
            }

            return applyMatrix(imageData, options, matrix, palette, nearestIndex, errorStrength);
        }
    };

    app.pages.ditherEditor.ditherAlgorithmRegistry.registerProcessor({
        id: 'error-diffusion',
        apply: function apply(imageData, options) {
            return app.pages.ditherEditor.errorDiffusion.apply(imageData, options);
        }
    });

    app.pages.ditherEditor.ditherAlgorithmRegistry.registerProcessor({
        id: 'adaptive-error-diffusion',
        apply: function apply(imageData, options, algorithm) {
            return applyAdaptiveFloydSteinberg(imageData, options, algorithm.adaptiveRadius || 1);
        }
    });
})(window.DitherApp);
