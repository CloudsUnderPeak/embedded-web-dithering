(function (app) {
    // Pipeline runner 是純執行器：依 state.pipeline 決定順序，逐步把 ImageData 丟給 operation。
    // 它不讀 DOM，也不決定哪些 tool 顯示；那些責任在 feature/page 層。
    function orderedOperationIds(state) {
        var pipeline = state.pipeline;
        return pipeline.fixedBefore
            .concat(pipeline.effectsOrder)
            .concat(pipeline.fixedAfter)
            .filter(function (id) {
                // export 是 action，不是會改變 pixels 的 pipeline operation。
                return id !== 'export' && pipeline.enabled[id] !== false;
            });
    }

    function runOperationIds(inputImageData, state, order) {
        var current = inputImageData;
        for (var i = 0; i < order.length; i += 1) {
            var operation = app.pages.ditherEditor.operationRegistry.get(order[i]);
            if (!operation) {
                throw new Error('Missing operation: ' + order[i]);
            }
            // Operation 若改變 pixels 必須回傳新的 ImageData；若設定為 no-op，可回傳原物件。
            current = operation.run(current, state.settings[order[i]] || {});
        }
        return current;
    }

    app.pages.ditherEditor = app.pages.ditherEditor || {};
    app.pages.ditherEditor.pipelineRunner = {
        // 依 state.pipeline 順序執行 operation，並把每步結果傳給下一步。
        run: function run(inputImageData, state) {
            return runOperationIds(inputImageData, state, orderedOperationIds(state));
        },
        // 執行指定 panel group 對應的 pipeline operation，用於取得 prepare 後的 edit original。
        runPanelGroup: function runPanelGroup(inputImageData, state, group) {
            return runOperationIds(
                inputImageData,
                state,
                orderedOperationIds(state).filter(function (id) {
                    return app.pages.ditherEditor.featureRegistry.panelGroupFor(id) === group;
                })
            );
        }
    };
})(window.DitherApp);
