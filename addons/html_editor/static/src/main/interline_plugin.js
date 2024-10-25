import { Plugin } from "@html_editor/plugin";
import { removeClass } from "@html_editor/utils/dom";
import { isProtected } from "@html_editor/utils/dom_info";
import { closestElement } from "@html_editor/utils/dom_traversal";
import { withSequence } from "@html_editor/utils/resource";
import { _t } from "@web/core/l10n/translation";

export class InterlinePlugin extends Plugin {
    static name = "interline";
    static dependencies = ["selection", "toolbar"];
    resources = {
        toolbarCategory: withSequence(15, { id: "global_style" }),
        toolbarItems: [
            {
                id: "paragraph_interline",
                category: "global_style",
                action(dispatch) {
                    dispatch("TOGGLE_INTERLINE");
                },
                icon: "fa-arrows-v",
                title: _t("Toggle spacing"),
                isFormatApplied: this.isInterlineApplied.bind(this),
                isAvailable: (selection) => this.isInterlineAvailable(selection),
            },
        ],
        interline_selectors: {
            paragraph: "p",
        },
        on_change_attribute: this.onChangeAttribute.bind(this),
    };

    setup() {
        // should detect disabledInterline during collaborative interactions
        // the same way as on START_EDITION
        this.disabledInterlines = new Set();
        this.interlineSelectors = {};
        for (const selectors of this.getResource("interline_selectors")) {
            Object.assign(this.interlineSelectors, selectors);
        }
        this.fullSelector = Object.values(this.interlineSelectors).join(",");
        this.evaluateInterlines();
    }

    handleCommand(command, payload) {
        switch (command) {
            case "NORMALIZE":
                this.normalize();
                break;
            case "TOGGLE_INTERLINE":
                this.toggleInterline(payload.keys);
                break;
        }
    }

    evaluateInterlines() {
        for (const [key, selector] of Object.entries(this.interlineSelectors)) {
            let shouldEnable;
            for (const element of this.editable.querySelectorAll(selector)) {
                if (!isProtected(element)) {
                    if (
                        element.matches(".oe-no-interline") ||
                        element.style.marginBottom === "0px"
                    ) {
                        this.disabledInterlines.add(key);
                        break;
                    } else {
                        shouldEnable = true;
                    }
                }
            }
            if (shouldEnable) {
                this.disabledInterlines.delete(key);
            }
        }
    }

    getSelectionContainer(editableSelection) {
        return closestElement(editableSelection.commonAncestorContainer, this.fullSelector);
    }

    isInterlineApplied(selection) {
        if (!this.isInterlineAvailable(selection)) {
            return false;
        }
        const container = this.getSelectionContainer(selection);
        for (const [key, selector] of Object.entries(this.interlineSelectors)) {
            if (container.matches(selector)) {
                return !this.disabledInterlines.has(key);
            }
        }
    }

    isInterlineAvailable(selection) {
        const container = this.getSelectionContainer(selection);
        return container && !isProtected(container) && container.matches(this.fullSelector);
    }

    /**
     * Should always normalize the entire editable depending on the current
     * disabledInterlines
     */
    normalize() {
        for (const [key, selector] of Object.entries(this.interlineSelectors)) {
            for (const target of this.editable.querySelectorAll(selector)) {
                if (isProtected(target)) {
                    continue;
                }
                if (
                    this.disabledInterlines.has(key) &&
                    !target.classList.contains("oe-no-interline")
                ) {
                    target.classList.add("oe-no-interline");
                    // Handle the margin bottom from sanitize.js
                    if (target.style.marginBottom === "0px") {
                        target.style.marginBottom = "";
                        if (target.getAttribute("style") === "") {
                            target.removeAttribute("style");
                        }
                    }
                } else if (
                    !this.disabledInterlines.has(key) &&
                    target.classList.contains("oe-no-interline")
                ) {
                    removeClass(target, "oe-no-interline");
                }
            }
        }
    }

    onChangeAttribute(attributeChange) {
        if (attributeChange.attributeName !== "class") {
            return;
        }
        const getDomTokenList = (attrState) => {
            const tmpEl = this.document.createElement("div");
            tmpEl.setAttribute("class", attrState);
            return tmpEl.classList;
        };
        let previousClassList = getDomTokenList(attributeChange.oldValue);
        let nextClassList = getDomTokenList(attributeChange.value);
        if (attributeChange.reverse) {
            const tmp = previousClassList;
            previousClassList = nextClassList;
            nextClassList = tmp;
        }
        const previousNoInterline = previousClassList.contains("oe-no-interline");
        const nextNoInterLine = nextClassList.contains("oe-no-interline");
        if (previousNoInterline === nextNoInterLine) {
            return;
        }
        for (const [key, selector] of Object.entries(this.interlineSelectors)) {
            if (attributeChange.target.matches(selector)) {
                if (previousNoInterline) {
                    this.disabledInterlines.delete(key);
                } else {
                    this.disabledInterlines.add(key);
                }
            }
        }
    }

    toggleInterline() {
        const container = this.getSelectionContainer(this.shared.getEditableSelection());
        if (isProtected(container)) {
            return;
        }
        if (container.classList.contains("oe-no-interline")) {
            removeClass(container, "oe-no-interline");
        } else if (container.matches(this.fullSelector)) {
            container.classList.add("oe-no-interline");
        }
        this.dispatch("ADD_STEP");
    }
}
