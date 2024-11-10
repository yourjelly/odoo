import { Plugin } from "@html_editor/plugin";
import { isEmptyBlock } from "@html_editor/utils/dom_info";
import { reactive } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { rotate } from "@web/core/utils/arrays";
import { Powerbox } from "./powerbox";
import { withSequence } from "@html_editor/utils/resource";
import { omit, pick } from "@web/core/utils/objects";

/** @typedef { import("@html_editor/core/selection_plugin").EditorSelection } EditorSelection */
/** @typedef { import("@html_editor/core/user_command_plugin").UserCommand } UserCommand */
/** @typedef { ReturnType<_t> } TranslatedString */

/**
 * @typedef {Object} PowerboxCategory
 * @property {string} id
 * @property {String} name
 *
 *
 * @typedef {Object} PowerboxItem
 * @property {string} categoryId Id of a powerbox category
 * @property {string} commandId Id of a user command to extend
 * @property {Object} [commandParams] Passed to the command's `run` function - optional
 * @property {TranslatedString} [title] Inheritable
 * @property {TranslatedString} [description] Inheritable
 * @property {string} [icon] fa-class - Inheritable
 * @property {TranslatedString[]} [keywords]
 * @property {(selection: EditorSelection) => boolean} [isAvailable] Optional and inheritable
 */

/**
 * A powerbox item must extend a user command ( @see UserCommand ) specified by commandId.
 * This means inheriting and overriding properties from a user command.
 *
 * Example:
 *
 * resources = {
 *      user_commands: [
 *          @type {UserCommand}
 *          {
 *              id: myCommand,
 *              run: myCommandFunction,
 *              title: _t("My Command"),
 *              description: _t("My command's description"),
 *              icon: "fa-bug",
 *          },
 *      ],
 *      powerbox_categories: [
 *          @type {PowerboxCategory}
 *          { id: "myCategory", name: _t("My Category") }
 *      ],
 *      powerbox_items: [
 *          @type {PowerboxItem}
 *          {
 *              categoryId: "myCategory",
 *              commandId: "myCommand",
 *              title: _t("My Powerbox Command"), // overrides the user command's `title`
 *              // `description` and `icon` are inherited from the user command
 *          }
 *      ],
 * };
 */

/**
 * The result of applying inheritance (type for internal use).
 * @typedef {Object} PowerboxCommand
 * @property {string} categoryId
 * @property {string} categoryName
 * @property {string} title
 * @property {string} description
 * @property {string} icon
 * @property {Function} run
 * @property {TranslatedString[]} [keywords]
 * @property { (selection: EditorSelection) => boolean  } [isAvailable]
 */

/**
 * @param {SelectionData} selectionData
 */
function target(selectionData) {
    const node = selectionData.editableSelection.anchorNode;
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (
        selectionData.documentSelectionIsInEditable &&
        (el.tagName === "DIV" || el.tagName === "P") &&
        isEmptyBlock(el)
    ) {
        return el;
    }
}

export class PowerboxPlugin extends Plugin {
    static name = "powerbox";
    static dependencies = ["overlay", "selection", "history", "user_command"];
    static shared = [
        "getAvailablePowerboxCommands",
        "openPowerbox",
        "updatePowerbox",
        "closePowerbox",
    ];
    resources = {
        hints: {
            text: _t('Type "/" for commands'),
            target,
        },
        powerbox_categories: [
            withSequence(10, { id: "structure", name: _t("Structure") }),
            withSequence(60, { id: "widget", name: _t("Widget") }),
        ],
        user_commands: {
            id: "openPowerbox",
            run: () =>
                this.openPowerbox({
                    commands: this.getAvailablePowerboxCommands(),
                    categories: this.getResource("powerbox_categories"),
                }),
        },
        power_buttons: withSequence(100, {
            commandId: "openPowerbox",
            title: _t("More options"),
            icon: "fa-ellipsis-v",
        }),
    };

    setup() {
        /** @type {import("@html_editor/core/overlay_plugin").Overlay} */
        this.overlay = this.shared.createOverlay(Powerbox);

        this.state = reactive({});
        this.overlayProps = {
            document: this.document,
            close: () => this.overlay.close(),
            state: this.state,
            activateCommand: (currentIndex) => {
                this.state.currentIndex = currentIndex;
            },
            applyCommand: this.applyCommand.bind(this),
        };
        this.powerboxCommands = this.makePowerboxCommands();
        this.addDomListener(this.editable.ownerDocument, "keydown", this.onKeyDown);
    }

    /**
     * @returns {PowerboxCommand[]}
     */
    getAvailablePowerboxCommands() {
        const selection = this.shared.getEditableSelection();
        return this.powerboxCommands.filter(
            (cmd) => cmd.isAvailable === undefined || cmd.isAvailable(selection)
        );
    }

    /**
     * @returns {PowerboxCommand[]}
     */
    makePowerboxCommands() {
        /** @type {PowerboxItem[]} */
        const powerboxItems = this.getResource("powerbox_items");
        /** @type {PowerboxCategory[]} */
        const categories = this.getResource("powerbox_categories");
        const categoryDict = Object.fromEntries(
            categories.map((category) => [category.id, category])
        );
        return powerboxItems.map((/** @type {PowerboxItem} */ item) => {
            const command = this.shared.getCommand(item.commandId);
            return {
                ...pick(command, "title", "description", "icon", "isAvailable"),
                ...omit(item, "commandId", "commandParams"),
                categoryName: categoryDict[item.categoryId].name,
                run: () => command.run(item.commandParams),
            };
        });
    }

    /**
     * @param {Object} params
     * @param {PowerboxCommand[]} params.commands
     * @param {PowerboxCategory[]} [params.categories]
     * @param {Function} [params.onApplyCommand=() => {}]
     * @param {Function} [params.onClose=() => {}]
     */
    openPowerbox({ commands, categories, onApplyCommand = () => {}, onClose = () => {} } = {}) {
        this.closePowerbox();
        this.onApplyCommand = onApplyCommand;
        this.onClose = onClose;
        this.updatePowerbox(commands, categories);
    }

    /**
     * @param {PowerboxCommand[]} commands
     * @param {PowerboxCategory[]} [categories]
     */
    updatePowerbox(commands, categories) {
        if (categories) {
            const orderCommands = [];
            for (const category of categories) {
                orderCommands.push(
                    ...commands.filter((command) => command.categoryId === category.id)
                );
            }
            commands = orderCommands;
        }
        Object.assign(this.state, {
            showCategories: !!categories,
            commands,
            currentIndex: 0,
        });
        this.overlay.open({ props: this.overlayProps });
    }

    closePowerbox() {
        if (!this.overlay.isOpen) {
            return;
        }
        this.onClose();
        this.overlay.close();
    }

    onKeyDown(ev) {
        if (!this.overlay.isOpen) {
            return;
        }
        const key = ev.key;
        switch (key) {
            case "Escape":
                this.closePowerbox();
                break;
            case "Enter":
            case "Tab":
                ev.preventDefault();
                ev.stopImmediatePropagation();
                this.applyCommand(this.state.commands[this.state.currentIndex]);
                break;
            case "ArrowUp": {
                ev.preventDefault();
                this.state.currentIndex = rotate(this.state.currentIndex, this.state.commands, -1);
                break;
            }
            case "ArrowDown": {
                ev.preventDefault();
                this.state.currentIndex = rotate(this.state.currentIndex, this.state.commands, 1);
                break;
            }
            case "ArrowLeft":
            case "ArrowRight": {
                this.closePowerbox();
                break;
            }
        }
    }

    applyCommand(command) {
        this.onApplyCommand(command);
        command.run();
        this.closePowerbox();
    }
}
