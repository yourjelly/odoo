/** @odoo-module **/
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { uniqueId } from "@web/core/utils/functions";
import { clamp } from "@web/core/utils/numbers";
import { useBus } from "@web/core/utils/hooks";
import { closest, isVisible } from "@web/core/utils/ui";
import { renderToElement } from "@web/core/utils/render";
import { useDragAndDrop } from "@web_editor/utils/drag_and_drop";
import { isUnremovable } from "@web_editor/js/editor/odoo-editor/src/utils/utils";
import * as gridUtils from "@web_editor/js/common/grid_layout_utils";

import dom from "@web/legacy/js/core/dom";

import { SnippetOption } from "./snippets_options";

import {
    Component,
    onMounted,
    onWillUnmount,
    onWillUpdateProps,
    useEffect,
    useState,
    useSubEnv,
} from "@odoo/owl";


export class SnippetEditor extends Component {
    static template = "web_editor.customize_block_options_section";
    static props = [
        "target",
        "showOptions",
        "options",
        "id",
        "manipulatorsArea",
        "previewOverlay",
        "showOverlay",
        "snippetEditionRequest",
        "toggleOverlay",
        "getDragAndDropOptions",
        "requestUserValueWidget",
        "updateUICounter",
        "updateUI",
        "bus",
        "activateInsertionZones",
        "getEditableArea",
        "renderPromise",
        "renderChildSnippets",
        "parentBus",
        "events",
        "callForEachChildSnippet",
        "updateOverlayCounter",
        "snippetRemoved",
    ];
    static defaultProps = {
        name: "Snippet",
    };
    layoutElementsSelector = [
        '.o_we_shape',
        '.o_we_bg_filter',
    ].join(',');
    setup() {
        /** @type {HTMLElement} **/
        this.overlayEl = renderToElement("web_editor.snippet_overlay");
        this.props.manipulatorsArea.appendChild(this.overlayEl);

        const sendBackEl = this.overlayEl.querySelector(".o_send_back");
        const bringFrontEl = this.overlayEl.querySelector(".o_bring_front");

        sendBackEl.addEventListener("click", this.onSendBackClick.bind(this));
        bringFrontEl.addEventListener("click", this.onBringFrontClick.bind(this));

        this.target = this.props.target;

        this.props.events.buildSnippet = this.buildSnippet.bind(this);
        this.props.events.cleanForSave = this.cleanForSave.bind(this);
        this.props.events.onClone = this.onClone.bind(this);
        this.props.events.onRemove = this.onRemove.bind(this);

        this.state = useState({
            name: this.name,
            updateOptionsUICounter: 0,
            updateOptionsUIVisibilityCounter: 0,
        });

        useBus(this.props.bus, "request_user_value_widget", (ev) => {
            ev.detail.onSuccess(this.requestUserValueWidget(ev.detail.name, ev.detail.allowParent, ev.detail.stopAtEl));
        });
        useBus(this.props.bus, "remove_snippet", (ev) => {
            this.removeSnippet().then(() => {
                ev.detail?.onSuccess?.();
            });
        });
        useBus(this.props.bus, "option_notify", (ev) => {
            this.notifyOptions(ev.detail.optionNames, ev.detail.data).then(ev.detail.onSuccess);
        });

        this.options = useState([]);
        this.topOptions = useState([]);

        this.initializeOptions();
        const $target = $(this.props.target);
        this.isTargetParentEditable = $target.parent().is(':o_editable');
        this.isTargetMovable = this.isTargetParentEditable && this.isTargetMovable && !$target.hasClass('oe_unmovable');
        this.isTargetRemovable = this.isTargetParentEditable && !$target.parent().is('[data-oe-type="image"]') && !isUnremovable(this.props.target);
        this.displayOverlayOptions = this.displayOverlayOptions || this.isTargetMovable || !this.isTargetParentEditable;

        if (this.isTargetMovable) {
            const dragAndDropOptions = this.props.getDragAndDropOptions();
            Object.assign(dragAndDropOptions, {
                // Fake ref as the overlay is can be inside the iframe.
                ref: { el: this.overlayEl },
                elements: ".o_move_handle",
                onDragStart: this.onDragAndDropStart.bind(this),
                dropzoneOver: this.onDropzoneOver.bind(this),
                dropzoneOut: this.onDropzoneOut.bind(this),
                getHelper: () => this.dragState.helper,
                onDragEnd: (...args) => {
                    setTimeout(() => {
                        this.onDragAndDropEnd(...args);
                    }, 0);
                },
            });
            useDragAndDrop(dragAndDropOptions);
        }

        useSubEnv({
            widgetsData: {},
        });

        // Update option props ahead of time to handle everything in the same
        // render
        onWillUpdateProps((nextProps) => {
            if (nextProps.showOptions !== this.props.showOptions) {
                for (const opt of this.options) {
                    opt.props.visible = nextProps.showOptions;
                }
            }
        });

        onMounted(this.props.renderPromise.resolve);

        useEffect(
            (show, preview) => {
                this.toggleOverlay(show);
            },
            () => [this.props.showOverlay]
        );
        useEffect(
            (counter) => {
                if (counter > 0) {
                    this.cover();
                }
            },
            () => [this.props.updateOverlayCounter]
        )

        useEffect(
            () => {
                // Because the full tree is not available in options' `onWillStart`
                // We update the option after the first render so that widgets
                // are already rendered once and updated their env.
                this.onOptionUpdate();
            },
            () => [this.props.updateUICounter]
        );

        useEffect(
            () => {
                this.onOptionVisibilityUpdate();
            },
            () => [this.state.updateOptionsUIVisibilityCounter]
        );

        onWillUnmount(() => {
            this.overlayEl.remove();
        });
    }
    /**
     * Returns the target according to an option definition.
     *
     * @param option - option definition
     * @returns {boolean|HTMLElement}
     */
    getOptionTarget(option) {
        // TODO: When browser properly support pseudo selector, remove JQuery
        let $target = $(this.props.target);
        let target = this.props.target;
        let matched = false;
        if (option.selector.is) {
            matched = option.selector.is($target);
        }
        if (option.base_target) {
            $target = $target.find(option.base_target);
            if (!$target.length) {
                matched = false;
            }
        }
        return matched && ($target?.[0] || target);
    }
    /**
     * Whether this snippet editor should be visible or not.
     * @returns {boolean}
     */
    get visible() {
        return (
            this.props.showOptions &&
            Array.from(Object.values(this.options)).some((option) => option.props.visible)
        );
    }
    /**
     * DOMElements have a default name which appears in the overlay when they
     * are being edited. This method retrieves this name; it can be defined
     * directly in the DOM thanks to the `data-name` attribute.
     */
    get name() {
        if (this.props.target.dataset.name !== undefined) {
            return this.props.target.dataset.name;
        }
        if (this.props.target.matches("img")) {
            return _t("Image");
        }
        if (this.props.target.matches(".fa")) {
            return _t("Icon");
        }
        if (this.props.target.matches(".media_iframe_video")) {
            return _t("Video");
        }
        if (this.props.target.parentElement.matches(".row")) {
            return _t("Column");
        }
        if (this.props.target.matches("#wrapwrap > main")) {
            return _t("Page Options");
        }
        return _t("Block");
    }
    /**
     * @returns {boolean}
     */
    isShown() {
        return this.props.showOverlay;
    }
    /**
     * @returns {boolean}
     */
    isTargetVisible() {
        return (this.target.dataset.invisible !== '1');
    }
    /**
     * Makes the editor overlay cover the associated snippet.
     */
    cover() {
        if (!this.isShown() || !this.props.target?.ownerDocument.defaultView) {
            return;
        }

        const modalEl = this.props.target.querySelector(".modal");
        const targetEl = isVisible(modalEl) ? modalEl : this.props.target;

        // Check first if the target is still visible, otherwise we have to
        // hide it. When covering all element after scroll for instance it may
        // have been hidden (part of an affixed header for example) or it may
        // be outside of the viewport (the whole header during an effect for
        // example).
        const rect = targetEl.getBoundingClientRect();
        const vpWidth =
            targetEl.ownerDocument.defaultView.innerWidth || document.documentElement.clientWidth;
        const vpHeight =
            targetEl.ownerDocument.defaultView.innerHeight || document.documentElement.clientHeight;
        const isInViewport =
            rect.bottom > -0.1 &&
            rect.right > -0.1 &&
            vpHeight - rect.top > -0.1 &&
            vpWidth - rect.left > -0.1;
        const hasSize = // :visible not enough for images
            Math.abs(rect.bottom - rect.top) > 0.01 && Math.abs(rect.right - rect.left) > 0.01;
        if (!isInViewport || !hasSize || !isVisible(this.props.target)) {
            // TODO: this.state.overlayVisible = false; ?
            // this.toggleOverlayVisibility(false);
            return;
        }

        const transform = window.getComputedStyle(targetEl).getPropertyValue("transform");
        const transformOrigin = window
            .getComputedStyle(targetEl)
            .getPropertyValue("transform-origin");
        targetEl.classList.add("o_transform_removal");

        // Now cover the element
        const offset = {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
        };

        // The manipulator is supposed to follow the scroll of the content
        // naturally without any JS recomputation.
        const manipulatorOffset = this.props.manipulatorsArea.parentElement.getBoundingClientRect();
        // const manipulatorOffset = this.$el.parent().offset();
        offset.top -= manipulatorOffset.top;
        offset.left -= manipulatorOffset.left;
        const overlayStyle = this.overlayEl.style;
        overlayStyle.width = `${targetEl.offsetWidth}px`;
        overlayStyle.height = `${targetEl.offsetHeight}px`;
        overlayStyle.left = `${offset.left}px`;
        overlayStyle.top = `${offset.top}px`;
        overlayStyle.transform = transform;
        overlayStyle.transformOrigin = transformOrigin;
        this.overlayEl.querySelector(".o_handles").style.height = `${targetEl.offsetHeight}px`;

        targetEl.classList.remove("o_transform_removal");

        const editableOffsetTop =
            this.env.editable.getBoundingClientRect().top - manipulatorOffset.top;
        this.overlayEl.classList.toggle("o_top_cover", offset.top - editableOffsetTop < 25);
        // If the element covered by the overlay has a scrollbar, we remove its
        // right border as it interferes with proper scrolling. (e.g. modal)
        const handleEReadonlyEl = this.overlayEl.querySelector('.o_handle.e.readonly');
        if (handleEReadonlyEl) {
            handleEReadonlyEl.style.width = dom.hasScrollableContent(targetEl) ? 0 : '';
        }
    }
    toggleOverlay(show) {
        if (!this.overlayEl || !this.displayOverlayOptions) {
            return;
        }
        this.overlayEl.classList.remove("o_we_overlay_preview");
        this.overlayEl.classList.toggle("o_we_overlay_sticky", show);
        // TODO: Check this
        //if (!this.displayOverlayOptions) {
        //    this.$el.find('.o_overlay_options_wrap').addClass('o_we_hidden_overlay_options');
        //}

        // Show/hide overlay in preview mode or not
        this.overlayEl.classList.toggle("oe_active", show);
        if (show) {
            this.cover();
        }
        this.toggleOverlayVisibility(show);
    }
    /**
     * @param {boolean} [show=false]
     */
    toggleOverlayVisibility(show) {
        if (this.overlayEl && !this.scrollingTimeout) {
            this.overlayEl.classList.toggle(
                "o_overlay_hidden",
                (!show || this.props.target.matches(".o_animating:not(.o_animate_on_scroll)")) &&
                    this.isShown()
            );
        }
    }
    /**
     * @param {boolean} [show]
     * @returns {Promise<boolean>}
     */
    async toggleTargetVisibility(show) {
        show = await this.toggleVisibilityStatus(show);
        return show;
    }
    /**
     * Changes the target's visibility state and calls every related component
     * to notify them of the change.
     *
     * @private
     * @param {boolean} [show]
     * @return {Promise<boolean>}
     */
    toggleVisibilityStatus(show) {
        return this.env.snippetEditionRequest(async () => {
            if (show === undefined) {
                show = !this.isTargetVisible();
            }
            if (show) {
                delete this.target.dataset.invisible;
            } else {
                this.target.dataset.invisible = '1';
            }
            for (const opt of this.options) {
                if (show) {
                    await opt.props.events.onTargetShow?.();
                } else {
                    await opt.props.events.onTargetHide?.();
                }
            }
            return show;
        });
    }
    /**
     * Create snippet options props. Each prop is essentially the definition of
     * an option that will be rendered.
     */
    initializeOptions() {
        this.selectorSiblings = [];
        this.selectorChildren = [];
        this.selectorLockWithin = new Set();
        const selectorExcludeAncestor = new Set();

        for (const [key, optionDef] of registry.category("snippets_options").getEntries()) {
            const target = this.getOptionTarget(optionDef);
            if (target && optionDef.template) {
                let component = optionDef.component;
                // The optionName is the name of the class. Used for notify.
                let optionName;
                // Use anonymous classes to use different templates with the same
                // component class.
                if (!component) {
                    component = class extends SnippetOption {};
                    optionName = "SnippetOption";
                } else {
                    optionName = component.name;
                    component = class extends component {};
                }
                component.template = optionDef.template;
                const id = uniqueId("snippet-option");
                const option = {
                    component,
                    key,
                    optionName,
                    props: {
                        id,
                        template: optionDef.template,
                        toggleVisibility: (value) =>
                            value === undefined
                                ? (option.props.visible = !option.props.visible)
                                : (option.props.visible = value),
                        target: target,
                        updateOverlay: () => {
                            this.cover();
                        },
                        optionUpdate: this.props.updateUI,
                        toggleOverlay: this.toggleOverlay.bind(this),
                        requestUserValueWidget: this.requestUserValueWidget.bind(this),
                        notifyOptions: this.notifyOptions.bind(this),
                        visible: this.props.showOptions,
                        overlayEl: this.overlayEl,
                        updateOptionsUICounter: 0,
                        updateOptionsUIVisibilityCounter: 0,
                        data: optionDef,
                        events: {},
                    },
                };
                if (option.component.isTopOption) {
                    this.topOptions.push(option);
                } else {
                    this.options.push(option);
                }
                if (option.component.displayOverlayOptions) {
                    this.displayOverlayOptions = true;
                }
                if (option.component.forceNoDeleteButton) {
                    this.forceNoDeleteButton = true;
                }
            }
            if (target && optionDef["drop-near"]) {
                this.selectorSiblings.push(optionDef["drop-near"]);
            }
            if (target && optionDef["drop-in"]) {
                this.selectorChildren.push(optionDef["drop-in"]);
            }
            if (target && optionDef['drop-lock-within']) {
                this.selectorLockWithin.add(optionDef['drop-lock-within']);
            }
            if (target && optionDef['drop-exclude-ancestor']) {
                selectorExcludeAncestor.add(optionDef['drop-exclude-ancestor']);
            }
        }
        if (selectorExcludeAncestor.size) {
            // Prevents dropping an element into another one.
            // (E.g. ToC inside another ToC)
            const excludedAncestorSelector = [...selectorExcludeAncestor].join(", ");
            this.excludeAncestors = (i, el) => !el.closest(excludedAncestorSelector);
        }
        this.isTargetMovable = (this.selectorSiblings.length > 0 || this.selectorChildren.length > 0);
    }
    /**
     *
     * @param name
     * @param [allowParent]
     * @param [stopAtEl] - If allowParent, this parameter can stop the search
     * at thi element.
     * @returns {unknown}
     */
    requestUserValueWidget(name, allowParent, stopAtEl) {
        // TODO: Implement allowParent
        const widget = Object.values(this.env.widgetsData).find((widget) => widget.name === name);
        if (widget) {
            return widget;
        }
        if (allowParent && this.target !== stopAtEl) {
            return this.props.requestUserValueWidget(name, allowParent, stopAtEl);
        }
    }
    /**
     * This method is overridable by module specific classes
     */
    prepareDrag() {
        return () => null;
    }
    /**
     * Called when the snippet is starting to be dragged with the move handle
     *
     * @private
     */
    onDragAndDropStart() {
        this.env.odooEditor.observerUnactive('dragAndDropMoveSnippet');
        // TODO: notify SnippetMenu that we are starting to drag.
        //this.trigger_up('drag_and_drop_start');
        this.env.odooEditor.automaticStepUnactive();
        const self = this;
        self.$target = $(this.props.target);
        this.dragState = {};
        const rowEl = this.props.target.parentNode;
        this.dragState.overFirstDropzone = true;

        this.dragState.helper = document.createElement("div");
        this.dragState.helper.style.position = "absolute";
        this.dragState.helper.style.width = "24px";
        this.dragState.helper.style.height = "24px";
        this.props.target.ownerDocument.body.append(this.dragState.helper);

        this.dragState.restore = this.prepareDrag();

        // Allow the grid mode if the option is present in the right panel or
        // if the grid mode is already activated.
        let hasGridLayoutOption = false;
        const widget = this.requestUserValueWidget("grid_mode", true, rowEl.parentElement);
        if (widget) {
            hasGridLayoutOption = true;
        }
        const allowGridMode = hasGridLayoutOption || rowEl.classList.contains('o_grid_mode');

        // Number of grid columns and rows in the grid item (BS column).
        let columnColCount;
        let columnRowCount;
        // TODO: Should this be moved into a website only folder?
        if (rowEl.classList.contains('row') && this.env.isWebsite) {
            if (allowGridMode) {
                // Toggle grid mode if it is not already on.
                if (!rowEl.classList.contains('o_grid_mode')) {
                    this.env.odooEditor.observerActive('dragAndDropMoveSnippet');
                    const containerEl = rowEl.parentNode;
                    gridUtils._toggleGridMode(containerEl);
                    this.env.odooEditor.observerUnactive('dragAndDropMoveSnippet');
                }

                // Computing the moving column width and height in terms of columns
                // and rows.
                const columnStart = this.props.target.style.gridColumnStart;
                const columnEnd = this.props.target.style.gridColumnEnd;
                const rowStart = this.props.target.style.gridRowStart;
                const rowEnd = this.props.target.style.gridRowEnd;

                columnColCount = columnEnd - columnStart;
                columnRowCount = rowEnd - rowStart;
                this.dragState.columnColCount = columnColCount;
                this.dragState.columnRowCount = columnRowCount;

                // Storing the current grid and grid area to use them for the
                // history.
                this.dragState.startingGrid = rowEl;
                this.dragState.prevGridArea = this.props.target.style.gridArea;

                this.dragState.startingZIndex = this.props.target.style.zIndex;

                // Reload the images.
                gridUtils._reloadLazyImages(this.props.target);
            } else {
                // If the column comes from a snippet that doesn't toggle the
                // grid mode on drag, store its width and height to use them
                // when the column goes over a grid dropzone.
                const isImageColumn = gridUtils._checkIfImageColumn(this.props.target);
                if (isImageColumn) {
                    // Store the image width and height if the column only
                    // contains an image.
                    const imageEl = this.props.target.querySelector('img');
                    this.dragState.columnWidth = parseFloat(imageEl.scrollWidth);
                    this.dragState.columnHeight = parseFloat(imageEl.scrollHeight);
                } else {
                    this.dragState.columnWidth = parseFloat(this.props.target.scrollWidth);
                    this.dragState.columnHeight = parseFloat(this.props.target.scrollHeight);
                }
            }
            // Storing the starting top position of the column.
            this.dragState.columnTop = this.props.target.getBoundingClientRect().top;
            this.dragState.isColumn = true;
            // Deactivate the snippet so the overlay doesn't show.
        }

        const openModalEl = this.props.target.closest('.modal');

        this.dragState.dropped = false;
        this._dropSiblings = {
            prev: self.$target.prev()[0],
            next: self.$target.next()[0],
        };
        self.size = {
            width: self.$target.width(),
            height: self.$target.height()
        };
        const dropCloneEl = document.createElement("div");
        dropCloneEl.classList.add("oe_drop_clone");
        dropCloneEl.style.setProperty("display", "none");
        self.$target[0].after(dropCloneEl);
        self.$target.detach();
        this.toggleOverlay(false);

        var $selectorSiblings;
        for (var i = 0; i < self.selectorSiblings.length; i++) {
            let $siblings = self.selectorSiblings[i].all();
            if (this.excludeAncestors) {
                $siblings = $siblings.filter(this.excludeAncestors);
            }
            $selectorSiblings = $selectorSiblings ? $selectorSiblings.add($siblings) : $siblings;
        }
        var $selectorChildren;
        for (i = 0; i < self.selectorChildren.length; i++) {
            let $children = self.selectorChildren[i].all();
            if (this.excludeAncestors) {
                $children = $children.filter(this.excludeAncestors);
            }
            $selectorChildren = $selectorChildren ? $selectorChildren.add($children) : $children;
        }
        // Disallow dropping an element outside a given direct or
        // indirect parent. (E.g. form field must remain within its own form)
        for (const lockedParentSelector of this.selectorLockWithin) {
            const closestLockedParentEl = dropCloneEl.closest(lockedParentSelector);
            const filterFunc = (i, el) => el.closest(lockedParentSelector) === closestLockedParentEl;
            if ($selectorSiblings) {
                $selectorSiblings = $selectorSiblings.filter(filterFunc);
            }
            if ($selectorChildren) {
                $selectorChildren = $selectorChildren.filter(filterFunc);
            }
        }

        // Remove the siblings/children outside the open popup.
        if (openModalEl) {
            const filterFunc = (i, el) => el.closest('.modal') === openModalEl;
            if ($selectorSiblings) {
                $selectorSiblings = $selectorSiblings.filter(filterFunc);
            }
            if ($selectorChildren) {
                $selectorChildren = $selectorChildren.filter(filterFunc);
            }
        }

        // TODO: move that function to props.
        const canBeSanitizedUnless = true;
        //const canBeSanitizedUnless = this._canBeSanitizedUnless(this.$target[0]);

        // Remove the siblings/children that would add a dropzone as direct
        // child of a grid area and make a dedicated set out of the identified
        // grid areas.
        const selectorGrids = new Set();
        const filterOutSelectorGrids = ($selectorItems, getDropzoneParent) => {
            if (!$selectorItems) {
                return;
            }
            // Looping backwards because elements are removed, so the
            // indexes are not lost.
            for (let i = $selectorItems.length - 1; i >= 0; i--) {
                const el = getDropzoneParent($selectorItems[i]);
                if (el.classList.contains('o_grid_mode')) {
                    $selectorItems.splice(i, 1);
                    selectorGrids.add(el);
                }
            }
        };
        filterOutSelectorGrids($selectorSiblings, el => el.parentElement);
        filterOutSelectorGrids($selectorChildren, el => el);

        // TODO: find why this is needed.
        //this.trigger_up('activate_snippet', {$snippet: this.$target.parent()});
        this.props.activateInsertionZones($selectorSiblings, $selectorChildren, canBeSanitizedUnless, selectorGrids);

        this.props.target.ownerDocument.body.classList.add('move-important');

        //this.$dropZones = this.$editable.find('.oe_drop_zone');
        //if (!canBeSanitizedUnless) {
        //    this.$dropZones = this.$dropZones.not('[data-oe-sanitize] .oe_drop_zone');
        //} else if (canBeSanitizedUnless === 'form') {
        //    this.$dropZones = this.$dropZones.not('[data-oe-sanitize][data-oe-sanitize!="allow_form"] .oe_drop_zone');
        //}

        // Trigger a scroll on the draggable element so that jQuery updates
        // the position of the drop zones.
        //self.draggableComponent.$scrollTarget.on('scroll.scrolling_element', function () {
        //    self.$el.trigger('scroll');
        //});
    }

    onDropzoneOver(args, dropzone) {
        const self = this;
        self.$target = $(this.props.target);
        // if (this.dragState.dropped) {
        //     self.$target.detach();
        //     $('.oe_drop_zone').removeClass('invisible');
        // }

        // Prevent a column to be trapped in an upper grid dropzone at
        // the start of the drag.
        if (self.dragState.isColumn && self.dragState.overFirstDropzone) {
            self.dragState.overFirstDropzone = false;

            // The column is considered as glued to the dropzone if the
            // dropzone is above and if the space between them is less
            // than 25px (the move handle height is 22px so 25 is a
            // safety margin).
            const columnTop = self.dragState.columnTop;
            const dropzoneBottom = dropzone.getBoundingClientRect().bottom;
            const areDropzonesGlued = (columnTop >= dropzoneBottom) && (columnTop - dropzoneBottom < 25);

            if (areDropzonesGlued && dropzone.classList.contains('oe_grid_zone')) {
                return;
            }
        }

        this.dragState.dropped = true;
        dropzone.after(this.props.target);
        dropzone.classList.add('invisible');

        // TODO: since we moved away from events, and rather direct function
        // calling on drag, dropzoneOut should always be called before a new
        // dropzoneOver happens.
        // Checking if the "out" event happened before this "over": if
        // `self.dragState.currentDropzoneEl` exists, "out" didn't
        // happen because it deletes it. We are therefore in the case
        // of an "over" after an "over" and we need to escape the
        // previous dropzone first.
        //if (self.dragState.currentDropzoneEl) {
        //    self._outPreviousDropzone.apply(self.dragState.currentDropzoneEl, [self, $dropzone[0]]);
        //}
        this.dragState.currentDropzoneEl = dropzone;

        let columnColCount = this.dragState.columnColCount;
        let columnRowCount = this.dragState.columnRowCount;
        if (dropzone.classList.contains('oe_grid_zone')) {
            // Case where the column we are dragging is over a grid
            // dropzone.
            const rowEl = dropzone.parentNode;

            // If the column doesn't come from a grid mode snippet.
            if (!this.props.target.classList.contains('o_grid_item')) {
                // Converting the column to grid.
                self.options.wysiwyg.odooEditor.observerActive('dragAndDropMoveSnippet');
                const spans = gridUtils._convertColumnToGrid(rowEl, self.$target[0], self.dragState.columnWidth, self.dragState.columnHeight);
                self.options.wysiwyg.odooEditor.observerUnactive('dragAndDropMoveSnippet');
                columnColCount = spans.columnColCount;
                columnRowCount = spans.columnRowCount;

                // Storing the column spans.
                self.dragState.columnColCount = columnColCount;
                self.dragState.columnRowCount = columnRowCount;
            }

            // Creating the drag helper.
            const dragHelperEl = document.createElement('div');
            dragHelperEl.classList.add('o_we_drag_helper');
            dragHelperEl.style.gridArea = `1 / 1 / ${1 + columnRowCount} / ${1 + columnColCount}`;
            rowEl.append(dragHelperEl);

            // Creating the background grid and updating the dropzone
            // (in the case where the column over the dropzone is
            // bigger than the grid).
            const backgroundGridEl = gridUtils._addBackgroundGrid(rowEl, columnRowCount);
            const rowCount = Math.max(rowEl.dataset.rowCount, columnRowCount);
            dropzone.style.gridRowEnd = rowCount + 1;

            this.env.odooEditor.observerActive('dragAndDropMoveSnippet');
            // Setting the moving grid item, the background grid and
            // the drag helper z-indexes. The grid item z-index is set
            // to its original one if we are in its starting grid, or
            // to the maximum z-index of the grid otherwise.
            if (rowEl === self.dragState.startingGrid) {
                this.props.target.style.zIndex = self.dragState.startingZIndex;
            } else {
                gridUtils._setElementToMaxZindex(self.$target[0], rowEl);
            }
            gridUtils._setElementToMaxZindex(backgroundGridEl, rowEl);
            gridUtils._setElementToMaxZindex(dragHelperEl, rowEl);

            // Setting the column height and width to keep its size
            // when the grid-area is removed (as it prevents it from
            // moving with the mouse).
            const gridProp = gridUtils._getGridProperties(rowEl);
            const columnHeight = columnRowCount * (gridProp.rowSize + gridProp.rowGap) - gridProp.rowGap;
            const columnWidth = columnColCount * (gridProp.columnSize + gridProp.columnGap) - gridProp.columnGap;
            self.$target[0].style.height = columnHeight + 'px';
            self.$target[0].style.width = columnWidth + 'px';
            self.$target[0].style.position = 'absolute';
            self.$target[0].style.removeProperty('grid-area');
            rowEl.style.position = 'relative';
            this.env.odooEditor.observerUnactive('dragAndDropMoveSnippet');

            // Storing useful information and adding an event listener.
            self.dragState.startingHeight = rowEl.clientHeight;
            self.dragState.currentHeight = rowEl.clientHeight;
            self.dragState.dragHelperEl = dragHelperEl;
            self.dragState.backgroundGridEl = backgroundGridEl;
            self._onGridMove = self.onGridMove.bind(self);
            window.addEventListener("pointermove", self._onGridMove, false);
        }
    }
    /**
     * Called when the mouse is moved to place a column in a grid.
     *
     * @private
     * @param {Event} ev
     */
    onGridMove(ev) {
        if (!this.dragState.currentDropzoneEl) {
            return;
        }
        const columnEl = this.props.target;
        const rowEl = columnEl.parentNode;

        // Computing the rowEl position.
        const rowElTop = rowEl.getBoundingClientRect().top;
        const rowElLeft = rowEl.getBoundingClientRect().left;

        // Getting the column dimensions.
        const borderWidth = parseFloat(window.getComputedStyle(columnEl).borderWidth);
        const columnHeight = columnEl.clientHeight + 2 * borderWidth;
        const columnWidth = columnEl.clientWidth + 2 * borderWidth;
        const columnMiddle = columnWidth / 2;

        // Placing the column where the mouse is.
        const top = ev.pageY - rowElTop;
        const bottom = top + columnHeight;
        let left = ev.pageX - rowElLeft - columnMiddle;

        // Horizontal overflow.
        left = clamp(left, 0, rowEl.clientWidth - columnWidth);

        columnEl.style.top = top + 'px';
        columnEl.style.left = left + 'px';

        // Computing the drag helper corresponding grid area.
        const gridProp = gridUtils._getGridProperties(rowEl);

        const rowStart = Math.round(top / (gridProp.rowSize + gridProp.rowGap)) + 1;
        const columnStart = Math.round(left / (gridProp.columnSize + gridProp.columnGap)) + 1;
        const rowEnd = rowStart + this.dragState.columnRowCount;
        const columnEnd = columnStart + this.dragState.columnColCount;

        const dragHelperEl = this.dragState.dragHelperEl;
        if (parseInt(dragHelperEl.style.gridRowStart) !== rowStart) {
            dragHelperEl.style.gridRowStart = rowStart;
            dragHelperEl.style.gridRowEnd = rowEnd;
        }

        if (parseInt(dragHelperEl.style.gridColumnStart) !== columnStart) {
            dragHelperEl.style.gridColumnStart = columnStart;
            dragHelperEl.style.gridColumnEnd = columnEnd;
        }

        // Vertical overflow/underflow.
        // Updating the reference heights, the dropzone and the background grid.
        const startingHeight = this.dragState.startingHeight;
        const currentHeight = this.dragState.currentHeight;
        const backgroundGridEl = this.dragState.backgroundGridEl;
        const dropzoneEl = this.dragState.currentDropzoneEl;
        const rowOverflow = Math.round((bottom - currentHeight) / (gridProp.rowSize + gridProp.rowGap));
        const updateRows = bottom > currentHeight || bottom <= currentHeight && bottom > startingHeight;
        const rowCount = Math.max(rowEl.dataset.rowCount, this.dragState.columnRowCount);
        const maxRowEnd = rowCount + gridUtils.additionalRowLimit + 1;
        if (Math.abs(rowOverflow) >= 1 && updateRows) {
            if (rowEnd <= maxRowEnd) {
                const dropzoneEnd = parseInt(dropzoneEl.style.gridRowEnd);
                dropzoneEl.style.gridRowEnd = dropzoneEnd + rowOverflow;
                backgroundGridEl.style.gridRowEnd = dropzoneEnd + rowOverflow;
                this.dragState.currentHeight += rowOverflow * (gridProp.rowSize + gridProp.rowGap);
            } else {
                // Don't add new rows if we have reached the limit.
                dropzoneEl.style.gridRowEnd = maxRowEnd;
                backgroundGridEl.style.gridRowEnd = maxRowEnd;
                this.dragState.currentHeight = (maxRowEnd - 1) * (gridProp.rowSize + gridProp.rowGap) - gridProp.rowGap;
            }
        }
    }

    onDropzoneOut(args, dropzone) {
        const dropzoneEl = dropzone;
        const rowEl = dropzoneEl.parentNode;

        // Checking if the "out" event happens right after the "over"
        // of the same dropzone. If it is not the case, we don't do
        // anything since the previous dropzone was already escaped (at
        // the start of the over).
        const sameDropzoneAsCurrent = this.dragState.currentDropzoneEl === dropzoneEl;

        if (sameDropzoneAsCurrent) {
            if (rowEl.classList.contains('o_grid_mode')) {
                // Removing the listener + cleaning.
                window.removeEventListener("pointermove", this._onGridMove, false);
                gridUtils._gridCleanUp(rowEl, this.props.target);
                this.props.target.style.removeProperty('z-index');

                // Removing the drag helper and the background grid and
                // resizing the grid and the dropzone.
                this.dragState.dragHelperEl.remove();
                this.dragState.backgroundGridEl.remove();
                this.env.odooEditor.observerActive('dragAndDropMoveSnippet');
                gridUtils._resizeGrid(rowEl);
                this.env.odooEditor.observerUnactive('dragAndDropMoveSnippet');
                const rowCount = parseInt(rowEl.dataset.rowCount);
                dropzoneEl.style.gridRowEnd = Math.max(rowCount + 1, 1);
            }

            const $target = $(this.props.target);
            var prev = $target.prev();
            if (dropzone === prev[0]) {
                this.dragState.dropped = false;
                $target.detach();
                $(dropzone).removeClass('invisible');
            }

            delete this.dragState.currentDropzoneEl;
        }
    }

    onDragAndDropEnd({ x, y }, dropzone) {
        const $target = $(this.props.target);
        this.env.odooEditor.automaticStepActive();
        this.env.odooEditor.automaticStepSkipStack();
        this.env.odooEditor.unbreakableStepUnactive();

        const rowEl = this.props.target.parentNode;
        if (rowEl && rowEl.classList.contains('o_grid_mode')) {
            // Case when dropping the column in a grid.

            // Removing the event listener.
            window.removeEventListener("pointermove", this._onGridMove, false);

            // Defining the column grid area with its position.
            const gridProp = gridUtils._getGridProperties(rowEl);

            const top = parseFloat(this.props.target.style.top);
            const left = parseFloat(this.props.target.style.left);

            const rowStart = Math.round(top / (gridProp.rowSize + gridProp.rowGap)) + 1;
            const columnStart = Math.round(left / (gridProp.columnSize + gridProp.columnGap)) + 1;
            const rowEnd = rowStart + this.dragState.columnRowCount;
            const columnEnd = columnStart + this.dragState.columnColCount;

            this.props.target.style.gridArea = `${rowStart} / ${columnStart} / ${rowEnd} / ${columnEnd}`;

            // Cleaning, removing the drag helper and the background grid and
            // resizing the grid.
            gridUtils._gridCleanUp(rowEl, this.props.target);
            this.dragState.dragHelperEl.remove();
            this.dragState.backgroundGridEl.remove();
            this.env.odooEditor.observerActive('dragAndDropMoveSnippet');
            gridUtils._resizeGrid(rowEl);
            this.env.odooEditor.observerUnactive('dragAndDropMoveSnippet');
        } else if (this.props.target.classList.contains('o_grid_item') && this.dragState.dropped) {
            // Case when dropping a grid item in a non-grid dropzone.
            this.env.odooEditor.observerActive('dragAndDropMoveSnippet');
            const gridSizeClasses = this.props.target.className.match(/(g-col-lg|g-height)-[0-9]+/g);
            this.props.target.classList.remove('o_grid_item', 'o_grid_item_image', 'o_grid_item_image_contain', ...gridSizeClasses);
            this.props.target.style.removeProperty('z-index');
            this.props.target.style.removeProperty('grid-area');
            this.env.odooEditor.observerUnactive('dragAndDropMoveSnippet');
        }

        // TODO lot of this is duplicated code of the d&d feature of snippets
        if (!this.dragState.dropped) {
            const body = this.props.target.ownerDocument.body;
            const $el = $(closest(body.querySelectorAll('.oe_drop_zone:not(.disabled)'), {x, y}));
            if ($el.length) {
                $el.after($target);
                // If the column is not dropped inside a dropzone.
                if ($el[0].classList.contains('oe_grid_zone')) {
                    // Case when a column is dropped near a grid.
                    const rowEl = $el[0].parentNode;

                    // If the column doesn't come from a snippet in grid mode,
                    // convert it.
                    if (!this.props.target.classList.contains('o_grid_item')) {
                        this.env.odooEditor.observerActive('dragAndDropMoveSnippet');
                        const spans = gridUtils._convertColumnToGrid(rowEl, this.props.target, this.dragState.columnWidth, this.dragState.columnHeight);
                        this.env.odooEditor.observerUnactive('dragAndDropMoveSnippet');
                        this.dragState.columnColCount = spans.columnColCount;
                        this.dragState.columnRowCount = spans.columnRowCount;
                    }

                    // Placing it in the top left corner.
                    this.env.odooEditor.observerActive('dragAndDropMoveSnippet');
                    this.props.target.style.gridArea = `1 / 1 / ${1 + this.dragState.columnRowCount} / ${1 + this.dragState.columnColCount}`;
                    const rowCount = Math.max(parseInt(rowEl.dataset.rowCount), this.dragState.columnRowCount);
                    rowEl.dataset.rowCount = rowCount;
                    this.env.odooEditor.observerUnactive('dragAndDropMoveSnippet');

                    // Setting the grid item z-index.
                    if (rowEl === this.dragState.startingGrid) {
                        this.props.target.style.zIndex = this.dragState.startingZIndex;
                    } else {
                        gridUtils._setElementToMaxZindex(this.props.target, rowEl);
                    }
                } else {
                    if (this.props.target.classList.contains('o_grid_item')) {
                        // Case when a grid column is dropped near a non-grid
                        // dropzone.
                        this.env.odooEditor.observerActive('dragAndDropMoveSnippet');
                        const gridSizeClasses = this.props.target.className.match(/(g-col-lg|g-height)-[0-9]+/g);
                        this.props.target.classList.remove('o_grid_item', 'o_grid_item_image', 'o_grid_item_image_contain', ...gridSizeClasses);
                        this.props.target.style.removeProperty('z-index');
                        this.props.target.style.removeProperty('grid-area');
                        this.env.odooEditor.observerUnactive('dragAndDropMoveSnippet');
                    }
                }

                this.dragState.dropped = true;
            }
        }

        // Resize the grid from where the column came from (if any), as it may
        // have not been resized if the column did not go over it.
        if (this.dragState.startingGrid) {
            this.env.odooEditor.observerActive('dragAndDropMoveSnippet');
            gridUtils._resizeGrid(this.dragState.startingGrid);
            this.env.odooEditor.observerUnactive('dragAndDropMoveSnippet');
        }

        this.props.getEditableArea().find(".oe_drop_zone").remove();

        var prev = $target.first()[0].previousSibling;
        var next = $target.last()[0].nextSibling;
        var $parent = $target.parent();

        var $clone = this.props.getEditableArea().find('.oe_drop_clone');
        if (prev === $clone[0]) {
            prev = $clone[0].previousSibling;
        } else if (next === $clone[0]) {
            next = $clone[0].nextSibling;
        }
        $clone.after($target);
        var $from = $clone.parent();

        this.props.target.ownerDocument.body.classList.remove('move-important');
        $clone.remove();

        this.env.odooEditor.observerActive('dragAndDropMoveSnippet');
        if (this.dragState.dropped) {
            if (prev) {
                $target.insertAfter(prev);
            } else if (next) {
                $target.insertBefore(next);
            } else {
                $parent.prepend($target);
            }

            for (var i in this.styles) {
                this.styles[i].onMove();
            }

            $target.trigger('content_changed');
            $from.trigger('content_changed');
        }

        // this.draggableComponent.$scrollTarget.off('scroll.scrolling_element');
        const samePositionAsStart = this.props.target.classList.contains('o_grid_item')
            ? (this.props.target.parentNode === this.dragState.startingGrid
                && this.props.target.style.gridArea === this.dragState.prevGridArea)
            : this._dropSiblings.prev === $target.prev()[0] && this._dropSiblings.next === $target.next()[0];
        if (!samePositionAsStart) {
            this.env.odooEditor.historyStep();
        }

        this.dragState.restore();

        delete this.$dropZones;
        delete this.dragState;
        this.toggleOverlay(true);
        for (const opt of this.options) {
            if (opt.props.callbacks?.onMove) {
                opt.props.callbacks.onMove();
            }
        }
        //this.target.onMove();
        this.props.updateUI();
    }
    /**
     * Method to be overriden
     */
    willCloneSnippet() {}
    /**
     * Clones the current snippet.
     *
     * @param {boolean} recordUndo
     */
    async clone(recordUndo) {
        this.willCloneSnippet();

        const cloneEl = this.target.cloneNode(true);

        this.target.after(cloneEl);

        if (recordUndo) {
            this.env.odooEditor.historyStep(true);
        }
        await this.props.callForEachChildSnippet(cloneEl, async (props, target) => {
            await props.events.onClone({
                isCurrent: target === cloneEl,
            });
        });
        await this.didCloneSnippet(cloneEl);
        this.env.activateSnippet(cloneEl);
        dom.scrollTo(cloneEl, {
            extraOffset: 50,
            easing: 'linear',
            duration: 500,
        });

        $(cloneEl).trigger('content_changed');
    }
    /**
     * Called when the snippet was cloned.
     *
     * @param isCurrent
     * @return {Promise<void>}
     */
    async onClone({ isCurrent }) {
        for (const opt of this.options) {
            await opt.props.events.onClone(isCurrent);
        }
    }
    /**
     * Called when a snippet is about to be removed.
     *
     * @return {Promise<void>}
     */
    async onRemove() {
        for (const opt of this.options) {
            await opt.props.events.onRemove();
        }
    }
    /**
     * Called when the snippet has been cloned.
     * Useful for children classes.
     *
     * @param {HTMLElement} cloneEl - the element that was cloned.
     * @return {Promise}
     */
    async didCloneSnippet(cloneEl) {}
    /**
     * Called when the snippet has just been dropped.
     *
     * @returns {Promise<void>}
     */
    async buildSnippet() {
        // Target hook will notify options
        for (const opt of this.options) {
            await opt.props.events.onBuilt();
        }
    }
    /**
     * Notifies all the associated snippet options that the template which
     * contains the snippet is about to be saved.
     */
    async cleanForSave() {
        // TODO: still needed?
        // if (this.isDestroyed()) {
        //     return;
        // }
        await this.toggleTargetVisibility(!this.target.classList.contains('o_snippet_invisible')
            && !this.target.classList.contains('o_snippet_mobile_invisible')
            && !this.target.classList.contains('o_snippet_desktop_invisible'));
        const proms = this.options.map((option) => {
            return option.props.events.cleanForSave();
        });
        await Promise.all(proms);
    }
    /**
     * Method to be overriden by other modules to interject before removing
     * a snippet. (e.g., in Website, to stop widgets before removing them.)
     */
    willRemoveSnippet() {}

    async removeSnippet() {
        if (!this.isTargetRemovable) {
            return;
        }
        await this.toggleTargetVisibility(!this.props.target.classList.contains('o_snippet_invisible'));

        this.willRemoveSnippet();

        let parent = this.props.target.parentElement;
        let nextSibling = this.props.target.nextElementSibling;
        let previousSibling = this.props.target.previousElementSibling;

        await this.env.snippetEditionRequest(async () => {
            await this.props.callForEachChildSnippet(this.target, async (props) => {
                await props.events.onRemove();
            });

            while (nextSibling && nextSibling.matches('.o_snippet_invisible')) {
                nextSibling = nextSibling.nextElementSibling;
            }
            while (previousSibling && previousSibling.matches('.o_snippet_invisible')) {
                previousSibling = previousSibling.previousElementSibling;
            }
            if ($(parent).is('.o_editable:not(body)')) {
                // If we target the editable, we want to reset the selection to the
                // body. If the editable has options, we do not want to show them.
                parent = $(parent).closest('body')[0];
            }
            this.props.target.remove();
        });
        await this.env.activateSnippet(previousSibling || nextSibling || parent);


        // Resize the grid to have the correct row count.
        // Must be done here and not in a dedicated onRemove method because
        // onRemove is called before actually removing the element and it
        // should be the case in order to resize the grid.
        gridUtils._resizeGrid(parent);

        if (parent && parent.firstChild) {
            if (!parent.firstChild.tagName && parent.firstChild.textContent === ' ') {
                parent.removeChild(parent.firstChild);
            }
        }
        // Potentially remove ancestors (like when removing the last column of a
        // snippet).
        if (this.props.parentBus) {
            const isEmpty = $(parent).text().trim() === ''
                && $(parent).children().toArray().every(el => {
                    return el.matches(this.layoutElementsSelector);
                })
                && !parent.classList.contains("oe_structure")
                && !parent.parentElement.classList.contains("carousel-item")
                && !isUnremovable(parent);
            if (isEmpty) {
                this.props.parentBus.trigger("remove_snippet");
            }
        }
        this.props.snippetRemoved();
        //    if (isEmptyAndRemovable($parent, editor)) {
        //        // TODO maybe this should be part of the actual Promise being
        //        // returned by the function ?
        //        setTimeout(() => editor.removeSnippet());
        //    }
    }
    /**
     * Updates a reactive counter which will first trigger each option
     * to compute their widget states, then check if their widgets should be
     * visible.
     */
    onOptionUpdate() {
        // Update the props of every child options
        for (const opt of this.options) {
            opt.props.updateOptionsUICounter++;
        }
        // Finally update visibility counter on the editor.
        // Since OWL updates the children first, we can assure synchronicity by
        // updating the parent state.
        this.state.updateOptionsUIVisibilityCounter++;
    }
    async onOptionVisibilityUpdate() {
        for (const opt of this.options) {
            opt.props.updateOptionsUIVisibilityCounter++;
        }
    }
    /**
     * Called when the "send to back" overlay button is clicked.
     *
     * @private
     * @param {Event} ev
     */
    onSendBackClick(ev) {
        ev.stopPropagation();
        const rowEl = this.target.parentNode;
        const columnEls = [...rowEl.children].filter(el => el !== this.target);
        const minZindex = Math.min(...columnEls.map(el => el.style.zIndex));

        // While the minimum z-index is not 0, it is OK to decrease it and to
        // set the column to it. Otherwise, the column is set to 0 and the
        // other columns z-index are increased by one.
        if (minZindex > 0) {
            this.target.style.zIndex = minZindex - 1;
        } else {
            for (const columnEl of columnEls) {
                columnEl.style.zIndex++;
            }
            this.target.style.zIndex = 0;
        }
    }
    /**
     * Called when the "bring to front" overlay button is clicked.
     *
     * @private
     * @param {Event} ev
     */
    onBringFrontClick(ev) {
        ev.stopPropagation();
        const rowEl = this.target.parentNode;
        gridUtils._setElementToMaxZindex(this.target, rowEl);
    }
    /**
     * Go through the tree of snippets editor to notify the first options
     * which matches the names provided.
     *
     * @param optionNames
     * @param data
     * @returns {Promise<boolean>}
     */
    async notifyOptions(optionNames, data) {
        const notifyForEachMatchedOption = async (name) => {
            const regex = new RegExp("^" + name + '\\d+$');
            let hasOption = false;
            for (const option of this.options) {
                if (option.optionName === name || regex.test(option.name)) {
                    await option.props.events.notify(data.name, data.data);
                    hasOption = true;
                }
            }
            return hasOption;
        };
        if (!Array.isArray(optionNames)) {
            optionNames = [optionNames];
        }
        let matched = false;
        for (const optionName of optionNames) {
            matched = (await notifyForEachMatchedOption(optionName)) || matched;
        }
        if (!matched && this.props.parentBus) {
            matched = await new Promise((resolve) => {
                this.props.parentBus.trigger("option_notify", {
                    optionNames: optionNames,
                    data: data,
                    onSuccess: resolve,
                });
            });
        }
        return matched;
    }
}
