/** @odoo-module **/

import { matchMedia, navigator, ontouchstart } from "../globals";
import { copy, isIterable } from "../utils";
import {
    config as DOMConfig,
    getActiveElement,
    getNextFocusableElement,
    getPreviousFocusableElement,
    getRect,
    isEditable,
    isEventTarget,
    isFocusable,
    parseCoordinates,
    queryAll,
    queryOne,
    toSelector,
} from "./dom";

/**
 * @typedef {import("./dom").Coordinates} Coordinates
 *
 * @typedef {keyof HTMLElementEventMap | keyof WindowEventMap} EventType
 *
 * @typedef {import("./dom").QueryOptions} QueryOptions
 *
 * @typedef {QueryOptions & {
 *  button?: number,
 *  position?: Side | `${Side}-${Side}` | Coordinates;
 *  relative?: boolean;
 * }} PointerOptions
 *
 * @typedef {"bottom" | "left" | "right" | "top"} Side
 *
 * @typedef {import("./dom").Target} Target
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

/**
 * @template {HTMLElement} T
 * @param {T} element
 */
const expect = (element) => {
    let errors = [];
    const elementTag = element.tagName.toLowerCase();

    /**
     * @param  {...string} tags
     */
    const hasTag = (...tags) => {
        if (!tags.some((tag) => tag === elementTag)) {
            errors.push(
                `expected tag name ${tags.map((tag) => `"${tag}"`).join(" or ")}, got <${
                    element.tagName
                }/>`
            );
        }
        return handlers;
    };

    /**
     *
     * @param {(element: T) => boolean} filter
     */
    const validates = (filter) => {
        if (!filter(element)) {
            errors.push(`does not validate constraint '${filter.name}'`);
        }
        return handlers;
    };

    const throwErrors = () => {
        if (errors.length) {
            throw new Error(
                `Element <${elementTag}/> fails the following assertions: ` +
                    errors.map((err) => `- ${err}`).join("\n")
            );
        }
    };

    const handlers = {
        get errors() {
            return errors;
        },
        get or() {
            errors = [];
            return handlers;
        },
        hasTag,
        validates,
        throw: throwErrors,
    };

    return handlers;
};

/**
 * Returns the list of nodes containing n2 (included) that do not contain n1.
 *
 * @param {HTMLOrSVGElement} el1
 * @param {HTMLOrSVGElement} el2
 */
const getDifferentParents = (el1, el2) => {
    const parents = [el2];
    while (parents[0].parentElement) {
        const parent = parents[0].parentElement;
        if (parent.contains(el1)) {
            break;
        }
        parents.unshift(parent);
    }
    return parents;
};

/**
 * @template {typeof Event} T
 * @param {EventType} eventType
 * @returns {[T, (attrs: EventInit) => EventInit]}
 */
const getEventConstructor = (eventType) => {
    switch (eventType) {
        // Mouse events
        case "auxclick":
        case "click":
        case "contextmenu":
        case "dblclick":
        case "mousedown":
        case "mouseup":
        case "mousemove":
        case "mouseover":
        case "mouseout":
            return [MouseEvent, mapBubblingPointerEvent];
        case "mouseenter":
        case "mouseleave":
            return [MouseEvent, mapNonBubblingPointerEvent];

        // Pointer events
        case "pointerdown":
        case "pointerup":
        case "pointermove":
        case "pointerover":
        case "pointerout":
            return [PointerEvent, mapBubblingPointerEvent];
        case "pointerenter":
        case "pointerleave":
        case "pointercancel":
            return [PointerEvent, mapNonBubblingPointerEvent];

        // Focus events
        case "focusin":
            return [FocusEvent, mapBubblingEvent];
        case "focus":
        case "blur":
            return [FocusEvent, mapNonBubblingEvent];

        // Clipboard events
        case "cut":
        case "copy":
        case "paste":
            return [ClipboardEvent, mapBubblingEvent];

        // Keyboard events
        case "keydown":
        case "keypress":
        case "keyup":
            return [KeyboardEvent, mapKeyboardEvent];

        // Drag events
        case "drag":
        case "dragend":
        case "dragenter":
        case "dragstart":
        case "dragleave":
        case "dragover":
        case "drop":
            return [DragEvent, mapBubblingEvent];

        // Input events
        case "input":
            return [InputEvent, mapBubblingEvent];

        // Composition events
        case "compositionstart":
        case "compositionend":
            return [CompositionEvent, mapBubblingEvent];

        // Touch events
        case "touchstart":
        case "touchend":
        case "touchmove":
            return [TouchEvent, mapCancelableTouchEvent];
        case "touchcancel":
            return [TouchEvent, mapNonCancelableTouchEvent];

        // Resize events
        case "resize":
            return [Event, mapNonBubblingEvent];

        // Submit events
        case "submit":
            return [SubmitEvent, mapBubblingCancelableEvent];

        // Wheel events
        case "wheel":
            return [WheelEvent, mapBubblingEvent];

        // Default: base Event constructor
        default:
            return [Event, mapBubblingEvent];
    }
};

/**
 * @param {HTMLElement} element
 * @param {PointerOptions} [options]
 */
const getPosition = (element, options) => {
    const { position, relative } = options || {};
    const isObject = position && typeof position === "object";

    if (isObject && !relative && !isNaN(position.x) && !isNaN(position.y)) {
        // Absolute position
        return {
            clientX: position.x || 0,
            clienty: position.y || 0,
        };
    }

    const { x, y, width, height } = getRect(element);
    let clientX = Math.floor(x);
    let clientY = Math.floor(y);

    if (isObject) {
        if (isNaN(position.x)) {
            clientX += Math.floor(width / 2);
        } else {
            if (relative) {
                clientX += position.x || 0;
            } else {
                clientX = position.x || 0;
            }
        }

        if (isNaN(position.y)) {
            clientY += Math.floor(height / 2);
        } else {
            if (relative) {
                clientY += position.y || 0;
            } else {
                clientY = position.y || 0;
            }
        }
    } else {
        const positions = typeof position === "string" ? position.split("-") : [];

        // X position
        if (positions.includes("left")) {
            clientX -= 1;
        } else if (positions.includes("right")) {
            clientX += Math.ceil(width) + 1;
        } else {
            clientX += Math.floor(width / 2);
        }

        // Y position
        if (positions.includes("top")) {
            clientY -= 1;
        } else if (positions.includes("bottom")) {
            clientY += Math.ceil(height) + 1;
        } else {
            clientY += Math.floor(height / 2);
        }
    }

    return { clientX, clientY };
};

/**
 * @param {Target} target
 * @param {QueryOptions} options
 */
const getTriggerTargets = (target, options) =>
    isEventTarget(target) ? [target] : queryAll(target, options);

const hasTouch = () => ontouchstart !== undefined || matchMedia("(pointer:coarse)").matches;

const isMacOS = () => /Mac/i.test(navigator.userAgent);

/**
 * @param {Event} event
 */
const isPrevented = (event) => event && event.defaultPrevented;

const logEvents = (() => {
    const flushEventLog = () => {
        const groupName = ["<triggered", allEvents.length, "events>"];
        console.groupCollapsed(...groupName);
        for (const event of allEvents) {
            const { target } = event;
            /** @type {(keyof typeof LOG_COLORS)[]} */
            const colors = ["blue"];

            const typeList = [event.type];
            if (event.key) {
                typeList.push(event.key);
            } else if (event.button) {
                typeList.push(event.button);
            }
            [...Array(typeList.length)].forEach(() => colors.push("orange"));

            const targetParts = toSelector(target, { object: true });
            colors.push("blue");
            if (targetParts.id) {
                colors.push("orange");
            }
            if (targetParts.class) {
                colors.push("lightBlue");
            }

            const typeString = typeList.map((t) => `%c"${t}"%c`).join(", ");
            const targetString = Object.values(targetParts)
                .map((part) => `%c${part}%c`)
                .join("");
            const message = `%c${event.constructor.name}%c<${typeString}> @${targetString}`;
            const messageColors = colors
                .map((color) => [
                    `color: ${LOG_COLORS[color]}; font-weight: normal`,
                    `color: ${LOG_COLORS.reset}`,
                ])
                .flat();

            console.groupCollapsed(message, ...messageColors);
            console.dir(event);
            console.log(event.target);
            console.groupEnd(message);
        }
        console.groupEnd(...groupName);
        allEvents = [];
    };

    let allEvents = [];
    let handle = 0;

    /**
     * @template {any[]} T
     * @param {string} groupName
     * @param {T} events
     */
    return function logEvents(events) {
        if (config.log) {
            allEvents.push(...events);
            cancelAnimationFrame(handle);
            handle = requestAnimationFrame(flushEventLog);
        }

        return events;
    };
})();

/**
 * @param {string | string[]} keyStrokes
 */
const parseKeyStroke = (keyStrokes) => {
    const keys = (isIterable(keyStrokes) ? [...keyStrokes] : [keyStrokes])
        .map((keyStroke) => keyStroke.split(/[\s,+]+/))
        .flat();

    /** @type {KeyboardEventInit} */
    const eventInit = { key: keys.at(-1) };

    for (const key of keys) {
        switch (key.toLowerCase()) {
            case "alt":
                if (isMacOS()) {
                    eventInit.ctrlKey = true;
                } else {
                    eventInit.altKey = true;
                }
                break;
            case "ctrl":
            case "control":
                if (isMacOS()) {
                    eventInit.metaKey = true;
                } else {
                    eventInit.ctrlKey = true;
                }
                break;
            case "caps":
            case "shift":
                eventInit.shiftKey = true;
                break;
        }
    }

    return eventInit;
};

/**
 * @template {EventType} T
 * @param {EventTarget} target
 * @param {T} type
 * @param {EventInit} [eventInit]
 * @returns {GlobalEventHandlersEventMap[T]}
 */
const triggerEvent = (target, type, eventInit) => {
    const [Constructor, processParams] = getEventConstructor(type);
    const event = new Constructor(type, processParams(eventInit));

    // Check special methods
    if (typeof target[type] === "function") {
        switch (type) {
            case "blur":
            case "focus":
            case "submit":
                target[type]();
                break;
        }
    }

    target.dispatchEvent(event);

    return event;
};

/**
 * @param {EventTarget} target
 */
const triggerFocus = (target) => {
    const previous = getActiveElement();
    /** @type {ReturnType<typeof triggerEvent<"focus">>[]} */
    const events = [];
    if (previous !== target.ownerDocument.body) {
        events.push(triggerEvent(previous, "blur", { relatedTarget: target }));
    }
    if (isFocusable(target)) {
        events.push(triggerEvent(target, "focus", { relatedTarget: previous }));
    }
    return events;
};

/**
 * @param {EventTarget} target
 * @param {KeyboardEventInit} eventInit
 */
const triggerKeyDown = (target, eventInit) => {
    const events = [triggerEvent(target, "keydown", eventInit)];
    if (!isPrevented(events[0])) {
        switch (eventInit.key) {
            /**
             * Special trigger: shift focus
             *  On: unprevented 'Tab' keydown
             *  Do: focus next (or previous with 'shift') focusable element
             */
            case "Tab": {
                const next = eventInit.shiftKey
                    ? getPreviousFocusableElement()
                    : getNextFocusableElement();
                events.push(...triggerFocus(next));
                break;
            }
            /**
             * Special trigger: copy
             *  On: unprevented 'ctrl + c' keydown
             *  Do: copy current selection to clipboard
             */
            case "c": {
                if (eventInit.ctrlKey) {
                    copy(window.getSelection());
                }
                break;
            }
            /**
             * Special trigger: paste
             *  On: unprevented 'ctrl + v' keydown on editable element
             *  Do: paste current clipboard content to current element
             */
            case "v": {
                if (eventInit.ctrlKey && isEditable(target)) {
                    navigator.clipboard.readText().then((value) => (target.value = value));
                }
                break;
            }
        }
    }
    return events;
};

/**
 * @param {EventTarget} target
 * @param {KeyboardEventInit} eventInit
 * @param {string} [value]
 */
const triggerKeyPress = (target, eventInit, value) => {
    /**
     * @type {ReturnType<typeof triggerKeyDown>
     *  | ReturnType<typeof triggerKeyUp>
     *  | ReturnType<typeof triggerEvent<"keypress">>[]
     * }
     */
    const events = [];
    const keyDownEvents = triggerKeyDown(target, eventInit);
    events.push(...keyDownEvents, ...triggerKeyUp(target, eventInit));
    let prevented = isPrevented(keyDownEvents[0]);

    if (!prevented) {
        if (isEditable(target)) {
            if (typeof value === "string") {
                // Hard-coded value from a special action (clear/fill all)
                target.value = value;
            } else if (/\w/.test(eventInit.key)) {
                // Character coming from the keystroke
                // ! TODO: Doesn't work with non-roman locales
                target.value += eventInit.shiftKey
                    ? eventInit.key.toUpperCase()
                    : eventInit.key.toLowerCase();
            }
        }

        const keyPressEvent = triggerEvent(target, "keypress", eventInit);
        events.push(keyPressEvent);
        prevented = isPrevented(keyPressEvent[0]);
    }

    if (!prevented && eventInit.key === "Enter") {
        const parentForm = target.closest("form");
        if (target.tagName === "BUTTON" && target.type === "button") {
            /**
             * Special trigger: button 'Enter'
             *  On: unprevented 'Enter' keydown & keypress on a <button type="button"/>
             *  Do: triggers a 'click' event on the button
             */
            events.push(triggerEvent(target, "click"));
        } else if (parentForm) {
            /**
             * Special trigger: form 'Enter'
             *  On: unprevented 'Enter' keydown & keypress on any element that
             *      is not a <button type="button"/> in a form element
             *  Do: triggers a 'submit' event on the form
             */
            events.push(triggerEvent(parentForm, "submit"));
        }
    }
    return events;
};

/**
 * @param {EventTarget} target
 * @param {KeyboardEventInit} eventInit
 */
const triggerKeyUp = (target, eventInit) => {
    return [triggerEvent(target, "keyup", eventInit)];
};

/**
 * @param {EventTarget} target
 * @param {PointerEventInit} eventInit
 */
const triggerPointerDown = (target, eventInit) => {
    const events = [triggerEvent(target, "pointerdown", eventInit)];

    if (!isPrevented(events[0])) {
        // pointer events are triggered along their related counterparts:
        // - mouse events in desktop environment
        // - touch events in mobile environment
        const relatedType = hasTouch() ? "touchstart" : "mousedown";
        const relatedEvent = triggerEvent(target, relatedType);
        events.push(relatedEvent);

        if (!isPrevented(relatedEvent)) {
            // Focus the element (if focusable)
            events.push(...triggerFocus(target));
            if (eventInit.button === 2) {
                /**
                 * Special trigger: context menu
                 *  On: unprevented 'pointerdown' with right click and its related
                 *      event on an element
                 *  Do: triggers a 'contextmenu' event
                 */
                events.push(triggerEvent(target, "contextmenu", eventInit));
            }
        }
    }
    return events;
};

/**
 * @param {EventTarget} target
 * @param {PointerEventInit} eventInit
 */
const triggerPointerUp = (target, eventInit) => {
    const events = [triggerEvent(target, "pointerup", eventInit)];
    if (!events.some(isPrevented)) {
        // pointer events are triggered along their related counterparts:
        // - mouse events in desktop environment
        // - touch events in mobile environment
        const relatedType = hasTouch() ? "touchend" : "mouseup";
        events.push(triggerEvent(target, relatedType));
    }
    return events;
};

//-----------------------------------------------------------------------------
// Event init attributes mappers
//-----------------------------------------------------------------------------

/** @param {EventInit} [eventInit] */
const mapBubblingEvent = (eventInit) => ({
    ...eventInit,
    bubbles: true,
});

/** @param {EventInit} [eventInit] */
const mapBubblingCancelableEvent = (eventInit) => ({
    ...mapBubblingEvent(eventInit),
    cancelable: true,
});

/** @param {EventInit} [eventInit] */
const mapNonBubblingEvent = (eventInit) => ({
    ...eventInit,
    bubbles: false,
});

/** @param {PointerEventInit} [eventInit] */
const mapBubblingPointerEvent = (eventInit) => ({
    clientX: eventInit?.clientX ?? eventInit?.pageX ?? 0,
    clientY: eventInit?.clientY ?? eventInit?.pageY ?? 0,
    view: DOMConfig.defaultView,
    ...mapBubblingCancelableEvent(eventInit),
});

/** @param {PointerEventInit} [eventInit] */
const mapNonBubblingPointerEvent = (eventInit) => ({
    ...mapBubblingPointerEvent(eventInit),
    bubbles: false,
    cancelable: false,
});

/** @param {TouchEventInit} [eventInit] */
const mapCancelableTouchEvent = (eventInit) => ({
    view: DOMConfig.defaultView,
    ...mapBubblingCancelableEvent(eventInit),
    composed: true,
    touches: eventInit?.touches ? [...eventInit.touches.map((e) => new Touch(e))] : undefined,
});

/** @param {TouchEventInit} [eventInit] */
const mapNonCancelableTouchEvent = (eventInit) => ({
    ...mapCancelableTouchEvent(eventInit),
    cancelable: false,
});

/** @param {TouchEventInit} [eventInit] */
const mapKeyboardEvent = (eventInit) => ({
    view: DOMConfig.defaultView,
    ...mapBubblingCancelableEvent(eventInit),
});

const LOG_COLORS = {
    blue: "#5db0d7",
    orange: "#f29364",
    lightBlue: "#9bbbdc",
    reset: "inherit",
};

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export function clear() {
    /**
     * @type {ReturnType<typeof triggerEvent<"input">>[]
     *  | ReturnType<typeof triggerEvent<"change">>[]
     * }
     */
    const events = [];
    const element = getActiveElement();

    expect(element).hasTag("select").or.validates(isEditable).throw();

    if (isEditable(element)) {
        events.push(...config.defaultActions.clear(element));
        events.push(triggerEvent(element, "input"));
    } else {
        element.selectedIndex = -1;
    }
    events.push(triggerEvent(element, "change"));
    return logEvents(events);
}

/**
 * @param {Target} target
 * @param {PointerOptions & { count?: number }} [options]
 */
export function click(target, options) {
    /**
     * @type {ReturnType<typeof triggerPointerDown>
     *  | ReturnType<typeof triggerPointerUp>
     *  | ReturnType<typeof triggerEvent<"click">>[]
     *  | ReturnType<typeof triggerEvent<"dblclick">>[]
     * }
     */
    const events = [];
    for (const element of getTriggerTargets(target, options)) {
        const pointerInit = {
            ...getPosition(element, options),
            button: options?.button || 0,
        };
        for (let i = 0; i < (options?.count || 1); i++) {
            events.push(
                ...triggerPointerDown(element, pointerInit),
                ...triggerPointerUp(element, pointerInit),
                triggerEvent(element, "click", pointerInit)
            );
            if (!hasTouch() && i && i % 2 === 0) {
                events.push(triggerEvent(element, "dblclick", pointerInit));
            }
        }
    }
    return logEvents(events);
}

/**
 * Helper performing a drag.
 *
 * - the 'from' selector is used to determine the element on which the drag will
 *  start;
 * - the 'target' selector will determine the element on which the dragged element will be
 * moved.
 *
 * Returns a drop function
 *
 * @param {Target} target
 * @param {PointerOptions} [options]
 */
export function drag(target, options) {
    /**
     * @template T
     * @param {T} fn
     * @param {boolean} endDrag
     * @returns {T}
     */
    const expectIsDragging = (fn, endDrag) => {
        return {
            [fn.name](...args) {
                if (dragEndReason) {
                    throw new Error(
                        `Cannot execute drag helper '${fn.name}': drag sequence has been ended by '${dragEndReason}'.`
                    );
                }
                fn(...args);
                if (endDrag) {
                    dragEndReason = fn.name;
                }
            },
        }[fn.name];
    };

    const cancel = expectIsDragging(function cancel() {
        events.push(...config.defaultActions.dragCancel(DOMConfig.defaultView));
        return logEvents(events);
    }, true);

    const drop = expectIsDragging(
        /**
         * @param {Target} [to]
         * @param {PointerOptions} [options]
         */
        function drop(to, options) {
            if (to) {
                moveTo(to, options);
            }
            events.push(...triggerPointerUp(currentTarget || source, targetPosition));
            if (canTriggerDragEvents) {
                /**
                 * Special trigger: drag events
                 *  On: unprevented 'pointerdown' and related events not immediatly
                 *      followed by a pointer up sequence
                 *  Do: trigger drag events along the pointer events
                 */
                events.push(triggerEvent(currentTarget || source, "dragend", targetPosition));
            }
            return logEvents(events);
        },
        true
    );

    const moveTo = expectIsDragging(
        /**
         * @param {Target} [to]
         * @param {PointerOptions} [options]
         */
        function moveTo(to, options) {
            currentTarget = queryOne(to);
            if (!currentTarget) {
                return;
            }

            // Recompute target position
            targetPosition = getPosition(currentTarget, options);

            // Move, enter and drop the element on the target
            events.push(triggerEvent(source, "pointermove", targetPosition));
            if (!hasTouch()) {
                events.push(triggerEvent(source, "mousemove", targetPosition));
            }
            if (canTriggerDragEvents) {
                events.push(triggerEvent(source, "drag", targetPosition));
            }

            // "pointerenter" is fired on every parent of `target` that do not contain
            // `from` (typically: different parent lists).
            for (const parent of getDifferentParents(source, currentTarget)) {
                events.push(triggerEvent(parent, "pointerenter", targetPosition));
                if (!hasTouch()) {
                    events.push(triggerEvent(source, "mouseenter", targetPosition));
                }
                if (canTriggerDragEvents) {
                    events.push(triggerEvent(parent, "dragenter", targetPosition));
                }
            }

            return dragHelpers;
        },
        false
    );

    const dragHelpers = { cancel, drop, moveTo };

    const source = queryOne(target);

    let dragEndReason = null;
    let currentTarget;
    let targetPosition;

    // Pointer down on main target
    const startEventInit = {
        ...getPosition(source, options),
        button: options?.button || 0,
    };

    /**
     * @type {ReturnType<typeof triggerPointerDown>
     *  | ReturnType<typeof triggerPointerUp>
     *  | ReturnType<typeof triggerKeyPress>
     *  | ReturnType<typeof triggerEvent<"pointermove">>[]
     *  | ReturnType<typeof triggerEvent<"mousemove">>[]
     *  | ReturnType<typeof triggerEvent<"pointerenter">>[]
     *  | ReturnType<typeof triggerEvent<"mouseenter">>[]
     *  | ReturnType<typeof triggerEvent<"dragstart">>[]
     *  | ReturnType<typeof triggerEvent<"drag">>[]
     *  | ReturnType<typeof triggerEvent<"dragend">>[]
     * }
     */
    const events = [...triggerPointerDown(source, startEventInit)];
    const canTriggerDragEvents = source.draggable && !events.slice(0, 2).some(isPrevented);

    if (canTriggerDragEvents) {
        events.push(triggerEvent(source, "dragstart", startEventInit));
    }

    return dragHelpers;
}

/**
 * @param {string | number | File | File[]} value
 * @param {{ allAtOnce?: boolean }} [options]
 */
export function fill(value, options) {
    /**
     * @type {ReturnType<typeof triggerKeyDown>
     *  | ReturnType<typeof triggerKeyUp>
     *  | ReturnType<typeof triggerEvent<"input">>[]
     *  | ReturnType<typeof triggerEvent<"change">>[]
     * }
     */
    const events = [];
    const element = getActiveElement();

    expect(element).validates(isEditable).throw();

    let prevented = false;
    if (element.tagName === "INPUT" && element.type === "file") {
        const dataTransfer = new DataTransfer();
        for (const file of isIterable(value) ? value : [value]) {
            if (!(file instanceof File)) {
                throw new Error(`File input value should be one or several File objects.`);
            }
            dataTransfer.items.add(file);
        }
        element.files = dataTransfer.files;
    } else if (isEditable(element)) {
        if (options?.allAtOnce) {
            events.push(...config.defaultActions.fillAll(element));
            events.push(triggerEvent(element, "input"));
        } else {
            for (const char of value) {
                const key = char.toLowerCase();
                const keyPressEvents = triggerKeyPress(element, {
                    shiftKey: key !== char,
                    key,
                });
                events.push(...keyPressEvents);
                prevented = isPrevented(keyPressEvents[0]);

                if (!prevented) {
                    events.push(triggerEvent(element, "input"));
                }
            }
        }
    }

    if (!prevented) {
        events.push(triggerEvent(element, "change"));
    }
    return logEvents(events);
}

/**
 * @param {Target} target
 * @param {PointerOptions} [options]
 */
export function hover(target, options) {
    /** @type {PointerEvent[]} */
    const events = [];
    for (const element of getTriggerTargets(target, options)) {
        const position = getPosition(element, options);
        events.push(
            triggerEvent(element, "pointerover", position),
            triggerEvent(element, "pointerenter", position),
            triggerEvent(element, "pointermove", position)
        );
        if (!hasTouch()) {
            events.push(triggerEvent(element, "mousemove", position));
        }
    }
    return logEvents(events);
}

/**
 * @param {string | string[]} keyStrokes
 */
export function keyDown(keyStrokes) {
    const eventInit = parseKeyStroke(keyStrokes);
    const events = [triggerKeyDown(getActiveElement(), eventInit)];
    return logEvents(events);
}

/**
 * @param {string | string[]} keyStrokes
 */
export function keyUp(keyStrokes) {
    const eventInit = parseKeyStroke(keyStrokes);
    const events = [triggerKeyUp(getActiveElement(), eventInit)];
    return logEvents(events);
}

/**
 * @param {Target} target
 * @param {PointerOptions} [options]
 */
export function leave(target, options) {
    /** @type {PointerEvent[]} */
    const events = [];
    for (const element of queryAll(target, options)) {
        const position = getPosition(options);
        events.push(triggerEvent(element, "pointermove", position));
        if (!hasTouch()) {
            events.push(triggerEvent(element, "mousemove", position));
        }
        events.push(
            triggerEvent(element, "pointerout", position),
            triggerEvent(element, "pointerleave", position)
        );
    }
    return logEvents(events);
}

/**
 * @template {EventType} T
 * @param {EventTarget | Target} target
 * @param {T} type
 * @param {(event: GlobalEventHandlersEventMap[T]) => any} listener
 * @param {boolean | AddEventListenerOptions} [options]
 */
export function on(target, type, listener, options) {
    const targets = isEventTarget(target) ? [target] : queryAll(target);
    for (const element of targets) {
        element.addEventListener(type, listener, options);
    }
    return function off() {
        for (const element of targets) {
            element.removeEventListener(type, listener, options);
        }
    };
}

/**
 *
 * @param {Target} target
 * @param {QueryOptions} options
 */
export function pointerDown(target, options) {
    const events = [];
    for (const element of getTriggerTargets(target, options)) {
        const pointerInit = {
            ...getPosition(element, options),
            button: options?.button || 0,
        };
        for (let i = 0; i < (options?.count || 1); i++) {
            events.push(...triggerPointerDown(element, pointerInit));
        }
    }
    return logEvents(events);
}

/**
 *
 * @param {Target} target
 * @param {QueryOptions} options
 */
export function pointerUp(target, options) {
    /** @type {ReturnType<typeof triggerPointerUp>} */
    const events = [];
    for (const element of getTriggerTargets(target, options)) {
        const pointerInit = {
            ...getPosition(element, options),
            button: options?.button || 0,
        };
        for (let i = 0; i < (options?.count || 1); i++) {
            events.push(...triggerPointerUp(element, pointerInit));
        }
    }
    return logEvents(events);
}

/**
 * @param {string | string[]} keyStrokes
 */
export function press(keyStrokes) {
    const eventInit = parseKeyStroke(keyStrokes);
    const events = [...triggerKeyPress(getActiveElement(), eventInit)];
    return logEvents(events);
}

/**
 *
 * @param {Target} target
 * @param {Coordinates} coordinates
 * @param {QueryOptions} options
 */
export function scroll(target, coordinates, options) {
    /** @type {ReturnType<typeof triggerEvent<"scroll">>[]} */
    const events = [];
    /** @type {ScrollToOptions} */
    const scrollOptions = {};
    const [left, top] = parseCoordinates(coordinates);
    if (left !== null) {
        scrollOptions.left = left;
    }
    if (top !== null) {
        scrollOptions.top = top;
    }
    for (const element of getTriggerTargets(target, { ...options, scrollable: true })) {
        if (!hasTouch()) {
            events.push(triggerEvent(target, "wheel"));
        }
        element.scrollTo(scrollOptions);
        events.push(triggerEvent(element, "scroll"));
    }
    return logEvents(events);
}

/**
 * @param {Target} target
 * @param {string | number} value
 * @param {QueryOptions} [options]
 */
export function select(target, value, options) {
    /** @type {ReturnType<typeof triggerEvent<"change">>[]} */
    const events = [];
    for (const element of getTriggerTargets(target, options)) {
        expect(element).hasTag("select").throw();

        element.value = String(value);
        events.push(triggerEvent(element, "change"));
    }
    return logEvents(events);
}

export const config = {
    defaultActions: {
        // To clear input: remove all text with Backspace (Control + Backspace)
        clear: (target) => triggerKeyPress(target, { ctrlKey: true, key: "Backspace" }, ""),
        // To cancel a drag sequence: press 'Escape'
        dragCancel: (target) => triggerKeyPress(target, { key: "Escape" }),
        // To fill all at once: paste from clipboard (Control + V)
        fillAll: (target, value) => triggerKeyPress(target, { ctrlKey: true, key: "v" }, value),
    },
    log: Boolean(odoo.debug),
};
