(function (app) {
    var MODE_EMPTY = 'empty';
    var MODE_CROP = 'crop';
    var MODE_EDIT = 'edit';
    var EDIT_PANEL_IDS = ['resize', 'adjust', 'palette', 'dither'];

    function hasImage(state) {
        return Boolean(state && state.sourceImageData);
    }

    function syncLegacyPanelOpenFlag(state) {
        state.settingsPanelOpen = Object.keys(state.openToolPanels || {}).some(function (id) {
            return state.openToolPanels[id];
        });
    }

    function openPanels(state, ids, activeTool) {
        state.openToolPanels = {};
        ids.forEach(function (id) {
            state.openToolPanels[id] = true;
        });
        state.activeTool = activeTool || ids[0] || null;
        syncLegacyPanelOpenFlag(state);
    }

    function availablePanelIds(state, ids) {
        var registry = app.pages.ditherEditor.featureRegistry;
        var tools = registry && registry.dockTools ? registry.dockTools(state.pipeline) : [];
        var availableIds = tools.map(function (tool) {
            return tool.id;
        });
        return ids.filter(function (id) {
            return availableIds.indexOf(id) !== -1;
        });
    }

    function normalize(state) {
        if (!hasImage(state)) {
            return enterEmpty(state);
        }
        if (state.mode === MODE_CROP || (state.openToolPanels && state.openToolPanels.crop)) {
            enterCrop(state);
            return state.mode;
        }
        normalizeEdit(state);
        return state.mode;
    }

    function enterEmpty(state) {
        state.mode = MODE_EMPTY;
        openPanels(state, ['input'], 'input');
        state.viewMode = 'result';
        return state.mode;
    }

    function enterCrop(state) {
        if (!hasImage(state)) {
            return enterEmpty(state);
        }
        state.mode = MODE_CROP;
        openPanels(state, ['crop'], 'crop');
        state.viewMode = 'result';
        return state.mode;
    }

    function enterEdit(state) {
        if (!hasImage(state)) {
            return enterEmpty(state);
        }
        var editPanelIds = availablePanelIds(state, EDIT_PANEL_IDS);
        normalizeEdit(state);
        openPanels(state, editPanelIds, editPanelIds[0]);
        return state.mode;
    }

    function normalizeEdit(state) {
        state.mode = MODE_EDIT;
        state.openToolPanels = state.openToolPanels || {};
        state.openToolPanels.crop = false;
        state.viewMode = state.viewMode === 'original' ? 'original' : 'result';
        syncLegacyPanelOpenFlag(state);
        return state.mode;
    }

    function openInputPanel(state) {
        if (!hasImage(state)) {
            return enterEmpty(state);
        }
        state.mode = MODE_EDIT;
        openPanels(state, ['input'], 'input');
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
        openInputPanel: openInputPanel,
        canUseTool: canUseTool,
        canUseAction: canUseAction
    };
})(window.DitherApp);
