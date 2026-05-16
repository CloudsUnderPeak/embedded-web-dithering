(function (app) {
    // 色彩通用工具：只處理數值轉換，不知道 palette preset 或 Dither algorithm。
    app.core.colorUtils = {
        // 將任意數值限制成 0-255 的整數色彩通道。
        clampByte: function clampByte(value) {
            return Math.min(255, Math.max(0, Math.round(value)));
        },
        // 依 Rec. 709 權重計算亮度，給圖案抖色等灰階判斷使用。
        luminance: function luminance(r, g, b) {
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        },
        // 將 #rrggbb 轉成 RGB 物件，給色票 input 使用。
        hexToRgb: function hexToRgb(hex) {
            var normalized = String(hex || '#000000').replace('#', '');
            return {
                r: parseInt(normalized.slice(0, 2), 16),
                g: parseInt(normalized.slice(2, 4), 16),
                b: parseInt(normalized.slice(4, 6), 16)
            };
        },
        // 將 RGB 物件轉成 #rrggbb 字串。
        rgbToHex: function rgbToHex(color) {
            function part(value) {
                return Math.min(255, Math.max(0, value)).toString(16).padStart(2, '0');
            }
            return '#' + part(color.r) + part(color.g) + part(color.b);
        }
    };
})(window.DitherApp);
