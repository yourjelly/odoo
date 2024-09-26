import { Plugin } from "@html_editor/plugin";
import { isZWS } from "@html_editor/utils/dom_info";
import { reactive } from "@odoo/owl";
import { isTextNode } from "@web/views/view_compiler";
import { Toolbar } from "./toolbar";
import { hasTouch } from "@web/core/browser/feature_detection";
import { registry } from "@web/core/registry";
import { ToolbarMobile } from "./mobile_toolbar";
import { debounce } from "@web/core/utils/timing";
import { omit, pick } from "@web/core/utils/objects";

/** @typedef { import("@html_editor/core/selection_plugin").EditorSelection } EditorSelection */
/** @typedef { import("@html_editor/core/user_command_plugin").UserCommand } UserCommand */
/** @typedef { import("@web/core/l10n/translation.js")._t} _t */
/** @typedef { ReturnType<_t> } TranslatedString */

/**
 * @typedef {Object} ToolbarNamespace
 * @property {string} id
 * @property {(traversedNodes: Node[]) => boolean} isApplied
 *
 *
 * @typedef {Object} ToolbarGroup
 * @property {string} id
 * @property {string} [namespace]
 *
 *
 * @typedef {ToolbarCommandItem | ToolbarComponentItem} ToolbarItem
 *
 * @typedef {Object} ToolbarCommandItem
 * Regular button: extends a user command specified by commandId.
 * @property {string} id
 * @property {string} groupId Id of a toolbar group
 * @property {string} commandId Id of the user command to extend
 * @property {Object} [commandParams] Passed to the command's `run` function - optional
 * @property {TranslatedString} [title] inheritable from user command
 * @property {string} [icon] Inheritable
 * @property {string} [text] Can be used with (or instead of) `icon`
 * @property {(selection: EditorSelection) => boolean} [isAvailable] Optional and inheritable
 * @property {(selection: EditorSelection, nodes: Node[]) => boolean} [isActive] Optional
 * @property {(selection: EditorSelection, nodes: Node[]) => boolean} [isDisabled] Optional
 *
 * @typedef {Object} ToolbarComponentItem
 * Adds a custom component to the toolbar.
 * @property {string} id
 * @property {string} groupId
 * @property {TranslatedString} title
 * @property {Function} Component
 * @property {Object} props
 * @property {(selection: EditorSelection) => boolean} [isAvailable] Optional and inheritable
 *
 * ToolbarItem.id maps to the button's `name` attribute
 * ToolbarItem.title maps to the button's `title` attribute (tooltip description)
 */

/**
 * A ToolbarCommandItem must extend a user command ( @see UserCommand )
 * specified by commandId. This means inheriting and overriding properties from
 * a user command.
 *
 * Example:
 *
 * resources = {
 *     user_commands: [
 *         @type {UserCommand}
 *         {
 *             id: myCommand,
 *             run: myCommandFunction,
 *             title: _t("My Command"),
 *             icon: "fa-bug",
 *         },
 *     ],
 *     toolbar_groups: [
 *         @type {ToolbarGroup}
 *         { id: "myGroup" },
 *     ],
 *     toolbar_items: [
 *         @type {ToolbarCommandItem}
 *         {
 *             id: "myButton",
 *             groupId: "myGroup",
 *             commandId: "myCommand",
 *             title: _t("My Toolbar Command Button"), // overrides the user command's `title`
 *             // `icon` is inherited from the user command
 *         },
 *         @type {ToolbarComponentItem}
 *         {
 *             id: "myComponentButton",
 *             groupId: "myGroup",
 *             title: _t("My Toolbar Component Button"),
 *             Component: MyComponent,
 *             props: { myProp: "myValue" },
 *         },
 *     ],
 * };
 */

/** Delay in ms for toolbar open after keyup, double click or triple click. */
const DELAY_TOOLBAR_OPEN = 300;

export class ToolbarPlugin extends Plugin {
    static name = "toolbar";
    static dependencies = ["overlay", "selection", "user_command"];
    static shared = ["getToolbarInfo"];
    resources = {
        selectionchange_handlers: this.handleSelectionChange.bind(this),
        step_added_handlers: () => this.updateToolbar(),
    };

    setup() {
        const groupIds = new Set();
        for (const group of this.getResource("toolbar_groups")) {
            if (groupIds.has(group.id)) {
                throw new Error(`Duplicate toolbar group id: ${group.id}`);
            }
            groupIds.add(group.id);
        }

        this.buttonGroups = this.getButtonGroups();

        this.isMobileToolbar = hasTouch() && window.visualViewport;

        if (this.isMobileToolbar) {
            this.overlay = new MobileToolbarOverlay(this.editable);
        } else {
            this.overlay = this.shared.createOverlay(Toolbar, {
                positionOptions: {
                    position: "top-start",
                },
                closeOnPointerdown: false,
            });
        }
        this.state = reactive({
            buttonsActiveState: this.buttonGroups.flatMap((g) =>
                g.buttons.map((b) => [b.id, false])
            ),
            buttonsDisabledState: this.buttonGroups.flatMap((g) =>
                g.buttons.map((b) => [b.id, false])
            ),
            buttonsAvailableState: this.buttonGroups.flatMap((g) =>
                g.buttons.map((b) => [b.id, true])
            ),
            namespace: undefined,
        });
        this.updateSelection = null;

        this.onSelectionChangeActive = true;
        this.debouncedUpdateToolbar = debounce(this.updateToolbar, DELAY_TOOLBAR_OPEN);

        if (!this.isMobileToolbar) {
            // Mouse interaction behavior:
            // Close toolbar on mousedown and prevent it from opening until mouseup.
            this.addDomListener(this.editable, "mousedown", () => {
                this.overlay.close();
                this.debouncedUpdateToolbar.cancel();
                this.onSelectionChangeActive = false;
            });
            this.addDomListener(this.document, "mouseup", (ev) => {
                if (ev.detail >= 2) {
                    // Delayed open, waiting for a possible triple click.
                    this.onSelectionChangeActive = true;
                    this.debouncedUpdateToolbar();
                } else {
                    // Fast open, just wait for a possible selection change due
                    // to mouseup.
                    setTimeout(() => {
                        this.updateToolbar();
                        this.onSelectionChangeActive = true;
                    });
                }
            });

            // Keyboard interaction behavior:
            // Close toolbar on keydown Arrows and prevent it from opening until
            // keyup. Opening is debounced to avoid open/close between
            // sequential keystrokes.
            this.addDomListener(this.editable, "keydown", (ev) => {
                if (ev.key.startsWith("Arrow")) {
                    this.overlay.close();
                    this.onSelectionChangeActive = false;
                }
            });
            this.addDomListener(this.editable, "keyup", (ev) => {
                if (ev.key.startsWith("Arrow")) {
                    this.onSelectionChangeActive = true;
                    this.debouncedUpdateToolbar();
                }
            });
        }
    }

    destroy() {
        this.debouncedUpdateToolbar.cancel();
        this.overlay.close();
        super.destroy();
    }

    /**
     * @typedef {Object} ToolbarCommandButton
     * @property {string} id
     * @property {string} groupId
     * @property {TranslatedString} title
     * @property {Function} run
     * @property {string} [icon]
     * @property {string} [text]
     * @property {(selection: EditorSelection) => boolean} [isAvailable]
     * @property {(selection: EditorSelection, nodes: Node[]) => boolean} [isActive]
     * @property {(selection: EditorSelection, nodes: Node[]) => boolean} [isDisabled]
     *
     * @typedef {ToolbarComponentItem} ToolbarComponentButton
     */

    /**
     * @returns {(ToolbarCommandButton| ToolbarComponentButton)[]}
     */
    getButtons() {
        /** @type {ToolbarItem[]} */
        const toolbarItems = this.getResource("toolbar_items");

        /** @returns {ToolbarCommandButton} */
        const commandItemToButton = (/** @type {ToolbarCommandItem}*/ item) => {
            const command = this.shared.getCommand(item.commandId);
            return {
                ...pick(command, "title", "icon", "isAvailable"),
                ...omit(item, "commandId", "commandParams"),
                run: () => command.run(item.commandParams),
            };
        };

        return toolbarItems.map((item) => ("Component" in item ? item : commandItemToButton(item)));
    }

    getButtonGroups() {
        const buttons = this.getButtons();
        /** @type {ToolbarGroup[]} */
        const groups = this.getResource("toolbar_groups");

        return groups.map((group) => ({
            ...group,
            buttons: buttons.filter((button) => button.groupId === group.id),
        }));
    }

    getToolbarInfo() {
        return {
            buttonGroups: this.buttonGroups,
            getSelection: () => this.shared.getEditableSelection(),
            state: this.state,
            focusEditable: () => this.shared.focusEditable(),
        };
    }

    handleSelectionChange(selectionData) {
        if (this.onSelectionChangeActive) {
            this.updateToolbar(selectionData);
        }
    }

    updateToolbar(selectionData = this.shared.getSelectionData()) {
        this.updateToolbarVisibility(selectionData);
        if (this.overlay.isOpen || this.config.disableFloatingToolbar) {
            this.updateNamespace();
            this.updateButtonsStates(selectionData.editableSelection);
        }
    }

    getFilterTraverseNodes() {
        return this.shared
            .getTraversedNodes()
            .filter((node) => !isTextNode(node) || (node.textContent !== "\n" && !isZWS(node)));
    }

    updateToolbarVisibility(selectionData) {
        if (this.config.disableFloatingToolbar) {
            return;
        }

        if (this.shouldBeVisible(selectionData)) {
            // Open toolbar or update its position
            const props = { toolbar: this.getToolbarInfo(), class: "shadow rounded my-2" };
            this.overlay.open({ props });
        } else if (this.overlay.isOpen && !this.shouldPreventClosing(selectionData)) {
            // Close toolbar
            this.overlay.close();
        }
    }

    shouldBeVisible(selectionData) {
        const inEditable =
            selectionData.documentSelectionIsInEditable &&
            !selectionData.documentSelectionIsProtected &&
            !selectionData.documentSelectionIsProtecting;
        if (!inEditable) {
            return false;
        }
        if (this.isMobileToolbar) {
            return true;
        }
        const isCollapsed = selectionData.editableSelection.isCollapsed;
        return !isCollapsed && this.getFilterTraverseNodes().length;
    }

    shouldPreventClosing(selectionData) {
        const preventClosing = selectionData.documentSelection?.anchorNode?.closest?.(
            "[data-prevent-closing-overlay]"
        );
        return preventClosing?.dataset?.preventClosingOverlay === "true";
    }

    updateNamespace() {
        const traversedNodes = this.getFilterTraverseNodes();
        for (const namespace of this.getResource("toolbar_namespaces")) {
            if (namespace.isApplied(traversedNodes)) {
                this.state.namespace = namespace.id;
                return;
            }
        }
        this.state.namespace = undefined;
    }

    updateButtonsStates(selection) {
        if (!this.updateSelection) {
            queueMicrotask(() => {
                if (!this.isDestroyed) {
                    this._updateButtonsStates();
                }
            });
        }
        this.updateSelection = selection;
    }
    _updateButtonsStates() {
        const selection = this.updateSelection;
        if (!selection) {
            return;
        }
        const nodes = this.getFilterTraverseNodes();
        for (const buttonGroup of this.buttonGroups) {
            if (buttonGroup.namespace === this.state.namespace) {
                for (const button of buttonGroup.buttons) {
                    this.state.buttonsActiveState[button.id] = button.isActive?.(selection, nodes);
                    this.state.buttonsDisabledState[button.id] = button.isDisabled?.(
                        selection,
                        nodes
                    );
                    this.state.buttonsAvailableState[button.id] =
                        button.isAvailable === undefined || button.isAvailable(selection);
                }
            }
        }
        this.updateSelection = null;
    }
}

class MobileToolbarOverlay {
    constructor(editable) {
        this.isOpen = false;
        this.overlayId = `mobile_toolbar_${Math.random().toString(16).slice(2)}`;
        this.editable = editable;
    }

    open({ props }) {
        props.class = "shadow";
        if (!this.isOpen) {
            const modal = this.editable.closest(".o_modal_full");
            if (modal) {
                // Same height of the toolbar
                modal.style.paddingBottom = "40px";
            }
            registry.category("main_components").add(this.overlayId, {
                Component: ToolbarMobile,
                props,
            });
            this.isOpen = true;
        }
    }

    close() {
        const modal = this.editable.closest(".o_modal_full");
        if (modal) {
            modal.style.paddingBottom = "";
        }
        registry.category("main_components").remove(this.overlayId, "MobileToolbar");
        this.isOpen = false;
    }
}
