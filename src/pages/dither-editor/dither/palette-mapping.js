(function (app) {
    // Palette Mapping 是 Dither 的選色層：決定輸入 RGB 如何落到固定 palette。
    // Dither processor 只呼叫 mapColor / mapThresholdColor，不應知道具體 mapping id。
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
        var red = new Uint8ClampedArray(source.length);
        var green = new Uint8ClampedArray(source.length);
        var blue = new Uint8ClampedArray(source.length);
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

    function createDistanceContext(colorDistanceId) {
        var mode = app.core.paletteUtils.normalizeColorDistanceId(colorDistanceId);
        if (mode === 'manhattan-rgb') {
            return {
                rgb: function rgb(r1, g1, b1, r2, g2, b2) {
                    return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
                }
            };
        }
        if (mode === 'manhattan-bt709') {
            return {
                rgb: function rgb(r1, g1, b1, r2, g2, b2) {
                    return 0.2126 * Math.abs(r1 - r2)
                        + 0.7152 * Math.abs(g1 - g2)
                        + 0.0722 * Math.abs(b1 - b2);
                }
            };
        }
        if (mode === 'euclidean-rgb') {
            return {
                rgb: function rgb(r1, g1, b1, r2, g2, b2) {
                    var dr = r1 - r2;
                    var dg = g1 - g2;
                    var db = b1 - b2;
                    return dr * dr + dg * dg + db * db;
                }
            };
        }
        if (mode === 'euclidean-bt709') {
            return {
                rgb: function rgb(r1, g1, b1, r2, g2, b2) {
                    var dr = r1 - r2;
                    var dg = g1 - g2;
                    var db = b1 - b2;
                    return 0.2126 * dr * dr + 0.7152 * dg * dg + 0.0722 * db * db;
                }
            };
        }

        var measure = app.core.paletteUtils.createColorDistanceMeasurer(mode);
        var a = { r: 0, g: 0, b: 0 };
        var b = { r: 0, g: 0, b: 0 };
        return {
            rgb: function rgb(r1, g1, b1, r2, g2, b2) {
                a.r = r1;
                a.g = g1;
                a.b = b1;
                b.r = r2;
                b.g = g2;
                b.b = b2;
                return measure(a, b);
            }
        };
    }

    function nearestIndex(palette, distance, r, g, b) {
        var bestIndex = 0;
        var bestDistance = Infinity;
        for (var i = 0; i < palette.length; i += 1) {
            var current = distance.rgb(
                r,
                g,
                b,
                palette.red[i],
                palette.green[i],
                palette.blue[i]
            );
            if (current < bestDistance) {
                bestDistance = current;
                bestIndex = i;
            }
        }
        return bestIndex;
    }

    function setResultFromIndex(palette, index, result) {
        result.index = index;
        result.r = palette.red[index];
        result.g = palette.green[index];
        result.b = palette.blue[index];
        return result;
    }

    function thresholdOffset(threshold, thresholdScale) {
        var cutoff = Number.isFinite(threshold) ? threshold : 0.5;
        var scale = Number.isFinite(thresholdScale) ? thresholdScale : 0;
        return (cutoff - 0.5) * scale;
    }

    function createPairCache(palette) {
        var pairs = [];
        for (var a = 0; a < palette.length; a += 1) {
            for (var b = a + 1; b < palette.length; b += 1) {
                var vr = palette.red[b] - palette.red[a];
                var vg = palette.green[b] - palette.green[a];
                var vb = palette.blue[b] - palette.blue[a];
                var lengthSq = vr * vr + vg * vg + vb * vb;
                if (!lengthSq) {
                    continue;
                }
                pairs.push({
                    a: a,
                    b: b,
                    vr: vr,
                    vg: vg,
                    vb: vb,
                    invLengthSq: 1 / lengthSq
                });
            }
        }
        return pairs;
    }

    function mixChoice(palette, distance, pairs, r, g, b, choice) {
        var bestNearest = nearestIndex(palette, distance, r, g, b);
        choice.a = bestNearest;
        choice.b = bestNearest;
        choice.ratio = 0;
        choice.distance = Infinity;

        for (var i = 0; i < pairs.length; i += 1) {
            var pair = pairs[i];
            var ar = palette.red[pair.a];
            var ag = palette.green[pair.a];
            var ab = palette.blue[pair.a];
            var ratio = ((r - ar) * pair.vr + (g - ag) * pair.vg + (b - ab) * pair.vb)
                * pair.invLengthSq;
            ratio = Math.max(0, Math.min(1, ratio));
            var mixedR = ar + pair.vr * ratio;
            var mixedG = ag + pair.vg * ratio;
            var mixedB = ab + pair.vb * ratio;
            var current = distance.rgb(r, g, b, mixedR, mixedG, mixedB);
            if (current < choice.distance) {
                choice.a = pair.a;
                choice.b = pair.b;
                choice.ratio = ratio;
                choice.distance = current;
            }
        }

        return choice;
    }

    function topCandidateIndexes(palette, distance, r, g, b, indexes, scores) {
        var count = 0;
        for (var i = 0; i < palette.length; i += 1) {
            var score = distance.rgb(r, g, b, palette.red[i], palette.green[i], palette.blue[i]);
            var insertAt = count;
            while (insertAt > 0 && score < scores[insertAt - 1]) {
                if (insertAt < indexes.length) {
                    indexes[insertAt] = indexes[insertAt - 1];
                    scores[insertAt] = scores[insertAt - 1];
                }
                insertAt -= 1;
            }
            if (insertAt < indexes.length) {
                indexes[insertAt] = i;
                scores[insertAt] = score;
            }
            count = Math.min(indexes.length, count + 1);
        }
        return count;
    }

    var TRI_CANDIDATE_COMBINATIONS = (function buildTriCandidateCombinations() {
        var output = [];
        for (var i = 0; i < 4; i += 1) {
            for (var j = i + 1; j < 5; j += 1) {
                for (var k = j + 1; k < 6; k += 1) {
                    output.push(i, j, k);
                }
            }
        }
        return output;
    })();

    function triChoice(palette, distance, r, g, b, buffers) {
        var count = topCandidateIndexes(
            palette,
            distance,
            r,
            g,
            b,
            buffers.candidateIndexes,
            buffers.candidateScores
        );
        var nearest = buffers.candidateIndexes[0] || 0;
        buffers.choiceIndexes[0] = nearest;
        buffers.choiceIndexes[1] = nearest;
        buffers.choiceIndexes[2] = nearest;
        buffers.choiceWeights[0] = 1;
        buffers.choiceWeights[1] = 0;
        buffers.choiceWeights[2] = 0;
        buffers.choiceDistance = Infinity;

        for (var comboIndex = 0; comboIndex < TRI_CANDIDATE_COMBINATIONS.length; comboIndex += 3) {
            var firstPosition = TRI_CANDIDATE_COMBINATIONS[comboIndex];
            var secondPosition = TRI_CANDIDATE_COMBINATIONS[comboIndex + 1];
            var thirdPosition = TRI_CANDIDATE_COMBINATIONS[comboIndex + 2];
            if (thirdPosition >= count) {
                continue;
            }

            var a = buffers.candidateIndexes[firstPosition];
            var bIndex = buffers.candidateIndexes[secondPosition];
            var c = buffers.candidateIndexes[thirdPosition];
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
                continue;
            }

            var second = (d11 * d20 - d01 * d21) / denom;
            var third = (d00 * d21 - d01 * d20) / denom;
            var first = 1 - second - third;
            first = Math.max(0, first);
            second = Math.max(0, second);
            third = Math.max(0, third);
            var total = first + second + third;
            if (!total) {
                continue;
            }
            var firstWeight = first / total;
            var secondWeight = second / total;
            var thirdWeight = third / total;
            var mixedR = palette.red[a] * firstWeight
                + palette.red[bIndex] * secondWeight
                + palette.red[c] * thirdWeight;
            var mixedG = palette.green[a] * firstWeight
                + palette.green[bIndex] * secondWeight
                + palette.green[c] * thirdWeight;
            var mixedB = palette.blue[a] * firstWeight
                + palette.blue[bIndex] * secondWeight
                + palette.blue[c] * thirdWeight;
            var current = distance.rgb(r, g, b, mixedR, mixedG, mixedB);
            if (current < buffers.choiceDistance) {
                buffers.choiceIndexes[0] = a;
                buffers.choiceIndexes[1] = bIndex;
                buffers.choiceIndexes[2] = c;
                buffers.choiceWeights[0] = firstWeight;
                buffers.choiceWeights[1] = secondWeight;
                buffers.choiceWeights[2] = thirdWeight;
                buffers.choiceDistance = current;
            }
        }

        return buffers;
    }

    function createNearestMapper(palette, distance) {
        var result = { index: 0, r: 0, g: 0, b: 0 };
        return {
            id: 'nearest-color',
            palette: palette,
            length: palette.length,
            mapColor: function mapColor(r, g, b) {
                return setResultFromIndex(palette, nearestIndex(palette, distance, r, g, b), result);
            },
            mapThresholdColor: function mapThresholdColor(r, g, b, threshold, thresholdScale) {
                var amount = thresholdOffset(threshold, thresholdScale);
                return this.mapColor(r + amount, g + amount, b + amount);
            }
        };
    }

    function createPairMixMapper(palette, distance) {
        var pairs = createPairCache(palette);
        var result = { index: 0, r: 0, g: 0, b: 0 };
        var choice = { a: 0, b: 0, ratio: 0, distance: Infinity };
        return {
            id: 'pair-mix',
            palette: palette,
            length: palette.length,
            mapColor: function mapColor(r, g, b, threshold) {
                mixChoice(palette, distance, pairs, r, g, b, choice);
                var cutoff = Number.isFinite(threshold) ? threshold : 0.5;
                return setResultFromIndex(palette, choice.ratio > cutoff ? choice.b : choice.a, result);
            },
            mapThresholdColor: function mapThresholdColor(r, g, b, threshold) {
                return this.mapColor(r, g, b, threshold);
            }
        };
    }

    function createTriMixMapper(palette, distance) {
        var result = { index: 0, r: 0, g: 0, b: 0 };
        var buffers = {
            candidateIndexes: new Array(6),
            candidateScores: new Array(6),
            choiceIndexes: [0, 0, 0],
            choiceWeights: [1, 0, 0],
            choiceDistance: Infinity
        };
        return {
            id: 'tri-mix',
            palette: palette,
            length: palette.length,
            mapColor: function mapColor(r, g, b, threshold) {
                triChoice(palette, distance, r, g, b, buffers);
                var cutoff = Number.isFinite(threshold) ? threshold : null;
                var selected = buffers.choiceIndexes[0];

                if (cutoff !== null) {
                    if (cutoff > buffers.choiceWeights[0] + buffers.choiceWeights[1]) {
                        selected = buffers.choiceIndexes[2];
                    } else if (cutoff > buffers.choiceWeights[0]) {
                        selected = buffers.choiceIndexes[1];
                    }
                } else {
                    var bestWeight = buffers.choiceWeights[0];
                    for (var i = 1; i < buffers.choiceWeights.length; i += 1) {
                        if (buffers.choiceWeights[i] > bestWeight) {
                            bestWeight = buffers.choiceWeights[i];
                            selected = buffers.choiceIndexes[i];
                        }
                    }
                }

                return setResultFromIndex(palette, selected, result);
            },
            mapThresholdColor: function mapThresholdColor(r, g, b, threshold) {
                return this.mapColor(r, g, b, threshold);
            }
        };
    }

    app.pages.ditherEditor.paletteMapping = {
        normalizeId: normalizeId,
        createMapper: function createMapper(options) {
            var palette = normalizedPalette(options && options.palette);
            var distance = createDistanceContext(options && options.colorDistance);
            var id = normalizeId(options && options.paletteMapping);
            if (id === 'pair-mix' && palette.length >= 2) {
                return createPairMixMapper(palette, distance);
            }
            if (id === 'tri-mix' && palette.length >= 3) {
                return createTriMixMapper(palette, distance);
            }
            return createNearestMapper(palette, distance);
        }
    };
})(window.DitherApp);
