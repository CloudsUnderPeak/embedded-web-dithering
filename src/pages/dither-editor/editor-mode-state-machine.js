(function (app) {
    var MODE_EMPTY = 'empty';
    var MODE_CROP = 'crop';
    var MODE_EDIT = 'edit';

    function hasImage(state) {
        return Boolean(state && state.sourceImageData);
    }

    function normalize(state) {
        if (!hasImage(state)) {
            state.mode = MODE_EMPTY;
            state.openToolPanels = { input: true };
            state.activeTool = 'input';
            state.viewMode = 'result';
            return state.mode;
        }
        if (state.mode === MODE_CROP || (state.openToolPanels && state.openToolPanels.crop)) {
            enterCrop(state);
            return state.mode;
        }
        enterEdit(state);
        return state.mode;
    }

    function enterEmpty(state) {
        state.mode = MODE_EMPTY;
        state.openToolPanels = { input: true };
        state.activeTool = 'input';
        state.viewMode = 'result';
        return state.mode;
    }

    function enterCrop(state) {
        if (!hasImage(state)) {
            return enterEmpty(state);
        }
        var inputOpen = Boolean(state.openToolPanels && state.openToolPanels.input);
        state.mode = MODE_CROP;
        state.openToolPanels = { input: inputOpen };
        state.openToolPanels.crop = true;
        state.activeTool = 'crop';
        state.viewMode = 'result';
        return state.mode;
    }

    function enterEdit(state) {
        if (!hasImage(state)) {
            return enterEmpty(state);
        }
        state.mode = MODE_EDIT;
        state.openToolPanels = state.openToolPanels || {};
        state.openToolPanels.crop = false;
        state.viewMode = state.viewMode === 'original' ? 'original' : 'result';
        return state.mode;
    }

    function canUseTool(state, id) {
        if (!hasImage(state) || state.mode === MODE_EMPTY) {
            return id === 'input';
        }
        if (state.mode === MODE_CROP) {
            return id === 'input' || id === 'crop';
        }
        return true;
    }

    function canUseAction(state, id) {
        if (!hasImage(state)) {
            return false;
        }
        return state.mode === MODE_EDIT || id === 'input';
    }

    app.pages.ditherEditor = app.pages.ditherEditor || {};
    app.pages.ditherEditor.editorModeStateMachine = {
        modes: {
            EMPTY: MODE_EMPTY,
            CROP: MODE_CROP,
            EDIT: MODE_EDIT
        },
        normalize: normalize,
        enterEmpty: enterEmpty,
        enterCrop: enterCrop,
        enterEdit: enterEdit,
        canUseTool: canUseTool,
        canUseAction: canUseAction
    };
})(window.DitherApp);
