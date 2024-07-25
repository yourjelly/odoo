import { isProtected, isProtecting } from "@html_editor/utils/dom_info";
import { Plugin } from "../plugin";

export class InputPlugin extends Plugin {
    static name = "input";
    setup() {
        const sequence = (resource) => resource.sequence ?? 50;
        this.resources.onBeforeInput?.sort((a, b) => sequence(a) - sequence(b));
        this.resources.onInput?.sort((a, b) => sequence(a) - sequence(b));

        this.addDomListener(this.editable, "beforeinput", this.onBeforeInput);
        this.addDomListener(this.editable, "input", this.onInput);
    }

    ignoreInput() {
        const selection = this.document.getSelection();
        const ignoreElementForInput = (el) => {
            if (!el) {
                return false;
            }
            return isProtected(el) || isProtecting(el);
        };
        return (
            ignoreElementForInput(selection.anchorNode) ||
            ignoreElementForInput(selection.focusNode)
        );
    }

    onBeforeInput(ev) {
        this.dispatch("HISTORY_STAGE_SELECTION");
        if (this.ignoreInput()) {
            return;
        }
        for (const { handler } of this.resources.onBeforeInput || []) {
            handler(ev);
        }
    }

    onInput(ev) {
        if (this.ignoreInput()) {
            return;
        }
        this.dispatch("ADD_STEP");
        for (const { handler } of this.resources.onInput || []) {
            handler(ev);
        }
    }
}
