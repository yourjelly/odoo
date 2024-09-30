import { fuzzyLookup } from "@web/core/utils/search";
import { Plugin } from "../../plugin";

/**
 * @typedef {import("./powerbox_plugin").CommandGroup} CommandGroup
 * @typedef {import("../core/selection_plugin").EditorSelection} EditorSelection
 */

export class SearchPowerboxPlugin extends Plugin {
    static name = "search_powerbox";
    static dependencies = ["powerbox", "selection", "history", "user_command"];
    resources = {
        onBeforeInput: this.onBeforeInput.bind(this),
        onInput: this.onInput.bind(this),
        delete_listeners: this.update.bind(this),
        post_undo_listeners: this.update.bind(this),
        post_redo_listeners: this.update.bind(this),
    };
    setup() {
        const categoryIds = new Set();
        for (const category of this.getResource("powerboxCategory")) {
            if (categoryIds.has(category.id)) {
                throw new Error(`Duplicate category id: ${category.id}`);
            }
            categoryIds.add(category.id);
        }
        this.categories = this.getResource("powerboxCategory");

        this.commands = this.getCommands();
        this.shouldUpdate = false;
    }
    getCommands() {
        const powerboxItems = this.getResource("powerboxItems");
        const userCommands = this.shared.getCommands();
        const categoryDict = Object.fromEntries(
            this.categories.map((category) => [category.id, category])
        );
        return powerboxItems.map((item) => {
            const userCommand = userCommands[item.commandId];
            return {
                label: item.label || userCommand?.label,
                description: item.description || userCommand?.description,
                icon: item.icon || userCommand?.icon,
                categoryName: categoryDict[item.category].name,
                run: () => this.shared.execCommand(item.commandId, item.commandParams),
                ...item,
            };
        });
    }
    onBeforeInput(ev) {
        if (ev.data === "/") {
            this.historySavePointRestore = this.shared.makeSavePoint();
        }
    }
    onInput(ev) {
        if (ev.data === "/") {
            this.openPowerbox();
        } else {
            this.update();
        }
    }
    update() {
        if (!this.shouldUpdate) {
            return;
        }
        const selection = this.shared.getEditableSelection();
        this.searchNode = selection.startContainer;
        if (!this.isSearching(selection)) {
            this.shared.closePowerbox();
            return;
        }
        const searchTerm = this.searchNode.nodeValue.slice(this.offset + 1, selection.endOffset);
        if (!searchTerm) {
            this.shared.updatePowerbox(this.enabledCommands, this.categories);
            return;
        }
        if (searchTerm.includes(" ")) {
            this.shared.closePowerbox();
            return;
        }
        const commands = this.filterCommands(searchTerm);
        if (!commands.length) {
            this.shared.closePowerbox();
            this.shouldUpdate = true;
            return;
        }
        this.shared.updatePowerbox(commands);
    }
    /**
     * @param {string} searchTerm
     */
    filterCommands(searchTerm) {
        return fuzzyLookup(searchTerm, this.enabledCommands, (cmd) => [
            cmd.label,
            cmd.categoryName,
            cmd.description,
            ...(cmd.searchKeywords || []),
        ]);
    }
    /**
     * @param {EditorSelection} selection
     */
    isSearching(selection) {
        return (
            selection.endContainer === this.searchNode &&
            this.searchNode.nodeValue &&
            this.searchNode.nodeValue[this.offset] === "/" &&
            selection.endOffset >= this.offset
        );
    }
    openPowerbox() {
        const selection = this.shared.getEditableSelection();
        this.offset = selection.startOffset - 1;
        this.enabledCommands = this.commands.filter(
            (cmd) => !cmd.isAvailable?.(selection.anchorNode)
        );
        this.shared.openPowerbox({
            commands: this.enabledCommands,
            categories: this.categories,
            onApplyCommand: this.historySavePointRestore,
            onClose: () => {
                this.shouldUpdate = false;
            },
        });
        this.shouldUpdate = true;
    }
}
