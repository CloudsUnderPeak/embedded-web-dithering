(function (app) {
    // Dither Editor page 擁有這一頁的 DOM、canvas 和短期 cached state。
    // controller 管狀態與 pipeline，renderer 管 canvas，page 只負責把兩者接到 UI。
    var controller = null;
    var renderer = null;
    var overlayRenderer = null;
    var pointerMapper = null;
    var sortable = null;
    var refs = {};
    var cachedState = null;

    // 取得 UI 文字，缺字串時回傳 key 方便除錯。
    function t(key) {
        return app.i18n.en[key] || key;
    }

    // 判斷指定工具面板是否展開，並兼容早期單面板狀態欄位。
    function isToolOpen(state, id) {
        if (state.openToolPanels) {
            return Boolean(state.openToolPanels[id]);
        }
        return state.settingsPanelOpen && state.activeTool === id;
    }

    // 將新版多面板狀態同步回舊欄位，避免其他流程讀到過期布林值。
    function syncLegacyPanelOpenFlag(state) {
        state.settingsPanelOpen = Object.keys(state.openToolPanels || {}).some(function (id) {
            return state.openToolPanels[id];
        });
    }

    function modeMachine() {
        return app.pages.ditherEditor.editorModeStateMachine;
    }

    // 建立左側/下方工具列，包含 tool row、panel host 與拖曳排序綁定。
    function buildToolDock(state) {
        // Tool dock 完全由 feature registry 產生；新增/停用 feature 不應修改本函式。
        var tools = app.pages.ditherEditor.featureRegistry.dockTools(state.pipeline);
        var draggableEffectIds = app.pages.ditherEditor.operationRegistry.pipelineEffects().map(function (operation) {
            return operation.id;
        });
        refs.toolButtons = {};
        refs.toolItems = {};
        refs.toolPanelHosts = {};
        refs.toolDock = app.utils.dom.el('nav', {
            className: 'tool-dock',
            attrs: { 'aria-label': 'Editor tools' },
            children: tools.map(function (tool) {
                var isPipelineEffect = draggableEffectIds.indexOf(tool.id) !== -1;
                var buttonChildren = [];
                if (isPipelineEffect) {
                    buttonChildren.push(
                        app.utils.dom.el('span', { className: 'tool-button-icon', text: tool.icon })
                    );
                    buttonChildren.push(
                        app.utils.dom.el('span', {
                            className: 'tool-drag-handle',
                            text: '⋮⋮',
                            attrs: { 'aria-hidden': 'true' }
                        })
                    );
                } else {
                    buttonChildren.push(
                        app.utils.dom.el('span', { className: 'tool-button-icon', text: tool.icon })
                    );
                }
                buttonChildren.push(
                    app.utils.dom.el('span', { className: 'tool-button-label', text: t(tool.labelKey) })
                );
                var button = app.utils.dom.el('button', {
                    className: isPipelineEffect ? 'tool-button is-draggable' : 'tool-button',
                    attrs: {
                        type: 'button',
                        title: t(tool.labelKey),
                        'aria-label': t(tool.labelKey),
                        'data-tool': tool.id
                    },
                    children: buttonChildren
                });
                var panelHost = app.utils.dom.el('div', {
                    className: 'tool-panel-host',
                    attrs: { 'data-tool-panel-host': tool.id }
                });
                button.addEventListener('click', function () {
                    if (!modeMachine().canUseTool(controller.state, tool.id)) {
                        return;
                    }
                    if (modeMachine().isSourceTool(tool.id)) {
                        if (!controller.state.sourceImageData) {
                            modeMachine().enterSource(controller.state);
                            render(controller.state);
                            return;
                        }
                        if (isToolOpen(controller.state, tool.id)) {
                            controller.state.openToolPanels[tool.id] = false;
                            controller.state.activeTool = null;
                            syncLegacyPanelOpenFlag(controller.state);
                            render(controller.state);
                        } else {
                            controller.openSourcePanel(tool.id);
                        }
                        return;
                    }
                    if (modeMachine().isPrepareTool(tool.id)) {
                        if (isToolOpen(controller.state, tool.id)) {
                            controller.closePrepareMode();
                        } else {
                            controller.openPrepareMode();
                        }
                        return;
                    }
                    if (modeMachine().isEditTool(tool.id)
                        && controller.state.mode === modeMachine().groups.PREPARE) {
                        controller.openEditPanel(tool.id);
                        return;
                    }
                    controller.state.openToolPanels = controller.state.openToolPanels || {};
                    controller.state.openToolPanels[tool.id] = !isToolOpen(controller.state, tool.id);
                    controller.state.activeTool = tool.id;
                    syncLegacyPanelOpenFlag(controller.state);
                    render(controller.state);
                });
                refs.toolButtons[tool.id] = button;
                refs.toolPanelHosts[tool.id] = panelHost;
                var item = app.utils.dom.el('div', {
                    className: 'tool-accordion-item',
                    attrs: isPipelineEffect
                        ? { 'data-id': tool.id, 'data-pipeline-effect': 'true' }
                        : {},
                    children: [button, panelHost]
                });
                refs.toolItems[tool.id] = item;
                return item;
            })
        });
        sortable = app.ui.sortableList.mount(refs.toolDock, {
            draggable: '[data-pipeline-effect="true"]',
            handle: '.tool-button',
            immediateHandle: '.tool-drag-handle',
            holdDelay: 260,
            onChange: function (order) {
                controller.reorderEffects(order);
            }
        });
        return refs.toolDock;
    }

    // 讓每個 dock tool 自己建立 panel，page 只負責把 panel 放到正確 host。
    function buildPanelSections(state) {
        var panels = {};
        app.pages.ditherEditor.featureRegistry.dockTools(state.pipeline).forEach(function (tool) {
            if (tool.buildPanel) {
                panels[tool.id] = tool.buildPanel({ state: state, controller: controller });
            }
        });
        return panels;
    }

    // 收集不屬於 tool row 的 action，例如 Export 按鈕。
    function buildFeatureActions() {
        refs.featureActions = {};
        return app.pages.ditherEditor.featureRegistry
            .all()
            .filter(function (feature) {
                return feature.buildAction;
            })
            .sort(function (a, b) {
                return (a.actionOrder || 0) - (b.actionOrder || 0);
            })
            .map(function (feature) {
                var action = feature.buildAction({ controller: controller });
                refs.featureActions[feature.id] = action;
                return action;
            });
    }

    function rebuildControls(state) {
        if (!refs.controls) {
            return;
        }
        if (sortable && sortable.destroy) {
            sortable.destroy();
        }
        sortable = null;
        app.utils.dom.clear(refs.controls);
        refs.panelSectionsByTool = buildPanelSections(state);
        refs.controls.appendChild(buildToolDock(state));
        buildFeatureActions().forEach(function (action) {
            refs.controls.appendChild(action);
        });
        refs.renderedUiRevision = state.uiRevision || 0;
    }

    function ensureControlRevision(state) {
        if (refs.renderedUiRevision !== (state.uiRevision || 0)) {
            rebuildControls(state);
        }
    }

    // 依 state 更新 tool row active 狀態與各 panel 顯示位置。
    function renderActiveTool(state) {
        syncLegacyPanelOpenFlag(state);
        Object.keys(refs.toolButtons || {}).forEach(function (id) {
            var isOpen = isToolOpen(state, id);
            var disabled = !modeMachine().canUseTool(state, id);
            refs.toolButtons[id].classList.toggle('is-active', isOpen);
            refs.toolButtons[id].disabled = disabled;
            refs.toolButtons[id].setAttribute('aria-disabled', disabled ? 'true' : 'false');
            refs.toolButtons[id].setAttribute('aria-pressed', isOpen ? 'true' : 'false');
            refs.toolButtons[id].setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            if (refs.toolItems[id]) {
                refs.toolItems[id].classList.toggle('is-disabled', disabled);
            }
        });
        Object.keys(refs.toolPanelHosts || {}).forEach(function (id) {
            refs.toolPanelHosts[id].hidden = !isToolOpen(state, id);
        });
        Object.keys(refs.panelSectionsByTool || {}).forEach(function (id) {
            var panel = refs.panelSectionsByTool[id];
            var isOpen = isToolOpen(state, id);
            panel.hidden = !isOpen;
            if (isOpen) {
                refs.toolPanelHosts[id].appendChild(panel);
            }
        });
    }

    function renderFeatureActions(state) {
        Object.keys(refs.featureActions || {}).forEach(function (id) {
            var disabled = !modeMachine().canUseAction(state, id);
            refs.featureActions[id].classList.toggle('is-disabled', disabled);
            refs.featureActions[id].querySelectorAll('button, input, select, textarea').forEach(function (control) {
                control.disabled = disabled;
                control.setAttribute('aria-disabled', disabled ? 'true' : 'false');
            });
        });
    }

    function renderPreviewToolbar(state) {
        if (!refs.previewToggleRow || !refs.cropControlRow) {
            return;
        }
        var isPrepareMode = state.mode === modeMachine().groups.PREPARE;
        var isEditMode = state.mode === modeMachine().groups.EDIT;
        var shouldReserveToolbar = Boolean(state.sourceImageData && !isPrepareMode && !isEditMode);
        refs.previewToolbar.hidden = !isPrepareMode && !isEditMode && !shouldReserveToolbar;
        refs.previewToolbar.classList.toggle('is-reserved', shouldReserveToolbar);
        refs.previewToolbar.setAttribute('aria-hidden', shouldReserveToolbar ? 'true' : 'false');
        refs.cropControlRow.hidden = !isPrepareMode;
        refs.previewToggleRow.hidden = !isEditMode;
        refs.cropZoomInButton.disabled = !isPrepareMode;
        refs.cropZoomOutButton.disabled = !isPrepareMode;
        refs.cropOkButton.disabled = !isPrepareMode;
        refs.originalInput.checked = state.viewMode === 'original';
        refs.resultInput.checked = state.viewMode !== 'original';
        refs.originalInput.disabled = !isEditMode;
        refs.resultInput.disabled = !isEditMode;
    }

    function loadEmptyUploadFile(file) {
        if (!file || !controller || !modeMachine().canUseSource(controller.state)) {
            return;
        }
        controller.loadFile(file);
    }

    function bindEmptyUploadDropzone() {
        if (!refs.emptyUpload || !refs.emptyFileInput || !refs.emptyBrowseButton) {
            return;
        }
        refs.emptyBrowseButton.addEventListener("click", function () {
            refs.emptyFileInput.click();
        });
        refs.emptyFileInput.addEventListener("change", function () {
            var selected = refs.emptyFileInput.files[0];
            refs.emptyFileInput.value = "";
            loadEmptyUploadFile(selected);
        });
        refs.emptyUpload.addEventListener("dragover", function (event) {
            event.preventDefault();
            refs.emptyUpload.classList.add("is-over");
        });
        refs.emptyUpload.addEventListener("dragleave", function (event) {
            if (!refs.emptyUpload.contains(event.relatedTarget)) {
                refs.emptyUpload.classList.remove("is-over");
            }
        });
        refs.emptyUpload.addEventListener("drop", function (event) {
            event.preventDefault();
            refs.emptyUpload.classList.remove("is-over");
            var dropped = event.dataTransfer && event.dataTransfer.files[0];
            loadEmptyUploadFile(dropped);
        });
    }

    function renderEmptyUpload(state) {
        if (!refs.emptyUpload || !refs.previewStage || !refs.canvas) {
            return;
        }
        var isEmptyMode = !state.sourceImageData;
        refs.emptyUpload.hidden = !isEmptyMode;
        refs.canvas.hidden = isEmptyMode;
        refs.canvas.style.display = isEmptyMode ? "none" : "";
        refs.previewStage.classList.toggle("is-empty-upload", isEmptyMode);

        var sourceToolIds = modeMachine().sourceToolIds(state);
        Object.keys(refs.panelSectionsByTool || {}).forEach(function (id) {
            if (sourceToolIds.indexOf(id) !== -1) {
                refs.panelSectionsByTool[id].classList.toggle("is-empty-upload-panel", isEmptyMode);
            }
        });
    }

    function adjustCropZoom(delta) {
        if (!controller || controller.state.mode !== modeMachine().groups.PREPARE) {
            return;
        }
        controller.updateSetting('crop', 'zoom', Number(controller.state.settings.crop.zoom || 1) + delta);
    }

    function shouldHoldPendingPreview(state, cropVisible) {
        return Boolean(
            !cropVisible
            && state.mode === modeMachine().groups.EDIT
            && state.status === 'processing-preview'
            && state.viewMode !== 'original'
            && refs.canvas
            && !refs.canvas.hidden
            && refs.lastRenderedPreviewKind === 'prepare'
            && refs.canvas.width
            && refs.canvas.height
        );
    }

    // 視窗尺寸改變時重新計算 canvas 與 crop overlay 尺寸。
    function bindViewportResize() {
        refs.handleResize = function () {
            window.cancelAnimationFrame(refs.resizeFrame);
            refs.resizeFrame = window.requestAnimationFrame(function () {
                if (controller) {
                    render(controller.state);
                }
            });
        };
        window.addEventListener('resize', refs.handleResize);
    }

    // Page 主渲染入口：決定要畫 original/result/crop preview，並同步 UI 狀態。
    function render(state) {
        modeMachine().normalize(state);
        ensureControlRevision(state);
        renderActiveTool(state);
        renderEmptyUpload(state);
        renderFeatureActions(state);
        renderPreviewToolbar(state);
        var cropVisible = overlayRenderer.shouldShowCropOverlay(state);
        var image = cropVisible
            ? state.sourceImageData
            : state.viewMode === 'original'
                ? state.preparedImageData || state.sourceImageData
                : state.previewImageData || state.outputImageData || state.sourceImageData;
        var holdPendingPreview = shouldHoldPendingPreview(state, cropVisible);
        var cropMetrics = null;
        if (cropVisible) {
            // Crop 開啟時 preview 必須顯示 source + crop transform，不顯示已跑完的 pipeline 結果。
            cropMetrics = overlayRenderer.updateCanvasDisplay(state, true);
            renderer.renderTransformed(image, state.settings.crop, cropMetrics.layout);
            refs.lastRenderedPreviewKind = 'prepare';
        } else if (holdPendingPreview) {
            overlayRenderer.holdPendingPreviewDisplay();
            renderer.setFilter('');
        } else {
            renderer.render(image);
            overlayRenderer.updateCanvasDisplay(state, false, image);
            refs.lastRenderedPreviewKind = state.viewMode === 'original'
                ? 'original'
                : state.previewImageData || state.outputImageData
                    ? 'result'
                    : state.sourceImageData
                        ? 'source'
                        : 'empty';
        }
        if (cropVisible) {
            renderer.setFilter('');
        } else if (!holdPendingPreview) {
            renderLivePreview(state);
        }
        refs.error.textContent = state.status === 'error' ? state.error || 'Error' : '';
        overlayRenderer.renderCropOverlay(state, cropMetrics, cropVisible);
        app.pages.ditherEditor.featureRegistry.dispatch('onRender', { state: state, controller: controller });
        if (refs.status) {
            app.app.renderStatus(refs.status, statusText(state));
        }
    }

    // Adjust 拖曳中用 livePreview base + CSS filter 顯示即時結果。
    function renderLivePreview(state) {
        var filter = previewFilter(state);
        if (state.viewMode !== 'original' && state.livePreview && state.livePreview.baseImageData && filter) {
            renderer.render(state.livePreview.baseImageData);
        } else if (state.viewMode !== 'original' && !filter && state.previewImageData) {
            renderer.render(state.previewImageData);
        }
        renderer.setFilter(filter);
    }

    // 將 editor status 轉成 header 狀態文字。
    function statusText(state) {
        if (state.status === 'processing-preview') {
            return t('statusProcessing');
        }
        if (state.status === 'exported') {
            return t('statusExported');
        }
        if (state.status === 'empty') {
            return t('statusEmpty');
        }
        if (state.mode === modeMachine().groups.PREPARE) {
            return t('statusCropMode');
        }
        return t('statusReady');
    }

    // 從目前 livePreview feature 取得 CSS filter 字串。
    function previewFilter(state) {
        if (state.viewMode === 'original' || !state.livePreview) {
            return '';
        }
        var feature = app.pages.ditherEditor.featureRegistry.get(state.livePreview.id);
        if (!feature || !feature.livePreviewFilter) {
            return '';
        }
        return feature.livePreviewFilter({
            state: state
        });
    }

    // 還原頁面時把 loading/exporting 這類暫態狀態轉成可顯示狀態。
    function normalizeCachedStatus(state) {
        // 切頁時若剛好在 transient 狀態，回來時不能卡在 loading/exporting。
        if (state.status === 'loading-image' || state.status === 'exporting' || state.status === 'processing-preview') {
            state.status = state.previewImageData ? 'preview-ready' : 'ready';
        }
    }

    app.pages.ditherEditorPage = {
        id: 'dither-editor',
        title: 'Dither Image Editor',
        // Router mount 時建立整個 Dither Editor DOM，並恢復快取 state。
        mount: function mount(container, appContext) {
            refs = {};
            controller = new app.pages.ditherEditor.Controller({
                render: render,
                renderLivePreview: renderLivePreview,
                setStatus: appContext.setStatus,
                initialState: cachedState
            });
            cachedState = null;

            var page = app.utils.dom.el('section', { className: 'dither-editor-page' });
            var controls = app.utils.dom.el('aside', { className: 'dither-controls-panel' });
            var preview = app.utils.dom.el('section', { className: 'dither-preview-panel' });
            refs.controls = controls;

            refs.status = appContext.statusNode;
            refs.canvas = app.utils.dom.el('canvas');
            refs.error = app.utils.dom.el('div', { className: 'error-text' });
            refs.cropOverlayLabel = app.utils.dom.el('span', { className: 'crop-overlay-label' });
            refs.cropOverlay = app.utils.dom.el('div', {
                className: 'crop-overlay',
                attrs: { hidden: 'hidden' },
                children: [refs.cropOverlayLabel]
            });
            refs.emptyFileInput = app.utils.dom.el("input", {
                className: "preview-upload-file-input",
                attrs: {
                    type: "file",
                    accept: app.core.imageLoader.acceptedImageTypes,
                    tabindex: "-1"
                }
            });
            refs.emptyBrowseButton = app.utils.dom.el("button", {
                className: "secondary-button preview-upload-button",
                text: t("actionBrowseFile"),
                attrs: { type: "button" }
            });
            refs.emptyUpload = app.utils.dom.el("div", {
                className: "preview-upload-dropzone",
                attrs: { hidden: "hidden" },
                children: [
                    refs.emptyFileInput,
                    app.utils.dom.el("span", {
                        className: "preview-upload-icon",
                        text: "↑",
                        attrs: { "aria-hidden": "true" }
                    }),
                    app.utils.dom.el("div", { className: "preview-upload-title", text: t("uploadDropTitle") }),
                    app.utils.dom.el("div", { className: "preview-upload-separator", text: t("uploadDropSeparator") }),
                    refs.emptyBrowseButton
                ]
            });
            refs.previewStage = app.utils.dom.el('div', {
                className: 'preview-stage',
                children: [refs.canvas, refs.cropOverlay, refs.emptyUpload]
            });
            bindEmptyUploadDropzone();
            overlayRenderer = new app.pages.ditherEditor.ViewportOverlayRenderer({
                previewStage: refs.previewStage,
                canvas: refs.canvas,
                cropOverlay: refs.cropOverlay,
                cropOverlayLabel: refs.cropOverlayLabel,
                prepareMode: modeMachine().groups.PREPARE
            });
            pointerMapper = new app.pages.ditherEditor.CropPointerMapper({
                cropOverlay: refs.cropOverlay,
                canvas: refs.canvas,
                controller: controller,
                prepareMode: modeMachine().groups.PREPARE
            });
            bindViewportResize();

            renderer = new app.pages.ditherEditor.ViewportRenderer(refs.canvas);
            var state = controller.state;
            modeMachine().normalize(state);
            app.pages.ditherEditor.featureRegistry.dispatch('onMount', { state: state, controller: controller });
            rebuildControls(state);

            var originalInput = app.utils.dom.el('input', {
                attrs: {
                    type: 'radio',
                    name: 'preview-view-mode',
                    value: 'original'
                }
            });
            originalInput.addEventListener('change', function () {
                if (originalInput.checked) {
                    controller.setViewMode('original');
                }
            });
            var resultInput = app.utils.dom.el('input', {
                attrs: {
                    type: 'radio',
                    name: 'preview-view-mode',
                    value: 'result'
                }
            });
            resultInput.addEventListener('change', function () {
                if (resultInput.checked) {
                    controller.setViewMode('result');
                }
            });
            var originalButton = app.utils.dom.el('label', {
                className: 'setting-choice preview-view-choice',
                children: [
                    originalInput,
                    app.utils.dom.el('span', { text: t('previewOriginal') })
                ]
            });
            var resultButton = app.utils.dom.el('label', {
                className: 'setting-choice preview-view-choice',
                children: [
                    resultInput,
                    app.utils.dom.el('span', { text: t('previewResult') })
                ]
            });
            var cropZoomInButton = app.utils.dom.el('button', {
                className: 'secondary-button crop-zoom-button',
                text: '+',
                attrs: { type: 'button', title: t('actionCropZoomIn'), 'aria-label': t('actionCropZoomIn') }
            });
            cropZoomInButton.addEventListener('click', function () {
                adjustCropZoom(0.1);
            });
            var cropZoomOutButton = app.utils.dom.el('button', {
                className: 'secondary-button crop-zoom-button',
                text: '-',
                attrs: { type: 'button', title: t('actionCropZoomOut'), 'aria-label': t('actionCropZoomOut') }
            });
            cropZoomOutButton.addEventListener('click', function () {
                adjustCropZoom(-0.1);
            });
            var cropOkButton = app.utils.dom.el('button', {
                className: 'primary-button crop-ok-button',
                text: t('actionCropOk'),
                attrs: { type: 'button' }
            });
            cropOkButton.addEventListener('click', function () {
                controller.closePrepareMode();
            });
            refs.originalInput = originalInput;
            refs.resultInput = resultInput;
            refs.cropZoomInButton = cropZoomInButton;
            refs.cropZoomOutButton = cropZoomOutButton;
            refs.cropOkButton = cropOkButton;
            refs.cropControlRow = app.utils.dom.el('div', {
                className: 'button-row',
                children: [cropZoomInButton, cropZoomOutButton, cropOkButton]
            });
            refs.previewToggleRow = app.utils.dom.el('div', {
                className: 'setting-choice-list preview-view-choice-list',
                children: [originalButton, resultButton]
            });

            preview.appendChild(refs.previewStage);
            preview.appendChild(
                refs.previewToolbar = app.utils.dom.el('div', {
                    className: 'preview-toolbar',
                    children: [refs.previewToggleRow, refs.cropControlRow]
                })
            );
            preview.appendChild(refs.error);

            page.appendChild(preview);
            page.appendChild(controls);
            container.appendChild(page);
            if (controller.state.sourceImageData) {
                // Dither Editor 切到其他頁再回來時，使用 in-memory cachedState 還原工作區。
                normalizeCachedStatus(controller.state);
                modeMachine().normalize(controller.state);
                if (controller.state.status === 'processing-preview' && controller.state.mode === modeMachine().groups.EDIT) {
                    controller.schedulePreview();
                } else {
                    render(controller.state);
                }
            } else {
                modeMachine().enterSource(controller.state);
                render(controller.state);
            }
        },
        // Router unmount 時保留 in-memory state，並清理 listener/timer/sortable。
        unmount: function unmount() {
            if (refs.handleResize) {
                window.removeEventListener('resize', refs.handleResize);
                window.cancelAnimationFrame(refs.resizeFrame);
            }
            if (controller) {
                // Router 會清空 page-host；因此在 unmount 前把 editor state 留在 page module。
                cachedState = controller.state;
                app.pages.ditherEditor.featureRegistry.dispatch('onUnmount', { state: controller.state, controller: controller });
            }
            if (sortable && sortable.destroy) {
                sortable.destroy();
            }
            if (pointerMapper) {
                pointerMapper.destroy();
            }
            if (controller) {
                app.pages.ditherEditor.featureRegistry.dispatch('dispose', { state: controller.state, controller: controller });
                controller.destroy();
            }
            sortable = null;
            pointerMapper = null;
            overlayRenderer = null;
            controller = null;
            renderer = null;
            refs = {};
        }
    };
})(window.DitherApp);
