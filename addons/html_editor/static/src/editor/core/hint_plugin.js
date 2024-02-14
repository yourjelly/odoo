import { _t } from "@web/core/l10n/translation";
import { Plugin } from "../plugin";
import { isEmpty } from "../utils/dom_info";
import { removeClass } from "../utils/dom";
import { registry } from "@web/core/registry";

function filterMutationRecords(records) {
    return records.filter((record) => {
        if (record.type === "attributes" && record.attributeName === "placeholder") {
            return false;
        }
        return true;
    });
}

export class HintPlugin extends Plugin {
    static name = "hint";
    static dependencies = ["history", "selection"];
    static resources = (p) => ({
        history_rendering_classes: ["o-we-hint"],
        filter_mutation_record: filterMutationRecords,
        onSelectionChange: p.updateTempHints.bind(p),
    });

    setup() {
        this.tempHints = new Set();
        this.hints = {
            BLOCKQUOTE: _t("Empty quote"),
            H1: _t("Heading 1"),
            H2: _t("Heading 2"),
            H3: _t("Heading 3"),
            H4: _t("Heading 4"),
            H5: _t("Heading 5"),
            H6: _t("Heading 6"),
            "UL LI": _t("List"),
            "OL LI": _t("List"),
            // @todo @phoenix
            // Reconsider spec for hint on checklists.
            // Current web_editor on stable displays no hint for checklists.
            // This selector finds nothing ('UL.o_checklist LI' instead would work).
            // Hint uses the ::before pseudo-element to display the hint text, but for checklists
            // this is already used to display the checkbox.
            "CL LI": _t("To-do"),
        };
        this.updateHints();
    }

    destroy() {
        this.removeHints();
    }

    handleCommand(command, payload) {
        switch (command) {
            case "CONTENT_UPDATED":
                this.updateHints();
                this.updateTempHints(this.shared.getEditableSelection());
                break;
            case "CREATE_HINT":
                this.createTempHint(payload.el, payload.text);
                break;
            case "CLEAN_BEFORE_SPLIT_BLOCK": // @todo @phoenix: maybe use the NORMALIZE command for this?
                this.clearTempHints();
                break;
            case "CLEAN":
                this.removeHints();
                break;
        }
    }

    removeHints() {
        for (const hint of this.editable.querySelectorAll(".o-we-hint")) {
            this.removeHint(hint);
        }
        this.tempHints.clear();
    }

    createTempHint(el, text) {
        if (el.classList.contains("o-we-hint")) {
            // a temp hint does not have precedence over an actual hint
            return;
        }
        this.tempHints.add(el);
        this.makeHint(el, text);
    }

    updateHints() {
        // remove all outdated (=non empty) hints
        for (const hint of this.editable.querySelectorAll(".o-we-hint")) {
            if (!isEmpty(hint)) {
                this.removeHint(hint);
                if (this.tempHints.has(hint)) {
                    this.tempHints.delete(hint);
                }
            }
        }
        // add new hints, if any
        for (const [selector, text] of Object.entries(this.hints)) {
            for (const el of this.editable.querySelectorAll(selector)) {
                if (!el.classList.contains("o-we-hint") && isEmpty(el)) {
                    this.makeHint(el, text);
                }
            }
        }
    }

    clearTempHints() {
        for (const el of this.tempHints) {
            this.removeHint(el);
        }
        this.tempHints.clear();
    }

    updateTempHints(selection) {
        this.clearTempHints();
        if (selection.isCollapsed && this.editable.contains(selection.commonAncestorContainer)) {
            for (const hint of this.resources["temp_hints"]) {
                const target = hint.target(selection);
                if (target) {
                    this.createTempHint(target, hint.text);
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
    }
}

registry.category("phoenix_plugins").add(HintPlugin.name, HintPlugin);
