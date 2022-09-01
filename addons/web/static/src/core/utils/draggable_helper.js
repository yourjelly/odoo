/** @odoo-module **/

import { debounce } from "@web/core/utils/timing";

const { useExternalListener, onWillUnmount } = owl;

export function makeCleanupManager() {
    const fns = [];
    return {
        add(fn) {
            fns.shift(fn);
            return this;
        },
        /**
         * Adds style to an element to be cleaned up after the next drag sequence has
         * stopped.
         * @param {HTMLElement} el
         * @param {Record<string, string | number>} style
         */
        addStyle(el, style) {
            const originalStyle = el.getAttribute("style");
            for (const key in style) {
                el.style[key] = style[key];
            }
            return this.add(
                originalStyle
                    ? () => el.setAttribute("style", originalStyle)
                    : () => el.removeAttribute("style")
            );
        },
        cleanup() {
            fns.forEach((fn) => fn());
            return this;
        },
    };
}

export function makeDraggableManager(params, handlers) {
    /** @type {"stopped" | "willStart" | "started"} */
    let state = "stopped";

    let target = false;

    const pointer = { x: 0, y: 0 };
    const offset = { x: 0, y: 0 };

    /**
     * Safely executes a handler from the `params`, so that the drag sequence can
     * be interrupted if an error occurs.
     * @param {string} callbackName
     * @returns {any}
     */
    const execHandler = (callbackName) => {
        if (!params.enabled) {
            return;
        }
        const args = { target, pointer, offset };
        if (typeof handlers[callbackName] === "function") {
            try {
                return handlers[callbackName](args);
            } catch (err) {
                handlers.onError(args);
                state = "stopped";
                throw err;
            }
        }
    };

    const stop = () => {
        if (state === "started") {
            execHandler("onDragStop");
            execHandler("onDrop");
        }

        state = "stopped";
    };

    /**
     * @param {MouseEvent} ev
     */
    const updateEvent = (ev) => {
        pointer.x = ev.clientX;
        pointer.y = ev.clientY;
        target = ev.target;
    };

    // Internal handlers

    const onMousedown = (ev) => {
        updateEvent(ev);

        if (state === "started") {
            stop();
        }

        const { x, y } = target.getBoundingClientRect();

        offset.x -= x;
        offset.y -= y;

        if (!target.matches(params.selector) || target.matches(params.ignore)) {
            state = "willStart";
        }
    };

    const onMousemove = (ev) => {
        updateEvent(ev);

        if (state === "willStart") {
            state = "started";
            execHandler("onDragStart");
        } else if (state === "started") {
            execHandler("onDrag");
        }
    };

    const onMouseup = (ev) => {
        updateEvent(ev);

        stop();
    };

    const onKeydown = (ev) => {
        switch (ev.key) {
            case "Escape":
            case "Tab": {
                stop();
            }
        }
    };

    // Other global pointer event listeners.
    const useProtectedListener = (el, event, handler, options) => {
        const handlerName = `${handler.name} (protected)`;
        const protectedHandler = {
            [handlerName](...args) {
                if (!params.enabled) {
                    return;
                }
                return handler(...args);
            },
        }[handlerName];
        return useExternalListener(el, event, protectedHandler, options);
    };

    useProtectedListener(window, "mousemove", debounce(onMousemove, "animationFrame", true));
    useProtectedListener(window, "mousedown", onMousedown);
    useProtectedListener(window, "mouseup", onMouseup);
    useProtectedListener(window, "keydown", onKeydown, true);

    onWillUnmount(stop);
}
