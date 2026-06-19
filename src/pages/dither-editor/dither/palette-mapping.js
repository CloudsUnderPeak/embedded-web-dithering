(function (app) {
    // Palette Mapping 是 Dither 的選色層：決定輸入 RGB 如何落到固定 palette。
    app.pages.ditherEditor = app.pages.ditherEditor || {};

    function clampByte(value) {
        return value < 0 ? 0 : (value > 255 ? 255 : value);
    }

    function normalizeId(id) {
        if (id === 'pair-mix') {
            return 'pair-mix';
        }
        if (id === 'tri-mix') {
            return 'tri-mix';
        }
        return 'nearest-color';
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

    function nearestIndex(palette, distance, r, g, b) {
        var bestIndex = 0;
        var bestDistance = Infinity;
        var color = { r: r, g: g, b: b };
        for (var i = 0; i < palette.length; i += 1) {
            var current = distance(color, {
                r: palette.red[i],
                g: palette.green[i],
                b: palette.blue[i]
            });
            if (current < bestDistance) {
                bestDistance = current;
                bestIndex = i;
            }
        }
        return bestIndex;
    }

    function mixChoice(palette, distance, r, g, b) {
        var bestNearest = nearestIndex(palette, distance, r, g, b);
        var best = {
            a: bestNearest,
            b: bestNearest,
            ratio: 0,
            distance: Infinity
        };
        var target = { r: r, g: g, b: b };

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
                var mixed = {
                    r: ar + vr * ratio,
                    g: ag + vg * ratio,
                    b: ab + vb * ratio
                };
                var current = distance(target, mixed);
                if (current < best.distance) {
                    best.a = a;
                    best.b = bIndex;
                    best.ratio = ratio;
                    best.distance = current;
                }
            }
        }

        return best;
    }

    function topCandidateIndexes(palette, distance, r, g, b, limit) {
        var target = { r: r, g: g, b: b };
        var candidates = [];
        for (var i = 0; i < palette.length; i += 1) {
            var score = distance(target, colorFromIndex(palette, i));
            candidates.push({ index: i, score: score });
        }
        candidates.sort(function (a, b) {
            return a.score - b.score;
        });
        return candidates.slice(0, Math.min(limit, candidates.length)).map(function (candidate) {
            return candidate.index;
        });
    }

    function barycentricWeights(palette, a, bIndex, c, r, g, b) {
        var ar = palette.red[a];
        var ag = palette.green[a];
        var ab = palette.blue[a];
        var v0r = palette.red[bIndex] - ar;
        var v0g = palette.green[bIndex] - ag;
        var v0b = palette.blue[bIndex] - ab;
        var v1r = palette.red[c] - ar;
        var v1g = palette.green[c] - ag;
        var v1b = palette.blue[c] - ab;
        var v2r = r - ar;
        var v2g = g - ag;
        var v2b = b - ab;
        var d00 = v0r * v0r + v0g * v0g + v0b * v0b;
        var d01 = v0r * v1r + v0g * v1g + v0b * v1b;
        var d11 = v1r * v1r + v1g * v1g + v1b * v1b;
        var d20 = v2r * v0r + v2g * v0g + v2b * v0b;
        var d21 = v2r * v1r + v2g * v1g + v2b * v1b;
        var denom = d00 * d11 - d01 * d01;

        if (Math.abs(denom) < 0.000001) {
            return null;
        }

        var second = (d11 * d20 - d01 * d21) / denom;
        var third = (d00 * d21 - d01 * d20) / denom;
        var first = 1 - second - third;
        first = Math.max(0, first);
        second = Math.max(0, second);
        third = Math.max(0, third);
        var total = first + second + third;
        if (!total) {
            return null;
        }
        return [first / total, second / total, third / total];
    }

    function triChoice(palette, distance, r, g, b) {
        var candidates = topCandidateIndexes(palette, distance, r, g, b, 6);
        var target = { r: r, g: g, b: b };
        var nearest = candidates[0] || 0;
        var best = {
            indexes: [nearest, nearest, nearest],
            weights: [1, 0, 0],
            distance: Infinity
        };

        for (var i = 0; i < candidates.length - 2; i += 1) {
            for (var j = i + 1; j < candidates.length - 1; j += 1) {
                for (var k = j + 1; k < candidates.length; k += 1) {
                    var a = candidates[i];
                    var bIndex = candidates[j];
                    var c = candidates[k];
                    var weights = barycentricWeights(palette, a, bIndex, c, r, g, b);
                    if (!weights) {
                        continue;
                    }
                    var mixed = {
                        r: palette.red[a] * weights[0]
                            + palette.red[bIndex] * weights[1]
                            + palette.red[c] * weights[2],
                        g: palette.green[a] * weights[0]
                            + palette.green[bIndex] * weights[1]
                            + palette.green[c] * weights[2],
                        b: palette.blue[a] * weights[0]
                            + palette.blue[bIndex] * weights[1]
                            + palette.blue[c] * weights[2]
                    };
                    var current = distance(target, mixed);
                    if (current < best.distance) {
                        best.indexes = [a, bIndex, c];
                        best.weights = weights;
                        best.distance = current;
                    }
                }
            }
        }

        return best;
    }

    function colorFromIndex(palette, index) {
        return {
            r: palette.red[index],
            g: palette.green[index],
            b: palette.blue[index]
        };
    }

    function createNearestMapper(palette, colorDistance) {
        var nearestColor = app.core.paletteUtils.createNearestColorFinder(palette.source, colorDistance);
        return {
            id: 'nearest-color',
            mapColor: function mapColor(r, g, b) {
                return nearestColor({ r: r, g: g, b: b });
            }
        };
    }

    function createPairMixMapper(palette, colorDistance) {
        var distance = app.core.paletteUtils.createColorDistanceMeasurer(colorDistance);
        return {
            id: 'pair-mix',
            mapColor: function mapColor(r, g, b, threshold) {
                var choice = mixChoice(palette, distance, r, g, b);
                var cutoff = Number.isFinite(threshold) ? threshold : 0.5;
                return colorFromIndex(palette, choice.ratio > cutoff ? choice.b : choice.a);
            }
        };
    }

    function createTriMixMapper(palette, colorDistance) {
        var distance = app.core.paletteUtils.createColorDistanceMeasurer(colorDistance);
        return {
            id: 'tri-mix',
            mapColor: function mapColor(r, g, b, threshold) {
                var choice = triChoice(palette, distance, r, g, b);
                var cutoff = Number.isFinite(threshold) ? threshold : null;
                var selected = choice.indexes[0];

                if (cutoff !== null) {
                    if (cutoff > choice.weights[0] + choice.weights[1]) {
                        selected = choice.indexes[2];
                    } else if (cutoff > choice.weights[0]) {
                        selected = choice.indexes[1];
                    }
                } else {
                    var bestWeight = choice.weights[0];
                    for (var i = 1; i < choice.weights.length; i += 1) {
                        if (choice.weights[i] > bestWeight) {
                            bestWeight = choice.weights[i];
                            selected = choice.indexes[i];
                        }
                    }
                }

                return colorFromIndex(palette, selected);
            }
        };
    }

    app.pages.ditherEditor.paletteMapping = {
        normalizeId: normalizeId,
        createMapper: function createMapper(options) {
            var palette = normalizedPalette(options && options.palette);
            var colorDistance = options && options.colorDistance;
            var id = normalizeId(options && options.paletteMapping);
            if (id === 'pair-mix' && palette.length >= 2) {
                return createPairMixMapper(palette, colorDistance);
            }
            if (id === 'tri-mix' && palette.length >= 3) {
                return createTriMixMapper(palette, colorDistance);
            }
            return createNearestMapper(palette, colorDistance);
        }
    };
})(window.DitherApp);
