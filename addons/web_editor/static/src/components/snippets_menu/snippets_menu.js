/** @odoo-module **/

import { Deferred, Mutex } from "@web/core/utils/concurrency";
import core from "@web/legacy/js/services/core";
import Dialog from "@web/legacy/js/core/dialog";
import dom from "@web/legacy/js/core/dom";
import { getCSSVariableValue } from "@web_editor/js/common/utils";
import * as gridUtils from "@web_editor/js/common/grid_layout_utils";
const QWeb = core.qweb;
import { closestElement } from "@web_editor/js/editor/odoo-editor/src/utils/utils";
import { debounce, throttleForAnimation, useDebounced } from "@web/core/utils/timing";
import { unique } from "@web/core/utils/arrays";
import { browser } from "@web/core/browser/browser";
import { registry } from "@web/core/registry";
import { _t, _lt } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { uniqueId } from "@web/core/utils/functions";


import {
    Component, EventBus, markRaw,
    markup, onMounted, onPatched, onWillDestroy,
    onWillStart,
    onWillUnmount, reactive,
    useEffect, useExternalListener,
    useRef,
    useState,
    useSubEnv,
    xml
} from "@odoo/owl";

import { useDragAndDrop } from "@web_editor/utils/drag_and_drop";
import { SnippetEditor } from "./snippets_editor";
import { renderToElement } from "@web/core/utils/render";
import { closest, isVisible, touching } from "@web/core/utils/ui";
import { LinkTools } from "@web_editor/js/wysiwyg/widgets/link_tools";
import { Toolbar } from "@web_editor/js/editor/toolbar";

let cacheSnippetTemplate = {};

export const globalSelector = {
    closest: () => $(),
    all: () => $(),
    is: () => false,
};
class SnippetPopoverMessage extends Component {
    static defaultProps = {
        message: _lt("Drag and drop the building block."),
    };
    static template = xml`<p class="p-1 m-1"><t t-out="this.props.message"/></p>`;
}

class WeInvisibleSnippet extends Component {
    static template = "web_editor.WeInvisibleSnippet";
    static components = { WeInvisibleSnippet };
    static props = {
        id: { type: String },
        target: { type: HTMLElement },
        title: { type: String },
        isRootParent: { type: Boolean },
        isDescendant: { type: Boolean },
        invisibleSelector: { type: String },
        onInvisibleEntryClick: { type: Function },
        invisibleSnippetsEls: { type: Array },
        getSnippetName: { type: Function },
    };

    setup() {
        super.setup();
        this.state = useState({
            show: isVisible(this.props.target),
            descendantsInvisibleEls: [],
            invisibleEntriesProps: [],
        });

        if (this.props.isRootParent || this.props.isDescendant) {
            useEffect(() => {
                this.updateDescendantsState();
            }, () => [this.props.invisibleSnippetsEls]);

            useEffect(() => {
                this.populateSubLevelInvisibleEntriesProps();
            }, () => [this.state.descendantsInvisibleEls]);
        }
    }

    updateDescendantsState() {
        this.state.descendantsInvisibleEls.splice(0, this.state.descendantsInvisibleEls.length,
            ...this.props.target.querySelectorAll(this.props.invisibleSelector));
    }
    /**
     * Populates the state with the invisible entries props of snippets which
     * are direct descendants of this.props.target.
     */
    populateSubLevelInvisibleEntriesProps() {
        this.state.invisibleEntriesProps = [];
        const directDescendantsEntriesProps = [...this.state.descendantsInvisibleEls].filter(
            (el) => {
                if (this.props.target === el.parentElement.closest(this.props.invisibleSelector)) {
                    return true;
                }
            }).map((el) => {
                return {
                    id: uniqueId("invisible-element"),
                    target: el,
                    title: this.props.getSnippetName(el),
                    isRootParent: false,
                    isDescendant: true,
                    invisibleSelector: this.props.invisibleSelector,
                    onInvisibleEntryClick: this.props.onInvisibleEntryClick,
                    invisibleSnippetsEls: this.props.invisibleSnippetsEls,
                    getSnippetName: this.props.getSnippetName,
                }
            });
        this.state.invisibleEntriesProps.push(...directDescendantsEntriesProps);
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @param {Event} ev
     */
    async onInvisibleEntryClick(ev) {
        ev.preventDefault();
        this.state.show = !this.state.show;
        ev.details = { target: this.props.target, show: this.state.show };
        await this.props.onInvisibleEntryClick(ev);
    }
}

export class WeInvisibleDOMPanel extends Component {
    static template = "web_editor.WeInvisibleDOMPanel";
    static components = { WeInvisibleSnippet };
    static props = {
        odooEditor: { type: Object },
        onInvisibleEntryClick: { type: Function },
        invisibleSnippetsEls: { type: Array },
        invisibleSelector: { type: String },
    };

    setup() {
        super.setup();
        useSubEnv({
            odooEditor: this.props.odooEditor,
        });
        this.state = useState({
            invisibleEntriesProps: []
        });

        onWillStart(async () => {
            this.env.odooEditor.automaticStepSkipStack();
        });

        useEffect((invisibleSnippetsEls) => {
            this.populateRootInvisibleEntriesProps(invisibleSnippetsEls);
        }, () => [this.props.invisibleSnippetsEls]);
    }
    /**
     * Gets a generic name for the invisible snippet.
     * @param {HTMLElement} targetEl
     * @returns {LazyTranslatedString}
     */
    getSnippetName(targetEl) {
        if (targetEl.dataset.name !== undefined) {
            return targetEl.dataset.name;
        }
        if (targetEl.tagName === "IMG") {
            return _t("Image");
        }
        if (targetEl.classList.contains("fa")) {
            return _t("Icon");
        }
        if (targetEl.classList.contains("media_iframe_video")) {
            return _t("Video");
        }
        if (targetEl.parentElement.classList.contains("row")) {
            return _t("Column");
        }
        if ($(targetEl).is('#wrapwrap > main')) {
            return _t("Page Options");
        }
        return _t("Block");
    }
    /**
     * Populates the state with the invisible entries props of snippets which
     * are not descendants of other invisible snippets.
     * @param {HTMLElement[]}
     */
    populateRootInvisibleEntriesProps(invisibleSnippetsEls) {
        const rootInvisibleSnippetEls = invisibleSnippetsEls.filter(
            (invisibleSnippetEl) => {
                const ancestorInvisibleEl = invisibleSnippetEl.parentElement
                    .closest(this.props.invisibleSelector);
                if (!ancestorInvisibleEl) {
                    return true;
                }
            }
        );

        this.state.invisibleEntriesProps = [];
        for (const invisibleSnippetEl of rootInvisibleSnippetEls) {
            const invisibleEntryProps = this.createInvisibleEntryProps(invisibleSnippetEl);
            this.state.invisibleEntriesProps.push(invisibleEntryProps);
        }
    }
    /**
     *
     * @param {HTMLElement} invisibleSnippetEl
     * @returns {Object} props for WeInvisibleSnippet
     */
    createInvisibleEntryProps(invisibleSnippetEl) {
        const selector = this.props.invisibleSelector;
        const hasInvisibleDescendants = !!invisibleSnippetEl.querySelector(selector);
        const invisibleEntryProps = {
            id: uniqueId("invisible-element"),
            title: this.getSnippetName(invisibleSnippetEl),
            target: invisibleSnippetEl,
            isRootParent: hasInvisibleDescendants,
            isDescendant: false,
            invisibleSelector: this.props.invisibleSelector,
            onInvisibleEntryClick: this.props.onInvisibleEntryClick,
            invisibleSnippetsEls: this.props.invisibleSnippetsEls,
            getSnippetName: this.getSnippetName,
        };
        return invisibleEntryProps;
    }
}

/**
 * Management of drag&drop menu and snippet related behaviors in the page.
 */
export class SnippetsMenu extends Component {
    static template = "web_editor.SnippetsMenu";
    static components = { SnippetEditor, Toolbar, LinkTools, WeInvisibleDOMPanel };
    // enum of the SnippetsMenu's tabs.
    static tabs = {
        BLOCKS: "blocks",
        OPTIONS: "options",
        CUSTOM: "custom",
    };
    static defaultProps = {
        snippetsXmlId: "web_editor.snippets",
        document: document,
        context: {},
    };
    static props = {
        document: { optional: true },
        editable: {},
        inIframe: { type: Boolean, optional: true },
        iframeZone: { optional: true },
        snippets: { type: String, optional: true },
        context: { type: Object, optional: true },
        selectorEditableArea: { type: String },
        requestSave: { type: Function },
        requestCancel: { type: Function },
        undo: { type: Function },
        redo: { type: Function },
        isSaving: { type: Function },
        odooEditor: { type: Object },
        readyToCleanForSave: { type: Function, optional: true},
        setCSSVariables: { type: Function },
        snippetRemoved: { type: Function },
        snippetsMenuPromise: {},
        wysiwygState: {},
        setupToolbar: {},
        wysiwyg: {},
    };
    /**
     * Allows the use of this variable in templates.
     * @returns {{BLOCKS: string, CUSTOM: string, OPTIONS: string}}
     */
    get tabs() {
        return SnippetsMenu.tabs;
    }
    setup() {
        this.bodyEl = this.props.editable.ownerDocument.body;
        this.$document = $(this.props.editable.ownerDocument);
        this.$body = $(this.bodyEl);
        this.ownerDocument = this.props.document;
        this.window = this.ownerDocument.defaultView;
        this.templateOptions = [];



        this.orm = useService("orm");
        this.popover = useService("popover");
        useSubEnv({
            mutex: new Mutex(),
            odooEditor: this.props.odooEditor,
            editable: this.props.editable,
            editionState: reactive({
                saving: false,
            }),
            activateSnippet: this.activateSnippet.bind(this),
            snippetEditionRequest: this.snippetEditionRequest.bind(this),
            requestSave: this.onSaveRequest.bind(this),
        });

        this.editionState = useState(this.env.editionState);

        this.snippets = {};
        this.oScroll = useRef("o_scroll");
        this.actionButtonsRef = useRef("action-buttons")

        this.state = useState({
            activeTab: SnippetsMenu.tabs.BLOCKS,
            snippetEditorsProps: [],
            snippetSections: [],
            canUndo: false,
            canRedo: false,
            contentLoading: false,
            saving: false,
            editableLoading: false,
            showToolbar: false,
            showTable: false,
            loadingTimers: [],
            searchValue: "",
            invisibleSnippetsEls: [],
        });

        useEffect(
            (value) => {
                this._filterSnippets(value);
            },
            () => [this.state.searchValue]
        );

        onWillStart(async () => {
            this.updateInvisibleDOM();
            const snippetsHtml = await this.loadSnippets();
            const snippetDiv = document.createElement("div");
            snippetDiv.insertAdjacentHTML("afterbegin", snippetsHtml);
            this.computeSnippetTemplates(snippetDiv);
            // Preload colorpalette dependencies without waiting for them. The
            // widget have huge chances of being used by the user (clicking on any
            // text will load it). The colorpalette itself will do the actual
            // waiting of the loading completion.
            this.env.getColorpickerTemplate(() => {
                return this._rpc({
                    model: "ir.ui.view",
                    method: "render_public_asset",
                    args: ["web_editor.colorpicker", {}],
                });
            });
        });

        this.customizePanel = useRef("customize-panel");
        useEffect(
            () => {
                document.body.classList.add(
                    "editor_has_snippets_hide_backend_navbar",
                    "editor_has_snippets"
                );
                // Hide scroll if no snippets defined
                if (!Object.keys(this.snippets).length) {
                    this.oScroll.el.classList.add("d-none");
                }
                this.props.setCSSVariables(this.customizePanel.el);
                return () =>
                    document.body.classList.remove(
                        "editor_has_snippets",
                        "editor_has_snippets_hide_backend_navbar"
                    );
            },
            () => []
        );
        this._onClick = this.onClick.bind(this);
        useEffect(
            (editable) => {
                this.manipulatorsArea = document.createElement("div");
                this.manipulatorsArea.id = "oe_manipulators";
                editable.ownerDocument.body.prepend(this.manipulatorsArea);

                editable.addEventListener("click", this._onClick);
                // Needed as bootstrap stop the propagation of click events for dropdowns
                this.$document.on('mouseup.snippets_menu', '.dropdown-toggle', this._onClick);

                return () => {
                    editable.removeEventListener("click", this._onClick);
                };
            },
            () => [this.props.editable]
        );
        this._loadingElement = renderToElement("web_editor.LoadingEffect");
        useEffect(
            (loading) => {
                if (loading) {
                    this.props.editable.appendChild(this._loadingElement);
                } else {
                    this._loadingElement.remove();
                }
            },
            () => [this.state.editableLoading]
        );

        useExternalListener(this.env.odooEditor, "historyStep", () => {
            this.state.canUndo = this.env.odooEditor.historyCanUndo();
            this.state.canRedo = this.env.odooEditor.historyCanRedo();
        });
        const refreshSnippetEditors = useDebounced(() => {
            this.state.snippetEditorsProps.splice(0, this.state.snippetEditorsProps.length);
            const selection = this.$body[0].ownerDocument.getSelection();
            if (selection.rangeCount) {
                const target = selection.getRangeAt(0).startContainer.parentElement;
                this.activateSnippet(target);
            }
            // TODO: update invisible dom
            //this._updateInvisibleDOM();
        }, 500);
        useExternalListener(this.env.odooEditor, "historyUndo", refreshSnippetEditors);
        useExternalListener(this.env.odooEditor, "historyRedo", refreshSnippetEditors);

        // Hide the active overlay when scrolling.
        // Show it again and recompute all the overlays after the scroll.
        this.$scrollingElement = $().getScrollingElement(this.$body[0].ownerDocument);
        if (!this.$scrollingElement[0]) {
            this.$scrollingElement = $(this.ownerDocument).find('.o_editable');
        }
        this.$scrollingTarget = this.$scrollingElement.is(this.$body[0].ownerDocument.scrollingElement)
            ? $(this.$body[0].ownerDocument.defaultView)
            : this.$scrollingElement;
        this._onScrollingElementScroll = throttleForAnimation(() => {
            this.toggleOverlay(null, false);
            clearTimeout(this.scrollingTimeout);
            this.scrollingTimeout = setTimeout(() => {
                this._scrollingTimeout = null;
                this.toggleOverlay(null, true);
            }, 250);
        });
        // Setting capture to true allows to take advantage of event bubbling
        // for events that otherwise don’t support it. (e.g. useful when
        // scrolling a modal)
        useExternalListener(this.$scrollingTarget[0], "scroll", this._onScrollingElementScroll, {capture: true});
        this._onTouchEvent = this.onTouchEvent.bind(this);
        useExternalListener(document, "touchstart", this._onTouchEvent, { capture: true });
        useExternalListener(document, "touchmove", this._onTouchEvent, { capture: true });
        useExternalListener(document, "touchend", this._onTouchEvent, { capture: true });

        this.debouncedCoverUpdate = useDebounced(() => {
            this.updateCurrentSnippetEditorOverlay();
        }, 50);
        useExternalListener(this.window, "resize", this.debouncedCoverUpdate);
        useExternalListener(this.bodyEl, "content_changed", this.debouncedCoverUpdate);

        this.$body.on("content_changed.snippets_menu", this.debouncedCoverUpdate);
        this.$body.on('click.snippets_menu', '.o_default_snippet_text', function (ev) {
            $(ev.target).closest('.o_default_snippet_text').removeClass('o_default_snippet_text');
            $(ev.target).selectContent();
            $(ev.target).removeClass('o_default_snippet_text');
        });
        this.$body.on('keyup.snippets_menu', function () {
            const selection = this.ownerDocument.getSelection();
            if (!Selection.rangeCount) {
                return;
            }
            const range = selection.getRangeAt(0);
            $(range.startContainer).closest('.o_default_snippet_text').removeClass('o_default_snippet_text');
        });

        onWillDestroy(() => {
            this.$body.off(".snippets_menu");
        });

        this._checkEditorToolbarVisibilityCallback = this._checkEditorToolbarVisibility.bind(this);
        useExternalListener(this.env.odooEditor.document.body,"click", this._checkEditorToolbarVisibilityCallback);

        this._notActivableElementsSelector = [
            "#web_editor-top-edit",
            ".o_we_website_top_actions",
            "#oe_snippets",
            "#oe_manipulators",
            ".o_technical_modal",
            ".oe_drop_zone",
            ".o_notification_manager",
            ".o_we_no_overlay",
            ".ui-autocomplete",
            ".modal .btn-close",
            ".o_we_crop_widget",
            ".transfo-container",
        ].join(", ");

        this.loadingTimers = {};
        this.loadingElements = {};
        this._loadingEffectDisabled = false;
        useDragAndDrop(this.getDragAndDropOptions());

        // TODO: Enable this for mass_mailing iframe.
        //if (this.props.inIframe && this.props.iframeZone) {
        //    this.mainRef = useRef("main");
        //    onMounted(() => {
        //        this.__owl__.moveBeforeDOMNode(this.props.iframeZone.lastChild);
        //        this.$el = $(this.mainRef.el);
        //    });
        //}

        useExternalListener(this.bodyEl, "keydown", () => {
            this.__overlayKeyWasDown = true;
            this.toggleOverlay(null, false);
        });
        const showOverlayAfterKeydown = () => {
            if (!this.__overlayKeyWasDown) {
                return;
            }
            this.__overlayKeyWasDown = false;
            this.toggleOverlay(null, true);
        }
        useExternalListener(this.bodyEl, "mousemove", showOverlayAfterKeydown);
        useExternalListener(this.bodyEl, "mousedown", showOverlayAfterKeydown);

        this.toolbarContainerRef = useRef("toolbar-container");
        useEffect(
            (toolbarEl) => {
                if (toolbarEl) {
                    this.props.setupToolbar(toolbarEl.querySelector("#toolbar"));
                    for (const dropdown of toolbarEl.querySelectorAll('.colorpicker-group')) {
                        const $ = dropdown.ownerDocument.defaultView.$;
                        const $dropdown = $(dropdown);
                        $dropdown.off('show.bs.dropdown');
                        $dropdown.on('show.bs.dropdown', () => {
                            this.props.wysiwyg.onColorpaletteDropdownShow(dropdown.dataset.colorType);
                        });
                        $dropdown.off('hide.bs.dropdown');
                        $dropdown.on('hide.bs.dropdown', (ev) => this.props.wysiwyg.onColorpaletteDropdownHide(ev));
                    }
                }
            },
            () => [this.toolbarContainerRef.el]
        );
        this.tableContainerRef = useRef("table-container");
        useEffect(
            (tableEl) => {
                if (tableEl) {
                    this.env.odooEditor.bindExecCommand(tableEl);
                }
            },
            () => [this.tableContainerRef.el]
        )
        onMounted(() => {
            // Ideally we do not want to do this, we should use props and reactive
            // values. But code in mass_mailing takes extensive use of this.
            this.props.snippetsMenuPromise.resolve(this);
            this._checkEditorToolbarVisibility();
        });

        onPatched(() => {
            if (this.onBlurPromise) {
                this.onBlurPromise.resolve();
            }
        });
    }
    /**
     * Allows for other modules to override the SnippetEditor
     *
     * @returns {SnippetEditor}
     */
    getSnippetEditorClass() {
        return SnippetEditor;
    }
    /**
     * Display a message above the Snippet
     * @param ev
     */
    displaySnippetPopover(ev) {
        if (this.removeActivePopover && this.snippetPopoverTimeout) {
            clearTimeout(this.snippetPopoverTimeout);
            this.removeActivePopover();
        }
        this.removeActivePopover = this.popover.add(
            ev.target,
            SnippetPopoverMessage,
            {
                message: _lt("Drag and drop the building block."),
            },
            {
                position: "bottom",
            }
        );
        this.snippetPopoverTimeout = setTimeout(() => {
            this.removeActivePopover();
            this.snippetPopoverTimeout = undefined;
        }, 1500);
    }
    hideSnippetPopover() {
        if (this.snippetPopoverTimeout) {
            clearTimeout(this.snippetPopoverTimeout);
            this.snippetPopoverTimeout = undefined;
        }
        if (this.removeActivePopover) {
            this.removeActivePopover();
            this.removeActivePopover = undefined;
        }
    }
    toggleOverlay(id, show, previewMode = false) {
        this.state.snippetEditorsProps.forEach((props) => {
            props.showOverlay = false;
        });
        const activateLastActiveOverlay = () => {
            const editor = this.state.snippetEditorsProps.find(
                (props) => props.id === this._activeOverlayId
            );
            if (editor) {
                editor.showOverlay = true;
            } else {
                this._activeOverlayId = undefined;
            }
        };
        if (id === null) {
            if (show) {
                activateLastActiveOverlay();
            }
            return;
        }
        if (show) {
            const snippetEditorProps = this.state.snippetEditorsProps.find(
                (props) => props.id === id
            );
            snippetEditorProps.showOverlay = show;
            if (!previewMode) {
                this._activeOverlayId = snippetEditorProps.id;
            }
        } else if (this._activeOverlayId) {
            activateLastActiveOverlay();
        }
    }
    toggleSnippetOptionVisibility(show) {
        if (this.props.wysiwyg.isSaving()) {
            // Do not update the option visibilities if we are destroying them.
            return;
        }
        if (!show) {
            this.activateSnippet(false);
        }
        this.updateInvisibleDOM(); // Re-render to update status
    }
    /**
     * @override
     */
    async start() {
        // TODO: Continue migrating this to use effect
        this.ownerDocument = this.$el[0].ownerDocument;
        this.$document = $(this.ownerDocument);
        this.window = this.ownerDocument.defaultView;
        this.$window = $(this.window);
        // // In an iframe, we need to make sure the element is using jquery on its
        // // own window and not on the top window lest jquery behave unexpectedly.
        this.$el = this.window.$(this.$el);
        this.$el.data('snippetMenu', this);

        this._addToolbar();

        // Add tooltips on we-title elements whose text overflows and on all
        // elements with available tooltip text. Note that the tooltips of the
        // blocks should not be taken into account here because they have
        // tooltips with a particular behavior (see _showSnippetTooltip).
        this.tooltips = new Tooltip(this.el, {
            selector: 'we-title, [title]:not(.oe_snippet)',
            placement: 'bottom',
            delay: 100,
            // Ensure the tooltips have a good position when in iframe.
            container: this.el,
            // Prevent horizontal scroll when tooltip is displayed.
            boundary: this.el.ownerDocument.body,
            title: function () {
                const el = this;
                if (el.tagName !== 'WE-TITLE') {
                    return el.title;
                }
                // On Firefox, el.scrollWidth is equal to el.clientWidth when
                // overflow: hidden, so we need to update the style before to
                // get the right values.
                el.style.setProperty('overflow', 'scroll', 'important');
                const tipContent = el.scrollWidth > el.clientWidth ? el.innerHTML : '';
                el.style.removeProperty('overflow');
                return tipContent;
            },
        });

        if (this.options.enableTranslation) {
            // Load the sidebar with the style tab only.
            await this._loadSnippetsTemplates();
            this.$el.find('.o_we_website_top_actions').removeClass('d-none');
            this.$('.o_snippet_search_filter').addClass('d-none');
            this.$('#o_scroll').addClass('d-none');
            this.$('button[data-action="mobilePreview"]').addClass('d-none');
            this.$('#snippets_menu button').removeClass('active').prop('disabled', true);
            this.$('.o_we_customize_snippet_btn').addClass('active').prop('disabled', false);
            this.$('o_we_ui_loading').addClass('d-none');
            $(this.customizePanel).removeClass('d-none');
            this.$('#o_we_editor_toolbar_container').hide();
            this.$('#o-we-editor-table-container').addClass('d-none');
            return Promise.all(defs);
        }
        this.invisibleDOMPanelEl = document.createElement('div');
        this.invisibleDOMPanelEl.classList.add('o_we_invisible_el_panel');
        this.invisibleDOMPanelEl.appendChild(
            $('<div/>', {
                text: _t('Invisible Elements'),
                class: 'o_panel_header',
            })[0]
        );

        this.emptyOptionsTabContent = document.createElement('div');
        this.emptyOptionsTabContent.classList.add('text-center', 'pt-5');
        this.emptyOptionsTabContent.append(_t("Select a block on your page to style it."));
        this.options.getScrollOptions = this._getScrollOptions.bind(this);

        // Fetch snippet templates and compute it
        defs.push((async () => {
            await this._loadSnippetsTemplates(this.options.invalidateSnippetCache);
            await this._updateInvisibleDOM();
        })());

        // Prepare snippets editor environment
        this.$snippetEditorArea = $('<div/>', {
            id: 'oe_manipulators',
        });
        this.$body.prepend(this.$snippetEditorArea);

        // Active snippet editor on click in the page
        this.$document.on('click.snippets_menu', '*', this._onClick);
        // Needed as bootstrap stop the propagation of click events for dropdowns
        this.$document.on('mouseup.snippets_menu', '.dropdown-toggle', this._onClick);

        core.bus.on('deactivate_snippet', this, this._onDeactivateSnippet);

        // Adapt overlay covering when the window is resized / content changes
        this.debouncedCoverUpdate = debounce(() => {
            this.updateCurrentSnippetEditorOverlay();
        }, 50);
        this.$window.on("resize.snippets_menu", this.debouncedCoverUpdate);
        this.$body.on("content_changed.snippets_menu", this.debouncedCoverUpdate);
        $(this.$body[0].ownerDocument.defaultView).on(
            "resize.snippets_menu",
            this.debouncedCoverUpdate
        );

        // On keydown add a class on the active overlay to hide it and show it
        // again when the mouse moves
        this.$body.on('keydown.snippets_menu', () => {
            this.__overlayKeyWasDown = true;
            this.snippetEditors.forEach(editor => {
                editor.toggleOverlayVisibility(false);
            });
        });
        this.$body.on('mousemove.snippets_menu, mousedown.snippets_menu', throttleForAnimation(() => {
            if (!this.__overlayKeyWasDown) {
                return;
            }
            this.__overlayKeyWasDown = false;
            this.snippetEditors.forEach(editor => {
                editor.toggleOverlayVisibility(true);
                editor.cover();
            });
        }));


        // Auto-selects text elements with a specific class and remove this
        // on text changes
        this.$body.on('click.snippets_menu', '.o_default_snippet_text', function (ev) {
            $(ev.target).closest('.o_default_snippet_text').removeClass('o_default_snippet_text');
            $(ev.target).selectContent();
            $(ev.target).removeClass('o_default_snippet_text');
        });
        this.$body.on('keyup.snippets_menu', function () {
            const selection = this.ownerDocument.getSelection();
            if (!Selection.rangeCount) {
                return;
            }
            const range = selection.getRangeAt(0);
            $(range.startContainer).closest('.o_default_snippet_text').removeClass('o_default_snippet_text');
        });
        const refreshSnippetEditors = debounce(() => {
            for (const snippetEditor of this.snippetEditors) {
                this._mutex.exec(() => snippetEditor.destroy());
            }
            // FIXME should not the snippetEditors list be emptied here ?
            const selection = this.$body[0].ownerDocument.getSelection();
            if (selection.rangeCount) {
                const target = selection.getRangeAt(0).startContainer.parentElement;
                this._activateSnippet($(target));
            }

            this._updateInvisibleDOM();
        }, 500);
        this.options.wysiwyg.odooEditor.addEventListener('historyUndo', refreshSnippetEditors);
        this.options.wysiwyg.odooEditor.addEventListener('historyRedo', refreshSnippetEditors);

        const $autoFocusEls = $('.o_we_snippet_autofocus');
        this._activateSnippet($autoFocusEls.length ? $autoFocusEls.first() : false);

        return Promise.all(defs).then(() => {
            const $undoButton = this.$('.o_we_external_history_buttons button[data-action="undo"]');
            const $redoButton = this.$('.o_we_external_history_buttons button[data-action="redo"]');
            if ($undoButton.length) {
                const updateHistoryButtons = () => {
                    $undoButton.attr('disabled', !this.options.wysiwyg.odooEditor.historyCanUndo());
                    $redoButton.attr('disabled', !this.options.wysiwyg.odooEditor.historyCanRedo());
                };
                this.options.wysiwyg.odooEditor.addEventListener('historyStep', updateHistoryButtons);
                this.options.wysiwyg.odooEditor.addEventListener('observerApply', () => {
                    $(this.options.wysiwyg.odooEditor.editable).trigger('content_changed');
                });
                this.options.wysiwyg.odooEditor.addEventListener('historyRevert', debounce(() => {
                    this.trigger_up('widgets_start_request', {
                        $target: this.options.wysiwyg.$editable,
                        editableMode: true,
                    });
                }, 50));
            }

            // Trigger a resize event once entering edit mode as the snippets
            // menu will take part of the screen width (delayed because of
            // animation). (TODO wait for real animation end)
            setTimeout(() => {
                this.$window.trigger('resize');
            }, 1000);
        });
    }
    /**
     * @override
     */
    destroy() {
        this._super.apply(this, arguments);
        if (this.$window) {
            if (this.$snippetEditorArea) {
                this.$snippetEditorArea.remove();
            }
            this.$window.off('.snippets_menu');
            this.$document.off('.snippets_menu');

            if (this.$scrollingTarget) {
                this.$scrollingTarget[0].removeEventListener('scroll', this._onScrollingElementScroll, {capture: true});
            }
        }
        if (this.debouncedCoverUpdate) {
            this.debouncedCoverUpdate.cancel();
        }
        core.bus.off('deactivate_snippet', this, this._onDeactivateSnippet);
        $(document.body).off('click', this._checkEditorToolbarVisibilityCallback);
        this.el.ownerDocument.body.classList.remove('editor_has_snippets');
        // Dispose BS tooltips.
        this.tooltips.dispose();
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Prepares the page so that it may be saved:
     * - Asks the snippet editors to clean their associated snippet
     * - Remove the 'contentEditable' attributes
     */
    async cleanForSave() {
        // Wait for snippet post-drop code here, since sometimes we save very
        // quickly after a snippet drop during automated testing, which breaks
        // some options code (executed while destroying the editor).
        // TODO we should find a better way, by better locking the drag and drop
        // code inside the edition mutex... which unfortunately cannot be done
        // given the state of the code, as internal operations of that drag and
        // drop code need to use the mutex themselves.
        await this.postSnippetDropPromise;

        // This promise is here because some of the new OWL Framework collides
        // with the old way of doing things. While the wysiwyg still calls
        // the snippets menu for cleanForSave, the snippetsMenu does not
        // handle onBlur and onFocus calls. Therefore, we have to wait
        // the next render of this component.
        this.onBlurPromise = new Deferred();

        // First disable the snippet selection, calling options onBlur, closing
        // widgets, etc. Then wait for full resolution of the mutex as widgets
        // may have triggered some final edition requests that need to be
        // processed before actual "clean for save" and saving.
        this.activateSnippet(false);

        await this.onBlurPromise;

        // Next, notify that we want the DOM to be cleaned (e.g. in website this
        // may be the moment where the public widgets need to be destroyed).

        if (this.props.readyToCleanForSave) {
            await this.props.readyToCleanForSave();
        }

        // Wait for the mutex a second time as some options do editor actions when
        // their snippets are destroyed. (E.g. s_popup triggers visibility updates
        // when hidden, destroying the widget hides it.)
        await this.env.mutex.getUnlockedDef();

        // Then destroy all snippet editors, making them call their own
        // "clean for save" methods (and options ones).
        await this._destroyEditors();

        // Final editor cleanup
        this.getEditableArea().find('[contentEditable]')
            .removeAttr('contentEditable')
            .removeProp('contentEditable');
        this.getEditableArea().find('.o_we_selected_image')
            .removeClass('o_we_selected_image');
        [...this.getEditableArea()].forEach(editableAreaEl => {
            editableAreaEl.querySelectorAll("[data-visibility='conditional']")
                            .forEach(invisibleEl => delete invisibleEl.dataset.invisible);
        });
    }
    /**
     * Load snippets.
     * @param {boolean} invalidateCache
     */
    loadSnippets(invalidateCache) {
        if (!invalidateCache && cacheSnippetTemplate[this.props.snippets]) {
            this._defLoadSnippets = cacheSnippetTemplate[this.props.snippets];
            return this._defLoadSnippets;
        }
        const context = Object.assign({}, this.props.context);
        if (context.user_lang) {
            context.lang = this.props.context.user_lang;
            context.snippet_lang = this.props.context.lang;
        }
        this._defLoadSnippets = this.orm.call(
            "ir.ui.view",
            "render_public_asset",
            [
                this.props.snippets,
                {
                    context,
                },
            ]
            // TODO: add the context here to render the snippets in a correct language.
        );
        cacheSnippetTemplate[this.props.snippetXmlId] = this._defLoadSnippets;
        return this._defLoadSnippets;
    }
    /**
     * Visually hide or display this snippet menu
     * @param {boolean} foldState
     */
    setFolded(foldState = true) {
        this.el.classList.toggle('d-none', foldState);
        this.el.ownerDocument.body.classList.toggle('editor_has_snippets', !foldState);
        this.folded = !!foldState;
    }
    /**
     * Get the editable area.
     *
     * @returns {JQuery}
     */
    getEditableArea() {
        return $(this.props.editable)
            .find(this.props.selectorEditableArea)
            .add($(this.props.editable).filter(this.props.selectorEditableArea));
    }
    /**
     * Updates the cover dimensions of the current snippet editor.
     */
    updateCurrentSnippetEditorOverlay() {
        if (this.snippetEditorDragging) {
            return;
        }
        for (const props of this.state.snippetEditorsProps) {
            if (props.target.closest('body')) {
                props.updateOverlayCounter++;
                continue;
            }
            // Destroy options whose $target are not in the DOM anymore but
            // only do it once all options executions are done.
            this.env.mutex.exec(() => {
                const propsIndex = this.state.snippetEditorsProps.indexOf(props);
                this.state.snippetEditorsProps.splice(propsIndex, 1);
            });
        }
        this.env.mutex.exec(() => {
            if (this.state.activeTab === this.tabs.OPTIONS && !this.state.snippetEditorsProps.length) {
                this.state.activeTab = this.tabs.BLOCKS;
            }
        });
    }
    activateCustomTab(content) {
        this._updateRightPanelContent({content: content, tab: this.tabs.CUSTOM});
    }
    /**
     * Postprocesses a snippet node when it has been inserted in the dom.
     *
     * @param {HTMLElement>} target
     * @returns {Promise}
     */
    async callPostSnippetDrop(target) {
        this.postSnippetDropPromise = new Deferred();

        // First call the onBuilt of all options of each item in the snippet
        // (and so build their editor instance first).
        await this.callForEachChildSnippet(target, (editorProps) => {
            return editorProps.events.buildSnippet();
        });
        // The snippet is now fully built, notify the editor for changed
        // content.
        $(target).trigger('content_changed');

        // Now notifies that a snippet was dropped (at the moment, useful to
        // start public widgets for instance (no saved content)).
        //await this._mutex.exec(() => {
        //    const proms = [];
        //    this.trigger_up('snippet_dropped', {
        //        $target: $target,
        //        addPostDropAsync: prom => proms.push(prom),
        //    });
        //    return Promise.all(proms);
        //});

        // Lastly, ensure that the snippets or its related parts are added to
        // the invisible DOM list if needed.
        //await this._updateInvisibleDOM();

        this.postSnippetDropPromise.resolve();
    }
    /**
     * Public implementation of _execWithLoadingEffect.
     *
     * @see this._execWithLoadingEffect for parameters
     */
    execWithLoadingEffect(action, contentLoading = true, delay = 500) {
        const execResult = this.env.mutex.exec(action);
        if (!this.state.loadingTimers[contentLoading]) {
            const addLoader = () => {
                if (
                    this._loadingEffectDisabled ||
                    (contentLoading ? this.state.contentLoading : this.state.editableLoading)
                ) {
                    return;
                }
                if (contentLoading) {
                    this.state.contentLoading = true;
                } else {
                    this.state.editableLoading = true;
                }
            };
            if (delay) {
                this.state.loadingTimers[contentLoading] = setTimeout(addLoader, delay);
            } else {
                addLoader();
            }
            this.env.mutex.getUnlockedDef().then(() => {
                if (delay) {
                    clearTimeout(this.state.loadingTimers[contentLoading]);
                    this.state.loadingTimers[contentLoading] = undefined;
                }

                if (contentLoading && this.state.contentLoading) {
                    this.state.contentLoading = false;
                } else if (this.state.editableLoading) {
                    this.state.editableLoading = false;
                }
            });
        }
        return execResult;
    }
    reload_snippet_dropzones() {
        this._disableUndroppableSnippets();
    }
    /**
     * @returns {String}
     */
    get invisibleSelector() {
        return ".o_snippet_invisible";
    }
    /**
     * @returns {HTMLCollection}
     */
    get invisibleSnippetsEls() {
        const wrapwrapEl = this.env.odooEditor.document.querySelector("#wrapwrap");
        return wrapwrapEl.querySelectorAll(this.invisibleSelector);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Creates drop zones in the DOM (locations where snippets may be dropped).
     * Those locations are determined thanks to the two types of given DOM.
     *
     * @private
     * @param {jQuery} [$selectorSiblings]
     *        elements which must have siblings drop zones
     * @param {jQuery} [$selectorChildren]
     *        elements which must have child drop zones between each of existing
     *        child
     * @param {string or boolean} canBeSanitizedUnless
     *        true: always allows,
     *        false: always forbid,
     *        string: specific type of forbidden sanitization
     * @param {Object} [selectorGrids = []]
     *        elements which are in grid mode and for which a grid dropzone
     *        needs to be inserted
     */
    activateInsertionZones($selectorSiblings, $selectorChildren, canBeSanitizedUnless, selectorGrids = []) {
        var self = this;

        // If a modal or a dropdown is open, the drop zones must be created
        // only in this element.
        const $editableArea = self.getEditableArea();
        let $open = $editableArea.find('.modal:visible');
        if (!$open.length) {
            $open = $editableArea.find('.dropdown-menu.show').addBack('.dropdown-menu.show').parent();
        }
        if ($open.length) {
            $selectorSiblings = $open.find($selectorSiblings);
            $selectorChildren = $open.find($selectorChildren);
        }

        // Check if the drop zone should be horizontal or vertical
        function setDropZoneDirection($elem, $parent, $sibling) {
            var vertical = false;
            var style = {};
            $sibling = $sibling || $elem;
            var css = window.getComputedStyle($elem[0]);
            var parentCss = window.getComputedStyle($parent[0]);
            var float = css.float || css.cssFloat;
            var display = parentCss.display;
            var flex = parentCss.flexDirection;
            if (float === 'left' || float === 'right' || (display === 'flex' && flex === 'row')) {
                style['float'] = float;
                if ($sibling.parent().width() !== $sibling.outerWidth(true)) {
                    vertical = true;
                    style['height'] = Math.max($sibling.outerHeight(), 30) + 'px';
                }
            }
            return {
                vertical: vertical,
                style: style,
            };
        }

        // If the previous sibling is a BR tag or a non-whitespace text, it
        // should be a vertical dropzone.
        function testPreviousSibling(node, $zone) {
            if (!node || ((node.tagName || !node.textContent.match(/\S/)) && node.tagName !== 'BR')) {
                return false;
            }
            return {
                vertical: true,
                style: {
                    'float': 'none',
                    'display': 'inline-block',
                    'height': parseInt(self.window.getComputedStyle($zone[0]).lineHeight) + 'px',
                },
            };
        }

        // Firstly, add a dropzone after the clone (if we are not in grid mode).
        var $clone = this.$body.find('.oe_drop_clone');
        if ($clone.length && $clone.closest('div.o_grid_mode').length === 0) {
            var $neighbor = $clone.prev();
            if (!$neighbor.length) {
                $neighbor = $clone.next();
            }
            var data;
            if ($neighbor.length) {
                data = setDropZoneDirection($neighbor, $neighbor.parent());
            } else {
                data = {
                    vertical: false,
                    style: {},
                };
            }
            self._insertDropzone($('<we-hook/>').insertAfter($clone), data.vertical, data.style, canBeSanitizedUnless);
        }

        if ($selectorChildren) {
            $selectorChildren.each(function () {
                var data;
                var $zone = $(this);
                var $children = $zone.find('> :not(.oe_drop_zone, .oe_drop_clone)');

                if (!$zone.children().last().is('.oe_drop_zone')) {
                    data = testPreviousSibling($zone[0].lastChild, $zone)
                        || setDropZoneDirection($zone, $zone, $children.last());
                    self._insertDropzone($('<we-hook/>').appendTo($zone), data.vertical, data.style, canBeSanitizedUnless);
                }

                if (!$zone.children().first().is('.oe_drop_clone')) {
                    data = testPreviousSibling($zone[0].firstChild, $zone)
                        || setDropZoneDirection($zone, $zone, $children.first());
                    self._insertDropzone($('<we-hook/>').prependTo($zone), data.vertical, data.style, canBeSanitizedUnless);
                }
            });

            // add children near drop zone
            $selectorSiblings = $(unique(($selectorSiblings || $()).add($selectorChildren.children()).get()));
        }

        var noDropZonesSelector = '[data-invisible="1"], .o_we_no_overlay, :not(:visible), :not(:o_editable)';
        if ($selectorSiblings) {
            $selectorSiblings.not(`.oe_drop_zone, .oe_drop_clone, ${noDropZonesSelector}`).each(function () {
                var data;
                var $zone = $(this);
                var $zoneToCheck = $zone;

                while ($zoneToCheck.prev(noDropZonesSelector).length) {
                    $zoneToCheck = $zoneToCheck.prev();
                }
                if (!$zoneToCheck.prev('.oe_drop_zone:visible, .oe_drop_clone').length) {
                    data = setDropZoneDirection($zone, $zone.parent());
                    self._insertDropzone($('<we-hook/>').insertBefore($zone), data.vertical, data.style, canBeSanitizedUnless);
                }

                $zoneToCheck = $zone;
                while ($zoneToCheck.next(noDropZonesSelector).length) {
                    $zoneToCheck = $zoneToCheck.next();
                }
                if (!$zoneToCheck.next('.oe_drop_zone:visible, .oe_drop_clone').length) {
                    data = setDropZoneDirection($zone, $zone.parent());
                    self._insertDropzone($('<we-hook/>').insertAfter($zone), data.vertical, data.style, canBeSanitizedUnless);
                }
            });
        }

        var count;
        var $zones;
        do {
            count = 0;
            $zones = this.getEditableArea().find('.oe_drop_zone > .oe_drop_zone').remove(); // no recursive zones
            count += $zones.length;
            $zones.remove();
        } while (count > 0);

        // Cleaning consecutive zone and up zones placed between floating or
        // inline elements. We do not like these kind of zones.
        $zones = this.getEditableArea().find('.oe_drop_zone:not(.oe_vertical)');

        let iframeOffset;
        const bodyWindow = this.$body[0].ownerDocument.defaultView;
        if (bodyWindow.frameElement && bodyWindow !== this.ownerDocument.defaultView) {
            iframeOffset = bodyWindow.frameElement.getBoundingClientRect();
        }

        $zones.each(function () {
            var zone = $(this);
            var prev = zone.prev();
            var next = zone.next();
            // remove consecutive zone
            if (prev.is('.oe_drop_zone') || next.is('.oe_drop_zone')) {
                zone.remove();
                return;
            }
            var floatPrev = prev.css('float') || 'none';
            var floatNext = next.css('float') || 'none';
            var dispPrev = prev.css('display') || null;
            var dispNext = next.css('display') || null;
            if ((floatPrev === 'left' || floatPrev === 'right')
             && (floatNext === 'left' || floatNext === 'right')) {
                zone.remove();
            } else if (dispPrev !== null && dispNext !== null
             && dispPrev.indexOf('inline') >= 0 && dispNext.indexOf('inline') >= 0) {
                zone.remove();
            }

            // In the case of the SnippetsMenu being instanciated in the global
            // document, with its editable content in an iframe, we want to
            // take the iframe's offset into account to compute the dropzones.
            if (iframeOffset) {
                this.oldGetBoundingClientRect = this.getBoundingClientRect;
                this.getBoundingClientRect = () => {
                    const rect = this.oldGetBoundingClientRect();
                    const { x, y } = iframeOffset;
                    rect.x += x;
                    rect.y += y;
                    return rect;
                };
            }
        });

        // Inserting a grid dropzone for each row in grid mode.
        for (const rowEl of selectorGrids) {
            self._insertGridDropzone(rowEl);
        }
    }
    /**
     * Updates the state with invisible snippets. This will then trigger
     * `WeInvisibleDOMPanel` to update in the menu editor.
     */
    updateInvisibleDOM() {
        this.state.invisibleSnippetsEls = [...this.invisibleSnippetsEls];
    }
    /**
     * Activates the SnippetEditors related to a target element
     * @param {HTMLElement|false} snippet - The element to activate snippet editors for.
     * It can be false to activate the blocks tabs.
     */
    activateSnippet(snippet) {
        if (snippet && !isVisible(snippet)) {
            return;
        }
        // Take the first parent of the provided DOM (or itself) which
        // should have an associated snippet editor.
        // It is important to do that before the mutex exec call to compute it
        // before potential ancestor removal.
        if (snippet) {
            const $closestSnippet = globalSelector.closest($(snippet));
            if (!$closestSnippet.length) {
                snippet = snippet.closest(
                    '[data-oe-model="ir.ui.view"]:not([data-oe-type]):not(.oe_structure), [data-oe-type="html"]:not(.oe_structure)'
                );
            } else {
                snippet = $closestSnippet[0];
            }
        }
        this.execWithLoadingEffect(async () => {
            const isChild = (parent, element) => {
                while (element) {
                    if (parent === element) {
                        return true;
                    }
                    element = element.parentElement;
                }
                return false;
            };
            const editorIdsToRemove = [];
            for (const editorProps of this.state.snippetEditorsProps) {
                if (!isChild(editorProps.target, snippet)) {
                    editorProps.showOptions = false;
                }
                if (!this.props.editable.contains(editorProps.target)) {
                    editorIdsToRemove.push(editorProps.id);
                }
            }
            this.state.snippetEditorsProps = this.state.snippetEditorsProps.filter(
                (editor) => !editorIdsToRemove.includes(editor.id)
            );
            if (!snippet) {
                this.state.activeTab = this.tabs.BLOCKS;
                return;
            }
            const editorToEnable = this.createSnippetEditorProps(snippet);
            if (!snippet || !editorToEnable) {
                this.state.activeTab = this.tabs.BLOCKS;
                return;
            }
            this.state.activeTab = this.tabs.OPTIONS;
            await Promise.all(this.state.snippetEditorsProps.map(prop => prop.renderPromise));
            this.toggleOverlay(editorToEnable.id, true);
        });
    }
    /**
     * Populates this.state.snippetEditorProps with Props data for the target
     * and its ancestors
     *
     * @param {HTMLElement} target - the element snippets editors will be
     * created for.
     * @param {Boolean} [show] - whether those snippets editors should be visible.
     * @return {Object} - SnippetEditor props of the target element.
     */
    createSnippetEditorProps(target, show = true) {
        if (!target) {
            return;
        }
        let parentEditor = false;
        if (!target.classList.contains("o_no_parent_editor")) {
            // find closest and create the props for that one.
            const $parent = globalSelector.closest($(target.parentElement));
            if ($parent.length) {
                parentEditor = this.createSnippetEditorProps($parent[0]);
            }
        }
        const existingEditor = this.state.snippetEditorsProps.find((props) => props.target === target);
        if (existingEditor) {
            existingEditor.showOptions = !!show;
            return existingEditor;
        }
        const id = uniqueId("snippet-editor");
        const props = {
            id,
            target,
            bus: new EventBus(),
            parentBus: parentEditor && parentEditor.bus,
            // Empty object for the snippet editor to fill with methods
            // that the snippets menu can call. These methods are usually
            // limited to target modifications.
            events: {},
            options: this.templateOptions,
            manipulatorsArea: this.manipulatorsArea,
            showOptions: !!show,
            showOverlay: false,
            previewOverlay: false,
            updateUICounter: 0,
            updateOverlayCounter: 0,
            // TODO: make it easier for editors to call toggle overlay by pre-adding the ID
            toggleOverlay: this.toggleOverlay.bind(this),
            toggleSnippetOptionVisibility: this.toggleSnippetOptionVisibility.bind(this),
            snippetEditionRequest: this.snippetEditionRequest.bind(this),
            getDragAndDropOptions: this.getDragAndDropOptions.bind(this),
            renderPromise: new Deferred(),
            activateInsertionZones: this.activateInsertionZones.bind(this),
            getEditableArea: this.getEditableArea.bind(this),
            renderChildSnippets: this.renderChildSnippets.bind(this),
            callForEachChildSnippet: this.callForEachChildSnippet.bind(this),
            updateInvisibleDOM: this.updateInvisibleDOM.bind(this),
            snippetRemoved: () => this.props.snippetRemoved(),
            requestUserValueWidget: (name, allowParent, stopAtEl) => {
                let widget = false;
                const onSuccess = (w) => (widget = w);
                if (parentEditor) {
                    parentEditor.bus.trigger("request_user_value_widget", {
                        name,
                        allowParent,
                        stopAtEl,
                        onSuccess,
                    });
                }
                return widget;
            },
            updateUI: () => {
                this.execWithLoadingEffect(() => {
                    this.updateCurrentSnippetEditorOverlay();
                    this.state.snippetEditorsProps.forEach((props) => {
                        props.updateUICounter++;
                    });
                });
            },
        };
        this.state.snippetEditorsProps.push(props);
        return props;
    }
    /**
     * Disable the overlay editor of the active snippet and activate the new one
     * if given.
     * Note 1: if the snippet editor associated to the given snippet is not
     *         created yet, this method will create it.
     * Note 2: if the given DOM element is not a snippet (no editor option), the
     *         first parent which is one is used instead.
     *
     * @param {jQuery|false} $snippet
     *        The DOM element whose editor (and its parent ones) need to be
     *        enabled. Only disable the current one if false is given.
     * @param {boolean} [previewMode=false]
     * @param {boolean} [ifInactiveOptions=false]
     * @returns {Promise<SnippetEditor>}
     *          (might be async when an editor must be created)
     */
    async _activateSnippet($snippet, previewMode, ifInactiveOptions) {
        if (this._blockPreviewOverlays && previewMode) {
            return;
        }
        if ($snippet && !$snippet.is(':visible')) {
            return;
        }
        // Take the first parent of the provided DOM (or itself) which
        // should have an associated snippet editor.
        // It is important to do that before the mutex exec call to compute it
        // before potential ancestor removal.
        if ($snippet && $snippet.length) {
            const $globalSnippet = globalSelector.closest($snippet);
            if (!$globalSnippet.length) {
                $snippet = $snippet.closest('[data-oe-model="ir.ui.view"]:not([data-oe-type]):not(.oe_structure), [data-oe-type="html"]:not(.oe_structure)');
            } else {
                $snippet = $globalSnippet;
            }
        }
        const exec = previewMode
            ? action => this._mutex.exec(action)
            : action => this._execWithLoadingEffect(action, false);
        return exec(() => {
            return new Promise(resolve => {
                if ($snippet && $snippet.length) {
                    return this._createSnippetEditor($snippet).then(resolve);
                }
                resolve(null);
            }).then(async editorToEnable => {
                if (!previewMode && this._enabledEditorHierarchy[0] === editorToEnable
                        || ifInactiveOptions && this._enabledEditorHierarchy.includes(editorToEnable)) {
                    return editorToEnable;
                }

                if (!previewMode) {
                    this._enabledEditorHierarchy = [];
                    let current = editorToEnable;
                    while (current && current.$target) {
                        this._enabledEditorHierarchy.push(current);
                        current = current.getParent();
                    }
                }

                // First disable all editors...
                for (let i = this.snippetEditors.length; i--;) {
                    const editor = this.snippetEditors[i];
                    editor.toggleOverlay(false, previewMode);
                    if (!previewMode) {
                        const wasShown = !!await editor.toggleOptions(false);
                        if (wasShown) {
                            this._updateRightPanelContent({
                                content: [],
                                tab: this.tabs.BLOCKS,
                            });
                        }
                    }
                }
                // ... then enable the right editor or look if some have been
                // enabled previously by a click
                let customize$Elements;
                if (editorToEnable) {
                    editorToEnable.toggleOverlay(true, previewMode);
                    if (!previewMode && !editorToEnable.displayOverlayOptions) {
                        const parentEditor = this._enabledEditorHierarchy.find(ed => ed.displayOverlayOptions);
                        if (parentEditor) {
                            parentEditor.toggleOverlay(true, previewMode);
                        }
                    }
                    customize$Elements = await editorToEnable.toggleOptions(true);
                } else {
                    for (const editor of this.snippetEditors) {
                        if (editor.isSticky()) {
                            editor.toggleOverlay(true, false);
                            customize$Elements = await editor.toggleOptions(true);
                        }
                    }
                }

                if (!previewMode) {
                    // As some options can only be generated using JavaScript
                    // (e.g. 'SwitchableViews'), it may happen at this point
                    // that the overlay is activated even though there are no
                    // options. That's why we disable the overlay if there are
                    // no options to enable.
                    if (editorToEnable && !customize$Elements) {
                        editorToEnable.toggleOverlay(false);
                    }
                    this._updateRightPanelContent({
                        content: customize$Elements || [],
                        tab: customize$Elements ? this.tabs.OPTIONS : this.tabs.BLOCKS,
                    });
                }

                return editorToEnable;
            }).then(async editor => {
                // If a link was clicked, the linktools should be focused after
                // the right panel is shown to the user.
                // TODO: this should be reviewed to be done another way: we
                // should avoid focusing something here while it is being
                // rendered elsewhere.
                const linkTools = this.options.wysiwyg.linkTools;
                if (linkTools && this._currentTab === this.tabs.OPTIONS
                        && !linkTools.noFocusUrl) {
                    // Wait for `linkTools` potential in-progress rendering
                    // before focusing the URL input on `snippetsMenu` (this
                    // prevents race condition for automated testing).
                    await linkTools.renderingPromise;
                    linkTools.focusUrl();
                }
                return editor;
            });
        });
    }
    /**
     * @private
     * @param {boolean} invalidateCache
     */
    async _loadSnippetsTemplates(invalidateCache) {
        return this._execWithLoadingEffect(async () => {
            await this._destroyEditors();
            const html = await this.loadSnippets(invalidateCache);
            await this._computeSnippetTemplates(html);
        }, false);
    }
    /**
     * TODO everything related to SnippetEditor destroy / cleanForSave should
     * really be cleaned / unified.
     *
     * @private
     * @param {SnippetEditor} editor
     */
    _destroyEditor(editor) {
        editor.destroy();
        const index = this.snippetEditors.indexOf(editor);
        if (index >= 0) {
            this.snippetEditors.splice(index, 1);
        }
    }
    /**
     * @private
     * @param {jQuery|null|undefined} [$el]
     *        The DOM element whose inside editors need to be destroyed.
     *        If no element is given, all the editors are destroyed.
     */
    async _destroyEditors ($el) {
        const aliveEditors = this.state.snippetEditorsProps.filter((snippetEditor) => {
            return !$el || $el.has($(snippetEditor.target)).length;
        });
        const cleanForSavePromises = aliveEditors.map((snippetEditor) => snippetEditor.events.cleanForSave());
        await Promise.all(cleanForSavePromises);

        for (const snippetEditor of aliveEditors) {
            // No need to clean the `this.snippetEditors` array as each
            // individual destroy notifies this class instance to remove the
            // element from the array.
            this.state.snippetEditorsProps = [];
        }
    }
    /**
     * Calls a given callback 'on' the given snippet and all its child ones if
     * any (DOM element with options).
     *
     * Note: the method creates the snippet editors if they do not exist yet.
     *
     * @private
     * @param {HTMLElement} snippet
     * @param {function} callback
     *        Given two arguments: the snippet editor's props associated to the snippet
     *        being managed and the DOM element of this snippet.
     * @returns {Promise} (might be async if snippet editors need to be created
     *                     and/or the callback is async)
     */
    async callForEachChildSnippet(snippet, callback) {
        await this.renderChildSnippets(snippet);
        const defs = [];
        for (const props of this.state.snippetEditorsProps) {
            if (props.target.contains(snippet)) {
                defs.push(callback(props, props.target));
            }
        }
        return Promise.all(defs);
    }
    /**
     * Implements an equivalent to callForEachChildSnippet() for one snippet.
     * @see this.callForEachChildSnippet for parameters
     */
    async callForSnippet(snippet, callback) {
        const targetProps = this.createSnippetEditorProps(snippet, false);
        await Promise.resolve(targetProps.renderPromise);
        return Promise.resolve(callback(targetProps, snippet));
    }
    renderChildSnippets(snippet) {
        const $snippet = $(snippet);
        const proms = Array.from($snippet.add(globalSelector.all($snippet))).map((target) => {
            const prop = this.createSnippetEditorProps(target, false);
            return prop && prop.renderPromise;
        });
        return Promise.all(proms);
    }
    /**
     * @private
     */
    _closeWidgets() {
        this.snippetEditors.forEach(editor => editor.closeWidgets());
    }
    /**
     * Creates and returns a set of helper functions which can help finding
     * snippets in the DOM which match some parameters (typically parameters
     * given by a snippet option). The functions are:
     *
     * - `is`: to determine if a given DOM is a snippet that matches the
     *         parameters
     *
     * - `closest`: find closest parent (or itself) of a given DOM which is a
     *              snippet that matches the parameters
     *
     * - `all`: find all snippets in the DOM that match the parameters
     *
     * See implementation for function details.
     *
     * @private
     * @param {string} selector
     *        jQuery selector that DOM elements must match to be considered as
     *        potential snippet.
     * @param {string} exclude
     *        jQuery selector that DOM elements must *not* match to be
     *        considered as potential snippet.
     * @param {string|false} target
     *        jQuery selector that at least one child of a DOM element must
     *        match to that DOM element be considered as a potential snippet.
     * @param {boolean} noCheck
     *        true if DOM elements which are technically not in an editable
     *        environment may be considered.
     * @param {boolean} isChildren
     *        when the DOM elements must be in an editable environment to be
     *        considered (@see noCheck), this is true if the DOM elements'
     *        parent must also be in an editable environment to be considered.
     * @param {string} excludeParent
     *        jQuery selector that the parents of DOM elements must *not* match
     *        to be considered as potential snippet.
     */
    computeSelectorFunctions(selector, exclude, target, noCheck, isChildren, excludeParent) {
        var self = this;

        // The `:not(.o_editable_media)` part is handled outside of the selector
        // (see filterFunc).
        // Note: the `:not([contenteditable="true"])` part was there for that
        // same purpose before the implementation of the o_editable_media class.
        // It still make sense for potential editable areas though. Although it
        // should be reviewed if we are to handle more hierarchy of nodes being
        // editable despite their non editable environment.
        // Without the `:not(.s_social_media)`, it is no longer possible to edit
        // icons in the social media snippet. This should be fixed in a more
        // proper way to get rid of this hack.
        exclude += `${exclude && ', '}.o_snippet_not_selectable`;

        let filterFunc = function () {
            // Exclude what it is asked to exclude.
            if ($(this).is(exclude)) {
                return false;
            }
            // `o_editable_media` bypasses the `o_not_editable` class.
            if (this.classList.contains('o_editable_media')) {
                return weUtils.shouldEditableMediaBeEditable(this);
            }
            return !$(this)
                .is('.o_not_editable:not(.s_social_media) :not([contenteditable="true"])');
        };
        if (target) {
            const oldFilter = filterFunc;
            filterFunc = function () {
                return oldFilter.apply(this) && $(this).find(target).length !== 0;
            };
        }
        if (excludeParent) {
            const oldFilter = filterFunc;
            filterFunc = function () {
                return oldFilter.apply(this) && !$(this).parent().is(excludeParent);
            };
        }

        // Prepare the functions
        const functions = {};
        // In translate mode, it is only possible to modify text content but not
        // the structure of the snippets. For this reason, the "Editable area"
        // are only the text zones and they should not be used inside functions
        // such as "is", "closest" and "all".
        if (noCheck || this.props.enableTranslation) {
            functions.is = function ($from) {
                return $from.is(selector) && $from.filter(filterFunc).length !== 0;
            };
            functions.closest = function ($from, parentNode) {
                return $from.closest(selector, parentNode).filter(filterFunc);
            };
            functions.all = function ($from) {
                return ($from ? dom.cssFind($from, selector) : self.$body.find(selector)).filter(filterFunc);
            };
        } else {
            functions.is = function ($from) {
                return $from.is(selector)
                    && self.getEditableArea().find($from).addBack($from).length !== 0
                    && $from.filter(filterFunc).length !== 0;
            };
            functions.closest = function ($from, parentNode) {
                var parents = self.getEditableArea().get();
                return $from.closest(selector, parentNode).filter(function () {
                    var node = this;
                    while (node.parentNode) {
                        if (parents.indexOf(node) !== -1) {
                            return true;
                        }
                        node = node.parentNode;
                    }
                    return false;
                }).filter(filterFunc);
            };
            functions.all = isChildren ? function ($from) {
                return dom.cssFind($from || self.getEditableArea(), selector).filter(filterFunc);
            } : function ($from) {
                $from = $from || self.getEditableArea();
                return $from.filter(selector).add(dom.cssFind($from, selector)).filter(filterFunc);
            };
        }
        return functions;
    }
    /**
     * Processes the given snippet template to register snippet options, creates
     * draggable thumbnail, etc.
     *
     * @private
     * @param {string} html
     */
    computeSnippetTemplates(snippetsHTML) {
        // TODO: This method parses the template to pretty much output exactly the
        // same way it is in the backend... Would be more efficient to markup
        // and output it, but then we loose some OWL features like t-on-x t-ref
        // and more. Here this allows to keep track of every snippet, their ID
        // and would allow us to add a custom Snippet without having to reload
        // the template completely.
        const panels = snippetsHTML.querySelectorAll(".o_panel");
        for (const panel of panels) {
            const header = panel.querySelector(".o_panel_header");
            const section = { id: "", name: "", header: "", snippets: [], visible: true };
            section.id = panel.getAttribute("id");
            if (header) {
                section.name = header.innerText;
                section.header = markup(header.innerHTML);
            }
            for (const snippetEl of panel.querySelector(".o_panel_body").children) {
                const moduleId = snippetEl.getAttribute("data-oe-module-id") || false;
                const name = snippetEl.getAttribute("name");
                const id = snippetEl.dataset.oeSnippetId || `${moduleId}-${name}`;
                const keywords = snippetEl.getAttribute("data-oe-keywords");
                const snippet = {
                    id,
                    name,
                    keywords,
                    moduleId,
                    visible: true,
                    baseBody: snippetEl.children[0],
                    thumbnail: snippetEl.getAttribute("data-oe-thumbnail"),
                    section: section,
                    el: snippetEl,
                };
                snippet.baseBody.dataset.name = name;
                section.snippets.push(snippet);
                this.snippets[id] = snippet;
                // TODO: Create the install button (t-install feature) if necessary
                // const moduleID = $snippet.data('moduleId');
                // if (moduleID) {
                //     el.classList.add('o_snippet_install');
                //     $thumbnail.append($('<button/>', {
                //         class: 'btn btn-primary o_install_btn w-100',
                //         type: 'button',
                //         text: _t("Install"),
                //     }));
                // }

                // TODO: Create the rename and delete button for custom snippets
                // if (isCustomSnippet) {
                //     const btnRenameEl = document.createElement('we-button');
                //     btnRenameEl.dataset.snippetId = $snippet.data('oeSnippetId');
                //     btnRenameEl.classList.add('o_rename_btn', 'fa', 'fa-pencil', 'btn', 'o_we_hover_success');
                //     btnRenameEl.title = sprintf(_t("Rename %s"), name);
                //     $snippet.append(btnRenameEl);
                //     const btnEl = document.createElement('we-button');
                //     btnEl.dataset.snippetId = $snippet.data('oeSnippetId');
                //     btnEl.classList.add('o_delete_btn', 'fa', 'fa-trash', 'btn', 'o_we_hover_danger');
                //     btnEl.title = sprintf(_t("Delete %s"), name);
                //     $snippet.append(btnEl);
                // }
            }
            this.state.snippetSections.push(section);
        }
        const snippetOptionsRegistry = registry.category("snippets_options");
        const selectors = [];
        const styles = Array.from(snippetsHTML.querySelectorAll("[data-selector]"));
        const snippetAdditionDropIn = styles
            .filter((style) => style.id === "so_snippet_addition")
            .map((style) => style.dataset.dropIn);

        console.group("ignored options")
        for (const style of styles) {
            const selector = style.dataset.selector;
            const exclude = style.dataset.exclude || "";
            const excludeParent = style.id === "so_content_addition" ? snippetAdditionDropIn : "";
            const target = style.dataset.target;
            const noCheck = style.dataset.noCheck;
            const optionID = style.dataset.js;

            if (optionID || style.children.length) {
                // TODO: Parse option templates from server view.
                // (We will store all the option infos includign a template name
                // in a root div e.g.:
                // <div name="template_name" selector="...">
                //     <WeButtonGroup ...>
                //        <WeButton .../>
                // ...)
                // for now, ignore the option.
                if (style.dataset.dropIn || style.dataset.dropNear) {
                    console.log(style);
                }
                continue;
            }
            const option = {
                component: optionID,
                selector,
                exclude,
                target,
                dropIn: style.dataset.dropIn,
                dropNear: style.dataset.dropNear,
                data: Object.assign({ string: style.getAttribute("string") }, style.dataset),
            };
            snippetOptionsRegistry.add(uniqueId("server_options"), option);
        }
        console.groupEnd("ignored options");

        for (const option of snippetOptionsRegistry.getAll()) {
            //option.baseSelector = option.selector;
            //option.baseTarget = option.target;
            //option.baseExclude = option.exclude;
            //const selector = this.computeSelectorFunctions(
            //    option.selector,
            //    option.exclude,
            //    option.target
            //);
            //selectors.push(selector);
            //if (option.dropNear) {
            //    option.dropNear = this.computeSelectorFunctions(option.dropNear, "", false, option.noCheck, true, "");
            //}
            const selector = option.base_selector || option.selector;
            const exclude = option.base_exclude || option.exclude || "";
            const excludeParent = option.id === "so_content_addition" ? snippetAdditionDropIn : "";
            const target = option.base_target || option.target;
            const dropNear = option.base_drop_near || option.dropNear;
            const dropIn = option.base_drop_in || option.dropIn;
            const noCheck = option.noCheck;

            Object.assign(option, {
                base_selector: selector,
                base_exclude: exclude,
                base_target: target,
                base_drop_near: dropNear,
                base_drop_in: dropIn,
                selector: this.computeSelectorFunctions(selector, exclude, target, noCheck),
                "drop-near":
                    dropNear &&
                    this.computeSelectorFunctions(
                        dropNear,
                         "",
                         false,
                        noCheck,
                         true,
                        excludeParent
                    ),
                "drop-in":
                    dropIn &&
                    this.computeSelectorFunctions(dropIn, "", false, noCheck),
                computedSelectorFunctions: true,
            });
            this.templateOptions.push(option);
            selectors.push(option.selector);
        }

        globalSelector.closest = function ($from) {
            let $temp;
            let $target;
            for (const selector of selectors) {
                $temp = selector.closest($from, $target && $target[0]);
                if ($temp.length) {
                    $target = $temp;
                }
            }
            return $target || $();
        };
        globalSelector.all = function ($from) {
            var $target = $();
            for (var i = 0, len = selectors.length; i < len; i++) {
                $target = $target.add(selectors[i].all($from));
            }
            return $target;
        };
        globalSelector.is = function ($from) {
            for (var i = 0, len = selectors.length; i < len; i++) {
                if (selectors[i].is($from)) {
                    return true;
                }
            }
            return false;
        };

        // Register the text nodes that needs to be auto-selected on click
        this._registerDefaultTexts($(snippetsHTML));

        // Add the computed template and make elements draggable
        // TODO: Disable Undroppable snippet
        // this._disableUndroppableSnippets();

        // this.$el.addClass('o_loaded');
        // $(this.el.ownerDocument.body).toggleClass('editor_has_snippets', !this.folded);
    }
    /**
     * Eases patching the XML definition for snippets and options in stable
     * versions. Note: in the future, we will probably move to other ways to
     * define snippets and options.
     *
     * @private
     * @param {jQuery}
     */
    _patchForComputeSnippetTemplates($html) {}
    /**
     * Creates a snippet editor to associated to the given snippet. If the given
     * snippet already has a linked snippet editor, the function only returns
     * that one.
     * The function also instantiates a snippet editor for all snippet parents
     * as a snippet editor must be able to display the parent snippet options.
     *
     * @private
     * @param {jQuery} $snippet
     * @returns {Promise<SnippetEditor>}
     */
    _createSnippetEditor($snippet) {
        var self = this;
        var snippetEditor = $snippet.data('snippet-editor');
        if (snippetEditor) {
            return snippetEditor.__isStarted;
        }

        var def;
        if (!$snippet[0].classList.contains('o_no_parent_editor')) {
            var $parent = globalSelector.closest($snippet.parent());
            if ($parent.length) {
                def = this._createSnippetEditor($parent);
            }
        }

        return Promise.resolve(def).then(function (parentEditor) {
            // When reaching this position, after the Promise resolution, the
            // snippet editor instance might have been created by another call
            // to _createSnippetEditor... the whole logic should be improved
            // to avoid doing this here.
            snippetEditor = $snippet.data('snippet-editor');
            if (snippetEditor) {
                return snippetEditor.__isStarted;
            }

            let editableArea = self.getEditableArea();
            // snippetEditor = new SnippetEditor(parentEditor || self, $snippet, self.templateOptions, $snippet.closest('[data-oe-type="html"], .oe_structure').add(editableArea), self.options);
            self.snippetEditors.push(snippetEditor);
            // Keep parent below its child inside the DOM as its `o_handle`
            // needs to be (visually) on top of the child ones.
            return snippetEditor.prependTo(self.$snippetEditorArea);
        }).then(function () {
            return snippetEditor;
        });
    }
    /**
     * There may be no location where some snippets might be dropped. This mades
     * them appear disabled in the menu.
     *
     * @todo make them undraggable
     * @private
     */
    _disableUndroppableSnippets() {
        var self = this;
        var cache = {};
        this.$snippets.each(function () {
            var $snippet = $(this);
            var $snippetBody = $snippet.find('.oe_snippet_body');
            const isSanitizeForbidden = $snippet.data('oeForbidSanitize');
            const filterSanitize = isSanitizeForbidden === 'form'
                ? $els => $els.filter((i, el) => !el.closest('[data-oe-sanitize]:not([data-oe-sanitize="allow_form"])'))
                : isSanitizeForbidden
                    ? $els => $els.filter((i, el) => !el.closest('[data-oe-sanitize]'))
                    : $els => $els;

            var check = false;
            self.templateOptions.forEach((option, k) => {
                if (check || !($snippetBody.is(option.base_selector) && !$snippetBody.is(option.base_exclude))) {
                    return;
                }

                k = isSanitizeForbidden ? 'forbidden/' + k : k;
                cache[k] = cache[k] || {
                    'drop-near': option['drop-near'] ? filterSanitize(option['drop-near'].all()).length : 0,
                    'drop-in': option['drop-in'] ? filterSanitize(option['drop-in'].all()).length : 0,
                };
                check = (cache[k]['drop-near'] || cache[k]['drop-in']);
            });

            $snippet.toggleClass('o_disabled', !check);
            $snippet.attr('title', check ? '' : _t("No location to drop in"));
            const $icon = $snippet.find('.o_snippet_undroppable').remove();
            if (check) {
                $icon.remove();
            } else if (!$icon.length) {
                const imgEl = document.createElement('img');
                imgEl.classList.add('o_snippet_undroppable');
                imgEl.src = '/web_editor/static/src/img/snippet_disabled.svg';
                $snippet.append(imgEl);
            }
        });
    }
    /**
     * @private
     * @param {string} [search]
     */
    _filterSnippets(search) {
        search = search.toLowerCase();
        const strMatches = str => !search || str.toLowerCase().includes(search);
        for (const section of this.state.snippetSections) {
            let hasVisibleSnippet = false;
            const isSectionTitleMatch = strMatches(section.name);
            for (const snippet of section.snippets) {
                const matches = (isSectionTitleMatch
                    || strMatches(snippet.name)
                    || strMatches(snippet.keywords || ''));
                if (matches) {
                    hasVisibleSnippet = true;
                }
                snippet.visible = matches;
            }
            section.visible = hasVisibleSnippet;
        }
    }
    /**
     * Creates a dropzone element and inserts it by replacing the given jQuery
     * location. This allows to add data on the dropzone depending on the hook
     * environment.
     *
     * @private
     * @param {jQuery} $hook
     * @param {boolean} [vertical=false]
     * @param {Object} [style]
     * @param {string or boolean} canBeSanitizedUnless
     *    true: always allow
     *    'form': allow if forms are allowed
     *    false: always fobid
     */
    _insertDropzone($hook, vertical, style, canBeSanitizedUnless) {
        const skip = $hook.closest('[data-oe-sanitize="no_block"]').length;
        let forbidSanitize;
        if (canBeSanitizedUnless === 'form') {
            forbidSanitize = $hook.closest('[data-oe-sanitize]:not([data-oe-sanitize="allow_form"]):not([data-oe-sanitize="no_block"])').length;
        } else {
            forbidSanitize = !canBeSanitizedUnless && $hook.closest('[data-oe-sanitize]:not([data-oe-sanitize="no_block"])').length;
        }
        var $dropzone = $('<div/>', {
            'class': skip ? 'd-none' : 'oe_drop_zone oe_insert' + (vertical ? ' oe_vertical' : '') +
                (forbidSanitize ? ' text-center oe_drop_zone_danger' : ''),
        });
        if (style) {
            $dropzone.css(style);
        }
        if (forbidSanitize) {
            $dropzone[0].appendChild(document.createTextNode(
                _t("For technical reasons, this block cannot be dropped here")
            ));
        }
        $hook.replaceWith($dropzone);
        return $dropzone;
    }
    /**
     * Creates a dropzone taking the entire area of the row in grid mode in
     * which it will be added. It allows to place elements dragged over it
     * inside the grid it belongs to.
     *
     * @param {Element} rowEl
     */
    _insertGridDropzone(rowEl) {
        const columnCount = 12;
        const rowCount = parseInt(rowEl.dataset.rowCount);
        let $dropzone = $('<div/>', {
            'class': 'oe_drop_zone oe_insert oe_grid_zone',
            'style': 'grid-area: ' + 1 + '/' + 1 + '/' + (rowCount + 1) + '/' + (columnCount + 1),
        });
        $dropzone[0].style.minHeight = window.getComputedStyle(rowEl).height;
        $dropzone[0].style.width = window.getComputedStyle(rowEl).width;
        rowEl.append($dropzone[0]);
    }
    /**
     * Get the drag and drop options.
     */
    getDragAndDropOptions(){
        return {
            ref: this.oScroll,
            elements: ".oe_snippet",
            scrollingArea: this.props.editable,
            getHelper: () => this.dragState.helper,
            onDragStart: ({ element, addClass }) => {
                this.toggleOverlay(null, false);
                this.hideSnippetPopover();
                this.dragState = {
                    snippet: this.snippets[element.dataset.oeSnippetId],
                    toInsert: this.snippets[element.dataset.oeSnippetId].baseBody.cloneNode(true),
                    dropped: false,
                    dragAndDropPromise: new Deferred(),
                };
                this.props.odooEditor.automaticStepUnactive("dragAndDropCreateSnippet");
                this.props.odooEditor.observerUnactive("dragAndDropCreateSnippet");
                this.env.mutex.exec(() => this.dragState.dragAndDropPromise);

                const helper = element.cloneNode(true);
                helper
                    .querySelectorAll(".o_delete_btn, .o_rename_btn")
                    .forEach((el) => el.remove());
                helper.classList.add("ui-draggable", "ui-draggable-dragging");
                helper.style.position = "fixed";
                document.body.append(helper);
                this.dragState.helper = helper;

                addClass(element.querySelector(".oe_snippet_thumbnail"), "o_we_already_dragging");

                const baseBody = this.dragState.toInsert;
                const $baseBody = $(baseBody);
                this.props.editable.ownerDocument.body.classList.add("oe_dropzone_active");
                // TODO: Remove JQuery?
                let $selectorSiblings = $();
                let $selectorChildren = $();
                const selectorExcludeAncestor = [];
                const temp = this.templateOptions;
                for (const option of temp) {
                    if (
                        $baseBody.is(option.base_selector) &&
                        !(option.base_exclude !== "" && $baseBody.is(option.base_exclude))
                    ) {
                        if (option["drop-near"]) {
                            $selectorSiblings = $selectorSiblings.add(option["drop-near"].all());
                        }
                        if (option["drop-in"]) {
                            $selectorChildren = $selectorChildren.add(option["drop-in"].all());
                        }
                        if (option['drop-exclude-ancestor']) {
                            selectorExcludeAncestor.push(option['drop-exclude-ancestor']);
                        }
                    }
                }
                // Prevent dropping an element into another one.
                // (E.g. ToC inside another ToC)
                for (const excludedAncestorSelector of selectorExcludeAncestor) {
                    $selectorSiblings = $selectorSiblings.filter((i, el) => !el.closest(excludedAncestorSelector));
                    $selectorChildren = $selectorChildren.filter((i, el) => !el.closest(excludedAncestorSelector));
                }

                this.dragState.toInsert
                    .querySelectorAll('img[src^="/web_editor/shape/"]')
                    .forEach((dynamicSvg) => {
                        const colorCustomizedURL = new URL(
                            dynamicSvg.getAttribute("src"),
                            window.location.origin
                        );
                        colorCustomizedURL.searchParams.forEach((value, key) => {
                            const match = key.match(/^c([1-5])$/);
                            if (match) {
                                colorCustomizedURL.searchParams.set(
                                    key,
                                    getCSSVariableValue(`o-color-${match[1]}`)
                                );
                            }
                        });
                        dynamicSvg.src = colorCustomizedURL.pathname + colorCustomizedURL.search;
                    });

                if (!$selectorSiblings.length && !$selectorChildren.length) {
                    console.warn(
                        this.dragState.snippet.name +
                            " have not insert action: data-drop-near or data-drop-in"
                    );
                    return;
                }

                const forbidSanitize = this.dragState.snippet.el.dataset.oeForbidSanitize;
                const canBeSanitizedUnless = forbidSanitize === "form" ? "form" : !forbidSanitize;

                this.activateInsertionZones(
                    $selectorSiblings,
                    $selectorChildren,
                    canBeSanitizedUnless
                );
            },
            dropzoneOver: ({ element }, dropzone) => {
                dropzone.after(this.dragState.toInsert);
                dropzone.classList.add("invisible");
                this.dragState.dropped = true;
            },
            dropzoneOut: ({ element }, dropzone) => {
                this.dragState.dropped = false;
                dropzone.classList.remove("invisible");
                this.dragState.toInsert.remove();
                this.dragState.dropped = false;
            },
            onDragEnd: ({ element, x, y }) => {
                this.dragState.helper.remove();

                const doc = this.props.odooEditor.document;
                $(doc.body).removeClass('oe_dropzone_active');
                this.props.odooEditor.automaticStepUnactive();
                this.props.odooEditor.automaticStepSkipStack();

                if (
                    !this.dragState.dropped &&
                    y > 3 &&
                    x + this.dragState.helper.getBoundingClientRect().top <
                        this.oScroll.el.getBoundingClientRect().left
                ) {
                    const point = { x, y };
                    const droppedOnNotNearest = touching(doc.body.querySelectorAll('.oe_structure_not_nearest'), point);
                    //const droppedOnNotNearest = doc.defaultView.$.touching(
                    //    point,
                    //    ".oe_structure_not_nearest",
                    //    container
                    //).first();
                    // If dropped outside a dropzone with class oe_structure_not_nearest,
                    // move the snippet to the nearest dropzone without it
                    const selector = droppedOnNotNearest.length
                        ? ".oe_drop_zone:not(.disabled)"
                        : ":not(.oe_structure_not_nearest) > .oe_drop_zone:not(.disabled)";
                    const $el = $(closest(doc.body.querySelectorAll(selector), point));
                    if ($el.length) {
                        $el.after(this.dragState.toInsert);
                    }
                }

                let prev;
                let next;
                let toInsertParent;
                if (this.dragState.dropped) {
                    prev = this.dragState.toInsert.previousSibling;
                    next = this.dragState.toInsert.nextSibling;

                    toInsertParent = this.dragState.toInsert.parentElement;
                    this.dragState.toInsert.remove();
                }

                // TODO: Activate the observer
                this.props.odooEditor.observerActive("dragAndDropCreateSnippet");
                // FIXME: Flicker when doing this

                if (this.dragState.dropped) {
                    if (prev) {
                        prev.after(this.dragState.toInsert);
                    } else if (next) {
                        next.before(this.dragState.toInsert);
                    } else {
                        toInsertParent.prepend(this.dragState.toInsert);
                    }
                }
                this.props.odooEditor.observerUnactive("dragAndDropCreateSnippet");
                const target = this.dragState.toInsert;
                browser.setTimeout(async () => {
                    // Free the mutex now to allow following operations
                    // (mutexed as well).
                    this.dragState.dragAndDropPromise.resolve();

                     await this.callPostSnippetDrop(target);

                    // Restore editor to its normal edition state, also
                    // make sure the undroppable snippets are updated.
                    // TOOD:
                    // this._disableUndroppableSnippets();
                    this.props.odooEditor.unbreakableStepUnactive();
                    this.props.odooEditor.historyStep();
                    this.dragState = {};
                });

                this.getEditableArea().find(".oe_drop_zone").remove();
                this.props.odooEditor.observerActive("dragAndDropCreateSnippet");
            },
            getDropArea: this.getEditableArea.bind(this),
        };
    }
    /**
     * Adds the 'o_default_snippet_text' class on nodes which contain only
     * non-empty text nodes. Those nodes are then auto-selected by the editor
     * when they are clicked.
     *
     * @private
     * @param {jQuery} [$in] - the element in which to search, default to the
     *                       snippet bodies in the menu
     */
    _registerDefaultTexts($in) {
        if ($in === undefined) {
            $in = this.$snippets.find('.oe_snippet_body');
        }

        $in.find('*').addBack()
            .contents()
            .filter(function () {
                return this.nodeType === 3 && this.textContent.match(/\S/);
            }).parent().addClass('o_default_snippet_text');
    }
    /**
     * Changes the content of the left panel and selects a tab.
     *
     * @private
     * @param {htmlString | Element | Text | Array | jQuery} [content]
     * the new content of the customizePanel
     * @param {this.tabs.VALUE} [tab='blocks'] - the tab to select
     */
    _updateRightPanelContent({content, tab, ...options}) {
        this._hideActiveTooltip();
        this._closeWidgets();

        this._currentTab = tab || this.tabs.BLOCKS;

        if (this._$toolbarContainer) {
            this._$toolbarContainer[0].remove();
        }
        this._$toolbarContainer = null;
        if (content) {
            while (this.customizePanel.firstChild) {
                this.customizePanel.removeChild(this.customizePanel.firstChild);
            }
            $(this.customizePanel).append(content);
            if (this._currentTab === this.tabs.OPTIONS && !options.forceEmptyTab) {
                this._addToolbar();
            }
        }

        this.$('.o_snippet_search_filter').toggleClass('d-none', this._currentTab !== this.tabs.BLOCKS);
        this.$('#o_scroll').toggleClass('d-none', this._currentTab !== this.tabs.BLOCKS);
        this.customizePanel.classList.toggle('d-none', this._currentTab === this.tabs.BLOCKS);
        // Remove active class of custom button (e.g. mass mailing theme selection).
        this.$('#snippets_menu button').removeClass('active');
        this.$('.o_we_add_snippet_btn').toggleClass('active', this._currentTab === this.tabs.BLOCKS);
        this.$('.o_we_customize_snippet_btn').toggleClass('active', this._currentTab === this.tabs.OPTIONS);
    }
    /**
     * Scrolls to given snippet.
     *
     * @private
     * @param {jQuery} $el - snippet to scroll to
     * @param {jQuery} [$scrollable] - $element to scroll
     * @return {Promise}
     */
    async scrollToSnippet($el, $scrollable) {
        // Don't scroll if $el is added to a visible popup that does not fill
        // the page (otherwise the page would scroll to a random location).
        const modalEl = $el[0].closest('.modal');
        if (modalEl && !dom.hasScrollableContent(modalEl)) {
            return;
        }
        return dom.scrollTo($el[0], {extraOffset: 50, $scrollable: $scrollable});
    }
    /**
     * Adds the action to the mutex queue and sets a loading effect over the
     * editor to appear if the action takes too much time.
     * As soon as the mutex is unlocked, the loading effect will be removed.
     *
     * @private
     * @param {function} action
     * @param {boolean} [contentLoading=true]
     * @param {number} [delay=500]
     * @returns {Promise}
     */
    async _execWithLoadingEffect(action, contentLoading = true, delay = 500) {
        const mutexExecResult = this._mutex.exec(action);
        if (!this.loadingTimers[contentLoading]) {
            const addLoader = () => {
                if (this._loadingEffectDisabled || this.loadingElements[contentLoading]) {
                    return;
                }
                this.loadingElements[contentLoading] = this._createLoadingElement();
                if (contentLoading) {
                    this.$snippetEditorArea.append(this.loadingElements[contentLoading]);
                } else {
                    this.el.appendChild(this.loadingElements[contentLoading]);
                }
            };
            if (delay) {
                this.loadingTimers[contentLoading] = setTimeout(addLoader, delay);
            } else {
                addLoader();
            }
            this._mutex.getUnlockedDef().then(() => {
                // Note: we remove the loading element at the end of the
                // execution queue *even if subsequent actions are content
                // related or not*. This is a limitation of the loading feature,
                // the goal is still to limit the number of elements in that
                // queue anyway.
                if (delay) {
                    clearTimeout(this.loadingTimers[contentLoading]);
                    this.loadingTimers[contentLoading] = undefined;
                }

                if (this.loadingElements[contentLoading]) {
                    this.loadingElements[contentLoading].remove();
                    this.loadingElements[contentLoading] = null;
                }
            });
        }
        return mutexExecResult;
    }
    /**
     * Update the options pannel as being empty.
     *
     * TODO review the utility of that function and how to call it (it was not
     * called inside a mutex then we had to do it... there must be better things
     * to do).
     *
     * @private
     */
    _activateEmptyOptionsTab() {
        this._updateRightPanelContent({
            content: this.emptyOptionsTabContent,
            tab: this.tabs.OPTIONS,
            forceEmptyTab: true,
        });
    }
    /**
     * Hides the active tooltip.
     *
     * @private
     */
    _hideActiveTooltip() {
        // The BS documentation says that "Tooltips that use delegation (which
        // are created using the selector option) cannot be individually
        // destroyed on descendant trigger elements". So we remove the active
        // tooltips manually.
        // For instance, without this, clicking on "Hide in Desktop" on a
        // snippet will leave the tooltip "forever" visible even if the "Hide in
        // Desktop" button is gone.
        const tooltipClass = 'aria-describedby';
        const tooltippedEl = this.actionButtonsRef.el.querySelector(`[${tooltipClass}^="tooltip"]`);
        if (tooltippedEl) {
            const tooltipEl = document.getElementById(tooltippedEl.getAttribute(tooltipClass));
            if (tooltipEl) {
                Tooltip.getInstance(tooltipEl).hide();
            }
        }
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Activates the right snippet and initializes its SnippetEditor.
     *
     * @private
     */
    onClick(ev) {
        if (this.editionState.saving) {
            return;
        }
        const target =
            ev.target ||
            (ev.originalEvent && (ev.originalEvent.target || ev.originalEvent.originalTarget));
        if (!target || this.lastTarget === target) {
            return;
        }
        if (
            target.closest(".o_edit_menu_popover") &&
            ((target.parentElement && target.parentElement.matches("a")) || target.matches("a"))
        ) {
            return;
        }
        this.lastTarget = target;
        browser.setTimeout(() => {
            this.lastTarget = false;
        });

        if (!target.closest("we-button, we-toggler, we-select, .o_we_color_preview")) {
            // this.closeWidget();
        }
        if (!target.closest("body > *") || target.matches("#iframe_target")) {
            return;
        }
        if (target.closest(this.props.notActivableElementsSelector)) {
            return;
        }

        const oeStructure = target.closest(".oe_structure");
        // TODO: Make the snippet bounce again
        // if (oeStructure && !oeStructure.children && !!Object.keys(this.snippets)) {}
        this.activateSnippet(target);
    }
    /**
     * Called when a child editor asks for insertion zones to be enabled.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onActivateInsertionZones(ev) {
        this._activateInsertionZones(ev.data.$selectorSiblings, ev.data.$selectorChildren, ev.data.canBeSanitizedUnless, ev.data.selectorGrids);
    }
    /**
     * Called when a child editor asks to deactivate the current snippet
     * overlay.
     *
     * @private
     */
    _onActivateSnippet(ev) {
        const prom = this._activateSnippet(ev.data.$snippet, ev.data.previewMode, ev.data.ifInactiveOptions);
        if (ev.data.onSuccess) {
            prom.then(() => ev.data.onSuccess());
        }
    }
    /**
     * Called when a child editor asks to operate some operation on all child
     * snippet of a DOM element.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onCallForEachChildSnippet(ev) {
        this._callForEachChildSnippet(ev.data.$snippet, ev.data.callback)
            .then(() => ev.data.onSuccess());
    }
    /**
     * Called when the overlay dimensions/positions should be recomputed.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onOverlaysCoverUpdate(ev) {
        this.snippetEditors.forEach(editor => {
            if (ev.data.overlayVisible) {
                editor.toggleOverlayVisibility(true);
            }
            editor.cover();
        });
    }
    /**
     * Called when a child editor asks to clone a snippet, allows to correctly
     * call the _onClone methods if the element's editor has one.
     *
     * @private
     * @param {OdooEvent} ev
     */
    async _onCloneSnippet(ev) {
        ev.stopPropagation();
        const editor = await this._createSnippetEditor(ev.data.$snippet);
        await editor.clone();
        if (ev.data.onSuccess) {
            ev.data.onSuccess();
        }
    }
    /**
     * Called when a child editor asks to deactivate the current snippet
     * overlay.
     *
     * @private
     */
    _onDeactivateSnippet() {
        this._activateSnippet(false);
    }
    /**
    * Called when a snippet will move in the page.
    *
    * @private
    */
   _onSnippetDragAndDropStart() {
        this.snippetEditorDragging = true;
    }
    /**
     * Called when a snippet has moved in the page.
     *
     * @private
     * @param {OdooEvent} ev
     */
    async _onSnippetDragAndDropStop(ev) {
        this.snippetEditorDragging = false;
        const visibleConditionalEls = [];
        for (const snippetEditor of this.snippetEditors) {
            const targetEl = snippetEditor.$target[0];
            if (targetEl.dataset["visibility"] === "conditional" &&
                !targetEl.classList.contains("o_conditional_hidden")) {
                visibleConditionalEls.push(targetEl);
            }
        }
        const modalEl = ev.data.$snippet[0].closest('.modal');
        const carouselItemEl = ev.data.$snippet[0].closest('.carousel-item');
        // If the snippet is in a modal, destroy editors only in that modal.
        // This to prevent the modal from closing because of the cleanForSave
        // on each editors. Same thing for 'carousel-item', otherwise all the
        // editors of the 'carousel' are destroyed and the 'carousel' jumps to
        // first slide.
        await this._destroyEditors(carouselItemEl ? $(carouselItemEl) : modalEl ? $(modalEl) : null);
        await this._activateSnippet(ev.data.$snippet);
        // Because of _destroyEditors(), all the snippets with a conditional
        // visibility are hidden. Show the ones that were visible before the
        // drag and drop.
        for (const visibleConditionalEl of visibleConditionalEls) {
            visibleConditionalEl.classList.remove("o_conditional_hidden");
            delete visibleConditionalEl.dataset["invisible"];
        }
        // Update the "Invisible Elements" panel as the order of invisible
        // snippets could have changed on the page.
        await this._updateInvisibleDOM();
    }
    /**
     * Transforms an event coming from a touch screen into a mouse event.
     *
     * @private
     * @param {Event} ev - a touch event
     */
    onTouchEvent(ev) {
        if (ev.touches.length > 1) {
            // Ignore multi-touch events.
            return;
        }
        const touch = ev.changedTouches[0];
        const touchToMouse = {
            touchstart: "mousedown",
            touchmove: "mousemove",
            touchend: "mouseup"
        };
        const simulatedEvent = new MouseEvent(touchToMouse[ev.type], {
            screenX: touch.screenX,
            screenY: touch.screenY,
            clientX: touch.clientX,
            clientY: touch.clientY,
            button: 0, // left mouse button
            bubbles: true,
            cancelable: true,
        });
        touch.target.dispatchEvent(simulatedEvent);
    }
    /**
     * Returns the droppable snippet from which a dropped snippet originates.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onFindSnippetTemplate(ev) {
        this.$snippets.each(function () {
            const snippetBody = this.querySelector(`.oe_snippet_body[data-snippet=${ev.data.snippet.dataset.snippet}]`);
            if (snippetBody) {
                ev.data.callback(snippetBody.parentElement);
                return false;
            }
        });
    }
    /**
     * @private
     */
    _onHideOverlay() {
        for (const editor of this.snippetEditors) {
            editor.toggleOverlay(false);
        }
    }
    /**
     * @private
     * @param {Event} ev
     */
    _onInstallBtnClick(ev) {
        var self = this;
        var $snippet = $(ev.currentTarget).closest('[data-module-id]');
        var moduleID = $snippet.data('moduleId');
        var name = $snippet.attr('name');
        new Dialog(this, {
            title: _t("Install %s", name),
            size: 'medium',
            $content: $('<div/>', {text: _t("Do you want to install the %s App?"), name}).append(
                $('<a/>', {
                    target: '_blank',
                    href: '/web#id=' + encodeURIComponent(moduleID) + '&view_type=form&model=ir.module.module&action=base.open_module_tree',
                    text: _t("More info about this app."),
                    class: 'ml4',
                })
            ),
            buttons: [{
                text: _t("Save and Install"),
                classes: 'btn-primary',
                click: function () {
                    this.$footer.find('.btn').toggleClass('o_hidden');
                    this._rpc({
                        model: 'ir.module.module',
                        method: 'button_immediate_install',
                        args: [[moduleID]],
                    }).then(() => {
                        self.trigger_up('request_save', {
                            invalidateSnippetCache: true,
                            _toMutex: true,
                            reloadWebClient: true,
                        });
                    }).guardedCatch(reason => {
                        reason.event.preventDefault();
                        this.close();
                        const message = markup(_t("Could not install module <strong>%s</strong>", name));
                        self.displayNotification({
                            message: message,
                            type: 'danger',
                            sticky: true,
                        });
                    });
                },
            }, {
                text: _t("Install in progress"),
                icon: 'fa-spin fa-circle-o-notch fa-spin mr8',
                classes: 'btn-primary disabled o_hidden',
            }, {
                text: _t("Cancel"),
                close: true,
            }],
        }).open();
    }
    /**
     * @param {Event} ev
     */
    async onInvisibleEntryClick(ev) {
        const isVisible = await this.callForSnippet(ev.details.target, (editorProps) => {
            return editorProps.events.toggleTargetVisibility(ev.details.show);
        });
        this.activateSnippet(isVisible ? ev.details.target : false);
    }
    /**
     * @private
     */
    _onBlocksTabClick(ev) {
        this._activateSnippet(false);
    }
    /**
     * @private
     */
    _onOptionsTabClick(ev) {
        if (!ev.currentTarget.classList.contains('active')) {
            this._activateSnippet(false);
            this._mutex.exec(() => {
                this._activateEmptyOptionsTab();
            });
        }
    }
    /**
     * @private
     */
    _onDeleteBtnClick(ev) {
        const $snippet = $(ev.target).closest('.oe_snippet');
        const snippetId = parseInt(ev.currentTarget.dataset.snippetId);
        ev.stopPropagation();
        new Dialog(this, {
            size: 'medium',
            title: _t('Confirmation'),
            $content: $('<div><p>' + _t("Are you sure you want to delete the snippet: %s?", $snippet.attr('name')) + '</p></div>'),
            buttons: [{
                text: _t("Yes"),
                close: true,
                classes: 'btn-primary',
                click: async () => {
                    await this._rpc({
                        model: 'ir.ui.view',
                        method: 'delete_snippet',
                        kwargs: {
                            'view_id': snippetId,
                            'template_key': this.options.snippets,
                        },
                    });
                    await this._loadSnippetsTemplates(true);
                },
            }, {
                text: _t("No"),
                close: true,
            }],
        }).open();
    }
    /**
     * @private
     */
    _onRenameBtnClick(ev) {
        const $snippet = $(ev.target).closest('.oe_snippet');
        const snippetName = $snippet.attr('name');
        const confirmText = _t('Confirm');
        const cancelText = _t('Cancel');
        const $input = $(`
            <we-input class="o_we_user_value_widget w-100 mx-1">
                <div>
                    <input type="text" autocomplete="chrome-off" value="${snippetName}" class="text-start"/>
                    <we-button class="o_we_confirm_btn o_we_text_success fa fa-check" title="${confirmText}"/>
                    <we-button class="o_we_cancel_btn o_we_text_danger fa fa-times" title="${cancelText}"/>
                </div>
            </we-input>
        `);
        $snippet.find('we-button').remove();
        $snippet.find('span.oe_snippet_thumbnail_title').replaceWith($input);
        const $textInput = $input.find('input');
        $textInput.focus();
        $textInput.select();
        $snippet.find('.oe_snippet_thumbnail').addClass('o_we_already_dragging'); // prevent drag
        $input.find('.o_we_confirm_btn').click(async () => {
            const name = $textInput.val();
            if (name !== snippetName) {
                this._execWithLoadingEffect(async () => {
                    await this._rpc({
                        model: 'ir.ui.view',
                        method: 'rename_snippet',
                        kwargs: {
                            'name': name,
                            'view_id': parseInt(ev.target.dataset.snippetId),
                            'template_key': this.options.snippets,
                        },
                    });
                }, true);
            }
            await this._loadSnippetsTemplates(name !== snippetName);
        });
        $input.find('.o_we_cancel_btn').click(async () => {
            await this._loadSnippetsTemplates(false);
        });
    }
    /**
     * Prevents pointer-events to change the focus when a pointer slide from
     * left-panel to the editable area.
     *
     * @private
     */
    _onMouseDown(ev) {
        const $blockedArea = $('#wrapwrap'); // TODO should get that element another way
        this.options.wysiwyg.odooEditor.automaticStepSkipStack();
        $blockedArea.addClass('o_we_no_pointer_events');
        const reenable = () => {
            this.options.wysiwyg.odooEditor.automaticStepSkipStack();
            $blockedArea.removeClass('o_we_no_pointer_events');
        };
        // Use a setTimeout fallback to avoid locking the editor if the mouseup
        // is fired over an element which stops propagation for example.
        const enableTimeoutID = setTimeout(() => reenable(), 5000);
        $(document).one('mouseup', () => {
            clearTimeout(enableTimeoutID);
            reenable();
        });
    }
    /**
     * @private
     */
    _onMouseUp(ev) {
        const snippetEl = ev.target.closest('.oe_snippet');
        if (snippetEl) {
            this._showSnippetTooltip($(snippetEl));
        }
    }
    /**
     * Displays an autofading tooltip over a snippet, after a delay.
     * If in the meantime the user has started to drag the snippet, it won't be
     * shown.
     *
     * TODO: remove delay param in master
     *
     * @private
     * @param {jQuery} $snippet
     * @param {Number} [delay=1500]
     */
    _showSnippetTooltip($snippet, delay = 1500) {
        this.$snippets.not($snippet).tooltip('hide');
        $snippet.tooltip('show');
        this._hideSnippetTooltips(1500);
    }
    /**
     * @private
     * @param {Number} [delay=0]
     */
    _hideSnippetTooltips(delay = 0) {
        clearTimeout(this.__hideSnippetTooltipTimeout);
        this.__hideSnippetTooltipTimeout = setTimeout(() => {
            this.$snippets.tooltip('hide');
        }, delay);
    }
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onGetSnippetVersions(ev) {
        const snippet = this.el.querySelector(`.oe_snippet > [data-snippet="${ev.data.snippetName}"]`);
        ev.data.onSuccess(snippet && {
            vcss: snippet.dataset.vcss,
            vjs: snippet.dataset.vjs,
            vxml: snippet.dataset.vxml,
        });
    }
    /**
     * UNUSED: used to be called when saving a custom snippet. We now save and
     * reload the page when saving a custom snippet so that all the DOM cleanup
     * mechanisms are run before saving. Kept for compatibility.
     *
     * TODO: remove in master / find a way to clean the DOM without save+reload
     *
     * @private
     */
    async _onReloadSnippetTemplate(ev) {
        await this._activateSnippet(false);
        await this._loadSnippetsTemplates(true);
    }
    /**
     * @private
     */
    _onBlockPreviewOverlays(ev) {
        this._blockPreviewOverlays = true;
    }
    /**
     * @private
     */
    _onUnblockPreviewOverlays(ev) {
        this._blockPreviewOverlays = false;
    }
    /**
     * @private
     * @param {OdooEvent} ev
     */
    async _onRemoveSnippet(ev) {
        ev.stopPropagation();
        const editor = await this._createSnippetEditor(ev.data.$snippet);
        await editor.removeSnippet(ev.data.shouldRecordUndo);
        if (ev.data.onSuccess) {
            ev.data.onSuccess();
        }
    }
    /**
     * Saving will destroy all editors since they need to clean their DOM.
     * This has thus to be done when they are all finished doing their work.
     *
     * @param {Object} options - options that should be passed to the wysiwyg
     * @private
     */
    onSaveRequest(options) {
        if (options.fromSnippetsMenu && !options._toMutex) {
            return;
        }
        delete options._toMutex;
        this._buttonClick((after) => this.execWithLoadingEffect(() => {
            const oldOnFailure = options.onFailure;
            options.onFailure = (reason) => {
                console.warn("reason", reason);
                if (oldOnFailure) {
                    oldOnFailure(reason);
                }
                after();
            };
            this.props.requestSave(options);
        }, true), this.actionButtonsRef.el?.querySelector('button[data-action=save]'));
    }
    /**
     * @private
     */
    _onSnippetClick() {
        const $els = this.getEditableArea().find('.oe_structure.oe_empty').addBack('.oe_structure.oe_empty');
        for (const el of $els) {
            if (!el.children.length) {
                $(el).odooBounce('o_we_snippet_area_animation');
            }
        }
    }
    /**
     * @private
     * @param {function} callback
     */
    snippetEditionRequest(callback) {
        return this.execWithLoadingEffect(callback);
    }
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onSnippetEditorDestroyed(ev) {
        ev.stopPropagation();
        const index = this.snippetEditors.indexOf(ev.target);
        this.snippetEditors.splice(index, 1);
    }
    /**
     * @private
     */
    _onSnippetCloned(ev) {
        this._updateInvisibleDOM();
    }
    /**
     * Called when a snippet is removed -> checks if there is draggable snippets
     * to enable/disable as the DOM changed.
     *
     * @private
     */
    _onSnippetRemoved() {
        this._disableUndroppableSnippets();
        this._updateInvisibleDOM();
    }
    /**
     * When the editor panel receives a notification indicating that an option
     * was used, the panel is in charge of asking for an UI update of the whole
     * panel. Logically, the options are displayed so that an option above
     * may influence the status and visibility of an option which is below;
     * e.g.:
     * - the user sets a badge type to 'info'
     *      -> the badge background option (below) is shown as blue
     * - the user adds a shadow
     *      -> more options are shown afterwards to control it (not above)
     *
     * Technically we however update the whole editor panel (parent and child
     * options) wherever the updates comes from. The only important thing is
     * to first update the options UI then their visibility as their visibility
     * may depend on their UI status.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onSnippetOptionUpdate(ev) {
        ev.stopPropagation();
        (async () => {
            // Only update editors whose DOM target is still inside the document
            // as a top option may have removed currently-enabled child items.
            const editors = this._enabledEditorHierarchy.filter(editor => !!editor.$target[0].closest('body'));

            await Promise.all(editors.map(editor => editor.updateOptionsUI()));
            await Promise.all(editors.map(editor => editor.updateOptionsUIVisibility()));

            // Always enable the deepest editor whose DOM target is still inside
            // the document.
            if (editors[0] !== this._enabledEditorHierarchy[0]) {
                // No awaiting this as the mutex is currently locked here.
                this._activateSnippet(editors[0].$target);
            }

            ev.data.onSuccess();
        })();
    }
    /**
     * @private
     * @param {OdooEvent} ev
     */
    async _onSnippetOptionVisibilityUpdate(ev) {
        if (this.options.wysiwyg.isSaving()) {
            // Do not update the option visibilities if we are destroying them.
            return;
        }
        if (!ev.data.show) {
            await this._activateSnippet(false);
        }
        await this._updateInvisibleDOM(); // Re-render to update status
    }
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onSnippetThumbnailURLRequest(ev) {
        const $snippet = this.$snippets.has(`[data-snippet="${ev.data.key}"]`);
        ev.data.onSuccess($snippet.length ? $snippet[0].dataset.oeThumbnail : '');
    }
    /**
     * Called when an user value widget is being opened -> close all the other
     * user value widgets of all editors + add backdrop.
     */
    _onUserValueWidgetOpening() {
        this._closeWidgets();
        this.el.classList.add('o_we_backdrop');
    }
    /**
     * Called when an user value widget is being closed -> rely on the fact only
     * one widget can be opened at a time: remove the backdrop.
     */
    _onUserValueWidgetClosing() {
        this.el.classList.remove('o_we_backdrop');
    }
    /**
     * Called when search input value changed -> adapts the snippets grid.
     *
     * @private
     */
    _onSnippetSearchInput() {
        this._filterSnippets();
    }
    /**
     * Called on snippet search filter reset -> clear input field search.
     *
     * @private
     */
    _onSnippetSearchResetClick() {
        this._filterSnippets('');
    }
    /**
     * Called when a child editor asks to update the "Invisible Elements" panel.
     *
     * @private
     */
    async _onUpdateInvisibleDom() {
        await this._updateInvisibleDOM();
    }
    _addToolbar(toolbarMode = "text") {
        if (this.folded) {
            return;
        }
        let titleText = _t("Inline Text");
        switch (toolbarMode) {
            case "image":
                titleText = _t("Image Formatting");
                break;
            case "video":
                titleText = _t("Video Formatting");
                break;
            case "picto":
                titleText = _t("Icon Formatting");
                break;
        }

        this.options.wysiwyg.toolbarEl.classList.remove('oe-floating');

        // Create toolbar custom container.
        this._$toolbarContainer = $('<WE-CUSTOMIZEBLOCK-OPTIONS id="o_we_editor_toolbar_container"/>');
        const $title = $("<we-title><span>" + titleText + "</span></we-title>");
        this._$toolbarContainer.append($title);
        // In case, the snippetEditor is inside an iframe, change the prototype
        // of the element. This is required as the toolbar element is used as a
        // reference to position the dropdown. The library popper.js check if
        // the element is an HTMLElement. If that check returns false, the
        // calculation err.
        this.options.wysiwyg.toolbarEl.__proto__ = this.options.wysiwyg.toolbarEl.ownerDocument.defaultView.HTMLDivElement.prototype;
        // In case, the snippetEditor is inside an iframe, rebind the dropdown
        // from the iframe.
        for (const dropdown of this.options.wysiwyg.toolbarEl.querySelectorAll('.colorpicker-group')) {
            const $ = dropdown.ownerDocument.defaultView.$;
            const $dropdown = $(dropdown);
            $dropdown.off('show.bs.dropdown');
            $dropdown.on('show.bs.dropdown', () => {
                this.options.wysiwyg.onColorpaletteDropdownShow(dropdown.dataset.colorType);
            });
            $dropdown.off('hide.bs.dropdown');
            $dropdown.on('hide.bs.dropdown', (ev) => this.options.wysiwyg.onColorpaletteDropdownHide(ev));
        }
        this._$toolbarContainer.append(this.options.wysiwyg.toolbar$El);
        $(this.customizePanel).append(this._$toolbarContainer);

        // Create table-options custom container.
        const $customizeTableBlock = $(QWeb.render('web_editor.toolbar.table-options'));
        this.options.wysiwyg.odooEditor.bindExecCommand($customizeTableBlock[0]);
        $(this.customizePanel).append($customizeTableBlock);
        this._$removeFormatButton = this.options.wysiwyg.toolbar$El.find('#removeFormat');
        $title.append(this._$removeFormatButton);
        this._$toolbarContainer.append(this.options.wysiwyg.toolbar$El);

        this._checkEditorToolbarVisibility();
    }
    /**
     * Update editor UI visibility based on the current range.
     */
    _checkEditorToolbarVisibility(e) {
        const selection = this.env.odooEditor.document.getSelection();
        const range = selection && selection.rangeCount && selection.getRangeAt(0);
        const $currentSelectionTarget = $(range && range.commonAncestorContainer);
        // Do not  toggle visibility if the target is inside the toolbar ( eg.
        // during link edition).
        if ($currentSelectionTarget.closest('#o_we_editor_toolbar_container').length ||
            (e && $(e.target).closest('#o_we_editor_toolbar_container').length)
        ) {
            return;
        }
        if (!range ||
            !$currentSelectionTarget.parents('#wrapwrap, .iframe-editor-wrapper .o_editable').length ||
            closestElement(selection.anchorNode, '[data-oe-model]:not([data-oe-type="html"]):not([data-oe-field="arch"]):not([data-oe-translation-initial-sha])') ||
            closestElement(selection.focusNode, '[data-oe-model]:not([data-oe-type="html"]):not([data-oe-field="arch"]):not([data-oe-translation-initial-sha])') ||
            (e && $(e.target).closest('.fa, img').length ||
            this.props.wysiwyg.lastMediaClicked && $(this.props.wysiwyg.lastMediaClicked).is('.fa, img')) ||
            (this.props.wysiwyg.lastElement && !this.props.wysiwyg.lastElement.isContentEditable)
        ) {
            this.state.showToolbar = false;
        } else {
            this.state.showToolbar = true;
        }

        const isInsideTD = !!(
            range &&
            $(range.startContainer).closest('.o_editable td').length &&
            $(range.endContainer).closest('.o_editable td').length
        );
        this.state.showTable = isInsideTD;
    }
    /**
     * On click on discard button.
     */
    onDiscardClick() {
        this._buttonClick(after => {
            this.toggleOverlay(null, false);
            this.props.requestCancel({onReject: after});
        }, this.actionButtonsRef.el.querySelector('button[data-action=cancel]'), false);
    }
    /**
     * Preview on mobile.
     */
    _onMobilePreviewClick() {
        this.trigger_up('request_mobile_preview');

        // TODO refactor things to make this more understandable -> on mobile
        // edition, update the UI. But to do it properly and inside the mutex
        // this simulates what happens when a snippet option is used.
        this._execWithLoadingEffect(async () => {
            // TODO needed so that mobile edition is considered before updating
            // the UI but this is clearly random. The trigger_up above should
            // properly await for the rerender somehow.
            await new Promise(resolve => setTimeout(resolve));

            return new Promise(resolve => {
                this.trigger_up('snippet_option_update', {
                    onSuccess: () => resolve(),
                });
            });
        }, false);

        // Reload images inside grid items so that no image disappears when
        // activating mobile preview.
        const $gridItemEls = this.getEditableArea().find('div.o_grid_item');
        for (const gridItemEl of $gridItemEls) {
            gridUtils._reloadLazyImages(gridItemEl);
        }
        for (const invisibleOverrideEl of this.getEditableArea().find('.o_snippet_mobile_invisible, .o_snippet_desktop_invisible')) {
            invisibleOverrideEl.classList.remove('o_snippet_override_invisible');
            invisibleOverrideEl.dataset.invisible = '1';
        }
        // This is async but using the main editor mutex.
        this._updateInvisibleDOM();
    }
    /**
     * Undo..
     */
    _onUndo () {
        this.options.wysiwyg.undo();
    }
    /**
     * Redo.
     */
    _onRedo() {
        this.options.wysiwyg.redo();
    }
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onRequestEditable(ev) {
        ev.data.callback($(this.options.wysiwyg.odooEditor.editable));
    }
    /**
     * Enable loading effects
     *
     * @private
     */
    _onEnableLoadingEffect() {
        this._loadingEffectDisabled = false;
    }
    /**
     * Disable loading effects and cancel the one displayed
     *
     * @private
     */
    _onDisableLoadingEffect() {
        this._loadingEffectDisabled = true;
        Object.keys(this.loadingElements).forEach(key => {
            if (this.loadingElements[key]) {
                this.loadingElements[key].remove();
                this.loadingElements[key] = null;
            }
        });
    }
    /***
     * Display a loading effect on the clicked button, and disables the other
     * buttons. Passes an argument to restore the buttons to their normal
     * state to the function to execute.
     *
     * @param action {Function} The action to execute
     * @param button {HTMLElement} The button element
     * @param addLoadingEffect {boolean} whether or not to add a loading effect.
     * @returns {Promise<void>}
     * @private
     */
    async _buttonClick(action, button, addLoadingEffect = true) {
        if (this._buttonAction) {
            return;
        }
        this._buttonAction = true;
        // Remove the tooltip now, because the button will be disabled and so,
        // the tooltip will not be removable (see BS doc).
        this._hideActiveTooltip();
        let after = () => null;
        if (this.actionButtonsRef.el) {
            let removeLoadingEffect;
            if (addLoadingEffect) {
                removeLoadingEffect = dom.addButtonLoadingEffect(button);
            }
            const actionButtons = this.actionButtonsRef.el.querySelectorAll('[data-action]');
            for (const actionButton of actionButtons) {
                actionButton.disabled = true;
            }
            after = () => {
                if (removeLoadingEffect) {
                    removeLoadingEffect();
                }
                for (const actionButton of actionButtons) {
                    actionButton.disabled = false;
                }
            };
        }
        await action(after);
        this._buttonAction = false;
    }
}
