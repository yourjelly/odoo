/** @odoo-module **/

import * as hoot from "@odoo/hoot-dom";
import { markup } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { utils } from "@web/core/ui/ui_service";
import { _legacyIsVisible } from "@web/core/utils/ui";
import { tourState } from "./tour_state";

/**
 * @typedef {string | (actions: RunningTourActionHelper) => void | Promise<void>} RunCommand
 */

export class TourError extends Error {
    constructor(message, ...args) {
        super(message, ...args);
        this.message = `(TourError) ${message}`;
    }
}

/**
 * Calls the given `func` then returns/resolves to `true`
 * if it will result to unloading of the page.
 * @param {(...args: any[]) => void} func
 * @param  {any[]} args
 * @returns {boolean | Promise<boolean>}
 */
export function callWithUnloadCheck(func, ...args) {
    let willUnload = false;
    const beforeunload = () => (willUnload = true);
    window.addEventListener("beforeunload", beforeunload);
    const result = func(...args);
    if (result instanceof Promise) {
        return result.then(() => {
            window.removeEventListener("beforeunload", beforeunload);
            return willUnload;
        });
    } else {
        window.removeEventListener("beforeunload", beforeunload);
        return willUnload;
    }
}

export function getFirstVisibleNode(nodes) {
    return (nodes || []).find((node) => _legacyIsVisible(node));
}

/**
 * @param {NodeList|HTMLElement|string} selector
 * @param {HTMLElement} target
 * @returns {Node[]}
 */
export function getNodesFromSelector(selector, target = document) {
    if (typeof selector === "string") {
        const iframeRegex = /(?<iframe>.*\biframe[^ ]*)(?<selector>.*)/;
        const iframeSplit = typeof selector === "string" && selector.match(iframeRegex);
        if (iframeSplit?.groups?.selector && !iframeSplit?.groups?.iframe.includes(":iframe")) {
            const iframeSelector = `${iframeSplit.groups?.iframe}:not(.o_ignore_in_tour)`;
            const iframe = hoot.queryAll(iframeSelector, { root: target }).at(0);
            if (iframe instanceof Node) {
                if (iframe.matches(`[is-ready="false"]`)) {
                    return [];
                } else {
                    return hoot.queryAll(iframeSplit.groups?.selector, {
                        root: iframe.contentWindow.document,
                    });
                }
            } else {
                return [];
            }
        } else {
            return hoot.queryAll(selector, { root: target });
        }
    } else if (selector instanceof HTMLElement) {
        return [selector];
    } else if (selector instanceof NodeList) {
        return [...selector];
    } else {
        return [];
    }
}

/**
 * @param {HTMLElement} [element]
 * @param {RunCommand} [runCommand]
 * @returns {string}
 */
export function getConsumeEventType(element, runCommand) {
    if (!element) {
        return "click";
    }
    const { classList, tagName, type } = element;
    const tag = tagName.toLowerCase();

    // Many2one
    if (classList.contains("o_field_many2one")) {
        return "autocompleteselect";
    }

    // Inputs and textareas
    if (
        tag === "textarea" ||
        (tag === "input" &&
            (!type ||
                ["email", "number", "password", "search", "tel", "text", "url"].includes(type)))
    ) {
        if (
            utils.isSmall() &&
            element.closest(".o_field_widget")?.matches(".o_field_many2one, .o_field_many2many")
        ) {
            return "click";
        }
        return "input";
    }

    // jQuery draggable
    if (classList.contains("ui-draggable-handle")) {
        return "mousedown";
    }

    // Drag & drop run command
    if (typeof runCommand === "string" && /^drag_and_drop/.test(runCommand)) {
        // this is a heuristic: the element has to be dragged and dropped but it
        // doesn't have class 'ui-draggable-handle', so we check if it has an
        // ui-sortable parent, and if so, we conclude that its event type is 'sort'
        if (element.closest(".ui-sortable")) {
            return "sort";
        }
        if (
            (/^drag_and_drop_native/.test(runCommand) && classList.contains("o_draggable")) ||
            element.closest(".o_draggable")
        ) {
            return "pointerdown";
        }
    }

    // Default: click
    return "click";
}

// /**
//  * ! This function is a copy-paste of its namesake in @web/../tests/helpers/utils
//  * TODO: Unify utils for tests and tours since they're doing the exact same thing
//  * @param {Node} n1
//  * @param {Node} n2
//  * @returns {Node[]}
//  */
// export function getDifferentParents(n1, n2) {
//     const parents = [n2];
//     while (parents[0].parentNode) {
//         const parent = parents[0].parentNode;
//         if (parent.contains(n1)) {
//             break;
//         }
//         parents.unshift(parent);
//     }
//     return parents;
// }

/**
 * @param {HTMLElement} element
 * @returns {HTMLElement | null}
 */
export function getScrollParent(element) {
    if (!element) {
        return null;
    }
    if (element.scrollHeight > element.clientHeight) {
        return element;
    } else {
        return getScrollParent(element.parentNode);
    }
}

/**
 * @param {HTMLElement} el
 * @param {string} type
 * @param {boolean} canBubbleAndBeCanceled
 * @param {PointerEventInit} [additionalParams]
 */
export const triggerPointerEvent = (el, type, canBubbleAndBeCanceled, additionalParams) => {
    const eventInit = {
        bubbles: canBubbleAndBeCanceled,
        cancelable: canBubbleAndBeCanceled,
        view: window,
        ...additionalParams,
    };

    el.dispatchEvent(new PointerEvent(type, eventInit));
    if (type.startsWith("pointer")) {
        el.dispatchEvent(new MouseEvent(type.replace("pointer", "mouse"), eventInit));
    }
};

export class RunningTourActionHelper {
    constructor(tourName, step, tip_widget) {
        this.tourName = tourName;
        this.step = step;
        this.tip_widget = tip_widget;
        this.anchor = this.tip_widget.anchor;
        this.consume_event = this.tip_widget.consume_event;
        this.devTools = tourState.get(this.tourName, "devTools");
        this.getActionError = (actionName, selector) => {
            return `${this.tourName} > ${this.step.content} > Impossible to ${actionName}(${selector})`;
        };
    }
    /**
     * Fire action depending on the type of element
     * @param {string} selector DOM Selector (HooT QueryAll)
     */
    auto(selector) {
        const element = this._get_action_element(selector);
        const consume_event = this._get_action_consume_event(element);
        if (consume_event === "input") {
            this._text(element);
        } else {
            this.click(selector);
        }
    }
    /**
     * @param {string|Node} selector DOM Selector or Node
     */
    click(selector) {
        try {
            const element = this._get_action_element(selector);
            hoot.click(element);
        } catch {
            throw new Error(this.getActionError("click", selector));
        }
    }
    /**
     * @param {string|Node} selector DOM Selector or Node
     */
    dblclick(selector) {
        try {
            const element = this._get_action_element(selector);
            hoot.dblclick(element);
        } catch {
            throw new Error(this.getActionError("dblclick", selector));
        }
    }
    /**
     * @param {string} text
     * @param {string|Node} selector DOM Selector or Node
     */
    text(text, selector) {
        const element = this._get_action_element(selector);
        this._text(element, text);
    }
    /**
     * @param {string} text
     * @param {string|Node} selector DOM Selector or Node
     */
    text_blur(text, selector) {
        const element = this._get_action_element(selector);
        hoot.click(element);
        hoot.edit(text, { confirm: true });
        element.dispatchEvent(
            new InputEvent("input", {
                bubbles: true,
            })
        );
        element.dispatchEvent(new Event("change", { bubbles: true, cancelable: false }));
        element.dispatchEvent(new Event("focusout"));
        element.dispatchEvent(new Event("blur"));
    }
    /**
     * @param {string} text
     * @param {string|Node} selector DOM Selector or Node
     */
    edit(text, selector) {
        const element = this._get_action_element(selector);
        hoot.click(element);
        hoot.edit(text);
        element.dispatchEvent(new Event("change", { bubbles: true, cancelable: false }));
    }
    /**
     * @param {string|Node} selector DOM Selector or Node
     */
    clear(selector) {
        const element = this._get_action_element(selector);
        hoot.pointerDown(element);
        hoot.clear();
    }
    range(text, selector) {
        const element = this._get_action_element(selector);
        element.value = text;
        hoot.dispatch(element, "change", { bubbles: true, cancelable: false });
    }
    drag_and_drop_native(target, source) {
        const to = this._get_action_element(target);
        const from = this._get_action_element(source);
        try {
            hoot.drag(from).drop(to);
        } catch {
            throw new Error(`Error when try to drag('${source}').moveTo('${target}').drop()`);
        }
    }
    // drag_and_drop(toSel, fromSel) {
    //     const from = this._get_action_element(fromSel);
    //     const to = getNodesFromSelector(toSel)[0];
    //     this._drag_and_drop(from, to);
    // }
    // _drag_and_drop(source, target) {
    //     const sourceRect = source.getBoundingClientRect();
    //     const sourcePosition = {
    //         clientX: sourceRect.x + sourceRect.width / 2,
    //         clientY: sourceRect.y + sourceRect.height / 2,
    //     };

    //     const targetRect = target.getBoundingClientRect();
    //     const targetPosition = {
    //         clientX: targetRect.x + targetRect.width / 2,
    //         clientY: targetRect.y + targetRect.height / 2,
    //     };

    //     triggerPointerEvent(source, "pointerdown", true, sourcePosition);
    //     triggerPointerEvent(source, "pointermove", true, targetPosition);

    //     for (const parent of getDifferentParents(source, target)) {
    //         triggerPointerEvent(parent, "pointerenter", false, targetPosition);
    //     }
    //     triggerPointerEvent(target, "pointerup", true, targetPosition);
    //     document.body.focus();
    // }
    /**
     * Get Node for a selector, return this.anchor by default
     * @param {string|Node} selector
     * @returns {Node}
     */
    _get_action_element(selector) {
        if (typeof selector === "string" && selector?.length > 0) {
            const nodes = getNodesFromSelector(selector);
            const node = getFirstVisibleNode(nodes);
            return !(node instanceof Node) ? nodes.at(0) : node;
        } else if (selector instanceof Node) {
            return selector;
        }
        return this.anchor;
    }
    /**
     * Get Event to consume on selector, return this.consume_event by default
     * @param {Node} element
     * @returns {string}
     */
    _get_action_consume_event(element) {
        if (element instanceof Node) {
            return getConsumeEventType(element);
        }
        return this.consume_event;
    }
    _text(element, text) {
        text = text || "Test";
        const consume_event = this._get_action_consume_event(element);
        hoot.click(element);

        if (consume_event === "input") {
            hoot.edit(text);
            element.dispatchEvent(new Event("change", { bubbles: true, cancelable: false }));
        } else if (element.matches("select")) {
            const options = hoot.queryAll("option", { root: element });
            options.forEach((option) => {
                delete option.selected;
            });
            let selectedOption = options.find((option) => option.value === text);
            if (!(selectedOption instanceof Node)) {
                selectedOption = options.find(
                    (option) => String(option.textContent).trim() === text
                );
            }
            const regex = /option\s+([0-9]+)/;
            if (!(selectedOption instanceof Node) && regex.test(text)) {
                // Extract position as 1-based, as the nth selectors.
                const position = parseInt(regex.exec(text)[1]);
                selectedOption = options.at(position - 1); // eq is 0-based.
            }
            selectedOption.selected = true;
            hoot.click(element);
            // For situations where an `oninput` is defined.
            element.dispatchEvent(new Event("input"));
            element.dispatchEvent(new Event("change", { bubbles: true, cancelable: false }));
        } else {
            element.dispatchEvent(new Event("focusin"));
            element.dispatchEvent(new KeyboardEvent("keydown", { key: "_" }));
            element.textContent = text;
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("focusout"));
            element.dispatchEvent(new KeyboardEvent("keyup", { key: "_" }));
            element.dispatchEvent(new Event("change", { bubbles: true, cancelable: false }));
        }
        // element.dispatchEvent(new Event("change", { bubbles: true, cancelable: false }));
    }
}

export const stepUtils = {
    _getHelpMessage(functionName, ...args) {
        return `Generated by function tour utils ${functionName}(${args.join(", ")})`;
    },

    addDebugHelp(helpMessage, step) {
        if (typeof step.debugHelp === "string") {
            step.debugHelp = step.debugHelp + "\n" + helpMessage;
        } else {
            step.debugHelp = helpMessage;
        }
        return step;
    },

    showAppsMenuItem() {
        return {
            edition: "community",
            trigger: ".o_navbar_apps_menu button",
            auto: true,
            position: "bottom",
        };
    },

    toggleHomeMenu() {
        return {
            edition: "enterprise",
            trigger: ".o_main_navbar .o_menu_toggle",
            content: markup(_t("Click on the <i>Home icon</i> to navigate across apps.")),
            position: "bottom",
        };
    },

    autoExpandMoreButtons(extra_trigger) {
        return {
            content: `autoExpandMoreButtons`,
            trigger: ".o-form-buttonbox",
            extra_trigger: extra_trigger,
            auto: true,
            run: (actions) => {
                const more = hoot.queryOne(".o-form-buttonbox .o_button_more");
                if (more instanceof Node) {
                    hoot.click(more);
                }
            },
        };
    },

    goBackBreadcrumbsMobile(description, ...extraTrigger) {
        return extraTrigger.map((element) => ({
            mobile: true,
            trigger: ".o_back_button",
            extra_trigger: element,
            content: description,
            position: "bottom",
            debugHelp: this._getHelpMessage(
                "goBackBreadcrumbsMobile",
                description,
                ...extraTrigger
            ),
        }));
    },

    goToAppSteps(dataMenuXmlid, description) {
        return [
            this.showAppsMenuItem(),
            {
                trigger: `.o_app[data-menu-xmlid="${dataMenuXmlid}"]`,
                content: description,
                position: "right",
                edition: "community",
            },
            {
                trigger: `.o_app[data-menu-xmlid="${dataMenuXmlid}"]`,
                content: description,
                position: "bottom",
                edition: "enterprise",
            },
        ].map((step) =>
            this.addDebugHelp(this._getHelpMessage("goToApp", dataMenuXmlid, description), step)
        );
    },

    openBurgerMenu(extraTrigger) {
        return {
            mobile: true,
            trigger: ".o_mobile_menu_toggle",
            extra_trigger: extraTrigger,
            content: _t("Open bugger menu."),
            position: "bottom",
            debugHelp: this._getHelpMessage("openBurgerMenu", extraTrigger),
        };
    },

    statusbarButtonsSteps(innerTextButton, description, extraTrigger) {
        return [
            {
                mobile: true,
                auto: true,
                trigger: ".o_statusbar_buttons",
                extra_trigger: extraTrigger,
                run: (actions) => {
                    const node = hoot.queryOne(
                        ".o_statusbar_buttons .btn.dropdown-toggle:contains(Action)"
                    );
                    if (node instanceof Node) {
                        hoot.click(node);
                    }
                },
            },
            {
                trigger: `.o_statusbar_buttons button:enabled:contains('${innerTextButton}')`,
                content: description,
                position: "bottom",
            },
        ].map((step) =>
            this.addDebugHelp(
                this._getHelpMessage(
                    "statusbarButtonsSteps",
                    innerTextButton,
                    description,
                    extraTrigger
                ),
                step
            )
        );
    },

    simulateEnterKeyboardInSearchModal() {
        return {
            mobile: true,
            trigger: ".o_searchview_input",
            extra_trigger: ".modal:not(.o_inactive_modal) .dropdown-menu.o_searchview_autocomplete",
            position: "bottom",
            run: () => {
                this.anchor.dispatchEvent(
                    new KeyboardEvent("keydown", {
                        bubbles: true,
                        cancelable: true,
                        key: "Enter",
                        code: "Enter",
                    })
                );
            },
            debugHelp: this._getHelpMessage("simulateEnterKeyboardInSearchModal"),
        };
    },

    mobileKanbanSearchMany2X(modalTitle, valueSearched) {
        return [
            {
                mobile: true,
                trigger: `.o_control_panel_navigation .btn .fa-search`,
                position: "bottom",
            },
            {
                mobile: true,
                trigger: ".o_searchview_input",
                extra_trigger: `.modal:not(.o_inactive_modal) .modal-title:contains('${modalTitle}')`,
                position: "bottom",
                run: `text ${valueSearched}`,
            },
            this.simulateEnterKeyboardInSearchModal(),
            {
                mobile: true,
                trigger: `.o_kanban_record .o_kanban_record_title :contains('${valueSearched}')`,
                position: "bottom",
            },
        ].map((step) =>
            this.addDebugHelp(
                this._getHelpMessage("mobileKanbanSearchMany2X", modalTitle, valueSearched),
                step
            )
        );
    },
    /**
     * Utility steps to save a form and wait for the save to complete
     *
     * @param {object} [options]
     * @param {string} [options.content]
     * @param {string} [options.extra_trigger] additional save-condition selector
     */
    saveForm(options = {}) {
        return [
            {
                content: options.content || "save form",
                trigger: ".o_form_button_save",
                extra_trigger: options.extra_trigger,
                run: "click",
                auto: true,
            },
            {
                content: "wait for save completion",
                trigger: ".o_form_readonly, .o_form_saved",
                run() {},
                auto: true,
            },
        ];
    },
    /**
     * Utility steps to cancel a form creation or edition.
     *
     * Supports creation/edition from either a form or a list view (so checks
     * for both states).
     */
    discardForm(options = {}) {
        return [
            {
                content: options.content || "exit the form",
                trigger: ".o_form_button_cancel",
                extra_trigger: options.extra_trigger,
                run: "click",
                auto: true,
            },
            {
                content: "wait for cancellation to complete",
                trigger:
                    ".o_view_controller.o_list_view, .o_form_view > div > div > .o_form_readonly, .o_form_view > div > div > .o_form_saved",
                run() {},
                auto: true,
            },
        ];
    },
};
