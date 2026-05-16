(function (app) {
    // Dither matrices 是演算法參數資料，不含執行邏輯。
    // error diffusion 使用一維 offset/factor；ordered dithering 使用二維 Bayer threshold map。
    app.pages.ditherEditor = app.pages.ditherEditor || {};
    app.pages.ditherEditor.ditherMatrices = {
        floydSteinberg: [
            { x: 1, y: 0, factor: 7 / 16 },
            { x: -1, y: 1, factor: 3 / 16 },
            { x: 0, y: 1, factor: 5 / 16 },
            { x: 1, y: 1, factor: 1 / 16 }
        ],
        atkinson: [
            { x: 1, y: 0, factor: 1 / 8 },
            { x: 2, y: 0, factor: 1 / 8 },
            { x: -1, y: 1, factor: 1 / 8 },
            { x: 0, y: 1, factor: 1 / 8 },
            { x: 1, y: 1, factor: 1 / 8 },
            { x: 0, y: 2, factor: 1 / 8 }
        ],
        jarvis: [
            { x: 1, y: 0, factor: 7 / 48 },
            { x: 2, y: 0, factor: 5 / 48 },
            { x: -2, y: 1, factor: 3 / 48 },
            { x: -1, y: 1, factor: 5 / 48 },
            { x: 0, y: 1, factor: 7 / 48 },
            { x: 1, y: 1, factor: 5 / 48 },
            { x: 2, y: 1, factor: 3 / 48 },
            { x: -2, y: 2, factor: 1 / 48 },
            { x: -1, y: 2, factor: 3 / 48 },
            { x: 0, y: 2, factor: 5 / 48 },
            { x: 1, y: 2, factor: 3 / 48 },
            { x: 2, y: 2, factor: 1 / 48 }
        ],
        stucki: [
            { x: 1, y: 0, factor: 8 / 42 },
            { x: 2, y: 0, factor: 4 / 42 },
            { x: -2, y: 1, factor: 2 / 42 },
            { x: -1, y: 1, factor: 4 / 42 },
            { x: 0, y: 1, factor: 8 / 42 },
            { x: 1, y: 1, factor: 4 / 42 },
            { x: 2, y: 1, factor: 2 / 42 },
            { x: -2, y: 2, factor: 1 / 42 },
            { x: -1, y: 2, factor: 2 / 42 },
            { x: 0, y: 2, factor: 4 / 42 },
            { x: 1, y: 2, factor: 2 / 42 },
            { x: 2, y: 2, factor: 1 / 42 }
        ],
        bayer4: [
            [0, 8, 2, 10],
            [12, 4, 14, 6],
            [3, 11, 1, 9],
            [15, 7, 13, 5]
        ]
    };
})(window.DitherApp);
