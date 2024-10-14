import { Plugin } from "@html_editor/plugin";
import { isEmptyBlock, isProtected } from "@html_editor/utils/dom_info";
import { removeClass } from "@html_editor/utils/dom";
import { selectElements } from "@html_editor/utils/dom_traversal";
import { closestBlock } from "../utils/blocks";

function isMutationRecordSavable(record) {
    return !(record.type === "attributes" && record.attributeName === "placeholder");
}

/**
 * @param {SelectionData} selectionData
 * @param {HTMLElement} editable
 */
function target(selectionData, editable) {
    if (selectionData.documentSelectionIsInEditable || editable.childNodes.length !== 1) {
        return;
    }
    const el = editable.firstChild;
    if (el.tagName === "P" && isEmptyBlock(el)) {
        return el;
    }
}

export class HintPlugin extends Plugin {
    static name = "hint";
    static dependencies = ["history", "selection"];
    resources = {
        mutation_filtered_classes: ["o-we-hint"],
        is_mutation_record_savable: isMutationRecordSavable,
        onSelectionChange: this.updateHints.bind(this),
        onExternalHistorySteps: () => {
            this.clearHints();
            this.updateHints();
        },
        ...(this.config.placeholder && {
            hints: [
                {
                    text: this.config.placeholder,
                    target,
                },
            ],
        }),
    };

    setup() {
        this.hint = null;
        this.updateHints(this.editable);
    }

    destroy() {
        super.destroy();
        this.clearHints();
    }

    handleCommand(command, payload) {
        switch (command) {
            case "CONTENT_UPDATED": {
                this.updateHints(payload.root);
                break;
            }
            case "CLEAN":
            case "CLEAN_FOR_SAVE":
                this.clearHints(payload.root);
                break;
        }
    }

    /**
     * @param {HTMLElement} [root]
     */
    updateHints() {
        const selectionData = this.shared.getSelectionData();
        const editableSelection = selectionData.editableSelection;
        this.clearHints();
        for (const hint of this.getResource("hints")) {
            if (hint.selector) {
                const el = closestBlock(editableSelection.anchorNode);
                if (
                    editableSelection.isCollapsed &&
                    el &&
                    el.matches(hint.selector) &&
                    !isProtected(el) &&
                    isEmptyBlock(el)
                ) {
                    this.makeHint(el, hint.text);
                    this.hint = el;
                }
            } else {
                if (hint.targets) {
                    const targets = hint.targets(selectionData, this.editable);
                    if (!targets.length) {
                        continue;
                    }
                    for (const target of targets) {
                        if (
                            target.tagName === "P" &&
                            !isProtected(target) &&
                            isEmptyBlock(target)
                        ) {
                            this.makeHint(target, hint.text);
                        } else {
                            const match = this.getResource("hints").find((hint) =>
                                target.matches(hint.selector)
                            );
                            if (match && !isProtected(target) && isEmptyBlock(target)) {
                                this.makeHint(target, match.text);
                            }
                        }
                    }
                } else {
                    const target = hint.target(selectionData, this.editable);
                    // Do not replace an existing empty block hint by a temp hint.
                    if (
                        editableSelection.isCollapsed &&
                        target &&
                        !target.classList.contains("o-we-hint")
                    ) {
                        this.makeHint(target, hint.text);
                        this.hint = target;
                        return;
                    }
                }
            }
        }
    }

    makeHint(el, text) {
        el.setAttribute("placeholder", text);
        el.classList.add("o-we-hint");
    }

    removeHint(el) {
        el.removeAttribute("placeholder");
        removeClass(el, "o-we-hint");
        if (this.hint === el) {
            this.hint = null;
        }
    }

    clearHints(root = this.editable) {
        for (const elem of selectElements(root, ".o-we-hint")) {
            this.removeHint(elem);
        }
    }
}
