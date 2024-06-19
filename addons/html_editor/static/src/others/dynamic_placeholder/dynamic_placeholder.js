import { _t } from "@web/core/l10n/translation";
import { Plugin } from "@html_editor/plugin";

export class DynamicPlaceholderPlugin extends Plugin {
    static name = "dynamic_placeholder";
    static dependencies = ["selection", "history", "dom", "qweb"];
    /** @type { (p: DynamicPlaceholderPlugin) => Record<string, any> } */
    static resources = (p) => ({
        powerboxCategory: { id: "marketing_tools", name: _t("Marketing Tools"), sequence: 60 },
        powerboxCommands: {
            name: _t("Dynamic Placeholder"),
            description: _t("Insert personalized content"),
            category: "marketing_tools",
            fontawesome: "fa-magic",
            action(dispatch) {
                dispatch("OPEN_DYNAMIC_PLACEHOLDER");
            },
        },
    });
    setup() {
        if (!this.config.dynamicPlaceholder || this.config.dynamicPlaceholderModelReferenceField) {
            throw new Error("Invalid Dynamic Placeholder Config");
        }
        this.dynamicPlaceholder = this.config.dynamicPlaceholder;
        this.dynamicPlaceholderModelReferenceField =
            this.config.dynamicPlaceholderModelReferenceField;
    }

    handleCommand(command) {
        switch (command) {
            case "OPEN_DYNAMIC_PLACEHOLDER": {
                this.openDialog();

                this.eventListenerHash = this.addDomListener(
                    this.editable,
                    "beforeinput",
                    this.onBeforeInput,
                    true
                );
                break;
            }
        }
    }

    openDialog() {
        this.selectionToRestore = this.shared.preserveSelection();

        this.dynamicPlaceholder.updateModel(this.dynamicPlaceholderModelReferenceField);
        this.dynamicPlaceholder.open({
            validateCallback: this.onDynamicPlaceholderValidate.bind(this),
            closeCallback: this.onDynamicPlaceholderClose.bind(this),
            positionCallback: this.positionDynamicPlaceholder.bind(this),
        });
    }
    onBeforeInput(ev) {
        if (ev.inputType === "insertParagraph") {
            ev.preventDefault();
            ev.stopImmediatePropagation();
        }
    }

    /**
     * @param {string} chain
     * @param {string} defaultValue
     */
    onDynamicPlaceholderValidate(chain, defaultValue) {
        if (!chain) {
            return;
        }

        // Ensure the focus is in the editable document
        // before inserting the <t> element.
        let dynamicPlaceholder = "object." + chain;
        dynamicPlaceholder +=
            defaultValue && defaultValue !== "" ? ` or '''${defaultValue}'''` : "";
        const t = document.createElement("T");
        t.setAttribute("t-out", dynamicPlaceholder);

        this.shared.domInsert(t);
        this.editable.focus();
        this.dispatch("NORMALIZE", { node: t.parentElement });
        this.dispatch("ADD_STEP");
    }
    onDynamicPlaceholderClose() {
        this.selectionToRestore();
        setTimeout(() => this.removeDomListener(this.eventListenerHash), 50);
    }

    /**
     * @param {HTMLElement} popover
     * @param {Object} position
     */
    positionDynamicPlaceholder(popover, position) {
        // @todo : better positioning based on the current range position
        // Apply the position back to the element.
        popover.style.top = position.top + "px";
        popover.style.left = position.left + "px";
    }
}
