(function (app) {
    // Palette 共用計算工具。
    // 目前使用 RGB squared distance；不做感知色差，保持演算法簡單且可預期。
    // 計算兩個 RGB 顏色的平方距離；避免開根號以降低大量像素處理成本。
    function distance(a, b) {
        var dr = a.r - b.r;
        var dg = a.g - b.g;
        var db = a.b - b.b;
        return dr * dr + dg * dg + db * db;
    }

    app.core.paletteUtils = {
        // 從 palette 中找出和目標色最接近的顏色。
        nearestColor: function nearestColor(color, palette) {
            var best = palette[0];
            var bestDistance = Infinity;
            palette.forEach(function (candidate) {
                var current = distance(color, candidate);
                if (current < bestDistance) {
                    bestDistance = current;
                    best = candidate;
                }
            });
            return best;
        }
    };
})(window.DitherApp);
