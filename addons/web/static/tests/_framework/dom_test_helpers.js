import { after } from "@odoo/hoot";
import {
    check,
    clear,
    click,
    drag,
    edit,
    fill,
    getActiveElement,
    hover,
    keyDown,
    keyUp,
    manuallyDispatchProgrammaticEvent,
    pointerDown,
    press,
    queryOne,
    scroll,
    select,
    uncheck,
    waitFor,
} from "@odoo/hoot-dom";
import { advanceFrame, advanceTime, animationFrame } from "@odoo/hoot-mock";

/**
 * @typedef {import("@odoo/hoot-dom").DragHelpers} DragHelpers
 * @typedef {import("@odoo/hoot-dom").FillOptions} FillOptions
 * @typedef {import("@odoo/hoot-dom").InputValue} InputValue
 * @typedef {import("@odoo/hoot-dom").KeyStrokes} KeyStrokes
 * @typedef {import("@odoo/hoot-dom").PointerOptions} PointerOptions
 * @typedef {import("@odoo/hoot-dom").Position} Position
 * @typedef {import("@odoo/hoot-dom").QueryOptions} QueryOptions
 * @typedef {import("@odoo/hoot-dom").Target} Target
 *
 * @typedef {{
 *  altKey?: boolean;
 *  ctrlKey?: boolean;
 *  metaKey?: boolean;
 *  shiftKey?: boolean;
 * }} KeyModifierOptions
 */

/**
 * @template T
 * @typedef {import("@odoo/hoot-dom").MaybePromise<T>} MaybePromise
 */

/**
 * @template T
 * @typedef {(...args: Parameters<T>) => MaybePromise<ReturnType<T>>} Promisify
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

/**
 * These params are used to move the pointer from an arbitrary distance in the
 * element to trigger a drag sequence (the distance required to trigger a drag
 * is defined by the `tolerance` option in the draggable hook builder).
 * @see {draggable_hook_builder.js}
 */
const DRAG_TOLERANCE_PARAMS = {
    position: {
        x: 100,
        y: 100,
    },
    relative: true,
};

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * @param {Target} target
 * @param {QueryOptions} [options]
 */
export function contains(target, options) {
    if (target?.raw) {
        return contains(String.raw(...arguments));
    }

    const focusCurrent = async () => {
        const actualNode = await node;
        if (actualNode !== getActiveElement()) {
            await pointerDown(actualNode);
        }
        return actualNode;
    };

    const node = waitFor(target, { visible: true, ...options });
    return {
        /**
         * @param {PointerOptions} [options]
         */
        check: async (options) => {
            await check(node, options);
            await animationFrame();
        },
        /**
         * @param {FillOptions} [options]
         */
        clear: async (options) => {
            await focusCurrent();
            await clear({ confirm: "auto", ...options });
            await animationFrame();
        },
        /**
         * @param {PointerOptions & KeyModifierOptions} [options]
         */
        click: async (options) => {
            const actions = [() => click(node, options)];
            if (options?.altKey) {
                actions.unshift(() => keyDown("Alt"));
                actions.push(() => keyUp("Alt"));
            }
            if (options?.ctrlKey) {
                actions.unshift(() => keyDown("Control"));
                actions.push(() => keyUp("Control"));
            }
            if (options?.metaKey) {
                actions.unshift(() => keyDown("Meta"));
                actions.push(() => keyUp("Meta"));
            }
            if (options?.shiftKey) {
                actions.unshift(() => keyDown("Shift"));
                actions.push(() => keyUp("Shift"));
            }

            for (const action of actions) {
                await action();
            }
            await animationFrame();
        },
        /**
         * @param {PointerOptions} [options]
         * @returns {Promise<DragHelpers>}
         */
        drag: async (options) => {
            /** @type {DragHelpers["cancel"]} */
            const asyncCancel = async () => {
                await cancel();
                await advanceFrame();
            };

            /** @type {DragHelpers["drop"]} */
            const asyncDrop = async () => {
                await drop();
                await advanceFrame();
            };

            /** @type {DragHelpers["moveTo"]} */
            const asyncMoveTo = async (to, options) => {
                await moveTo(to, options);
                await advanceFrame();
            };

            const { cancel, drop, moveTo } = await drag(node, options);
            await advanceTime(500); // Go past the touch delay

            await hover(node, DRAG_TOLERANCE_PARAMS);
            await advanceFrame();

            return {
                cancel: asyncCancel,
                drop: asyncDrop,
                moveTo: asyncMoveTo,
            };
        },
        /**
         * @param {Target} target
         * @param {PointerOptions} [options]
         */
        dragAndDrop: async (target, options) => {
            const [from, to] = await Promise.all([node, waitFor(target)]);

            const { drop, moveTo } = await drag(from);
            await advanceTime(500); // Go past the touch delay

            await hover(from, DRAG_TOLERANCE_PARAMS);
            await advanceFrame();

            await moveTo(to, options);
            await advanceFrame();

            await drop();
            await advanceFrame();
        },
        /**
         * @param {InputValue} value
         * @param {FillOptions} [options]
         */
        edit: async (value, options) => {
            await focusCurrent();
            await edit(value, { confirm: "auto", ...options });
            await animationFrame();
        },
        /**
         * @param {InputValue} value
         * @param {FillOptions} [options]
         */
        fill: async (value, options) => {
            await focusCurrent();
            await fill(value, { confirm: "auto", ...options });
            await animationFrame();
        },
        focus: async () => {
            await focusCurrent();
            await animationFrame();
        },
        hover: async () => {
            await hover(node);
            await animationFrame();
        },
        /**
         * @param {KeyStrokes} keyStrokes
         * @param {KeyboardEventInit} [options]
         */
        press: async (keyStrokes, options) => {
            await focusCurrent();
            await press(keyStrokes, options);
            await animationFrame();
        },
        /**
         * @param {Position} position
         */
        scroll: async (position) => {
            await scroll(node, position);
            await animationFrame();
        },
        /**
         * @param {InputValue} value
         */
        select: async (value) => {
            await select(value, { target: node });
            await animationFrame();
        },
        /**
         * @param {PointerOptions} [options]
         */
        uncheck: async (options) => {
            await uncheck(node, options);
            await animationFrame();
        },
    };
}

/**
 * @param {string} style
 */
export function defineStyle(style) {
    const styleEl = document.createElement("style");
    styleEl.textContent = style;

    document.head.appendChild(styleEl);
    after(() => styleEl.remove());
}

/**
 * @param {string} value
 */
export async function editAce(value) {
    // Ace editor traps focus on "mousedown" events, which are not triggered in
    // mobile. To support both environments, a single "mouedown" event is triggered
    // in this specific case. This should not be reproduced and is only accepted
    // because the tested behaviour comes from a lib on which we have no control.
    manuallyDispatchProgrammaticEvent(queryOne(".ace_editor .ace_content"), "mousedown");

    await contains(".ace_editor textarea", { displayed: true, visible: false }).edit(value, {
        instantly: true,
    });
}
