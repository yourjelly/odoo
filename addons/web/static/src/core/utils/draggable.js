/** @odoo-module **/

import { clamp } from "@web/core/utils/numbers";
import { debounce } from "@web/core/utils/timing";
import { makeCleanupManager, makeDraggableManager } from "./draggable_helper";

const { useEffect, useEnv, useExternalListener, onWillUnmount } = owl;

/**
 * @typedef DraggableParams
 *
 * MANDATORY
 *
 * @property {{ el: HTMLElement | null }} ref
 * @property {string} elements defines draggable elements
 *
 * OPTIONAL
 *
 * @property {boolean | () => boolean} [enable] whether the draggable system should
 *  be enabled.
 * @property {string | () => string} [groups] defines parent groups of draggable
 *  elements. This allows to add `onGroupEnter` and `onGroupLeave` callbacks to
 *  work on group elements during the dragging sequence.
 * @property {string | () => string} [handle] additional selector for when the dragging
 *  sequence must be initiated when dragging on a certain part of the element.
 * @property {string | () => string} [ignore] selector targetting elements that must
 *  initiate a drag.
 * @property {boolean | () => boolean} [connectGroups] whether elements can be dragged
 *  accross different parent groups. Note that it requires a `groups` param to work.
 * @property {string | () => string} [cursor] cursor style during the dragging sequence.
 *
 * HANDLERS (also optional)
 *
 * @property {(group: HTMLElement | null, element: HTMLElement) => any} [onStart]
 *  called when a dragging sequence is initiated.
 * @property {(element: HTMLElement) => any} [onElementEnter] called when the cursor
 *  enters another draggable element.
 * @property {(element: HTMLElement) => any} [onElementLeave] called when the cursor
 *  leaves another draggable element.
 * @property {(group: HTMLElement) => any} [onGroupEnter] (if a `groups` is specified):
 *  will be called when the cursor enters another group element.
 * @property {(group: HTMLElement) => any} [onGroupLeave] (if a `groups` is specified):
 *  will be called when the cursor leaves another group element.
 * @property {(group: HTMLElement | null, element: HTMLElement) => any} [onStop]
 *  called when the dragging sequence ends, regardless of the reason.
 * @property {(params: DropParams) => any} [onDrop] called when the dragging sequence
 *  ends on a mouseup action AND the dragged element has been moved elsewhere. The
 *  callback will be given an object with any useful element regarding the new position
 *  of the dragged element (@see DropParams ).
 */

/**
 * @typedef DropParams
 * @property {HTMLElement} element
 * @property {HTMLElement | null} group
 * @property {HTMLElement | null} previous
 * @property {HTMLElement | null} next
 * @property {HTMLElement | null} parent
 */

const LEFT_CLICK = 0;
const MANDATORY_DRAGGABLE_PARAMS = ["ref", "elements"];
const DRAGGABLE_PARAMS = {
    enable: ["boolean", "function"],
    ref: ["object"],
    elements: ["string"],
    groups: ["string", "function"],
    handle: ["string", "function"],
    ignore: ["string", "function"],
    connectGroups: ["boolean", "function"],
    cursor: ["string"],
};

/**
 * Cancels the default behavior and propagation of a given event.
 * @param {Event} ev
 */
function cancelEvent(ev) {
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    ev.preventDefault();
}

/**
 * @param {DraggableParams} params
 * @returns {[string, string | boolean][]}
 */
function computeParams(params) {
    const computedParams = { enable: true };
    for (const prop in DRAGGABLE_PARAMS) {
        if (prop in params) {
            computedParams[prop] = params[prop];
            if (typeof params[prop] === "function") {
                computedParams[prop] = computedParams[prop]();
            }
        }
    }
    return Object.entries(computedParams);
}

/**
 * Converts a CSS pixel value to a number, removing the 'px' part.
 * @param {string} val
 * @returns {number}
 */
function cssValueToNumber(val) {
    return Number(val.slice(0, -2));
}

/**
 * Basic error builder for the draggable hook.
 * @param {string} reason
 * @returns {Error}
 */
function draggableError(reason) {
    return new Error(`Unable to use draggable feature: ${reason}.`);
}

/**
 * Draggable feature hook.
 *
 * This hook needs 2 things to work:
 *
 * 1) a `ref` object (@see owl.useRef) which will be used as the root element to
 * calculate boundaries of dragged elements;
 *
 * 2) an `elements` selector string or function that will determine which elements
 * are draggable in the reference element.
 *
 * All other parameters are optional and define the constraints of the dragged elements
 * (and the appearance of the cursor during a dragging sequence), or the different
 * available handlers triggered during the drag sequence.
 * @see DraggableParams
 *
 * @param {DraggableParams} params
 */
export function useDraggable(params) {
    const env = useEnv();
    const cleanupManager = makeCleanupManager();
    const { ref } = params;

    // Basic error handling asserting that the parameters are valid.
    for (const prop in DRAGGABLE_PARAMS) {
        if (params[prop] && !DRAGGABLE_PARAMS[prop].includes(typeof params[prop])) {
            throw draggableError(`invalid type for property "${prop}" in parameters`);
        } else if (!params[prop] && MANDATORY_DRAGGABLE_PARAMS.includes(prop)) {
            throw draggableError(`missing required property "${prop}" in parameters`);
        }
    }

    /**
     * Stores the current group selector (optional).
     * @type {string | null}
     */
    let elementSelector = null;
    /**
     * Stores the full selector used to initiate a drag sequence.
     * @type {string | null}
     */
    let ignoreSelector = null;
    /**
     * Stores the full selector used to initiate a drag sequence.
     * @type {string | null}
     */
    let fullSelector = null;

    /**
     * Stores the style of the cursor, if defined.
     * @type {string | null}
     */
    let cursor = null;
    /**
     * Stores the position and dimensions of the confining element (ref or
     * parent).
     * @type {DOMRect | null}
     */
    let currentContainerRect = null;

    /**
     * Stores the current dragged element.
     * @type {HTMLElement | null}
     */
    let currentElement = null;
    /**
     * Stores the dimensions and position of the dragged element.
     * @type {DOMRect | null}
     */
    let currentElementRect = null;

    /**
     * Stores whether a drag sequence can be initiated.
     * This is determined by both the given ref being in the document and the
     * `setup` function returning the required params (namely: `elements`).
     * @type {boolean}
     */
    let enabled = false;
    /**
     * Stores whether a drag sequence has been initiated.
     * @type {boolean}
     */
    let started = false;

    /**
     * Stores the position of the mouse cursor.
     */
    const mouse = { x: 0, y: 0 };
    /**
     * Stores the initial offset between the initial mousedown position and the
     * top-left corner of the dragged element.
     */
    const offset = { x: 0, y: 0 };

    makeDraggableManager({
        get enabled() {
            return enabled;
        },
        get selector() {
            return [fullSelector, ignoreSelector];
        },
        events: {
            mouseenter: {},
        },
        onDragStart({ addListener, target, mouse, offset }) {
            addListener(fullSelector);
        },
        onDrag({ target, mouse, offset }) {},
        onDragStop({ target, mouse, offset }) {},
        onDrop({ target, mouse, offset }) {},
    });

    /**
     * Element "mouseenter" event handler.
     * @param {MouseEvent} ev
     */
    const onElementMouseenter = (ev) => {
        const element = ev.currentTarget;
        execHandler("onElementEnter", { element });
    };

    /**
     * Element "mouseleave" event handler.
     * @param {MouseEvent} ev
     */
    const onElementMouseleave = (ev) => {
        const element = ev.currentTarget;
        execHandler("onElementLeave", { element });
    };

    /**
     * Window "keydown" event handler.
     * @param {KeyboardEvent} ev
     */
    const onKeydown = (ev) => {
        if (!enabled || !started) {
            return;
        }
        switch (ev.key) {
            case "Escape":
            case "Tab": {
                cancelEvent(ev);
                dragStop();
            }
        }
    };

    /**
     * Global (= ref) "mousedown" event handler.
     * @param {MouseEvent} ev
     */
    const onMousedown = (ev) => {
        updateMouseFromEvent(ev);

        // A drag sequence can still be in progress if the mouseup occurred
        // outside of the window.
        dragStop();

        if (
            ev.button !== LEFT_CLICK ||
            !enabled ||
            !ev.target.closest(fullSelector) ||
            (ignoreSelector && ev.target.closest(ignoreSelector))
        ) {
            return;
        }

        currentElement = ev.target.closest(elementSelector);

        Object.assign(offset, mouse);
    };

    /**
     * Window "mousemove" event handler.
     * @param {MouseEvent} ev
     */
    const onMousemove = (ev) => {
        updateMouseFromEvent(ev);

        if (!enabled || !currentElement) {
            return;
        }
        if (started) {
            // Updates the position of the dragged element.
            currentElement.style.left = `${clamp(
                mouse.x - offset.x,
                currentContainerRect.x,
                currentContainerRect.x + currentContainerRect.width - currentElementRect.width
            )}px`;
            currentElement.style.top = `${clamp(
                mouse.y - offset.y,
                currentContainerRect.y,
                currentContainerRect.y + currentContainerRect.height - currentElementRect.height
            )}px`;
        } else {
            dragStart();
        }
    };

    /**
     * Window "mouseup" event handler.
     * @param {MousEvent} ev
     */
    const onMouseup = (ev) => {
        updateMouseFromEvent(ev);
        dragStop();
    };

    /**
     * Main entry function to start a drag sequence.
     */
    const dragStart = () => {
        started = true;

        // Calculates the bounding rectangles of the current element, and of the
        // container element (`parentElement` or `ref.el`).
        const container = ref.el;
        const containerStyle = getComputedStyle(container);
        const [pleft, pright, ptop, pbottom] = [
            "padding-left",
            "padding-right",
            "padding-top",
            "padding-bottom",
        ].map((prop) => cssValueToNumber(containerStyle.getPropertyValue(prop)));

        currentElementRect = currentElement.getBoundingClientRect();
        currentContainerRect = container.getBoundingClientRect();
        const { x, y, width, height } = currentElementRect;

        // Reduces the container's dimensions according to its padding.
        currentContainerRect.x += pleft;
        currentContainerRect.width -= pleft + pright;
        currentContainerRect.y += ptop;
        currentContainerRect.height -= ptop + pbottom;

        // Binds handlers on eligible elements
        for (const siblingElement of ref.el.querySelectorAll(elementSelector)) {
            if (siblingElement !== currentElement) {
                cleanupManager
                    .addListener(siblingElement, "mouseenter", onElementMouseenter)
                    .addListener(siblingElement, "mouseleave", onElementMouseleave)
                    .addStyle(siblingElement, { "pointer-events": "auto" });
            }
        }

        execHandler("onStart", { element: currentElement });

        // Adjusts the offset
        offset.x -= x;
        offset.y -= y;

        const bodyStyle = {
            "pointer-events": "none",
            "user-select": "none",
        };
        if (cursor) {
            bodyStyle.cursor = cursor;
        }

        cleanupManager
            .addStyle(currentElement, {
                position: "fixed",
                "pointer-events": "none",
                "z-index": 1000,
                width: `${width}px`,
                height: `${height}px`,
                left: `${x}px`,
                top: `${y}px`,
            })
            .addStyle(document.body, bodyStyle);
    };

    /**
     * Main exit function to stop a drag sequence. Note that it can be called
     * even if a drag sequence did not start yet to perform a cleanup of all
     * current context variables.
     * @param {boolean} [inErrorState] can be set to true when an error
     *  occurred to avoid falling into an infinite loop if the error
     *  originated from one of the handlers.
     */
    const dragStop = (inErrorState) => {
        if (started) {
            if (!inErrorState) {
                execHandler("onStop", { element: currentElement });
                execHandler("onDrop", { element: currentElement });
            }
        }

        // Performes all registered clean-ups.
        cleanupManager.cleanup();

        currentContainerRect = null;

        currentElement = null;
        currentElementRect = null;

        started = false;
    };

    /**
     * @param {MouseEvent} ev
     */
    const updateMouseFromEvent = (ev) => {
        mouse.x = ev.clientX;
        mouse.y = ev.clientY;
    };

    // OWL HOOKS

    // Effect depending on the params to update them.
    useEffect(
        (...deps) => {
            const actualParams = Object.fromEntries(deps);
            enabled = Boolean(ref.el && !env.isSmall && actualParams.enable);
            if (!enabled) {
                return;
            }

            // Selectors
            elementSelector = actualParams.elements;
            if (!elementSelector) {
                throw draggableError(`no value found by "elements" selector: ${elementSelector}`);
            }
            const allSelectors = [elementSelector];
            cursor = actualParams.cursor;
            if (actualParams.handle) {
                allSelectors.push(actualParams.handle);
            }
            if (actualParams.ignore) {
                ignoreSelector = actualParams.ignore;
            }
            fullSelector = allSelectors.join(" ");
        },
        () => computeParams(params)
    );
    // Effect depending on the `ref.el` to add triggering mouse events listener.
    useEffect(
        (el) => {
            if (el) {
                el.addEventListener("mousedown", onMousedown);
                return () => el.removeEventListener("mousedown", onMousedown);
            }
        },
        () => [ref.el]
    );
    // Other global mouse event listeners.
    const debouncedMousemove = debounce(onMousemove, "animationFrame", true);
    useExternalListener(window, "mousemove", debouncedMousemove);
    useExternalListener(window, "mouseup", onMouseup);
    useExternalListener(window, "keydown", onKeydown, true);
    onWillUnmount(() => dragStop());
}
