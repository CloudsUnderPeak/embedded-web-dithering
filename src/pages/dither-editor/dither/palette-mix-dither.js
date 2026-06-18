(function (app) {
    // Palette mix dither 先找最能混出目標像素的兩個 palette 色，再用不同 mask 決定落點。
    app.pages.ditherEditor = app.pages.ditherEditor || {};

    function clampByte(value) {
        return value < 0 ? 0 : (value > 255 ? 255 : value);
    }

    function normalizedPalette(palette) {
        var source = palette || [];
        var red = new Array(source.length);
        var green = new Array(source.length);
        var blue = new Array(source.length);
        for (var i = 0; i < source.length; i += 1) {
            red[i] = clampByte(Math.round(Number(source[i] && source[i].r) || 0));
            green[i] = clampByte(Math.round(Number(source[i] && source[i].g) || 0));
            blue[i] = clampByte(Math.round(Number(source[i] && source[i].b) || 0));
        }
        return {
            source: source,
            red: red,
            green: green,
            blue: blue,
            length: source.length
        };
    }

    function weightedDistance(r1, g1, b1, r2, g2, b2) {
        var dr = r1 - r2;
        var dg = g1 - g2;
        var db = b1 - b2;
        return 0.2126 * dr * dr + 0.7152 * dg * dg + 0.0722 * db * db;
    }

    function nearestIndex(palette, r, g, b) {
        var bestIndex = 0;
        var bestDistance = Infinity;
        for (var i = 0; i < palette.length; i += 1) {
            var distance = weightedDistance(r, g, b, palette.red[i], palette.green[i], palette.blue[i]);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = i;
            }
        }
        return bestIndex;
    }

    function mixChoice(palette, r, g, b) {
        var best = {
            a: nearestIndex(palette, r, g, b),
            b: nearestIndex(palette, r, g, b),
            ratio: 0,
            distance: Infinity
        };

        for (var a = 0; a < palette.length; a += 1) {
            for (var bIndex = a + 1; bIndex < palette.length; bIndex += 1) {
                var ar = palette.red[a];
                var ag = palette.green[a];
                var ab = palette.blue[a];
                var br = palette.red[bIndex];
                var bg = palette.green[bIndex];
                var bb = palette.blue[bIndex];
                var vr = br - ar;
                var vg = bg - ag;
                var vb = bb - ab;
                var lengthSq = vr * vr + vg * vg + vb * vb;
                if (!lengthSq) {
                    continue;
                }
                var ratio = ((r - ar) * vr + (g - ag) * vg + (b - ab) * vb) / lengthSq;
                ratio = Math.max(0, Math.min(1, ratio));
                var mr = ar + vr * ratio;
                var mg = ag + vg * ratio;
                var mb = ab + vb * ratio;
                var distance = weightedDistance(r, g, b, mr, mg, mb);
                if (distance < best.distance) {
                    best.a = a;
                    best.b = bIndex;
                    best.ratio = ratio;
                    best.distance = distance;
                }
            }
        }

        return best;
    }

    function buildClusteredDotMatrix(size) {
        var center = (size - 1) / 2;
        var cells = [];
        var matrix = new Array(size);
        for (var y = 0; y < size; y += 1) {
            matrix[y] = new Array(size);
            for (var x = 0; x < size; x += 1) {
                var dx = x - center;
                var dy = y - center;
                cells.push({
                    x: x,
                    y: y,
                    distance: dx * dx + dy * dy,
                    angle: Math.atan2(dy, dx)
                });
            }
        }
        cells.sort(function (a, b) {
            if (a.distance !== b.distance) {
                return a.distance - b.distance;
            }
            return a.angle - b.angle;
        });
        for (var i = 0; i < cells.length; i += 1) {
            matrix[cells[i].y][cells[i].x] = i;
        }
        return matrix;
    }

    var CLUSTERED_DOT_MATRIX = buildClusteredDotMatrix(8);

    function maskThreshold(maskName, x, y) {
        if (maskName === 'halftone') {
            var size = CLUSTERED_DOT_MATRIX.length;
            return (
                CLUSTERED_DOT_MATRIX[y % size][x % size] + 0.5
            ) / (size * size);
        }

        var matrix = app.pages.ditherEditor.ditherMatrices.blueNoise64;
        return (matrix.cell(x, y) + 0.5) / matrix.levels;
    }

    function applyPaletteMix(imageData, options, algorithm) {
        var width = imageData.width;
        var height = imageData.height;
        var source = imageData.data;
        var output = new Uint8ClampedArray(source.length);
        var palette = normalizedPalette(options.palette);
        if (palette.length < 2) {
            return imageData;
        }

        var maskName = algorithm.mixMask || 'blue-noise';
        for (var y = 0; y < height; y += 1) {
            for (var x = 0; x < width; x += 1) {
                var index = (y * width + x) * 4;
                var choice = mixChoice(
                    palette,
                    source[index],
                    source[index + 1],
                    source[index + 2]
                );
                var colorIndex = choice.ratio > maskThreshold(maskName, x, y)
                    ? choice.b
                    : choice.a;
                output[index] = palette.red[colorIndex];
                output[index + 1] = palette.green[colorIndex];
                output[index + 2] = palette.blue[colorIndex];
                output[index + 3] = 255;
            }
        }

        return new ImageData(output, width, height);
    }

    app.pages.ditherEditor.paletteMixDither = {
        apply: applyPaletteMix
    };

    app.pages.ditherEditor.ditherAlgorithmRegistry.registerProcessor({
        id: 'palette-mix',
        apply: function apply(imageData, options, algorithm) {
            return applyPaletteMix(imageData, options, algorithm);
        }
    });
})(window.DitherApp);
