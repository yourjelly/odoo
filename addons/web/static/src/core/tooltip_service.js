/** @odoo-module **/

import { browser } from "./browser/browser";
import { registry } from "./registry";

const { Component } = owl;
const { xml } = owl.tags;

class Tooltip extends Component {}
Tooltip.template = xml`<span class="p-2" t-esc="props.message" />`;

export const tooltipService = {
    dependencies: ["popover"],
    start(env, { popover }) {
        let timeoutId = null;
        const stack = [];

        function reset() {
            if (timeoutId) {
                browser.clearTimeout(timeoutId);
                timeoutId = null;
            }

            const item = stack[stack.length - 1];
            if (item && item.remove) {
                item.remove();
            }
        }
        function addTooltip(item) {
            timeoutId = browser.setTimeout(() => {
                item.remove = popover.add(
                    item.target,
                    Tooltip,
                    { message: item.message },
                    {
                        popoverClass: "o_custom_tooltip",
                        onClose() {
                            const index = stack.findIndex((i) => i === item);
                            if (index >= 0) {
                                stack.splice(index, 1);
                            }
                        },
                    }
                );
            }, 500);
        }
        function onEnter(ev) {
            if (
                ev.target &&
                ev.target.nodeType === Node.ELEMENT_NODE &&
                ev.target.hasAttribute("title")
            ) {
                reset();

                const message = ev.target.getAttribute("title");
                if (message) {
                    const item = { target: ev.target, message };
                    stack.push(item);
                    addTooltip(item);
                    item.target.removeAttribute("title");
                }
            }
        }
        function onLeave(ev) {
            if (
                ev.target &&
                ev.target.nodeType === Node.ELEMENT_NODE &&
                stack.length &&
                stack[stack.length - 1].target === ev.target
            ) {
                reset();

                let item = stack.pop();
                if (item) {
                    item.target.setAttribute("title", item.message);
                }

                if (stack.length) {
                    const item = stack[stack.length - 1];
                    addTooltip(item);
                }
            }
        }

        document.addEventListener("mouseenter", onEnter, { capture: true });
        document.addEventListener("mouseleave", onLeave, { capture: true });
    },
};

registry.category("services").add("tooltip", tooltipService);
