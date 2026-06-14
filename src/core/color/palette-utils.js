(function (app) {
    // Palette 共用計算工具。
    // 預設使用 RgbQuant-style Euclidean distance，也就是 BT.709 weighted RGB。
    var DEFAULT_COLOR_DISTANCE_ID = 'euclidean-bt709';

    function clampByte(value) {
        return Math.max(0, Math.min(255, Number(value) || 0));
    }

    function euclideanRgbDistance(a, b) {
        var dr = a.r - b.r;
        var dg = a.g - b.g;
        var db = a.b - b.b;
        return dr * dr + dg * dg + db * db;
    }

    function manhattanRgbDistance(a, b) {
        return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
    }

    function euclideanBt709Distance(a, b) {
        var dr = a.r - b.r;
        var dg = a.g - b.g;
        var db = a.b - b.b;
        return 0.2126 * dr * dr + 0.7152 * dg * dg + 0.0722 * db * db;
    }

    function manhattanBt709Distance(a, b) {
        return 0.2126 * Math.abs(a.r - b.r)
            + 0.7152 * Math.abs(a.g - b.g)
            + 0.0722 * Math.abs(a.b - b.b);
    }

    function srgbToLinear(value) {
        var channel = clampByte(value) / 255;
        return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    }

    function labPivot(value) {
        var delta = 6 / 29;
        return value > delta * delta * delta ? Math.cbrt(value) : value / (3 * delta * delta) + 4 / 29;
    }

    function rgbToLab(color) {
        var r = srgbToLinear(color.r);
        var g = srgbToLinear(color.g);
        var b = srgbToLinear(color.b);
        var x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
        var y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
        var z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
        var fx = labPivot(x / 0.95047);
        var fy = labPivot(y);
        var fz = labPivot(z / 1.08883);
        return {
            l: 116 * fy - 16,
            a: 500 * (fx - fy),
            b: 200 * (fy - fz)
        };
    }

    function degreesToRadians(value) {
        return value * Math.PI / 180;
    }

    function hueAngle(a, b) {
        if (a === 0 && b === 0) {
            return 0;
        }
        var hue = Math.atan2(b, a) * 180 / Math.PI;
        return hue < 0 ? hue + 360 : hue;
    }

    function ciede2000Distance(lab1, lab2) {
        var l1 = lab1.l;
        var a1 = lab1.a;
        var b1 = lab1.b;
        var l2 = lab2.l;
        var a2 = lab2.a;
        var b2 = lab2.b;
        var c1 = Math.sqrt(a1 * a1 + b1 * b1);
        var c2 = Math.sqrt(a2 * a2 + b2 * b2);
        var cBar = (c1 + c2) / 2;
        var cBar7 = Math.pow(cBar, 7);
        var g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + Math.pow(25, 7))));
        var a1Prime = (1 + g) * a1;
        var a2Prime = (1 + g) * a2;
        var c1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
        var c2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);
        var h1Prime = hueAngle(a1Prime, b1);
        var h2Prime = hueAngle(a2Prime, b2);
        var deltaLPrime = l2 - l1;
        var deltaCPrime = c2Prime - c1Prime;
        var deltaHPrime = 0;

        if (c1Prime * c2Prime !== 0) {
            deltaHPrime = h2Prime - h1Prime;
            if (Math.abs(deltaHPrime) > 180) {
                deltaHPrime += deltaHPrime > 0 ? -360 : 360;
            }
        }

        var deltaBigHPrime = 2 * Math.sqrt(c1Prime * c2Prime)
            * Math.sin(degreesToRadians(deltaHPrime / 2));
        var lBarPrime = (l1 + l2) / 2;
        var cBarPrime = (c1Prime + c2Prime) / 2;
        var hBarPrime = h1Prime + h2Prime;
        if (c1Prime * c2Prime !== 0) {
            if (Math.abs(h1Prime - h2Prime) <= 180) {
                hBarPrime = (h1Prime + h2Prime) / 2;
            } else if (h1Prime + h2Prime < 360) {
                hBarPrime = (h1Prime + h2Prime + 360) / 2;
            } else {
                hBarPrime = (h1Prime + h2Prime - 360) / 2;
            }
        }
        var t = 1
            - 0.17 * Math.cos(degreesToRadians(hBarPrime - 30))
            + 0.24 * Math.cos(degreesToRadians(2 * hBarPrime))
            + 0.32 * Math.cos(degreesToRadians(3 * hBarPrime + 6))
            - 0.20 * Math.cos(degreesToRadians(4 * hBarPrime - 63));
        var deltaTheta = 30 * Math.exp(-Math.pow((hBarPrime - 275) / 25, 2));
        var cBarPrime7 = Math.pow(cBarPrime, 7);
        var rc = 2 * Math.sqrt(cBarPrime7 / (cBarPrime7 + Math.pow(25, 7)));
        var sl = 1 + (0.015 * Math.pow(lBarPrime - 50, 2))
            / Math.sqrt(20 + Math.pow(lBarPrime - 50, 2));
        var sc = 1 + 0.045 * cBarPrime;
        var sh = 1 + 0.015 * cBarPrime * t;
        var rt = -Math.sin(degreesToRadians(2 * deltaTheta)) * rc;
        var termL = deltaLPrime / sl;
        var termC = deltaCPrime / sc;
        var termH = deltaBigHPrime / sh;
        return Math.max(0, termL * termL + termC * termC + termH * termH + rt * termC * termH);
    }

    function normalizeColorDistanceId(id) {
        // 保留舊 id 相容，並轉成明確標示有無 BT.709 權重的新命名。
        if (id === 'bt709' || id === 'euclidean') {
            return 'euclidean-bt709';
        }
        if (id === 'rgb') {
            return 'euclidean-rgb';
        }
        if (id === 'manhattan') {
            return 'manhattan-rgb';
        }
        var metrics = app.pages
            && app.pages.ditherEditor
            && app.pages.ditherEditor.config
            && app.pages.ditherEditor.config.colorDistanceMetrics;
        var fallback = app.pages
            && app.pages.ditherEditor
            && app.pages.ditherEditor.constants
            && app.pages.ditherEditor.constants.DEFAULT_COLOR_DISTANCE_ID
            || DEFAULT_COLOR_DISTANCE_ID;
        if (metrics && metrics.some(function (metric) { return metric.id === id; })) {
            return id;
        }
        return fallback;
    }

    function createNearestColorFinder(palette, colorDistanceId) {
        var mode = normalizeColorDistanceId(colorDistanceId);
        var candidates = (palette || []).map(function (color) {
            var candidate = { color: color };
            if (mode === 'ciede2000') {
                candidate.lab = rgbToLab(color);
            }
            return candidate;
        });

        return function findNearestColor(color) {
            if (!candidates.length) {
                return color;
            }
            var best = candidates[0].color;
            var bestDistance = Infinity;
            var sourceLab = mode === 'ciede2000' ? rgbToLab(color) : null;
            candidates.forEach(function (candidate) {
                var current;
                if (mode === 'manhattan-rgb') {
                    current = manhattanRgbDistance(color, candidate.color);
                } else if (mode === 'manhattan-bt709') {
                    current = manhattanBt709Distance(color, candidate.color);
                } else if (mode === 'euclidean-bt709') {
                    current = euclideanBt709Distance(color, candidate.color);
                } else if (mode === 'ciede2000') {
                    current = ciede2000Distance(sourceLab, candidate.lab);
                } else {
                    current = euclideanRgbDistance(color, candidate.color);
                }
                if (current < bestDistance) {
                    bestDistance = current;
                    best = candidate.color;
                }
            });
            return best;
        };
    }

    app.core.paletteUtils = {
        createNearestColorFinder: createNearestColorFinder,
        normalizeColorDistanceId: normalizeColorDistanceId,
        // 從 palette 中找出和目標色最接近的顏色。
        nearestColor: function nearestColor(color, palette, colorDistanceId) {
            return createNearestColorFinder(palette, colorDistanceId)(color);
        }
    };
})(window.DitherApp);
