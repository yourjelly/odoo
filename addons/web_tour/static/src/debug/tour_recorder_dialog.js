/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { makeDraggableHook } from "@web/core/utils/draggable_hook_builder";
import { Component, onWillDestroy, useState } from "@odoo/owl";
import { finder } from "./finder";
import { useService } from "@web/core/utils/hooks";

const useDialogDraggable = makeDraggableHook({
    name: "useDialogDraggable",
    onWillStartDrag({ ctx, addCleanup, addStyle, getRect }) {
        const { height, width } = getRect(ctx.current.element);
        ctx.current.container = document.createElement("div");
        addStyle(ctx.current.container, {
            position: "fixed",
            top: "0",
            bottom: `${70 - height}px`,
            left: `${70 - width}px`,
            right: `${70 - width}px`,
        });
        ctx.current.element.after(ctx.current.container);
        addCleanup(() => ctx.current.container.remove());
    },
    onDrop({ ctx, getRect }) {
        const { top, left } = getRect(ctx.current.element);
        return {
            left: left - ctx.current.elementRect.left,
            top: top - ctx.current.elementRect.top,
        };
    },
});
export class TourRecorderOverlay extends Component {
    static template = "web_tour.TourRecorderDialog";
    static title = _lt("Tours");

    setup() {
        this.state = useState({ recording: false });
        this.steps = useState([]);
        this.position = useState({ left: 0, top: 0 });
        this.notification = useService("notification");
        useDialogDraggable({
            ref: { el: document },
            elements: ".o-tour-controller",
            edgeScrolling: { enabled: false },
            onDrop: ({ top, left }) => {
                this.position.left += left;
                this.position.top += top;
            },
        });

        onWillDestroy(() => {
            if (this.state.recording) {
                document.removeEventListener("click", this.addClick, true);
            }
        });
    }

    get contentStyle() {
        return `top: ${this.position.top}px; left: ${this.position.left}px; width: 300px; z-index:9999; opacity: 0.9;`;
    }

    generateStepsString(stepsArray) {
        let initialString = `steps: () => [`;
        stepsArray.forEach((element) => {
            initialString += `
                {
                    trigger: "${element}",
                },`;
        });
        initialString += `
            ],`;
        return initialString;
    }

    addClick(ev) {
        const parentElement = document.querySelector(".o-tour-controller");
        if (parentElement.contains(ev.target) || ev.target === document.querySelector("html")) {
            return;
        }
        // TODO: verify if there is more than one element
        const selector = finder(ev.target);

        this.steps.push(selector);
    }

    startRecording() {
        this.state.recording = true;
        this.addClickReference = this.addClick.bind(this);
        document.addEventListener("click", this.addClickReference, true);
    }

    resetRecording() {
        this.steps.length = 0;
    }

    copySteps() {
        navigator.clipboard.writeText(this.generateStepsString(this.steps));
        this.notification.add(this.env._t("Steps copied to clipboard!"), { type: "success" });
    }

    stopRecording() {
        this.state.recording = false;
        document.removeEventListener("click", this.addClickReference, true);
    }
}
